import test from 'node:test';import assert from 'node:assert/strict';
import {createServer,type Server} from 'node:http';
import {createProject,executeCommand,parseProject,type Project} from '../src/project.ts';
import {effectiveLevel} from '../src/levels.ts';
import {roundState} from '../src/guideRound.ts';
import {requestGuide} from '../server/guide.ts';
async function fake(body:()=>Record<string,unknown>){let seen:any=null;let system='';const s:Server=createServer(async(req,res)=>{let b='';for await(const c of req)b+=c;const m=JSON.parse(b).messages;system=m[0].content;seen=JSON.parse(m[1].content);res.setHeader('Content-Type','application/json');res.end(JSON.stringify({choices:[{finish_reason:'stop',message:{content:JSON.stringify(body())}}]}));});
 await new Promise<void>(r=>s.listen(0,'127.0.0.1',r));return {config:{baseUrl:`http://127.0.0.1:${(s.address() as {port:number}).port}`,model:'t',apiKey:'fixture-secret',provider:'deepseek'},seen:()=>seen,system:()=>system,close:async()=>{s.closeAllConnections();await new Promise<void>(r=>s.close(()=>r()));}};}
const base=(level?:string)=>{let p:Project=createProject('p','p');p=executeCommand(p,{type:'set_inputs',source:{id:'s1',name:'描述',content:'x',kind:'text'}});if(level)p=executeCommand(p,{type:'set_profile_level',level} as any);return p;};
const Q=(domain:string,extra:Record<string,unknown>={})=>({message:'ok',question:{domain,title:'问一个',why:'',options:[{label:'A',detail:'',...(extra.bundle?{bundle:['单体','云数据库']}:{})},{label:'B',detail:''}],...extra},diagram:null});

test('STORY-028 AC-01：水平保存、可切换、旧项目按程序员、非法拒绝',()=>{
 let p=base();assert.equal(p.profileLevel,undefined);assert.equal(effectiveLevel(p),'programmer');
 p=executeCommand(p,{type:'set_profile_level',level:'beginner'} as any);assert.equal(effectiveLevel(p),'beginner');
 p=executeCommand(p,{type:'set_profile_level',level:'architect'} as any);assert.equal(parseProject(JSON.parse(JSON.stringify(p))).profileLevel,'architect');
 assert.throws(()=>executeCommand(p,{type:'set_profile_level',level:'guru'} as any));assert.throws(()=>parseProject({...JSON.parse(JSON.stringify(p)),profileLevel:'guru'}));
});
test('STORY-028 AC-02：程序员跳过基础问题，首轮从应用架构开始，上下文带水平规则',async()=>{
 assert.match(roundState(base('programmer')).focus,/^应用架构/);assert.match(roundState(base('beginner')).focus,/^目标与业务/);
 const f=await fake(()=>Q('goals_constraints'));try{const r=await requestGuide(f.config,base('programmer'),'继续',new AbortController().signal);assert.equal(r.question,null,'基础域问题被丢弃');assert.equal(f.seen().level.id,'programmer');assert.ok(f.seen().level.rules.length>10);
 }finally{await f.close();}
 const g=await fake(()=>Q('technical_structure'));try{const r=await requestGuide(g.config,base('programmer'),'继续',new AbortController().signal);assert.ok(r.question);}finally{await g.close();}
});
test('STORY-028 AC-03：架构师级别不主动出题（矛盾除外），也不自动收敛',async()=>{
 const p=base('architect');for(let i=0;i<6;i++){p.questions.push({id:'q'+i,source:'ai',domain:'technical_structure',title:'t'+i,why:'',options:[{id:'o1',label:'A',detail:''},{id:'o2',label:'B',detail:''}],multi:false,status:'answered',answer:{optionIds:['o1'],note:'',answeredAt:new Date().toISOString()},history:[],proposalId:null,createdAt:new Date().toISOString()});}
 assert.equal(roundState(p).phase,'diverge');
 let body=Q('technical_structure');const f=await fake(()=>body);try{let r=await requestGuide(f.config,p,'帮我加一个缓存',new AbortController().signal);assert.equal(r.question,null);
  body=Q('technical_structure',{conflict:true});r=await requestGuide(f.config,p,'继续',new AbortController().signal);assert.ok(r.question,'矛盾问题保留');assert.match(f.system()+JSON.stringify(f.seen().level),/副驾驶/);
 }finally{await f.close();}
});
test('STORY-028 AC-04：小白级别选项可带套餐内容',async()=>{
 const f=await fake(()=>Q('technical_structure',{bundle:true}));try{const r=await requestGuide(f.config,base('beginner'),'继续',new AbortController().signal);assert.deepEqual(r.question!.options[0].bundle,['单体','云数据库']);assert.match(JSON.stringify(f.seen().level),/套餐/);
 }finally{await f.close();}
});
