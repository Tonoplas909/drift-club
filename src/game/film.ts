import { RaceSim, type HudData } from '../core/race/race';
import { CARS } from '../core/physics/cars';
import { MODES } from '../core/physics/assists';
import { copyCarState } from '../core/physics/car';
import { lireReplay } from '../core/replay/replay';
import { PAS_MAX, type NiveauPrepare } from '../core/replay/verifier';
import type { CarId, CarState, ModeId } from '../core/physics/types';
import type { TrackData } from '../core/track/buildTrack';
import { SIM_DT } from '../core/constants';

/**
 * « Revoir sa course » : la course est déterministe, on la rejoue depuis son replay et on garde l'état de la voiture
 * à chaque pas (le film), puis on le passe à la vitesse voulue avec des caméras de télévision.
 */
export interface ImageFilm {
  car: CarState;
  hud: HudData;
  /** abscisse le long de la route (m) */
  s: number;
}

export interface Film {
  images: ImageFilm[];
  /** durée en secondes */
  duree: number;
}

/** secondes gardées avant le départ (fin du décompte) et après l'arrivée */
const AVANT = 0.6;
const APRES = 2.5;

/** Rejoue la course ; null si le replay ne mène pas à l'arrivée (niveau modifié, replay abîmé). */
export function tournerFilm(n: NiveauPrepare, voiture: CarId, mode: ModeId, replay: Uint8Array): Film | null {
  const sim = new RaceSim({ level: n.level, track: n.track, terrain: n.terrain, env: n.env, car: CARS[voiture], assists: MODES[mode] });
  const images: ImageFilm[] = [];
  const garder = (): void => { images.push({ car: copyCarState(sim.car), hud: sim.hud(), s: sim.progressS }); };
  let depart = -1;
  const lu = lireReplay(replay, PAS_MAX, (p) => {
    sim.step(p.input, p.replacer);
    if (depart < 0 && sim.phase === 'compte' && sim.countdown > AVANT) return true;
    if (depart < 0) depart = images.length;
    garder();
    return sim.phase !== 'arrivee';
  });
  if (typeof lu === 'string' || !sim.result) return null;
  // la voiture finit sa course en roue libre après la ligne
  const roueLibre = { gaz: 0, frein: 0, direction: 0, freinAMain: false };
  for (let k = 0; k < APRES / SIM_DT; k++) { sim.step(roueLibre); garder(); }
  return { images, duree: (images.length - 1) * SIM_DT };
}

// --- Caméras de télévision ------------------------------------------------------------------------------

export type CameraFilm = 'tele' | 'helico' | 'poursuite' | 'embarquee';
export const CAMERAS_FILM: readonly CameraFilm[] = ['tele', 'helico', 'poursuite', 'embarquee'];
export const NOMS_CAMERAS_FILM: Record<CameraFilm, string> = { tele: 'Bord de route', helico: 'Hélicoptère', poursuite: 'Poursuite', embarquee: 'Embarquée' };

type V3 = [number, number, number];
export interface PlanFilm { pos: V3; cible: V3; fov: number }

/** Postes de caméra au bord de la route, tous les `pas` mètres, à l'extérieur des virages, un peu en hauteur. */
export function postesBordDeRoute(track: TrackData, sol: (x: number, z: number) => number, pas = 70): { s: number; pos: V3 }[] {
  const out: { s: number; pos: V3 }[] = [];
  const S = track.samples;
  for (let s = pas / 2; s < track.length; s += pas) {
    const sp = S[Math.min(S.length - 1, Math.round(s))];
    // extérieur du virage (k > 0 : virage à gauche, l'extérieur est à droite, côté −normale)
    const cote = sp.k > 0 ? -1 : 1;
    const ecart = sp.w + 7;
    const x = sp.x + sp.nx * cote * ecart, z = sp.z + sp.nz * cote * ecart;
    out.push({ s: sp.s, pos: [x, Math.max(sol(x, z), sp.y) + 2.2, z] });
  }
  return out;
}

/** Poste qui filme la voiture : le premier qu'elle n'a pas encore dépassé de plus de 15 m. */
export function planBordDeRoute(postes: { s: number; pos: V3 }[], car: { x: number; y: number; z: number }, s: number): PlanFilm | null {
  if (postes.length === 0) return null;
  let p = postes.find((x) => x.s > s - 15) ?? postes[postes.length - 1];
  // trop loin devant (longue ligne droite) : le précédent
  const i = postes.indexOf(p);
  if (p.s - s > 60 && i > 0) p = postes[i - 1];
  const d = Math.hypot(car.x - p.pos[0], car.z - p.pos[2]);
  // zoom : la voiture garde à peu près la même taille à l'écran
  const fov = Math.max(14, Math.min(60, 2 * Math.atan(6 / Math.max(1, d)) * 180 / Math.PI));
  return { pos: p.pos, cible: [car.x, car.y + 0.6, car.z], fov };
}

/** Hélicoptère : haut, derrière et sur le côté de la voiture, qui tourne lentement autour d'elle. */
export function planHelico(car: { x: number; y: number; z: number }, cap: number, t: number): PlanFilm {
  const a = cap + Math.PI + 0.9 * Math.sin(t * 0.12);
  return { pos: [car.x + Math.sin(a) * 26, car.y + 24, car.z + Math.cos(a) * 26], cible: [car.x, car.y, car.z], fov: 50 };
}
