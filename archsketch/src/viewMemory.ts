import type { Design } from './design.ts';
/** 视图与选中上下文（STORY-033 / F-07）：非绘图操作保持当前视图与仍存在的选中对象；重开项目恢复上次视图。 */
export function initialView(design:Design,stored:string|null):string{return stored&&design.views.some(v=>v.id===stored)?stored:design.views[0]?.id||'';}
export function keepContext(design:Design,viewId:string,selected:string|undefined,keep:boolean):{viewId:string;selected?:string}{
 const view=keep&&design.views.some(v=>v.id===viewId)?viewId:design.views[0]?.id||'';
 return keep&&selected&&design.nodes.some(n=>n.id===selected)?{viewId:view,selected}:{viewId:view};
}
export const viewKey=(projectId:string)=>'archsketch:view:'+projectId;
