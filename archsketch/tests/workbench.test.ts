import test from 'node:test';import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';import {tmpdir} from 'node:os';import {join} from 'node:path';
import {validateDesign,newDesign} from '../src/design.ts';
import {procurementDesign} from '../src/layers.ts';
import {objectTree,NODE_STATUS_NAMES} from '../src/workbench.ts';
import {createProject,executeCommand,head,parseProject} from '../src/project.ts';
import {ProjectStore} from '../server/projects.ts';
import {normalizeChangeSet} from '../server/guide.ts';

test('STORY-029 AC-02：对象树按 L0～L4 → 视图 → 元素组织，带问题计数，可搜索',()=>{
 const d=procurementDesign();const t=objectTree(d);assert.deepEqual(t.map(l=>l.layer),[...new Set(t.map(l=>l.layer))]);assert.ok(t.every(l=>/^L[0-4]$/.test(l.layer)&&l.views.length));
 const all=t.flatMap(l=>l.views.flatMap(v=>v.nodes));assert.ok(all.length>0);assert.ok(all.some(n=>n.issues>0),'Profile 问题计数');
 const name=all[0].name;const f=objectTree(d,name.slice(0,2));assert.ok(f.flatMap(l=>l.views.flatMap(v=>v.nodes)).every(n=>n.name.includes(name.slice(0,2))));
 assert.deepEqual(objectTree(newDesign('空')),[]);
});
test('STORY-029 AC-05：元素状态合法性；接受 AI 提案后新增元素为 ai，已有元素状态不变',()=>{
 assert.deepEqual(Object.keys(NODE_STATUS_NAMES),['draft','ai','review','confirmed']);
 const d=newDesign('t');d.nodes.push({id:'n1',name:'服务',level:'technical',role:'service',technology:'',description:'',sourceIds:[],status:'confirmed'} as any);const v=d.views.find(v=>v.id==='technical')!;v.nodeIds.push('n1');v.positions.n1={x:0,y:0};
 validateDesign(d);assert.throws(()=>validateDesign({...d,nodes:[{...d.nodes[0],status:'weird'}]} as any));
 let p=createProject('p','p',d);p.proposals.push({id:'pr',requestId:'r',baseHeadRevisionId:p.headRevisionId,baseInputVersion:p.inputVersion,status:'pending',summary:'加缓存',operations:[{type:'set_node',node:{id:'n2',name:'缓存',level:'technical',role:'cache',technology:'',description:'',sourceIds:[]}}]} as any);
 p=executeCommand(p,{type:'accept_proposal',proposalId:'pr'});const h=head(p);assert.equal(h.nodes.find(n=>n.id==='n2')!.status,'ai');assert.equal(h.nodes.find(n=>n.id==='n1')!.status,'confirmed');
});
test('STORY-030 AC-01：ChangeSet 字段规范化（缺省为空、限长、限条数）',()=>{
 const c=normalizeChangeSet({rationale:'因为审批超时',impact:['审批工作流','x'.repeat(500),3],tradeoffs:Array.from({length:20},(_,i)=>'t'+i),validation:'不是数组'});
 assert.equal(c.rationale,'因为审批超时');assert.equal(c.impact.length,2);assert.ok(c.impact[1].length<=200);assert.equal(c.tradeoffs.length,8);assert.deepEqual(c.validation,[]);
 assert.deepEqual(normalizeChangeSet(null),{rationale:'',impact:[],tradeoffs:[],validation:[]});
});
test('STORY-030 AC-01～03：提案保存字段、批准记录、撤销仅在未有新修改时允许',async()=>{
 const root=await mkdtemp(join(tmpdir(),'as-cs-'));try{const s=new ProjectStore(root);const d=newDesign('t');let p=await s.create('p','p','c',d);
  const op={type:'set_risk' as const,risk:{id:'r1',text:'审批缺少超时',objectIds:[]}};
  p=await s.appendGuide('p',p.headRevisionId,p.inputVersion,'g1','补审批超时',[op],'h1',null,undefined,{rationale:'超时无人处理',impact:['审批工作流'],tradeoffs:['多一个定时任务'],validation:['超时 24h 自动升级']});
  const prop=p.proposals.at(-1)!;assert.equal(prop.rationale,'超时无人处理');assert.deepEqual(prop.validation,['超时 24h 自动升级']);
  p=await s.commit('p',{requestId:'a',expectedWriteVersion:p.writeVersion,command:{type:'accept_proposal',proposalId:prop.id}});const acc=p.proposals.find(x=>x.id===prop.id)!;assert.equal(acc.approval!.revisionId,p.headRevisionId);assert.ok(acc.approval!.approvedAt);
  const applied=p.headRevisionId;p=await s.commit('p',{requestId:'u',expectedWriteVersion:p.writeVersion,command:{type:'undo_proposal',proposalId:prop.id} as any});
  assert.equal(p.proposals.find(x=>x.id===prop.id)!.status,'reverted');assert.notEqual(p.headRevisionId,applied);assert.equal(p.revisions.at(-1)!.origin,'restore');assert.ok(!head(p).risks.some(r=>r.id==='r1'));
  assert.equal(parseProject(JSON.parse(JSON.stringify(p))).proposals.find(x=>x.id===prop.id)!.status,'reverted');
  let q=createProject('q','q',d);q.proposals.push({id:'pr',requestId:'r',baseHeadRevisionId:q.headRevisionId,baseInputVersion:0,status:'pending',summary:'x',operations:[op]} as any);q=executeCommand(q,{type:'accept_proposal',proposalId:'pr'});q=executeCommand(q,{type:'edit_design',design:{...head(q),title:'之后又改了'}});
  assert.throws(()=>executeCommand(q,{type:'undo_proposal',proposalId:'pr'} as any),/历史/);
 }finally{await rm(root,{recursive:true,force:true});}
});
