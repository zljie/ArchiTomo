import { useMemo, useState } from 'react';
import { head, type Command, type Project } from './project.ts';
import { manualCapabilities, type BizCandidate } from './onboarding.ts';
import { LEVELS, LEVEL_IDS, effectiveLevel, type Level } from './levels.ts';
import { STARTERS } from './starters';
/** 初始化向导（STORY-025）：① 目标 → ② AI 业务拓扑（勾选确认）→ ③ AI 技术架构草图（问题卡片引导）。 */
const CONSTRAINT_ROWS=[{kind:'team',name:'研发团队',unit:'人',placeholder:'例如 8'},{kind:'scale',name:'业务规模',unit:'',placeholder:'例如 日均 5 万单'},{kind:'deployment',name:'部署要求',unit:'',placeholder:'例如 私有化部署 / 公有云'},{kind:'compliance',name:'合规要求',unit:'',placeholder:'例如 等保三级'},{kind:'cost',name:'预算',unit:'',placeholder:'例如 首年 50 万'}];
const KIND_NAMES:Record<BizCandidate['kind'],string>={capability:'业务能力',process:'关键流程',concept:'核心业务对象'};
const STEPS=['设定目标','业务架构','技术架构'];
type Props={project:Project;aiConfigured:boolean;busy:boolean;generating:boolean;onCommand:(c:Command)=>Promise<void>;onBusiness:()=>Promise<void>;onTechnical:()=>Promise<void>;onCancel:()=>void;onOpenGuide:()=>void;onPreview:(id:string)=>void;onStarter:(id:string)=>void};
export default function OnboardingWizard({project,aiConfigured,busy,generating,onCommand,onBusiness,onTechnical,onCancel,onOpenGuide,onPreview,onStarter}:Props){
 const o=project.onboarding!;const step=o.status==='goal'?0:o.status==='business'?1:2;const level=effectiveLevel(project);
 const [remembered]=useState<Level|null>(()=>{try{const v=localStorage.getItem('archsketch:level');return LEVEL_IDS.includes(v as Level)?v as Level:null;}catch{return null;}});
 const chooseLevel=(l:Level)=>{try{localStorage.setItem('archsketch:level',l);}catch{}void onCommand({type:'set_profile_level',level:l});};
 const [statement,setStatement]=useState('');const [metrics,setMetrics]=useState('');const [values,setValues]=useState<Record<string,string>>({});
 const [picked,setPicked]=useState<Set<string>|null>(null);const [manual,setManual]=useState('');
 const selected=picked??new Set(o.candidates.map(c=>c.id));const toggle=(id:string)=>{const next=new Set(selected);if(next.has(id))next.delete(id);else next.add(id);setPicked(next);};
 const design=head(project);const goal=design.nodes.find(n=>n.id===o.goalId);
 const pending=project.proposals.filter(p=>p.status==='pending');const openQ=project.questions.filter(q=>q.status==='open');const asked=project.conversation.some(m=>m.role==='assistant');
 const lock=busy||generating;const skip=()=>void onCommand({type:'set_onboarding_status',status:'skipped'});
 const hasCap=o.candidates.some(c=>c.kind==='capability'&&selected.has(c.id));
 const groups=useMemo(()=>(['capability','process','concept'] as const).map(k=>[k,o.candidates.filter(c=>c.kind===k)] as const).filter(([,xs])=>xs.length),[o.candidates]);
 const stepper=<ol className="ob-steps" aria-label="初始化步骤">{STEPS.map((s,i)=><li key={s} className={i<step?'done':i===step?'current':''} aria-current={i===step?'step':undefined}><i>{i<step?'✓':i+1}</i>{s}</li>)}</ol>;
 if(step===2)return <div className="ob-dock" role="region" aria-label="初始化向导">{stepper}<div className="ob-dock-body"><div><strong>第三步 · 生成基础技术架构</strong><small>目标：{goal?.name}；已确认 {o.selectedIds.length} 项业务元素</small></div>
  {!asked&&<button className="primary" disabled={lock||!aiConfigured} onClick={()=>void onTechnical()}>{generating?'AI 正在绘制…':'让 AI 绘制技术架构'}</button>}
  {asked&&<>{generating&&<span className="ob-live">AI 正在绘制…</span>}{!generating&&openQ.length>0&&<button className="primary" onClick={onOpenGuide}>回答 {openQ.length} 个问题卡片</button>}{!generating&&pending.map(p=><button key={p.id} onClick={()=>onPreview(p.id)}>预览草图 · 待接受</button>)}{!generating&&!openQ.length&&!pending.length&&<button disabled={lock||!aiConfigured} onClick={()=>void onTechnical()}>再画一版</button>}</>}
  {generating&&<button onClick={onCancel}>取消</button>}
  {!aiConfigured&&<small>AI 尚未配置：可用参考模板或图代码手动绘制技术架构</small>}
  <button className="ob-finish" disabled={lock} onClick={()=>void onCommand({type:'set_onboarding_status',status:'done'})}>完成初始化</button></div>
  {level==='beginner'&&!asked&&<div className="ob-starters"><small>或直接选一个参考套餐（静态模板，不是 AI 生成）：</small>{STARTERS.slice(0,4).map(st=><button key={st.id} disabled={lock} title={st.description} onClick={()=>onStarter(st.id)}>{st.name}</button>)}</div>}
  <p className="ob-hint">每回答一张问题卡片，AI 会据此修正草图；草图在接受前只是预览，不会改动设计。</p></div>;
 if(!project.profileLevel&&step===0)return <div className="ob-overlay" role="dialog" aria-modal="true" aria-label="初始化向导"><div className="ob-card"><h2>你更接近哪一种？</h2><p>它决定之后 AI 怎么引导你，随时可以在“AI引导”里切换。</p>
  <div className="ob-levels">{LEVEL_IDS.map(l=><button key={l} className={'ob-level'+(l===remembered?' suggested':'')} disabled={lock} onClick={()=>chooseLevel(l)}><strong>{LEVELS[l].name}</strong><small>{LEVELS[l].tagline}</small>{l===remembered&&<em>上次的选择</em>}</button>)}</div>
  <div className="ob-actions"><button type="button" className="ob-skip" onClick={skip}>跳过向导</button></div></div></div>;
 return <div className="ob-overlay" role="dialog" aria-modal="true" aria-label="初始化向导"><div className="ob-card">{stepper}
  {step===0&&<form onSubmit={e=>{e.preventDefault();void onCommand({type:'onboard_goal',statement:statement.trim(),metrics:metrics.split(/\r?\n/).map(s=>s.trim()).filter(Boolean),constraints:CONSTRAINT_ROWS.map(r=>({kind:r.kind,name:r.name,value:(values[r.kind]||'').trim(),unit:r.unit}))});}}>
   <h2>这个系统要达成什么目标？</h2><p>一句话写清目标，后面的业务拓扑和技术架构都会从它推导。</p>
   <label>设计目标<input aria-label="设计目标" autoFocus value={statement} maxLength={80} placeholder="例如：把采购审批周期从 5 天缩短到 2 天以内" onChange={e=>setStatement(e.target.value)}/></label>
   <label>怎么衡量（每行一条，可选）<textarea aria-label="衡量指标" value={metrics} rows={2} placeholder={'审批周期 < 2 天\n审批记录可审计追溯'} onChange={e=>setMetrics(e.target.value)}/></label>
   <fieldset className="ob-constraints"><legend>已知约束（留空表示待确认）</legend>{CONSTRAINT_ROWS.map(r=><label key={r.kind}>{r.name}{r.unit&&<small>（{r.unit}）</small>}<input aria-label={r.name} value={values[r.kind]||''} placeholder={r.placeholder} onChange={e=>setValues({...values,[r.kind]:e.target.value})}/></label>)}</fieldset>
   <div className="ob-actions"><button type="button" className="ob-skip" onClick={skip}>跳过向导</button><button className="primary" disabled={lock||!statement.trim()}>下一步：业务架构</button></div></form>}
  {step===1&&<div>
   <h2>确认业务架构</h2><p>目标：<strong>{goal?.name}</strong>。{o.candidates.length?'勾选当前设计范围内的业务元素，取消不需要的。':aiConfigured?'让 AI 按目标拓扑业务能力、关键流程和核心业务对象。':'AI 尚未配置，可以手动列出业务能力。'}</p>
   {!o.candidates.length&&aiConfigured&&<div className="ob-actions"><button className="primary" disabled={lock} onClick={()=>void onBusiness()}>{generating?'AI 正在拓扑业务场景…':'AI 拓扑业务场景'}</button>{generating&&<button onClick={onCancel}>取消</button>}</div>}
   {!o.candidates.length&&!aiConfigured&&<><label>业务能力（每行一个）<textarea aria-label="手动业务能力" rows={5} value={manual} onChange={e=>setManual(e.target.value)}/></label><div className="ob-actions"><button className="primary" disabled={lock||!manual.trim()} onClick={()=>void onCommand({type:'set_business_candidates',candidates:manualCapabilities(manual)})}>生成勾选清单</button></div></>}
   {groups.map(([k,xs])=><fieldset key={k} className="ob-group"><legend>{KIND_NAMES[k]} <small>{xs.filter(x=>selected.has(x.id)).length}/{xs.length}</small></legend>{xs.map(c=><label key={c.id} className="ob-cand"><input type="checkbox" checked={selected.has(c.id)} onChange={()=>toggle(c.id)}/><span><strong>{c.name}</strong>{c.steps&&<em>{c.steps.join(' → ')}</em>}{c.description&&<small>{c.description}</small>}{c.rationale&&<small className="ob-why">为什么：{c.rationale}</small>}</span></label>)}</fieldset>)}
   {level!=='beginner'&&<div className="ob-actions"><button type="button" disabled={lock} onClick={()=>void onCommand({type:'set_onboarding_status',status:'technical'})}>跳过业务拓扑，直接到技术架构</button></div>}
   {o.candidates.length>0&&<div className="ob-actions"><button type="button" className="ob-skip" onClick={skip}>跳过向导</button>{aiConfigured&&<button disabled={lock} onClick={()=>{setPicked(null);void onBusiness();}}>{generating?'重新拓扑中…':'重新拓扑'}</button>}<button className="primary" disabled={lock||!hasCap} onClick={()=>void onCommand({type:'apply_business',selectedIds:o.candidates.filter(c=>selected.has(c.id)).map(c=>c.id)})}>确认业务架构，下一步</button></div>}
   {o.candidates.length>0&&!hasCap&&<small className="ob-warn">至少勾选一项业务能力</small>}
   {!o.candidates.length&&<div className="ob-actions"><button type="button" className="ob-skip" onClick={skip}>跳过向导</button></div>}
  </div>}
 </div></div>;
}
