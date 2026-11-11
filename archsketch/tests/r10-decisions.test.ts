import test from 'node:test';import assert from 'node:assert/strict';
import {orderDesign,validateDesign} from '../src/design.ts';
import {procurementDesign} from '../src/layers.ts';
import {acceptDecision,supersedeDecision,decisionState} from '../src/decisions.ts';
import {createProject,executeCommand,head} from '../src/project.ts';
import {toAdr,designDocument} from '../src/adr.ts';
import {aduStatus} from '../src/adu.ts';

// F-01 复现：选择候选、填写取舍，但不点“接受决策”
function chosenNotAccepted(){const d=orderDesign();const dec=d.decisions[0];dec.selectedId='monolith';dec.reason='团队 10 人';dec.tradeoff='放弃独立扩展';return d;}

test('STORY-031 AC-01：已选未接受的决策在 ADR 与说明书中为 proposed，不出现 accepted',()=>{
 const d=chosenNotAccepted();const adr=toAdr(d,'dec-style');
 assert.doesNotMatch(adr,/accepted/);assert.match(adr,/proposed（已选择：模块化单体，待接受）/);
 const doc=designDocument(createProject('p','p',d));assert.doesNotMatch(doc,/accepted/);assert.match(doc,/ADR-001 模块化单体还是微服务：提议中（已选择 模块化单体，待接受）/);
});
test('STORY-031 AC-02：四态在界面状态函数、ADR、说明书一致；只有接受操作产生 accepted',()=>{
 const none=orderDesign();assert.equal(decisionState(none.decisions[0]),'unselected');assert.match(toAdr(none,'dec-style'),/proposed（尚未选择方案）/);
 const chosen=chosenNotAccepted();assert.equal(decisionState(chosen.decisions[0]),'selected');
 const p=procurementDesign();const dec=p.decisions[0];dec.selectedId='reuse';dec.reason='已有平台';dec.tradeoff='定制受限';
 const acc=acceptDecision(p,'dec-workflow',{confirmedBy:'张工'});assert.equal(decisionState(acc.decisions[0]),'accepted');
 const doc=designDocument(createProject('p','p',acc));assert.match(doc,/已接受（已选择 /);
 const {design:s}=supersedeDecision(acc,'dec-workflow');assert.equal(decisionState(s.decisions[0]),'superseded');assert.match(designDocument(createProject('p','p',s)),/已取代/);
 // 设计完成度：已选未接受不算已决策
 assert.notEqual(aduStatus(chosen,'L3').find(x=>x.id==='decision')?.state,'done');
});
test('STORY-031 AC-03：确认人、接受时间与验证要求被记录并导出，接受后不可原地修改',()=>{
 const p=procurementDesign();const dec=p.decisions[0];dec.selectedId='reuse';dec.reason='已有平台';dec.tradeoff='定制受限';dec.verification='上线前压测审批流 200 并发';
 const acc=acceptDecision(p,'dec-workflow',{confirmedBy:'张工'});const a=acc.decisions[0];
 assert.equal(a.confirmedBy,'张工');assert.ok(a.acceptedAt&&!Number.isNaN(Date.parse(a.acceptedAt)));
 const adr=toAdr(acc,'dec-workflow');assert.match(adr,/确认人：张工/);assert.match(adr,/验证要求：上线前压测审批流 200 并发/);
 const proj=createProject('p','p',acc);const e=structuredClone(head(proj));e.decisions[0].confirmedBy='李工';assert.throws(()=>executeCommand(proj,{type:'edit_design',design:e}),/已接受/);
 assert.throws(()=>validateDesign({...acc,decisions:[{...a,confirmedBy:'x'.repeat(200)}]}));
});
test('STORY-031 AC-04：旧项目文件（无新字段、无状态但已选）可打开并视为提议中',()=>{
 const d=chosenNotAccepted();const old=JSON.parse(JSON.stringify(d));delete old.decisions[0].status;
 const ok=validateDesign(old);assert.equal(decisionState(ok.decisions[0]),'selected');assert.match(toAdr(ok,'dec-style'),/proposed/);
});
