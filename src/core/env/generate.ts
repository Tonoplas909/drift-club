import type { Level } from '../level/types';
import type { TrackData } from '../track/buildTrack';
import type { Terrain } from '../track/terrain';
import { nearestSampleWithin } from '../track/projection';
import { mulberry32 } from '../math/rng';
import { fbm } from '../math/noise';
import { smoothstep, DEG } from '../math/vec';
import { COLLIDER_RADIUS, SOLID_DISTANCE, VARIANTS, type DecorKind, type EnvItem, type Environment } from './types';
import { THEMES, type Essence } from './themes';

/** Au-dessus de ce seuil, le masque de forêt vaut « forêt ». */
export function forestThreshold(densite: number): number {
  return 1 - (0.35 + 0.5 * densite);
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
        add({
          kind: ex.kind, variant: Math.min(VARIANTS[ex.kind] - 1, Math.floor(variantR * VARIANTS[ex.kind])),
          x, y: terrain.heightAt(x, z), z, rot: rotR * Math.PI * 2, scale: 0.8 + 0.5 * scaleR, solid: true, manual: false,
        });
      }
    }
  }

  // 5. Arbres en bosquets (6 tirages par case, toujours consommés → déterminisme)
  const thr = forestThreshold(densite);
  const arbres = theme.arbres;
  const b = track.bounds;
  const trees = (cell: number, dMin: number, dMax: number): void => {
    for (let gz = b.minZ - dMax; gz < b.maxZ + dMax; gz += cell) {
      for (let gx = b.minX - dMax; gx < b.maxX + dMax; gx += cell) {
        const x = gx + rng() * cell, z = gz + rng() * cell;
        const pick = rng(), kindR = rng(), variantR = rng(), rotR = rng(), scaleR = rng();
        const d = terrain.distanceToRoad(x, z);
        if (d < dMin || d >= dMax) continue;
        if (inCorridor(x, z, 3, d) || nearManual(x, z, 4)) continue;
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
