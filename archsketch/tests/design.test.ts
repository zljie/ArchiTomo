import test from 'node:test';
import assert from 'node:assert/strict';
import {selfDesign,validateDesign,projection,inspectDesign,drillViews} from '../src/design.ts';

test('自身架构覆盖六类视图，场景分支、数据责任和部署映射有实际语义',()=>{
 const d=selfDesign();assert.deepEqual(new Set(d.views.map(v=>v.perspective)),new Set(['context','functional','application','technical','scenario','data','deployment'])/* GOAL-001 r5 GSC-16 新增 L2 应用视角 */);
 assert.deepEqual(validateDesign(d),d);
 for(const v of d.views){const p=projection(d,v);assert.ok(p.elements.length);assert.equal(p.elements.length,Object.keys(p.view.positions).length);assert.ok(d.nodes.filter(n=>v.nodeIds.includes(n.id)).every(n=>n.level===v.level));}
 assert.ok(d.relationships.some(r=>r.type==='branch'));assert.ok(d.relationships.some(r=>r.type==='failure'));
 assert.ok(d.nodes.some(n=>n.level==='entity'&&n.relatedIds?.length));assert.ok(d.relationships.some(r=>r.type==='deploys'));
});
test('能力下钻只展示关联功能，视角切换不复制实体',()=>{
 const d=selfDesign();const cap=d.nodes.find(n=>n.level==='capability')!;assert.ok(cap);
 const drill=drillViews(d,cap.id);assert.ok(drill.length);assert.ok(drill.every(v=>v.nodeIds.every(id=>d.nodes.find(n=>n.id===id)?.level===v.level)));
 assert.equal(new Set(d.nodes.map(n=>n.id)).size,d.nodes.length);
});
test('全局缺口和同层混杂明确提示，业务不完整仍可保存',()=>{
 const d=selfDesign();assert.equal(d.coverage.length,10);
 assert.ok(inspectDesign(d).some(i=>i.domain));
 const v=d.views.find(v=>v.level==='capability')!;const other=d.nodes.find(n=>n.level==='technical')!;v.nodeIds.push(other.id);v.positions[other.id]={x:0,y:0};
 assert.ok(inspectDesign(d).some(i=>i.viewId===v.id));assert.doesNotThrow(()=>validateDesign(d));
});
