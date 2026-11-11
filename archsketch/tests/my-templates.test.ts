import test from 'node:test';import assert from 'node:assert/strict';
import {mkdtemp,rm,writeFile,readFile} from 'node:fs/promises';import {tmpdir} from 'node:os';import {join} from 'node:path';
import {createServer,type Server} from 'node:http';
import {TemplateStore} from '../server/templates.ts';
import {createProjectMiddleware} from '../server/local.ts';
const code='网关 [type: gateway]\n服务 [type: service]\n网关 > 服务';

test('STORY-015 AC-01：保存、列出、删除并跨实例持久',async()=>{
 const root=await mkdtemp(join(tmpdir(),'as-tpl-'));try{
  const s=new TemplateStore(root);let list=await s.save({name:'我的网关',description:'说明',level:'technical',code});assert.equal(list.length,1);assert.ok(list[0].id&&list[0].createdAt);
  list=await new TemplateStore(root).list();assert.equal(list[0].name,'我的网关');assert.equal(list[0].code,code);
  await assert.rejects(()=>s.save({name:'我的网关',description:'',level:'technical',code}),(e:any)=>e.status===409);
  list=await s.save({name:'我的网关',description:'新',level:'technical',code},true);assert.equal(list.length,1);assert.equal(list[0].description,'新');
  list=await s.remove(list[0].id);assert.deepEqual(list,[]);
 }finally{await rm(root,{recursive:true,force:true});}
});
test('STORY-015 AC-02：非法模板拒绝；损坏文件不被覆盖',async()=>{
 const root=await mkdtemp(join(tmpdir(),'as-tpl-'));try{
  const s=new TemplateStore(root);
  for(const bad of [{name:' ',description:'',level:'technical',code},{name:'x',description:'',level:'nope',code},{name:'x',description:'',level:'technical',code:'坏 [type: capability]'},{name:'x',description:'',level:'technical',code:''}])await assert.rejects(()=>s.save(bad),(e:any)=>e.status===400);
  await writeFile(join(root,'templates.json'),'{坏');await assert.rejects(()=>s.save({name:'y',description:'',level:'technical',code}),(e:any)=>e.status===500);assert.equal(await readFile(join(root,'templates.json'),'utf8'),'{坏');
 }finally{await rm(root,{recursive:true,force:true});}
});
test('STORY-015：HTTP 接口往返',async()=>{
 const root=await mkdtemp(join(tmpdir(),'as-tpl-'));const mw=createProjectMiddleware(root,{baseUrl:'',model:'',apiKey:'',provider:''});const app:Server=createServer((req,res)=>mw(req,res,()=>{res.statusCode=404;res.end();}));await new Promise<void>(r=>app.listen(0,'127.0.0.1',r));const base=`http://127.0.0.1:${(app.address() as {port:number}).port}`;
 try{let r=await fetch(base+'/api/templates',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({template:{name:'T',description:'',level:'technical',code}})});assert.equal(r.status,201);const id=(await r.json()).templates[0].id;
  r=await fetch(base+'/api/templates');assert.equal((await r.json()).templates.length,1);
  r=await fetch(base+'/api/templates/'+id+'/delete',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'});assert.deepEqual((await r.json()).templates,[]);
  r=await fetch(base+'/api/projects');assert.equal((await r.json()).projects.length,0,'模板文件不应出现在项目列表');
 }finally{app.closeAllConnections();await new Promise<void>(r=>app.close(()=>r()));await rm(root,{recursive:true,force:true});}
});
