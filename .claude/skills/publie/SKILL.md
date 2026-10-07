---
name: publie
description: Met en ligne une modification de Drift Club (le propriétaire dit « publie ») ou la prépare : nouvelle version, note de version, carnet d'idées, vérifications, pull request, fusion dans main, suppression de la branche et rappels Supabase. À utiliser aussi pour préparer une branche avant d'ouvrir sa PR.
---

# Publier une modification de Drift Club

Suivre les étapes dans l'ordre. Les règles de référence sont dans `CLAUDE.md` ; en cas de doute, c'est lui qui fait foi.

## 1. Situer la modification

- `git fetch origin main`, puis `git log --oneline origin/main..HEAD` et `git diff --stat origin/main...HEAD` pour voir ce qui part.
- La branche doit partir du dernier `main`. Sinon, fusionner `origin/main` dedans (pas de rebase sur une branche déjà poussée).
- **Touche-t-elle le jeu ?** Seulement de la documentation (`docs/`, `README.md`, `CLAUDE.md`, `.claude/`) → pas de nouvelle
  version ni de note de version : passer directement à l'étape 4.

## 2. Version

- Version actuelle : `node -p "require('./package.json').version"`.
- Par défaut, 3ᵉ chiffre + 1 (`0.5.5 → 0.5.6`). 2ᵉ chiffre (`0.5.x → 0.6.0`) seulement pour une mise à jour importante ou si le
  propriétaire le demande.
- `npm version <x.y.z> --no-git-tag-version` (met à jour `package.json` et `package-lock.json` ensemble).
- Si la branche porte déjà une version plus haute que `main`, ne pas l'augmenter une deuxième fois.

## 3. Notes et idées

- **`src/notes.ts`** : nouvelle entrée **en tête** de `NOTES`, avec `version` (celle de `package.json`), `date` du jour au
  format `JJ/MM/AAAA`, un `titre` court et des `notes` écrites pour le joueur, en français, tutoiement, sans jargon technique
  (ce qui change pour lui, pas comment c'est codé). Un test vérifie que la première entrée correspond à `package.json`.
- **`docs/IDEES.md`** : si la modification réalise une idée du carnet, passer son **État** à `fait (x.y.z)` dans le tableau et la
  reporter dans la section « Fait ». Ajouter les nouvelles idées apparues en chemin.

## 4. Fichiers générés

Si `src/core/**` ou `levels/` ont changé : `npx vite-node tools/gen-fonction.ts`, puis committer
`supabase/functions/verifier-course/course.js` et `src/online/empreinteSimulation.ts`.

## 5. Vérifications (toutes doivent passer)

```bash
npx vitest run
npx tsc --noEmit
npm run build
```

Ne rien pousser tant qu'une des trois échoue. Corriger la cause ; ne jamais désactiver un test.

## 6. Commit et pull request

- Commit en français, titre au format des précédents : `<Titre de la note> (x.y.z)`.
- Pousser la branche, puis ouvrir (ou mettre à jour) la pull request vers `main` avec ce même titre et un résumé de ce qui
  change pour le joueur. Utiliser l'outil GitHub disponible (serveur MCP GitHub en session cloud, sinon `gh`).

## 7. Fusion — seulement si le propriétaire a dit « publie »

Sans ce mot, s'arrêter à la PR prête et le dire.

1. Vérifier que la CI de la PR est verte et qu'il n'y a pas de conflit.
2. Fusionner la PR dans `main` (squash, comme l'historique : un commit par version, suffixé `(#numéro)`).
3. **Supprimer la branche** sur GitHub et en local (`git branch -D <branche>`) : le dépôt ne garde que `main` et les branches
   en cours.
4. Le push sur `main` lance les tests, publie sur GitHub Pages puis redéploie l'Edge Function (job `fonction`).

## 8. Rappels au propriétaire

Les mentionner dans le message de fin quand ils s'appliquent :

- **Nouvelle migration** dans `supabase/migrations/` : à appliquer à la main dans le SQL Editor de Supabase (le jeu publié
  reste utilisable en attendant).
- **Simulation ou niveaux officiels modifiés** : vérifier que le job `fonction` de la publication a bien redéployé
  `verifier-course` ; s'il a été sauté (secret `SUPABASE_ACCESS_TOKEN` absent), la redéployer à la main (voir
  `supabase/README.md`).
