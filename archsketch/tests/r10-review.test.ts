import test from 'node:test';import assert from 'node:assert/strict';
import {orderDesign} from '../src/design.ts';
import {procurementDesign} from '../src/layers.ts';
import {createProject,executeCommand,head,parseProject} from '../src/project.ts';
import {PROFILE,profileFindings} from '../src/profile.ts';
import {ruleCounts,issueFromFinding,evidenceSummary} from '../src/review.ts';

test('STORY-037 AC-03：按规则集与版本逐条列出通过/未通过/无法检查，不出单一质量分',()=>{
 const d=procurementDesign();const rows=ruleCounts(d);const fs=profileFindings(d);
 assert.equal(rows.length,PROFILE.invariants.length);
 for(const inv of ['INV-009','INV-010']){const r=rows.find(x=>x.id===inv)!;const n=fs.filter(f=>f.inv===inv).length;assert.equal(r.count,n);assert.equal(r.result,n?'fail':'pass');}
 assert.equal(rows.find(x=>x.id==='INV-005')!.result,'uncheckable');assert.equal(rows.find(x=>x.id==='INV-004')!.result,'pass','保存时强制');
 assert.ok(rows.every(r=>['pass','fail','uncheckable'].includes(r.result)&&r.check));assert.ok(!('score' in (rows as unknown as Record<string,unknown>)));
});
test('STORY-037 AC-02：评审问题含严重度、对象、依据、建议修复、负责人、状态、验证计划，并随项目保存',()=>{
 let p=createProject('p','采购',procurementDesign());const f={inv:'INV-009',severity:'error' as const,text:'业务能力“供应商准入”没有 realizedBy 应用系统',targetId:head(p).nodes[0].id};
 const issue={...issueFromFinding(f),id:'iss-1',owner:'王工',fix:'为能力补 realizedBy 应用',verificationPlan:'评审会复核职责矩阵',createdAt:'2026-10-19T08:00:00.000Z'} as never;
 const draft=issueFromFinding(f);assert.equal(draft.source,'rule');assert.equal(draft.severity,'blocking');assert.equal(draft.status,'open');assert.match(String(draft.basis),new RegExp(PROFILE.profileId+'.*'+f.inv));assert.deepEqual(draft.objectIds,[f.targetId]);
 p=executeCommand(p,{type:'set_review_issue',issue});assert.equal(p.reviewIssues?.[0].owner,'王工');
 p=executeCommand(p,{type:'set_review_issue',issue:{...(issue as object),status:'in_progress'} as never});assert.equal(p.reviewIssues?.length,1);assert.equal(p.reviewIssues?.[0].status,'in_progress');
 assert.throws(()=>executeCommand(p,{type:'set_review_issue',issue:{...(issue as object),status:'done'} as never}),/状态/);
 assert.doesNotThrow(()=>parseProject(JSON.parse(JSON.stringify(p))));
});
test('STORY-037 AC-04：验证计划与实测证据分开，解决问题不自动产生通过证据',()=>{
 let p=createProject('p','订单',orderDesign());const before=evidenceSummary(head(p),p);
 p=executeCommand(p,{type:'set_review_issue',issue:{id:'iss-2',source:'manual',title:'峰值吞吐未验证',severity:'major',objectIds:[],basis:'质量场景缺度量',fix:'压测',owner:'',status:'resolved',verificationPlan:'压测 2000 TPS',createdAt:'2026-10-19T08:00:00.000Z'} as never});
 const after=evidenceSummary(head(p),p);assert.equal(after.plans,before.plans+1);assert.equal(after.evidence,before.evidence);assert.equal(after.passed,before.passed);assert.deepEqual(head(p).evidence,head(createProject('q','订单',orderDesign())).evidence);
});
