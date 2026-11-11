import test from 'node:test';import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {newDesign} from '../src/design.ts';
import {parseCode} from '../src/dsl.ts';
import {createProject,executeCommand,head,applyOperations,operationsBetween} from '../src/project.ts';
import {requestGuide} from '../server/guide.ts';
const sorted=(d:any)=>JSON.stringify({...d,nodes:[...d.nodes].sort((a:any,b:any)=>a.id.localeCompare(b.id)),relationships:[...d.relationships].sort((a:any,b:any)=>a.id.localeCompare(b.id)),boundaries:[...d.boundaries].sort((a:any,b:any)=>a.id.localeCompare(b.id))});

test('STORY-009 AC-03：operationsBetween 把旧设计变为新设计',()=>{
 const d0=newDesign();const v=d0.views.find(v=>v.id==='technical')!;
 const d1=parseCode(d0,v,'direction down\nVPC {\n  网关 [type: gateway]\n  服务 [type: service]\n}\n网关 > 服务: 转发\n服务 -- 缓存 [type: depends_on]').design!;
 const d2=parseCode(d1,d1.views.find(v=>v.id==='technical')!,'网关 [type: gateway]\n服务 [type: service, color: red]\n网关 <> 服务: 双向').design!;
 for(const [a,b] of [[d0,d1],[d1,d2],[d2,d0]]){const ops=operationsBetween(a,b);assert.ok(ops.length>0);assert.equal(sorted(applyOperations(a,ops)),sorted(b));}
 assert.deepEqual(operationsBetween(d1,d1),[]);
});
test('STORY-009 AC-03：AI返回图代码成为待审建议，新节点关联材料；非法图代码被丢弃',async()=>{
 let diagram='网关 [type: gateway]\n订单服务 [type: service]\n网关 > 订单服务: 转发';const provider=createServer(async(req,res)=>{for await(const _ of req){}res.setHeader('Content-Type','application/json');res.end(JSON.stringify({choices:[{finish_reason:'stop',message:{content:JSON.stringify({message:'草图如下',question:null,diagram:{viewId:'technical',code:diagram},operations:[]})}}]}));});
 await new Promise<void>(r=>provider.listen(0,'127.0.0.1',r));const config={baseUrl:`http://127.0.0.1:${(provider.address() as {port:number}).port}`,model:'test',apiKey:'fixture-secret',provider:'deepseek'};
 let p=createProject('p','草图');p=executeCommand(p,{type:'set_inputs',source:{id:'s1',name:'描述',content:'订单系统',kind:'text'}});const original=JSON.stringify(head(p));
 try{const result=await requestGuide(config,p,'画一个订单系统',new AbortController().signal);assert.ok(result.operations.length>=3);assert.equal(JSON.stringify(head(p)),original);
  const applied=applyOperations(head(p),result.operations);const v=applied.views.find(v=>v.id==='technical')!;assert.equal(v.nodeIds.length,2);for(const n of applied.nodes)assert.deepEqual(n.sourceIds,['s1']);assert.equal(applied.relationships[0].label,'转发');
  diagram='坏组 {\n  服务 [type: service]';// 宽松模式下类型别名可容忍，改用结构性错误（未闭合分组）const bad=await requestGuide(config,p,'再画',new AbortController().signal);assert.match(bad.message,/^草图如下/);assert.match(bad.message,/已丢弃/);// 真实模型验收后：丢弃草图时向架构师说明原因assert.deepEqual(bad.operations,[]);
 }finally{provider.closeAllConnections();await new Promise<void>(r=>provider.close(()=>r()));}
});
test('真实模型兼容：diagram 直接为图代码字符串时按技术容器视图解析',async()=>{
 const {diagramOperations}=await import('../server/guide.ts');let p=createProject('p','串');p=executeCommand(p,{type:'set_inputs',source:{id:'s1',name:'描述',content:'x',kind:'text'}});
 const ops=diagramOperations(p,'网关 [type: gateway]\n服务 [type: service]\n网关 > 服务');assert.ok(ops.some(o=>o.type==='set_node'));
});
test('BUG-002：真实模型省略 operations、给 null 或超过 30 项时不再整体失败',async()=>{
 let body:Record<string,unknown>={};const provider=createServer(async(req,res)=>{for await(const _ of req){}res.setHeader('Content-Type','application/json');res.end(JSON.stringify({choices:[{finish_reason:'stop',message:{content:JSON.stringify(body)}}]}));});
 await new Promise<void>(r=>provider.listen(0,'127.0.0.1',r));const config={baseUrl:`http://127.0.0.1:${(provider.address() as {port:number}).port}`,model:'test',apiKey:'fixture-secret',provider:'deepseek'};
 let p=createProject('p','草图');p=executeCommand(p,{type:'set_inputs',source:{id:'s1',name:'描述',content:'订单系统',kind:'text'}});
 const diagram={viewId:'technical',code:'网关 [type: gateway]\n订单服务 [type: service]\n网关 > 订单服务'};
 try{
  body={message:'省略',question:null,diagram};let r=await requestGuide(config,p,'画',new AbortController().signal);assert.ok(r.operations.some(o=>o.type==='set_node'));
  body={message:'空值',question:null,diagram,operations:null};r=await requestGuide(config,p,'画',new AbortController().signal);assert.ok(r.operations.some(o=>o.type==='set_node'));
  body={message:'过多',question:null,operations:Array.from({length:40},(_,i)=>({type:'set_risk',risk:{id:'r'+i,text:'风险'+i,objectIds:[]}}))};r=await requestGuide(config,p,'画',new AbortController().signal);assert.equal(r.operations.length,30);assert.match(r.message,/超出/);
 }finally{provider.closeAllConnections();await new Promise<void>(r=>provider.close(()=>r()));}
});
test('BUG-002：额外 operations 校验失败时保留有效草图并说明',async()=>{
 const provider=createServer(async(req,res)=>{for await(const _ of req){}res.setHeader('Content-Type','application/json');res.end(JSON.stringify({choices:[{finish_reason:'stop',message:{content:JSON.stringify({message:'草图',question:null,diagram:{viewId:'technical',code:'网关 [type: gateway]\n服务 [type: service]\n网关 > 服务'},operations:[{type:'set_decision',decision:{id:'d1',title:'缺字段'}}]})}}]}));});
 await new Promise<void>(r=>provider.listen(0,'127.0.0.1',r));const config={baseUrl:`http://127.0.0.1:${(provider.address() as {port:number}).port}`,model:'test',apiKey:'fixture-secret',provider:'deepseek'};
 let p=createProject('p','草图');p=executeCommand(p,{type:'set_inputs',source:{id:'s1',name:'描述',content:'x',kind:'text'}});
 try{const r=await requestGuide(config,p,'画',new AbortController().signal);assert.ok(r.operations.every(o=>o.type!=='set_decision'));assert.ok(r.operations.some(o=>o.type==='set_node'));assert.match(r.message,/未通过校验/);}
 finally{provider.closeAllConnections();await new Promise<void>(r=>provider.close(()=>r()));}
});
