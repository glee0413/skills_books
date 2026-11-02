#!/usr/bin/env bash
# 一键启动书架。参数原样传给 scripts/shelf.mjs：
#   ./start.sh                     # 默认监听所有网卡，本机与局域网都能打开
#   ./start.sh --port 8080         # 换端口
#   ./start.sh --host 127.0.0.1     # 只允许本机访问
#   ./start.sh --check             # 只做自检，不启动服务
set -euo pipefail
cd "$(dirname "$0")"

if ! command -v node >/dev/null 2>&1; then
  echo "需要 Node.js 20 或更新版本，见 https://nodejs.org/" >&2
  exit 1
fi

major="$(node -p 'process.versions.node.split(".")[0]')"
if [ "$major" -lt 20 ]; then
  echo "Node.js 版本过低（当前 $(node -v)），需要 >= 20。" >&2
  exit 1
fi

exec node scripts/shelf.mjs "$@"