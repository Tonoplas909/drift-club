import { describe, it, expect } from 'vitest';
import {
  mondeVersEcran, ecranVersMonde, zoomAutour, deplacer, cadrer, bornesNiveau, pasGrille, echelleGraphique,
  pasEchantillons, segmentDeEchantillon, choisirRoute, limiterDistance, troncons, directionRot, ECHELLE_MAX,
} from '../../src/editor/geom';
import { buildTrack } from '../../src/core/track/buildTrack';
import { newLevel } from '../../src/core/editor/ops';
import { curveLevel, straightLevel, makeLevel } from '../fixtures/levels';

const V = { cx: 10, cz: -20, scale: 2 };

describe('transformations de la vue', () => {
  it('aller-retour monde ↔ écran', () => {
    const s = mondeVersEcran(V, 800, 600, 33, 7);
    const m = ecranVersMonde(V, 800, 600, s.sx, s.sy);
    expect(m.x).toBeCloseTo(33);
    expect(m.z).toBeCloseTo(7);
  });
  it('le centre de la vue est au centre de l\'écran, z vers le bas', () => {
    expect(mondeVersEcran(V, 800, 600, 10, -20)).toEqual({ sx: 400, sy: 300 });
    expect(mondeVersEcran(V, 800, 600, 10, -19).sy).toBeGreaterThan(300);
  });
  it('le zoom garde fixe le point sous le curseur', () => {
    const avant = ecranVersMonde(V, 800, 600, 123, 456);
    const v2 = zoomAutour(V, 800, 600, 123, 456, 1.7);
    expect(v2.scale).toBeCloseTo(3.4);
    const apres = ecranVersMonde(v2, 800, 600, 123, 456);
    expect(apres.x).toBeCloseTo(avant.x);
    expect(apres.z).toBeCloseTo(avant.z);
  });
  it('le zoom est borné', () => {
    expect(zoomAutour(V, 800, 600, 0, 0, 1e6).scale).toBe(ECHELLE_MAX);
  });
  it('le déplacement suit le doigt', () => {
    const v2 = deplacer(V, 20, -10);
    const p = mondeVersEcran(v2, 800, 600, 10, -20);
    expect(p.sx).toBeCloseTo(420);
    expect(p.sy).toBeCloseTo(290);
  });
});

describe('cadrage', () => {
  it('cadre tout le niveau dans l\'écran', () => {
    const l = newLevel();
    const b = bornesNiveau(l, buildTrack(l));
    const v = cadrer(b, 1000, 600, 50);
    for (const p of l.route) {
      const s = mondeVersEcran(v, 1000, 600, p.x, p.z);
      expect(s.sx).toBeGreaterThanOrEqual(0);
      expect(s.sx).toBeLessThanOrEqual(1000);
      expect(s.sy).toBeGreaterThanOrEqual(0);
      expect(s.sy).toBeLessThanOrEqual(600);
    }
  });
  it('les bornes incluent les objets', () => {
    const l = makeLevel([[0, 0, 0, 10], [0, 50, 0, 10]], { objets: [{ type: 'rocher', x: 500, z: 0, rot: 0 }] });
    expect(bornesNiveau(l, null).maxX).toBeGreaterThanOrEqual(500);
  });
});

describe('grille et échelle', () => {
  it('pas de grille en 1-2-5 avec un espacement minimal', () => {
    for (const sc of [0.1, 0.37, 1, 2.5, 30]) {
      const pas = pasGrille(sc, 48);
      expect(pas * sc).toBeGreaterThanOrEqual(48 - 1e-9);
      const m = pas / Math.pow(10, Math.floor(Math.log10(pas)));
      expect([1, 2, 5]).toContain(Math.round(m));
    }
  });
  it('échelle graphique ronde et pas trop large', () => {
    const g = echelleGraphique(0.5, 120);
    expect(g.metres).toBe(200);
    expect(g.px).toBeLessThanOrEqual(120);
  });
  it('pas d\'échantillonnage : 1 à fort zoom, plus grand à faible zoom', () => {
    expect(pasEchantillons(4)).toBe(1);
    expect(pasEchantillons(0.25)).toBe(8);
  });
});

describe('choix du tronçon de route', () => {
  const l = straightLevel(200, 10);
  const t = buildTrack(l);
  it('retrouve le tronçon et le côté d\'après la vraie courbe', () => {
    // route vers +z : la gauche est +x (normale gauche = (tz, −tx))
    const g = choisirRoute(l, t, 3, 120, 4)!;
    expect(g.cote).toBe('gauche');
    expect(g.seg).toBe(2);
    expect(g.x).toBeCloseTo(0);
    expect(choisirRoute(l, t, -3, 30, 4)!.cote).toBe('droite');
    expect(choisirRoute(l, t, -3, 30, 4)!.seg).toBe(0);
  });
  it('refuse au-delà de la demi-largeur + marge', () => {
    expect(choisirRoute(l, t, 5 + 4.5, 100, 4)).toBeNull();
    expect(choisirRoute(l, t, 5 + 3.5, 100, 4)).not.toBeNull();
  });
  it('retombe sur le polygone sans piste', () => {
    const r = choisirRoute(l, null, 2, 60, 4)!;
    expect(r.seg).toBe(1);
    expect(r.z).toBeCloseTo(60);
  });
  it('segmentDeEchantillon suit pointSample', () => {
    expect(segmentDeEchantillon(t, 0)).toBe(0);
    expect(segmentDeEchantillon(t, t.pointSample[2])).toBe(2);
    expect(segmentDeEchantillon(t, t.samples.length - 1)).toBe(t.pointSample.length - 2);
  });
});

describe('limiterDistance', () => {
  it('ramène dans [min, max] dans la même direction', () => {
    const a = limiterDistance({ x: 0, z: 0 }, 500, 0, 6, 145);
    expect(a).toEqual({ x: 145, z: 0 });
    const b = limiterDistance({ x: 0, z: 0 }, 0, 1, 6, 145);
    expect(b).toEqual({ x: 0, z: 6 });
    const c = limiterDistance({ x: 0, z: 0 }, 30, 40, 6, 145);
    expect(c.x).toBeCloseTo(30);
  });
  it('gère la distance nulle', () => {
    const p = limiterDistance({ x: 5, z: 5 }, 5, 5, 6, 145);
    expect(Math.hypot(p.x - 5, p.z - 5)).toBeCloseTo(6);
  });
});

describe('côté des barrières', () => {
  it('gauche / droite / deux', () => {
    const l = straightLevel(200);
    const t = buildTrack(l);
    expect(troncons(t, { de: 0, a: 2, cote: 'gauche' }).every((x) => x.side === 1)).toBe(true);
    expect(troncons(t, { de: 0, a: 2, cote: 'droite' }).every((x) => x.side === -1)).toBe(true);
    expect(new Set(troncons(t, { de: 0, a: 2, cote: 'deux' }).map((x) => x.side))).toEqual(new Set([1, -1]));
  });
  it('« ext » suit l\'extérieur du virage (virage à gauche → côté droit)', () => {
    const t = buildTrack(curveLevel());
    const r = troncons(t, { de: 0, a: 4, cote: 'ext' });
    // comme en jeu : côté gauche tant que la courbure est trop faible (début), puis extérieur = droite
    const dernier = r[r.length - 1];
    expect(dernier.side).toBe(-1);
    expect(dernier.to).toBe(t.pointSample[4]);
    expect(dernier.to - dernier.from).toBeGreaterThan(t.pointSample[4] * 0.9);
    expect(r[0].from).toBe(0);
  });
  it('« ext » change de côté aux inflexions (S)', () => {
    const l = makeLevel([[0, 0, 0, 10], [40, 40, 0, 10], [80, 100, 0, 10], [40, 160, 0, 10], [0, 200, 0, 10], [-40, 260, 0, 10], [0, 320, 0, 10]]);
    const t = buildTrack(l);
    const r = troncons(t, { de: 0, a: 6, cote: 'ext' });
    expect(new Set(r.map((x) => x.side))).toEqual(new Set([1, -1]));
  });
});

describe('directionRot', () => {
  it('(sin, cos) comme dans la génération du décor', () => {
    expect(directionRot(0).z).toBeCloseTo(1);
    expect(directionRot(90).x).toBeCloseTo(1);
  });
});
