import test from 'node:test';import assert from 'node:assert/strict';
import {newDesign,validateDesign,LEVEL_ROLES} from '../src/design.ts';
import {STARTERS,applyStarter} from '../src/starters.ts';
import {toCode,parseCode} from '../src/dsl.ts';

test('STORY-009 AC-01/02：参考架构模板解析为合法设计，只写技术视图',()=>{
 for(const id of ['web-three-tier','microservices-queue','event-pipeline'])assert.ok(STARTERS.some(s=>s.id===id),id);// STORY-014 扩充模板库后，原三模板仍须存在
 for(const s of STARTERS){
  assert.ok(s.name.trim()&&s.description.trim());const before=newDesign();const d=applyStarter(before,s.id);assert.doesNotThrow(()=>validateDesign(d));
  const v=d.views.find(v=>v.id==='technical')!;assert.ok(v.nodeIds.length>=4,s.id);assert.ok(d.boundaries.length>=1,s.id);assert.ok(d.relationships.length>=3,s.id);
  for(const n of d.nodes){assert.equal(n.level,'technical');assert.ok(LEVEL_ROLES.technical.includes(n.role));}
  for(const other of d.views.filter(v=>v.id!=='technical'))assert.deepEqual(other.nodeIds,[]);
  assert.deepEqual(parseCode(d,v,toCode(d,v)).summary,{added:0,updated:0,removed:0,groups:0,relations:0});
 }
 assert.throws(()=>applyStarter(newDesign(),'missing'));
});
