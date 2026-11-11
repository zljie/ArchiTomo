import test from 'node:test';import assert from 'node:assert/strict';
import {newDesign,validateDesign,LEVEL_ROLES} from '../src/design.ts';
import {STARTERS,PATTERNS,CATEGORIES,applyStarter,applyPattern} from '../src/starters.ts';
import {toCode,parseCode} from '../src/dsl.ts';

test('STORY-014 AC-01：完整模板≥7个，均有类别与描述，解析合法且往返稳定',()=>{
 assert.ok(STARTERS.length>=7);for(const id of ['web-three-tier','microservices-queue','event-pipeline'])assert.ok(STARTERS.some(s=>s.id===id),id);
 for(const s of STARTERS){assert.ok(s.category&&CATEGORIES.includes(s.category),s.id+' 类别');assert.ok(s.description.trim()&&s.tags?.length,s.id);
  const d=applyStarter(newDesign(),s.id);const v=d.views.find(v=>v.id==='technical')!;assert.ok(v.nodeIds.length>=4,s.id);for(const n of d.nodes)assert.ok(LEVEL_ROLES.technical.includes(n.role),s.id+' '+n.role);
  assert.deepEqual(parseCode(d,v,toCode(d,v)).summary,{added:0,updated:0,removed:0,groups:0,relations:0},s.id);}
});
test('STORY-014 AC-02：模式插入保留原节点、连到选中节点、重复插入不重复',()=>{
 assert.ok(PATTERNS.length>=8);for(const id of ['cache-aside','read-replica','queue-decouple','gateway-auth'])assert.ok(PATTERNS.some(p=>p.id===id),id);
 const d=applyStarter(newDesign(),'web-three-tier');const app=d.nodes.find(n=>n.role==='application')!;const before=d.nodes.map(n=>n.id);
 const once=applyPattern(d,'technical','queue-decouple',app.id);for(const id of before)assert.ok(once.nodes.some(n=>n.id===id),'原节点保留 '+id);
 const added=once.nodes.filter(n=>!before.includes(n.id));assert.ok(added.some(n=>n.role==='queue'));assert.ok(once.relationships.some(r=>r.source===app.id&&added.some(n=>n.id===r.target)),'连到选中节点');
 const twice=applyPattern(once,'technical','queue-decouple',app.id);assert.equal(twice.nodes.length,once.nodes.length);
 for(const p of PATTERNS){assert.ok(p.description.trim());const r=applyPattern(d,'technical',p.id,app.id);assert.doesNotThrow(()=>validateDesign(r));for(const id of before)assert.ok(r.nodes.some(n=>n.id===id),p.id);const empty=applyPattern(newDesign(),'technical',p.id);assert.ok(empty.nodes.length>=2,p.id+' 应新增节点');}// 修正：同名节点被复用是预期行为（如 Web 三层已含 Redis 缓存），新增节点断言改在空设计上
 const free=applyPattern(newDesign(),'technical','cache-aside');assert.ok(free.nodes.length>=2,'未选中时保留占位节点');
});
test('STORY-014：非技术层级或不存在的模式被拒绝',()=>{assert.throws(()=>applyPattern(newDesign(),'context','cache-aside'),/技术容器/);assert.throws(()=>applyPattern(newDesign(),'technical','missing'),/不存在/);});
