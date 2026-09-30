import type { CarId, ModeId } from '../core/physics/types';
import { THEMES } from '../core/env/themes';
import { CARS, CAR_IDS } from '../core/physics/cars';
import { MODE_IDS, MODE_NOMS } from '../core/physics/assists';
import type { RaceResult } from '../core/race/race';
import { validateLevel } from '../core/level/validate';
import type { Reglages, Qualite } from '../storage/store';
import { COULEURS } from './couleurs';
import { accentSkin, choisirSkin, couleurEffective, skinChoisie, skinDef, skinsDe, type SkinId, type SkinsChoisies } from '../core/skins';
import { RARETES } from '../core/raretes';
import { ECONOMIE, livreeDebloquee, type GainCourse, type Progression } from '../core/economie';
import { iconeCadenas, iconeCle } from './svg';
import { formatScore, formatTime } from './format';

export function levelSummary(data: unknown): { nom: string; longueur: number; ambiance: 'jour' | 'coucher'; theme: string } | null {
  const v = validateLevel(data);
  if (!v.ok) return null;
  let l = 0;
  const r = v.level.route;
  for (let i = 1; i < r.length; i++) l += Math.hypot(r[i].x - r[i - 1].x, r[i].y - r[i - 1].y, r[i].z - r[i - 1].z);
  return { nom: v.level.nom, longueur: l, ambiance: v.level.ambiance, theme: THEMES[v.level.environnement].nom };
}

type Child = Node | string | null | undefined | false;
type Attrs = Record<string, string | boolean | ((e: Event) => void)>;

/** Petit constructeur d'éléments : h('button', { class: 'btn', onclick: f }, 'Texte'). */
export function h<K extends keyof HTMLElementTagNameMap>(tag: K, attrs: Attrs = {}, ...children: Child[]): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (typeof v === 'function') el.addEventListener(k.slice(2), v as EventListener);
    else if (typeof v === 'boolean') { if (v) el.setAttribute(k, ''); }
    else el.setAttribute(k, v);
  }
  for (const c of children) if (c !== null && c !== undefined && c !== false) el.append(c);
  return el;
}

const DESCRIPTIONS_VOITURES: Record<CarId, string> = {
  equilibree: 'Coupé fastback prévisible, pour débuter.',
  legere: 'Petit coupé des années 80, agile : on la fait glisser par le poids.',
  turbo: 'Grosse GT turbo, puissante : décroche au moindre coup de gaz.',
};

const DESCRIPTIONS_MODES: Record<ModeId, string> = {
  arcade: 'Bouton Drift : glissade guidée, la plus facile à tenir.',
  semi: 'On lance le drift soi-même, contre-braquage aidé.',
  exigeant: 'Aucune aide. Tout se dose à la main.',
};

export interface NiveauCarte { nom: string; detail: string; /** place du joueur dans le classement en ligne (texte prêt à afficher) */ place: string; /** raison pour laquelle le niveau ne se lance pas */ desactive?: string }

/** Bloc « clés gagnées » de l'écran des résultats (aussi réutilisé par la version mise à jour après la réponse du serveur). */
export function blocGains(c: GainCourse, onCaisses?: () => void): HTMLElement {
  const s = (n: number): string => `${n} clé${n > 1 ? 's' : ''}`;
  return h('div', { class: 'gains' }, iconeCle(),
    h('div', {},
      c.arrivee > 0 && h('b', {}, `+${s(c.arrivee)}`),
      c.record > 0 && h('b', { class: 'record' }, `+${c.record} clé record`),
      h('small', {}, `Total : ${s(c.total)}`, c.total >= ECONOMIE.coutCaisse ? ' · une caisse est prête !' : ''),
    ),
    onCaisses && h('button', { class: 'btn sm' + (c.total >= ECONOMIE.coutCaisse ? '' : ' sec'), onclick: onCaisses }, 'Caisses'),
  );
}

export class Screens {
  private progressEl: HTMLElement | null = null;
  private toastTimer = 0;
  private ongletNiveaux: 'off' | 'perso' | 'ligne' = 'off';
  private ecranNiveaux: HTMLElement | null = null;
  private boutonCompte: HTMLElement | null = null;

  constructor(private readonly root: HTMLElement) {}

  private show(...nodes: HTMLElement[]): void {
    this.root.replaceChildren(...nodes);
    this.progressEl = null;
  }

  clear(): void {
    this.show();
  }

  /** Affiche un écran construit ailleurs (éditeur, hub). */
  monter(node: HTMLElement): void {
    this.show(node);
  }

  loading(msg: string): void {
    const bar = h('i');
    this.show(h('div', { class: 'screen' }, h('h1', { class: 'logo' }, 'Drift', h('span', {}, 'Club')), h('p', {}, msg), h('div', { class: 'load' }, bar)));
    this.progressEl = bar;
  }

  setProgress(p: number): void {
    if (this.progressEl) this.progressEl.style.width = `${Math.round(p * 100)}%`;
  }

  error(titre: string, message: string, actions: { label: string; onClick: () => void }[]): void {
    this.show(h('div', { class: 'screen' }, h('div', { class: 'panel' },
      h('h2', {}, titre),
      h('p', { class: 'pre' }, message),
      h('div', { class: 'row' }, ...actions.map((a) => h('button', { class: 'btn', onclick: a.onClick }, a.label))),
    )));
  }

  accueil(o: { onJouer(): void; onGarage(): void; onCaisses(): void; onEditeur(): void; onCompte(): void; onReglages(): void; persistent: boolean; compte: string }): void {
    const compte = h('button', { class: 'btn sec', onclick: o.onCompte }, o.compte);
    this.boutonCompte = compte;
    this.show(h('div', { class: 'screen accueil' },
      h('h1', { class: 'logo big' }, 'Drift', h('span', {}, 'Club')),
      h('div', { class: 'menu' },
        h('button', { class: 'btn big', onclick: o.onJouer }, 'Jouer'),
        h('div', { class: 'duo' },
          h('button', { class: 'btn sec', onclick: o.onGarage }, 'Garage'),
          h('button', { class: 'btn sec', onclick: o.onCaisses }, 'Caisses'),
        ),
        h('button', { class: 'btn sec', onclick: o.onEditeur }, 'Éditeur'),
        compte,
        h('button', { class: 'btn sec', onclick: o.onReglages }, 'Réglages'),
      ),
      h('p', { class: 'hint' }, 'Z/W ou ↑ accélérer · S ou ↓ freiner · Q/A, D ou ← → tourner · Espace frein à main · R replacer · ⌫ recommencer · C caméra · Échap pause'),
      !o.persistent && h('p', { class: 'warn' }, 'Stockage indisponible : tes records et réglages ne seront pas enregistrés.'),
    ));
  }

  /** Met à jour le libellé du bouton Compte de l'accueil (connexion ou pseudo changé). */
  majCompte(libelle: string): void {
    if (this.boutonCompte && this.root.contains(this.boutonCompte)) this.boutonCompte.textContent = libelle;
  }

  niveaux(o: { cartes: NiveauCarte[]; perso: NiveauCarte[]; mode: ModeId; voiture: CarId; onChoisir(i: number): void; onChoisirPerso(i: number): void; onClassement(perso: boolean, i: number): void; onImporter(): void; /** contenu de l'onglet « En ligne » (créé au premier affichage) */ enLigne(): HTMLElement; onEditeur(): void; onGarage(): void; onReglages(): void; onRetour(): void }): void {
    const carte = (c: NiveauCarte, i: number, choisir: (i: number) => void, perso: boolean): HTMLElement =>
      h('div', { class: 'cardw' },
        h('button', { class: 'card' + (c.desactive ? ' off' : ''), title: c.desactive ?? '', onclick: () => (c.desactive ? this.toast(c.desactive) : choisir(i)) },
          h('span', { class: 'num' }, String(i + 1)),
          h('b', {}, c.nom),
          h('small', {}, c.detail),
          h('span', { class: 'rec' }, c.place),
        ),
        h('button', { class: 'btn sm sec', onclick: () => o.onClassement(perso, i) }, 'Classement'),
      );
    const render = (): void => {
      const onglet = this.ongletNiveaux;
      const perso = onglet === 'perso';
      const ligne = onglet === 'ligne';
      const ecran = h('div', { class: 'screen' }, h('div', { class: 'panel wide' + (ligne ? '' : ' liste') },
        h('h2', {}, 'Choisis un niveau'),
        h('div', { class: 'tabs' },
          h('button', { class: 'tab' + (onglet === 'off' ? ' on' : ''), onclick: () => { this.ongletNiveaux = 'off'; render(); } }, 'Officiels'),
          h('button', { class: 'tab' + (perso ? ' on' : ''), onclick: () => { this.ongletNiveaux = 'perso'; render(); } }, `Mes niveaux${o.perso.length ? ` (${o.perso.length})` : ''}`),
          h('button', { class: 'tab' + (ligne ? ' on' : ''), onclick: () => { this.ongletNiveaux = 'ligne'; render(); } }, 'En ligne'),
          h('button', { class: 'tab', onclick: o.onImporter }, 'Importer'),
        ),
        h('p', { class: 'sub' }, 'Mode ', h('b', {}, MODE_NOMS[o.mode]), ' · Voiture ', h('b', {}, CARS[o.voiture].nom)),
        ligne
          ? o.enLigne()
          : perso && o.perso.length === 0
            ? h('p', { class: 'sub' }, "Tu n'as pas encore créé de niveau. Ouvre l'éditeur pour dessiner ta première route, ou importe-en un !")
            : h('div', { class: 'cards' }, ...(perso ? o.perso.map((c, i) => carte(c, i, o.onChoisirPerso, true)) : o.cartes.map((c, i) => carte(c, i, o.onChoisir, false)))),
        h('div', { class: 'row' },
          h('button', { class: 'btn sec', onclick: o.onRetour }, 'Retour'),
          perso && h('button', { class: 'btn sec', onclick: o.onEditeur }, 'Éditeur'),
          h('button', { class: 'btn sec', onclick: o.onGarage }, 'Garage'),
          h('button', { class: 'btn sec', onclick: o.onReglages }, 'Réglages'),
        ),
      ));
      this.ecranNiveaux = ecran;
      this.show(ecran);
    };
    render();
  }

  /** true tant que l'écran de choix du niveau est affiché (pour les mises à jour asynchrones). */
  niveauxVisible(): boolean {
    return !!this.ecranNiveaux && this.root.contains(this.ecranNiveaux);
  }

  garage(o: {
    voiture: CarId; couleur: string; skins: SkinsChoisies; progression: Progression;
    onChange(voiture: CarId, couleur: string, skins: SkinsChoisies): void;
    /** aperçu 3D d'une livrée non enregistrée (verrouillée) ou retour à la livrée enregistrée */
    onApercu(voiture: CarId, couleur: string, skin: SkinId): void;
    onCaisses(): void; onRetour(): void;
  }): void {
    let voiture = o.voiture, couleur = o.couleur, skins = o.skins;
    /** livrée verrouillée en cours d'aperçu (jamais enregistrée) */
    let apercu: SkinId | null = null;
    const change = () => { apercu = null; o.onChange(voiture, couleur, skins); render(); };
    const render = () => {
      const choisie = skinChoisie(skins, voiture), affichee = apercu ?? choisie, def = skinDef(voiture, affichee);
      const verrou = apercu !== null;
      const forcee = def.couleurForcee !== undefined;
      const defilement = this.root.querySelector('.garage-corps')?.scrollTop ?? 0; // la liste garde sa place au re-rendu
      const corps = h('div', { class: 'garage-corps' },
        h('div', { class: 'choices' }, ...CAR_IDS.map((id) =>
          h('button', { class: 'choice' + (id === voiture ? ' on' : ''), onclick: () => { voiture = id; change(); } },
            h('b', {}, CARS[id].nom), h('small', {}, DESCRIPTIONS_VOITURES[id])))),
        h('div', { class: 'swatches' + (forcee ? ' figees' : '') }, ...COULEURS.map((c) =>
          h('button', { class: 'swatch' + (c.hex === couleur ? ' on' : ''), style: `background:${c.hex}`, title: forcee ? 'Couleur imposée par la livrée' : c.nom, 'aria-label': c.nom, disabled: forcee, onclick: () => { couleur = c.hex; change(); } }))),
        h('h3', {}, 'Livrée'),
        h('div', { class: 'skins' }, ...skinsDe(voiture).map((s) => {
          const libre = livreeDebloquee(o.progression, voiture, s.id);
          const classe = 'chip' + (libre ? '' : ' lock') + (libre && s.id === choisie && !verrou ? ' on' : '') + (s.id === apercu ? ' apercu' : '');
          return h('button', {
            class: classe, style: `--rc:${RARETES[s.rarete].couleur}`,
            title: `${s.nom} · ${RARETES[s.rarete].nom}${libre ? '' : ' · verrouillée'} — ${s.description}`,
            onclick: () => {
              if (libre) { skins = choisirSkin(skins, voiture, s.id); change(); return; }
              apercu = s.id; // aperçu seulement : rien n'est enregistré
              o.onApercu(voiture, couleur, s.id);
              render();
            },
          }, h('i', { style: `background:linear-gradient(135deg,${couleurEffective(s, couleur)} 50%,${accentSkin(s, couleur)} 50%)` }), s.nom, !libre && iconeCadenas());
        })),
      );
      this.show(h('div', { class: 'screen garage' }, h('div', { class: 'panel side' },
        h('h2', {}, 'Garage'),
        corps,
        h('div', { class: 'skin-info', style: `--rc:${RARETES[def.rarete].couleur}` },
          h('span', { class: 'cs-rarete' }, RARETES[def.rarete].nom),
          h('b', {}, def.nom),
          h('span', { class: 'petit skin-desc' }, def.description),
          verrou && h('span', { class: 'verrou' }, 'Verrouillée — à gagner dans une caisse'),
          forcee && h('span', { class: 'petit' }, 'Couleur imposée par la livrée'),
        ),
        h('div', { class: 'row' },
          h('button', { class: 'btn sec', onclick: o.onCaisses }, iconeCle(), `Caisses (${o.progression.cles} clé${o.progression.cles > 1 ? 's' : ''})`),
          h('button', { class: 'btn', onclick: o.onRetour }, 'Retour'),
        ),
      )));
      corps.scrollTop = defilement;
    };
    render();
  }

  reglages(o: { reglages: Reglages; touch: boolean; onChange(r: Reglages): void; onRetour(): void }): void {
    const r = { ...o.reglages };
    const change = () => { o.onChange({ ...r }); render(); };
    const QUALITES: [Qualite, string][] = [['auto', 'Auto'], ['basse', 'Basse'], ['haute', 'Haute']];
    const render = () => {
      this.show(h('div', { class: 'screen' }, h('div', { class: 'panel wide' },
        h('h2', {}, 'Réglages'),
        h('h3', {}, 'Mode de conduite'),
        h('div', { class: 'choices row3' }, ...MODE_IDS.map((m) =>
          h('button', { class: 'choice' + (m === r.mode ? ' on' : ''), onclick: () => { r.mode = m; change(); } },
            h('b', {}, MODE_NOMS[m]), h('small', {}, DESCRIPTIONS_MODES[m])))),
        h('h3', {}, 'Son'),
        h('div', { class: 'line' },
          h('input', { type: 'range', min: '0', max: '1', step: '0.05', value: String(r.volume), oninput: (e: Event) => { r.volume = parseFloat((e.target as HTMLInputElement).value); o.onChange({ ...r }); } }),
          h('label', { class: 'check' }, h('input', { type: 'checkbox', checked: r.muet, onchange: (e: Event) => { r.muet = (e.target as HTMLInputElement).checked; change(); } }), 'Muet'),
        ),
        h('h3', {}, 'Qualité graphique'),
        h('div', { class: 'seg' }, ...QUALITES.map(([q, label]) =>
          h('button', { class: 'tab' + (q === r.qualite ? ' on' : ''), onclick: () => { r.qualite = q; change(); } }, label))),
        h('h3', {}, 'Conduite'),
        h('label', { class: 'check' }, h('input', { type: 'checkbox', checked: r.cameraLoin, onchange: (e: Event) => { r.cameraLoin = (e.target as HTMLInputElement).checked; change(); } }), 'Caméra éloignée (touche C)'),
        h('label', { class: 'check' }, h('input', { type: 'checkbox', checked: r.detailPoints, onchange: (e: Event) => { r.detailPoints = (e.target as HTMLInputElement).checked; change(); } }), 'Détail des points de drift (vitesse, durée, angle)'),
        h('label', { class: 'check' }, h('input', { type: 'checkbox', checked: r.indicateurAngle, onchange: (e: Event) => { r.indicateurAngle = (e.target as HTMLInputElement).checked; change(); } }), 'Indicateur d\'angle sous la voiture'),
        o.touch && h('label', { class: 'check' }, h('input', { type: 'checkbox', checked: r.accelAuto, onchange: (e: Event) => { r.accelAuto = (e.target as HTMLInputElement).checked; change(); } }), 'Accélération automatique (tactile)'),
        h('button', { class: 'btn', onclick: o.onRetour }, 'Retour'),
      )));
    };
    render();
  }

  pause(o: { onReprendre(): void; onRecommencer(): void; onMenu(): void; menuLabel?: string }): void {
    this.show(h('div', { class: 'screen dim' }, h('div', { class: 'panel' },
      h('h2', {}, 'Pause'),
      h('button', { class: 'btn', onclick: o.onReprendre }, 'Reprendre'),
      h('button', { class: 'btn sec', onclick: o.onRecommencer }, 'Recommencer'),
      h('button', { class: 'btn sec', onclick: o.onMenu }, o.menuLabel ?? 'Menu'),
    )));
  }

  resultats(o: { result: RaceResult; record: boolean; persistent: boolean; /** clés gagnées à l'arrivée et total */ cles?: GainCourse; /** bloc de clés du compte, mis à jour après la réponse du serveur (prioritaire sur `cles`) */ gainsEnLigne?: HTMLElement | null; onCaisses?: () => void; onRecommencer(): void; onSuivant: (() => void) | null; onMenu(): void; menuLabel?: string; /** bloc classement en ligne, rempli après l'envoi du score */ enLigne?: HTMLElement | null }): void {
    const r = o.result;
    const ecart = r.time - r.targetTime;
    // deux colonnes (score | clés et boutons) sur téléphone en paysage, sinon une seule pile (voir styles.css)
    this.show(h('div', { class: 'screen dim' }, h('div', { class: 'panel resultats' },
      h('div', { class: 'res-g' },
      h('h2', {}, 'Arrivée !'),
      o.record && h('div', { class: 'badge' }, o.persistent ? 'Nouveau record !' : 'Nouveau record (non enregistré)'),
      h('div', { class: 'score' }, formatScore(r.score)),
      h('table', { class: 'detail' },
        h('tr', {}, h('td', {}, 'Points de drift'), h('td', {}, formatScore(r.driftPoints))),
        h('tr', {}, h('td', {}, 'Bonus de temps'), h('td', {}, formatScore(r.bonus))),
        h('tr', {}, h('td', {}, 'Temps'), h('td', {}, `${formatTime(r.time)} (${ecart <= 0 ? '−' : '+'}${formatTime(Math.abs(ecart))} / cible)`)),
        h('tr', {}, h('td', {}, 'Meilleur drift'), h('td', {}, formatScore(r.bestDrift))),
      ),
      ),
      h('div', { class: 'res-d' },
      o.gainsEnLigne ?? (o.cles && blocGains(o.cles, o.onCaisses)),
      o.enLigne,
      h('div', { class: 'row' },
        h('button', { class: 'btn', onclick: o.onRecommencer }, 'Recommencer'),
        o.onSuivant && h('button', { class: 'btn', onclick: o.onSuivant }, 'Niveau suivant'),
        h('button', { class: 'btn sec', onclick: o.onMenu }, o.menuLabel ?? 'Menu'),
      ),
      ),
    )));
  }

  toast(msg: string): void {
    const t = h('div', { class: 'toast' }, msg);
    this.root.append(t);
    window.clearTimeout(this.toastTimer);
    this.toastTimer = window.setTimeout(() => t.remove(), 2200);
  }
}
