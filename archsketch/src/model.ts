import type { ElkNode } from 'elkjs/lib/elk-api';

export const KINDS = ['application', 'service', 'database', 'external'] as const;
export type ElementKind = typeof KINDS[number];
export type Position = { x: number; y: number };
export type ArchitectureElement = {
  id: string; name: string; kind: ElementKind; technology: string; description: string;
  requirementIds?: string[];
  c4Type?: 'person' | 'system' | 'container';
};
export type Relationship = { id: string; source: string; target: string; label: string };
export type Requirement = { id: string; text: string };
export type Assumption = { id: string; text: string; confirmed: boolean };
export type Boundary = { id: string; name: string; elementIds: string[] };
export type ArchitectureModel = {
  schemaVersion: 1; title: string;
  elements: ArchitectureElement[]; relationships: Relationship[];
  view: { positions: Record<string, Position> };
  requirements?: Requirement[];
  assumptions?: Assumption[];
  boundaries?: Boundary[];
};
export const NODE_WIDTH = 224;
export const NODE_HEIGHT = 100;
export function exampleModel(): ArchitectureModel {
  return {
    schemaVersion: 1, title: '企业应用技术架构',
    elements: [
      { id: 'web', name: 'Web 工作台', kind: 'application', technology: 'React · TypeScript', description: '用户交互与业务入口' },
      { id: 'gateway', name: 'API 网关', kind: 'service', technology: 'HTTP / REST', description: '统一 API 接入与请求路由' },
      { id: 'business', name: '业务服务', kind: 'service', technology: 'Domain services', description: '业务规则与流程编排' },
      { id: 'database', name: '业务数据库', kind: 'database', technology: 'PostgreSQL', description: '持久化业务数据' },
      { id: 'identity', name: '身份服务', kind: 'external', technology: 'OIDC', description: '外部身份认证提供方' },
    ],
    relationships: [
      { id: 'r1', source: 'web', target: 'gateway', label: 'HTTPS 请求' },
      { id: 'r2', source: 'gateway', target: 'business', label: '业务调用' },
      { id: 'r3', source: 'business', target: 'database', label: '读写数据' },
      { id: 'r4', source: 'gateway', target: 'identity', label: '验证身份' },
    ],
    view: { positions: {
      web: { x: 0, y: 160 }, gateway: { x: 304, y: 160 },
      business: { x: 608, y: 160 }, database: { x: 912, y: 160 }, identity: { x: 608, y: 0 },
    } },
  };
}

function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('模型结构无效');
  return value as Record<string, unknown>;
}

function text(value: unknown, field: string, max: number, required = false): string {
  if (typeof value !== 'string' || value.length > max || (required && !value.trim()) || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\ufffe\uffff]/u.test(value)) {
    throw new Error(`模型${field}无效或过长`);
  }
  return value;
}

export function parseModel(serialized: string): ArchitectureModel {
  let value: unknown;
  try { value = JSON.parse(serialized); } catch { throw new Error('JSON 格式无效'); }
  const data = object(value);
  if (data.schemaVersion !== 1) throw new Error('模型版本不支持，需 schemaVersion: 1');
  if (!Array.isArray(data.elements) || !Array.isArray(data.relationships) || data.elements.length > 200 || data.relationships.length > 1000) {
    throw new Error('模型需包含组件/关系数组，最多 200 个组件、1000 条关系');
  }
  const ids = new Set<string>();
  function id(value: unknown): string {
    const result = text(value, 'ID', 100, true);
    if (!/^[a-zA-Z0-9_-]+$/.test(result) || ids.has(result)) throw new Error('模型 ID 无效或重复');
    ids.add(result);
    return result;
  }
  function optionalArray(key: string, max: number): unknown[] | undefined {
    if (!Object.hasOwn(data, key)) return undefined;
    if (!Array.isArray(data[key]) || data[key].length > max) throw new Error(`模型${key}数组无效或过大`);
    return data[key];
  }
  const requirements = optionalArray('requirements', 50)?.map(value => {
    const item = object(value);
    return { id: id(item.id), text: text(item.text, '需求', 500, true) };
  });
  const requirementIds = new Set(requirements?.map(r => r.id));
  const assumptions = optionalArray('assumptions', 50)?.map(value => {
    const item = object(value);
    if (typeof item.confirmed !== 'boolean') throw new Error('模型假设确认状态无效');
    return { id: id(item.id), text: text(item.text, '假设', 500, true), confirmed: item.confirmed };
  });
  const elements: ArchitectureElement[] = data.elements.map(value => {
    const element = object(value);
    if (!KINDS.includes(element.kind as ElementKind)) throw new Error('模型组件类型无效');
    const result: ArchitectureElement = {
      id: id(element.id), name: text(element.name, '名称', 80, true), kind: element.kind as ElementKind,
      technology: text(element.technology, '技术', 100), description: text(element.description, '说明', 2000),
    };
    if (Object.hasOwn(element, 'requirementIds')) {
      if (!Array.isArray(element.requirementIds) || element.requirementIds.some(ref => typeof ref !== 'string' || !requirementIds.has(ref)) || new Set(element.requirementIds).size !== element.requirementIds.length) throw new Error('模型组件需求引用无效');
      result.requirementIds = element.requirementIds;
    }
    if (Object.hasOwn(element, 'c4Type')) {
      if (!['person', 'system', 'container'].includes(String(element.c4Type))) throw new Error('模型 C4 类型无效');
      result.c4Type = element.c4Type as ArchitectureElement['c4Type'];
    }
    return result;
  });
  const elementIds = new Set(elements.map(e => e.id));
  const relationships: Relationship[] = data.relationships.map(value => {
    const relation = object(value);
    if (typeof relation.source !== 'string' || typeof relation.target !== 'string' || !elementIds.has(relation.source) || !elementIds.has(relation.target)) {
      throw new Error('模型关系引用了不存在的组件');
    }
    return { id: id(relation.id), source: relation.source, target: relation.target, label: text(relation.label, '关系说明', 120) };
  });
  const positions = object(object(data.view).positions);
  if (Object.keys(positions).length !== elements.length || Object.keys(positions).some(key => !elementIds.has(key))) {
    throw new Error('模型位置必须与组件 ID 一一对应');
  }
  const entries = elements.map(element => {
    const position = object(positions[element.id]);
    if (typeof position.x !== 'number' || typeof position.y !== 'number' || !Number.isFinite(position.x) || !Number.isFinite(position.y) || Math.abs(position.x) > 1e6 || Math.abs(position.y) > 1e6) {
      throw new Error('模型位置需为有限坐标');
    }
    return [element.id, { x: position.x, y: position.y }] as const;
  });
  const owned = new Set<string>();
  const boundaries = optionalArray('boundaries', 20)?.map(value => {
    const boundary = object(value);
    // shortcut: flat boundaries with one owner per element; nested boundaries need a model/layout revision.
    if (!Array.isArray(boundary.elementIds) || !boundary.elementIds.length || boundary.elementIds.some(ref => typeof ref !== 'string' || !elementIds.has(ref) || owned.has(ref))) throw new Error('模型边界成员无效或重复归属');
    if (new Set(boundary.elementIds).size !== boundary.elementIds.length) throw new Error('模型边界成员重复');
    boundary.elementIds.forEach(ref => owned.add(ref));
    return { id: id(boundary.id), name: text(boundary.name, '边界名称', 80, true), elementIds: boundary.elementIds as string[] };
  });
  return {
    schemaVersion: 1, title: text(data.title, '名称', 120, true), elements, relationships, view: { positions: Object.fromEntries(entries) },
    ...(requirements === undefined ? {} : { requirements }), ...(assumptions === undefined ? {} : { assumptions }), ...(boundaries === undefined ? {} : { boundaries }),
  };
}

export function removeElements(model: ArchitectureModel, ids: string[]): ArchitectureModel {
  const removed = new Set(ids);
  return {
    ...model,
    elements: model.elements.filter(e => !removed.has(e.id)),
    relationships: model.relationships.filter(r => !removed.has(r.source) && !removed.has(r.target)),
    view: { positions: Object.fromEntries(Object.entries(model.view.positions).filter(([id]) => !removed.has(id))) },
    ...(model.boundaries ? { boundaries: model.boundaries.map(b => ({ ...b, elementIds: b.elementIds.filter(id => !removed.has(id)) })).filter(b => b.elementIds.length) } : {}),
  };
}

export async function layoutModel(model: ArchitectureModel, direction: 'RIGHT' | 'DOWN' | 'LEFT' | 'UP' = 'RIGHT'): Promise<ArchitectureModel> {
  if (!model.elements.length) return model;
  const { default: ELK } = await import('elkjs/lib/elk.bundled.js');
  const grouped = new Set(model.boundaries?.flatMap(b => b.elementIds));
  const node = (id: string) => ({ id, width: NODE_WIDTH, height: NODE_HEIGHT });
  let rootId = 'root';
  const ids = new Set([...model.elements.map(e => e.id), ...(model.boundaries?.map(b => b.id) || [])]);
  while (ids.has(rootId)) rootId += '_';
  const graph = await new ELK().layout({
    id: rootId, layoutOptions: { 'elk.algorithm': 'layered', 'elk.direction': direction, 'elk.hierarchyHandling': 'INCLUDE_CHILDREN', 'elk.spacing.nodeNode': '60', 'elk.layered.spacing.nodeNodeBetweenLayers': '90' },
    children: [...model.elements.filter(e => !grouped.has(e.id)).map(e => node(e.id)), ...(model.boundaries?.map(b => ({ id: b.id, children: b.elementIds.map(node), layoutOptions: { 'elk.algorithm': 'layered', 'elk.direction': direction, 'elk.spacing.nodeNode': '60', 'elk.layered.spacing.nodeNodeBetweenLayers': '100', 'elk.padding': '[top=50,left=30,bottom=30,right=30]' } })) || [])],
    edges: model.relationships.map(r => ({ id: r.id, sources: [r.source], targets: [r.target] })),
  });
  const positions: Record<string, Position> = {};
  function collect(nodes: ElkNode[], x = 0, y = 0) {
    for (const n of nodes) {
      const point = { x: x + (n.x ?? 0), y: y + (n.y ?? 0) };
      if (n.children) collect(n.children, point.x, point.y); else positions[n.id] = point;
    }
  }
  collect(graph.children || []);
  return { ...model, view: { positions } };
}

export function boundaryBoxes(model: ArchitectureModel) {
  return (model.boundaries || []).map(b => {
    const positions = b.elementIds.map(id => model.view.positions[id]);
    const x = Math.min(...positions.map(p => p.x)) - 26;
    const y = Math.min(...positions.map(p => p.y)) - 44;
    return { ...b, x, y, width: Math.max(...positions.map(p => p.x + NODE_WIDTH)) - x + 26, height: Math.max(...positions.map(p => p.y + NODE_HEIGHT)) - y + 26 };
  });
}

const escapeXml = (value: string) => value.replace(/[<>&"']/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;' })[c]!);
function lines(value: string, size: number): string[] {
  const chars = Array.from(value);
  return Array.from({ length: Math.ceil(chars.length / size) }, (_, i) => chars.slice(i * size, (i + 1) * size).join(''));
}

export function toSvg(model: ArchitectureModel): string {
  const boxes = boundaryBoxes(model);
  const points = [...Object.values(model.view.positions), ...boxes.map(b => ({ x: b.x, y: b.y })), ...boxes.map(b => ({ x: b.x + b.width - NODE_WIDTH, y: b.y + b.height - NODE_HEIGHT }))];
  const left = Math.min(0, ...points.map(p => p.x)) - 70;
  const top = Math.min(0, ...points.map(p => p.y)) - 90;
  const width = Math.max(NODE_WIDTH, ...points.map(p => p.x + NODE_WIDTH)) - left + 70;
  const height = Math.max(NODE_HEIGHT, ...points.map(p => p.y + NODE_HEIGHT)) - top + 70;
  const palette = { application: '#4c6fff', service: '#059b91', database: '#b078ec', external: '#d99536' };
  const boundaries = boxes.map(b => `<g data-boundary-id="${escapeXml(b.id)}"><rect x="${b.x}" y="${b.y}" width="${b.width}" height="${b.height}" fill="#edf3ff" stroke="#8aa4d5" stroke-dasharray="6 4" rx="12"/><text x="${b.x + 16}" y="${b.y + 26}" font-size="13" fill="#536f9c">${escapeXml(b.name)}</text></g>`).join('');
  const edges = model.relationships.map(r => {
    const a = model.view.positions[r.source], b = model.view.positions[r.target];
    const x1 = a.x + NODE_WIDTH, y1 = a.y + NODE_HEIGHT / 2, x2 = b.x, y2 = b.y + NODE_HEIGHT / 2;
    const curve = Math.max(60, Math.abs(x2 - x1) / 2);
    return `<g><path d="M${x1} ${y1} C${x1 + curve} ${y1},${x2 - curve} ${y2},${x2} ${y2}" fill="none" stroke="#8290ac" stroke-width="2" marker-end="url(#arrow)"/><text x="${(x1 + x2) / 2}" y="${(y1 + y2) / 2 - 12}" text-anchor="middle" font-size="12" fill="#52617a">${escapeXml(r.label)}</text></g>`;
  }).join('');
  const nodes = model.elements.map(e => {
    const p = model.view.positions[e.id];
    const nameLines = lines(e.name, 16);
    // shortcut: fixed-size cards show two name lines; full text remains in SVG title and JSON.
    const visibleName = nameLines.slice(0, 2).map((line, i) => `<tspan x="20" y="${35 + i * 20}">${escapeXml(line + (i === 1 && nameLines.length > 2 ? '…' : ''))}</tspan>`).join('');
    const tech = Array.from(e.technology).slice(0, 26).join('') + (Array.from(e.technology).length > 26 ? '…' : '');
    return `<g data-element-id="${escapeXml(e.id)}" transform="translate(${p.x} ${p.y})"><title>${escapeXml(e.name + '\n' + e.technology + '\n' + e.description)}</title><rect width="${NODE_WIDTH}" height="${NODE_HEIGHT}" rx="12" fill="white" stroke="#dce2ed"/><rect width="4" height="${NODE_HEIGHT}" rx="2" fill="${palette[e.kind]}"/><text font-size="16" font-weight="600" fill="#18243d">${visibleName}</text><text x="20" y="82" font-size="12" fill="#63718a">${escapeXml(tech)}</text></g>`;
  }).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${left} ${top} ${width} ${height}" width="${width}" height="${height}" font-family="system-ui, sans-serif"><title>${escapeXml(model.title)}</title><defs><marker id="arrow" viewBox="0 0 10 10" refX="10" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0 L10 5 L0 10 Z" fill="#8290ac"/></marker></defs><rect x="${left}" y="${top}" width="${width}" height="${height}" fill="#f7f9fc"/><text x="${left + 32}" y="${top + 42}" font-size="20" font-weight="700" fill="#18243d">${escapeXml(model.title)}</text>${boundaries}${edges}${nodes}</svg>`;
}
