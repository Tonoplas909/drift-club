# Drift Club — Lot 1 (jeu jouable) — Plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal :** un jeu de drift 3D jouable dans le navigateur (clavier + tactile) avec 3 voitures, 3 modes de conduite, score au drift, décor généré, 3 niveaux officiels, menus, son, records, publié automatiquement sur GitHub Pages.

**Architecture :** simulation pure et déterministe dans `src/core/` (sans three.js ni DOM), pas fixe de 1/120 s ; rendu three.js dans `src/render/` qui interpole entre deux états ; `src/game/` fait la boucle et le lien ; `src/ui/` les menus HTML/CSS.

**Tech Stack :** TypeScript 5 (strict), Vite 5, Vitest 2, three.js 0.170, décor Kenney Nature Kit (CC0), voitures d'inspiration japonaise générées par code.

**Spec :** `docs/superpowers/specs/2026-09-29-drift-club-design.md` (à lire en entier avant toute tâche).

## Global Constraints

- Node ≥ 20. Seule dépendance d'exécution : `three@0.170.x`. Dépendances de dev : `typescript`, `vite`, `vitest`, `@types/three`.
- TypeScript `strict`. Modules ES. Pas de `any` implicite.
- `src/core/**` n'importe **jamais** `three`, ni le DOM (`document`, `window`), ni `Math.random`, `Date`, `performance`. Hasard uniquement via `mulberry32` (`src/core/math/rng.ts`).
- Pas de simulation : `SIM_DT = 1 / 120` (constante dans `src/core/constants.ts`).
- Unités internes : mètres, secondes, radians. km/h seulement pour l'affichage et les seuils du score.
- Repère : y vers le haut. Cap `heading` (ψ) : avant = `(sin ψ, cos ψ)` en (x, z) ; gauche = `(cos ψ, −sin ψ)` ; ψ qui augmente = virage à gauche ; three.js : `object.rotation.y = ψ`. Les voitures regardent vers +z, leurs roues gauches sont en +x.
- Braquage `steer` positif = roues vers la gauche. `direction` d'entrée : +1 = gauche, −1 = droite.
- Dérive `beta` = `atan2(vLat, vLong)` : positive = la vitesse part à gauche du nez.
- Vite `base: '/drift-club/'` ; les fichiers de `public/` se chargent via `import.meta.env.BASE_URL`.
- Tous les textes visibles par le joueur sont en **français**.
- Tests : Vitest, dans `tests/` en miroir de `src/`. Lancer un fichier : `npx vitest run tests/chemin/fichier.test.ts`. Tout lancer : `npm test`. Vérif de types : `npx tsc --noEmit`.
- Commits : message en français, dernière ligne `Co-Authored-By: Claude Haiku 4.5 <noreply@anthropic.com>` (agents Haiku) ou le modèle réellement utilisé. Ne **jamais** `git push`.
- Windows : le shell est Git Bash ; utiliser des chemins avec `/`.

## Review Focus

1. **Niveau minimal** (2 points, 20 m de route) : piste, terrain, décor, course et arrivée doivent fonctionner sans erreur — test dans la Tâche 10.
2. **Grand saut de temps** (onglet masqué puis revenu, image de 10 s) : la boucle borne le temps à 0,25 s et ne rattrape pas 1 200 pas — test dans la Tâche 16.
3. **Stockage qui lève une exception** (navigation privée) : le jeu démarre avec des réglages par défaut et `persistent = false` — test dans la Tâche 11.
4. **Voiture jetée hors de la zone / bloquée hors progression** : replacement automatique, jamais de `NaN` — test dans la Tâche 10.
5. **Entrées aléatoires pendant longtemps** sur les 3 voitures × 3 modes : état toujours fini, vitesse bornée — test dans la Tâche 7.

## Carte des fichiers

```
package.json, tsconfig.json, vite.config.ts, index.html, .gitignore
.github/workflows/deploy.yml
src/main.ts                     démarrage
src/app.ts                      enchaînement des écrans
src/styles.css                  styles HUD + menus
src/levels.ts                   liste des niveaux officiels
src/core/constants.ts           SIM_DT
src/core/input.ts               InputState
src/core/math/{vec,rng,noise}.ts
src/core/level/{types,validate}.ts
src/core/track/{spline,grid,buildTrack,projection,checkGeometry,terrain}.ts
src/core/loadLevel.ts
src/core/env/{types,generate}.ts
src/core/physics/{types,cars,assists,car,collision}.ts
src/core/scoring/score.ts
src/core/race/race.ts
src/storage/store.ts
src/render/{materials,assets,procedural,jdmCars,palettes,sky,road,terrainMesh,decor,carView,effects,camera,quality,world,showroom}.ts
src/game/{loop,pose,prepare,hud,session}.ts
src/input/{keyboard,touch,manager}.ts
src/audio/audio.ts
src/ui/{format,couleurs,screens}.ts
src/debug/panel.ts
levels/{premiers-virages,foret-des-pins,col-du-loup}.json
public/models/nature/*.glb, public/models/LICENCE-kenney.txt   (décor Kenney ; voitures générées par code)
tests/…                         miroir de src/
```

---

## Tâche 1 : Squelette du projet, tests et publication automatique

**Files :**
- Create : `package.json`, `tsconfig.json`, `vite.config.ts`, `index.html`, `.gitignore`, `.github/workflows/deploy.yml`, `src/main.ts`, `src/core/constants.ts`, `src/core/input.ts`
- Test : `tests/core/constants.test.ts`

**Interfaces :**
- Produces : `SIM_DT: number` (`src/core/constants.ts`) ; `InputState`, `NO_INPUT` (`src/core/input.ts`).

- [ ] **Step 1 : fichiers de configuration**

`package.json` :
```json
{
  "name": "drift-club",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc --noEmit && vite build",
    "preview": "vite preview",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "dependencies": {
    "three": "~0.170.0"
  },
  "devDependencies": {
    "@types/three": "~0.170.0",
    "typescript": "^5.6.3",
    "vite": "^5.4.10",
    "vitest": "^2.1.4"
  }
}
```

`tsconfig.json` :
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "strict": true,
    "noFallthroughCasesInSwitch": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "skipLibCheck": true,
    "noEmit": true,
    "types": ["vite/client"]
  },
  "include": ["src", "tests", "levels", "vite.config.ts"]
}
```

`vite.config.ts` :
```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  base: '/drift-club/',
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
  },
});
```

`.gitignore` :
```
node_modules/
dist/
.claude/
*.log
```

`index.html` :
```html
<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover" />
<meta name="theme-color" content="#1b1f2e" />
<title>Drift Club</title>
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=Baloo+2:wght@500;700;800&display=swap" rel="stylesheet" />
</head>
<body>
<div id="app">
  <canvas id="scene"></canvas>
  <div id="hud"></div>
  <div id="touch"></div>
  <div id="ui"></div>
</div>
<script type="module" src="/src/main.ts"></script>
</body>
</html>
```

`src/main.ts` (provisoire, remplacé à la Tâche 19) :
```ts
const ui = document.getElementById('ui');
if (ui) ui.textContent = 'Drift Club';
```

`.github/workflows/deploy.yml` :
```yaml
name: Publication GitHub Pages
on:
  push:
    branches: [main]
  workflow_dispatch:
permissions:
  contents: read
  pages: write
  id-token: write
concurrency:
  group: pages
  cancel-in-progress: true
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
      - run: npm ci
      - run: npm test
      - run: npm run build
      - uses: actions/upload-pages-artifact@v3
        with:
          path: dist
  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - id: deployment
        uses: actions/deploy-pages@v4
```

- [ ] **Step 2 : installer**

Run : `npm install`
Expected : `node_modules/` créé, `package-lock.json` créé, pas d'erreur.

- [ ] **Step 3 : écrire le test (il échoue)**

`tests/core/constants.test.ts` :
```ts
import { describe, it, expect } from 'vitest';
import { SIM_DT } from '../../src/core/constants';
import { NO_INPUT } from '../../src/core/input';

describe('constantes', () => {
  it('pas de simulation de 1/120 s', () => {
    expect(SIM_DT).toBeCloseTo(1 / 120, 12);
  });
  it('entrée neutre', () => {
    expect(NO_INPUT).toEqual({ gaz: 0, frein: 0, direction: 0, freinAMain: false });
  });
});
```

Run : `npx vitest run tests/core/constants.test.ts` → Expected : FAIL (module introuvable).

- [ ] **Step 4 : implémenter**

`src/core/constants.ts` :
```ts
/** Pas fixe de la simulation (secondes). */
export const SIM_DT = 1 / 120;
```

`src/core/input.ts` :
```ts
/** Intention de pilotage, identique pour le clavier et le tactile. */
export interface InputState {
  /** Accélérateur 0..1 */
  gaz: number;
  /** Frein / marche arrière 0..1 */
  frein: number;
  /** Direction −1..1 (+1 = gauche) */
  direction: number;
  /** Frein à main (bouton Drift en mode Arcade) */
  freinAMain: boolean;
}

export const NO_INPUT: Readonly<InputState> = Object.freeze({ gaz: 0, frein: 0, direction: 0, freinAMain: false });
```

- [ ] **Step 5 : vérifier**

Run : `npx vitest run tests/core/constants.test.ts` → PASS.
Run : `npm run build` → Expected : `dist/index.html` produit, pas d'erreur TypeScript.

- [ ] **Step 6 : commit**

```bash
git add package.json package-lock.json tsconfig.json vite.config.ts index.html .gitignore .github src tests
git commit -m "Squelette du projet : Vite, TypeScript, Vitest et publication GitHub Pages"
```

---

## Tâche 2 : Outils mathématiques (vecteurs, hasard à graine, bruit)

**Files :**
- Create : `src/core/math/vec.ts`, `src/core/math/rng.ts`, `src/core/math/noise.ts`
- Test : `tests/core/math.test.ts`

**Interfaces :**
- Produces :
  - `clamp(v, lo, hi): number`, `lerp(a, b, t): number`, `smoothstep(e0, e1, x): number`, `wrapAngle(a): number` (résultat dans ]−π, π]), `DEG: number` (= π/180)
  - `type Rng = () => number`, `mulberry32(seed: number): Rng` (valeurs dans [0, 1[), `hash2(ix, iz, seed): number` ([0, 1[), `randRange(rng, lo, hi)`, `randInt(rng, n)`
  - `valueNoise(x, z, seed): number` et `fbm(x, z, seed, octaves = 3): number`, tous deux dans [0, 1]

- [ ] **Step 1 : écrire les tests**

`tests/core/math.test.ts` :
```ts
import { describe, it, expect } from 'vitest';
import { clamp, lerp, smoothstep, wrapAngle, DEG } from '../../src/core/math/vec';
import { mulberry32, hash2, randInt } from '../../src/core/math/rng';
import { valueNoise, fbm } from '../../src/core/math/noise';

describe('vec', () => {
  it('clamp / lerp / smoothstep', () => {
    expect(clamp(5, 0, 2)).toBe(2);
    expect(clamp(-1, 0, 2)).toBe(0);
    expect(lerp(10, 20, 0.25)).toBe(12.5);
    expect(smoothstep(0, 1, -1)).toBe(0);
    expect(smoothstep(0, 1, 2)).toBe(1);
    expect(smoothstep(0, 1, 0.5)).toBeCloseTo(0.5, 10);
  });
  it('wrapAngle ramène dans ]-pi, pi]', () => {
    expect(wrapAngle(3 * Math.PI)).toBeCloseTo(Math.PI, 9);
    expect(wrapAngle(-3 * Math.PI / 2)).toBeCloseTo(Math.PI / 2, 9);
    expect(wrapAngle(0.3)).toBeCloseTo(0.3, 12);
    expect(DEG * 180).toBeCloseTo(Math.PI, 12);
  });
});

describe('rng', () => {
  it('mulberry32 est déterministe et dans [0,1[', () => {
    const a = mulberry32(42), b = mulberry32(42);
    for (let i = 0; i < 1000; i++) {
      const x = a();
      expect(x).toBe(b());
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThan(1);
    }
  });
  it('graines différentes → suites différentes', () => {
    expect(mulberry32(1)()).not.toBe(mulberry32(2)());
  });
  it('hash2 déterministe et dans [0,1[', () => {
    for (let i = -20; i < 20; i++) {
      const h = hash2(i, i * 7, 99);
      expect(h).toBe(hash2(i, i * 7, 99));
      expect(h).toBeGreaterThanOrEqual(0);
      expect(h).toBeLessThan(1);
    }
  });
  it('randInt reste dans [0, n[', () => {
    const r = mulberry32(3);
    for (let i = 0; i < 500; i++) {
      const v = randInt(r, 3);
      expect([0, 1, 2]).toContain(v);
    }
  });
});

describe('bruit', () => {
  it('valueNoise continu et dans [0,1]', () => {
    for (let i = 0; i < 200; i++) {
      const x = i * 0.137, z = i * 0.071;
      const n = valueNoise(x, z, 5);
      expect(n).toBeGreaterThanOrEqual(0);
      expect(n).toBeLessThanOrEqual(1);
      expect(Math.abs(valueNoise(x + 0.001, z, 5) - n)).toBeLessThan(0.01);
    }
  });
  it('fbm dans [0,1] et déterministe', () => {
    for (let i = 0; i < 100; i++) {
      const v = fbm(i * 1.3, -i * 0.7, 12);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(1);
      expect(v).toBe(fbm(i * 1.3, -i * 0.7, 12));
    }
  });
});
```

Run : `npx vitest run tests/core/math.test.ts` → FAIL (modules introuvables).

- [ ] **Step 2 : implémenter**

`src/core/math/vec.ts` :
```ts
export const DEG = Math.PI / 180;

export function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function smoothstep(e0: number, e1: number, x: number): number {
  const t = clamp((x - e0) / (e1 - e0), 0, 1);
  return t * t * (3 - 2 * t);
}

/** Ramène un angle dans ]−π, π]. */
export function wrapAngle(a: number): number {
  const TWO_PI = Math.PI * 2;
  a = a % TWO_PI;
  if (a > Math.PI) a -= TWO_PI;
  else if (a <= -Math.PI) a += TWO_PI;
  return a;
}
```

`src/core/math/rng.ts` :
```ts
export type Rng = () => number;

/** Générateur pseudo-aléatoire à graine (valeurs dans [0, 1[). */
export function mulberry32(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Valeur pseudo-aléatoire stable pour une case entière (ix, iz). */
export function hash2(ix: number, iz: number, seed: number): number {
  let h = Math.imul(ix | 0, 374761393) ^ Math.imul(iz | 0, 668265263) ^ Math.imul(seed | 0, 1442695041);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

export function randRange(rng: Rng, lo: number, hi: number): number {
  return lo + (hi - lo) * rng();
}

export function randInt(rng: Rng, n: number): number {
  return Math.min(n - 1, Math.floor(rng() * n));
}
```

`src/core/math/noise.ts` :
```ts
import { hash2 } from './rng';

const fade = (t: number): number => t * t * (3 - 2 * t);

/** Bruit de valeur 2D lissé, dans [0, 1]. */
export function valueNoise(x: number, z: number, seed: number): number {
  const ix = Math.floor(x), iz = Math.floor(z);
  const fx = fade(x - ix), fz = fade(z - iz);
  const a = hash2(ix, iz, seed), b = hash2(ix + 1, iz, seed);
  const c = hash2(ix, iz + 1, seed), d = hash2(ix + 1, iz + 1, seed);
  const top = a + (b - a) * fx;
  const bottom = c + (d - c) * fx;
  return top + (bottom - top) * fz;
}

/** Somme d'octaves de bruit, normalisée dans [0, 1]. */
export function fbm(x: number, z: number, seed: number, octaves = 3): number {
  let sum = 0, amp = 0.5, freq = 1, norm = 0;
  for (let o = 0; o < octaves; o++) {
    sum += amp * valueNoise(x * freq, z * freq, seed + o * 1013);
    norm += amp;
    amp *= 0.5;
    freq *= 2;
  }
  return sum / norm;
}
```

- [ ] **Step 3 : vérifier** — `npx vitest run tests/core/math.test.ts` → PASS ; `npx tsc --noEmit` → aucune erreur.

- [ ] **Step 4 : commit**

```bash
git add src/core/math tests/core/math.test.ts
git commit -m "Outils mathématiques : vecteurs, hasard à graine et bruit"
```

---

## Tâche 3 : Format de niveau et validation

**Files :**
- Create : `src/core/level/types.ts`, `src/core/level/validate.ts`, `tests/fixtures/levels.ts`
- Test : `tests/core/level/validate.test.ts`

**Interfaces :**
- Produces :
  - types `Level`, `PointRoute`, `Barriere`, `ObjetPlace`, `Ambiance`, `Environnement`, `CoteBarriere`, `TypeObjet`, constante `LIMITES`
  - `validateLevel(raw: unknown): ResultatValidation` avec `type ResultatValidation = { ok: true; level: Level } | { ok: false; erreurs: string[] }`
  - fixtures de test : `makeLevel(route, extra?)`, `straightLevel(length?, width?)`, `hairpinLevel()`, `curveLevel()`

- [ ] **Step 1 : types et fixtures**

`src/core/level/types.ts` :
```ts
export type Ambiance = 'jour' | 'coucher';
export type Environnement = 'montagne';
export type CoteBarriere = 'gauche' | 'droite' | 'deux' | 'ext';
export type TypeObjet = 'arbre' | 'sapin' | 'rocher' | 'pneus' | 'barriere' | 'panneau';

export interface PointRoute { x: number; z: number; y: number; l: number }
export interface Barriere { de: number; a: number; cote: CoteBarriere }
export interface ObjetPlace { type: TypeObjet; x: number; z: number; rot: number }

export interface Level {
  format: 1;
  nom: string;
  auteur: string;
  environnement: Environnement;
  ambiance: Ambiance;
  route: PointRoute[];
  barrieres: Barriere[];
  decor: { graine: number; densite: number };
  objets: ObjetPlace[];
}

export const LIMITES = {
  pointsMin: 2,
  pointsMax: 150,
  objetsMax: 300,
  longueurMax: 3000,
  largeurMin: 6,
  largeurMax: 20,
  hauteurMin: -50,
  hauteurMax: 150,
  ecartMin: 5,
  ecartMax: 150,
  nomMax: 40,
  auteurMax: 30,
} as const;
```

`tests/fixtures/levels.ts` :
```ts
import type { Level } from '../../src/core/level/types';

/** route : liste de [x, z, y, l] */
export function makeLevel(route: [number, number, number, number][], extra: Partial<Level> = {}): Level {
  return {
    format: 1,
    nom: 'Test',
    auteur: 'Tests',
    environnement: 'montagne',
    ambiance: 'jour',
    route: route.map(([x, z, y, l]) => ({ x, z, y, l })),
    barrieres: [],
    decor: { graine: 1234, densite: 0.5 },
    objets: [],
    ...extra,
  };
}

/** Ligne droite vers +z depuis l'origine. */
export function straightLevel(length = 200, width = 10): Level {
  const pts: [number, number, number, number][] = [];
  const n = Math.max(1, Math.ceil(length / 50));
  for (let i = 0; i <= n; i++) pts.push([0, (length * i) / n, 0, width]);
  return makeLevel(pts);
}

/** Virage à gauche en quart de cercle, rayon 50 m, centre (50, 0). */
export function curveLevel(): Level {
  const pts: [number, number, number, number][] = [];
  for (let i = 0; i <= 4; i++) {
    const phi = (i / 4) * (Math.PI / 2);
    pts.push([50 - 50 * Math.cos(phi), 50 * Math.sin(phi), 0, 10]);
  }
  return makeLevel(pts);
}

/** Montée le long de +z, épingle en demi-cercle (rayon 20 m, centre (20, 100)), redescente parallèle à x = 40. */
export function hairpinLevel(): Level {
  return makeLevel([
    [0, 0, 0, 10],
    [0, 50, 0, 10],
    [0, 100, 0, 10],
    [5.86, 114.14, 0, 10],
    [20, 120, 0, 10],
    [34.14, 114.14, 0, 10],
    [40, 100, 0, 10],
    [40, 50, 0, 10],
    [40, 0, 0, 10],
  ]);
}
```

- [ ] **Step 2 : écrire les tests**

`tests/core/level/validate.test.ts` :
```ts
import { describe, it, expect } from 'vitest';
import { validateLevel } from '../../../src/core/level/validate';
import { makeLevel, straightLevel } from '../../fixtures/levels';

const errs = (raw: unknown): string[] => {
  const r = validateLevel(raw);
  return r.ok ? [] : r.erreurs;
};

describe('validateLevel', () => {
  it('accepte un niveau correct', () => {
    const r = validateLevel(straightLevel());
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.level.route.length).toBeGreaterThanOrEqual(2);
  });
  it('refuse ce qui n’est pas un objet', () => {
    expect(errs(null)[0]).toMatch(/objet JSON/);
    expect(errs([1, 2])[0]).toMatch(/objet JSON/);
  });
  it('refuse une version plus récente', () => {
    expect(errs({ ...straightLevel(), format: 2 })[0]).toMatch(/plus récente/);
  });
  it('refuse un format manquant', () => {
    const { format: _f, ...rest } = straightLevel();
    expect(errs(rest)[0]).toMatch(/format/);
  });
  it('vérifie nom, ambiance et environnement', () => {
    expect(errs({ ...straightLevel(), nom: '' }).join()).toMatch(/nom/);
    expect(errs({ ...straightLevel(), ambiance: 'nuit' }).join()).toMatch(/ambiance/);
    expect(errs({ ...straightLevel(), environnement: 'lune' }).join()).toMatch(/environnement/);
  });
  it('vérifie le nombre de points', () => {
    expect(errs(makeLevel([[0, 0, 0, 10]])).join()).toMatch(/2 à 150 points/);
  });
  it('vérifie largeur, hauteur et écart entre points', () => {
    expect(errs(makeLevel([[0, 0, 0, 10], [0, 50, 0, 40]])).join()).toMatch(/route\[1\]\.l/);
    expect(errs(makeLevel([[0, 0, 0, 10], [0, 50, 500, 10]])).join()).toMatch(/route\[1\]\.y/);
    expect(errs(makeLevel([[0, 0, 0, 10], [0, 2, 0, 10]])).join()).toMatch(/distance au point précédent/);
  });
  it('vérifie la longueur totale', () => {
    const pts: [number, number, number, number][] = [];
    for (let i = 0; i <= 25; i++) pts.push([0, i * 140, 0, 10]);
    expect(errs(makeLevel(pts)).join()).toMatch(/longueur totale/);
  });
  it('vérifie les barrières', () => {
    expect(errs({ ...straightLevel(), barrieres: [{ de: 2, a: 1, cote: 'gauche' }] }).join()).toMatch(/barrieres\[0\]/);
    expect(errs({ ...straightLevel(), barrieres: [{ de: 0, a: 1, cote: 'haut' }] }).join()).toMatch(/barrieres\[0\]/);
  });
  it('vérifie décor et objets', () => {
    expect(errs({ ...straightLevel(), decor: { graine: 1.5, densite: 0.5 } }).join()).toMatch(/decor/);
    expect(errs({ ...straightLevel(), decor: { graine: 1, densite: 2 } }).join()).toMatch(/decor/);
    expect(errs({ ...straightLevel(), objets: [{ type: 'cone', x: 0, z: 0, rot: 0 }] }).join()).toMatch(/objets\[0\]/);
  });
  it('rend un niveau propre (nom sans espaces autour)', () => {
    const r = validateLevel({ ...straightLevel(), nom: '  Mon niveau  ' });
    expect(r.ok && r.level.nom).toBe('Mon niveau');
  });
});
```

Run : `npx vitest run tests/core/level/validate.test.ts` → FAIL.

- [ ] **Step 3 : implémenter**

`src/core/level/validate.ts` :
```ts
import { LIMITES } from './types';
import type { Level, PointRoute, Barriere, ObjetPlace, Ambiance, CoteBarriere, TypeObjet } from './types';

export type ResultatValidation = { ok: true; level: Level } | { ok: false; erreurs: string[] };

const AMBIANCES: readonly string[] = ['jour', 'coucher'];
const ENVIRONNEMENTS: readonly string[] = ['montagne'];
const COTES: readonly string[] = ['gauche', 'droite', 'deux', 'ext'];
const TYPES_OBJETS: readonly string[] = ['arbre', 'sapin', 'rocher', 'pneus', 'barriere', 'panneau'];

const isObj = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const isInt = (v: unknown): v is number => isNum(v) && Number.isInteger(v);

export function validateLevel(raw: unknown): ResultatValidation {
  if (!isObj(raw)) return { ok: false, erreurs: ['Le niveau doit être un objet JSON.'] };
  if (!isInt(raw.format)) return { ok: false, erreurs: ['Champ « format » manquant ou invalide.'] };
  if (raw.format > 1) return { ok: false, erreurs: ["Ce niveau vient d'une version plus récente du jeu."] };
  if (raw.format < 1) return { ok: false, erreurs: ['Format de niveau inconnu.'] };

  const e: string[] = [];

  const nom = raw.nom;
  if (typeof nom !== 'string' || nom.trim().length < 1 || nom.trim().length > LIMITES.nomMax) {
    e.push(`nom : 1 à ${LIMITES.nomMax} caractères.`);
  }
  const auteur = raw.auteur;
  if (typeof auteur !== 'string' || auteur.length > LIMITES.auteurMax) {
    e.push(`auteur : 0 à ${LIMITES.auteurMax} caractères.`);
  }
  if (typeof raw.environnement !== 'string' || !ENVIRONNEMENTS.includes(raw.environnement)) {
    e.push('environnement : valeur inconnue (attendu : montagne).');
  }
  if (typeof raw.ambiance !== 'string' || !AMBIANCES.includes(raw.ambiance)) {
    e.push('ambiance : « jour » ou « coucher ».');
  }

  // Route
  const route: PointRoute[] = [];
  if (!Array.isArray(raw.route)) {
    e.push('route : liste de points manquante.');
  } else {
    if (raw.route.length < LIMITES.pointsMin || raw.route.length > LIMITES.pointsMax) {
      e.push(`route : ${LIMITES.pointsMin} à ${LIMITES.pointsMax} points.`);
    }
    raw.route.forEach((p: unknown, i: number) => {
      if (!isObj(p) || !isNum(p.x) || !isNum(p.z) || !isNum(p.y) || !isNum(p.l)) {
        e.push(`route[${i}] : x, z, y et l doivent être des nombres.`);
        return;
      }
      if (p.l < LIMITES.largeurMin || p.l > LIMITES.largeurMax) {
        e.push(`route[${i}].l : largeur hors limites (${LIMITES.largeurMin}–${LIMITES.largeurMax}).`);
      }
      if (p.y < LIMITES.hauteurMin || p.y > LIMITES.hauteurMax) {
        e.push(`route[${i}].y : hauteur hors limites (${LIMITES.hauteurMin}–${LIMITES.hauteurMax}).`);
      }
      route.push({ x: p.x, z: p.z, y: p.y, l: p.l });
    });
    let longueur = 0;
    for (let i = 1; i < route.length; i++) {
      const a = route[i - 1], b = route[i];
      const d = Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z);
      longueur += d;
      if (d < LIMITES.ecartMin || d > LIMITES.ecartMax) {
        e.push(`route[${i}] : distance au point précédent hors limites (${LIMITES.ecartMin}–${LIMITES.ecartMax} m).`);
      }
    }
    if (longueur > LIMITES.longueurMax) {
      e.push(`route : longueur totale ${Math.round(longueur)} m, maximum ${LIMITES.longueurMax} m.`);
    }
  }

  // Barrières
  const barrieres: Barriere[] = [];
  if (raw.barrieres !== undefined && !Array.isArray(raw.barrieres)) {
    e.push('barrieres : doit être une liste.');
  } else if (Array.isArray(raw.barrieres)) {
    raw.barrieres.forEach((b: unknown, i: number) => {
      if (
        !isObj(b) || !isInt(b.de) || !isInt(b.a) || typeof b.cote !== 'string' || !COTES.includes(b.cote) ||
        b.de < 0 || b.a <= b.de || b.a > route.length - 1
      ) {
        e.push(`barrieres[${i}] : « de » < « a » (indices de points) et côté gauche, droite, deux ou ext.`);
        return;
      }
      barrieres.push({ de: b.de, a: b.a, cote: b.cote as CoteBarriere });
    });
  }

  // Décor
  const decorRaw = raw.decor;
  let decor = { graine: 0, densite: 0.5 };
  if (
    !isObj(decorRaw) || !isInt(decorRaw.graine) || decorRaw.graine < 0 || decorRaw.graine > 2147483647 ||
    !isNum(decorRaw.densite) || decorRaw.densite < 0 || decorRaw.densite > 1
  ) {
    e.push('decor : graine entière (0 à 2147483647) et densité entre 0 et 1.');
  } else {
    decor = { graine: decorRaw.graine, densite: decorRaw.densite };
  }

  // Objets
  const objets: ObjetPlace[] = [];
  if (raw.objets !== undefined && !Array.isArray(raw.objets)) {
    e.push('objets : doit être une liste.');
  } else if (Array.isArray(raw.objets)) {
    if (raw.objets.length > LIMITES.objetsMax) e.push(`objets : ${LIMITES.objetsMax} au maximum.`);
    raw.objets.forEach((o: unknown, i: number) => {
      if (!isObj(o) || typeof o.type !== 'string' || !TYPES_OBJETS.includes(o.type) || !isNum(o.x) || !isNum(o.z) || !isNum(o.rot)) {
        e.push(`objets[${i}] : type inconnu ou coordonnées invalides.`);
        return;
      }
      objets.push({ type: o.type as TypeObjet, x: o.x, z: o.z, rot: o.rot });
    });
  }

  if (e.length > 0) return { ok: false, erreurs: e };
  return {
    ok: true,
    level: {
      format: 1,
      nom: (nom as string).trim(),
      auteur: auteur as string,
      environnement: 'montagne',
      ambiance: raw.ambiance as Ambiance,
      route,
      barrieres,
      decor,
      objets,
    },
  };
}
```

- [ ] **Step 4 : vérifier** — `npx vitest run tests/core/level/validate.test.ts` → PASS ; `npx tsc --noEmit` → OK.

- [ ] **Step 5 : commit**

```bash
git add src/core/level tests/core/level tests/fixtures
git commit -m "Format de niveau et validation avec messages en français"
```

---

## Tâche 4 : Piste (courbe, échantillons, projection, contrôle de géométrie)

**Files :**
- Create : `src/core/track/spline.ts`, `src/core/track/grid.ts`, `src/core/track/buildTrack.ts`, `src/core/track/projection.ts`, `src/core/track/checkGeometry.ts`, `src/core/loadLevel.ts`
- Test : `tests/core/track/track.test.ts`

**Interfaces :**
- Consumes : `Level` (Tâche 3), `validateLevel` (Tâche 3), `clamp`, `lerp`, `wrapAngle` (Tâche 2).
- Produces :
  - `interface P4 { x; y; z; l }`, `catmullRomCentripetal(p0, p1, p2, p3, u): P4`, `sampleRoute(points: P4[], step: number): { samples: (P4 & { s: number })[]; pointS: number[] }`
  - `class SampleGrid { constructor(cell: number); add(i, x, z): void; query(x, z, radius, out: number[]): number[] }`
  - `interface TrackSample { x; y; z; tx; tz; nx; nz; w; s; k; grade }` (tangente horizontale unitaire `(tx, tz)`, normale gauche `(nx, nz) = (tz, −tx)`, `w` = **demi**-largeur, `s` = abscisse en m, `k` = courbure signée (+ = gauche), `grade` = dy/ds)
  - `interface CurbRange { from: number; to: number }` (indices d'échantillons)
  - `interface TrackData { samples: TrackSample[]; length: number; targetTime: number; curbs: CurbRange[]; pointSample: number[]; grid: SampleGrid; bounds: { minX; maxX; minZ; maxZ } }`
  - `buildTrack(level: Level): TrackData` — échantillons tous les 1 m (indice ≈ mètres)
  - `interface Projection { index: number; s: number; lateral: number; dist: number }`
  - `nearestSampleWithin(track, x, z, radius): { index: number; dist: number } | null`
  - `nearestSample(track, x, z): { index: number; dist: number } | null` (cherche jusqu'à 64 m)
  - `projectOnTrack(track, x, z, hint: number, back = 20, fwd = 30): Projection`
  - `checkGeometry(track: TrackData): string[]`
  - `loadLevel(raw: unknown): { ok: true; level: Level; track: TrackData } | { ok: false; erreurs: string[] }`

- [ ] **Step 1 : écrire les tests**

`tests/core/track/track.test.ts` :
```ts
import { describe, it, expect } from 'vitest';
import { buildTrack } from '../../../src/core/track/buildTrack';
import { projectOnTrack, nearestSample, nearestSampleWithin } from '../../../src/core/track/projection';
import { checkGeometry } from '../../../src/core/track/checkGeometry';
import { loadLevel } from '../../../src/core/loadLevel';
import { makeLevel, straightLevel, curveLevel, hairpinLevel } from '../../fixtures/levels';

describe('buildTrack', () => {
  it('ligne droite : échantillons tous les mètres, tangente +z, normale gauche +x', () => {
    const t = buildTrack(straightLevel(200));
    expect(t.samples.length).toBe(201);
    expect(t.length).toBeCloseTo(200, 1);
    const mid = t.samples[100];
    expect(mid.s).toBeCloseTo(100, 5);
    expect(mid.tx).toBeCloseTo(0, 5);
    expect(mid.tz).toBeCloseTo(1, 5);
    expect(mid.nx).toBeCloseTo(1, 5);
    expect(mid.nz).toBeCloseTo(0, 5);
    expect(mid.w).toBe(5);
    expect(mid.k).toBeCloseTo(0, 5);
    expect(t.targetTime).toBeCloseTo(200 / 30, 1);
    expect(t.curbs.length).toBe(0);
    expect(t.pointSample).toEqual([0, 50, 100, 150, 200]);
    expect(t.bounds.minZ).toBeCloseTo(0, 5);
    expect(t.bounds.maxZ).toBeCloseTo(200, 1);
  });
  it('virage à gauche de rayon 50 : courbure ≈ +0,02', () => {
    const t = buildTrack(curveLevel());
    const mid = t.samples[Math.floor(t.samples.length / 2)];
    expect(mid.k).toBeGreaterThan(0.017);
    expect(mid.k).toBeLessThan(0.023);
    expect(t.length).toBeGreaterThan(75);
    expect(t.length).toBeLessThan(82);
    for (const s of t.samples) expect(s.k).toBeGreaterThan(-1 / 400);
  });
  it('pente : grade ≈ dy/ds', () => {
    const t = buildTrack(makeLevel([[0, 0, 0, 10], [0, 100, 10, 10], [0, 200, 20, 10]]));
    const mid = t.samples[Math.floor(t.samples.length / 2)];
    expect(mid.grade).toBeCloseTo(0.1, 2);
  });
  it('épingle : des vibreurs sont générés', () => {
    expect(buildTrack(hairpinLevel()).curbs.length).toBeGreaterThan(0);
  });
  it('niveau minimal de 2 points', () => {
    const t = buildTrack(makeLevel([[0, 0, 0, 10], [0, 20, 0, 10]]));
    expect(t.samples.length).toBe(21);
    expect(t.length).toBeCloseTo(20, 3);
  });
});

describe('projection', () => {
  const straight = buildTrack(straightLevel(200));
  it('projette un point sur la ligne droite', () => {
    const p = projectOnTrack(straight, 3, 100, 95);
    expect(p.s).toBeCloseTo(100, 1);
    expect(p.lateral).toBeCloseTo(3, 3);
    expect(p.index).toBe(100);
  });
  it("ne saute pas sur l'autre branche d'une épingle", () => {
    const t = buildTrack(hairpinLevel());
    const p = projectOnTrack(t, 40, 50, 50);
    expect(p.index).toBeGreaterThanOrEqual(30);
    expect(p.index).toBeLessThanOrEqual(80);
    expect(Math.abs(p.lateral)).toBeGreaterThan(30);
  });
  it('nearestSample trouve la bonne branche', () => {
    const t = buildTrack(hairpinLevel());
    const n = nearestSample(t, 40, 50);
    expect(n).not.toBeNull();
    expect(t.samples[n!.index].s).toBeGreaterThan(150);
    expect(n!.dist).toBeLessThan(1.5);
  });
  it('nearestSampleWithin renvoie null au-delà du rayon', () => {
    expect(nearestSampleWithin(straight, 30, 100, 14)).toBeNull();
    expect(nearestSampleWithin(straight, 10, 100, 14)!.dist).toBeCloseTo(10, 3);
  });
});

describe('checkGeometry', () => {
  it('niveaux corrects : aucune erreur', () => {
    expect(checkGeometry(buildTrack(straightLevel()))).toEqual([]);
    expect(checkGeometry(buildTrack(curveLevel()))).toEqual([]);
    expect(checkGeometry(buildTrack(hairpinLevel()))).toEqual([]);
  });
  it('route qui se croise', () => {
    const t = buildTrack(makeLevel([[0, 0, 0, 10], [60, 60, 0, 10], [60, 0, 0, 10], [0, 60, 0, 10]]));
    expect(checkGeometry(t).join(' ')).toMatch(/croise/);
  });
  it('virage trop serré', () => {
    const t = buildTrack(makeLevel([[0, 0, 0, 6], [0, 40, 0, 6], [8, 40, 0, 6], [8, 0, 0, 6]]));
    expect(checkGeometry(t).join(' ')).toMatch(/serré/);
  });
});

describe('loadLevel', () => {
  it('niveau valide', () => {
    const r = loadLevel(straightLevel());
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.track.samples.length).toBe(201);
  });
  it('erreurs de structure', () => {
    const r = loadLevel({ format: 1 });
    expect(r.ok).toBe(false);
  });
  it('erreurs de géométrie', () => {
    const r = loadLevel(makeLevel([[0, 0, 0, 10], [60, 60, 0, 10], [60, 0, 0, 10], [0, 60, 0, 10]]));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.erreurs.join(' ')).toMatch(/croise/);
  });
});
```

Run : `npx vitest run tests/core/track/track.test.ts` → FAIL.

- [ ] **Step 2 : implémenter la courbe et la grille**

`src/core/track/spline.ts` :
```ts
import { lerp } from '../math/vec';

export interface P4 { x: number; y: number; z: number; l: number }

function knot(t: number, a: P4, b: P4): number {
  const d = Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z);
  return t + Math.max(Math.sqrt(d), 1e-4);
}

function mix(a: P4, b: P4, ta: number, tb: number, t: number): P4 {
  const wa = (tb - t) / (tb - ta);
  const wb = (t - ta) / (tb - ta);
  return { x: a.x * wa + b.x * wb, y: a.y * wa + b.y * wb, z: a.z * wa + b.z * wb, l: a.l * wa + b.l * wb };
}

/** Catmull-Rom centripète (alpha = 0,5) sur le segment p1 → p2, u dans [0, 1]. */
export function catmullRomCentripetal(p0: P4, p1: P4, p2: P4, p3: P4, u: number): P4 {
  const t0 = 0;
  const t1 = knot(t0, p0, p1);
  const t2 = knot(t1, p1, p2);
  const t3 = knot(t2, p2, p3);
  const t = t1 + (t2 - t1) * u;
  const a1 = mix(p0, p1, t0, t1, t);
  const a2 = mix(p1, p2, t1, t2, t);
  const a3 = mix(p2, p3, t2, t3, t);
  const b1 = mix(a1, a2, t0, t2, t);
  const b2 = mix(a2, a3, t1, t3, t);
  return mix(b1, b2, t1, t2, t);
}

/**
 * Point fantôme avant le premier point (ou après le dernier) : prolonge la courbe dans la direction
 * tangente de la parabole passant par a, b, c, à la distance |b − a|. Évite le petit « S » qu'une
 * simple symétrie (2a − b) crée aux extrémités d'un virage. Repli sur la symétrie si c manque ou si
 * la tangente s'écarte de plus de 30° de la corde a → b.
 */
function ghost(a: P4, b: P4, c?: P4): P4 {
  const lin: P4 = { x: 2 * a.x - b.x, y: 2 * a.y - b.y, z: 2 * a.z - b.z, l: a.l };
  if (!c) return lin;
  const tx = (-3 * a.x + 4 * b.x - c.x) / 2, tz = (-3 * a.z + 4 * b.z - c.z) / 2;
  const cx = b.x - a.x, cz = b.z - a.z;
  const tl = Math.hypot(tx, tz), cl = Math.hypot(cx, cz);
  if (tl < 1e-6 || cl < 1e-6) return lin;
  if ((tx * cx + tz * cz) / (tl * cl) < Math.cos(Math.PI / 6)) return lin;
  return { x: a.x - (tx / tl) * cl, y: lin.y, z: a.z - (tz / tl) * cl, l: a.l };
}

/**
 * Échantillonne la courbe passant par tous les points, à pas constant (longueur 3D).
 * pointS[i] = abscisse du point de passage i.
 */
export function sampleRoute(points: P4[], step: number): { samples: (P4 & { s: number })[]; pointS: number[] } {
  const n = points.length;
  const ext = [ghost(points[0], points[1], points[2]), ...points, ghost(points[n - 1], points[n - 2], points[n - 3])];
  const SUB = 32;
  const dense: P4[] = [];
  const pointDense: number[] = [];
  for (let i = 0; i < n - 1; i++) {
    pointDense.push(dense.length);
    for (let k = 0; k < SUB; k++) dense.push(catmullRomCentripetal(ext[i], ext[i + 1], ext[i + 2], ext[i + 3], k / SUB));
  }
  pointDense.push(dense.length);
  dense.push({ ...points[n - 1] });

  const cum = new Float64Array(dense.length);
  for (let i = 1; i < dense.length; i++) {
    const a = dense[i - 1], b = dense[i];
    cum[i] = cum[i - 1] + Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z);
  }
  const total = cum[dense.length - 1];
  const pointS = pointDense.map((i) => cum[i]);

  const targets: number[] = [];
  const count = Math.floor(total / step + 1e-9);
  for (let k = 0; k <= count; k++) targets.push(k * step);
  if (total - count * step > 0.01) targets.push(total);

  const samples: (P4 & { s: number })[] = [];
  let j = 0;
  for (const t of targets) {
    while (j < dense.length - 2 && cum[j + 1] < t) j++;
    const seg = cum[j + 1] - cum[j];
    const u = seg > 1e-9 ? Math.min(1, Math.max(0, (t - cum[j]) / seg)) : 0;
    const a = dense[j], b = dense[j + 1];
    samples.push({ x: lerp(a.x, b.x, u), y: lerp(a.y, b.y, u), z: lerp(a.z, b.z, u), l: lerp(a.l, b.l, u), s: t });
  }
  return { samples, pointS };
}
```

`src/core/track/grid.ts` :
```ts
/** Grille de hachage spatial : indices d'éléments rangés par case de `cell` mètres. */
export class SampleGrid {
  private readonly map = new Map<number, number[]>();
  constructor(readonly cell: number) {}

  private key(ix: number, iz: number): number {
    return (ix + 32768) * 65536 + (iz + 32768);
  }

  add(i: number, x: number, z: number): void {
    const k = this.key(Math.floor(x / this.cell), Math.floor(z / this.cell));
    let b = this.map.get(k);
    if (!b) { b = []; this.map.set(k, b); }
    b.push(i);
  }

  /** Remplit `out` avec les indices des cases qui recouvrent le carré (x ± r, z ± r). */
  query(x: number, z: number, radius: number, out: number[]): number[] {
    out.length = 0;
    const c = this.cell;
    const x0 = Math.floor((x - radius) / c), x1 = Math.floor((x + radius) / c);
    const z0 = Math.floor((z - radius) / c), z1 = Math.floor((z + radius) / c);
    for (let iz = z0; iz <= z1; iz++) {
      for (let ix = x0; ix <= x1; ix++) {
        const b = this.map.get(this.key(ix, iz));
        if (b) for (const i of b) out.push(i);
      }
    }
    return out;
  }
}
```

- [ ] **Step 3 : construire la piste**

`src/core/track/buildTrack.ts` :
```ts
import type { Level } from '../level/types';
import { clamp, wrapAngle } from '../math/vec';
import { sampleRoute, type P4 } from './spline';
import { SampleGrid } from './grid';

export interface TrackSample {
  x: number; y: number; z: number;
  /** tangente horizontale unitaire */
  tx: number; tz: number;
  /** normale gauche unitaire = (tz, −tx) */
  nx: number; nz: number;
  /** demi-largeur de la route (m) */
  w: number;
  /** abscisse curviligne (m) */
  s: number;
  /** courbure signée (1/m), + = virage à gauche */
  k: number;
  /** pente dy/ds */
  grade: number;
}

export interface CurbRange { from: number; to: number }

export interface TrackData {
  samples: TrackSample[];
  length: number;
  targetTime: number;
  curbs: CurbRange[];
  pointSample: number[];
  grid: SampleGrid;
  bounds: { minX: number; maxX: number; minZ: number; maxZ: number };
}

const STEP = 1;
const A_LAT = 8;
const V_MIN = 12;
const V_MAX = 30;
const CURB_K = 1 / 40;

export function buildTrack(level: Level): TrackData {
  const pts: P4[] = level.route.map((p) => ({ x: p.x, y: p.y, z: p.z, l: p.l }));
  const { samples: raw, pointS } = sampleRoute(pts, STEP);
  const n = raw.length;
  const samples: TrackSample[] = raw.map((r) => ({
    x: r.x, y: r.y, z: r.z, tx: 0, tz: 1, nx: 1, nz: 0, w: clamp(r.l, 6, 20) / 2, s: r.s, k: 0, grade: 0,
  }));

  // Tangentes, normales, pente
  for (let i = 0; i < n; i++) {
    const a = samples[Math.max(0, i - 1)], b = samples[Math.min(n - 1, i + 1)];
    const dx = b.x - a.x, dz = b.z - a.z;
    const len = Math.hypot(dx, dz) || 1;
    const sp = samples[i];
    sp.tx = dx / len; sp.tz = dz / len;
    sp.nx = sp.tz; sp.nz = -sp.tx;
    const ds = b.s - a.s;
    sp.grade = ds > 1e-9 ? (b.y - a.y) / ds : 0;
  }

  // Courbure : variation de cap sur ±2 échantillons, puis moyenne glissante sur 5
  const heading = samples.map((sp) => Math.atan2(sp.tx, sp.tz));
  const rawK = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    const i0 = Math.max(0, i - 2), i1 = Math.min(n - 1, i + 2);
    const ds = samples[i1].s - samples[i0].s;
    rawK[i] = ds > 1e-9 ? wrapAngle(heading[i1] - heading[i0]) / ds : 0;
  }
  for (let i = 0; i < n; i++) {
    let sum = 0, cnt = 0;
    for (let j = Math.max(0, i - 2); j <= Math.min(n - 1, i + 2); j++) { sum += rawK[j]; cnt++; }
    samples[i].k = sum / cnt;
  }

  // Temps cible (spec §5.2)
  let targetTime = 0;
  for (let i = 1; i < n; i++) {
    const k = Math.abs(samples[i].k);
    const vref = k > 1e-9 ? clamp(Math.sqrt(A_LAT / k), V_MIN, V_MAX) : V_MAX;
    targetTime += (samples[i].s - samples[i - 1].s) / vref;
  }

  // Vibreurs : zones de rayon < 40 m d'au moins 5 m, prolongées de 3 m, fusionnées
  const curbs: CurbRange[] = [];
  let start = -1;
  for (let i = 0; i <= n; i++) {
    const tight = i < n && Math.abs(samples[i].k) > CURB_K;
    if (tight && start < 0) start = i;
    if (!tight && start >= 0) {
      if (i - start >= 5) {
        const from = Math.max(0, start - 3), to = Math.min(n - 1, i - 1 + 3);
        const last = curbs[curbs.length - 1];
        if (last && from <= last.to) last.to = to;
        else curbs.push({ from, to });
      }
      start = -1;
    }
  }

  const pointSample = pointS.map((s) => Math.min(n - 1, Math.round(s / STEP)));

  const grid = new SampleGrid(16);
  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
  samples.forEach((sp, i) => {
    grid.add(i, sp.x, sp.z);
    minX = Math.min(minX, sp.x); maxX = Math.max(maxX, sp.x);
    minZ = Math.min(minZ, sp.z); maxZ = Math.max(maxZ, sp.z);
  });

  return { samples, length: samples[n - 1].s, targetTime, curbs, pointSample, grid, bounds: { minX, maxX, minZ, maxZ } };
}
```

- [ ] **Step 4 : projection, contrôle de géométrie, chargement**

`src/core/track/projection.ts` :
```ts
import { clamp } from '../math/vec';
import type { TrackData } from './buildTrack';

export interface Projection { index: number; s: number; lateral: number; dist: number }

const scratch: number[] = [];

/** Échantillon le plus proche dans un rayon donné (une seule recherche dans la grille). */
export function nearestSampleWithin(track: TrackData, x: number, z: number, radius: number): { index: number; dist: number } | null {
  track.grid.query(x, z, radius, scratch);
  let best = -1;
  let bestD2 = radius * radius;
  for (const i of scratch) {
    const sp = track.samples[i];
    const dx = sp.x - x, dz = sp.z - z;
    const d2 = dx * dx + dz * dz;
    if (d2 < bestD2 || (d2 === bestD2 && best < 0)) { bestD2 = d2; best = i; }
  }
  return best < 0 ? null : { index: best, dist: Math.sqrt(bestD2) };
}

/** Échantillon le plus proche, cherché jusqu'à 64 m (null au-delà). */
export function nearestSample(track: TrackData, x: number, z: number): { index: number; dist: number } | null {
  for (const r of [16, 32, 64]) {
    const res = nearestSampleWithin(track, x, z, r);
    if (res) return res;
  }
  return null;
}

/** Projection sur la route en ne cherchant qu'autour de l'indice `hint` (anti-raccourci). */
export function projectOnTrack(track: TrackData, x: number, z: number, hint: number, back = 20, fwd = 30): Projection {
  const S = track.samples;
  const i0 = Math.max(0, Math.min(S.length - 1, hint - back));
  const i1 = Math.max(0, Math.min(S.length - 1, hint + fwd));
  let best = i0, bestD2 = Infinity;
  for (let i = i0; i <= i1; i++) {
    const dx = S[i].x - x, dz = S[i].z - z;
    const d2 = dx * dx + dz * dz;
    if (d2 < bestD2) { bestD2 = d2; best = i; }
  }
  const sp = S[best];
  const dx = x - sp.x, dz = z - sp.z;
  const along = dx * sp.tx + dz * sp.tz;
  const lateral = dx * sp.nx + dz * sp.nz;
  return { index: best, s: clamp(sp.s + along, 0, track.length), lateral, dist: Math.sqrt(bestD2) };
}
```

`src/core/track/checkGeometry.ts` :
```ts
import type { TrackData } from './buildTrack';

const MAX_PAR_TYPE = 5;

/** Erreurs de géométrie : croisements / passages trop proches, virages de rayon < 8 m. */
export function checkGeometry(track: TrackData): string[] {
  const errs: string[] = [];
  const S = track.samples;
  const scratch: number[] = [];

  let crossings = 0;
  let lastFlag = -Infinity;
  for (let i = 0; i < S.length && crossings < MAX_PAR_TYPE; i += 2) {
    const a = S[i];
    track.grid.query(a.x, a.z, a.w + 14, scratch);
    for (const j of scratch) {
      if (j <= i) continue;
      const b = S[j];
      const thr = a.w + b.w + 4;
      if (b.s - a.s <= 2 * thr) continue;
      if (Math.hypot(a.x - b.x, a.z - b.z) < thr) {
        if (a.s - lastFlag > 30) {
          errs.push(`La route se croise ou passe trop près d'elle-même (vers ${Math.round(a.s)} m et ${Math.round(b.s)} m).`);
          crossings++;
          lastFlag = a.s;
        }
        break;
      }
    }
  }

  let inTight = false;
  let tight = 0;
  for (const sp of S) {
    const r = Math.abs(sp.k) > 1e-9 ? 1 / Math.abs(sp.k) : Infinity;
    if (r < 8) {
      if (!inTight && tight < MAX_PAR_TYPE) {
        errs.push(`Virage trop serré vers ${Math.round(sp.s)} m (rayon ${r.toFixed(1)} m, minimum 8 m).`);
        tight++;
      }
      inTight = true;
    } else {
      inTight = false;
    }
  }
  return errs;
}
```

`src/core/loadLevel.ts` :
```ts
import type { Level } from './level/types';
import { validateLevel } from './level/validate';
import { buildTrack, type TrackData } from './track/buildTrack';
import { checkGeometry } from './track/checkGeometry';

export type ResultatChargement = { ok: true; level: Level; track: TrackData } | { ok: false; erreurs: string[] };

/** Valide la structure, construit la piste et vérifie sa géométrie. */
export function loadLevel(raw: unknown): ResultatChargement {
  const v = validateLevel(raw);
  if (!v.ok) return v;
  const track = buildTrack(v.level);
  const geo = checkGeometry(track);
  if (geo.length > 0) return { ok: false, erreurs: geo };
  return { ok: true, level: v.level, track };
}
```

- [ ] **Step 5 : vérifier** — `npx vitest run tests/core/track/track.test.ts` → PASS ; `npx tsc --noEmit` → OK.

Si `checkGeometry` signale un virage serré sur `hairpinLevel()` ou `curveLevel()`, ne pas modifier les seuils : afficher le rayon minimal `Math.min(...t.samples.map((s) => 1 / Math.abs(s.k)))` pour diagnostiquer, et vérifier le calcul de courbure (rayon attendu de l'épingle ≈ 15–20 m). Signaler le problème dans le rapport plutôt que d'affaiblir un test.

- [ ] **Step 6 : commit**

```bash
git add src/core/track src/core/loadLevel.ts tests/core/track
git commit -m "Piste : courbe Catmull-Rom, échantillons, projection anti-raccourci et contrôle de géométrie"
```

---

## Tâche 5 : Terrain (hauteurs autour de la route)

**Files :**
- Create : `src/core/track/terrain.ts`
- Test : `tests/core/track/terrain.test.ts`

**Interfaces :**
- Consumes : `TrackData`, `TrackSample`, `nearestSampleWithin` (Tâche 4), `fbm`, `lerp`, `smoothstep`, `clamp` (Tâche 2).
- Produces :
  - `interface Ground { heightAt(x, z): number; gradientAt(x, z): { gx: number; gz: number } }`
  - `rise(e: number, n: number): number`
  - `class Terrain implements Ground { constructor(track: TrackData, seed: number); readonly minX; maxX; minZ; maxZ; heightAt(x, z); gradientAt(x, z); distanceToRoad(x, z): number }`

Principe (spec §5.3) : deux grilles. Grille fine (maille 4 m, jusqu'à 64 m de la route) et grille grossière (maille 16 m, jusqu'à 420 m, marge 440 m). Chaque échantillon de route « tamponne » les cases proches avec `hauteur = y_route + rise(distance − (w + 1,5), bruit)` en gardant le **minimum** : le terrain reste continu entre deux portions de route à des hauteurs différentes. Sur la chaussée et jusqu'à `w + 1 m`, la hauteur vaut exactement celle de la route, avec une transition douce jusqu'à `w + 3 m`.

- [ ] **Step 1 : écrire les tests**

`tests/core/track/terrain.test.ts` :
```ts
import { describe, it, expect } from 'vitest';
import { buildTrack } from '../../../src/core/track/buildTrack';
import { Terrain, rise } from '../../../src/core/track/terrain';
import { makeLevel, straightLevel } from '../../fixtures/levels';

describe('rise', () => {
  it('nul sur l’accotement, croissant ensuite, plafonné', () => {
    expect(rise(-3, 1)).toBe(0);
    expect(rise(0, 1)).toBe(0);
    expect(rise(5, 1)).toBeCloseTo(0.5, 6);
    expect(rise(50, 1)).toBeGreaterThan(rise(20, 1));
    expect(rise(5000, 1)).toBe(250);
  });
});

describe('Terrain', () => {
  const track = buildTrack(straightLevel(300));
  const terrain = new Terrain(track, 1234);

  it('hauteur exacte sur la route et sur l’accotement', () => {
    expect(terrain.heightAt(0, 150)).toBeCloseTo(0, 6);
    expect(terrain.heightAt(3, 150)).toBeCloseTo(0, 6);
    expect(terrain.heightAt(-5.9, 150)).toBeCloseTo(0, 6);
  });
  it('les collines montent en s’éloignant', () => {
    expect(terrain.heightAt(40, 150)).toBeGreaterThan(1);
    expect(terrain.heightAt(200, 150)).toBeGreaterThan(20);
  });
  it('continu de la route jusqu’à 150 m (pas de marche)', () => {
    let prev = terrain.heightAt(0, 150);
    for (let x = 0.1; x <= 150; x += 0.1) {
      const h = terrain.heightAt(x, 150);
      expect(Math.abs(h - prev)).toBeLessThan(0.25);
      prev = h;
    }
  });
  it('définie partout, même loin (bord de grille)', () => {
    expect(Number.isFinite(terrain.heightAt(5000, -5000))).toBe(true);
    expect(Number.isFinite(terrain.heightAt(-800, 150))).toBe(true);
  });
  it('distance à la route approximative', () => {
    expect(terrain.distanceToRoad(30, 150)).toBeGreaterThan(27);
    expect(terrain.distanceToRoad(30, 150)).toBeLessThan(33);
    expect(terrain.distanceToRoad(0, 150)).toBeLessThan(2);
    expect(terrain.distanceToRoad(300, 150)).toBeGreaterThan(250);
  });
  it('route en pente : hauteur et gradient', () => {
    const t = buildTrack(makeLevel([[0, 0, 0, 10], [0, 100, 10, 10], [0, 200, 20, 10]]));
    const ter = new Terrain(t, 1);
    expect(ter.heightAt(0, 100)).toBeCloseTo(10, 0);
    const g = ter.gradientAt(0, 100);
    expect(g.gz).toBeCloseTo(0.1, 1);
    expect(Math.abs(g.gx)).toBeLessThan(0.02);
  });
  it('déterministe', () => {
    const t2 = new Terrain(track, 1234);
    expect(t2.heightAt(77.7, 33.3)).toBe(terrain.heightAt(77.7, 33.3));
  });
});
```

Run : `npx vitest run tests/core/track/terrain.test.ts` → FAIL.

- [ ] **Step 2 : implémenter**

`src/core/track/terrain.ts` :
```ts
import type { TrackData, TrackSample } from './buildTrack';
import { nearestSampleWithin } from './projection';
import { fbm } from '../math/noise';
import { clamp, lerp, smoothstep } from '../math/vec';

export interface Ground {
  heightAt(x: number, z: number): number;
  gradientAt(x: number, z: number): { gx: number; gz: number };
}

/** Élévation du terrain à `e` mètres au-delà de l'accotement ; `n` = facteur de bruit (0,35..1). */
export function rise(e: number, n: number): number {
  if (e <= 0) return 0;
  const a = Math.min(e, 10);
  const b = Math.max(0, e - 10);
  return Math.min(250, (0.02 * a * a + 0.4 * b + 0.0015 * b * b) * n);
}

interface Grid {
  ox: number; oz: number; cell: number; nx: number; nz: number;
  h: Float32Array; d: Float32Array; noise: Float32Array;
}

const FINE_CELL = 4, FINE_R = 64;
const COARSE_CELL = 16, COARSE_R = 420, MARGIN = 440;

function makeGrid(ox: number, oz: number, cell: number, width: number, depth: number, seed: number): Grid {
  const nx = Math.ceil(width / cell) + 1;
  const nz = Math.ceil(depth / cell) + 1;
  const h = new Float32Array(nx * nz).fill(Infinity);
  const d = new Float32Array(nx * nz).fill(Infinity);
  const noise = new Float32Array(nx * nz);
  for (let iz = 0; iz < nz; iz++) {
    for (let ix = 0; ix < nx; ix++) {
      const wx = ox + ix * cell, wz = oz + iz * cell;
      noise[iz * nx + ix] = 0.35 + 0.65 * fbm(wx / 140, wz / 140, seed + 77);
    }
  }
  return { ox, oz, cell, nx, nz, h, d, noise };
}

function stampOne(g: Grid, sp: TrackSample, radius: number): void {
  const shoulder = sp.w + 1.5;
  const cx0 = Math.max(0, Math.floor((sp.x - radius - g.ox) / g.cell));
  const cx1 = Math.min(g.nx - 1, Math.ceil((sp.x + radius - g.ox) / g.cell));
  const cz0 = Math.max(0, Math.floor((sp.z - radius - g.oz) / g.cell));
  const cz1 = Math.min(g.nz - 1, Math.ceil((sp.z + radius - g.oz) / g.cell));
  for (let cz = cz0; cz <= cz1; cz++) {
    const dz = g.oz + cz * g.cell - sp.z;
    for (let cx = cx0; cx <= cx1; cx++) {
      const dx = g.ox + cx * g.cell - sp.x;
      const dd = Math.sqrt(dx * dx + dz * dz);
      if (dd > radius) continue;
      const idx = cz * g.nx + cx;
      if (dd < g.d[idx]) g.d[idx] = dd;
      const hh = sp.y + rise(dd - shoulder, g.noise[idx]);
      if (hh < g.h[idx]) g.h[idx] = hh;
    }
  }
}

function stamp(g: Grid, track: TrackData, every: number, radius: number): void {
  const S = track.samples;
  for (let i = 0; i < S.length; i += every) stampOne(g, S[i], radius);
  if ((S.length - 1) % every !== 0) stampOne(g, S[S.length - 1], radius);
}

/** Interpolation bilinéaire ; NaN hors grille ou si un coin n'a pas de valeur. */
function bilinear(g: Grid, arr: Float32Array, x: number, z: number): number {
  const fx = (x - g.ox) / g.cell, fz = (z - g.oz) / g.cell;
  const ix = Math.floor(fx), iz = Math.floor(fz);
  if (ix < 0 || iz < 0 || ix >= g.nx - 1 || iz >= g.nz - 1) return NaN;
  const tx = fx - ix, tz = fz - iz;
  const i00 = iz * g.nx + ix;
  const a = arr[i00], b = arr[i00 + 1], c = arr[i00 + g.nx], d = arr[i00 + g.nx + 1];
  if (!(a < Infinity && b < Infinity && c < Infinity && d < Infinity)) return NaN;
  return (a + (b - a) * tx) * (1 - tz) + (c + (d - c) * tx) * tz;
}

export class Terrain implements Ground {
  readonly minX: number;
  readonly maxX: number;
  readonly minZ: number;
  readonly maxZ: number;
  private readonly fine: Grid;
  private readonly coarse: Grid;

  constructor(private readonly track: TrackData, seed: number) {
    const b = track.bounds;
    this.fine = makeGrid(b.minX - FINE_R, b.minZ - FINE_R, FINE_CELL, b.maxX - b.minX + 2 * FINE_R, b.maxZ - b.minZ + 2 * FINE_R, seed);
    this.coarse = makeGrid(b.minX - MARGIN, b.minZ - MARGIN, COARSE_CELL, b.maxX - b.minX + 2 * MARGIN, b.maxZ - b.minZ + 2 * MARGIN, seed);
    stamp(this.fine, track, 2, FINE_R);
    stamp(this.coarse, track, 8, COARSE_R);
    let maxH = -Infinity;
    for (const h of this.coarse.h) if (h < Infinity && h > maxH) maxH = h;
    for (let i = 0; i < this.coarse.h.length; i++) {
      if (this.coarse.h[i] === Infinity) { this.coarse.h[i] = maxH; this.coarse.d[i] = 1000; }
    }
    this.minX = this.coarse.ox;
    this.minZ = this.coarse.oz;
    this.maxX = this.coarse.ox + (this.coarse.nx - 1) * COARSE_CELL;
    this.maxZ = this.coarse.oz + (this.coarse.nz - 1) * COARSE_CELL;
  }

  private coarseAt(arr: Float32Array, x: number, z: number): number {
    const cx = clamp(x, this.minX, this.maxX - 1e-3);
    const cz = clamp(z, this.minZ, this.maxZ - 1e-3);
    return bilinear(this.coarse, arr, cx, cz);
  }

  private gridHeight(x: number, z: number): number {
    const coarse = this.coarseAt(this.coarse.h, x, z);
    const f = bilinear(this.fine, this.fine.h, x, z);
    if (Number.isNaN(f)) return coarse;
    const fd = bilinear(this.fine, this.fine.d, x, z);
    return lerp(f, coarse, smoothstep(44, 60, fd));
  }

  heightAt(x: number, z: number): number {
    const g = this.gridHeight(x, z);
    const near = nearestSampleWithin(this.track, x, z, 14);
    if (!near) return g;
    const sp = this.track.samples[near.index];
    const along = (x - sp.x) * sp.tx + (z - sp.z) * sp.tz;
    const roadY = sp.y + sp.grade * along;
    return lerp(roadY, g, smoothstep(sp.w + 1, sp.w + 3, near.dist));
  }

  gradientAt(x: number, z: number): { gx: number; gz: number } {
    const e = 0.5;
    return {
      gx: (this.heightAt(x + e, z) - this.heightAt(x - e, z)) / (2 * e),
      gz: (this.heightAt(x, z + e) - this.heightAt(x, z - e)) / (2 * e),
    };
  }

  /** Distance approximative (±2 m) à l'axe de la route. */
  distanceToRoad(x: number, z: number): number {
    const f = bilinear(this.fine, this.fine.d, x, z);
    if (!Number.isNaN(f)) return f;
    return this.coarseAt(this.coarse.d, x, z);
  }
}
```

- [ ] **Step 3 : vérifier** — `npx vitest run tests/core/track/terrain.test.ts` → PASS ; `npx tsc --noEmit` → OK.

Si le test de continuité échoue, afficher l'abscisse `x` où le saut se produit : un saut vers 44–64 m indique un problème de transition fine/grossière (vérifier que `stamp` de la grille fine utilise bien le rayon 64 et la maille 4) ; un saut vers `w + 1..3 m` indique un problème dans `heightAt`.

- [ ] **Step 4 : commit**

```bash
git add src/core/track/terrain.ts tests/core/track/terrain.test.ts
git commit -m "Terrain : grilles de hauteurs autour de la route, collines et pente"
```

---

## Tâche 6 : Environnement procédural (décor, barrières, obstacles)

**Files :**
- Create : `src/core/env/types.ts`, `src/core/env/generate.ts`
- Test : `tests/core/env/generate.test.ts`

**Interfaces :**
- Consumes : `Level` (T3), `TrackData`, `nearestSampleWithin`, `nearestSample` (T4), `Terrain` (T5), `mulberry32`, `fbm`, `smoothstep`, `DEG` (T2).
- Produces :
  - `type DecorKind = 'sapin' | 'feuillu' | 'rocher' | 'rocherHaut' | 'chevron' | 'borne' | 'pneus' | 'panneau'`
  - `interface EnvItem { kind: DecorKind; variant: number; x; y; z; rot: number; scale: number; solid: boolean; manual: boolean }`
  - `interface CircleCollider { x; z; r }`, `interface SegmentCollider { ax; az; bx; bz }`, `interface BarrierPiece { x; y; z; rot; len }`
  - `interface Environment { items: EnvItem[]; circles: CircleCollider[]; segments: SegmentCollider[]; barriers: BarrierPiece[] }`
  - constantes `VARIANTS: Record<DecorKind, number>`, `COLLIDER_RADIUS: Record<DecorKind, number>`, `SOLID_DISTANCE = 40`
  - `forestThreshold(densite: number): number`, `forestMask(x, z, graine): number` (réutilisés par le rendu du terrain)
  - `generateEnvironment(level: Level, track: TrackData, terrain: Terrain): Environment`

Règles (spec §5.5) : couloir libre de `w + 3 m` autour de l'axe ; rien à moins de 4 m d'un objet manuel ; obstacles solides à moins de 40 m de la route ; forêt en bosquets par bruit ; rochers plus fréquents sur les pentes ; chevrons à l'extérieur des virages de rayon < 30 m ; bornes tous les 25 m sauf là où il y a une barrière ou une zone de virage serré. `rot` est un cap (convention ψ) : l'objet regarde vers `(sin rot, cos rot)`.

- [ ] **Step 1 : écrire les tests**

`tests/core/env/generate.test.ts` :
```ts
import { describe, it, expect } from 'vitest';
import { buildTrack } from '../../../src/core/track/buildTrack';
import { Terrain } from '../../../src/core/track/terrain';
import { nearestSample } from '../../../src/core/track/projection';
import { generateEnvironment } from '../../../src/core/env/generate';
import type { Level } from '../../../src/core/level/types';
import { straightLevel, curveLevel, hairpinLevel } from '../../fixtures/levels';

function envOf(level: Level) {
  const track = buildTrack(level);
  const terrain = new Terrain(track, level.decor.graine);
  return { track, terrain, env: generateEnvironment(level, track, terrain) };
}

describe('generateEnvironment', () => {
  it('déterministe', () => {
    const lv = straightLevel(300);
    expect(envOf(lv).env).toEqual(envOf(lv).env);
  });
  it('une autre graine donne un autre décor', () => {
    const a = envOf(straightLevel(300)).env;
    const lv = straightLevel(300);
    lv.decor.graine = 999;
    const b = envOf(lv).env;
    expect(b.items.map((i) => i.x)).not.toEqual(a.items.map((i) => i.x));
  });
  it('rien dans le couloir de la route', () => {
    const { track, env } = envOf(hairpinLevel());
    for (const it of env.items) {
      if (it.manual) continue;
      const n = nearestSample(track, it.x, it.z);
      if (!n) continue;
      const w = track.samples[n.index].w;
      const min = it.kind === 'chevron' || it.kind === 'borne' ? w + 1.5 : w + 3;
      expect(n.dist).toBeGreaterThanOrEqual(min - 0.05);
    }
  });
  it('un cercle d’obstacle par objet solide, solides seulement près de la route', () => {
    const { terrain, env } = envOf(straightLevel(300));
    expect(env.circles.length).toBe(env.items.filter((i) => i.solid).length);
    for (const it of env.items) {
      if (it.solid && !it.manual) expect(terrain.distanceToRoad(it.x, it.z)).toBeLessThan(40);
    }
    expect(env.items.some((i) => !i.solid)).toBe(true);
  });
  it('la densité change le nombre d’arbres', () => {
    const lo = straightLevel(300); lo.decor.densite = 0;
    const hi = straightLevel(300); hi.decor.densite = 1;
    const count = (lv: Level) => envOf(lv).env.items.filter((i) => i.kind === 'sapin' || i.kind === 'feuillu').length;
    expect(count(hi)).toBeGreaterThan(count(lo) * 1.5);
  });
  it('objets manuels : présents, solides, sans arbre généré à moins de 4 m', () => {
    const lv = straightLevel(300);
    lv.objets = [{ type: 'arbre', x: 20, z: 150, rot: 0 }, { type: 'barriere', x: 15, z: 100, rot: 0 }];
    const { env } = envOf(lv);
    const tree = env.items.find((i) => i.manual);
    expect(tree).toMatchObject({ kind: 'feuillu', x: 20, z: 150, solid: true });
    for (const it of env.items) {
      if (it.manual) continue;
      expect(Math.hypot(it.x - 20, it.z - 150)).toBeGreaterThanOrEqual(4);
    }
    const seg = env.segments.find((s) => Math.abs(s.ax - 15) < 1e-9);
    expect(seg).toBeDefined();
    expect(seg!.az).toBeCloseTo(98, 6);
    expect(seg!.bz).toBeCloseTo(102, 6);
  });
  it('barrière à gauche sur la ligne droite (x ≈ w + 0,8)', () => {
    const lv = straightLevel(300);
    lv.barrieres = [{ de: 0, a: 2, cote: 'gauche' }];
    const { env } = envOf(lv);
    expect(env.segments.length).toBeGreaterThan(40);
    for (const s of env.segments) {
      expect(s.ax).toBeCloseTo(5.8, 3);
      expect(s.bz).toBeLessThanOrEqual(100.001);
    }
    expect(env.barriers.length).toBe(env.segments.length);
  });
  it('barrière « ext » : à l’extérieur du virage à gauche', () => {
    const lv = curveLevel();
    lv.barrieres = [{ de: 0, a: 4, cote: 'ext' }];
    const { env } = envOf(lv);
    for (const s of env.segments.slice(3, -3)) {
      expect(Math.hypot(s.ax - 50, s.az)).toBeGreaterThan(54.5);
    }
  });
  it('chevrons dans l’épingle, bornes sur la ligne droite', () => {
    expect(envOf(hairpinLevel()).env.items.filter((i) => i.kind === 'chevron').length).toBeGreaterThan(0);
    expect(envOf(straightLevel(300)).env.items.filter((i) => i.kind === 'borne').length).toBeGreaterThanOrEqual(20);
  });
  it('toutes les positions sont finies', () => {
    for (const it of envOf(hairpinLevel()).env.items) {
      expect(Number.isFinite(it.x + it.y + it.z + it.rot + it.scale)).toBe(true);
    }
  });
});
```

Run : `npx vitest run tests/core/env/generate.test.ts` → FAIL.

- [ ] **Step 2 : implémenter**

`src/core/env/types.ts` :
```ts
export type DecorKind = 'sapin' | 'feuillu' | 'rocher' | 'rocherHaut' | 'chevron' | 'borne' | 'pneus' | 'panneau';

export interface EnvItem {
  kind: DecorKind;
  variant: number;
  x: number; y: number; z: number;
  /** cap (convention ψ) */
  rot: number;
  /** multiplicateur de taille autour de la taille de base du modèle */
  scale: number;
  solid: boolean;
  manual: boolean;
}

export interface CircleCollider { x: number; z: number; r: number }
export interface SegmentCollider { ax: number; az: number; bx: number; bz: number }
export interface BarrierPiece { x: number; y: number; z: number; rot: number; len: number }

export interface Environment {
  items: EnvItem[];
  circles: CircleCollider[];
  segments: SegmentCollider[];
  barriers: BarrierPiece[];
}

export const VARIANTS: Record<DecorKind, number> = {
  sapin: 3, feuillu: 3, rocher: 2, rocherHaut: 1, chevron: 1, borne: 1, pneus: 1, panneau: 1,
};

/** Rayon de collision (m) pour scale = 1. */
export const COLLIDER_RADIUS: Record<DecorKind, number> = {
  sapin: 0.45, feuillu: 0.5, rocher: 1.4, rocherHaut: 1.1, chevron: 0.15, borne: 0.12, pneus: 0.6, panneau: 0.15,
};

export const SOLID_DISTANCE = 40;
```

`src/core/env/generate.ts` :
```ts
import type { Level } from '../level/types';
import type { TrackData } from '../track/buildTrack';
import type { Terrain } from '../track/terrain';
import { nearestSampleWithin } from '../track/projection';
import { mulberry32 } from '../math/rng';
import { fbm } from '../math/noise';
import { smoothstep, DEG } from '../math/vec';
import { COLLIDER_RADIUS, SOLID_DISTANCE, type DecorKind, type EnvItem, type Environment } from './types';

/** Au-dessus de ce seuil, le masque de forêt vaut « forêt ». */
export function forestThreshold(densite: number): number {
  return 1 - (0.35 + 0.5 * densite);
}

export function forestMask(x: number, z: number, graine: number): number {
  return fbm(x / 120, z / 120, graine + 11);
}

const MANUAL_KIND: Record<string, DecorKind> = {
  arbre: 'feuillu', sapin: 'sapin', rocher: 'rocher', pneus: 'pneus', panneau: 'panneau',
};

export function generateEnvironment(level: Level, track: TrackData, terrain: Terrain): Environment {
  const env: Environment = { items: [], circles: [], segments: [], barriers: [] };
  const { graine, densite } = level.decor;
  const rng = mulberry32(graine);
  const S = track.samples;
  const lowest = S.reduce((m, s) => Math.min(m, s.y), Infinity);
  const manual = level.objets;

  const nearManual = (x: number, z: number, r: number): boolean =>
    manual.some((o) => (o.x - x) * (o.x - x) + (o.z - z) * (o.z - z) < r * r);
  const inCorridor = (x: number, z: number, margin: number, d: number): boolean => {
    if (d > 25) return false;
    const ns = nearestSampleWithin(track, x, z, 25);
    return ns !== null && ns.dist < S[ns.index].w + margin;
  };
  const add = (item: EnvItem): void => {
    env.items.push(item);
    if (item.solid) env.circles.push({ x: item.x, z: item.z, r: COLLIDER_RADIUS[item.kind] * item.scale });
  };

  // 1. Barrières du niveau (tronçons de 2 m, à w + 0,8 m de l'axe)
  const leftCovered = new Uint8Array(S.length);
  const rightCovered = new Uint8Array(S.length);
  for (const b of level.barrieres) {
    const i0 = track.pointSample[b.de], i1 = track.pointSample[b.a];
    let extSide = 1;
    for (let i = i0; i < i1; i += 2) {
      const j = Math.min(i + 2, i1);
      const sp = S[i];
      let sides: number[];
      if (b.cote === 'gauche') sides = [1];
      else if (b.cote === 'droite') sides = [-1];
      else if (b.cote === 'deux') sides = [1, -1];
      else {
        if (sp.k > 1 / 400) extSide = -1;
        else if (sp.k < -1 / 400) extSide = 1;
        sides = [extSide];
      }
      for (const side of sides) {
        const a = S[i], c = S[j];
        const ax = a.x + a.nx * side * (a.w + 0.8), az = a.z + a.nz * side * (a.w + 0.8);
        const bx = c.x + c.nx * side * (c.w + 0.8), bz = c.z + c.nz * side * (c.w + 0.8);
        env.segments.push({ ax, az, bx, bz });
        const mx = (ax + bx) / 2, mz = (az + bz) / 2;
        env.barriers.push({ x: mx, y: terrain.heightAt(mx, mz), z: mz, rot: Math.atan2(bx - ax, bz - az), len: Math.hypot(bx - ax, bz - az) });
        const covered = side > 0 ? leftCovered : rightCovered;
        for (let k = i; k <= j; k++) covered[k] = 1;
      }
    }
  }

  // 2. Objets placés à la main (toujours solides)
  for (const o of manual) {
    const rot = o.rot * DEG;
    if (o.type === 'barriere') {
      const dx = Math.sin(rot) * 2, dz = Math.cos(rot) * 2;
      env.segments.push({ ax: o.x - dx, az: o.z - dz, bx: o.x + dx, bz: o.z + dz });
      env.barriers.push({ x: o.x, y: terrain.heightAt(o.x, o.z), z: o.z, rot, len: 4 });
      continue;
    }
    add({ kind: MANUAL_KIND[o.type], variant: 0, x: o.x, y: terrain.heightAt(o.x, o.z), z: o.z, rot, scale: 1, solid: true, manual: true });
  }

  // 3. Chevrons à l'extérieur des virages de rayon < 30 m (tous les 8 m, à w + 2,2 m)
  const tightZone = new Uint8Array(S.length);
  let runStart = -1;
  for (let i = 0; i <= S.length; i++) {
    const tight = i < S.length && Math.abs(S[i].k) > 1 / 30;
    if (tight && runStart < 0) runStart = i;
    if (!tight && runStart >= 0) {
      if (i - runStart >= 6) {
        for (let k = runStart; k < i; k += 8) {
          const sp = S[k];
          const side = sp.k > 0 ? -1 : 1;
          const off = sp.w + 2.2;
          const x = sp.x + sp.nx * side * off, z = sp.z + sp.nz * side * off;
          if (nearManual(x, z, 2)) continue;
          add({ kind: 'chevron', variant: 0, x, y: terrain.heightAt(x, z), z, rot: Math.atan2(-side * sp.nx, -side * sp.nz), scale: 1, solid: true, manual: false });
        }
        for (let k = Math.max(0, runStart - 10); k < Math.min(S.length, i + 10); k++) tightZone[k] = 1;
      }
      runStart = -1;
    }
  }

  // 4. Bornes tous les 25 m, des deux côtés, à w + 1,6 m
  for (let s = 10; s < track.length - 10; s += 25) {
    const i = Math.min(S.length - 1, Math.round(s));
    if (tightZone[i]) continue;
    const sp = S[i];
    for (const side of [1, -1]) {
      if ((side > 0 ? leftCovered : rightCovered)[i]) continue;
      const off = sp.w + 1.6;
      const x = sp.x + sp.nx * side * off, z = sp.z + sp.nz * side * off;
      if (nearManual(x, z, 2)) continue;
      add({ kind: 'borne', variant: 0, x, y: terrain.heightAt(x, z), z, rot: Math.atan2(sp.tx, sp.tz), scale: 1, solid: true, manual: false });
    }
  }

  // 5. Arbres en bosquets (6 tirages par case, toujours consommés → déterminisme)
  const thr = forestThreshold(densite);
  const b = track.bounds;
  const trees = (cell: number, dMin: number, dMax: number): void => {
    for (let gz = b.minZ - dMax; gz < b.maxZ + dMax; gz += cell) {
      for (let gx = b.minX - dMax; gx < b.maxX + dMax; gx += cell) {
        const x = gx + rng() * cell, z = gz + rng() * cell;
        const pick = rng(), kindR = rng(), variantR = rng(), rotR = rng(), scaleR = rng();
        const d = terrain.distanceToRoad(x, z);
        if (d < dMin || d >= dMax) continue;
        if (inCorridor(x, z, 3, d) || nearManual(x, z, 4)) continue;
        let p = forestMask(x, z, graine) > thr ? 0.85 : 0.08 * (0.5 + densite);
        if (d < 12) p *= 0.5;
        if (pick >= p) continue;
        const y = terrain.heightAt(x, z);
        const kind: DecorKind = kindR < 0.4 + 0.6 * smoothstep(0, 60, y - lowest) ? 'sapin' : 'feuillu';
        add({ kind, variant: Math.min(2, Math.floor(variantR * 3)), x, y, z, rot: rotR * Math.PI * 2, scale: 0.8 + 0.5 * scaleR, solid: d < SOLID_DISTANCE, manual: false });
      }
    }
  };
  trees(7, 0, 60);
  trees(14, 60, 320);

  // 6. Rochers, plus fréquents sur les pentes
  for (let gz = b.minZ - 200; gz < b.maxZ + 200; gz += 11) {
    for (let gx = b.minX - 200; gx < b.maxX + 200; gx += 11) {
      const x = gx + rng() * 11, z = gz + rng() * 11;
      const pick = rng(), kindR = rng(), variantR = rng(), rotR = rng(), scaleR = rng();
      const d = terrain.distanceToRoad(x, z);
      if (d >= 200) continue;
      if (inCorridor(x, z, 4, d) || nearManual(x, z, 4)) continue;
      const g = terrain.gradientAt(x, z);
      const slope = Math.hypot(g.gx, g.gz);
      const p = (0.03 + 0.25 * smoothstep(0.25, 0.8, slope)) * (0.5 + densite / 2);
      if (pick >= p) continue;
      const kind: DecorKind = kindR < 0.2 ? 'rocherHaut' : 'rocher';
      add({
        kind, variant: kind === 'rocher' ? Math.min(1, Math.floor(variantR * 2)) : 0,
        x, y: terrain.heightAt(x, z) - 0.3, z, rot: rotR * Math.PI * 2, scale: 0.8 + 0.5 * scaleR,
        solid: d < SOLID_DISTANCE, manual: false,
      });
    }
  }

  return env;
}
```

- [ ] **Step 3 : vérifier** — `npx vitest run tests/core/env/generate.test.ts` → PASS ; `npx tsc --noEmit` → OK. Le fichier de test doit tourner en moins de 20 s ; si c'est beaucoup plus lent, le signaler dans le rapport.

- [ ] **Step 4 : commit**

```bash
git add src/core/env tests/core/env
git commit -m "Environnement généré : forêt en bosquets, rochers, chevrons, bornes et barrières"
```

---

## Tâche 7 : Physique de la voiture, 3 voitures, 3 modes

**Files :**
- Create : `src/core/physics/types.ts`, `src/core/physics/cars.ts`, `src/core/physics/assists.ts`, `src/core/physics/car.ts`
- Test : `tests/core/physics/car.test.ts`

**Interfaces :**
- Consumes : `InputState` (T1), `Ground` (T5), `clamp`, `lerp`, `smoothstep`, `wrapAngle`, `DEG`, `mulberry32` (T2).
- Produces :
  - `type CarId = 'equilibree' | 'legere' | 'turbo'`, `type ModeId = 'arcade' | 'semi' | 'exigeant'`
  - `interface CarParams` (voir code), `interface AssistParams` (voir code)
  - `interface CarState { x; y; z; heading; vx; vz; yawRate; steer; steerInput; ax; beta; speed; vLong; vLat; rearSlip; wheelSpin; rpm; gear; reverse; throttle; prevVelAngle }`
  - `interface StepContext { params: CarParams; assists: AssistParams; ground: Ground; onRoad: boolean }`
  - `CAR_IDS: CarId[]`, `CARS: Record<CarId, CarParams>` ; `MODE_IDS: ModeId[]`, `MODE_NOMS: Record<ModeId, string>`, `MODES: Record<ModeId, AssistParams>`
  - `createCarState(x, z, heading, y = 0): CarState`, `copyCarState(src, dst?): CarState`, `stepCar(car, input, ctx, dt): void` (modifie `car` sur place)

Modèle (spec §4) : bicyclette, Pacejka simplifiée `F = −μ·Fz·sin(C·atan(B·α))`, cercle d'adhérence, transfert de masse longitudinal, propulsion, frein à main (μ arrière × 0,5 + freinage arrière), pente, traînée, basse vitesse cinématique, aides des modes.

- [ ] **Step 1 : écrire les tests**

`tests/core/physics/car.test.ts` :
```ts
import { describe, it, expect } from 'vitest';
import { createCarState, stepCar, copyCarState } from '../../../src/core/physics/car';
import { CARS, CAR_IDS } from '../../../src/core/physics/cars';
import { MODES, MODE_IDS } from '../../../src/core/physics/assists';
import type { CarId, ModeId, StepContext, CarState } from '../../../src/core/physics/types';
import type { Ground } from '../../../src/core/track/terrain';
import type { InputState } from '../../../src/core/input';
import { SIM_DT } from '../../../src/core/constants';
import { DEG } from '../../../src/core/math/vec';
import { mulberry32 } from '../../../src/core/math/rng';

const flat: Ground = { heightAt: () => 0, gradientAt: () => ({ gx: 0, gz: 0 }) };
const ctxOf = (car: CarId, mode: ModeId, ground: Ground = flat, onRoad = true): StepContext =>
  ({ params: CARS[car], assists: MODES[mode], ground, onRoad });
const inp = (p: Partial<InputState>): InputState => ({ gaz: 0, frein: 0, direction: 0, freinAMain: false, ...p });

function run(car: CarState, ctx: StepContext, seconds: number, input: InputState | ((t: number) => InputState)) {
  let maxBeta = 0;
  const steps = Math.round(seconds / SIM_DT);
  for (let i = 0; i < steps; i++) {
    const t = i * SIM_DT;
    stepCar(car, typeof input === 'function' ? input(t) : input, ctx, SIM_DT);
    maxBeta = Math.max(maxBeta, Math.abs(car.beta));
  }
  return { maxBeta };
}

const finite = (c: CarState) => Object.values(c).every((v) => typeof v !== 'number' || Number.isFinite(v));

describe('voiture : ligne droite', () => {
  it('accélère pleins gaz sans dévier', () => {
    const c = createCarState(0, 0, 0);
    run(c, ctxOf('equilibree', 'semi'), 5, inp({ gaz: 1 }));
    expect(c.speed).toBeGreaterThan(14);
    expect(c.speed).toBeLessThan(28);
    expect(Math.abs(c.x)).toBeLessThan(0.5);
    expect(Math.abs(c.heading)).toBeLessThan(0.01);
    expect(c.z).toBeGreaterThan(30);
  });
  it('plafonne près de la vitesse max', () => {
    for (const id of CAR_IDS) {
      const c = createCarState(0, 0, 0);
      run(c, ctxOf(id, 'semi'), 60, inp({ gaz: 1 }));
      expect(c.speed).toBeGreaterThan(0.75 * CARS[id].maxSpeed);
      expect(c.speed).toBeLessThanOrEqual(CARS[id].maxSpeed + 0.5);
    }
  });
  it('freine de 25 m/s à l’arrêt en moins de 70 m', () => {
    const c = createCarState(0, 0, 0);
    c.vz = 25;
    const ctx = ctxOf('equilibree', 'semi');
    let t = 0;
    while (c.speed > 0.5 && t < 6) { stepCar(c, inp({ frein: 1 }), ctx, SIM_DT); t += SIM_DT; }
    expect(t).toBeLessThan(5);
    expect(c.z).toBeLessThan(70);
  });
  it('recule en maintenant le frein à l’arrêt', () => {
    const c = createCarState(0, 0, 0);
    run(c, ctxOf('equilibree', 'semi'), 3, inp({ frein: 1 }));
    expect(c.reverse).toBe(true);
    expect(c.vLong).toBeLessThan(-2);
    expect(c.vLong).toBeGreaterThan(-8.5);
  });
});

describe('voiture : virages et glisse', () => {
  it('tourne à gauche (cap qui augmente, x qui augmente)', () => {
    const c = createCarState(0, 0, 0);
    c.vz = 8;
    run(c, ctxOf('equilibree', 'semi'), 2, inp({ gaz: 0.3, direction: 1 }));
    expect(c.heading).toBeGreaterThan(0.3);
    expect(c.x).toBeGreaterThan(1);
  });
  it('le frein à main fait décrocher l’arrière (semi et exigeant)', () => {
    for (const mode of ['semi', 'exigeant'] as ModeId[]) {
      const c = createCarState(0, 0, 0);
      c.vz = 20;
      const { maxBeta } = run(c, ctxOf('equilibree', mode), 1.5, (t) =>
        t < 0.3 ? inp({ gaz: 0.5, direction: 1 }) : inp({ direction: 1, freinAMain: true }));
      expect(maxBeta).toBeGreaterThan(20 * DEG);
    }
  });
  it('Arcade : le drift tient et ne part pas en tête-à-queue', () => {
    const c = createCarState(0, 0, 0);
    c.vz = 25;
    const { maxBeta } = run(c, ctxOf('equilibree', 'arcade'), 6, inp({ gaz: 1, freinAMain: true, direction: 1 }));
    expect(maxBeta).toBeGreaterThan(15 * DEG);
    expect(maxBeta).toBeLessThanOrEqual(60 * DEG);
    expect(c.speed).toBeGreaterThan(8);
  });
  it('hors route : vitesse de pointe plus basse', () => {
    const on = createCarState(0, 0, 0), off = createCarState(0, 0, 0);
    run(on, ctxOf('equilibree', 'semi', flat, true), 20, inp({ gaz: 1 }));
    run(off, ctxOf('equilibree', 'semi', flat, false), 20, inp({ gaz: 1 }));
    expect(off.speed).toBeLessThan(on.speed - 1);
  });
  it('pente : la voiture roule seule vers le bas', () => {
    const slope: Ground = { heightAt: (_x, z) => -0.1 * z, gradientAt: () => ({ gx: 0, gz: -0.1 }) };
    const c = createCarState(0, 0, 0);
    run(c, ctxOf('equilibree', 'semi', slope), 5, inp({}));
    expect(c.vz).toBeGreaterThan(2);
    expect(c.y).toBeCloseTo(-0.1 * c.z, 6);
  });
});

describe('voiture : robustesse', () => {
  const randomInputs = (seed: number) => {
    const r = mulberry32(seed);
    let cur = inp({});
    let next = 0;
    return (t: number) => {
      if (t >= next) {
        cur = inp({ gaz: r() < 0.7 ? r() : 0, frein: r() < 0.2 ? r() : 0, direction: r() * 2 - 1, freinAMain: r() < 0.2 });
        next = t + 0.25;
      }
      return cur;
    };
  };
  it('déterministe : mêmes entrées, même état au bit près', () => {
    const a = createCarState(0, 0, 0), b = createCarState(0, 0, 0);
    run(a, ctxOf('turbo', 'semi'), 20, randomInputs(7));
    run(b, ctxOf('turbo', 'semi'), 20, randomInputs(7));
    expect(a).toEqual(b);
  });
  it('3 voitures × 3 modes, 30 s d’entrées aléatoires : état fini, vitesse bornée', () => {
    for (const id of CAR_IDS) for (const mode of MODE_IDS) {
      const c = createCarState(0, 0, 0);
      run(c, ctxOf(id, mode), 30, randomInputs(id.length * 31 + mode.length));
      expect(finite(c)).toBe(true);
      expect(c.speed).toBeLessThan(80);
    }
  });
  it('copyCarState copie toutes les valeurs', () => {
    const c = createCarState(1, 2, 0.5, 3);
    c.vx = 4;
    const d = copyCarState(c);
    expect(d).toEqual(c);
    expect(d).not.toBe(c);
  });
});
```

Run : `npx vitest run tests/core/physics/car.test.ts` → FAIL.

- [ ] **Step 2 : types, voitures et modes**

`src/core/physics/types.ts` :
```ts
import type { Ground } from '../track/terrain';

export type CarId = 'equilibree' | 'legere' | 'turbo';
export type ModeId = 'arcade' | 'semi' | 'exigeant';

export interface CarParams {
  id: CarId;
  nom: string;
  mass: number;          // kg
  wheelbase: number;     // m
  cgToFront: number;     // m, centre de gravité → essieu avant
  cgHeight: number;      // m
  gyration: number;      // m, rayon de giration (inertie = masse × gyration²)
  engineForce: number;   // N, force motrice à l'arrêt
  maxSpeed: number;      // m/s
  brakeForce: number;    // N
  handbrakeForce: number;// N
  dragCoef: number;      // N/(m/s)²
  rollResist: number;    // N/(m/s)
  muFront: number;
  muRear: number;
  tireB: number;
  tireC: number;
  maxSteer: number;      // rad, braquage max à l'arrêt
  steerLock: number;     // rad, butée (aide au contre-braquage comprise)
  steerSpeed: number;    // rad/s
  steerSpeedReduction: number; // braquage max / (1 + v × k)
  length: number;        // m
  width: number;         // m
}

export interface AssistParams {
  counterSteer: number;          // 0..1
  counterSteerDeadzone: number;  // rad
  betaMax: number | null;        // rad, null = pas de limiteur
  spinStiffness: number;         // (rad/s²)/rad
  speedRetention: number;        // 0..1
  arcadeDrift: boolean;
  arcadeBeta: number;            // rad
  arcadeRearGrip: number;        // multiplicateur de μ arrière
  arcadePathRate: number;        // rad/s à direction pleine
}

export interface CarState {
  x: number; y: number; z: number;
  heading: number;
  vx: number; vz: number;
  yawRate: number;
  steer: number;
  steerInput: number;
  /** accélération longitudinale lissée (transfert de masse) */
  ax: number;
  beta: number;
  speed: number;
  vLong: number;
  vLat: number;
  /** 0..1, intensité de glisse arrière (fumée, son) */
  rearSlip: number;
  wheelSpin: number;
  rpm: number;
  gear: number;
  reverse: boolean;
  /** accélérateur effectif (−1..1, négatif = marche arrière) */
  throttle: number;
  prevVelAngle: number;
}

export interface StepContext {
  params: CarParams;
  assists: AssistParams;
  ground: Ground;
  onRoad: boolean;
}
```

`src/core/physics/cars.ts` :
```ts
import type { CarId, CarParams } from './types';

export const CAR_IDS: CarId[] = ['equilibree', 'legere', 'turbo'];

/** Valeurs de départ, à régler avec le panneau ?debug. */
export const CARS: Record<CarId, CarParams> = {
  equilibree: {
    id: 'equilibree', nom: "L'Équilibrée",
    mass: 1250, wheelbase: 2.6, cgToFront: 1.25, cgHeight: 0.5, gyration: 1.5,
    engineForce: 5200, maxSpeed: 55, brakeForce: 11000, handbrakeForce: 5000,
    dragCoef: 0.42, rollResist: 12, muFront: 1.05, muRear: 1.0, tireB: 8, tireC: 1.5,
    maxSteer: 0.62, steerLock: 0.85, steerSpeed: 3.2, steerSpeedReduction: 0.035,
    length: 4.4, width: 1.74,
  },
  legere: {
    id: 'legere', nom: 'La Légère',
    mass: 950, wheelbase: 2.45, cgToFront: 1.15, cgHeight: 0.48, gyration: 1.35,
    engineForce: 3800, maxSpeed: 48, brakeForce: 9000, handbrakeForce: 4200,
    dragCoef: 0.38, rollResist: 10, muFront: 1.08, muRear: 0.98, tireB: 9, tireC: 1.5,
    maxSteer: 0.66, steerLock: 0.9, steerSpeed: 3.6, steerSpeedReduction: 0.03,
    length: 4.1, width: 1.68,
  },
  turbo: {
    id: 'turbo', nom: 'La Turbo',
    mass: 1650, wheelbase: 2.8, cgToFront: 1.45, cgHeight: 0.62, gyration: 1.65,
    engineForce: 10500, maxSpeed: 58, brakeForce: 14000, handbrakeForce: 6000,
    dragCoef: 0.5, rollResist: 14, muFront: 1.02, muRear: 0.92, tireB: 7, tireC: 1.6,
    maxSteer: 0.58, steerLock: 0.82, steerSpeed: 2.8, steerSpeedReduction: 0.04,
    length: 4.6, width: 1.82,
  },
};
```

`src/core/physics/assists.ts` :
```ts
import { DEG } from '../math/vec';
import type { AssistParams, ModeId } from './types';

export const MODE_IDS: ModeId[] = ['arcade', 'semi', 'exigeant'];

export const MODE_NOMS: Record<ModeId, string> = { arcade: 'Arcade', semi: 'Semi-arcade', exigeant: 'Exigeant' };

/** Aides par mode (spec §4.3). Valeurs de départ, réglables avec ?debug. */
export const MODES: Record<ModeId, AssistParams> = {
  arcade: {
    counterSteer: 1, counterSteerDeadzone: 3 * DEG, betaMax: 55 * DEG, spinStiffness: 60, speedRetention: 0.7,
    arcadeDrift: true, arcadeBeta: 40 * DEG, arcadeRearGrip: 0.6, arcadePathRate: 0.9,
  },
  semi: {
    counterSteer: 0.5, counterSteerDeadzone: 3 * DEG, betaMax: 75 * DEG, spinStiffness: 35, speedRetention: 0.35,
    arcadeDrift: false, arcadeBeta: 0, arcadeRearGrip: 1, arcadePathRate: 0,
  },
  exigeant: {
    counterSteer: 0, counterSteerDeadzone: 0, betaMax: null, spinStiffness: 0, speedRetention: 0,
    arcadeDrift: false, arcadeBeta: 0, arcadeRearGrip: 1, arcadePathRate: 0,
  },
};
```

- [ ] **Step 3 : le modèle de voiture**

`src/core/physics/car.ts` :
```ts
import type { InputState } from '../input';
import { clamp, lerp, smoothstep, wrapAngle, DEG } from '../math/vec';
import type { CarState, StepContext } from './types';

const G = 9.81;
const GEAR_STEPS = [0, 0.2, 0.38, 0.56, 0.76];

export function createCarState(x: number, z: number, heading: number, y = 0): CarState {
  return {
    x, y, z, heading, vx: 0, vz: 0, yawRate: 0, steer: 0, steerInput: 0, ax: 0, beta: 0, speed: 0,
    vLong: 0, vLat: 0, rearSlip: 0, wheelSpin: 0, rpm: 900, gear: 1, reverse: false, throttle: 0, prevVelAngle: heading,
  };
}

export function copyCarState(src: CarState, dst?: CarState): CarState {
  return Object.assign(dst ?? ({} as CarState), src);
}

function tireForce(alpha: number, load: number, mu: number, B: number, C: number): number {
  return -mu * load * Math.sin(C * Math.atan(B * alpha));
}

/** Avance la voiture d'un pas `dt` (modifie `car`). Déterministe. */
export function stepCar(car: CarState, input: InputState, ctx: StepContext, dt: number): void {
  const p = ctx.params, as = ctx.assists;
  const m = p.mass, L = p.wheelbase, a = p.cgToFront, b = L - a;
  const sinH = Math.sin(car.heading), cosH = Math.cos(car.heading);
  const vLong0 = car.vx * sinH + car.vz * cosH;
  const vLat0 = car.vx * cosH - car.vz * sinH;
  const speed0 = Math.hypot(car.vx, car.vz);
  const beta0 = speed0 > 1 ? Math.atan2(vLat0, vLong0) : 0;

  // Direction (rampe) + contre-braquage assisté
  const maxSteer = p.maxSteer / (1 + speed0 * p.steerSpeedReduction);
  const target = clamp(input.direction, -1, 1) * maxSteer;
  const ds = p.steerSpeed * dt;
  car.steerInput += clamp(target - car.steerInput, -ds, ds);
  let steer = car.steerInput;
  if (as.counterSteer > 0 && vLong0 > 2 && Math.abs(beta0) > as.counterSteerDeadzone) {
    const b0 = clamp(beta0, -1.2, 1.2);
    steer += as.counterSteer * (b0 - Math.sign(b0) * as.counterSteerDeadzone);
  }
  steer = clamp(steer, -p.steerLock, p.steerLock);
  car.steer = steer;

  // Marche avant / arrière
  if (!car.reverse) {
    if (input.frein > 0 && vLong0 <= 0.5 && input.gaz === 0) car.reverse = true;
  } else if (input.gaz > 0 && vLong0 >= -0.5) {
    car.reverse = false;
  }
  const throttle = car.reverse ? -input.frein : input.gaz;
  const brake = car.reverse ? input.gaz : input.frein;
  car.throttle = throttle;

  // Charges par essieu (transfert de masse longitudinal)
  const Fzf = Math.max(0.1 * m * G, (m * G * b) / L - (m * car.ax * p.cgHeight) / L);
  const Fzr = Math.max(0.1 * m * G, (m * G * a) / L + (m * car.ax * p.cgHeight) / L);

  // Adhérence
  const surface = ctx.onRoad ? 1 : 0.7;
  const muF = p.muFront * surface;
  let muR = p.muRear * surface;
  const arcadeDrift = as.arcadeDrift && input.freinAMain && speed0 > 8.3;
  const handbrake = input.freinAMain && !as.arcadeDrift;
  if (arcadeDrift) muR *= as.arcadeRearGrip;
  if (handbrake) muR *= 0.5;

  // Forces longitudinales
  let Fdrive = 0;
  if (throttle > 0) {
    const r = clamp(vLong0 / p.maxSpeed, 0, 1);
    Fdrive = throttle * p.engineForce * (1 - r * r);
  } else if (throttle < 0 && vLong0 > -8) {
    Fdrive = throttle * p.engineForce * 0.4;
  }
  let FbrakeF = 0, FbrakeR = 0;
  if (brake > 0 && Math.abs(vLong0) > 0.3) {
    const dir = Math.sign(vLong0);
    FbrakeF = -dir * brake * p.brakeForce * 0.6;
    FbrakeR = -dir * brake * p.brakeForce * 0.4;
  }
  if (handbrake && Math.abs(vLong0) > 0.3) FbrakeR -= Math.sign(vLong0) * p.handbrakeForce;

  // Cercle d'adhérence
  const maxRx = muR * Fzr;
  const rearUse = clamp(Math.abs(Fdrive + FbrakeR) / maxRx, 0, 1);
  const Frx = clamp(Fdrive + FbrakeR, -maxRx, maxRx);
  const maxFx = muF * Fzf;
  const frontUse = clamp(Math.abs(FbrakeF) / maxFx, 0, 1);
  const Ffx = clamp(FbrakeF, -maxFx, maxFx);
  const rearLat = Math.sqrt(Math.max(0.05, 1 - rearUse * rearUse));
  const frontLat = Math.sqrt(Math.max(0.05, 1 - frontUse * frontUse));

  // Forces latérales
  const vAbs = Math.max(Math.abs(vLong0), 0.5);
  const dirSign = vLong0 >= 0 ? 1 : -1;
  const alphaF = Math.atan2(vLat0 + car.yawRate * a, vAbs) - steer * dirSign;
  const alphaR = Math.atan2(vLat0 - car.yawRate * b, vAbs);
  const Fyf = tireForce(alphaF, Fzf, muF, p.tireB, p.tireC) * frontLat;
  const Fyr = tireForce(alphaR, Fzr, muR, p.tireB, p.tireC) * rearLat;

  // Somme des forces (repère voiture : x = avant, y = gauche) et couple
  const cosD = Math.cos(steer), sinD = Math.sin(steer);
  const rolling = p.rollResist * (ctx.onRoad ? 1 : 4);
  const Fx = Frx + Ffx * cosD - Fyf * sinD - p.dragCoef * vLong0 * Math.abs(vLong0) - rolling * vLong0;
  const Fy = Fyr + Fyf * cosD + Ffx * sinD;
  const torque = a * (Fyf * cosD + Ffx * sinD) - b * Fyr;

  // Intégration (Euler semi-implicite) ; monde = avant·Fx + gauche·Fy ; gravité sur la pente
  const grad = ctx.ground.gradientAt(car.x, car.z);
  car.vx += ((Fx * sinH + Fy * cosH) / m - G * grad.gx) * dt;
  car.vz += ((Fx * cosH - Fy * sinH) / m - G * grad.gz) * dt;
  car.yawRate += (torque / (m * p.gyration * p.gyration)) * dt;

  // Basse vitesse : transition vers un modèle cinématique
  const sp1 = Math.hypot(car.vx, car.vz);
  if (sp1 < 3) {
    const t = smoothstep(0.5, 3, sp1);
    const vl = car.vx * sinH + car.vz * cosH;
    const vt = car.vx * cosH - car.vz * sinH;
    car.yawRate = lerp((vl * Math.tan(steer)) / L, car.yawRate, t);
    const damp = (1 - t) * Math.min(1, 10 * dt);
    car.vx -= cosH * vt * damp;
    car.vz += sinH * vt * damp;
    const flatGround = Math.hypot(grad.gx, grad.gz) < 0.03;
    if (flatGround && sp1 < 0.3 && input.gaz === 0 && input.frein === 0) { car.vx *= 0.9; car.vz *= 0.9; }
  }

  // Aide : limiteur de tête-à-queue
  const vl2 = car.vx * sinH + car.vz * cosH;
  const vt2 = car.vx * cosH - car.vz * sinH;
  const sp2 = Math.hypot(car.vx, car.vz);
  const beta2 = sp2 > 2 ? Math.atan2(vt2, vl2) : 0;
  if (as.betaMax !== null && as.spinStiffness > 0) {
    const excess = Math.abs(beta2) - as.betaMax;
    if (excess > 0) {
      car.yawRate += Math.sign(beta2) * as.spinStiffness * excess * dt;
      if (Math.sign(car.yawRate) === -Math.sign(beta2)) car.yawRate *= 1 - Math.min(1, 8 * dt);
    }
  }

  // Aide Arcade : le bouton Drift vise un angle de dérive et courbe la trajectoire
  const velAngle = sp2 > 0.5 ? Math.atan2(car.vx, car.vz) : car.heading;
  const pathRate = wrapAngle(velAngle - car.prevVelAngle) / dt;
  car.prevVelAngle = velAngle;
  if (arcadeDrift && vl2 > 5) {
    const dirIn = clamp(input.direction, -1, 1);
    const dir = dirIn !== 0 ? Math.sign(dirIn) : beta2 !== 0 ? -Math.sign(beta2) : 0;
    const amount = dirIn !== 0 ? Math.abs(dirIn) : 0.6;
    const betaTarget = -dir * as.arcadeBeta * amount;
    const rDesired = pathRate + 3 * (beta2 - betaTarget);
    car.yawRate += (rDesired - car.yawRate) * Math.min(1, 10 * dt);
    const turn = dirIn * as.arcadePathRate * dt;
    const c = Math.cos(turn), s = Math.sin(turn);
    const nvx = car.vx * c + car.vz * s;
    const nvz = car.vz * c - car.vx * s;
    car.vx = nvx;
    car.vz = nvz;
  }

  // Aide : vitesse conservée en drift
  if (as.speedRetention > 0 && Math.abs(beta2) > 15 * DEG && brake === 0) {
    const ns = Math.hypot(car.vx, car.vz);
    if (ns < speed0 && ns > 0.1) {
      const k = (ns + (speed0 - ns) * as.speedRetention) / ns;
      car.vx *= k;
      car.vz *= k;
    }
  }

  car.yawRate = clamp(car.yawRate, -6, 6);

  // Position
  car.heading = wrapAngle(car.heading + car.yawRate * dt);
  car.x += car.vx * dt;
  car.z += car.vz * dt;
  car.y = ctx.ground.heightAt(car.x, car.z);

  // Valeurs dérivées
  const s2 = Math.sin(car.heading), c2 = Math.cos(car.heading);
  car.vLong = car.vx * s2 + car.vz * c2;
  car.vLat = car.vx * c2 - car.vz * s2;
  car.speed = Math.hypot(car.vx, car.vz);
  car.beta = car.speed > 1 ? Math.atan2(car.vLat, car.vLong) : 0;
  const axNow = clamp((car.vLong - vLong0) / dt, -15, 15);
  car.ax += (axNow - car.ax) * Math.min(1, 8 * dt);
  const slide = clamp((Math.abs(alphaR) - 0.12) / 0.35, 0, 1) * smoothstep(3, 8, car.speed);
  const spin = rearUse > 0.98 && throttle > 0 && car.speed < 15 ? 0.6 : 0;
  car.rearSlip = clamp(Math.max(slide, spin, handbrake && car.speed > 3 ? 0.8 : 0), 0, 1);
  car.wheelSpin = (car.wheelSpin + (car.vLong / 0.34) * dt) % (Math.PI * 2);

  // Boîte automatique et régime (pour le son)
  const f = Math.abs(car.vLong) / p.maxSpeed;
  let gear = 1;
  for (let g = 1; g < GEAR_STEPS.length; g++) if (f >= GEAR_STEPS[g]) gear = g + 1;
  car.gear = car.reverse ? -1 : gear;
  const lo = GEAR_STEPS[gear - 1];
  const hi = gear < GEAR_STEPS.length ? GEAR_STEPS[gear] : 1;
  const inGear = clamp((f - lo) / Math.max(1e-6, hi - lo), 0, 1);
  const targetRpm = car.speed < 0.5 && throttle <= 0 ? 900 : 1500 + inGear * 5500 + (spin > 0 ? 1200 : 0);
  car.rpm += (clamp(targetRpm, 900, 7500) - car.rpm) * Math.min(1, 12 * dt);
}
```

- [ ] **Step 4 : vérifier** — `npx vitest run tests/core/physics/car.test.ts` → PASS ; `npx tsc --noEmit` → OK.

Règles si un test de comportement échoue (ne jamais affaiblir un test sans le signaler) :
- « Arcade : ne part pas en tête-à-queue » échoue avec `maxBeta > 60°` → multiplier `MODES.arcade.spinStiffness` par 1,5 (maximum 200) jusqu'à ce que le test passe ; indiquer la valeur finale dans le rapport.
- « le frein à main fait décrocher » échoue → vérifier d'abord les signes (convention en tête du plan : `beta = atan2(vLat, vLong)`, gauche = `(cos ψ, −sin ψ)`), puis signaler la valeur de `maxBeta` obtenue au lieu de changer les paramètres.
- Tout autre échec : diagnostiquer et signaler, sans modifier les valeurs des voitures.

- [ ] **Step 5 : commit**

```bash
git add src/core/physics tests/core/physics/car.test.ts
git commit -m "Physique de la voiture : modèle de pneus, 3 voitures et aides des 3 modes"
```

---

## Tâche 8 : Collisions

**Files :**
- Create : `src/core/physics/collision.ts`
- Test : `tests/core/physics/collision.test.ts`

**Interfaces :**
- Consumes : `CarState`, `CarParams` (T7), `CircleCollider`, `SegmentCollider` (T6), `SampleGrid` (T4), `clamp` (T2).
- Produces :
  - `interface CollisionWorld { circles: CircleCollider[]; segments: SegmentCollider[]; circleGrid: SampleGrid; segmentGrid: SampleGrid }`
  - `buildCollisionWorld(env: { circles: CircleCollider[]; segments: SegmentCollider[] }): CollisionWorld`
  - `resolveCollisions(car: CarState, params: CarParams, world: CollisionWorld): number` — sépare la voiture des obstacles, applique les impulsions, renvoie la **vitesse normale d'impact maximale** du pas (0 si aucun contact en approche)
  - constante `CRASH_IMPACT = 2.5` (m/s, seuil de « choc » pour le score)

Voiture ≈ 3 cercles de rayon `width / 2` alignés sur l'axe (avant, centre, arrière) ; restitution 0,3 ; frottement tangentiel : 20 % de la vitesse tangentielle retirée (garde 80 %) ; impulsion de lacet selon le point de contact. Produit vectoriel 2D : `cross(p, F) = p.z·F.x − p.x·F.z` ; vitesse d'un point `p` due au lacet `r` : `(r·p.z, −r·p.x)`.

- [ ] **Step 1 : écrire les tests**

`tests/core/physics/collision.test.ts` :
```ts
import { describe, it, expect } from 'vitest';
import { buildCollisionWorld, resolveCollisions, CRASH_IMPACT } from '../../../src/core/physics/collision';
import { createCarState, stepCar, copyCarState } from '../../../src/core/physics/car';
import { CARS } from '../../../src/core/physics/cars';
import { MODES } from '../../../src/core/physics/assists';
import type { Ground } from '../../../src/core/track/terrain';
import { SIM_DT } from '../../../src/core/constants';

const flat: Ground = { heightAt: () => 0, gradientAt: () => ({ gx: 0, gz: 0 }) };
const P = CARS.equilibree;
const idle = { gaz: 0, frein: 0, direction: 0, freinAMain: false };

describe('collisions', () => {
  it('percute un arbre : choc détecté, voiture arrêtée devant', () => {
    const world = buildCollisionWorld({ circles: [{ x: 0, z: 6, r: 0.5 }], segments: [] });
    const car = createCarState(0, 0, 0);
    car.vz = 10;
    let maxImpact = 0;
    for (let i = 0; i < 120; i++) {
      stepCar(car, idle, { params: P, assists: MODES.semi, ground: flat, onRoad: true }, SIM_DT);
      maxImpact = Math.max(maxImpact, resolveCollisions(car, P, world));
    }
    expect(maxImpact).toBeGreaterThan(CRASH_IMPACT);
    expect(car.z).toBeLessThan(3.5);
    expect(car.vz).toBeLessThan(3);
  });
  it('barrière à gauche : repoussée à la bonne distance, freinée et tournée vers la droite', () => {
    const world = buildCollisionWorld({ circles: [], segments: [{ ax: 3, az: -50, bx: 3, bz: 50 }] });
    const car = createCarState(2.5, 0, 0);
    car.vx = 5; car.vz = 10;
    const impact = resolveCollisions(car, P, world);
    expect(impact).toBeGreaterThan(CRASH_IMPACT);
    expect(car.x).toBeLessThanOrEqual(3 - P.width / 2 + 1e-6);
    expect(car.vx).toBeLessThan(2.5);
    expect(car.yawRate).toBeLessThan(0);
  });
  it('frottement léger le long d’une barrière : pas un choc', () => {
    const world = buildCollisionWorld({ circles: [], segments: [{ ax: 3, az: -50, bx: 3, bz: 50 }] });
    const car = createCarState(3 - P.width / 2 + 0.05, 0, 0);
    car.vx = 0.5; car.vz = 20;
    const impact = resolveCollisions(car, P, world);
    expect(impact).toBeLessThan(CRASH_IMPACT);
    expect(car.x).toBeLessThanOrEqual(3 - P.width / 2 + 1e-6);
  });
  it('aucun contact : état inchangé, impact nul', () => {
    const world = buildCollisionWorld({ circles: [{ x: 50, z: 50, r: 1 }], segments: [{ ax: 40, az: 0, bx: 40, bz: 10 }] });
    const car = createCarState(0, 0, 0.3);
    car.vx = 3; car.vz = 7; car.yawRate = 0.2;
    const before = copyCarState(car);
    expect(resolveCollisions(car, P, world)).toBe(0);
    expect(car).toEqual(before);
  });
  it('obstacle à cheval sur deux cases de la grille', () => {
    const world = buildCollisionWorld({ circles: [{ x: 7.9, z: 8.1, r: 1 }], segments: [] });
    // cercle avant à (length/2 − width/2) devant le centre ; 0,1 m d'interpénétration
    const off = P.length / 2 - P.width / 2;
    const car = createCarState(7.9, 8.1 - 1 - P.width / 2 - off + 0.1, 0);
    car.vz = 5;
    expect(resolveCollisions(car, P, world)).toBeGreaterThan(0);
  });
  it('arrière de la voiture : un obstacle derrière est aussi détecté', () => {
    const world = buildCollisionWorld({ circles: [{ x: 0, z: -2.5, r: 0.5 }], segments: [] });
    const car = createCarState(0, 0, 0);
    car.vz = -4;
    expect(resolveCollisions(car, P, world)).toBeGreaterThan(0);
  });
});
```

Run : `npx vitest run tests/core/physics/collision.test.ts` → FAIL.

- [ ] **Step 2 : implémenter**

`src/core/physics/collision.ts` :
```ts
import type { CircleCollider, SegmentCollider } from '../env/types';
import { SampleGrid } from '../track/grid';
import { clamp } from '../math/vec';
import type { CarParams, CarState } from './types';

export const CRASH_IMPACT = 2.5;
const RESTITUTION = 0.3;
const FRICTION_LOSS = 0.2;
const CELL = 8;

export interface CollisionWorld {
  circles: CircleCollider[];
  segments: SegmentCollider[];
  circleGrid: SampleGrid;
  segmentGrid: SampleGrid;
}

export function buildCollisionWorld(env: { circles: CircleCollider[]; segments: SegmentCollider[] }): CollisionWorld {
  const circleGrid = new SampleGrid(CELL);
  const segmentGrid = new SampleGrid(CELL);
  env.circles.forEach((c, i) => circleGrid.add(i, c.x, c.z));
  env.segments.forEach((s, i) => {
    const len = Math.hypot(s.bx - s.ax, s.bz - s.az);
    const n = Math.max(1, Math.ceil(len / (CELL / 2)));
    for (let k = 0; k <= n; k++) {
      const t = k / n;
      segmentGrid.add(i, s.ax + (s.bx - s.ax) * t, s.az + (s.bz - s.az) * t);
    }
  });
  return { circles: env.circles, segments: env.segments, circleGrid, segmentGrid };
}

const scratch: number[] = [];
let visitStamp = 0;
let segVisited = new Int32Array(0);
let circVisited = new Int32Array(0);

/** Déplace la voiture de `pen` le long de n et applique l'impulsion au point de contact (px, pz). */
function applyContact(car: CarState, px: number, pz: number, nx: number, nz: number, pen: number, m: number, I: number): number {
  car.x += nx * pen;
  car.z += nz * pen;
  const rpx = px - car.x, rpz = pz - car.z;
  const vpx = car.vx + car.yawRate * rpz;
  const vpz = car.vz - car.yawRate * rpx;
  const vn = vpx * nx + vpz * nz;
  if (vn >= 0) return 0;
  const invM = 1 / m, invI = 1 / I;
  const rn = rpz * nx - rpx * nz;
  const j = (-(1 + RESTITUTION) * vn) / (invM + rn * rn * invI);
  car.vx += j * nx * invM;
  car.vz += j * nz * invM;
  car.yawRate += rn * j * invI;
  const tx = -nz, tz = nx;
  const vt = (car.vx + car.yawRate * rpz) * tx + (car.vz - car.yawRate * rpx) * tz;
  const rt = rpz * tx - rpx * tz;
  const jt = (-vt / (invM + rt * rt * invI)) * FRICTION_LOSS;
  car.vx += jt * tx * invM;
  car.vz += jt * tz * invM;
  car.yawRate += rt * jt * invI;
  return -vn;
}

export function resolveCollisions(car: CarState, params: CarParams, world: CollisionWorld): number {
  const rc = params.width / 2;
  const off = Math.max(0, params.length / 2 - rc);
  const m = params.mass;
  const I = m * params.gyration * params.gyration;
  if (segVisited.length < world.segments.length) segVisited = new Int32Array(world.segments.length);
  if (circVisited.length < world.circles.length) circVisited = new Int32Array(world.circles.length);
  let impact = 0;

  for (const o of [off, 0, -off]) {
    const fx = Math.sin(car.heading), fz = Math.cos(car.heading);
    let cx = car.x + fx * o, cz = car.z + fz * o;

    visitStamp++;
    world.circleGrid.query(cx, cz, rc + 3, scratch);
    for (const i of scratch) {
      if (circVisited[i] === visitStamp) continue;
      circVisited[i] = visitStamp;
      const c = world.circles[i];
      const dx = cx - c.x, dz = cz - c.z;
      const d = Math.hypot(dx, dz);
      const pen = rc + c.r - d;
      if (pen <= 0) continue;
      const nx = d > 1e-6 ? dx / d : -fx;
      const nz = d > 1e-6 ? dz / d : -fz;
      impact = Math.max(impact, applyContact(car, cx - nx * rc, cz - nz * rc, nx, nz, pen, m, I));
      cx += nx * pen;
      cz += nz * pen;
    }

    visitStamp++;
    world.segmentGrid.query(cx, cz, rc + 3, scratch);
    for (const i of scratch) {
      if (segVisited[i] === visitStamp) continue;
      segVisited[i] = visitStamp;
      const s = world.segments[i];
      const ex = s.bx - s.ax, ez = s.bz - s.az;
      const len2 = ex * ex + ez * ez;
      const t = len2 > 1e-9 ? clamp(((cx - s.ax) * ex + (cz - s.az) * ez) / len2, 0, 1) : 0;
      const qx = s.ax + ex * t, qz = s.az + ez * t;
      const dx = cx - qx, dz = cz - qz;
      const d = Math.hypot(dx, dz);
      const pen = rc - d;
      if (pen <= 0) continue;
      let nx: number, nz: number;
      if (d > 1e-6) { nx = dx / d; nz = dz / d; }
      else { const l = Math.sqrt(len2) || 1; nx = -ez / l; nz = ex / l; }
      impact = Math.max(impact, applyContact(car, qx, qz, nx, nz, pen, m, I));
      cx += nx * pen;
      cz += nz * pen;
    }
  }
  return impact;
}
```

- [ ] **Step 3 : vérifier** — `npx vitest run tests/core/physics/collision.test.ts` → PASS ; `npx tsc --noEmit` → OK.

- [ ] **Step 4 : commit**

```bash
git add src/core/physics/collision.ts tests/core/physics/collision.test.ts
git commit -m "Collisions : voiture en 3 cercles contre arbres, rochers et barrières"
```

---

## Tâche 9 : Score (drift, combo, encaissement, bonus de temps)

**Files :**
- Create : `src/core/scoring/score.ts`
- Test : `tests/core/scoring/score.test.ts`

**Interfaces :**
- Consumes : `DEG` (T2).
- Produces :
  - `interface ScoreParams { betaMinDeg; speedMinKmh; gainPerKmh; bankDelay; comboTimeout; comboMax; spinDeg; spinSpeedKmh; progressMin; timeBonusPerSec }`, `DEFAULT_SCORE_PARAMS`
  - `interface ScoreState { total; drift; multiplier; active; pending; inactiveTime; sinceBank; bestDrift; driftCount }`
  - `type ScoreEvent = { type: 'bank'; points: number; multiplier: number } | { type: 'lose'; points: number }`
  - `interface ScoreFrame { betaRad: number; speed: number /* m/s */; onRoad: boolean; progressRate: number /* m/s */; crash: boolean; reset: boolean }`
  - `createScore(): ScoreState`, `angleFactor(betaDeg): number`, `stepScore(st, frame, dt, p?): ScoreEvent | null`, `finishScore(st, p?): ScoreEvent | null`, `timeBonus(targetTime, time, p?): number`

Règles (spec §6) : drift actif si β > 15° et vitesse > 30 km/h ; gain `10 × f(β) × km/h` par seconde, seulement sur la chaussée et en avançant (≥ 2 m/s) ; encaissement après 0,5 s d'inactivité (`points × multiplicateur`, puis multiplicateur +1, max x5) ; un nouveau drift avant 0,5 s prolonge le même ; multiplicateur remis à x1 après 2 s sans drift ; choc, replacement ou tête-à-queue (β > 90° au-dessus de 15 km/h) = perte du drift en cours et combo à x1 ; bonus = `max(0, cible − temps) × 2000`.

- [ ] **Step 1 : écrire les tests**

`tests/core/scoring/score.test.ts` :
```ts
import { describe, it, expect } from 'vitest';
import { createScore, stepScore, finishScore, timeBonus, angleFactor, type ScoreFrame, type ScoreEvent, type ScoreState } from '../../../src/core/scoring/score';
import { SIM_DT } from '../../../src/core/constants';
import { DEG } from '../../../src/core/math/vec';

const frame = (p: Partial<ScoreFrame>): ScoreFrame =>
  ({ betaRad: 0, speed: 0, onRoad: true, progressRate: 20, crash: false, reset: false, ...p });
const DRIFT = frame({ betaRad: 30 * DEG, speed: 80 / 3.6 });
const STRAIGHT = frame({ speed: 80 / 3.6 });

function hold(st: ScoreState, f: ScoreFrame, seconds: number): ScoreEvent[] {
  const ev: ScoreEvent[] = [];
  for (let i = 0; i < Math.round(seconds / SIM_DT); i++) {
    const e = stepScore(st, f, SIM_DT);
    if (e) ev.push(e);
  }
  return ev;
}

describe('angleFactor', () => {
  it('suit la courbe de la spec', () => {
    expect(angleFactor(10)).toBe(0);
    expect(angleFactor(15)).toBeCloseTo(0.5, 9);
    expect(angleFactor(20)).toBeCloseTo(0.75, 9);
    expect(angleFactor(30)).toBe(1);
    expect(angleFactor(75)).toBeCloseTo(0.75, 9);
    expect(angleFactor(95)).toBe(0);
  });
});

describe('stepScore', () => {
  it('un drift de 2 s à 30° et 80 km/h vaut 1600, encaissé x1', () => {
    const st = createScore();
    expect(hold(st, DRIFT, 2)).toEqual([]);
    expect(st.drift).toBeCloseTo(1600, -1);
    const ev = hold(st, STRAIGHT, 0.6);
    expect(ev.length).toBe(1);
    expect(ev[0]).toMatchObject({ type: 'bank', multiplier: 1 });
    expect(st.total).toBeCloseTo(1600, -1);
    expect(st.multiplier).toBe(2);
    expect(st.bestDrift).toBeCloseTo(1600, -1);
  });
  it('le deuxième drift est multiplié par 2', () => {
    const st = createScore();
    hold(st, DRIFT, 2); hold(st, STRAIGHT, 0.6);
    hold(st, DRIFT, 1);
    const ev = hold(st, STRAIGHT, 0.6);
    expect(ev[0]).toMatchObject({ type: 'bank', multiplier: 2 });
    expect(st.total).toBeCloseTo(3200, -1);
    expect(st.multiplier).toBe(3);
  });
  it('enchaîner avant 0,5 s = un seul drift', () => {
    const st = createScore();
    const ev = [...hold(st, DRIFT, 1), ...hold(st, STRAIGHT, 0.3), ...hold(st, DRIFT, 1), ...hold(st, STRAIGHT, 0.6)];
    expect(ev.length).toBe(1);
    expect(st.total).toBeCloseTo(1600, -1);
  });
  it('choc pendant un drift : perte, combo à x1', () => {
    const st = createScore();
    hold(st, DRIFT, 2); hold(st, STRAIGHT, 0.6);
    hold(st, DRIFT, 1);
    const e = stepScore(st, { ...DRIFT, crash: true }, SIM_DT);
    expect(e?.type).toBe('lose');
    expect(st.drift).toBe(0);
    expect(st.multiplier).toBe(1);
    expect(st.total).toBeCloseTo(1600, -1);
  });
  it('replacement et tête-à-queue font perdre', () => {
    const a = createScore();
    hold(a, DRIFT, 1);
    expect(stepScore(a, { ...STRAIGHT, reset: true }, SIM_DT)?.type).toBe('lose');
    const b = createScore();
    hold(b, DRIFT, 1);
    expect(stepScore(b, frame({ betaRad: 100 * DEG, speed: 60 / 3.6 }), SIM_DT)?.type).toBe('lose');
  });
  it('hors route ou sans avancer : aucun point', () => {
    const st = createScore();
    hold(st, { ...DRIFT, onRoad: false }, 1);
    hold(st, { ...DRIFT, progressRate: 0 }, 1);
    expect(st.drift).toBe(0);
    expect(hold(st, STRAIGHT, 0.6)).toEqual([]);
    expect(st.multiplier).toBe(1);
  });
  it('le combo retombe après 2 s sans drift', () => {
    const st = createScore();
    hold(st, DRIFT, 1); hold(st, STRAIGHT, 0.6);
    expect(st.multiplier).toBe(2);
    hold(st, STRAIGHT, 1.0);
    expect(st.multiplier).toBe(2);
    hold(st, STRAIGHT, 0.6);
    expect(st.multiplier).toBe(1);
  });
  it('multiplicateur plafonné à x5', () => {
    const st = createScore();
    for (let i = 0; i < 8; i++) { hold(st, DRIFT, 0.5); hold(st, STRAIGHT, 0.6); }
    expect(st.multiplier).toBe(5);
  });
  it('finishScore encaisse le drift en cours', () => {
    const st = createScore();
    hold(st, DRIFT, 1);
    expect(finishScore(st)).toMatchObject({ type: 'bank' });
    expect(st.total).toBeCloseTo(800, -1);
    expect(finishScore(st)).toBeNull();
  });
  it('bonus de temps', () => {
    expect(timeBonus(60, 50)).toBe(20000);
    expect(timeBonus(60, 70)).toBe(0);
  });
});
```

Run : `npx vitest run tests/core/scoring/score.test.ts` → FAIL.

- [ ] **Step 2 : implémenter**

`src/core/scoring/score.ts` :
```ts
import { DEG } from '../math/vec';

export interface ScoreParams {
  betaMinDeg: number;
  speedMinKmh: number;
  gainPerKmh: number;
  bankDelay: number;
  comboTimeout: number;
  comboMax: number;
  spinDeg: number;
  spinSpeedKmh: number;
  progressMin: number;
  timeBonusPerSec: number;
}

/** Valeurs de départ (spec §6), réglables avec ?debug. */
export const DEFAULT_SCORE_PARAMS: ScoreParams = {
  betaMinDeg: 15,
  speedMinKmh: 30,
  gainPerKmh: 10,
  bankDelay: 0.5,
  comboTimeout: 2,
  comboMax: 5,
  spinDeg: 90,
  spinSpeedKmh: 15,
  progressMin: 2,
  timeBonusPerSec: 2000,
};

export interface ScoreState {
  total: number;
  /** points bruts du drift en cours (à multiplier) */
  drift: number;
  multiplier: number;
  active: boolean;
  /** un drift attend d'être encaissé */
  pending: boolean;
  inactiveTime: number;
  sinceBank: number;
  bestDrift: number;
  driftCount: number;
}

export type ScoreEvent = { type: 'bank'; points: number; multiplier: number } | { type: 'lose'; points: number };

export interface ScoreFrame {
  betaRad: number;
  /** m/s */
  speed: number;
  onRoad: boolean;
  /** vitesse de progression le long de la route, m/s */
  progressRate: number;
  crash: boolean;
  reset: boolean;
}

export function createScore(): ScoreState {
  return { total: 0, drift: 0, multiplier: 1, active: false, pending: false, inactiveTime: 0, sinceBank: 0, bestDrift: 0, driftCount: 0 };
}

/** Facteur d'angle : 0,5 à 15°, 1 de 25° à 60°, 0,5 à 90°, 0 au-delà. */
export function angleFactor(betaDeg: number): number {
  const b = Math.abs(betaDeg);
  if (b < 15) return 0;
  if (b <= 25) return 0.5 + (0.5 * (b - 15)) / 10;
  if (b <= 60) return 1;
  if (b <= 90) return 1 - (0.5 * (b - 60)) / 30;
  return 0;
}

function bank(st: ScoreState, p: ScoreParams): ScoreEvent | null {
  const raw = st.drift;
  const mult = st.multiplier;
  st.drift = 0;
  st.pending = false;
  st.inactiveTime = 0;
  st.sinceBank = p.bankDelay;
  if (raw <= 0) return null;
  const points = raw * mult;
  st.total += points;
  st.bestDrift = Math.max(st.bestDrift, points);
  st.driftCount++;
  st.multiplier = Math.min(p.comboMax, mult + 1);
  return { type: 'bank', points, multiplier: mult };
}

function lose(st: ScoreState): ScoreEvent | null {
  const lost = st.drift * st.multiplier;
  const hadCombo = st.multiplier > 1;
  st.drift = 0;
  st.multiplier = 1;
  st.active = false;
  st.pending = false;
  st.inactiveTime = 0;
  st.sinceBank = 0;
  return lost > 0 || hadCombo ? { type: 'lose', points: lost } : null;
}

export function stepScore(st: ScoreState, f: ScoreFrame, dt: number, p: ScoreParams = DEFAULT_SCORE_PARAMS): ScoreEvent | null {
  const betaDeg = Math.abs(f.betaRad) / DEG;
  const kmh = f.speed * 3.6;
  if (f.crash || f.reset || (betaDeg > p.spinDeg && kmh > p.spinSpeedKmh)) return lose(st);

  const active = betaDeg > p.betaMinDeg && kmh > p.speedMinKmh;
  st.active = active;
  if (active) {
    st.pending = true;
    st.inactiveTime = 0;
    st.sinceBank = 0;
    if (f.onRoad && f.progressRate >= p.progressMin) st.drift += p.gainPerKmh * angleFactor(betaDeg) * kmh * dt;
    return null;
  }
  if (st.pending) {
    st.inactiveTime += dt;
    return st.inactiveTime >= p.bankDelay - 1e-9 ? bank(st, p) : null;
  }
  st.sinceBank += dt;
  if (st.sinceBank >= p.comboTimeout - 1e-9 && st.multiplier > 1) st.multiplier = 1;
  return null;
}

/** À l'arrivée : encaisse le drift en cours s'il y en a un. */
export function finishScore(st: ScoreState, p: ScoreParams = DEFAULT_SCORE_PARAMS): ScoreEvent | null {
  return st.pending ? bank(st, p) : null;
}

export function timeBonus(targetTime: number, time: number, p: ScoreParams = DEFAULT_SCORE_PARAMS): number {
  return Math.max(0, targetTime - time) * p.timeBonusPerSec;
}
```

- [ ] **Step 3 : vérifier** — `npx vitest run tests/core/scoring/score.test.ts` → PASS ; `npx tsc --noEmit` → OK.

- [ ] **Step 4 : commit**

```bash
git add src/core/scoring tests/core/scoring
git commit -m "Score : points de drift, combo x5, encaissement, pertes et bonus de temps"
```

---

## Tâche 10 : Course (RaceSim)

**Files :**
- Create : `src/core/race/race.ts`
- Test : `tests/core/race/race.test.ts`

**Interfaces :**
- Consumes : `SIM_DT` (T1), `InputState` (T1), `Level` (T3), `TrackData`, `projectOnTrack`, `nearestSample` (T4), `Terrain` (T5), `Environment`, `generateEnvironment` (T6), `CarParams`, `AssistParams`, `CarState`, `StepContext`, `createCarState`, `copyCarState`, `stepCar` (T7), `buildCollisionWorld`, `resolveCollisions`, `CRASH_IMPACT` (T8), tout le module score (T9), `clamp` (T2).
- Produces :
  - `type RacePhase = 'compte' | 'course' | 'arrivee'`
  - `interface RaceConfig { level: Level; track: TrackData; terrain: Terrain; env: Environment; car: CarParams; assists: AssistParams; scoreParams?: ScoreParams; countdown?: number }` (countdown par défaut 3 s)
  - `interface RaceResult { score: number; driftPoints: number; bonus: number; time: number; bestDrift: number; targetTime: number }`
  - `type RaceEvent = { type: 'decompte'; n: number } | ScoreEvent | { type: 'choc'; impact: number } | { type: 'replace'; auto: boolean } | { type: 'arrivee'; result: RaceResult }`
  - `interface HudData { phase: RacePhase; countdown: number; time: number; score: number; drift: number; multiplier: number; driftActive: boolean; progress: number; wrongWay: boolean; speedKmh: number }`
  - `class RaceSim { readonly car: CarState; readonly prevCar: CarState; phase: RacePhase; countdown: number; time: number; readonly score: ScoreState; progressIndex: number; progressS: number; maxProgressS: number; onRoad: boolean; wrongWay: boolean; result: RaceResult | null; readonly config: RaceConfig; constructor(cfg: RaceConfig); step(input: InputState, replacer?: boolean): RaceEvent[]; hud(): HudData }`
  - constantes `ZONE_LIMIT = 35`, `FROZEN_LIMIT = 5`

Comportement (spec §4.6, §5.4, §6, §8.2) :
- Départ : voiture posée sur l'échantillon d'indice `min(6, n − 1)`, dans l'axe. Le premier `step` renvoie `{ type: 'decompte', n: 3 }` (si countdown > 0), puis un événement à chaque changement de chiffre (2, 1, puis 0 = « Partez ! »). Pendant le décompte la voiture ne bouge pas (seul le régime moteur suit l'accélérateur).
- Course : `stepCar` puis `resolveCollisions` ; choc si impact > `CRASH_IMPACT`. Progression par `projectOnTrack` autour de `progressIndex` ; si `|lateral| > w + 25` la progression est gelée (`frozenTime` augmente) ; au-delà de 5 s gelé → replacement automatique. Si `|lateral| > 30` et que la route la plus proche (`nearestSample`) est à plus de 35 m ou introuvable → replacement automatique. `R` (paramètre `replacer`) → replacement manuel. Mauvais sens si la progression recule (< −1 m/s) plus de 2 s cumulées.
- Replacement : au centre de la route, 5 m avant `maxProgressS`, dans l'axe, vitesse nulle, `prevCar` recopié (pas d'interpolation parasite).
- Arrivée : quand `maxProgressS ≥ length − 1,5` et voiture sur la chaussée → `finishScore`, bonus, `result` (`score = driftPoints + bonus`, arrondis), phase `arrivee`, événement `arrivee`. Ensuite la voiture continue en roue libre en freinant légèrement (frein 0,3).

- [ ] **Step 1 : écrire les tests**

`tests/core/race/race.test.ts` :
```ts
import { describe, it, expect } from 'vitest';
import { RaceSim, type RaceEvent } from '../../../src/core/race/race';
import { buildTrack } from '../../../src/core/track/buildTrack';
import { Terrain } from '../../../src/core/track/terrain';
import { projectOnTrack } from '../../../src/core/track/projection';
import { generateEnvironment } from '../../../src/core/env/generate';
import { CARS } from '../../../src/core/physics/cars';
import { MODES } from '../../../src/core/physics/assists';
import type { InputState } from '../../../src/core/input';
import type { Level } from '../../../src/core/level/types';
import { SIM_DT } from '../../../src/core/constants';
import { makeLevel, straightLevel, hairpinLevel } from '../../fixtures/levels';

function makeSim(level: Level, countdown = 0): RaceSim {
  const track = buildTrack(level);
  const terrain = new Terrain(track, level.decor.graine);
  const env = generateEnvironment(level, track, terrain);
  return new RaceSim({ level, track, terrain, env, car: CARS.equilibree, assists: MODES.semi, countdown });
}
const GAZ: InputState = { gaz: 1, frein: 0, direction: 0, freinAMain: false };
const IDLE: InputState = { gaz: 0, frein: 0, direction: 0, freinAMain: false };

function runFor(sim: RaceSim, seconds: number, input: InputState): RaceEvent[] {
  const ev: RaceEvent[] = [];
  for (let i = 0; i < Math.round(seconds / SIM_DT); i++) ev.push(...sim.step(input));
  return ev;
}

describe('RaceSim', () => {
  it('décompte 3-2-1-0 : la voiture ne bouge pas', () => {
    const sim = makeSim(straightLevel(300), 3);
    const z0 = sim.car.z;
    const ev = runFor(sim, 3.05, GAZ);
    const counts = ev.filter((e) => e.type === 'decompte').map((e) => (e as { n: number }).n);
    expect(counts).toEqual([3, 2, 1, 0]);
    expect(sim.phase).toBe('course');
    expect(sim.car.z).toBeCloseTo(z0, 1);
  });
  it('ligne droite pleins gaz : arrivée avec un résultat cohérent', () => {
    const sim = makeSim(straightLevel(300));
    let arrivee: RaceEvent | undefined;
    for (let t = 0; t < 60 && !arrivee; t += SIM_DT) arrivee = sim.step(GAZ).find((e) => e.type === 'arrivee');
    expect(arrivee).toBeDefined();
    expect(sim.phase).toBe('arrivee');
    const r = sim.result!;
    expect(r.time).toBeGreaterThan(5);
    expect(r.time).toBeLessThan(40);
    expect(r.score).toBe(r.driftPoints + r.bonus);
    expect(r.bonus).toBe(Math.round(Math.max(0, r.targetTime - r.time) * 2000));
    const zAfter = sim.car.z;
    runFor(sim, 1, GAZ);
    expect(sim.car.z).toBeGreaterThan(zAfter);
  });
  it('replacement manuel : sur la route, à l’arrêt, pas au-delà de la progression', () => {
    const sim = makeSim(straightLevel(300));
    runFor(sim, 4, GAZ);
    sim.car.x += 4;
    const ev = sim.step(IDLE, true);
    expect(ev).toContainEqual({ type: 'replace', auto: false });
    expect(sim.car.speed).toBe(0);
    const p = projectOnTrack(sim.config.track, sim.car.x, sim.car.z, sim.progressIndex);
    expect(Math.abs(p.lateral)).toBeLessThan(0.5);
    expect(sim.progressS).toBeLessThanOrEqual(sim.maxProgressS);
  });
  it('limite de zone : replacement automatique', () => {
    const sim = makeSim(straightLevel(300));
    runFor(sim, 2, GAZ);
    sim.car.x += 60;
    const ev = sim.step(IDLE);
    expect(ev).toContainEqual({ type: 'replace', auto: true });
  });
  it('raccourci dans une épingle : progression gelée puis replacement après 5 s', () => {
    const sim = makeSim(hairpinLevel());
    runFor(sim, 2, GAZ);
    const before = sim.maxProgressS;
    sim.car.x = 40; sim.car.vx = 0; sim.car.vz = 0; sim.car.yawRate = 0;
    const ev = runFor(sim, 5.3, IDLE);
    expect(ev).toContainEqual({ type: 'replace', auto: true });
    expect(sim.maxProgressS).toBeLessThan(before + 10);
  });
  it('mauvais sens détecté', () => {
    const sim = makeSim(straightLevel(300));
    runFor(sim, 6, GAZ);
    sim.car.heading = Math.PI;
    sim.car.vz = -sim.car.vz;
    let seen = false;
    for (let t = 0; t < 4; t += SIM_DT) { sim.step(GAZ); if (sim.hud().wrongWay) seen = true; }
    expect(seen).toBe(true);
  });
  it('rocher sur la route : choc et perte de combo', () => {
    const lv = straightLevel(300);
    lv.objets = [{ type: 'rocher', x: 0, z: 120, rot: 0 }];
    const sim = makeSim(lv);
    const ev = runFor(sim, 20, GAZ);
    expect(ev.some((e) => e.type === 'choc')).toBe(true);
  });
  it('déterministe', () => {
    const script = (t: number): InputState => ({ gaz: 1, frein: 0, direction: Math.sin(t) > 0.5 ? 1 : 0, freinAMain: t % 3 < 0.4 });
    const a = makeSim(hairpinLevel()), b = makeSim(hairpinLevel());
    for (let i = 0; i < 1800; i++) { a.step(script(i * SIM_DT)); b.step(script(i * SIM_DT)); }
    expect(a.car).toEqual(b.car);
    expect(a.score).toEqual(b.score);
  });
  it('niveau minimal (2 points, 20 m) : arrivée', () => {
    const sim = makeSim(makeLevel([[0, 0, 0, 10], [0, 20, 0, 10]]));
    const ev = runFor(sim, 10, GAZ);
    expect(ev.some((e) => e.type === 'arrivee')).toBe(true);
  });
  it('HUD : valeurs finies', () => {
    const sim = makeSim(straightLevel(300), 3);
    runFor(sim, 5, GAZ);
    const h = sim.hud();
    for (const v of Object.values(h)) if (typeof v === 'number') expect(Number.isFinite(v)).toBe(true);
    expect(h.progress).toBeGreaterThan(0);
    expect(h.progress).toBeLessThanOrEqual(1);
  });
});
```

Run : `npx vitest run tests/core/race/race.test.ts` → FAIL.

- [ ] **Step 2 : implémenter**

`src/core/race/race.ts` :
```ts
import { SIM_DT } from '../constants';
import type { InputState } from '../input';
import type { Level } from '../level/types';
import type { TrackData } from '../track/buildTrack';
import type { Terrain } from '../track/terrain';
import { projectOnTrack, nearestSample } from '../track/projection';
import type { Environment } from '../env/types';
import type { AssistParams, CarParams, CarState, StepContext } from '../physics/types';
import { createCarState, copyCarState, stepCar } from '../physics/car';
import { buildCollisionWorld, resolveCollisions, CRASH_IMPACT, type CollisionWorld } from '../physics/collision';
import {
  createScore, stepScore, finishScore, timeBonus, DEFAULT_SCORE_PARAMS,
  type ScoreEvent, type ScoreParams, type ScoreState,
} from '../scoring/score';
import { clamp } from '../math/vec';

export type RacePhase = 'compte' | 'course' | 'arrivee';

export interface RaceConfig {
  level: Level;
  track: TrackData;
  terrain: Terrain;
  env: Environment;
  car: CarParams;
  assists: AssistParams;
  scoreParams?: ScoreParams;
  countdown?: number;
}

export interface RaceResult {
  score: number;
  driftPoints: number;
  bonus: number;
  time: number;
  bestDrift: number;
  targetTime: number;
}

export type RaceEvent =
  | { type: 'decompte'; n: number }
  | ScoreEvent
  | { type: 'choc'; impact: number }
  | { type: 'replace'; auto: boolean }
  | { type: 'arrivee'; result: RaceResult };

export interface HudData {
  phase: RacePhase;
  countdown: number;
  time: number;
  score: number;
  drift: number;
  multiplier: number;
  driftActive: boolean;
  progress: number;
  wrongWay: boolean;
  speedKmh: number;
}

export const ZONE_LIMIT = 35;
export const FROZEN_LIMIT = 5;
const COAST: InputState = { gaz: 0, frein: 0.3, direction: 0, freinAMain: false };

export class RaceSim {
  readonly car: CarState;
  readonly prevCar: CarState;
  phase: RacePhase = 'compte';
  countdown: number;
  time = 0;
  readonly score: ScoreState = createScore();
  progressIndex: number;
  progressS: number;
  maxProgressS: number;
  onRoad = true;
  wrongWay = false;
  result: RaceResult | null = null;
  readonly config: RaceConfig;

  private wrongWayTime = 0;
  private frozenTime = 0;
  private readonly world: CollisionWorld;
  private readonly ctx: StepContext;
  private readonly sp: ScoreParams;
  private pending: RaceEvent[] = [];

  constructor(cfg: RaceConfig) {
    this.config = cfg;
    this.sp = cfg.scoreParams ?? DEFAULT_SCORE_PARAMS;
    this.countdown = cfg.countdown ?? 3;
    this.world = buildCollisionWorld(cfg.env);
    this.ctx = { params: cfg.car, assists: cfg.assists, ground: cfg.terrain, onRoad: true };
    const idx = Math.min(6, cfg.track.samples.length - 1);
    const s0 = cfg.track.samples[idx];
    this.car = createCarState(s0.x, s0.z, Math.atan2(s0.tx, s0.tz), cfg.terrain.heightAt(s0.x, s0.z));
    this.prevCar = copyCarState(this.car);
    this.progressIndex = idx;
    this.progressS = s0.s;
    this.maxProgressS = s0.s;
    if (this.countdown > 0) this.pending.push({ type: 'decompte', n: Math.ceil(this.countdown) });
    else this.phase = 'course';
  }

  step(input: InputState, replacer = false): RaceEvent[] {
    const ev = this.pending;
    this.pending = [];
    copyCarState(this.car, this.prevCar);

    if (this.phase === 'compte') {
      const before = Math.ceil(this.countdown - 1e-9);
      this.countdown = Math.max(0, this.countdown - SIM_DT);
      const after = Math.ceil(this.countdown - 1e-9);
      if (after < before) ev.push({ type: 'decompte', n: after });
      if (this.countdown <= 0) this.phase = 'course';
      this.car.rpm = 900 + clamp(input.gaz, 0, 1) * 5200;
      return ev;
    }

    if (this.phase === 'arrivee') {
      this.ctx.onRoad = this.onRoad;
      stepCar(this.car, COAST, this.ctx, SIM_DT);
      resolveCollisions(this.car, this.config.car, this.world);
      return ev;
    }

    // Course
    this.time += SIM_DT;
    const track = this.config.track;
    this.ctx.onRoad = this.onRoad;
    stepCar(this.car, input, this.ctx, SIM_DT);
    const impact = resolveCollisions(this.car, this.config.car, this.world);
    const crash = impact > CRASH_IMPACT;
    if (crash) ev.push({ type: 'choc', impact });

    // Progression (fenêtre autour de la dernière position : anti-raccourci)
    const proj = projectOnTrack(track, this.car.x, this.car.z, this.progressIndex);
    const sp = track.samples[proj.index];
    const lat = Math.abs(proj.lateral);
    this.onRoad = lat <= sp.w;
    let progressRate = 0;
    if (lat <= sp.w + 25) {
      const prevS = this.progressS;
      this.progressIndex = proj.index;
      this.progressS = proj.s;
      progressRate = (this.progressS - prevS) / SIM_DT;
      if (this.progressS > this.maxProgressS) this.maxProgressS = this.progressS;
      this.frozenTime = 0;
    } else {
      this.frozenTime += SIM_DT;
    }

    // Mauvais sens
    if (progressRate < -1) this.wrongWayTime += SIM_DT;
    else this.wrongWayTime = Math.max(0, this.wrongWayTime - 2 * SIM_DT);
    this.wrongWay = this.wrongWayTime > 2;

    // Replacement manuel ou automatique
    let auto = this.frozenTime > FROZEN_LIMIT;
    if (!auto && lat > 30) {
      const near = nearestSample(track, this.car.x, this.car.z);
      if (!near || near.dist > ZONE_LIMIT) auto = true;
    }
    let reset = false;
    if (replacer || auto) {
      this.respawn();
      reset = true;
      ev.push({ type: 'replace', auto: !replacer });
    }

    // Score
    const se = stepScore(
      this.score,
      { betaRad: this.car.beta, speed: this.car.speed, onRoad: this.onRoad, progressRate, crash, reset },
      SIM_DT,
      this.sp,
    );
    if (se) ev.push(se);

    // Arrivée
    if (this.maxProgressS >= track.length - 1.5 && this.onRoad) this.finish(ev);
    return ev;
  }

  hud(): HudData {
    return {
      phase: this.phase,
      countdown: this.countdown,
      time: this.time,
      score: this.score.total,
      drift: this.score.drift * this.score.multiplier,
      multiplier: this.score.multiplier,
      driftActive: this.score.active,
      progress: clamp(this.maxProgressS / this.config.track.length, 0, 1),
      wrongWay: this.wrongWay,
      speedKmh: this.car.speed * 3.6,
    };
  }

  private respawn(): void {
    const track = this.config.track;
    const s = Math.max(0, this.maxProgressS - 5);
    const idx = Math.min(track.samples.length - 1, Math.round(s));
    const sp = track.samples[idx];
    const fresh = createCarState(sp.x, sp.z, Math.atan2(sp.tx, sp.tz), this.config.terrain.heightAt(sp.x, sp.z));
    fresh.wheelSpin = this.car.wheelSpin;
    Object.assign(this.car, fresh);
    copyCarState(this.car, this.prevCar);
    this.progressIndex = idx;
    this.progressS = sp.s;
    this.wrongWayTime = 0;
    this.frozenTime = 0;
    this.onRoad = true;
  }

  private finish(ev: RaceEvent[]): void {
    const fe = finishScore(this.score, this.sp);
    if (fe) ev.push(fe);
    const driftPoints = Math.round(this.score.total);
    const bonus = Math.round(timeBonus(this.config.track.targetTime, this.time, this.sp));
    this.result = {
      score: driftPoints + bonus,
      driftPoints,
      bonus,
      time: this.time,
      bestDrift: Math.round(this.score.bestDrift),
      targetTime: this.config.track.targetTime,
    };
    this.phase = 'arrivee';
    ev.push({ type: 'arrivee', result: this.result });
  }
}
```

- [ ] **Step 3 : vérifier** — `npx vitest run tests/core/race/race.test.ts` → PASS ; puis **tous** les tests : `npm test` → PASS ; `npx tsc --noEmit` → OK.

- [ ] **Step 4 : commit**

```bash
git add src/core/race tests/core/race
git commit -m "Course : décompte, progression anti-raccourci, replacement, mauvais sens, arrivée"
```

---

## Tâche 11 : Sauvegarde (réglages et records)

**Files :**
- Create : `src/storage/store.ts`
- Test : `tests/storage/store.test.ts`

**Interfaces :**
- Consumes : `CarId`, `ModeId` (T7), `CAR_IDS` (T7), `MODE_IDS` (T7).
- Produces :
  - `interface KV { getItem(key: string): string | null; setItem(key: string, value: string): void }`, `memoryKV(): KV`
  - `safeStorage(candidate?: KV | null): { kv: KV; persistent: boolean }` (sans argument : essaie `localStorage`)
  - `type Qualite = 'auto' | 'basse' | 'haute'`
  - `interface Reglages { mode: ModeId; voiture: CarId; couleur: string; volume: number; muet: boolean; qualite: Qualite; accelAuto: boolean; cameraLoin: boolean }`, `defaultReglages(touch: boolean): Reglages`
  - `interface RecordEntry { score: number; temps: number; voiture: CarId; meilleurDrift: number; date: string }`
  - `class Store { constructor(kv: KV); loadReglages(touch: boolean): Reglages; saveReglages(r: Reglages): void; getRecord(levelKey: string, mode: ModeId): RecordEntry | null; submitRecord(levelKey: string, mode: ModeId, entry: RecordEntry): boolean }`

Clés : `driftclub.v1.reglages`, `driftclub.v1.records`. Aucune méthode ne lève d'exception (spec §12) ; valeurs invalides remplacées par les valeurs par défaut.

- [ ] **Step 1 : écrire les tests**

`tests/storage/store.test.ts` :
```ts
import { describe, it, expect } from 'vitest';
import { Store, memoryKV, safeStorage, defaultReglages, type KV } from '../../src/storage/store';

const throwingKV: KV = { getItem: () => { throw new Error('refusé'); }, setItem: () => { throw new Error('refusé'); } };

describe('safeStorage', () => {
  it('utilise le stockage fourni s’il fonctionne', () => {
    const kv = memoryKV();
    const s = safeStorage(kv);
    expect(s.persistent).toBe(true);
    expect(s.kv).toBe(kv);
  });
  it('se rabat sur la mémoire si le stockage lève une exception', () => {
    const s = safeStorage(throwingKV);
    expect(s.persistent).toBe(false);
    s.kv.setItem('a', '1');
    expect(s.kv.getItem('a')).toBe('1');
  });
  it('se rabat sur la mémoire sans stockage', () => {
    expect(safeStorage(null).persistent).toBe(false);
  });
});

describe('Store', () => {
  it('réglages par défaut (Arcade au tactile, Semi-arcade sinon)', () => {
    expect(new Store(memoryKV()).loadReglages(true).mode).toBe('arcade');
    expect(new Store(memoryKV()).loadReglages(false)).toEqual(defaultReglages(false));
  });
  it('aller-retour des réglages', () => {
    const st = new Store(memoryKV());
    const r = { ...defaultReglages(false), voiture: 'turbo' as const, couleur: '#3a6ff0', volume: 0.3, cameraLoin: true };
    st.saveReglages(r);
    expect(st.loadReglages(false)).toEqual(r);
  });
  it('JSON corrompu ou valeurs invalides → défauts', () => {
    const kv = memoryKV();
    kv.setItem('driftclub.v1.reglages', '{pas du json');
    expect(new Store(kv).loadReglages(false)).toEqual(defaultReglages(false));
    kv.setItem('driftclub.v1.reglages', JSON.stringify({ mode: 'turbo', couleur: 'rouge', volume: 5, voiture: 'legere' }));
    const r = new Store(kv).loadReglages(false);
    expect(r.mode).toBe('semi');
    expect(r.couleur).toBe(defaultReglages(false).couleur);
    expect(r.volume).toBe(defaultReglages(false).volume);
    expect(r.voiture).toBe('legere');
  });
  it('records : seul un meilleur score remplace', () => {
    const st = new Store(memoryKV());
    const e = { score: 1000, temps: 60, voiture: 'equilibree' as const, meilleurDrift: 400, date: '2026-09-29' };
    expect(st.getRecord('off:a', 'semi')).toBeNull();
    expect(st.submitRecord('off:a', 'semi', e)).toBe(true);
    expect(st.submitRecord('off:a', 'semi', { ...e, score: 900 })).toBe(false);
    expect(st.getRecord('off:a', 'semi')!.score).toBe(1000);
    expect(st.submitRecord('off:a', 'semi', { ...e, score: 1200 })).toBe(true);
    expect(st.getRecord('off:a', 'arcade')).toBeNull();
    expect(st.getRecord('off:a', 'semi')!.score).toBe(1200);
  });
  it('ne lève jamais d’exception, même si le stockage refuse tout', () => {
    const st = new Store(throwingKV);
    expect(() => st.saveReglages(defaultReglages(false))).not.toThrow();
    expect(st.loadReglages(false)).toEqual(defaultReglages(false));
    expect(() => st.submitRecord('x', 'semi', { score: 1, temps: 1, voiture: 'legere', meilleurDrift: 1, date: 'd' })).not.toThrow();
  });
});
```

Run : `npx vitest run tests/storage/store.test.ts` → FAIL.

- [ ] **Step 2 : implémenter**

`src/storage/store.ts` :
```ts
import type { CarId, ModeId } from '../core/physics/types';
import { CAR_IDS } from '../core/physics/cars';
import { MODE_IDS } from '../core/physics/assists';

export interface KV {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export type Qualite = 'auto' | 'basse' | 'haute';

export interface Reglages {
  mode: ModeId;
  voiture: CarId;
  couleur: string;
  volume: number;
  muet: boolean;
  qualite: Qualite;
  accelAuto: boolean;
  cameraLoin: boolean;
}

export interface RecordEntry {
  score: number;
  temps: number;
  voiture: CarId;
  meilleurDrift: number;
  date: string;
}

const K_REGLAGES = 'driftclub.v1.reglages';
const K_RECORDS = 'driftclub.v1.records';
const QUALITES: Qualite[] = ['auto', 'basse', 'haute'];

export function memoryKV(): KV {
  const m = new Map<string, string>();
  return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => { m.set(k, v); } };
}

/** Renvoie un stockage utilisable ; `persistent = false` si rien ne sera conservé. */
export function safeStorage(candidate?: KV | null): { kv: KV; persistent: boolean } {
  try {
    const kv = candidate === undefined ? (typeof localStorage !== 'undefined' ? localStorage : null) : candidate;
    if (!kv) return { kv: memoryKV(), persistent: false };
    kv.setItem('driftclub.test', '1');
    if (kv.getItem('driftclub.test') !== '1') throw new Error('stockage illisible');
    return { kv, persistent: true };
  } catch {
    return { kv: memoryKV(), persistent: false };
  }
}

export function defaultReglages(touch: boolean): Reglages {
  return {
    mode: touch ? 'arcade' : 'semi',
    voiture: 'equilibree',
    couleur: '#e63b2e',
    volume: 0.8,
    muet: false,
    qualite: 'auto',
    accelAuto: true,
    cameraLoin: false,
  };
}

type RecordsMap = Record<string, Partial<Record<ModeId, RecordEntry>>>;

export class Store {
  constructor(private readonly kv: KV) {}

  private read(key: string): unknown {
    try {
      const s = this.kv.getItem(key);
      return s ? JSON.parse(s) : null;
    } catch {
      return null;
    }
  }

  private write(key: string, value: unknown): void {
    try {
      this.kv.setItem(key, JSON.stringify(value));
    } catch {
      // stockage plein ou refusé : le jeu continue sans sauvegarder
    }
  }

  loadReglages(touch: boolean): Reglages {
    const d = defaultReglages(touch);
    const raw = this.read(K_REGLAGES);
    if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return d;
    const o = raw as Record<string, unknown>;
    return {
      mode: MODE_IDS.includes(o.mode as ModeId) ? (o.mode as ModeId) : d.mode,
      voiture: CAR_IDS.includes(o.voiture as CarId) ? (o.voiture as CarId) : d.voiture,
      couleur: typeof o.couleur === 'string' && /^#[0-9a-f]{6}$/i.test(o.couleur) ? o.couleur : d.couleur,
      volume: typeof o.volume === 'number' && o.volume >= 0 && o.volume <= 1 ? o.volume : d.volume,
      muet: typeof o.muet === 'boolean' ? o.muet : d.muet,
      qualite: QUALITES.includes(o.qualite as Qualite) ? (o.qualite as Qualite) : d.qualite,
      accelAuto: typeof o.accelAuto === 'boolean' ? o.accelAuto : d.accelAuto,
      cameraLoin: typeof o.cameraLoin === 'boolean' ? o.cameraLoin : d.cameraLoin,
    };
  }

  saveReglages(r: Reglages): void {
    this.write(K_REGLAGES, r);
  }

  private records(): RecordsMap {
    const r = this.read(K_RECORDS);
    return typeof r === 'object' && r !== null && !Array.isArray(r) ? (r as RecordsMap) : {};
  }

  getRecord(levelKey: string, mode: ModeId): RecordEntry | null {
    const e = this.records()[levelKey]?.[mode];
    return e && typeof e.score === 'number' ? e : null;
  }

  /** Enregistre si c'est un nouveau record ; renvoie true dans ce cas. */
  submitRecord(levelKey: string, mode: ModeId, entry: RecordEntry): boolean {
    const all = this.records();
    const cur = all[levelKey]?.[mode];
    if (cur && typeof cur.score === 'number' && cur.score >= entry.score) return false;
    all[levelKey] = { ...(all[levelKey] ?? {}), [mode]: entry };
    this.write(K_RECORDS, all);
    return true;
  }
}
```

- [ ] **Step 3 : vérifier** — `npx vitest run tests/storage/store.test.ts` → PASS ; `npx tsc --noEmit` → OK.

- [ ] **Step 4 : commit**

```bash
git add src/storage tests/storage
git commit -m "Sauvegarde : réglages et records, sans jamais planter si le stockage est refusé"
```

---

## Tâche 12 : Les 3 niveaux officiels

**Files :**
- Create : `levels/premiers-virages.json`, `levels/foret-des-pins.json`, `levels/col-du-loup.json`, `src/levels.ts`
- Test : `tests/levels.test.ts`

**Interfaces :**
- Consumes : `loadLevel` (T4), `Terrain` (T5), `generateEnvironment` (T6).
- Produces : `interface NiveauOfficiel { id: string; data: unknown }`, `NIVEAUX_OFFICIELS: NiveauOfficiel[]` (ordre : premiers-virages, foret-des-pins, col-du-loup), `cleNiveauOfficiel(id: string): string` (= `off:<id>`).

- [ ] **Step 1 : écrire le test**

`tests/levels.test.ts` :
```ts
import { describe, it, expect } from 'vitest';
import { NIVEAUX_OFFICIELS, cleNiveauOfficiel } from '../src/levels';
import { loadLevel } from '../src/core/loadLevel';
import { Terrain } from '../src/core/track/terrain';
import { generateEnvironment } from '../src/core/env/generate';

describe('niveaux officiels', () => {
  it('trois niveaux dans le bon ordre, identifiants uniques', () => {
    expect(NIVEAUX_OFFICIELS.map((n) => n.id)).toEqual(['premiers-virages', 'foret-des-pins', 'col-du-loup']);
    expect(cleNiveauOfficiel('col-du-loup')).toBe('off:col-du-loup');
  });
  for (const n of NIVEAUX_OFFICIELS) {
    it(`${n.id} : valide, bonne longueur, décor généré`, () => {
      const r = loadLevel(n.data);
      if (!r.ok) throw new Error(r.erreurs.join('\n'));
      expect(r.track.length).toBeGreaterThan(900);
      expect(r.track.length).toBeLessThan(2100);
      expect(r.track.targetTime).toBeGreaterThan(35);
      expect(r.track.targetTime).toBeLessThan(150);
      const terrain = new Terrain(r.track, r.level.decor.graine);
      const env = generateEnvironment(r.level, r.track, terrain);
      expect(env.items.length).toBeGreaterThan(300);
      if (n.id === 'col-du-loup') expect(env.segments.length).toBeGreaterThan(0);
    });
  }
});
```

Run : `npx vitest run tests/levels.test.ts` → FAIL.

- [ ] **Step 2 : les niveaux**

`levels/premiers-virages.json` :
```json
{
  "format": 1,
  "nom": "Premiers virages",
  "auteur": "Drift Club",
  "environnement": "montagne",
  "ambiance": "jour",
  "route": [
    { "x": 0, "z": 0, "y": 0, "l": 12 },
    { "x": 0, "z": 80, "y": 0, "l": 12 },
    { "x": 30, "z": 150, "y": 2, "l": 12 },
    { "x": 100, "z": 190, "y": 4, "l": 12 },
    { "x": 170, "z": 170, "y": 5, "l": 12 },
    { "x": 210, "z": 110, "y": 6, "l": 12 },
    { "x": 260, "z": 60, "y": 6, "l": 12 },
    { "x": 330, "z": 60, "y": 7, "l": 12 },
    { "x": 380, "z": 110, "y": 8, "l": 12 },
    { "x": 380, "z": 190, "y": 9, "l": 12 },
    { "x": 330, "z": 240, "y": 10, "l": 12 },
    { "x": 260, "z": 260, "y": 10, "l": 12 },
    { "x": 200, "z": 310, "y": 11, "l": 12 },
    { "x": 220, "z": 380, "y": 12, "l": 12 },
    { "x": 290, "z": 410, "y": 12, "l": 12 }
  ],
  "barrieres": [],
  "decor": { "graine": 4821, "densite": 0.55 },
  "objets": []
}
```

`levels/foret-des-pins.json` :
```json
{
  "format": 1,
  "nom": "Forêt des Pins",
  "auteur": "Drift Club",
  "environnement": "montagne",
  "ambiance": "jour",
  "route": [
    { "x": 0, "z": 0, "y": 0, "l": 10 },
    { "x": 0, "z": 60, "y": 1, "l": 10 },
    { "x": 40, "z": 110, "y": 3, "l": 10 },
    { "x": 0, "z": 160, "y": 5, "l": 10 },
    { "x": -40, "z": 210, "y": 7, "l": 10 },
    { "x": 0, "z": 260, "y": 9, "l": 10 },
    { "x": 50, "z": 300, "y": 11, "l": 10 },
    { "x": 110, "z": 300, "y": 13, "l": 10 },
    { "x": 150, "z": 260, "y": 14, "l": 10 },
    { "x": 150, "z": 200, "y": 15, "l": 10 },
    { "x": 190, "z": 160, "y": 16, "l": 10 },
    { "x": 250, "z": 160, "y": 18, "l": 10 },
    { "x": 290, "z": 200, "y": 20, "l": 10 },
    { "x": 290, "z": 260, "y": 22, "l": 10 },
    { "x": 250, "z": 310, "y": 24, "l": 10 },
    { "x": 260, "z": 380, "y": 26, "l": 10 },
    { "x": 320, "z": 420, "y": 28, "l": 10 },
    { "x": 390, "z": 410, "y": 30, "l": 10 },
    { "x": 430, "z": 360, "y": 30, "l": 10 },
    { "x": 480, "z": 330, "y": 29, "l": 10 },
    { "x": 540, "z": 350, "y": 28, "l": 10 }
  ],
  "barrieres": [{ "de": 7, "a": 10, "cote": "ext" }],
  "decor": { "graine": 1337, "densite": 0.85 },
  "objets": []
}
```

`levels/col-du-loup.json` :
```json
{
  "format": 1,
  "nom": "Col du Loup",
  "auteur": "Drift Club",
  "environnement": "montagne",
  "ambiance": "coucher",
  "route": [
    { "x": 0, "z": 0, "y": 0, "l": 9 },
    { "x": 100, "z": 0, "y": 5, "l": 9 },
    { "x": 190, "z": 3, "y": 14, "l": 9 },
    { "x": 205, "z": 4, "y": 15, "l": 9 },
    { "x": 219.8, "z": 10.2, "y": 16, "l": 9 },
    { "x": 226, "z": 25, "y": 17, "l": 9 },
    { "x": 219.8, "z": 39.8, "y": 18, "l": 9 },
    { "x": 205, "z": 46, "y": 19, "l": 9 },
    { "x": 120, "z": 50, "y": 28, "l": 9 },
    { "x": 50, "z": 50, "y": 35, "l": 9 },
    { "x": 35, "z": 50, "y": 36, "l": 9 },
    { "x": 19.4, "z": 56.4, "y": 37, "l": 9 },
    { "x": 13, "z": 72, "y": 38, "l": 9 },
    { "x": 19.4, "z": 87.6, "y": 39, "l": 9 },
    { "x": 35, "z": 94, "y": 40, "l": 9 },
    { "x": 130, "z": 100, "y": 50, "l": 9 },
    { "x": 207, "z": 100, "y": 57, "l": 9 },
    { "x": 222, "z": 100, "y": 58, "l": 9 },
    { "x": 237.6, "z": 106.4, "y": 59, "l": 9 },
    { "x": 244, "z": 122, "y": 60, "l": 9 },
    { "x": 237.6, "z": 137.6, "y": 61, "l": 9 },
    { "x": 222, "z": 144, "y": 62, "l": 9 },
    { "x": 140, "z": 150, "y": 70, "l": 9 },
    { "x": 60, "z": 160, "y": 78, "l": 9 },
    { "x": 20, "z": 200, "y": 82, "l": 9 },
    { "x": 40, "z": 250, "y": 86, "l": 9 },
    { "x": 120, "z": 270, "y": 88, "l": 9 },
    { "x": 200, "z": 260, "y": 90, "l": 9 },
    { "x": 280, "z": 280, "y": 90, "l": 9 },
    { "x": 340, "z": 330, "y": 88, "l": 9 },
    { "x": 330, "z": 400, "y": 86, "l": 9 },
    { "x": 270, "z": 440, "y": 84, "l": 9 },
    { "x": 200, "z": 470, "y": 84, "l": 9 },
    { "x": 150, "z": 520, "y": 85, "l": 9 },
    { "x": 170, "z": 590, "y": 86, "l": 9 },
    { "x": 240, "z": 610, "y": 86, "l": 9 }
  ],
  "barrieres": [
    { "de": 2, "a": 8, "cote": "ext" },
    { "de": 9, "a": 15, "cote": "ext" },
    { "de": 16, "a": 22, "cote": "ext" },
    { "de": 28, "a": 31, "cote": "ext" }
  ],
  "decor": { "graine": 777, "densite": 0.7 },
  "objets": []
}
```

`src/levels.ts` :
```ts
import premiersVirages from '../levels/premiers-virages.json';
import foretDesPins from '../levels/foret-des-pins.json';
import colDuLoup from '../levels/col-du-loup.json';

export interface NiveauOfficiel {
  id: string;
  data: unknown;
}

export const NIVEAUX_OFFICIELS: NiveauOfficiel[] = [
  { id: 'premiers-virages', data: premiersVirages },
  { id: 'foret-des-pins', data: foretDesPins },
  { id: 'col-du-loup', data: colDuLoup },
];

export const cleNiveauOfficiel = (id: string): string => `off:${id}`;
```

- [ ] **Step 3 : vérifier** — `npx vitest run tests/levels.test.ts` → PASS ; `npx tsc --noEmit` → OK.

Si un niveau échoue sur la géométrie :
- « virage trop serré » → les épingles du Col du Loup sont déjà des arcs de 5 points (rayon ≈ 21 m, mesuré à 15 m minimum après lissage) ; si un niveau échoue quand même, signaler le rayon mesuré et le point concerné dans le rapport (BLOCKED), sans modifier les seuils.
- « se croise » → écarter de 10 m le point le plus proche de la zone signalée, perpendiculairement à la route.
- Dans tous les cas, noter dans le rapport les points modifiés et pourquoi.

- [ ] **Step 4 : commit**

```bash
git add levels src/levels.ts tests/levels.test.ts
git commit -m "Trois niveaux officiels : Premiers virages, Forêt des Pins, Col du Loup"
```

---

## Tâche 13 : Voitures JDM générées par code, modèles de décor Kenney, matériaux toon

**Files :**
- Create : `public/models/**` (copie du décor), `src/render/materials.ts`, `src/render/procedural.ts`, `src/render/jdmCars.ts`, `src/render/assets.ts`
- Test : `tests/render/assets.test.ts`

**Interfaces :**
- Consumes : `CAR_IDS`, `CarId` (T7), `DecorKind` (T6).
- Produces :
  - `toonGradient(): THREE.DataTexture`, `toonMaterial(opts?: { color?: THREE.ColorRepresentation; vertexColors?: boolean; map?: THREE.Texture | null }): THREE.MeshToonMaterial`
  - `outlineMaterial(width: number, color?: THREE.ColorRepresentation): THREE.MeshBasicMaterial` (coque inversée, extrusion le long de la normale)
  - `outlineGeometry(geo: THREE.BufferGeometry): THREE.BufferGeometry` (normales lissées par position, pour des contours sans trous)
  - `colorize(g: THREE.BufferGeometry, color: THREE.ColorRepresentation): THREE.BufferGeometry`, `coloredBox(w, h, d, x, y, z, color): THREE.BufferGeometry`, `wheelGeometry(r: number, width: number)`, `borneGeometry()`, `chevronGeometry()`, `barrierGeometry()` (longueur 1 le long de +z), `tireStack(wheel: THREE.BufferGeometry)`
  - `PAINT: THREE.Color` (couleur « sentinelle » de la peinture), `interface CarShape` (voir code), `CAR_SHAPES: Record<CarId, CarShape>`, `bodyProfile(s): [number, number][]`, `cabinProfile(s): [number, number][]`, `extrudeProfile(points, width, color, bevel?): THREE.BufferGeometry`, `buildJdmCar(s: CarShape): CarModel`
  - `bakeMesh(mesh: THREE.Mesh, matrix: THREE.Matrix4): THREE.BufferGeometry` → géométrie non indexée avec `position`, `normal`, `color` (couleur du matériau, linéaire)
  - `normalizeGeometry(geo, size: number, axis: 'x' | 'y'): THREE.BufferGeometry` (base à y = 0, centrée en x/z, mise à l'échelle)
  - `paintGeometry(src, paint: THREE.Color, color: THREE.Color): THREE.BufferGeometry`
  - `interface WheelModel { geometry; position: THREE.Vector3; front: boolean; left: boolean }`, `interface CarModel { body: THREE.BufferGeometry; wheels: WheelModel[]; paint: THREE.Color }`
  - `interface Assets { cars: Record<CarId, CarModel>; decor: Record<string, THREE.BufferGeometry> }` — clés de décor : `decorKey(kind, variant)` = `` `${kind}${variant}` `` (`sapin0..2`, `feuillu0..2`, `rocher0..1`, `rocherHaut0`, `panneau0`, `pneus0`, `chevron0`, `borne0`) + `barriere`
  - `decorKey(kind: DecorKind, variant: number): string`
  - `loadAssets(baseUrl: string, onProgress?: (p: number) => void): Promise<Assets>` (réseau : ne charge que le décor ; les voitures sont construites par code)

**Voitures (choix de Macalamar) :** trois silhouettes d'inspiration japonaise, sans nom ni logo de marque. Chaque voiture est un profil latéral (caisse + habitacle vitré) extrudé sur la largeur, avec passages de roues découpés dans le profil, toit peint, pare-chocs, calandre, feux, rétroviseurs et aileron selon le modèle :
- **La Légère** : petit coupé à hayon des années 80, phares escamotables (esprit AE86) ;
- **L'Équilibrée** : coupé fastback, petit becquet (esprit Silvia) ;
- **La Turbo** : grosse GT, capot long, grand aileron (esprit Supra / Skyline).

Les voitures regardent vers +z, roues gauches en +x, axes de roues aux positions de la physique (`cgToFront` et `cgToFront − wheelbase`). La peinture utilise une couleur sentinelle (`PAINT`, magenta) remplacée par la couleur choisie via `paintGeometry`. Les roues sont procédurales (pneu, jante, moyeu et rayons visibles quand elles tournent).

**Décor :** modèles Kenney Nature Kit (sans texture : couleur du matériau), mis à l'échelle en mètres.

- [ ] **Step 1 : copier les modèles de décor dans le projet**

```bash
SRC="/c/Users/mdemore/AppData/Local/Temp/claude/C--Users-mdemore-Desktop-proj-drift-club/3052ff09-7a6b-401c-8060-8a3cc2db44d4/scratchpad/kenney"
mkdir -p public/models/nature
for f in tree_pineTallA tree_pineDefaultA tree_pineRoundA tree_default tree_oak tree_fat rock_largeA rock_largeB rock_tallA sign; do cp "$SRC/nature/Models/GLTF format/$f.glb" public/models/nature/; done
{ echo "Modèles de décor : Kenney Nature Kit (www.kenney.nl) — licence CC0 (domaine public)."; echo; cat "$SRC/nature/License.txt"; } > public/models/LICENCE-kenney.txt
ls -R public/models
```
Expected : 10 fichiers `.glb` dans `nature/`, et `LICENCE-kenney.txt`.

- [ ] **Step 2 : écrire les tests** (rien ici ne dépend du DOM)

`tests/render/assets.test.ts` :
```ts
import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { toonGradient, toonMaterial, outlineGeometry, outlineMaterial } from '../../src/render/materials';
import { coloredBox, wheelGeometry, borneGeometry, chevronGeometry, barrierGeometry, tireStack } from '../../src/render/procedural';
import { buildJdmCar, CAR_SHAPES, PAINT, bodyProfile } from '../../src/render/jdmCars';
import { bakeMesh, normalizeGeometry, paintGeometry, decorKey } from '../../src/render/assets';
import { CARS, CAR_IDS } from '../../src/core/physics/cars';

const finite = (g: THREE.BufferGeometry) => Array.from(g.getAttribute('position').array as Float32Array).every(Number.isFinite);
const bbox = (g: THREE.BufferGeometry) => { g.computeBoundingBox(); return g.boundingBox!; };
const countColor = (g: THREE.BufferGeometry, c: THREE.Color) => {
  const col = g.getAttribute('color');
  let n = 0;
  for (let i = 0; i < col.count; i++) if (Math.abs(col.getX(i) - c.r) + Math.abs(col.getY(i) - c.g) + Math.abs(col.getZ(i) - c.b) < 1e-3) n++;
  return n;
};

describe('matériaux', () => {
  it('rampe toon 3 tons', () => {
    const t = toonGradient();
    expect(t.image.width).toBe(3);
    expect(t.minFilter).toBe(THREE.NearestFilter);
    expect(toonMaterial({ vertexColors: true }).gradientMap).toBe(t);
  });
  it('contour : normales lissées (moyennes par position)', () => {
    const g = outlineGeometry(new THREE.BoxGeometry(1, 1, 1));
    const n = g.getAttribute('normal');
    const p = g.getAttribute('position');
    for (let i = 0; i < p.count; i++) {
      expect(Math.abs(n.getX(i))).toBeCloseTo(1 / Math.sqrt(3), 4);
      expect(Math.sign(n.getX(i))).toBe(Math.sign(p.getX(i)));
    }
    expect(outlineMaterial(0.05).side).toBe(THREE.BackSide);
  });
});

describe('géométries procédurales', () => {
  it('ont des couleurs, pas d’UV, des positions finies', () => {
    for (const g of [coloredBox(1, 2, 3, 0, 0, 0, 0xff0000), wheelGeometry(0.32, 0.24), borneGeometry(), chevronGeometry(), barrierGeometry()]) {
      expect(g.getAttribute('color')).toBeDefined();
      expect(g.getAttribute('uv')).toBeUndefined();
      expect(finite(g)).toBe(true);
    }
  });
  it('roue : diamètre 2r, axe selon x', () => {
    const b = bbox(wheelGeometry(0.32, 0.24));
    expect(b.max.y - b.min.y).toBeGreaterThan(0.6);
    expect(b.max.y - b.min.y).toBeLessThan(0.66);
    expect(b.max.x - b.min.x).toBeLessThan(0.35);
  });
  it('borne ≈ 0,9 m de haut, barrière d’1 m de long sur z', () => {
    expect(bbox(borneGeometry()).max.y).toBeGreaterThan(0.85);
    const r = bbox(barrierGeometry());
    expect(r.max.z - r.min.z).toBeCloseTo(1, 2);
  });
  it('pile de 3 pneus couchés, posée au sol', () => {
    const b = bbox(tireStack(wheelGeometry(0.375, 0.3)));
    expect(b.max.y - b.min.y).toBeGreaterThan(0.85);
    expect(b.max.y - b.min.y).toBeLessThan(1.1);
    expect(b.min.y).toBeCloseTo(0, 5);
  });
});

describe('voitures JDM', () => {
  for (const id of CAR_IDS) {
    it(`${id} : dimensions, peinture, roues aux essieux de la physique`, () => {
      const s = CAR_SHAPES[id];
      const car = buildJdmCar(s);
      expect(finite(car.body)).toBe(true);
      const b = bbox(car.body);
      expect(b.max.z - b.min.z).toBeGreaterThan(s.length - 0.05);
      expect(b.max.z - b.min.z).toBeLessThan(s.length + 0.2);
      expect(b.max.x - b.min.x).toBeLessThan(s.width + 0.1);
      expect(b.min.y).toBeGreaterThan(0.1);
      expect(b.max.y).toBeGreaterThan(s.roofY);
      expect(countColor(car.body, PAINT)).toBeGreaterThan(20);
      expect(car.wheels.length).toBe(4);
      const fl = car.wheels.find((w) => w.front && w.left)!;
      expect(fl.position.z).toBeCloseTo(CARS[id].cgToFront, 5);
      expect(fl.position.x).toBeGreaterThan(0);
      const rear = car.wheels.find((w) => !w.front)!;
      expect(rear.position.z).toBeCloseTo(CARS[id].cgToFront - CARS[id].wheelbase, 5);
      expect(Math.abs(s.length - CARS[id].length)).toBeLessThan(1e-9);
    });
  }
  it('profil de caisse fermé et fini', () => {
    const p = bodyProfile(CAR_SHAPES.turbo);
    expect(p.length).toBeGreaterThan(15);
    expect(p.every(([z, y]) => Number.isFinite(z) && Number.isFinite(y))).toBe(true);
  });
  it('paintGeometry : repeint seulement la peinture, sans toucher l’original', () => {
    const car = buildJdmCar(CAR_SHAPES.equilibree);
    const blue = new THREE.Color(0x3a6ff0);
    const before = countColor(car.body, PAINT);
    const out = paintGeometry(car.body, PAINT, blue);
    expect(countColor(out, PAINT)).toBe(0);
    expect(countColor(out, blue)).toBe(before);
    expect(countColor(car.body, PAINT)).toBe(before);
  });
});

describe('préparation des modèles de décor', () => {
  it('bakeMesh : couleur du matériau et matrice appliquées', () => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({ color: 0xff0000 }));
    const g = bakeMesh(mesh, new THREE.Matrix4().makeTranslation(0, 5, 0));
    const c = g.getAttribute('color');
    expect(c.getX(0)).toBeCloseTo(1, 5);
    expect(c.getY(0)).toBeCloseTo(0, 5);
    expect(bbox(g).min.y).toBeCloseTo(4.5, 5);
    expect(g.index).toBeNull();
  });
  it('normalizeGeometry : taille visée, base au sol, centrée', () => {
    const bb = bbox(normalizeGeometry(new THREE.BoxGeometry(2, 4, 2).translate(10, 3, -7), 8, 'y'));
    expect(bb.max.y - bb.min.y).toBeCloseTo(8, 5);
    expect(bb.min.y).toBeCloseTo(0, 5);
    expect((bb.min.x + bb.max.x) / 2).toBeCloseTo(0, 5);
    expect((bb.min.z + bb.max.z) / 2).toBeCloseTo(0, 5);
  });
  it('decorKey', () => {
    expect(decorKey('sapin', 2)).toBe('sapin2');
  });
});
```

Run : `npx vitest run tests/render/assets.test.ts` → FAIL.

- [ ] **Step 3 : matériaux**

`src/render/materials.ts` :
```ts
import * as THREE from 'three';

let gradient: THREE.DataTexture | null = null;

/** Rampe partagée à 3 tons pour MeshToonMaterial (ombres en aplats). */
export function toonGradient(): THREE.DataTexture {
  if (!gradient) {
    gradient = new THREE.DataTexture(new Uint8Array([110, 190, 255]), 3, 1, THREE.RedFormat);
    gradient.minFilter = THREE.NearestFilter;
    gradient.magFilter = THREE.NearestFilter;
    gradient.generateMipmaps = false;
    gradient.needsUpdate = true;
  }
  return gradient;
}

export function toonMaterial(opts: { color?: THREE.ColorRepresentation; vertexColors?: boolean; map?: THREE.Texture | null } = {}): THREE.MeshToonMaterial {
  return new THREE.MeshToonMaterial({
    color: opts.color ?? 0xffffff,
    vertexColors: opts.vertexColors ?? false,
    map: opts.map ?? null,
    gradientMap: toonGradient(),
  });
}

/** Contour noir par coque inversée : les sommets sont poussés le long de la normale de `width` mètres. */
export function outlineMaterial(width: number, color: THREE.ColorRepresentation = 0x15131c): THREE.MeshBasicMaterial {
  const m = new THREE.MeshBasicMaterial({ color, side: THREE.BackSide });
  const uniform = { value: width };
  m.onBeforeCompile = (shader) => {
    shader.uniforms.outlineWidth = uniform;
    shader.vertexShader =
      'uniform float outlineWidth;\n' +
      shader.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n  transformed += normalize( normal ) * outlineWidth;');
  };
  m.customProgramCacheKey = () => 'outline';
  return m;
}

/** Copie de la géométrie avec des normales moyennées par position (contour continu aux arêtes vives). */
export function outlineGeometry(src: THREE.BufferGeometry): THREE.BufferGeometry {
  const pos = src.getAttribute('position') as THREE.BufferAttribute;
  const nor = src.getAttribute('normal') as THREE.BufferAttribute;
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', pos);
  if (src.index) geo.setIndex(src.index);
  const key = (i: number) => `${pos.getX(i).toFixed(3)},${pos.getY(i).toFixed(3)},${pos.getZ(i).toFixed(3)}`;
  const acc = new Map<string, [number, number, number]>();
  for (let i = 0; i < pos.count; i++) {
    const k = key(i);
    const a = acc.get(k) ?? [0, 0, 0];
    a[0] += nor.getX(i); a[1] += nor.getY(i); a[2] += nor.getZ(i);
    acc.set(k, a);
  }
  const out = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) {
    const a = acc.get(key(i))!;
    const l = Math.hypot(a[0], a[1], a[2]) || 1;
    out[i * 3] = a[0] / l; out[i * 3 + 1] = a[1] / l; out[i * 3 + 2] = a[2] / l;
  }
  geo.setAttribute('normal', new THREE.BufferAttribute(out, 3));
  geo.boundingSphere = src.boundingSphere;
  return geo;
}
```

- [ ] **Step 4 : géométries procédurales (roues, bornes, chevrons, glissières, pneus)**

`src/render/procedural.ts` :
```ts
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/** Rend la géométrie non indexée, sans UV, avec normales plates et une couleur unie par sommet. */
export function colorize(g: THREE.BufferGeometry, color: THREE.ColorRepresentation): THREE.BufferGeometry {
  const out = g.index ? g.toNonIndexed() : g;
  if (out.getAttribute('uv')) out.deleteAttribute('uv');
  out.computeVertexNormals();
  const c = new THREE.Color(color);
  const n = out.getAttribute('position').count;
  const arr = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { arr[i * 3] = c.r; arr[i * 3 + 1] = c.g; arr[i * 3 + 2] = c.b; }
  out.setAttribute('color', new THREE.BufferAttribute(arr, 3));
  return out;
}

export function coloredBox(w: number, h: number, d: number, x: number, y: number, z: number, color: THREE.ColorRepresentation): THREE.BufferGeometry {
  return colorize(new THREE.BoxGeometry(w, h, d).translate(x, y, z), color);
}

const merge = (parts: THREE.BufferGeometry[]): THREE.BufferGeometry => {
  const g = mergeGeometries(parts);
  if (!g) throw new Error('fusion de géométries impossible');
  return g;
};

/** Roue centrée sur l'origine, axe selon x : pneu, jante, moyeu et 3 rayons (6 branches) visibles en rotation. */
export function wheelGeometry(r: number, width: number): THREE.BufferGeometry {
  const cyl = (radius: number, len: number, seg: number, color: number) =>
    colorize(new THREE.CylinderGeometry(radius, radius, len, seg, 1).rotateZ(Math.PI / 2), color);
  const parts = [cyl(r, width, 14, 0x1d1d24), cyl(r * 0.62, width + 0.02, 10, 0xc9ced6), cyl(r * 0.2, width + 0.05, 6, 0x6b6f7a)];
  for (let k = 0; k < 3; k++) parts.push(coloredBox(width + 0.03, r * 1.12, 0.06, 0, 0, 0, 0x8a8f99).rotateX((k * Math.PI) / 3));
  return merge(parts);
}

/** Borne de bord de route : poteau blanc à bande rouge. */
export function borneGeometry(): THREE.BufferGeometry {
  return merge([
    coloredBox(0.18, 0.9, 0.18, 0, 0.45, 0, 0xf2f2ee),
    coloredBox(0.19, 0.12, 0.19, 0, 0.76, 0, 0xe63b2e),
  ]);
}

/** Panneau à chevrons : poteau + panneau à bandes rouge/blanc/rouge, face vers +z. */
export function chevronGeometry(): THREE.BufferGeometry {
  return merge([
    coloredBox(0.1, 1.3, 0.1, 0, 0.65, 0, 0x6b6f7a),
    coloredBox(0.27, 0.6, 0.06, -0.4, 1.45, 0.06, 0xe63b2e),
    coloredBox(0.26, 0.6, 0.06, 0, 1.45, 0.06, 0xf4f1e8),
    coloredBox(0.27, 0.6, 0.06, 0.4, 1.45, 0.06, 0xe63b2e),
  ]);
}

/** Glissière de sécurité, 1 m de long le long de +z (mise à l'échelle en z par tronçon). */
export function barrierGeometry(): THREE.BufferGeometry {
  return merge([
    coloredBox(0.12, 0.32, 1.0, 0, 0.6, 0, 0xc9ced6),
    coloredBox(0.12, 0.75, 0.12, 0, 0.375, 0, 0x5b606b),
  ]);
}

/** Trois roues couchées (axe vertical) empilées, base à y = 0. */
export function tireStack(wheel: THREE.BufferGeometry): THREE.BufferGeometry {
  const one = wheel.clone();
  one.rotateZ(Math.PI / 2);
  one.computeBoundingBox();
  const bb = one.boundingBox!;
  one.translate(-(bb.min.x + bb.max.x) / 2, -bb.min.y, -(bb.min.z + bb.max.z) / 2);
  const h = bb.max.y - bb.min.y;
  return merge([0, 1, 2].map((i) => one.clone().translate(0, i * h, 0)));
}
```

- [ ] **Step 5 : les voitures JDM**

Profil latéral dans le plan (z = avant, y = hauteur), extrudé le long de x. `ExtrudeGeometry` extrude selon +z ; après `rotateY(−π/2)`, le x du profil devient le z du monde et l'extrusion devient l'axe x.

`src/render/jdmCars.ts` :
```ts
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { CarId } from '../core/physics/types';
import { colorize, coloredBox, wheelGeometry } from './procedural';
import type { CarModel, WheelModel } from './assets';

/** Couleur « sentinelle » de la peinture, remplacée par la couleur choisie (paintGeometry). */
export const PAINT = new THREE.Color(1, 0, 1);
const GLASS = 0x28303f;
const TRIM = 0x1d1d24;
const LIGHT_FRONT = 0xfff4c2;
const LIGHT_REAR = 0xd9302a;
const POPUP = 0xdfe3ea;

/** Silhouette d'une voiture (m). z = 0 au centre de gravité, avant vers +z. */
export interface CarShape {
  length: number;
  width: number;
  groundClear: number;
  wheelR: number;
  frontAxle: number;
  rearAxle: number;
  noseY: number;
  hoodFrontY: number;
  cowlZ: number;
  cowlY: number;
  deckZ: number;
  deckY: number;
  tailY: number;
  roofFrontZ: number;
  roofRearZ: number;
  roofY: number;
  aileron: 'aucun' | 'petit' | 'grand';
  phares: 'escamotables' | 'fixes';
}

/** Longueurs et essieux alignés sur la physique (CARS : length, cgToFront, cgToFront − wheelbase). */
export const CAR_SHAPES: Record<CarId, CarShape> = {
  legere: {
    length: 4.1, width: 1.68, groundClear: 0.24, wheelR: 0.31, frontAxle: 1.15, rearAxle: -1.3,
    noseY: 0.4, hoodFrontY: 0.58, cowlZ: 0.62, cowlY: 0.76, deckZ: -1.85, deckY: 0.8, tailY: 0.78,
    roofFrontZ: 0.02, roofRearZ: -1.05, roofY: 1.24, aileron: 'aucun', phares: 'escamotables',
  },
  equilibree: {
    length: 4.4, width: 1.74, groundClear: 0.25, wheelR: 0.32, frontAxle: 1.25, rearAxle: -1.35,
    noseY: 0.42, hoodFrontY: 0.62, cowlZ: 0.72, cowlY: 0.8, deckZ: -1.45, deckY: 0.84, tailY: 0.8,
    roofFrontZ: 0.05, roofRearZ: -0.6, roofY: 1.22, aileron: 'petit', phares: 'fixes',
  },
  turbo: {
    length: 4.6, width: 1.82, groundClear: 0.24, wheelR: 0.34, frontAxle: 1.45, rearAxle: -1.35,
    noseY: 0.42, hoodFrontY: 0.64, cowlZ: 0.55, cowlY: 0.84, deckZ: -1.55, deckY: 0.88, tailY: 0.86,
    roofFrontZ: -0.12, roofRearZ: -0.75, roofY: 1.24, aileron: 'grand', phares: 'fixes',
  },
};

function arch(cz: number, y0: number, r: number, n = 6): [number, number][] {
  const pts: [number, number][] = [];
  for (let i = 0; i <= n; i++) {
    const a = Math.PI * (1 - i / n);
    pts.push([cz + r * Math.cos(a), y0 + r * Math.sin(a)]);
  }
  return pts;
}

/** Contour de la caisse : dessous (avec passages de roues), nez, capot, ligne de caisse, arrière. */
export function bodyProfile(s: CarShape): [number, number][] {
  const h = s.length / 2, y0 = s.groundClear, ar = s.wheelR + 0.09;
  return [
    [-h + 0.08, y0],
    ...arch(s.rearAxle, y0, ar),
    ...arch(s.frontAxle, y0, ar),
    [h - 0.08, y0 + 0.03],
    [h, s.noseY],
    [h - 0.03, s.hoodFrontY],
    [h - 0.25, s.hoodFrontY + 0.04],
    [s.cowlZ, s.cowlY],
    [s.deckZ, s.deckY],
    [-h + 0.15, s.deckY],
    [-h, s.tailY],
    [-h, y0 + 0.15],
  ];
}

/** Habitacle vitré : pare-brise, toit, lunette. */
export function cabinProfile(s: CarShape): [number, number][] {
  return [[s.cowlZ, s.cowlY], [s.roofFrontZ, s.roofY], [s.roofRearZ, s.roofY], [s.deckZ, s.deckY + 0.02]];
}

/** Extrude un profil (z, y) sur la largeur `width` (centrée sur x = 0), arêtes chanfreinées. */
export function extrudeProfile(points: [number, number][], width: number, color: THREE.ColorRepresentation, bevel = 0.04): THREE.BufferGeometry {
  const shape = new THREE.Shape(points.map(([z, y]) => new THREE.Vector2(z, y)));
  const depth = Math.max(0.01, width - 2 * bevel);
  const g = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 1, curveSegments: 1 });
  g.translate(0, 0, -depth / 2);
  g.rotateY(-Math.PI / 2);
  return colorize(g, color);
}

export function buildJdmCar(s: CarShape): CarModel {
  const w = s.width, h = s.length / 2, cw = w - 0.3;
  const both = (f: (side: number) => THREE.BufferGeometry) => [f(1), f(-1)];
  const parts: THREE.BufferGeometry[] = [
    extrudeProfile(bodyProfile(s), w, PAINT, 0.04),
    extrudeProfile(cabinProfile(s), cw, GLASS, 0.03),
    coloredBox(cw - 0.02, 0.05, s.roofFrontZ - s.roofRearZ + 0.08, 0, s.roofY + 0.03, (s.roofFrontZ + s.roofRearZ) / 2, PAINT),
    coloredBox(w - 0.1, 0.1, 0.14, 0, s.groundClear + 0.05, h - 0.02, TRIM),
    coloredBox(w - 0.1, 0.1, 0.14, 0, s.groundClear + 0.05, -h + 0.02, TRIM),
    coloredBox(0.7, 0.08, 0.04, 0, s.noseY + 0.02, h + 0.02, TRIM),
    ...both((side) => coloredBox(0.4, 0.1, 0.04, side * (w / 2 - 0.3), s.tailY - 0.14, -h - 0.02, LIGHT_REAR)),
    ...both((side) => coloredBox(0.12, 0.08, 0.14, side * (cw / 2 + 0.06), s.cowlY + 0.1, s.cowlZ - 0.2, PAINT)),
  ];
  if (s.phares === 'escamotables') {
    parts.push(...both((side) => coloredBox(0.36, 0.04, 0.22, side * (w / 2 - 0.32), s.hoodFrontY + 0.03, h - 0.3, POPUP)));
  } else {
    parts.push(...both((side) => coloredBox(0.34, 0.1, 0.04, side * (w / 2 - 0.3), s.noseY + 0.12, h + 0.02, LIGHT_FRONT)));
  }
  if (s.aileron === 'petit') parts.push(coloredBox(w - 0.3, 0.05, 0.2, 0, s.deckY + 0.04, -h + 0.22, PAINT));
  if (s.aileron === 'grand') {
    parts.push(
      ...both((side) => coloredBox(0.06, 0.3, 0.12, side * 0.55, s.deckY + 0.15, -h + 0.3, TRIM)),
      coloredBox(w - 0.1, 0.06, 0.4, 0, s.deckY + 0.32, -h + 0.28, PAINT),
      ...both((side) => coloredBox(0.04, 0.18, 0.42, side * (w / 2 - 0.05), s.deckY + 0.3, -h + 0.28, TRIM)),
    );
  }
  const body = mergeGeometries(parts);
  if (!body) throw new Error('carrosserie impossible à assembler');
  body.computeBoundingSphere();

  const wheel = wheelGeometry(s.wheelR, 0.24);
  const wx = w / 2 - 0.12;
  const wheels: WheelModel[] = [];
  for (const [z, front] of [[s.frontAxle, true], [s.rearAxle, false]] as const) {
    for (const side of [1, -1]) {
      wheels.push({ geometry: wheel, position: new THREE.Vector3(side * wx, s.wheelR, z), front, left: side > 0 });
    }
  }
  return { body, wheels, paint: PAINT.clone() };
}
```

- [ ] **Step 6 : chargement du décor et assemblage**

`src/render/assets.ts` :
```ts
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { CarId } from '../core/physics/types';
import type { DecorKind } from '../core/env/types';
import { CAR_IDS } from '../core/physics/cars';
import { borneGeometry, chevronGeometry, barrierGeometry, tireStack, wheelGeometry } from './procedural';
import { buildJdmCar, CAR_SHAPES } from './jdmCars';

export interface WheelModel { geometry: THREE.BufferGeometry; position: THREE.Vector3; front: boolean; left: boolean }
export interface CarModel { body: THREE.BufferGeometry; wheels: WheelModel[]; paint: THREE.Color }
export interface Assets { cars: Record<CarId, CarModel>; decor: Record<string, THREE.BufferGeometry> }

export const decorKey = (kind: DecorKind, variant: number): string => `${kind}${variant}`;

/** Modèles de décor Kenney : fichier, taille visée (m) et axe mesuré. */
export const DECOR_FILES: Record<string, { file: string; size: number; axis: 'x' | 'y' }> = {
  sapin0: { file: 'nature/tree_pineTallA.glb', size: 11, axis: 'y' },
  sapin1: { file: 'nature/tree_pineDefaultA.glb', size: 10, axis: 'y' },
  sapin2: { file: 'nature/tree_pineRoundA.glb', size: 9, axis: 'y' },
  feuillu0: { file: 'nature/tree_default.glb', size: 8, axis: 'y' },
  feuillu1: { file: 'nature/tree_oak.glb', size: 7.5, axis: 'y' },
  feuillu2: { file: 'nature/tree_fat.glb', size: 7, axis: 'y' },
  rocher0: { file: 'nature/rock_largeA.glb', size: 3.2, axis: 'x' },
  rocher1: { file: 'nature/rock_largeB.glb', size: 3.2, axis: 'x' },
  rocherHaut0: { file: 'nature/rock_tallA.glb', size: 3.5, axis: 'y' },
  panneau0: { file: 'nature/sign.glb', size: 1.8, axis: 'y' },
};

/** Géométrie non indexée (position, normal, color) transformée par `matrix` ; couleur = couleur du matériau. */
export function bakeMesh(mesh: THREE.Mesh, matrix: THREE.Matrix4): THREE.BufferGeometry {
  let geo = mesh.geometry.clone();
  if (geo.index) geo = geo.toNonIndexed();
  geo.applyMatrix4(matrix);
  if (!geo.getAttribute('normal')) geo.computeVertexNormals();
  const mat = (Array.isArray(mesh.material) ? mesh.material[0] : mesh.material) as THREE.MeshStandardMaterial;
  const pos = geo.getAttribute('position');
  const colors = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) {
    colors[i * 3] = mat.color.r; colors[i * 3 + 1] = mat.color.g; colors[i * 3 + 2] = mat.color.b;
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', pos);
  out.setAttribute('normal', geo.getAttribute('normal'));
  out.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  return out;
}

export function normalizeGeometry(geo: THREE.BufferGeometry, size: number, axis: 'x' | 'y'): THREE.BufferGeometry {
  geo.computeBoundingBox();
  const bb = geo.boundingBox!;
  const extent = axis === 'y' ? bb.max.y - bb.min.y : bb.max.x - bb.min.x;
  const s = size / Math.max(1e-6, extent);
  geo.translate(-(bb.min.x + bb.max.x) / 2, -bb.min.y, -(bb.min.z + bb.max.z) / 2);
  geo.scale(s, s, s);
  geo.computeBoundingBox();
  geo.computeBoundingSphere();
  return geo;
}

/** Copie de la carrosserie où la couleur `paint` est remplacée par `color`. */
export function paintGeometry(src: THREE.BufferGeometry, paint: THREE.Color, color: THREE.Color): THREE.BufferGeometry {
  const geo = src.clone();
  const col = geo.getAttribute('color') as THREE.BufferAttribute;
  for (let i = 0; i < col.count; i++) {
    const dr = col.getX(i) - paint.r, dg = col.getY(i) - paint.g, db = col.getZ(i) - paint.b;
    if (dr * dr + dg * dg + db * db < 0.0009) col.setXYZ(i, color.r, color.g, color.b);
  }
  col.needsUpdate = true;
  return geo;
}

function bakeScene(scene: THREE.Object3D): THREE.BufferGeometry {
  scene.updateMatrixWorld(true);
  const parts: THREE.BufferGeometry[] = [];
  scene.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (mesh.isMesh) parts.push(bakeMesh(mesh, mesh.matrixWorld));
  });
  const g = mergeGeometries(parts);
  if (!g) throw new Error('modèle vide');
  return g;
}

/** Construit les voitures et charge le décor. `baseUrl` se termine par « / » (ex. `${import.meta.env.BASE_URL}models/`). */
export async function loadAssets(baseUrl: string, onProgress?: (p: number) => void): Promise<Assets> {
  const loader = new GLTFLoader();
  const entries = Object.entries(DECOR_FILES);
  let done = 0;
  const decorList = await Promise.all(entries.map(async ([key, def]) => {
    const gltf = await loader.loadAsync(baseUrl + def.file);
    const geo = normalizeGeometry(bakeScene(gltf.scene), def.size, def.axis);
    onProgress?.(++done / entries.length);
    return [key, geo] as const;
  }));
  const decor: Record<string, THREE.BufferGeometry> = Object.fromEntries(decorList);
  decor.pneus0 = tireStack(wheelGeometry(0.375, 0.3));
  decor.chevron0 = chevronGeometry();
  decor.borne0 = borneGeometry();
  decor.barriere = barrierGeometry();
  for (const g of Object.values(decor)) g.computeBoundingSphere();
  const cars = Object.fromEntries(CAR_IDS.map((id) => [id, buildJdmCar(CAR_SHAPES[id])])) as Record<CarId, CarModel>;
  return { cars, decor };
}
```

- [ ] **Step 7 : vérifier** — `npx vitest run tests/render/assets.test.ts` → PASS ; `npx tsc --noEmit` → OK. (L'allure des voitures sera vérifiée dans le navigateur par le contrôleur après la Tâche 19 ; il pourra retoucher `CAR_SHAPES`.)

- [ ] **Step 8 : commit**

```bash
git add public/models src/render/materials.ts src/render/procedural.ts src/render/jdmCars.ts src/render/assets.ts tests/render/assets.test.ts
git commit -m "Voitures JDM générées par code, décor Kenney, matériaux toon avec contours"
```

---

## Tâche 14 : Rendu du monde : palettes, ciel, route, terrain, montagnes

**Files :**
- Create : `src/render/palettes.ts`, `src/render/sky.ts`, `src/render/road.ts`, `src/render/terrainMesh.ts`, `src/render/quality.ts`
- Test : `tests/render/world-geometry.test.ts`

**Interfaces :**
- Consumes : `Ambiance`, `Level` (T3), `TrackData`, `nearestSampleWithin` (T4), `Terrain` (T5), `forestThreshold`, `forestMask` (T6), `toonMaterial`, `coloredBox` (T13), `fbm`, `mulberry32`, `smoothstep` (T2), `Qualite` (T11).
- Produces :
  - `interface Palette { skyTop; skyBottom; fog; sun; sunIntensity; sunDir: [number, number, number]; hemiSky; hemiGround; hemiIntensity; grassA; grassB; forestFloor; rock; asphalt; line }` (couleurs en hexadécimal sRGB), `PALETTES: Record<Ambiance, Palette>`
  - `type QualityLevel = 'basse' | 'haute'`, `interface QualitySettings { maxPixelRatio; shadows; fogFar; smokeMax; skidMax }`, `QUALITY: Record<QualityLevel, QualitySettings>`, `class QualityManager { level: QualityLevel; constructor(mode: Qualite, touch: boolean); sample(dt: number): boolean }`
  - `createSky(p: Palette): THREE.Mesh`
  - `interface RoadTextures { road: THREE.Texture; curb: THREE.Texture; checker: THREE.Texture }`, `createRoadTextures(p: Palette, anisotropy: number): RoadTextures` (DOM), `buildRoad(track: TrackData, p: Palette, tex: RoadTextures): THREE.Group` (surface, accotements, vibreurs, lignes de départ/arrivée, arche d'arrivée)
  - `chunkStep(dmin: number, q: QualityLevel): number`, `buildTerrain(level: Level, track: TrackData, terrain: Terrain, p: Palette, q: QualityLevel): THREE.Group` (chaque morceau a `userData.center: THREE.Vector3`), `buildMountains(track: TrackData, p: Palette, seed: number): THREE.Mesh`

- [ ] **Step 1 : écrire les tests**

`tests/render/world-geometry.test.ts` :
```ts
import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { PALETTES } from '../../src/render/palettes';
import { QualityManager, QUALITY } from '../../src/render/quality';
import { createSky } from '../../src/render/sky';
import { buildRoad } from '../../src/render/road';
import { buildTerrain, buildMountains, chunkStep } from '../../src/render/terrainMesh';
import { buildTrack } from '../../src/core/track/buildTrack';
import { Terrain } from '../../src/core/track/terrain';
import { straightLevel, hairpinLevel } from '../fixtures/levels';

const fakeTex = () => ({ road: new THREE.Texture(), curb: new THREE.Texture(), checker: new THREE.Texture() });
const allFinite = (o: THREE.Object3D) => {
  let ok = true;
  o.traverse((c) => {
    const m = c as THREE.Mesh;
    if (m.isMesh) ok = ok && Array.from(m.geometry.getAttribute('position').array as Float32Array).every(Number.isFinite);
  });
  return ok;
};

describe('palettes et qualité', () => {
  it('deux ambiances complètes', () => {
    expect(Object.keys(PALETTES.jour).sort()).toEqual(Object.keys(PALETTES.coucher).sort());
  });
  it('qualité auto : Haute sur PC, Basse au tactile, passe en Basse sous 50 i/s pendant 3 s', () => {
    expect(new QualityManager('auto', true).level).toBe('basse');
    const q = new QualityManager('auto', false);
    expect(q.level).toBe('haute');
    let changed = false;
    for (let i = 0; i < 40 * 2.9; i++) changed = q.sample(1 / 40) || changed;
    expect(changed).toBe(false);
    for (let i = 0; i < 40 * 0.7; i++) changed = q.sample(1 / 40) || changed;
    expect(changed).toBe(true);
    expect(q.level).toBe('basse');
  });
  it('qualité fixe : jamais de changement ; 60 i/s : pas de baisse', () => {
    const fixed = new QualityManager('haute', false);
    for (let i = 0; i < 400; i++) expect(fixed.sample(1 / 20)).toBe(false);
    const good = new QualityManager('auto', false);
    for (let i = 0; i < 600; i++) good.sample(1 / 60);
    expect(good.level).toBe('haute');
    expect(QUALITY.basse.shadows).toBe(false);
  });
});

describe('géométrie du monde', () => {
  const track = buildTrack(hairpinLevel());
  it('ciel', () => {
    const sky = createSky(PALETTES.jour);
    expect(sky.material).toBeInstanceOf(THREE.ShaderMaterial);
  });
  it('route : 2 sommets par échantillon, normales vers le haut, vibreurs', () => {
    const g = buildRoad(track, PALETTES.jour, fakeTex());
    const surface = g.getObjectByName('surface') as THREE.Mesh;
    expect(surface.geometry.getAttribute('position').count).toBe(track.samples.length * 2);
    const n = surface.geometry.getAttribute('normal');
    for (let i = 0; i < n.count; i += 37) expect(n.getY(i)).toBeGreaterThan(0.9);
    expect(g.getObjectByName('vibreurs')).toBeDefined();
    expect(g.getObjectByName('arche')).toBeDefined();
    expect(allFinite(g)).toBe(true);
  });
  it('pas du terrain selon la distance et la qualité', () => {
    expect(chunkStep(0, 'haute')).toBe(2);
    expect(chunkStep(100, 'haute')).toBe(4);
    expect(chunkStep(300, 'haute')).toBe(8);
    expect(chunkStep(0, 'basse')).toBe(4);
  });
  it('terrain en morceaux, positions finies, centres renseignés', () => {
    const lv = straightLevel(200);
    const t = buildTrack(lv);
    const terrain = new Terrain(t, lv.decor.graine);
    const g = buildTerrain(lv, t, terrain, PALETTES.jour, 'basse');
    expect(g.children.length).toBeGreaterThan(4);
    for (const c of g.children) expect(c.userData.center).toBeInstanceOf(THREE.Vector3);
    expect(allFinite(g)).toBe(true);
    const m = buildMountains(t, PALETTES.coucher, 3);
    expect(allFinite(m)).toBe(true);
  });
});
```

Run : `npx vitest run tests/render/world-geometry.test.ts` → FAIL.

- [ ] **Step 2 : palettes, qualité, ciel**

`src/render/palettes.ts` :
```ts
import type { Ambiance } from '../core/level/types';

export interface Palette {
  skyTop: number; skyBottom: number; fog: number;
  sun: number; sunIntensity: number; sunDir: [number, number, number];
  hemiSky: number; hemiGround: number; hemiIntensity: number;
  grassA: number; grassB: number; forestFloor: number; rock: number;
  asphalt: number; line: number;
}

export const PALETTES: Record<Ambiance, Palette> = {
  jour: {
    skyTop: 0x5ea8e8, skyBottom: 0xcfe8f7, fog: 0xcfe8f7,
    sun: 0xfff4e0, sunIntensity: 2.2, sunDir: [0.5, 0.8, 0.3],
    hemiSky: 0xbfdcf5, hemiGround: 0x5f7a3a, hemiIntensity: 1.1,
    grassA: 0x7cc152, grassB: 0x5fa843, forestFloor: 0x4f8a3c, rock: 0x9a938a,
    asphalt: 0x4a4d57, line: 0xf4f1e8,
  },
  coucher: {
    skyTop: 0x3d4f8f, skyBottom: 0xffb37a, fog: 0xf2a877,
    sun: 0xffc38a, sunIntensity: 2.0, sunDir: [-0.6, 0.35, 0.5],
    hemiSky: 0xffc9a0, hemiGround: 0x4a3f5c, hemiIntensity: 0.9,
    grassA: 0x8fae4a, grassB: 0x6f9440, forestFloor: 0x55723a, rock: 0xa08a80,
    asphalt: 0x4d4a58, line: 0xf7e9d8,
  },
};
```

`src/render/quality.ts` :
```ts
import type { Qualite } from '../storage/store';

export type QualityLevel = 'basse' | 'haute';

export interface QualitySettings {
  maxPixelRatio: number;
  shadows: boolean;
  fogFar: number;
  smokeMax: number;
  skidMax: number;
}

export const QUALITY: Record<QualityLevel, QualitySettings> = {
  basse: { maxPixelRatio: 1, shadows: false, fogFar: 180, smokeMax: 60, skidMax: 250 },
  haute: { maxPixelRatio: 2, shadows: true, fogFar: 350, smokeMax: 150, skidMax: 600 },
};

/** Qualité « auto » : Haute sur PC, Basse au tactile ; passe en Basse si < 50 i/s pendant 3 s. */
export class QualityManager {
  level: QualityLevel;
  private window = 0;
  private frames = 0;
  private lowTime = 0;

  constructor(private readonly mode: Qualite, touch: boolean) {
    this.level = mode === 'auto' ? (touch ? 'basse' : 'haute') : mode;
  }

  /** À appeler à chaque image pendant la course ; renvoie true si le niveau vient de changer. */
  sample(dt: number): boolean {
    if (this.mode !== 'auto' || this.level === 'basse') return false;
    this.window += dt;
    this.frames++;
    if (this.window < 0.5) return false;
    const fps = this.frames / this.window;
    this.lowTime = fps < 50 ? this.lowTime + this.window : 0;
    this.window = 0;
    this.frames = 0;
    if (this.lowTime >= 3 - 1e-9) {
      this.level = 'basse';
      return true;
    }
    return false;
  }
}
```

`src/render/sky.ts` :
```ts
import * as THREE from 'three';
import type { Palette } from './palettes';

/** Dôme de ciel en dégradé ; à recentrer sur la caméra à chaque image. */
export function createSky(p: Palette): THREE.Mesh {
  const mat = new THREE.ShaderMaterial({
    uniforms: {
      top: { value: new THREE.Color(p.skyTop) },
      bottom: { value: new THREE.Color(p.skyBottom) },
    },
    vertexShader: /* glsl */ `
      varying vec3 vDir;
      void main() {
        vDir = normalize(position);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 top;
      uniform vec3 bottom;
      varying vec3 vDir;
      void main() {
        float h = smoothstep(-0.05, 0.5, vDir.y);
        gl_FragColor = vec4(mix(bottom, top, h), 1.0);
        #include <colorspace_fragment>
      }`,
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
  });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(1500, 32, 16), mat);
  mesh.frustumCulled = false;
  mesh.renderOrder = -1;
  return mesh;
}
```

- [ ] **Step 3 : la route**

Bandes de triangles : pour deux rangées de points A (à gauche) et B (à droite), triangles `(A_i, B_i, A_{i+1})` et `(B_i, B_{i+1}, A_{i+1})` → normales vers le haut.

`src/render/road.ts` :
```ts
import * as THREE from 'three';
import type { TrackData, TrackSample } from '../core/track/buildTrack';
import { mulberry32 } from '../core/math/rng';
import { toonMaterial } from './materials';
import { coloredBox } from './procedural';
import type { Palette } from './palettes';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

export interface RoadTextures { road: THREE.Texture; curb: THREE.Texture; checker: THREE.Texture }

const hex = (c: number) => '#' + c.toString(16).padStart(6, '0');

function canvasTexture(w: number, h: number, draw: (ctx: CanvasRenderingContext2D) => void): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('canvas 2D indisponible');
  draw(ctx);
  const t = new THREE.CanvasTexture(canvas);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** Textures dessinées au chargement (DOM). */
export function createRoadTextures(p: Palette, anisotropy: number): RoadTextures {
  const road = canvasTexture(128, 256, (ctx) => {
    ctx.fillStyle = hex(p.asphalt);
    ctx.fillRect(0, 0, 128, 256);
    const rng = mulberry32(7);
    for (let i = 0; i < 900; i++) {
      ctx.fillStyle = rng() < 0.5 ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.05)';
      ctx.fillRect(Math.floor(rng() * 128), Math.floor(rng() * 256), 2, 2);
    }
    ctx.fillStyle = hex(p.line);
    ctx.fillRect(5, 0, 3, 256);
    ctx.fillRect(120, 0, 3, 256);
    ctx.fillRect(62, 0, 4, 85); // tiret central : 3 m sur 9
  });
  road.wrapS = THREE.ClampToEdgeWrapping;
  road.wrapT = THREE.RepeatWrapping;
  road.anisotropy = anisotropy;

  const curb = canvasTexture(4, 2, (ctx) => {
    ctx.fillStyle = '#e63b2e'; ctx.fillRect(0, 0, 4, 1);
    ctx.fillStyle = '#f4f1e8'; ctx.fillRect(0, 1, 4, 1);
  });
  curb.magFilter = THREE.NearestFilter;
  curb.wrapT = THREE.RepeatWrapping;

  const checker = canvasTexture(2, 2, (ctx) => {
    ctx.fillStyle = '#f4f1e8'; ctx.fillRect(0, 0, 2, 2);
    ctx.fillStyle = '#1b1f2e'; ctx.fillRect(0, 0, 1, 1); ctx.fillRect(1, 1, 1, 1);
  });
  checker.magFilter = THREE.NearestFilter;
  checker.wrapS = THREE.RepeatWrapping;
  checker.wrapT = THREE.RepeatWrapping;
  return { road, curb, checker };
}

type V3 = [number, number, number];

/** Bande de triangles entre deux rangées A (gauche) et B (droite). */
function strip(a: V3[], b: V3[], uvA?: [number, number][], uvB?: [number, number][], color?: THREE.Color): THREE.BufferGeometry {
  const n = a.length;
  const pos = new Float32Array(n * 2 * 3);
  for (let i = 0; i < n; i++) { pos.set(a[i], i * 6); pos.set(b[i], i * 6 + 3); }
  const idx: number[] = [];
  for (let i = 0; i < n - 1; i++) {
    const A = i * 2, B = i * 2 + 1, A1 = A + 2, B1 = B + 2;
    idx.push(A, B, A1, B, B1, A1);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  if (uvA && uvB) {
    const uv = new Float32Array(n * 2 * 2);
    for (let i = 0; i < n; i++) { uv.set(uvA[i], i * 4); uv.set(uvB[i], i * 4 + 2); }
    g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  }
  if (color) {
    const col = new Float32Array(n * 2 * 3);
    for (let i = 0; i < n * 2; i++) { col[i * 3] = color.r; col[i * 3 + 1] = color.g; col[i * 3 + 2] = color.b; }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  }
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

const off = (sp: TrackSample, lat: number, dy: number): V3 => [sp.x + sp.nx * lat, sp.y + dy, sp.z + sp.nz * lat];

export function buildRoad(track: TrackData, p: Palette, tex: RoadTextures): THREE.Group {
  const S = track.samples;
  const group = new THREE.Group();

  // Surface texturée
  const surface = new THREE.Mesh(
    strip(S.map((s) => off(s, s.w, 0.02)), S.map((s) => off(s, -s.w, 0.02)), S.map((s) => [0, s.s / 9]), S.map((s) => [1, s.s / 9])),
    toonMaterial({ map: tex.road }),
  );
  surface.name = 'surface';
  surface.receiveShadow = true;
  group.add(surface);

  // Accotements sombres qui descendent sous le terrain
  const dark = new THREE.Color(p.asphalt).multiplyScalar(0.7);
  const shoulders = mergeGeometries([
    strip(S.map((s) => off(s, s.w + 0.7, -0.25)), S.map((s) => off(s, s.w, 0.02)), undefined, undefined, dark),
    strip(S.map((s) => off(s, -s.w, 0.02)), S.map((s) => off(s, -s.w - 0.7, -0.25)), undefined, undefined, dark),
  ]);
  if (shoulders) {
    const m = new THREE.Mesh(shoulders, toonMaterial({ vertexColors: true }));
    m.name = 'accotements';
    m.receiveShadow = true;
    group.add(m);
  }

  // Vibreurs
  const curbParts: THREE.BufferGeometry[] = [];
  for (const c of track.curbs) {
    const seg = S.slice(c.from, c.to + 1);
    if (seg.length < 2) continue;
    curbParts.push(strip(seg.map((s) => off(s, s.w + 0.9, 0.05)), seg.map((s) => off(s, s.w, 0.05)), seg.map((s) => [0, s.s / 2]), seg.map((s) => [1, s.s / 2])));
    curbParts.push(strip(seg.map((s) => off(s, -s.w, 0.05)), seg.map((s) => off(s, -s.w - 0.9, 0.05)), seg.map((s) => [0, s.s / 2]), seg.map((s) => [1, s.s / 2])));
  }
  const curbs = new THREE.Mesh(curbParts.length ? mergeGeometries(curbParts)! : new THREE.BufferGeometry(), toonMaterial({ map: tex.curb }));
  curbs.name = 'vibreurs';
  group.add(curbs);

  // Lignes de départ (s = 3 m) et d'arrivée (s = longueur − 1,5 m) en damier
  const lineAt = (s: number): THREE.Mesh => {
    const i = Math.min(S.length - 2, Math.max(0, Math.round(s)));
    const a = S[i], b = S[i + 1];
    const reps = (2 * a.w) / 1.5;
    const m = new THREE.Mesh(
      strip([off(a, a.w, 0.03), off(b, b.w, 0.03)], [off(a, -a.w, 0.03), off(b, -b.w, 0.03)], [[0, 0], [0, 1]], [[reps, 0], [reps, 1]]),
      toonMaterial({ map: tex.checker }),
    );
    return m;
  };
  group.add(lineAt(3), lineAt(track.length - 1.5));

  // Arche d'arrivée
  const f = S[Math.max(0, S.length - 2)];
  const half = f.w + 1.2;
  const arch = new THREE.Mesh(
    mergeGeometries([
      coloredBox(0.4, 5.5, 0.4, half, 2.75, 0, 0x2b2d42),
      coloredBox(0.4, 5.5, 0.4, -half, 2.75, 0, 0x2b2d42),
      coloredBox(2 * half + 0.4, 1.0, 0.3, 0, 5.0, 0, 0xe63b2e),
    ])!,
    toonMaterial({ vertexColors: true }),
  );
  arch.name = 'arche';
  arch.position.set(f.x, f.y, f.z);
  arch.rotation.y = Math.atan2(f.tx, f.tz);
  arch.castShadow = true;
  group.add(arch);
  return group;
}
```

Note : dans `coloredBox`, l'axe x de l'arche est l'axe latéral local ; avec `rotation.y = ψ`, x local = gauche du sens de course : les poteaux sont bien de part et d'autre de la route.

- [ ] **Step 4 : terrain et montagnes**

`src/render/terrainMesh.ts` :
```ts
import * as THREE from 'three';
import type { Level } from '../core/level/types';
import type { TrackData } from '../core/track/buildTrack';
import type { Terrain } from '../core/track/terrain';
import { nearestSampleWithin } from '../core/track/projection';
import { forestMask, forestThreshold } from '../core/env/generate';
import { fbm } from '../core/math/noise';
import { mulberry32 } from '../core/math/rng';
import { smoothstep } from '../core/math/vec';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { toonMaterial } from './materials';
import type { Palette } from './palettes';
import type { QualityLevel } from './quality';

const CHUNK = 128;
const SKIRT = 4;

/** Pas de maille (m) d'un morceau selon sa distance minimale à la route. */
export function chunkStep(dmin: number, q: QualityLevel): number {
  const base = dmin < 40 ? 2 : dmin < 150 ? 4 : 8;
  return q === 'haute' ? base : base * 2;
}

export function buildTerrain(level: Level, track: TrackData, terrain: Terrain, p: Palette, q: QualityLevel): THREE.Group {
  const group = new THREE.Group();
  group.name = 'terrain';
  const mat = toonMaterial({ vertexColors: true });
  mat.side = THREE.DoubleSide;
  const seed = level.decor.graine;
  const thr = forestThreshold(level.decor.densite);
  const cA = new THREE.Color(p.grassA), cB = new THREE.Color(p.grassB), cF = new THREE.Color(p.forestFloor);
  const cR = new THREE.Color(p.rock), cS = new THREE.Color(p.asphalt).multiplyScalar(0.7);
  const c = new THREE.Color();

  for (let z0 = terrain.minZ; z0 < terrain.maxZ; z0 += CHUNK) {
    for (let x0 = terrain.minX; x0 < terrain.maxX; x0 += CHUNK) {
      const dmin = Math.max(0, terrain.distanceToRoad(x0 + CHUNK / 2, z0 + CHUNK / 2) - CHUNK * 0.71);
      const step = chunkStep(dmin, q);
      const n = Math.round(CHUNK / step);
      const N = n + 1;
      const heights = new Float32Array(N * N);
      const roadDist = new Float32Array(N * N).fill(1e9);
      const roadW = new Float32Array(N * N);
      for (let j = 0; j < N; j++) {
        for (let i = 0; i < N; i++) {
          const x = x0 + i * step, z = z0 + j * step;
          const k = j * N + i;
          let h = terrain.heightAt(x, z);
          const near = nearestSampleWithin(track, x, z, 14);
          if (near) {
            const w = track.samples[near.index].w;
            roadDist[k] = near.dist;
            roadW[k] = w;
            h -= 0.15 * (1 - smoothstep(w + 0.5, w + 2, near.dist));
          }
          heights[k] = h;
        }
      }
      const vCount = N * N + 4 * N * 2;
      const pos = new Float32Array(vCount * 3);
      const col = new Float32Array(vCount * 3);
      for (let j = 0; j < N; j++) {
        for (let i = 0; i < N; i++) {
          const k = j * N + i;
          const x = x0 + i * step, z = z0 + j * step;
          pos[k * 3] = x; pos[k * 3 + 1] = heights[k]; pos[k * 3 + 2] = z;
          const hx = heights[j * N + Math.min(n, i + 1)] - heights[j * N + Math.max(0, i - 1)];
          const hz = heights[Math.min(n, j + 1) * N + i] - heights[Math.max(0, j - 1) * N + i];
          const slope = Math.max(Math.abs(hx), Math.abs(hz)) / (2 * step);
          c.copy(cA).lerp(cB, fbm(x / 30, z / 30, seed + 5));
          c.lerp(cF, smoothstep(thr, thr + 0.08, forestMask(x, z, seed)) * 0.85);
          c.lerp(cR, smoothstep(0.6, 1.0, slope));
          if (roadDist[k] < 1e8) c.lerp(cS, 1 - smoothstep(roadW[k] + 0.5, roadW[k] + 1.5, roadDist[k]));
          col[k * 3] = c.r; col[k * 3 + 1] = c.g; col[k * 3 + 2] = c.b;
        }
      }
      const idx: number[] = [];
      for (let j = 0; j < n; j++) {
        for (let i = 0; i < n; i++) {
          const a = j * N + i, b = a + 1, cc = a + N, d = cc + 1;
          idx.push(a, cc, b, b, cc, d);
        }
      }
      // Jupes (bords qui descendent de 4 m) : cachent les fentes entre morceaux de mailles différentes
      let v = N * N;
      const edges: number[][] = [
        Array.from({ length: N }, (_, i) => i),
        Array.from({ length: N }, (_, i) => n * N + i),
        Array.from({ length: N }, (_, j) => j * N),
        Array.from({ length: N }, (_, j) => j * N + n),
      ];
      for (const e of edges) {
        const top0 = v;
        for (const k of e) {
          pos.set([pos[k * 3], pos[k * 3 + 1], pos[k * 3 + 2]], v * 3);
          col.set([col[k * 3], col[k * 3 + 1], col[k * 3 + 2]], v * 3);
          pos.set([pos[k * 3], pos[k * 3 + 1] - SKIRT, pos[k * 3 + 2]], (v + N) * 3);
          col.set([col[k * 3], col[k * 3 + 1], col[k * 3 + 2]], (v + N) * 3);
          v++;
        }
        for (let t = 0; t < N - 1; t++) {
          const a = top0 + t, b = top0 + t + 1, a2 = a + N, b2 = b + N;
          idx.push(a, a2, b, b, a2, b2);
        }
        v += N;
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
      geo.setIndex(idx);
      geo.computeVertexNormals();
      geo.computeBoundingSphere();
      const mesh = new THREE.Mesh(geo, mat);
      mesh.receiveShadow = true;
      mesh.userData.center = new THREE.Vector3(x0 + CHUNK / 2, 0, z0 + CHUNK / 2);
      group.add(mesh);
    }
  }
  return group;
}

/** Anneau de montagnes lointaines (sans brouillard, couleurs déjà « noyées » dans la brume). */
export function buildMountains(track: TrackData, p: Palette, seed: number): THREE.Mesh {
  const b = track.bounds;
  const cx = (b.minX + b.maxX) / 2, cz = (b.minZ + b.maxZ) / 2;
  const R = Math.max(b.maxX - b.minX, b.maxZ - b.minZ) / 2 + 700;
  const lowest = track.samples.reduce((m, s) => Math.min(m, s.y), Infinity);
  const rng = mulberry32(seed + 3);
  const fog = new THREE.Color(p.fog);
  const rock = new THREE.Color(p.rock).lerp(fog, 0.55);
  const snow = new THREE.Color(0xf4f6fa).lerp(fog, 0.35);
  const parts: THREE.BufferGeometry[] = [];
  for (let i = 0; i < 40; i++) {
    const a = (i / 40) * Math.PI * 2 + rng() * 0.1;
    const r = R + rng() * 250;
    const h = 180 + rng() * 260;
    const rad = 160 + rng() * 140;
    const g = new THREE.ConeGeometry(rad, h, 6 + Math.floor(rng() * 3), 1).toNonIndexed();
    g.deleteAttribute('uv');
    const base = lowest - 30;
    g.translate(cx + Math.sin(a) * r, base + h / 2, cz + Math.cos(a) * r);
    const pos = g.getAttribute('position');
    const col = new Float32Array(pos.count * 3);
    for (let k = 0; k < pos.count; k++) {
      const cc = pos.getY(k) > base + h * 0.72 ? snow : rock;
      col[k * 3] = cc.r; col[k * 3 + 1] = cc.g; col[k * 3 + 2] = cc.b;
    }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    parts.push(g);
  }
  const mat = toonMaterial({ vertexColors: true });
  mat.fog = false;
  mat.flatShading = true;
  const mesh = new THREE.Mesh(mergeGeometries(parts)!, mat);
  mesh.name = 'montagnes';
  return mesh;
}
```

- [ ] **Step 5 : vérifier** — `npx vitest run tests/render/world-geometry.test.ts` → PASS ; `npx tsc --noEmit` → OK.

- [ ] **Step 6 : commit**

```bash
git add src/render/palettes.ts src/render/quality.ts src/render/sky.ts src/render/road.ts src/render/terrainMesh.ts tests/render/world-geometry.test.ts
git commit -m "Rendu : ambiances, ciel, route texturée avec vibreurs et arche, terrain en morceaux, montagnes"
```

---

## Tâche 15 : Décor instancié, voiture, fumée et traces

**Files :**
- Create : `src/render/decor.ts`, `src/render/carView.ts`, `src/render/effects.ts`
- Test : `tests/render/objects.test.ts`

**Interfaces :**
- Consumes : `Environment`, `EnvItem` (T6), `Assets`, `CarModel`, `decorKey`, `paintGeometry` (T13), `toonMaterial`, `outlineMaterial`, `outlineGeometry` (T13), `QualityLevel` (T14), `mulberry32`, `Rng` (T2).
- Produces :
  - `buildDecor(env: Environment, assets: Assets, q: QualityLevel, shadows: boolean): THREE.Group`
  - `interface CarPose { x; y; z; heading; steer; wheelSpin; groundPitch; groundRoll; pitch; roll }`
  - `class CarView { readonly root: THREE.Group; constructor(model: CarModel, color: string, shadows: boolean); setColor(color: string): void; update(p: CarPose): void; rearWheels(out: THREE.Vector3[]): void; dispose(): void }`
  - `interface Particle { x; y; z; vx; vy; vz; age; life; size }`, `class ParticlePool { readonly items: Particle[]; constructor(capacity: number, seed?: number); emit(x, y, z, vx, vz): void; update(dt): void; static scaleOf(p: Particle): number; alive(): number }`
  - `class SmokeSystem { readonly mesh: THREE.InstancedMesh; constructor(capacity: number, color: THREE.ColorRepresentation); emit(points: THREE.Vector3[], rate: number, dt: number, vx: number, vz: number): void; update(dt: number): void; dispose(): void }`
  - `class SkidTrail { readonly capacity: number; readonly data: Float32Array; count: number; constructor(capacity: number, width?: number); add(wheel: number, x, y, z, active: boolean): number; reset(): void }` (renvoie l'indice du quadrilatère écrit, ou −1)
  - `class SkidMarks { readonly mesh: THREE.Mesh; constructor(capacity: number); add(wheel: number, p: THREE.Vector3, active: boolean): void; reset(): void; dispose(): void }`

- [ ] **Step 1 : écrire les tests**

`tests/render/objects.test.ts` :
```ts
import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { ParticlePool, SkidTrail } from '../../src/render/effects';
import { buildDecor } from '../../src/render/decor';
import { CarView } from '../../src/render/carView';
import { coloredBox } from '../../src/render/procedural';
import type { Assets, CarModel } from '../../src/render/assets';
import type { Environment } from '../../src/core/env/types';

const box = () => coloredBox(1, 1, 1, 0, 0.5, 0, 0x33aa33);
const carModel = (): CarModel => ({
  body: coloredBox(1.8, 1, 4, 0, 0.8, 0, 0xff0000),
  wheels: [
    { geometry: coloredBox(0.3, 0.7, 0.7, 0, 0, 0, 0x111111), position: new THREE.Vector3(0.8, 0.35, 1.3), front: true, left: true },
    { geometry: coloredBox(0.3, 0.7, 0.7, 0, 0, 0, 0x111111), position: new THREE.Vector3(-0.8, 0.35, 1.3), front: true, left: false },
    { geometry: coloredBox(0.3, 0.7, 0.7, 0, 0, 0, 0x111111), position: new THREE.Vector3(0.8, 0.35, -1.3), front: false, left: true },
    { geometry: coloredBox(0.3, 0.7, 0.7, 0, 0, 0, 0x111111), position: new THREE.Vector3(-0.8, 0.35, -1.3), front: false, left: false },
  ],
  paint: new THREE.Color(0xff0000),
});
const fakeAssets = (): Assets => ({
  cars: { equilibree: carModel(), legere: carModel(), turbo: carModel() },
  decor: { sapin0: box(), sapin1: box(), sapin2: box(), feuillu0: box(), feuillu1: box(), feuillu2: box(), rocher0: box(), rocher1: box(), rocherHaut0: box(), panneau0: box(), pneus0: box(), chevron0: box(), borne0: box(), barriere: box() },
});

describe('ParticlePool', () => {
  it('émet, vieillit puis disparaît', () => {
    const pool = new ParticlePool(4, 1);
    pool.emit(0, 0, 0, 10, 0);
    expect(pool.alive()).toBe(1);
    pool.update(0.2);
    expect(ParticlePool.scaleOf(pool.items[0])).toBeGreaterThan(0);
    for (let i = 0; i < 100; i++) pool.update(0.05);
    expect(pool.alive()).toBe(0);
    expect(ParticlePool.scaleOf(pool.items[0])).toBe(0);
  });
  it('anneau de capacité fixe', () => {
    const pool = new ParticlePool(3, 1);
    for (let i = 0; i < 10; i++) pool.emit(i, 0, 0, 0, 0);
    expect(pool.items.length).toBe(3);
    expect(pool.alive()).toBe(3);
  });
});

describe('SkidTrail', () => {
  it('trace des quadrilatères quand la roue glisse et se déplace', () => {
    const t = new SkidTrail(3, 0.28);
    expect(t.add(0, 0, 0, 0, true)).toBe(-1);
    expect(t.add(0, 0, 0, 1, true)).toBe(0);
    const d = t.data;
    expect(Math.hypot(d[0] - d[3], d[2] - d[5])).toBeCloseTo(0.28, 5);
    expect(t.add(0, 0, 0, 1.1, true)).toBe(-1);
    expect(t.add(0, 0, 0, 3, false)).toBe(-1);
    expect(t.add(0, 0, 0, 4, true)).toBe(-1);
    for (let i = 5; i < 12; i++) t.add(0, 0, 0, i, true);
    expect(t.count).toBe(3);
  });
});

describe('décor et voiture', () => {
  it('buildDecor crée des maillages instanciés avec le bon nombre d’instances', () => {
    const env: Environment = {
      items: [
        { kind: 'sapin', variant: 0, x: 0, y: 0, z: 0, rot: 0, scale: 1, solid: true, manual: false },
        { kind: 'sapin', variant: 0, x: 10, y: 0, z: 0, rot: 1, scale: 1.2, solid: true, manual: false },
        { kind: 'rocher', variant: 1, x: 100, y: 0, z: 0, rot: 0, scale: 1, solid: false, manual: false },
      ],
      circles: [], segments: [], barriers: [{ x: 0, y: 0, z: 5, rot: 0, len: 2 }],
    };
    const g = buildDecor(env, fakeAssets(), 'haute', false);
    const inst = g.children.filter((c) => (c as THREE.InstancedMesh).isInstancedMesh) as THREE.InstancedMesh[];
    const total = inst.filter((m) => !(m.material as THREE.Material).side || (m.material as THREE.Material).side !== THREE.BackSide).reduce((s, m) => s + m.count, 0);
    expect(total).toBe(4);
  });
  it('CarView suit la pose, les roues avant braquent', () => {
    const v = new CarView(carModel(), '#3a6ff0', false);
    v.update({ x: 5, y: 1, z: -3, heading: 0.5, steer: 0.3, wheelSpin: 1, groundPitch: 0, groundRoll: 0, pitch: 0, roll: 0 });
    expect(v.root.position.x).toBe(5);
    expect(v.root.rotation.y).toBeCloseTo(0.5, 9);
    const rear: THREE.Vector3[] = [new THREE.Vector3(), new THREE.Vector3()];
    v.rearWheels(rear);
    expect(rear[0].distanceTo(new THREE.Vector3(5, 1, -3))).toBeGreaterThan(1);
    v.setColor('#ffffff');
    v.dispose();
  });
});
```

Run : `npx vitest run tests/render/objects.test.ts` → FAIL.

- [ ] **Step 2 : implémenter les effets**

`src/render/effects.ts` :
```ts
import * as THREE from 'three';
import { mulberry32, type Rng } from '../core/math/rng';
import { toonMaterial } from './materials';

export interface Particle { x: number; y: number; z: number; vx: number; vy: number; vz: number; age: number; life: number; size: number }

/** Réserve circulaire de particules (logique pure, sans three.js). */
export class ParticlePool {
  readonly items: Particle[];
  private next = 0;
  private readonly rng: Rng;

  constructor(readonly capacity: number, seed = 1) {
    this.items = Array.from({ length: capacity }, () => ({ x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, age: 1, life: 1, size: 1 }));
    this.rng = mulberry32(seed);
  }

  emit(x: number, y: number, z: number, vx: number, vz: number): void {
    const p = this.items[this.next];
    this.next = (this.next + 1) % this.capacity;
    const r = this.rng;
    p.x = x; p.y = y; p.z = z;
    p.vx = vx * 0.3 + (r() - 0.5) * 1.2;
    p.vy = 0.6 + r() * 0.8;
    p.vz = vz * 0.3 + (r() - 0.5) * 1.2;
    p.age = 0;
    p.life = 0.9 + r() * 0.5;
    p.size = 0.7 + r() * 0.5;
  }

  update(dt: number): void {
    const damp = Math.exp(-2.5 * dt);
    for (const p of this.items) {
      if (p.age >= p.life) continue;
      p.age += dt;
      p.vx *= damp; p.vz *= damp;
      p.vy += 0.4 * dt;
      p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
    }
  }

  alive(): number {
    return this.items.filter((p) => p.age < p.life).length;
  }

  /** Taille affichée : grossit puis se résorbe (bouffées toon opaques, sans transparence). */
  static scaleOf(p: Particle): number {
    if (p.age >= p.life) return 0;
    const t = p.age / p.life;
    return p.size * (0.6 + 2.2 * t) * Math.pow(Math.sin(Math.PI * t), 0.6);
  }
}

export class SmokeSystem {
  readonly mesh: THREE.InstancedMesh;
  private readonly pool: ParticlePool;
  private readonly acc: number[] = [];
  private readonly m = new THREE.Matrix4();
  private readonly q = new THREE.Quaternion();
  private readonly s = new THREE.Vector3();
  private readonly p = new THREE.Vector3();

  constructor(capacity: number, color: THREE.ColorRepresentation) {
    this.pool = new ParticlePool(capacity, 11);
    this.mesh = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(0.5, 0), toonMaterial({ color }), capacity);
    this.mesh.frustumCulled = false;
    this.update(0);
  }

  /** Émet `rate` bouffées par seconde et par point. */
  emit(points: THREE.Vector3[], rate: number, dt: number, vx: number, vz: number): void {
    points.forEach((pt, k) => {
      this.acc[k] = (this.acc[k] ?? 0) + rate * dt;
      while (this.acc[k] >= 1) {
        this.pool.emit(pt.x, pt.y + 0.2, pt.z, vx, vz);
        this.acc[k] -= 1;
      }
    });
  }

  update(dt: number): void {
    this.pool.update(dt);
    this.pool.items.forEach((it, i) => {
      const sc = ParticlePool.scaleOf(it);
      this.s.setScalar(sc);
      this.p.set(it.x, it.y, it.z);
      this.m.compose(this.p, this.q, this.s);
      this.mesh.setMatrixAt(i, this.m);
    });
    this.mesh.instanceMatrix.needsUpdate = true;
  }

  dispose(): void {
    this.mesh.geometry.dispose();
    (this.mesh.material as THREE.Material).dispose();
  }
}

/** Traces de gomme : anneau de quadrilatères (logique pure). */
export class SkidTrail {
  readonly data: Float32Array;
  count = 0;
  private next = 0;
  private readonly last: ({ x: number; y: number; z: number } | null)[] = [null, null];

  constructor(readonly capacity: number, private readonly width = 0.28) {
    this.data = new Float32Array(capacity * 4 * 3);
  }

  add(wheel: number, x: number, y: number, z: number, active: boolean): number {
    if (!active) { this.last[wheel] = null; return -1; }
    const prev = this.last[wheel];
    if (!prev) { this.last[wheel] = { x, y, z }; return -1; }
    const dx = x - prev.x, dz = z - prev.z;
    const len = Math.hypot(dx, dz);
    if (len < 0.25) return -1;
    const hx = (-dz / len) * (this.width / 2), hz = (dx / len) * (this.width / 2);
    const i = this.next;
    const o = i * 12;
    const yA = prev.y + 0.03, yB = y + 0.03;
    this.data.set([prev.x + hx, yA, prev.z + hz, prev.x - hx, yA, prev.z - hz, x + hx, yB, z + hz, x - hx, yB, z - hz], o);
    this.next = (this.next + 1) % this.capacity;
    this.count = Math.min(this.count + 1, this.capacity);
    this.last[wheel] = { x, y, z };
    return i;
  }

  reset(): void {
    this.data.fill(0);
    this.count = 0;
    this.next = 0;
    this.last[0] = null;
    this.last[1] = null;
  }
}

export class SkidMarks {
  readonly mesh: THREE.Mesh;
  private readonly trail: SkidTrail;
  private readonly attr: THREE.BufferAttribute;

  constructor(capacity: number) {
    this.trail = new SkidTrail(capacity);
    const geo = new THREE.BufferGeometry();
    this.attr = new THREE.BufferAttribute(this.trail.data, 3);
    this.attr.setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute('position', this.attr);
    const idx: number[] = [];
    for (let q = 0; q < capacity; q++) {
      const b = q * 4;
      idx.push(b, b + 2, b + 1, b + 1, b + 2, b + 3);
    }
    geo.setIndex(idx);
    this.mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({
      color: 0x1a1a1a, transparent: true, opacity: 0.5, depthWrite: false,
      polygonOffset: true, polygonOffsetFactor: -2, side: THREE.DoubleSide,
    }));
    this.mesh.frustumCulled = false;
  }

  add(wheel: number, p: THREE.Vector3, active: boolean): void {
    if (this.trail.add(wheel, p.x, p.y, p.z, active) >= 0) this.attr.needsUpdate = true;
  }

  reset(): void {
    this.trail.reset();
    this.attr.needsUpdate = true;
  }

  dispose(): void {
    this.mesh.geometry.dispose();
    (this.mesh.material as THREE.Material).dispose();
  }
}
```

- [ ] **Step 3 : décor instancié et voiture**

`src/render/decor.ts` :
```ts
import * as THREE from 'three';
import type { EnvItem, Environment } from '../core/env/types';
import { decorKey, type Assets } from './assets';
import { toonMaterial, outlineMaterial, outlineGeometry } from './materials';
import type { QualityLevel } from './quality';

/**
 * Un InstancedMesh par modèle et par distance (proche = solide, lointain = visuel).
 * Qualité Basse : un objet lointain sur trois, contours seulement sur les objets proches.
 */
export function buildDecor(env: Environment, assets: Assets, q: QualityLevel, shadows: boolean): THREE.Group {
  const root = new THREE.Group();
  root.name = 'decor';
  const mat = toonMaterial({ vertexColors: true });
  const outline = outlineMaterial(0.05);
  const groups = new Map<string, [EnvItem[], EnvItem[]]>();
  env.items.forEach((it, i) => {
    const far = !it.solid;
    if (q === 'basse' && far && i % 3 !== 0) return;
    const key = decorKey(it.kind, it.variant);
    let g = groups.get(key);
    if (!g) { g = [[], []]; groups.set(key, g); }
    g[far ? 1 : 0].push(it);
  });

  const m = new THREE.Matrix4(), qt = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3();
  const up = new THREE.Vector3(0, 1, 0);
  const outlines = new Map<string, THREE.BufferGeometry>();

  for (const [key, lists] of groups) {
    const geo = assets.decor[key];
    if (!geo) continue;
    lists.forEach((list, li) => {
      if (list.length === 0) return;
      const far = li === 1;
      const mesh = new THREE.InstancedMesh(geo, mat, list.length);
      list.forEach((it, i) => {
        qt.setFromAxisAngle(up, it.rot);
        s.setScalar(it.scale);
        p.set(it.x, it.y, it.z);
        mesh.setMatrixAt(i, m.compose(p, qt, s));
      });
      mesh.instanceMatrix.needsUpdate = true;
      mesh.castShadow = shadows && !far;
      mesh.computeBoundingSphere();
      root.add(mesh);
      if (q === 'haute' || !far) {
        let og = outlines.get(key);
        if (!og) { og = outlineGeometry(geo); outlines.set(key, og); }
        const ol = new THREE.InstancedMesh(og, outline, list.length);
        ol.instanceMatrix = mesh.instanceMatrix;
        ol.computeBoundingSphere();
        root.add(ol);
      }
    });
  }

  if (env.barriers.length > 0 && assets.decor.barriere) {
    const geo = assets.decor.barriere;
    const mesh = new THREE.InstancedMesh(geo, mat, env.barriers.length);
    env.barriers.forEach((b, i) => {
      qt.setFromAxisAngle(up, b.rot);
      s.set(1, 1, b.len);
      p.set(b.x, b.y, b.z);
      mesh.setMatrixAt(i, m.compose(p, qt, s));
    });
    mesh.instanceMatrix.needsUpdate = true;
    mesh.castShadow = shadows;
    mesh.computeBoundingSphere();
    const ol = new THREE.InstancedMesh(outlineGeometry(geo), outline, env.barriers.length);
    ol.instanceMatrix = mesh.instanceMatrix;
    ol.computeBoundingSphere();
    root.add(mesh, ol);
  }
  return root;
}
```

`src/render/carView.ts` :
```ts
import * as THREE from 'three';
import type { CarModel } from './assets';
import { paintGeometry } from './assets';
import { toonMaterial, outlineMaterial, outlineGeometry } from './materials';

export interface CarPose {
  x: number; y: number; z: number;
  heading: number;
  steer: number;
  wheelSpin: number;
  /** inclinaison due au terrain (nez vers le haut = +) */
  groundPitch: number;
  /** dévers dû au terrain (côté gauche plus haut = +) */
  groundRoll: number;
  /** plongée/cabrage de la caisse */
  pitch: number;
  /** roulis de la caisse en virage */
  roll: number;
}

/** Voiture affichée : root (cap) → ground (pente) → [roues, lean (caisse)]. */
export class CarView {
  readonly root = new THREE.Group();
  private readonly ground = new THREE.Group();
  private readonly lean = new THREE.Group();
  private readonly body: THREE.Mesh;
  private readonly mat = toonMaterial({ vertexColors: true });
  private readonly outlineMat = outlineMaterial(0.035);
  private readonly wheels: { pivot: THREE.Group; spin: THREE.Group; front: boolean }[] = [];
  private readonly owned: THREE.BufferGeometry[] = [];

  constructor(private readonly model: CarModel, color: string, shadows: boolean) {
    this.root.add(this.ground);
    this.ground.add(this.lean);
    this.body = new THREE.Mesh(paintGeometry(model.body, model.paint, new THREE.Color(color)), this.mat);
    this.body.castShadow = shadows;
    const bodyOutline = outlineGeometry(model.body);
    this.owned.push(bodyOutline);
    this.lean.add(this.body, new THREE.Mesh(bodyOutline, this.outlineMat));
    for (const w of model.wheels) {
      const pivot = new THREE.Group();
      pivot.position.copy(w.position);
      const spin = new THREE.Group();
      const mesh = new THREE.Mesh(w.geometry, this.mat);
      mesh.castShadow = shadows;
      const og = outlineGeometry(w.geometry);
      this.owned.push(og);
      spin.add(mesh, new THREE.Mesh(og, this.outlineMat));
      pivot.add(spin);
      this.ground.add(pivot);
      this.wheels.push({ pivot, spin, front: w.front });
    }
  }

  setColor(color: string): void {
    const old = this.body.geometry;
    this.body.geometry = paintGeometry(this.model.body, this.model.paint, new THREE.Color(color));
    old.dispose();
  }

  update(p: CarPose): void {
    this.root.position.set(p.x, p.y, p.z);
    this.root.rotation.set(0, p.heading, 0);
    this.ground.rotation.set(-p.groundPitch, 0, p.groundRoll);
    this.lean.rotation.set(-p.pitch, 0, p.roll);
    for (const w of this.wheels) {
      w.pivot.rotation.y = w.front ? p.steer : 0;
      w.spin.rotation.x = p.wheelSpin;
    }
  }

  /** Positions monde des roues arrière (gauche, droite) au niveau du sol. */
  rearWheels(out: THREE.Vector3[]): void {
    this.root.updateMatrixWorld(true);
    let k = 0;
    for (const w of this.wheels) {
      if (w.front || k >= out.length) continue;
      w.pivot.getWorldPosition(out[k]);
      out[k].y -= w.pivot.position.y;
      k++;
    }
  }

  dispose(): void {
    this.body.geometry.dispose();
    for (const g of this.owned) g.dispose();
    this.mat.dispose();
    this.outlineMat.dispose();
  }
}
```

Dans le test `buildDecor`, le total compté exclut les maillages de contour (matériau `BackSide`) : 2 sapins + 1 rocher + 1 barrière = 4.

- [ ] **Step 4 : vérifier** — `npx vitest run tests/render/objects.test.ts` → PASS ; `npx tsc --noEmit` → OK.

- [ ] **Step 5 : commit**

```bash
git add src/render/decor.ts src/render/carView.ts src/render/effects.ts tests/render/objects.test.ts
git commit -m "Rendu : décor instancié avec contours, voiture animée, fumée de pneus et traces de gomme"
```

---

## Tâche 16 : Caméra, monde complet, boucle à pas fixe, interpolation

**Files :**
- Create : `src/render/camera.ts`, `src/render/world.ts`, `src/game/loop.ts`, `src/game/pose.ts`
- Test : `tests/game/loop.test.ts`

**Interfaces :**
- Consumes : `SIM_DT` (T1), `Level` (T3), `TrackData` (T4), `Ground`, `Terrain` (T5), `Environment` (T6), `CarState`, `CarId` (T7), `CARS` (T7), tout le rendu (T13–T15), `wrapAngle`, `lerp`, `smoothstep`, `clamp` (T2).
- Produces :
  - `interface ChaseConfig { dist; height; lookAhead; fovMin; fovMax }`, `CAMERA_PROCHE`, `CAMERA_LOIN`, `interface CameraTarget { x; y; z; heading; vx; vz; speed }`, `desiredYaw(t): number`, `class ChaseCamera { readonly camera: THREE.PerspectiveCamera; yaw: number; constructor(camera); reset(t, cfg, ground): void; update(t, cfg, dt, ground): void; addShake(impact: number): void }`
  - `interface WorldInit { renderer; level; track; terrain; env; assets; carId: CarId; color: string; quality: QualityLevel }`, `class World { readonly scene; readonly camera; constructor(init: WorldInit); setQuality(q: QualityLevel): void; resize(w: number, h: number): void; resetCamera(car: CarState): void; update(pose: CarPose, car: CarState, dt: number, cfg: ChaseConfig): void; render(): void; shake(impact: number): void; resetEffects(): void; dispose(): void }`
  - `class FixedStepLoop { constructor(step: () => void, maxFrame?: number); advance(frameDt: number): number /* alpha dans [0,1[ */; reset(): void }`
  - `interpolatePose(prev: CarState, cur: CarState, alpha: number, ground: Ground): CarPose`

- [ ] **Step 1 : écrire les tests**

`tests/game/loop.test.ts` :
```ts
import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { FixedStepLoop } from '../../src/game/loop';
import { interpolatePose } from '../../src/game/pose';
import { ChaseCamera, CAMERA_PROCHE, desiredYaw } from '../../src/render/camera';
import { createCarState } from '../../src/core/physics/car';
import type { Ground } from '../../src/core/track/terrain';

const flat: Ground = { heightAt: () => 0, gradientAt: () => ({ gx: 0, gz: 0 }) };

describe('FixedStepLoop', () => {
  it('2 pas pour une image de 1/60 s, alpha dans [0,1[', () => {
    let n = 0;
    const loop = new FixedStepLoop(() => n++);
    const a = loop.advance(1 / 60 + 1e-9);
    expect(n).toBe(2);
    expect(a).toBeGreaterThanOrEqual(0);
    expect(a).toBeLessThan(1);
  });
  it('144 Hz : 120 pas par seconde en moyenne', () => {
    let n = 0;
    const loop = new FixedStepLoop(() => n++);
    for (let i = 0; i < 144; i++) loop.advance(1 / 144);
    expect(n).toBeGreaterThanOrEqual(119);
    expect(n).toBeLessThanOrEqual(120);
  });
  it('grand saut de temps : borné à 0,25 s (30 pas), temps négatif ignoré', () => {
    let n = 0;
    const loop = new FixedStepLoop(() => n++);
    loop.advance(10);
    expect(n).toBe(30);
    loop.advance(-5);
    expect(n).toBe(30);
  });
});

describe('interpolatePose', () => {
  it('interpole position et cap (en passant par ±π)', () => {
    const a = createCarState(0, 0, 3.1), b = createCarState(2, 4, -3.1);
    const p = interpolatePose(a, b, 0.5, flat);
    expect(p.x).toBeCloseTo(1, 9);
    expect(p.z).toBeCloseTo(2, 9);
    expect(Math.abs(Math.abs(p.heading) - Math.PI)).toBeLessThan(0.01);
    expect(p.groundPitch).toBeCloseTo(0, 9);
  });
  it('pente : nez vers le haut en montée', () => {
    const slope: Ground = { heightAt: (_x, z) => 0.1 * z, gradientAt: () => ({ gx: 0, gz: 0.1 }) };
    const c = createCarState(0, 10, 0, 1);
    expect(interpolatePose(c, c, 0, slope).groundPitch).toBeCloseTo(Math.atan(0.1), 3);
  });
});

describe('ChaseCamera', () => {
  it('se place derrière la voiture et au-dessus', () => {
    const cam = new ChaseCamera(new THREE.PerspectiveCamera(60, 1.5, 0.1, 2500));
    const t = { x: 0, y: 0, z: 0, heading: 0, vx: 0, vz: 20, speed: 20 };
    cam.reset(t, CAMERA_PROCHE, flat);
    for (let i = 0; i < 120; i++) cam.update(t, CAMERA_PROCHE, 1 / 60, flat);
    expect(cam.camera.position.z).toBeCloseTo(-7, 0);
    expect(cam.camera.position.y).toBeGreaterThan(2);
    expect(cam.camera.fov).toBeGreaterThan(60);
  });
  it('suit la direction de la vitesse (drift), le cap à l’arrêt', () => {
    expect(desiredYaw({ x: 0, y: 0, z: 0, heading: 1, vx: 0, vz: 10, speed: 10 })).toBeCloseTo(0, 9);
    expect(desiredYaw({ x: 0, y: 0, z: 0, heading: 1, vx: 0, vz: 1, speed: 1 })).toBe(1);
  });
});
```

Run : `npx vitest run tests/game/loop.test.ts` → FAIL.

- [ ] **Step 2 : boucle et interpolation**

`src/game/loop.ts` :
```ts
import { SIM_DT } from '../core/constants';

/** Accumule le temps réel et exécute la simulation à pas fixe. Renvoie alpha pour l'interpolation. */
export class FixedStepLoop {
  private acc = 0;

  constructor(private readonly step: () => void, private readonly maxFrame = 0.25) {}

  advance(frameDt: number): number {
    const dt = Math.min(Math.max(frameDt, 0), this.maxFrame);
    this.acc += dt;
    while (this.acc >= SIM_DT - 1e-12) {
      this.step();
      this.acc -= SIM_DT;
    }
    if (this.acc < 0) this.acc = 0;
    return this.acc / SIM_DT;
  }

  reset(): void {
    this.acc = 0;
  }
}
```

`src/game/pose.ts` :
```ts
import type { CarState } from '../core/physics/types';
import type { Ground } from '../core/track/terrain';
import { clamp, lerp, wrapAngle } from '../core/math/vec';
import type { CarPose } from '../render/carView';

/** Pose affichée entre deux états simulés (alpha ∈ [0, 1]). */
export function interpolatePose(prev: CarState, cur: CarState, alpha: number, ground: Ground): CarPose {
  const x = lerp(prev.x, cur.x, alpha);
  const y = lerp(prev.y, cur.y, alpha);
  const z = lerp(prev.z, cur.z, alpha);
  const heading = wrapAngle(prev.heading + wrapAngle(cur.heading - prev.heading) * alpha);
  const wheelSpin = prev.wheelSpin + wrapAngle(cur.wheelSpin - prev.wheelSpin) * alpha;
  const fx = Math.sin(heading), fz = Math.cos(heading);
  const lx = Math.cos(heading), lz = -Math.sin(heading);
  const hf = ground.heightAt(x + fx * 1.4, z + fz * 1.4), hb = ground.heightAt(x - fx * 1.4, z - fz * 1.4);
  const hl = ground.heightAt(x + lx * 0.8, z + lz * 0.8), hr = ground.heightAt(x - lx * 0.8, z - lz * 0.8);
  return {
    x, y, z, heading,
    steer: lerp(prev.steer, cur.steer, alpha),
    wheelSpin,
    groundPitch: Math.atan2(hf - hb, 2.8),
    groundRoll: Math.atan2(hl - hr, 1.6),
    pitch: clamp(cur.ax * 0.006, -0.05, 0.05),
    roll: clamp(cur.yawRate * cur.speed * 0.004, -0.08, 0.08),
  };
}
```

- [ ] **Step 3 : caméra de poursuite**

`src/render/camera.ts` :
```ts
import * as THREE from 'three';
import type { Ground } from '../core/track/terrain';
import { lerp, smoothstep, wrapAngle } from '../core/math/vec';

export interface ChaseConfig { dist: number; height: number; lookAhead: number; fovMin: number; fovMax: number }
export const CAMERA_PROCHE: ChaseConfig = { dist: 7, height: 2.8, lookAhead: 4, fovMin: 60, fovMax: 72 };
export const CAMERA_LOIN: ChaseConfig = { dist: 10, height: 4, lookAhead: 5, fovMin: 60, fovMax: 72 };

export interface CameraTarget { x: number; y: number; z: number; heading: number; vx: number; vz: number; speed: number }

/** La caméra suit la direction de la vitesse (on voit l'angle de drift), le cap sous 2 m/s. */
export function desiredYaw(t: CameraTarget): number {
  return t.speed > 2 ? Math.atan2(t.vx, t.vz) : t.heading;
}

export class ChaseCamera {
  yaw = 0;
  private readonly pos = new THREE.Vector3();
  private shake = 0;
  private time = 0;

  constructor(readonly camera: THREE.PerspectiveCamera) {}

  private target(t: CameraTarget, cfg: ChaseConfig, ground: Ground): THREE.Vector3 {
    const fx = Math.sin(this.yaw), fz = Math.cos(this.yaw);
    const x = t.x - fx * cfg.dist, z = t.z - fz * cfg.dist;
    const y = Math.max(t.y + cfg.height, ground.heightAt(x, z) + 1.2);
    return new THREE.Vector3(x, y, z);
  }

  reset(t: CameraTarget, cfg: ChaseConfig, ground: Ground): void {
    this.yaw = t.heading;
    this.pos.copy(this.target(t, cfg, ground));
    this.shake = 0;
    this.apply(t, cfg);
  }

  addShake(impact: number): void {
    this.shake = Math.min(0.6, this.shake + impact * 0.05);
  }

  update(t: CameraTarget, cfg: ChaseConfig, dt: number, ground: Ground): void {
    this.time += dt;
    this.yaw += wrapAngle(desiredYaw(t) - this.yaw) * (1 - Math.exp(-4 * dt));
    const tg = this.target(t, cfg, ground);
    const k = 1 - Math.exp(-8 * dt);
    this.pos.x += (tg.x - this.pos.x) * k;
    this.pos.z += (tg.z - this.pos.z) * k;
    this.pos.y += (tg.y - this.pos.y) * (1 - Math.exp(-5 * dt));
    this.pos.y = Math.max(this.pos.y, ground.heightAt(this.pos.x, this.pos.z) + 1.0);
    this.shake *= Math.exp(-6 * dt);
    this.apply(t, cfg);
  }

  private apply(t: CameraTarget, cfg: ChaseConfig): void {
    const sx = Math.sin(this.time * 37.1) * this.shake * 0.3;
    const sy = Math.sin(this.time * 53.7) * this.shake * 0.3;
    this.camera.position.set(this.pos.x + sx, this.pos.y + sy, this.pos.z);
    const fx = Math.sin(this.yaw), fz = Math.cos(this.yaw);
    this.camera.lookAt(t.x + fx * cfg.lookAhead, t.y + 1.0, t.z + fz * cfg.lookAhead);
    const fov = lerp(cfg.fovMin, cfg.fovMax, smoothstep(5, 50, t.speed));
    if (Math.abs(this.camera.fov - fov) > 0.01) {
      this.camera.fov = fov;
      this.camera.updateProjectionMatrix();
    }
  }
}
```

- [ ] **Step 4 : le monde complet**

`src/render/world.ts` :
```ts
import * as THREE from 'three';
import type { Level } from '../core/level/types';
import type { TrackData } from '../core/track/buildTrack';
import type { Terrain } from '../core/track/terrain';
import type { Environment } from '../core/env/types';
import type { CarId, CarState } from '../core/physics/types';
import type { Assets } from './assets';
import { PALETTES, type Palette } from './palettes';
import { QUALITY, type QualityLevel } from './quality';
import { createSky } from './sky';
import { buildRoad, createRoadTextures } from './road';
import { buildTerrain, buildMountains } from './terrainMesh';
import { buildDecor } from './decor';
import { CarView, type CarPose } from './carView';
import { SmokeSystem, SkidMarks } from './effects';
import { ChaseCamera, type ChaseConfig, type CameraTarget } from './camera';

export interface WorldInit {
  renderer: THREE.WebGLRenderer;
  level: Level;
  track: TrackData;
  terrain: Terrain;
  env: Environment;
  assets: Assets;
  carId: CarId;
  color: string;
  quality: QualityLevel;
}

export class World {
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(60, 1, 0.1, 2500);
  private readonly chase = new ChaseCamera(this.camera);
  private readonly palette: Palette;
  private readonly sun: THREE.DirectionalLight;
  private readonly sky: THREE.Mesh;
  private readonly terrainGroup: THREE.Group;
  private readonly carView: CarView;
  private smoke: SmokeSystem;
  private skids: SkidMarks;
  private quality: QualityLevel;
  private readonly rear = [new THREE.Vector3(), new THREE.Vector3()];
  private readonly target: CameraTarget = { x: 0, y: 0, z: 0, heading: 0, vx: 0, vz: 0, speed: 0 };
  private readonly owned: { dispose(): void }[] = [];

  constructor(private readonly init: WorldInit) {
    const { renderer, level, track, terrain, env, assets, quality } = init;
    this.quality = quality;
    const q = QUALITY[quality];
    const p = (this.palette = PALETTES[level.ambiance]);

    renderer.shadowMap.enabled = q.shadows;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, q.maxPixelRatio));

    this.scene.background = new THREE.Color(p.fog);
    this.scene.fog = new THREE.Fog(p.fog, q.fogFar * 0.3, q.fogFar);

    this.scene.add(new THREE.HemisphereLight(p.hemiSky, p.hemiGround, p.hemiIntensity));
    this.sun = new THREE.DirectionalLight(p.sun, p.sunIntensity);
    this.sun.castShadow = q.shadows;
    this.sun.shadow.mapSize.set(2048, 2048);
    const sc = this.sun.shadow.camera;
    sc.left = -30; sc.right = 30; sc.top = 30; sc.bottom = -30; sc.near = 1; sc.far = 250;
    this.sun.shadow.bias = -0.0005;
    this.sun.shadow.normalBias = 0.02;
    this.scene.add(this.sun, this.sun.target);

    this.sky = createSky(p);
    this.scene.add(this.sky);

    const tex = createRoadTextures(p, renderer.capabilities.getMaxAnisotropy());
    this.owned.push(tex.road, tex.curb, tex.checker);
    this.scene.add(buildRoad(track, p, tex));
    this.terrainGroup = buildTerrain(level, track, terrain, p, quality);
    this.scene.add(this.terrainGroup);
    this.scene.add(buildMountains(track, p, level.decor.graine));
    this.scene.add(buildDecor(env, assets, quality, q.shadows));

    this.carView = new CarView(assets.cars[init.carId], init.color, q.shadows);
    this.scene.add(this.carView.root);
    this.smoke = new SmokeSystem(q.smokeMax, 0xe9e6e1);
    this.skids = new SkidMarks(q.skidMax);
    this.scene.add(this.smoke.mesh, this.skids.mesh);
  }

  setQuality(level: QualityLevel): void {
    if (level === this.quality) return;
    this.quality = level;
    const q = QUALITY[level];
    this.init.renderer.setPixelRatio(Math.min(window.devicePixelRatio, q.maxPixelRatio));
    this.sun.castShadow = q.shadows;
    const fog = this.scene.fog as THREE.Fog;
    fog.near = q.fogFar * 0.3;
    fog.far = q.fogFar;
  }

  resize(w: number, h: number): void {
    this.init.renderer.setSize(w, h, false);
    this.camera.aspect = w / Math.max(1, h);
    this.camera.updateProjectionMatrix();
  }

  private setTarget(car: CarState, x = car.x, y = car.y, z = car.z): void {
    const t = this.target;
    t.x = x; t.y = y; t.z = z; t.heading = car.heading; t.vx = car.vx; t.vz = car.vz; t.speed = car.speed;
  }

  resetCamera(car: CarState): void {
    this.setTarget(car);
    this.chase.reset(this.target, { dist: 7, height: 2.8, lookAhead: 4, fovMin: 60, fovMax: 72 }, this.init.terrain);
  }

  resetEffects(): void {
    this.skids.reset();
  }

  shake(impact: number): void {
    this.chase.addShake(impact);
  }

  update(pose: CarPose, car: CarState, dt: number, cfg: ChaseConfig): void {
    this.carView.update(pose);
    this.carView.rearWheels(this.rear);
    const sliding = car.rearSlip > 0.05 && car.speed > 1;
    if (sliding) this.smoke.emit(this.rear, car.rearSlip * 35, dt, car.vx, car.vz);
    this.smoke.update(dt);
    const marking = car.rearSlip > 0.35 && car.speed > 3;
    this.skids.add(0, this.rear[0], marking);
    this.skids.add(1, this.rear[1], marking);

    this.setTarget(car, pose.x, pose.y, pose.z);
    this.chase.update(this.target, cfg, dt, this.init.terrain);
    this.sky.position.copy(this.camera.position);

    const d = this.palette.sunDir;
    this.sun.position.set(pose.x + d[0] * 80, pose.y + d[1] * 80, pose.z + d[2] * 80);
    this.sun.target.position.set(pose.x, pose.y, pose.z);

    const maxD = QUALITY[this.quality].fogFar + 150;
    const cx = this.camera.position.x, cz = this.camera.position.z;
    for (const chunk of this.terrainGroup.children) {
      const c = chunk.userData.center as THREE.Vector3;
      chunk.visible = (c.x - cx) * (c.x - cx) + (c.z - cz) * (c.z - cz) < maxD * maxD;
    }
  }

  render(): void {
    this.init.renderer.render(this.scene, this.camera);
  }

  /** Libère ce que ce monde a créé (les modèles partagés de `assets` ne sont pas libérés). */
  dispose(): void {
    const shared = new Set<THREE.BufferGeometry>(Object.values(this.init.assets.decor));
    for (const m of Object.values(this.init.assets.cars)) {
      shared.add(m.body);
      for (const w of m.wheels) shared.add(w.geometry);
    }
    this.carView.dispose();
    this.smoke.dispose();
    this.skids.dispose();
    this.scene.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (mesh.isMesh && mesh.geometry && !shared.has(mesh.geometry)) mesh.geometry.dispose();
    });
    for (const d of this.owned) d.dispose();
  }
}
```

- [ ] **Step 5 : vérifier** — `npx vitest run tests/game/loop.test.ts` → PASS ; `npm test` → tout PASS ; `npx tsc --noEmit` → OK. (`World` est vérifié visuellement par le contrôleur après la Tâche 19.)

- [ ] **Step 6 : commit**

```bash
git add src/render/camera.ts src/render/world.ts src/game/loop.ts src/game/pose.ts tests/game/loop.test.ts
git commit -m "Caméra de poursuite, assemblage du monde, boucle à pas fixe et interpolation"
```

---

## Tâche 17 : Contrôles clavier et tactile

**Files :**
- Create : `src/input/keyboard.ts`, `src/input/touch.ts`, `src/input/manager.ts`
- Test : `tests/input/input.test.ts`

**Interfaces :**
- Consumes : `InputState`, `NO_INPUT` (T1), `clamp` (T2).
- Produces :
  - `interface Actions { replacer: boolean; pause: boolean; camera: boolean; muet: boolean; pleinEcran: boolean }`, `NO_ACTIONS`
  - `class KeyboardInput { capture: boolean; keyDown(code: string, repeat?: boolean): void; keyUp(code: string): void; clear(): void; attach(w: Window): void; detach(): void; state(): InputState; consumeActions(): Actions }`
  - `steerFromDrag(dx: number, zoneWidth: number): number`
  - `interface TouchSource { readonly active: boolean; state(accelAuto: boolean): InputState; consumeActions(): Actions; reset(): void }`
  - `class TouchControls implements TouchSource { constructor(root: HTMLElement); show(visible: boolean): void }` (DOM)
  - `class InputManager { constructor(keyboard: KeyboardInput, touch: TouchSource | null); readonly touchActive: boolean; state(accelAuto: boolean): InputState; consumeActions(): Actions; reset(): void }`

Touches lues par position physique (`KeyboardEvent.code`) : `KeyW`/`ArrowUp` gaz, `KeyS`/`ArrowDown` frein, `KeyA`/`ArrowLeft` gauche, `KeyD`/`ArrowRight` droite, `Space` frein à main ; actions (une fois par appui, répétition ignorée) : `KeyR` replacer, `Escape`/`KeyP` pause, `KeyC` caméra, `KeyM` muet, `KeyF` plein écran. Au tactile, l'accélération automatique (option) met le gaz à 1 sauf quand on freine ; elle ne s'applique qu'aux commandes tactiles.

- [ ] **Step 1 : écrire les tests**

`tests/input/input.test.ts` :
```ts
import { describe, it, expect } from 'vitest';
import { KeyboardInput, NO_ACTIONS } from '../../src/input/keyboard';
import { steerFromDrag } from '../../src/input/touch';
import { InputManager } from '../../src/input/manager';
import type { TouchSource } from '../../src/input/touch';
import type { InputState } from '../../src/core/input';

describe('KeyboardInput', () => {
  it('ZQSD (positions physiques) et flèches', () => {
    const k = new KeyboardInput();
    k.keyDown('KeyW'); k.keyDown('KeyA');
    expect(k.state()).toEqual({ gaz: 1, frein: 0, direction: 1, freinAMain: false });
    k.keyUp('KeyW'); k.keyUp('KeyA');
    k.keyDown('ArrowDown'); k.keyDown('ArrowRight'); k.keyDown('Space');
    expect(k.state()).toEqual({ gaz: 0, frein: 1, direction: -1, freinAMain: true });
  });
  it('gauche + droite s’annulent', () => {
    const k = new KeyboardInput();
    k.keyDown('KeyA'); k.keyDown('KeyD');
    expect(k.state().direction).toBe(0);
  });
  it('actions : une fois par appui, répétition ignorée, vidées à la lecture', () => {
    const k = new KeyboardInput();
    k.keyDown('KeyR');
    k.keyDown('KeyR', true);
    expect(k.consumeActions().replacer).toBe(true);
    expect(k.consumeActions()).toEqual(NO_ACTIONS);
    k.keyDown('Escape');
    expect(k.consumeActions().pause).toBe(true);
    k.keyDown('KeyP', false);
    expect(k.consumeActions().pause).toBe(true);
  });
  it('clear relâche tout (perte de focus)', () => {
    const k = new KeyboardInput();
    k.keyDown('KeyW');
    k.clear();
    expect(k.state().gaz).toBe(0);
  });
});

describe('tactile', () => {
  it('glisser à droite = tourner à droite (direction négative), borné', () => {
    expect(steerFromDrag(0, 400)).toBeCloseTo(0, 9);
    expect(steerFromDrag(36, 400)).toBeCloseTo(-0.5, 9);
    expect(steerFromDrag(-500, 400)).toBe(1);
    expect(steerFromDrag(30, 100)).toBeCloseTo(-0.5, 9);
  });
});

describe('InputManager', () => {
  const fakeTouch = (s: InputState, active = true): TouchSource => ({
    active,
    state: (accel) => (accel ? { ...s, gaz: s.frein > 0 ? s.gaz : 1 } : s),
    consumeActions: () => ({ ...NO_ACTIONS, camera: true }),
    reset: () => {},
  });
  it('fusionne clavier et tactile', () => {
    const k = new KeyboardInput();
    k.keyDown('KeyW');
    const m = new InputManager(k, fakeTouch({ gaz: 0, frein: 0, direction: -0.4, freinAMain: true }));
    expect(m.state(false)).toEqual({ gaz: 1, frein: 0, direction: -0.4, freinAMain: true });
    k.keyDown('KeyA');
    expect(m.state(false).direction).toBe(1);
    expect(m.consumeActions().camera).toBe(true);
  });
  it('accélération auto seulement via le tactile', () => {
    const m = new InputManager(new KeyboardInput(), fakeTouch({ gaz: 0, frein: 0, direction: 0, freinAMain: false }));
    expect(m.state(true).gaz).toBe(1);
    expect(m.state(false).gaz).toBe(0);
    expect(new InputManager(new KeyboardInput(), null).state(true).gaz).toBe(0);
  });
});
```

Run : `npx vitest run tests/input/input.test.ts` → FAIL.

- [ ] **Step 2 : implémenter**

`src/input/keyboard.ts` :
```ts
import type { InputState } from '../core/input';

export interface Actions { replacer: boolean; pause: boolean; camera: boolean; muet: boolean; pleinEcran: boolean }
export const NO_ACTIONS: Readonly<Actions> = Object.freeze({ replacer: false, pause: false, camera: false, muet: false, pleinEcran: false });

const GAZ = ['KeyW', 'ArrowUp'];
const FREIN = ['KeyS', 'ArrowDown'];
const GAUCHE = ['KeyA', 'ArrowLeft'];
const DROITE = ['KeyD', 'ArrowRight'];
const FREIN_A_MAIN = ['Space'];
const ACTION_CODES: Record<string, keyof Actions> = {
  KeyR: 'replacer', Escape: 'pause', KeyP: 'pause', KeyC: 'camera', KeyM: 'muet', KeyF: 'pleinEcran',
};
const PREVENT = new Set(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space']);

export class KeyboardInput {
  /** true pendant une course : empêche le défilement de la page avec les flèches / Espace */
  capture = false;
  private readonly down = new Set<string>();
  private actions: Actions = { ...NO_ACTIONS };
  private target: Window | null = null;

  keyDown(code: string, repeat = false): void {
    this.down.add(code);
    const a = ACTION_CODES[code];
    if (a && !repeat) this.actions[a] = true;
  }

  keyUp(code: string): void {
    this.down.delete(code);
  }

  clear(): void {
    this.down.clear();
  }

  private readonly onDown = (e: KeyboardEvent): void => {
    const t = e.target as HTMLElement | null;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA')) return;
    if (this.capture && PREVENT.has(e.code)) e.preventDefault();
    this.keyDown(e.code, e.repeat);
  };
  private readonly onUp = (e: KeyboardEvent): void => this.keyUp(e.code);
  private readonly onBlur = (): void => this.clear();

  attach(w: Window): void {
    this.detach();
    w.addEventListener('keydown', this.onDown);
    w.addEventListener('keyup', this.onUp);
    w.addEventListener('blur', this.onBlur);
    this.target = w;
  }

  detach(): void {
    if (!this.target) return;
    this.target.removeEventListener('keydown', this.onDown);
    this.target.removeEventListener('keyup', this.onUp);
    this.target.removeEventListener('blur', this.onBlur);
    this.target = null;
  }

  state(): InputState {
    const has = (codes: string[]) => codes.some((c) => this.down.has(c));
    return {
      gaz: has(GAZ) ? 1 : 0,
      frein: has(FREIN) ? 1 : 0,
      direction: (has(GAUCHE) ? 1 : 0) - (has(DROITE) ? 1 : 0),
      freinAMain: has(FREIN_A_MAIN),
    };
  }

  consumeActions(): Actions {
    const a = this.actions;
    this.actions = { ...NO_ACTIONS };
    return a;
  }
}
```

`src/input/touch.ts` :
```ts
import type { InputState } from '../core/input';
import { clamp } from '../core/math/vec';
import { NO_ACTIONS, type Actions } from './keyboard';

/** Glisser vers la droite = tourner à droite (direction négative). Course pleine = 18 % de la zone (60 px min). */
export function steerFromDrag(dx: number, zoneWidth: number): number {
  const full = Math.max(60, zoneWidth * 0.18);
  return -clamp(dx / full, -1, 1);
}

export interface TouchSource {
  readonly active: boolean;
  state(accelAuto: boolean): InputState;
  consumeActions(): Actions;
  reset(): void;
}

export class TouchControls implements TouchSource {
  active = false;
  private steer = 0;
  private gaz = false;
  private frein = false;
  private drift = false;
  private actions: Actions = { ...NO_ACTIONS };
  private steerPointer: number | null = null;
  private steerOrigin = 0;
  private readonly knob: HTMLElement;

  constructor(private readonly root: HTMLElement) {
    root.innerHTML = `
      <div class="t-steer"><div class="t-steer-track"><div class="t-knob"></div></div><span>Glisse pour tourner</span></div>
      <div class="t-pedals">
        <button class="t-btn t-frein" type="button">Frein</button>
        <button class="t-btn t-drift" type="button">Drift</button>
        <button class="t-btn t-gaz" type="button">Gaz</button>
      </div>
      <div class="t-top">
        <button class="t-small t-replace" type="button">Replacer</button>
        <button class="t-small t-pause" type="button">Pause</button>
      </div>`;
    this.knob = root.querySelector('.t-knob') as HTMLElement;
    const zone = root.querySelector('.t-steer') as HTMLElement;

    zone.addEventListener('pointerdown', (e) => {
      if (this.steerPointer !== null) return;
      this.steerPointer = e.pointerId;
      this.steerOrigin = e.clientX;
      zone.setPointerCapture(e.pointerId);
    });
    zone.addEventListener('pointermove', (e) => {
      if (e.pointerId !== this.steerPointer) return;
      this.steer = steerFromDrag(e.clientX - this.steerOrigin, zone.clientWidth);
      this.knob.style.transform = `translateX(${-this.steer * 80}px)`;
    });
    const endSteer = (e: PointerEvent) => {
      if (e.pointerId !== this.steerPointer) return;
      this.steerPointer = null;
      this.steer = 0;
      this.knob.style.transform = '';
    };
    zone.addEventListener('pointerup', endSteer);
    zone.addEventListener('pointercancel', endSteer);

    const hold = (sel: string, set: (v: boolean) => void) => {
      const b = root.querySelector(sel) as HTMLElement;
      b.addEventListener('pointerdown', (e) => { set(true); b.classList.add('down'); b.setPointerCapture(e.pointerId); });
      const up = () => { set(false); b.classList.remove('down'); };
      b.addEventListener('pointerup', up);
      b.addEventListener('pointercancel', up);
    };
    hold('.t-gaz', (v) => { this.gaz = v; });
    hold('.t-frein', (v) => { this.frein = v; });
    hold('.t-drift', (v) => { this.drift = v; });
    (root.querySelector('.t-pause') as HTMLElement).addEventListener('pointerdown', () => { this.actions.pause = true; });
    (root.querySelector('.t-replace') as HTMLElement).addEventListener('pointerdown', () => { this.actions.replacer = true; });

    window.addEventListener('touchstart', () => { this.active = true; }, { passive: true });
  }

  show(visible: boolean): void {
    this.root.classList.toggle('on', visible);
  }

  state(accelAuto: boolean): InputState {
    return {
      gaz: this.gaz || (accelAuto && !this.frein) ? 1 : 0,
      frein: this.frein ? 1 : 0,
      direction: this.steer,
      freinAMain: this.drift,
    };
  }

  consumeActions(): Actions {
    const a = this.actions;
    this.actions = { ...NO_ACTIONS };
    return a;
  }

  reset(): void {
    this.gaz = this.frein = this.drift = false;
    this.steer = 0;
    this.steerPointer = null;
    this.knob.style.transform = '';
    this.actions = { ...NO_ACTIONS };
  }
}
```

`src/input/manager.ts` :
```ts
import { NO_INPUT, type InputState } from '../core/input';
import type { Actions, KeyboardInput } from './keyboard';
import type { TouchSource } from './touch';

export class InputManager {
  constructor(readonly keyboard: KeyboardInput, readonly touch: TouchSource | null) {}

  get touchActive(): boolean {
    return this.touch?.active ?? false;
  }

  /** `accelAuto` ne concerne que les commandes tactiles (et seulement si elles ont servi). */
  state(accelAuto: boolean): InputState {
    const k = this.keyboard.state();
    const t = this.touch ? this.touch.state(accelAuto && this.touchActive) : NO_INPUT;
    return {
      gaz: Math.max(k.gaz, t.gaz),
      frein: Math.max(k.frein, t.frein),
      direction: k.direction !== 0 ? k.direction : t.direction,
      freinAMain: k.freinAMain || t.freinAMain,
    };
  }

  consumeActions(): Actions {
    const a = this.keyboard.consumeActions();
    if (!this.touch) return a;
    const b = this.touch.consumeActions();
    return {
      replacer: a.replacer || b.replacer,
      pause: a.pause || b.pause,
      camera: a.camera || b.camera,
      muet: a.muet || b.muet,
      pleinEcran: a.pleinEcran || b.pleinEcran,
    };
  }

  reset(): void {
    this.keyboard.clear();
    this.touch?.reset();
    this.consumeActions();
  }
}
```

- [ ] **Step 3 : vérifier** — `npx vitest run tests/input/input.test.ts` → PASS ; `npx tsc --noEmit` → OK.

- [ ] **Step 4 : commit**

```bash
git add src/input tests/input
git commit -m "Contrôles : clavier AZERTY/QWERTY et commandes tactiles avec volant à glisser"
```

---

## Tâche 18 : Son synthétisé

**Files :**
- Create : `src/audio/audio.ts`
- Test : `tests/audio/audio.test.ts`

**Interfaces :**
- Consumes : `clamp`, `smoothstep` (T2).
- Produces : `engineFrequency(rpm): number`, `screechGain(slip, speed): number`, `class AudioEngine { unlock(): void; setVolume(v: number): void; setMuted(m: boolean): void; toggleMute(): boolean; startEngine(): void; stopEngine(): void; updateEngine(rpm: number, throttle: number, slip: number, speed: number): void; playBank(multiplier: number): void; playLose(): void; playCrash(impact: number): void; playCountdown(n: number): void }` — toutes les méthodes sont sans effet (et sans erreur) tant que `unlock()` n'a pas créé l'`AudioContext`.

- [ ] **Step 1 : écrire les tests**

`tests/audio/audio.test.ts` :
```ts
import { describe, it, expect } from 'vitest';
import { AudioEngine, engineFrequency, screechGain } from '../../src/audio/audio';

describe('audio', () => {
  it('fréquence moteur : 4 cylindres', () => {
    expect(engineFrequency(3000)).toBe(100);
  });
  it('crissement selon la glisse et la vitesse', () => {
    expect(screechGain(1, 20)).toBeCloseTo(0.22, 9);
    expect(screechGain(0.5, 0)).toBe(0);
    expect(screechGain(0, 30)).toBe(0);
  });
  it('sans AudioContext : aucune méthode ne lève d’erreur', () => {
    const a = new AudioEngine();
    expect(() => {
      a.unlock();
      a.setVolume(0.5);
      a.startEngine();
      a.updateEngine(4000, 1, 0.5, 20);
      a.playBank(3); a.playLose(); a.playCrash(8); a.playCountdown(0);
      a.stopEngine();
    }).not.toThrow();
    expect(a.toggleMute()).toBe(true);
    expect(a.toggleMute()).toBe(false);
  });
});
```

Run : `npx vitest run tests/audio/audio.test.ts` → FAIL.

- [ ] **Step 2 : implémenter**

`src/audio/audio.ts` :
```ts
import { clamp, smoothstep } from '../core/math/vec';

/** Fréquence de base du moteur (4 cylindres : 2 explosions par tour). */
export function engineFrequency(rpm: number): number {
  return (rpm / 60) * 2;
}

export function screechGain(slip: number, speed: number): number {
  return clamp(slip, 0, 1) * smoothstep(3, 10, speed) * 0.22;
}

interface EngineNodes { osc1: OscillatorNode; osc2: OscillatorNode; filter: BiquadFilterNode; gain: GainNode; noise: AudioBufferSourceNode; screech: GainNode }

export class AudioEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private engine: EngineNodes | null = null;
  private volume = 0.8;
  private muted = false;
  private noiseBuffer: AudioBuffer | null = null;

  /** À appeler lors d'un geste de l'utilisateur (exigence des navigateurs). */
  unlock(): void {
    if (typeof window === 'undefined') return;
    if (this.ctx) {
      if (this.ctx.state === 'suspended') void this.ctx.resume();
      return;
    }
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    try {
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.connect(this.ctx.destination);
      this.applyVolume();
      const len = this.ctx.sampleRate * 2;
      this.noiseBuffer = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const data = this.noiseBuffer.getChannelData(0);
      let seed = 12345;
      for (let i = 0; i < len; i++) {
        seed = (seed * 1103515245 + 12345) & 0x7fffffff;
        data[i] = (seed / 0x7fffffff) * 2 - 1;
      }
    } catch {
      this.ctx = null;
      this.master = null;
    }
  }

  private applyVolume(): void {
    if (this.master && this.ctx) this.master.gain.setTargetAtTime(this.muted ? 0 : this.volume, this.ctx.currentTime, 0.02);
  }

  setVolume(v: number): void { this.volume = clamp(v, 0, 1); this.applyVolume(); }
  setMuted(m: boolean): void { this.muted = m; this.applyVolume(); }
  toggleMute(): boolean { this.setMuted(!this.muted); return this.muted; }

  startEngine(): void {
    const ctx = this.ctx, master = this.master;
    if (!ctx || !master || this.engine || !this.noiseBuffer) return;
    const osc1 = ctx.createOscillator(); osc1.type = 'sawtooth';
    const osc2 = ctx.createOscillator(); osc2.type = 'square';
    const filter = ctx.createBiquadFilter(); filter.type = 'lowpass'; filter.frequency.value = 600;
    const gain = ctx.createGain(); gain.gain.value = 0.0;
    osc1.connect(filter); osc2.connect(filter); filter.connect(gain); gain.connect(master);
    const noise = ctx.createBufferSource(); noise.buffer = this.noiseBuffer; noise.loop = true;
    const band = ctx.createBiquadFilter(); band.type = 'bandpass'; band.frequency.value = 1800; band.Q.value = 3;
    const screech = ctx.createGain(); screech.gain.value = 0;
    noise.connect(band); band.connect(screech); screech.connect(master);
    osc1.start(); osc2.start(); noise.start();
    this.engine = { osc1, osc2, filter, gain, noise, screech };
  }

  stopEngine(): void {
    const e = this.engine;
    if (!e) return;
    try { e.osc1.stop(); e.osc2.stop(); e.noise.stop(); } catch { /* déjà arrêtés */ }
    e.gain.disconnect(); e.screech.disconnect();
    this.engine = null;
  }

  updateEngine(rpm: number, throttle: number, slip: number, speed: number): void {
    const e = this.engine, ctx = this.ctx;
    if (!e || !ctx) return;
    const t = ctx.currentTime;
    const f = engineFrequency(rpm);
    e.osc1.frequency.setTargetAtTime(f, t, 0.03);
    e.osc2.frequency.setTargetAtTime(f / 2, t, 0.03);
    e.filter.frequency.setTargetAtTime(400 + rpm * 0.25, t, 0.05);
    e.gain.gain.setTargetAtTime(0.06 + Math.max(0, throttle) * 0.06, t, 0.05);
    e.screech.gain.setTargetAtTime(screechGain(slip, speed), t, 0.05);
  }

  private blip(freq: number, dur: number, type: OscillatorType, gain: number, endFreq?: number, delay = 0): void {
    const ctx = this.ctx, master = this.master;
    if (!ctx || !master) return;
    const t = ctx.currentTime + delay;
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (endFreq) o.frequency.exponentialRampToValueAtTime(endFreq, t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(master);
    o.start(t); o.stop(t + dur + 0.02);
  }

  playBank(multiplier: number): void {
    this.blip(660, 0.08, 'sine', 0.2);
    this.blip(990 + multiplier * 40, 0.14, 'sine', 0.2, undefined, 0.08);
  }

  playLose(): void {
    this.blip(300, 0.3, 'square', 0.12, 120);
  }

  playCrash(impact: number): void {
    const ctx = this.ctx, master = this.master;
    if (!ctx || !master || !this.noiseBuffer) return;
    const t = ctx.currentTime;
    const src = ctx.createBufferSource(); src.buffer = this.noiseBuffer;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 600;
    const g = ctx.createGain();
    g.gain.setValueAtTime(Math.min(0.5, impact * 0.05), t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.25);
    src.connect(lp); lp.connect(g); g.connect(master);
    src.start(t); src.stop(t + 0.3);
  }

  playCountdown(n: number): void {
    if (n > 0) this.blip(440, 0.15, 'triangle', 0.25);
    else this.blip(880, 0.4, 'triangle', 0.3);
  }
}
```

- [ ] **Step 3 : vérifier** — `npx vitest run tests/audio/audio.test.ts` → PASS ; `npx tsc --noEmit` → OK.

- [ ] **Step 4 : commit**

```bash
git add src/audio tests/audio
git commit -m "Son synthétisé : moteur, crissement, choc, encaissement et décompte"
```

---

## Tâche 19 : HUD, session de jeu et premier lancement jouable

**Files :**
- Create : `src/ui/format.ts`, `src/ui/couleurs.ts`, `src/game/prepare.ts`, `src/game/hud.ts`, `src/game/session.ts`, `src/app.ts` (version minimale, remplacée à la Tâche 20), `src/styles.css`
- Modify : `src/main.ts` (remplacer tout le contenu)
- Test : `tests/game/prepare.test.ts`, `tests/ui/format.test.ts`

**Interfaces :**
- Consumes : tout ce qui précède.
- Produces :
  - `formatScore(n: number): string` (espaces fines insécables : « 12 345 »), `formatTime(s: number): string` (« 1:23.45 »), `formatDistance(m: number): string` (« 1,2 km »)
  - `COULEURS: { nom: string; hex: string }[]` (8 couleurs)
  - `interface PreparedLevel { key: string; level: Level; track: TrackData; terrain: Terrain; env: Environment }`, `prepareLevel(key: string, raw: unknown): { ok: true; prepared: PreparedLevel } | { ok: false; erreurs: string[] }`
  - `class Hud { constructor(root: HTMLElement); show(v: boolean): void; reset(): void; update(h: HudData): void; flash(kind: 'bank' | 'lose', points: number): void; go(): void }`
  - `interface SessionDeps { renderer; assets; hud; audio; input; quality; reglages; debug?: DebugHook | null }`, `interface SessionCallbacks { onFinish(r: RaceResult): void; onPause(): void }`, `interface DebugHook { attach(car: CarParams, assists: AssistParams, cam: ChaseConfig): void; frame(car: CarState, dt: number): void }`
  - `class GameSession { constructor(level: PreparedLevel, deps: SessionDeps, cb: SessionCallbacks); start(): void; pause(): void; resume(): void; restart(): void; dispose(): void }`
  - `toggleFullscreen(): void`

- [ ] **Step 1 : écrire les tests**

`tests/ui/format.test.ts` :
```ts
import { describe, it, expect } from 'vitest';
import { formatScore, formatTime, formatDistance } from '../../src/ui/format';

describe('formatage', () => {
  it('score avec espaces fines', () => {
    expect(formatScore(0)).toBe('0');
    expect(formatScore(1234567.4)).toBe('1 234 567');
    expect(formatScore(999)).toBe('999');
  });
  it('temps m:ss.cc sans « 60 secondes »', () => {
    expect(formatTime(83.456)).toBe('1:23.46');
    expect(formatTime(5.2)).toBe('0:05.20');
    expect(formatTime(59.999)).toBe('1:00.00');
  });
  it('distance', () => {
    expect(formatDistance(1234)).toBe('1,2 km');
    expect(formatDistance(850)).toBe('850 m');
  });
});
```

`tests/game/prepare.test.ts` :
```ts
import { describe, it, expect } from 'vitest';
import { prepareLevel } from '../../src/game/prepare';
import { NIVEAUX_OFFICIELS, cleNiveauOfficiel } from '../../src/levels';

describe('prepareLevel', () => {
  it('prépare un niveau officiel', () => {
    const n = NIVEAUX_OFFICIELS[0];
    const r = prepareLevel(cleNiveauOfficiel(n.id), n.data);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.prepared.key).toBe('off:premiers-virages');
      expect(r.prepared.env.items.length).toBeGreaterThan(0);
    }
  });
  it('renvoie les erreurs d’un niveau invalide', () => {
    const r = prepareLevel('x', { format: 1, nom: '' });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.erreurs.length).toBeGreaterThan(0);
  });
});
```

Run : `npx vitest run tests/ui/format.test.ts tests/game/prepare.test.ts` → FAIL.

- [ ] **Step 2 : utilitaires et préparation**

`src/ui/format.ts` :
```ts
export function formatScore(n: number): string {
  return Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}

export function formatTime(s: number): string {
  const cs = Math.round(Math.max(0, s) * 100);
  const m = Math.floor(cs / 6000);
  const rest = cs - m * 6000;
  const sec = Math.floor(rest / 100);
  const c = rest % 100;
  return `${m}:${String(sec).padStart(2, '0')}.${String(c).padStart(2, '0')}`;
}

export function formatDistance(m: number): string {
  return m >= 1000 ? `${(m / 1000).toFixed(1).replace('.', ',')} km` : `${Math.round(m)} m`;
}
```

`src/ui/couleurs.ts` :
```ts
export const COULEURS: { nom: string; hex: string }[] = [
  { nom: 'Rouge', hex: '#e63b2e' },
  { nom: 'Orange', hex: '#ff8a1f' },
  { nom: 'Jaune', hex: '#ffd23f' },
  { nom: 'Vert', hex: '#3fbf5f' },
  { nom: 'Turquoise', hex: '#2ec4c9' },
  { nom: 'Bleu', hex: '#3a6ff0' },
  { nom: 'Violet', hex: '#8e5cf0' },
  { nom: 'Blanc', hex: '#f2f2ee' },
];
```

`src/game/prepare.ts` :
```ts
import type { Level } from '../core/level/types';
import type { TrackData } from '../core/track/buildTrack';
import type { Environment } from '../core/env/types';
import { loadLevel } from '../core/loadLevel';
import { Terrain } from '../core/track/terrain';
import { generateEnvironment } from '../core/env/generate';

export interface PreparedLevel { key: string; level: Level; track: TrackData; terrain: Terrain; env: Environment }

/** Valide le niveau puis calcule piste, terrain et décor (peut prendre quelques centaines de ms). */
export function prepareLevel(key: string, raw: unknown): { ok: true; prepared: PreparedLevel } | { ok: false; erreurs: string[] } {
  const r = loadLevel(raw);
  if (!r.ok) return r;
  const terrain = new Terrain(r.track, r.level.decor.graine);
  const env = generateEnvironment(r.level, r.track, terrain);
  return { ok: true, prepared: { key, level: r.level, track: r.track, terrain, env } };
}
```

- [ ] **Step 3 : HUD**

`src/game/hud.ts` :
```ts
import type { HudData } from '../core/race/race';
import { formatScore, formatTime } from '../ui/format';

export class Hud {
  private readonly el: Record<string, HTMLElement> = {};
  private last = { score: '', time: '', drift: '', mult: '', bar: -1, count: '', wrong: false, speed: '' };
  private flashUntil = 0;
  private goUntil = 0;

  constructor(private readonly root: HTMLElement) {
    root.innerHTML = `
      <div class="hud-top">
        <div class="hud-box"><small>Score</small><b data-k="score">0</b></div>
        <div class="hud-box"><small>Temps</small><b data-k="time">0:00.00</b></div>
      </div>
      <div class="hud-drift" data-k="driftBox"><b data-k="drift"></b><span data-k="mult"></span></div>
      <div class="hud-count" data-k="count"></div>
      <div class="hud-wrong" data-k="wrong">Mauvais sens !</div>
      <div class="hud-progress"><div class="hud-bar"><i data-k="bar"></i></div></div>
      <div class="hud-speed"><b data-k="speed">0</b> km/h</div>`;
    root.querySelectorAll<HTMLElement>('[data-k]').forEach((e) => { this.el[e.dataset.k!] = e; });
  }

  show(v: boolean): void {
    this.root.classList.toggle('on', v);
  }

  reset(): void {
    this.last = { score: '', time: '', drift: '', mult: '', bar: -1, count: '', wrong: false, speed: '' };
    this.flashUntil = 0;
    this.goUntil = 0;
    this.el.driftBox.className = 'hud-drift';
  }

  private set(key: 'score' | 'time' | 'drift' | 'mult' | 'count' | 'speed', value: string): void {
    if (this.last[key] === value) return;
    this.last[key] = value;
    this.el[key].textContent = value;
  }

  update(h: HudData): void {
    const now = performance.now();
    this.set('score', formatScore(h.score));
    this.set('time', formatTime(h.time));
    this.set('speed', String(Math.round(h.speedKmh)));
    if (now >= this.flashUntil) {
      const box = this.el.driftBox;
      if (h.drift > 0) {
        this.set('drift', formatScore(h.drift));
        this.set('mult', `x${h.multiplier}`);
        box.className = 'hud-drift on' + (h.driftActive ? ' active' : '');
      } else if (h.multiplier > 1) {
        this.set('drift', '');
        this.set('mult', `Combo x${h.multiplier}`);
        box.className = 'hud-drift on';
      } else {
        box.className = 'hud-drift';
      }
    }
    let count = '';
    if (h.phase === 'compte') count = String(Math.max(1, Math.ceil(h.countdown - 1e-9)));
    else if (now < this.goUntil) count = 'Partez !';
    this.set('count', count);
    if (h.wrongWay !== this.last.wrong) {
      this.last.wrong = h.wrongWay;
      this.el.wrong.classList.toggle('on', h.wrongWay);
    }
    const bar = Math.round(h.progress * 1000);
    if (bar !== this.last.bar) {
      this.last.bar = bar;
      this.el.bar.style.width = `${bar / 10}%`;
    }
  }

  flash(kind: 'bank' | 'lose', points: number): void {
    const box = this.el.driftBox;
    this.set('drift', (kind === 'bank' ? '+' : '−') + formatScore(points));
    this.set('mult', kind === 'bank' ? 'Encaissé !' : 'Perdu !');
    box.className = 'hud-drift on';
    void box.offsetWidth; // relance l'animation CSS
    box.className = `hud-drift on ${kind}`;
    this.flashUntil = performance.now() + 800;
  }

  go(): void {
    this.goUntil = performance.now() + 800;
  }
}
```

- [ ] **Step 4 : session de jeu**

`src/game/session.ts` :
```ts
import * as THREE from 'three';
import { RaceSim, type RaceEvent, type RaceResult } from '../core/race/race';
import { CARS } from '../core/physics/cars';
import { MODES } from '../core/physics/assists';
import type { AssistParams, CarParams, CarState } from '../core/physics/types';
import type { Assets } from '../render/assets';
import { World } from '../render/world';
import { CAMERA_LOIN, CAMERA_PROCHE, type ChaseConfig } from '../render/camera';
import type { QualityManager } from '../render/quality';
import type { AudioEngine } from '../audio/audio';
import type { InputManager } from '../input/manager';
import type { Reglages } from '../storage/store';
import { FixedStepLoop } from './loop';
import { interpolatePose } from './pose';
import type { Hud } from './hud';
import type { PreparedLevel } from './prepare';

export interface DebugHook {
  attach(car: CarParams, assists: AssistParams, cam: ChaseConfig): void;
  frame(car: CarState, dt: number): void;
}

export interface SessionDeps {
  renderer: THREE.WebGLRenderer;
  assets: Assets;
  hud: Hud;
  audio: AudioEngine;
  input: InputManager;
  quality: QualityManager;
  reglages: Reglages;
  debug?: DebugHook | null;
}

export interface SessionCallbacks {
  onFinish(r: RaceResult): void;
  onPause(): void;
}

export function toggleFullscreen(): void {
  if (!document.fullscreenElement) document.documentElement.requestFullscreen?.().catch(() => {});
  else document.exitFullscreen?.().catch(() => {});
}

export class GameSession {
  private race: RaceSim;
  private readonly world: World;
  private readonly loop: FixedStepLoop;
  private raf = 0;
  private last = 0;
  private paused = false;
  private disposed = false;
  private pendingReplace = false;
  private finishDelay = -1;
  private camCfg: ChaseConfig;

  constructor(private readonly level: PreparedLevel, private readonly deps: SessionDeps, private readonly cb: SessionCallbacks) {
    this.world = new World({
      renderer: deps.renderer, level: level.level, track: level.track, terrain: level.terrain, env: level.env,
      assets: deps.assets, carId: deps.reglages.voiture, color: deps.reglages.couleur, quality: deps.quality.level,
    });
    this.race = this.newRace();
    this.loop = new FixedStepLoop(() => this.simStep());
    this.camCfg = deps.reglages.cameraLoin ? CAMERA_LOIN : CAMERA_PROCHE;
    deps.debug?.attach(CARS[deps.reglages.voiture], MODES[deps.reglages.mode], this.camCfg);
    window.addEventListener('resize', this.onResize);
    this.onResize();
  }

  private newRace(): RaceSim {
    const { level, track, terrain, env } = this.level;
    return new RaceSim({ level, track, terrain, env, car: CARS[this.deps.reglages.voiture], assists: MODES[this.deps.reglages.mode] });
  }

  private readonly onResize = (): void => {
    this.world.resize(window.innerWidth, window.innerHeight);
  };

  start(): void {
    this.deps.hud.reset();
    this.deps.hud.show(true);
    this.world.resetCamera(this.race.car);
    this.deps.input.reset();
    this.deps.audio.startEngine();
    this.last = performance.now();
    this.raf = requestAnimationFrame(this.frame);
  }

  private readonly frame = (now: number): void => {
    if (this.disposed) return;
    this.raf = requestAnimationFrame(this.frame);
    const dt = Math.min(0.25, Math.max(0, (now - this.last) / 1000));
    this.last = now;
    if (this.paused) return;

    const a = this.deps.input.consumeActions();
    if (a.pause && this.race.phase !== 'arrivee') { this.cb.onPause(); return; }
    if (a.camera) {
      this.deps.reglages.cameraLoin = !this.deps.reglages.cameraLoin;
      this.camCfg = this.deps.reglages.cameraLoin ? CAMERA_LOIN : CAMERA_PROCHE;
    }
    if (a.muet) this.deps.reglages.muet = this.deps.audio.toggleMute();
    if (a.pleinEcran) toggleFullscreen();
    if (a.replacer) this.pendingReplace = true;

    const alpha = this.loop.advance(dt);
    const car = this.race.car;
    const pose = interpolatePose(this.race.prevCar, car, alpha, this.level.terrain);
    this.world.update(pose, car, dt, this.camCfg);
    this.world.render();
    this.deps.hud.update(this.race.hud());
    this.deps.audio.updateEngine(car.rpm, car.throttle, car.rearSlip, car.speed);
    this.deps.debug?.frame(car, dt);
    if (this.race.phase === 'course' && this.deps.quality.sample(dt)) this.world.setQuality(this.deps.quality.level);

    if (this.finishDelay >= 0) {
      this.finishDelay -= dt;
      if (this.finishDelay < 0 && this.race.result) this.cb.onFinish(this.race.result);
    }
  };

  private simStep(): void {
    const input = this.deps.input.state(this.deps.reglages.accelAuto);
    const events = this.race.step(input, this.pendingReplace);
    this.pendingReplace = false;
    for (const e of events) this.handle(e);
  }

  private handle(e: RaceEvent): void {
    switch (e.type) {
      case 'decompte':
        this.deps.audio.playCountdown(e.n);
        if (e.n === 0) this.deps.hud.go();
        break;
      case 'bank':
        this.deps.audio.playBank(e.multiplier);
        this.deps.hud.flash('bank', e.points);
        break;
      case 'lose':
        this.deps.audio.playLose();
        this.deps.hud.flash('lose', e.points);
        break;
      case 'choc':
        this.deps.audio.playCrash(e.impact);
        this.world.shake(e.impact);
        break;
      case 'replace':
        this.world.resetCamera(this.race.car);
        break;
      case 'arrivee':
        this.finishDelay = 1.5;
        break;
    }
  }

  pause(): void {
    this.paused = true;
    this.deps.audio.stopEngine();
  }

  resume(): void {
    this.paused = false;
    this.loop.reset();
    this.deps.input.reset();
    this.deps.audio.startEngine();
    this.last = performance.now();
  }

  restart(): void {
    this.race = this.newRace();
    this.finishDelay = -1;
    this.pendingReplace = false;
    this.world.resetEffects();
    this.world.resetCamera(this.race.car);
    this.deps.hud.reset();
    this.resume();
  }

  dispose(): void {
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    window.removeEventListener('resize', this.onResize);
    this.deps.audio.stopEngine();
    this.deps.hud.show(false);
    this.world.dispose();
  }
}
```

- [ ] **Step 5 : styles de base, HUD et tactile**

`src/styles.css` :
```css
:root {
  --ink: #15131c;
  --cream: #fff7e8;
  --red: #e63b2e;
  --orange: #ff8a1f;
  --yellow: #ffd23f;
  --green: #3fbf5f;
  --blue: #3a6ff0;
  --bg1: #2a2f45;
  --bg2: #1b1f2e;
  --font: 'Baloo 2', system-ui, -apple-system, 'Segoe UI', sans-serif;
}
* { box-sizing: border-box; }
html, body {
  margin: 0; height: 100%; overflow: hidden; background: var(--bg2);
  font-family: var(--font); color: var(--ink);
  -webkit-user-select: none; user-select: none; touch-action: none;
  -webkit-tap-highlight-color: transparent;
}
#app { position: fixed; inset: 0; }
#scene { position: absolute; inset: 0; width: 100%; height: 100%; display: block; }
#hud, #touch, #ui { position: absolute; inset: 0; pointer-events: none; }
.stroke { -webkit-text-stroke: 3px var(--ink); paint-order: stroke fill; }

/* HUD */
#hud { display: none; }
#hud.on { display: block; }
.hud-top { position: absolute; top: max(12px, env(safe-area-inset-top)); left: 16px; right: 16px; display: flex; justify-content: space-between; }
.hud-box { background: var(--cream); border: 3px solid var(--ink); border-radius: 16px; padding: 2px 14px 0; box-shadow: 0 4px 0 var(--ink); text-align: center; min-width: 118px; }
.hud-box small { display: block; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; opacity: .6; }
.hud-box b { font-size: 26px; font-weight: 800; font-variant-numeric: tabular-nums; }
.hud-drift { position: absolute; top: 20%; left: 50%; transform: translateX(-50%); text-align: center; opacity: 0; transition: opacity .15s; white-space: nowrap; }
.hud-drift.on { opacity: 1; }
.hud-drift b { display: block; font-size: 46px; font-weight: 800; color: var(--yellow); -webkit-text-stroke: 3px var(--ink); paint-order: stroke fill; line-height: 1; }
.hud-drift span { font-size: 24px; font-weight: 800; color: #fff; -webkit-text-stroke: 3px var(--ink); paint-order: stroke fill; }
.hud-drift.active b { transform: scale(1.06); }
.hud-drift.bank b { color: var(--green); animation: pop .7s ease-out; }
.hud-drift.lose b { color: var(--red); animation: shake .5s; }
@keyframes pop { 0% { transform: scale(1.5); } 100% { transform: scale(1); } }
@keyframes shake { 0%, 100% { transform: translateX(0); } 25% { transform: translateX(-10px); } 75% { transform: translateX(10px); } }
.hud-count { position: absolute; top: 34%; left: 0; right: 0; text-align: center; font-size: 110px; font-weight: 800; color: #fff; -webkit-text-stroke: 6px var(--ink); paint-order: stroke fill; }
.hud-wrong { display: none; position: absolute; top: 48%; left: 50%; transform: translateX(-50%); background: var(--red); color: #fff; border: 3px solid var(--ink); border-radius: 14px; padding: 4px 18px; font-size: 28px; font-weight: 800; box-shadow: 0 4px 0 var(--ink); }
.hud-wrong.on { display: block; }
.hud-progress { position: absolute; bottom: max(16px, env(safe-area-inset-bottom)); left: 50%; transform: translateX(-50%); width: min(420px, 55vw); }
.hud-bar { height: 14px; background: var(--cream); border: 3px solid var(--ink); border-radius: 10px; overflow: hidden; }
.hud-bar i { display: block; height: 100%; width: 0; background: var(--orange); }
.hud-speed { position: absolute; right: 16px; bottom: max(12px, env(safe-area-inset-bottom)); font-weight: 700; color: #fff; -webkit-text-stroke: 2px var(--ink); paint-order: stroke fill; font-size: 18px; }
.hud-speed b { font-size: 30px; font-variant-numeric: tabular-nums; }

/* Commandes tactiles */
#touch { display: none; }
#touch.on { display: block; }
.t-steer { position: absolute; left: 0; bottom: 0; width: 45%; height: 60%; pointer-events: auto; display: flex; align-items: flex-end; justify-content: center; padding-bottom: 34px; }
.t-steer-track { width: 220px; height: 64px; border-radius: 32px; background: rgba(255, 247, 232, .35); border: 3px solid rgba(21, 19, 28, .6); position: relative; }
.t-knob { position: absolute; left: 50%; top: 50%; width: 56px; height: 56px; margin: -28px 0 0 -28px; border-radius: 50%; background: var(--cream); border: 3px solid var(--ink); }
.t-steer span { position: absolute; bottom: 10px; font-size: 12px; color: #fff; opacity: .75; }
.t-pedals { position: absolute; right: 16px; bottom: 24px; display: flex; gap: 12px; align-items: flex-end; pointer-events: auto; }
.t-btn { width: 80px; height: 80px; border-radius: 50%; border: 3px solid var(--ink); box-shadow: 0 5px 0 var(--ink); font: 800 16px var(--font); color: var(--ink); touch-action: none; }
.t-gaz { background: var(--green); width: 96px; height: 96px; }
.t-frein { background: var(--red); color: #fff; }
.t-drift { background: var(--yellow); }
.t-btn.down { transform: translateY(4px); box-shadow: 0 1px 0 var(--ink); }
.t-top { position: absolute; top: calc(max(12px, env(safe-area-inset-top)) + 70px); right: 16px; display: flex; gap: 8px; pointer-events: auto; }
.t-small { padding: 6px 12px; border-radius: 12px; border: 3px solid var(--ink); background: var(--cream); font: 700 14px var(--font); box-shadow: 0 3px 0 var(--ink); }

/* Écrans (complétés à la Tâche 20) */
.screen { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; flex-direction: column; gap: 16px; padding: 16px; pointer-events: auto; background: radial-gradient(circle at 50% 30%, var(--bg1), var(--bg2)); color: var(--cream); text-align: center; }
.btn { font: 800 20px var(--font); padding: 10px 26px; border-radius: 16px; border: 3px solid var(--ink); background: var(--orange); color: var(--ink); box-shadow: 0 5px 0 var(--ink); cursor: pointer; }
.btn:active { transform: translateY(4px); box-shadow: 0 1px 0 var(--ink); }
```

- [ ] **Step 6 : démarrage minimal (sera remplacé par les menus à la Tâche 20)**

`src/app.ts` :
```ts
import * as THREE from 'three';
import { loadAssets } from './render/assets';
import { QualityManager } from './render/quality';
import { AudioEngine } from './audio/audio';
import { KeyboardInput } from './input/keyboard';
import { TouchControls } from './input/touch';
import { InputManager } from './input/manager';
import { Store, safeStorage } from './storage/store';
import { Hud } from './game/hud';
import { GameSession } from './game/session';
import { prepareLevel } from './game/prepare';
import { NIVEAUX_OFFICIELS, cleNiveauOfficiel } from './levels';
import { formatScore, formatTime } from './ui/format';

const $ = (id: string) => document.getElementById(id) as HTMLElement;

/** Version minimale : lance directement le premier niveau (utile pour vérifier le rendu et la conduite). */
export async function startApp(): Promise<void> {
  const ui = $('ui');
  const touch = matchMedia('(pointer: coarse)').matches;
  let renderer: THREE.WebGLRenderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas: $('scene') as HTMLCanvasElement, antialias: true, powerPreference: 'high-performance' });
  } catch {
    ui.innerHTML = '<div class="screen"><h2>WebGL indisponible</h2><p>Essaie avec un navigateur récent.</p></div>';
    return;
  }
  const store = new Store(safeStorage().kv);
  const reglages = store.loadReglages(touch);
  const audio = new AudioEngine();
  audio.setVolume(reglages.volume);
  const unlock = () => audio.unlock();
  window.addEventListener('pointerdown', unlock);
  window.addEventListener('keydown', unlock);
  const keyboard = new KeyboardInput();
  keyboard.attach(window);
  keyboard.capture = true;
  const touchControls = new TouchControls($('touch'));
  touchControls.show(touch);
  const input = new InputManager(keyboard, touchControls);
  ui.innerHTML = '<div class="screen"><h2>Chargement…</h2></div>';
  const assets = await loadAssets(import.meta.env.BASE_URL + 'models/');
  const n = NIVEAUX_OFFICIELS[0];
  const res = prepareLevel(cleNiveauOfficiel(n.id), n.data);
  if (!res.ok) { ui.innerHTML = `<div class="screen"><h2>Niveau invalide</h2><p>${res.erreurs.join('<br>')}</p></div>`; return; }
  ui.innerHTML = '';
  const session: GameSession = new GameSession(res.prepared, {
    renderer, assets, hud: new Hud($('hud')), audio, input, quality: new QualityManager(reglages.qualite, touch), reglages,
  }, {
    onPause: () => {
      session.pause();
      ui.innerHTML = '<div class="screen"><h2>Pause</h2><button class="btn" id="go">Reprendre</button></div>';
      $('go').onclick = () => { ui.innerHTML = ''; session.resume(); };
    },
    onFinish: (r) => {
      session.pause();
      ui.innerHTML = `<div class="screen"><h2>Arrivée !</h2><p>Score ${formatScore(r.score)} — ${formatTime(r.time)}</p><button class="btn" id="go">Rejouer</button></div>`;
      $('go').onclick = () => { ui.innerHTML = ''; session.restart(); };
    },
  });
  session.start();
}
```

`src/main.ts` (remplacer tout) :
```ts
import './styles.css';
import { startApp } from './app';

void startApp();
```

- [ ] **Step 7 : vérifier** — `npx vitest run tests/ui/format.test.ts tests/game/prepare.test.ts` → PASS ; `npm test` → tout PASS ; `npm run build` → OK.

Vérification visuelle (faite par le **contrôleur**, pas par l'agent) : `npm run dev`, ouvrir `http://localhost:5173/drift-club/`, vérifier que la route, le terrain, le décor et la voiture s'affichent, que la voiture se conduit au clavier, que le décompte, le score et l'arrivée fonctionnent, et qu'il n'y a pas d'erreur dans la console.

- [ ] **Step 8 : commit**

```bash
git add src tests
git commit -m "HUD, session de jeu et premier lancement jouable"
```

---

## Tâche 20 : Menus, garage 3D, réglages, pause, résultats

**Files :**
- Create : `src/ui/screens.ts`, `src/render/showroom.ts`
- Modify : `src/app.ts` (remplacer tout le contenu), `src/main.ts` (remplacer tout), `src/styles.css` (ajouter à la fin)
- Test : `tests/ui/screens.test.ts`

**Interfaces :**
- Consumes : tout ce qui précède.
- Produces :
  - `levelSummary(data: unknown): { nom: string; longueur: number; ambiance: 'jour' | 'coucher' } | null` (pur, testable)
  - `class Screens { constructor(root: HTMLElement); loading(msg: string): void; setProgress(p: number): void; error(titre: string, message: string, actions: { label: string; onClick: () => void }[]): void; accueil(o): void; niveaux(o): void; garage(o): void; reglages(o): void; pause(o): void; resultats(o): void; toast(msg: string): void; clear(): void }`
  - `class Showroom { constructor(renderer: THREE.WebGLRenderer, assets: Assets); setCar(id: CarId, color: string): void; start(): void; stop(): void; dispose(): void }`
  - `class App { constructor(); start(): Promise<void> }`

Parcours (spec §8.2, §8.3) : Accueil (Jouer, Garage, Éditeur — « bientôt », Réglages) → Choix du niveau (onglet Officiels ; « Mes niveaux » et « Importer » grisés « bientôt » ; record du mode courant sur chaque carte) → préparation → course → Pause (Reprendre, Recommencer, Menu ; Échap reprend) → Résultats (score, détail drift + bonus, temps vs cible, meilleur drift, « Nouveau record ! », Recommencer, Niveau suivant, Menu). Garage : 3 voitures, 8 couleurs, aperçu 3D tournant. Réglages : mode de conduite (avec description), volume, muet, qualité, accélération automatique (tactile), caméra éloignée. Message « Tourne ton téléphone » en portrait au tactile. Message si le stockage est indisponible. Mise en pause automatique si l'onglet est masqué.

- [ ] **Step 1 : écrire le test (partie pure)**

`tests/ui/screens.test.ts` :
```ts
import { describe, it, expect } from 'vitest';
import { levelSummary } from '../../src/ui/screens';
import { NIVEAUX_OFFICIELS } from '../../src/levels';

describe('levelSummary', () => {
  it('résume un niveau officiel', () => {
    const s = levelSummary(NIVEAUX_OFFICIELS[2].data);
    expect(s).toMatchObject({ nom: 'Col du Loup', ambiance: 'coucher' });
    expect(s!.longueur).toBeGreaterThan(900);
  });
  it('null pour un niveau invalide', () => {
    expect(levelSummary({ format: 1 })).toBeNull();
  });
});
```

Run : `npx vitest run tests/ui/screens.test.ts` → FAIL.

- [ ] **Step 2 : écrans**

`src/ui/screens.ts` :
```ts
import type { CarId, ModeId } from '../core/physics/types';
import { CARS, CAR_IDS } from '../core/physics/cars';
import { MODE_IDS, MODE_NOMS } from '../core/physics/assists';
import type { RaceResult } from '../core/race/race';
import { validateLevel } from '../core/level/validate';
import type { Reglages, RecordEntry, Qualite } from '../storage/store';
import { COULEURS } from './couleurs';
import { formatScore, formatTime } from './format';

export function levelSummary(data: unknown): { nom: string; longueur: number; ambiance: 'jour' | 'coucher' } | null {
  const v = validateLevel(data);
  if (!v.ok) return null;
  let l = 0;
  const r = v.level.route;
  for (let i = 1; i < r.length; i++) l += Math.hypot(r[i].x - r[i - 1].x, r[i].y - r[i - 1].y, r[i].z - r[i - 1].z);
  return { nom: v.level.nom, longueur: l, ambiance: v.level.ambiance };
}

type Child = Node | string | null | undefined | false;
type Attrs = Record<string, string | boolean | ((e: Event) => void)>;

/** Petit constructeur d'éléments : h('button', { class: 'btn', onclick: f }, 'Texte'). */
export function h<K extends keyof HTMLElementTagNameMap>(tag: K, attrs: Attrs = {}, ...children: Child[]): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (typeof v === 'function') el.addEventListener(k.slice(2), v as EventListener);
    else if (typeof v === 'boolean') { if (v) el.setAttribute(k, ''); }
    else el.setAttribute(k, v);
  }
  for (const c of children) if (c !== null && c !== undefined && c !== false) el.append(c);
  return el;
}

const DESCRIPTIONS_VOITURES: Record<CarId, string> = {
  equilibree: 'Coupé fastback prévisible, pour débuter.',
  legere: 'Petit coupé des années 80, agile : on la fait glisser par le poids.',
  turbo: 'Grosse GT turbo, puissante : décroche au moindre coup de gaz.',
};

const DESCRIPTIONS_MODES: Record<ModeId, string> = {
  arcade: 'Bouton Drift : glissade guidée, pas de tête-à-queue.',
  semi: 'On lance le drift soi-même, contre-braquage aidé.',
  exigeant: 'Aucune aide. Tout se dose à la main.',
};

export interface NiveauCarte { nom: string; detail: string; record: RecordEntry | null }

export class Screens {
  private progressEl: HTMLElement | null = null;
  private toastTimer = 0;

  constructor(private readonly root: HTMLElement) {}

  private show(...nodes: HTMLElement[]): void {
    this.root.replaceChildren(...nodes);
    this.progressEl = null;
  }

  clear(): void {
    this.show();
  }

  loading(msg: string): void {
    const bar = h('i');
    this.show(h('div', { class: 'screen' }, h('h1', { class: 'logo' }, 'Drift', h('span', {}, 'Club')), h('p', {}, msg), h('div', { class: 'load' }, bar)));
    this.progressEl = bar;
  }

  setProgress(p: number): void {
    if (this.progressEl) this.progressEl.style.width = `${Math.round(p * 100)}%`;
  }

  error(titre: string, message: string, actions: { label: string; onClick: () => void }[]): void {
    this.show(h('div', { class: 'screen' }, h('div', { class: 'panel' },
      h('h2', {}, titre),
      h('p', { class: 'pre' }, message),
      h('div', { class: 'row' }, ...actions.map((a) => h('button', { class: 'btn', onclick: a.onClick }, a.label))),
    )));
  }

  accueil(o: { onJouer(): void; onGarage(): void; onEditeur(): void; onReglages(): void; persistent: boolean }): void {
    this.show(h('div', { class: 'screen accueil' },
      h('h1', { class: 'logo big' }, 'Drift', h('span', {}, 'Club')),
      h('div', { class: 'menu' },
        h('button', { class: 'btn big', onclick: o.onJouer }, 'Jouer'),
        h('button', { class: 'btn sec', onclick: o.onGarage }, 'Garage'),
        h('button', { class: 'btn sec', onclick: o.onEditeur }, 'Éditeur ', h('small', {}, 'bientôt')),
        h('button', { class: 'btn sec', onclick: o.onReglages }, 'Réglages'),
      ),
      h('p', { class: 'hint' }, 'Z/W ou ↑ accélérer · S ou ↓ freiner · Q/A, D ou ← → tourner · Espace frein à main · R replacer · C caméra · Échap pause'),
      !o.persistent && h('p', { class: 'warn' }, 'Stockage indisponible : tes records et réglages ne seront pas enregistrés.'),
    ));
  }

  niveaux(o: { cartes: NiveauCarte[]; mode: ModeId; voiture: CarId; onChoisir(i: number): void; onGarage(): void; onReglages(): void; onRetour(): void }): void {
    this.show(h('div', { class: 'screen' }, h('div', { class: 'panel wide' },
      h('h2', {}, 'Choisis un niveau'),
      h('div', { class: 'tabs' },
        h('button', { class: 'tab on' }, 'Officiels'),
        h('button', { class: 'tab', disabled: true }, 'Mes niveaux · bientôt'),
        h('button', { class: 'tab', disabled: true }, 'Importer · bientôt'),
      ),
      h('p', { class: 'sub' }, 'Mode ', h('b', {}, MODE_NOMS[o.mode]), ' · Voiture ', h('b', {}, CARS[o.voiture].nom)),
      h('div', { class: 'cards' }, ...o.cartes.map((c, i) =>
        h('button', { class: 'card', onclick: () => o.onChoisir(i) },
          h('span', { class: 'num' }, String(i + 1)),
          h('b', {}, c.nom),
          h('small', {}, c.detail),
          h('span', { class: 'rec' }, c.record ? `Record : ${formatScore(c.record.score)}` : 'Pas encore de record'),
        ))),
      h('div', { class: 'row' },
        h('button', { class: 'btn sec', onclick: o.onRetour }, 'Retour'),
        h('button', { class: 'btn sec', onclick: o.onGarage }, 'Garage'),
        h('button', { class: 'btn sec', onclick: o.onReglages }, 'Réglages'),
      ),
    )));
  }

  garage(o: { voiture: CarId; couleur: string; onChange(voiture: CarId, couleur: string): void; onRetour(): void }): void {
    let voiture = o.voiture, couleur = o.couleur;
    const render = () => {
      this.show(h('div', { class: 'screen garage' }, h('div', { class: 'panel side' },
        h('h2', {}, 'Garage'),
        h('div', { class: 'choices' }, ...CAR_IDS.map((id) =>
          h('button', { class: 'choice' + (id === voiture ? ' on' : ''), onclick: () => { voiture = id; o.onChange(voiture, couleur); render(); } },
            h('b', {}, CARS[id].nom), h('small', {}, DESCRIPTIONS_VOITURES[id])))),
        h('div', { class: 'swatches' }, ...COULEURS.map((c) =>
          h('button', { class: 'swatch' + (c.hex === couleur ? ' on' : ''), style: `background:${c.hex}`, title: c.nom, 'aria-label': c.nom, onclick: () => { couleur = c.hex; o.onChange(voiture, couleur); render(); } }))),
        h('button', { class: 'btn', onclick: o.onRetour }, 'Retour'),
      )));
    };
    render();
  }

  reglages(o: { reglages: Reglages; touch: boolean; onChange(r: Reglages): void; onRetour(): void }): void {
    const r = { ...o.reglages };
    const change = () => { o.onChange({ ...r }); render(); };
    const QUALITES: [Qualite, string][] = [['auto', 'Auto'], ['basse', 'Basse'], ['haute', 'Haute']];
    const render = () => {
      this.show(h('div', { class: 'screen' }, h('div', { class: 'panel wide' },
        h('h2', {}, 'Réglages'),
        h('h3', {}, 'Mode de conduite'),
        h('div', { class: 'choices row3' }, ...MODE_IDS.map((m) =>
          h('button', { class: 'choice' + (m === r.mode ? ' on' : ''), onclick: () => { r.mode = m; change(); } },
            h('b', {}, MODE_NOMS[m]), h('small', {}, DESCRIPTIONS_MODES[m])))),
        h('h3', {}, 'Son'),
        h('div', { class: 'line' },
          h('input', { type: 'range', min: '0', max: '1', step: '0.05', value: String(r.volume), oninput: (e: Event) => { r.volume = parseFloat((e.target as HTMLInputElement).value); o.onChange({ ...r }); } }),
          h('label', { class: 'check' }, h('input', { type: 'checkbox', checked: r.muet, onchange: (e: Event) => { r.muet = (e.target as HTMLInputElement).checked; change(); } }), 'Muet'),
        ),
        h('h3', {}, 'Qualité graphique'),
        h('div', { class: 'seg' }, ...QUALITES.map(([q, label]) =>
          h('button', { class: 'tab' + (q === r.qualite ? ' on' : ''), onclick: () => { r.qualite = q; change(); } }, label))),
        h('h3', {}, 'Conduite'),
        h('label', { class: 'check' }, h('input', { type: 'checkbox', checked: r.cameraLoin, onchange: (e: Event) => { r.cameraLoin = (e.target as HTMLInputElement).checked; change(); } }), 'Caméra éloignée (touche C)'),
        o.touch && h('label', { class: 'check' }, h('input', { type: 'checkbox', checked: r.accelAuto, onchange: (e: Event) => { r.accelAuto = (e.target as HTMLInputElement).checked; change(); } }), 'Accélération automatique (tactile)'),
        h('button', { class: 'btn', onclick: o.onRetour }, 'Retour'),
      )));
    };
    render();
  }

  pause(o: { onReprendre(): void; onRecommencer(): void; onMenu(): void }): void {
    this.show(h('div', { class: 'screen dim' }, h('div', { class: 'panel' },
      h('h2', {}, 'Pause'),
      h('button', { class: 'btn', onclick: o.onReprendre }, 'Reprendre'),
      h('button', { class: 'btn sec', onclick: o.onRecommencer }, 'Recommencer'),
      h('button', { class: 'btn sec', onclick: o.onMenu }, 'Menu'),
    )));
  }

  resultats(o: { result: RaceResult; record: boolean; persistent: boolean; onRecommencer(): void; onSuivant: (() => void) | null; onMenu(): void }): void {
    const r = o.result;
    const ecart = r.time - r.targetTime;
    this.show(h('div', { class: 'screen dim' }, h('div', { class: 'panel' },
      h('h2', {}, 'Arrivée !'),
      o.record && h('div', { class: 'badge' }, o.persistent ? 'Nouveau record !' : 'Nouveau record (non enregistré)'),
      h('div', { class: 'score' }, formatScore(r.score)),
      h('table', { class: 'detail' },
        h('tr', {}, h('td', {}, 'Points de drift'), h('td', {}, formatScore(r.driftPoints))),
        h('tr', {}, h('td', {}, 'Bonus de temps'), h('td', {}, formatScore(r.bonus))),
        h('tr', {}, h('td', {}, 'Temps'), h('td', {}, `${formatTime(r.time)} (${ecart <= 0 ? '−' : '+'}${formatTime(Math.abs(ecart))} / cible)`)),
        h('tr', {}, h('td', {}, 'Meilleur drift'), h('td', {}, formatScore(r.bestDrift))),
      ),
      h('div', { class: 'row' },
        h('button', { class: 'btn', onclick: o.onRecommencer }, 'Recommencer'),
        o.onSuivant && h('button', { class: 'btn', onclick: o.onSuivant }, 'Niveau suivant'),
        h('button', { class: 'btn sec', onclick: o.onMenu }, 'Menu'),
      ),
    )));
  }

  toast(msg: string): void {
    const t = h('div', { class: 'toast' }, msg);
    this.root.append(t);
    window.clearTimeout(this.toastTimer);
    this.toastTimer = window.setTimeout(() => t.remove(), 2200);
  }
}

```

- [ ] **Step 3 : aperçu 3D du garage**

`src/render/showroom.ts` :
```ts
import * as THREE from 'three';
import type { CarId } from '../core/physics/types';
import type { Assets } from './assets';
import { CarView } from './carView';
import { toonMaterial } from './materials';

export class Showroom {
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(35, 1, 0.1, 100);
  private view: CarView | null = null;
  private angle = 0.6;
  private raf = 0;
  private last = 0;
  private running = false;

  constructor(private readonly renderer: THREE.WebGLRenderer, private readonly assets: Assets) {
    this.scene.background = new THREE.Color(0x2a2f45);
    this.scene.add(new THREE.HemisphereLight(0xdfe8ff, 0x3b3350, 1.2));
    const sun = new THREE.DirectionalLight(0xfff1dd, 2.2);
    sun.position.set(4, 8, 5);
    this.scene.add(sun);
    const floor = new THREE.Mesh(new THREE.CylinderGeometry(4, 4, 0.2, 48), toonMaterial({ color: 0x3b4260 }));
    floor.position.y = -0.1;
    this.scene.add(floor);
    this.camera.position.set(5.5, 2.4, 6.5);
    this.camera.lookAt(0, 0.7, 0);
  }

  setCar(id: CarId, color: string): void {
    if (this.view) { this.scene.remove(this.view.root); this.view.dispose(); }
    this.view = new CarView(this.assets.cars[id], color, false);
    this.scene.add(this.view.root);
  }

  private readonly frame = (now: number): void => {
    if (!this.running) return;
    this.raf = requestAnimationFrame(this.frame);
    const dt = Math.min(0.1, (now - this.last) / 1000);
    this.last = now;
    this.angle += dt * 0.5;
    const w = window.innerWidth, h = window.innerHeight;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    if (w > 800) this.camera.setViewOffset(w, h, -w * 0.18, 0, w, h);
    else this.camera.clearViewOffset();
    this.camera.updateProjectionMatrix();
    this.view?.update({ x: 0, y: 0, z: 0, heading: this.angle, steer: 0.25, wheelSpin: 0, groundPitch: 0, groundRoll: 0, pitch: 0, roll: 0 });
    this.renderer.render(this.scene, this.camera);
  };

  start(): void {
    if (this.running) return;
    this.running = true;
    this.last = performance.now();
    this.raf = requestAnimationFrame(this.frame);
  }

  stop(): void {
    this.running = false;
    cancelAnimationFrame(this.raf);
    this.renderer.clear();
  }

  dispose(): void {
    this.stop();
    this.view?.dispose();
  }
}
```

- [ ] **Step 4 : l'application complète**

`src/app.ts` (remplacer tout) :
```ts
import * as THREE from 'three';
import { loadAssets, type Assets } from './render/assets';
import { QualityManager } from './render/quality';
import { Showroom } from './render/showroom';
import { AudioEngine } from './audio/audio';
import { KeyboardInput } from './input/keyboard';
import { TouchControls } from './input/touch';
import { InputManager } from './input/manager';
import { Store, safeStorage, type Reglages } from './storage/store';
import { Hud } from './game/hud';
import { GameSession, type DebugHook } from './game/session';
import { prepareLevel, type PreparedLevel } from './game/prepare';
import { NIVEAUX_OFFICIELS, cleNiveauOfficiel } from './levels';
import { Screens, levelSummary } from './ui/screens';
import { formatDistance } from './ui/format';
import type { RaceResult } from './core/race/race';

const $ = (id: string) => document.getElementById(id) as HTMLElement;

export class App {
  private renderer!: THREE.WebGLRenderer;
  private store!: Store;
  private persistent = true;
  private reglages!: Reglages;
  private assets: Assets | null = null;
  private readonly screens = new Screens($('ui'));
  private readonly hud = new Hud($('hud'));
  private readonly audio = new AudioEngine();
  private readonly keyboard = new KeyboardInput();
  private readonly touchControls = new TouchControls($('touch'));
  private readonly input = new InputManager(this.keyboard, this.touchControls);
  private readonly touch = matchMedia('(pointer: coarse)').matches;
  private session: GameSession | null = null;
  private showroom: Showroom | null = null;
  private current: { index: number; prepared: PreparedLevel } | null = null;
  private onEscape: (() => void) | null = null;

  constructor(private readonly debug: DebugHook | null = null) {}

  async start(): Promise<void> {
    try {
      this.renderer = new THREE.WebGLRenderer({ canvas: $('scene') as HTMLCanvasElement, antialias: true, powerPreference: 'high-performance' });
    } catch {
      this.screens.error('WebGL indisponible', "Ton navigateur ou ta carte graphique ne permet pas d'afficher la 3D. Essaie avec un navigateur récent (Chrome, Firefox, Edge ou Safari).", []);
      return;
    }
    this.renderer.setSize(window.innerWidth, window.innerHeight, false);
    const s = safeStorage();
    this.store = new Store(s.kv);
    this.persistent = s.persistent;
    this.reglages = this.store.loadReglages(this.touch);
    this.audio.setVolume(this.reglages.volume);
    this.audio.setMuted(this.reglages.muet);
    this.keyboard.attach(window);

    const unlock = () => this.audio.unlock();
    window.addEventListener('pointerdown', unlock);
    window.addEventListener('keydown', unlock);
    window.addEventListener('keydown', (e) => { if (e.code === 'Escape' && this.onEscape) { const f = this.onEscape; this.onEscape = null; f(); } });
    document.addEventListener('visibilitychange', () => { if (document.hidden && this.session) this.pauseRace(); });
    $('app').append(Object.assign(document.createElement('div'), { className: 'portrait', textContent: 'Tourne ton téléphone en mode paysage' }));

    await this.chargerModeles();
  }

  private async chargerModeles(): Promise<void> {
    this.screens.loading('Chargement des modèles…');
    try {
      this.assets = await loadAssets(import.meta.env.BASE_URL + 'models/', (p) => this.screens.setProgress(p));
      this.showroom = new Showroom(this.renderer, this.assets);
      this.accueil();
    } catch {
      this.screens.error('Chargement impossible', "Les modèles 3D n'ont pas pu être chargés. Vérifie ta connexion.", [
        { label: 'Réessayer', onClick: () => void this.chargerModeles() },
      ]);
    }
  }

  private save(): void {
    this.store.saveReglages(this.reglages);
  }

  private accueil(): void {
    this.showroom?.stop();
    this.screens.accueil({
      persistent: this.persistent,
      onJouer: () => this.niveaux(),
      onGarage: () => this.garage(() => this.accueil()),
      onEditeur: () => this.screens.toast("L'éditeur arrive bientôt !"),
      onReglages: () => this.reglagesEcran(() => this.accueil()),
    });
  }

  private niveaux(): void {
    this.showroom?.stop();
    const cartes = NIVEAUX_OFFICIELS.map((n) => {
      const s = levelSummary(n.data);
      return {
        nom: s?.nom ?? n.id,
        detail: s ? `${formatDistance(s.longueur)} · ${s.ambiance === 'jour' ? 'Jour' : 'Coucher de soleil'}` : '',
        record: this.store.getRecord(cleNiveauOfficiel(n.id), this.reglages.mode),
      };
    });
    this.screens.niveaux({
      cartes, mode: this.reglages.mode, voiture: this.reglages.voiture,
      onChoisir: (i) => void this.lancer(i),
      onGarage: () => this.garage(() => this.niveaux()),
      onReglages: () => this.reglagesEcran(() => this.niveaux()),
      onRetour: () => this.accueil(),
    });
  }

  private garage(retour: () => void): void {
    if (this.showroom) {
      this.showroom.setCar(this.reglages.voiture, this.reglages.couleur);
      this.showroom.start();
    }
    this.screens.garage({
      voiture: this.reglages.voiture,
      couleur: this.reglages.couleur,
      onChange: (voiture, couleur) => {
        this.reglages.voiture = voiture;
        this.reglages.couleur = couleur;
        this.save();
        this.showroom?.setCar(voiture, couleur);
      },
      onRetour: () => { this.showroom?.stop(); retour(); },
    });
  }

  private reglagesEcran(retour: () => void): void {
    this.screens.reglages({
      reglages: this.reglages,
      touch: this.touch,
      onChange: (r) => {
        this.reglages = r;
        this.audio.setVolume(r.volume);
        this.audio.setMuted(r.muet);
        this.save();
      },
      onRetour: retour,
    });
  }

  private async lancer(index: number): Promise<void> {
    if (!this.assets) return;
    this.showroom?.stop();
    this.screens.loading('Préparation du niveau…');
    await new Promise((r) => setTimeout(r, 30));
    const n = NIVEAUX_OFFICIELS[index];
    const res = prepareLevel(cleNiveauOfficiel(n.id), n.data);
    if (!res.ok) {
      this.screens.error('Niveau invalide', res.erreurs.join('\n'), [{ label: 'Retour', onClick: () => this.niveaux() }]);
      return;
    }
    this.session?.dispose();
    this.current = { index, prepared: res.prepared };
    this.session = new GameSession(res.prepared, {
      renderer: this.renderer, assets: this.assets, hud: this.hud, audio: this.audio, input: this.input,
      quality: new QualityManager(this.reglages.qualite, this.touch), reglages: this.reglages, debug: this.debug,
    }, {
      onFinish: (r) => this.arrivee(r),
      onPause: () => this.pauseRace(),
    });
    this.screens.clear();
    this.keyboard.capture = true;
    this.touchControls.show(this.touch || this.input.touchActive);
    this.session.start();
  }

  private reprendre(): void {
    this.screens.clear();
    this.touchControls.show(this.touch || this.input.touchActive);
    this.session?.resume();
  }

  private pauseRace(): void {
    if (!this.session) return;
    this.session.pause();
    this.save();
    this.touchControls.show(false);
    this.onEscape = () => this.reprendre();
    this.screens.pause({
      onReprendre: () => { this.onEscape = null; this.reprendre(); },
      onRecommencer: () => { this.onEscape = null; this.screens.clear(); this.touchControls.show(this.touch || this.input.touchActive); this.session?.restart(); },
      onMenu: () => { this.onEscape = null; this.quitterCourse(); },
    });
  }

  private arrivee(r: RaceResult): void {
    const cur = this.current;
    if (!cur || !this.session) return;
    this.session.pause();
    this.save();
    this.touchControls.show(false);
    const record = this.store.submitRecord(cur.prepared.key, this.reglages.mode, {
      score: r.score, temps: r.time, voiture: this.reglages.voiture, meilleurDrift: r.bestDrift, date: new Date().toISOString().slice(0, 10),
    });
    const next = cur.index + 1 < NIVEAUX_OFFICIELS.length ? cur.index + 1 : -1;
    this.screens.resultats({
      result: r, record, persistent: this.persistent,
      onRecommencer: () => { this.screens.clear(); this.touchControls.show(this.touch || this.input.touchActive); this.session?.restart(); },
      onSuivant: next >= 0 ? () => void this.lancer(next) : null,
      onMenu: () => this.quitterCourse(),
    });
  }

  private quitterCourse(): void {
    this.session?.dispose();
    this.session = null;
    this.keyboard.capture = false;
    this.touchControls.show(false);
    this.niveaux();
  }
}
```

`src/main.ts` (remplacer tout) :
```ts
import './styles.css';
import { App } from './app';

void new App().start();
```

- [ ] **Step 5 : styles des menus** (ajouter à la fin de `src/styles.css`)

```css
/* Menus */
.screen.dim { background: rgba(21, 19, 28, .55); }
.logo { margin: 0; font-size: 56px; font-weight: 800; color: var(--yellow); -webkit-text-stroke: 4px var(--ink); paint-order: stroke fill; letter-spacing: 1px; line-height: 1; transform: rotate(-4deg); }
.logo span { color: var(--orange); margin-left: 8px; }
.logo.big { font-size: clamp(56px, 12vw, 110px); }
.menu { display: flex; flex-direction: column; gap: 12px; width: min(320px, 90vw); }
.btn.big { font-size: 28px; padding: 14px; background: var(--yellow); }
.btn.sec { background: var(--cream); }
.btn small { font-size: 13px; opacity: .6; }
.btn:disabled { opacity: .5; cursor: default; }
.hint { font-size: 14px; opacity: .75; max-width: 640px; }
.warn { background: var(--red); color: #fff; border: 3px solid var(--ink); border-radius: 12px; padding: 4px 12px; }
.panel { background: var(--cream); color: var(--ink); border: 4px solid var(--ink); border-radius: 24px; box-shadow: 0 8px 0 var(--ink); padding: 20px 24px; display: flex; flex-direction: column; gap: 12px; width: min(420px, 94vw); max-height: 92vh; overflow-y: auto; text-align: left; }
.panel.wide { width: min(760px, 94vw); }
.panel h2 { margin: 0; font-size: 32px; font-weight: 800; }
.panel h3 { margin: 6px 0 0; font-size: 16px; text-transform: uppercase; letter-spacing: 1px; opacity: .6; }
.panel .pre { white-space: pre-line; }
.row { display: flex; gap: 10px; flex-wrap: wrap; }
.tabs, .seg { display: flex; gap: 6px; flex-wrap: wrap; }
.tab { font: 700 15px var(--font); padding: 6px 14px; border-radius: 12px; border: 3px solid var(--ink); background: #fff; cursor: pointer; }
.tab.on { background: var(--yellow); }
.tab:disabled { opacity: .45; cursor: default; }
.sub { margin: 0; }
.cards { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 12px; }
.card { position: relative; text-align: left; font-family: var(--font); background: #fff; border: 3px solid var(--ink); border-radius: 18px; box-shadow: 0 5px 0 var(--ink); padding: 12px 14px 12px 56px; cursor: pointer; display: flex; flex-direction: column; gap: 2px; }
.card:active { transform: translateY(4px); box-shadow: 0 1px 0 var(--ink); }
.card .num { position: absolute; left: 12px; top: 12px; width: 34px; height: 34px; border-radius: 50%; background: var(--orange); border: 3px solid var(--ink); display: grid; place-items: center; font-weight: 800; }
.card b { font-size: 20px; }
.card small { opacity: .7; }
.card .rec { font-size: 14px; font-weight: 700; color: #7a5a00; }
.choices { display: flex; flex-direction: column; gap: 8px; }
.choices.row3 { flex-direction: row; flex-wrap: wrap; }
.choices.row3 .choice { flex: 1 1 180px; }
.choice { text-align: left; font-family: var(--font); background: #fff; border: 3px solid var(--ink); border-radius: 14px; padding: 8px 12px; cursor: pointer; display: flex; flex-direction: column; }
.choice.on { background: var(--yellow); box-shadow: 0 4px 0 var(--ink); }
.choice b { font-size: 18px; }
.choice small { opacity: .75; }
.swatches { display: flex; flex-wrap: wrap; gap: 8px; }
.swatch { width: 38px; height: 38px; border-radius: 50%; border: 3px solid var(--ink); cursor: pointer; }
.swatch.on { outline: 4px solid var(--orange); outline-offset: 2px; }
.screen.garage { background: none; align-items: flex-start; justify-content: center; }
.panel.side { width: min(360px, 94vw); }
.line { display: flex; align-items: center; gap: 14px; }
.line input[type=range] { flex: 1; }
.check { display: flex; align-items: center; gap: 8px; font-weight: 700; cursor: pointer; }
.check input { width: 20px; height: 20px; }
.load { width: min(320px, 80vw); height: 16px; background: var(--cream); border: 3px solid var(--ink); border-radius: 10px; overflow: hidden; }
.load i { display: block; height: 100%; width: 0; background: var(--orange); transition: width .2s; }
.badge { align-self: flex-start; background: var(--green); border: 3px solid var(--ink); border-radius: 12px; padding: 2px 12px; font-weight: 800; }
.score { font-size: 56px; font-weight: 800; color: var(--orange); -webkit-text-stroke: 3px var(--ink); paint-order: stroke fill; line-height: 1; }
.detail { border-collapse: collapse; font-size: 17px; }
.detail td { padding: 3px 0; }
.detail td:last-child { text-align: right; font-weight: 800; font-variant-numeric: tabular-nums; }
.toast { position: absolute; left: 50%; bottom: 40px; transform: translateX(-50%); background: var(--cream); border: 3px solid var(--ink); border-radius: 14px; padding: 8px 18px; font-weight: 800; box-shadow: 0 4px 0 var(--ink); pointer-events: none; }
.portrait { display: none; }
@media (orientation: portrait) and (pointer: coarse) {
  .portrait { display: grid; place-items: center; position: fixed; inset: 0; z-index: 10; background: var(--bg2); color: var(--cream); font-size: 24px; font-weight: 800; text-align: center; padding: 24px; }
}
@media (max-width: 800px) {
  .screen.garage { align-items: flex-end; }
  .panel.side { max-height: 55vh; }
}
```

- [ ] **Step 6 : vérifier** — `npx vitest run tests/ui/screens.test.ts` → PASS ; `npm test` → tout PASS ; `npm run build` → OK. Vérification visuelle par le **contrôleur** : parcours complet des menus, garage 3D, réglages, course, pause (Échap), résultats, record, niveau suivant, en taille ordinateur et mobile (375 × 812 et paysage 812 × 375).

- [ ] **Step 7 : commit**

```bash
git add src tests
git commit -m "Menus : accueil, choix du niveau, garage 3D, réglages, pause et résultats"
```

---

## Tâche 21 : Panneau de réglage `?debug`

**Files :**
- Create : `src/debug/panel.ts`
- Modify : `src/main.ts` (remplacer tout)
- Test : `tests/debug/panel.test.ts`

**Interfaces :**
- Consumes : `DebugHook` (T19), `CarParams`, `AssistParams`, `CarState` (T7), `ChaseConfig` (T16), `DEFAULT_SCORE_PARAMS` (T9), `DEG` (T2).
- Produces : `sliderSpec(value: number): { min: number; max: number; step: number }`, `numericKeys(obj: object): string[]`, `isDebug(search: string): boolean`, `class DebugPanel implements DebugHook`.

Le panneau modifie **directement** les objets de paramètres (`CARS[id]`, `MODES[mode]`, `DEFAULT_SCORE_PARAMS`, config caméra) : la simulation les lit par référence à chaque pas, le changement est immédiat. « Copier les paramètres » copie un JSON de toutes les sections dans le presse-papiers.

- [ ] **Step 1 : écrire les tests**

`tests/debug/panel.test.ts` :
```ts
import { describe, it, expect } from 'vitest';
import { sliderSpec, numericKeys, isDebug } from '../../src/debug/panel';

describe('panneau de réglage', () => {
  it('bornes des curseurs', () => {
    expect(sliderSpec(10)).toEqual({ min: 0, max: 30, step: 0.1 });
    expect(sliderSpec(0)).toEqual({ min: 0, max: 1, step: 0.01 });
    expect(sliderSpec(-2).min).toBe(-6);
  });
  it('seulement les champs numériques', () => {
    expect(numericKeys({ a: 1, b: 'x', c: true, d: null, e: 2.5 })).toEqual(['a', 'e']);
  });
  it('détecte ?debug', () => {
    expect(isDebug('?debug')).toBe(true);
    expect(isDebug('?x=1&debug=1')).toBe(true);
    expect(isDebug('')).toBe(false);
  });
});
```

Run : `npx vitest run tests/debug/panel.test.ts` → FAIL.

- [ ] **Step 2 : implémenter**

`src/debug/panel.ts` :
```ts
import type { DebugHook } from '../game/session';
import type { AssistParams, CarParams, CarState } from '../core/physics/types';
import type { ChaseConfig } from '../render/camera';
import { DEFAULT_SCORE_PARAMS } from '../core/scoring/score';
import { DEG } from '../core/math/vec';

export function sliderSpec(value: number): { min: number; max: number; step: number } {
  if (value === 0) return { min: 0, max: 1, step: 0.01 };
  const a = Math.abs(value) * 3;
  return { min: value < 0 ? -a : 0, max: a, step: Number((a / 300).toPrecision(2)) };
}

export function numericKeys(obj: object): string[] {
  return Object.entries(obj).filter(([, v]) => typeof v === 'number').map(([k]) => k);
}

export function isDebug(search: string): boolean {
  return new URLSearchParams(search).has('debug');
}

export class DebugPanel implements DebugHook {
  private readonly root = document.createElement('div');
  private readonly readout = document.createElement('pre');
  private sections: { titre: string; obj: Record<string, unknown> }[] = [];
  private acc = 0;
  private frames = 0;

  constructor() {
    this.root.className = 'debug';
    document.body.append(this.root);
  }

  attach(car: CarParams, assists: AssistParams, cam: ChaseConfig): void {
    this.sections = [
      { titre: `Voiture (${car.nom})`, obj: car as unknown as Record<string, unknown> },
      { titre: 'Aides du mode', obj: assists as unknown as Record<string, unknown> },
      { titre: 'Score', obj: DEFAULT_SCORE_PARAMS as unknown as Record<string, unknown> },
      { titre: 'Caméra', obj: cam as unknown as Record<string, unknown> },
    ];
    this.root.replaceChildren();
    const bar = document.createElement('div');
    bar.className = 'debug-bar';
    const copy = document.createElement('button');
    copy.textContent = 'Copier les paramètres';
    copy.onclick = () => {
      const data = Object.fromEntries(this.sections.map((s) => [s.titre, s.obj]));
      void navigator.clipboard?.writeText(JSON.stringify(data, null, 2));
      copy.textContent = 'Copié !';
      setTimeout(() => { copy.textContent = 'Copier les paramètres'; }, 1200);
    };
    const hide = document.createElement('button');
    hide.textContent = 'Masquer';
    hide.onclick = () => this.root.classList.toggle('folded');
    bar.append(copy, hide);
    this.root.append(bar, this.readout);
    for (const s of this.sections) {
      const h = document.createElement('h4');
      h.textContent = s.titre;
      this.root.append(h);
      for (const key of numericKeys(s.obj)) {
        const value = s.obj[key] as number;
        const spec = sliderSpec(value);
        const row = document.createElement('label');
        const name = document.createElement('span');
        name.textContent = key;
        const input = document.createElement('input');
        input.type = 'range';
        input.min = String(spec.min);
        input.max = String(spec.max);
        input.step = String(spec.step);
        input.value = String(value);
        const out = document.createElement('code');
        out.textContent = value.toPrecision(4);
        input.oninput = () => {
          const v = parseFloat(input.value);
          s.obj[key] = v;
          out.textContent = v.toPrecision(4);
        };
        row.append(name, input, out);
        this.root.append(row);
      }
    }
  }

  frame(car: CarState, dt: number): void {
    this.acc += dt;
    this.frames++;
    if (this.acc < 0.2) return;
    const fps = this.frames / this.acc;
    this.acc = 0;
    this.frames = 0;
    this.readout.textContent =
      `β ${(car.beta / DEG).toFixed(1)}°  ·  ${(car.speed * 3.6).toFixed(0)} km/h  ·  lacet ${car.yawRate.toFixed(2)} rad/s\n` +
      `glisse arr. ${car.rearSlip.toFixed(2)}  ·  braquage ${(car.steer / DEG).toFixed(1)}°  ·  ${fps.toFixed(0)} i/s`;
  }
}
```

Ajouter à la fin de `src/styles.css` :
```css
.debug { position: fixed; top: 8px; right: 8px; width: 330px; max-height: 92vh; overflow-y: auto; z-index: 20; background: rgba(21, 19, 28, .88); color: #eee; font: 12px/1.3 ui-monospace, monospace; padding: 8px; border-radius: 10px; pointer-events: auto; }
.debug.folded > :not(.debug-bar) { display: none; }
.debug-bar { display: flex; gap: 6px; }
.debug button { font: 12px ui-monospace, monospace; }
.debug h4 { margin: 8px 0 2px; color: var(--yellow); }
.debug label { display: grid; grid-template-columns: 120px 1fr 56px; gap: 4px; align-items: center; }
.debug pre { margin: 6px 0; white-space: pre-wrap; color: #9fe; }
```

`src/main.ts` (remplacer tout) :
```ts
import './styles.css';
import { App } from './app';
import { DebugPanel, isDebug } from './debug/panel';

void new App(isDebug(location.search) ? new DebugPanel() : null).start();
```

- [ ] **Step 3 : vérifier** — `npx vitest run tests/debug/panel.test.ts` → PASS ; `npm test` → tout PASS ; `npm run build` → OK.

- [ ] **Step 4 : commit**

```bash
git add src tests
git commit -m "Panneau de réglage ?debug : paramètres modifiables en direct et copie JSON"
```

---

## Tâche 22 : README et vérification finale

**Files :**
- Create : `README.md`

- [ ] **Step 1 : écrire le README**

`README.md` :
````markdown
# Drift Club

Jeu de drift en 3D dans le navigateur : enchaîne les drifts sur des routes de montagne et fais le plus de points avant la ligne d'arrivée.

**Jouer :** https://tonoplas909.github.io/drift-club/

## Principe

- Un drift compte dès que la voiture glisse de plus de 15° au-dessus de 30 km/h. Plus l'angle et la vitesse sont grands, plus il rapporte.
- Enchaîne les drifts pour monter le **combo** (jusqu'à x5). Un drift est **encaissé** quand tu te redresses proprement.
- Un **choc** contre une barrière ou le décor, un tête-à-queue ou un replacement font **perdre** le drift en cours et le combo.
- À l'arrivée, un **bonus de temps** récompense les courses rapides.

## Modes de conduite

| Mode | Pour qui |
|---|---|
| **Arcade** | Bouton Drift : glissade guidée, pas de tête-à-queue. Idéal au tactile. |
| **Semi-arcade** | On lance le drift soi-même (frein à main, coup de gaz), contre-braquage aidé. |
| **Exigeant** | Aucune aide. |

Trois voitures : **L'Équilibrée** (pour débuter), **La Légère** (agile) et **La Turbo** (puissante). Les records sont enregistrés par niveau et par mode.

## Commandes

| Action | Clavier |
|---|---|
| Accélérer | Z / W / ↑ |
| Freiner / reculer | S / ↓ |
| Tourner | Q / A / D / ← → |
| Frein à main (Drift en Arcade) | Espace |
| Replacer sur la route | R |
| Caméra proche / éloignée | C |
| Pause | Échap / P |
| Muet / plein écran | M / F |

Au tactile : glisse le pouce gauche pour tourner, boutons Gaz, Frein et Drift à droite (accélération automatique activable dans les réglages).

## Développement

```bash
npm install
npm run dev      # serveur local
npm test         # tests
npm run build    # version publiée (dist/)
```

Ajoute `?debug` à l'adresse pour afficher le panneau de réglage de la conduite.

Chaque push sur `main` lance les tests puis publie le jeu sur GitHub Pages (Settings → Pages → Source : GitHub Actions).

## Crédits

Décor 3D : [Kenney](https://www.kenney.nl) (Nature Kit), licence CC0 — voir `public/models/LICENCE-kenney.txt`. Les voitures, d'inspiration japonaise, sont générées par le code du jeu.
````

- [ ] **Step 2 : vérification finale**

Run : `npm test` → tout PASS (noter le nombre de tests).
Run : `npx tsc --noEmit` → aucune erreur.
Run : `npm run build` → `dist/` produit ; noter la taille de `dist/assets/*.js`.

- [ ] **Step 3 : commit**

```bash
git add README.md
git commit -m "README : principe du jeu, modes, commandes et crédits"
```

---

## Après le plan (contrôleur)

1. Revue de l'ensemble de la branche (agent externe « œil neuf », demandé par Macalamar) : tests, build, parcours complet dans le navigateur (ordinateur et mobile), lecture critique du code.
2. Session de **réglage de la sensation de drift** avec `?debug` (spec §4.3 : le semi-arcade d'abord), puis report des valeurs dans `cars.ts` / `assists.ts`.
3. Push sur `main` **seulement avec l'accord de Macalamar**, qui active GitHub Pages (Settings → Pages → Source : GitHub Actions).
