import test from 'node:test';import assert from 'node:assert/strict';
import {procurementDesign} from '../src/layers.ts';
import {acceptProblems,acceptDecision,supersedeDecision} from '../src/decisions.ts';
import {createProject,executeCommand,head,applyOperations} from '../src/project.ts';
import {toAdr} from '../src/adr.ts';
import {aduStatus} from '../src/adu.ts';

test('STORY-024 AC-01：不满足条件时列出缺项，不能接受',()=>{
 const d=procurementDesign();const probs=acceptProblems(d,'dec-workflow');assert.ok(probs.some(p=>/选择/.test(p)));assert.ok(probs.some(p=>/理由/.test(p)));assert.ok(probs.some(p=>/取舍|代价/.test(p)));
 assert.throws(()=>acceptDecision(d,'dec-workflow'),/选择/);
 const one=structuredClone(d);const dec=one.decisions[0];dec.candidates=[dec.candidates[0]];dec.selectedId=dec.candidates[0].id;dec.reason='复用';dec.tradeoff='定制受限';assert.ok(acceptProblems(one,'dec-workflow').some(p=>/两个|豁免/.test(p)));
 dec.waiver='只有一个可行平台';assert.deepEqual(acceptProblems(one,'dec-workflow'),[]);
 const noAffected=structuredClone(one);noAffected.decisions[0].affectedIds=[];assert.ok(acceptProblems(noAffected,'dec-workflow').some(p=>/影响/.test(p)));
});
function accepted(){const d=procurementDesign();const dec=d.decisions[0];dec.selectedId='reuse';dec.reason='已有平台与运维';dec.tradeoff='多组织规则需定制';return acceptDecision(d,'dec-workflow');}
test('STORY-024 AC-02：已接受决策不能原地修改，只能取代',()=>{
 const d=accepted();assert.equal(d.decisions[0].status,'accepted');assert.equal(aduStatus(d,'L3').find(s=>s.id==='decision')!.state,'done');
 let p=createProject('p','p',d);const e=structuredClone(head(p));e.decisions[0].reason='改理由';assert.throws(()=>executeCommand(p,{type:'edit_design',design:e}),/已接受/);
 assert.doesNotThrow(()=>executeCommand(p,{type:'edit_design',design:applyOperations(head(p),[{type:'remove_node',id:'app-workflow'}])}),'删除元素导致影响对象收缩是允许的');
 const {design:s,newId}=supersedeDecision(head(p),'dec-workflow');assert.ok(newId);const old=s.decisions.find(x=>x.id==='dec-workflow')!,nw=s.decisions.find(x=>x.id===newId)!;
 assert.equal(old.status,'superseded');assert.equal(old.supersededBy,newId);assert.equal(nw.status,'proposed');assert.equal(nw.supersedes,'dec-workflow');assert.equal(nw.selectedId,undefined);
 p=executeCommand(p,{type:'edit_design',design:s});assert.equal(head(p).decisions.length,2);
 const again=structuredClone(head(p));again.decisions.find(x=>x.id==='dec-workflow')!.title='偷改';assert.throws(()=>executeCommand(p,{type:'edit_design',design:again}),/已取代|已接受/);
});
test('STORY-024 AC-03：ADR 体现状态与取代链',()=>{
 const d=accepted();assert.match(toAdr(d,'dec-workflow'),/accepted/);const {design:s,newId}=supersedeDecision(d,'dec-workflow');
 assert.match(toAdr(s,'dec-workflow'),/superseded/);assert.match(toAdr(s,'dec-workflow'),new RegExp('取代'));assert.match(toAdr(s,newId),/proposed/);assert.match(toAdr(s,newId),/取代/);
});
