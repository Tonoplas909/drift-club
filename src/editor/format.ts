import type { Level } from '../core/level/types';
import { LIMITES } from '../core/level/types';
import type { AnalyseNiveau } from '../core/editor/analyse';
import { formatDistance } from '../ui/format';

/** Longueur de la ligne brisée des points de contrôle en 3D (celle que borne la validation, §5.1). */
export function longueurRoute(level: Level): number {
  let l = 0;
  for (let i = 1; i < level.route.length; i++) {
    const a = level.route[i - 1], b = level.route[i];
    l += Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z);
  }
  return l;
}

const pluriel = (n: number, mot: string): string => `${n} ${mot}${n > 1 ? 's' : ''}`;

export function formatTempsCible(s: number): string {
  const t = Math.round(s);
  return t >= 60 ? `${Math.floor(t / 60)} min ${String(t % 60).padStart(2, '0')} s` : `${t} s`;
}

export interface ResumeValidation {
  ok: boolean;
  /** phrase affichée dans la barre */
  texte: string;
  /** tous les messages d'erreur (vide si valide) */
  messages: string[];
  compteurs: { points: string; objets: string; longueur: string };
  depasse: { points: boolean; objets: boolean; longueur: boolean };
}

/** Texte de la barre de validation : « ✔ Niveau valide · … » ou les erreurs en français. */
export function resumeValidation(level: Level, a: AnalyseNiveau): ResumeValidation {
  const longueur = longueurRoute(level);
  const messages = [...a.erreurs, ...a.problemes.map((p) => p.message)];
  const km = (m: number): string => (m / 1000).toFixed(1).replace('.', ',');
  const compteurs = {
    points: `${level.route.length}/${LIMITES.pointsMax}`,
    objets: `${level.objets.length}/${LIMITES.objetsMax}`,
    longueur: `${km(longueur)}/${km(LIMITES.longueurMax)} km`,
  };
  const depasse = {
    points: level.route.length > LIMITES.pointsMax,
    objets: level.objets.length > LIMITES.objetsMax,
    longueur: longueur > LIMITES.longueurMax,
  };
  const texte = a.ok
    ? `✔ Niveau valide · ${formatDistance(longueur)} · ${pluriel(level.route.length, 'point')} · ${pluriel(level.objets.length, 'objet')} · temps cible ${formatTempsCible(a.stats.tempsCible)}`
    : messages.length > 1 ? `${messages[0]} (+${messages.length - 1})` : messages[0] ?? 'Niveau invalide.';
  return { ok: a.ok, texte, messages, compteurs, depasse };
}

/** JSON lisible (§5.1) : indentation de 2 espaces, retour à la ligne final. */
export function jsonLisible(level: Level): string {
  return JSON.stringify(level, null, 2) + '\n';
}

/** Nom de fichier sûr pour l'export : minuscules, sans accents, tirets. */
export function nomFichier(nom: string): string {
  const base = nom.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  return `${base || 'niveau'}.json`;
}

/** « 29/09/2026 » à partir d'une date ISO ; chaîne vide si illisible. */
export function dateCourte(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
}
