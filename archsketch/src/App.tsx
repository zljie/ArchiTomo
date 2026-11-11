import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ReactFlow, ReactFlowProvider, Background, Controls, MiniMap, Handle, Position,
  MarkerType, useReactFlow, type Node, type NodeProps, type NodeChange, type EdgeChange, type Connection,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { exampleModel, parseModel, removeElements, layoutModel, toSvg, boundaryBoxes, KINDS, NODE_WIDTH, NODE_HEIGHT, type ArchitectureModel, type ArchitectureElement, type ElementKind } from './model';
import { inspectModel, updateRequirements } from './planning';
import { createTemplate, TEMPLATES, type TemplateId } from './templates';

const STORAGE_KEY = 'archsketch:model:v1';
const kindLabels: Record<ElementKind, string> = { application: '应用', service: '服务', database: '数据库', external: '外部系统' };
const kindSymbols: Record<ElementKind, string> = { application: '▣', service: '◇', database: '▤', external: '↗' };
type ComponentNode = Node<ArchitectureElement, 'component'>;
type Selection = { kind: 'element' | 'relationship'; id: string } | null;

function ArchitectureNode({ data }: NodeProps<ComponentNode>) {
  return <div className={`architecture-node ${data.kind}`} title={`${data.name}\n${data.technology}\n${data.description}`}>
    <Handle type="target" position={Position.Left} />
    <div className="node-top"><span className="node-symbol">{kindSymbols[data.kind]}</span><span>{data.c4Type ? ({ person: '人员', system: '外部软件系统', container: '容器' })[data.c4Type] : kindLabels[data.kind]}</span>{!!data.requirementIds?.length && <span className="node-trace">{data.requirementIds.length} 需求</span>}</div>
    <strong>{data.name}</strong><small>{data.technology || '未指定技术'}</small>
    <Handle type="source" position={Position.Right} />
  </div>;
}
function BoundaryNode({ data }: NodeProps<Node<{ label: string }, 'boundary'>>) { return <div className="boundary-label">{data.label}</div>; }
const nodeTypes = { component: ArchitectureNode, boundary: BoundaryNode };

function initialDocument() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    const model = saved ? parseModel(saved) : exampleModel();
    return { model, saved: saved ? JSON.stringify(model) : '', error: '' };
  } catch {
    return { model: exampleModel(), saved: '', error: '本机设计无法读取，已显示示例。原存储未覆盖；可先导出原存储备份。' };
  }
}

function download(content: string, type: string, filename: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function Workspace() {
  const [initial] = useState(initialDocument);
  const [model, setModel] = useState<ArchitectureModel>(initial.model);
  const [saved, setSaved] = useState(initial.saved);
  const [selection, setSelection] = useState<Selection>(null);
  const [message, setMessage] = useState(initial.error);
  const [busy, setBusy] = useState(false);
  const [recovery, setRecovery] = useState(!!initial.error);
  const [panel, setPanel] = useState<'properties' | 'requirements' | 'review'>('properties');
  const [draftRequirements, setDraftRequirements] = useState((initial.model.requirements || []).map(r => r.text).join('\n'));
  const [template, setTemplate] = useState<TemplateId>('technical');
  const [ai, setAi] = useState({ configured: false, model: '', service: '' });
  const [showSetup, setShowSetup] = useState(false);
  const generation = useRef<AbortController | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const flow = useReactFlow();
  const requirementsDirty = draftRequirements !== (model.requirements || []).map(r => r.text).join('\n');
  const dirty = JSON.stringify(model) !== saved || requirementsDirty;
  const element = selection?.kind === 'element' ? model.elements.find(e => e.id === selection.id) : undefined;
  const relationship = selection?.kind === 'relationship' ? model.relationships.find(e => e.id === selection.id) : undefined;
  const issues = useMemo(() => inspectModel(model), [model]);
  const nodes = useMemo<Node[]>(() => [
    ...boundaryBoxes(model).map(b => ({ id: b.id, type: 'boundary', data: { label: b.name }, ariaLabel: b.name, position: { x: b.x, y: b.y }, initialWidth: b.width, initialHeight: b.height, draggable: false, selectable: false, connectable: false, zIndex: -1, style: { width: b.width, height: b.height, pointerEvents: 'none' as const, background: '#edf3ff', border: '1px dashed #8aa4d5', borderRadius: 12, fontSize: 11, color: '#536f9c', textAlign: 'left' as const, padding: '12px 16px' } })),
    ...model.elements.map(e => ({ id: e.id, type: 'component', data: e, ariaLabel: e.name, initialWidth: NODE_WIDTH, initialHeight: NODE_HEIGHT, position: model.view.positions[e.id], selected: selection?.kind === 'element' && selection.id === e.id, zIndex: 1, style: { width: NODE_WIDTH, height: NODE_HEIGHT } })),
  ], [model, selection]);
  const edges = useMemo(() => model.relationships.map(r => ({ ...r, selected: selection?.kind === 'relationship' && selection.id === r.id, type: 'default', markerEnd: { type: MarkerType.ArrowClosed, width: 18, height: 18 }, style: { stroke: '#93a0ba', strokeWidth: 1.7 }, labelStyle: { fontSize: 11, fill: '#64728b' }, labelBgStyle: { fill: '#f7f9fc' } })), [model, selection]);

  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  useEffect(() => {
    let timer: number;
    const resize = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => void flow.fitView({ padding: 0.2 }), 120);
    };
    window.addEventListener('resize', resize);
    return () => { window.clearTimeout(timer); window.removeEventListener('resize', resize); };
  }, [flow]);

  useEffect(() => { setDraftRequirements((model.requirements || []).map(r => r.text).join('\n')); }, [model.requirements]);
  useEffect(() => {
    const controller = new AbortController();
    void fetch('/api/ai/status', { signal: controller.signal }).then(r => r.ok ? r.json() : Promise.reject()).then(setAi).catch(() => {});
    return () => { controller.abort(); generation.current?.abort(); };
  }, []);

  function edit(update: (current: ArchitectureModel) => ArchitectureModel) { setModel(update); setMessage(''); }
  function updateElement(patch: Partial<ArchitectureElement>) {
    if (!element) return;
    edit(m => ({ ...m, elements: m.elements.map(e => e.id === element.id ? { ...e, ...patch } : e) }));
  }
  function addElement(kind: ElementKind) {
    if (model.elements.length >= 200) { setMessage('最多支持 200 个组件。'); return; }
    const id = crypto.randomUUID();
    const p = flow.screenToFlowPosition({ x: window.innerWidth / 2, y: window.innerHeight / 2 });
    const offset = model.elements.length % 5 * 25;
    edit(m => ({ ...m, elements: [...m.elements, { id, kind, name: `新${kindLabels[kind]}`, technology: '', description: '' }], view: { positions: { ...m.view.positions, [id]: { x: p.x - NODE_WIDTH / 2 + offset, y: p.y - NODE_HEIGHT / 2 + offset } } } }));
    setSelection({ kind: 'element', id });
  }
  function changeNodes(changes: NodeChange[]) {
    if (busy) return;
    const removed = changes.filter(c => c.type === 'remove').map(c => c.id);
    const moved = changes.filter(c => c.type === 'position' && c.position);
    if (!removed.length && !moved.length) return;
    edit(current => {
      const result = removeElements(current, removed);
      const positions = { ...result.view.positions };
      for (const change of moved) if (change.type === 'position' && change.position && Object.hasOwn(positions, change.id)) positions[change.id] = change.position;
      return { ...result, view: { positions } };
    });
    if (selection && removed.includes(selection.id)) setSelection(null);
  }
  function changeEdges(changes: EdgeChange[]) {
    if (busy) return;
    const removed = changes.filter(c => c.type === 'remove').map(c => c.id);
    if (removed.length) edit(m => ({ ...m, relationships: m.relationships.filter(r => !removed.includes(r.id)) }));
  }
  function connect(connection: Connection) {
    if (!connection.source || !connection.target) return;
    if (model.relationships.length >= 1000) { setMessage('最多支持 1000 条关系。'); return; }
    if (model.relationships.some(r => r.source === connection.source && r.target === connection.target)) { setMessage('这两个组件之间已有同方向关系，可选择连线编辑说明。'); return; }
    edit(m => ({ ...m, relationships: [...m.relationships, { id: crypto.randomUUID(), source: connection.source!, target: connection.target!, label: '调用' }] }));
  }
  async function autoLayout() {
    setBusy(true); setMessage('正在计算布局…');
    const snapshot = model;
    try {
      const result = await layoutModel(snapshot);
      setModel(current => current === snapshot ? result : current);
      setMessage('自动布局完成');
      requestAnimationFrame(() => flow.fitView({ padding: 0.2, duration: 250 }));
    } catch { setMessage('自动布局失败，原设计已保留。'); }
    finally { setBusy(false); }
  }
  function save() {
    try {
      const valid = parseModel(JSON.stringify(requirementsDirty ? updateRequirements(model, draftRequirements) : model));
      const serialized = JSON.stringify(valid);
      if (recovery && !window.confirm('覆盖无法读取的原本机设计？建议先导出原存储备份。')) return;
      localStorage.setItem(STORAGE_KEY, serialized);
      setModel(valid); setSaved(serialized); setRecovery(false); setMessage('已保存到此浏览器');
    } catch (error) { setMessage(error instanceof Error ? `保存失败：${error.message}` : '保存失败；请导出 JSON 备份。'); }
  }
  async function importFile(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    try {
      if (file.size > 1024 * 1024) throw new Error('文件超过 1 MB');
      const incoming = parseModel(await file.text());
      if (dirty && !window.confirm('当前设计有未保存更改，确认用导入模型替换？')) return;
      setModel(incoming); setSelection(null); setMessage('导入成功；点击本机保存以保留此设计。');
      requestAnimationFrame(() => flow.fitView({ padding: 0.2, duration: 250 }));
    } catch (error) { setMessage(`导入失败，当前设计未变：${error instanceof Error ? error.message : '无法读取文件'}`); }
    finally { setBusy(false); if (input.current) input.current.value = ''; }
  }
  function exportFile(format: 'json' | 'svg') {
    try {
      const valid = parseModel(JSON.stringify(model));
      download(format === 'json' ? JSON.stringify(valid, null, 2) : toSvg(valid), format === 'json' ? 'application/json' : 'image/svg+xml', `archsketch.${format}`);
      setMessage(`已导出 ${format.toUpperCase()}`);
    } catch (error) { setMessage(`导出失败：${error instanceof Error ? error.message : '模型无效'}`); }
  }
  async function reset(id: TemplateId = template) {
    if (dirty && !window.confirm('当前设计有未保存更改，确认载入模板？')) return;
    setBusy(true);
    try {
      const next = await layoutModel(createTemplate(id));
      setModel(next); setSelection(null); setTemplate(id); setMessage('已载入模板；这不是 AI 生成，尚未覆盖本机保存。');
      requestAnimationFrame(() => flow.fitView({ padding: 0.2, duration: 250 }));
    } catch { setMessage('模板布局失败，当前设计未变。'); }
    finally { setBusy(false); }
  }

  function applyRequirements() {
    try { edit(m => updateRequirements(m, draftRequirements)); setMessage('已更新需求清单；未改需求的 ID 和关联已保留。'); }
    catch (error) { setMessage(error instanceof Error ? error.message : '需求无效'); }
  }

  async function generate() {
    const controller = new AbortController();
    generation.current = controller; setBusy(true); setMessage('模型正在推导架构…');
    try {
      const response = await fetch('/api/ai/generate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ requirements: draftRequirements, template }), signal: controller.signal });
      const result = await response.json();
      if (!response.ok) throw new Error(typeof result.error === 'string' ? result.error : '模型服务调用失败');
      const candidate = await layoutModel(parseModel(JSON.stringify(result.model)));
      if (controller.signal.aborted) return;
      if (dirty && !window.confirm('AI 草稿已生成，确认替换当前未保存设计？')) { setMessage('已保留当前设计，未应用 AI 草稿。'); return; }
      setModel(candidate); setSelection(null); setPanel('review');
      setMessage('AI 草稿已生成；请核对需求覆盖并确认设计假设。');
      requestAnimationFrame(() => flow.fitView({ padding: 0.2, duration: 250 }));
    } catch (error) { setMessage(controller.signal.aborted ? '生成已取消，当前设计未变。' : `生成失败，当前设计未变：${error instanceof Error ? error.message : '无法连接服务'}`); }
    finally { generation.current = null; setBusy(false); }
  }

  return <div className="studio">
    <header className="topbar">
      <a className="brand" href="#" aria-label="ArchSketch 工作台"><span className="brand-mark">A<span>↗</span></span><span>Arch<span className="brand-light">Sketch</span><small>架构设计工作台</small></span></a>
      <div className="document-heading"><span className="document-icon">▧</span><input aria-label="设计名称" maxLength={120} value={model.title} disabled={busy} onChange={e => edit(m => ({ ...m, title: e.target.value }))} /><span className={`save-state ${dirty ? 'unsaved' : ''}`}>{dirty ? '未保存' : '已保存'}</span></div>
      <div className="header-actions"><button className="design-action" onClick={() => setPanel('requirements')}>需求建模</button><button disabled={busy} onClick={save}>本机保存</button><button className="primary" disabled={busy} onClick={() => exportFile('svg')}>导出 SVG <span>↗</span></button></div>
    </header>
    <div className="workspace">
      <aside className="library" aria-label="组件库">
        <div className="panel-eyebrow">DESIGN TOOLKIT</div><h2>组件库 <span className="badge">4</span></h2><p className="panel-intro">从组件开始，让系统结构清晰可见。</p>
        <div className="section-label">添加组件</div>
        <div className="component-library">{KINDS.map(kind => <button key={kind} className={`library-item ${kind}`} disabled={busy} onClick={() => addElement(kind)}><span className="component-icon">{kindSymbols[kind]}</span><span><strong>{kindLabels[kind]}</strong><small>{{ application: '用户界面与应用入口', service: '业务服务与处理能力', database: '数据存储与持久化', external: '外部系统与第三方集成' }[kind]}</small></span><span className="plus">＋</span></button>)}</div>
        <div className="library-divider" /><div className="section-label">专业模板</div>
        <div className="template-list">{TEMPLATES.map(t => <button key={t.id} disabled={busy} title={t.description} onClick={() => void reset(t.id)}>{t.name}<span>↗</span></button>)}</div>
        <div className="library-divider" /><div className="section-label">设计资产</div>
        <button className="asset-button" disabled={busy} onClick={() => input.current?.click()}>↓ 导入 JSON <span>模型</span></button>
        <button className="asset-button" disabled={busy} onClick={() => exportFile('json')}>↑ 导出 JSON <span>备份</span></button>
        <button className="asset-button" disabled={busy} onClick={() => void reset()}>↻ 载入示例 <span>模板</span></button>
        <input ref={input} aria-label="导入架构模型文件" className="file-input" type="file" accept="application/json,.json" disabled={busy} onChange={e => void importFile(e.target.files?.[0])} />
        {recovery && <button className="asset-button" onClick={() => { try { download(localStorage.getItem(STORAGE_KEY) || '', 'text/plain', 'archsketch-recovery.txt'); } catch { setMessage('无法读取原存储。'); } }}>导出原存储备份</button>}
        <div className="model-note"><span>◇</span><strong>模型优先 · 需求可追溯</strong><p>从需求生成可编辑草稿，按组件核对来源与设计假设。</p><small>本机保存 · AI 服务按配置调用</small></div>
      </aside>
      <main className="canvas-area" aria-label="架构画布">
        <div className="canvas-toolbar"><div><span className="view-label">架构视图</span><span className="toolbar-count">{model.elements.length} 个组件 / {model.relationships.length} 条关系</span></div><button disabled={busy || !model.elements.length} onClick={() => void autoLayout()}>{busy ? '处理中…' : '✧ 自动布局'}</button></div>
        <div className="canvas">
          <ReactFlow nodes={nodes} edges={edges} nodeTypes={nodeTypes} onNodesChange={changeNodes} onEdgesChange={changeEdges} onConnect={connect} onNodeClick={(_, node) => { setSelection({ kind: 'element', id: node.id }); setPanel('properties'); }} onEdgeClick={(_, edge) => { setSelection({ kind: 'relationship', id: edge.id }); setPanel('properties'); }} onPaneClick={() => setSelection(null)} nodesDraggable={!busy} nodesConnectable={!busy} elementsSelectable={!busy} deleteKeyCode={busy ? null : ['Backspace', 'Delete']} fitView fitViewOptions={{ padding: 0.2 }} minZoom={0.15} maxZoom={2} proOptions={{ hideAttribution: false }} ariaLabelConfig={{ 'controls.zoomIn.ariaLabel': '放大画布', 'controls.zoomOut.ariaLabel': '缩小画布', 'controls.fitView.ariaLabel': '适应画布', 'controls.interactive.ariaLabel': '切换画布交互' }}>
            <Background color="#d9e0ec" gap={24} size={1} /><Controls showInteractive={false} /><MiniMap style={{ width: 125, height: 80 }} nodeColor={n => ({ application: '#8c9fff', service: '#58c5b9', database: '#b99ce4', external: '#e5b36c' })[n.data.kind as ElementKind]} maskColor="rgba(239,242,249,.6)" pannable zoomable />
          </ReactFlow>
          {!model.elements.length && <div className="empty-canvas"><div>◇</div><h2>从第一个组件开始</h2><p>点击左侧组件类型，将你的架构想法放到画布上。</p></div>}
          <div className="canvas-hint">拖动组件调整位置 · 从右侧连接点拖到左侧建立关系</div>
        </div>
      </main>
      <aside className="inspector" aria-label="属性面板">
        <div className="panel-eyebrow">DESIGN INSPECTOR</div>
        <div className="inspector-tabs" role="tablist" aria-label="设计面板">
          <button role="tab" aria-selected={panel === 'properties'} onClick={() => setPanel('properties')}>属性</button>
          <button role="tab" aria-selected={panel === 'requirements'} onClick={() => setPanel('requirements')}>需求</button>
          <button role="tab" aria-selected={panel === 'review'} onClick={() => setPanel('review')}>检查 {issues.length || ''}</button>
        </div>
        {panel === 'properties' && <><h2>{relationship ? '关系属性' : '组件属性'}</h2>
        <fieldset disabled={busy}>
          {element ? <><div className={`inspector-type ${element.kind}`}><span>{kindSymbols[element.kind]}</span>{kindLabels[element.kind]}</div><label>组件名称<input aria-label="组件名称" maxLength={80} value={element.name} onChange={e => updateElement({ name: e.target.value })} /></label><label>组件类型<select aria-label="组件类型" value={element.kind} onChange={e => updateElement({ kind: e.target.value as ElementKind })}>{KINDS.map(k => <option key={k} value={k}>{kindLabels[k]}</option>)}</select></label><label>技术 / 协议<input aria-label="技术或协议" maxLength={100} value={element.technology} placeholder="例如 React / REST" onChange={e => updateElement({ technology: e.target.value })} /></label><label>职责说明<textarea aria-label="职责说明" maxLength={2000} rows={4} value={element.description} placeholder="这个组件承担什么职责？" onChange={e => updateElement({ description: e.target.value })} /></label><div className="property-id">稳定 ID <code>{element.id}</code></div><button className="delete-button" onClick={() => { edit(m => removeElements(m, [element.id])); setSelection(null); }}>删除组件及关联关系</button></> : relationship ? <><div className="relationship-endpoints"><strong>{model.elements.find(e => e.id === relationship.source)?.name}</strong><span>↓</span><strong>{model.elements.find(e => e.id === relationship.target)?.name}</strong></div><label>关系说明<input aria-label="关系说明" maxLength={120} value={relationship.label} onChange={e => edit(m => ({ ...m, relationships: m.relationships.map(r => r.id === relationship.id ? { ...r, label: e.target.value } : r) }))} /></label><div className="property-id">稳定 ID <code>{relationship.id}</code></div><button className="delete-button" onClick={() => { edit(m => ({ ...m, relationships: m.relationships.filter(r => r.id !== relationship.id) })); setSelection(null); }}>删除关系</button></> : <div className="inspector-empty"><span>⌖</span><h3>选择一个组件或关系</h3><p>在画布中点击组件或连线，在这里编辑名称、技术与职责。</p></div>}
        </fieldset>
        {element && <fieldset disabled={busy} className="trace-links"><legend>关联需求</legend>{model.requirements?.length ? model.requirements.map(r => <label key={r.id}><input type="checkbox" aria-label={`关联需求：${r.text}`} checked={!!element.requirementIds?.includes(r.id)} onChange={e => updateElement({ requirementIds: e.target.checked ? [...(element.requirementIds || []), r.id] : (element.requirementIds || []).filter(id => id !== r.id) })} /><span>{r.text}<small>{r.id}</small></span></label>) : <p>先在“需求”中录入设计目标。</p>}</fieldset>}
        {element?.c4Type && <label className="c4-property">C4 角色<select aria-label="C4 角色" disabled={busy} value={element.c4Type} onChange={e => updateElement({ c4Type: e.target.value as ArchitectureElement['c4Type'] })}><option value="person">人员</option><option value="system">软件系统</option><option value="container">容器</option></select></label>}
        </>}
        {panel === 'requirements' && <div className="requirements-panel">
          <h2>从需求开始设计</h2><p className="panel-intro">每行一条需求，可包含业务能力、约束与规模。</p>
          <label>原始需求<textarea aria-label="原始需求" rows={10} maxLength={8000} disabled={busy} value={draftRequirements} placeholder={'用户可以管理采购订单\n供应商协同与审批\n采用 React + Java，支持多租户'} onChange={e => setDraftRequirements(e.target.value)} /></label>
          <button className="wide-button" disabled={busy} onClick={applyRequirements}>更新需求清单</button>
          <label>图纸类型<select aria-label="AI 图纸类型" value={template} disabled={busy} onChange={e => setTemplate(e.target.value as TemplateId)}>{TEMPLATES.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}</select></label>
          <div className="ai-status">{ai.configured ? `已配置 · ${ai.model}` : 'AI 尚未配置'}<button onClick={() => setShowSetup(!showSetup)}>接入说明</button></div>
          {showSetup && <div className="setup-note">默认使用 DeepSeek。在应用目录的 <code>.env.local</code> 填写密钥后重启；没有此文件时复制 <code>.env.example</code>。密钥仅留在本机服务端。其他 OpenAI 兼容服务可按 README 配置。ChatGPT 套餐登录（SIWC）尚未接入。</div>}
          <p className="ai-destination">{ai.configured ? `生成时将这些需求发送至 ${ai.service}` : '模板与手工编辑无需 AI 配置'}</p>
          <button className="primary wide-button" disabled={busy || !ai.configured || !draftRequirements.trim()} onClick={() => void generate()}>AI 生成架构草稿</button>
          {generation.current && <button className="wide-button" onClick={() => generation.current?.abort()}>取消生成</button>}
        </div>}
        {panel === 'review' && <div className="review-panel"><h2>完整性与追溯检查</h2><p className="panel-intro">{issues.length ? `${issues.length} 项待复核` : '完整性检查通过；架构合理性仍需人工判断。'}</p>
          <div className="issue-list">{issues.map(issue => <button key={issue.id} disabled={busy || !issue.elementId} onClick={() => { if (issue.elementId) { setSelection({ kind: 'element', id: issue.elementId }); setPanel('properties'); } }}>{issue.message}</button>)}</div>
          {!!model.assumptions?.length && <fieldset disabled={busy} className="assumption-list"><legend>设计假设 · 由架构师确认</legend>{model.assumptions.map(a => <label key={a.id}><input type="checkbox" aria-label={`确认假设：${a.text}`} checked={a.confirmed} onChange={e => edit(m => ({ ...m, assumptions: m.assumptions?.map(item => item.id === a.id ? { ...item, confirmed: e.target.checked } : item) }))} /><span>{a.text}</span></label>)}</fieldset>}
        </div>}
        <div className="review-note"><span className="section-label">设计提示</span><p>需求覆盖、组件职责与边界需要逐项核对。AI 草稿和完整性检查不能替代架构师最终评审。</p></div>
      </aside>
    </div>
    <footer className="statusbar"><span className="status-message" role="status" aria-live="polite"><span className="status-dot" />{message || '工作台就绪'}</span><span>ArchSketch <span className="footer-version">v0.2</span><span className="footer-divider">/</span>Model first. Design clearly.</span></footer>
  </div>;
}

export default function App() { return <ReactFlowProvider><Workspace /></ReactFlowProvider>; }
