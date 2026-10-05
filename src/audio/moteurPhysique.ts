/**
 * Moteur « physique » dans un AudioWorklet (voir moteurPhysiqueDsp.ts) : profils des voitures, chargement du
 * module et création du nœud. Sans AudioWorklet (navigateur ancien, page non sécurisée…), le jeu garde la
 * voix synthétique d'origine (oscillateurs de `voices.ts`).
 */
import type { CarId } from '../core/physics/types';
import { MoteurPhysiqueDSP, type ProfilMoteur } from './moteurPhysiqueDsp';

const MIX = { admission: 0.35, bloc: 0.5, sortie: 1 };

/**
 * Un moteur par voiture (`action` ≤ 0,1 : au-delà, le silencieux entre en résonance et le modèle diverge). : nombre de cylindres et longueurs des tubes (échantillons à 44,1 kHz).
 * Tubes courts : timbre plus aigu et nerveux ; longs : plus grave et plein ; silencieux plus grand : plus sourd.
 */
export const PROFILS_MOTEUR: Record<CarId, ProfilMoteur> = {
  // quatre cylindres de référence (réglages d'origine du générateur)
  equilibree: { cylindres: 4, admission: 100, echappement: 100, collecteur: 100, ligne: 128, silencieux: [10, 15, 20, 25], action: 0.1, sortie: 5, allumage: 0.016, mix: MIX, niveau: 0.75 },
  // quatre cylindres léger et pointu : tubes courts
  legere: { cylindres: 4, admission: 78, echappement: 74, collecteur: 70, ligne: 96, silencieux: [8, 12, 16, 20], action: 0.08, sortie: 4, allumage: 0.015, mix: MIX, niveau: 0.64 },
  // six en ligne turbo : plus lisse et plus rond
  turbo: { cylindres: 6, admission: 110, echappement: 118, collecteur: 120, ligne: 160, silencieux: [12, 18, 26, 34], action: 0.1, sortie: 6, allumage: 0.017, mix: MIX, niveau: 1.84 },
  // trois cylindres de kei car : rauque et court
  kei: { cylindres: 3, admission: 50, echappement: 44, collecteur: 42, ligne: 60, silencieux: [6, 9, 12], action: 0.07, sortie: 3, allumage: 0.014, mix: { admission: 0.45, bloc: 0.35, sortie: 1 }, niveau: 0.45 },
  // V8 : tubes longs, gros silencieux, combustion plus longue
  muscle: { cylindres: 8, admission: 140, echappement: 150, collecteur: 150, ligne: 210, silencieux: [16, 24, 32, 40], action: 0.1, sortie: 8, allumage: 0.022, irregularite: 0.03, mix: MIX, niveau: 1.29 },
  // birotor : deux allumages par tour comme un quatre cylindres, tubes très courts et combustion longue (le « brap »)
  rotative: { cylindres: 4, admission: 58, echappement: 52, collecteur: 50, ligne: 88, silencieux: [8, 12, 18, 22], action: 0.06, sortie: 4, allumage: 0.03, mix: { admission: 0.35, bloc: 0.6, sortie: 1 }, niveau: 0.56 },
  // quatre cylindres de break : placide, un peu étouffé
  break: { cylindres: 4, admission: 112, echappement: 110, collecteur: 112, ligne: 150, silencieux: [12, 18, 24, 30], action: 0.1, sortie: 6, allumage: 0.017, mix: MIX, niveau: 0.74 },
};

/** Clarté du son (ouverture du passe-bas de la chaîne) : V8 sourd, petits moteurs pointus. */
export const CLARTE_MOTEUR: Record<CarId, number> = {
  equilibree: 1, legere: 1.1, turbo: 0.95, kei: 1.5, muscle: 0.7, rotative: 1.2, break: 0.9,
};

export const NOM_PROCESSEUR = 'drift-club-moteur';

/** Code du module AudioWorklet : la classe DSP recopiée telle quelle, enveloppée dans un AudioWorkletProcessor. */
export function sourceWorkletMoteur(): string {
  return `const MoteurPhysiqueDSP = (${MoteurPhysiqueDSP.toString()});
class ProcesseurMoteur extends AudioWorkletProcessor {
  static get parameterDescriptors() {
    return [
      { name: 'rpm', defaultValue: 900, minValue: 0, maxValue: 20000, automationRate: 'a-rate' },
      { name: 'gaz', defaultValue: 0, minValue: 0, maxValue: 1, automationRate: 'a-rate' },
    ];
  }
  constructor(options) {
    super();
    this.dsp = new MoteurPhysiqueDSP(options.processorOptions, sampleRate);
    this.actif = true;
    this.port.onmessage = (e) => { if (e.data === 'stop') this.actif = false; };
  }
  process(entrees, sorties, p) {
    const canal = sorties[0][0];
    if (canal) this.dsp.rendre(canal, p.rpm, p.gaz);
    return this.actif;
  }
}
registerProcessor(${JSON.stringify(NOM_PROCESSEUR)}, ProcesseurMoteur);
`;
}

const charges = new WeakMap<BaseAudioContext, Promise<boolean>>();

/** Charge le module une fois par contexte ; faux si l'AudioWorklet n'est pas disponible. */
export function chargerMoteurPhysique(ctx: BaseAudioContext): Promise<boolean> {
  let p = charges.get(ctx);
  if (!p) {
    p = (async () => {
      if (!ctx.audioWorklet || typeof Blob === 'undefined' || typeof URL === 'undefined') return false;
      const url = URL.createObjectURL(new Blob([sourceWorkletMoteur()], { type: 'application/javascript' }));
      try {
        await ctx.audioWorklet.addModule(url);
        return true;
      } catch {
        return false;
      } finally {
        URL.revokeObjectURL(url);
      }
    })();
    charges.set(ctx, p);
  }
  return p;
}

/** Nœud moteur d'une voiture (module déjà chargé) ; null en cas d'échec. */
export function creerNoeudMoteur(ctx: BaseAudioContext, car: CarId): AudioWorkletNode | null {
  try {
    return new AudioWorkletNode(ctx, NOM_PROCESSEUR, { numberOfInputs: 0, numberOfOutputs: 1, outputChannelCount: [1], processorOptions: PROFILS_MOTEUR[car] });
  } catch {
    return null;
  }
}
