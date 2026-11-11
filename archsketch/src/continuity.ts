import { ROLE_NAMES, type Design, type Decision } from './design.ts';
import type { Project } from './project.ts';
import { LAYERS, layerOfLevel } from './layers.ts';
/** 从回答接续到决策、材料与同名对象（STORY-036 / F-10）。 */
/** 已回答的引导问题 → 待审决策草案：选项即候选，回答的选择预填为已选，状态始终 proposed，出处记问题 ID。 */
export function decisionFromAnswer(p:Project,questionId:string):Decision{
 const q=p.questions.find(x=>x.id===questionId);if(!q||q.status!=='answered'||!q.answer)throw Error('该问题尚未回答，不能生成决策草案');
 const chosen=q.answer.optionIds[0];const labels=q.answer.optionIds.map(id=>q.options.find(o=>o.id===id)?.label).filter(Boolean);
 return {id:'dec-'+crypto.randomUUID().slice(0,8),title:q.title.slice(0,120),dimensions:[],candidates:q.options.map(o=>({id:o.id,name:o.label.slice(0,100),benefits:(o.detail||'').slice(0,4000),costs:'',rationale:'',violations:[],scores:{}})),
  ...(chosen?{selectedId:chosen}:{}),reason:(`来自引导回答：${labels.join('、')||'未选预设项'}${q.answer.note.trim()?'；补充：'+q.answer.note.trim():''}`).slice(0,4000),tradeoff:'',reconsiderWhen:'',affectedIds:[],status:'proposed',sourceQuestionIds:[q.id]};
}
export function linkSources(d:Design,nodeIds:string[],sourceIds:string[]):Design{
 const ids=new Set(nodeIds);return {...d,nodes:d.nodes.map(n=>ids.has(n.id)?{...n,sourceIds:[...new Set([...n.sourceIds,...sourceIds])]}:n)};
}
/** 同名对象加“角色 · 所在视图”区分；不重名保持原名。 */
export function nodeLabel(d:Design,id:string):string{
 const n=d.nodes.find(x=>x.id===id);if(!n)return id;if(d.nodes.filter(x=>x.name===n.name).length<2)return n.name;
 const views=d.views.filter(v=>v.nodeIds.includes(id)).map(v=>v.name);return `${n.name}（${ROLE_NAMES[n.role]||n.role}${views.length?' · '+views.join('/'):''}）`;
}
export function groupNodes(d:Design):{label:string;nodes:{id:string;label:string}[]}[]{
 return LAYERS.map(l=>({label:`${l.id} ${l.name}`,nodes:d.nodes.filter(n=>layerOfLevel(n.level)===l.id).map(n=>({id:n.id,label:nodeLabel(d,n.id)}))})).filter(g=>g.nodes.length);
}
