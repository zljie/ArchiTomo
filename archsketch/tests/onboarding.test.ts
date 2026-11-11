import test from 'node:test';import assert from 'node:assert/strict';
import {createServer,type Server} from 'node:http';import {mkdtemp,rm} from 'node:fs/promises';import {tmpdir} from 'node:os';import {join} from 'node:path';
import {createProject,executeCommand,head,parseProject,type Project} from '../src/project.ts';
import {normalizeBusiness,technicalPrompt} from '../src/onboarding.ts';
import {createProjectMiddleware} from '../server/local.ts';

const goal=(p:Project)=>executeCommand(p,{type:'onboard_goal',statement:'缩短采购审批周期',metrics:['审批周期 < 2 天','审计可追溯'],constraints:[{kind:'team',name:'研发团队',value:'8',unit:'人'},{kind:'deployment',name:'部署要求',value:'私有化部署',unit:''},{kind:'scale',name:'日审批单量',value:'',unit:'单/日'}]} as any);
const CANDS={capabilities:[{name:'采购申请',description:'提交与预算校验',rationale:'目标涉及申请'},{name:'采购审批',description:'多级审批',rationale:'目标核心'},{name:'',description:'空名称'}],processes:[{name:'采购审批流程',steps:['提交申请','多级审批','生成订单'],rationale:'关键路径'}],concepts:[{name:'采购申请单',description:'申请明细',rationale:'核心对象'}]};

test('STORY-025 AC-02：目标步生成 L0 目标、约束与设计问题，进入业务步',()=>{
 let p=createProject('p','新项目');assert.equal(p.onboarding,undefined);p=goal(p);const d=head(p);
 const g=d.nodes.find(n=>n.level==='goal')!;assert.equal(g.name,'缩短采购审批周期');assert.match(g.description,/审批周期 < 2 天/);assert.ok(d.views.find(v=>v.id==='goals')!.nodeIds.includes(g.id));
 assert.equal(d.constraints!.length,3);assert.equal(d.constraints!.find(c=>c.name==='研发团队')!.status,'confirmed');assert.equal(d.constraints!.find(c=>c.name==='日审批单量')!.status,'unconfirmed');
 assert.equal(d.layers!.find(l=>l.id==='L0')!.question,'缩短采购审批周期');assert.equal(p.onboarding!.status,'business');assert.equal(p.onboarding!.goalId,g.id);
 assert.throws(()=>executeCommand(createProject('q','q'),{type:'onboard_goal',statement:' ',metrics:[],constraints:[]} as any),/目标/);
});
test('STORY-025 TC-P-02：业务候选规范化（分配 ID、丢弃非法、限量）',()=>{
 const c=normalizeBusiness(CANDS);assert.deepEqual(c.map(x=>x.kind),['capability','capability','process','concept']);assert.ok(c.every(x=>x.id&&x.name&&x.rationale!==undefined));
 assert.deepEqual(c.find(x=>x.kind==='process')!.steps,['提交申请','多级审批','生成订单']);assert.equal(new Set(c.map(x=>x.id)).size,c.length);
 assert.deepEqual(normalizeBusiness(null),[]);assert.ok(normalizeBusiness({capabilities:Array.from({length:40},(_,i)=>({name:'能力'+i}))}).length<=15);
});
test('STORY-025 AC-03：勾选确认生成 L1 对象与 motivates 关系，修订来源 ai；未选能力或未知 ID 拒绝',()=>{
 let p=goal(createProject('p','新项目'));const cands=normalizeBusiness(CANDS);p=executeCommand(p,{type:'set_business_candidates',candidates:cands} as any);assert.equal(head(p).nodes.length,1,'保存候选不改设计');
 const pick=cands.filter(c=>c.name!=='采购申请').map(c=>c.id);
 assert.throws(()=>executeCommand(p,{type:'apply_business',selectedIds:[cands.find(c=>c.kind==='concept')!.id]} as any),/能力/);
 assert.throws(()=>executeCommand(p,{type:'apply_business',selectedIds:['nope']} as any),/候选/);
 p=executeCommand(p,{type:'apply_business',selectedIds:pick} as any);const d=head(p);
 assert.equal(p.revisions.at(-1)!.origin,'ai');assert.equal(p.onboarding!.status,'technical');assert.deepEqual(p.onboarding!.selectedIds,pick);
 const cap=d.nodes.find(n=>n.name==='采购审批')!;assert.equal(cap.level,'capability');assert.ok(!d.nodes.some(n=>n.name==='采购申请'));
 assert.ok(d.relationships.some(r=>r.type==='motivates'&&r.source===p.onboarding!.goalId&&r.target===cap.id));
 const steps=d.nodes.filter(n=>n.level==='step');assert.deepEqual(steps.map(s=>s.order),[1,2,3]);assert.equal(d.relationships.filter(r=>r.type==='next').length,2);
 assert.ok(d.nodes.some(n=>n.level==='entity'&&n.name==='采购申请单'));assert.ok(d.views.find(v=>v.id==='capabilities')!.nodeIds.includes(cap.id));
 assert.deepEqual(parseProject(JSON.parse(JSON.stringify(p))).onboarding,p.onboarding,'刷新后状态仍在');
});
test('STORY-025 TC-P-04：技术步提示词含目标、已确认业务能力与约束；完成与跳过',()=>{
 let p=goal(createProject('p','新项目'));const cands=normalizeBusiness(CANDS);p=executeCommand(p,{type:'set_business_candidates',candidates:cands} as any);p=executeCommand(p,{type:'apply_business',selectedIds:cands.map(c=>c.id)} as any);
 const prompt=technicalPrompt(p);for(const s of ['缩短采购审批周期','采购审批','研发团队','私有化部署','diagram'])assert.ok(prompt.includes(s),s);
 p=executeCommand(p,{type:'set_onboarding_status',status:'done'} as any);assert.equal(p.onboarding!.status,'done');
 assert.throws(()=>executeCommand(p,{type:'set_onboarding_status',status:'weird'} as any));
 const raw=JSON.parse(JSON.stringify(createProject('o','旧')));delete raw.onboarding;assert.equal(parseProject(raw).onboarding,undefined);
});
test('STORY-025 TC-P-05：HTTP 业务候选端点保存候选、不改设计',async()=>{
 const provider:Server=createServer(async(req,res)=>{for await(const _ of req){}res.setHeader('Content-Type','application/json');res.end(JSON.stringify({choices:[{finish_reason:'stop',message:{content:JSON.stringify(CANDS)}}]}));});await new Promise<void>(r=>provider.listen(0,'127.0.0.1',r));
 const root=await mkdtemp(join(tmpdir(),'as-onb-'));const mw=createProjectMiddleware(root,{baseUrl:`http://127.0.0.1:${(provider.address() as {port:number}).port}`,model:'t',apiKey:'fixture-secret',provider:'deepseek'});const app:Server=createServer((req,res)=>mw(req,res,()=>{res.statusCode=404;res.end();}));await new Promise<void>(r=>app.listen(0,'127.0.0.1',r));const base=`http://127.0.0.1:${(app.address() as {port:number}).port}`;
 const post=async(path:string,body:unknown)=>{const r=await fetch(base+path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});return {status:r.status,body:await r.json()};};
 try{let p=(await post('/api/projects',{projectId:'p',title:'p',requestId:'c'})).body.project;p=(await post('/api/projects/p/commands',{requestId:'g',expectedWriteVersion:p.writeVersion,command:{type:'onboard_goal',statement:'缩短审批周期',metrics:[],constraints:[]}})).body.project;
  const r=await post('/api/projects/p/ai/business',{requestId:'b1',baseHeadRevisionId:p.headRevisionId,baseInputVersion:p.inputVersion});assert.equal(r.status,200);assert.equal(r.body.project.onboarding.candidates.length,4);assert.equal(r.body.project.headRevisionId,p.headRevisionId);
 }finally{app.closeAllConnections();await new Promise<void>(r=>app.close(()=>r()));provider.closeAllConnections();await new Promise<void>(r=>provider.close(()=>r()));await rm(root,{recursive:true,force:true});}
});
