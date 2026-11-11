import { validateDesign, type Design } from './design.ts';
/** 决策生命周期（STORY-024 / ADR-006 / INV-006）：提议 → 接受 → 取代。 */
export function acceptProblems(d:Design,id:string):string[]{
 const dec=d.decisions.find(x=>x.id===id);if(!dec)return ['决策不存在'];const out:string[]=[];
 if(dec.status==='accepted')out.push('决策已接受');if(dec.status==='superseded')out.push('决策已被取代');
 if(!dec.selectedId||!dec.candidates.some(c=>c.id===dec.selectedId))out.push('需要选择一个方案');
 if(!dec.reason.trim())out.push('需要写明选择理由');if(!dec.tradeoff.trim())out.push('需要写明取舍与代价');
 if(!dec.affectedIds.length)out.push('需要关联受影响的对象');
 if(dec.candidates.length<2&&!dec.waiver?.trim())out.push('至少比较两个方案，或登记单方案豁免理由');
 return out;
}
export function acceptDecision(d:Design,id:string,by:{confirmedBy?:string}={}):Design{
 const problems=acceptProblems(d,id);if(problems.length)throw Error('不能接受：'+problems.join('；'));const who=by.confirmedBy?.trim()||d.decisions.find(x=>x.id===id)?.confirmedBy?.trim();
 return validateDesign({...d,decisions:d.decisions.map(x=>x.id===id?{...x,status:'accepted' as const,acceptedAt:new Date().toISOString(),...(who?{confirmedBy:who}:{})}:x)});
}
export function supersedeDecision(d:Design,id:string):{design:Design;newId:string}{
 const old=d.decisions.find(x=>x.id===id);if(!old)throw Error('决策不存在');if(old.status!=='accepted')throw Error('只有已接受的决策需要取代');
 let newId='dec-'+crypto.randomUUID().slice(0,8);while(d.decisions.some(x=>x.id===newId))newId='dec-'+crypto.randomUUID().slice(0,8);
 const {selectedId,waiver,status,supersededBy,confirmedBy,acceptedAt,...rest}=old;void selectedId;void waiver;void status;void supersededBy;void confirmedBy;void acceptedAt;
 const fresh={...structuredClone(rest),id:newId,status:'proposed' as const,supersedes:old.id,reason:'',tradeoff:''};
 return {design:validateDesign({...d,decisions:[...d.decisions.map(x=>x.id===id?{...x,status:'superseded' as const,supersededBy:newId}:x),fresh]}),newId};
}
/** 决策四态（STORY-031 / GSC-26）：缺省一律按 proposed，只有接受操作产生 accepted；界面、ADR、说明书共用。 */
export type DecisionState='unselected'|'selected'|'accepted'|'superseded';
export const DECISION_STATE_NAMES:Record<DecisionState,string>={unselected:'提议中 · 未选方案',selected:'提议中 · 已选待接受',accepted:'已接受',superseded:'已取代'};
export function decisionState(dec:Design['decisions'][number]):DecisionState{
 const s=dec.status??'proposed';return s==='proposed'?(dec.selectedId?'selected':'unselected'):s;
}
