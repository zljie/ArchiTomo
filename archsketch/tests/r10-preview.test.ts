import test from 'node:test';import assert from 'node:assert/strict';
import {newDesign,type Design,type Operation} from '../src/design.ts';
import {applyOperations} from '../src/project.ts';
import {affectedViews,previewTarget} from '../src/previewTarget.ts';

function base():Design{const d=newDesign('t');d.nodes.push({id:'svc',name:'业务服务',role:'service',level:'technical',technology:'',description:'',sourceIds:[]} as Design['nodes'][number]);const tv=d.views.find(v=>v.id==='technical')!;tv.nodeIds.push('svc');tv.positions.svc={x:0,y:0};return d;}
const deployOps:Operation[]=[
 {type:'set_node',node:{id:'pod-a',name:'业务 Pod',role:'runtime',level:'runtime',technology:'k8s',description:'',sourceIds:[]} as Design['nodes'][number]},
 {type:'set_node',node:{id:'pod-b',name:'网关 Pod',role:'runtime',level:'runtime',technology:'k8s',description:'',sourceIds:[]} as Design['nodes'][number]},
 {type:'set_view',view:{id:'deployment',positions:{'pod-a':{x:0,y:0},'pod-b':{x:200,y:0}},nodeIds:['pod-a','pod-b']}},
];
test('STORY-033 AC-01：部署提案在部署视图预览时停留在部署视图（F-03 复现）',()=>{
 const b=base();const a=applyOperations(b,deployOps);
 assert.equal(previewTarget(b,a,'deployment',deployOps),'deployment');
});
test('STORY-033 AC-01：当前视图无变化时定位到受影响最多的视图，并列出全部受影响视图',()=>{
 const b=base();const a=applyOperations(b,deployOps);
 assert.equal(previewTarget(b,a,'technical',deployOps),'deployment');
 const views=affectedViews(b,a);assert.equal(views[0].viewId,'deployment');assert.equal(views[0].added,2);assert.ok(!views.some(v=>v.viewId==='technical'));
 // 多视图：同时改技术视图
 const ops2:Operation[]=[...deployOps,{type:'set_node',node:{...b.nodes[0],description:'改职责'}}];const a2=applyOperations(b,ops2);
 assert.deepEqual(affectedViews(b,a2).map(v=>v.viewId).sort(),['deployment','technical']);
 assert.equal(previewTarget(b,a2,'technical',ops2),'technical','当前视图有变化时不跳走');
});
import {createProject,executeCommand,head} from '../src/project.ts';
import {currentQuestion} from '../src/guidance.ts';
import {initialView,keepContext} from '../src/viewMemory.ts';
test('STORY-033 AC-02：架构师模式不主动展示内置基础题；已有目标时不再把目标题作为默认必答题',()=>{
 let p=createProject('p','引导');p=executeCommand(p,{type:'set_profile_level',level:'architect'});assert.equal(currentQuestion(p,head(p)),null);
 const g=createProject('g','有目标');const d=structuredClone(head(g));d.nodes.push({id:'goal-1',name:'设备知识先行',role:'goal',level:'goal',technology:'',description:'',sourceIds:[]} as Design['nodes'][number]);
 const q=currentQuestion(g,d);assert.notEqual(q?.domain,'goals_constraints');
});
test('STORY-033 AC-03：非绘图操作保持视图与选中；重开恢复上次视图',()=>{
 const b=base();assert.deepEqual(keepContext(b,'technical','svc',true),{viewId:'technical',selected:'svc'});
 assert.deepEqual(keepContext(b,'technical','gone',true),{viewId:'technical'},'对象已不存在时清空选中');
 assert.equal(initialView(b,'deployment'),'deployment');assert.equal(initialView(b,'nope'),b.views[0].id);assert.equal(initialView(b,null),b.views[0].id);
});
