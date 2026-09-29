import type { Level } from '../core/level/types';
import type { TrackData } from '../core/track/buildTrack';
import { clamp } from '../core/math/vec';
import { formatDistance } from '../ui/format';
import type { Selection } from './types';

/** Zone de tracé du profil en long (pixels CSS) et plage de hauteurs affichée. */
export interface ProfilVue { w: number; h: number; longueur: number; ymin: number; ymax: number }

export const PROFIL_MARGE = { g: 44, d: 14, h: 12, b: 20 };

export interface PointProfil { i: number; s: number; y: number }

/** Plage de hauteurs (m) : hauteurs de la route, marge de 10 %, étendue minimale de 40 m. */
export function plageHauteur(level: Level, track: TrackData): { ymin: number; ymax: number } {
  let lo = Infinity, hi = -Infinity;
  for (const p of level.route) { lo = Math.min(lo, p.y); hi = Math.max(hi, p.y); }
  for (const sp of track.samples) { lo = Math.min(lo, sp.y); hi = Math.max(hi, sp.y); }
  const span = Math.max(40, (hi - lo) * 1.2);
  const mid = (hi + lo) / 2;
  return { ymin: mid - span / 2, ymax: mid + span / 2 };
}

export function sVersX(v: ProfilVue, s: number): number {
  const m = PROFIL_MARGE;
  return m.g + (s / Math.max(1, v.longueur)) * (v.w - m.g - m.d);
}

export function yVersPx(v: ProfilVue, y: number): number {
  const m = PROFIL_MARGE;
  return m.h + (1 - (y - v.ymin) / (v.ymax - v.ymin)) * (v.h - m.h - m.b);
}

export function pxVersY(v: ProfilVue, py: number): number {
  const m = PROFIL_MARGE;
  return v.ymin + (1 - (py - m.h) / (v.h - m.h - m.b)) * (v.ymax - v.ymin);
}

/** Points de contrôle placés à leur abscisse curviligne (échantillon le plus proche). */
export function pointsProfil(level: Level, track: TrackData): PointProfil[] {
  return level.route.map((p, i) => ({ i, s: track.samples[track.pointSample[i]].s, y: p.y }));
}

/** Point de contrôle sous (px, py), ou −1. */
export function choisirPointProfil(v: ProfilVue, pts: PointProfil[], px: number, py: number, rayon: number): number {
  let best = -1, bd = rayon;
  for (const p of pts) {
    const d = Math.hypot(sVersX(v, p.s) - px, yVersPx(v, p.y) - py);
    if (d <= bd) { bd = d; best = p.i; }
  }
  return best;
}

/** Graduation ronde (1, 2, 5 × 10^n) donnant environ `n` pas sur `etendue`. */
export function graduation(etendue: number, n: number): number {
  const raw = etendue / Math.max(1, n);
  const p = Math.pow(10, Math.floor(Math.log10(raw)));
  const m = raw / p;
  return (m <= 1.5 ? 1 : m <= 3.5 ? 2 : m <= 7.5 ? 5 : 10) * p;
}

export interface EtatProfil { level: Level; track: TrackData | null; vue: ProfilVue | null; selection: Selection; rayon: number }

export function dessinerProfil(ctx: CanvasRenderingContext2D, w: number, h: number, e: EtatProfil): void {
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = '#fff7e8';
  ctx.fillRect(0, 0, w, h);
  ctx.font = '700 11px system-ui, sans-serif';
  if (!e.track || !e.vue) {
    ctx.fillStyle = '#15131c99';
    ctx.textAlign = 'center';
    ctx.fillText('Profil en long indisponible tant que la route est invalide', w / 2, h / 2);
    return;
  }
  const v = e.vue, S = e.track.samples, m = PROFIL_MARGE;
  const xr = w - m.d, yb = h - m.b;

  // grille et graduations
  ctx.lineWidth = 1;
  ctx.textAlign = 'right';
  const pas = graduation(v.ymax - v.ymin, 4);
  for (let y = Math.ceil(v.ymin / pas) * pas; y <= v.ymax; y += pas) {
    const py = yVersPx(v, y);
    ctx.strokeStyle = y === 0 ? '#15131c55' : '#15131c1c';
    ctx.beginPath(); ctx.moveTo(m.g, py); ctx.lineTo(xr, py); ctx.stroke();
    ctx.fillStyle = '#15131c99';
    ctx.fillText(`${Math.round(y)} m`, m.g - 5, py + 4);
  }
  ctx.textAlign = 'center';
  const pasS = graduation(v.longueur, 6);
  for (let s = 0; s <= v.longueur; s += pasS) {
    const px = sVersX(v, s);
    ctx.strokeStyle = '#15131c1c';
    ctx.beginPath(); ctx.moveTo(px, m.h); ctx.lineTo(px, yb); ctx.stroke();
    ctx.fillStyle = '#15131c99';
    ctx.fillText(formatDistance(s), px, h - 6);
  }

  // relief sous la route, puis la courbe
  ctx.beginPath();
  ctx.moveTo(sVersX(v, 0), yb);
  const stride = Math.max(1, Math.floor(S.length / Math.max(1, w)));
  for (let i = 0; i < S.length; i += stride) ctx.lineTo(sVersX(v, S[i].s), yVersPx(v, S[i].y));
  ctx.lineTo(sVersX(v, S[S.length - 1].s), yVersPx(v, S[S.length - 1].y));
  ctx.lineTo(sVersX(v, S[S.length - 1].s), yb);
  ctx.closePath();
  ctx.fillStyle = '#7cc36b66';
  ctx.fill();
  ctx.beginPath();
  for (let i = 0; i < S.length; i += stride) {
    const px = sVersX(v, S[i].s), py = yVersPx(v, S[i].y);
    if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
  }
  ctx.lineTo(sVersX(v, S[S.length - 1].s), yVersPx(v, S[S.length - 1].y));
  ctx.strokeStyle = '#15131c';
  ctx.lineWidth = 3;
  ctx.lineJoin = 'round';
  ctx.stroke();

  // poignées
  for (const p of pointsProfil(e.level, e.track)) {
    const sel = e.selection?.kind === 'point' && e.selection.i === p.i;
    ctx.beginPath();
    ctx.arc(sVersX(v, p.s), yVersPx(v, clamp(p.y, v.ymin, v.ymax)), sel ? e.rayon : e.rayon * 0.75, 0, Math.PI * 2);
    ctx.fillStyle = sel ? '#ffd23f' : p.i === 0 ? '#3fbf5f' : p.i === e.level.route.length - 1 ? '#e63b2e' : '#fff7e8';
    ctx.fill();
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = '#15131c';
    ctx.stroke();
  }
}
