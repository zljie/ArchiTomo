import test from 'node:test';import assert from 'node:assert/strict';
import {procurementDesign,responsibility,setOwner} from '../src/layers.ts';
import {recommendRelation,typedRelations,traceDownstream} from '../src/profile.ts';
import {createProject,executeCommand,head} from '../src/project.ts';

test('STORY-023 AC-01：按端点推荐 Profile 允许的关系',()=>{
 const d=procurementDesign();
 assert.equal(recommendRelation(d,'cap-approval','app-workflow'),'realizedBy');assert.equal(recommendRelation(d,'g-01','cap-approval'),'motivates');
 assert.equal(recommendRelation(d,'app-platform','app-sap'),'integratesWith');assert.equal(recommendRelation(d,'app-platform','tech-api'),'implementedBy');
 assert.equal(recommendRelation(d,'tech-api','tech-flow'),'dependsOn');assert.equal(recommendRelation(d,'tech-api','tech-db'),'depends_on','Profile 未定义时回退到通用依赖');
});
test('STORY-023 AC-02：类型化图含存储、旧类型映射与派生关系',()=>{
 const d=procurementDesign();const rels=typedRelations(d);const has=(type:string,s:string,t:string,origin?:string)=>rels.some(r=>r.type===type&&r.source===s&&r.target===t&&(!origin||r.origin===origin));
 assert.ok(has('realizedBy','cap-approval','app-workflow'),'应用承担能力 ≡ 能力 realizedBy 应用');assert.ok(has('motivates','g-01','cap-approval','legacy'),'derives_from 反向映射为 motivates');
 assert.ok(has('governedBy','cap-approval','c-org','derived'));assert.ok(has('mustSatisfy','tech-flow','s-peak','derived'));assert.ok(has('justifiedBy','tech-flow','dec-workflow','derived'));
 assert.ok(has('contains','app-workflow','tech-flow','legacy'),'parentId ≡ contains');
});
test('STORY-023 BR-04：职责矩阵新勾选写 realizedBy，并兼容旧 realizes',()=>{
 const d=procurementDesign();const next=setOwner(d,'cap-supplier','app-platform',true);assert.ok(next.relationships.some(r=>r.type==='realizedBy'&&r.source==='cap-supplier'&&r.target==='app-platform'));
 assert.ok(responsibility(next).find(r=>r.capability.id==='cap-supplier')!.owners.includes('app-platform'));
 const off=setOwner(next,'cap-supplier','app-platform',false);assert.ok(!responsibility(off).find(r=>r.capability.id==='cap-supplier')!.owners.includes('app-platform'));
});
test('STORY-023 AC-03：目标变化提示下游复核且对象不变',()=>{
 const d=procurementDesign();const down=traceDownstream(d,'g-01');for(const id of ['cap-approval','app-workflow','tech-flow','comp-rule','dec-workflow'])assert.ok(down.includes(id),id);
 let p=createProject('p','p',d);const before=JSON.stringify(head(p).nodes.filter(n=>n.id!=='g-01'));const e=structuredClone(head(p));e.nodes.find(n=>n.id==='g-01')!.description='审批周期缩短 50%';p=executeCommand(p,{type:'edit_design',design:e});
 const risk=head(p).risks.find(r=>r.id==='trace-g-01')!;assert.ok(risk,'应有下游复核提示');assert.match(risk.text,/采购审批效率提升/);assert.ok(risk.objectIds.includes('tech-flow'));assert.equal(JSON.stringify(head(p).nodes.filter(n=>n.id!=='g-01')),before);
 const t=structuredClone(head(p));t.nodes.find(n=>n.id==='tech-db')!.description='改了技术描述';p=executeCommand(p,{type:'edit_design',design:t});assert.ok(!head(p).risks.some(r=>r.id==='trace-tech-db'),'技术元素变化不产生目标追溯提示');
});
