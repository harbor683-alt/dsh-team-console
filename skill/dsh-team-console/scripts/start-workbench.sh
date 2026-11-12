#!/usr/bin/env sh
# dsh-team-console launcher (macOS / Linux)
# Usage: sh start-workbench.sh [workspace] [port]
set -eu

PORT="${2:-8787}"
case "$PORT" in
  ''|*[!0-9]*)
    echo "[error] port must be a number: $PORT" >&2
    exit 1
    ;;
  0*)
    echo "[error] port must be between 1 and 65535: $PORT" >&2
    exit 1
    ;;
esac
if [ "$PORT" -lt 1 ] || [ "$PORT" -gt 65535 ]; then
  echo "[error] port must be between 1 and 65535: $PORT" >&2
  exit 1
fi

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
WS="${1:-}"

if [ -n "${DSH_TEAM_CONSOLE_HOME:-}" ]; then
  CONSOLE_HOME=$DSH_TEAM_CONSOLE_HOME
elif [ -n "$WS" ] && [ -f "$WS/team-view/serve-workbench.mjs" ]; then
  CONSOLE_HOME="$WS/team-view"
else
  CONSOLE_HOME=$(CDPATH= cd -- "$SCRIPT_DIR/../../../.." && pwd)
fi

if [ ! -f "$CONSOLE_HOME/serve-workbench.mjs" ]; then
  echo "[error] serve-workbench.mjs not found under: $CONSOLE_HOME" >&2
  echo "        Set DSH_TEAM_CONSOLE_HOME to the folder containing it." >&2
  exit 1
fi

if [ -z "$WS" ]; then
  WS=$(CDPATH= cd -- "$CONSOLE_HOME/.." && pwd)
fi

if [ ! -d "$WS" ]; then
  echo "[error] workspace not found: $WS" >&2
  exit 1
fi

if ! command -v node >/dev/null 2>&1; then
  echo "[error] Node.js 20 or newer is required." >&2
  exit 1
fi

NODE_MAJOR=$(node -p 'process.versions.node.split(".")[0]')
if [ "$NODE_MAJOR" -lt 20 ]; then
  echo "[error] Node.js 20 or newer is required. Current: $(node --version)" >&2
  exit 1
fi

echo "Workspace : $WS"
echo "Console   : $CONSOLE_HOME/serve-workbench.mjs"
echo "URL       : http://127.0.0.1:$PORT/"

exec node "$CONSOLE_HOME/serve-workbench.mjs" "$WS" --port="$PORT"
