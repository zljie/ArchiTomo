import test from 'node:test';import assert from 'node:assert/strict';
import {orderDesign} from '../src/design.ts';
import {createProject,executeCommand,head} from '../src/project.ts';
import {toAdr,designDocument} from '../src/adr.ts';
test('STORY-017 AC-01：ADR 章节齐全，状态与选择一致，引用名称正确',()=>{
 const d=orderDesign();let md=toAdr(d,'dec-style',1);
 for(const h of ['# ADR-001: 模块化单体还是微服务','## 状态','## 背景与约束','## 决策','## 备选方案与评分','## 后果与代价','## 重评条件','## 关联元素'])assert.ok(md.includes(h),h);
 assert.match(md,/proposed/);assert.match(md,/日订单量/);assert.match(md,/订单服务/);assert.match(md,/待确认/);
 const chosen=structuredClone(d);chosen.decisions[0].selectedId='monolith';chosen.decisions[0].reason='团队 10 人';md=toAdr(chosen,'dec-style',2);assert.match(md,/# ADR-002/);
 // GOAL-001 r10 GSC-26 预期变更：已选未接受为 proposed，不再推断 accepted（F-01）
 assert.doesNotMatch(md,/accepted/);assert.match(md,/proposed（已选择：模块化单体，待接受）/);assert.match(md,/已选择：模块化单体/);
 chosen.risks.push({id:'recheck-dec-style',text:'约束或质量场景变化，决策待重查：x',objectIds:[]});assert.match(toAdr(chosen,'dec-style'),/待重查/);
 const evil=structuredClone(d);evil.decisions[0].title='<script>x</script> # 标题';assert.ok(!toAdr(evil,'dec-style').includes('<script>'));
 assert.throws(()=>toAdr(d,'missing'),/决策不存在/);
});
test('STORY-017 AC-02：设计说明书按四步顺序含约束、拓扑、决策、质量与完成度',()=>{
 const p=createProject('p','订单',orderDesign());const doc=designDocument(p);const order=['## 1. 目标与约束','## 2. 架构拓扑','## 3. 关键决策','## 4. 质量验证','## 5. 设计完成度'].map(h=>doc.indexOf(h));
 assert.ok(order.every(i=>i>=0),'章节缺失');assert.deepEqual([...order].sort((a,b)=>a-b),order);
 assert.match(doc,/日订单量/);assert.match(doc,/单个订单服务实例宕机/);assert.match(doc,/ADR-001/);assert.match(doc,/修订 /);
 assert.equal(designDocument(executeCommand(p,{type:'create_baseline',name:'b',revisionId:p.headRevisionId})).includes(head(p).title),true);
});
