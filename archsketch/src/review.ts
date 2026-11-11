import type { Design } from './design.ts';
import type { Project, ReviewIssue } from './project.ts';
import { PROFILE, profileFindings, type Finding } from './profile.ts';
/** 评审工作区（STORY-037 / W3）：按规则集与版本逐条透明计数，不出单一质量分；评审问题与验证计划随项目保存，不代替实测证据。 */
export type RuleRow={id:string;rule:string;check:string;result:'pass'|'fail'|'uncheckable';count:number};
const ENFORCED:Record<string,string>={'INV-004':'保存时强制（不合法即拒绝保存）','INV-006':'接受决策时强制','INV-008':'发布交付包时强制（已发布只读）'};
const FOUND=['INV-002','INV-009','INV-010'];
export function ruleCounts(d:Design,_p?:Project):RuleRow[]{
 const fs=profileFindings(d);const passed=new Set(d.evidence.filter(e=>e.result==='pass').map(e=>e.id));
 return PROFILE.invariants.map(inv=>{
  if(ENFORCED[inv.id])return {id:inv.id,rule:inv.rule,check:ENFORCED[inv.id],result:'pass' as const,count:0};
  if(FOUND.includes(inv.id)){const n=fs.filter(f=>f.inv===inv.id).length;return {id:inv.id,rule:inv.rule,check:'规则检查',result:n?'fail' as const:'pass' as const,count:n};}
  if(inv.id==='INV-011'){const n=(d.scenarios||[]).filter(s=>!s.evidenceIds.some(id=>passed.has(id))).length;return {id:inv.id,rule:inv.rule,check:'规则检查（只看通过证据；风险接受记录无法自动核对）',result:n?'fail' as const:'pass' as const,count:n};}
  return {id:inv.id,rule:inv.rule,check:'无法自动检查，需人工评审',result:'uncheckable' as const,count:0};});
}
const SEVERITY:Record<Finding['severity'],ReviewIssue['severity']>={error:'blocking',warning:'major',info:'minor'};
export function issueFromFinding(f:Finding):Omit<ReviewIssue,'id'|'createdAt'>{
 const rule=PROFILE.invariants.find(i=>i.id===f.inv)?.rule||'';
 return {source:'rule',title:f.text.slice(0,200),severity:SEVERITY[f.severity],objectIds:f.targetId?[f.targetId]:[],basis:`${PROFILE.profileId} ${PROFILE.version} ${f.inv}：${rule}`.slice(0,2000),fix:'',owner:'',status:'open',verificationPlan:''};
}
/** 计划与证据分开计数：计划 = 带验证计划的评审问题 + 写了验证方法的质量场景；证据只看设计中的证据记录。 */
export function evidenceSummary(d:Design,p:Project):{plans:number;evidence:number;passed:number}{
 return {plans:(p.reviewIssues||[]).filter(i=>i.verificationPlan.trim()).length+(d.scenarios||[]).filter(s=>s.verification.trim()).length,evidence:d.evidence.length,passed:d.evidence.filter(e=>e.result==='pass').length};
}
