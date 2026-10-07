#!/bin/bash
# En fin de tour : si la simulation (src/core) ou les niveaux officiels ont changé, régénère l'Edge Function
# verifier-course et l'empreinte (npx vite-node tools/gen-fonction.ts), et prévient Claude s'il faut les committer.
set -uo pipefail

entree=$(cat)
# Déjà relancé par ce hook : ne pas boucler.
[ "$(echo "$entree" | jq -r '.stop_hook_active // false')" = "true" ] && exit 0

cd "$CLAUDE_PROJECT_DIR" || exit 0
[ -d node_modules ] || exit 0

modifs=$(git status --porcelain -- src/core levels 2>/dev/null)
if git rev-parse --verify -q origin/main >/dev/null; then
  modifs="$modifs$(git diff --name-only origin/main...HEAD -- src/core levels 2>/dev/null)"
fi
[ -n "$modifs" ] || exit 0

generes="supabase/functions/verifier-course/course.js src/online/empreinteSimulation.ts"
avant=$(cat $generes 2>/dev/null | sha1sum)
if ! sortie=$(npx vite-node tools/gen-fonction.ts 2>&1); then
  echo "La régénération de la fonction verifier-course a échoué (npx vite-node tools/gen-fonction.ts) :" >&2
  echo "$sortie" | tail -20 >&2
  exit 2
fi
apres=$(cat $generes 2>/dev/null | sha1sum)

if [ "$avant" != "$apres" ]; then
  echo "src/core ou les niveaux ont changé : l'Edge Function verifier-course et src/online/empreinteSimulation.ts viennent d'être régénérés. Les ajouter au commit." >&2
  exit 2
fi
exit 0
