import test from 'node:test';import assert from 'node:assert/strict';
import {newDesign,validateDesign,inspectDesign,LEVEL_ROLES} from '../src/design.ts';
import {ELEMENTS,ICONS,elementsFor,iconFor,isColor} from '../src/elements.ts';
import {applyOperations} from '../src/project.ts';
const node=(id:string,role='service',extra={})=>({id,name:id,level:'technical',role,technology:'',description:'职责',sourceIds:[],...extra});

test('STORY-008 AC-01：各层元素目录带中文名与图标',()=>{
 const tech=elementsFor('technical').map(e=>e.role);
 for(const role of ['client','gateway','load_balancer','application','service','queue','cache','database','storage','cdn','external'])assert.ok(tech.includes(role),'技术层缺少'+role);
 assert.deepEqual(elementsFor('context').map(e=>e.role),['person','system','external']);
 for(const role of ['runtime','server','container','cluster','network'])assert.ok(elementsFor('runtime').some(e=>e.role===role));
 for(const e of ELEMENTS){assert.ok(e.name.trim()&&e.category.trim());assert.ok(ICONS[e.icon],e.role+'图标缺失');assert.ok(LEVEL_ROLES[e.level].includes(e.role));}
 assert.equal(iconFor({role:'queue'}),'queue');assert.equal(iconFor({role:'queue',icon:'database'}),'database');
});
test('STORY-008 AC-02：新可选字段合法值通过、非法值拒绝、旧文件兼容',()=>{
 assert.doesNotThrow(()=>validateDesign(newDesign()));
 const d=newDesign();d.nodes=[node('gw','gateway',{icon:'gateway',color:'blue'}),node('q','queue',{color:'#22aa66'})];const v=d.views.find(v=>v.id==='technical')!;v.nodeIds=['gw','q'];v.positions={gw:{x:0,y:0},q:{x:300,y:0}};v.direction='down';
 d.relationships=[{id:'r',source:'gw',target:'q',type:'depends_on',label:'',line:'dashed',arrow:'both',color:'red'}];d.boundaries=[{id:'vpc',name:'VPC',elementIds:['gw'],color:'gray',icon:'network'},{id:'sub',name:'子网',elementIds:['q'],parentId:'vpc'}];
 assert.doesNotThrow(()=>validateDesign(d));assert.ok(!inspectDesign(validateDesign(d)).some(i=>i.id.startsWith('role-')),'新角色不应被判为与层级不一致');
 const bad=(f:(x:typeof d)=>void)=>{const x=structuredClone(d);f(x);assert.throws(()=>validateDesign(x));};
 bad(x=>{x.nodes[0].color='不是颜色';});bad(x=>{x.nodes[0].icon='nope';});bad(x=>{(x.relationships[0] as any).line='wavy';});bad(x=>{(x.relationships[0] as any).arrow='left';});bad(x=>{(x.views.find(v=>v.id==='technical') as any).direction='diag';});
 bad(x=>{x.boundaries[0].parentId='sub';});bad(x=>{x.boundaries[1].parentId='missing';});bad(x=>{x.boundaries[1].elementIds=['gw'];});
 assert.ok(isColor('blue')&&isColor('#a1b2c3'));assert.ok(!isColor('#12')&&!isColor('url(x)'));
});
test('删除节点后仍含子分组的父分组保留',()=>{
 let d=newDesign();d=applyOperations(d,[{type:'set_node',node:node('a')},{type:'set_node',node:node('b')}]);d.boundaries=[{id:'vpc',name:'VPC',elementIds:['a']},{id:'sub',name:'子网',elementIds:['b'],parentId:'vpc'}];d=validateDesign(d);
 const next=applyOperations(d,[{type:'remove_node',id:'a'}]);assert.deepEqual(next.boundaries.map(b=>b.id).sort(),['sub','vpc']);
 const all=applyOperations(next,[{type:'remove_node',id:'b'}]);assert.deepEqual(all.boundaries,[]);
});
