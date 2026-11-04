#!/usr/bin/env bash
# Vite/Vitest treat "#" in the project path as a URL fragment and fail to load
# test files. If the project path contains "#", mirror it to a temp dir and run there.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
if [[ "$ROOT" != *"#"* ]]; then
  cd "$ROOT" && exec npx vitest "$@"
fi
TMP="${TMPDIR:-/tmp}/lostiravida-test"
mkdir -p "$TMP"
rsync -a --delete --exclude node_modules --exclude .git "$ROOT/" "$TMP/"
[ -e "$TMP/node_modules" ] || cp -R "$ROOT/node_modules" "$TMP/node_modules"
cd "$TMP" && exec npx vitest "$@"
