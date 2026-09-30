import type { Level, PointRoute, Barriere, CoteBarriere, TypeObjet } from '../level/types';
import { LIMITES } from '../level/types';
import { clamp } from '../math/vec';
import { aire, autoIntersection } from '../env/eau';

export type CoteEdit = 'gauche' | 'droite' | 'ext';

export interface BarrierFlags {
  gauche: boolean;
  droite: boolean;
  ext: boolean;
}

export interface PickSegment {
  seg: number;
  t: number;
  cote: 'gauche' | 'droite';
  dist: number;
}

// Points

/** Ajoute un point à la fin de la route. */
export function addPoint(l: Level, x: number, z: number): void {
  const lastPoint = l.route[l.route.length - 1];
  l.route.push({ x, z, y: lastPoint.y, l: lastPoint.l });
}

/** Insère un point entre deux points existants. Décale les indices des barrières. */
export function insertPoint(l: Level, seg: number, x: number, z: number): void {
  const p1 = l.route[seg];
  const p2 = l.route[seg + 1];
  const newY = (p1.y + p2.y) / 2;
  const newL = (p1.l + p2.l) / 2;
  l.route.splice(seg + 1, 0, { x, z, y: newY, l: newL });

  // Décale les indices des barrières
  // Une barrière covering segment seg (from point seg to seg+1) should now cover two segments after insertion
  for (const b of l.barrieres) {
    // Si la barrière couvre le segment où on insère (segment seg = entre points seg et seg+1)
    if (b.de <= seg && seg < b.a) {
      // Prolonge la barrière pour inclure le nouveau segment
      b.a++;
    } else {
      // Sinon, décale simplement les indices si nécessaire
      if (b.de > seg) b.de++;
      if (b.a > seg) b.a++;
    }
  }
}

/** Déplace un point. */
export function movePoint(l: Level, i: number, x: number, z: number): void {
  const p = l.route[i];
  p.x = x;
  p.z = z;
}

/** Modifie la hauteur et/ou la largeur d'un point. */
export function setPoint(l: Level, i: number, props: { y?: number; l?: number }): void {
  const p = l.route[i];
  if (props.y !== undefined) p.y = clamp(props.y, LIMITES.hauteurMin, LIMITES.hauteurMax);
  if (props.l !== undefined) p.l = clamp(props.l, LIMITES.largeurMin, LIMITES.largeurMax);
}

/** Supprime un point. Renvoie false si la route n'a que 2 points. Raccourcit les barrières qui le couvraient. */
export function deletePoint(l: Level, i: number): boolean {
  if (l.route.length <= LIMITES.pointsMin) return false;
  l.route.splice(i, 1);
  const out: Barriere[] = [];
  for (const b of l.barrieres) {
    const de = b.de > i ? b.de - 1 : b.de;
    const a = Math.min(b.a >= i ? b.a - 1 : b.a, l.route.length - 1);
    if (a > de) out.push({ de, a, cote: b.cote });
  }
  l.barrieres = out;
  return true;
}

// Barriers

/** Retourne les drapeaux des barrières pour un segment donné. */
export function barrierAt(l: Level, seg: number): BarrierFlags {
  const flags = { gauche: false, droite: false, ext: false };
  for (const b of l.barrieres) {
    if (b.de <= seg && seg < b.a) {
      if (b.cote === 'gauche') flags.gauche = true;
      else if (b.cote === 'droite') flags.droite = true;
      else if (b.cote === 'deux') {
        flags.gauche = true;
        flags.droite = true;
      } else if (b.cote === 'ext') flags.ext = true;
    }
  }
  return flags;
}

/** Bascule une barrière sur un côté ('ext' exclut gauche/droite sur le tronçon, et inversement). */
export function toggleBarrier(l: Level, seg: number, cote: CoteEdit): void {
  const flags = toFlags(l);
  const f = flags[seg];
  if (!f) return;
  if (cote === 'ext') {
    f.ext = !f.ext;
    if (f.ext) f.gauche = f.droite = false;
  } else {
    f[cote] = !f[cote];
    if (f[cote]) f.ext = false;
  }
  l.barrieres = fromFlags(flags);
}

/** Barrières → drapeaux par tronçon (le tronçon i va du point i au point i+1). */
function toFlags(l: Level): BarrierFlags[] {
  const n = Math.max(0, l.route.length - 1);
  const flags: BarrierFlags[] = Array.from({ length: n }, () => ({ gauche: false, droite: false, ext: false }));
  for (const b of l.barrieres) {
    for (let s = Math.max(0, b.de); s < Math.min(b.a, n); s++) {
      const f = flags[s];
      if (b.cote === 'ext') f.ext = true;
      if (b.cote === 'gauche' || b.cote === 'deux') f.gauche = true;
      if (b.cote === 'droite' || b.cote === 'deux') f.droite = true;
    }
  }
  return flags;
}

/** Drapeaux → plages minimales triées ('ext' prioritaire, gauche+droite → 'deux'). */
function fromFlags(flags: BarrierFlags[]): Barriere[] {
  const code = (f: BarrierFlags): CoteBarriere | null =>
    f.ext ? 'ext' : f.gauche && f.droite ? 'deux' : f.gauche ? 'gauche' : f.droite ? 'droite' : null;
  const out: Barriere[] = [];
  let cur: Barriere | null = null;
  flags.forEach((f, s) => {
    const c = code(f);
    if (cur && cur.cote === c) { cur.a = s + 1; return; }
    cur = c ? { de: s, a: s + 1, cote: c } : null;
    if (cur) out.push(cur);
  });
  return out;
}

/** Normalise les barrières : plages fusionnées, triées, sans chevauchement. */
export function normalizeBarriers(l: Level): void {
  l.barrieres = fromFlags(toFlags(l));
}

// Objects

/** Ajoute un objet. Renvoie l'index ou -1 si au-delà de la limite. */
export function addObjet(l: Level, type: TypeObjet, x: number, z: number, rot = 0): number {
  if (l.objets.length >= LIMITES.objetsMax) return -1;
  l.objets.push({ type, x, z, rot: ((rot % 360) + 360) % 360 });
  return l.objets.length - 1;
}

/** Déplace un objet. */
export function moveObjet(l: Level, i: number, x: number, z: number): void {
  const o = l.objets[i];
  o.x = x;
  o.z = z;
}

/** Fait pivoter un objet d'un angle en degrés. */
export function rotateObjet(l: Level, i: number, deltaDeg: number): void {
  const o = l.objets[i];
  o.rot = (o.rot + deltaDeg) % 360;
  if (o.rot < 0) o.rot += 360;
}

/** Supprime un objet. */
export function deleteObjet(l: Level, i: number): void {
  l.objets.splice(i, 1);
}

// Lacs

/** Hauteur de surface proposée pour un nouveau lac : 3 m sous le point le plus bas de la route. */
export function niveauLacParDefaut(l: Level): number {
  const bas = l.route.reduce((m, p) => Math.min(m, p.y), Infinity);
  return clamp(Math.round(bas - 3), LIMITES.eauNiveauMin, LIMITES.eauNiveauMax);
}

/** Pourquoi ce contour ne peut pas devenir un lac (message en français), ou null s'il convient. */
export function erreurContourLac(l: Level, points: { x: number; z: number }[]): string | null {
  if ((l.eau?.length ?? 0) >= LIMITES.eauMax) return `Maximum ${LIMITES.eauMax} lacs.`;
  if (points.length < LIMITES.eauPointsMin) return `Il faut au moins ${LIMITES.eauPointsMin} points pour un lac.`;
  if (points.length > LIMITES.eauPointsMax) return `Maximum ${LIMITES.eauPointsMax} points par lac.`;
  if (autoIntersection(points)) return 'Le contour du lac se croise lui-même.';
  if (aire(points) < LIMITES.eauAireMin) return `Ce lac est trop petit (au moins ${LIMITES.eauAireMin} m²).`;
  return null;
}

/** Ajoute un lac de contour `points`. Renvoie l'index, ou -1 si le contour est refusé (voir `erreurContourLac`). */
export function addLac(l: Level, points: { x: number; z: number }[], niveau = niveauLacParDefaut(l)): number {
  if (erreurContourLac(l, points) !== null) return -1;
  l.eau = [...(l.eau ?? []), { points: points.map((p) => ({ x: p.x, z: p.z })), niveau }];
  return l.eau.length - 1;
}

/** Supprime un lac (le champ `eau` disparaît quand il n'en reste aucun). */
export function deleteLac(l: Level, i: number): void {
  if (!l.eau || !l.eau[i]) return;
  l.eau.splice(i, 1);
  if (l.eau.length === 0) delete l.eau;
}

/** Change la hauteur de la surface d'un lac. */
export function setNiveauLac(l: Level, i: number, niveau: number): void {
  if (l.eau?.[i]) l.eau[i].niveau = clamp(niveau, LIMITES.eauNiveauMin, LIMITES.eauNiveauMax);
}

// Picking helpers

/** Trouve le point le plus proche. Renvoie -1 si aucun n'est dans maxDist. */
export function nearestPoint(l: Level, x: number, z: number, maxDist: number): number {
  let best = -1;
  let bestDist = Infinity;
  for (let i = 0; i < l.route.length; i++) {
    const p = l.route[i];
    const d = Math.hypot(p.x - x, p.z - z);
    if (d < bestDist) {
      bestDist = d;
      best = i;
    }
  }
  return bestDist <= maxDist ? best : -1;
}

/** Trouve le segment de route le plus proche. */
export function nearestSegment(l: Level, x: number, z: number, maxDist: number): PickSegment | null {
  let best: PickSegment | null = null;
  let bestDist = Infinity;

  for (let seg = 0; seg < l.route.length - 1; seg++) {
    const p1 = l.route[seg];
    const p2 = l.route[seg + 1];
    const dx = p2.x - p1.x;
    const dz = p2.z - p1.z;
    const lenSq = dx * dx + dz * dz;

    if (lenSq < 1e-9) continue;

    const t = clamp(((x - p1.x) * dx + (z - p1.z) * dz) / lenSq, 0, 1);
    const px = p1.x + t * dx;
    const pz = p1.z + t * dz;
    const d = Math.hypot(px - x, pz - z);

    if (d < bestDist) {
      bestDist = d;
      // Calcule le côté du segment direction
      // Tangente = (dx, dz) / len, normale gauche = (dz, -dx) / len
      const len = Math.sqrt(lenSq);
      const nx = dz / len;
      const nz = -dx / len;
      const side = (x - px) * nx + (z - pz) * nz;
      const cote = side < 0 ? 'droite' : 'gauche';

      best = { seg, t, cote, dist: d };
    }
  }

  return best && bestDist <= maxDist ? best : null;
}

/** Trouve l'objet le plus proche. Renvoie -1 si aucun n'est dans maxDist. */
export function nearestObjet(l: Level, x: number, z: number, maxDist: number): number {
  let best = -1;
  let bestDist = Infinity;
  for (let i = 0; i < l.objets.length; i++) {
    const o = l.objets[i];
    const d = Math.hypot(o.x - x, o.z - z);
    if (d < bestDist) {
      bestDist = d;
      best = i;
    }
  }
  return bestDist <= maxDist ? best : -1;
}

// Factory

/** Crée un niveau par défaut valide. */
export function newLevel(): Level {
  // Crée un S doux d'environ 400 m
  const route: PointRoute[] = [];
  route.push({ x: 0, z: 0, y: 0, l: 10 });
  route.push({ x: 50, z: 50, y: 10, l: 10 });
  route.push({ x: 100, z: 100, y: 20, l: 10 });
  route.push({ x: 50, z: 150, y: 30, l: 10 });
  route.push({ x: 0, z: 200, y: 20, l: 10 });
  route.push({ x: -50, z: 250, y: 10, l: 10 });
  route.push({ x: 0, z: 300, y: 0, l: 10 });

  return {
    format: 1,
    nom: 'Nouveau niveau',
    auteur: '',
    environnement: 'montagne',
    ambiance: 'jour',
    route,
    barrieres: [],
    decor: { graine: 1, densite: 0.6 },
    objets: [],
  };
}

/** Copie profonde d'un niveau. */
export function copyLevel(level: Level, nom?: string): Level {
  return structuredClone({
    ...level,
    nom: nom !== undefined ? nom : level.nom,
  });
}
