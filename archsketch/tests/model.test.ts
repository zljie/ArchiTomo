import test from 'node:test';
import assert from 'node:assert/strict';
import { exampleModel, parseModel, removeElements, layoutModel, toSvg, NODE_WIDTH, NODE_HEIGHT } from '../src/model.ts';

test('模型往返保持组件、关系、稳定 ID 与视图位置', () => {
  const model = exampleModel();
  assert.deepEqual(parseModel(JSON.stringify(model)), model);
});

test('导入拒绝非法 JSON、版本、重复 ID、悬空关系和非法位置', () => {
  assert.throws(() => parseModel('{'), /JSON/);
  const source = exampleModel();
  const invalid = [
    { ...source, schemaVersion: 2 },
    { ...source, elements: [...source.elements, source.elements[0]] },
    { ...source, relationships: [...source.relationships, source.relationships[0]] },
    { ...source, relationships: [{ id: 'missing', source: 'unknown', target: 'web', label: '' }] },
    { ...source, view: { positions: { ...source.view.positions, web: { x: 'bad', y: 0 } } } },
    { ...source, view: { positions: {} } },
    { ...source, elements: [{ ...source.elements[0], name: '' }] },
    { ...source, view: { positions: { ...source.view.positions, ghost: { x: 0, y: 0 } } } },
  ];
  for (const document of invalid) assert.throws(() => parseModel(JSON.stringify(document)), /模型|版本|ID|关系|位置|名称/);
  assert.deepEqual(source, exampleModel(), '导入校验不修改现有设计');
});

test('删除组件清理所有相关关系和视图坐标，并保留其他 ID', () => {
  const source = exampleModel();
  const result = removeElements(source, ['gateway']);
  assert.equal(result.elements.length, 4);
  assert.equal(result.relationships.length, 1);
  assert.equal(result.relationships[0].id, 'r3');
  assert.equal('gateway' in result.view.positions, false);
  assert.deepEqual(source, exampleModel(), '删除不修改输入模型');
  assert.deepEqual(parseModel(JSON.stringify(result)), result);
});

test('自动布局位置有效、节点无重叠并保持全部语义信息', async () => {
  const source = exampleModel();
  const result = await layoutModel(source);
  assert.deepEqual(result.elements, source.elements);
  assert.deepEqual(result.relationships, source.relationships);
  const positions = Object.values(result.view.positions);
  assert.equal(positions.length, result.elements.length);
  for (const p of positions) assert.ok(Number.isFinite(p.x) && Number.isFinite(p.y));
  for (let i = 0; i < positions.length; i++) for (let j = i + 1; j < positions.length; j++) {
    const a = positions[i], b = positions[j];
    assert.ok(Math.abs(a.x - b.x) >= NODE_WIDTH || Math.abs(a.y - b.y) >= NODE_HEIGHT, '节点不重叠');
  }
  assert.deepEqual(source, exampleModel(), '布局不修改输入模型');
});

test('SVG 包含当前组件关系，转义不可信文字并支持空模型', () => {
  const source = exampleModel();
  source.elements[0].name = '<script>alert("x")</script>&';
  source.view.positions.web = { x: -120, y: -40 };
  const svg = toSvg(source);
  assert.match(svg, /<svg[^>]+xmlns="http:\/\/www.w3.org\/2000\/svg"/);
  assert.match(svg, /&lt;script&gt;/);
  assert.doesNotMatch(svg, /<script>/);
  assert.match(svg, /HTTPS 请求/);
  assert.match(svg, /API 网关/);
  assert.match(svg, /translate\(-120 -40\)/);
  assert.equal((svg.match(/data-element-id=/g) || []).length, 5);
  assert.match(toSvg({ schemaVersion: 1, title: '空图', elements: [], relationships: [], view: { positions: {} } }), /<svg/);
});
