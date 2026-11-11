import { LEVEL_ROLES, validateDesign, type Design, type DesignGroup, type DesignNode, type DesignRelation, type DesignView } from './design.ts';
import { ICONS, isColor } from './elements.ts';
import { applyOperations, pruneGroups } from './project.ts';
import { freeSlot } from './canvas.ts';
/**
 * 图代码（STORY-007，ADR-002）：Eraser 架构图语法子集，是单个视图的文本投影。模型仍是唯一正本——
 * parseCode 把代码解析为对模型的增量修改；任一错误都返回 design=null，不改模型。
 *   节点  名称 [id: x, type: service, icon: queue, color: blue, label: "显示名", tech: Kafka]
 *   分组  名称 [id: g, icon, color] {  …  }        可嵌套
 *   连线  A > B / A < B / A <> B / A - B / A -- B / A --> B，可 `A > B, C [type: realizes, color: red]: 标签`
 *   方向  direction down|up|left|right            注释  // …
 * 名称是代码内引用，label 为显示名；未声明的名称出现在连线中会自动创建节点。tech 缺省时保留原值（`tech: ""` 清空）。
 */
export type CodeError={line:number;message:string};
export type CodeSummary={added:number;updated:number;removed:number;groups:number;relations:number};
export type CodeResult={design:Design|null;errors:CodeError[];summary:CodeSummary;warnings?:string[]};
/** 宽松模式（仅用于 AI 草图）：常见别名映射到可用类型，未知图标/颜色/类型被忽略并记入 warnings。 */
const TYPE_ALIASES:Record<string,string>={mobile:'client',web:'client',app:'client',browser:'client',frontend:'client',user:'client',person:'client',actor:'client',context:'client',api:'gateway',api_gateway:'gateway',lb:'load_balancer',loadbalancer:'load_balancer',nginx:'load_balancer',microservice:'service',backend:'service',server:'service',worker:'service',function:'service',mq:'queue',kafka:'queue',message_queue:'queue',broker:'queue',redis:'cache',db:'database',rdbms:'database',mysql:'database',postgres:'database',postgresql:'database',mongodb:'database',s3:'storage',oss:'storage',object_storage:'storage',blob:'storage',third_party:'external',thirdparty:'external',saas:'external',system:'external'};
const EMPTY:CodeSummary={added:0,updated:0,removed:0,groups:0,relations:0};
export const baseViewId=(view:DesignView)=>view.id.replace(/^drill-/,'');
const defaultRole=(level:string)=>{const roles=LEVEL_ROLES[level]||[];return roles.includes('service')?'service':roles[0]||'service';};
const defaultType=(level:string)=>level==='step'?'next':'depends_on';
const OPS:Record<string,{arrow:'end'|'both'|'none';line:'solid'|'dashed';reverse?:boolean}>={'>':{arrow:'end',line:'solid'},'<':{arrow:'end',line:'solid',reverse:true},'<>':{arrow:'both',line:'solid'},'-':{arrow:'none',line:'solid'},'--':{arrow:'none',line:'dashed'},'-->':{arrow:'end',line:'dashed'}};
const opOf=(r:DesignRelation)=>{const arrow=r.arrow||'end',dashed=r.line==='dashed';return arrow==='both'?'<>':arrow==='none'?(dashed?'--':'-'):(dashed?'-->':'>');};

/* ---------- 生成 ---------- */
const needsQuote=(s:string)=>!s||/[\[\]{}<>,:"]/.test(s)||/(^|\s)(-|--|-->)(\s|$)/.test(s)||s.startsWith('//')||/^direction(\s|$)/.test(s)||s!==s.trim();
const tok=(s:string)=>needsQuote(s)?`"${s.replace(/"/g,"'")}"`:s;
const val=(s:string)=>/[,\]"]/.test(s)||s!==s.trim()||!s?`"${s.replace(/"/g,"'")}"`:s;
/** 节点在当前视图图代码中的引用名（与 toCode 一致）。 */
export function nodeToken(design:Design,view:DesignView,id:string):string{const nodes=design.nodes.filter(n=>view.nodeIds.includes(n.id));const n=nodes.find(x=>x.id===id)!;return nodes.filter(x=>x.name===n.name).length===1&&n.name.trim()?tok(n.name):n.id;}
export function toCode(design:Design,view:DesignView):string{
 const nodes=design.nodes.filter(n=>view.nodeIds.includes(n.id));const ids=new Set(nodes.map(n=>n.id));
 const count=new Map<string,number>();for(const n of nodes)count.set(n.name,(count.get(n.name)||0)+1);
 const token=(n:DesignNode)=>count.get(n.name)===1&&n.name.trim()?tok(n.name):n.id;
 const nodeLine=(n:DesignNode)=>{const props=[`id: ${n.id}`,`type: ${n.role}`,...(n.icon?[`icon: ${n.icon}`]:[]),...(n.color?[`color: ${val(n.color)}`]:[]),...(token(n)===n.id&&n.name!==n.id?[`label: ${val(n.name)}`]:[]),...(n.technology?[`tech: ${val(n.technology)}`]:[])];return `${token(n)} [${props.join(', ')}]`;};
 const groups=relevantGroups(design,view);const owner=new Map<string,string>();for(const g of groups)for(const id of g.elementIds)if(ids.has(id))owner.set(id,g.id);
 const lines=[`// 视图：${view.name} · 可用类型 ${(LEVEL_ROLES[view.level]||[]).join('/')}`,'// 节点 名称 [id, type, icon, color, label, tech]   分组 名称 { … }   连线 A > B: 标签（< <> - -- -->）'];
 if(view.direction)lines.push(`direction ${view.direction}`);lines.push('');
 for(const n of nodes)if(!owner.has(n.id))lines.push(nodeLine(n));
 const emit=(g:DesignGroup,indent:string)=>{lines.push(`${indent}${tok(g.name)} [${[`id: ${g.id}`,...(g.icon?[`icon: ${g.icon}`]:[]),...(g.color?[`color: ${val(g.color)}`]:[])].join(', ')}] {`);for(const n of nodes)if(owner.get(n.id)===g.id)lines.push(indent+'  '+nodeLine(n));for(const c of groups)if(c.parentId===g.id)emit(c,indent+'  ');lines.push(indent+'}');};
 for(const g of groups)if(!g.parentId||!groups.some(p=>p.id===g.parentId))emit(g,'');
 const rels=design.relationships.filter(r=>ids.has(r.source)&&ids.has(r.target));if(rels.length)lines.push('');
 const byId=new Map(nodes.map(n=>[n.id,n]));
 for(const r of rels){const props=[...(r.type!==defaultType(view.level)?[`type: ${r.type}`]:[]),...(r.color?[`color: ${val(r.color)}`]:[])];lines.push(`${token(byId.get(r.source)!)} ${opOf(r)} ${token(byId.get(r.target)!)}${props.length?` [${props.join(', ')}]`:''}${r.label&&r.label!==r.type?`: ${r.label.replace(/\n/g,' ')}`:''}`);}
 return lines.join('\n')+'\n';
}
/** 当前视图相关的分组：有成员在视图中，或有相关的子分组；按原顺序。 */
function relevantGroups(design:Design,view:DesignView):DesignGroup[]{
 const inView=new Set(view.nodeIds);const all=design.boundaries;const keep=new Set<string>();
 for(const g of all)if(g.elementIds.some(id=>inView.has(id))){let at:DesignGroup|undefined=g;while(at&&!keep.has(at.id)){keep.add(at.id);at=at.parentId?all.find(x=>x.id===at!.parentId):undefined;}}
 return all.filter(g=>keep.has(g.id));
}

/* ---------- 解析 ---------- */
function splitTop(s:string,sep:string):string[]{const out:string[]=[];let depth=0,quote=false,cur='';for(const ch of s){if(ch==='"')quote=!quote;else if(!quote&&ch==='[')depth++;else if(!quote&&ch===']')depth--;if(ch===sep&&!quote&&depth===0){out.push(cur);cur='';}else cur+=ch;}out.push(cur);return out;}
const unquote=(s:string)=>{s=s.trim();return s.length>=2&&s.startsWith('"')&&s.endsWith('"')?s.slice(1,-1):s;};
function props(raw:string|undefined,allowed:string[],lenient=false):Record<string,string>{const out:Record<string,string>={};if(raw===undefined)return out;for(const part of splitTop(raw,',')){if(!part.trim())continue;const at=part.indexOf(':');if(at<0)throw Error(`属性“${part.trim()}”缺少冒号`);const key=part.slice(0,at).trim().toLowerCase();if(!allowed.includes(key)){if(lenient)continue;throw Error(`不支持的属性“${key}”，可用：${allowed.join('/')}`);}out[key==='role'?'type':key]=unquote(part.slice(at+1));}return out;}
/** 拆出“名称 [属性]”；名称可加双引号。 */
function head(text:string):{name:string;raw?:string}{text=text.trim();let name:string,rest:string;
 if(text.startsWith('"')){const end=text.indexOf('"',1);if(end<0)throw Error('引号未闭合');name=text.slice(1,end);rest=text.slice(end+1).trim();}
 else{const at=text.indexOf('[');name=(at<0?text:text.slice(0,at)).trim();rest=at<0?'':text.slice(at).trim();}
 if(!name.trim())throw Error('名称为空');if(name.length>80)throw Error('名称超过80字');
 if(!rest)return {name};if(!rest.startsWith('[')||!rest.endsWith(']'))throw Error('属性须写在名称后的 [ ] 中');return {name,raw:rest.slice(1,-1)};}
function findOp(text:string):{at:number;op:string}|null{let quote=false,depth=0;for(let i=0;i<text.length;i++){const ch=text[i];if(ch==='"')quote=!quote;else if(!quote&&ch==='[')depth++;else if(!quote&&ch===']')depth--;if(quote||depth||ch!==' ')continue;for(const op of ['-->','<>','--','>','<','-'])if(text.startsWith(op+' ',i+1))return {at:i,op};}return null;}

type NodeDecl={token:string;name:string;id:string;type?:string;icon?:string;color?:string;tech?:string;group:string|null;line:number;declared:boolean};
type GroupDecl={token:string;name:string;id:string;icon?:string;color?:string;parent:string|null;line:number;children:number};
type EdgeDecl={line:number;source:string;targets:string[];op:string;type?:string;color?:string;label:string};

export function parseCode(design:Design,view:DesignView,code:string,parentId?:string,opts:{lenient?:boolean}={}):CodeResult{
 const errors:CodeError[]=[];const warnings:string[]=[];const level=view.level;const roles=LEVEL_ROLES[level]||[];
 const lines=code.split('\n');if(lines.length>5000)return {design:null,errors:[{line:0,message:'代码超过5000行'}],summary:EMPTY};
 const viewIds=new Set(view.nodeIds);const existing=design.nodes.filter(n=>viewIds.has(n.id));const outside=new Set(design.nodes.filter(n=>!viewIds.has(n.id)).map(n=>n.id));
 const oldGroups=relevantGroups(design,view);
 const nodes:NodeDecl[]=[];const groups:GroupDecl[]=[];const edges:EdgeDecl[]=[];const stack:GroupDecl[]=[];let direction:DesignView['direction'];
 const usedIds=new Set<string>();const claim=(id:string)=>{usedIds.add(id);return id;};
 const shortId=(prefix:string)=>{for(;;){const id=prefix+crypto.randomUUID().slice(0,6);if(!usedIds.has(id)&&!design.nodes.some(n=>n.id===id)&&!design.boundaries.some(b=>b.id===id)&&!design.relationships.some(r=>r.id===id))return claim(id);}};
 const checkId=(id:string)=>{if(!/^[\w-]{1,100}$/.test(id))throw Error(`ID“${id}”只能使用字母、数字、_、-`);if(outside.has(id))throw Error(`ID“${id}”已被其他视图的对象使用`);if(usedIds.has(id))throw Error(`ID“${id}”重复`);return claim(id);};
 const declareNode=(token:string,p:Record<string,string>,line:number,declared:boolean)=>{
  const dup=nodes.find(n=>n.token===token);if(dup)throw Error(`名称“${token}”重复（第${dup.line}行），请改名或用 label 设置显示名`);
  if(groups.some(g=>g.token===token))throw Error(`“${token}”已是分组名称`);
  if(opts.lenient){if(p.type!==undefined&&!roles.includes(p.type)){const alias=TYPE_ALIASES[p.type.toLowerCase()];if(alias&&roles.includes(alias))p.type=alias;else{warnings.push(`“${token}”的类型 ${p.type} 不可用，按默认处理`);delete p.type;}}if(p.icon!==undefined&&!Object.hasOwn(ICONS,p.icon)){delete p.icon;}if(p.color!==undefined&&!isColor(p.color)){delete p.color;}}
  if(p.type!==undefined&&!roles.includes(p.type))throw Error(`类型“${p.type}”不属于此视图，可用：${roles.join('/')}`);
  if(p.icon!==undefined&&!Object.hasOwn(ICONS,p.icon))throw Error(`图标“${p.icon}”不存在`);if(p.color!==undefined&&!isColor(p.color))throw Error(`颜色“${p.color}”无效，使用颜色名或 #RRGGBB`);
  if(p.tech!==undefined&&p.tech.length>100)throw Error('tech 超过100字');const name=p.label??token;if(name.length>80)throw Error('显示名超过80字');
  const id=p.id!==undefined?checkId(p.id):existing.find(n=>n.name===name&&!usedIds.has(n.id))?.id;
  nodes.push({token,name,id:id?claim(id):shortId('n-'),type:p.type,icon:p.icon,color:p.color,tech:p.tech,group:declared?stack.at(-1)?.token??null:null,line,declared});
 };
 lines.forEach((raw,i)=>{const line=i+1;const text=raw.trim();if(!text||text.startsWith('//'))return;
  try{
   if(text==='}'){const g=stack.pop();if(!g)throw Error('多余的 }，没有对应的分组');if(!g.children)errors.push({line:g.line,message:`分组“${g.token}”不能为空`});if(stack.length)stack.at(-1)!.children++;return;}
   const dir=/^direction\s+(\S+)$/.exec(text);if(dir){if(!['right','down','left','up'].includes(dir[1]))throw Error('direction 只能是 right/down/left/up');direction=dir[1] as DesignView['direction'];return;}
   if(text.endsWith('{')){const placeholder:GroupDecl={token:'',name:'',id:'',parent:null,line,children:1};stack.push(placeholder);const h=head(text.slice(0,-1));placeholder.token=h.name;const p=props(h.raw,['id','icon','color'],opts.lenient);if(opts.lenient){if(p.icon!==undefined&&!Object.hasOwn(ICONS,p.icon))delete p.icon;if(p.color!==undefined&&!isColor(p.color))delete p.color;}if(groups.some(g=>g.token===h.name)||nodes.some(n=>n.token===h.name))throw Error(`分组名称“${h.name}”重复`);
    if(p.icon!==undefined&&!Object.hasOwn(ICONS,p.icon))throw Error(`图标“${p.icon}”不存在`);if(p.color!==undefined&&!isColor(p.color))throw Error(`颜色“${p.color}”无效`);
    let id:string;if(p.id!==undefined){if(!/^[\w-]{1,100}$/.test(p.id))throw Error(`ID“${p.id}”只能使用字母、数字、_、-`);if(usedIds.has(p.id)||design.nodes.some(n=>n.id===p.id))throw Error(`ID“${p.id}”重复`);id=claim(p.id);}
    else{const old=oldGroups.find(g=>g.name===h.name&&!usedIds.has(g.id));id=old?claim(old.id):shortId('g-');}
    stack.pop();const g:GroupDecl={token:h.name,name:h.name,id,icon:p.icon,color:p.color,parent:stack.at(-1)?.token??null,line,children:0};groups.push(g);stack.push(g);return;}
   const op=findOp(text);
   if(op){const left=text.slice(0,op.at).trim();let right=text.slice(op.at+op.op.length+2).trim();const colon=splitTop(right,':');let label='';if(colon.length>1){label=colon.slice(1).join(':').trim();right=colon[0].trim();}
    let raw:string|undefined;const bracket=right.lastIndexOf('[');if(right.endsWith(']')&&bracket>=0&&!right.slice(bracket).includes('"')){raw=right.slice(bracket+1,-1);right=right.slice(0,bracket).trim();}
    const p=props(raw,['type','color'],opts.lenient);if(opts.lenient&&p.color!==undefined&&!isColor(p.color))delete p.color;if(p.color!==undefined&&!isColor(p.color))throw Error(`颜色“${p.color}”无效`);if(label.length>120)throw Error('连线标签超过120字');if(p.type!==undefined&&!/^[\w-]{1,60}$/.test(p.type))throw Error('连线 type 无效');
    const targets=splitTop(right,',').map(unquote).filter(Boolean);const source=unquote(left);if(!source||!targets.length)throw Error('连线需要两端名称');
    edges.push({line,source,targets,op:op.op,type:p.type,color:p.color,label});if(stack.length)stack.at(-1)!.children++;return;}
   const h=head(text);declareNode(h.name,props(h.raw,opts.lenient?['id','type','icon','color','label','tech','role']:['id','type','icon','color','label','tech'],opts.lenient),line,true);if(stack.length)stack.at(-1)!.children++;
  }catch(e){errors.push({line,message:(e as Error).message});}
 });
 for(const g of stack){const msg=`分组“${g.token}”未闭合，缺少 }`;const same=errors.find(e=>e.line===g.line);if(same)same.message+='；'+msg;else errors.push({line:g.line,message:msg});}
 const resolve=(token:string,line:number)=>{const n=nodes.find(x=>x.token===token);if(n)return n.id;if(groups.some(g=>g.token===token))throw Error(`连线不能连接分组“${token}”`);declareNode(token,{},line,false);return nodes.at(-1)!.id;};
 type Link={source:string;target:string;op:string;type?:string;color?:string;label:string};const links:Link[]=[];
 for(const e of edges)try{const s=resolve(e.source,e.line);for(const t of e.targets){const target=resolve(t,e.line);if(s===target)throw Error('连线两端不能是同一节点');const spec=OPS[e.op];links.push({source:spec.reverse?target:s,target:spec.reverse?s:target,op:e.op,type:e.type,color:e.color,label:e.label});}}catch(err){errors.push({line:e.line,message:(err as Error).message});}
 if(errors.length)return {design:null,errors:errors.sort((a,b)=>a.line-b.line),summary:EMPTY};

 // 1. 删除代码中不再出现的节点（连带引用）
 const keep=new Set(nodes.map(n=>n.id));const removed=existing.filter(n=>!keep.has(n.id));
 let next=applyOperations(design,removed.map(n=>({type:'remove_node' as const,id:n.id})));
 const v=next.views.find(x=>x.id===baseViewId(view))!;
 // 2. 新增/更新节点（未声明、仅在连线中出现的已有节点保持原样）
 let added=0,updated=0;
 for(const d of nodes){const old=next.nodes.find(n=>n.id===d.id);
  if(old){if(!d.declared)continue;const upd:DesignNode={...old,name:d.name,role:d.type??old.role,technology:d.tech??old.technology};delete upd.icon;delete upd.color;if(d.icon)upd.icon=d.icon;if(d.color)upd.color=d.color;if(JSON.stringify(upd)!==JSON.stringify(old)){const at=next.nodes.indexOf(old);next.nodes[at]=upd;updated++;}}
  else{next.nodes.push({id:d.id,name:d.name,level,role:d.type??defaultRole(level),technology:d.tech??'',description:'',sourceIds:[],...(parentId?{parentId}:{}),...(level==='step'?{order:v.nodeIds.length+1}:{}),...(d.icon?{icon:d.icon}:{}),...(d.color?{color:d.color}:{})});added++;}
  if(!v.nodeIds.includes(d.id)){v.positions[d.id]=freeSlot(v);v.nodeIds.push(d.id);}
 }
 // 3. 分组：代码中的分组决定视图内已声明节点的归属；视图外成员与未声明节点的原归属保留
 const prev=new Map(next.boundaries.map(g=>[g.id,JSON.stringify(g)]));const inView=new Set(v.nodeIds);const codeIds=new Set(groups.map(g=>g.id));
 const declaredIds=new Set(nodes.filter(n=>n.declared).map(n=>n.id));
 let all:DesignGroup[]=next.boundaries.map(g=>({...g,elementIds:g.elementIds.filter(id=>!inView.has(id)||(!declaredIds.has(id)&&codeIds.has(g.id)))}));
 for(const g of groups){const at=all.findIndex(x=>x.id===g.id);const old=at>=0?all[at]:undefined;const parent=g.parent?groups.find(p=>p.token===g.parent)!.id:undefined;
  const members=nodes.filter(n=>n.declared&&n.group===g.token).map(n=>n.id);
  const ng:DesignGroup={id:g.id,name:g.name,elementIds:[...(old?.elementIds||[]),...members],...(parent?{parentId:parent}:{}),...(g.color?{color:g.color}:{}),...(g.icon?{icon:g.icon}:{})};if(at>=0)all[at]=ng;else all.push(ng);}
 all=pruneGroups(all);for(const g of all)if(g.parentId&&!all.some(p=>p.id===g.parentId))delete g.parentId;next.boundaries=all;
 const after=new Map(all.map(g=>[g.id,JSON.stringify(g)]));let groupChanges=0;for(const id of new Set([...oldGroups.map(g=>g.id),...groups.map(g=>g.id)]))if((prev.get(id)??null)!==(after.get(id)??null))groupChanges++;
 // 4. 连线：同一端点优先复用原关系（保持ID），视图内未出现的关系删除
 const finalIds=new Set(v.nodeIds);const beforeRels=design.relationships.filter(r=>viewIds.has(r.source)&&viewIds.has(r.target));
 const inside=(r:DesignRelation)=>finalIds.has(r.source)&&finalIds.has(r.target);const candidates=next.relationships.filter(inside);const used=new Set<string>();
 const rels=links.map(l=>{const old=candidates.find(r=>!used.has(r.id)&&r.source===l.source&&r.target===l.target&&(!l.type||r.type===l.type));if(old)used.add(old.id);const spec=OPS[l.op];const type=l.type||old?.type||defaultType(level);
  const label=l.label||(old&&(old.label===''||old.label===old.type)?old.label:'');const r:DesignRelation={id:old?.id||shortId('r-'),source:l.source,target:l.target,type,label};
  if(spec.line==='dashed')r.line='dashed';else if(old?.line==='solid')r.line='solid';if(spec.arrow!=='end')r.arrow=spec.arrow;else if(old?.arrow==='end')r.arrow='end';if(l.color)r.color=l.color;return r;});
 const order=new Map(next.relationships.map((r,i)=>[r.id,i]));
 next.relationships=[...next.relationships.filter(r=>!inside(r)),...rels].sort((a,b)=>(order.get(a.id)??1e9)-(order.get(b.id)??1e9));
 const keyed=(list:DesignRelation[])=>new Map(list.map(r=>[r.id,JSON.stringify(r)]));const b=keyed(beforeRels),a=keyed(rels);let relChanges=0;for(const id of new Set([...b.keys(),...a.keys()]))if(b.get(id)!==a.get(id))relChanges++;
 // 5. 方向
 if(direction)v.direction=direction;else delete v.direction;
 try{next=validateDesign(next);}catch(e){return {design:null,errors:[{line:0,message:'应用后模型无效：'+(e as Error).message}],summary:EMPTY};}
 return {design:next,errors:[],summary:{added,updated,removed:removed.length,groups:groupChanges,relations:relChanges},...(warnings.length?{warnings}:{})};
}
