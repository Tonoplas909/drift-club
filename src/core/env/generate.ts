import type { Level } from '../level/types';
import type { TrackData } from '../track/buildTrack';
import type { Terrain } from '../track/terrain';
import { nearestSampleWithin } from '../track/projection';
import { mulberry32 } from '../math/rng';
import { fbm } from '../math/noise';
import { smoothstep, DEG } from '../math/vec';
import { COLLIDER_RADIUS, SOLID_DISTANCE, VARIANTS, type DecorKind, type EnvItem, type Environment } from './types';
import { THEMES, type Essence } from './themes';
import { batimentDe, boiteDe } from './ville';

/** Au-dessus de ce seuil, le masque de forêt vaut « forêt » (`min` : plancher du thème, ex. parcs rares en ville). */
export function forestThreshold(densite: number, min = 0): number {
  return Math.max(1 - (0.35 + 0.5 * densite), min);
}

/** Rectangle orienté au sol (emprise d'un bâtiment) : axes unitaires, demi-dimensions, rayon du cercle circonscrit. */
interface Emprise { x: number; z: number; ex: number; ez: number; fx: number; fz: number; hw: number; hd: number; r: number }

/** Emprise d'un objet de cap `rot` (convention ψ : x local = (cos ψ, −sin ψ), z local = (sin ψ, cos ψ)). */
function empriseDe(x: number, z: number, rot: number, w: number, d: number): Emprise {
  return { x, z, ex: Math.cos(rot), ez: -Math.sin(rot), fx: Math.sin(rot), fz: Math.cos(rot), hw: w / 2, hd: d / 2, r: Math.hypot(w, d) / 2 };
}

/** Sommets d'une emprise (dans l'ordre : autour du rectangle). */
function sommets(e: Emprise): [number, number][] {
  const c = (a: number, b: number): [number, number] => [e.x + a * e.hw * e.ex + b * e.hd * e.fx, e.z + a * e.hw * e.ez + b * e.hd * e.fz];
  return [c(-1, -1), c(1, -1), c(1, 1), c(-1, 1)];
}

/** Deux rectangles orientés se chevauchent-ils (marge `m` m entre eux) ? Séparation par les 4 axes des côtés. */
function chevauche(a: Emprise, b: Emprise, m: number): boolean {
  const dx = b.x - a.x, dz = b.z - a.z;
  for (const [ux, uz] of [[a.ex, a.ez], [a.fx, a.fz], [b.ex, b.ez], [b.fx, b.fz]]) {
    const ra = a.hw * Math.abs(ux * a.ex + uz * a.ez) + a.hd * Math.abs(ux * a.fx + uz * a.fz);
    const rb = b.hw * Math.abs(ux * b.ex + uz * b.ez) + b.hd * Math.abs(ux * b.fx + uz * b.fz);
    if (Math.abs(dx * ux + dz * uz) > ra + rb + m) return false;
  }
  return true;
}

/** Le point (x, z) est-il dans l'emprise agrandie de `m` m ? */
function contient(e: Emprise, x: number, z: number, m: number): boolean {
  const dx = x - e.x, dz = z - e.z;
  return Math.abs(dx * e.ex + dz * e.ez) <= e.hw + m && Math.abs(dx * e.fx + dz * e.fz) <= e.hd + m;
}

/** Points régulièrement espacés (≤ `pas` m) sur le pourtour d'une emprise, sommets compris. */
function pourtour(e: Emprise, pas: number): [number, number][] {
  const v = sommets(e), out: [number, number][] = [];
  for (let k = 0; k < 4; k++) {
    const [ax, az] = v[k], [bx, bz] = v[(k + 1) % 4];
    const n = Math.max(1, Math.ceil(Math.hypot(bx - ax, bz - az) / pas));
    for (let j = 0; j < n; j++) out.push([ax + ((bx - ax) * j) / n, az + ((bz - az) * j) / n]);
  }
  return out;
}

export function forestMask(x: number, z: number, graine: number): number {
  return fbm(x / 120, z / 120, graine + 11);
}

/** Côté (+1 gauche, −1 droite) d'une barrière « ext » : extérieur du virage, inchangé sur les quasi-droites. */
export function coteExterieur(k: number, precedent: number): number {
  if (k > 1 / 400) return -1;
  if (k < -1 / 400) return 1;
  return precedent;
}

/** Essence tirée selon les poids du thème à l'altitude relative `t` (0 = bas de la route, 1 = 60 m plus haut). */
function pickEssence(essences: readonly Essence[], r: number, t: number): Essence {
  let total = 0;
  for (const e of essences) total += e.bas + (e.haut - e.bas) * t;
  const target = r * total;
  let acc = 0;
  for (const e of essences) {
    acc += e.bas + (e.haut - e.bas) * t;
    if (target < acc) return e;
  }
  return essences[essences.length - 1];
}

export function generateEnvironment(level: Level, track: TrackData, terrain: Terrain): Environment {
  const env: Environment = { items: [], circles: [], segments: [], barriers: [] };
  const { graine, densite } = level.decor;
  const rng = mulberry32(graine);
  const theme = THEMES[level.environnement];
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
  const posés: { x: number; z: number; r: number }[] = [];
  const add = (item: EnvItem): void => {
    env.items.push(item);
    const box = boiteDe(item.kind, item.variant);
    if (theme.bord.sansChevauchement) {
      posés.push({ x: item.x, z: item.z, r: box ? (Math.hypot(box[0], box[1]) / 2) * item.scale : COLLIDER_RADIUS[item.kind] * item.scale });
    }
    if (!item.solid) return;
    if (box) {
      // emprise rectangulaire : 4 segments (bâtiments, voitures garées, abribus…)
      const v = sommets(empriseDe(item.x, item.z, item.rot, box[0] * item.scale, box[1] * item.scale));
      for (let k = 0; k < 4; k++) env.segments.push({ ax: v[k][0], az: v[k][1], bx: v[(k + 1) % 4][0], bz: v[(k + 1) % 4][1] });
    } else {
      env.circles.push({ x: item.x, z: item.z, r: COLLIDER_RADIUS[item.kind] * item.scale });
    }
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
        extSide = coteExterieur(sp.k, extSide);
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
    add({ kind: theme.objets[o.type], variant: 0, x: o.x, y: terrain.heightAt(o.x, o.z), z: o.z, rot, scale: 1, solid: true, manual: true });
  }

  // 3. Chevrons à l'extérieur des virages de rayon < 30 m (tous les 8 m, à w + 2,2 m)
  const chevron = theme.bord.chevron, borne = theme.bord.borne;
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
          if (!chevron || nearManual(x, z, 2)) continue;
          add({ kind: chevron, variant: 0, x, y: terrain.heightAt(x, z), z, rot: Math.atan2(-side * sp.nx, -side * sp.nz), scale: 1, solid: true, manual: false });
        }
        for (let k = Math.max(0, runStart - 10); k < Math.min(S.length, i + 10); k++) tightZone[k] = 1;
      }
      runStart = -1;
    }
  }

  // 4. Bornes tous les 25 m, des deux côtés, à w + 1,6 m
  for (let s = 10; s < track.length - 10; s += 25) {
    const i = Math.min(S.length - 1, Math.round(s));
    if (!borne || tightZone[i]) continue;
    const sp = S[i];
    for (const side of [1, -1]) {
      if ((side > 0 ? leftCovered : rightCovered)[i]) continue;
      const off = sp.w + 1.6;
      const x = sp.x + sp.nx * side * off, z = sp.z + sp.nz * side * off;
      if (nearManual(x, z, 2)) continue;
      add({ kind: borne, variant: 0, x, y: terrain.heightAt(x, z), z, rot: Math.atan2(sp.tx, sp.tz), scale: 1, solid: true, manual: false });
    }
  }

  // 4b. Petits objets de bord de route propres au thème (tirages toujours consommés → déterminisme)
  for (const ex of theme.bord.extras) {
    for (let s = 6; s < track.length - 6; s += ex.tousLes) {
      for (const side of [1, -1]) {
        const pick = rng(), jitter = rng(), rotR = rng(), scaleR = rng(), variantR = rng();
        if (pick >= ex.probabilite) continue;
        const i = Math.min(S.length - 1, Math.max(0, Math.round(s + (jitter - 0.5) * ex.tousLes * 0.8)));
        if (tightZone[i] || (side > 0 ? leftCovered : rightCovered)[i]) continue;
        const sp = S[i];
        const off = sp.w + ex.decalage;
        const x = sp.x + sp.nx * side * off, z = sp.z + sp.nz * side * off;
        if (nearManual(x, z, 3) || inCorridor(x, z, 3, terrain.distanceToRoad(x, z))) continue;
        const variant = Math.min(VARIANTS[ex.kind] - 1, Math.floor(variantR * VARIANTS[ex.kind]));
        const [eMin, eAmp] = ex.echelle ?? [0.8, 0.5];
        const scale = eMin + eAmp * scaleR;
        if (theme.bord.sansChevauchement) {
          const box = boiteDe(ex.kind, variant);
          const r = (box ? Math.hypot(box[0], box[1]) / 2 : COLLIDER_RADIUS[ex.kind]) * scale;
          if (posés.some((p) => (p.x - x) * (p.x - x) + (p.z - z) * (p.z - z) < (p.r + r + 0.5) * (p.r + r + 0.5))) continue;
        }
        // cap : aléatoire, ou le long de la route (+x local vers l'extérieur, sens aléatoire pour `routeSym`)
        const ori = ex.orientation ?? 'libre';
        const alongRoad = Math.atan2(sp.tx, sp.tz) + (side > 0 ? 0 : Math.PI);
        const rot = ori === 'libre' ? rotR * Math.PI * 2 : ori === 'route' ? alongRoad : alongRoad + (rotR < 0.5 ? 0 : Math.PI);
        add({ kind: ex.kind, variant, x, y: terrain.heightAt(x, z), z, rot, scale, solid: true, manual: false });
      }
    }
  }

  // 4c. Bâtiments (thème ville) : trois rangs, générateur de nombres aléatoires à part (le reste du décor n'en dépend pas)
  const thr = forestThreshold(densite, theme.arbres.seuilMin);
  const emprises: Emprise[] = [];
  const CASE = 48;
  const grille = new Map<number, Emprise[]>();
  const cle = (i: number, j: number): number => (j + 512) * 4096 + (i + 512);
  const casesDe = (e: Emprise, m: number): number[] => {
    const out: number[] = [];
    for (let j = Math.floor((e.z - e.r - m) / CASE); j <= Math.floor((e.z + e.r + m) / CASE); j++) {
      for (let i = Math.floor((e.x - e.r - m) / CASE); i <= Math.floor((e.x + e.r + m) / CASE); i++) out.push(cle(i, j));
    }
    return out;
  };
  const enBatiment = (x: number, z: number, m: number): boolean =>
    emprises.length > 0 && (grille.get(cle(Math.floor(x / CASE), Math.floor(z / CASE))) ?? []).some((e) => contient(e, x, z, m));
  const bat = theme.batiments;
  if (bat) {
    const rb = mulberry32(graine + 4099);
    /** Pose (si la place est libre) un bâtiment de centre (x, z) et de cap `rot` ; renvoie s'il est posé. */
    const poser = (kind: DecorKind, variant: number, x: number, z: number, rot: number): boolean => {
      const b = batimentDe(kind, variant)!;
      const e = empriseDe(x, z, rot, b.w, b.d);
      if (nearManual(x, z, e.r + 2)) return false;
      const pts = [...pourtour(e, 3.5), [x, z] as [number, number]];
      let dMin = Infinity, yMin = Infinity;
      for (const [px, pz] of pts) {
        if (forestMask(px, pz, graine) > thr) return false; // parc
        const ns = nearestSampleWithin(track, px, pz, 10 + bat.recul + 0.5);
        if (ns && ns.dist < S[ns.index].w + bat.recul) return false;
        dMin = Math.min(dMin, terrain.distanceToRoad(px, pz));
        yMin = Math.min(yMin, terrain.heightAt(px, pz));
      }
      const cases = casesDe(e, 1);
      for (const c of cases) {
        for (const o of grille.get(c) ?? []) {
          if ((o.x - x) * (o.x - x) + (o.z - z) * (o.z - z) < (o.r + e.r + 1) * (o.r + e.r + 1) && chevauche(o, e, 1)) return false;
        }
      }
      emprises.push(e);
      for (const c of cases) { const l = grille.get(c); if (l) l.push(e); else grille.set(c, [e]); }
      add({ kind, variant, x, y: yMin - 0.1, z, rot, scale: 1, solid: dMin < SOLID_DISTANCE, manual: false });
      return true;
    };
    // rangs le long de la route : le 2e rang (30 à 50 m) mêle des tours
    const rang = (decale: number, amplitude: number, proba: number, partTours: number): void => {
      for (const side of [1, -1]) {
        for (let s = 3 + rb() * 6; s < track.length - 3;) {
          const pick = rb(), kindR = rb(), variantR = rb(), gapR = rb(), offR = rb();
          const kind: DecorKind = kindR < partTours ? 'tour' : 'immeuble';
          const variant = Math.min(VARIANTS[kind] - 1, Math.floor(variantR * VARIANTS[kind]));
          const b = batimentDe(kind, variant)!;
          const sp = S[Math.min(S.length - 1, Math.round(s + b.w / 2))];
          const off = sp.w + bat.recul + decale + offR * amplitude + b.d / 2;
          const x = sp.x + sp.nx * side * off, z = sp.z + sp.nz * side * off;
          const ok = pick < proba && poser(kind, variant, x, z, Math.atan2(-sp.tz, sp.tx));
          s += ok ? b.w + bat.ecart[0] + bat.ecart[1] * gapR : 5;
        }
      }
    };
    rang(0, 2, bat.rang1, 0);
    rang(24, 14, bat.rang2, 0.4);
    // fond : tours et immeubles isolés jusqu'à 320 m (visuels, hors de portée de la voiture)
    const bb = track.bounds, cell = bat.fond.cellule;
    for (let gz = bb.minZ - 320; gz < bb.maxZ + 320; gz += cell) {
      for (let gx = bb.minX - 320; gx < bb.maxX + 320; gx += cell) {
        const x = gx + rb() * cell, z = gz + rb() * cell;
        const pick = rb(), kindR = rb(), variantR = rb(), rotR = rb();
        const d = terrain.distanceToRoad(x, z);
        if (d < 45 || d >= 320 || pick >= bat.fond.probabilite) continue;
        const kind: DecorKind = kindR < 0.35 ? 'tour' : 'immeuble';
        poser(kind, Math.min(VARIANTS[kind] - 1, Math.floor(variantR * VARIANTS[kind])), x, z, Math.round(rotR * 4) * (Math.PI / 2));
      }
    }
  }

  // 5. Arbres en bosquets (6 tirages par case, toujours consommés → déterminisme)
  const arbres = theme.arbres;
  const b = track.bounds;
  const trees = (cell: number, dMin: number, dMax: number): void => {
    for (let gz = b.minZ - dMax; gz < b.maxZ + dMax; gz += cell) {
      for (let gx = b.minX - dMax; gx < b.maxX + dMax; gx += cell) {
        const x = gx + rng() * cell, z = gz + rng() * cell;
        const pick = rng(), kindR = rng(), variantR = rng(), rotR = rng(), scaleR = rng();
        const d = terrain.distanceToRoad(x, z);
        if (d < dMin || d >= dMax) continue;
        if (inCorridor(x, z, 3, d) || nearManual(x, z, 4) || enBatiment(x, z, 2.5)) continue;
        let p = forestMask(x, z, graine) > thr ? arbres.pForet : arbres.pHors * (0.5 + densite);
        if (d < 12) p *= 0.5;
        if (pick >= p) continue;
        const y = terrain.heightAt(x, z);
        const ess = pickEssence(arbres.essences, kindR, smoothstep(0, 60, y - lowest));
        const [sMin, sAmp] = ess.echelle ?? [0.8, 0.5];
        const nv = VARIANTS[ess.kind];
        add({ kind: ess.kind, variant: Math.min(nv - 1, Math.floor(variantR * nv)), x, y, z, rot: rotR * Math.PI * 2, scale: sMin + sAmp * scaleR, solid: d < SOLID_DISTANCE, manual: false });
      }
    }
  };
  trees(7, 0, 60);
  trees(14, 60, 320);

  // 6. Rochers, plus fréquents sur les pentes
  const roc = theme.rochers;
  for (let gz = b.minZ - 200; gz < b.maxZ + 200; gz += 11) {
    for (let gx = b.minX - 200; gx < b.maxX + 200; gx += 11) {
      const x = gx + rng() * 11, z = gz + rng() * 11;
      const pick = rng(), kindR = rng(), variantR = rng(), rotR = rng(), scaleR = rng();
      const d = terrain.distanceToRoad(x, z);
      if (d >= 200) continue;
      if (inCorridor(x, z, 4, d) || nearManual(x, z, 4)) continue;
      const g = terrain.gradientAt(x, z);
      const slope = Math.hypot(g.gx, g.gz);
      const p = (roc.base + roc.pente * smoothstep(0.25, 0.8, slope)) * (0.5 + densite / 2);
      if (pick >= p) continue;
      const kind: DecorKind = kindR < roc.partHauts ? roc.haut : roc.normal;
      const nv = VARIANTS[kind];
      add({
        kind, variant: Math.min(nv - 1, Math.floor(variantR * nv)),
        x, y: terrain.heightAt(x, z) - 0.3, z, rot: rotR * Math.PI * 2, scale: roc.echelle[0] + roc.echelle[1] * scaleR,
        solid: d < SOLID_DISTANCE, manual: false,
      });
    }
  }

  return env;
}
