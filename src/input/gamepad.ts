import { NO_INPUT, type InputState } from '../core/input';
import { NO_ACTIONS, type Actions } from './keyboard';
import { TOUCHES_DEFAUT, type BoutonsManette, type CommandeManette } from './touches';

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
  /** vibrations (drift encaissé, choc, hors piste) sur les manettes qui en ont */
  vibrations: boolean;
}

export const MANETTE_DEFAUT: Readonly<ReglagesManette> = Object.freeze({ zoneMorte: 0.15, sensibilite: 0.5, vibrations: true });

/** Une vibration : moteurs lourd (basses fréquences) et léger (aigus) de 0 à 1, durée en ms. */
export interface Vibration { fort: number; faible: number; duree: number }

/** Drift encaissé : petite impulsion, plus forte avec le multiplicateur (x1 à x5). */
export function vibrationDrift(multiplicateur: number): Vibration {
  const m = borne((multiplicateur - 1) / 4, 0, 1);
  return { fort: 0.15 + 0.45 * m, faible: 0.35 + 0.4 * m, duree: 90 + 90 * m };
}

/** Choc : secousse selon la violence de l'impact (m/s de vitesse perdue). */
export function vibrationChoc(impact: number): Vibration {
  const k = borne(impact / 12, 0.3, 1);
  return { fort: k, faible: 0.6 * k, duree: 120 + 180 * k };
}

/** Hors piste : grondement léger qui grandit avec la vitesse (null à l'arrêt). Rejoué en continu tant qu'on y roule. */
export function vibrationHorsPiste(vitesse: number): Vibration | null {
  if (!(vitesse > 3)) return null;
  const k = borne(vitesse / 25, 0, 1);
  return { fort: 0.08 + 0.17 * k, faible: 0.04 + 0.1 * k, duree: 140 };
}

/** Moteur de vibration d'une manette (Chrome, Edge) ; ailleurs absent. */
interface Vibreur { playEffect(type: 'dual-rumble', p: { duration: number; strongMagnitude: number; weakMagnitude: number }): Promise<unknown> }

/** Ce que l'on lit d'une manette (sous-ensemble de `Gamepad`, pour les tests). */
export interface ManetteBrute {
  readonly connected: boolean;
  readonly axes: readonly number[];
  readonly buttons: readonly { readonly pressed: boolean; readonly value: number }[];
}

const B = { RB: 5, GAUCHE: 14, DROITE: 15 } as const;
const ACTIONS_MANETTE: (keyof Actions & CommandeManette)[] = ['replacer', 'camera', 'pause', 'recommencer'];
/** sous ce seuil, une gâchette au repos (ou mal calibrée) ne compte pas */
const ZONE_GACHETTE = 0.05;

const borne = (v: number, lo: number, hi: number): number => (v < lo ? lo : v > hi ? hi : v);

/** Axe du stick → direction (−1..1) : zone morte, puis courbe de réponse (exposant 2,2 → 1 selon la sensibilité). */
export function courbeStick(x: number, r: Pick<ReglagesManette, 'zoneMorte' | 'sensibilite'>): number {
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

/**
 * Commandes de pilotage lues sur une manette. Stick vers la droite = tourner à droite (direction négative).
 * La croix sert de direction quand le stick est au repos, sauf ceux de ses boutons choisis pour une autre commande.
 */
export function etatManette(gp: ManetteBrute, r: Pick<ReglagesManette, 'zoneMorte' | 'sensibilite'>, b: BoutonsManette = TOUCHES_DEFAUT.manette): InputState {
  const pris = new Set(Object.values(b));
  const croix = (i: number): boolean => !pris.has(i) && appuye(gp, i);
  let direction = -courbeStick(gp.axes[0] ?? 0, r);
  if (direction === 0) direction = (croix(B.GAUCHE) ? 1 : 0) - (croix(B.DROITE) ? 1 : 0);
  return {
    gaz: gachette(gp, b.gaz),
    frein: gachette(gp, b.frein),
    // `+ 0` : jamais de −0 (voir `quantifier`)
    direction: direction + 0,
    // RB reste un second frein à main tant qu'il ne sert à rien d'autre
    freinAMain: appuye(gp, b.freinAMain) || (!pris.has(B.RB) && appuye(gp, B.RB)),
  };
}

/** Premier bouton enfoncé (pour choisir un bouton dans les Réglages), ou null. */
export function boutonAppuye(gp: ManetteBrute): number | null {
  const i = gp.buttons.findIndex((x) => x.pressed || x.value > 0.6);
  return i < 0 ? null : i;
}

/** vrai si la manette est touchée (bouton, gâchette ou stick hors de la zone morte) */
function sollicitee(gp: ManetteBrute): boolean {
  return gp.buttons.some((b) => b.pressed || b.value > 0.2) || gp.axes.some((a) => Math.abs(a) > 0.3);
}

/** Lit les manettes branchées (une seule pilote : la dernière touchée). */
export class GamepadInput {
  reglages: ReglagesManette = { ...MANETTE_DEFAUT };
  /** boutons choisis dans les Réglages */
  boutons: BoutonsManette = { ...TOUCHES_DEFAUT.manette };
  /** nom de la manette qui pilote (null : aucune) */
  nom: string | null = null;
  private etat: InputState = { ...NO_INPUT };
  private actions: Actions = { ...NO_ACTIONS };
  private precedents: boolean[] = [];
  private index = -1;
  /** vibration en cours : jusqu'à quand (ms) et sa force, pour ne pas écraser une secousse par un grondement */
  private vibreJusqua = 0;
  private vibreForce = 0;
  private dernierePad: Gamepad | ManetteBrute | null = null;

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
    this.dernierePad = gp && gp.connected ? gp : null;
    if (!gp || !gp.connected) {
      this.index = -1; this.nom = null; this.etat = { ...NO_INPUT }; this.precedents = [];
      return;
    }
    this.nom = 'id' in gp && typeof gp.id === 'string' ? gp.id : 'Manette';
    this.etat = etatManette(gp, this.reglages, this.boutons);
    for (const a of ACTIONS_MANETTE) {
      const i = this.boutons[a];
      const p = appuye(gp, i);
      if (p && this.precedents[i] === false) this.actions[a] = true;
      this.precedents[i] = p;
    }
  }

  /** Manette qui pilote (lue au dernier `poll`), pour choisir un bouton dans les Réglages. */
  get manette(): ManetteBrute | null {
    return this.dernierePad;
  }

  /** Lit les manettes sans piloter : la première touchée devient celle qui pilote. */
  lireBouton(): number | null {
    this.poll();
    return this.dernierePad ? boutonAppuye(this.dernierePad) : null;
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

  /**
   * Fait vibrer la manette qui pilote (si les vibrations sont activées et que le navigateur sait le faire).
   * Une vibration plus faible que celle en cours ne la coupe pas. `maintenant` en ms.
   */
  vibrer(v: Vibration | null, maintenant: number): void {
    if (!v || !this.reglages.vibrations || this.index < 0) return;
    const force = Math.max(v.fort, v.faible);
    if (maintenant < this.vibreJusqua && force < this.vibreForce) return;
    const act = (this.dernierePad as { vibrationActuator?: Vibreur | null } | null)?.vibrationActuator;
    if (!act || typeof act.playEffect !== 'function') return;
    this.vibreJusqua = maintenant + v.duree;
    this.vibreForce = force;
    try {
      void act.playEffect('dual-rumble', { duration: Math.round(v.duree), strongMagnitude: borne(v.fort, 0, 1), weakMagnitude: borne(v.faible, 0, 1) }).catch(() => {});
    } catch {
      // effet refusé par le navigateur : tant pis
    }
  }

  /** Arrête toute vibration (pause, arrivée). */
  arreterVibrations(): void {
    this.vibreJusqua = 0; this.vibreForce = 0;
    const act = (this.dernierePad as { vibrationActuator?: (Vibreur & { reset?: () => Promise<unknown> }) | null } | null)?.vibrationActuator;
    try { void act?.reset?.().catch(() => {}); } catch { /* rien */ }
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
