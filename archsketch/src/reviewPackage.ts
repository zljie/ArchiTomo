import { projection, ROLE_NAMES, type Design } from './design.ts';
import type { Project } from './project.ts';
import { toSvg } from './model.ts';
import { toAdr } from './adr.ts';
import { completeness } from './completeness.ts';
import { PROFILE, profileFindings } from './profile.ts';
import { decisionState, DECISION_STATE_NAMES } from './decisions.ts';
/** 评审版 HTML、多视图导出与交付包（STORY-034 AC-02/03、STORY-035）：都从同一已保存修订生成，内容可复现。 */
export type PackageFile={path:string;content:string};
const esc=(v:unknown)=>String(v??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'})[c]!);
function snapshot(p:Project,revisionId=p.headRevisionId):Design{const r=p.revisions.find(x=>x.id===revisionId);if(!r)throw Error('修订不存在');return r.snapshot;}
/** 可绘制的视图：非空且每个元素都有坐标。 */
function drawable(d:Design){return d.views.filter(v=>v.nodeIds.length&&v.nodeIds.every(id=>v.positions[id]));}
const svgOf=(d:Design,v:Design['views'][number])=>toSvg(projection(d,v));
export function reviewHtml(p:Project,revisionId=p.headRevisionId):string{
 const d=snapshot(p,revisionId);const views=drawable(d);const skipped=d.views.filter(v=>v.nodeIds.length&&!views.includes(v));
 const items=completeness(d,p.questions);const findings=profileFindings(d);const sev=(s:string)=>findings.filter(f=>f.severity===s).length;
 const unconfirmed=(d.constraints||[]).filter(c=>c.status!=='confirmed'||!c.value.trim());
 const toc=[['overview','1. 概览'],['goals','2. 目标与约束'],['views','3. 架构视图'],['decisions','4. 关键决策'],['open','5. 未决事项'],['quality','6. 质量与证据'],['appendix','附录']];
 const out=[`<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(d.title)} · 评审版</title>`,
  '<style>body{font:14px/1.6 system-ui,sans-serif;max-width:1100px;margin:0 auto;padding:24px 16px;color:#1d2330;background:#fff}nav{background:#f4f6fa;border-radius:8px;padding:12px 16px}figure{margin:12px 0;overflow-x:auto;border:1px solid #e1e5ec;border-radius:8px;padding:8px}figure svg{max-width:100%;height:auto}table{border-collapse:collapse;width:100%}td,th{border:1px solid #e1e5ec;padding:6px 8px;text-align:left;vertical-align:top}.state{font-weight:600}pre{white-space:pre-wrap;background:#f7f8fa;padding:8px;border-radius:6px}</style></head><body>',
  `<h1>${esc(d.title)} · 架构评审版</h1><p>由 ArchSketch 从同一已保存修订生成；“待确认”的数值只是前提，不是已验证事实；本文件不代表架构已被接受。</p>`,
  `<nav aria-label="目录"><strong>目录</strong><ol>${toc.map(([id,n])=>`<li><a href="#${id}">${n}</a></li>`).join('')}</ol></nav>`,
  `<section id="overview"><h2>1. 概览</h2><p>${d.nodes.length} 个对象、${d.relationships.length} 条关系、${views.length} 张视图图、${d.decisions.length} 项决策；规则检查 ${sev('error')} 阻断级 / ${sev('warning')} 提示（${esc(PROFILE.profileId)} ${esc(PROFILE.version)}）；${items.length} 项待完成。不出单一质量分。</p></section>`,
  `<section id="goals"><h2>2. 目标与约束</h2><ul>${d.nodes.filter(n=>['goal','constraint','quality'].includes(n.level)).map(n=>`<li>${esc(ROLE_NAMES[n.role]||n.role)}：${esc(n.name)}${n.description?' — '+esc(n.description):''}</li>`).join('')||'<li>暂无</li>'}</ul>`,
  `<table><thead><tr><th>约束</th><th>数值</th><th>状态</th></tr></thead><tbody>${(d.constraints||[]).map(c=>`<tr><td>${esc(c.name)}</td><td>${esc(c.value||'未填写')}${esc(c.unit)}</td><td>${c.status==='confirmed'?'已确认':'待确认'}</td></tr>`).join('')||'<tr><td colspan="3">暂无</td></tr>'}</tbody></table></section>`,
  `<section id="views"><h2>3. 架构视图</h2>${views.map(v=>`<section><h3>${esc(v.name)}</h3><figure>${svgOf(d,v)}</figure></section>`).join('')}${skipped.length?`<p>以下视图有对象但尚未布局，未出图：${skipped.map(v=>esc(v.name)).join('、')}</p>`:''}</section>`,
  `<section id="decisions"><h2>4. 关键决策</h2><table><thead><tr><th>决策</th><th>状态</th><th>已选方案</th><th>理由</th><th>取舍</th><th>确认人</th></tr></thead><tbody>${d.decisions.map(dec=>`<tr><td>${esc(dec.title)}</td><td class="state">${DECISION_STATE_NAMES[decisionState(dec)]}</td><td>${esc(dec.candidates.find(c=>c.id===dec.selectedId)?.name||'—')}</td><td>${esc(dec.reason||'待补充')}</td><td>${esc(dec.tradeoff||'待补充')}</td><td>${esc(dec.confirmedBy||'—')}</td></tr>`).join('')||'<tr><td colspan="6">暂无决策</td></tr>'}</tbody></table></section>`,
  `<section id="open"><h2>5. 未决事项</h2><ul>${[...items.map(i=>(i.blocking?'【阻断】':'')+i.text),...unconfirmed.map(c=>'约束待确认：'+c.name),...d.risks.map(r=>'风险/待复核：'+r.text)].map(t=>`<li>${esc(t)}</li>`).join('')||'<li>无</li>'}</ul></section>`,
  `<section id="quality"><h2>6. 质量与证据</h2><ul>${(d.scenarios||[]).map(s=>`<li>质量场景：${esc(s.stimulus)} → ${esc(s.response)}；度量 ${esc(s.measure||'待定义')}；验证 ${esc(s.verification||'待定义')}</li>`).join('')}${d.evidence.map(e=>`<li>证据（${esc(e.result)}）：${esc(e.text)}</li>`).join('')||(d.scenarios?.length?'':'<li>暂无质量场景或证据</li>')}</ul><p>验证计划与实测证据分别记录，计划不等于通过。</p></section>`,
  `<section id="appendix"><h2>附录</h2><h3>A. 原始材料</h3>${p.sources.map(s=>`<details><summary>${esc(s.name)}</summary><pre>${esc(s.content)}</pre></details>`).join('')||'<p>无</p>'}`,
  `<h3>B. 内部标识</h3><p>项目 ${esc(p.projectId)} · 修订 ${esc(revisionId)}</p><table><thead><tr><th>对象</th><th>ID</th></tr></thead><tbody>${d.nodes.map(n=>`<tr><td>${esc(n.name)}</td><td>${esc(n.id)}</td></tr>`).join('')}</tbody></table></section></body></html>`];
 return out.join('\n')+'\n';
}
const slug=(s:string)=>s.replace(/[\\/:*?"<>|\s]+/g,'-').slice(0,40)||'archsketch';
export function viewSvgFiles(p:Project,viewIds:string[],revisionId=p.headRevisionId):PackageFile[]{
 const d=snapshot(p,revisionId);const ok=drawable(d);
 return viewIds.map(id=>ok.find(v=>v.id===id)).filter((v):v is Design['views'][number]=>!!v).map(v=>({path:`${slug(d.title)}-${revisionId.slice(0,8)}-${v.id}.svg`,content:svgOf(d,v)}));
}
/** 交付包内容（不含哈希；哈希由服务端写入文件时计算并记入 releases）。 */
export function buildRelease(p:Project,baselineId:string,approvedBy:string,publishedAt:string):PackageFile[]{
 const b=p.baselines.find(x=>x.id===baselineId);if(!b)throw Error('基线不存在');const d=snapshot(p,b.revisionId);const findings=profileFindings(d);const items=completeness(d,p.questions);
 const json=(v:unknown)=>JSON.stringify(v,null,2)+'\n';
 return [
  {path:'README.md',content:`# ${d.title} · 交付包\n\n- 基线：${b.name}\n- 修订：${b.revisionId}\n- 批准人：${approvedBy}\n- 发布时间：${publishedAt}\n\n发布后不可修改；逐文件 SHA-256 记录在项目文件的 releases 中。批准发布不代表业务接受或验证通过。\n`},
  {path:'model.json',content:json({format:'archsketch-model',projectId:p.projectId,revisionId:b.revisionId,design:d})},
  {path:'review.html',content:reviewHtml(p,b.revisionId)},
  {path:'adr.md',content:d.decisions.length?d.decisions.map((x,i)=>toAdr(d,x.id,i+1)).join('\n'):'暂无决策\n'},
  {path:'decisions.json',content:json(d.decisions.map(x=>({id:x.id,title:x.title,state:decisionState(x),selected:x.candidates.find(c=>c.id===x.selectedId)?.name??null,confirmedBy:x.confirmedBy??null,acceptedAt:x.acceptedAt??null,supersededBy:x.supersededBy??null})))},
  {path:'checks.json',content:json({profile:{id:PROFILE.profileId,version:PROFILE.version,error:findings.filter(f=>f.severity==='error').length,warning:findings.filter(f=>f.severity==='warning').length,info:findings.filter(f=>f.severity==='info').length,findings},completeness:{unanswered:items.filter(i=>i.kind==='unanswered').length,unconfirmed:items.filter(i=>i.kind==='unconfirmed').length,evidence:items.filter(i=>i.kind==='evidence').length},note:'规则检查只给建议，不出单一质量分'})},
  ...drawable(d).map(v=>({path:`views/${v.id}.svg`,content:svgOf(d,v)})),
 ];
}
