import test from 'node:test';import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {aiConcurrency} from '../server/ai.ts';
import {requestGuide} from '../server/guide.ts';
import {createProject,head,executeCommand} from '../src/project.ts';
import {newDesign} from '../src/design.ts';

test('模型建议经来源/引用校验，返回建议而不改设计；无效或未配置明确拒绝',async()=>{
 let invalid=false;let received:any;const provider=createServer(async(req,res)=>{const chunks=[];for await(const c of req)chunks.push(c);received=JSON.parse(Buffer.concat(chunks).toString());const node={id:'ai-node',name:'需求澄清能力',level:'capability',role:'capability',technology:'',description:'澄清业务目标',sourceIds:[invalid?'unknown':'source-1']};res.setHeader('Content-Type','application/json');res.end(JSON.stringify({choices:[{finish_reason:'stop',message:{content:JSON.stringify({message:'请确认成功标准',operations:[{type:'set_node',node}]})}}]}));});await new Promise<void>(r=>provider.listen(0,'127.0.0.1',r));
 const config={baseUrl:`http://127.0.0.1:${(provider.address() as {port:number}).port}`,model:'test',apiKey:'fixture-secret',provider:'deepseek'};
 let p=createProject('p','项目',newDesign());p=executeCommand(p,{type:'set_inputs',source:{id:'source-1',name:'需求',content:'架构师需要AI澄清需求',kind:'text'}});const original=JSON.stringify(head(p));
 try{const result=await requestGuide(config,p,'请澄清',new AbortController().signal);assert.equal(result.operations.length,1);assert.equal(result.message,'请确认成功标准');assert.equal(JSON.stringify(head(p)),original);assert.equal(received.response_format.type,'json_object');assert.doesNotMatch(JSON.stringify(result),/fixture-secret/);
 invalid=true;await assert.rejects(()=>requestGuide(config,p,'继续',new AbortController().signal),/来源|校验/);
 await assert.rejects(()=>requestGuide({...config,apiKey:''},p,'继续',new AbortController().signal),/未配置/);
 }finally{provider.closeAllConnections();await new Promise<void>(r=>provider.close(()=>r()));}
});

test('取消真实HTTP模型请求释放并发占用且不改变设计',async()=>{
 let arrived!:()=>void;const received=new Promise<void>(resolve=>{arrived=resolve;});const provider=createServer(async(req,res)=>{for await(const _ of req){}arrived();res.on('close',()=>{});});await new Promise<void>(r=>provider.listen(0,'127.0.0.1',r));const config={baseUrl:`http://127.0.0.1:${(provider.address() as {port:number}).port}`,model:'test',apiKey:'fixture-secret',provider:'deepseek'};const p=createProject('p','取消');const before=JSON.stringify(p);const controller=new AbortController();
 try{const pending=requestGuide(config,p,'请讨论',controller.signal);const check=assert.rejects(pending,/取消/);await received;controller.abort();await check;assert.equal(aiConcurrency.running,false);assert.equal(JSON.stringify(p),before);}finally{provider.closeAllConnections();await new Promise<void>(r=>provider.close(()=>r()));}
});
test('真实模型兼容：不支持的变更类型被忽略并说明，其余合法建议保留',async()=>{
 const provider=createServer(async(req,res)=>{for await(const _ of req){}res.setHeader('Content-Type','application/json');res.end(JSON.stringify({choices:[{finish_reason:'stop',message:{content:JSON.stringify({message:'建议',operations:[{type:'add_node',node:{}},{type:'set_constraint',constraint:{}},{type:'set_node',node:{id:'n1',name:'服务',level:'technical',role:'service',technology:'',description:'x',sourceIds:['source-1']}}]})}}]}));});await new Promise<void>(r=>provider.listen(0,'127.0.0.1',r));
 const config={baseUrl:`http://127.0.0.1:${(provider.address() as {port:number}).port}`,model:'test',apiKey:'fixture-secret',provider:'deepseek'};
 let p=createProject('p','项目',newDesign());p=executeCommand(p,{type:'set_inputs',source:{id:'source-1',name:'需求',content:'x',kind:'text'}});
 try{const r=await requestGuide(config,p,'继续',new AbortController().signal);assert.deepEqual(r.operations.map(o=>o.type),['set_node']);assert.match(r.message,/已忽略 2 项/);}finally{provider.closeAllConnections();await new Promise<void>(r=>provider.close(()=>r()));}
});
test('STORY-021 AC-03：AI 上下文包含 ADU 缺口摘要',async()=>{
 let body:any;const provider=createServer(async(req,res)=>{const c=[];for await(const x of req)c.push(x);body=JSON.parse(Buffer.concat(c).toString());res.setHeader('Content-Type','application/json');res.end(JSON.stringify({choices:[{finish_reason:'stop',message:{content:JSON.stringify({message:'ok',operations:[]})}}]}));});await new Promise<void>(r=>provider.listen(0,'127.0.0.1',r));
 const config={baseUrl:`http://127.0.0.1:${(provider.address() as {port:number}).port}`,model:'test',apiKey:'fixture-secret',provider:'deepseek'};
 try{await requestGuide(config,createProject('p','项目',newDesign()),'继续',new AbortController().signal);const ctx=JSON.parse(body.messages[1].content);assert.ok(Array.isArray(ctx.adu)&&ctx.adu.length>0);assert.match(body.messages[0].content,/ADU/);}finally{provider.closeAllConnections();await new Promise<void>(r=>provider.close(()=>r()));}
});
