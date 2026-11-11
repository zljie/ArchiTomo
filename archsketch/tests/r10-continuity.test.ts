import test from 'node:test';import assert from 'node:assert/strict';
import {newDesign,validateDesign,type Design} from '../src/design.ts';
import {createProject,executeCommand,head} from '../src/project.ts';
import {builtinQuestion} from '../src/guidance.ts';
import {decisionFromAnswer,linkSources,nodeLabel,groupNodes} from '../src/continuity.ts';
import {decisionState} from '../src/decisions.ts';
function answered(){let p=createProject('p','t',newDesign('t'));const q=builtinQuestion('technical_structure');
 p=executeCommand(p,{type:'answer_question',questionId:q.id,optionIds:['o2'],note:'团队 6 人，先模块化单体',question:q});return {p,q};}
test('STORY-036 AC-01：已回答的引导问题生成带出处的待审决策草案，不自动接受',()=>{
 const {p,q}=answered();const dec=decisionFromAnswer(p,q.id);
 assert.equal(dec.title,q.title);assert.deepEqual(dec.sourceQuestionIds,[q.id]);assert.equal(dec.candidates.length,q.options.length);
 assert.equal(dec.candidates.find(c=>c.id===dec.selectedId)?.name,'模块化单体');assert.match(dec.reason,/团队 6 人/);
 assert.notEqual(decisionState(dec),'accepted');assert.equal(dec.status,'proposed');
 const d=structuredClone(head(p));d.decisions.push(dec);assert.doesNotThrow(()=>validateDesign(d));
 const open=createProject('o','t');assert.throws(()=>decisionFromAnswer(open,builtinQuestion('data').id),/尚未回答/);
});
const n=(id:string,name:string,level:string,role:string)=>({id,name,level,role,technology:'',description:'',sourceIds:[]}) as Design['nodes'][number];
test('STORY-036 AC-02：多选对象批量关联材料来源，不重复、不丢已有来源',()=>{
 const d=newDesign('t');d.nodes.push(n('a','订单服务','technical','service'),n('b','订单库','technical','database'));d.nodes[0].sourceIds=['s1'];
 const out=linkSources(d,['a','b'],['s1','s2']);assert.deepEqual(out.nodes.find(x=>x.id==='a')!.sourceIds,['s1','s2']);assert.deepEqual(out.nodes.find(x=>x.id==='b')!.sourceIds,['s1','s2']);
 assert.deepEqual(d.nodes[1].sourceIds,[],'不改原对象');
});
test('STORY-036 AC-03：影响对象按层级分组，同名对象带角色与视图区分',()=>{
 const d=newDesign('t');d.nodes.push(n('t1','知识服务','technical','service'),n('r1','知识服务','runtime','runtime'),n('a1','Admin','application','business_app'));
 d.views.find(v=>v.id==='technical')!.nodeIds.push('t1');d.views.find(v=>v.id==='deployment')!.nodeIds.push('r1');
 assert.notEqual(nodeLabel(d,'t1'),nodeLabel(d,'r1'));assert.match(nodeLabel(d,'r1'),/运行部署|运行资源/);assert.equal(nodeLabel(d,'a1'),'Admin','不重名时保持原名');
 const g=groupNodes(d);assert.deepEqual(g.map(x=>x.label),['L2 应用架构','L3 技术架构']);assert.equal(g[1].nodes.length,2);
});
