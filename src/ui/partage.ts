import type { Level } from '../core/level/types';
import { encoderNiveau } from '../core/level/encode';
import { LONGUEUR_LIEN_SURE, lienNiveau, lienEnLigne } from '../share/lien';
import { telechargerJson } from '../share/fichier';
import { lireSaisie, lireFichier, type Lecture } from '../share/importer';
import type { Resultat } from '../online/classement';
import type { EtatCompte } from '../online/compte';
import type { NiveauCharge } from '../online/niveaux';
import type { MonNiveau } from '../storage/store';
import { longueurRoute } from '../editor/format';
import { formatDistance, libelleAmbiance } from './format';
import { h } from './screens';
import { modale } from './dialog';

const adresseJeu = (): { origine: string; base: string } => ({ origine: location.origin, base: import.meta.env.BASE_URL });

/** Copie dans le presse-papiers ; à défaut sélectionne le champ (Ctrl+C). Renvoie true si la copie a eu lieu. */
async function copier(texte: string, champ: HTMLInputElement | HTMLTextAreaElement): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(texte);
    return true;
  } catch { /* presse-papiers refusé ou indisponible : repli ci-dessous */ }
  champ.focus();
  champ.select();
  try { return document.execCommand('copy'); } catch { return false; }
}

// ───────────────────────── Partager ─────────────────────────

export interface OptionsPartage {
  root: HTMLElement;
  /** niveau valide (l'appelant a déjà refusé les niveaux à corriger) */
  level: Level;
  compte(): EtatCompte;
  service: { publier(level: Level): Promise<Resultat<{ id: string; empreinte: string }>> };
  /** ouvre l'écran Compte ; la fenêtre est déjà fermée */
  onCompte(): void;
}

/** Fenêtre « Partager » : lien, code, .json, partage du téléphone et publication en ligne. */
export function ouvrirPartage(o: OptionsPartage): void {
  const niveau = structuredClone(o.level);
  const statut = h('p', { class: 'msg' });
  const dire = (texte: string, ok = true): void => { statut.textContent = texte; statut.className = `msg ${ok ? 'ok' : 'err'}`; };

  /** Champ en lecture seule + bouton Copier. */
  const ligneCopie = (label: string, bouton: string, ok: string) => {
    const champ = h('input', { type: 'text', readonly: true, 'aria-label': label, spellcheck: 'false' });
    champ.addEventListener('focus', () => champ.select());
    const b = h('button', {
      class: 'btn sm', disabled: true,
      onclick: () => void copier(champ.value, champ).then((c) => dire(c ? ok : 'Copie automatique impossible : le texte est sélectionné, fais Ctrl+C.', c)),
    }, bouton);
    return {
      el: h('div', { class: 'copie' }, h('span', { class: 'lbl' }, label), h('div', { class: 'line' }, champ, b)),
      remplir(v: string): void { champ.value = v; b.disabled = false; },
    };
  };

  modale(o.root, 'Partager ce niveau', (fermer) => {
    const lien = ligneCopie('Lien', 'Copier le lien', 'Lien copié !');
    const code = ligneCopie('Code', 'Copier le code', 'Code copié !');
    const info = h('p', { class: 'petit' }, 'Calcul du lien…');

    let adresse = '';
    encoderNiveau(niveau).then((c) => {
      const { origine, base } = adresseJeu();
      adresse = lienNiveau(origine, base, c);
      lien.remplir(adresse);
      code.remplir(c);
      btnPartager?.removeAttribute('disabled');
      if (adresse.length > LONGUEUR_LIEN_SURE) {
        info.className = 'msg err';
        info.textContent = `Ce lien fait ${adresse.length} caractères : certaines applis risquent de le tronquer. Préfère le fichier .json ou « Publier en ligne ».`;
      } else {
        info.textContent = `Le lien contient tout le niveau (${adresse.length} caractères) : il fonctionne sans internet ni compte.`;
      }
    }).catch((e: unknown) => {
      info.className = 'msg err';
      info.textContent = e instanceof Error ? e.message : 'Impossible de créer le lien.';
    });

    const btnPartager = typeof navigator.share === 'function'
      ? h('button', {
        class: 'btn sm', disabled: true,
        onclick: () => {
          navigator.share({ title: niveau.nom, text: `Mon niveau Drift Club : ${niveau.nom}`, url: adresse })
            .catch((e: unknown) => { if (!(e instanceof DOMException && e.name === 'AbortError')) dire('Partage impossible.', false); });
        },
      }, 'Partager…')
      : null;

    // publication en ligne
    const zonePub = h('div', { class: 'pub' });
    const btnPub = h('button', { class: 'btn sm', onclick: () => void publier() }, 'Publier en ligne');
    const publier = async (): Promise<void> => {
      const c = o.compte();
      if (c.statut !== 'connecte' || !c.pseudo) {
        zonePub.replaceChildren(
          h('p', { class: 'msg err' }, c.statut !== 'connecte' ? 'Connecte-toi pour publier un niveau en ligne.' : 'Choisis un pseudo pour publier un niveau en ligne.'),
          h('div', { class: 'row' }, h('button', { class: 'btn sm', onclick: () => { fermer(); o.onCompte(); } }, 'Ouvrir Compte')),
        );
        return;
      }
      btnPub.disabled = true;
      zonePub.replaceChildren(h('p', { class: 'sub petit' }, 'Publication…'));
      const r = await o.service.publier(niveau);
      if (!r.ok) {
        btnPub.disabled = false;
        zonePub.replaceChildren(h('p', { class: 'msg err' }, r.message));
        return;
      }
      const { origine, base } = adresseJeu();
      const court = ligneCopie('Lien du niveau en ligne', 'Copier le lien court', 'Lien court copié !');
      court.remplir(lienEnLigne(origine, base, r.valeur.id));
      zonePub.replaceChildren(
        h('p', { class: 'msg ok' }, 'Publié ! Ton niveau est visible dans l’onglet « En ligne » du choix de niveau.'),
        court.el,
      );
    };

    return [
      h('p', { class: 'sub' }, h('b', {}, niveau.nom)),
      lien.el, info, code.el,
      h('div', { class: 'row' },
        h('button', { class: 'btn sm', onclick: () => { telechargerJson(niveau); dire('Fichier .json téléchargé.'); } }, 'Télécharger le .json'),
        btnPartager,
      ),
      h('h3', {}, 'En ligne'),
      h('p', { class: 'petit' }, 'Publie ton niveau pour que tout le monde puisse le trouver et le jouer (compte requis).'),
      h('div', { class: 'row' }, btnPub),
      zonePub,
      statut,
      h('div', { class: 'row' }, h('button', { class: 'btn sec', onclick: fermer }, 'Fermer')),
    ];
  });
}

// ───────────────────────── Importer ─────────────────────────

export type ResultatImport = { action: 'fermer' } | { action: 'jouer' | 'modifier'; niveau: MonNiveau };

export interface OptionsImport {
  root: HTMLElement;
  /** enregistre le niveau importé dans Mes niveaux */
  enregistrer(level: Level): MonNiveau;
  chargerEnLigne(id: string): Promise<Resultat<NiveauCharge>>;
}

/** Fenêtre « Importer » : code, lien ou fichier .json. Se termine quand le joueur choisit Jouer, Modifier ou Fermer. */
export function ouvrirImport(o: OptionsImport): Promise<ResultatImport> {
  return new Promise((resolve) => {
    modale(o.root, 'Importer un niveau', (fermer) => {
      const zone = h('textarea', { rows: '3', placeholder: 'Colle ici un code ou un lien de partage', spellcheck: 'false', 'aria-label': 'Code ou lien du niveau' });
      const erreurs = h('div', { class: 'erreurs' });
      const corps = h('div', { class: 'imp' });
      const fichier = h('input', { type: 'file', accept: '.json,application/json,text/plain', class: 'cache' });

      const succes = (level: Level): void => {
        const n = o.enregistrer(level);
        corps.replaceChildren(
          h('p', { class: 'msg ok' }, 'Niveau importé dans Mes niveaux.'),
          h('p', { class: 'sub' }, h('b', {}, n.level.nom), n.level.auteur && ` · par ${n.level.auteur}`, ` · ${formatDistance(longueurRoute(n.level))}`),
          h('div', { class: 'row' },
            h('button', { class: 'btn', onclick: () => { resolve({ action: 'jouer', niveau: n }); fermer(); } }, 'Jouer'),
            h('button', { class: 'btn sec', onclick: () => { resolve({ action: 'modifier', niveau: n }); fermer(); } }, 'Modifier'),
            h('button', { class: 'btn sec', onclick: fermer }, 'Fermer'),
          ),
        );
      };
      const echec = (liste: string[]): void => {
        erreurs.replaceChildren(h('p', { class: 'msg err' }, 'Niveau refusé :'), h('ul', { class: 'err-liste' }, ...liste.slice(0, 8).map((e) => h('li', {}, e))));
      };
      let occupe = false;
      const traiter = async (lecture: Promise<Lecture>): Promise<void> => {
        if (occupe) return;
        occupe = true;
        erreurs.replaceChildren(h('p', { class: 'sub petit' }, 'Lecture…'));
        try {
          const l = await lecture;
          if (l.type === 'niveau') succes(l.level);
          else if (l.type === 'erreur') echec(l.erreurs);
          else {
            const r = await o.chargerEnLigne(l.id);
            if (r.ok) succes(r.valeur.level); else echec([r.message]);
          }
        } catch { echec(['Import impossible.']); } finally { occupe = false; }
      };

      fichier.addEventListener('change', () => {
        const f = fichier.files?.[0];
        fichier.value = '';
        if (f) void traiter(lireFichier(f));
      });
      corps.append(
        h('p', { class: 'sub' }, 'Colle le code ou le lien que l’on t’a envoyé, ou choisis un fichier .json.'),
        h('label', { class: 'ed-f' }, h('span', {}, 'Code ou lien'), zone),
        erreurs,
        h('div', { class: 'row' },
          h('button', { class: 'btn', onclick: () => void traiter(lireSaisie(zone.value)) }, 'Importer'),
          h('button', { class: 'btn sec', onclick: () => fichier.click() }, 'Choisir un .json'),
          h('button', { class: 'btn sec', onclick: fermer }, 'Annuler'),
        ),
        fichier,
      );
      setTimeout(() => zone.focus(), 0);
      return [corps];
    }, () => resolve({ action: 'fermer' }));
  });
}

// ───────────────────────── Niveau partagé (ouverture d'un lien) ─────────────────────────

export interface OptionsCarte {
  level: Level;
  /** auteur affiché : auteur du niveau, ou pseudo du compte pour un niveau en ligne ; vide = omis */
  par: string;
  persistent: boolean;
  /** vrai si le niveau est déjà dans Mes niveaux (retour de course) */
  enregistre: boolean;
  onJouer(): void;
  /** enregistre (une seule fois) dans Mes niveaux */
  onEnregistrer(): void;
  /** ouvre l'éditeur sur une copie enregistrée */
  onModifier(): void;
  onRetour(): void;
}

/** Écran « Niveau partagé : nom, par auteur » : Jouer / Enregistrer / Modifier une copie / Retour. */
export function carteNiveauPartage(o: OptionsCarte): HTMLElement {
  const l = o.level;
  const info = h('p', { class: 'msg ok' });
  const enregistrer = h('button', { class: 'btn sec', disabled: o.enregistre }, o.enregistre ? 'Enregistré' : 'Enregistrer dans mes niveaux');
  enregistrer.addEventListener('click', () => {
    o.onEnregistrer();
    enregistrer.setAttribute('disabled', '');
    enregistrer.textContent = 'Enregistré';
    info.textContent = o.persistent ? 'Ajouté à Mes niveaux.' : 'Ajouté à Mes niveaux (stockage indisponible : il sera perdu à la fermeture).';
  });
  return h('div', { class: 'screen' }, h('div', { class: 'panel' },
    h('h2', {}, 'Niveau partagé'),
    h('p', { class: 'sub' }, 'Niveau partagé : ', h('b', {}, l.nom), o.par && `, par ${o.par}`),
    h('p', { class: 'petit' }, `${formatDistance(longueurRoute(l))} · ${libelleAmbiance(l)}`),
    h('div', { class: 'col-actions' },
      h('button', { class: 'btn big', onclick: o.onJouer }, 'Jouer'),
      enregistrer,
      h('button', { class: 'btn sec', onclick: o.onModifier }, 'Modifier une copie'),
      h('button', { class: 'btn sec', onclick: o.onRetour }, 'Retour'),
    ),
    info,
  ));
}
