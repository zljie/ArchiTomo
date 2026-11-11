import test from 'node:test';
import assert from 'node:assert/strict';
import { exampleModel, parseModel, removeElements, layoutModel, toSvg } from '../src/model.ts';
import { parseRequirements, inspectModel, modelFromBlueprint, updateRequirements } from '../src/planning.ts';
import { createTemplate, TEMPLATES } from '../src/templates.ts';

test('三种专业模板保持模型完整，C4 容器包含边界并可布局/导出', async () => {
  for (const template of TEMPLATES) {
    const model = createTemplate(template.id);
    assert.deepEqual(parseModel(JSON.stringify(model)), model);
    const laid = await layoutModel(model);
    assert.equal(laid.elements.length, model.elements.length);
    assert.match(toSvg(laid), /<svg/);
    if (template.id === 'c4') {
      assert.ok(model.boundaries?.length);
      assert.ok(model.elements.some(e => e.c4Type === 'person'));
      assert.match(toSvg(laid), /data-boundary-id=/);
    }
  }
});

test('新增需求/假设/边界元数据往返不丢失，旧模型原样保留', () => {
  const old = exampleModel();
  assert.deepEqual(parseModel(JSON.stringify(old)), old);
  const model = { ...old, requirements: [{ id: 'RQ-01', text: '用户可以管理采购订单' }],
    assumptions: [{ id: 'AS-01', text: '身份认证由外部服务提供', confirmed: false }],
    boundaries: [{ id: 'BD-01', name: '采购系统', elementIds: ['business', 'database'] }],
    elements: old.elements.map(e => ({ ...e, requirementIds: ['RQ-01'] })) };
  assert.deepEqual(parseModel(JSON.stringify(model)), model);
  const deleted = removeElements(model, ['business']);
  assert.deepEqual(deleted.boundaries![0].elementIds, ['database']);
  assert.deepEqual(parseModel(JSON.stringify(deleted)), deleted);
});

test('无效需求引用、边界成员、重复成员、假设确认状态不可进入模型', () => {
  const source = exampleModel();
  const invalid = [
    { ...source, elements: source.elements.map(e => ({ ...e, requirementIds: ['unknown'] })) },
    { ...source, boundaries: [{ id: 'b', name: '边界', elementIds: ['unknown'] }] },
    { ...source, boundaries: [{ id: 'b', name: '边界', elementIds: ['web', 'web'] }] },
    { ...source, assumptions: [{ id: 'a', text: '假设', confirmed: 'yes' }] },
  ];
  for (const document of invalid) assert.throws(() => parseModel(JSON.stringify(document)), /模型|需求|边界|假设/);
});

test('追溯检查准确区分需求未覆盖、组件无来源和未确认假设', () => {
  const model = { ...exampleModel(), requirements: [{ id: 'RQ-01', text: '采购管理' }], assumptions: [{ id: 'AS-01', text: '待确认规模', confirmed: false }] };
  const issues = inspectModel(model);
  assert.ok(issues.some(i => i.requirementId === 'RQ-01'));
  assert.ok(issues.some(i => i.elementId === 'web'));
  assert.ok(issues.some(i => i.id === 'assumption:AS-01'));
});

test('需求输入有界且分配稳定 ID，AI 结果仅接受已给需求引用且假设保持未确认', () => {
  const requirements = parseRequirements('用户管理采购\n\n供应商协同');
  assert.deepEqual(requirements, [{ id: 'RQ-01', text: '用户管理采购' }, { id: 'RQ-02', text: '供应商协同' }]);
  assert.throws(() => parseRequirements(' '), /需求/);
  assert.throws(() => parseRequirements('x'.repeat(9000)), /需求/);
  const blueprint = { title: '采购系统',
    elements: [{ id: 'app', name: '采购应用', kind: 'application', technology: 'React', description: '采购入口', requirementIds: ['RQ-01', 'RQ-02'] }],
    relationships: [], boundaries: [], assumptions: [{ id: 'AS-01', text: '用户规模待确认', confirmed: true }] };
  const model = modelFromBlueprint(blueprint, requirements);
  assert.deepEqual(model.requirements, requirements);
  assert.equal(model.assumptions![0].confirmed, false);
  assert.deepEqual(parseModel(JSON.stringify(model)), model);
  assert.throws(() => modelFromBlueprint({ ...blueprint, elements: [{ ...blueprint.elements[0], requirementIds: ['fake'] }] }, requirements), /需求/);
  assert.throws(() => modelFromBlueprint({ ...blueprint, elements: [{ ...blueprint.elements[0], requirementIds: [] }] }, requirements), /需求/);
});

test('修改需求清单保留未改需求的身份与映射，不复用被删除身份', () => {
  const old = { ...exampleModel(), requirements: [{ id: 'RQ-01', text: '采购' }, { id: 'RQ-02', text: '供应商' }] };
  old.elements[0].requirementIds = ['RQ-01', 'RQ-02'];
  const updated = updateRequirements(old, '供应商\n库存');
  assert.equal(updated.requirements![0].id, 'RQ-02');
  assert.notEqual(updated.requirements![1].id, 'RQ-01');
  assert.deepEqual(updated.elements[0].requirementIds, ['RQ-02']);
  assert.deepEqual(parseModel(JSON.stringify(updated)), updated);
});
