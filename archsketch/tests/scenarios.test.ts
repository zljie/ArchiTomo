import test from 'node:test';import assert from 'node:assert/strict';
import {newDesign,validateDesign,type Design} from '../src/design.ts';
import {createProject,executeCommand,head,applyOperations} from '../src/project.ts';
const base=()=>{let d=newDesign('场景');d=applyOperations(d,[{type:'set_node',node:{id:'api',name:'API',level:'technical',role:'service',technology:'',description:'x',sourceIds:[]}}]);
 d.decisions=[{id:'dec',title:'一致性',dimensions:[],candidates:[],reason:'',tradeoff:'',reconsiderWhen:'',affectedIds:['api']}];
 d.scenarios=[{id:'s1',attribute:'availability',source:'用户',stimulus:'单个实例宕机',environment:'大促高峰',response:'流量切到其他实例',measure:'',verification:'',objectIds:['api'],decisionIds:['dec'],evidenceIds:[]}];
 d.points=[{id:'p1',kind:'tradeoff',text:'副本数：可用性↑ 成本↑',scenarioIds:['s1'],objectIds:['api'],decisionIds:['dec']},{id:'p2',kind:'sensitivity',text:'连接池大小',scenarioIds:[],objectIds:['api'],decisionIds:[]}];return validateDesign(d);};

test('STORY-012 AC-01：质量场景六要素与四类分析点合法并往返',()=>{const d=base();assert.deepEqual(validateDesign(JSON.parse(JSON.stringify(d))).scenarios,d.scenarios);assert.equal(d.points!.length,2);});
test('STORY-012 AC-03：非法属性/类型/引用被拒绝',()=>{
 const bad=(f:(d:Design)=>void)=>{const d=structuredClone(base());f(d);assert.throws(()=>validateDesign(d));};
 bad(d=>{(d.scenarios![0] as any).attribute='fast';});bad(d=>{(d.points![0] as any).kind='maybe';});bad(d=>{d.points![0].scenarioIds=['nope'];});bad(d=>{d.scenarios![0].evidenceIds=['nope'];});bad(d=>{d.scenarios![0].objectIds=['nope'];});bad(d=>{(d.scenarios![0] as any).stimulus=undefined;});
});
test('删除节点清理场景与分析点引用',()=>{const n=applyOperations(base(),[{type:'remove_node',id:'api'}]);assert.deepEqual(n.scenarios![0].objectIds,[]);assert.deepEqual(n.points![0].objectIds,[]);});
test('STORY-013 AC-01：场景度量变化使关联决策待重查',()=>{let p=createProject('p','p',base());const d=structuredClone(head(p));d.scenarios![0].measure='切换 < 30 秒';p=executeCommand(p,{type:'edit_design',design:d});assert.ok(head(p).risks.some(r=>r.id==='recheck-dec'));});
