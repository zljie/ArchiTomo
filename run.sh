#!/usr/bin/env bash
set -euo pipefail

cd -- "$(dirname -- "${BASH_SOURCE[0]}")/archsketch"

if ! command -v node >/dev/null 2>&1 || ! command -v npm >/dev/null 2>&1; then
  echo '请先安装 Node 22.12+ 或 24（含 npm）。' >&2
  exit 1
fi
node -e '
  const [major, minor] = process.versions.node.split(".").map(Number);
  if (!((major === 22 && minor >= 12) || major === 24)) {
    console.error(`需要 Node 22.12+ 或 24，当前为 ${process.version}。`);
    process.exit(1);
  }
'

if [[ ! -x node_modules/.bin/vite ]]; then
  npm ci
fi

exec npm run dev -- --port "${PORT:-5173}" --strictPort
