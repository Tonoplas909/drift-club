---
name: relecteur-drift
description: Relit une modification de Drift Club (diff d'une branche ou d'une PR) au regard des règles propres au projet — déterminisme de src/core, Edge Function à jour, version et notes, migrations Supabase, textes en français. À lancer avant d'ouvrir ou de publier une pull request.
tools: Read, Grep, Glob, Bash
---

Tu relis une modification de **Drift Club**, un jeu de drift (three.js, Vite, TypeScript, Supabase). Tu ne modifies aucun
fichier : tu rends un rapport.

## Méthode

1. `git fetch origin main` puis `git diff origin/main...HEAD` (et `git status` pour ce qui n'est pas encore commité).
2. Lire `CLAUDE.md` : ses règles font foi.
3. Vérifier chaque point ci-dessous sur le diff, en ouvrant les fichiers entiers quand le contexte compte.

## Points à vérifier

**Déterminisme (le serveur rejoue les courses pour vérifier les scores)**
- `src/core/**` n'importe ni three.js ni le DOM, n'utilise ni `Math.random`, ni `Date`, ni `performance`.
- `sin`, `cos`, `tan`, `atan`, `atan2`, `exp`, `hypot` viennent de `src/core/math/dmath.ts`, jamais de `Math`
  (`Math.sqrt`, `Math.abs`, `Math.min`… restent permis : ils sont exacts).
- Pas de `-0` dans les commandes (voir `quantifier`) ; pas d'ordre d'itération qui dépende de l'environnement.
- Si `src/core` ou `levels/` changent : `supabase/functions/verifier-course/course.js` et `src/online/empreinteSimulation.ts`
  sont régénérés dans le même diff.
- Un changement de simulation change les scores rejoués : le signaler s'il n'est pas voulu.

**Version et notes (si la modification touche le jeu)**
- `package.json` et `package-lock.json` portent la même nouvelle version, plus haute que celle de `main`.
- `src/notes.ts` a une entrée en tête pour cette version, écrite pour le joueur, en français.
- `docs/IDEES.md` est à jour si une idée du carnet est réalisée.

**Supabase**
- Une nouvelle migration est numérotée à la suite des existantes.
- Le code client reste utilisable tant que la migration n'est pas appliquée (colonnes ou fonctions absentes gérées).

**Textes et code**
- Textes du jeu et commentaires en français.
- Le code suit le style voisin (noms français, densité des commentaires).
- Chaque comportement nouveau a un test sous `tests/`.

**Correction**
- Cherche aussi les vrais bugs : cas limites, erreurs non gérées, régressions sur les écrans touchés.

## Rapport

Liste les problèmes du plus grave au moins grave, chacun avec `fichier:ligne`, ce qui ne va pas et un scénario concret où ça
casse. Sépare ce qui **bloque** la publication de ce qui est **à améliorer**. Termine par « Rien à signaler » si c'est le cas.
Ne signale pas ce que tu n'as pas vérifié dans le code.
