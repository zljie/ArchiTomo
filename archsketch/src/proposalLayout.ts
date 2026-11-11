import { projection, type Design, type Operation } from './design.ts';
import { boundaryBoxes, layoutModel } from './model.ts';
import { applyOperations } from './project.ts';
import { affectedViews } from './previewTarget.ts';
/** 同级分组外接矩形重叠对数（与 SVG 导出同一画法：成员外接矩形）。 */
export function siblingOverlaps(d:Design,viewId:string):number{
 const v=d.views.find(x=>x.id===viewId);if(!v)return 0;const m=projection(d,v);if(!(m.boundaries||[]).every(b=>b.elementIds.every(id=>m.view.positions[id])))return 0;
 const parent=new Map(d.boundaries.map(b=>[b.id,b.parentId||'']));const boxes=boundaryBoxes(m);let n=0;
 for(let i=0;i<boxes.length;i++)for(let j=i+1;j<boxes.length;j++){const a=boxes[i],b=boxes[j];if(parent.get(a.id)!==parent.get(b.id))continue;if(a.x<b.x+b.width&&b.x<a.x+a.width&&a.y<b.y+b.height&&b.y<a.y+a.height)n++;}
 return n;
}
const DIR={down:'DOWN',left:'LEFT',up:'UP',right:'RIGHT'} as const;
/** 提案自带分组布局（STORY-034 / F-05）：对新增了对象或同级分组重叠的受影响视图做一次分层布局，
 * 以 set_view 追加到提案末尾；预览与接受看到同一布局，只改坐标不改语义，撤销仍是单一修订。 */
export async function withLayout(before:Design,ops:Operation[]):Promise<Operation[]>{
 const after=applyOperations(before,ops);const extra:Operation[]=[];
 for(const c of affectedViews(before,after)){const v=after.views.find(x=>x.id===c.viewId)!;if(!v.nodeIds.length||(!c.added&&!siblingOverlaps(after,v.id)))continue;
  const laid=await layoutModel(projection(after,v),DIR[v.direction||'right']);const positions:Record<string,{x:number;y:number}>={};for(const id of v.nodeIds){const p=laid.view.positions[id]??v.positions[id];if(p)positions[id]={x:Math.round(p.x),y:Math.round(p.y)};}
  extra.push({type:'set_view',view:{id:v.id,nodeIds:[...v.nodeIds],positions,...(v.direction?{direction:v.direction}:{})}});}
 return extra.length?[...ops,...extra]:ops;
}
