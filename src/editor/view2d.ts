import type { Level, TypeObjet } from '../core/level/types';
import { THEMES } from '../core/env/themes';
import type { AnalyseNiveau } from '../core/editor/analyse';
import type { TrackData } from '../core/track/buildTrack';
import { mondeVersEcran, pasGrille, pasEchantillons, echelleGraphique, troncons, directionRot, type Vue2D } from './geom';
import type { Outil, Selection } from './types';

export interface EtatDessin {
  vue: Vue2D;
  w: number;
  h: number;
  level: Level;
  analyse: AnalyseNiveau;
  /** dernière piste valide, montrée en fantôme quand la route est momentairement invalide */
  fantome: TrackData | null;
  selection: Selection;
  outil: Outil;
  /** rayon des poignées, en pixels */
  rayon: number;
  /** contour de lac en cours de tracé (outil « Lac ») */
  brouillonLac?: { x: number; z: number }[];
}

const INK = '#15131c', CREAM = '#fff7e8', ORANGE = '#ff8a1f', YELLOW = '#ffd23f', RED = '#e63b2e', GREEN = '#3fbf5f';

/** Rayon (m) et couleurs des objets, pour le symbole vu de dessus. */
export const OBJETS: Record<TypeObjet, { r: number; fill: string }> = {
  arbre: { r: 2.6, fill: '#3f9b4a' },
  sapin: { r: 2.2, fill: '#1f6b46' },
  rocher: { r: 1.9, fill: '#9a9aa6' },
  pneus: { r: 1.1, fill: '#2b2b33' },
  barriere: { r: 2, fill: ORANGE },
  panneau: { r: 0.9, fill: YELLOW },
};

export function rayonObjet(type: TypeObjet, scale: number): number {
  return Math.max(OBJETS[type].r * scale, 8);
}

export function dessiner(ctx: CanvasRenderingContext2D, e: EtatDessin): void {
  const { vue, w, h } = e;
  const P = (x: number, z: number) => mondeVersEcran(vue, w, h, x, z);
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = THEMES[e.level.environnement].fondEditeur; // sol du décor choisi
  ctx.fillRect(0, 0, w, h);
  grille(ctx, e);
  lacs(ctx, e);

  const track = e.analyse.track;
  if (track) {
    ruban(ctx, track, e, 1);
    if (e.outil === 'barrieres') separateurs(ctx, track, e);
    barrieres(ctx, track, e);
    departArrivee(ctx, track, e);
  } else if (e.fantome) {
    ruban(ctx, e.fantome, e, 0.35);
  }

  // polygone des points de contrôle
  const r = e.level.route;
  ctx.setLineDash(track ? [6, 6] : [3, 5]);
  ctx.lineWidth = track ? 1.5 : 2.5;
  ctx.strokeStyle = track ? '#15131c66' : RED;
  ctx.beginPath();
  r.forEach((p, i) => { const s = P(p.x, p.z); if (i === 0) ctx.moveTo(s.sx, s.sy); else ctx.lineTo(s.sx, s.sy); });
  ctx.stroke();
  ctx.setLineDash([]);

  objets(ctx, e);
  problemes(ctx, e);
  poignees(ctx, e);
  echelle(ctx, e);
}

/** Lacs du niveau (aplat bleu) et contour en cours de tracé avec l'outil « Lac ». */
function lacs(ctx: CanvasRenderingContext2D, e: EtatDessin): void {
  const P = (p: { x: number; z: number }) => mondeVersEcran(e.vue, e.w, e.h, p.x, p.z);
  for (const lac of e.level.eau ?? []) {
    ctx.beginPath();
    lac.points.forEach((q, i) => { const s = P(q); if (i === 0) ctx.moveTo(s.sx, s.sy); else ctx.lineTo(s.sx, s.sy); });
    ctx.closePath();
    ctx.fillStyle = 'rgba(79,169,224,.6)';
    ctx.fill();
    ctx.lineWidth = 3; ctx.lineJoin = 'round'; ctx.strokeStyle = '#2d6a8f';
    ctx.stroke();
  }
  const b = e.brouillonLac;
  if (b && b.length > 0) {
    ctx.beginPath();
    b.forEach((q, i) => { const s = P(q); if (i === 0) ctx.moveTo(s.sx, s.sy); else ctx.lineTo(s.sx, s.sy); });
    ctx.setLineDash([8, 6]); ctx.lineWidth = 3; ctx.strokeStyle = '#2d6a8f';
    ctx.stroke();
    ctx.setLineDash([]);
    for (const q of b) {
      const s = P(q);
      ctx.beginPath(); ctx.arc(s.sx, s.sy, 6, 0, Math.PI * 2);
      ctx.fillStyle = '#fff'; ctx.fill();
      ctx.lineWidth = 3; ctx.strokeStyle = '#2d6a8f'; ctx.stroke();
    }
  }
}

function grille(ctx: CanvasRenderingContext2D, e: EtatDessin): void {
  const { vue, w, h } = e;
  const pas = pasGrille(vue.scale);
  const x0 = vue.cx - w / 2 / vue.scale, x1 = vue.cx + w / 2 / vue.scale;
  const z0 = vue.cz - h / 2 / vue.scale, z1 = vue.cz + h / 2 / vue.scale;
  ctx.lineWidth = 1;
  const trace = (major: boolean): void => {
    ctx.strokeStyle = major ? 'rgba(21,19,28,.22)' : 'rgba(21,19,28,.09)';
    ctx.beginPath();
    for (let x = Math.ceil(x0 / pas) * pas; x <= x1; x += pas) {
      if ((Math.round(x / pas) % 5 === 0) !== major) continue;
      const sx = Math.round((x - vue.cx) * vue.scale + w / 2) + 0.5;
      ctx.moveTo(sx, 0); ctx.lineTo(sx, h);
    }
    for (let z = Math.ceil(z0 / pas) * pas; z <= z1; z += pas) {
      if ((Math.round(z / pas) % 5 === 0) !== major) continue;
      const sy = Math.round((z - vue.cz) * vue.scale + h / 2) + 0.5;
      ctx.moveTo(0, sy); ctx.lineTo(w, sy);
    }
    ctx.stroke();
  };
  trace(false);
  trace(true);
}

function bord(ctx: CanvasRenderingContext2D, track: TrackData, e: EtatDessin, side: number, off: number, step: number, reverse: boolean, first: boolean): void {
  const S = track.samples;
  const n = S.length;
  const idx: number[] = [];
  for (let i = 0; i < n; i += step) idx.push(i);
  if (idx[idx.length - 1] !== n - 1) idx.push(n - 1);
  if (reverse) idx.reverse();
  idx.forEach((i, k) => {
    const sp = S[i];
    const p = mondeVersEcran(e.vue, e.w, e.h, sp.x + sp.nx * side * (sp.w + off), sp.z + sp.nz * side * (sp.w + off));
    if (k === 0 && first) ctx.moveTo(p.sx, p.sy); else ctx.lineTo(p.sx, p.sy);
  });
}

function ruban(ctx: CanvasRenderingContext2D, track: TrackData, e: EtatDessin, alpha: number): void {
  const step = pasEchantillons(e.vue.scale);
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.lineJoin = 'round';
  ctx.beginPath();
  bord(ctx, track, e, 1, 0, step, false, true);
  bord(ctx, track, e, -1, 0, step, true, false);
  ctx.closePath();
  ctx.fillStyle = '#4a4d57';
  ctx.fill();
  // bords blancs
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = Math.max(1.5, 0.3 * e.vue.scale);
  for (const side of [1, -1]) {
    ctx.beginPath();
    bord(ctx, track, e, side, 0, step, false, true);
    ctx.stroke();
  }
  // axe en pointillés
  ctx.setLineDash([Math.max(6, 3 * e.vue.scale), Math.max(8, 4 * e.vue.scale)]);
  ctx.strokeStyle = 'rgba(255,255,255,.55)';
  ctx.lineWidth = Math.max(1, 0.2 * e.vue.scale);
  ctx.beginPath();
  bord(ctx, track, e, 0, 0, step, false, true);
  ctx.stroke();
  ctx.restore();
}

function separateurs(ctx: CanvasRenderingContext2D, track: TrackData, e: EtatDessin): void {
  ctx.strokeStyle = 'rgba(21,19,28,.7)';
  ctx.lineWidth = 2;
  ctx.setLineDash([4, 3]);
  ctx.beginPath();
  for (const idx of track.pointSample) {
    const sp = track.samples[idx];
    const a = mondeVersEcran(e.vue, e.w, e.h, sp.x + sp.nx * (sp.w + 2), sp.z + sp.nz * (sp.w + 2));
    const b = mondeVersEcran(e.vue, e.w, e.h, sp.x - sp.nx * (sp.w + 2), sp.z - sp.nz * (sp.w + 2));
    ctx.moveTo(a.sx, a.sy); ctx.lineTo(b.sx, b.sy);
  }
  ctx.stroke();
  ctx.setLineDash([]);
}

function barrieres(ctx: CanvasRenderingContext2D, track: TrackData, e: EtatDessin): void {
  const S = track.samples;
  ctx.lineCap = 'butt';
  ctx.lineJoin = 'round';
  const largeur = Math.max(3, 0.7 * e.vue.scale);
  for (const passe of [0, 1]) {
    ctx.strokeStyle = passe === 0 ? INK : ORANGE;
    ctx.lineWidth = passe === 0 ? largeur + 3 : largeur;
    for (const b of e.level.barrieres) {
      if (b.a >= track.pointSample.length) continue;
      for (const t of troncons(track, b)) {
        ctx.beginPath();
        for (let i = t.from; i <= t.to; i++) {
          const sp = S[i];
          const p = mondeVersEcran(e.vue, e.w, e.h, sp.x + sp.nx * t.side * (sp.w + 0.8), sp.z + sp.nz * t.side * (sp.w + 0.8));
          if (i === t.from) ctx.moveTo(p.sx, p.sy); else ctx.lineTo(p.sx, p.sy);
        }
        ctx.stroke();
      }
    }
  }
}

function departArrivee(ctx: CanvasRenderingContext2D, track: TrackData, e: EtatDessin): void {
  const S = track.samples;
  const place = (sp: typeof S[number], dessin: () => void): void => {
    const p = mondeVersEcran(e.vue, e.w, e.h, sp.x, sp.z);
    const k = e.vue.scale;
    ctx.save();
    ctx.transform(sp.nx * k, sp.nz * k, sp.tx * k, sp.tz * k, p.sx, p.sy);
    dessin();
    ctx.restore();
  };
  const a = S[0], b = S[S.length - 1];
  place(a, () => { ctx.fillStyle = GREEN; ctx.fillRect(-a.w, -0.8, a.w * 2, 1.6); });
  place(b, () => {
    const cols = Math.max(2, Math.round((b.w * 2) / 1.2));
    const cw = (b.w * 2) / cols;
    for (let c = 0; c < cols; c++) for (let r = 0; r < 2; r++) {
      ctx.fillStyle = (c + r) % 2 === 0 ? '#fff' : INK;
      ctx.fillRect(-b.w + c * cw, (r - 1) * cw, cw, cw);
    }
  });
  ctx.font = '800 12px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.lineWidth = 3;
  // « Départ » derrière la ligne, « Arrivée » devant
  for (const [sp, txt, dir] of [[a, 'Départ', -1], [b, 'Arrivée', 1]] as const) {
    const p = mondeVersEcran(e.vue, e.w, e.h, sp.x + dir * sp.tx * (sp.w + 3), sp.z + dir * sp.tz * (sp.w + 3));
    const off = Math.max(22, e.rayon + 14);
    const q = { sx: p.sx + dir * sp.tx * off, sy: p.sy + dir * sp.tz * off };
    ctx.strokeStyle = CREAM;
    ctx.strokeText(txt, q.sx, q.sy + 4);
    ctx.fillStyle = INK;
    ctx.fillText(txt, q.sx, q.sy + 4);
  }
}

function symbole(ctx: CanvasRenderingContext2D, type: TypeObjet, sx: number, sy: number, r: number, rot: number, scale: number, fond: string): void {
  const d = directionRot(rot);
  ctx.lineWidth = 2;
  ctx.strokeStyle = INK;
  ctx.fillStyle = OBJETS[type].fill;
  ctx.beginPath();
  if (type === 'barriere') {
    const half = Math.max(2 * scale, 10);
    ctx.lineWidth = Math.max(5, 0.5 * scale) + 3;
    ctx.moveTo(sx - d.x * half, sy - d.z * half); ctx.lineTo(sx + d.x * half, sy + d.z * half);
    ctx.stroke();
    ctx.strokeStyle = ORANGE;
    ctx.lineWidth = Math.max(5, 0.5 * scale);
    ctx.stroke();
    return;
  }
  if (type === 'sapin') {
    for (let k = 0; k < 3; k++) { const a = -Math.PI / 2 + (k * 2 * Math.PI) / 3; ctx.lineTo(sx + Math.cos(a) * r, sy + Math.sin(a) * r); }
    ctx.closePath();
  } else if (type === 'rocher') {
    for (let k = 0; k < 6; k++) { const a = (k * Math.PI) / 3 + 0.3; const rr = r * (k % 2 ? 0.8 : 1); ctx.lineTo(sx + Math.cos(a) * rr, sy + Math.sin(a) * rr); }
    ctx.closePath();
  } else if (type === 'panneau') {
    ctx.rect(sx - r, sy - r, r * 2, r * 2);
  } else {
    ctx.arc(sx, sy, r, 0, Math.PI * 2);
  }
  ctx.fill();
  ctx.stroke();
  if (type === 'pneus') {
    ctx.beginPath(); ctx.arc(sx, sy, r * 0.45, 0, Math.PI * 2); ctx.fillStyle = fond; ctx.fill(); ctx.stroke();
  }
}

function objets(ctx: CanvasRenderingContext2D, e: EtatDessin): void {
  e.level.objets.forEach((o, i) => {
    const p = mondeVersEcran(e.vue, e.w, e.h, o.x, o.z);
    if (p.sx < -40 || p.sy < -40 || p.sx > e.w + 40 || p.sy > e.h + 40) return;
    const r = rayonObjet(o.type, e.vue.scale);
    const sel = e.selection?.kind === 'objet' && e.selection.i === i;
    if (sel) {
      ctx.beginPath(); ctx.arc(p.sx, p.sy, r + 7, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255,210,63,.55)'; ctx.fill();
      ctx.lineWidth = 3; ctx.strokeStyle = INK; ctx.stroke();
    }
    symbole(ctx, o.type, p.sx, p.sy, r, o.rot, e.vue.scale, THEMES[e.level.environnement].fondEditeur);
    // repère de rotation
    const d = directionRot(o.rot);
    ctx.beginPath();
    ctx.moveTo(p.sx + d.x * r * 0.4, p.sy + d.z * r * 0.4);
    ctx.lineTo(p.sx + d.x * (r + 7), p.sy + d.z * (r + 7));
    ctx.lineWidth = 3; ctx.strokeStyle = INK; ctx.stroke();
    ctx.lineWidth = 1.5; ctx.strokeStyle = '#fff'; ctx.stroke();
  });
}

function problemes(ctx: CanvasRenderingContext2D, e: EtatDessin): void {
  for (const pb of e.analyse.problemes) {
    const a = mondeVersEcran(e.vue, e.w, e.h, pb.x, pb.z);
    const cercle = (p: { sx: number; sy: number }): void => {
      ctx.beginPath(); ctx.arc(p.sx, p.sy, Math.max(16, 9 * e.vue.scale), 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(230,59,46,.28)'; ctx.fill();
      ctx.lineWidth = 3.5; ctx.strokeStyle = RED; ctx.stroke();
    };
    if (pb.x2 !== undefined && pb.z2 !== undefined) {
      const b = mondeVersEcran(e.vue, e.w, e.h, pb.x2, pb.z2);
      ctx.setLineDash([8, 6]); ctx.lineWidth = 3; ctx.strokeStyle = RED;
      ctx.beginPath(); ctx.moveTo(a.sx, a.sy); ctx.lineTo(b.sx, b.sy); ctx.stroke();
      ctx.setLineDash([]);
      cercle(b);
    }
    cercle(a);
  }
}

function poignees(ctx: CanvasRenderingContext2D, e: EtatDessin): void {
  const n = e.level.route.length;
  // poignées plus petites (et sans numéro) quand les points sont très rapprochés à l'écran
  let ecart = Infinity;
  for (let i = 1; i < n; i++) ecart = Math.min(ecart, Math.hypot(e.level.route[i].x - e.level.route[i - 1].x, e.level.route[i].z - e.level.route[i - 1].z));
  const dense = ecart * e.vue.scale < e.rayon * 2.6;
  const r = dense ? Math.max(4, (ecart * e.vue.scale) / 2.6) : e.rayon;
  ctx.font = `800 ${Math.round(r * 1.05)}px system-ui, sans-serif`;
  ctx.textAlign = 'center';
  e.level.route.forEach((p, i) => {
    const s = mondeVersEcran(e.vue, e.w, e.h, p.x, p.z);
    if (s.sx < -30 || s.sy < -30 || s.sx > e.w + 30 || s.sy > e.h + 30) return;
    const sel = e.selection?.kind === 'point' && e.selection.i === i;
    if (sel) {
      ctx.beginPath(); ctx.arc(s.sx, s.sy, r + 6, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255,210,63,.6)'; ctx.fill();
      ctx.lineWidth = 3; ctx.strokeStyle = ORANGE; ctx.stroke();
    }
    ctx.beginPath(); ctx.arc(s.sx, s.sy, r, 0, Math.PI * 2);
    ctx.fillStyle = sel ? YELLOW : i === 0 ? GREEN : i === n - 1 ? RED : CREAM;
    ctx.fill();
    ctx.lineWidth = 3; ctx.strokeStyle = INK; ctx.stroke();
    if (dense && !sel) return;
    ctx.fillStyle = i === n - 1 && !sel ? '#fff' : INK;
    ctx.fillText(String(i), s.sx, s.sy + r * 0.36);
  });
}

function echelle(ctx: CanvasRenderingContext2D, e: EtatDessin): void {
  const g = echelleGraphique(e.vue.scale);
  const x = 16, y = e.h - 16;
  ctx.lineWidth = 4; ctx.strokeStyle = INK; ctx.lineCap = 'butt';
  ctx.beginPath(); ctx.moveTo(x, y - 6); ctx.lineTo(x, y); ctx.lineTo(x + g.px, y); ctx.lineTo(x + g.px, y - 6); ctx.stroke();
  ctx.lineWidth = 2; ctx.strokeStyle = '#fff'; ctx.stroke();
  ctx.font = '800 12px system-ui, sans-serif';
  ctx.textAlign = 'left';
  const t = g.metres >= 1000 ? `${g.metres / 1000} km` : `${g.metres} m`;
  ctx.lineWidth = 3; ctx.strokeStyle = CREAM; ctx.strokeText(t, x + 2, y - 10);
  ctx.fillStyle = INK; ctx.fillText(t, x + 2, y - 10);
}
