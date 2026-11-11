import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer, type Server } from 'node:http';
import { createAiMiddleware, resolveAiConfig } from '../server/ai.ts';

async function listen(server: Server) {
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  assert.ok(address && typeof address === 'object');
  return `http://127.0.0.1:${address.port}`;
}
async function close(server: Server) {
  server.closeAllConnections();
  await new Promise<void>(resolve => server.close(() => resolve()));
}

test('未配置 AI 时明确503；状态接口不返回密钥', async () => {
  const handler = createAiMiddleware({ baseUrl: 'https://api.openai.com/v1', model: '', apiKey: '' });
  const server = createServer((req, res) => handler(req, res, () => res.end()));
  const base = await listen(server);
  try {
    const status = await fetch(base + '/api/ai/status');
    assert.deepEqual(await status.json(), { configured: false, model: '', service: 'api.openai.com' });
    const response = await fetch(base + '/api/ai/generate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ requirements: '用户管理采购' }) });
    assert.equal(response.status, 503);
  } finally { await close(server); }
});

test('AI 接口拒绝跨站调用、错误方法与过大输入', async () => {
  const handler = createAiMiddleware({ baseUrl: 'https://api.openai.com/v1', model: 'test-model', apiKey: 'test-only-token' });
  const server = createServer((req, res) => handler(req, res, () => res.end()));
  const base = await listen(server);
  try {
    assert.equal((await fetch(base + '/api/ai/generate', { method: 'POST', headers: { Origin: 'https://other.example', 'Content-Type': 'application/json' }, body: '{}' })).status, 403);
    assert.equal((await fetch(base + '/api/ai/generate')).status, 405);
    const large = await fetch(base + '/api/ai/generate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ requirements: 'x'.repeat(20000) }) });
    assert.equal(large.status, 413);
  } finally { await close(server); }
});

test('模型服务响应经严格校验，真实HTTP集成保持需求且不泄露服务端密钥', async () => {
  let format: unknown;
  let auth = '';
  let invalid = false;
  const upstream = createServer(async (req, res) => {
    const chunks = []; for await (const chunk of req) chunks.push(chunk);
    const body = JSON.parse(Buffer.concat(chunks).toString());
    format = body.response_format; auth = String(req.headers.authorization);
    res.setHeader('Content-Type', 'application/json');
    const blueprint = { title: '采购应用', elements: [{ id: 'app', name: '采购入口', kind: 'application', technology: 'React', description: '采购', requirementIds: [invalid ? 'missing' : 'RQ-01'] }], relationships: [], boundaries: [], assumptions: [{ id: 'AS-01', text: '规模待确认' }] };
    res.end(JSON.stringify({ choices: [{ message: { content: JSON.stringify(blueprint) }, finish_reason: 'stop' }] }));
  });
  const upstreamBase = await listen(upstream);
  const handler = createAiMiddleware({ baseUrl: upstreamBase + '/v1', model: 'test-model', apiKey: 'test-only-token' });
  const app = createServer((req, res) => handler(req, res, () => res.end()));
  const base = await listen(app);
  try {
    const request = () => fetch(base + '/api/ai/generate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ requirements: '用户管理采购' }) });
    const response = await request();
    assert.equal(response.status, 200);
    const body = await response.text();
    assert.doesNotMatch(body, /test-only-token/);
    const result = JSON.parse(body);
    assert.equal(result.model.requirements[0].text, '用户管理采购');
    assert.equal(result.model.assumptions[0].confirmed, false);
    assert.equal(auth, 'Bearer test-only-token');
    assert.equal((format as { type: string }).type, 'json_schema');
    invalid = true;
    assert.equal((await request()).status, 502);
  } finally { await close(app); await close(upstream); }
});

test('DeepSeek 使用 JSON Output 和专用参数，空内容/截断/无效需求引用仍被拒绝', async () => {
  const requests: { response_format: unknown; max_tokens?: number; thinking?: unknown; max_completion_tokens?: number; store?: boolean; messages: { content: string }[] }[] = [];
  let scenario = 'valid';
  const upstream = createServer(async (req, res) => {
    const chunks = []; for await (const chunk of req) chunks.push(chunk);
    requests.push(JSON.parse(Buffer.concat(chunks).toString()));
    const blueprint = { title: '采购架构', elements: [{ id: 'app', name: '采购门户', kind: 'application', technology: 'React', description: '采购入口', requirementIds: [scenario === 'invalid' ? 'missing' : 'RQ-01'], c4Type: 'none' }], relationships: [], boundaries: [], assumptions: [] };
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ choices: [{ message: { content: scenario === 'empty' ? '' : JSON.stringify(blueprint) }, finish_reason: scenario === 'truncated' ? 'length' : 'stop' }] }));
  });
  const upstreamBase = await listen(upstream);
  const config = { provider: 'deepseek', baseUrl: upstreamBase + '/v1', model: 'deepseek-flash', apiKey: 'test-only-deepseek' };
  const handler = createAiMiddleware(config);
  const app = createServer((req, res) => handler(req, res, () => res.end()));
  const base = await listen(app);
  try {
    const request = () => fetch(base + '/api/ai/generate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ requirements: '管理采购订单', template: 'technical' }) });
    const response = await request();
    assert.equal(response.status, 200);
    assert.equal((await response.json()).model.requirements[0].text, '管理采购订单');
    assert.deepEqual(requests[0].response_format, { type: 'json_object' });
    assert.equal(requests[0].max_tokens, 8000);
    assert.deepEqual(requests[0].thinking, { type: 'disabled' });
    assert.equal(requests[0].max_completion_tokens, undefined);
    assert.equal(requests[0].store, undefined);
    assert.match(requests[0].messages[0].content, /JSON.*[Ss]chema/);
    assert.match(requests[0].messages[0].content, /Example JSON/);
    for (scenario of ['empty', 'truncated', 'invalid']) assert.equal((await request()).status, 502, scenario);
  } finally { await close(app); await close(upstream); }
});

test('配置默认 DeepSeek，跨 provider 不回退密钥且保留旧自定义服务', () => {
  const env = { DEEPSEEK_API_KEY: 'test-deepseek', OPENAI_API_KEY: 'test-openai' };
  assert.deepEqual(resolveAiConfig(env), { provider: 'deepseek', baseUrl: 'https://api.deepseek.com', model: 'deepseek-flash', apiKey: 'test-deepseek' });
  assert.equal(resolveAiConfig({ OPENAI_API_KEY: 'test-openai' }).apiKey, '');
  const old = resolveAiConfig({ ...env, ARCHSKETCH_AI_BASE_URL: 'https://api.openai.com/v1', ARCHSKETCH_AI_MODEL: 'existing-model' });
  assert.equal(old.provider, 'openai-compatible');
  assert.equal(old.apiKey, 'test-openai');
  assert.equal(old.model, 'existing-model');
  assert.equal(resolveAiConfig({ ...env, ARCHSKETCH_AI_API_KEY: 'explicit-key' }).apiKey, 'explicit-key');
  assert.equal(resolveAiConfig({ ...env, ARCHSKETCH_AI_PROVIDER: 'chatgpt-siwc' }).apiKey, '');
});
