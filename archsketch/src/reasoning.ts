import type {Decision,Candidate} from './design.ts';
export type Ranked={candidate:Candidate;score:number|null;issues:string[]};
export function rankDecision(decision:Decision):{eligible:Ranked[];excluded:Ranked[];weightValid:boolean}{
 const weightValid=decision.dimensions.length>0&&decision.dimensions.every(d=>Number.isFinite(d.weight)&&d.weight>=0&&d.weight<=100)&&Math.abs(decision.dimensions.reduce((s,d)=>s+d.weight,0)-100)<1e-8;
 const eligible:Ranked[]=[],excluded:Ranked[]=[];
 for(const candidate of decision.candidates){const issues=[...candidate.violations];const missing=decision.dimensions.some(d=>{const v=candidate.scores[d.id];return typeof v!=='number'||!Number.isFinite(v)||v<0||v>5;});if(!weightValid)issues.push('权重合计需要100%');if(missing)issues.push('评分待补充');const score=weightValid&&!missing?decision.dimensions.reduce((s,d)=>s+d.weight*candidate.scores[d.id]!/5,0):null;const item={candidate,score,issues};(issues.length?excluded:eligible).push(item);}
 eligible.sort((a,b)=>b.score!-a.score!);return {eligible,excluded,weightValid};
}
export function newDecision(affectedIds:string[]=[]):Decision{return {id:crypto.randomUUID(),title:'架构技术路线',dimensions:[{id:'reliable',name:'资产可靠性',weight:35},{id:'trace',name:'历史可追溯',weight:25},{id:'reuse',name:'现有实现复用',weight:15},{id:'exchange',name:'检查与迁移',weight:10},{id:'simple',name:'交付简洁程度',weight:15}],candidates:[['a','本机 Node + JSON',[4,4,5,5,5]],['b','本机嵌入式数据库',[4,5,3,3,3]],['c','桌面应用壳 + 文件',[4,4,2,4,2]]].map(([id,name,scores])=>({id:id as string,name:name as string,benefits:'待架构师补充收益',costs:'待架构师补充代价',rationale:'示例适配度估计，尚非实测；请根据当前目标调整',violations:[],scores:Object.fromEntries(['reliable','trace','reuse','exchange','simple'].map((key,i)=>[key,(scores as number[])[i]]))})),reason:'',tradeoff:'',reconsiderWhen:'',affectedIds};}

export function impact(d:import('./design.ts').Design,ids:string[]):{id:string;path:string[]}[]{
 const found=new Map(ids.filter(id=>d.nodes.some(n=>n.id===id)).map(id=>[id,{id,path:[id]}]));
 for(const row of found.values()){
  const add=(id:string,via:string)=>{if(!found.has(id))found.set(id,{id,path:[...row.path,via,id]});};
  for(const r of d.relationships)if(r.target===row.id&&['depends_on','realizes','derives_from','constrained_by'].includes(r.type))add(r.source,r.id);
  for(const n of d.nodes)if(n.parentId===row.id||n.relatedIds?.includes(row.id))add(n.id,n.parentId===row.id?'包含':'关联职责');
 }
 return [...found.values()];
}
export function changedObjects(before:import('./design.ts').Design,after:import('./design.ts').Design):string[]{
 const changed=new Set<string>();
 for(const id of new Set([...before.nodes,...after.nodes].map(n=>n.id)))if(JSON.stringify(before.nodes.find(n=>n.id===id))!==JSON.stringify(after.nodes.find(n=>n.id===id)))changed.add(id);
 for(const id of new Set([...before.relationships,...after.relationships].map(r=>r.id))){const a=before.relationships.find(r=>r.id===id),b=after.relationships.find(r=>r.id===id);if(JSON.stringify(a)!==JSON.stringify(b)){for(const r of [a,b])if(r){changed.add(r.source);changed.add(r.target);}}}
 for(const id of new Set([...before.decisions,...after.decisions].map(d=>d.id))){const a=before.decisions.find(d=>d.id===id),b=after.decisions.find(d=>d.id===id);if((a||b?.selectedId)&&JSON.stringify(a)!==JSON.stringify(b))for(const ref of [...(a?.affectedIds||[]),...(b?.affectedIds||[])])changed.add(ref);}
 return [...new Set([...impact(before,[...changed]),...impact(after,[...changed])].map(x=>x.id))];
}
export function explain(p:import('./project.ts').Project,html=false):string{
 const d=p.revisions.find(r=>r.id===p.headRevisionId)!.snapshot;
 const text=(v:unknown)=>String(v??'').replace(/[\\`*_{}\[\]()#+.!<>|]/g,'\\$&');
 const lines=[`# ${text(d.title)}`,`项目 ${p.projectId} · 设计修订 ${p.headRevisionId} · 写入 ${p.writeVersion} · 输入 ${p.inputVersion}`,'','## 目标、范围与来源',...p.sources.map(s=>`- ${text(s.name)} [${s.id}]：${text(s.content)}`),'','## 全局问题地图',...d.coverage.map(c=>`- ${c.domain} / ${c.state}：${text(c.reason)}`),'','## 设计对象',...d.nodes.map(n=>`- ${text(n.name)} [${n.id}] / ${n.level} / ${n.role}：${text(n.description)}；技术 ${text(n.technology)}；来源 ${n.sourceIds.join(', ')}；父级 ${n.parentId||'无'}；关联 ${n.relatedIds?.join(', ')||'无'}`),'','## 视图与协作关系',...d.views.map(v=>`- ${text(v.name)}：${v.nodeIds.join(', ')}`),...d.relationships.map(r=>`- ${r.source} → ${r.target} (${text(r.type)})：${text(r.label)}`),'','## 方案与决策'];
 for(const dec of d.decisions){const ranking=rankDecision(dec);lines.push(`### ${text(dec.title)}`,`已选：${text(dec.candidates.find(c=>c.id===dec.selectedId)?.name||'待人工选择')}`,`理由：${text(dec.reason)}；代价：${text(dec.tradeoff)}；重评：${text(dec.reconsiderWhen)}`,`维度：${dec.dimensions.map(x=>`${text(x.name)} ${x.weight}%`).join('；')}`);for(const row of [...ranking.eligible,...ranking.excluded])lines.push(`- ${text(row.candidate.name)}：${row.score??'待补充'}/100；${text(row.issues.join('；'))}；评分 ${text(JSON.stringify(row.candidate.scores))}；依据 ${text(row.candidate.rationale)}；收益 ${text(row.candidate.benefits)}；代价 ${text(row.candidate.costs)}`);}
 lines.push('','## 目标与约束',...(d.constraints||[]).map(c=>`- ${text(c.name)}（${c.kind}）：${text(c.value||'未填写')}${text(c.unit)}；${c.status==='confirmed'?'已确认':'待确认'}；${text(c.note)}`),'','## 质量场景',...(d.scenarios||[]).map(s=>`- [${s.attribute}] 刺激源 ${text(s.source)}；刺激 ${text(s.stimulus)}；环境 ${text(s.environment)}；响应 ${text(s.response)}；度量 ${text(s.measure||'待定义')}；验证 ${text(s.verification||'待定义')}`),'','## 敏感点、权衡点与风险',...(d.points||[]).map(x=>`- ${({sensitivity:'敏感点',tradeoff:'权衡点',risk:'风险',nonrisk:'非风险'} as Record<string,string>)[x.kind]}：${text(x.text)}`),'','## 风险与待复核',...d.risks.map(r=>`- ${text(r.text)} [${r.objectIds.join(', ')}]`),'','## 假设',...d.assumptions.map(a=>`- ${text(a.text)}：${a.confirmed?'已确认':'待确认'}`),'','## 验证证据与待验证',...d.evidence.map(e=>`- ${text(e.text)}：${e.result}；依据修订 ${e.revisionId}；对象 ${e.objectIds.join(', ')}`),...d.nodes.filter(n=>n.role==='quality'&&!d.evidence.some(e=>e.objectIds.includes(n.id)&&e.result==='pass')).map(n=>`- 待验证：${text(n.name)}`),'','工程检查和架构师确认分别记录；说明不代表验证通过或业务接受。');
 const md=lines.join('\n');if(!html)return md;
 const escape=(s:string)=>s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
 return `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${escape(d.title)}</title><style>body{max-width:1000px;margin:40px auto;padding:0 24px;color:#172b3a;font:16px/1.7 system-ui}pre{white-space:pre-wrap;overflow-wrap:anywhere}h1{font-size:28px}</style><h1>${escape(d.title)}</h1><pre>${escape(md.replace(/\\([\\`*_{}\[\]()#+.!<>|])/g,'$1'))}</pre></html>`;
}
