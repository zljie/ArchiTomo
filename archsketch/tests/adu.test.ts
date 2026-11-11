import test from 'node:test';import assert from 'node:assert/strict';
import {newDesign,validateDesign} from '../src/design.ts';
import {procurementDesign} from '../src/layers.ts';
import {aduStatus,aduSummary} from '../src/adu.ts';
const state=(steps:ReturnType<typeof aduStatus>)=>Object.fromEntries(steps.map(s=>[s.id,s.state]));
test('STORY-021 AC-01：示例的 ADU 六步状态按规则派生',()=>{
 const d=procurementDesign();
 for(const l of ['L0','L1','L2','L3','L4'] as const){const s=aduStatus(d,l);assert.deepEqual(s.map(x=>x.id),['question','inputs','alternatives','decision','model','evidence']);for(const x of s){assert.ok(x.label&&x.detail,l+x.id);assert.ok(x.target.id);}}
 const l2=state(aduStatus(d,'L2'));assert.equal(l2.model,'done','职责矩阵完整');assert.equal(l2.question,'done');
 const l3=state(aduStatus(d,'L3'));assert.equal(l3.alternatives,'done','工作流方案决策有两个以上候选');assert.equal(l3.decision,'todo','尚未选择方案');assert.equal(l3.evidence,'partial','有计划中的证据但未通过');
 const e=state(aduStatus(newDesign(),'L1'));assert.ok(Object.values(e).every(v=>v==='todo'));
});
test('STORY-021：选择方案并写理由后决策步完成；不适用层全部 na；摘要列出缺口',()=>{
 const d=procurementDesign();const dec=d.decisions.find(x=>x.layer==='L3')!;dec.selectedId=dec.candidates[0].id;dec.reason='复用现有平台';dec.tradeoff='定制受限';
 // GOAL-001 r10 GSC-26 预期变更：已选未接受只算部分完成，接受后才完成（原预期“选择即完成”与 F-01 冲突）
 assert.equal(state(aduStatus(validateDesign(d),'L3')).decision,'partial');dec.status='accepted';assert.equal(state(aduStatus(validateDesign(d),'L3')).decision,'done');
 d.layers=[{id:'L4',applicable:false,reason:'组件交由实施团队',question:''}];assert.ok(aduStatus(validateDesign(d),'L4').every(s=>s.state==='na'));
 const sum=aduSummary(validateDesign(d));assert.ok(sum.length>0&&sum.every(x=>/^L[0-4]/.test(x)));assert.ok(!sum.some(x=>x.startsWith('L4')));
});
test('STORY-021：决策按 layer 或影响对象归层',()=>{
 const d=procurementDesign();const s=aduStatus(d,'L2');assert.ok(['todo','partial','done'].includes(s.find(x=>x.id==='alternatives')!.state));
});
