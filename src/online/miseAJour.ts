/**
 * Mise à jour du jeu sans recharger la page à la main : le site publié contient `version.json` (identifiant de
 * compilation, voir vite.config.ts). Le jeu le relit de temps en temps ; s'il a changé, il recharge la page dès que
 * le joueur est dans un menu (jamais en course, dans l'éditeur, dans les caisses ni pendant une saisie).
 */

export interface OptionsMiseAJour {
  /** identifiant de compilation du jeu en cours d'exécution */
  actuel: string;
  /** identifiant publié (null : injoignable ou illisible) */
  lire(): Promise<string | null>;
  /** vrai si recharger maintenant ne fait rien perdre au joueur */
  peutRecharger(): boolean;
  recharger(): void;
  /** mémoire de la page (sessionStorage) : évite une boucle de rechargements si le site met du temps à se propager */
  memoire: { lire(): string | null; ecrire(v: string): void };
  maintenant(): number;
}

/** Délai minimal entre deux rechargements vers la même version (le temps que le cache du site se mette à jour). */
export const DELAI_NOUVEL_ESSAI = 120_000;

export class MiseAJour {
  /** identifiant de la version publiée plus récente, ou null */
  disponible: string | null = null;

  constructor(private readonly o: OptionsMiseAJour) {}

  /** Relit la version publiée ; vrai si une autre version que celle en cours est disponible. */
  async verifier(): Promise<boolean> {
    let publie: string | null = null;
    try { publie = await this.o.lire(); } catch { publie = null; }
    if (publie && publie !== this.o.actuel) this.disponible = publie;
    return this.disponible !== null;
  }

  /** Recharge la page si une version est disponible et que le moment s'y prête ; vrai si le rechargement est lancé. */
  appliquer(): boolean {
    const cible = this.disponible;
    if (!cible || !this.o.peutRecharger()) return false;
    const t = this.o.maintenant();
    try {
      const m = JSON.parse(this.o.memoire.lire() ?? 'null') as { cible?: unknown; t?: unknown } | null;
      if (m && m.cible === cible && typeof m.t === 'number' && t - m.t < DELAI_NOUVEL_ESSAI) return false;
    } catch { /* mémoire illisible : on recharge */ }
    try { this.o.memoire.ecrire(JSON.stringify({ cible, t })); } catch { /* stockage indisponible */ }
    this.o.recharger();
    return true;
  }
}

/** Lit `version.json` à côté de la page, sans aucun cache. */
export async function lireVersionPubliee(base: string): Promise<string | null> {
  const r = await fetch(`${base}version.json?t=${Date.now()}`, { cache: 'no-store' });
  if (!r.ok) return null;
  const d = (await r.json()) as { build?: unknown };
  return typeof d.build === 'string' && d.build ? d.build : null;
}
