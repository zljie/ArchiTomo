import { useState } from 'react';
import type { Design } from './design.ts';
import { ROLE_NAMES } from './design.ts';
import { objectTree, NODE_STATUS_NAMES } from './workbench.ts';
/** 对象树（STORY-029）：ADF 层 → 视图 → 元素，标出模型问题与确认状态；点击定位。 */
export default function ObjectTree({design,selected,onLocate,onView}:{design:Design;selected?:string;onLocate:(id:string)=>void;onView:(viewId:string)=>void}){
 const [query,setQuery]=useState('');const [closed,setClosed]=useState<Set<string>>(new Set());const tree=objectTree(design,query);
 const toggle=(k:string)=>{const n=new Set(closed);if(n.has(k))n.delete(k);else n.add(k);setClosed(n);};
 const total=tree.reduce((a,l)=>a+l.views.reduce((b,v)=>b+v.nodes.length,0),0);
 return <div className="object-tree"><div className="gx-label">架构资源树<small>{total} 个对象</small></div><input aria-label="搜索架构对象" placeholder="搜索架构对象…" value={query} onChange={e=>setQuery(e.target.value)}/>
  {!tree.length&&<p className="gx-hint">{query?'没有匹配的对象':'还没有架构对象。从画布添加，或让 AI 先画一版。'}</p>}
  {tree.map(l=><section key={l.layer} className="tree-layer"><button className="tree-head" aria-expanded={!closed.has(l.layer)} onClick={()=>toggle(l.layer)}><b>{l.layer}</b>{l.name}<small>{l.views.reduce((a,v)=>a+v.nodes.length,0)}</small></button>
   {!closed.has(l.layer)&&l.views.map(v=><div key={v.viewId} className="tree-view"><button className="tree-view-name" onClick={()=>onView(v.viewId)}>{v.name}</button>
    <ul>{v.nodes.map(n=><li key={n.id}><button className={'tree-node'+(selected===n.id?' on':'')} onClick={()=>onLocate(n.id)} title={(ROLE_NAMES[n.role]||n.role)+(n.status?' · '+NODE_STATUS_NAMES[n.status]:'')}><i className={'dot st-'+(n.status||'none')} aria-hidden="true"/><span>{n.name}</span>{n.issues>0&&<em className="tree-issue" aria-label={n.issues+' 个问题'}>!</em>}</button></li>)}</ul></div>)}
  </section>)}</div>;
}
