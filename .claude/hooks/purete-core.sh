#!/bin/bash
# Après une modification d'un fichier de src/core : refuse ce qui casse le déterminisme (voir CLAUDE.md).
# Même règle que le test « src/core : simulation déterministe » (tests/core/dmath.test.ts), plus les autres interdits.
set -uo pipefail

fichier=$(jq -r '.tool_input.file_path // empty')
case "$fichier" in
  */src/core/*.ts) ;;
  *) exit 0 ;;
esac
case "$fichier" in
  */src/core/math/dmath.ts) exit 0 ;;
esac
[ -f "$fichier" ] || exit 0

interdits='Math\.(sin|cos|tan|asin|acos|atan|atan2|sinh|cosh|tanh|exp|expm1|log|log2|log10|log1p|pow|cbrt|hypot|random)\b|\bDate\.now\b|\bnew Date\b|\bperformance\.|from '"'"'three|\b(document|window)\.'
fautes=$(grep -nE "$interdits" "$fichier")
if [ -n "$fautes" ]; then
  {
    echo "src/core doit rester pur et déterministe (CLAUDE.md) : $fichier"
    echo "$fautes"
    echo "Utiliser src/core/math/dmath.ts pour sin, cos, tan, atan, atan2, exp, hypot ; pas de Math.random, Date, performance, three.js ni DOM."
  } >&2
  exit 2
fi
exit 0
