import test from 'node:test';import assert from 'node:assert/strict';
import {newDesign,validateDesign,VIEW_SPECS,LEVEL_ROLES,type Design} from '../src/design.ts';
import {LAYERS,layerOfView,responsibility,setOwner,procurementDesign} from '../src/layers.ts';
import {completeness} from '../src/completeness.ts';

test('STORY-020 AC-01：五层定义、视图归层；旧设计自动补空应用视图且原数据不变',()=>{
 assert.deepEqual(LAYERS.map(l=>l.id),['L0','L1','L2','L3','L4']);assert.ok(LAYERS.every(l=>l.name&&l.question));
 assert.ok(VIEW_SPECS.some(v=>v.id==='applications'&&v.level==='application'));assert.deepEqual(LEVEL_ROLES.application,['business_app','platform','external']);
 const expect:Record<string,string>={context:'L0',goals:'L0',constraints:'L0',qualities:'L0',capabilities:'L1',functions:'L1',scenario:'L1',data:'L1',applications:'L2',technical:'L3',deployment:'L3',components:'L4'};
 for(const v of VIEW_SPECS)assert.equal(layerOfView(v),expect[v.id],v.id);
 const old=newDesign();old.views=old.views.filter(v=>v.id!=='applications');const before=JSON.stringify(old.nodes);const d=validateDesign(old);assert.ok(d.views.some(v=>v.id==='applications'&&!v.nodeIds.length));assert.equal(JSON.stringify(d.nodes),before);
});
test('STORY-020：sourcing、layers、decision.layer 校验',()=>{
 const d=newDesign();d.nodes=[{id:'sap',name:'SAP',level:'application',role:'external',technology:'',description:'',sourceIds:[],sourcing:'buy'}];const v=d.views.find(v=>v.id==='applications')!;v.nodeIds=['sap'];v.positions={sap:{x:0,y:0}};
 d.layers=[{id:'L4',applicable:false,reason:'简单 CRUD 无需组件设计',question:''}];d.decisions=[{id:'x',title:'t',dimensions:[],candidates:[],reason:'',tradeoff:'',reconsiderWhen:'',affectedIds:[],layer:'L2'}];
 assert.doesNotThrow(()=>validateDesign(d));
 const bad=(f:(x:Design)=>void)=>{const x=structuredClone(d);f(x);assert.throws(()=>validateDesign(x));};
 bad(x=>{(x.nodes[0] as any).sourcing='steal';});bad(x=>{(x.layers![0] as any).id='L9';});bad(x=>{x.layers![0].reason='';});bad(x=>{(x.decisions[0] as any).layer='L7';});bad(x=>{x.layers!.push({...x.layers![0]});});
});
test('STORY-020 AC-02：职责矩阵读写 realizes 关系，无人负责的能力为阻断级',()=>{
 const d=procurementDesign();const rows=responsibility(d);assert.ok(rows.length>=4);assert.ok(rows.every(r=>r.owners.length>=1),'示例中每项能力都有负责应用');
 const cap=rows[0].capability.id,app=rows[0].owners[0];const removed=setOwner(d,cap,app,false);assert.equal(responsibility(removed).find(r=>r.capability.id===cap)!.owners.length,rows[0].owners.length-1);
 const items=completeness(removed);const block=items.find(i=>i.target.id===cap);if(!rows[0].owners.slice(1).length){assert.ok(block?.blocking,'无人负责应为阻断级');}
 const again=setOwner(removed,cap,app,true);assert.deepEqual(responsibility(again).find(r=>r.capability.id===cap)!.owners.sort(),rows[0].owners.sort());
 assert.equal(setOwner(again,cap,app,true).relationships.length,again.relationships.length,'重复勾选不重复建关系');
 assert.ok(d.nodes.filter(n=>n.level==='application').every(n=>n.sourcing),'示例应用均已定 sourcing');
});
test('STORY-020 AC-03：不适用层的缺口不计入完成度；应用未定 sourcing 为未回答',()=>{
 const d=procurementDesign();const orphan=structuredClone(d);orphan.nodes.push({id:'cap-x',name:'新能力',level:'capability',role:'capability',technology:'',description:'',sourceIds:[]});orphan.views.find(v=>v.id==='capabilities')!.nodeIds.push('cap-x');orphan.views.find(v=>v.id==='capabilities')!.positions['cap-x']={x:0,y:900};
 assert.ok(completeness(validateDesign(orphan)).some(i=>i.target.id==='cap-x'&&i.blocking));
 orphan.layers=[{id:'L2',applicable:false,reason:'暂不规划应用',question:''}];assert.ok(!completeness(validateDesign(orphan)).some(i=>i.target.id==='cap-x'));
 const noSrc=structuredClone(d);const app=noSrc.nodes.find(n=>n.level==='application')!;delete app.sourcing;assert.ok(completeness(validateDesign(noSrc)).some(i=>i.kind==='unanswered'&&i.target.id===app.id));
});
