import { useEffect, useMemo, useRef, useState } from 'react';
import { highlight } from './highlight';
import type { Design, DesignView } from './design';
import { parseCode, toCode } from './dsl';

/** 图代码面板（STORY-007，参照 Eraser）：与画布并排，均从模型派生；“应用”才增量写回模型。 */
export default function CodePanel({design,view,parentId,disabled,onApply,onClose}:{design:Design;view:DesignView;parentId?:string;disabled:boolean;onApply:(d:Design)=>void;onClose?:()=>void}){
 const generated=useMemo(()=>toCode(design,view),[design,view]);
 const [code,setCode]=useState(generated);const [dirty,setDirty]=useState(false);
 useEffect(()=>{if(!dirty)setCode(generated);},[generated,dirty]);
 useEffect(()=>{setDirty(false);},[view.id]);
 const result=useMemo(()=>dirty?parseCode(design,view,code,parentId):null,[dirty,design,view,code,parentId]);
 const s=result?.summary;const changed=!!s&&(s.added+s.updated+s.removed+s.groups+s.relations)>0;
 const apply=()=>{if(result?.design&&changed){onApply(result.design);setDirty(false);}};
 const lines=useMemo(()=>highlight(code),[code]);const errorLines=new Set(result?.errors.map(e=>e.line)||[]);const hl=useRef<HTMLDivElement>(null);
 return <section className="code-panel" aria-label="图代码">
  <div className="code-head"><strong>图代码</strong><small>{view.name}</small>{onClose&&<button className="code-close" aria-label="收起图代码" title="收起图代码" onClick={onClose}>收起</button>}</div>
  <div className="code-editor"><div className="code-hl" ref={hl} aria-hidden="true">{lines.map((line,i)=><div key={i} className={errorLines.has(i+1)?'code-line has-error':'code-line'}><span className="code-ln">{i+1}</span><span className="code-src">{line.map((t,j)=><span key={j} className={'tk-'+t.kind}>{t.text}</span>)}{'\u200b'}</span></div>)}</div>
  <textarea aria-label="图代码编辑器" spellCheck={false} wrap="off" value={code} disabled={disabled} onScroll={e=>{if(hl.current){hl.current.scrollTop=e.currentTarget.scrollTop;hl.current.scrollLeft=e.currentTarget.scrollLeft;}}} onChange={e=>{setCode(e.target.value);setDirty(true);}} onKeyDown={e=>{if((e.metaKey||e.ctrlKey)&&e.key==='Enter'){e.preventDefault();apply();}}}/></div>
  <div className="code-foot" role="status">
   {!dirty&&<span>与模型同步 · 编辑后按 ⌘/Ctrl+Enter 应用</span>}
   {result&&result.errors.length>0&&<ul className="code-errors">{result.errors.slice(0,8).map(e=><li key={e.line+e.message}>{e.line?`第 ${e.line} 行：`:''}{e.message}</li>)}</ul>}
   {result&&!result.errors.length&&<span>{changed?`将新增 ${s!.added}、修改 ${s!.updated}、删除 ${s!.removed} 个节点；分组 ${s!.groups} 处、连线 ${s!.relations} 处变化`:'没有变化'}</span>}
   <div><button className="primary" disabled={disabled||!result?.design||!changed} onClick={apply}>应用到模型</button><button disabled={!dirty} onClick={()=>setDirty(false)}>放弃修改</button></div>
  </div>
 </section>;
}
