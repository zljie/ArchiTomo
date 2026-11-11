import type { AnalysisPoint, Constraint, Design, QualityScenario } from './design';

/** 约束与质量（STORY-011/012，GOAL-001 r3）：结构化目标与约束、轻量 ATAM 质量场景、敏感点/权衡点/风险。值的确认只由架构师完成。 */
const KIND_NAMES:Record<Constraint['kind'],string>={scale:'规模 / 吞吐',availability:'可用性 SLA',cost:'成本',team:'团队',compliance:'合规',deployment:'部署方式',evolution:'演进周期',other:'其他'};
const ATTR_NAMES:Record<QualityScenario['attribute'],string>={availability:'可用性',performance:'性能',security:'安全',modifiability:'可修改性',reliability:'可靠性',scalability:'可扩展性',usability:'易用性',cost:'成本',other:'其他'};
const POINT_NAMES:Record<AnalysisPoint['kind'],string>={sensitivity:'敏感点',tradeoff:'权衡点',risk:'风险',nonrisk:'非风险'};
const newId=(p:string)=>p+crypto.randomUUID().slice(0,8);

function Links({label,options,value,onChange}:{label:string;options:{id:string;name:string}[];value:string[];onChange:(v:string[])=>void}){
 return <details className="link-picker"><summary>{label}（{value.length}）{value.length?'：'+value.map(id=>options.find(o=>o.id===id)?.name||id).join('、'):''}</summary><fieldset className="relation-choices">{options.length?options.map(o=><label key={o.id}><input type="checkbox" checked={value.includes(o.id)} onChange={e=>onChange(e.target.checked?[...value,o.id]:value.filter(x=>x!==o.id))}/>{o.name}</label>):<small>暂无可关联对象</small>}</fieldset></details>;
}

export default function ConstraintsPanel({design,onChange,disabled,focusId}:{design:Design;onChange:(d:Design)=>void;disabled:boolean;focusId?:string}){
 const constraints=design.constraints||[],scenarios=design.scenarios||[],points=design.points||[];
 const nodes=design.nodes.map(n=>({id:n.id,name:n.name||n.id})),decisions=design.decisions.map(d=>({id:d.id,name:d.title||d.id})),scenOpts=scenarios.map(s=>({id:s.id,name:s.stimulus||ATTR_NAMES[s.attribute]})),evOpts=design.evidence.map(e=>({id:e.id,name:e.text+' · '+e.result}));
 const setC=(id:string,patch:Partial<Constraint>)=>onChange({...design,constraints:constraints.map(c=>c.id===id?{...c,...patch}:c)});
 const setS=(id:string,patch:Partial<QualityScenario>)=>onChange({...design,scenarios:scenarios.map(s=>s.id===id?{...s,...patch}:s)});
 const setP=(id:string,patch:Partial<AnalysisPoint>)=>onChange({...design,points:points.map(p=>p.id===id?{...p,...patch}:p)});
 return <fieldset className="constraints-panel" disabled={disabled}>
  <h2>目标与约束</h2><p>数值带单位；未确认的值只作为前提，AI 不会替你确认。修改已关联决策的约束，会把决策标为“待重查”。</p>
  {constraints.map(c=><article key={c.id} id={'constraint-'+c.id} className={'analysis-card'+(focusId===c.id?' focused':'')+(c.status==='confirmed'?' confirmed':'')}>
   <div className="analysis-head"><select aria-label="约束类型" value={c.kind} onChange={e=>setC(c.id,{kind:e.target.value as Constraint['kind']})}>{Object.entries(KIND_NAMES).map(([k,v])=><option key={k} value={k}>{v}</option>)}</select><button className={'status-pill '+c.status} aria-pressed={c.status==='confirmed'} disabled={!c.value.trim()} title={c.value.trim()?'切换确认状态':'先填写数值'} onClick={()=>setC(c.id,{status:c.status==='confirmed'?'unconfirmed':'confirmed'})}>{c.status==='confirmed'?'已确认':'待确认'}</button></div>
   <label>名称<input aria-label="约束名称" value={c.name} maxLength={120} onChange={e=>setC(c.id,{name:e.target.value})}/></label>
   <div className="value-row"><label>数值<input aria-label="约束数值" value={c.value} maxLength={200} placeholder="未知可留空" onChange={e=>setC(c.id,{value:e.target.value,...(e.target.value.trim()?{}:{status:'unconfirmed' as const})})}/></label><label>单位<input aria-label="约束单位" value={c.unit} maxLength={40} placeholder="笔/日、%、人…" onChange={e=>setC(c.id,{unit:e.target.value})}/></label></div>
   <label>说明<input aria-label="约束说明" value={c.note} maxLength={2000} onChange={e=>setC(c.id,{note:e.target.value})}/></label>
   <Links label="关联元素" options={nodes} value={c.objectIds} onChange={v=>setC(c.id,{objectIds:v})}/><Links label="影响的决策" options={decisions} value={c.decisionIds} onChange={v=>setC(c.id,{decisionIds:v})}/>
   <button className="text-button" onClick={()=>onChange({...design,constraints:constraints.filter(x=>x.id!==c.id)})}>删除约束</button>
  </article>)}
  <button className="wide-button" onClick={()=>onChange({...design,constraints:[...constraints,{id:newId('c-'),kind:'scale',name:'新约束',value:'',unit:'',status:'unconfirmed',note:'',objectIds:[],decisionIds:[]}]})}>＋ 添加约束</button>

  <h2>质量场景</h2><p>按“刺激源 → 刺激 → 环境 → 响应 → 度量”描述，并写明如何验证。</p>
  {scenarios.map(s=><article key={s.id} id={'scenario-'+s.id} className={'analysis-card'+(focusId===s.id?' focused':'')}>
   <div className="analysis-head"><select aria-label="质量属性" value={s.attribute} onChange={e=>setS(s.id,{attribute:e.target.value as QualityScenario['attribute']})}>{Object.entries(ATTR_NAMES).map(([k,v])=><option key={k} value={k}>{v}</option>)}</select></div>
   {([['source','刺激源'],['stimulus','刺激'],['environment','环境'],['response','响应'],['measure','响应度量'],['verification','验证方法']] as const).map(([k,l])=><label key={k}>{l}<input aria-label={'场景'+l} value={s[k]} maxLength={2000} className={(k==='measure'||k==='verification')&&!s[k].trim()?'missing':''} onChange={e=>setS(s.id,{[k]:e.target.value})}/></label>)}
   <Links label="关联元素" options={nodes} value={s.objectIds} onChange={v=>setS(s.id,{objectIds:v})}/><Links label="影响的决策" options={decisions} value={s.decisionIds} onChange={v=>setS(s.id,{decisionIds:v})}/><Links label="验证证据" options={evOpts} value={s.evidenceIds} onChange={v=>setS(s.id,{evidenceIds:v})}/>
   <button className="text-button" onClick={()=>onChange({...design,scenarios:scenarios.filter(x=>x.id!==s.id),points:points.map(p=>({...p,scenarioIds:p.scenarioIds.filter(x=>x!==s.id)}))})}>删除场景</button>
  </article>)}
  <button className="wide-button" onClick={()=>onChange({...design,scenarios:[...scenarios,{id:newId('s-'),attribute:'availability',source:'',stimulus:'',environment:'',response:'',measure:'',verification:'',objectIds:[],decisionIds:[],evidenceIds:[]}]})}>＋ 添加质量场景</button>

  <h2>敏感点、权衡点与风险</h2>
  {points.map(p=><article key={p.id} id={'point-'+p.id} className={'analysis-card point-'+p.kind+(focusId===p.id?' focused':'')}>
   <div className="analysis-head"><select aria-label="分析点类型" value={p.kind} onChange={e=>setP(p.id,{kind:e.target.value as AnalysisPoint['kind']})}>{Object.entries(POINT_NAMES).map(([k,v])=><option key={k} value={k}>{v}</option>)}</select></div>
   <label>说明<input aria-label="分析点说明" value={p.text} maxLength={2000} onChange={e=>setP(p.id,{text:e.target.value})}/></label>
   <Links label="关联场景" options={scenOpts} value={p.scenarioIds} onChange={v=>setP(p.id,{scenarioIds:v})}/><Links label="关联元素" options={nodes} value={p.objectIds} onChange={v=>setP(p.id,{objectIds:v})}/><Links label="关联决策" options={decisions} value={p.decisionIds} onChange={v=>setP(p.id,{decisionIds:v})}/>
   <button className="text-button" onClick={()=>onChange({...design,points:points.filter(x=>x.id!==p.id)})}>删除</button>
  </article>)}
  <button className="wide-button" onClick={()=>onChange({...design,points:[...points,{id:newId('p-'),kind:'tradeoff',text:'新的权衡点',scenarioIds:[],objectIds:[],decisionIds:[]}]})}>＋ 添加分析点</button>
 </fieldset>;
}
