import test from 'node:test';import assert from 'node:assert/strict';
import {screenOperations,outcomeStatus,relationGuide,repairPrompt} from '../src/aiOutcome.ts';
import {PROFILE} from '../src/profile.ts';

test('STORY-032 AC-01：丢弃的每项变更都有可读原因，不出现 undefined；常见别名字段被规范化',()=>{
 const raw=[{type:'set_node',node:{id:'a'}},{op:'set_node',node:{id:'b'}},{action:'set_relation',relation:{id:'r'}},{id:'c'}/* 无法推断类型：载荷推断见下一用例 */,{type:'set_view',view:{id:'applications'}},null];
 const s=screenOperations(raw);
 assert.equal(s.kept.length,3,'type / op / action 均可识别为受支持的变更');assert.ok(s.kept.every(o=>typeof o.type==='string'));
 assert.equal(s.dropped.length,3);assert.ok(s.dropped.every(d=>d.reason&&!/undefined|null/.test(d.reason)),JSON.stringify(s.dropped));
 assert.match(s.dropped.find(d=>d.index===3)!.reason,/缺少变更类型/);assert.match(s.dropped.find(d=>d.index===4)!.reason,/set_view.*不支持/);
});
test('STORY-032 AC-01：真实模型省略 type 时按唯一载荷字段推断（2026-10-19 浏览器实测 6 项缺 type）',()=>{
 const s=screenOperations([{node:{id:'n'}},{relation:{id:'r'}},{coverage:{domain:'data'}},{node:{id:'x'},relation:{id:'y'}},{id:'gone'}]);
 assert.deepEqual(s.kept.map(o=>o.type),['set_node','set_relation','set_coverage']);assert.equal(s.dropped.length,2);assert.match(s.dropped[0].reason,/无法判断/);
});
test('STORY-032 AC-01：零有效操作与成功态区分',()=>{
 assert.equal(outcomeStatus({kept:0,dropped:['第 1 项缺少变更类型']},false),'none');
 assert.equal(outcomeStatus({kept:3,dropped:[]},true),'applicable');
 assert.equal(outcomeStatus({kept:0,dropped:[]},false),'empty','纯对话回复不算失败');
});
test('STORY-032 AC-03：给模型的关系规则含类型与端点约束',()=>{
 const g=relationGuide(PROFILE);assert.ok(g.length>=6);
 const contains=g.find(l=>l.startsWith('contains'));assert.ok(contains&&/→/.test(contains),contains);
 assert.ok(g.some(l=>/realizedBy/.test(l)));
});
test('STORY-032 AC-04：修复提示包含原请求与具体失败原因，并要求只修正不合法部分',()=>{
 const t=repairPrompt('补设备与文档关系','contains（DomainConcept → DomainConcept）不在 Profile 白名单中');
 assert.match(t,/补设备与文档关系/);assert.match(t,/DomainConcept → DomainConcept/);assert.match(t,/修复|修正/);
});
import {createServer} from 'node:http';
import {requestGuide} from '../server/guide.ts';
import {createProject,executeCommand,parseProject} from '../src/project.ts';
import {newDesign} from '../src/design.ts';
test('STORY-032 AC-01/03：服务端返回结果说明，提示词带关系规则；零有效操作不产生提案',async()=>{
 let seen='';const provider=createServer(async(req,res)=>{let body='';for await(const c of req)body+=c;seen=body;res.setHeader('Content-Type','application/json');res.end(JSON.stringify({choices:[{finish_reason:'stop',message:{content:JSON.stringify({message:'已新建 9 个应用节点',operations:[{target:'a'},{type:'set_view',view:{}}]})}}]}));});
 await new Promise<void>(r=>provider.listen(0,'127.0.0.1',r));const config={baseUrl:`http://127.0.0.1:${(provider.address() as {port:number}).port}`,model:'test',apiKey:'fixture-secret',provider:'deepseek'};
 let p=createProject('p','项目',newDesign());p=executeCommand(p,{type:'set_inputs',source:{id:'source-1',name:'需求',content:'x',kind:'text'}});
 try{const r=await requestGuide(config,p,'建应用层',new AbortController().signal);
  assert.equal(r.operations.length,0);assert.equal(r.outcome.kept,0);assert.equal(r.outcome.dropped.length,2);assert.ok(r.outcome.dropped.every(x=>!/undefined/.test(x)));
  assert.match(seen,/relationRules/);assert.match(seen,/ApplicationSystem → RuntimeUnit/);
  const withMsg=structuredClone(p);withMsg.conversation.push({id:'m1',role:'assistant',content:r.message,sourceIds:[],outcome:r.outcome});assert.doesNotThrow(()=>parseProject(withMsg));
 }finally{provider.closeAllConnections();await new Promise<void>(r=>provider.close(()=>r()));}
});
