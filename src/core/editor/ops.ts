import type { Level, PointRoute, Barriere, ObjetPlace } from '../level/types';
import { LIMITES } from '../level/types';
import { clamp } from '../math/vec';

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

/** Supprime un point. Renvoie false si la route n'a que 2 points. Ajuste les barrières. */
export function deletePoint(l: Level, i: number): boolean {
  if (l.route.length <= LIMITES.pointsMin) return false;
  l.route.splice(i, 1);

  // Ajuste les barrières : décale les indices et supprime les barrières invalides
  const newBarrieres: Barriere[] = [];
  for (const b of l.barrieres) {
    // Une barrière couvre des segments de b.de à b.a-1 (entre points b.de et b.a)
    // Si le point supprimé est à l'intérieur, on supprime la barrière
    // Sinon on décale les indices
    if (b.a <= i) {
      // Barrière avant le point supprimé : inchangée
      newBarrieres.push(b);
    } else if (b.de > i) {
      // Barrière après le point supprimé : décale les indices
      newBarrieres.push({ de: b.de - 1, a: b.a - 1, cote: b.cote });
    }
    // Sinon: b.de <= i < b.a : la barrière est supprimée (elle couvre le point supprimé)
  }
  l.barrieres = newBarrieres;
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

/** Bascule une barrière sur un côté. */
export function toggleBarrier(l: Level, seg: number, cote: CoteEdit): void {
  const flags = barrierAt(l, seg);

  if (cote === 'ext') {
    // Activer ext : désactiver gauche/droite
    if (flags.ext) {
      flags.ext = false;
    } else {
      flags.ext = true;
      flags.gauche = false;
      flags.droite = false;
    }
  } else {
    // Activer gauche/droite : désactiver ext
    if (cote === 'gauche') flags.gauche = !flags.gauche;
    else flags.droite = !flags.droite;
    if (flags.gauche || flags.droite) flags.ext = false;
  }

  // Reconstruit les barrières
  rebuildBarriers(l, seg, flags);
}

/** Reconstruit les barrières pour un segment en particulier. */
function rebuildBarriers(l: Level, seg: number, newFlags: BarrierFlags): void {
  // Supprime les barrières qui chevauchent ce segment
  const newBarrieres: Barriere[] = [];
  for (const b of l.barrieres) {
    if (!(b.de <= seg && seg < b.a)) {
      newBarrieres.push(b);
    }
  }
  l.barrieres = newBarrieres;

  // Fusionne les barrières adjacentes pour ce segment
  normalizeBarriers(l);

  // Ajoute les nouvelles barrières si nécessaire
  if (newFlags.gauche || newFlags.droite || newFlags.ext) {
    const barcode = newFlags.ext ? 'ext' : newFlags.gauche && newFlags.droite ? 'deux' : newFlags.gauche ? 'gauche' : 'droite';

    // Cherche si on peut étendre une barrière existante
    let merged = false;
    for (const b of l.barrieres) {
      if (b.cote === barcode && b.a === seg) {
        b.a = seg + 1;
        merged = true;
        break;
      }
      if (b.cote === barcode && b.de === seg + 1) {
        b.de = seg;
        merged = true;
        break;
      }
    }

    if (!merged) {
      l.barrieres.push({ de: seg, a: seg + 1, cote: barcode as any });
    }

    normalizeBarriers(l);
  }
}

/** Normalise les barrières : fusionne les plages contigues et compresse les formats. */
export function normalizeBarriers(l: Level): void {
  if (l.barrieres.length === 0) return;

  // Étend les barrières 'deux' en deux entrées 'gauche' et 'droite'
  const expanded: Array<{ de: number; a: number; cote: string }> = [];
  for (const b of l.barrieres) {
    if (b.cote === 'deux') {
      expanded.push({ de: b.de, a: b.a, cote: 'gauche' });
      expanded.push({ de: b.de, a: b.a, cote: 'droite' });
    } else {
      expanded.push(b);
    }
  }

  // Trie par côté et par position
  const grouped: Record<string, Array<{ de: number; a: number }>> = {};
  for (const b of expanded) {
    if (!grouped[b.cote]) grouped[b.cote] = [];
    grouped[b.cote].push({ de: b.de, a: b.a });
  }

  // Fusionne les plages contigues pour chaque côté
  const merged: Array<{ de: number; a: number; cote: string }> = [];
  for (const [cote, ranges] of Object.entries(grouped)) {
    ranges.sort((a, b) => a.de - b.de);
    for (let i = 0; i < ranges.length; ) {
      const start = ranges[i].de;
      let end = ranges[i].a;
      let j = i + 1;
      // Fusionne tant que le prochain segment est adjacent ou chevauche
      while (j < ranges.length && ranges[j].de <= end) {
        end = Math.max(end, ranges[j].a);
        j++;
      }
      merged.push({ de: start, a: end, cote });
      i = j;
    }
  }

  // Compresse : convertit gauche+droite en 'deux' quand ils couvrent la même plage
  const final: Barriere[] = [];
  const seen = new Set<string>();

  for (const b of merged) {
    const key = `${b.de}-${b.a}`;
    if (seen.has(key)) continue;
    seen.add(key);

    if (b.cote === 'gauche') {
      const droite = merged.find((x) => x.cote === 'droite' && x.de === b.de && x.a === b.a);
      if (droite) {
        final.push({ de: b.de, a: b.a, cote: 'deux' });
        seen.add(`${droite.de}-${droite.a}`);
        continue;
      }
    } else if (b.cote === 'droite') {
      const gauche = merged.find((x) => x.cote === 'gauche' && x.de === b.de && x.a === b.a);
      if (gauche) {
        // Already handled by gauche case
        continue;
      }
    }

    final.push(b as Barriere);
  }

  final.sort((a, b) => a.de - b.de);
  l.barrieres = final;
}

// Objects

/** Ajoute un objet. Renvoie l'index ou -1 si au-delà de la limite. */
export function addObjet(l: Level, type: any, x: number, z: number, rot = 0): number {
  if (l.objets.length >= LIMITES.objetsMax) return -1;
  l.objets.push({ type, x, z, rot: rot % 360 });
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
