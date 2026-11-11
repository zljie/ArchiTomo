import type { AiMiddleware, AiConfig } from './ai.ts';
import { withLayout } from '../src/proposalLayout.ts';
import { head as headDesign } from '../src/project.ts';
import { requestGuide, requestBusiness, requestReview } from './guide.ts';
import { InsightStore } from './insights.ts';
import type { IncomingMessage } from 'node:http';
import { TemplateStore } from './templates.ts';
import { ProjectStore, digest, type CommandRequest, MAX_PROJECT_BYTES } from './projects.ts';
import { ProjectError, parseProject } from '../src/project.ts';
import { record, string, identifier, validateDesign } from '../src/design.ts';
/** STORY-034：提案带分组布局；布局失败时保留原操作（布局只影响坐标）。 */
async function laidOut(p:import('../src/project.ts').Project,ops:import('../src/design.ts').Operation[]){if(!ops.length)return ops;try{return await withLayout(headDesign(p),ops);}catch(e){console.warn('[archsketch] 提案布局失败，保留原坐标：'+(e instanceof Error?e.message:String(e)));return ops;}}
export async function jsonBody(request:IncomingMessage){const chunks:Buffer[]=[];let size=0;for await(const chunk of request){size+=chunk.length;if(size>MAX_PROJECT_BYTES)throw new ProjectError(413,'INPUT_TOO_LARGE','请求超过32MB，未替换项目');chunks.push(chunk);}try{return record(JSON.parse(Buffer.concat(chunks).toString('utf8')));}catch{throw new ProjectError(400,'INVALID_INPUT','JSON对象无效');}}
export function createProjectMiddleware(root:string,config:AiConfig,opts:{settleMs?:number}={}):AiMiddleware{
 const store=new ProjectStore(root);const insights=new InsightStore(store,opts.settleMs??3000);const templates=new TemplateStore(root);
 return (req,res,next)=>{
  const path=req.url?.split('?')[0]||'';if(!path.startsWith('/api/projects')&&!path.startsWith('/api/templates')){next();return;}
  const send=(status:number,value:unknown)=>{if(!res.writableEnded){res.statusCode=status;res.setHeader('Content-Type','application/json; charset=utf-8');res.setHeader('Cache-Control','no-store');res.end(JSON.stringify(value));}};
  void(async()=>{
   let host:URL;try{host=new URL('http://'+req.headers.host);}catch{throw new ProjectError(403,'LOCAL_ACCESS_DENIED','拒绝非本机访问');}
   if(!['127.0.0.1','localhost','[::1]'].includes(host.hostname)||!['127.0.0.1','::1','::ffff:127.0.0.1'].includes(req.socket.remoteAddress||'')||req.headers['sec-fetch-site']==='cross-site')throw new ProjectError(403,'LOCAL_ACCESS_DENIED','仅允许本机同站访问');
   if(req.headers.origin){let origin;try{origin=new URL(req.headers.origin);}catch{throw new ProjectError(403,'LOCAL_ACCESS_DENIED','来源无效');}if(origin.host!==host.host||origin.protocol!=='http:')throw new ProjectError(403,'LOCAL_ACCESS_DENIED','拒绝跨站访问');}
   if(req.method==='POST'&&!req.headers['content-type']?.startsWith('application/json'))throw new ProjectError(415,'UNSUPPORTED_FORMAT','需要JSON请求');
   if(path==='/api/templates'){
    if(req.method==='GET'){send(200,{templates:await templates.list()});return;}
    if(req.method==='POST'){const body=await jsonBody(req);send(201,{templates:await templates.save(body.template as never,body.overwrite===true)});return;}
   }
   const tdel=/^\/api\/templates\/([\w-]+)\/delete$/.exec(path);if(tdel&&req.method==='POST'){send(200,{templates:await templates.remove(tdel[1])});return;}
   if(path==='/api/projects'){
    if(req.method==='GET'){send(200,{projects:await store.list(),root:store.root});return;}
    if(req.method==='POST'){const body=await jsonBody(req);const p=await store.create(identifier(body.projectId),string(body.title,120,true),identifier(body.requestId),body.design===undefined?undefined:validateDesign(body.design));send(201,{project:p,persisted:true});return;}
   }
   if(path==='/api/projects/import'&&req.method==='POST'){
    const body=await jsonBody(req);const imported=parseProject(body.project);const p=await store.importProject(imported,identifier(body.projectId),identifier(body.requestId));send(201,{project:p,persisted:true});return;
   }
   const recovery=/^\/api\/projects\/([\w-]+)\/recover$/.exec(path);if(recovery&&req.method==='POST'){const body=await jsonBody(req);const p=await store.recover(recovery[1],identifier(body.requestId));send(200,{project:p,persisted:true});return;}
   const guide=/^\/api\/projects\/([\w-]+)\/ai\/guide$/.exec(path);
   if(guide&&req.method==='POST'){
    const body=await jsonBody(req);const p=await store.read(guide[1]);identifier(body.requestId);const hash='guide:'+digest(body);const receipt=p.receipts.find(r=>r.requestId===body.requestId);if(receipt){if(receipt.hash!==hash)throw new ProjectError(409,'REQUEST_CONFLICT','重复请求ID内容冲突');send(200,{project:p,persisted:true,replayed:true});return;}
    if(p.headRevisionId!==body.baseHeadRevisionId||p.inputVersion!==body.baseInputVersion)throw new ProjectError(409,'STALE_CONTEXT','设计或材料版本已变，请回读后讨论');
    const controller=new AbortController();res.on('close',()=>{if(!res.writableEnded)controller.abort();});
    const result=await requestGuide(config,p,string(body.prompt,8000,true),controller.signal,{roundSize:Number(body.roundSize)||undefined,converge:body.converge===true});
    if(controller.signal.aborted)return;
    const updated=await store.appendGuide(p.projectId,p.headRevisionId,p.inputVersion,String(body.requestId),result.message,await laidOut(p,result.operations),hash,result.question,result.round,result.change,result.outcome);send(200,{project:updated,persisted:true});return;
   }
   const insight=/^\/api\/projects\/([\w-]+)\/insights(?:\/(status|prefs|ai))?$/.exec(path);
   if(insight){const id=insight[1];
    if(!insight[2]&&req.method==='GET'){send(200,{insights:await insights.observe(id)});return;}
    if(insight[2]==='status'&&req.method==='POST'){const body=await jsonBody(req);send(200,{insights:await insights.setStatus(id,identifier(body.id),body.status as 'dismissed'|'adopted')});return;}
    if(insight[2]==='prefs'&&req.method==='POST'){const body=await jsonBody(req);send(200,{insights:await insights.setPrefs(id,{...(typeof body.off==='boolean'?{off:body.off}:{}),...(typeof body.mute==='string'?{mute:body.mute}:{}),...(typeof body.unmute==='string'?{unmute:body.unmute}:{})})});return;}
    if(insight[2]==='ai'&&req.method==='POST'){
     const body=await jsonBody(req);identifier(body.requestId);let p=await store.read(id);
     if(p.headRevisionId!==body.baseHeadRevisionId||p.inputVersion!==body.baseInputVersion)throw new ProjectError(409,'STALE_CONTEXT','设计已变化，请稍后再请 AI 点评');
     const f=await insights.observe(id,Date.now()+60000);const batch=insights.latestBatch(f);if(!batch)throw new ProjectError(409,'NO_CHANGE','还没有可点评的变化，先做一步修改');
     const controller=new AbortController();res.on('close',()=>{if(!res.writableEnded)controller.abort();});
     const result=await requestReview(config,p,batch,controller.signal);if(controller.signal.aborted)return;
     let proposalId:string|null=null;if(result.operations.length){p=await store.appendGuide(id,p.headRevisionId,p.inputVersion,String(body.requestId),'AI 点评：'+result.summary,await laidOut(p,result.operations),'review:'+digest(body));proposalId=p.proposals.at(-1)!.id;}
     send(200,{insights:await insights.addAi(id,batch,result.insights,proposalId),project:p});return;
    }
   }
   const business=/^\/api\/projects\/([\w-]+)\/ai\/business$/.exec(path);
   if(business&&req.method==='POST'){
    const body=await jsonBody(req);const p=await store.read(business[1]);identifier(body.requestId);const hash=digest({...body,kind:'business'});const receipt=p.receipts.find(r=>r.requestId===body.requestId);if(receipt){if(receipt.hash!==hash)throw new ProjectError(409,'REQUEST_CONFLICT','重复请求ID内容冲突');send(200,{project:p,persisted:true,replayed:true});return;}
    if(p.headRevisionId!==body.baseHeadRevisionId||p.inputVersion!==body.baseInputVersion)throw new ProjectError(409,'STALE_CONTEXT','设计或材料版本已变，请回读后重试');
    if(p.onboarding?.status!=='business')throw new ProjectError(409,'WRONG_STEP','当前不在业务拓扑步骤');
    const controller=new AbortController();res.on('close',()=>{if(!res.writableEnded)controller.abort();});
    const candidates=await requestBusiness(config,p,controller.signal);if(controller.signal.aborted)return;
    const updated=await store.commit(p.projectId,{requestId:String(body.requestId),expectedWriteVersion:p.writeVersion,command:{type:'set_business_candidates',candidates}} as unknown as CommandRequest);send(200,{project:updated,persisted:true});return;
   }
   const pub=/^\/api\/projects\/([\w-]+)\/releases$/.exec(path);
   if(pub&&req.method==='POST'){const body=await jsonBody(req);const p=await store.publish(pub[1],identifier(body.requestId),identifier(body.baselineId),string(body.approvedBy,80,true));send(200,{project:p,persisted:true});return;}
   const relFile=/^\/api\/projects\/([\w-]+)\/releases\/([\w-]+)\/files\/([\w.\-\/]+)$/.exec(path);
   if(relFile&&req.method==='GET'){const f=await store.releaseFile(relFile[1],relFile[2],decodeURIComponent(relFile[3]));if(!res.writableEnded){res.statusCode=200;res.setHeader('Content-Type',f.type);res.setHeader('Cache-Control','no-store');res.setHeader('Content-Disposition','attachment');res.setHeader('X-Content-Type-Options','nosniff');res.end(f.content);}return;}
   const match=/^\/api\/projects\/([\w-]+)(?:\/(commands))?$/.exec(path);
   if(match){const id=match[1];if(!match[2]&&req.method==='GET'){send(200,{project:await store.read(id)});return;}if(match[2]==='commands'&&req.method==='POST'){const body=await jsonBody(req);const p=await store.commit(id,body as unknown as CommandRequest);send(200,{project:p,persisted:true,writeVersion:p.writeVersion,headRevisionId:p.headRevisionId,inputVersion:p.inputVersion});return;}}
   throw new ProjectError(req.method==='GET'||req.method==='POST'?404:405,'NOT_FOUND','接口不存在或方法不支持');
  })().catch(error=>{if(error instanceof ProjectError)send(error.status,{error:error.message,code:error.code});else if(error instanceof Error&&/无效|引用|超限|ID|字段|版本|评分/.test(error.message))send(400,{error:error.message,code:'INVALID_INPUT'});else send(500,{error:'本机项目操作失败；设计和原文件未被自动替换',code:'PROJECT_FAILED'});});
 };
}
