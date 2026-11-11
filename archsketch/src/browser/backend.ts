import { createProject, parseProject, executeCommand, ProjectError, head, type Project, type Command, type Question, type ChangeSetMeta } from '../project.ts';
import { identifier, string, record, validateDesign, newDesign, type Design, type Operation } from '../design.ts';
import { buildRelease } from '../reviewPackage.ts';
import { ruleInsights, KIND_NAMES, type Insight, type InsightKind } from '../insights.ts';
import { parseCode } from '../dsl.ts';
import { withLayout } from '../proposalLayout.ts';
import type { GuideRound } from '../guideRound.ts';
import { requestGuide, requestBusiness, requestReview } from '../../server/guide.ts';
import { generateModel, aiEndpoint, aiConcurrency, ApiError, type AiConfig } from '../../server/ai.ts';
/**
 * 浏览器版后端（静态部署用）：与 server/local.ts 相同的 /api 路由与语义，数据存在本浏览器 IndexedDB，
 * AI 用用户自己填写、只存本浏览器的密钥直连模型服务。不是云端存储：换浏览器或清理站点数据会丢失，需导出备份。
 */
export type Kv={get(key:string):Promise<unknown>;set(key:string,value:unknown):Promise<void>;del(key:string):Promise<void>;keys(prefix:string):Promise<string[]>};
export type ApiResult={status:number;json?:unknown;body?:string;type?:string};
type CommandRequest={requestId:string;expectedWriteVersion:number;command:Command};
const MAX_PROJECT_BYTES=32*1024*1024,MAX_TEMPLATES=100,MAX_TEMPLATE_BYTES=2*1024*1024,MAX_INSIGHTS=300;const KINDS=Object.keys(KIND_NAMES);
const bytes=(s:string)=>new TextEncoder().encode(s).length;
export async function sha256(text:string){const h=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text));return [...new Uint8Array(h)].map(b=>b.toString(16).padStart(2,'0')).join('');}
export const digest=(v:unknown)=>sha256(JSON.stringify(v));
export type MyTemplate={id:string;name:string;description:string;level:string;code:string;createdAt:string};
export type InsightFile={format:'archsketch-insights';lastRevisionId:string|null;items:Insight[];prefs:{off:boolean;muted:string[]}};
const emptyInsights=():InsightFile=>({format:'archsketch-insights',lastRevisionId:null,items:[],prefs:{off:false,muted:[]}});

export class BrowserProjectStore{
 kv:Kv;private queues=new Map<string,Promise<unknown>>();constructor(kv:Kv){this.kv=kv;}
 /** 同一项目的写入串行执行（代替文件写锁）。 */
 locked<T>(id:string,fn:()=>Promise<T>):Promise<T>{identifier(id);const job=(this.queues.get(id)||Promise.resolve()).catch(()=>{}).then(fn);this.queues.set(id,job);return job;}
 async read(id:string,name:'project'|'previous'='project'):Promise<Project>{
  identifier(id);const raw=await this.kv.get(name+':'+id);if(raw===undefined)throw new ProjectError(404,'PROJECT_NOT_FOUND','项目不存在');
  try{const p=parseProject(JSON.parse(String(raw)));if(p.projectId!==id)throw Error('项目ID不一致');return p;}catch{throw new ProjectError(500,'PROJECT_READ_FAILED','项目无法读取；请恢复备份或导入导出文件');}
 }
 async list(){const out:{projectId:string;title:string;writeVersion:number;error?:string}[]=[];for(const key of await this.kv.keys('project:')){const id=key.slice(8);try{const p=await this.read(id);out.push({projectId:p.projectId,title:p.title,writeVersion:p.writeVersion});}catch(e){out.push({projectId:id,title:id,writeVersion:0,error:e instanceof Error?e.message:'无法读取'});}}return out;}
 async write(p:Project,previous?:Project){
  const content=JSON.stringify(parseProject(p));if(bytes(content)>MAX_PROJECT_BYTES)throw new ProjectError(413,'INPUT_TOO_LARGE','项目超过32MB；历史未删除，请导出备份');
  try{if(previous)await this.kv.set('previous:'+p.projectId,JSON.stringify(previous));await this.kv.set('project:'+p.projectId,content);}
  catch{throw new ProjectError(500,'PROJECT_WRITE_FAILED','浏览器存储写入失败（可能空间不足）；请导出备份');}
 }
 private async absent(id:string,same:(old:Project)=>boolean){try{const old=await this.read(id);if(same(old))return old;throw new ProjectError(409,'PROJECT_EXISTS','项目已存在，禁止覆盖');}catch(e){if(!(e instanceof ProjectError)||e.status!==404)throw e;}return null;}
 async create(id:string,title:string,requestId:string,design?:Design):Promise<Project>{
  identifier(id);identifier(requestId);string(title,120,true);const hash=await digest({id,title,requestId,design});
  return this.locked(id,async()=>{const old=await this.absent(id,o=>o.receipts.find(r=>r.requestId===requestId)?.hash===hash);if(old)return old;
   const p=createProject(id,title,design);p.receipts.push({requestId,hash,writeVersion:p.writeVersion,headRevisionId:p.headRevisionId,inputVersion:p.inputVersion});await this.write(p);return p;});
 }
 async commit(id:string,request:CommandRequest):Promise<Project>{
  identifier(request.requestId);const hash=await digest(request);
  return this.locked(id,async()=>{const old=await this.read(id);const receipt=old.receipts.find(r=>r.requestId===request.requestId);
   if(receipt){if(receipt.hash!==hash)throw new ProjectError(409,'REQUEST_CONFLICT','重复请求ID内容冲突');return old;}
   if(old.writeVersion!==request.expectedWriteVersion)throw new ProjectError(409,'VERSION_CONFLICT','保存版本冲突，草稿已保留；请回读比较');
   const next=executeCommand(old,request.command);next.receipts.push({requestId:request.requestId,hash,writeVersion:next.writeVersion,headRevisionId:next.headRevisionId,inputVersion:next.inputVersion});await this.write(next,old);return next;});
 }
 async publish(id:string,requestId:string,baselineId:string,approvedBy:string):Promise<Project>{
  identifier(requestId);identifier(baselineId);const who=string(approvedBy,80,true,'批准人').trim();const hash=await digest({kind:'publish',baselineId,approvedBy:who});
  return this.locked(id,async()=>{const old=await this.read(id);const receipt=old.receipts.find(r=>r.requestId===requestId);if(receipt){if(receipt.hash!==hash)throw new ProjectError(409,'REQUEST_CONFLICT','重复请求ID内容冲突');return old;}
   const b=old.baselines.find(x=>x.id===baselineId);if(!b)throw new ProjectError(404,'NOT_FOUND','基线不存在');if(old.releases?.some(r=>r.baselineId===baselineId))throw new ProjectError(409,'RELEASE_EXISTS','该基线已发布交付包，已发布内容不可修改');
   const relId=crypto.randomUUID();const publishedAt=new Date().toISOString();const files=buildRelease(old,baselineId,who,publishedAt);const entries=[];
   for(const f of files){if(f.path.split('/').includes('..'))throw new ProjectError(400,'INVALID_INPUT','交付文件路径无效');await this.kv.set(`release:${id}:${relId}:${f.path}`,f.content);entries.push({path:f.path,sha256:await sha256(f.content),bytes:bytes(f.content)});}
   const next=executeCommand(old,{type:'record_release',release:{id:relId,baselineId,revisionId:b.revisionId,approvedBy:who,publishedAt,files:entries}});next.receipts.push({requestId,hash,writeVersion:next.writeVersion,headRevisionId:next.headRevisionId,inputVersion:next.inputVersion});await this.write(next,old);return next;});
 }
 async releaseFile(id:string,releaseId:string,path:string):Promise<{content:string;type:string}>{
  const p=await this.read(id);const rel=p.releases?.find(r=>r.id===releaseId);const entry=rel?.files.find(f=>f.path===path);if(!rel||!entry)throw new ProjectError(404,'NOT_FOUND','交付文件不存在');
  const content=await this.kv.get(`release:${id}:${rel.id}:${entry.path}`);if(typeof content!=='string')throw new ProjectError(404,'NOT_FOUND','交付文件缺失');
  if(await sha256(content)!==entry.sha256)throw new ProjectError(409,'RELEASE_TAMPERED','交付文件与发布时的哈希不一致，已拒绝读取');
  return {content,type:path.endsWith('.html')?'text/html; charset=utf-8':path.endsWith('.svg')?'image/svg+xml':path.endsWith('.json')?'application/json; charset=utf-8':'text/markdown; charset=utf-8'};
 }
 async importProject(source:Project,id:string,requestId:string):Promise<Project>{
  identifier(id);identifier(requestId);const imported=parseProject(source);const hash=await digest({source,id,requestId});
  return this.locked(id,async()=>{const old=await this.absent(id,o=>o.receipts.some(r=>r.requestId===requestId&&r.hash===hash));if(old)return old;
   const p=structuredClone(imported);p.projectId=id;p.writeVersion=1;p.receipts=[{requestId,hash,writeVersion:1,headRevisionId:p.headRevisionId,inputVersion:p.inputVersion}];await this.write(p);return p;});
 }
 async recover(id:string,requestId:string):Promise<Project>{
  identifier(requestId);return this.locked(id,async()=>{
   try{const current=await this.read(id);if(current.receipts.some(r=>r.requestId===requestId&&r.hash==='recovery'))return current;throw new ProjectError(409,'PROJECT_HEALTHY','当前项目可读；禁止用恢复副本覆盖');}catch(e){if(!(e instanceof ProjectError)||!['PROJECT_READ_FAILED','PROJECT_NOT_FOUND'].includes(e.code))throw e;}
   const restored=structuredClone(await this.read(id,'previous'));restored.writeVersion++;restored.receipts.push({requestId,hash:'recovery',writeVersion:restored.writeVersion,headRevisionId:restored.headRevisionId,inputVersion:restored.inputVersion});
   const damaged=await this.kv.get('project:'+id);if(damaged!==undefined)await this.kv.set('damaged:'+id+':'+crypto.randomUUID(),damaged);await this.write(restored);return restored;});
 }
 async appendGuide(id:string,baseHeadRevisionId:string,baseInputVersion:number,requestId:string,content:string,operations:Operation[],hash:string,question:Question|null=null,round?:GuideRound,meta?:ChangeSetMeta,outcome?:{kept:number;dropped:string[]}):Promise<Project>{
  return this.locked(id,async()=>{const old=await this.read(id);const receipt=old.receipts.find(r=>r.requestId===requestId);if(receipt){if(receipt.hash!==hash)throw new ProjectError(409,'REQUEST_CONFLICT','重复请求ID内容冲突');return old;}
   const next=structuredClone(old);next.conversation.push({id:crypto.randomUUID(),role:'assistant',content,sourceIds:[],...(outcome?{outcome:{kept:outcome.kept,dropped:outcome.dropped.slice(0,200).map(r=>r.slice(0,400))}}:{})});
   let proposalId:string|null=null;if(operations.length){proposalId=crypto.randomUUID();for(const o of next.proposals)if(o.status==='pending')o.status='stale';
    next.proposals.push({id:proposalId,requestId,baseHeadRevisionId,baseInputVersion,status:baseHeadRevisionId===next.headRevisionId&&baseInputVersion===next.inputVersion?'pending':'stale',summary:content,operations,...(meta?{rationale:meta.rationale,impact:meta.impact,tradeoffs:meta.tradeoffs,validation:meta.validation}:{})});}
   if(question){next.questions??=[];for(const q of next.questions)if(q.status==='open'&&q.source==='ai')q.status='skipped';next.questions.push({...question,proposalId});}
   if(round)next.guideRound=round;
   next.writeVersion++;next.receipts.push({requestId,hash,writeVersion:next.writeVersion,headRevisionId:next.headRevisionId,inputVersion:next.inputVersion});await this.write(next,old);return next;});
 }
}

export class BrowserTemplateStore{
 kv:Kv;private queue:Promise<unknown>=Promise.resolve();constructor(kv:Kv){this.kv=kv;}
 async list():Promise<MyTemplate[]>{const v=await this.kv.get('templates');return Array.isArray(v)?v as MyTemplate[]:[];}
 private serial<T>(fn:()=>Promise<T>):Promise<T>{const job=this.queue.catch(()=>{}).then(fn);this.queue=job;return job;}
 private async write(templates:MyTemplate[]){if(bytes(JSON.stringify(templates))>MAX_TEMPLATE_BYTES)throw new ProjectError(413,'INPUT_TOO_LARGE','模板总量超过2MB');await this.kv.set('templates',templates);}
 save(input:Omit<MyTemplate,'id'|'createdAt'>,overwrite=false):Promise<MyTemplate[]>{return this.serial(async()=>{
  let name:string,description:string,code:string;try{name=string(input?.name,60,true).trim();description=string(input?.description??'',300);code=string(input?.code,200000,true);}catch{throw new ProjectError(400,'INVALID_INPUT','模板名称或内容无效');}
  const view=newDesign().views.find(v=>v.level===input.level);if(!view)throw new ProjectError(400,'INVALID_INPUT','模板层级无效');
  const parsed=parseCode(newDesign(),view,code);if(!parsed.design)throw new ProjectError(400,'INVALID_INPUT','模板图代码无效：'+parsed.errors.slice(0,2).map(e=>e.message).join('；'));
  const list=await this.list();const same=list.find(t=>t.name===name);if(same&&!overwrite)throw new ProjectError(409,'TEMPLATE_EXISTS','已有同名模板');
  const t:MyTemplate={id:same?.id||crypto.randomUUID(),name,description,level:input.level,code,createdAt:new Date().toISOString()};
  const next=same?list.map(x=>x.id===same.id?t:x):[...list,t];if(next.length>MAX_TEMPLATES)throw new ProjectError(413,'INPUT_TOO_LARGE','最多保存100个模板');await this.write(next);return next;});}
 remove(id:string):Promise<MyTemplate[]>{return this.serial(async()=>{const list=await this.list();const next=list.filter(t=>t.id!==id);if(next.length===list.length)throw new ProjectError(404,'NOT_FOUND','模板不存在');await this.write(next);return next;});}
}

/** 与 server/insights.ts 相同的观察规则，存储换成浏览器键值。 */
export class BrowserInsightStore{
 store:BrowserProjectStore;settleMs:number;constructor(store:BrowserProjectStore,settleMs=3000){this.store=store;this.settleMs=settleMs;}
 private async load(id:string):Promise<InsightFile>{const v=await this.store.kv.get('insights:'+id) as InsightFile|undefined;if(v?.format!=='archsketch-insights'||!Array.isArray(v.items)||!v.prefs)return emptyInsights();return {...v,prefs:{off:!!v.prefs.off,muted:Array.isArray(v.prefs.muted)?v.prefs.muted.filter(k=>KINDS.includes(k)):[]}};}
 private change<T>(id:string,fn:(f:InsightFile)=>Promise<T>|T){return this.store.locked(id,async()=>{const f=await this.load(id);const out=await fn(f);f.items=f.items.slice(-MAX_INSIGHTS);await this.store.kv.set('insights:'+id,f);return out;});}
 read(id:string){return this.store.locked(id,()=>this.load(id));}
 async observe(id:string,now=Date.now()):Promise<InsightFile>{
  const p=await this.store.read(id);const top=p.revisions.find(r=>r.id===p.headRevisionId)!;
  const f=await this.read(id);if(f.lastRevisionId===p.headRevisionId)return f;if(f.lastRevisionId&&Date.parse(top.createdAt)+this.settleMs>now)return f;
  return this.change(id,f=>{if(f.lastRevisionId===p.headRevisionId)return f;const from=p.revisions.find(r=>r.id===f.lastRevisionId);
   if(from&&!f.prefs.off){const batchId=crypto.randomUUID();const createdAt=new Date(now).toISOString();
    for(const x of ruleInsights(from.snapshot,head(p),p.questions))if(!f.prefs.muted.includes(x.kind))f.items.push({...x,id:crypto.randomUUID(),batchId,fromRevisionId:from.id,toRevisionId:p.headRevisionId,source:'rule',status:'new',createdAt});}
   f.lastRevisionId=p.headRevisionId;return f;});
 }
 setStatus(id:string,insightId:string,status:'dismissed'|'adopted'){if(!['dismissed','adopted'].includes(status))throw new ProjectError(400,'INVALID_INPUT','见解状态无效');return this.change(id,f=>{const i=f.items.find(x=>x.id===insightId);if(!i)throw new ProjectError(404,'INSIGHT_NOT_FOUND','见解不存在');i.status=status;return f;});}
 setPrefs(id:string,p:{off?:boolean;mute?:string;unmute?:string}){for(const k of [p.mute,p.unmute])if(k!==undefined&&!KINDS.includes(k))throw new ProjectError(400,'INVALID_INPUT','见解类别无效');return this.change(id,f=>{if(typeof p.off==='boolean')f.prefs.off=p.off;if(p.mute&&!f.prefs.muted.includes(p.mute))f.prefs.muted.push(p.mute);if(p.unmute)f.prefs.muted=f.prefs.muted.filter(k=>k!==p.unmute);return f;});}
 latestBatch(f:InsightFile){const last=[...f.items].reverse().find(i=>i.source==='rule');if(!last)return null;return {batchId:last.batchId,fromRevisionId:last.fromRevisionId,toRevisionId:last.toRevisionId,items:f.items.filter(i=>i.batchId===last.batchId)};}
 addAi(id:string,batch:{batchId:string;fromRevisionId:string;toRevisionId:string},items:{title:string;detail:string;objectIds:string[]}[],proposalId:string|null){return this.change(id,f=>{const createdAt=new Date().toISOString();for(const x of items)f.items.push({id:crypto.randomUUID(),batchId:batch.batchId,fromRevisionId:batch.fromRevisionId,toRevisionId:batch.toRevisionId,source:'ai',kind:'ai' as InsightKind,severity:'info',title:x.title,detail:x.detail,objectIds:x.objectIds,...(proposalId?{proposalId}:{}),status:'new',createdAt});return f;});}
}

async function laidOut(p:Project,ops:Operation[]){if(!ops.length)return ops;try{return await withLayout(head(p),ops);}catch(e){console.warn('[archsketch] 提案布局失败，保留原坐标：'+(e instanceof Error?e.message:String(e)));return ops;}}
export function aiConfigured(config:AiConfig){return !!(aiEndpoint(config)&&config.model&&config.apiKey);}
const NOT_CONFIGURED='AI 尚未配置：点右上角“AI 设置”填写你自己的 API key';

/** 路由与 server/local.ts、server/ai.ts 一一对应；body 为已解析的 JSON（GET 为 undefined）。 */
export function createBrowserApi(kv:Kv,getConfig:()=>AiConfig,opts:{settleMs?:number}={}){
 const store=new BrowserProjectStore(kv);const insights=new BrowserInsightStore(store,opts.settleMs??3000);const templates=new BrowserTemplateStore(kv);
 return async function handle(method:string,path:string,rawBody:unknown,signal:AbortSignal):Promise<ApiResult>{
  const ok=(status:number,json:unknown):ApiResult=>({status,json});
  try{
   const body=method==='POST'?(()=>{try{return record(rawBody);}catch{throw new ProjectError(400,'INVALID_INPUT','JSON对象无效');}})():{} as Record<string,unknown>;
   const config=getConfig();
   if(path==='/api/ai/status'&&method==='GET'){const endpoint=aiEndpoint(config);return ok(200,{configured:aiConfigured(config),model:config.model,service:endpoint?.hostname||''});}
   if(path==='/api/ai/generate'&&method==='POST'){if(!aiConfigured(config))throw new ApiError(503,NOT_CONFIGURED);let acquired=false;try{return ok(200,{model:await generateModel(config,body,signal,()=>{acquired=true;})});}finally{if(acquired)aiConcurrency.running=false;}}
   const needAi=()=>{if(!aiConfigured(config))throw new ProjectError(503,'AI_NOT_CONFIGURED',NOT_CONFIGURED);};
   if(path==='/api/templates'){if(method==='GET')return ok(200,{templates:await templates.list()});if(method==='POST')return ok(201,{templates:await templates.save(body.template as never,body.overwrite===true)});}
   const tdel=/^\/api\/templates\/([\w-]+)\/delete$/.exec(path);if(tdel&&method==='POST')return ok(200,{templates:await templates.remove(tdel[1])});
   if(path==='/api/projects'){if(method==='GET')return ok(200,{projects:await store.list(),root:'本浏览器（IndexedDB）'});if(method==='POST'){const p=await store.create(identifier(body.projectId),string(body.title,120,true),identifier(body.requestId),body.design===undefined?undefined:validateDesign(body.design));return ok(201,{project:p,persisted:true});}}
   if(path==='/api/projects/import'&&method==='POST'){const p=await store.importProject(parseProject(body.project),identifier(body.projectId),identifier(body.requestId));return ok(201,{project:p,persisted:true});}
   const recovery=/^\/api\/projects\/([\w-]+)\/recover$/.exec(path);if(recovery&&method==='POST')return ok(200,{project:await store.recover(recovery[1],identifier(body.requestId)),persisted:true});
   const guide=/^\/api\/projects\/([\w-]+)\/ai\/guide$/.exec(path);
   if(guide&&method==='POST'){const p=await store.read(guide[1]);identifier(body.requestId);const hash='guide:'+await digest(body);const receipt=p.receipts.find(r=>r.requestId===body.requestId);if(receipt){if(receipt.hash!==hash)throw new ProjectError(409,'REQUEST_CONFLICT','重复请求ID内容冲突');return ok(200,{project:p,persisted:true,replayed:true});}
    if(p.headRevisionId!==body.baseHeadRevisionId||p.inputVersion!==body.baseInputVersion)throw new ProjectError(409,'STALE_CONTEXT','设计或材料版本已变，请回读后讨论');needAi();
    const r=await requestGuide(config,p,string(body.prompt,8000,true),signal,{roundSize:Number(body.roundSize)||undefined,converge:body.converge===true});
    return ok(200,{project:await store.appendGuide(p.projectId,p.headRevisionId,p.inputVersion,String(body.requestId),r.message,await laidOut(p,r.operations),hash,r.question,r.round,r.change,r.outcome),persisted:true});}
   const insight=/^\/api\/projects\/([\w-]+)\/insights(?:\/(status|prefs|ai))?$/.exec(path);
   if(insight){const id=insight[1];
    if(!insight[2]&&method==='GET')return ok(200,{insights:await insights.observe(id)});
    if(insight[2]==='status'&&method==='POST')return ok(200,{insights:await insights.setStatus(id,identifier(body.id),body.status as 'dismissed'|'adopted')});
    if(insight[2]==='prefs'&&method==='POST')return ok(200,{insights:await insights.setPrefs(id,{...(typeof body.off==='boolean'?{off:body.off}:{}),...(typeof body.mute==='string'?{mute:body.mute}:{}),...(typeof body.unmute==='string'?{unmute:body.unmute}:{})})});
    if(insight[2]==='ai'&&method==='POST'){identifier(body.requestId);let p=await store.read(id);
     if(p.headRevisionId!==body.baseHeadRevisionId||p.inputVersion!==body.baseInputVersion)throw new ProjectError(409,'STALE_CONTEXT','设计已变化，请稍后再请 AI 点评');
     const f=await insights.observe(id,Date.now()+60000);const batch=insights.latestBatch(f);if(!batch)throw new ProjectError(409,'NO_CHANGE','还没有可点评的变化，先做一步修改');needAi();
     const r=await requestReview(config,p,batch,signal);let proposalId:string|null=null;
     if(r.operations.length){p=await store.appendGuide(id,p.headRevisionId,p.inputVersion,String(body.requestId),'AI 点评：'+r.summary,await laidOut(p,r.operations),'review:'+await digest(body));proposalId=p.proposals.at(-1)!.id;}
     return ok(200,{insights:await insights.addAi(id,batch,r.insights,proposalId),project:p});}
   }
   const business=/^\/api\/projects\/([\w-]+)\/ai\/business$/.exec(path);
   if(business&&method==='POST'){const p=await store.read(business[1]);identifier(body.requestId);const hash=await digest({...body,kind:'business'});const receipt=p.receipts.find(r=>r.requestId===body.requestId);if(receipt){if(receipt.hash!==hash)throw new ProjectError(409,'REQUEST_CONFLICT','重复请求ID内容冲突');return ok(200,{project:p,persisted:true,replayed:true});}
    if(p.headRevisionId!==body.baseHeadRevisionId||p.inputVersion!==body.baseInputVersion)throw new ProjectError(409,'STALE_CONTEXT','设计或材料版本已变，请回读后重试');
    if(p.onboarding?.status!=='business')throw new ProjectError(409,'WRONG_STEP','当前不在业务拓扑步骤');needAi();
    const candidates=await requestBusiness(config,p,signal);
    return ok(200,{project:await store.commit(p.projectId,{requestId:String(body.requestId),expectedWriteVersion:p.writeVersion,command:{type:'set_business_candidates',candidates}} as unknown as CommandRequest),persisted:true});}
   const pub=/^\/api\/projects\/([\w-]+)\/releases$/.exec(path);
   if(pub&&method==='POST')return ok(200,{project:await store.publish(pub[1],identifier(body.requestId),identifier(body.baselineId),string(body.approvedBy,80,true)),persisted:true});
   const relFile=/^\/api\/projects\/([\w-]+)\/releases\/([\w-]+)\/files\/([\w.\-\/]+)$/.exec(path);
   if(relFile&&method==='GET'){const f=await store.releaseFile(relFile[1],relFile[2],decodeURIComponent(relFile[3]));return {status:200,body:f.content,type:f.type};}
   const match=/^\/api\/projects\/([\w-]+)(?:\/(commands))?$/.exec(path);
   if(match){const id=match[1];if(!match[2]&&method==='GET')return ok(200,{project:await store.read(id)});if(match[2]==='commands'&&method==='POST'){const p=await store.commit(id,body as unknown as CommandRequest);return ok(200,{project:p,persisted:true,writeVersion:p.writeVersion,headRevisionId:p.headRevisionId,inputVersion:p.inputVersion});}}
   throw new ProjectError(method==='GET'||method==='POST'?404:405,'NOT_FOUND','接口不存在或方法不支持');
  }catch(error){
   if(error instanceof ProjectError)return ok(error.status,{error:error.message,code:error.code});
   if(error instanceof ApiError)return ok(error.status,{error:error.message});
   if(signal.aborted)return ok(499,{error:'已取消，当前设计未变'});
   if(error instanceof Error&&/无效|引用|超限|ID|字段|版本|评分/.test(error.message))return ok(400,{error:error.message,code:'INVALID_INPUT'});
   return ok(500,{error:'浏览器项目操作失败；设计未被自动替换',code:'PROJECT_FAILED'});
  }
 };
}
