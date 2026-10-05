import type { CarId } from './physics/types';
import { CAR_IDS } from './physics/cars';
import { estRarete } from './raretes';
import type { SkinId } from './skins';
import { COLLECTIONS, defautDe, estCollection, estDebloque, idValide, type CleCollection, type Objet } from './caisses';
import { progressionVide, validerProgression, type GainCourse, type Progression } from './economie';

/**
 * Progression stockée dans le compte en ligne (serveur) : mêmes données que la progression locale,
 * plus l'indicateur `importee` (ancienne reprise de la progression de l'appareil, supprimée en 0.4.5 : un compte
 * ne reprend plus rien de l'appareil, dont le contenu est modifiable par le joueur).
 */
export interface ProgressionCompte { progression: Progression; importee: boolean }

/** Objets au format du serveur : « voiture:skin » ou « fumee:id » (« unie » et « classique » n'y figurent jamais). */
export function debloquesVersLignes(d: Record<CleCollection, SkinId[]>): string[] {
  const out: string[] = [];
  for (const car of COLLECTIONS) for (const s of d[car] ?? []) if (s !== defautDe(car) && idValide(car, s)) out.push(`${car}:${s}`);
  return out;
}


/** Lit une ligne `progressions` du serveur (ids inconnus de cette version du jeu ignorés) ; null si elle est inutilisable. */
export function lireProgressionCompte(ligne: unknown): ProgressionCompte | null {
  if (typeof ligne !== 'object' || ligne === null || Array.isArray(ligne)) return null;
  const o = ligne as Record<string, unknown>;
  if (typeof o.cles !== 'number' && typeof o.cles !== 'string') return null;
  const debloques: Record<string, string[]> = Object.fromEntries(COLLECTIONS.map((c) => [c, [] as string[]]));
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

/** Objet tiré par le serveur (`ouvrir_caisse`) : livrée ou fumée ; null si la collection, l'objet ou la rareté sont inconnus de cette version du jeu. */
export function lireObjetServeur(ligne: unknown): { objet: Objet; doublon: boolean; cles: number } | null {
  if (typeof ligne !== 'object' || ligne === null || Array.isArray(ligne)) return null;
  const o = ligne as Record<string, unknown>;
  const car = o.voiture, skin = o.skin, cles = Number(o.cles);
  if (!estCollection(car)) return null;
  if (!idValide(car, skin) || skin === defautDe(car) || !estRarete(o.rarete) || !Number.isFinite(cles)) return null;
  return { objet: { car, skin, rarete: o.rarete }, doublon: o.doublon === true, cles: Math.max(0, Math.floor(cles)) };
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
