import { useEffect, useMemo, useState } from 'react';
import type { Design } from './design';
import { searchCommands, type CommandItem } from './commands';

/** ⌘K 命令面板（STORY-018）：搜索视图、元素与命令；↑↓ 选择，Enter 执行，Esc 关闭。 */
export default function CommandPalette({open,design,onClose,onRun}:{open:boolean;design:Design|null;onClose:()=>void;onRun:(item:CommandItem)=>void}){
 const [query,setQuery]=useState('');const [index,setIndex]=useState(0);
 useEffect(()=>{if(open){setQuery('');setIndex(0);}},[open]);
 const items=useMemo(()=>searchCommands(design,query),[design,query]);
 useEffect(()=>{setIndex(0);},[query]);
 if(!open)return null;
 const run=(item?:CommandItem)=>{if(!item)return;onClose();onRun(item);};
 const KIND:Record<CommandItem['kind'],string>={view:'视图',node:'元素',command:'命令'};
 return <div className="tpl-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)onClose();}}>
  <div className="cmd-dialog" role="dialog" aria-modal="true" aria-label="命令面板">
   <input aria-label="搜索视图、元素或命令" placeholder="搜索视图、元素或命令…" autoFocus value={query} onChange={e=>setQuery(e.target.value)} onKeyDown={e=>{if(e.key==='ArrowDown'){e.preventDefault();setIndex(i=>Math.min(i+1,items.length-1));}else if(e.key==='ArrowUp'){e.preventDefault();setIndex(i=>Math.max(i-1,0));}else if(e.key==='Enter'){e.preventDefault();run(items[index]);}else if(e.key==='Escape'){e.preventDefault();onClose();}}}/>
   <ul role="listbox" aria-label="结果">{items.map((item,i)=><li key={item.id} role="option" aria-selected={i===index}><button onMouseEnter={()=>setIndex(i)} onClick={()=>run(item)}><span className={'cmd-kind kind-'+item.kind}>{KIND[item.kind]}</span><strong>{item.label}</strong><small>{item.hint}</small></button></li>)}{!items.length&&<li className="cmd-empty">没有匹配项</li>}</ul>
   <footer><span>↑↓ 选择</span><span>Enter 执行</span><span>Esc 关闭</span></footer>
  </div>
 </div>;
}
