import test from 'node:test';
import assert from 'node:assert/strict';
import { createProject, executeCommand, head, parseProject, applyOperations } from '../src/project.ts';
import { migrateLegacy, newDesign, validateDesign } from '../src/design.ts';
import { exampleModel } from '../src/model.ts';

test('迁移保留旧组件ID、需求、边界、假设及位置，不改变原文件',()=>{
 const old=exampleModel();const before=JSON.stringify(old);const d=migrateLegacy(old);
 assert.deepEqual(d.nodes.map(n=>n.id),old.elements.map(n=>n.id));
 assert.equal(d.views[0].positions.web.x,old.view.positions.web.x);
 assert.equal(JSON.stringify(old),before);
});
test('编辑/基线/回退保留不可变历史，完整项目可往返',()=>{
 const p=createProject('test','原设计');const d=newDesign('修改后');
 const edited=executeCommand(p,{type:'edit_design',design:d});
 assert.equal(edited.writeVersion,2);assert.equal(head(edited).title,'修改后');
 assert.equal(p.revisions.length,1);assert.equal(edited.revisions.length,2);
 const base=executeCommand(edited,{type:'create_baseline',name:'方案一',revisionId:edited.headRevisionId});
 const restored=executeCommand(base,{type:'restore_revision',revisionId:p.headRevisionId});
 assert.equal(head(restored).title,'原设计');assert.equal(restored.revisions.length,3);
 assert.equal(restored.baselines[0].revisionId,edited.headRevisionId);
 assert.deepEqual(parseProject(JSON.parse(JSON.stringify(restored))),restored);
});
test('无效引用/未知格式不能被解析器静默接受',()=>{
 const d=newDesign();d.relationships=[{id:'bad',source:'missing',target:'also-missing',type:'depends_on',label:''}];
 assert.throws(()=>validateDesign(d));
 assert.throws(()=>parseProject({...createProject('p','p'),formatVersion:99}));
 const p=createProject('p','p');p.headRevisionId='missing';assert.throws(()=>parseProject(p));
});
test('材料变化增加inputVersion但不改设计head，旧建议不能接受',()=>{
 const p=createProject('p','p');const next=executeCommand(p,{type:'set_inputs',source:{id:'s',name:'需求',content:'新需求',kind:'text'}});
 assert.equal(next.inputVersion,1);assert.equal(next.headRevisionId,p.headRevisionId);
 next.proposals.push({id:'prop',requestId:'ai',baseHeadRevisionId:p.headRevisionId,baseInputVersion:0,status:'pending',summary:'旧建议',operations:[]});
 assert.throws(()=>executeCommand(next,{type:'accept_proposal',proposalId:'prop'}),/过期/);
});

test('AI建议不能确认决策或伪造验证通过，不修改原建议对象',()=>{
 const d=newDesign('例子');const decision={id:'choice',title:'方案',dimensions:[],candidates:[{id:'a',name:'A',benefits:'',costs:'',rationale:'',violations:[],scores:{}}],selectedId:'a',reason:'',tradeoff:'',reconsiderWhen:'',affectedIds:[]};
 const operations=[{type:'set_decision' as const,decision}];const next=applyOperations(d,operations);assert.equal(next.decisions[0].selectedId,undefined);assert.equal(decision.selectedId,'a');
 const withEvidence=applyOperations(d,[{type:'set_evidence',evidence:{id:'proof',text:'未经实测',objectIds:[],revisionId:'old',result:'pass'}}]);assert.equal(withEvidence.evidence[0].result,'planned');
});
