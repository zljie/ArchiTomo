import { mkdir, open, readFile, rename, unlink } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { ProjectError } from '../src/project.ts';
import { newDesign, string } from '../src/design.ts';
import { parseCode } from '../src/dsl.ts';
/** 我的模板（STORY-015）：本机项目根目录 templates.json；写入用临时文件+rename，损坏文件不覆盖。 */
export type MyTemplate={id:string;name:string;description:string;level:string;code:string;createdAt:string};
const FILE='templates.json',MAX=100,MAX_BYTES=2*1024*1024;
export class TemplateStore{
 root:string;private queue:Promise<unknown>=Promise.resolve();
 constructor(root:string){this.root=resolve(root);}
 async list():Promise<MyTemplate[]>{
  let text:string;try{text=await readFile(join(this.root,FILE),'utf8');}catch(e){if((e as NodeJS.ErrnoException).code==='ENOENT')return [];throw new ProjectError(500,'TEMPLATES_READ_FAILED','模板文件无法读取');}
  try{const v=JSON.parse(text);if(v?.format!=='archsketch-templates'||v.version!==1||!Array.isArray(v.templates))throw Error();return v.templates as MyTemplate[];}catch{throw new ProjectError(500,'TEMPLATES_CORRUPT','模板文件已损坏；原文件已保留，请检查 '+FILE);}
 }
 private serial<T>(fn:()=>Promise<T>):Promise<T>{const job=this.queue.catch(()=>{}).then(fn);this.queue=job;return job;}
 private async write(templates:MyTemplate[]){
  const body=JSON.stringify({format:'archsketch-templates',version:1,templates},null,2);if(Buffer.byteLength(body)>MAX_BYTES)throw new ProjectError(413,'INPUT_TOO_LARGE','模板总量超过2MB');
  await mkdir(this.root,{recursive:true,mode:0o700});const tmp=join(this.root,FILE+'.tmp-'+crypto.randomUUID());let h;
  try{h=await open(tmp,'wx',0o600);await h.writeFile(body,'utf8');await h.sync();await h.close();h=undefined;await rename(tmp,join(this.root,FILE));}finally{await h?.close();await unlink(tmp).catch(()=>{});}
 }
 save(input:Omit<MyTemplate,'id'|'createdAt'>,overwrite=false):Promise<MyTemplate[]>{return this.serial(async()=>{
  let name:string,description:string,code:string;try{name=string(input?.name,60,true).trim();description=string(input?.description??'',300);code=string(input?.code,200000,true);}catch{throw new ProjectError(400,'INVALID_INPUT','模板名称或内容无效');}
  const view=newDesign().views.find(v=>v.level===input.level);if(!view)throw new ProjectError(400,'INVALID_INPUT','模板层级无效');
  const parsed=parseCode(newDesign(),view,code);if(!parsed.design)throw new ProjectError(400,'INVALID_INPUT','模板图代码无效：'+parsed.errors.slice(0,2).map(e=>e.message).join('；'));
  const list=await this.list();const same=list.find(t=>t.name===name);if(same&&!overwrite)throw new ProjectError(409,'TEMPLATE_EXISTS','已有同名模板');
  const t:MyTemplate={id:same?.id||crypto.randomUUID(),name,description,level:input.level,code,createdAt:new Date().toISOString()};
  const next=same?list.map(x=>x.id===same.id?t:x):[...list,t];if(next.length>MAX)throw new ProjectError(413,'INPUT_TOO_LARGE','最多保存100个模板');await this.write(next);return next;
 });}
 remove(id:string):Promise<MyTemplate[]>{return this.serial(async()=>{const list=await this.list();const next=list.filter(t=>t.id!==id);if(next.length===list.length)throw new ProjectError(404,'NOT_FOUND','模板不存在');await this.write(next);return next;});}
}
