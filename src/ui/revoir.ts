import { h } from './screens';
import { formatTime } from './format';
import { CAMERAS_FILM, NOMS_CAMERAS_FILM, type CameraFilm } from '../game/film';

export const VITESSES_FILM: readonly [number, string][] = [[0.25, '×¼'], [0.5, '×½'], [1, '×1'], [2, '×2'], [4, '×4']];

/** Ce que l'écran « Revoir » pilote (la session de course en mode film). */
export interface LecteurFilm {
  readonly lecture: { position: number; duree: number; vitesse: number; pause: boolean; camera: CameraFilm } | null;
  reglerFilm(o: { pause?: boolean; vitesse?: number; position?: number; camera?: CameraFilm }): void;
}

/**
 * Commandes de « Revoir sa course » : lecture / pause, avance et retour de 5 s, vitesse (ralenti, accéléré),
 * barre de temps, caméras de télévision, mode photo. Clavier : Espace, ← →, C ; Échap quitte (géré par l'app).
 */
export function ecranRevoir(o: { titre: string; lecteur: LecteurFilm; onPhoto(): void; onQuitter(): void }): HTMLElement {
  const L = o.lecteur;
  const lecture = h('button', { class: 'btn sm', title: 'Lecture / pause (Espace)', onclick: () => basculer() }, '⏸');
  const temps = h('span', { class: 'film-temps' }, '0:00.00');
  const barre = h('input', { type: 'range', min: '0', max: '1000', step: '1', value: '0', class: 'film-barre', 'aria-label': 'Position dans la course' });
  let glisse = false;
  barre.addEventListener('pointerdown', () => { glisse = true; });
  barre.addEventListener('pointerup', () => { glisse = false; });
  barre.addEventListener('input', () => {
    const l = L.lecture;
    if (l) L.reglerFilm({ position: (Number(barre.value) / 1000) * l.duree });
  });
  const vitesses = h('div', { class: 'seg' });
  const cameras = h('div', { class: 'seg' });
  const majBoutons = (): void => {
    const l = L.lecture;
    vitesses.replaceChildren(...VITESSES_FILM.map(([v, nom]) =>
      h('button', { class: 'tab' + (l?.vitesse === v ? ' on' : ''), onclick: () => { L.reglerFilm({ vitesse: v }); majBoutons(); } }, nom)));
    cameras.replaceChildren(...CAMERAS_FILM.map((c) =>
      h('button', { class: 'tab' + (l?.camera === c ? ' on' : ''), onclick: () => { L.reglerFilm({ camera: c }); majBoutons(); } }, NOMS_CAMERAS_FILM[c])));
  };
  majBoutons();
  const basculer = (): void => { const l = L.lecture; if (l) L.reglerFilm({ pause: !l.pause }); };
  const sauter = (d: number): void => { const l = L.lecture; if (l) L.reglerFilm({ position: l.position + d }); };
  const cameraSuivante = (): void => {
    const l = L.lecture;
    if (!l) return;
    L.reglerFilm({ camera: CAMERAS_FILM[(CAMERAS_FILM.indexOf(l.camera) + 1) % CAMERAS_FILM.length] });
    majBoutons();
  };

  const racine = h('div', { class: 'screen dim film' },
    h('div', { class: 'film-titre' }, h('b', {}, 'Revoir'), ' · ', o.titre),
    h('div', { class: 'film-commandes' },
      h('div', { class: 'film-ligne' },
        lecture,
        h('button', { class: 'btn sm sec', title: 'Reculer de 5 s (←)', onclick: () => sauter(-5) }, '−5 s'),
        h('button', { class: 'btn sm sec', title: 'Avancer de 5 s (→)', onclick: () => sauter(5) }, '+5 s'),
        barre,
        temps,
      ),
      h('div', { class: 'film-ligne' },
        vitesses,
        cameras,
        h('button', { class: 'btn sm sec', onclick: () => { if (L.lecture && !L.lecture.pause) L.reglerFilm({ pause: true }); o.onPhoto(); } }, 'Photo'),
        h('button', { class: 'btn sm', onclick: () => o.onQuitter() }, 'Quitter'),
      ),
    ),
  );

  const onKey = (e: KeyboardEvent): void => {
    if (!racine.isConnected) { window.removeEventListener('keydown', onKey); return; }
    if (e.code === 'Space') { e.preventDefault(); basculer(); }
    else if (e.code === 'ArrowLeft') { e.preventDefault(); sauter(-5); }
    else if (e.code === 'ArrowRight') { e.preventDefault(); sauter(5); }
    else if (e.code === 'KeyC') cameraSuivante();
  };
  window.addEventListener('keydown', onKey);

  // la barre et le temps suivent la lecture
  const suivre = (): void => {
    if (!racine.isConnected) { window.removeEventListener('keydown', onKey); return; }
    const l = L.lecture;
    if (l) {
      if (!glisse) barre.value = String(Math.round((l.position / Math.max(1e-6, l.duree)) * 1000));
      temps.textContent = `${formatTime(l.position)} / ${formatTime(l.duree)}`;
      const icone = l.pause ? '▶' : '⏸';
      if (lecture.textContent !== icone) lecture.textContent = icone;
    }
    requestAnimationFrame(suivre);
  };
  requestAnimationFrame(suivre);
  return racine;
}
