import test from 'node:test';import assert from 'node:assert/strict';
import {createServer,type Server} from 'node:http';import {mkdtemp,rm} from 'node:fs/promises';import {tmpdir} from 'node:os';import {join} from 'node:path';
import {createProject,executeCommand,parseProject,type Project,type Question} from '../src/project.ts';
import {ProjectStore} from '../server/projects.ts';
import {requestGuide} from '../server/guide.ts';
import {roundState} from '../src/guideRound.ts';
const q=(i:number,round?:number):Question=>({id:'q'+i,source:'ai',domain:'key_scenarios',title:'问题'+i,why:'',options:[{id:'o1',label:'A',detail:''},{id:'o2',label:'B',detail:''}],multi:false,status:'open',answer:null,history:[],proposalId:null,createdAt:new Date().toISOString(),...(round?{round}:{})});
const op=(name:string)=>({type:'set_risk' as const,risk:{id:name,text:name,objectIds:[]}});
const answered=(n:number,round?:number)=>{let p:Project=createProject('p','p');p=executeCommand(p,{type:'set_inputs',source:{id:'s1',name:'描述',content:'x',kind:'text'}});for(let i=0;i<n;i++){p.questions.push(q(i,round));p=executeCommand(p,{type:'answer_question',questionId:'q'+i,optionIds:['o1'],note:''});}return p;};
async function fake(body:()=>Record<string,unknown>){let seen:any=null;const s:Server=createServer(async(req,res)=>{let b='';for await(const c of req)b+=c;seen=JSON.parse(JSON.parse(b).messages[1].content);res.setHeader('Content-Type','application/json');res.end(JSON.stringify({choices:[{finish_reason:'stop',message:{content:JSON.stringify(body())}}]}));});
 await new Promise<void>(r=>s.listen(0,'127.0.0.1',r));return {config:{baseUrl:`http://127.0.0.1:${(s.address() as {port:number}).port}`,model:'t',apiKey:'fixture-secret',provider:'deepseek'},seen:()=>seen,close:async()=>{s.closeAllConnections();await new Promise<void>(r=>s.close(()=>r()));}};}
const ASK={message:'继续',question:{domain:'key_scenarios',title:'再问',why:'',options:[{label:'A'},{label:'B'}]},diagram:null};
const DRAW={message:'本轮结论',question:{domain:'key_scenarios',title:'不该出现',why:'',options:[{label:'A'},{label:'B'}]},diagram:{viewId:'technical',code:'网关 [type: gateway]\n服务 [type: service]\n网关 > 服务'}};

test('BUG-003：新草图到达时，之前未处理的草图标记为已过期，只保留最新一份',async()=>{
 const root=await mkdtemp(join(tmpdir(),'as-conv-'));try{const s=new ProjectStore(root);let p=await s.create('p','p','c');
  p=await s.appendGuide('p',p.headRevisionId,p.inputVersion,'r1','第一版',[op('a')],'h1');p=await s.appendGuide('p',p.headRevisionId,p.inputVersion,'r2','第二版',[op('b')],'h2');
  assert.deepEqual(p.proposals.map(x=>x.status),['stale','pending']);
 }finally{await rm(root,{recursive:true,force:true});}
});
test('BUG-003 轮次：发散阶段把轮次、焦点、框架与已问问题交给 AI，问题带轮次',async()=>{
 const f=await fake(()=>ASK);try{const p=answered(2,1);const r=await requestGuide(f.config,p,'继续',new AbortController().signal);
  const round=f.seen().round;assert.equal(round.phase,'diverge');assert.equal(round.index,1);assert.equal(round.answered,2);assert.equal(round.size,5);assert.equal(round.asked.length,2);assert.ok(round.focus&&round.dimensions.length>=5);
  assert.equal(r.question!.round,1);assert.deepEqual(r.round,{index:1,size:5,converged:false});
 }finally{await f.close();}
});
test('BUG-003 轮次：答满本轮题数后收敛，不再提问并给出草图；旧项目未标轮次的问题计入第 1 轮',async()=>{
 const f=await fake(()=>DRAW);try{const p=answered(65);assert.equal(roundState(p).phase,'converge');
  const r=await requestGuide(f.config,p,'继续',new AbortController().signal);assert.equal(r.question,null);assert.ok(r.operations.some(o=>o.type==='set_node'));assert.deepEqual(r.round,{index:1,size:5,converged:true});assert.equal(f.seen().round.phase,'converge');
 }finally{await f.close();}
});
test('BUG-003 轮次：10 题一轮；可随时要求收敛；收敛后下一次请求开启新一轮',async()=>{
 const f=await fake(()=>ASK);try{let p=answered(6,1);assert.equal(roundState(p,10).phase,'diverge');assert.equal(roundState(p,10,true).phase,'converge');
  p.guideRound={index:1,size:5,converged:true};p=parseProject(p);const s=roundState(p);assert.equal(s.index,2);assert.equal(s.answered,0);assert.equal(s.phase,'diverge');
  const r=await requestGuide(f.config,p,'开始下一轮',new AbortController().signal);assert.equal(r.question!.round,2);
  const raw=JSON.parse(JSON.stringify(createProject('o','旧')));assert.equal(parseProject(raw).guideRound,undefined);assert.throws(()=>parseProject({...raw,guideRound:{index:0,size:7,converged:false}}));
 }finally{await f.close();}
});
