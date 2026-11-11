import { open, mkdir, lstat, realpath, readdir, rename, unlink } from 'node:fs/promises';
import { constants } from 'node:fs';
import { resolve, join, sep } from 'node:path';
import { createHash } from 'node:crypto';
import type { Project, Command } from '../src/project.ts';
import { createProject, parseProject, executeCommand, ProjectError } from '../src/project.ts';
import { identifier, string, type Design } from '../src/design.ts';
import { buildRelease } from '../src/reviewPackage.ts';
export type CommandRequest={requestId:string;expectedWriteVersion:number;command:Command};
export const MAX_PROJECT_BYTES=32*1024*1024;
export const digest=(v:unknown)=>createHash('sha256').update(JSON.stringify(v)).digest('hex');
export class ProjectStore {
 root:string;constructor(root:string){this.root=resolve(root);}
 async directory(id:string,create=false){
  identifier(id);await mkdir(this.root,{recursive:true,mode:0o700});const root=await realpath(this.root);const dir=join(root,id);
  if(create)await mkdir(dir,{mode:0o700}).catch(e=>{if(e.code!=='EEXIST')throw e;});
  const stat=await lstat(dir);if(stat.isSymbolicLink()||!stat.isDirectory())throw new ProjectError(403,'LOCAL_ACCESS_DENIED','拒绝项目目录符号链接或无效路径');
  const actual=await realpath(dir);if(!actual.startsWith(root+sep))throw new ProjectError(403,'LOCAL_ACCESS_DENIED','项目路径越界');return actual;
 }
 async read(id:string,name:'project.json'|'project.previous.json'='project.json'):Promise<Project>{
  let handle;
  try{const dir=await this.directory(id);handle=await open(join(dir,name),constants.O_RDONLY|constants.O_NOFOLLOW);const stat=await handle.stat();if(stat.size>MAX_PROJECT_BYTES)throw new ProjectError(413,'INPUT_TOO_LARGE','项目超过32MB，未截断历史');const chunks:Buffer[]=[];let bytes=0;for(;;){const chunk=Buffer.alloc(65536);const {bytesRead}=await handle.read(chunk,0,chunk.length,null);if(!bytesRead)break;bytes+=bytesRead;if(bytes>MAX_PROJECT_BYTES)throw new ProjectError(413,'INPUT_TOO_LARGE','项目超过32MB');chunks.push(chunk.subarray(0,bytesRead));}const p=parseProject(JSON.parse(Buffer.concat(chunks).toString('utf8')));if(p.projectId!==id)throw Error('项目目录与ID不一致');return p;
  }catch(e){if(e instanceof ProjectError)throw e;const error=e as NodeJS.ErrnoException;if(error.code==='ENOENT')throw new ProjectError(404,'PROJECT_NOT_FOUND','项目不存在');throw new ProjectError(500,'PROJECT_READ_FAILED','项目无法读取；原文件保留，请检查或恢复备份');}finally{await handle?.close();}
 }
 async list(){await mkdir(this.root,{recursive:true,mode:0o700});const out:{projectId:string;title:string;writeVersion:number;error?:string}[]=[];for(const entry of await readdir(this.root,{withFileTypes:true})){if(!entry.isDirectory()||!/^[-\w]+$/.test(entry.name))continue;try{const p=await this.read(entry.name);out.push({projectId:p.projectId,title:p.title,writeVersion:p.writeVersion});}catch(e){out.push({projectId:entry.name,title:entry.name,writeVersion:0,error:e instanceof Error?e.message:'无法读取'});}}return out;}
 async locked<T>(id:string,fn:(dir:string)=>Promise<T>,create=false):Promise<T>{
  const dir=await this.directory(id,create);const path=join(dir,'write.lock');let lock;
  const acquire=()=>open(path,'wx',0o600);
  try{lock=await acquire();}catch(e){
   if((e as NodeJS.ErrnoException).code!=='EEXIST')throw e;
   let recovery;let old;
   try{
    recovery=await open(join(dir,'recovery.lock'),'wx',0o600);
    old=await open(path,constants.O_RDONLY|constants.O_NOFOLLOW);if((await old.stat()).size>20)throw Error('锁无效');const pid=Number(await old.readFile('utf8'));await old.close();old=undefined;
    if(!Number.isSafeInteger(pid)||pid<=0)throw Error('锁无效');
    let dead=false;try{process.kill(pid,0);}catch(error){dead=(error as NodeJS.ErrnoException).code==='ESRCH';}if(!dead)throw Error('仍有写入');
    await unlink(path);lock=await acquire();
   }catch{throw new ProjectError(409,'PROJECT_BUSY','项目写锁仍被占用或无法确认进程退出；请回读检查后重试');}
   finally{await old?.close();if(recovery){await recovery.close();await unlink(join(dir,'recovery.lock')).catch(()=>{});}}
  }
  try{await lock.writeFile(String(process.pid));await lock.sync();return await fn(dir);}finally{await lock.close();await unlink(path).catch(()=>{});}
 }
 async write(dir:string,p:Project,previous?:Project){
  const content=JSON.stringify(parseProject(p));if(Buffer.byteLength(content)>MAX_PROJECT_BYTES)throw new ProjectError(413,'INPUT_TOO_LARGE','项目超过32MB；历史未删除，请导出备份');
  const replace=async(name:string,body:string)=>{const temp=join(dir,name+'.tmp-'+crypto.randomUUID());let h;try{h=await open(temp,'wx',0o600);await h.writeFile(body,'utf8');await h.sync();await h.close();h=undefined;await rename(temp,join(dir,name));}finally{await h?.close();await unlink(temp).catch(()=>{});}};
  try{if(previous)await replace('project.previous.json',JSON.stringify(previous));await replace('project.json',content);const directory=await open(dir,constants.O_RDONLY);try{await directory.sync();}finally{await directory.close();}}
  catch{throw new ProjectError(500,'PROJECT_WRITE_FAILED','写入失败，不能确认已保存；原项目或previous备份保留，请回读检查');}
 }
 async create(id:string,title:string,requestId:string,design?:Design):Promise<Project>{
  identifier(id);identifier(requestId);string(title,120,true);const hash=digest({id,title,requestId,design});
  return this.locked(id,async dir=>{
   try{const old=await this.read(id);const receipt=old.receipts.find(r=>r.requestId===requestId);if(receipt?.hash===hash)return old;throw new ProjectError(409,'PROJECT_EXISTS','项目已存在，禁止覆盖');}catch(e){if(!(e instanceof ProjectError)||e.status!==404)throw e;}
   const p=createProject(id,title,design);p.receipts.push({requestId,hash,writeVersion:p.writeVersion,headRevisionId:p.headRevisionId,inputVersion:p.inputVersion});await this.write(dir,p);return p;
  },true);
 }
 async commit(id:string,request:CommandRequest):Promise<Project>{
  identifier(request.requestId);const hash=digest(request);
  return this.locked(id,async dir=>{
   const old=await this.read(id);const receipt=old.receipts.find(r=>r.requestId===request.requestId);
   if(receipt){if(receipt.hash!==hash)throw new ProjectError(409,'REQUEST_CONFLICT','重复请求ID内容冲突');return old;}
   if(old.writeVersion!==request.expectedWriteVersion)throw new ProjectError(409,'VERSION_CONFLICT','保存版本冲突，草稿已保留；请回读比较');
   const next=executeCommand(old,request.command);next.receipts.push({requestId:request.requestId,hash,writeVersion:next.writeVersion,headRevisionId:next.headRevisionId,inputVersion:next.inputVersion});await this.write(dir,next,old);return next;
  });
 }
 /** 发布基线（STORY-035）：交付包文件只写一次（wx、只读权限），项目记录逐文件 SHA-256；重复请求幂等。 */
 async publish(id:string,requestId:string,baselineId:string,approvedBy:string):Promise<Project>{
  identifier(requestId);identifier(baselineId);const who=string(approvedBy,80,true,'批准人').trim();const hash=digest({kind:'publish',baselineId,approvedBy:who});
  return this.locked(id,async dir=>{
   const old=await this.read(id);const receipt=old.receipts.find(r=>r.requestId===requestId);if(receipt){if(receipt.hash!==hash)throw new ProjectError(409,'REQUEST_CONFLICT','重复请求ID内容冲突');return old;}
   const b=old.baselines.find(x=>x.id===baselineId);if(!b)throw new ProjectError(404,'NOT_FOUND','基线不存在');if(old.releases?.some(r=>r.baselineId===baselineId))throw new ProjectError(409,'RELEASE_EXISTS','该基线已发布交付包，已发布内容不可修改');
   const relId=crypto.randomUUID();const publishedAt=new Date().toISOString();const files=buildRelease(old,baselineId,who,publishedAt);
   const base=join(dir,'releases',relId);await mkdir(join(dir,'releases'),{recursive:true,mode:0o700});await mkdir(base,{mode:0o700});
   for(const f of files){const target=join(base,f.path);if(!target.startsWith(base+sep))throw new ProjectError(400,'INVALID_INPUT','交付文件路径无效');await mkdir(join(target,'..'),{recursive:true,mode:0o700});const h=await open(target,'wx',0o400);try{await h.writeFile(f.content,'utf8');await h.sync();}finally{await h.close();}}
   const release={id:relId,baselineId,revisionId:b.revisionId,approvedBy:who,publishedAt,files:files.map(f=>({path:f.path,sha256:createHash('sha256').update(f.content).digest('hex'),bytes:Buffer.byteLength(f.content)}))};
   const next=executeCommand(old,{type:'record_release',release});next.receipts.push({requestId,hash,writeVersion:next.writeVersion,headRevisionId:next.headRevisionId,inputVersion:next.inputVersion});await this.write(dir,next,old);return next;
  });
 }
 /** 读取已发布文件并核对哈希；被改动时拒绝返回。 */
 async releaseFile(id:string,releaseId:string,path:string):Promise<{content:Buffer;type:string}>{
  const p=await this.read(id);const rel=p.releases?.find(r=>r.id===releaseId);const entry=rel?.files.find(f=>f.path===path);if(!rel||!entry)throw new ProjectError(404,'NOT_FOUND','交付文件不存在');
  const dir=await this.directory(id);const base=join(dir,'releases',rel.id);const target=join(base,entry.path);if(!target.startsWith(base+sep))throw new ProjectError(403,'LOCAL_ACCESS_DENIED','交付文件路径越界');
  let h;try{h=await open(target,constants.O_RDONLY|constants.O_NOFOLLOW);const content=await h.readFile();if(createHash('sha256').update(content).digest('hex')!==entry.sha256)throw new ProjectError(409,'RELEASE_TAMPERED','交付文件与发布时的哈希不一致，已拒绝读取');
   return {content,type:path.endsWith('.html')?'text/html; charset=utf-8':path.endsWith('.svg')?'image/svg+xml':path.endsWith('.json')?'application/json; charset=utf-8':'text/markdown; charset=utf-8'};}
  catch(e){if(e instanceof ProjectError)throw e;throw new ProjectError(404,'NOT_FOUND','交付文件缺失');}finally{await h?.close();}
 }
 async importProject(source:Project,id:string,requestId:string):Promise<Project>{
  identifier(id);identifier(requestId);const imported=parseProject(source);const hash=digest({source,id,requestId});
  return this.locked(id,async dir=>{
   try{const old=await this.read(id);if(old.receipts.some(r=>r.requestId===requestId&&r.hash===hash))return old;throw new ProjectError(409,'PROJECT_EXISTS','目标项目已存在，禁止覆盖');}catch(e){if(!(e instanceof ProjectError)||e.status!==404)throw e;}
   const p=structuredClone(imported);p.projectId=id;p.writeVersion=1;p.receipts=[{requestId,hash,writeVersion:1,headRevisionId:p.headRevisionId,inputVersion:p.inputVersion}];await this.write(dir,p);return p;
  },true);
 }
 async recover(id:string,requestId:string):Promise<Project>{
  identifier(requestId);return this.locked(id,async dir=>{
   try{const current=await this.read(id);if(current.receipts.some(r=>r.requestId===requestId&&r.hash==='recovery'))return current;throw new ProjectError(409,'PROJECT_HEALTHY','当前项目可读；禁止用恢复副本覆盖');}catch(e){if(!(e instanceof ProjectError)||!['PROJECT_READ_FAILED','PROJECT_NOT_FOUND'].includes(e.code))throw e;}
   const previous=await this.read(id,'project.previous.json');const restored=structuredClone(previous);restored.writeVersion++;
   restored.receipts.push({requestId,hash:'recovery',writeVersion:restored.writeVersion,headRevisionId:restored.headRevisionId,inputVersion:restored.inputVersion});
   await rename(join(dir,'project.json'),join(dir,'project.damaged.'+crypto.randomUUID()+'.json')).catch(e=>{if(e.code!=='ENOENT')throw e;});await this.write(dir,restored);return restored;
  });
 }
 async appendGuide(id:string,baseHeadRevisionId:string,baseInputVersion:number,requestId:string,content:string,operations:import('../src/design.ts').Operation[],hash:string,question:import('../src/project.ts').Question|null=null,round?:import('../src/guideRound.ts').GuideRound,meta?:import('../src/project.ts').ChangeSetMeta,outcome?:{kept:number;dropped:string[]}):Promise<Project>{
  return this.locked(id,async dir=>{const old=await this.read(id);const receipt=old.receipts.find(r=>r.requestId===requestId);if(receipt){if(receipt.hash!==hash)throw new ProjectError(409,'REQUEST_CONFLICT','重复请求ID内容冲突');return old;}
   const next=structuredClone(old);next.conversation.push({id:crypto.randomUUID(),role:'assistant',content,sourceIds:[],...(outcome?{outcome:{kept:outcome.kept,dropped:outcome.dropped.slice(0,200).map(r=>r.slice(0,400))}}:{})});
   let proposalId:string|null=null;if(operations.length){proposalId=crypto.randomUUID();for(const old of next.proposals)if(old.status==='pending')old.status='stale';// BUG-003：只保留最新草图
 next.proposals.push({id:proposalId,requestId,baseHeadRevisionId,baseInputVersion,status:baseHeadRevisionId===next.headRevisionId&&baseInputVersion===next.inputVersion?'pending':'stale',summary:content,operations,...(meta?{rationale:meta.rationale,impact:meta.impact,tradeoffs:meta.tradeoffs,validation:meta.validation}:{})});}
   if(question){next.questions??=[];for(const q of next.questions)if(q.status==='open'&&q.source==='ai')q.status='skipped';next.questions.push({...question,proposalId});}
   if(round)next.guideRound=round;
   next.writeVersion++;next.receipts.push({requestId,hash,writeVersion:next.writeVersion,headRevisionId:next.headRevisionId,inputVersion:next.inputVersion});await this.write(dir,next,old);return next;
  });
 }
}
