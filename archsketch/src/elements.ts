import type { DesignNode } from './design.ts';
/** 架构元素目录：角色 → 中文名、类别与自带通用图标（24×24 描边路径；厂商图标包为 Non-Goal）。 */
export type ElementSpec={role:string;name:string;category:string;icon:string;level:string};
export const ICONS:Record<string,string>={
 person:'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21a8 8 0 0 1 16 0',
 system:'M3 5h18v14H3zM3 9h18',
 external:'M7 18a5 5 0 1 1 1-9.9A6 6 0 0 1 19 10a4 4 0 0 1-1 8zM14 13l3-3m0 0h-2.5m2.5 0v2.5',
 client:'M3 4h18v12H3zM8 20h8M12 16v4',
 gateway:'M4 4h16v16H4zM9 8l-3 4 3 4M15 8l3 4-3 4',
 load_balancer:'M12 3v6M12 9l-7 6M12 9l7 6M12 9v6M5 15v5M12 15v5M19 15v5',
 application:'M3 4h18v16H3zM3 8h18M6 6h.01M9 6h.01',
 service:'M12 2l8.5 5v10L12 22l-8.5-5V7zM12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z',
 queue:'M3 6h18v4H3zM3 14h18v4H3zM7 8h.01M7 16h.01',
 cache:'M13 2L4 14h7l-1 8 9-12h-7z',
 database:'M4 6c0-2 16-2 16 0v12c0 2-16 2-16 0zM4 6c0 2 16 2 16 0M4 12c0 2 16 2 16 0',
 storage:'M3 7l9-4 9 4-9 4zM3 7v10l9 4 9-4V7M12 11v10',
 cdn:'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18',
 runtime:'M6 6h12v12H6zM9 2v4M15 2v4M9 18v4M15 18v4M2 9h4M2 15h4M18 9h4M18 15h4',
 server:'M3 4h18v6H3zM3 14h18v6H3zM7 7h.01M7 17h.01',
 container:'M12 2l9 5v10l-9 5-9-5V7zM3 7l9 5 9-5M12 12v10',
 cluster:'M3 3h8v8H3zM13 3h8v8h-8zM3 13h8v8H3zM13 13h8v8h-8z',
 network:'M12 5a2 2 0 1 0 0-.01M5 19a2 2 0 1 0 0-.01M19 19a2 2 0 1 0 0-.01M12 7v5M12 12l-6 5M12 12l6 5',
 capability:'M4 20V10l8-6 8 6v10zM9 20v-6h6v6',
 business_app:'M3 5h18v14H3zM3 9h18M7 13h4M7 16h7',
 platform:'M3 17l9 4 9-4M3 12l9 4 9-4M3 7l9-4 9 4-9 4z',
 function:'M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z',
 component:'M7 3h10v4H7zM4 10h16v11H4zM8 14h8',
 step:'M5 12h14M13 6l6 6-6 6',
 entity:'M4 4h16v16H4zM4 9h16M4 14h16M10 9v11',
 goal:'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z',
 constraint:'M6 11V8a6 6 0 0 1 12 0v3M4 11h16v10H4z',
 quality:'M12 3l2.6 5.6 6 .7-4.5 4.1 1.2 6L12 16.5 6.7 19.4l1.2-6L3.4 9.3l6-.7z',
};
const spec=(level:string,category:string,rows:[string,string][])=>rows.map(([role,name])=>({role,name,category,icon:role,level}));
export const ELEMENTS:ElementSpec[]=[
 ...spec('context','上下文',[['person','人员'],['system','系统'],['external','外部系统']]),
 ...spec('technical','接入',[['client','客户端'],['gateway','API 网关'],['load_balancer','负载均衡'],['cdn','CDN']]),
 ...spec('technical','计算',[['application','应用'],['service','服务']]),
 ...spec('technical','数据与消息',[['queue','消息队列'],['cache','缓存'],['database','数据库'],['storage','对象存储']]),
 ...spec('technical','外部',[['external','外部系统']]),
 ...spec('runtime','运行环境',[['runtime','运行资源'],['server','服务器'],['container','容器'],['cluster','集群'],['network','网络']]),
 ...spec('application','应用',[['business_app','业务应用'],['platform','平台 / 中台'],['external','外部系统']]),
 ...spec('capability','业务',[['capability','能力']]),...spec('function','业务',[['function','功能模块']]),...spec('component','实现',[['component','组件']]),
 ...spec('step','场景',[['step','场景步骤']]),...spec('entity','数据',[['entity','数据实体']]),
 ...spec('goal','目标',[['goal','目标']]),...spec('constraint','目标',[['constraint','约束']]),...spec('quality','目标',[['quality','质量要求']]),
];
export function elementsFor(level:string):ElementSpec[]{return ELEMENTS.filter(e=>e.level===level);}
export function iconFor(node:Pick<DesignNode,'role'|'icon'>):string{return node.icon&&ICONS[node.icon]?node.icon:ICONS[node.role]?node.role:'system';}
const NAMED=['red','orange','yellow','green','teal','blue','purple','pink','gray','black','white'];
export const COLOR_VALUES:Record<string,string>={red:'#e5484d',orange:'#f76b15',yellow:'#e2a336',green:'#30a46c',teal:'#12a594',blue:'#3e63dd',purple:'#8e4ec6',pink:'#d6409f',gray:'#8b8d98',black:'#1c2024',white:'#ffffff'};
export function isColor(v:unknown):boolean{return typeof v==='string'&&(NAMED.includes(v)||/^#[0-9a-fA-F]{6}$/.test(v));}
export const colorValue=(c?:string)=>c?COLOR_VALUES[c]||c:undefined;
