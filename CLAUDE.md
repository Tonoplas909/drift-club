# Drift Club — consignes pour Claude

## Version du jeu

La version affichée en bas à gauche des menus (« v0.4.1 ») vient de `package.json` (et `package-lock.json`).

- **À chaque mise en ligne** (fusion dans `main`), augmenter le 3ᵉ chiffre : `0.2.0 → 0.2.1`.
- Augmenter le 2ᵉ chiffre (`0.2.x → 0.3.0`) seulement pour une mise à jour importante, ou quand le propriétaire le demande expressément.
- Mettre à jour `package.json` et `package-lock.json` ensemble (`npm version <x.y.z> --no-git-tag-version`).
- **Notes de version** : ajouter en tête de `src/notes.ts` une entrée pour cette version (date, titre, ce qui change pour le joueur, en français). Un test vérifie que la première entrée correspond à `package.json`.

## Rappels

- Textes du jeu et commentaires en français.
- `src/core/**` reste pur : pas de three.js, pas de DOM, pas de `Math.random`, `Date` ni `performance`.
- Avant de pousser : `npx vitest run`, `npx tsc --noEmit`, `npm run build`.
- Un push sur `main` lance les tests puis publie sur GitHub Pages.
- Supabase : les migrations (`supabase/migrations/`) sont appliquées à la main par le propriétaire dans le SQL Editor ; le code client doit rester utilisable tant qu'elles ne sont pas passées.
