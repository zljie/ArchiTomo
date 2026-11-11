import { ROLE_NAMES, type Design } from './design.ts';
import { head, type Project } from './project.ts';
import { rankDecision } from './reasoning.ts';
import { completeness } from './completeness.ts';
import { decisionState } from './decisions.ts';
/** ADR 与设计说明书（STORY-017）：从同一已保存修订生成 Markdown；文本做 HTML/表格转义，不执行内容中的标记。 */
const esc=(v:unknown)=>String(v??'').replace(/[&<>]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;'})[c]!).replace(/\|/g,'\\|').replace(/\r?\n/g,' ').trim();
const status=(s:string)=>s==='confirmed'?'已确认':'待确认';
const ATTR:Record<string,string>={availability:'可用性',performance:'性能',security:'安全',modifiability:'可修改性',reliability:'可靠性',scalability:'可扩展性',usability:'易用性',cost:'成本',other:'其他'};
const POINT:Record<string,string>={sensitivity:'敏感点',tradeoff:'权衡点',risk:'风险',nonrisk:'非风险'};
const pad=(n:number)=>String(n).padStart(3,'0');
function adrStatus(design:Design,dec:Design['decisions'][number],chosen?:string):string[]{
 const title=(id?:string)=>design.decisions.find(x=>x.id===id)?.title||id||'';
 const status=dec.status??'proposed';const lines=[status==='accepted'?`accepted（已选择：${esc(chosen||'')}）`:status==='superseded'?`superseded（已被“${esc(title(dec.supersededBy))}”取代）`:chosen?`proposed（已选择：${esc(chosen)}，待接受）`:'proposed（尚未选择方案）'];
 if(dec.supersedes)lines.push(`取代：“${esc(title(dec.supersedes))}”`);if(dec.waiver)lines.push(`单方案豁免：${esc(dec.waiver)}`);
 lines.push(`确认人：${esc(dec.confirmedBy||'未填写')}`);if(dec.acceptedAt)lines.push(`接受时间：${esc(dec.acceptedAt)}`);return lines;
}
export function toAdr(design:Design,decisionId:string,index=1):string{
 const dec=design.decisions.find(d=>d.id===decisionId);if(!dec)throw Error('决策不存在');
 const name=(id:string)=>design.nodes.find(n=>n.id===id)?.name||id;const chosen=dec.candidates.find(c=>c.id===dec.selectedId);
 const recheck=design.risks.find(r=>r.id==='recheck-'+dec.id);const linked=(design.constraints||[]).filter(c=>c.decisionIds.includes(dec.id));
 const scenarios=(design.scenarios||[]).filter(s=>s.decisionIds.includes(dec.id));const points=(design.points||[]).filter(p=>p.decisionIds.includes(dec.id));
 const ranking=rankDecision(dec);const total=(id:string)=>[...ranking.eligible,...ranking.excluded].find(r=>r.candidate.id===id)?.score;
 const out=[`# ADR-${pad(index)}: ${esc(dec.title)}`,'','## 状态',...adrStatus(design,dec,chosen?.name),...(recheck?['',`> 待重查：${esc(recheck.text)}`]:[]),'',
  '## 背景与约束',...(linked.length?linked.map(c=>`- ${esc(c.name)}：${esc(c.value||'未填写')}${esc(c.unit)}（${status(c.status)}）${c.note?' · '+esc(c.note):''}`):['- 未关联约束']),
  ...scenarios.map(s=>`- 质量场景（${ATTR[s.attribute]}）：${esc(s.stimulus)} → ${esc(s.response)}；度量 ${esc(s.measure||'待定义')}`),'',
  '## 决策',chosen?`已选择：${esc(chosen.name)}。理由：${esc(dec.reason||'待补充')}`:`尚未选择。${esc(dec.reason)}`,'',
  '## 备选方案与评分',`| 方案 | 总分 | ${dec.dimensions.map(d=>esc(d.name)+' '+d.weight+'%').join(' | ')} | 收益 | 代价 | 问题 |`,`|${'---|'.repeat(dec.dimensions.length+5)}`,
  ...dec.candidates.map(c=>`| ${esc(c.name)}${c.id===dec.selectedId?'（已选）':''} | ${total(c.id)?.toFixed(1)??'待补充'} | ${dec.dimensions.map(d=>c.scores[d.id]??'—').join(' | ')} | ${esc(c.benefits)} | ${esc(c.costs)} | ${esc(c.violations.join('；'))} |`),
  ...dec.candidates.filter(c=>c.rationale.trim()).map(c=>`- ${esc(c.name)} 依据：${esc(c.rationale)}`),'',
  '## 后果与代价',esc(dec.tradeoff||'待补充'),...points.map(p=>`- ${POINT[p.kind]}：${esc(p.text)}`),'',
  '## 重评条件',esc(dec.reconsiderWhen||'待补充'),'',
  '## 验证要求',`验证要求：${esc(dec.verification||'待补充')}`,'',
  '## 关联元素',...(dec.affectedIds.length?dec.affectedIds.map(id=>`- ${esc(name(id))}`):['- 无']),''];
 return out.join('\n');
}
export function designDocument(project:Project):string{
 const d=head(project);const name=(id:string)=>d.nodes.find(n=>n.id===id)?.name||id;
 const lines=[`# ${esc(d.title)} · 设计说明书`,'',`项目 ${project.projectId} · 修订 ${project.headRevisionId} · 写入版本 ${project.writeVersion}`,'','> 由 ArchSketch 从同一已保存修订生成；“待确认”的数值只是前提，不是已验证事实。','',
  '## 1. 目标与约束','| 约束 | 数值 | 状态 | 说明 |','|---|---|---|---|',...(d.constraints||[]).map(c=>`| ${esc(c.name)} | ${esc(c.value||'未填写')}${esc(c.unit)} | ${status(c.status)} | ${esc(c.note)} |`),
  ...d.nodes.filter(n=>['goal','constraint','quality'].includes(n.level)).map(n=>`- ${ROLE_NAMES[n.role]||n.role}：${esc(n.name)}${n.description?' — '+esc(n.description):''}`),'',
  '## 2. 架构拓扑'];
 for(const v of d.views){if(!v.nodeIds.length)continue;lines.push('',`### ${esc(v.name)}`);for(const id of v.nodeIds){const n=d.nodes.find(x=>x.id===id);if(n)lines.push(`- ${esc(n.name)}（${ROLE_NAMES[n.role]||n.role}${n.technology?' · '+esc(n.technology):''}）${n.description?'：'+esc(n.description):''}`);}
  for(const r of d.relationships)if(v.nodeIds.includes(r.source)&&v.nodeIds.includes(r.target))lines.push(`- ${esc(name(r.source))} → ${esc(name(r.target))}${r.label?'：'+esc(r.label):''}`);}
 lines.push('','## 3. 关键决策',...(d.decisions.length?d.decisions.map((dec,i)=>{const c=dec.candidates.find(x=>x.id===dec.selectedId);const st=decisionState(dec);const label=st==='accepted'?`已接受（已选择 ${esc(c?.name)}）`:st==='superseded'?'已取代':c?`提议中（已选择 ${esc(c.name)}，待接受）`:'提议中（尚未选择方案）';return `- ADR-${pad(i+1)} ${esc(dec.title)}：${label}${d.risks.some(r=>r.id==='recheck-'+dec.id)?'（待重查）':''}`;}):['- 暂无决策']),
  '','## 4. 质量验证',...(d.scenarios||[]).map(s=>`- [${ATTR[s.attribute]}] 刺激源 ${esc(s.source||'—')}；刺激 ${esc(s.stimulus)}；环境 ${esc(s.environment||'—')}；响应 ${esc(s.response)}；度量 ${esc(s.measure||'待定义')}；验证 ${esc(s.verification||'待定义')}`),
  ...(d.points||[]).map(p=>`- ${POINT[p.kind]}：${esc(p.text)}`),...d.evidence.map(e=>`- 证据（${e.result}）：${esc(e.text)}`),
  '','## 5. 设计完成度');
 const items=completeness(d,project.questions);for(const [kind,label] of [['unanswered','未回答问题'],['unconfirmed','未确认取舍'],['evidence','缺验证证据']] as const){const xs=items.filter(i=>i.kind===kind);lines.push(`### ${label}（${xs.length}）`,...(xs.length?xs.map(i=>'- '+esc(i.text)):['- 无']));}
 lines.push('','## 附录：架构决策记录','',...d.decisions.map((dec,i)=>toAdr(d,dec.id,i+1)));
 return lines.join('\n')+'\n';
}
