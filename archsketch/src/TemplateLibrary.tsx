import { useEffect, useState } from 'react';
import { CATEGORIES, PATTERNS, STARTERS } from './starters';

/** 模板库（STORY-014）：完整架构模板与可插入的局部模式；模板是静态资产，不是 AI 结果。 */
export type MyTemplate={id:string;name:string;description:string;level:string;code:string;createdAt:string};
async function call(path:string,body?:unknown){const r=await fetch(path,{method:body===undefined?'GET':'POST',headers:body===undefined?{}:{'Content-Type':'application/json'},...(body===undefined?{}:{body:JSON.stringify(body)})});const v=await r.json();if(!r.ok)throw Object.assign(Error(v.error||'请求失败'),{status:r.status});return v;}
export default function TemplateLibrary({open,onClose,canInsert,anchorName,technicalEmpty,onStarter,onPattern,busy,current,onMine}:{open:boolean;onClose:()=>void;canInsert:boolean;anchorName?:string;technicalEmpty:boolean;onStarter:(id:string)=>void;onPattern:(id:string)=>void;busy:boolean;current:{code:string;level:string;viewName:string;nodeCount:number;levelEmpty:(level:string)=>boolean};onMine:(t:MyTemplate)=>void}){
 const [tab,setTab]=useState<'full'|'pattern'|'mine'>('full');const [mine,setMine]=useState<MyTemplate[]>([]);const [mineError,setMineError]=useState('');const [saveName,setSaveName]=useState('');const [saveDesc,setSaveDesc]=useState('');const [saving,setSaving]=useState(false);
 useEffect(()=>{if(open)call('/api/templates').then(v=>{setMine(v.templates);setMineError('');}).catch(e=>setMineError(e.message));},[open]);
 async function saveCurrent(){if(!saveName.trim())return;setSaving(true);setMineError('');try{let v;try{v=await call('/api/templates',{template:{name:saveName.trim(),description:saveDesc,level:current.level,code:current.code}});}catch(e){if((e as {status?:number}).status!==409||!window.confirm('已有同名模板，覆盖它？'))throw e;v=await call('/api/templates',{template:{name:saveName.trim(),description:saveDesc,level:current.level,code:current.code},overwrite:true});}setMine(v.templates);setSaveName('');setSaveDesc('');}catch(e){setMineError((e as Error).message);}finally{setSaving(false);}}
 async function removeMine(t:MyTemplate){if(!window.confirm(`删除模板“${t.name}”？`))return;try{setMine((await call('/api/templates/'+t.id+'/delete',{})).templates);}catch(e){setMineError((e as Error).message);}}const [query,setQuery]=useState('');const [category,setCategory]=useState('全部');
 useEffect(()=>{if(open){setQuery('');setCategory('全部');}},[open]);
 useEffect(()=>{if(!open)return;const esc=(e:KeyboardEvent)=>{if(e.key==='Escape')onClose();};window.addEventListener('keydown',esc);return()=>window.removeEventListener('keydown',esc);},[open,onClose]);
 if(!open)return null;
 const q=query.trim().toLowerCase();const match=(...parts:(string|undefined)[])=>!q||parts.join(' ').toLowerCase().includes(q);
 const starters=STARTERS.filter(s=>(category==='全部'||s.category===category)&&match(s.name,s.description,s.category,...(s.tags||[])));
 const patternCats=['全部',...new Set(PATTERNS.map(p=>p.category))];const patterns=PATTERNS.filter(p=>(category==='全部'||p.category===category)&&match(p.name,p.description,p.category));
 const LEVELS:Record<string,string>={context:'系统上下文',capability:'业务能力',function:'功能模块',technical:'技术容器',component:'核心组件',step:'关键场景',entity:'数据架构',runtime:'运行部署',goal:'设计目标',constraint:'约束条件',quality:'质量目标'};
 const mineShown=mine.filter(t=>(category==='全部'||LEVELS[t.level]===category)&&match(t.name,t.description,t.code));
 const cats=tab==='full'?['全部',...CATEGORIES]:tab==='pattern'?patternCats:['全部',...new Set(mine.map(t=>LEVELS[t.level]||t.level))];
 return <div className="tpl-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)onClose();}}>
  <div className="tpl-dialog" role="dialog" aria-modal="true" aria-label="模板库">
   <header><h2>模板库</h2><div role="tablist" aria-label="模板类型" className="mode-switch"><button role="tab" aria-selected={tab==='full'} onClick={()=>{setTab('full');setCategory('全部');}}>完整架构 {STARTERS.length}</button><button role="tab" aria-selected={tab==='pattern'} onClick={()=>{setTab('pattern');setCategory('全部');}}>局部模式 {PATTERNS.length}</button><button role="tab" aria-selected={tab==='mine'} onClick={()=>{setTab('mine');setCategory('全部');}}>我的模板 {mine.length}</button></div><input aria-label="搜索模板" placeholder="搜索：缓存、RAG、多租户…" value={query} onChange={e=>setQuery(e.target.value)} autoFocus/><button aria-label="关闭模板库" onClick={onClose}>关闭</button></header>
   <div className="tpl-body">
    <nav aria-label="模板类别">{cats.map(c=><button key={c} aria-pressed={category===c} onClick={()=>setCategory(c)}>{c}</button>)}</nav>
    <section>
     {tab==='mine'&&<form className="tpl-save" onSubmit={e=>{e.preventDefault();void saveCurrent();}}><strong>把当前视图「{current.viewName}」保存为模板</strong><small>{current.nodeCount} 个元素 · 保存在本机项目目录，不离开这台电脑</small><input aria-label="模板名称" placeholder="模板名称" maxLength={60} value={saveName} onChange={e=>setSaveName(e.target.value)}/><input aria-label="模板说明" placeholder="说明（可选）" maxLength={300} value={saveDesc} onChange={e=>setSaveDesc(e.target.value)}/><button className="primary" type="submit" disabled={saving||!saveName.trim()||!current.nodeCount}>{saving?'保存中…':'保存为我的模板'}</button></form>}
     {mineError&&tab==='mine'&&<p className="tpl-hint tpl-error" role="alert">{mineError}</p>}
     <p className="tpl-hint">{tab==='mine'?'同层级且当前视图为空时填入当前视图，否则以模板新建项目。':tab==='full'?(technicalEmpty?'应用到当前项目的技术容器视图，作为一次人工修订保存。':'当前技术容器已有内容：将以模板新建一个项目，不覆盖当前设计。'):canInsert?`插入到技术容器，新元素连到选中的「${anchorName||'业务服务'}」；同名元素会复用。`:'局部模式只能插入技术容器视图，请先切换到“技术容器”。'}</p>
     <div className="tpl-grid">
      {tab==='full'&&starters.map(s=><article key={s.id} className="tpl-card"><div className="tpl-meta"><span>{s.category}</span></div><strong>{s.name}</strong><p>{s.description}</p><div className="tpl-tags">{s.tags?.map(t=><small key={t}>{t}</small>)}</div><button className="primary" disabled={busy} onClick={()=>onStarter(s.id)}>{technicalEmpty?'使用模板':'以此新建项目'}</button></article>)}
      {tab==='pattern'&&patterns.map(p=><article key={p.id} className="tpl-card"><div className="tpl-meta"><span>{p.category}</span></div><strong>{p.name}</strong><p>{p.description}</p><pre aria-label={p.name+' 图代码'}>{p.code.split('{选中}').join(anchorName||'业务服务')}</pre><button className="primary" disabled={busy||!canInsert} onClick={()=>onPattern(p.id)}>插入</button></article>)}
      {tab==='mine'&&mineShown.map(t=><article key={t.id} className="tpl-card"><div className="tpl-meta"><span>{LEVELS[t.level]||t.level} · {new Date(t.createdAt).toLocaleDateString()}</span></div><strong>{t.name}</strong><p>{t.description||'（无说明）'}</p><pre aria-label={t.name+' 图代码'}>{t.code.split('\n').filter(l=>l.trim()&&!l.startsWith('//')).slice(0,6).join('\n')}</pre><div className="tpl-actions"><button className="primary" disabled={busy} onClick={()=>onMine(t)}>{current.levelEmpty(t.level)?'使用模板':'以此新建项目'}</button><button disabled={busy} onClick={()=>void removeMine(t)}>删除</button></div></article>)}
      {(tab==='full'?starters:tab==='pattern'?patterns:mineShown).length===0&&<p className="tpl-hint">{tab==='mine'?'还没有保存的模板':'没有匹配的模板'}</p>}
     </div>
    </section>
   </div>
  </div>
 </div>;
}
