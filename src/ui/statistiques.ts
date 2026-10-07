import { h } from './screens';
import { formatDistance, formatScore } from './format';
import { CARS } from '../core/physics/cars';
import { formatDuree, voiturePreferee, type Statistiques } from '../game/statistiques';
import { iconeMedaille } from './svg';
import type { Medaille } from '../core/medailles';

/** Écran « Statistiques du pilote » (celles du compte connecté, sinon celles de l'appareil). */
export function ecranStatistiques(o: { stats: Statistiques; /** « ton compte (Max) » ou « cet appareil » */ source: string; medailles: Record<Medaille, number>; niveaux: number; onRetour(): void }): HTMLElement {
  const s = o.stats;
  const pref = voiturePreferee(s);
  const total = s.distanceCourse + s.distanceZen;
  const tuile = (valeur: string, nom: string, detail?: string): HTMLElement =>
    h('div', { class: 'stat' }, h('b', {}, valeur), h('span', {}, nom), detail ? h('small', {}, detail) : null);
  const date = s.depuis ? new Date(s.depuis + 'T12:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }) : null;
  return h('div', { class: 'screen' }, h('div', { class: 'panel wide statistiques' },
    h('h2', {}, 'Statistiques du pilote'),
    h('p', { class: 'hint' }, date ? `Comptées sur ${o.source} depuis le ${date}.` : `Comptées sur ${o.source} : joue une course pour commencer.`),
    h('div', { class: 'stats-grille' },
      tuile(formatDistance(total), 'parcourus', `dont ${formatDistance(s.distanceZen)} en mode Zen`),
      tuile(formatDuree(s.tempsGlisse), 'en glisse', total > 0 && s.tempsGlisse > 0 ? `${formatDistance(s.distanceCourse)} en course` : undefined),
      tuile(`${s.plusLongDrift.toFixed(1).replace('.', ',')} s`, 'plus long drift'),
      tuile(formatScore(s.meilleurDrift), 'meilleur drift', `${formatScore(s.drifts)} drift${s.drifts > 1 ? 's' : ''} encaissé${s.drifts > 1 ? 's' : ''}`),
      tuile(formatScore(s.courses), `course${s.courses > 1 ? 's' : ''} finie${s.courses > 1 ? 's' : ''}`),
      tuile(pref ? CARS[pref].nom : '—', 'voiture la plus jouée', pref ? formatDistance(s.parVoiture[pref] ?? 0) : undefined),
    ),
    h('h3', {}, 'Médailles'),
    h('div', { class: 'stats-medailles' },
      ...(['or', 'argent', 'bronze'] as const).map((m) => h('span', { class: 'stat-medaille' }, iconeMedaille(m), h('b', {}, String(o.medailles[m])))),
      h('small', {}, `sur ${o.niveaux} niveaux officiels`),
    ),
    h('button', { class: 'btn', onclick: o.onRetour }, 'Retour'),
  ));
}
