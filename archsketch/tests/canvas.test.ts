import test from 'node:test';import assert from 'node:assert/strict';
import {newDesign,selfDesign,validateDesign} from '../src/design.ts';
import {toFlowNodes,toFlowEdges,groupBoxes,freeSlot,NODE_W,NODE_H} from '../src/canvas.ts';
import {applyOperations} from '../src/project.ts';

test('BUG-001 AC-01：派生的画布节点都带measured尺寸且只含视图节点',()=>{
 const d=selfDesign();const v=d.views.find(v=>v.id==='context')!;const nodes=toFlowNodes(d,v);
 assert.deepEqual(nodes.map(n=>n.id).sort(),[...v.nodeIds].sort());
 for(const n of nodes)assert.deepEqual(n.measured,{width:NODE_W,height:NODE_H},n.id+'缺少measured，受控重渲染后会被隐藏');
});
test('连线只在视图内派生，线型与箭头按关系属性映射',()=>{
 let d=newDesign();d=applyOperations(d,[{type:'set_node',node:{id:'a',name:'A',level:'technical',role:'service',technology:'',description:'',sourceIds:[]}},{type:'set_node',node:{id:'b',name:'B',level:'technical',role:'service',technology:'',description:'',sourceIds:[]}},{type:'set_node',node:{id:'c',name:'C',level:'capability',role:'capability',technology:'',description:'',sourceIds:[]}}]);
 d.relationships=[{id:'r1',source:'a',target:'b',type:'depends_on',label:''},{id:'r2',source:'b',target:'a',type:'depends_on',label:'回调',line:'dashed',arrow:'both'},{id:'r3',source:'a',target:'b',type:'data_relation',label:'',arrow:'none'},{id:'r4',source:'a',target:'c',type:'realizes',label:''}];d=validateDesign(d);
 const e=toFlowEdges(d,d.views.find(v=>v.id==='technical')!);assert.deepEqual(e.map(x=>x.id),['r1','r2','r3']);
 assert.ok(e[0].markerEnd&&!e[0].markerStart);assert.ok(e[1].markerEnd&&e[1].markerStart);assert.equal(e[1].style?.strokeDasharray,'6 4');assert.equal(e[1].label,'回调');assert.ok(!e[2].markerEnd&&!e[2].markerStart);
});
test('STORY-008 AC-03：嵌套分组框包含成员与子分组',()=>{
 let d=newDesign();const node=(id:string)=>({type:'set_node' as const,node:{id,name:id,level:'technical',role:'service',technology:'',description:'',sourceIds:[]}});d=applyOperations(d,[node('a'),node('b'),node('c')]);
 const v=d.views.find(v=>v.id==='technical')!;v.positions={a:{x:0,y:0},b:{x:400,y:0},c:{x:800,y:300}};d.boundaries=[{id:'vpc',name:'VPC',elementIds:['c']},{id:'subnet',name:'子网',elementIds:['a','b'],parentId:'vpc'}];d=validateDesign(d);
 const boxes=groupBoxes(d,d.views.find(v=>v.id==='technical')!);const outer=boxes.find(b=>b.id==='vpc')!,inner=boxes.find(b=>b.id==='subnet')!;
 assert.ok(outer&&inner);assert.equal(outer.depth,0);assert.equal(inner.depth,1);
 const inside=(o:typeof outer,x:number,y:number,w:number,h:number)=>x>=o.x&&y>=o.y&&x+w<=o.x+o.width&&y+h<=o.y+o.height;
 assert.ok(inside(inner,0,0,NODE_W,NODE_H)&&inside(inner,400,0,NODE_W,NODE_H));assert.ok(inside(outer,inner.x,inner.y,inner.width,inner.height));assert.ok(inside(outer,800,300,NODE_W,NODE_H));assert.ok(!inside(inner,800,300,NODE_W,NODE_H));
});
test('新元素放置位置不与已有节点重叠',()=>{
 const d=newDesign();const v=d.views.find(v=>v.id==='technical')!;v.nodeIds=['a','b'];v.positions={a:{x:0,y:0},b:{x:600,y:0}};
 const p=freeSlot(v);for(const q of Object.values(v.positions))assert.ok(Math.abs(p.x-q.x)>=NODE_W||Math.abs(p.y-q.y)>=NODE_H,'新位置与已有节点重叠');
});
