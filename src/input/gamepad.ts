import { NO_INPUT, type InputState } from '../core/input';
import { NO_ACTIONS, type Actions } from './keyboard';

/**
 * Manette (API Gamepad, disposition « standard » des manettes Xbox et PlayStation) :
 * gâchette droite = accélérateur, gâchette gauche = frein (dosage progressif), stick gauche (ou croix) = direction,
 * A / Croix = frein à main, B / Rond = replacer, Y / Triangle = caméra, Start / Options = pause, Select / Share = recommencer.
 * Les commandes passent ensuite par `quantifier()` comme celles du clavier : le rejeu serveur n'y voit aucune différence.
 */

/** Réglages de la manette. */
export interface ReglagesManette {
  /** zone morte du stick (0..0,4) : en dessous, la voiture va tout droit */
  zoneMorte: number;
  /** sensibilité de la direction (0 = précise au centre, 1 = linéaire et vive) */
  sensibilite: number;
}

export const MANETTE_DEFAUT: Readonly<ReglagesManette> = Object.freeze({ zoneMorte: 0.15, sensibilite: 0.5 });

/** Ce que l'on lit d'une manette (sous-ensemble de `Gamepad`, pour les tests). */
export interface ManetteBrute {
  readonly connected: boolean;
  readonly axes: readonly number[];
  readonly buttons: readonly { readonly pressed: boolean; readonly value: number }[];
}

const B = { A: 0, B: 1, Y: 3, LB: 4, RB: 5, LT: 6, RT: 7, SELECT: 8, START: 9, GAUCHE: 14, DROITE: 15 } as const;
const ACTIONS_BOUTONS: [number, keyof Actions][] = [[B.B, 'replacer'], [B.Y, 'camera'], [B.START, 'pause'], [B.SELECT, 'recommencer']];
/** sous ce seuil, une gâchette au repos (ou mal calibrée) ne compte pas */
const ZONE_GACHETTE = 0.05;

const borne = (v: number, lo: number, hi: number): number => (v < lo ? lo : v > hi ? hi : v);

/** Axe du stick → direction (−1..1) : zone morte, puis courbe de réponse (exposant 2,2 → 1 selon la sensibilité). */
export function courbeStick(x: number, r: ReglagesManette): number {
  if (!Number.isFinite(x)) return 0;
  const zm = borne(r.zoneMorte, 0, 0.4);
  const a = Math.abs(x);
  if (a <= zm) return 0;
  const n = borne((a - zm) / (1 - zm), 0, 1);
  const expo = 2.2 - 1.2 * borne(r.sensibilite, 0, 1);
  return Math.sign(x) * Math.pow(n, expo);
}

function gachette(gp: ManetteBrute, i: number): number {
  const b = gp.buttons[i];
  if (!b) return 0;
  const v = Number.isFinite(b.value) ? b.value : 0;
  const x = Math.max(v, b.pressed ? 1 : 0);
  return x < ZONE_GACHETTE ? 0 : borne((x - ZONE_GACHETTE) / (1 - ZONE_GACHETTE), 0, 1);
}

const appuye = (gp: ManetteBrute, i: number): boolean => gp.buttons[i]?.pressed ?? false;

/** Commandes de pilotage lues sur une manette. Stick vers la droite = tourner à droite (direction négative). */
export function etatManette(gp: ManetteBrute, r: ReglagesManette): InputState {
  let direction = -courbeStick(gp.axes[0] ?? 0, r);
  if (direction === 0) direction = (appuye(gp, B.GAUCHE) ? 1 : 0) - (appuye(gp, B.DROITE) ? 1 : 0);
  return {
    gaz: gachette(gp, B.RT),
    frein: gachette(gp, B.LT),
    // `+ 0` : jamais de −0 (voir `quantifier`)
    direction: direction + 0,
    freinAMain: appuye(gp, B.A) || appuye(gp, B.RB),
  };
}

/** vrai si la manette est touchée (bouton, gâchette ou stick hors de la zone morte) */
function sollicitee(gp: ManetteBrute): boolean {
  return gp.buttons.some((b) => b.pressed || b.value > 0.2) || gp.axes.some((a) => Math.abs(a) > 0.3);
}

/** Lit les manettes branchées (une seule pilote : la dernière touchée). */
export class GamepadInput {
  reglages: ReglagesManette = { ...MANETTE_DEFAUT };
  /** nom de la manette qui pilote (null : aucune) */
  nom: string | null = null;
  private etat: InputState = { ...NO_INPUT };
  private actions: Actions = { ...NO_ACTIONS };
  private precedents: boolean[] = [];
  private index = -1;

  constructor(private readonly lire: () => readonly (Gamepad | ManetteBrute | null)[] = lireManettes) {}

  /** À appeler une fois par image : met à jour l'état et détecte les appuis (front montant). */
  poll(): void {
    const pads = this.lire();
    // la manette touchée en dernier prend la main
    for (let i = 0; i < pads.length; i++) {
      const p = pads[i];
      if (p?.connected && i !== this.index && sollicitee(p)) { this.index = i; this.precedents = []; }
    }
    const gp = this.index >= 0 ? pads[this.index] : null;
    if (!gp || !gp.connected) {
      this.index = -1; this.nom = null; this.etat = { ...NO_INPUT }; this.precedents = [];
      return;
    }
    this.nom = 'id' in gp && typeof gp.id === 'string' ? gp.id : 'Manette';
    this.etat = etatManette(gp, this.reglages);
    for (const [i, a] of ACTIONS_BOUTONS) {
      const p = appuye(gp, i);
      if (p && this.precedents[i] === false) this.actions[a] = true;
      this.precedents[i] = p;
    }
  }

  get active(): boolean {
    return this.index >= 0;
  }

  state(): InputState {
    return this.etat;
  }

  consumeActions(): Actions {
    const a = this.actions;
    this.actions = { ...NO_ACTIONS };
    return a;
  }

  /** Oublie les appuis pas encore lus. */
  reset(): void {
    this.actions = { ...NO_ACTIONS };
  }
}

function lireManettes(): readonly (Gamepad | null)[] {
  try {
    return typeof navigator !== 'undefined' && navigator.getGamepads ? navigator.getGamepads() : [];
  } catch {
    // API refusée (politique de permissions du site hôte)
    return [];
  }
}
