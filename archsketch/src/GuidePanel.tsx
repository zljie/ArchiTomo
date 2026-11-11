import { useEffect, useRef, useState } from 'react';
import { applyOperations, designDiff, type Command, type Project, type Question } from './project';
import type { Design } from './design';
import { currentQuestion, domainName } from './guidance';
import { roundState } from './guideRound';
import { LEVELS, LEVEL_IDS, effectiveLevel, type Level } from './levels';
import { outcomeStatus } from './aiOutcome';

type Props = { project:Project; design:Design; ai:{configured:boolean;model:string}; busy:boolean; generating:boolean; prompt:string; setPrompt:(v:string)=>void; onSend:()=>void; onCancel:()=>void; onAnswer:(q:Question,optionIds:string[],note:string,skip:boolean)=>void; onAction:(c:Command)=>void; onPreview?:(id:string)=>void; roundSize?:5|10; setRoundSize?:(n:5|10)=>void; onConverge?:()=>void; onNextRound?:()=>void; onLevel?:(l:Level)=>void; failure?:{prompt:string;reason:string}|null; onRepair?:()=>void; onRetry?:(prompt:string)=>void; onDecisionDraft?:(questionId:string)=>void };

function QuestionCard({question,step,busy,editing,onSubmit,onSkip,onCancel}:{question:Question;step:number;busy:boolean;editing:boolean;onSubmit:(ids:string[],note:string)=>void;onSkip?:()=>void;onCancel?:()=>void}){
 const [chosen,setChosen]=useState<string[]>(question.answer?.optionIds||[]);const [note,setNote]=useState(question.answer?.note||'');
 useEffect(()=>{setChosen(question.answer?.optionIds||[]);setNote(question.answer?.note||'');},[question.id,question.answer?.answeredAt]);
 const toggle=(id:string)=>setChosen(c=>question.multi?(c.includes(id)?c.filter(x=>x!==id):[...c,id]):(c[0]===id?[]:[id]));
 const card=useRef<HTMLElement>(null);useEffect(()=>{card.current?.scrollIntoView?.({block:'start',behavior:'smooth'});},[question.id]);/* F-07：新题卡定位到题目标题 */
 return <article ref={card} className="question-card" aria-label={'引导问题：'+question.title}>
  <div className="question-meta"><span className="step-badge">第 {step} 步</span><span>{domainName(question.domain)}</span><span className={'source-'+question.source}>{question.source==='ai'?'AI 提问':'内置引导'}</span></div>
  <h3>{question.title}</h3>{question.why&&<p className="question-why">{question.why}</p>}
  <div className="option-grid" role={question.multi?'group':'radiogroup'}>{question.options.map(o=><button key={o.id} type="button" role={question.multi?'checkbox':'radio'} aria-checked={chosen.includes(o.id)} className={'option-card'+(chosen.includes(o.id)?' chosen':'')} disabled={busy} onClick={()=>toggle(o.id)}><strong>{o.label}</strong>{o.detail&&<small>{o.detail}</small>}{o.bundle&&<span className="bundle-items">{o.bundle.map(b=><i key={b}>{b}</i>)}</span>}</button>)}</div>
  {question.multi&&<small className="question-hint">可多选</small>}
  <label className="question-note">补充说明（可选）<textarea aria-label="补充说明" value={note} maxLength={4000} onChange={e=>setNote(e.target.value)} placeholder="选项不完全贴合时，写下你的实际情况"/></label>
  <div className="question-actions"><button className="primary" disabled={busy||(!chosen.length&&!note.trim())} onClick={()=>onSubmit(chosen,note)}>{editing?'保存修改':'确认并继续'}</button>{onSkip&&<button disabled={busy} onClick={onSkip}>暂时跳过</button>}{onCancel&&<button disabled={busy} onClick={onCancel}>取消</button>}</div>
 </article>;
}

export default function GuidePanel({project,design,ai,busy,generating,prompt,setPrompt,onSend,onCancel,onAnswer,onAction,onPreview,roundSize=5,setRoundSize,onConverge,onNextRound,onLevel,failure,onRepair,onRetry,onDecisionDraft}:Props){
 const [editing,setEditing]=useState<string|null>(null);
 const converged=ai.configured&&!!project.guideRound?.converged;const round=roundState(project,roundSize);const shownRound=converged?project.guideRound!.index:round.index;
 const current=converged?null:currentQuestion(project,design);const answered=project.questions.filter(q=>q.status!=='open');
 const block=busy||generating;
 const lastAi=[...project.conversation].reverse().find(m=>m.role==='assistant');const lastUser=lastAi?project.conversation.slice(0,project.conversation.indexOf(lastAi)).reverse().find(m=>m.role==='user'):undefined;
 const replyState=lastAi?outcomeStatus(lastAi.outcome,project.proposals.some(x=>x.summary===lastAi.content&&['pending','accepted'].includes(x.status))):'empty';
 return <div className="guide-panel">
  <h2>AI 引导设计</h2>
  <p className="ai-status">{ai.configured?'已配置 '+ai.model:'AI 尚未配置 · 使用内置引导题'} · 每次一个问题，选择会保存在项目中</p>
  {onLevel&&<label className="level-switch">引导方式<select aria-label="用户水平" value={effectiveLevel(project)} disabled={block} onChange={e=>onLevel(e.target.value as Level)}>{LEVEL_IDS.map(l=><option key={l} value={l}>{LEVELS[l].name}</option>)}</select><small>{LEVELS[effectiveLevel(project)].tagline}</small></label>}
  {ai.configured&&effectiveLevel(project)==='architect'&&<p className="guide-note">副驾驶模式：AI 不会主动出题。在下方“自由补充需求 / 追问”里告诉它要画什么、改什么；发现明显矛盾时它才会提醒。</p>}
  {ai.configured&&effectiveLevel(project)!=='architect'&&<div className="round-bar" aria-label="引导轮次"><div><strong>第 {shownRound} 轮</strong><small>{converged?'已收敛 · 草图见下方':round.phase==='converge'?`已答满 ${round.size} 题 · 请收敛生成草图`:`发散 ${round.answered}/${round.size} · ${round.focus.split('：')[0]}`}</small></div><div className="round-meter" aria-hidden="true"><i style={{width:`${converged?100:Math.min(100,round.answered/round.size*100)}%`}}/></div><div className="round-actions">{setRoundSize&&<select aria-label="每轮题数" value={roundSize} disabled={block} onChange={e=>setRoundSize(Number(e.target.value) as 5|10)}><option value={5}>每轮 5 题</option><option value={10}>每轮 10 题</option></select>}{!converged&&onConverge&&<button className={round.phase==='converge'?'primary':''} disabled={block||round.answered<1} onClick={onConverge}>现在收敛，生成草图</button>}{converged&&onNextRound&&<button className="primary" disabled={block} onClick={onNextRound}>开始下一轮</button>}</div></div>}
  <ol className="guide-progress" aria-label="引导进度">{answered.filter(q=>!ai.configured||q.source!=='ai'||(q.round??1)===shownRound).map(q=><li key={q.id} className={q.status}>{domainName(q.domain)}</li>)}{current&&<li className="open">{domainName(current.domain)}</li>}</ol>
  {project.proposals.filter(x=>x.status==='pending').slice(-1).map(prop=>{let diff:ReturnType<typeof designDiff>=[];let previewError='';try{const before=project.revisions.find(r=>r.id===prop.baseHeadRevisionId)!.snapshot;diff=designDiff(before,applyOperations(before,prop.operations));}catch{previewError='建议无法预览，不能应用';}if(prop.status!=='pending')return null;return <article key={prop.id} className="proposal-card"><strong>变更建议 · {({pending:'待审阅',stale:'已过期',accepted:'已接受',rejected:'已拒绝'})[prop.status]}</strong><p>{prop.summary}</p><ChangeSetDetails prop={prop}/><small>{diff.length} 项语义差异</small>{diff.map(change=><details key={change.area+change.id}><summary>{change.before===null?'新增':change.after===null?'删除':'修改'} {change.area} · {change.id}</summary><pre>之前：{JSON.stringify(change.before,null,2)}{'\n'}之后：{JSON.stringify(change.after,null,2)}</pre></details>)}{previewError&&<p>{previewError}</p>}{onPreview&&!previewError&&<button disabled={block} onClick={()=>onPreview(prop.id)}>在画布上预览</button>}{prop.status==='pending'&&<button className="primary" disabled={block||!!previewError} onClick={()=>onAction({type:'accept_proposal',proposalId:prop.id})}>接受并应用建议</button>}<button disabled={block} onClick={()=>onAction({type:'reject_proposal',proposalId:prop.id})}>拒绝此建议</button></article>;})}
  {(()=>{const done=project.proposals.find(x=>x.status==='accepted'&&x.approval?.revisionId===project.headRevisionId);return done&&<article className="proposal-card applied"><strong>已应用 AI 建议</strong><p>{done.summary.slice(0,160)}</p><small>批准于 {new Date(done.approval!.approvedAt).toLocaleString()}</small><ChangeSetDetails prop={done}/><button disabled={block} onClick={()=>onAction({type:'undo_proposal',proposalId:done.id})}>撤销这次应用</button></article>;})()}
  {(()=>{const older=project.proposals.filter(x=>x.status==='stale').length+Math.max(0,project.proposals.filter(x=>x.status==='pending').length-1);return older>0&&<p className="guide-note">另有 {older} 份旧草图已被最新草图取代，已收起。</p>;})()}
  {generating&&<div className="question-card thinking">AI 正在根据你的选择准备下一步…<button onClick={onCancel}>取消</button></div>}
  {!generating&&current&&<QuestionCard key={current.id} question={current} step={ai.configured&&current.source==='ai'?round.answered+1:answered.length+1} busy={block} editing={false} onSubmit={(ids,note)=>onAnswer(current,ids,note,false)} onSkip={()=>onAnswer(current,[],'',true)}/>}
  {!generating&&!current&&<p className="guide-note">当前没有待回答的问题。可以在下方补充新的需求或追问，{ai.configured?'AI 会继续提出下一步问题。':'或在“全局”中把问题域标记为待澄清以重新引导。'}</p>}
  {answered.length>0&&<section className="answered-list"><h3>已走过的步骤（{answered.length}）</h3>{answered.map((q,i)=>editing===q.id?<QuestionCard key={q.id} question={q} step={i+1} busy={block} editing onSubmit={(ids,note)=>{setEditing(null);onAnswer(q,ids,note,false);}} onCancel={()=>setEditing(null)}/>:<article key={q.id} className={'answered-item '+q.status}><div><small>第 {i+1} 步 · {domainName(q.domain)}{q.history.length?` · 修改过 ${q.history.length} 次`:''}</small><strong>{q.title}</strong><p>{q.status==='skipped'?'已跳过':q.answer!.optionIds.map(id=>q.options.find(o=>o.id===id)?.label).join('、')||'（仅补充说明）'}{q.answer?.note?` · ${q.answer.note}`:''}</p></div><button disabled={block} onClick={()=>setEditing(q.id)}>{q.status==='skipped'?'现在回答':'修改选择'}</button>{onDecisionDraft&&q.status==='answered'&&(design.decisions.some(d=>d.sourceQuestionIds?.includes(q.id))?<small className="draft-done">已有决策草案</small>:<button disabled={block} title="生成提议中的决策，需在设计决策中补充取舍并人工接受" onClick={()=>onDecisionDraft(q.id)}>转为待审决策</button>)}</article>)}</section>}
  {failure&&<article className="ai-reply status-none" role="alert"><strong>AI 建议未通过校验 · 当前设计未变</strong><p>{failure.reason}</p><small>修复会把失败原因连同原请求发回 AI，只修正不合法部分；结果仍需你预览并接受。</small>{onRepair&&<button className="primary" disabled={block} onClick={onRepair}>修复本次建议</button>}</article>}
  {lastAi&&!failure&&<article className={'ai-reply status-'+replyState} aria-label="最近一次 AI 回复"><strong>{replyState==='none'?'未生成可应用变更':replyState==='applicable'?'AI 回复 · 已生成建议':'AI 回复'}</strong><p>{lastAi.content.length>600?lastAi.content.slice(0,600)+'…':lastAi.content}</p>{lastAi.outcome&&(lastAi.outcome.dropped.length>0||replyState==='none')&&<details open={replyState==='none'}><summary>保留 {lastAi.outcome.kept} 项 · 丢弃 {lastAi.outcome.dropped.length} 项</summary><ul>{lastAi.outcome.dropped.slice(0,20).map((r,i)=><li key={i}>{r}</li>)}</ul></details>}{replyState==='none'&&onRetry&&lastUser&&<button disabled={block} onClick={()=>onRetry(lastUser.content)}>重试这次请求</button>}</article>}
  <details className="free-input"><summary>自由补充需求 / 追问</summary>
   <p className="guide-note">发送讨论时，相关业务材料与当前设计将交给已配置的模型服务。</p>
   {project.sources.filter(s=>s.kind!=='text'||!project.conversation.some(m=>m.sourceIds.includes(s.id))).map(s=><details key={s.id}><summary>材料：{s.name}</summary><pre>{s.content}</pre></details>)}
   <label>业务需求或本轮问题<textarea aria-label="AI讨论输入" value={prompt} maxLength={8000} onChange={e=>setPrompt(e.target.value)} placeholder="先描述业务目标；AI会一步一步提问。"/></label>
   <button className="primary wide-button" disabled={block||!ai.configured||!prompt.trim()} onClick={onSend}>{generating?'正在讨论…':'发送并继续'}</button>
   <div className="conversation">{project.conversation.map(m=><article key={m.id} className={m.role}><strong>{m.role==='user'?'架构师':'AI助手'}</strong><p>{m.content}</p></article>)}</div>
  </details>
 </div>;
}
/** ChangeSet 详情（STORY-030）：理由、影响、取舍、应用后验证；缺省时注明未提供。 */
export function ChangeSetDetails({prop}:{prop:{rationale?:string;impact?:string[];tradeoffs?:string[];validation?:string[]}}){
 const has=prop.rationale||prop.impact?.length||prop.tradeoffs?.length||prop.validation?.length;if(!has)return <small className="cs-missing">AI 未提供理由、影响与验证项</small>;
 return <dl className="changeset">{prop.rationale&&<><dt>理由</dt><dd>{prop.rationale}</dd></>}{([['impact','影响'],['tradeoffs','取舍'],['validation','应用后验证']] as const).map(([k,label])=>prop[k]?.length?<div key={k}><dt>{label}</dt><dd><ul>{prop[k]!.map((x,i)=><li key={i}>{x}</li>)}</ul></dd></div>:null)}</dl>;
}
