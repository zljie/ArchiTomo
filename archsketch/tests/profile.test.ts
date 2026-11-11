import test from 'node:test';import assert from 'node:assert/strict';
import raw0 from '../src/profiles/addm-base.ts';const raw=raw0 as Record<string,unknown>;
import {newDesign,validateDesign,type Design} from '../src/design.ts';
import {PROFILE,parseProfile,elementTypeOf,tripleAllowed,profileFindings} from '../src/profile.ts';
import {procurementDesign} from '../src/layers.ts';
import {applyOperations} from '../src/project.ts';

test('STORY-022 AC-01：内置 ADDM-BASE Profile 结构校验通过',()=>{
 assert.ok(PROFILE);assert.equal(PROFILE!.profileId,'ADDM-BASE');assert.equal(PROFILE!.version,'1.0.0');
 assert.equal(PROFILE!.elementTypes.length,31);assert.equal(PROFILE!.relationTypes.length,18);assert.equal(PROFILE!.invariants.length,12);
 assert.throws(()=>parseProfile({...raw,elementTypes:[{id:'X',level:'L9'}]}),/层级/);assert.throws(()=>parseProfile({...raw,relationTypes:[{id:'r',sourceTypes:['Nope'],targetTypes:['Goal']}]}),/类型/);
});
test('STORY-022 AC-02：层级/角色映射到 ADDM 元素类型',()=>{
 const t=(level:string,role:string)=>elementTypeOf({level,role});
 assert.equal(t('goal','goal'),'Goal');assert.equal(t('constraint','constraint'),'Constraint');assert.equal(t('capability','capability'),'BusinessCapability');assert.equal(t('step','step'),'BusinessProcess');assert.equal(t('entity','entity'),'DomainConcept');
 for(const r of ['business_app','platform','external'])assert.equal(t('application',r),'ApplicationSystem');
 assert.equal(t('technical','service'),'TechnicalService');assert.equal(t('technical','client'),'RuntimeUnit');assert.equal(t('technical','database'),'DataStore');assert.equal(t('technical','queue'),'IntegrationChannel');
 assert.equal(t('runtime','cluster'),'DeploymentUnit');assert.equal(t('component','component'),'Component');assert.equal(t('context','person'),null,'上下文对象不参与类型检查');
 assert.ok(tripleAllowed('realizedBy','BusinessCapability','ApplicationSystem'));assert.ok(!tripleAllowed('realizedBy','ApplicationSystem','BusinessCapability'));
 assert.ok(tripleAllowed('contains','ApplicationSystem','RuntimeUnit'));assert.ok(!tripleAllowed('contains','ApplicationSystem','Component'),'contains 受 allowedPairs 约束');
});
function base():Design{let d=newDesign();d=applyOperations(d,[{type:'set_node',node:{id:'g',name:'目标',level:'goal',role:'goal',technology:'',description:'',sourceIds:[]}},{type:'set_node',node:{id:'cap',name:'能力',level:'capability',role:'capability',technology:'',description:'',sourceIds:[]}},{type:'set_node',node:{id:'app',name:'应用',level:'application',role:'business_app',technology:'',description:'',sourceIds:[]}},{type:'set_node',node:{id:'rt',name:'运行单元',level:'technical',role:'client',technology:'',description:'',sourceIds:[]}},{type:'set_node',node:{id:'rt2',name:'运行单元2',level:'technical',role:'application',technology:'',description:'',sourceIds:[]}}]);return d;}
test('STORY-022 AC-03：ADDM 关系三元组不合法或 contains 成环/多父时拒绝保存；旧关系只提示',()=>{
 const ok=base();ok.relationships=[{id:'r1',source:'cap',target:'app',type:'realizedBy',label:''},{id:'r2',source:'g',target:'cap',type:'motivates',label:''},{id:'r3',source:'app',target:'rt',type:'contains',label:''}];assert.doesNotThrow(()=>validateDesign(ok));
 const bad=(rel:Design['relationships'])=>{const d=base();d.relationships=rel;assert.throws(()=>validateDesign(d),/关系|contains/);};
 bad([{id:'x',source:'app',target:'cap',type:'realizedBy',label:''}]);
 bad([{id:'x',source:'g',target:'app',type:'motivates',label:''}]);
 bad([{id:'a',source:'app',target:'rt',type:'contains',label:''},{id:'b',source:'rt2',target:'rt',type:'dependsOn',label:''},{id:'c',source:'app',target:'rt2',type:'contains',label:''},{id:'e',source:'rt',target:'rt2',type:'contains',label:''}]);
 const legacy=base();legacy.relationships=[{id:'l',source:'app',target:'cap',type:'realizes',label:''},{id:'w',source:'rt',target:'g',type:'weird_type',label:''}];assert.doesNotThrow(()=>validateDesign(legacy));
 assert.ok(profileFindings(validateDesign(legacy)).some(f=>f.inv==='INV-002'&&f.severity==='info'&&f.text.includes('weird_type')));
});
test('STORY-022 AC-04：采购示例给出 INV-010 等提示且带跳转目标',()=>{
 const d=procurementDesign();const f=profileFindings(d);assert.ok(f.length>0);assert.ok(f.every(x=>x.inv.startsWith('INV-')&&x.text));
 const tech=d.nodes.find(n=>n.id==='tech-mq')!;assert.ok(f.some(x=>x.inv==='INV-010'&&x.targetId===tech.id),'消息队列没有上游依据');
 assert.ok(!f.some(x=>x.inv==='INV-010'&&x.targetId==='tech-flow'),'审批工作流服务受决策影响，有上游依据');
});
