import { describe, it, expect } from 'vitest';
import { plageHauteur, sVersX, yVersPx, pxVersY, pointsProfil, choisirPointProfil, graduation, PROFIL_MARGE, type ProfilVue } from '../../src/editor/profil';
import { buildTrack } from '../../src/core/track/buildTrack';
import { newLevel } from '../../src/core/editor/ops';

describe('profil en long', () => {
  const level = newLevel();
  const track = buildTrack(level);
  const { ymin, ymax } = plageHauteur(level, track);
  const v: ProfilVue = { w: 600, h: 140, longueur: track.length, ymin, ymax };

  it('la plage couvre les hauteurs avec au moins 40 m', () => {
    expect(ymax - ymin).toBeGreaterThanOrEqual(40);
    for (const p of level.route) { expect(p.y).toBeGreaterThan(ymin); expect(p.y).toBeLessThan(ymax); }
  });
  it('y ↔ pixel est réversible et orienté vers le haut', () => {
    expect(pxVersY(v, yVersPx(v, 12.5))).toBeCloseTo(12.5);
    expect(yVersPx(v, 30)).toBeLessThan(yVersPx(v, 0));
  });
  it('s couvre la zone de tracé', () => {
    expect(sVersX(v, 0)).toBe(PROFIL_MARGE.g);
    expect(sVersX(v, track.length)).toBeCloseTo(v.w - PROFIL_MARGE.d);
  });
  it('un point de contrôle est placé sur son échantillon', () => {
    const pts = pointsProfil(level, track);
    expect(pts).toHaveLength(level.route.length);
    expect(pts[0].s).toBe(0);
    expect(pts[3].y).toBe(level.route[3].y);
    expect(pts[3].s).toBeGreaterThan(pts[2].s);
  });
  it('choisit la poignée sous le pointeur', () => {
    const pts = pointsProfil(level, track);
    const p = pts[3];
    expect(choisirPointProfil(v, pts, sVersX(v, p.s) + 3, yVersPx(v, p.y) - 2, 12)).toBe(3);
    expect(choisirPointProfil(v, pts, 2, 2, 12)).toBe(-1);
  });
  it('graduations rondes', () => {
    expect(graduation(97, 4)).toBe(20);
    expect(graduation(1234, 6)).toBe(200);
  });
});
