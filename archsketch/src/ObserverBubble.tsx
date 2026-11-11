import { useState } from 'react';
import type { Design } from './design.ts';
import { KIND_NAMES, type Insight, type InsightKind } from './insights.ts';
import { BEGINNER_TIPS, type Level } from './levels.ts';
/** 观察者气泡（STORY-027 / ADR-007）：画布右下角，不弹窗、不打断；规则见解自动出现，AI 点评由用户点击触发。 */
export type InsightFile={lastRevisionId:string|null;items:Insight[];prefs:{off:boolean;muted:string[]}};
type Props={file:InsightFile;design:Design;aiConfigured:boolean;busy:boolean;reviewing:boolean;onLocate:(id:string)=>void;onStatus:(id:string,s:'dismissed'|'adopted')=>void;onPrefs:(p:{off?:boolean;mute?:string;unmute?:string})=>void;onAskAi:()=>void;onPreview:(proposalId:string)=>void;level?:Level};
const SEV:Record<Insight['severity'],string>={error:'阻断级',warning:'提示',info:'信息',good:'进展'};
export default function ObserverBubble({file,design,aiConfigured,busy,reviewing,onLocate,onStatus,onPrefs,onAskAi,onPreview,level='programmer'}:Props){
 const visible=(i:Insight)=>level!=='architect'||i.source==='ai'||i.severity==='error';
 const [open,setOpen]=useState(false);
 const batches=[...new Set([...file.items].reverse().map(i=>i.batchId))].slice(0,3);
 const latest=batches[0];const unread=file.items.filter(i=>i.batchId===latest&&i.status==='new'&&i.severity!=='good'&&visible(i)).length;
 const name=(id:string)=>design.nodes.find(n=>n.id===id)?.name;
 return <div className={'observer'+(open?' open':'')}>
  {open&&<section className="observer-panel" role="dialog" aria-label="架构观察">
   <header><strong>架构观察</strong><small>{file.prefs.off?'已关闭':'每次修改停顿后，只说这一步带来的变化'}</small><button className="gx-quiet" aria-label="收起观察" onClick={()=>setOpen(false)}>×</button></header>
   {file.prefs.off?<p className="observer-empty">观察者已关闭，不会再产生见解。</p>:!batches.length?<p className="observer-empty">还没有观察到变化。做一步修改，停顿几秒后这里会出现见解。</p>:
    batches.map((b,bi)=>{const items=file.items.filter(i=>i.batchId===b&&i.status!=='dismissed'&&visible(i));return <div key={b} className="observer-batch"><small className="observer-when">{bi===0?'最近一次变化':'更早的变化'} · {new Date(items[0]?.createdAt||file.items.find(i=>i.batchId===b)!.createdAt).toLocaleTimeString()}</small>
     {!items.length&&<p className="observer-empty">这次变化没有新的问题。</p>}
     {items.map(i=><article key={i.id} className={'insight sev-'+i.severity+(i.status==='adopted'?' adopted':'')}><div><span className="insight-tag">{i.source==='ai'?'AI':SEV[i.severity]}</span><strong>{i.title}</strong></div>{i.detail&&<p>{i.detail}</p>}{level==='beginner'&&BEGINNER_TIPS[i.kind]&&<p className="insight-tip">{BEGINNER_TIPS[i.kind]}</p>}
      <div className="insight-actions">{i.objectIds.filter(name).slice(0,3).map(id=><button key={id} onClick={()=>onLocate(id)}>定位：{name(id)}</button>)}{i.proposalId&&<button className="primary" onClick={()=>{onStatus(i.id,'adopted');onPreview(i.proposalId!);}}>预览建议</button>}<button onClick={()=>onStatus(i.id,'dismissed')}>忽略</button>{i.kind!=='ai'&&<button className="gx-quiet" title="不再提示此类" onClick={()=>onPrefs({mute:i.kind})}>不再提示“{KIND_NAMES[i.kind]}”</button>}</div></article>)}
    </div>;})}
   <footer>{!file.prefs.off&&<button className="primary" disabled={busy||reviewing||!aiConfigured||!batches.length} title={aiConfigured?'只把这次变化与相关局部设计交给模型':'AI 尚未配置'} onClick={onAskAi}>{reviewing?'AI 点评中…':'请 AI 点评这次变化'}</button>}
    {file.prefs.muted.length>0&&<span className="observer-muted">已静音：{file.prefs.muted.map(k=><button key={k} className="gx-quiet" title="恢复提示" onClick={()=>onPrefs({unmute:k})}>{KIND_NAMES[k as InsightKind]} ×</button>)}</span>}
    <button className="gx-quiet" onClick={()=>onPrefs({off:!file.prefs.off})}>{file.prefs.off?'开启观察':'关闭观察'}</button></footer>
  </section>}
  <button className="observer-bubble" aria-label={`架构观察${unread?`，${unread} 条新见解`:''}`} aria-expanded={open} onClick={()=>setOpen(o=>!o)}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>观察{unread>0&&<b>{unread}</b>}</button>
 </div>;
}
