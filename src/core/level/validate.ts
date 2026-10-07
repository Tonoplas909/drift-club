import { LIMITES, ENVIRONNEMENTS, AMBIANCES } from './types';
import type { Level, PointRoute, Barriere, ObjetPlace, Ambiance, CoteBarriere, TypeObjet, Environnement, PlanEau, ZoneClipping, CoteClipping } from './types';
import { aire, autoIntersection } from '../env/eau';
import * as dm from '../math/dmath';

export type ResultatValidation = { ok: true; level: Level } | { ok: false; erreurs: string[] };

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
  if (typeof raw.environnement !== 'string' || !(ENVIRONNEMENTS as readonly string[]).includes(raw.environnement)) {
    e.push(`environnement : valeur inconnue (attendu : ${ENVIRONNEMENTS.join(', ')}).`);
  }
  if (typeof raw.ambiance !== 'string' || !(AMBIANCES as readonly string[]).includes(raw.ambiance)) {
    e.push('ambiance : « jour », « coucher » ou « nuit ».');
  }
  if (raw.meteo !== undefined && raw.meteo !== 'pluie') e.push('meteo : « pluie » ou absente.');

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
      const d = dm.hypot(b.x - a.x, b.y - a.y, b.z - a.z);
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

  // Zones de clipping (optionnelles)
  const clipping: ZoneClipping[] = [];
  if (raw.clipping !== undefined) {
    if (!Array.isArray(raw.clipping)) {
      e.push('clipping : doit être une liste.');
    } else {
      if (raw.clipping.length > LIMITES.clippingMax) e.push(`clipping : ${LIMITES.clippingMax} zones au maximum.`);
      raw.clipping.forEach((z: unknown, i: number) => {
        if (
          !isObj(z) || !isInt(z.de) || !isInt(z.a) || (z.cote !== 'gauche' && z.cote !== 'droite') ||
          z.de < 0 || z.a <= z.de || z.a > route.length - 1
        ) {
          e.push(`clipping[${i}] : « de » < « a » (indices de points) et côté gauche ou droite.`);
          return;
        }
        clipping.push({ de: z.de, a: z.a, cote: z.cote as CoteClipping });
      });
    }
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

  // Lacs (optionnels)
  const eau: PlanEau[] = [];
  if (raw.eau !== undefined) {
    if (!Array.isArray(raw.eau)) {
      e.push('eau : doit être une liste de lacs.');
    } else {
      if (raw.eau.length > LIMITES.eauMax) e.push(`eau : ${LIMITES.eauMax} lacs au maximum.`);
      raw.eau.forEach((l: unknown, i: number) => {
        const n = i + 1;
        if (!isObj(l) || !isNum(l.niveau) || !Array.isArray(l.points)) {
          e.push(`eau[${i}] : hauteur de la surface (niveau) et liste de points x, z attendues.`);
          return;
        }
        if (l.niveau < LIMITES.eauNiveauMin || l.niveau > LIMITES.eauNiveauMax) {
          e.push(`eau[${i}].niveau : hauteur hors limites (${LIMITES.eauNiveauMin}–${LIMITES.eauNiveauMax}).`);
        }
        if (l.points.length < LIMITES.eauPointsMin || l.points.length > LIMITES.eauPointsMax) {
          e.push(`eau[${i}] : le lac ${n} doit avoir ${LIMITES.eauPointsMin} à ${LIMITES.eauPointsMax} points.`);
          return;
        }
        const pts: { x: number; z: number }[] = [];
        for (const p of l.points) {
          if (!isObj(p) || !isNum(p.x) || !isNum(p.z)) {
            e.push(`eau[${i}] : chaque point du lac doit avoir x et z (nombres).`);
            return;
          }
          pts.push({ x: p.x, z: p.z });
        }
        if (autoIntersection(pts)) e.push(`eau[${i}] : le contour du lac ${n} se croise lui-même.`);
        else if (aire(pts) < LIMITES.eauAireMin) e.push(`eau[${i}] : le lac ${n} est trop petit (au moins ${LIMITES.eauAireMin} m²).`);
        eau.push({ points: pts, niveau: l.niveau });
      });
    }
  }

  if (e.length > 0) return { ok: false, erreurs: e };
  return {
    ok: true,
    level: {
      format: 1,
      nom: (nom as string).trim(),
      auteur: auteur as string,
      environnement: raw.environnement as Environnement,
      ambiance: raw.ambiance as Ambiance,
      route,
      barrieres,
      decor,
      objets,
      ...(eau.length > 0 ? { eau } : {}),
      ...(clipping.length > 0 ? { clipping } : {}),
      ...(raw.meteo === 'pluie' ? { meteo: 'pluie' as const } : {}),
    },
  };
}
