import test from 'node:test';import assert from 'node:assert/strict';
import {newDesign,validateDesign} from '../src/design.ts';
import {toCode,parseCode} from '../src/dsl.ts';
import {applyOperations} from '../src/project.ts';
const N=(id:string,name:string,role:string,extra={})=>({type:'set_node' as const,node:{id,name,level:'technical',role,technology:'',description:name+'职责',sourceIds:[],...extra}});
function base(){let d=newDesign('代码');d=applyOperations(d,[N('web','Web 前端','client',{technology:'React'}),N('api','API 服务','service',{color:'blue'}),N('db','订单库','database'),{type:'set_relation',relation:{id:'r1',source:'web',target:'api',type:'depends_on',label:'调用'}},{type:'set_relation',relation:{id:'r2',source:'api',target:'db',type:'data_relation',label:'',line:'dashed',arrow:'end'}},{type:'set_node',node:{id:'cap',name:'能力',level:'capability',role:'capability',technology:'',description:'',sourceIds:[]}}]);d.boundaries=[{id:'vpc',name:'VPC',elementIds:['api','db']}];return validateDesign(d);}
const tv=(d:ReturnType<typeof base>)=>d.views.find(v=>v.id==='technical')!;
const sorted=(d:any)=>JSON.stringify({...d,nodes:[...d.nodes].sort((a:any,b:any)=>a.id.localeCompare(b.id)),relationships:[...d.relationships].sort((a:any,b:any)=>a.id.localeCompare(b.id)),boundaries:[...d.boundaries].sort((a:any,b:any)=>a.id.localeCompare(b.id))});

test('STORY-007 AC-01：生成的代码原样解析不产生变化',()=>{
 const d=base();const code=toCode(d,tv(d));
 assert.match(code,/Web 前端 \[id: web, type: client, tech: React\]/);assert.match(code,/VPC \[id: vpc\] \{/);assert.match(code,/  API 服务 \[id: api, type: service, color: blue\]/);assert.match(code,/Web 前端 > API 服务: 调用/);assert.match(code,/API 服务 --> 订单库 \[type: data_relation\]/);
 const r=parseCode(d,tv(d),code);assert.deepEqual(r.errors,[]);assert.deepEqual(r.summary,{added:0,updated:0,removed:0,groups:0,relations:0});assert.equal(sorted(r.design),sorted(d));
});
test('STORY-007 AC-02：Eraser子集语法写回模型并保留ID、描述与其他视图',()=>{
 const d=base();const code=`// 注释
direction down
Web 门户 [id: web, type: client, icon: client]
VPC [id: vpc, color: gray] {
  私有子网 {
    API 服务 [id: api, type: service]
    缓存 [type: cache, color: "#ff8800"]
  }
}
"支付网关 (第三方)" [type: external]
Web 门户 > API 服务, 缓存: HTTPS
API 服务 <> 缓存
API 服务 - "支付网关 (第三方)"
API 服务 -- 审计 [type: depends_on]
缓存 < 消息队列`;
 const r=parseCode(d,tv(d),code);assert.deepEqual(r.errors,[]);const n=r.design!;const v=n.views.find(v=>v.id==='technical')!;
 const by=(name:string)=>n.nodes.find(x=>x.name===name)!;
 assert.equal(by('Web 门户').id,'web');assert.equal(by('Web 门户').description,'Web 前端职责');assert.equal(by('Web 门户').technology,'React');assert.equal(by('API 服务').color,undefined);
 assert.ok(!n.nodes.some(x=>x.id==='db'));assert.ok(n.nodes.some(x=>x.id==='cap'));assert.equal(v.direction,'down');
 for(const name of ['缓存','支付网关 (第三方)','审计','消息队列']){assert.ok(by(name),name);assert.ok(v.nodeIds.includes(by(name).id));assert.ok(v.positions[by(name).id]);}
 assert.equal(by('缓存').role,'cache');assert.equal(by('缓存').color,'#ff8800');assert.equal(by('审计').role,'service');
 const sub=n.boundaries.find(b=>b.name==='私有子网')!;assert.equal(sub.parentId,'vpc');assert.deepEqual([...sub.elementIds].sort(),[by('API 服务').id,by('缓存').id].sort());assert.deepEqual(n.boundaries.find(b=>b.id==='vpc')!.elementIds,[]);assert.equal(n.boundaries.find(b=>b.id==='vpc')!.color,'gray');
 const rel=(s:string,t:string)=>n.relationships.filter(r=>r.source===by(s).id&&r.target===by(t).id);
 assert.equal(rel('Web 门户','API 服务')[0].id,'r1');assert.equal(rel('Web 门户','API 服务')[0].label,'HTTPS');assert.equal(rel('Web 门户','缓存')[0].label,'HTTPS');
 assert.equal(rel('API 服务','缓存')[0].arrow,'both');assert.equal(rel('API 服务','支付网关 (第三方)')[0].arrow,'none');
 assert.equal(rel('API 服务','审计')[0].line,'dashed');assert.equal(rel('API 服务','审计')[0].arrow,'none');assert.equal(rel('消息队列','缓存').length,1);
 assert.ok(!n.relationships.some(r=>r.id==='r2'));
 assert.deepEqual(r.summary,{added:4,updated:2,removed:1,groups:2,relations:7});
 const again=parseCode(n,n.views.find(v=>v.id==='technical')!,toCode(n,n.views.find(v=>v.id==='technical')!));assert.deepEqual(again.errors,[]);assert.equal(sorted(again.design),sorted(n));
});
test('STORY-007 AC-02：label 作为显示名、名称作为代码内引用；重名用id区分',()=>{
 const d=newDesign();const v=d.views.find(v=>v.id==='technical')!;const r=parseCode(d,v,'gw [type: gateway, label: "API 网关"]\nsvc1 [id: s1, type: service, label: 服务]\nsvc2 [id: s2, type: service, label: 服务]\ngw > svc1, svc2');
 assert.deepEqual(r.errors,[]);const n=r.design!;assert.ok(n.nodes.some(x=>x.name==='API 网关'));assert.equal(n.relationships.length,2);
 const code=toCode(n,n.views.find(v=>v.id==='technical')!);assert.match(code,/s1 \[id: s1, type: service, label: 服务\]/);assert.deepEqual(parseCode(n,n.views.find(v=>v.id==='technical')!,code).summary,{added:0,updated:0,removed:0,groups:0,relations:0});
});
test('STORY-007 AC-03：非法代码按行报错且不改模型',()=>{
 const d=base();const before=JSON.stringify(d);
 const r=parseCode(d,tv(d),'A [type: capability]\nB [shape: box]\nC [id: 坏 id]\nD [id: cap]\nE [color: 不是颜色]\nF [icon: nope]\nG {\nH [type: service]\n}\n}\nX > X\n空组 {\n}\nI [type: service] {');
 assert.equal(r.design,null);assert.deepEqual(r.errors.map(e=>e.line),[1,2,3,4,5,6,10,11,12,14]);assert.equal(JSON.stringify(d),before);
 assert.match(r.errors[0].message,/类型/);assert.match(r.errors[3].message,/其他视图/);assert.match(r.errors[6].message,/\}/);assert.match(r.errors[9].message,/未闭合/);
});
test('真实模型兼容：宽松模式把常见类型别名映射、忽略未知图标与属性；严格模式仍报错',()=>{
 const d=newDesign();const v=d.views.find(v=>v.id==='technical')!;const code='用户 [type: person, icon: mobile]\nApp [type: mobile, shape: box]\n订单服务 [type: microservice]\n库存 [type: weird]\n用户 > App';
 assert.ok(parseCode(d,v,code).errors.length>0);
 const r=parseCode(d,v,code,undefined,{lenient:true});assert.deepEqual(r.errors,[]);const role=(n:string)=>r.design!.nodes.find(x=>x.name===n)!.role;
 assert.equal(role('用户'),'client');assert.equal(role('App'),'client');assert.equal(role('订单服务'),'service');assert.equal(role('库存'),'service');assert.equal(r.design!.nodes.find(x=>x.name==='用户')!.icon,undefined);assert.ok(r.warnings?.some(w=>w.includes('weird')));
});
