# Drift Club — consignes pour Claude

## Version du jeu

La version affichée en bas à gauche des menus (« v0.4.3 ») vient de `package.json` (et `package-lock.json`).

- **À chaque mise en ligne** (fusion dans `main`), augmenter le 3ᵉ chiffre : `0.2.0 → 0.2.1`.
- Augmenter le 2ᵉ chiffre (`0.2.x → 0.3.0`) seulement pour une mise à jour importante, ou quand le propriétaire le demande expressément.
- Mettre à jour `package.json` et `package-lock.json` ensemble (`npm version <x.y.z> --no-git-tag-version`).
- **Notes de version** : ajouter en tête de `src/notes.ts` une entrée pour cette version (date, titre, ce qui change pour le joueur, en français). Un test vérifie que la première entrée correspond à `package.json`.

## Branches et pull requests

- **Une branche par modification**, partie du dernier `main` (`git fetch origin main && git checkout -B <nom> origin/main`), avec un nom court en français (`defi-du-jour`, `manette`…).
- Une fois la modification prête (vérifications ci-dessous passées), ouvrir une **pull request** vers `main`, puis la fusionner quand le propriétaire demande la mise en ligne (« publie »).
- **Après la fusion, supprimer la branche** (sur GitHub et en local) : le dépôt ne garde que `main` et les branches en cours.
- Une modification qui ne touche pas le jeu (documentation seule, comme `docs/`) passe aussi par une branche et une PR, mais sans nouvelle version ni note de version.

## Idées

Les idées pour la suite sont dans `docs/IDEES.md` : y ajouter les nouvelles, et mettre à jour leur état (et la section « Fait ») quand l'une d'elles sort.

## Rappels

- Textes du jeu et commentaires en français.
- `src/core/**` reste pur : pas de three.js, pas de DOM, pas de `Math.random`, `Date` ni `performance`.
- `src/core/**` est déterministe au bit près (le serveur rejoue les courses pour vérifier les scores) : `sin`, `cos`, `tan`, `atan`, `atan2`, `exp`, `hypot` viennent de `src/core/math/dmath.ts`, jamais de `Math` (un test le vérifie). Pas de `-0` dans les commandes (voir `quantifier`).
- Après un changement de `src/core` ou des niveaux officiels : `npx vite-node tools/gen-fonction.ts` (Edge Function `supabase/functions/verifier-course/course.js` et `src/online/empreinteSimulation.ts`, un test vérifie qu'ils sont à jour). Le push sur `main` redéploie la fonction juste après le site (job `fonction`, secret `SUPABASE_ACCESS_TOKEN`) ; si le secret manque, rappeler au propriétaire de la redéployer à la main.
- Avant de pousser : `npx vitest run`, `npx tsc --noEmit`, `npm run build`.
- Un push sur `main` lance les tests puis publie sur GitHub Pages.
- Supabase : les migrations (`supabase/migrations/`) sont appliquées à la main par le propriétaire dans le SQL Editor ; le code client doit rester utilisable tant qu'elles ne sont pas passées.
