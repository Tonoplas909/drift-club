import { h } from './screens';
import { CARS } from '../core/physics/cars';
import { RARETES, RARETE_IDS, formatPoids, type Rarete } from '../core/raretes';
import { SKINS, accentSkin, couleurEffective } from '../core/skins';
import { ECONOMIE, peutOuvrir, type Ouverture, type Progression } from '../core/economie';
import { INDEX_GAGNANT, construireBande, tirerObjet, type Objet } from '../core/caisses';
import type { Rng } from '../core/math/rng';
import { iconeCaisse, iconeCle, iconeVoiture } from './svg';
import { DUREE_ROULETTE, DUREE_ROULETTE_REDUITE, defilementFinal, easeOutRoulette, indexSousRepere, nouvelRng } from './roulette';

export interface AudioCaisses {
  /** `k` ∈ [0, 1] : variation de hauteur */
  tick(k: number): void;
  ouvrir(): void;
  reveal(r: Rarete): void;
}

export interface OptionsCaisses {
  progression(): Progression;
  /** paie et tire une caisse avec `rng` (applique et enregistre la progression) ; null si pas assez de clés */
  ouvrir(rng: Rng): Ouverture | null;
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

/** Carte de la roulette : barre de rareté, pastille de livrée, voiture et nom. */
function carte(o: Objet, couleur: string): HTMLElement {
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
  let etat: 'attente' | 'roulette' | 'revele' = 'attente';
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
    const ok = peutOuvrir(p), manque = ECONOMIE.coutCaisse - p.cles;
    actions.replaceChildren(
      iconeCaisse(),
      h('div', { class: 'cs-ouvrir' },
        h('button', { class: 'btn big', disabled: !ok, onclick: () => demarrer() }, `Ouvrir (${cle(ECONOMIE.coutCaisse)})`),
        !ok && h('p', { class: 'cs-raison' }, `Il te manque ${cle(manque)} : +${ECONOMIE.clesParArrivee} par arrivée, +${ECONOMIE.clesRecord} sur un record.`),
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
    const x = ou.tirage.objet, def = SKINS[x.car].find((s) => s.id === x.skin)!, r = RARETES[x.rarete];
    ecran.classList.add('revele');
    o.audio.reveal(x.rarete);
    o.onApercu?.(x);
    const p = o.progression();
    ecran.append(h('div', { class: `cs-revele r-${x.rarete}`, style: `--rc:${r.couleur}` },
      h('div', { class: 'cs-lueur' }),
      h('div', { class: 'cs-fiche', role: 'dialog', 'aria-label': 'Livrée gagnée' },
        h('span', { class: 'cs-rarete' }, r.nom),
        h('h2', {}, ou.tirage.doublon ? `Doublon : +${ou.remboursement} clé${ou.remboursement > 1 ? 's' : ''}` : 'Nouvelle livrée !'),
        h('p', { class: 'cs-obj' }, h('b', {}, def.nom), ` · ${CARS[x.car].nom}`),
        h('p', { class: 'cs-desc petit' }, def.description),
        h('p', { class: 'petit' }, ou.tirage.doublon ? 'Tu avais déjà cette livrée : une clé te revient.' : 'Elle est débloquée pour ton Garage.'),
        def.couleurForcee && h('p', { class: 'petit' }, 'Couleur imposée par la livrée.'),
        h('p', { class: 'cs-total' }, iconeCle(), `Tu as ${cle(p.cles)}`),
        h('div', { class: 'row' },
          h('button', { class: 'btn', onclick: () => o.onEquiper(x) }, 'Équiper'),
          h('button', { class: 'btn sec', disabled: !peutOuvrir(p), title: peutOuvrir(p) ? '' : `Il te manque ${cle(ECONOMIE.coutCaisse - p.cles)}`, onclick: () => { fermerRevele(); demarrer(); } }, `Rouvrir (${cle(ECONOMIE.coutCaisse)})`),
          h('button', { class: 'btn sec', onclick: retour }, 'Retour'),
        ),
      ),
    ));
  };

  const demarrer = (): void => {
    if (etat !== 'attente') return;
    const rng = nouveauRng();
    const ou = o.ouvrir(rng);
    if (!ou) { rendreActions(); return; }
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
      window.setTimeout(() => { if (ecran.isConnected && etat === 'roulette') reveler(ou); }, delai);
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
