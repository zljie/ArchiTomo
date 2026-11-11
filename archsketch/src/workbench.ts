import type { Design } from './design.ts';
import { LAYERS, layerOfView } from './layers.ts';
import { profileFindings } from './profile.ts';
/**
 * 工作台 v2（STORY-029 / ADR-009）：从模型派生对象树与层级分组，不另存。
 * 元素确认状态：草稿 / AI 生成待确认 / 待评审 / 已确认（可缺省）。
 */
export type NodeStatus='draft'|'ai'|'review'|'confirmed';
export const NODE_STATUS_NAMES:Record<NodeStatus,string>={draft:'草稿',ai:'AI 生成·待确认',review:'待评审',confirmed:'已确认'};
export type TreeNode={id:string;name:string;role:string;status?:NodeStatus;issues:number};
export type TreeLayer={layer:string;name:string;views:{viewId:string;name:string;nodes:TreeNode[]}[]};
export type Workspace='design'|'review'|'decisions'|'delivery';
export const WORKSPACES:{id:Workspace;name:string}[]=[{id:'design',name:'架构设计'},{id:'review',name:'架构评审'},{id:'decisions',name:'设计决策'},{id:'delivery',name:'交付中心'}];
export function issueCounts(d:Design):Map<string,number>{const m=new Map<string,number>();for(const f of profileFindings(d))if(f.targetId&&f.severity!=='info')m.set(f.targetId,(m.get(f.targetId)||0)+1);return m;}
export function objectTree(d:Design,query=''):TreeLayer[]{
 const q=query.trim().toLowerCase();const issues=issueCounts(d);const out:TreeLayer[]=[];
 for(const l of LAYERS){const views=d.views.filter(v=>layerOfView(v)===l.id).map(v=>({viewId:v.id,name:v.name,nodes:v.nodeIds.map(id=>d.nodes.find(n=>n.id===id)).filter((n):n is Design['nodes'][number]=>!!n&&(!q||n.name.toLowerCase().includes(q))).map(n=>({id:n.id,name:n.name||'待命名',role:n.role,...(n.status?{status:n.status as NodeStatus}:{}),issues:issues.get(n.id)||0}))})).filter(v=>v.nodes.length);
  if(views.length)out.push({layer:l.id,name:l.name,views});}
 return out;
}
