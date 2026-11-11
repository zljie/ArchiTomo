import { DOMAINS, type Design } from './design.ts';
import type { Question } from './project.ts';
import { LAYERS, layerApplicable, layerOfLevel, layerOfView, responsibility, type LayerId } from './layers.ts';
/**
 * ADU 设计单元（STORY-021 / ADR-005）：每层六步——设计问题、输入与约束、候选方案、权衡与决策、架构模型、验证与证据。
 * 状态全部从模型派生，不持久化；不适用层全部 na。
 */
export type AduStep={id:'question'|'inputs'|'alternatives'|'decision'|'model'|'evidence';label:string;state:'done'|'partial'|'todo'|'na';detail:string;target:{type:'layer'|'panel'|'view';id:string}};
const DOMAIN_LAYER:Record<typeof DOMAINS[number],LayerId>={goals_constraints:'L0',system_context:'L0',capabilities:'L1',functional_structure:'L1',key_scenarios:'L1',data:'L1',technical_structure:'L3',deployment:'L3',quality:'L0',decisions_evolution:'L0'};
export function decisionLayer(d:Design,dec:Design['decisions'][number]):LayerId|null{
 if(dec.layer)return dec.layer;const counts=new Map<LayerId,number>();for(const id of dec.affectedIds){const n=d.nodes.find(x=>x.id===id);if(n)counts.set(layerOfLevel(n.level),(counts.get(layerOfLevel(n.level))||0)+1);}
 return [...counts.entries()].sort((a,b)=>b[1]-a[1])[0]?.[0]??null;
}
export function aduStatus(d:Design,layer:LayerId,questions:Question[]=[]):AduStep[]{
 const labels:[AduStep['id'],string][]=[['question','设计问题'],['inputs','输入与约束'],['alternatives','候选方案'],['decision','权衡与决策'],['model','架构模型'],['evidence','验证与证据']];
 const setting=d.layers?.find(l=>l.id===layer);
 if(!layerApplicable(d,layer))return labels.map(([id,label])=>({id,label,state:'na',detail:'本层不适用：'+(setting?.reason||''),target:{type:'layer',id:layer}}));
 const views=d.views.filter(v=>layerOfView(v)===layer);const nodes=new Set(views.flatMap(v=>v.nodeIds));
 const decisions=d.decisions.filter(dec=>dec.status!=='superseded'&&decisionLayer(d,dec)===layer);const decIds=new Set(decisions.map(x=>x.id));
 const touches=(o:{objectIds:string[];decisionIds:string[]})=>o.objectIds.some(id=>nodes.has(id))||o.decisionIds.some(id=>decIds.has(id));
 const steps:AduStep[]=[];
 const answered=questions.filter(q=>q.status==='answered'&&DOMAIN_LAYER[q.domain as typeof DOMAINS[number]]===layer).length;
 steps.push({id:'question',label:'设计问题',state:setting?.question.trim()?'done':answered?'partial':'todo',detail:setting?.question.trim()||(answered?`已回答 ${answered} 个相关引导问题，尚未写明本层设计问题`:'尚未写明本层要解决的设计问题'),target:{type:'layer',id:layer}});
 const inputs=(d.constraints||[]).filter(c=>layer==='L0'||touches(c));const unconfirmed=inputs.filter(c=>c.status!=='confirmed'||!c.value.trim()).length;
 steps.push({id:'inputs',label:'输入与约束',state:!inputs.length?'todo':unconfirmed?'partial':'done',detail:!inputs.length?'没有关联到本层的约束':unconfirmed?`${inputs.length} 条约束，其中 ${unconfirmed} 条待确认`:`${inputs.length} 条约束已确认`,target:{type:'panel',id:'constraints'}});
 const withAlt=decisions.filter(x=>x.candidates.length>=2).length;
 steps.push({id:'alternatives',label:'候选方案',state:withAlt?'done':decisions.length?'partial':'todo',detail:decisions.length?`${decisions.length} 个决策，${withAlt} 个有两个以上候选`:'本层还没有决策',target:{type:'panel',id:'decisions'}});
 const live=decisions.filter(x=>x.status!=='superseded');const decided=live.filter(x=>x.status==='accepted').length;const pending=live.filter(x=>x.status!=='accepted'&&x.selectedId).length;// GSC-26：只有 accepted 算完成；已选未接受为部分完成
 steps.push({id:'decision',label:'权衡与决策',state:!live.length||(!decided&&!pending)?'todo':decided<live.length?'partial':'done',detail:live.length?`${decided}/${live.length} 个决策已接受${pending?`，${pending} 个已选待接受`:''}`:'暂无待决策',target:{type:'panel',id:'decisions'}});
 let modelState:AduStep['state']=nodes.size?'done':'todo';let modelDetail=nodes.size?`${nodes.size} 个元素`:'本层视图还没有元素';
 if(layer==='L2'&&nodes.size){const rows=responsibility(d);const orphan=rows.filter(r=>!r.owners.length).length;if(orphan){modelState='partial';modelDetail=`${orphan} 项业务能力没有负责应用`;}else modelDetail=`${nodes.size} 个应用，${rows.length} 项能力均有负责应用`;}
 steps.push({id:'model',label:'架构模型',state:modelState,detail:modelDetail,target:{type:'view',id:views[0]?.id||''}});
 const passed=new Set(d.evidence.filter(e=>e.result==='pass').map(e=>e.id));const scen=(d.scenarios||[]).filter(touches);const nodeEvidence=d.evidence.filter(e=>e.objectIds.some(id=>nodes.has(id)));
 const proven=scen.filter(s=>s.evidenceIds.some(id=>passed.has(id))).length;const planned=scen.some(s=>s.measure.trim()||s.verification.trim())||nodeEvidence.length>0;
 steps.push({id:'evidence',label:'验证与证据',state:scen.length&&proven===scen.length?'done':proven||planned?'partial':'todo',detail:scen.length?`${scen.length} 个质量场景，${proven} 个有通过证据`:nodeEvidence.length?`${nodeEvidence.length} 条验证计划`:'没有关联的质量场景或证据',target:{type:'panel',id:'constraints'}});
 return steps;
}
/** AI 上下文用：每个适用层未完成的步骤。 */
export function aduSummary(d:Design,questions:Question[]=[]):string[]{
 return LAYERS.filter(l=>layerApplicable(d,l.id)).map(l=>({l,gaps:aduStatus(d,l.id,questions).filter(s=>s.state!=='done')})).filter(x=>x.gaps.length).map(x=>`${x.l.id} ${x.l.name}：缺 ${x.gaps.map(g=>g.label+'（'+g.detail+'）').join('；')}`);
}
