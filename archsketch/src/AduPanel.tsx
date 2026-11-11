import type { Design, LayerSetting } from './design';
import type { Question } from './project';
import { LAYERS, layerApplicable, responsibility, setOwner, type LayerId } from './layers';
import { aduStatus, type AduStep } from './adu';

/** ADF 设计单元看板（STORY-020/021）：每层六步状态派生自模型；设计问题与“不适用”可直接编辑；L2 附职责矩阵。 */
const STATE:Record<AduStep['state'],string>={done:'完成',partial:'部分',todo:'待做',na:'不适用'};
export default function AduPanel({design,questions,onChange,onJump,disabled}:{design:Design;questions:Question[];onChange:(d:Design)=>void;onJump:(layer:LayerId,step:AduStep)=>void;disabled:boolean}){
 const setting=(id:LayerId):LayerSetting=>design.layers?.find(l=>l.id===id)||{id,applicable:true,reason:'',question:''};
 const save=(id:LayerId,patch:Partial<LayerSetting>)=>{const next={...setting(id),...patch};if(!next.applicable&&!next.reason.trim())next.reason='待补充理由';const others=(design.layers||[]).filter(l=>l.id!==id);onChange({...design,layers:[...others,next].sort((a,b)=>a.id.localeCompare(b.id))});};
 const apps=design.nodes.filter(n=>n.level==='application');const rows=responsibility(design);
 return <fieldset className="adu-panel" disabled={disabled}>
  <h2>ADF 设计单元</h2><p>每层按“问题 → 输入 → 候选 → 决策 → 模型 → 证据”推进；状态由设计自动判断，点击可跳转。</p>
  {LAYERS.map(l=>{const s=setting(l.id);const steps=aduStatus(design,l.id,questions);const done=steps.filter(x=>x.state==='done').length;
   return <section key={l.id} className={'adu-layer'+(layerApplicable(design,l.id)?'':' na')}>
    <header><span className="adu-id">{l.id}</span><strong>{l.name}</strong><small>{s.applicable?`${done}/6`:'不适用'}</small><label className="adu-toggle"><input type="checkbox" checked={s.applicable} onChange={e=>save(l.id,{applicable:e.target.checked,...(e.target.checked?{reason:''}:{})})}/>适用</label></header>
    {s.applicable?<label>设计问题<textarea aria-label={l.id+' 设计问题'} rows={2} maxLength={500} placeholder={l.question} value={s.question} onChange={e=>save(l.id,{question:e.target.value})}/></label>:<label>不适用理由<input aria-label={l.id+' 不适用理由'} maxLength={500} value={s.reason} onChange={e=>save(l.id,{reason:e.target.value})}/></label>}
    {s.applicable&&<ol className="adu-steps">{steps.map(st=><li key={st.id}><button type="button" className={'adu-step state-'+st.state} title={st.detail} onClick={()=>onJump(l.id,st)}><b>{STATE[st.state]}</b><span>{st.label}</span><small>{st.detail}</small></button></li>)}</ol>}
    {l.id==='L2'&&s.applicable&&<div className="adu-matrix"><strong>职责矩阵 · 业务能力 → 应用</strong>{!apps.length||!rows.length?<small>{!rows.length?'先在 L1 业务能力视图添加能力':'先在 L2 应用架构视图添加应用'}</small>:<div className="matrix-scroll"><table><thead><tr><th>能力</th>{apps.map(a=><th key={a.id} title={a.name}>{a.name}</th>)}</tr></thead><tbody>{rows.map(r=><tr key={r.capability.id} className={r.owners.length?'':'orphan'}><th>{r.capability.name}{!r.owners.length&&<em>无人负责</em>}</th>{apps.map(a=><td key={a.id}><input type="checkbox" aria-label={`${a.name} 承担 ${r.capability.name}`} checked={r.owners.includes(a.id)} onChange={e=>onChange(setOwner(design,r.capability.id,a.id,e.target.checked))}/></td>)}</tr>)}</tbody></table></div>}</div>}
   </section>;})}
 </fieldset>;
}
