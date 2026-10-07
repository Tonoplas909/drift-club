#!/bin/bash
# Sessions Claude Code dans le cloud : installe les dépendances pour que tests, tsc et build marchent dès le départ.
set -euo pipefail

if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

cd "$CLAUDE_PROJECT_DIR"
# npm install (et non npm ci) : réutilise node_modules gardé en cache par le conteneur.
npm install --no-audit --no-fund
