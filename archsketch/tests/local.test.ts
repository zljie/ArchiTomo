import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createProjectMiddleware} from '../server/local.ts';
import {newDesign} from '../src/design.ts';

test('本机项目HTTP创建/编辑/回读和冲突不会覆盖资产',async()=>{
 const root=await mkdtemp(join(tmpdir(),'archsketch-http-'));const middleware=createProjectMiddleware(root,{baseUrl:'https://api.deepseek.com',model:'',apiKey:''});
 const server=createServer((req,res)=>middleware(req,res,()=>{res.statusCode=404;res.end();}));await new Promise<void>(r=>server.listen(0,'127.0.0.1',r));const base=`http://127.0.0.1:${(server.address() as {port:number}).port}`;
 const post=(path:string,body:unknown,headers:Record<string,string>={})=>fetch(base+path,{method:'POST',headers:{'Content-Type':'application/json',...headers},body:JSON.stringify(body)});
 try{
 const created=await post('/api/projects',{projectId:'p',title:'项目',requestId:'create'});assert.equal(created.status,201);const p=(await created.json()).project;
 const edited=await post('/api/projects/p/commands',{requestId:'edit',expectedWriteVersion:p.writeVersion,command:{type:'edit_design',design:newDesign('新标题')}});assert.equal(edited.status,200);
 const current=(await (await fetch(base+'/api/projects/p')).json()).project;assert.equal(current.title,'新标题');
 const conflict=await post('/api/projects/p/commands',{requestId:'conflict',expectedWriteVersion:1,command:{type:'edit_design',design:newDesign('不应覆盖')}});assert.equal(conflict.status,409);
 const cross=await post('/api/projects',{projectId:'evil',title:'x',requestId:'x'},{Origin:'https://evil.example'});assert.equal(cross.status,403);
 const after=(await (await fetch(base+'/api/projects/p')).json()).project;assert.equal(after.title,'新标题');
 }finally{server.closeAllConnections();await new Promise<void>(r=>server.close(()=>r()));await rm(root,{recursive:true,force:true});}
});
