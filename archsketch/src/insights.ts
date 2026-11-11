import type { Design } from './design.ts';
import type { Question } from './project.ts';
import { profileFindings } from './profile.ts';
import { completeness } from './completeness.ts';
/**
 * 观察者见解（STORY-027 / ADR-007）：对比一次合并变化的前后修订，只报告这次新引入或消除的内容。
 * 纯函数、不调用 AI、不改设计；AI 见解由用户点击“请 AI 点评”另行产生。
 */
export type InsightKind='new_problem'|'resolved_problem'|'new_gap'|'resolved_gap'|'review'|'ai';
export type Insight={id:string;batchId:string;fromRevisionId:string;toRevisionId:string;source:'rule'|'ai';kind:InsightKind;severity:'error'|'warning'|'info'|'good';title:string;detail:string;objectIds:string[];proposalId?:string;status:'new'|'dismissed'|'adopted';createdAt:string};
export type RuleInsight=Pick<Insight,'kind'|'severity'|'title'|'detail'|'objectIds'>;
export const KIND_NAMES:Record<InsightKind,string>={new_problem:'新增问题',resolved_problem:'已解决问题',new_gap:'新增缺口',resolved_gap:'已补齐缺口',review:'下游复核',ai:'AI 点评'};
const REVIEW=/^(trace|recheck|review)-/;
export function ruleInsights(before:Design,after:Design,questions:Question[]=[]):RuleInsight[]{
 if(JSON.stringify(before)===JSON.stringify(after))return [];
 const out:RuleInsight[]=[];const exists=(id?:string)=>!!id&&after.nodes.some(n=>n.id===id);
 const key=(f:{inv:string;targetId?:string;text:string})=>f.inv+'|'+(f.targetId||'')+'|'+f.text;
 const fb=profileFindings(before).filter(f=>f.severity!=='info'),fa=profileFindings(after).filter(f=>f.severity!=='info');
 const kb=new Set(fb.map(key)),ka=new Set(fa.map(key));
 for(const f of fa)if(!kb.has(key(f)))out.push({kind:'new_problem',severity:f.severity as 'error'|'warning',title:f.text,detail:`${f.inv}：这一步引入的模型问题`,objectIds:exists(f.targetId)?[f.targetId!]:[]});
 for(const f of fb)if(!ka.has(key(f)))out.push({kind:'resolved_problem',severity:'good',title:f.text,detail:`${f.inv}：这一步已解决`,objectIds:exists(f.targetId)?[f.targetId!]:[]});
 const cb=completeness(before,questions),ca=completeness(after,questions);const ib=new Set(cb.map(i=>i.id)),ia=new Set(ca.map(i=>i.id));
 const added=ca.filter(i=>!ib.has(i.id)),solved=cb.filter(i=>!ia.has(i.id));
 if(added.length)out.push({kind:'new_gap',severity:added.some(i=>i.blocking)?'warning':'info',title:`新增 ${added.length} 项待完成`,detail:added.slice(0,5).map(i=>i.text).join('；'),objectIds:added.filter(i=>i.target.type==='node'&&exists(i.target.id)).map(i=>i.target.id)});
 if(solved.length)out.push({kind:'resolved_gap',severity:'good',title:`补齐 ${solved.length} 项`,detail:solved.slice(0,5).map(i=>i.text).join('；'),objectIds:[]});
 const rb=new Map(before.risks.map(r=>[r.id,r.text]));
 for(const r of after.risks)if(REVIEW.test(r.id)&&rb.get(r.id)!==r.text)out.push({kind:'review',severity:'warning',title:r.text,detail:`影响 ${r.objectIds.length} 个对象，需复核`,objectIds:r.objectIds.filter(exists)});
 return out;
}
