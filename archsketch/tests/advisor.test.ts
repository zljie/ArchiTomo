import test from 'node:test';import assert from 'node:assert/strict';
import {orderDesign,validateDesign,newDesign,type Decision} from '../src/design.ts';
import {PLAYBOOKS,recommend,toDecision,sensitivity} from '../src/advisor.ts';
import {rankDecision} from '../src/reasoning.ts';

test('STORY-019 AC-01：架构风格手册按约束给出确定评分、理由与依据（含确认状态）',()=>{
 assert.deepEqual(PLAYBOOKS.map(p=>p.id),['architecture-style','data-consistency','deployment-model']);
 const d=orderDesign();const before=JSON.stringify(d);const r=recommend(d,'architecture-style');assert.equal(JSON.stringify(d),before,'不修改设计');
 assert.deepEqual(r.candidates.map(c=>c.id),['monolith','modular-monolith','microservices']);
 assert.deepEqual(recommend(d,'architecture-style'),r,'确定性');
 assert.ok(r.basis.some(b=>b.name==='研发团队'&&b.status==='unconfirmed'));for(const c of r.candidates)assert.ok(c.reasons.length>0&&c.reasons.some(x=>/待确认/.test(x)));
 const dec=toDecision(r);const ranked=rankDecision(dec);assert.equal(ranked.eligible[0]?.candidate.id,'modular-monolith','10 人团队 + 私有化 → 模块化单体领先');
 assert.ok(r.missing.length>=0);
});
test('STORY-019 AC-01：缺少约束时相关维度为 null 并列为缺口',()=>{
 const d=newDesign();const r=recommend(d,'architecture-style');assert.ok(r.missing.length>=2);assert.ok(r.candidates.every(c=>Object.values(c.scores).some(v=>v===null)));
 assert.throws(()=>recommend(d,'nope'),/手册不存在/);
});
test('STORY-019 AC-02：决策草案无已选方案，可加入设计，约束不变',()=>{
 const d=orderDesign();const dec=toDecision(recommend(d,'data-consistency'));assert.equal(dec.selectedId,undefined);assert.match(dec.reason,/规则推荐/);
 const next=structuredClone(d);next.decisions.push(dec);assert.doesNotThrow(()=>validateDesign(next));assert.deepEqual(next.constraints,d.constraints);
 assert.equal(Math.round(dec.dimensions.reduce((s,x)=>s+x.weight,0)),100);
});
test('STORY-019 AC-03：敏感性给出翻转权重与新第一名',()=>{
 const dec:Decision={id:'x',title:'t',dimensions:[{id:'a',name:'A',weight:60},{id:'b',name:'B',weight:40}],candidates:[{id:'p',name:'P',benefits:'',costs:'',rationale:'',violations:[],scores:{a:5,b:1}},{id:'q',name:'Q',benefits:'',costs:'',rationale:'',violations:[],scores:{a:1,b:5}}],reason:'',tradeoff:'',reconsiderWhen:'',affectedIds:[]};
 const s=sensitivity(dec);assert.equal(s.leader,'P');const a=s.rows.find(r=>r.dimensionId==='a')!;assert.equal(a.newLeader,'Q');assert.ok(a.flipAt!==null&&a.flipAt<60&&a.flipAt>=45&&a.flipAt<=50,'A 权重降到约 50% 以下时翻转：'+a.flipAt);
 const b=s.rows.find(r=>r.dimensionId==='b')!;assert.ok(b.flipAt!==null&&b.flipAt>40&&b.flipAt<=55);
 const solid:Decision={...dec,candidates:[{...dec.candidates[0],scores:{a:5,b:5}},{...dec.candidates[1],scores:{a:1,b:1}}]};assert.ok(sensitivity(solid).rows.every(r=>r.flipAt===null));
 const incomplete:Decision={...dec,candidates:[{...dec.candidates[0],scores:{a:null,b:1}},dec.candidates[1]]};assert.match(sensitivity(incomplete).note,/评分/);
});
