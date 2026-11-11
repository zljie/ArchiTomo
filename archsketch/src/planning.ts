import { parseModel, type ArchitectureModel, type Requirement } from './model.ts';
export type ModelIssue = { id: string; message: string; elementId?: string; requirementId?: string };
const string = { type: 'string' };
const strings = { type: 'array', items: string };
const objectSchema = (properties: Record<string, unknown>) => ({ type: 'object', properties, required: Object.keys(properties), additionalProperties: false });
export const BLUEPRINT_SCHEMA = objectSchema({
  title: string,
  elements: { type: 'array', items: objectSchema({ id: string, name: string, kind: { type: 'string', enum: ['application', 'service', 'database', 'external'] }, technology: string, description: string, requirementIds: strings, c4Type: { type: 'string', enum: ['none', 'person', 'system', 'container'] } }) },
  relationships: { type: 'array', items: objectSchema({ id: string, source: string, target: string, label: string }) },
  boundaries: { type: 'array', items: objectSchema({ id: string, name: string, elementIds: strings }) },
  assumptions: { type: 'array', items: objectSchema({ id: string, text: string }) },
});

export function parseRequirements(input: string): Requirement[] {
  if (typeof input !== 'string' || input.length > 8000) throw new Error('需求最多 8000 字符');
  const lines = input.split('\n').map(s => s.trim()).filter(Boolean);
  if (!lines.length || lines.length > 50 || lines.some(s => s.length > 500)) throw new Error('需求须为 1～50 条，每条最多 500 字符');
  if (new Set(lines).size !== lines.length) throw new Error('需求内容重复，请合并重复条目');
  return lines.map((text, i) => ({ id: `RQ-${String(i + 1).padStart(2, '0')}`, text }));
}

export function updateRequirements(model: ArchitectureModel, input: string): ArchitectureModel {
  const parsed = input.trim() ? parseRequirements(input) : [];
  const old = new Map(model.requirements?.map(r => [r.text, r.id]));
  const requirements = parsed.map(r => ({ ...r, id: old.get(r.text) || `RQ-${crypto.randomUUID()}` }));
  const ids = new Set(requirements.map(r => r.id));
  return { ...model, requirements, elements: model.elements.map(e => ({ ...e, ...(e.requirementIds ? { requirementIds: e.requirementIds.filter(id => ids.has(id)) } : {}) })) };
}

export function modelFromBlueprint(value: unknown, requirements: Requirement[]): ArchitectureModel {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('AI 模型结构无效');
  const data = value as Record<string, unknown>;
  if (!Array.isArray(data.elements) || !data.elements.length || !Array.isArray(data.assumptions) || !Array.isArray(data.boundaries) || !Array.isArray(data.relationships)) throw new Error('AI 模型缺少组件/关系/边界/假设数组');
  const elements = data.elements.map(element => {
    if (!element || typeof element !== 'object' || !Array.isArray(element.requirementIds) || !element.requirementIds.length) throw new Error('每个 AI 组件必须关联原始需求');
    const { c4Type, ...rest } = element;
    return { ...rest, ...(c4Type && c4Type !== 'none' ? { c4Type } : {}) };
  });
  return parseModel(JSON.stringify({
    schemaVersion: 1, title: data.title, elements, relationships: data.relationships, boundaries: data.boundaries,
    requirements, assumptions: data.assumptions.map(a => ({ ...a, confirmed: false })),
    view: { positions: Object.fromEntries(elements.map((e, i) => [e.id, { x: i * 300, y: 0 }])) },
  }));
}

export function inspectModel(model: ArchitectureModel): ModelIssue[] {
  const issues: ModelIssue[] = [];
  if (!model.requirements?.length) issues.push({ id: 'no-requirements', message: '尚未录入需求，无法检查需求覆盖' });
  for (const r of model.requirements || []) if (!model.elements.some(e => e.requirementIds?.includes(r.id))) issues.push({ id: `requirement:${r.id}`, requirementId: r.id, message: `需求未覆盖：${r.text}` });
  for (const e of model.elements) {
    if (model.requirements?.length && !e.requirementIds?.length) issues.push({ id: `source:${e.id}`, elementId: e.id, message: `组件未关联需求：${e.name}` });
    if (model.elements.length > 1 && !model.relationships.some(r => r.source === e.id || r.target === e.id)) issues.push({ id: `isolated:${e.id}`, elementId: e.id, message: `孤立组件：${e.name}` });
  }
  for (const a of model.assumptions || []) if (!a.confirmed) issues.push({ id: `assumption:${a.id}`, message: `假设待确认：${a.text}` });
  return issues;
}
