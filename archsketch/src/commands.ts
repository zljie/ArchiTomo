import { ROLE_NAMES, type Design } from './design.ts';
/** 命令面板搜索（STORY-018）：空查询列命令与视图；有查询时按 视图 → 元素 → 命令 排序，结果稳定，最多 50 项。 */
export type CommandItem={id:string;kind:'view'|'node'|'command';label:string;hint:string;target:string};
export const COMMANDS:{id:string;label:string;hint:string;keywords:string}[]=[
 {id:'templates',label:'打开模板库',hint:'完整架构、局部模式、我的模板',keywords:'模板 template 起步'},
 {id:'new-project',label:'新建项目',hint:'空白项目',keywords:'新建 new project'},
 {id:'layout',label:'自动布局当前视图',hint:'按视图方向排列',keywords:'布局 layout 排列'},
 {id:'guide',label:'打开 AI 引导',hint:'一次一个问题',keywords:'ai 引导 问题 guide'},
 {id:'constraints',label:'打开约束与质量',hint:'约束、质量场景、分析点',keywords:'约束 质量 场景 constraint'},
 {id:'toggle-code',label:'显示/隐藏图代码',hint:'图代码是图形的存储格式，按需查看或编辑',keywords:'图代码 代码 code dsl 显示 隐藏'},
 {id:'theme',label:'切换浅色 / 深色主题',hint:'外观',keywords:'主题 theme 浅色 深色 light dark'},
 {id:'export-doc',label:'导出设计说明书',hint:'Markdown，含 ADR',keywords:'导出 export 说明书 adr 文档'},
];
export function searchCommands(design:Design|null,query:string):CommandItem[]{
 const q=query.trim().toLowerCase();const hit=(...parts:string[])=>parts.join(' ').toLowerCase().includes(q);
 const commands:CommandItem[]=COMMANDS.filter(c=>!q||hit(c.label,c.hint,c.keywords)).map(c=>({id:'cmd:'+c.id,kind:'command',label:c.label,hint:c.hint,target:c.id}));
 const views:CommandItem[]=(design?.views||[]).filter(v=>!q||hit(v.name)).map(v=>({id:'view:'+v.id,kind:'view',label:v.name,hint:`视图 · ${v.nodeIds.length} 个元素`,target:v.id}));
 if(!q)return [...commands,...views].slice(0,50);
 const nodes:CommandItem[]=[];for(const v of design?.views||[])for(const id of v.nodeIds){const n=design!.nodes.find(x=>x.id===id);if(!n||nodes.some(x=>x.target===n.id))continue;const hint=`${ROLE_NAMES[n.role]||n.role} · ${v.name}`;if(hit(n.name,n.technology))nodes.push({id:'node:'+n.id,kind:'node',label:n.name,hint,target:n.id});}
 return [...views,...nodes,...commands].slice(0,50);
}
