import type { CarId, ModeId } from '../core/physics/types';
import { CARS, CAR_IDS } from '../core/physics/cars';
import { MODE_IDS, MODE_NOMS } from '../core/physics/assists';
import type { RaceResult } from '../core/race/race';
import { validateLevel } from '../core/level/validate';
import type { Reglages, RecordEntry, Qualite } from '../storage/store';
import { COULEURS } from './couleurs';
import { formatScore, formatTime } from './format';

export function levelSummary(data: unknown): { nom: string; longueur: number; ambiance: 'jour' | 'coucher' } | null {
  const v = validateLevel(data);
  if (!v.ok) return null;
  let l = 0;
  const r = v.level.route;
  for (let i = 1; i < r.length; i++) l += Math.hypot(r[i].x - r[i - 1].x, r[i].y - r[i - 1].y, r[i].z - r[i - 1].z);
  return { nom: v.level.nom, longueur: l, ambiance: v.level.ambiance };
}

type Child = Node | string | null | undefined | false;
type Attrs = Record<string, string | boolean | ((e: Event) => void)>;

/** Petit constructeur d'elements : h('button', { class: 'btn', onclick: f }, 'Texte'). */
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
  equilibree: 'Coupe fastback previsible, pour debuter.',
  legere: 'Petit coupe des annees 80, agile : on la fait glisser par le poids.',
  turbo: 'Grosse GT turbo, puissante : decroche au moindre coup de gaz.',
};

const DESCRIPTIONS_MODES: Record<ModeId, string> = {
  arcade: 'Bouton Drift : glissade guidee, pas de tete-a-queue.',
  semi: 'On lance le drift soi-meme, contre-braquage aide.',
  exigeant: 'Aucune aide. Tout se dose a la main.',
};

export interface NiveauCarte { nom: string; detail: string; record: RecordEntry | null }

export class Screens {
  private progressEl: HTMLElement | null = null;
  private toastTimer = 0;

  constructor(private readonly root: HTMLElement) {}

  private show(...nodes: HTMLElement[]): void {
    this.root.replaceChildren(...nodes);
    this.progressEl = null;
  }

  clear(): void {
    this.show();
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

  accueil(o: { onJouer(): void; onGarage(): void; onEditeur(): void; onReglages(): void; persistent: boolean }): void {
    this.show(h('div', { class: 'screen accueil' },
      h('h1', { class: 'logo big' }, 'Drift', h('span', {}, 'Club')),
      h('div', { class: 'menu' },
        h('button', { class: 'btn big', onclick: o.onJouer }, 'Jouer'),
        h('button', { class: 'btn sec', onclick: o.onGarage }, 'Garage'),
        h('button', { class: 'btn sec', onclick: o.onEditeur }, 'Editeur ', h('small', {}, 'bientot')),
        h('button', { class: 'btn sec', onclick: o.onReglages }, 'Reglages'),
      ),
      h('p', { class: 'hint' }, 'Z/W ou ↑ accelerer · S ou ↓ freiner · Q/A, D ou ← → tourner · Espace frein a main · R replacer · C camera · Echap pause'),
      !o.persistent && h('p', { class: 'warn' }, 'Stockage indisponible : tes records et reglages ne seront pas enregistres.'),
    ));
  }

  niveaux(o: { cartes: NiveauCarte[]; mode: ModeId; voiture: CarId; onChoisir(i: number): void; onGarage(): void; onReglages(): void; onRetour(): void }): void {
    this.show(h('div', { class: 'screen' }, h('div', { class: 'panel wide' },
      h('h2', {}, 'Choisis un niveau'),
      h('div', { class: 'tabs' },
        h('button', { class: 'tab on' }, 'Officiels'),
        h('button', { class: 'tab', disabled: true }, 'Mes niveaux · bientot'),
        h('button', { class: 'tab', disabled: true }, 'Importer · bientot'),
      ),
      h('p', { class: 'sub' }, 'Mode ', h('b', {}, MODE_NOMS[o.mode]), ' · Voiture ', h('b', {}, CARS[o.voiture].nom)),
      h('div', { class: 'cards' }, ...o.cartes.map((c, i) =>
        h('button', { class: 'card', onclick: () => o.onChoisir(i) },
          h('span', { class: 'num' }, String(i + 1)),
          h('b', {}, c.nom),
          h('small', {}, c.detail),
          h('span', { class: 'rec' }, c.record ? `Record : ${formatScore(c.record.score)}` : 'Pas encore de record'),
        ))),
      h('div', { class: 'row' },
        h('button', { class: 'btn sec', onclick: o.onRetour }, 'Retour'),
        h('button', { class: 'btn sec', onclick: o.onGarage }, 'Garage'),
        h('button', { class: 'btn sec', onclick: o.onReglages }, 'Reglages'),
      ),
    )));
  }

  garage(o: { voiture: CarId; couleur: string; onChange(voiture: CarId, couleur: string): void; onRetour(): void }): void {
    let voiture = o.voiture, couleur = o.couleur;
    const render = () => {
      this.show(h('div', { class: 'screen garage' }, h('div', { class: 'panel side' },
        h('h2', {}, 'Garage'),
        h('div', { class: 'choices' }, ...CAR_IDS.map((id) =>
          h('button', { class: 'choice' + (id === voiture ? ' on' : ''), onclick: () => { voiture = id; o.onChange(voiture, couleur); render(); } },
            h('b', {}, CARS[id].nom), h('small', {}, DESCRIPTIONS_VOITURES[id])))),
        h('div', { class: 'swatches' }, ...COULEURS.map((c) =>
          h('button', { class: 'swatch' + (c.hex === couleur ? ' on' : ''), style: `background:${c.hex}`, title: c.nom, 'aria-label': c.nom, onclick: () => { couleur = c.hex; o.onChange(voiture, couleur); render(); } }))),
        h('button', { class: 'btn', onclick: o.onRetour }, 'Retour'),
      )));
    };
    render();
  }

  reglages(o: { reglages: Reglages; touch: boolean; onChange(r: Reglages): void; onRetour(): void }): void {
    const r = { ...o.reglages };
    const change = () => { o.onChange({ ...r }); render(); };
    const QUALITES: [Qualite, string][] = [['auto', 'Auto'], ['basse', 'Basse'], ['haute', 'Haute']];
    const render = () => {
      this.show(h('div', { class: 'screen' }, h('div', { class: 'panel wide' },
        h('h2', {}, 'Reglages'),
        h('h3', {}, 'Mode de conduite'),
        h('div', { class: 'choices row3' }, ...MODE_IDS.map((m) =>
          h('button', { class: 'choice' + (m === r.mode ? ' on' : ''), onclick: () => { r.mode = m; change(); } },
            h('b', {}, MODE_NOMS[m]), h('small', {}, DESCRIPTIONS_MODES[m])))),
        h('h3', {}, 'Son'),
        h('div', { class: 'line' },
          h('input', { type: 'range', min: '0', max: '1', step: '0.05', value: String(r.volume), oninput: (e: Event) => { r.volume = parseFloat((e.target as HTMLInputElement).value); o.onChange({ ...r }); } }),
          h('label', { class: 'check' }, h('input', { type: 'checkbox', checked: r.muet, onchange: (e: Event) => { r.muet = (e.target as HTMLInputElement).checked; change(); } }), 'Muet'),
        ),
        h('h3', {}, 'Qualite graphique'),
        h('div', { class: 'seg' }, ...QUALITES.map(([q, label]) =>
          h('button', { class: 'tab' + (q === r.qualite ? ' on' : ''), onclick: () => { r.qualite = q; change(); } }, label))),
        h('h3', {}, 'Conduite'),
        h('label', { class: 'check' }, h('input', { type: 'checkbox', checked: r.cameraLoin, onchange: (e: Event) => { r.cameraLoin = (e.target as HTMLInputElement).checked; change(); } }), 'Camera eloignee (touche C)'),
        o.touch && h('label', { class: 'check' }, h('input', { type: 'checkbox', checked: r.accelAuto, onchange: (e: Event) => { r.accelAuto = (e.target as HTMLInputElement).checked; change(); } }), 'Acceleration automatique (tactile)'),
        h('button', { class: 'btn', onclick: o.onRetour }, 'Retour'),
      )));
    };
    render();
  }

  pause(o: { onReprendre(): void; onRecommencer(): void; onMenu(): void }): void {
    this.show(h('div', { class: 'screen dim' }, h('div', { class: 'panel' },
      h('h2', {}, 'Pause'),
      h('button', { class: 'btn', onclick: o.onReprendre }, 'Reprendre'),
      h('button', { class: 'btn sec', onclick: o.onRecommencer }, 'Recommencer'),
      h('button', { class: 'btn sec', onclick: o.onMenu }, 'Menu'),
    )));
  }

  resultats(o: { result: RaceResult; record: boolean; persistent: boolean; onRecommencer(): void; onSuivant: (() => void) | null; onMenu(): void }): void {
    const r = o.result;
    const ecart = r.time - r.targetTime;
    this.show(h('div', { class: 'screen dim' }, h('div', { class: 'panel' },
      h('h2', {}, 'Arrivee !'),
      o.record && h('div', { class: 'badge' }, o.persistent ? 'Nouveau record !' : 'Nouveau record (non enregistre)'),
      h('div', { class: 'score' }, formatScore(r.score)),
      h('table', { class: 'detail' },
        h('tr', {}, h('td', {}, 'Points de drift'), h('td', {}, formatScore(r.driftPoints))),
        h('tr', {}, h('td', {}, 'Bonus de temps'), h('td', {}, formatScore(r.bonus))),
        h('tr', {}, h('td', {}, 'Temps'), h('td', {}, `${formatTime(r.time)} (${ecart <= 0 ? '−' : '+'}${formatTime(Math.abs(ecart))} / cible)`)),
        h('tr', {}, h('td', {}, 'Meilleur drift'), h('td', {}, formatScore(r.bestDrift))),
      ),
      h('div', { class: 'row' },
        h('button', { class: 'btn', onclick: o.onRecommencer }, 'Recommencer'),
        o.onSuivant && h('button', { class: 'btn', onclick: o.onSuivant }, 'Niveau suivant'),
        h('button', { class: 'btn sec', onclick: o.onMenu }, 'Menu'),
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
