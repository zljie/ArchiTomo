import type { Design, DesignNode } from './design.ts';
import rawProfile from './profiles/addm-base.ts';
/**
 * ADDM Profile 引擎（STORY-022/023 / ADR-006）：版本化元模型 + ArchSketch 绑定层。
 * 存储的 ADDM 关系须合法（validateDesign 拒绝）；旧关系类型按映射解释，只给提示；governedBy/mustSatisfy/justifiedBy/verifiedBy 由既有引用派生。
 */
export type Profile={profileId:string;version:string;elementTypes:{id:string;level:string}[];relationTypes:{id:string;label:string;sourceTypes:string[];targetTypes:string[];acyclic?:boolean;singleParent?:boolean;allowedPairs?:[string,string][]}[];invariants:{id:string;severity:string;rule:string}[]};
export type Finding={inv:string;severity:'error'|'warning'|'info';text:string;targetId?:string};
export type TypedRelation={id?:string;type:string;source:string;target:string;origin:'stored'|'legacy'|'derived'};
const PLATFORM_TYPES=['ArchitectureDecision','EvidenceRecord'];
export function parseProfile(raw:unknown):Profile{
 const p=raw as Profile;if(!p||typeof p!=='object'||typeof p.profileId!=='string'||typeof p.version!=='string')throw Error('Profile 缺少标识或版本');
 if(!Array.isArray(p.elementTypes)||!Array.isArray(p.relationTypes)||!Array.isArray(p.invariants))throw Error('Profile 结构无效');
 const types=new Set<string>();for(const t of p.elementTypes){if(!['L0','L1','L2','L3','L4'].includes(t.level))throw Error(`元素类型 ${t.id} 的层级无效`);if(types.has(t.id))throw Error('元素类型重复：'+t.id);types.add(t.id);}
 const known=(id:string)=>types.has(id)||PLATFORM_TYPES.includes(id);
 for(const r of p.relationTypes){if(!r.id||!Array.isArray(r.sourceTypes)||!Array.isArray(r.targetTypes))throw Error('关系定义无效');for(const t of [...r.sourceTypes,...r.targetTypes,...(r.allowedPairs||[]).flat()])if(!known(t))throw Error(`关系 ${r.id} 引用了未知类型 ${t}`);}
 return {profileId:p.profileId,version:p.version,elementTypes:p.elementTypes.map(t=>({id:t.id,level:t.level})),relationTypes:p.relationTypes,invariants:p.invariants};
}
export const PROFILE:Profile=parseProfile(rawProfile);
/** 可在 relationships 中直接存储的 ADDM 关系（其余由引用派生或属于 DDD 扩展）。 */
export const ADDM_RELATIONS=['motivates','realizedBy','implementedBy','integratesWith','contains','dependsOn'];
const ALL_ADDM=new Set(PROFILE.relationTypes.map(r=>r.id));
export const RELATION_LABELS:Record<string,string>=Object.fromEntries(PROFILE.relationTypes.map(r=>[r.id,r.label]));
const TECH:Record<string,string>={client:'RuntimeUnit',application:'RuntimeUnit',service:'TechnicalService',gateway:'IntegrationChannel',load_balancer:'IntegrationChannel',cdn:'IntegrationChannel',queue:'IntegrationChannel',database:'DataStore',cache:'DataStore',storage:'DataStore'};
const LEVEL:Record<string,string>={goal:'Goal',constraint:'Constraint',quality:'QualityScenario',capability:'BusinessCapability',function:'BusinessCapability',step:'BusinessProcess',entity:'DomainConcept',application:'ApplicationSystem',runtime:'DeploymentUnit',component:'Component'};
/** ArchSketch 层级/角色 → ADDM 元素类型；上下文层与技术层外部依赖不参与类型检查。 */
export function elementTypeOf(n:Pick<DesignNode,'level'|'role'>):string|null{if(n.level==='technical')return TECH[n.role]??null;return LEVEL[n.level]??null;}
export function tripleAllowed(type:string,s:string,t:string):boolean{
 const r=PROFILE.relationTypes.find(x=>x.id===type);if(!r)return false;if(r.allowedPairs)return r.allowedPairs.some(([a,b])=>a===s&&b===t);return r.sourceTypes.includes(s)&&r.targetTypes.includes(t);
}
const typeOfId=(d:Design,id:string)=>{const n=d.nodes.find(x=>x.id===id);return n?elementTypeOf(n):null;};
/** 数据完整性（validateDesign 调用）：存储的 ADDM 关系须合法；contains 无环且单父。 */
export function checkStoredRelations(d:Pick<Design,'nodes'|'relationships'>):void{
 const nodeType=(id:string)=>{const n=d.nodes.find(x=>x.id===id);return n?elementTypeOf(n):null;};
 for(const r of d.relationships){if(!ALL_ADDM.has(r.type))continue;const s=nodeType(r.source),t=nodeType(r.target);if(!s||!t||!tripleAllowed(r.type,s,t))throw Error(`关系 ${r.type}（${s??'未映射'} → ${t??'未映射'}）不在 Profile 白名单中`);}
 const contains=d.relationships.filter(r=>r.type==='contains');const parent=new Map<string,string>();
 for(const r of contains){if(parent.has(r.target))throw Error('contains：同一元素有多个结构父节点');parent.set(r.target,r.source);}
 for(const start of parent.keys()){const seen=new Set<string>();let at:string|undefined=start;while(at){if(seen.has(at))throw Error('contains 关系成环');seen.add(at);at=parent.get(at);}}
}
const VIEW_ONLY=['next','branch','failure','data_relation','deploys'];
/** 类型化图：存储的 ADDM 关系、旧类型映射、由引用派生的关系。 */
export function typedRelations(d:Design):TypedRelation[]{
 const out:TypedRelation[]=[];
 for(const r of d.relationships){
  if(ALL_ADDM.has(r.type)){out.push({id:r.id,type:r.type,source:r.source,target:r.target,origin:'stored'});continue;}
  const s=typeOfId(d,r.source),t=typeOfId(d,r.target);
  if(r.type==='realizes'&&s==='ApplicationSystem'&&t==='BusinessCapability')out.push({id:r.id,type:'realizedBy',source:r.target,target:r.source,origin:'legacy'});
  else if(r.type==='derives_from'&&s==='BusinessCapability'&&t==='Goal')out.push({id:r.id,type:'motivates',source:r.target,target:r.source,origin:'legacy'});
  else if(r.type==='constrained_by'&&t==='Constraint')out.push({id:r.id,type:'governedBy',source:r.source,target:r.target,origin:'legacy'});
  else if(r.type==='depends_on')out.push({id:r.id,type:'dependsOn',source:r.source,target:r.target,origin:'legacy'});
 }
 for(const n of d.nodes)if(n.parentId)out.push({type:'contains',source:n.parentId,target:n.id,origin:'legacy'});
 for(const c of d.constraints||[])for(const id of c.objectIds)out.push({type:'governedBy',source:id,target:c.id,origin:'derived'});
 for(const s of d.scenarios||[]){for(const id of s.objectIds)out.push({type:'mustSatisfy',source:id,target:s.id,origin:'derived'});for(const e of s.evidenceIds)out.push({type:'verifiedBy',source:s.id,target:e,origin:'derived'});}
 for(const dec of d.decisions)if(dec.status!=='superseded')for(const id of dec.affectedIds)out.push({type:'justifiedBy',source:id,target:dec.id,origin:'derived'});
 return out;
}
/** 按端点推荐关系：先取 Profile 允许的 ADDM 关系，未定义时回退为通用依赖（场景步骤为“下一步”）。 */
export function recommendRelation(d:Design,sourceId:string,targetId:string):string{
 const s=typeOfId(d,sourceId),t=typeOfId(d,targetId);
 if(s&&t)for(const type of ['realizedBy','motivates','implementedBy','integratesWith','contains','dependsOn'])if(tripleAllowed(type,s,t))return type;
 const level=d.nodes.find(n=>n.id===sourceId)?.level;return level==='step'?'next':'depends_on';
}
const STRUCTURAL=['RuntimeUnit','TechnicalService','DataStore','IntegrationChannel','Module','Component'];
export function profileFindings(d:Design):Finding[]{
 const out:Finding[]=[];const rels=typedRelations(d);const name=(id:string)=>d.nodes.find(n=>n.id===id)?.name||id;
 for(const r of d.relationships){if(ALL_ADDM.has(r.type)||VIEW_ONLY.includes(r.type))continue;const mapped=rels.find(x=>x.id===r.id);
  if(!mapped)out.push({inv:'INV-002',severity:'info',text:`${name(r.source)} → ${name(r.target)}：关系类型 ${r.type} 在 Profile 中没有对应语义`,targetId:r.source});
  else{const s=typeOfId(d,mapped.source),t=typeOfId(d,mapped.target);if(s&&t&&!tripleAllowed(mapped.type,s,t))out.push({inv:'INV-002',severity:'info',text:`${name(r.source)} → ${name(r.target)}：${r.type} 对应 ${mapped.type}，但 ${s} → ${t} 不在白名单`,targetId:r.source});}}
 for(const n of d.nodes)if(n.level==='capability'&&!rels.some(r=>r.type==='realizedBy'&&r.source===n.id))out.push({inv:'INV-009',severity:'error',text:`业务能力“${n.name}”没有 realizedBy 应用系统`,targetId:n.id});
 const upstream=new Map<string,boolean>();
 const has=(id:string,seen=new Set<string>()):boolean=>{if(upstream.has(id))return upstream.get(id)!;if(seen.has(id))return false;seen.add(id);
  const direct=rels.some(r=>r.source===id&&['justifiedBy','governedBy','mustSatisfy'].includes(r.type));
  const viaParent=rels.filter(r=>r.target===id&&['contains','implementedBy'].includes(r.type)).some(r=>{const pt=typeOfId(d,r.source);return pt==='ApplicationSystem'?rels.some(x=>x.type==='realizedBy'&&x.target===r.source):has(r.source,seen);});
  const v=direct||viaParent;upstream.set(id,v);return v;};
 for(const n of d.nodes){const t=elementTypeOf(n);if(t&&STRUCTURAL.includes(t)&&!has(n.id))out.push({inv:'INV-010',severity:'warning',text:`“${n.name}”（${t}）缺少到目标、约束或决策的上游依据`,targetId:n.id});}
 return out;
}
/** 目标/能力变化的下游：motivates → realizedBy → implementedBy/contains，以及受影响的决策、质量场景与证据。 */
export function traceDownstream(d:Design,id:string):string[]{
 const rels=typedRelations(d);const seen=new Set<string>([id]);const queue=[id];
 while(queue.length){const at=queue.shift()!;for(const r of rels)if(r.source===at&&['motivates','realizedBy','implementedBy','contains'].includes(r.type)&&!seen.has(r.target)){seen.add(r.target);queue.push(r.target);}}
 const nodes=[...seen].filter(x=>x!==id);const out=new Set(nodes);
 for(const dec of d.decisions)if(dec.status!=='superseded'&&dec.affectedIds.some(x=>seen.has(x)))out.add(dec.id);
 for(const s of d.scenarios||[])if(s.objectIds.some(x=>seen.has(x))){out.add(s.id);for(const e of s.evidenceIds)out.add(e);}
 return [...out];
}
