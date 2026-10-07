/**
 * Écran de l'Atelier : créer une livrée à partir des motifs du jeu, la proposer, suivre ses propositions et, pour les
 * administrateurs, valider (en choisissant la rareté) ou refuser celles des joueurs. L'aperçu 3D est celui du showroom.
 */
import type { CarId } from '../core/physics/types';
import { CARS, CAR_IDS } from '../core/physics/cars';
import { RARETES, RARETE_IDS, type Rarete } from '../core/raretes';
import type { SkinDef, SkinElement } from '../core/skins';
import { LIMITES_ATELIER, MOTIFS, TEINTES_RELATIVES, motifDe, validerElement, validerLivree, type LivreeAtelier, type Reglage } from '../core/atelier';
import type { Resultat } from '../online/classement';
import type { Proposition } from '../online/atelier';
import { COULEURS } from './couleurs';
import { h } from './screens';

/** Brouillon de l'éditeur (gardé sur l'appareil entre deux visites). */
export interface Brouillon {
  voiture: CarId;
  /** couleur de carrosserie de l'aperçu (celle du joueur, quand la livrée n'en impose pas) */
  couleurEssai: string;
  nom: string;
  description: string;
  couleurForcee: string | null;
  elements: SkinElement[];
}

export interface OptionsAtelier {
  voiture: CarId;
  couleur: string;
  /** connecté avec un pseudo : seul cas où l'on peut proposer */
  peutProposer(): boolean;
  brouillon: { lire(): unknown; ecrire(b: Brouillon): void };
  /** montre la livrée dans le showroom (null : voiture sans livrée) */
  apercu(voiture: CarId, couleur: string, def: SkinDef | null): void;
  proposer(l: LivreeAtelier): Promise<Resultat<string>>;
  mesPropositions(): Promise<Resultat<Proposition[]>>;
  estAdmin(): Promise<boolean>;
  aModerer(): Promise<Resultat<Proposition[]>>;
  /** propositions en attente soumises au vote, et vote (1, -1, 0 : retirer) */
  enVote(): Promise<Resultat<Proposition[]>>;
  voter(id: string, vote: -1 | 0 | 1): Promise<Resultat<{ pour: number; contre: number }>>;
  moderer(id: string, decision: { valider: true; rarete: Rarete } | { valider: false; motif: string }): Promise<Resultat<null>>;
  onCompte(): void;
  onRetour(): void;
}

type Onglet = 'creer' | 'miennes' | 'votes' | 'moderer';

const NOMS_TEINTES: Record<(typeof TEINTES_RELATIVES)[number], string> = {
  principale: 'Couleur de la voiture', contraste: 'Contraste', sombre: 'Plus sombre', clair: 'Plus clair',
};
/** Valeur affichée d'un réglage facultatif absent (celle que prend le rendu). */
const AFFICHAGE_DEFAUT: Record<string, number> = { pos: 0.5, pente: 1.2 };
const HEX = /^#[0-9a-f]{6}$/i;

const copie = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T;

/** Élément ajouté : valeurs par défaut du motif, réglages facultatifs rendus explicites (curseurs à leur place). */
function nouvelElement(type: SkinElement['type']): SkinElement {
  const m = motifDe(type)!;
  const el = copie(m.defaut) as unknown as Record<string, unknown>;
  for (const [cle, r] of Object.entries(m.reglages)) {
    if (el[cle] !== undefined) continue;
    if (r.sorte === 'nombre') el[cle] = AFFICHAGE_DEFAUT[cle] ?? (r.min + r.max) / 2;
    else if (r.sorte === 'choix') el[cle] = r.options[0][0];
  }
  return el as unknown as SkinElement;
}

function brouillonVide(voiture: CarId, couleur: string): Brouillon {
  return { voiture, couleurEssai: couleur, nom: '', description: '', couleurForcee: null, elements: [nouvelElement('bandes')] };
}

/** Relit un brouillon gardé (tout est re-validé ; un motif invalide est simplement oublié). */
function lireBrouillon(raw: unknown, voiture: CarId, couleur: string): Brouillon {
  const b = brouillonVide(voiture, couleur);
  if (typeof raw !== 'object' || raw === null) return b;
  const o = raw as Record<string, unknown>;
  if (CAR_IDS.includes(o.voiture as CarId)) b.voiture = o.voiture as CarId;
  if (typeof o.couleurEssai === 'string' && HEX.test(o.couleurEssai)) b.couleurEssai = o.couleurEssai;
  if (typeof o.nom === 'string') b.nom = o.nom.slice(0, LIMITES_ATELIER.nomMax);
  if (typeof o.description === 'string') b.description = o.description.slice(0, LIMITES_ATELIER.descriptionMax);
  if (typeof o.couleurForcee === 'string' && HEX.test(o.couleurForcee)) b.couleurForcee = o.couleurForcee;
  if (Array.isArray(o.elements)) {
    const els = o.elements.slice(0, LIMITES_ATELIER.elementsMax).map(validerElement).filter((v) => v.ok).map((v) => (v as { element: SkinElement }).element);
    if (els.length) b.elements = els;
  }
  return b;
}

/** Définition de livrée pour l'aperçu (motifs valides seulement). */
function defApercu(b: Brouillon, nom = b.nom, description = b.description): SkinDef {
  const elements = b.elements.map(validerElement).filter((v) => v.ok).map((v) => (v as { element: SkinElement }).element);
  return { id: 'atelier-apercu', nom: nom || 'Ma livrée', rarete: 'commune', description: description || '', elements, ...(b.couleurForcee ? { couleurForcee: b.couleurForcee } : {}) };
}

const defDeLivree = (l: LivreeAtelier): SkinDef => ({
  id: 'atelier-apercu', nom: l.nom, rarete: 'commune', description: l.description, elements: l.elements, ...(l.couleurForcee ? { couleurForcee: l.couleurForcee } : {}),
});

const texteStatut = (p: Proposition): string =>
  p.statut === 'proposee' ? 'En attente de validation'
    : p.statut === 'validee' ? `Validée · ${p.rarete ? RARETES[p.rarete].nom : ''} · dans les caisses`
      : `Refusée${p.motifRefus ? ` : ${p.motifRefus}` : ''}`;

export function ecranAtelier(o: OptionsAtelier): HTMLElement {
  let b = lireBrouillon(o.brouillon.lire(), o.voiture, o.couleur);
  let onglet: Onglet = 'creer';
  let admin = false;
  /** motif dont les réglages sont ouverts */
  let ouvert = b.elements.length - 1;
  let envoi = false;
  let message: { texte: string; err: boolean } | null = null;
  let mesPropositions: Resultat<Proposition[]> | null = null;
  let aModerer: Resultat<Proposition[]> | null = null;
  let enVote: Resultat<Proposition[]> | null = null;

  const ecran = h('div', { class: 'screen garage atelier' });
  const panneau = h('div', { class: 'panel side' });
  ecran.append(panneau);

  // l'aperçu suit chaque réglage, mais une seule reconstruction par image (curseurs qu'on fait glisser)
  let apercuDemande = 0;
  const majApercu = (): void => {
    if (apercuDemande) return;
    apercuDemande = requestAnimationFrame(() => { apercuDemande = 0; o.apercu(b.voiture, b.couleurEssai, defApercu(b)); });
  };
  const enregistrer = (): void => { o.brouillon.ecrire(b); majApercu(); };

  // ----- réglages d'un motif -----
  const choixTeinte = (valeur: string, onChange: (v: string) => void): HTMLElement => {
    const libre = HEX.test(valeur);
    const couleur = h('input', { type: 'color', value: libre ? valeur : '#ffffff', 'aria-label': 'Couleur libre' });
    const select = h('select', {},
      ...TEINTES_RELATIVES.map((t) => h('option', { value: t, ...(t === valeur ? { selected: true } : {}) }, NOMS_TEINTES[t])),
      h('option', { value: 'libre', ...(libre ? { selected: true } : {}) }, 'Couleur au choix'));
    couleur.hidden = !libre;
    select.addEventListener('change', () => {
      const v = select.value === 'libre' ? couleur.value : select.value;
      couleur.hidden = select.value !== 'libre';
      onChange(v);
    });
    couleur.addEventListener('input', () => onChange(couleur.value));
    return h('span', { class: 'at-teinte' }, select, couleur);
  };

  const controle = (el: Record<string, unknown>, cle: string, r: Reglage): HTMLElement => {
    const maj = (v: unknown): void => { el[cle] = v; enregistrer(); };
    switch (r.sorte) {
      case 'teinte':
        return h('label', { class: 'at-reg' }, h('span', {}, r.nom), choixTeinte(String(el[cle] ?? 'contraste'), maj));
      case 'teintes': {
        const liste = (Array.isArray(el[cle]) ? el[cle] : []) as string[];
        const zone = h('div', { class: 'at-teintes' }, ...liste.map((t, i) => choixTeinte(t, (v) => { liste[i] = v; maj(liste); })));
        const actions = h('span', { class: 'row' },
          h('button', { class: 'btn sm sec', disabled: liste.length >= r.max, onclick: () => { liste.push('contraste'); maj(liste); dessiner(); } }, '+ couleur'),
          h('button', { class: 'btn sm sec', disabled: liste.length <= r.min, onclick: () => { liste.pop(); maj(liste); dessiner(); } }, '− couleur'));
        return h('div', { class: 'at-reg col' }, h('span', {}, r.nom), zone, actions);
      }
      case 'nombre': {
        const v = typeof el[cle] === 'number' ? (el[cle] as number) : AFFICHAGE_DEFAUT[cle] ?? (r.min + r.max) / 2;
        const curseur = h('input', { type: 'range', min: String(r.min), max: String(r.max), step: String(r.pas), value: String(v) });
        curseur.addEventListener('input', () => maj(Number(curseur.value)));
        return h('label', { class: 'at-reg' }, h('span', {}, r.nom), curseur);
      }
      case 'choix': {
        const select = h('select', {}, ...r.options.map(([val, nom]) => h('option', { value: String(val), ...(val === el[cle] ? { selected: true } : {}) }, nom)));
        select.addEventListener('change', () => maj(r.options.find(([val]) => String(val) === select.value)?.[0]));
        return h('label', { class: 'at-reg' }, h('span', {}, r.nom), select);
      }
      case 'chiffres': {
        const champ = h('input', { type: 'text', inputmode: 'numeric', maxlength: String(r.max), value: String(el[cle] ?? '') });
        champ.addEventListener('input', () => {
          champ.value = champ.value.replace(/[^0-9]/g, '').slice(0, r.max);
          if (champ.value) maj(champ.value);
        });
        return h('label', { class: 'at-reg' }, h('span', {}, r.nom), champ);
      }
      case 'positions': {
        const liste = (Array.isArray(el[cle]) ? el[cle] : [0.5]) as number[];
        const zone = h('div', { class: 'at-teintes' }, ...liste.map((p, i) => {
          const c = h('input', { type: 'range', min: '0.1', max: '0.9', step: '0.01', value: String(p), 'aria-label': `Place ${i + 1}` });
          c.addEventListener('input', () => { liste[i] = Number(c.value); maj(liste); });
          return c;
        }));
        const actions = h('span', { class: 'row' },
          h('button', { class: 'btn sm sec', disabled: liste.length >= r.max, onclick: () => { liste.push(0.5); maj(liste); dessiner(); } }, '+ place'),
          h('button', { class: 'btn sm sec', disabled: liste.length <= r.min, onclick: () => { liste.pop(); maj(liste); dessiner(); } }, '− place'));
        return h('div', { class: 'at-reg col' }, h('span', {}, r.nom), zone, actions);
      }
      case 'intervalle': {
        const iv = (Array.isArray(el[cle]) ? el[cle] : [0, 0.4]) as number[];
        const curseur = (i: number, nom: string): HTMLElement => {
          const c = h('input', { type: 'range', min: '0', max: '1', step: '0.01', value: String(iv[i]), 'aria-label': nom });
          c.addEventListener('input', () => { iv[i] = Number(c.value); maj([...iv]); });
          return h('label', { class: 'at-reg' }, h('span', {}, nom), c);
        };
        return h('div', { class: 'at-reg col' }, curseur(0, `${r.nom} : début`), curseur(1, `${r.nom} : fin`));
      }
    }
  };

  const carteMotif = (el: SkinElement, i: number): HTMLElement => {
    const m = motifDe(el.type)!;
    const deplacer = (d: number): void => {
      const j = i + d;
      if (j < 0 || j >= b.elements.length) return;
      [b.elements[i], b.elements[j]] = [b.elements[j], b.elements[i]];
      ouvert = j;
      enregistrer(); dessiner();
    };
    const tete = h('div', { class: 'at-tete' },
      h('button', { class: 'at-nom', 'aria-expanded': String(ouvert === i), onclick: () => { ouvert = ouvert === i ? -1 : i; dessiner(); } }, `${i + 1}. ${m.nom}`),
      h('button', { class: 'btn sm sec', title: 'Monter (dessiné plus tôt, donc dessous)', disabled: i === 0, onclick: () => deplacer(-1) }, '▲'),
      h('button', { class: 'btn sm sec', title: 'Descendre (dessiné plus tard, donc dessus)', disabled: i === b.elements.length - 1, onclick: () => deplacer(1) }, '▼'),
      h('button', { class: 'btn sm sec', title: 'Dupliquer', disabled: b.elements.length >= LIMITES_ATELIER.elementsMax, onclick: () => { b.elements.splice(i + 1, 0, copie(el)); ouvert = i + 1; enregistrer(); dessiner(); } }, '⧉'),
      h('button', { class: 'btn sm sec', title: 'Supprimer', onclick: () => { b.elements.splice(i, 1); ouvert = Math.min(ouvert, b.elements.length - 1); enregistrer(); dessiner(); } }, '✕'),
    );
    const corps = ouvert === i
      ? h('div', { class: 'at-corps' }, ...Object.entries(m.reglages).map(([cle, r]) => controle(el as unknown as Record<string, unknown>, cle, r)))
      : null;
    return h('div', { class: 'at-motif' + (ouvert === i ? ' ouvert' : '') }, tete, corps);
  };

  // ----- onglets -----
  const creer = (): (HTMLElement | null)[] => {
    const nom = h('input', { type: 'text', maxlength: String(LIMITES_ATELIER.nomMax), value: b.nom, placeholder: 'Nom de la livrée' });
    nom.addEventListener('input', () => { b.nom = nom.value; enregistrer(); });
    const desc = h('input', { type: 'text', maxlength: String(LIMITES_ATELIER.descriptionMax), value: b.description, placeholder: 'Une ligne : la référence, l\'idée…' });
    desc.addEventListener('input', () => { b.description = desc.value; enregistrer(); });
    const forcee = h('input', { type: 'checkbox', ...(b.couleurForcee ? { checked: true } : {}) });
    const couleurForcee = h('input', { type: 'color', value: b.couleurForcee ?? '#d4af37', 'aria-label': 'Couleur imposée' });
    couleurForcee.hidden = !b.couleurForcee;
    forcee.addEventListener('change', () => { b.couleurForcee = forcee.checked ? couleurForcee.value : null; couleurForcee.hidden = !forcee.checked; enregistrer(); dessiner(); });
    couleurForcee.addEventListener('input', () => { b.couleurForcee = couleurForcee.value; enregistrer(); });
    const ajout = h('select', { 'aria-label': 'Motif à ajouter' }, ...MOTIFS.map((m) => h('option', { value: m.type }, m.nom)));
    const plein = b.elements.length >= LIMITES_ATELIER.elementsMax;

    const proposer = async (): Promise<void> => {
      const v = validerLivree({ voiture: b.voiture, nom: b.nom, description: b.description, elements: b.elements, ...(b.couleurForcee ? { couleurForcee: b.couleurForcee } : {}) });
      if (!v.ok) { message = { texte: v.erreurs[0], err: true }; dessiner(); return; }
      envoi = true; message = null; dessiner();
      const r = await o.proposer(v.livree);
      envoi = false;
      if (r.ok) {
        message = { texte: 'Proposition envoyée ! Elle sera examinée avant d\'entrer dans les caisses.', err: false };
        b = { ...brouillonVide(b.voiture, b.couleurEssai) };
        ouvert = 0;
        mesPropositions = null;
        enregistrer();
      } else message = { texte: r.message, err: true };
      dessiner();
    };

    return [
      h('div', { class: 'choices voitures' }, ...CAR_IDS.map((id) =>
        h('button', { class: 'choice' + (id === b.voiture ? ' on' : ''), onclick: () => { b.voiture = id; enregistrer(); dessiner(); } }, h('b', {}, CARS[id].nom)))),
      h('div', { class: 'swatches' + (b.couleurForcee ? ' figees' : '') }, ...COULEURS.map((c) =>
        h('button', { class: 'swatch' + (c.hex === b.couleurEssai ? ' on' : ''), style: `background:${c.hex}`, title: `Essayer en ${c.nom.toLowerCase()}`, 'aria-label': c.nom, disabled: !!b.couleurForcee, onclick: () => { b.couleurEssai = c.hex; enregistrer(); dessiner(); } }))),
      h('label', { class: 'check' }, forcee, 'Imposer la couleur de carrosserie', couleurForcee),
      h('label', { class: 'champ' }, 'Nom', nom),
      h('label', { class: 'champ' }, 'Description', desc),
      h('h3', {}, `Motifs (${b.elements.length}/${LIMITES_ATELIER.elementsMax})`),
      h('p', { class: 'petit' }, 'Les motifs du bas sont dessinés par-dessus ceux du haut. « Contraste », « plus sombre » et « plus clair » suivent la couleur choisie par chaque joueur.'),
      ...b.elements.map(carteMotif),
      h('div', { class: 'row at-ajout' }, ajout,
        h('button', { class: 'btn sm', disabled: plein, onclick: () => { b.elements.push(nouvelElement(ajout.value as SkinElement['type'])); ouvert = b.elements.length - 1; enregistrer(); dessiner(); } }, 'Ajouter')),
      h('p', { class: 'petit' }, 'Une livrée validée entre dans les caisses de tous les joueurs, avec ton pseudo. Tu la reçois aussitôt, avec 5 clés. 3 propositions par jour au plus.'),
      message && h('p', { class: 'msg' + (message.err ? ' err' : ' ok') }, message.texte),
      o.peutProposer()
        ? h('button', { class: 'btn', disabled: envoi, onclick: () => void proposer() }, envoi ? 'Envoi…' : 'Proposer cette livrée')
        : h('button', { class: 'btn sec', onclick: o.onCompte }, 'Connecte-toi (avec un pseudo) pour proposer'),
    ];
  };

  const charger = (quoi: 'miennes' | 'moderer' | 'votes'): void => {
    const p = quoi === 'miennes' ? o.mesPropositions() : quoi === 'votes' ? o.enVote() : o.aModerer();
    void p.then((r) => {
      if (quoi === 'miennes') mesPropositions = r; else if (quoi === 'votes') enVote = r; else aModerer = r;
      if (onglet === quoi) dessiner();
    });
  };

  /** Compteur des votes d'une proposition (« 👍 3 · 👎 1 »), si le serveur les donne. */
  const compteVotes = (p: Proposition): string => (p.pour === undefined ? '' : `👍 ${p.pour} · 👎 ${p.contre ?? 0}`);

  const votes = (): (HTMLElement | null)[] => {
    if (!enVote) { charger('votes'); return [h('p', { class: 'petit' }, 'Chargement…')]; }
    if (!enVote.ok) return [h('p', { class: 'msg err' }, enVote.message.includes('pas encore disponible') ? 'Les votes de l\'Atelier arrivent bientôt.' : enVote.message)];
    if (!enVote.valeur.length) return [h('p', {}, 'Aucune proposition en attente : crée la tienne dans l\'onglet « Créer » !')];
    const peutVoter = o.peutProposer();
    return [
      h('p', { class: 'petit' }, 'Les propositions des joueurs en attente de validation. Donne ton avis : les plus aimées passent en premier devant l\'administrateur, et la plus aimée de la semaine est mise en avant à l\'écran des caisses.'),
      ...enVote.valeur.map((p) => {
        const msg = h('p', { class: 'msg err' });
        const compte = h('span', { class: 'at-votes' }, compteVotes(p));
        const voter = async (v: -1 | 1): Promise<void> => {
          const nouveau: -1 | 0 | 1 = p.monVote === v ? 0 : v;
          const r = await o.voter(p.id, nouveau);
          if (!r.ok) { msg.textContent = r.message; return; }
          p.pour = r.valeur.pour; p.contre = r.valeur.contre; p.monVote = nouveau;
          dessiner();
        };
        return h('div', { class: 'at-prop' },
          h('b', {}, p.livree.nom), h('small', {}, `${CARS[p.livree.voiture].nom} · par ${p.pseudo} · ${p.livree.description}`),
          h('div', { class: 'row' },
            h('button', { class: 'btn sm sec', onclick: () => voir(p) }, 'Voir'),
            p.mienne
              ? h('span', { class: 'petit' }, 'Ta proposition')
              : peutVoter
                ? h('span', { class: 'row at-vote' },
                  h('button', { class: 'btn sm' + (p.monVote === 1 ? '' : ' sec'), title: 'J\'aime', 'aria-pressed': String(p.monVote === 1), onclick: () => void voter(1) }, '👍'),
                  h('button', { class: 'btn sm' + (p.monVote === -1 ? '' : ' sec'), title: 'J\'aime pas', 'aria-pressed': String(p.monVote === -1), onclick: () => void voter(-1) }, '👎'))
                : h('button', { class: 'btn sm sec', onclick: o.onCompte }, 'Connecte-toi pour voter'),
            compte),
          msg,
        );
      }),
    ];
  };

  const voir = (p: Proposition): void => o.apercu(p.livree.voiture, b.couleurEssai, defDeLivree(p.livree));

  const miennes = (): (HTMLElement | null)[] => {
    if (!o.peutProposer()) return [h('p', {}, 'Connecte-toi pour voir tes propositions.'), h('button', { class: 'btn sec', onclick: o.onCompte }, 'Compte')];
    if (!mesPropositions) { charger('miennes'); return [h('p', { class: 'petit' }, 'Chargement…')]; }
    if (!mesPropositions.ok) return [h('p', { class: 'msg err' }, mesPropositions.message)];
    if (!mesPropositions.valeur.length) return [h('p', {}, 'Aucune proposition pour l\'instant : à toi de jouer dans l\'onglet « Créer » !')];
    return mesPropositions.valeur.map((p) => h('div', { class: 'at-prop ' + p.statut, style: p.rarete ? `--rc:${RARETES[p.rarete].couleur}` : '' },
      h('b', {}, p.livree.nom), h('small', {}, `${CARS[p.livree.voiture].nom} · ${p.livree.description}`),
      h('span', { class: 'at-statut' }, texteStatut(p)),
      h('div', { class: 'row' },
        h('button', { class: 'btn sm sec', onclick: () => voir(p) }, 'Voir'),
        h('button', { class: 'btn sm sec', onclick: () => {
          b = { voiture: p.livree.voiture, couleurEssai: b.couleurEssai, nom: p.livree.nom, description: p.livree.description, couleurForcee: p.livree.couleurForcee ?? null, elements: copie(p.livree.elements) };
          ouvert = -1; onglet = 'creer'; message = null; enregistrer(); dessiner();
        } }, 'Reprendre dans l\'éditeur')),
    ));
  };

  const moderer = (): (HTMLElement | null)[] => {
    if (!aModerer) { charger('moderer'); return [h('p', { class: 'petit' }, 'Chargement…')]; }
    if (!aModerer.ok) return [h('p', { class: 'msg err' }, aModerer.message)];
    if (!aModerer.valeur.length) return [h('p', {}, 'Rien à examiner pour l\'instant.')];
    return aModerer.valeur.map((p) => {
      const rarete = h('select', { 'aria-label': 'Rareté' }, ...RARETE_IDS.map((r) => h('option', { value: r }, RARETES[r].nom)));
      const motif = h('input', { type: 'text', maxlength: '200', placeholder: 'Motif du refus (facultatif)' });
      const msg = h('p', { class: 'msg err' });
      const decider = async (d: { valider: true; rarete: Rarete } | { valider: false; motif: string }): Promise<void> => {
        const r = await o.moderer(p.id, d);
        if (!r.ok) { msg.textContent = r.message; return; }
        aModerer = null; mesPropositions = null; enVote = null; dessiner();
      };
      return h('div', { class: 'at-prop' },
        h('b', {}, p.livree.nom), h('small', {}, `${CARS[p.livree.voiture].nom} · par ${p.pseudo} · ${p.livree.description}`),
        p.pour !== undefined && h('span', { class: 'at-votes' }, compteVotes(p)),
        h('div', { class: 'row' },
          h('button', { class: 'btn sm sec', onclick: () => voir(p) }, 'Voir'),
          rarete,
          h('button', { class: 'btn sm', onclick: () => void decider({ valider: true, rarete: rarete.value as Rarete }) }, 'Valider')),
        h('div', { class: 'row' }, motif, h('button', { class: 'btn sm sec', onclick: () => void decider({ valider: false, motif: motif.value }) }, 'Refuser')),
        msg,
      );
    });
  };

  const dessiner = (): void => {
    const ancien = panneau.querySelector('.garage-corps')?.scrollTop ?? 0;
    const corps = h('div', { class: 'garage-corps' }, ...(onglet === 'creer' ? creer() : onglet === 'miennes' ? miennes() : onglet === 'votes' ? votes() : moderer()));
    const tab = (id: Onglet, nom: string): HTMLElement => h('button', { class: 'tab' + (onglet === id ? ' on' : ''), onclick: () => {
      onglet = id;
      if (id === 'creer') majApercu();
      dessiner();
    } }, nom);
    panneau.replaceChildren(
      h('h2', {}, 'Atelier'),
      h('div', { class: 'tabs' }, tab('creer', 'Créer'), tab('miennes', 'Mes propositions'), tab('votes', 'Votes'), admin && tab('moderer', 'À valider')),
      corps,
      h('div', { class: 'row' }, h('button', { class: 'btn', onclick: () => { if (apercuDemande) cancelAnimationFrame(apercuDemande); o.onRetour(); } }, 'Retour')),
    );
    corps.scrollTop = ancien;
  };

  dessiner();
  majApercu();
  void o.estAdmin().then((a) => { if (a && !admin) { admin = true; if (ecran.isConnected) dessiner(); } });
  return ecran;
}
