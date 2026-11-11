import test from 'node:test';import assert from 'node:assert/strict';
import {createServer,type Server} from 'node:http';import {mkdtemp,rm} from 'node:fs/promises';import {tmpdir} from 'node:os';import {join} from 'node:path';
import {createProjectMiddleware} from '../server/local.ts';
async function listen(s:Server){await new Promise<void>(r=>s.listen(0,'127.0.0.1',r));return `http://127.0.0.1:${(s.address() as {port:number}).port}`;}
async function close(s:Server){s.closeAllConnections();await new Promise<void>(r=>s.close(()=>r()));}
test('STORY-006 AC-02/04 本机HTTP：每轮一张卡片，作答落盘回读仍在，上下文含选择，新卡替代旧未答卡',async()=>{
 let round=0;let lastBody:any;const provider=createServer(async(req,res)=>{const chunks=[];for await(const c of req)chunks.push(c);lastBody=JSON.parse(Buffer.concat(chunks).toString());round++;res.setHeader('Content-Type','application/json');res.end(JSON.stringify({choices:[{finish_reason:'stop',message:{content:JSON.stringify({message:'测试替身第'+round+'轮',question:{domain:'technical_structure',title:'第'+round+'个问题',why:'推进',options:[{label:'单体',detail:'简单'},{label:'微服务',detail:'独立'}]},operations:[]})}}]}));});
 const root=await mkdtemp(join(tmpdir(),'archsketch-cards-'));const middleware=createProjectMiddleware(root,{baseUrl:await listen(provider),model:'test-fixture',apiKey:'fixture-secret',provider:'deepseek'});const app=createServer((req,res)=>middleware(req,res,()=>{res.statusCode=404;res.end();}));const base=await listen(app);
 const post=async(path:string,body:unknown)=>{const r=await fetch(base+path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});return {status:r.status,body:await r.json()};};
 try{let p=(await post('/api/projects',{projectId:'p',title:'p',requestId:'create'})).body.project;
  const guide=async(requestId:string)=>{const r=await post('/api/projects/p/ai/guide',{requestId,baseHeadRevisionId:p.headRevisionId,baseInputVersion:p.inputVersion,prompt:'继续'});assert.equal(r.status,200);p=r.body.project;};
  await guide('g1');assert.equal(p.questions?.length,1);assert.equal(p.questions[0].status,'open');assert.equal(p.questions[0].title,'第1个问题');
  let r=await post('/api/projects/p/commands',{requestId:'a1',expectedWriteVersion:p.writeVersion,command:{type:'answer_question',questionId:p.questions[0].id,optionIds:['o2'],note:'团队较大'}});assert.equal(r.status,200);p=r.body.project;
  await guide('g2');assert.ok(lastBody.messages[1].content.includes('团队较大'));assert.ok(JSON.parse(lastBody.messages[1].content).answers.some((a:any)=>a.chosen.includes('微服务')));assert.equal(p.questions.length,2);
  await guide('g3');assert.deepEqual(p.questions.map((q:any)=>q.status),['answered','skipped','open']);
  const read=(await(await fetch(base+'/api/projects/p')).json()).project;assert.deepEqual(read.questions[0].answer.optionIds,['o2']);
  r=await post('/api/projects/p/commands',{requestId:'bad',expectedWriteVersion:read.writeVersion,command:{type:'answer_question',questionId:read.questions[2].id,optionIds:['o1','o2'],note:''}});assert.equal(r.status,400);
 }finally{await close(app);await close(provider);await rm(root,{recursive:true,force:true});}
});
