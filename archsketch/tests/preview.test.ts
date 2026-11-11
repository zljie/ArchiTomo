import test from 'node:test';import assert from 'node:assert/strict';
import {newDesign,validateDesign} from '../src/design.ts';
import {applyOperations} from '../src/project.ts';
import {previewFlow} from '../src/canvas.ts';
const N=(id:string,name=id)=>({type:'set_node' as const,node:{id,name,level:'technical',role:'service',technology:'',description:'',sourceIds:[]}});
test('STORY-016 AC-01：预览按变化类型标注节点与连线，删除对象保留原位置',()=>{
 let before=applyOperations(newDesign(),[N('a'),N('b'),N('c'),{type:'set_relation',relation:{id:'r1',source:'a',target:'b',type:'depends_on',label:''}},{type:'set_relation',relation:{id:'r2',source:'b',target:'c',type:'depends_on',label:''}}]);before=validateDesign(before);
 const after=applyOperations(before,[{type:'remove_node',id:'c'},N('d'),{...N('b','B 改名')},{type:'set_relation',relation:{id:'r3',source:'a',target:'d',type:'depends_on',label:'新'}}]);
 const p=previewFlow(before,after,'technical');const ch=(id:string)=>p.nodes.find(n=>n.id===id)?.change;
 assert.equal(ch('a'),'same');assert.equal(ch('b'),'changed');assert.equal(ch('c'),'removed');assert.equal(ch('d'),'added');
 assert.deepEqual(p.nodes.find(n=>n.id==='c')!.position,before.views.find(v=>v.id==='technical')!.positions.c);
 const ech=(id:string)=>p.edges.find(e=>e.id===id)?.change;assert.equal(ech('r1'),'same');assert.equal(ech('r2'),'removed');assert.equal(ech('r3'),'added');
 assert.deepEqual(p.counts,{added:2,changed:1,removed:2});
 for(const n of p.nodes)assert.ok(n.measured&&n.handles,'预览节点同样带尺寸与连接点');
});
