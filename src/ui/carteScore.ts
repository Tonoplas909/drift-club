import type { Medaille } from '../core/medailles';
import { formatScore, formatTime } from './format';

/** Ce qu'affiche la carte de score. */
export interface InfosCarte {
  niveau: string;
  score: number;
  meilleurDrift: number;
  temps: number;
  voiture: string;
  livree: string;
  mode: string;
  medaille: Medaille | null;
  record: boolean;
  /** adresse du jeu, écrite en bas de la carte */
  lien: string;
}

export const LARGEUR_CARTE = 1200;
export const HAUTEUR_CARTE = 675;

/** Textes de la carte (fonction pure, testée). */
export function textesCarte(i: InfosCarte): { titre: string; score: string; badge: string | null; lignes: [string, string][]; pied: string } {
  const voiture = i.livree && i.livree !== 'Unie' ? `${i.voiture} · ${i.livree}` : i.voiture;
  return {
    titre: i.niveau,
    score: formatScore(i.score),
    badge: i.medaille ? `Médaille ${i.medaille === 'or' ? 'd\'or' : i.medaille === 'argent' ? 'd\'argent' : 'de bronze'}` : i.record ? 'Nouveau record' : null,
    lignes: [['Meilleur drift', formatScore(i.meilleurDrift)], ['Temps', formatTime(i.temps)], ['Voiture', voiture], ['Mode', i.mode]],
    pied: i.lien.replace(/^https?:\/\//, '').replace(/\/$/, ''),
  };
}

const COULEURS_MEDAILLES: Record<Medaille, string> = { bronze: '#d08a4e', argent: '#c9ced8', or: '#ffd23f' };

function arrondi(g: CanvasRenderingContext2D, x: number, y: number, l: number, h: number, r: number): void {
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + l, y, x + l, y + h, r);
  g.arcTo(x + l, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + l, y, r);
  g.closePath();
}

/** Texte réduit jusqu'à tenir dans `max` px. */
function ajuster(g: CanvasRenderingContext2D, texte: string, poids: number, taille: number, max: number): void {
  let t = taille;
  g.font = `${poids} ${t}px 'Baloo 2', system-ui, sans-serif`;
  while (t > 12 && g.measureText(texte).width > max) { t -= 2; g.font = `${poids} ${t}px 'Baloo 2', system-ui, sans-serif`; }
}

/**
 * Dessine la carte : la capture de la course en fond (recadrée), un panneau crème avec le niveau, le score, la médaille,
 * le meilleur drift, le temps, la voiture et le mode, et l'adresse du jeu. `capture` peut manquer (fond uni).
 */
export function dessinerCarte(capture: CanvasImageSource & { width: number; height: number } | null, i: InfosCarte): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = LARGEUR_CARTE; c.height = HAUTEUR_CARTE;
  const g = c.getContext('2d');
  if (!g) throw new Error('canvas 2D indisponible');
  const t = textesCarte(i);
  const encre = '#15131c', creme = '#fff6e5', orange = '#ff8a1f';

  // fond : capture recadrée pour remplir la carte, ou dégradé du ciel
  const px = 44, py = 44, pl = 470, ph = HAUTEUR_CARTE - 88;
  if (capture && capture.width > 0 && capture.height > 0) {
    // la voiture (au centre de la capture) se retrouve au milieu de la partie libre, à droite du panneau
    const cx = (px + pl + LARGEUR_CARTE) / 2;
    const k = Math.max(HAUTEUR_CARTE / capture.height, (2 * cx) / capture.width, (2 * (LARGEUR_CARTE - cx)) / capture.width);
    const l = capture.width * k, h = capture.height * k;
    g.drawImage(capture, cx - l / 2, (HAUTEUR_CARTE - h) / 2, l, h);
  } else {
    const d = g.createLinearGradient(0, 0, 0, HAUTEUR_CARTE);
    d.addColorStop(0, '#2b2350'); d.addColorStop(1, '#ff8a5c');
    g.fillStyle = d; g.fillRect(0, 0, LARGEUR_CARTE, HAUTEUR_CARTE);
  }
  // voile à gauche pour la lisibilité
  const voile = g.createLinearGradient(0, 0, LARGEUR_CARTE * 0.6, 0);
  voile.addColorStop(0, 'rgba(21,19,28,.55)'); voile.addColorStop(1, 'rgba(21,19,28,0)');
  g.fillStyle = voile; g.fillRect(0, 0, LARGEUR_CARTE, HAUTEUR_CARTE);

  // panneau
  g.fillStyle = encre; arrondi(g, px, py + 8, pl, ph, 28); g.fill();
  g.fillStyle = creme; arrondi(g, px, py, pl, ph, 28); g.fill();
  g.lineWidth = 5; g.strokeStyle = encre; g.stroke();

  const x = px + 34, max = pl - 68;
  let y = py + 70;
  // logo
  g.textBaseline = 'alphabetic';
  g.font = "800 38px 'Baloo 2', system-ui, sans-serif";
  g.fillStyle = encre; g.fillText('Drift', x, y);
  const lDrift = g.measureText('Drift ').width;
  g.fillStyle = orange; g.fillText('Club', x + lDrift, y);
  y += 54;
  ajuster(g, t.titre, 800, 34, max);
  g.fillStyle = encre; g.fillText(t.titre, x, y);
  y += 92;
  // score, contour encre comme dans le jeu
  ajuster(g, t.score, 800, 96, max);
  g.lineJoin = 'round'; g.lineWidth = 12; g.strokeStyle = encre; g.strokeText(t.score, x, y);
  g.fillStyle = orange; g.fillText(t.score, x, y);
  y += 22;
  if (t.badge) {
    g.font = "800 24px 'Baloo 2', system-ui, sans-serif";
    const lb = g.measureText(t.badge).width + 56;
    g.fillStyle = i.medaille ? COULEURS_MEDAILLES[i.medaille] : '#3ec46d';
    arrondi(g, x, y, lb, 44, 14); g.fill();
    g.lineWidth = 4; g.strokeStyle = encre; g.stroke();
    g.fillStyle = encre;
    g.beginPath(); g.arc(x + 24, y + 22, 9, 0, Math.PI * 2); g.fill();
    g.fillText(t.badge, x + 42, y + 31);
    y += 58;
  } else y += 12;
  // détail
  for (const [nom, val] of t.lignes) {
    y += 40;
    g.font = "600 22px 'Baloo 2', system-ui, sans-serif";
    g.fillStyle = 'rgba(21,19,28,.65)'; g.fillText(nom, x, y);
    ajuster(g, val, 800, 22, max - 160);
    g.fillStyle = encre;
    g.textAlign = 'right'; g.fillText(val, x + max, y); g.textAlign = 'left';
  }
  // pied
  g.font = "700 18px 'Baloo 2', system-ui, sans-serif";
  g.fillStyle = 'rgba(21,19,28,.55)';
  g.fillText(t.pied, x, py + ph - 26);
  return c;
}

/** Nom du fichier de la carte. */
export function nomCarte(niveau: string): string {
  const s = niveau.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40);
  return `drift-club-${s || 'course'}.png`;
}

