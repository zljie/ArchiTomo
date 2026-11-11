import { head, type Project } from './project.ts';
/** 初始化向导（STORY-025）：目标 → AI 业务拓扑候选（勾选确认）→ AI 技术架构草图（问题卡片引导）。 */
export type BizCandidate={id:string;kind:'capability'|'process'|'concept';name:string;description:string;steps?:string[];rationale:string};
export type OnboardingStatus='goal'|'business'|'technical'|'done'|'skipped';
export type Onboarding={status:OnboardingStatus;goalId?:string;candidates:BizCandidate[];selectedIds:string[]};
export const ONBOARDING_STATUSES:OnboardingStatus[]=['goal','business','technical','done','skipped'];
const text=(v:unknown,max:number)=>typeof v==='string'?v.trim().slice(0,max):'';
const LIMITS={capability:12,process:8,concept:12} as const;
/** 规范化 AI 返回的业务候选：分配 ID，丢弃无名称条目，按类别限量；步骤最多 8 个。 */
export function normalizeBusiness(raw:unknown):BizCandidate[]{
 if(!raw||typeof raw!=='object')return [];const r=raw as Record<string,unknown>;const out:BizCandidate[]=[];
 const groups:[BizCandidate['kind'],unknown][]=[['capability',r.capabilities],['process',r.processes],['concept',r.concepts]];
 for(const [kind,list] of groups){if(!Array.isArray(list))continue;let n=0;
  for(const item of list){if(n>=LIMITS[kind])break;if(!item||typeof item!=='object')continue;const x=item as Record<string,unknown>;const name=text(x.name,80);if(!name)continue;
   const c:BizCandidate={id:`${kind}-${out.length+1}`,kind,name,description:text(x.description,500),rationale:text(x.rationale,500)};
   if(kind==='process'){const steps=(Array.isArray(x.steps)?x.steps:[]).map(s=>text(s,80)).filter(Boolean).slice(0,8);if(steps.length<2)continue;c.steps=steps;}
   out.push(c);n++;}}
 return out;
}
/** 手动录入（未配置 AI 时）：每行一个能力。 */
export function manualCapabilities(lines:string):BizCandidate[]{return normalizeBusiness({capabilities:lines.split(/\r?\n/).map(s=>({name:s,description:'',rationale:'手动录入'}))});}
/** 业务拓扑请求提示词。 */
export function businessPrompt(p:Project):string{
 const d=head(p);const goal=d.nodes.find(n=>n.id===p.onboarding?.goalId);
 return ['根据下面的设计目标，拓扑出业务架构候选，只返回 JSON：{"capabilities":[{name,description,rationale}],"processes":[{name,steps:[步骤名],rationale}],"concepts":[{name,description,rationale}]}。',
  '能力 4-8 个，关键流程 1-3 条（每条 3-6 步），核心业务对象 3-6 个；rationale 用一句话说明它和目标的关系。全部用中文。',
  `目标：${goal?.name||''}`,goal?.description?`衡量：${goal.description}`:'',...(d.constraints||[]).map(c=>`约束：${c.name} ${c.value}${c.unit}${c.status==='unconfirmed'?'（待确认）':''}`)].filter(Boolean).join('\n');
}
/** 技术步提示词：目标、已确认业务能力/流程/对象与约束 → 请求技术架构草图（diagram）与问题卡片。 */
export function technicalPrompt(p:Project):string{
 const d=head(p);const o=p.onboarding;const goal=d.nodes.find(n=>n.id===o?.goalId);const chosen=(o?.candidates||[]).filter(c=>o!.selectedIds.includes(c.id));
 const by=(k:BizCandidate['kind'])=>chosen.filter(c=>c.kind===k);
 return ['请基于已确认的业务架构，绘制一版基础技术架构：在 diagram 中给出技术视图的图代码（客户端、网关、服务、数据存储、消息与外部系统），并用问题卡片逐个引导关键技术选择（如部署形态、服务拆分粒度、数据存储、集成方式）。',
  `目标：${goal?.name||''}${goal?.description?`（${goal.description}）`:''}`,
  `业务能力：${by('capability').map(c=>c.name).join('、')||'无'}`,
  ...by('process').map(c=>`关键流程：${c.name}（${(c.steps||[]).join(' → ')}）`),
  `核心业务对象：${by('concept').map(c=>c.name).join('、')||'无'}`,
  ...(d.constraints||[]).map(c=>`约束：${c.name} ${c.value||'未填写'}${c.unit}${c.status==='unconfirmed'?'（待确认）':''}`)].join('\n');
}
