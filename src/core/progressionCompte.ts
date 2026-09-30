import type { CarId } from './physics/types';
import { CAR_IDS } from './physics/cars';
import { estRarete } from './raretes';
import { SKIN_DEFAUT, skinValide, type SkinId } from './skins';
import { estDebloque, type Objet } from './caisses';
import { progressionVide, validerProgression, type GainCourse, type Progression } from './economie';

/**
 * Progression stockée dans le compte en ligne (serveur) : mêmes données que la progression locale,
 * plus l'indicateur « la progression de l'appareil a déjà été reprise ».
 */
export interface ProgressionCompte { progression: Progression; importee: boolean }

/** Plafond de clés repris à l'import (le serveur applique le même). */
export const PLAFOND_CLES_IMPORT = 30;

/** Livrées au format du serveur : « voiture:skin » (« unie » n'y figure jamais). */
export function debloquesVersLignes(d: Record<CarId, SkinId[]>): string[] {
  const out: string[] = [];
  for (const car of CAR_IDS) for (const s of d[car] ?? []) if (s !== SKIN_DEFAUT && skinValide(car, s)) out.push(`${car}:${s}`);
  return out;
}

/** Contenu envoyé à `importer_progression_locale` : livrées débloquées et clés de l'appareil. */
export const donneesImport = (p: Progression): { debloques: string[]; cles: number } =>
  ({ debloques: debloquesVersLignes(p.debloques), cles: Math.max(0, Math.floor(p.cles)) });

/** L'import de l'appareil ne se fait qu'une fois par compte : seulement si le serveur ne l'a pas encore marqué. */
export const doitImporter = (c: ProgressionCompte | null): boolean => c !== null && !c.importee;

/** Lit une ligne `progressions` du serveur (ids inconnus de cette version du jeu ignorés) ; null si elle est inutilisable. */
export function lireProgressionCompte(ligne: unknown): ProgressionCompte | null {
  if (typeof ligne !== 'object' || ligne === null || Array.isArray(ligne)) return null;
  const o = ligne as Record<string, unknown>;
  if (typeof o.cles !== 'number' && typeof o.cles !== 'string') return null;
  const debloques: Record<string, string[]> = Object.fromEntries(CAR_IDS.map((c) => [c, [] as string[]]));
  if (Array.isArray(o.debloques)) {
    for (const v of o.debloques) {
      if (typeof v !== 'string') continue;
      const i = v.indexOf(':');
      if (i > 0) debloques[v.slice(0, i)]?.push(v.slice(i + 1));
    }
  }
  const progression = validerProgression({ cles: Number(o.cles), ouvertes: Number(o.ouvertes ?? 0), caisseOfferte: o.caisse_offerte === true, debloques });
  return { progression, importee: o.importee === true };
}

/** Livrée tirée par le serveur (`ouvrir_caisse`) ; null si la voiture, la livrée ou la rareté sont inconnues de cette version du jeu. */
export function lireObjetServeur(ligne: unknown): { objet: Objet; doublon: boolean; cles: number } | null {
  if (typeof ligne !== 'object' || ligne === null || Array.isArray(ligne)) return null;
  const o = ligne as Record<string, unknown>;
  const car = o.voiture, skin = o.skin, cles = Number(o.cles);
  if (typeof car !== 'string' || !(CAR_IDS as string[]).includes(car)) return null;
  if (!skinValide(car as CarId, skin) || skin === SKIN_DEFAUT || !estRarete(o.rarete) || !Number.isFinite(cles)) return null;
  return { objet: { car: car as CarId, skin, rarete: o.rarete }, doublon: o.doublon === true, cles: Math.max(0, Math.floor(cles)) };
}

/** Progression après une ouverture faite par le serveur : clés du serveur, livrée ajoutée sauf doublon. */
export function appliquerOuvertureServeur(p: Progression, objet: Objet, doublon: boolean, cles: number): Progression {
  const debloques = { ...p.debloques };
  if (!doublon && !estDebloque(debloques, objet.car, objet.skin)) debloques[objet.car] = [...debloques[objet.car], objet.skin];
  return { ...p, debloques, cles: Math.max(0, Math.floor(cles)), ouvertes: p.ouvertes + 1 };
}

/** Gain d'une arrivée d'après la réponse de `soumettre_score` : `clesGagnees` = arrivée + record, `cles` = total du compte. */
export function gainServeur(clesGagnees: number, clesRecord: number, cles: number): GainCourse {
  const record = Math.max(0, Math.min(Math.floor(clesRecord), Math.floor(clesGagnees)));
  return { arrivee: Math.max(0, Math.floor(clesGagnees)) - record, record, total: Math.max(0, Math.floor(cles)) };
}

/** Progression du compte connu de l'appareil : `ok` = lue sur le serveur, `hors-ligne` = dernière valeur connue (lecture seule). */
export interface EtatProgressionCompte { id: string; progression: Progression; importee: boolean; synchro: 'ok' | 'hors-ligne' }

export interface ProgressionActive {
  source: 'local' | 'compte';
  progression: Progression;
  /** vrai quand le compte fait foi mais n'est pas joignable : rien ne peut être gagné ni dépensé */
  lectureSeule: boolean;
}

/**
 * Progression à utiliser : connecté avec pseudo, celle du COMPTE fait foi (jamais mélangée avec la locale) ;
 * sinon, ou si le service en ligne n'est pas installé, la progression locale.
 * Compte pas encore connu (premier lancement hors ligne) : progression vide en lecture seule.
 */
export function choisirProgression(o: { idCompte: string | null; local: Progression; compte: EtatProgressionCompte | null; serviceAbsent: boolean }): ProgressionActive {
  if (o.idCompte === null || o.serviceAbsent) return { source: 'local', progression: o.local, lectureSeule: false };
  if (o.compte && o.compte.id === o.idCompte) return { source: 'compte', progression: o.compte.progression, lectureSeule: o.compte.synchro !== 'ok' };
  return { source: 'compte', progression: progressionVide(), lectureSeule: true };
}
