import { exampleModel, type ArchitectureModel } from './model.ts';
export const TEMPLATES = [
  { id: 'technical', name: '技术架构', description: '应用、服务、数据与外部集成' },
  { id: 'functional', name: '应用功能架构', description: '用户能力、业务模块与职责分工' },
  { id: 'c4', name: 'C4 容器示例', description: '人员、容器、外部系统与系统边界' },
] as const;
export type TemplateId = typeof TEMPLATES[number]['id'];
export function createTemplate(id: TemplateId): ArchitectureModel {
  if (id === 'technical') return exampleModel();
  const functional = id === 'functional';
  const elements: ArchitectureModel['elements'] = functional ? [
    { id: 'portal', name: '业务门户', kind: 'application', technology: '用户工作台', description: '统一业务入口' },
    { id: 'orders', name: '订单管理', kind: 'service', technology: '订单领域', description: '订单创建、变更与查询' },
    { id: 'suppliers', name: '供应商管理', kind: 'service', technology: '供应商领域', description: '供应商资料与协同' },
    { id: 'approval', name: '审批中心', kind: 'service', technology: '工作流', description: '业务审批与处理记录' },
    { id: 'report', name: '经营分析', kind: 'application', technology: '指标与报表', description: '汇总业务指标与运营状态' },
  ] : [
    { id: 'person', name: '业务用户', kind: 'external', c4Type: 'person', technology: '人员', description: '通过浏览器使用采购系统' },
    { id: 'web', name: 'Web 应用', kind: 'application', c4Type: 'container', technology: 'React', description: '用户界面与交互' },
    { id: 'api', name: '应用服务', kind: 'service', c4Type: 'container', technology: 'REST API', description: '采购业务能力' },
    { id: 'data', name: '业务数据库', kind: 'database', c4Type: 'container', technology: 'PostgreSQL', description: '业务数据持久化' },
    { id: 'identity', name: '身份平台', kind: 'external', c4Type: 'system', technology: 'OIDC', description: '外部身份认证系统' },
  ];
  const relations = functional ? [['portal', 'orders', '管理订单'], ['portal', 'suppliers', '维护供应商'], ['orders', 'approval', '发起审批'], ['orders', 'report', '业务指标']] : [['person', 'web', '使用'], ['web', 'api', 'HTTPS / JSON'], ['api', 'data', 'SQL 读写'], ['api', 'identity', '认证身份']];
  return {
    schemaVersion: 1, title: functional ? '采购应用功能架构' : '采购系统 · C4 容器图', elements,
    relationships: relations.map(([source, target, label], i) => ({ id: `rel-${i + 1}`, source, target, label })),
    view: { positions: Object.fromEntries(elements.map((e, i) => [e.id, { x: i * 300, y: 0 }])) },
    ...(functional ? {} : { boundaries: [{ id: 'procurement', name: '采购系统 · Software System', elementIds: ['web', 'api', 'data'] }] }),
  };
}
