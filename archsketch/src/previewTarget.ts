import type { Design, Operation } from './design.ts';
import { previewFlow } from './canvas.ts';
/** 提案预览定位（STORY-033 / F-03）：按受影响视图定位；当前视图有变化则停留，否则跳到变化最多的视图。 */
export type ViewChange={viewId:string;name:string;added:number;changed:number;removed:number};
export function affectedViews(before:Design,after:Design):ViewChange[]{
 const out:ViewChange[]=[];for(const v of after.views){const c=previewFlow(before,after,v.id).counts;if(c.added+c.changed+c.removed)out.push({viewId:v.id,name:v.name,...c});}
 return out.map((x,i)=>({x,i})).sort((a,b)=>(b.x.added+b.x.changed+b.x.removed)-(a.x.added+a.x.changed+a.x.removed)||a.i-b.i).map(({x})=>x);
}
export function previewTarget(before:Design,after:Design,currentViewId:string,_operations:Operation[]=[]):string{
 const views=affectedViews(before,after);return views.some(v=>v.viewId===currentViewId)||!views.length?currentViewId:views[0].viewId;
}
