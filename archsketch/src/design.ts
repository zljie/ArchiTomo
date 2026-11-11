import { ICONS, isColor } from './elements.ts';
import { checkStoredRelations } from './profile.ts';
import { parseModel, type ArchitectureModel, type ArchitectureElement, type Position, type Requirement, type Assumption, type Boundary } from './model.ts';
export const DOMAINS = ['goals_constraints','system_context','capabilities','functional_structure','technical_structure','key_scenarios','data','deployment','quality','decisions_evolution'] as const;
export const DOMAIN_NAMES = ['目标与约束','系统边界','业务能力','功能结构','技术结构','关键协作','数据架构','运行部署','质量治理','决策与演进'];
export type Perspective = 'context'|'functional'|'application'|'technical'|'scenario'|'data'|'deployment';
export type DesignNode = { id:string; name:string; level:string; role:string; technology:string; description:string; sourceIds:string[]; parentId?:string; relatedIds?:string[]; order?:number; requirementIds?:string[]; legacyKind?:ArchitectureElement['kind']; c4Type?:ArchitectureElement['c4Type']; icon?:string; color?:string; sourcing?:'build'|'buy'|'reuse'; status?:'draft'|'ai'|'review'|'confirmed' };
export type DesignRelation = { id:string; source:string; target:string; type:string; label:string; line?:'solid'|'dashed'; arrow?:'end'|'both'|'none'; color?:string };
export type DesignView = { id:string; name:string; perspective:Perspective; level:string; nodeIds:string[]; positions:Record<string,Position>; direction?:'right'|'down'|'left'|'up' };
export type Coverage = { domain:typeof DOMAINS[number]; state:'designed'|'needs_clarification'|'not_applicable'; reason:string; objectIds:string[] };
export type Candidate = { id:string; name:string; benefits:string; costs:string; rationale:string; violations:string[]; scores:Record<string,number|null> };
export type Decision = { id:string; title:string; dimensions:{id:string;name:string;weight:number}[]; candidates:Candidate[]; selectedId?:string; reason:string; tradeoff:string; reconsiderWhen:string; affectedIds:string[]; layer?:'L0'|'L1'|'L2'|'L3'|'L4'; status?:'proposed'|'accepted'|'superseded'; waiver?:string; supersededBy?:string; supersedes?:string; confirmedBy?:string; acceptedAt?:string; verification?:string; sourceQuestionIds?:string[] };
export type Evidence = { id:string; text:string; objectIds:string[]; revisionId:string; result:'planned'|'pass'|'fail'|'stale' };
export type LayerSetting = { id:'L0'|'L1'|'L2'|'L3'|'L4'; applicable:boolean; reason:string; question:string };
export type Constraint = { id:string; kind:'scale'|'availability'|'cost'|'team'|'compliance'|'deployment'|'evolution'|'other'; name:string; value:string; unit:string; status:'confirmed'|'unconfirmed'; note:string; objectIds:string[]; decisionIds:string[] };
export type QualityScenario = { id:string; attribute:'availability'|'performance'|'security'|'modifiability'|'reliability'|'scalability'|'usability'|'cost'|'other'; source:string; stimulus:string; environment:string; response:string; measure:string; verification:string; objectIds:string[]; decisionIds:string[]; evidenceIds:string[] };
export type AnalysisPoint = { id:string; kind:'sensitivity'|'tradeoff'|'risk'|'nonrisk'; text:string; scenarioIds:string[]; objectIds:string[]; decisionIds:string[] };
export type Design = { modelVersion:2; title:string; nodes:DesignNode[]; relationships:DesignRelation[]; views:DesignView[]; coverage:Coverage[]; decisions:Decision[]; requirements:Requirement[]; assumptions:Assumption[]; boundaries:DesignGroup[]; risks:{id:string;text:string;objectIds:string[]}[]; evidence:Evidence[]; layers?:LayerSetting[]; constraints?:Constraint[]; scenarios?:QualityScenario[]; points?:AnalysisPoint[] };
export type DesignGroup = Boundary & { parentId?:string; color?:string; icon?:string };
export type Operation = { type:'set_node'; node:DesignNode }|{type:'remove_node';id:string}|{type:'set_relation';relation:DesignRelation}|{type:'set_coverage';coverage:Coverage}|{type:'set_decision';decision:Decision}|{type:'set_risk';risk:Design['risks'][number]}|{type:'set_evidence';evidence:Evidence}|{type:'remove_relation';id:string}|{type:'set_group';group:DesignGroup}|{type:'remove_group';id:string}|{type:'set_view';view:Pick<DesignView,'id'|'positions'|'direction'>&{nodeIds?:string[]}};
export function newDesign(title='新架构设计'):Design { return {modelVersion:2,title,nodes:[],relationships:[],views:VIEW_SPECS.map(v=>({...v,nodeIds:[],positions:{}})),coverage:DOMAINS.map(domain=>({domain,state:'needs_clarification',reason:'待澄清',objectIds:[]})),decisions:[],requirements:[],assumptions:[],boundaries:[],risks:[],evidence:[]}; }
export const VIEW_SPECS: {id:string;name:string;perspective:Perspective;level:string}[] = [
 {id:'context',name:'系统上下文',perspective:'context',level:'context'},
 {id:'capabilities',name:'业务能力',perspective:'functional',level:'capability'},
 {id:'functions',name:'功能模块',perspective:'functional',level:'function'},
 {id:'applications',name:'应用架构',perspective:'application',level:'application'},
 {id:'technical',name:'技术容器',perspective:'technical',level:'technical'},
 {id:'components',name:'核心组件',perspective:'technical',level:'component'},
 {id:'scenario',name:'关键场景',perspective:'scenario',level:'step'},
 {id:'data',name:'数据架构',perspective:'data',level:'entity'},
 {id:'deployment',name:'运行部署',perspective:'deployment',level:'runtime'},
 {id:'goals',name:'设计目标',perspective:'functional',level:'goal'},
 {id:'constraints',name:'约束条件',perspective:'functional',level:'constraint'},
 {id:'qualities',name:'质量目标',perspective:'functional',level:'quality'},
];
export function record(v:unknown):Record<string,unknown>{if(!v||typeof v!=='object'||Array.isArray(v))throw Error('对象结构无效');return v as Record<string,unknown>;}
export function string(v:unknown,max=4000,required=false,field=''):string{if(typeof v!=='string'||v.length>max||(required&&!v.trim())||/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/u.test(v))throw Error(`${field||'文字'}无效或过长（上限 ${max} 字${typeof v==='string'?`，当前 ${v.length} 字`:''}）`);return v;}
export function identifier(v:unknown):string{const s=string(v,100,true);if(!/^[\w-]+$/.test(s))throw Error('ID无效');return s;}
export function array(v:unknown,max=2000):unknown[]{if(!Array.isArray(v)||v.length>max)throw Error('数组无效或超限');return v;}
export function keys(v:Record<string,unknown>,allowed:string[]){if(Object.keys(v).some(k=>!allowed.includes(k)))throw Error('存在未识别字段，不能静默丢弃');}
const refs=(v:unknown,ids:Set<string>)=>{const a=array(v).map(identifier);if(new Set(a).size!==a.length||a.some(id=>!ids.has(id)))throw Error('引用不存在或重复');};
export function validateDesign(value:unknown):Design {
 const d=record(value);keys(d,['modelVersion','title','nodes','relationships','views','coverage','decisions','requirements','assumptions','boundaries','risks','evidence','constraints','scenarios','points','layers']);
 if(d.modelVersion!==2)throw Error('模型版本不支持');string(d.title,120,true);
 const used=new Set<string>();const take=(v:unknown)=>{const id=identifier(v);if(used.has(id))throw Error('ID重复');used.add(id);return id;};
 const nodes=array(d.nodes,500).map(record);const nodeIds=new Set(nodes.map(n=>take(n.id)));
 const requirements=array(d.requirements,50).map(record);const rqIds=new Set(requirements.map(r=>{const id=take(r.id);string(r.text,500,true);return id;}));
 const evidence=array(d.evidence,200).map(record);const evIds=new Set(evidence.map(e=>take(e.id)));
 for(const n of nodes){keys(n,['id','name','level','role','technology','description','sourceIds','parentId','relatedIds','order','requirementIds','c4Type','legacyKind','icon','color','sourcing','status']);if(n.status!==undefined&&!['draft','ai','review','confirmed'].includes(String(n.status)))throw Error('元素状态无效');if(n.sourcing!==undefined&&!['build','buy','reuse'].includes(String(n.sourcing)))throw Error('应用来源无效');if(n.icon!==undefined&&!Object.hasOwn(ICONS,String(n.icon)))throw Error('图标名称无效');if(n.color!==undefined&&!isColor(n.color))throw Error('颜色无效');string(n.name,80);string(n.level,60,true);if(!Object.hasOwn(LEVEL_ROLES,String(n.level)))throw Error('节点层级无效');string(n.role,60,true);string(n.technology,100);string(n.description,4000);array(n.sourceIds,100).forEach(identifier);
  if(n.parentId!==undefined){if(!nodeIds.has(identifier(n.parentId))||n.parentId===n.id)throw Error('父节点引用无效');}
  if(n.relatedIds!==undefined)refs(n.relatedIds,nodeIds);if(n.requirementIds!==undefined)refs(n.requirementIds,rqIds);
  if(n.order!==undefined&&(typeof n.order!=='number'||!Number.isFinite(n.order)||n.order<0))throw Error('场景顺序无效');
  if(n.c4Type!==undefined&&!['person','system','container'].includes(String(n.c4Type)))throw Error('C4角色无效');
  if(n.legacyKind!==undefined&&!['application','service','database','external'].includes(String(n.legacyKind)))throw Error('旧组件类型无效');
 }
 for(const n of nodes){const visited=new Set<string>();let at:Record<string,unknown>|undefined=n;while(at){const id=String(at.id);if(visited.has(id))throw Error('包含关系成环');visited.add(id);at=at.parentId?nodes.find(x=>x.id===at!.parentId):undefined;}}
 const allTargets=new Set([...nodeIds,...evIds]);
 for(const value of array(d.relationships,2000)){const r=record(value);keys(r,['id','source','target','type','label','line','arrow','color']);if(r.line!==undefined&&!['solid','dashed'].includes(String(r.line)))throw Error('连线线型无效');if(r.arrow!==undefined&&!['end','both','none'].includes(String(r.arrow)))throw Error('连线箭头无效');if(r.color!==undefined&&!isColor(r.color))throw Error('颜色无效');take(r.id);if(!nodeIds.has(identifier(r.source))||!allTargets.has(identifier(r.target)))throw Error('关系引用不存在');string(r.type,60,true);string(r.label,120);if(!nodeIds.has(String(r.target))&&r.type!=='verified_by')throw Error('证据关系类型无效');}
 for(const value of array(d.views,30)){const v=record(value);keys(v,['id','name','perspective','level','nodeIds','positions','direction']);if(v.direction!==undefined&&!['right','down','left','up'].includes(String(v.direction)))throw Error('视图方向无效');take(v.id);string(v.name,80,true);string(v.level,60,true);if(!['context','functional','application','technical','scenario','data','deployment'].includes(String(v.perspective)))throw Error('视角无效');refs(v.nodeIds,nodeIds);const positions=record(v.positions);if(Object.keys(positions).length!==(v.nodeIds as string[]).length)throw Error('视图坐标不完整');for(const id of v.nodeIds as string[]){const point=record(positions[id]);if(typeof point.x!=='number'||typeof point.y!=='number'||![point.x,point.y].every(n=>Number.isFinite(n)&&Math.abs(n)<=1e6))throw Error('坐标无效');}}
 const coverage=array(d.coverage,10).map(record);if(coverage.length!==10||new Set(coverage.map(c=>c.domain)).size!==10)throw Error('需要十个不重复的问题域');
 for(const c of coverage){keys(c,['domain','state','reason','objectIds']);if(!DOMAINS.includes(c.domain as typeof DOMAINS[number])||!['designed','needs_clarification','not_applicable'].includes(String(c.state)))throw Error('问题域状态无效');string(c.reason,4000);refs(c.objectIds,nodeIds);}
 for(const value of array(d.decisions,50)){const dec=record(value);keys(dec,['id','title','dimensions','candidates','selectedId','layer','status','waiver','supersededBy','supersedes','reason','tradeoff','reconsiderWhen','affectedIds','confirmedBy','acceptedAt','verification','sourceQuestionIds']);if(dec.sourceQuestionIds!==undefined)for(const q of array(dec.sourceQuestionIds,50))string(q,200,true);if(dec.confirmedBy!==undefined)string(dec.confirmedBy,80);if(dec.acceptedAt!==undefined&&Number.isNaN(Date.parse(string(dec.acceptedAt,40))))throw Error('决策接受时间无效');if(dec.verification!==undefined)string(dec.verification,4000);if(dec.status!==undefined&&!['proposed','accepted','superseded'].includes(String(dec.status)))throw Error('决策状态无效');if(dec.waiver!==undefined)string(dec.waiver,2000);if(dec.layer!==undefined&&!['L0','L1','L2','L3','L4'].includes(String(dec.layer)))throw Error('决策所属层无效');take(dec.id);string(dec.title,120);refs(dec.affectedIds,nodeIds);for(const k of ['reason','tradeoff','reconsiderWhen'])string(dec[k],4000);
  const dims=array(dec.dimensions,20).map(record);const dimIds=new Set(dims.map(x=>identifier(x.id)));if(dimIds.size!==dims.length)throw Error('比较维度重复');for(const dim of dims){string(dim.name,100);if(typeof dim.weight!=='number'||!Number.isFinite(dim.weight)||dim.weight<0||dim.weight>100)throw Error('权重无效');}
  const candidates=array(dec.candidates,20).map(record);const candidateIds=new Set(candidates.map(x=>identifier(x.id)));if(candidateIds.size!==candidates.length)throw Error('候选ID重复');for(const c of candidates){string(c.name,100);for(const k of ['benefits','costs','rationale'])string(c[k],4000);array(c.violations,50).forEach(x=>string(x,500));const scores=record(c.scores);for(const [k,v] of Object.entries(scores))if(!dimIds.has(k)||(v!==null&&(typeof v!=='number'||!Number.isFinite(v)||v<0||v>5)))throw Error('评分必须为0～5或待补充');}
  if(dec.selectedId!==undefined&&!candidateIds.has(identifier(dec.selectedId)))throw Error('选择的候选不存在');
 }
 for(const value of array(d.assumptions,50)){const a=record(value);take(a.id);string(a.text,500);if(typeof a.confirmed!=='boolean')throw Error('假设状态无效');}
 const groups=array(d.boundaries,100).map(record);const groupIds=new Set<string>();const owner=new Map<string,string>();
 for(const b of groups){keys(b,['id','name','elementIds','parentId','color','icon']);groupIds.add(take(b.id));string(b.name,80);refs(b.elementIds,nodeIds);for(const id of b.elementIds as string[]){if(owner.has(id))throw Error('元素只能属于一个分组');owner.set(id,String(b.id));}if(b.color!==undefined&&!isColor(b.color))throw Error('颜色无效');if(b.icon!==undefined&&!Object.hasOwn(ICONS,String(b.icon)))throw Error('图标名称无效');}
 for(const b of groups){if(b.parentId===undefined)continue;if(!groupIds.has(identifier(b.parentId))||b.parentId===b.id)throw Error('父分组引用无效');const seen=new Set<string>();let at:Record<string,unknown>|undefined=b;while(at){if(seen.has(String(at.id)))throw Error('分组嵌套成环');seen.add(String(at.id));at=at.parentId===undefined?undefined:groups.find(g=>g.id===at!.parentId);}}
 for(const value of array(d.risks,200)){const r=record(value);take(r.id);string(r.text,4000);refs(r.objectIds,nodeIds);}
 for(const e of evidence){string(e.text,4000);array(e.objectIds,500).forEach(identifier);string(e.revisionId,100);if(!['planned','pass','fail','stale'].includes(String(e.result)))throw Error('证据状态无效');}
 if(d.layers!==undefined){const seen=new Set<string>();for(const v of array(d.layers,5)){const l=record(v);keys(l,['id','applicable','reason','question']);if(!['L0','L1','L2','L3','L4'].includes(String(l.id))||seen.has(String(l.id)))throw Error('层设置无效或重复');seen.add(String(l.id));if(typeof l.applicable!=='boolean')throw Error('层适用标记无效');string(l.reason,500,l.applicable===false);string(l.question,500);}}
 const decAll=array(d.decisions,50).map(record);const decSet=new Set(decAll.map(x=>String(x.id)));for(const dec of decAll){for(const k of ['supersededBy','supersedes'])if(dec[k]!==undefined&&(!decSet.has(String(dec[k]))||dec[k]===dec.id))throw Error('决策取代关系引用无效');if(dec.status==='superseded'&&!dec.supersededBy)throw Error('已取代的决策缺少取代者');}
 try{checkStoredRelations({nodes:nodes as never,relationships:array(d.relationships,2000) as never});}catch(e){throw Error((e as Error).message+'（关系无效）');}
 validateAnalysis(d,nodeIds,new Set(array(d.decisions,50).map(x=>String(record(x).id))),evIds);
 const out=structuredClone(d) as unknown as Design;
 if(!out.views.some(v=>v.level==='application')){let id='applications';while(used.has(id))id+='_';out.views.push({id,name:'应用架构',perspective:'application',level:'application',nodeIds:[],positions:{}});}// ADF L2：旧设计补空视图
 return out;
}
export function migrateLegacy(model:ArchitectureModel):Design {
 keys(record(model),['schemaVersion','title','elements','relationships','view','requirements','assumptions','boundaries']);
 for(const e of model.elements)keys(record(e),['id','name','kind','technology','description','requirementIds','c4Type']);
 for(const r of model.relationships)keys(record(r),['id','source','target','label']);keys(record(model.view),['positions']);for(const value of Object.values(model.view.positions))keys(record(value),['x','y']);for(const r of model.requirements||[])keys(record(r),['id','text']);for(const a of model.assumptions||[])keys(record(a),['id','text','confirmed']);for(const b of model.boundaries||[])keys(record(b),['id','name','elementIds']);
 const old=parseModel(JSON.stringify(model));const d=newDesign(old.title);
 d.nodes=old.elements.map(({kind,...e})=>({...e,level:'technical',role:kind,legacyKind:kind,sourceIds:[]}));
 d.relationships=old.relationships.map(r=>({...r,type:'depends_on'}));
 d.views=[{id:'technical-view',name:'技术架构（迁移）',perspective:'technical',level:'technical',nodeIds:d.nodes.map(n=>n.id),positions:old.view.positions},...VIEW_SPECS.filter(v=>v.level!=='technical').map(v=>({...v,nodeIds:[],positions:{}}))];
 d.requirements=old.requirements||[];d.assumptions=old.assumptions||[];d.boundaries=old.boundaries||[];
 return validateDesign(d);
}
export function projection(d:Design,v:DesignView):ArchitectureModel {
 const selected=new Set(v.nodeIds);const elements=d.nodes.filter(n=>selected.has(n.id)).map(n=>({id:n.id,name:n.name||'待命名',kind:projectKind(n.role),technology:n.technology||n.role,description:n.description,...(n.c4Type?{c4Type:n.c4Type}:{})}));
 return {schemaVersion:1,title:d.title+' · '+v.name,elements,relationships:d.relationships.filter(r=>selected.has(r.source)&&selected.has(r.target)),view:{positions:v.positions},boundaries:d.boundaries.map(b=>({...b,elementIds:b.elementIds.filter(id=>selected.has(id))})).filter(b=>b.elementIds.length)};
}
const KIND_OF:Record<string,ArchitectureElement['kind']>={service:'service',gateway:'service',load_balancer:'service',queue:'service',database:'database',cache:'database',storage:'database',external:'external',cdn:'external'};
function projectKind(role:string):ArchitectureElement['kind']{return KIND_OF[role]||'application';}
export const ROLE_NAMES:Record<string,string>={person:'人员',system:'系统',external:'外部系统',business_app:'业务应用',platform:'平台',client:'客户端',gateway:'API 网关',load_balancer:'负载均衡',queue:'消息队列',cache:'缓存',storage:'对象存储',cdn:'CDN',server:'服务器',container:'容器',cluster:'集群',network:'网络',capability:'能力',function:'功能模块',application:'应用',service:'服务',database:'数据库',component:'组件',step:'场景步骤',entity:'数据实体',runtime:'运行资源',goal:'目标',constraint:'约束',quality:'质量要求'};
export const LEVEL_ROLES:Record<string,string[]>={context:['person','system','external'],capability:['capability'],function:['function'],technical:['client','gateway','load_balancer','application','service','queue','cache','database','storage','cdn','external'],component:['component'],application:['business_app','platform','external'],step:['step'],entity:['entity'],runtime:['runtime','server','container','cluster','network'],goal:['goal'],constraint:['constraint'],quality:['quality']};
export function selfDesign():Design{
 const d=newDesign('ArchSketch 自身架构（示例，待复核）');
 const add=(id:string,name:string,level:string,role:string,description:string,parentId?:string,relatedIds?:string[],order?:number)=>{d.nodes.push({id,name,level,role,technology:'',description,sourceIds:[],...(parentId?{parentId}:{}),...(relatedIds?{relatedIds}:{}),...(order!==undefined?{order}:{})});};
 add('architect','软件架构师','context','person','输入需求、评审取舍、接受建议与交付');add('archsketch','ArchSketch','context','system','本机单人架构设计工作台');add('llm','模型服务','context','external','接收选定上下文并返回问题或建议');
 const caps=[['clarify','需求澄清'],['model','架构建模'],['choose','方案权衡'],['preserve','设计追溯'],['deliver','设计交付']];for(const [id,name]of caps)add('cap-'+id,name,'capability','capability',name+'能力');
 const funcs=[['guide','引导讨论','clarify'],['canvas','视图与下钻','model'],['compare','决策比较','choose'],['project','项目与基线','preserve'],['export','图纸与说明','deliver']];
 for(const [id,name,cap]of funcs){add('fun-'+id,name,'function','function',name);d.relationships.push({id:'realize-'+id,source:'fun-'+id,target:'cap-'+cap,type:'realizes',label:'实现能力'});}
 d.nodes.push({id:'app-archsketch',name:'ArchSketch 工作台',level:'application',role:'business_app',technology:'',description:'建模、权衡、追溯与交付',sourceIds:[],sourcing:'build'},{id:'app-llm',name:'模型服务',level:'application',role:'external',technology:'',description:'按需提供 AI 引导与草图',sourceIds:[],sourcing:'buy'});
 for(const [id] of caps)d.relationships.push({id:'own-'+id,source:'app-archsketch',target:'cap-'+id,type:'realizes',label:'承担'});d.relationships.push({id:'app-ai',source:'app-archsketch',target:'app-llm',type:'depends_on',label:'AI 请求'});
 add('browser','浏览器工作台','technical','application','交互、同层视图、差异审阅与保存状态','archsketch');add('local','本机 Node 服务','technical','service','项目版本、文件保存和模型服务接入','archsketch');add('files','JSON 项目文件','technical','database','保存当前修订、来源、对话、历史与命名基线','archsketch');
 add('model-core','设计模型与规则','component','component','校验引用、计算评分与影响','local');add('history-core','变更与历史','component','component','接受变更、回退与基线','local');add('storage-core','项目文件保存','component','component','串行写入、失败保护与幂等','local');add('guide-core','AI 引导适配','component','component','生成待审建议，凭据仅服务端','local');add('render-core','视图投影与导出','component','component','同一模型派生图与说明','browser');
 d.relationships.push({id:'call-local',source:'browser',target:'local',type:'depends_on',label:'同站项目/AI接口'},{id:'save-files',source:'local',target:'files',type:'depends_on',label:'可靠写入'},...funcs.map(([id,,cap])=>({id:'impl-'+id,source:id==='canvas'||id==='export'?'browser':'local',target:'fun-'+id,type:'realizes',label:'承载功能'})));
 const steps=[['input','输入业务需求','browser'],['question','AI 澄清与建议','local'],['review','审阅差异与取舍','browser'],['accept','人工接受建议','local'],['save','保存修订与回执','local']];for(let i=0;i<steps.length;i++){const [id,name,participant]=steps[i];add('step-'+id,name,'step','step','核心设计旅程',undefined,[participant],i+1);if(i)d.relationships.push({id:'seq-'+i,source:'step-'+steps[i-1][0],target:'step-'+id,type:'next',label:'下一步'});}
 d.relationships.push({id:'branch-reject',source:'step-review',target:'step-input',type:'branch',label:'拒绝：继续讨论'},{id:'failure-save',source:'step-save',target:'step-review',type:'failure',label:'写入失败：保留草稿'});
 const entities=[['project','项目'],['revision','设计修订'],['decision','权衡决策'],['proposal','待审建议'],['source','来源材料'],['message','讨论记录'],['baseline','命名基线']];for(const [id,name]of entities)add('data-'+id,name,'entity','entity','由本机项目服务维护',undefined,['local']);for(const [id]of entities.slice(1))d.relationships.push({id:'er-'+id,source:'data-project',target:'data-'+id,type:'data_relation',label:'1 : N'});
 add('run-browser','浏览器进程','runtime','runtime','本机用户交互',undefined,['browser']);add('run-node','127.0.0.1 Node 进程','runtime','runtime','本机同站接口',undefined,['local']);add('run-files','本机项目目录','runtime','runtime','JSON资产及恢复副本',undefined,['files']);
 for(const [a,b]of [['run-browser','browser'],['run-node','local'],['run-files','files']])d.relationships.push({id:'deploy-'+a,source:a,target:b,type:'deploys',label:'承载'});
 add('goal-clear','清晰且可追溯的设计','goal','goal','从业务需求形成可编辑架构、决策与交付');add('constraint-local','本机单人运行','constraint','constraint','方案A；凭据仅服务端');add('quality-reliable','可靠保存与设计追溯优先','quality','quality','通过故障、回读、回退与备份验证，当前待实测');
 for(const [id]of caps)d.relationships.push({id:'from-'+id,source:'cap-'+id,target:'goal-clear',type:'derives_from',label:'服务目标'});d.relationships.push({id:'limit-local',source:'local',target:'constraint-local',type:'constrained_by',label:'受约束'});
 d.views=VIEW_SPECS.map(v=>{const ids=d.nodes.filter(n=>n.level===v.level).map(n=>n.id);return {...v,nodeIds:ids,positions:Object.fromEntries(ids.map((id,i)=>[id,{x:(i%3)*310,y:Math.floor(i/3)*180}]))};});
 return validateDesign(d);
}
export function inspectDesign(d:Design):{id:string;text:string;nodeId?:string;viewId?:string;domain?:string}[]{
 const issues:{id:string;text:string;nodeId?:string;viewId?:string;domain?:string}[]=[];
 for(const [i,c]of d.coverage.entries())if(c.state==='needs_clarification'||!c.reason.trim())issues.push({id:'domain-'+c.domain,text:DOMAIN_NAMES[i]+'：'+(c.reason||'缺少理由'),domain:c.domain});
 for(const v of d.views)if(v.nodeIds.some(id=>d.nodes.find(n=>n.id===id)?.level!==v.level))issues.push({id:'mixed-'+v.id,text:v.name+'存在同层语义混杂，建议整理',viewId:v.id});
 for(const n of d.nodes){if(!LEVEL_ROLES[n.level]?.includes(n.role))issues.push({id:'role-'+n.id,text:n.name+'：角色与层级不一致，建议整理',nodeId:n.id});if(!n.name.trim()||!n.description.trim())issues.push({id:'incomplete-'+n.id,text:(n.name||'待命名节点')+'：名称或职责待补充',nodeId:n.id});if(!n.sourceIds.length&&!n.requirementIds?.length&&!d.relationships.some(r=>r.source===n.id&&['derives_from','realizes'].includes(r.type)))issues.push({id:'source-'+n.id,text:n.name+'：设计来源待关联',nodeId:n.id});if(n.role==='quality'&&!d.relationships.some(r=>r.source===n.id&&r.type==='verified_by'))issues.push({id:'quality-'+n.id,text:n.name+'：验证证据待关联',nodeId:n.id});}
 for(const a of d.assumptions)if(!a.confirmed)issues.push({id:'assumption-'+a.id,text:'假设待确认：'+a.text});
 for(const dec of d.decisions)if(!dec.reason.trim()||!dec.tradeoff.trim()||!dec.reconsiderWhen.trim())issues.push({id:'decision-'+dec.id,text:'决策 '+dec.title+' 的理由、代价或重评条件待补充'});
 for(const r of d.risks)issues.push({id:'risk-'+r.id,text:'风险/待复核：'+r.text});for(const e of d.evidence)if(e.result!=='pass')issues.push({id:'evidence-'+e.id,text:'验证 '+e.result+'：'+e.text,nodeId:e.objectIds.find(id=>d.nodes.some(n=>n.id===id))});
 return issues;
}
export function drillViews(d:Design,nodeId:string):DesignView[]{
 const ids=d.nodes.filter(n=>n.parentId===nodeId||d.relationships.some(r=>r.source===n.id&&r.target===nodeId&&r.type==='realizes')).map(n=>n.id);
 const result:DesignView[]=[];for(const v of d.views){const nodeIds=v.nodeIds.filter(id=>ids.includes(id));if(nodeIds.length)result.push({...v,id:'drill-'+v.id,name:v.name+' · '+(d.nodes.find(n=>n.id===nodeId)?.name||''),nodeIds,positions:Object.fromEntries(nodeIds.map(id=>[id,v.positions[id]]))});}return result;
}
const KINDS=['scale','availability','cost','team','compliance','deployment','evolution','other'];
const ATTRIBUTES=['availability','performance','security','modifiability','reliability','scalability','usability','cost','other'];
/** 约束、质量场景与分析点（GOAL-001 r3 / ADR-003）：可选字段，引用必须存在。 */
function validateAnalysis(d:Record<string,unknown>,nodeIds:Set<string>,decIds:Set<string>,evIds:Set<string>){
 const ids=new Set<string>();const take=(v:unknown)=>{const id=identifier(v);if(ids.has(id))throw Error('约束/场景ID重复');ids.add(id);return id;};
 const refsIn=(v:unknown,set:Set<string>)=>{const a=array(v,500).map(identifier);if(new Set(a).size!==a.length||a.some(x=>!set.has(x)))throw Error('约束/场景引用不存在或重复');};
 if(d.constraints!==undefined)for(const v of array(d.constraints,100)){const c=record(v);keys(c,['id','kind','name','value','unit','status','note','objectIds','decisionIds']);take(c.id);if(!KINDS.includes(String(c.kind)))throw Error('约束类型无效');string(c.name,120,true);string(c.value,200);string(c.unit,40);if(!['confirmed','unconfirmed'].includes(String(c.status)))throw Error('约束状态无效');string(c.note,2000);refsIn(c.objectIds,nodeIds);refsIn(c.decisionIds,decIds);}
 const scenIds=new Set<string>();
 if(d.scenarios!==undefined)for(const v of array(d.scenarios,100)){const q=record(v);keys(q,['id','attribute','source','stimulus','environment','response','measure','verification','objectIds','decisionIds','evidenceIds']);scenIds.add(take(q.id));if(!ATTRIBUTES.includes(String(q.attribute)))throw Error('质量属性无效');for(const k of ['source','stimulus','environment','response','measure','verification'])string(q[k],2000);refsIn(q.objectIds,nodeIds);refsIn(q.decisionIds,decIds);refsIn(q.evidenceIds,evIds);}
 if(d.points!==undefined)for(const v of array(d.points,200)){const p=record(v);keys(p,['id','kind','text','scenarioIds','objectIds','decisionIds']);take(p.id);if(!['sensitivity','tradeoff','risk','nonrisk'].includes(String(p.kind)))throw Error('分析点类型无效');string(p.text,2000,true);refsIn(p.scenarioIds,scenIds);refsIn(p.objectIds,nodeIds);refsIn(p.decisionIds,decIds);}
}
/** 订单系统演示设计（STORY-011）：数值来自讨论示例，全部为待确认的演示数据。 */
export function orderDesign():Design{
 const d=newDesign('订单系统（示例，演示数据）');
 const add=(id:string,name:string,level:string,role:string,description:string,technology='')=>d.nodes.push({id,name,level,role,technology,description,sourceIds:[]});
 add('buyer','下单用户','context','person','通过 App/小程序下单');add('order-system','订单系统','context','system','企业级订单管理');add('payment','支付平台','context','external','第三方支付');
 add('app','App / 小程序','technical','client','下单与查询入口');add('gateway','API 网关','technical','gateway','鉴权、限流与路由');add('order','订单服务','technical','service','下单、状态机与查询');add('inventory','库存服务','technical','service','预占与扣减库存');add('mq','消息队列','technical','queue','订单事件异步分发');add('order-db','订单库','technical','database','订单与明细');
 add('q-availability','订单可用性 99.9%','quality','quality','高峰期下单可用');
 d.relationships.push({id:'r-app',source:'app',target:'gateway',type:'depends_on',label:'HTTPS'},{id:'r-order',source:'gateway',target:'order',type:'depends_on',label:'下单'},{id:'r-inv',source:'gateway',target:'inventory',type:'depends_on',label:''},{id:'r-mq',source:'order',target:'mq',type:'depends_on',label:'订单事件',line:'dashed'},{id:'r-mq-inv',source:'mq',target:'inventory',type:'depends_on',label:'扣减',line:'dashed'},{id:'r-db',source:'order',target:'order-db',type:'depends_on',label:'读写'},{id:'r-buy',source:'buyer',target:'order-system',type:'depends_on',label:'下单'},{id:'r-pay',source:'order-system',target:'payment',type:'depends_on',label:'支付'});
 d.boundaries=[{id:'core',name:'核心服务',elementIds:['order','inventory']}];
 d.decisions=[{id:'dec-style',title:'模块化单体还是微服务',dimensions:[{id:'team',name:'团队与交付',weight:40},{id:'ops',name:'运维复杂度',weight:30},{id:'scale',name:'独立扩展',weight:30}],candidates:[{id:'monolith',name:'模块化单体',benefits:'部署与治理简单，适合 10 人团队',costs:'模块边界需自律；整体扩展',rationale:'待用峰值吞吐验证',violations:[],scores:{team:null,ops:null,scale:null}},{id:'micro',name:'微服务',benefits:'独立部署与扩展',costs:'分布式治理成本高',rationale:'待评估团队承载能力',violations:[],scores:{team:null,ops:null,scale:null}}],reason:'',tradeoff:'',reconsiderWhen:'日订单量或团队规模变化',affectedIds:['order','inventory']}];
 const demo='演示数据，来自讨论示例，待确认';
 d.constraints=[{id:'c-orders',kind:'scale',name:'日订单量',value:'1000000',unit:'笔/日',status:'unconfirmed',note:demo,objectIds:['order'],decisionIds:['dec-style']},{id:'c-team',kind:'team',name:'研发团队',value:'10',unit:'人',status:'unconfirmed',note:demo,objectIds:[],decisionIds:['dec-style']},{id:'c-sla',kind:'availability',name:'目标可用性',value:'99.9',unit:'%',status:'unconfirmed',note:demo,objectIds:['order','gateway'],decisionIds:[]},{id:'c-deploy',kind:'deployment',name:'部署要求',value:'私有化部署',unit:'',status:'unconfirmed',note:demo,objectIds:[],decisionIds:['dec-style']},{id:'c-peak',kind:'scale',name:'峰值下单吞吐',value:'',unit:'笔/秒',status:'unconfirmed',note:demo+'；数值未知',objectIds:['order'],decisionIds:['dec-style']}];
 d.scenarios=[{id:'s-node-down',attribute:'availability',source:'运维环境',stimulus:'单个订单服务实例宕机',environment:'大促高峰',response:'流量切换到其他实例，下单不中断',measure:'',verification:'',objectIds:['order','gateway'],decisionIds:['dec-style'],evidenceIds:[]}];
 d.points=[{id:'p-replicas',kind:'tradeoff',text:'实例副本数：可用性提升，同时增加私有化部署成本',scenarioIds:['s-node-down'],objectIds:['order'],decisionIds:['dec-style']},{id:'p-db',kind:'sensitivity',text:'订单库写入能力决定峰值吞吐上限',scenarioIds:[],objectIds:['order-db'],decisionIds:[]}];
 d.views=VIEW_SPECS.map(v=>{const ids=d.nodes.filter(n=>n.level===v.level).map(n=>n.id);return {...v,nodeIds:ids,positions:Object.fromEntries(ids.map((id,i)=>[id,{x:(i%4)*300,y:Math.floor(i/4)*180}]))};});
 return validateDesign(d);
}

