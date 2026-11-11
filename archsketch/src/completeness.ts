import { DOMAINS, DOMAIN_NAMES, type Design } from './design.ts';
import { layerApplicable, layerOfLevel, responsibility, type LayerId } from './layers.ts';
import type { Question } from './project.ts';
/**
 * 设计完成度清单（STORY-013 / ADR-003）：从设计派生，不持久化。
 * 未回答：待澄清问题域、跳过的引导题、空值约束；未确认：待确认约束、未选择或缺理由的决策、待重查决策、未关联决策的权衡点；
 * 缺证据：场景缺度量/验证方法/通过证据、质量节点无通过证据、证据计划/失败/过期。
 */
export type CompletenessItem={id:string;kind:'unanswered'|'unconfirmed'|'evidence';text:string;blocking?:boolean;target:{type:'domain'|'constraint'|'scenario'|'decision'|'node'|'point'|'question'|'evidence';id:string}};
export function completeness(design:Design,questions:Question[]=[]):CompletenessItem[]{
 const out:CompletenessItem[]=[];const add=(kind:CompletenessItem['kind'],type:CompletenessItem['target']['type'],id:string,text:string,layer?:LayerId,blocking=false)=>{if(layer&&!layerApplicable(design,layer))return;out.push({id:kind+':'+type+':'+id,kind,text,target:{type,id},...(blocking?{blocking:true}:{})});};
 const nodeLayer=(id:string)=>{const n=design.nodes.find(x=>x.id===id);return n?layerOfLevel(n.level):undefined;};
 for(const c of design.coverage)if(c.state==='needs_clarification')add('unanswered','domain',c.domain,DOMAIN_NAMES[DOMAINS.indexOf(c.domain)]+'：待澄清');
 for(const r of responsibility(design))if(!r.owners.length)add('unanswered','node',r.capability.id,'阻断级：业务能力“'+r.capability.name+'”没有负责的应用','L2',true);
 for(const n of design.nodes)if(n.level==='application'&&!n.sourcing)add('unanswered','node',n.id,n.name+'：自建、采购还是复用待定','L2');
 for(const q of questions)if(q.status==='skipped')add('unanswered','question',q.id,'跳过的引导问题：'+q.title);
 for(const c of design.constraints||[]){if(!c.value.trim())add('unanswered','constraint',c.id,c.name+'：尚未填写'+(c.unit?`（${c.unit}）`:''));else if(c.status==='unconfirmed')add('unconfirmed','constraint',c.id,`${c.name}：${c.value}${c.unit} 待确认`);}
 for(const dec of design.decisions.filter(x=>x.status!=='superseded')){const recheck=design.risks.some(r=>r.id==='recheck-'+dec.id);const missing=!dec.selectedId?'尚未选择方案':!dec.reason.trim()||!dec.tradeoff.trim()?'缺少选择理由或代价':'';
  if(recheck||missing)add('unconfirmed','decision',dec.id,dec.title+'：'+[recheck?'约束变化待重查':'',missing].filter(Boolean).join('；'));}
 for(const p of design.points||[])if(p.kind==='tradeoff'&&!p.decisionIds.length)add('unconfirmed','point',p.id,'权衡点未关联决策：'+p.text);
 const passed=new Set(design.evidence.filter(e=>e.result==='pass').map(e=>e.id));
 for(const s of design.scenarios||[]){const gaps=[!s.measure.trim()?'缺响应度量':'',!s.verification.trim()?'缺验证方法':'',!s.evidenceIds.some(id=>passed.has(id))?'无通过证据':''].filter(Boolean);if(gaps.length)add('evidence','scenario',s.id,(s.stimulus||s.attribute)+'：'+gaps.join('、'));}
 for(const n of design.nodes)if(n.role==='quality'&&!design.evidence.some(e=>e.result==='pass'&&e.objectIds.includes(n.id)))add('evidence','node',n.id,n.name+'：质量要求无通过证据',nodeLayer(n.id));
 const scenarioEvidence=new Set((design.scenarios||[]).flatMap(s=>s.evidenceIds));
 for(const e of design.evidence)if(e.result!=='pass'&&!scenarioEvidence.has(e.id))add('evidence','evidence',e.id,'验证'+({planned:'计划中',fail:'未通过',stale:'已过期'} as Record<string,string>)[e.result]+'：'+e.text);
 return out;
}
