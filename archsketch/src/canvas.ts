import type { Design, DesignNode, DesignView } from './design.ts';
import { colorValue } from './elements.ts';
/**
 * 画布派生：模型 → React Flow 节点/连线/分组框。节点尺寸固定并显式给出 measured，
 * 受控 React Flow 每次重渲染拿到新对象时也不会因“未测量”而把节点隐藏（BUG-001）；连接点位置同样显式给出，
 * 连线不依赖浏览器测量（React Flow 仅在未提供 handles 时才测量 DOM）。
 */
export const NODE_W=224, NODE_H=72;
const PAD=28, TITLE=30, GAP_X=300, GAP_Y=180;
export type FlowNode={id:string;type:'architecture';data:{node:DesignNode};position:{x:number;y:number};selected:boolean;style:{width:number;height:number};width:number;height:number;measured:{width:number;height:number};handles:FlowHandle[];zIndex:number};
export type FlowHandle={type:'source'|'target';position:'left'|'right';x:number;y:number;width:number;height:number};
const HANDLE=8;
const HANDLES:FlowHandle[]=[{type:'target',position:'left',x:-HANDLE/2,y:NODE_H/2-HANDLE/2,width:HANDLE,height:HANDLE},{type:'source',position:'right',x:NODE_W-HANDLE/2,y:NODE_H/2-HANDLE/2,width:HANDLE,height:HANDLE}];
export type FlowEdge={id:string;source:string;target:string;type:'default';label:string;markerEnd?:{type:'arrowclosed';color?:string};markerStart?:{type:'arrowclosed';color?:string};style?:Record<string,string|number>};
export type GroupBox={id:string;name:string;x:number;y:number;width:number;height:number;depth:number;color?:string;icon?:string};
export function toFlowNodes(design:Design,view:DesignView,selected?:string):FlowNode[]{
 return design.nodes.filter(n=>view.nodeIds.includes(n.id)).map(n=>({id:n.id,type:'architecture',data:{node:n},position:view.positions[n.id],selected:n.id===selected,style:{width:NODE_W,height:NODE_H},width:NODE_W,height:NODE_H,measured:{width:NODE_W,height:NODE_H},handles:HANDLES,zIndex:1}));
}
const TYPE_NAMES:Record<string,string>={realizes:'实现',derives_from:'来源于',data_relation:'数据关系',deploys:'部署',constrained_by:'受约束',branch:'分支',failure:'失败',verified_by:'验证'};
export function toFlowEdges(design:Design,view:DesignView):FlowEdge[]{
 return design.relationships.filter(r=>view.nodeIds.includes(r.source)&&view.nodeIds.includes(r.target)).map(r=>{
  const color=colorValue(r.color);const marker={type:'arrowclosed' as const,...(color?{color}:{})};const arrow=r.arrow||'end';
  const style:Record<string,string|number>={...(r.line==='dashed'?{strokeDasharray:'6 4'}:{}),...(color?{stroke:color}:{})};
  return {id:r.id,source:r.source,target:r.target,type:'default' as const,label:r.label||(['depends_on','next'].includes(r.type)?'':TYPE_NAMES[r.type]||r.type),...(arrow!=='none'?{markerEnd:marker}:{}),...(arrow==='both'?{markerStart:marker}:{}),...(Object.keys(style).length?{style}:{})};
 });
}
/** 分组框：成员节点与子分组的包围盒，外层逐级加边距；只返回在当前视图有成员的分组。 */
export function groupBoxes(design:Design,view:DesignView):GroupBox[]{
 const inView=new Set(view.nodeIds);const groups=design.boundaries;const out=new Map<string,GroupBox|null>();
 const depth=(id:string):number=>{let d=0;let at=groups.find(g=>g.id===id);while(at?.parentId){d++;at=groups.find(g=>g.id===at!.parentId);}return d;};
 const box=(id:string):GroupBox|null=>{
  if(out.has(id))return out.get(id)!;const g=groups.find(x=>x.id===id)!;const rects:{x:number;y:number;w:number;h:number}[]=[];
  for(const nid of g.elementIds)if(inView.has(nid)&&view.positions[nid]){const p=view.positions[nid];rects.push({x:p.x,y:p.y,w:NODE_W,h:NODE_H});}
  for(const child of groups.filter(c=>c.parentId===id)){const b=box(child.id);if(b)rects.push({x:b.x,y:b.y,w:b.width,h:b.height});}
  if(!rects.length){out.set(id,null);return null;}
  const x=Math.min(...rects.map(r=>r.x))-PAD,y=Math.min(...rects.map(r=>r.y))-PAD-TITLE;const right=Math.max(...rects.map(r=>r.x+r.w))+PAD,bottom=Math.max(...rects.map(r=>r.y+r.h))+PAD;
  const result={id,name:g.name,x,y,width:right-x,height:bottom-y,depth:depth(id),...(g.color?{color:g.color}:{}),...(g.icon?{icon:g.icon}:{})};out.set(id,result);return result;
 };
 return groups.map(g=>box(g.id)).filter((b):b is GroupBox=>!!b).sort((a,b)=>a.depth-b.depth);
}
/** 第一个不与已有节点重叠的网格位置。 */
export function freeSlot(view:DesignView,near?:{x:number;y:number}):{x:number;y:number}{
 const taken=Object.values(view.positions);const free=(p:{x:number;y:number})=>taken.every(q=>Math.abs(p.x-q.x)>=NODE_W||Math.abs(p.y-q.y)>=NODE_H);
 if(near&&free(near))return near;
 for(let k=0;;k++){const p={x:(k%4)*GAP_X,y:Math.floor(k/4)*GAP_Y};if(free(p))return p;}
}

/** AI 建议预览（STORY-016）：before/after 的并集；删除对象留在原位置，只读展示。 */
export type Change='added'|'removed'|'changed'|'same';
export type PreviewResult={nodes:(FlowNode&{change:Change})[];edges:(FlowEdge&{change:Change})[];counts:{added:number;changed:number;removed:number}};
export function previewFlow(before:Design,after:Design,viewId:string):PreviewResult{
 const bv=before.views.find(v=>v.id===viewId),av=after.views.find(v=>v.id===viewId);const counts={added:0,changed:0,removed:0};
 if(!bv||!av)return {nodes:[],edges:[],counts};
 const same=(a:unknown,b:unknown)=>JSON.stringify(a)===JSON.stringify(b);
 const nodes:(FlowNode&{change:Change})[]=[];
 for(const n of toFlowNodes(after,av)){const old=before.nodes.find(x=>x.id===n.id);const change:Change=!old||!bv.nodeIds.includes(n.id)?'added':same(old,n.data.node)?'same':'changed';if(change!=='same')counts[change]++;nodes.push({...n,selected:false,change});}
 for(const n of toFlowNodes(before,bv))if(!av.nodeIds.includes(n.id)){counts.removed++;nodes.push({...n,selected:false,change:'removed'});}
 const afterEdges=toFlowEdges(after,av),beforeEdges=toFlowEdges(before,bv);const edges:(FlowEdge&{change:Change})[]=[];
 for(const e of afterEdges){const old=beforeEdges.find(x=>x.id===e.id);const change:Change=!old?'added':same(old,e)?'same':'changed';if(change!=='same')counts[change]++;edges.push({...e,change});}
 for(const e of beforeEdges)if(!afterEdges.some(x=>x.id===e.id)){counts.removed++;edges.push({...e,change:'removed'});}
 return {nodes,edges,counts};
}
