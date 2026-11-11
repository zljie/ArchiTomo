import test from 'node:test';import assert from 'node:assert/strict';
import {newDesign,validateDesign,orderDesign,type Design,type Constraint} from '../src/design.ts';
import {createProject,executeCommand,head,applyOperations,designDiff} from '../src/project.ts';
const base=()=>{let d=newDesign('约束');d=applyOperations(d,[{type:'set_node',node:{id:'api',name:'API',level:'technical',role:'service',technology:'',description:'x',sourceIds:[]}},{type:'set_node',node:{id:'db',name:'DB',level:'technical',role:'database',technology:'',description:'x',sourceIds:[]}},{type:'set_relation',relation:{id:'r',source:'api',target:'db',type:'depends_on',label:''}}]);
 d.decisions=[{id:'dec',title:'单体还是微服务',dimensions:[],candidates:[{id:'a',name:'单体',benefits:'',costs:'',rationale:'',violations:[],scores:{}}],reason:'',tradeoff:'',reconsiderWhen:'',affectedIds:['db']},{id:'other',title:'无关',dimensions:[],candidates:[],reason:'',tradeoff:'',reconsiderWhen:'',affectedIds:[]}];
 const c:Constraint={id:'c-scale',kind:'scale',name:'日订单量',value:'',unit:'笔/日',status:'unconfirmed',note:'',objectIds:['api'],decisionIds:['dec']};d.constraints=[c];return validateDesign(d);};

test('STORY-011 AC-01：约束合法字段通过并往返；旧文件无约束仍合法',()=>{
 const d=base();assert.equal(d.constraints![0].status,'unconfirmed');assert.equal(d.constraints![0].value,'');
 const c=structuredClone(d);c.constraints![0]={...c.constraints![0],value:'1000000',status:'confirmed'};assert.deepEqual(validateDesign(JSON.parse(JSON.stringify(c))).constraints,c.constraints);
 const old=newDesign();assert.doesNotThrow(()=>validateDesign(old));assert.equal(validateDesign(old).constraints,undefined);
});
test('STORY-011 AC-02：非法字段与悬空引用拒绝；删除节点清理约束引用',()=>{
 const bad=(f:(d:Design)=>void)=>{const d=structuredClone(base());f(d);assert.throws(()=>validateDesign(d));};
 bad(d=>{(d.constraints![0] as any).kind='weird';});bad(d=>{(d.constraints![0] as any).status='maybe';});bad(d=>{d.constraints![0].objectIds=['missing'];});bad(d=>{d.constraints![0].decisionIds=['missing'];});bad(d=>{(d.constraints![0] as any).extra=1;});
 const next=applyOperations(base(),[{type:'remove_node',id:'api'}]);assert.deepEqual(next.constraints![0].objectIds,[]);
});
test('STORY-011 AC-03：AI 建议不能写入约束',()=>{assert.throws(()=>applyOperations(base(),[{type:'set_constraint',constraint:{}} as any]),/不支持/);});
test('STORY-011：订单系统示例合法，约束带单位且全部待确认并注明演示数据',()=>{
 const d=validateDesign(orderDesign());assert.ok(d.nodes.length>=6);const cs=d.constraints||[];assert.ok(cs.length>=5);
 for(const kind of ['scale','team','availability','deployment'])assert.ok(cs.some(c=>c.kind===kind),kind);
 for(const c of cs){assert.equal(c.status,'unconfirmed');assert.match(c.note,/演示/);}assert.ok(cs.some(c=>c.unit));assert.ok((d.decisions||[]).length>=1);assert.ok((d.scenarios||[]).length>=1);
});
test('STORY-013 AC-01：约束值变化时关联决策待重查并列影响对象，决策不被改写；无关修改不触发',()=>{
 let p=createProject('p','p',base());const decBefore=JSON.stringify(head(p).decisions);
 let d=structuredClone(head(p));d.title='只改标题';p=executeCommand(p,{type:'edit_design',design:d});assert.ok(!head(p).risks.some(r=>r.id.startsWith('recheck-')));
 d=structuredClone(head(p));d.constraints![0]={...d.constraints![0],value:'1000000',status:'confirmed'};p=executeCommand(p,{type:'edit_design',design:d});
 const risk=head(p).risks.find(r=>r.id==='recheck-dec')!;assert.ok(risk,'应生成待重查');assert.match(risk.text,/日订单量/);assert.ok(risk.objectIds.includes('db'));assert.ok(!head(p).risks.some(r=>r.id==='recheck-other'));assert.equal(JSON.stringify(head(p).decisions),decBefore);
 const restored=executeCommand(p,{type:'restore_revision',revisionId:p.revisions[0].id});assert.ok(!head(restored).risks.some(r=>r.id.startsWith('recheck-')));
 d=structuredClone(head(p));d.risks=d.risks.filter(r=>r.id!=='recheck-dec');p=executeCommand(p,{type:'edit_design',design:d});assert.ok(!head(p).risks.some(r=>r.id==='recheck-dec'),'标记已重查后风险消失');
});
test('设计差异包含约束、场景与分析点',()=>{const a=base();const b=structuredClone(a);b.constraints![0].value='5';assert.ok(designDiff(a,b).some(c=>c.area==='constraints'&&c.id==='c-scale'));});
