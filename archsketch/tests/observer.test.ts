import test from 'node:test';import assert from 'node:assert/strict';
import {createServer,type Server} from 'node:http';import {mkdtemp,rm} from 'node:fs/promises';import {tmpdir} from 'node:os';import {join} from 'node:path';
import {newDesign,type Design} from '../src/design.ts';
import {head} from '../src/project.ts';
import {ruleInsights} from '../src/insights.ts';
import {ProjectStore} from '../server/projects.ts';
import {InsightStore} from '../server/insights.ts';
import {createProjectMiddleware} from '../server/local.ts';

const withCap=(d:Design,extra:Partial<Design>={})=>{const x=structuredClone(d);x.nodes.push({id:'cap1',name:'采购审批',level:'capability',role:'capability',technology:'',description:'',sourceIds:[]});{const v=x.views.find(v=>v.id==='capabilities')!;v.nodeIds.push('cap1');v.positions.cap1={x:0,y:0};}return {...x,...extra};};
const withApp=(d:Design)=>{const x=structuredClone(d);x.nodes.push({id:'app1',name:'审批平台',level:'application',role:'business_app',technology:'',description:'',sourceIds:[]});{const v=x.views.find(v=>v.level==='application')!;v.nodeIds.push('app1');v.positions.app1={x:0,y:0};}x.relationships.push({id:'r1',source:'cap1',target:'app1',type:'realizedBy',label:''});return x;};

test('STORY-027 AC-01：规则只报这次变化新引入与新解决的问题，并指向对象',()=>{
 const d0=newDesign('t');const d1=withCap(d0);const d2=withApp(d1);
 const a=ruleInsights(d0,d1);const np=a.find(i=>i.kind==='new_problem'&&i.objectIds.includes('cap1'));assert.ok(np,'新增能力缺 realizedBy');assert.equal(np!.severity,'error');
 assert.ok(!ruleInsights(d1,d1).length,'无变化不产生见解');
 const b=ruleInsights(d1,d2);assert.ok(b.some(i=>i.kind==='resolved_problem'&&i.objectIds.includes('cap1')));assert.ok(!b.some(i=>i.kind==='new_problem'&&i.objectIds.includes('cap1')),'已有问题不重复报');
});
test('STORY-027 AC-02/03/05：稳定后才观察、合并、可静音与关闭，不改项目写入版本',async()=>{
 const root=await mkdtemp(join(tmpdir(),'as-obs-'));try{const s=new ProjectStore(root);const ins=new InsightStore(s,3000);let p=await s.create('p','p','c');
  let f=await ins.observe('p');assert.equal(f.lastRevisionId,p.headRevisionId);assert.equal(f.items.length,0,'不回溯历史');
  p=await s.commit('p',{requestId:'e1',expectedWriteVersion:p.writeVersion,command:{type:'edit_design',design:withCap(head(p))}});
  f=await ins.observe('p',Date.now());assert.equal(f.items.length,0,'未稳定');
  const later=Date.parse(p.revisions.at(-1)!.createdAt)+3500;f=await ins.observe('p',later);assert.ok(f.items.some(i=>i.kind==='new_problem'));assert.equal(f.lastRevisionId,p.headRevisionId);
  const n=f.items.length;f=await ins.observe('p',later+10000);assert.equal(f.items.length,n,'无新变化不重复');
  assert.equal((await s.read('p')).writeVersion,p.writeVersion,'不改写入版本');
  f=await ins.setStatus('p',f.items[0].id,'dismissed');assert.equal(f.items[0].status,'dismissed');
  f=await ins.setPrefs('p',{mute:'resolved_problem'});assert.deepEqual(f.prefs.muted,['resolved_problem']);
  p=await s.commit('p',{requestId:'e2',expectedWriteVersion:p.writeVersion,command:{type:'edit_design',design:withApp(head(p))}});
  f=await ins.observe('p',Date.parse(p.revisions.at(-1)!.createdAt)+3500);assert.ok(!f.items.some(i=>i.kind==='resolved_problem'),'静音');
  f=await ins.setPrefs('p',{off:true});const before=f.items.length;
  p=await s.commit('p',{requestId:'e3',expectedWriteVersion:p.writeVersion,command:{type:'edit_design',design:withCap({...head(p),nodes:head(p).nodes.filter(x=>x.id!=='cap1'),relationships:[],views:head(p).views.map(v=>({...v,nodeIds:v.nodeIds.filter(id=>id!=='cap1'),positions:Object.fromEntries(Object.entries(v.positions).filter(([k])=>k!=='cap1'))}))})}});
  f=await ins.observe('p',Date.parse(p.revisions.at(-1)!.createdAt)+3500);assert.equal(f.items.length,before,'关闭后不产生');assert.equal(f.lastRevisionId,p.headRevisionId);
 }finally{await rm(root,{recursive:true,force:true});}
});
test('STORY-027 AC-04：请 AI 点评只在点击时调用，最多 3 条，丢弃无依据见解，附带变更成为待审建议',async()=>{
 let calls=0;const provider:Server=createServer(async(req,res)=>{for await(const _ of req){}calls++;res.setHeader('Content-Type','application/json');res.end(JSON.stringify({choices:[{finish_reason:'stop',message:{content:JSON.stringify({summary:'新增能力尚无承载系统',insights:[{title:'能力缺少承载',detail:'建议指定应用',objectIds:['cap1']},{title:'无依据',detail:'x',objectIds:['ghost']},{title:'b',detail:'',objectIds:['cap1']},{title:'c',detail:'',objectIds:['cap1']},{title:'d',detail:'',objectIds:['cap1']}],diagram:null,operations:[{type:'set_risk',risk:{id:'obs-r1',text:'采购审批缺少承载系统',objectIds:['cap1']}}]})}}]}));});
 await new Promise<void>(r=>provider.listen(0,'127.0.0.1',r));const root=await mkdtemp(join(tmpdir(),'as-obs-ai-'));
 const mw=createProjectMiddleware(root,{baseUrl:`http://127.0.0.1:${(provider.address() as {port:number}).port}`,model:'t',apiKey:'fixture-secret',provider:'deepseek'},{settleMs:0});const app:Server=createServer((req,res)=>mw(req,res,()=>{res.statusCode=404;res.end();}));await new Promise<void>(r=>app.listen(0,'127.0.0.1',r));const base=`http://127.0.0.1:${(app.address() as {port:number}).port}`;
 const call=async(path:string,body?:unknown)=>{const r=await fetch(base+path,body===undefined?{}:{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});return {status:r.status,body:await r.json()};};
 try{let p=(await call('/api/projects',{projectId:'p',title:'p',requestId:'c'})).body.project;await call('/api/projects/p/insights');
  p=(await call('/api/projects/p/commands',{requestId:'e',expectedWriteVersion:p.writeVersion,command:{type:'edit_design',design:withCap(p.revisions[0].snapshot)}})).body.project;
  let f=(await call('/api/projects/p/insights')).body.insights;assert.ok(f.items.length>0);assert.equal(calls,0,'观察不调用模型');
  const r=await call('/api/projects/p/insights/ai',{requestId:'a1',baseHeadRevisionId:p.headRevisionId,baseInputVersion:p.inputVersion});assert.equal(r.status,200);assert.equal(calls,1);
  const ai=r.body.insights.items.filter((i:any)=>i.source==='ai');assert.ok(ai.length>=1&&ai.length<=3);assert.ok(ai.every((i:any)=>!i.objectIds.includes('ghost')));
  const prop=r.body.project.proposals.at(-1);assert.equal(prop.status,'pending');assert.ok(ai.some((i:any)=>i.proposalId===prop.id));assert.equal(r.body.project.headRevisionId,p.headRevisionId,'不直接改设计');
 }finally{app.closeAllConnections();await new Promise<void>(r=>app.close(()=>r()));provider.closeAllConnections();await new Promise<void>(r=>provider.close(()=>r()));await rm(root,{recursive:true,force:true});}
});
