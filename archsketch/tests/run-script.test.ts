import test from 'node:test';
import assert from 'node:assert/strict';
import { chmodSync, copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

test('启动入口支持外部目录和空格路径，复用依赖且在前置检查失败时停止', () => {
  const source = new URL('../../run.sh', import.meta.url);
  assert.ok(existsSync(source), '根目录应提供 run.sh 启动入口');
  const root = mkdtempSync(join(tmpdir(), 'archsketch launcher '));
  try {
    const app = join(root, 'archsketch');
    const bin = join(root, 'bin');
    const calls = join(root, 'calls');
    mkdirSync(app); mkdirSync(bin);
    copyFileSync(source, join(root, 'run.sh'));
    writeFileSync(join(bin, 'node'), '#!/bin/sh\nexit "${NODE_CHECK_EXIT:-0}"\n');
    writeFileSync(join(bin, 'npm'), `#!/bin/sh
printf '%s|%s\\n' "$PWD" "$*" >> "$CALLS"
if [ "$1" = ci ]; then
  if [ -n "$INSTALL_EXIT" ] && [ "$INSTALL_EXIT" != 0 ]; then exit "$INSTALL_EXIT"; fi
  mkdir -p node_modules/.bin
  printf '#!/bin/sh\\nexit 0\\n' > node_modules/.bin/vite
  chmod +x node_modules/.bin/vite
fi
`);
    chmodSync(join(bin, 'node'), 0o755); chmodSync(join(bin, 'npm'), 0o755);
    const run = (extra: Record<string, string> = {}) => spawnSync('bash', [join(root, 'run.sh')], {
      cwd: tmpdir(), encoding: 'utf8',
      env: { ...process.env, PATH: `${bin}:/usr/bin:/bin`, CALLS: calls, PORT: '5199', ...extra },
    });
    assert.equal(run().status, 0);
    assert.deepEqual(readFileSync(calls, 'utf8').trim().split('\n'), [
      `${app}|ci`, `${app}|run dev -- --port 5199 --strictPort`,
    ]);
    writeFileSync(calls, '');
    assert.equal(run({ PORT: '' }).status, 0);
    assert.equal(readFileSync(calls, 'utf8').trim(), `${app}|run dev -- --port 5173 --strictPort`);
    writeFileSync(calls, '');
    assert.equal(run({ NODE_CHECK_EXIT: '1' }).status, 1);
    assert.equal(readFileSync(calls, 'utf8'), '');
    rmSync(join(app, 'node_modules'), { recursive: true });
    assert.equal(run({ INSTALL_EXIT: '42' }).status, 42);
    assert.equal(readFileSync(calls, 'utf8').trim(), `${app}|ci`);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
