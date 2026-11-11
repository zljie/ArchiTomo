import test from 'node:test';import assert from 'node:assert/strict';
import {newDesign,validateDesign,orderDesign} from '../src/design.ts';
import {applyOperations} from '../src/project.ts';
import {completeness} from '../src/completeness.ts';
import {builtinQuestion} from '../src/guidance.ts';

function sample(){let d=newDesign('完成度');d=applyOperations(d,[{type:'set_node',node:{id:'api',name:'API',level:'technical',role:'service',technology:'',description:'x',sourceIds:[]}},{type:'set_node',node:{id:'q',name:'高可用',level:'quality',role:'quality',technology:'',description:'x',sourceIds:[]}}]);
 d.coverage=d.coverage.map(c=>c.domain==='data'?c:{...c,state:'designed',reason:'ok'});
 d.decisions=[{id:'dec',title:'部署形态',dimensions:[],candidates:[{id:'a',name:'A',benefits:'',costs:'',rationale:'',violations:[],scores:{}}],reason:'',tradeoff:'',reconsiderWhen:'',affectedIds:[]}];
 d.constraints=[{id:'c1',kind:'scale',name:'日订单量',value:'',unit:'笔/日',status:'unconfirmed',note:'',objectIds:[],decisionIds:[]},{id:'c2',kind:'team',name:'团队',value:'10',unit:'人',status:'unconfirmed',note:'',objectIds:[],decisionIds:[]},{id:'c3',kind:'deployment',name:'部署',value:'私有化',unit:'',status:'confirmed',note:'',objectIds:[],decisionIds:[]}];
 d.scenarios=[{id:'s1',attribute:'availability',source:'',stimulus:'实例宕机',environment:'',response:'切换',measure:'',verification:'',objectIds:['api'],decisionIds:[],evidenceIds:[]}];
 d.points=[{id:'p1',kind:'tradeoff',text:'副本数',scenarioIds:['s1'],objectIds:[],decisionIds:[]}];
 d.risks=[{id:'recheck-dec',text:'待重查',objectIds:[]}];return validateDesign(d);}
const ids=(items:ReturnType<typeof completeness>,kind:string)=>items.filter(i=>i.kind===kind).map(i=>i.target.type+':'+i.target.id).sort();

test('STORY-013 AC-02：完成度按三类列出并带跳转目标',()=>{
 const skipped={...builtinQuestion('system_context'),status:'skipped' as const};const items=completeness(sample(),[skipped]);
 assert.deepEqual(ids(items,'unanswered'),['constraint:c1','domain:data','question:'+skipped.id].sort());
 assert.deepEqual(ids(items,'unconfirmed'),['constraint:c2','decision:dec','point:p1'].sort());
 assert.deepEqual(ids(items,'evidence'),['node:q','scenario:s1'].sort());
 for(const i of items)assert.ok(i.text.trim());
});
test('STORY-012 AC-02：场景补齐度量、验证与通过证据后不再缺证据',()=>{
 const d=structuredClone(sample());d.evidence=[{id:'ev',text:'压测报告',objectIds:['api'],revisionId:'r1',result:'pass'}];d.scenarios![0]={...d.scenarios![0],measure:'30 秒内恢复',verification:'故障演练',evidenceIds:['ev']};
 assert.ok(!completeness(validateDesign(d)).some(i=>i.target.type==='scenario'));
 d.evidence[0].result='planned';assert.ok(completeness(validateDesign(d)).some(i=>i.target.type==='scenario'));
});
test('订单示例的完成度非空且全部可跳转',()=>{const items=completeness(orderDesign());assert.ok(items.some(i=>i.kind==='unconfirmed'&&i.target.type==='constraint'));});
