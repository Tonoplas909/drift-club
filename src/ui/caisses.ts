import { h } from './screens';
import { CARS } from '../core/physics/cars';
import type { CarId } from '../core/physics/types';
import { RARETES, RARETE_IDS, formatPoids, type Rarete } from '../core/raretes';
import { SKINS, accentSkin, couleurEffective } from '../core/skins';
import { fumeeDef } from '../core/fumees';
import { ECONOMIE, peutOuvrir, type Ouverture, type Progression } from '../core/economie';
import { INDEX_GAGNANT, construireBande, estFumee, infoObjet, tirerObjet, type Objet } from '../core/caisses';
import type { Rng } from '../core/math/rng';
import { iconeCaisse, iconeCle, iconeFumee, iconeVoiture } from './svg';
import { DUREE_ROULETTE, DUREE_ROULETTE_REDUITE, defilementFinal, easeOutRoulette, indexSousRepere, nouvelRng } from './roulette';

export interface AudioCaisses {
  /** `k` ∈ [0, 1] : variation de hauteur */
  tick(k: number): void;
  ouvrir(): void;
  reveal(r: Rarete): void;
}

/** Résultat d'une ouverture : le tirage (local, ou fait par le serveur) ou la raison de l'échec. */
export type ResultatOuverture = { ok: true; ouverture: Ouverture } | { ok: false; message: string };

export interface OptionsCaisses {
  progression(): Progression;
  /**
   * Paie et tire une caisse (applique et enregistre la progression). `rng` sert à la roulette ; avec un compte en ligne le
   * tirage vient du serveur, donc la réponse est asynchrone et la roulette s'arrête sur SON résultat.
   */
  ouvrir(rng: Rng): ResultatOuverture | Promise<ResultatOuverture>;
  /** raison qui empêche d'ouvrir maintenant (ex. compte injoignable), ou null */
  blocage?(): string | null;
  audio: AudioCaisses;
  /** couleur principale du joueur (pour les pastilles des cartes) */
  couleur(): string;
  /** montre la livrée gagnée en 3D derrière l'écran (null : arrêter l'aperçu) */
  onApercu?(o: Objet | null): void;
  onEquiper(o: Objet): void;
  onRetour(): void;
  /** générateur du tirage réel (par défaut : graine cryptographique) */
  rng?: () => Rng;
  mouvementReduit?(): boolean;
}

const cle = (n: number): string => `${n} clé${n > 1 ? 's' : ''}`;

/** Nombre maximal de caisses ouvertes d'un coup. */
export const MAX_LOT = 10;

/** Caisses ouvrables d'un coup avec ces clés (0 ou 1 : pas de bouton « ×N »). */
export const tailleLot = (cles: number): number => Math.max(0, Math.min(MAX_LOT, Math.floor(cles / ECONOMIE.coutCaisse)));

/** La plus rare des ouvertures (à rareté égale, la première ; une nouveauté passe avant un doublon). */
export function meilleure(ouvertures: Ouverture[]): Ouverture {
  const rang = (x: Ouverture): number => RARETE_IDS.indexOf(x.tirage.objet.rarete) * 2 + (x.tirage.doublon ? 0 : 1);
  return ouvertures.reduce((a, b) => (rang(b) > rang(a) ? b : a));
}

/** Carte de la roulette : barre de rareté, pastille de livrée, voiture et nom. */
function carte(o: Objet, couleur: string): HTMLElement {
  if (o.car === 'fumee') {
    const f = fumeeDef(o.skin);
    return h('div', { class: 'cs-carte', style: `--rc:${RARETES[o.rarete].couleur}` },
      iconeFumee(f.style),
      h('span', { class: 'cs-voit' }, 'Fumée'),
      h('b', { class: 'cs-nom' }, f.nom),
      h('i', { class: 'cs-barre' }),
    );
  }
  const def = SKINS[o.car].find((s) => s.id === o.skin)!;
  const base = couleurEffective(def, couleur);
  return h('div', { class: 'cs-carte', style: `--rc:${RARETES[o.rarete].couleur}` },
    iconeVoiture(base, accentSkin(def, couleur), o.car),
    h('span', { class: 'cs-voit' }, CARS[o.car].nom),
    h('b', { class: 'cs-nom' }, def.nom),
    h('i', { class: 'cs-barre' }),
  );
}

/** Écran des caisses : roulette de livrées, puis fiche de révélation. Le tirage est fait par `ouvrir` ; l'écran ne fait que l'animer. */
export function ecranCaisses(o: OptionsCaisses): HTMLElement {
  const nouveauRng = o.rng ?? nouvelRng;
  const reduit = (): boolean => o.mouvementReduit?.() ?? (typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches);
  let etat: 'attente' | 'ouverture' | 'roulette' | 'revele' = 'attente';
  /** ouverture d'un lot en cours : caisses déjà ouvertes / demandées */
  let lot: { fait: number; total: number } | null = null;
  /** dernier échec d'ouverture, affiché sous le bouton */
  let erreur: string | null = null;
  let raf = 0;
  let fin: (() => void) | null = null;

  const piste = h('div', { class: 'cs-piste' });
  const vue = h('div', { class: 'cs-reel' }, piste, h('div', { class: 'cs-repere' }));
  const cles = h('b', {});
  const zoneCles = h('div', { class: 'cs-cles', title: 'Clés' }, iconeCle(), cles);
  const actions = h('div', { class: 'cs-actions' });
  const corps = h('div', { class: 'cs' });
  const ecran = h('div', { class: 'screen caisses' });

  const majCles = (): void => { cles.textContent = cle(o.progression().cles); };

  const monter = (objets: Objet[]): HTMLElement[] => {
    const cartes = objets.map((x) => carte(x, o.couleur()));
    piste.replaceChildren(...cartes);
    piste.style.transform = 'translate3d(0,0,0)';
    return cartes;
  };
  monter(Array.from({ length: 16 }, () => tirerObjet(nouveauRng())));

  const chances = h('p', { class: 'cs-chances' }, 'Chances : ',
    ...RARETE_IDS.map((r) => h('span', { class: 'cs-chance', style: `--rc:${RARETES[r].couleur}` }, h('i', {}), `${RARETES[r].nom} ${formatPoids(RARETES[r].poids)}`)));

  const rendreActions = (): void => {
    const p = o.progression();
    majCles();
    if (etat === 'roulette') {
      actions.replaceChildren(iconeCaisse('ico-caisse secoue'), h('button', { class: 'btn sec', onclick: () => fin?.() }, 'Passer'));
      return;
    }
    const bloque = o.blocage?.() ?? null;
    const ok = peutOuvrir(p) && bloque === null && etat === 'attente', manque = ECONOMIE.coutCaisse - p.cles;
    const n = tailleLot(p.cles);
    actions.replaceChildren(
      iconeCaisse(etat === 'ouverture' ? 'ico-caisse secoue' : undefined),
      h('div', { class: 'cs-ouvrir' },
        h('div', { class: 'row' },
          h('button', { class: 'btn big', disabled: !ok, onclick: () => void demarrer(1) },
            etat === 'ouverture' ? (lot ? `Ouverture… ${lot.fait}/${lot.total}` : 'Ouverture…') : `Ouvrir (${cle(ECONOMIE.coutCaisse)})`),
          etat !== 'ouverture' && n >= 2 && h('button', { class: 'btn big sec', disabled: !ok, title: `Ouvre ${n} caisses d'un coup`, onclick: () => void demarrer(n) },
            `Ouvrir ×${n} (${cle(n * ECONOMIE.coutCaisse)})`),
        ),
        bloque !== null ? h('p', { class: 'cs-raison' }, bloque)
          : erreur !== null ? h('p', { class: 'cs-raison' }, erreur)
          : !peutOuvrir(p) && h('p', { class: 'cs-raison' }, `Il te manque ${cle(manque)} : +${ECONOMIE.clesParArrivee} par arrivée, +${ECONOMIE.clesRecord} sur un record.`),
      ),
    );
  };

  const retour = (): void => {
    cancelAnimationFrame(raf);
    o.onApercu?.(null);
    o.onRetour();
  };

  const fermerRevele = (): void => {
    ecran.querySelector('.cs-revele')?.remove();
    ecran.classList.remove('revele');
    o.onApercu?.(null);
    etat = 'attente';
    rendreActions();
  };

  /** Fiche de révélation : lueur de la rareté, nouvelle livrée ou doublon, actions. */
  const reveler = (ou: Ouverture): void => {
    etat = 'revele';
    const x = ou.tirage.objet, info = infoObjet(x), fumee = estFumee(x), r = RARETES[x.rarete];
    const def = fumee ? null : SKINS[x.car as CarId].find((s) => s.id === x.skin)!;
    ecran.classList.add('revele');
    o.audio.reveal(x.rarete);
    o.onApercu?.(x);
    const p = o.progression();
    ecran.append(h('div', { class: `cs-revele r-${x.rarete}`, style: `--rc:${r.couleur}` },
      h('div', { class: 'cs-lueur' }),
      h('div', { class: 'cs-fiche', role: 'dialog', 'aria-label': fumee ? 'Fumée gagnée' : 'Livrée gagnée' },
        h('span', { class: 'cs-rarete' }, r.nom),
        h('h2', {}, ou.tirage.doublon ? `Doublon : +${ou.remboursement} clé${ou.remboursement > 1 ? 's' : ''}` : fumee ? 'Nouvelle fumée !' : 'Nouvelle livrée !'),
        h('p', { class: 'cs-obj' }, h('b', {}, info.nom), ` · ${fumee ? 'Fumée de pneus' : CARS[x.car as CarId].nom}`),
        fumee && h('div', { class: 'fumee-info' }, iconeFumee(fumeeDef(x.skin).style, 'ico-fumee')),
        h('p', { class: 'cs-desc petit' }, info.description),
        h('p', { class: 'petit' }, ou.tirage.doublon ? (fumee ? 'Tu avais déjà cette fumée : une clé te revient.' : 'Tu avais déjà cette livrée : une clé te revient.') : (fumee ? 'Elle est débloquée pour tes dérapages.' : 'Elle est débloquée pour ton Garage.')),
        def?.couleurForcee && h('p', { class: 'petit' }, 'Couleur imposée par la livrée.'),
        h('p', { class: 'cs-total' }, iconeCle(), `Tu as ${cle(p.cles)}`),
        h('div', { class: 'row' },
          h('button', { class: 'btn', onclick: () => o.onEquiper(x) }, 'Équiper'),
          h('button', { class: 'btn sec', disabled: !peutOuvrir(p) || (o.blocage?.() ?? null) !== null, title: peutOuvrir(p) ? '' : `Il te manque ${cle(ECONOMIE.coutCaisse - p.cles)}`, onclick: () => { fermerRevele(); void demarrer(1); } }, `Rouvrir (${cle(ECONOMIE.coutCaisse)})`),
          h('button', { class: 'btn sec', onclick: retour }, 'Retour'),
        ),
      ),
    ));
  };

  /** Fiche d'un lot : toutes les caisses ouvertes, la plus rare en lumière ; cliquer une carte l'équipe. */
  const revelerLot = (ouvertures: Ouverture[], probleme: string | null): void => {
    etat = 'revele';
    const top = meilleure(ouvertures), x = top.tirage.objet, r = RARETES[x.rarete];
    ecran.classList.add('revele');
    o.audio.reveal(x.rarete);
    o.onApercu?.(x);
    const p = o.progression(), n = tailleLot(p.cles);
    const doublons = ouvertures.filter((u) => u.tirage.doublon);
    const rendu = doublons.reduce((t, u) => t + u.remboursement, 0);
    const nouveautes = ouvertures.length - doublons.length;
    const cartes = ouvertures.map((u) => {
      const c = carte(u.tirage.objet, o.couleur());
      c.classList.add('cs-mini');
      if (u === top) c.classList.add('gagnante');
      c.append(h('span', { class: `cs-badge${u.tirage.doublon ? ' doublon' : ''}` }, u.tirage.doublon ? `+${u.remboursement}` : 'Nouveau'));
      c.title = `Équiper ${infoObjet(u.tirage.objet).nom}`;
      c.addEventListener('click', () => o.onEquiper(u.tirage.objet));
      return c;
    });
    ecran.append(h('div', { class: `cs-revele lot r-${x.rarete}`, style: `--rc:${r.couleur}` },
      h('div', { class: 'cs-lueur' }),
      h('div', { class: 'cs-fiche', role: 'dialog', 'aria-label': `${ouvertures.length} caisses ouvertes` },
        h('span', { class: 'cs-rarete' }, `Meilleure : ${r.nom}`),
        h('h2', {}, `${ouvertures.length} caisses ouvertes`),
        h('p', { class: 'petit' }, `${nouveautes} nouveauté${nouveautes > 1 ? 's' : ''}`, doublons.length > 0 ? ` · ${doublons.length} doublon${doublons.length > 1 ? 's' : ''} : +${cle(rendu)}` : '', '. Touche une carte pour l\'équiper.'),
        h('div', { class: 'cs-lot' }, ...cartes),
        probleme !== null && h('p', { class: 'cs-raison sombre' }, `Arrêté avant la fin : ${probleme}`),
        h('p', { class: 'cs-total' }, iconeCle(), `Tu as ${cle(p.cles)}`),
        h('div', { class: 'row' },
          n >= 2 && (o.blocage?.() ?? null) === null
            ? h('button', { class: 'btn', onclick: () => { fermerRevele(); void demarrer(n); } }, `Rouvrir ×${n}`)
            : h('button', { class: 'btn', disabled: !peutOuvrir(p) || (o.blocage?.() ?? null) !== null, onclick: () => { fermerRevele(); void demarrer(1); } }, `Rouvrir (${cle(ECONOMIE.coutCaisse)})`),
          h('button', { class: 'btn sec', onclick: retour }, 'Retour'),
        ),
      ),
    ));
  };

  /** Ouvre une caisse (n = 1) ou un lot de n caisses, l'une après l'autre (chacune payée et tirée comme une ouverture seule). */
  const demarrer = async (n: number): Promise<void> => {
    if (etat !== 'attente') return;
    const rng = nouveauRng();
    erreur = null;
    etat = 'ouverture';
    lot = n > 1 ? { fait: 0, total: n } : null;
    rendreActions();
    const ouvertures: Ouverture[] = [];
    let probleme: string | null = null;
    for (let i = 0; i < n; i++) {
      let res: ResultatOuverture;
      try { res = await o.ouvrir(i === 0 ? rng : nouveauRng()); } catch { res = { ok: false, message: "Ouverture impossible pour le moment. Réessaie." }; }
      if (!ecran.isConnected) return; // écran quitté pendant l'attente
      if (!res.ok) { probleme = res.message; break; }
      ouvertures.push(res.ouverture);
      if (lot) { lot.fait = ouvertures.length; rendreActions(); }
      if (o.blocage?.() || !peutOuvrir(o.progression())) break;
    }
    lot = null;
    etat = 'attente';
    if (ouvertures.length === 0) { erreur = probleme; rendreActions(); return; }
    // la roulette s'arrête sur la plus rare du lot, puis la fiche montre tout le lot
    const ou = ouvertures.length === 1 ? ouvertures[0] : meilleure(ouvertures);
    const apres = ouvertures.length === 1 ? (): void => reveler(ou) : (): void => revelerLot(ouvertures, probleme);
    if (ouvertures.length === 1 && probleme !== null) erreur = probleme;
    etat = 'roulette';
    o.audio.ouvrir();
    const cartes = monter(construireBande(rng, ou.tirage.objet));
    rendreActions();
    // mesures faites une fois, avant l'animation ; ensuite seules des transformations sont écrites
    const pas = cartes[1].offsetLeft - cartes[0].offsetLeft, largeurCarte = cartes[0].offsetWidth, largeurVue = vue.clientWidth;
    const finale = defilementFinal(INDEX_GAGNANT, pas, largeurCarte, largeurVue, rng() * 2 - 1);
    const duree = reduit() ? DUREE_ROULETTE_REDUITE : DUREE_ROULETTE;
    let t0 = 0, dernier = -1, dernierTic = -1e9;
    const poser = (d: number): void => { piste.style.transform = `translate3d(${-d}px,0,0)`; };
    const sous = (i: number, now: number): void => {
      if (i === dernier) return;
      cartes[dernier]?.classList.remove('sous');
      cartes[i]?.classList.add('sous');
      dernier = i;
      if (now - dernierTic > 26) { dernierTic = now; o.audio.tick(Math.random()); }
    };
    let termine = false;
    const conclure = (delai: number): void => {
      if (termine) return;
      termine = true;
      cancelAnimationFrame(raf);
      fin = null;
      poser(finale);
      sous(INDEX_GAGNANT, performance.now());
      cartes[INDEX_GAGNANT].classList.add('gagnante');
      window.setTimeout(() => { if (ecran.isConnected && etat === 'roulette') apres(); }, delai);
    };
    fin = () => conclure(160);
    const image = (now: number): void => {
      if (!ecran.isConnected || termine) return;
      if (!t0) t0 = now;
      const p = Math.min(1, (now - t0) / duree);
      const d = finale * easeOutRoulette(p);
      poser(d);
      sous(indexSousRepere(d, largeurVue, pas), now);
      if (p < 1) raf = requestAnimationFrame(image);
      else conclure(reduit() ? 200 : 450);
    };
    raf = requestAnimationFrame(image);
  };

  rendreActions();
  corps.append(
    h('div', { class: 'cs-tete' }, h('h2', {}, 'Caisses'), zoneCles, h('button', { class: 'btn sec sm', onclick: retour }, 'Retour')),
    vue, actions, chances,
  );
  ecran.append(corps);
  return ecran;
}
