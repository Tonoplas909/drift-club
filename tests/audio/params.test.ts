import { describe, it, expect } from 'vitest';
import {
  CAR_SOUND, MAX_SOURCES, PLAFOND, RPM_LIMITEUR, RPM_MAX, bankFreq, bankNotes, boostCible, chocIntensite, creuxChangement, engineFrequency, engineTargets,
  limiteurQuantite, revealParams, rpmNorm, screechCentre, screechLevel, sifflementFreq, sifflementGain, smoothAsym, smoothFactor, soufflageDeclenche,
  surfaceLevel, tempsFinDecroissance, tickFreq, ventLevel, volumeToGain,
} from '../../src/audio/params';
import { fillNoise, saturationCurve, softClipCurve } from '../../src/audio/noise';
import { CAR_IDS } from '../../src/core/physics/cars';
import { RARETES } from '../../src/core/raretes';

const RARETES_ORDRE = Object.keys(RARETES) as (keyof typeof RARETES)[];

describe('moteur : régime → fréquence', () => {
  it('4 cylindres : 2 allumages par tour', () => {
    expect(engineFrequency(900)).toBe(30);
    expect(engineFrequency(6000)).toBe(200);
  });
  it('rpmNorm borné 0..1', () => {
    expect(rpmNorm(0)).toBe(0);
    expect(rpmNorm(900)).toBe(0);
    expect(rpmNorm(RPM_MAX)).toBe(1);
    expect(rpmNorm(99999)).toBe(1);
  });
  it('chaque voiture a un profil, la Légère est plus aiguë et la Turbo plus grave', () => {
    for (const id of CAR_IDS) expect(CAR_SOUND[id]).toBeDefined();
    const f = (id: 'equilibree' | 'legere' | 'turbo') => engineTargets(CAR_SOUND[id], 4000, 1).freq;
    expect(f('legere')).toBeGreaterThan(f('equilibree'));
    expect(f('turbo')).toBeLessThan(f('equilibree'));
    expect(CAR_SOUND.turbo.turbo).toBe(true);
    expect(CAR_SOUND.equilibree.turbo).toBe(false);
  });
  it('en charge : plus fort et plus brillant qu\'en décélération ; tout monte avec le régime', () => {
    for (const id of CAR_IDS) {
      const on = engineTargets(CAR_SOUND[id], 4000, 1), off = engineTargets(CAR_SOUND[id], 4000, 0);
      expect(on.gain).toBeGreaterThan(off.gain);
      expect(on.cutoff).toBeGreaterThan(off.cutoff);
      expect(on.noiseGain).toBeGreaterThan(off.noiseGain);
      expect(engineTargets(CAR_SOUND[id], 6500, 1).cutoff).toBeGreaterThan(on.cutoff);
      expect(on.cutoff).toBeLessThanOrEqual(4000);
    }
  });
  it('marche arrière (gaz négatif) : même timbre en charge', () => {
    expect(engineTargets(CAR_SOUND.equilibree, 3000, -1).gain).toBe(engineTargets(CAR_SOUND.equilibree, 3000, 1).gain);
  });
  it('limiteur : rien sous le seuil, plein près de 7500', () => {
    expect(limiteurQuantite(RPM_LIMITEUR - 500)).toBe(0);
    expect(limiteurQuantite(RPM_MAX)).toBe(1);
    expect(limiteurQuantite(7400)).toBeGreaterThan(0);
    expect(limiteurQuantite(7400)).toBeLessThan(1);
  });
  it('creux au changement de rapport : descend puis remonte à 1 sans saut', () => {
    expect(creuxChangement(-1)).toBe(1);
    expect(creuxChangement(0)).toBe(1);
    const bas = creuxChangement(0.05);
    expect(bas).toBeGreaterThan(0.49);
    expect(bas).toBeLessThan(0.56);
    expect(creuxChangement(0.5)).toBeGreaterThan(0.99);
    // continuité au raccord de la tenue (0,05 s)
    expect(Math.abs(creuxChangement(0.0501) - creuxChangement(0.0499))).toBeLessThan(0.01);
    let prec = 1;
    for (let t = 0; t < 0.6; t += 0.001) { const v = creuxChangement(t); expect(Math.abs(v - prec)).toBeLessThan(0.1); prec = v; }
  });
});

describe('turbo', () => {
  it('pression : nulle sans gaz ou à bas régime, pleine à haut régime plein gaz', () => {
    expect(boostCible(0, 6000)).toBe(0);
    expect(boostCible(1, 1000)).toBe(0);
    expect(boostCible(1, 6000)).toBe(1);
  });
  it('sifflement : monte en fréquence et en volume avec la pression, reste modéré', () => {
    expect(sifflementFreq(1)).toBeGreaterThan(sifflementFreq(0));
    expect(sifflementFreq(1)).toBeLessThanOrEqual(3200);
    expect(sifflementGain(1)).toBeGreaterThan(sifflementGain(0.5));
    expect(sifflementGain(0)).toBe(0);
    expect(sifflementGain(1)).toBeLessThan(0.05);
  });
  it('pschh : seulement gaz relâchés, pression haute et régime élevé', () => {
    expect(soufflageDeclenche(0.8, 0, 5000)).toBe(true);
    expect(soufflageDeclenche(0.8, 1, 5000)).toBe(false);
    expect(soufflageDeclenche(0.2, 0, 5000)).toBe(false);
    expect(soufflageDeclenche(0.8, 0, 2000)).toBe(false);
  });
});

describe('lissage', () => {
  it('coefficient : 0 sans temps, tend vers 1, tau nul = instantané', () => {
    expect(smoothFactor(0, 0.05)).toBe(0);
    expect(smoothFactor(10, 0.05)).toBeCloseTo(1, 6);
    expect(smoothFactor(0.05, 0.05)).toBeCloseTo(1 - Math.exp(-1), 9);
    expect(smoothFactor(0.01, 0)).toBe(1);
    expect(smoothFactor(-1, 0.1)).toBe(0);
  });
  it('asymétrique : monte vite, redescend lentement, ne dépasse jamais la cible', () => {
    const haut = smoothAsym(0, 1, 0.05, 0.05, 0.5), bas = smoothAsym(1, 0, 0.05, 0.05, 0.5);
    expect(haut).toBeGreaterThan(1 - bas);
    let v = 0;
    for (let i = 0; i < 100; i++) { const n = smoothAsym(v, 1, 1 / 60, 0.05, 0.3); expect(n).toBeGreaterThanOrEqual(v); expect(n).toBeLessThanOrEqual(1); v = n; }
  });
  it('fin de décroissance : passe sous −80 dB', () => {
    const tau = 0.1;
    const fin = tempsFinDecroissance(1, 0.004, tau);
    expect(Math.exp(-(fin - 1.004) / tau)).toBeLessThan(1e-4);
  });
});

describe('pneus, surface, vent', () => {
  it('crissement : silencieux à faible vitesse ou sans glisse, croît avec la glisse', () => {
    expect(screechLevel(1, 0)).toBe(0);
    expect(screechLevel(0, 30)).toBe(0);
    expect(screechLevel(1, 20)).toBe(1);
    expect(screechLevel(0.8, 20)).toBeGreaterThan(screechLevel(0.4, 20));
    expect(screechLevel(2, 20)).toBe(1);
  });
  it('fréquence centrale entre 800 et 2000 Hz (jamais perçant)', () => {
    for (const slip of [0, 0.5, 1]) for (const v of [0, 10, 25, 60]) {
      const c = screechCentre(slip, v);
      expect(c).toBeGreaterThanOrEqual(800);
      expect(c).toBeLessThanOrEqual(2000);
    }
    expect(screechCentre(1, 40)).toBeGreaterThan(screechCentre(0, 5));
  });
  it('grondement seulement hors piste et en mouvement', () => {
    expect(surfaceLevel(true, 40)).toBe(0);
    expect(surfaceLevel(false, 0)).toBe(0);
    expect(surfaceLevel(false, 20)).toBe(1);
  });
  it('vent : nul à basse vitesse, croissant, borné', () => {
    expect(ventLevel(5)).toBe(0);
    expect(ventLevel(40)).toBeGreaterThan(ventLevel(25));
    expect(ventLevel(200)).toBe(1);
  });
});

describe('événements', () => {
  it('choc : croît avec l\'impact, borné 0,15..1', () => {
    expect(chocIntensite(0)).toBeCloseTo(0.15, 9);
    expect(chocIntensite(2.5)).toBeCloseTo(0.15, 9);
    expect(chocIntensite(8)).toBeGreaterThan(chocIntensite(4));
    expect(chocIntensite(100)).toBe(1);
  });
  it('ding : la note monte à chaque cran de combo, jamais au-delà de l\'octave', () => {
    let prec = 0;
    for (let m = 1; m <= 6; m++) { const f = bankFreq(m); expect(f).toBeGreaterThan(prec); prec = f; }
    expect(bankFreq(1)).toBeCloseTo(784, 6);
    expect(bankFreq(6)).toBeCloseTo(1568, 6);
    expect(bankFreq(50)).toBe(bankFreq(6));
    expect(bankFreq(0)).toBe(bankFreq(1));
  });
  it('ding : deux notes, une troisième aux gros combos', () => {
    expect(bankNotes(1)).toHaveLength(2);
    expect(bankNotes(5)).toHaveLength(3);
    expect(bankNotes(5)[0].delai).toBe(0);
  });
  it('tic de roulette : 900..1200 Hz', () => {
    expect(tickFreq(0)).toBe(900);
    expect(tickFreq(1)).toBe(1200);
    expect(tickFreq(5)).toBe(1200);
    expect(tickFreq(-1)).toBe(900);
  });
  it('sting de révélation : plus la rareté est haute, plus il est long, riche et scintillant', () => {
    const p = RARETES_ORDRE.map((r) => revealParams(r));
    for (let i = 1; i < p.length; i++) {
      expect(p[i].notes.length).toBeGreaterThanOrEqual(p[i - 1].notes.length);
      expect(p[i].tau).toBeGreaterThan(p[i - 1].tau);
      expect(p[i].etincelles).toBeGreaterThanOrEqual(p[i - 1].etincelles);
      expect(p[i].niveau).toBeGreaterThanOrEqual(p[i - 1].niveau);
    }
    expect(revealParams('commune').houle).toBe(false);
    expect(revealParams('exotique').houle).toBe(true);
    expect(revealParams('commune').notes.length).toBeGreaterThanOrEqual(2);
    for (const r of RARETES_ORDRE) for (const f of revealParams(r).notes) { expect(f).toBeGreaterThan(200); expect(f).toBeLessThan(2500); }
  });
});

describe('mixage', () => {
  it('volume : 0 = silence, 1 = plein, monotone', () => {
    expect(volumeToGain(0)).toBe(0);
    expect(volumeToGain(1)).toBe(1);
    expect(volumeToGain(0.8)).toBeLessThan(0.8);
    expect(volumeToGain(0.6)).toBeLessThan(volumeToGain(0.7));
    expect(volumeToGain(-3)).toBe(0);
    expect(volumeToGain(9)).toBe(1);
    expect(volumeToGain(NaN)).toBe(0);
  });
  it('constantes : plafond sous −1 dBFS, nombre de sources borné', () => {
    expect(20 * Math.log10(PLAFOND)).toBeLessThan(-1);
    expect(MAX_SOURCES).toBeGreaterThan(8);
    expect(MAX_SOURCES).toBeLessThan(100);
  });
});

describe('bruits et courbes', () => {
  it('bruit : déterministe, centré, borné, RMS ≈ 0,25', () => {
    for (const k of ['white', 'pink', 'brown'] as const) {
      const a = fillNoise(k, 8192, 5), b = fillNoise(k, 8192, 5), c = fillNoise(k, 8192, 6);
      expect(Array.from(a.slice(0, 50))).toEqual(Array.from(b.slice(0, 50)));
      expect(Array.from(a.slice(0, 50))).not.toEqual(Array.from(c.slice(0, 50)));
      let s = 0, q = 0, m = 0;
      for (const v of a) { s += v; q += v * v; m = Math.max(m, Math.abs(v)); }
      expect(Math.abs(s / a.length)).toBeLessThan(1e-3);
      expect(Math.sqrt(q / a.length)).toBeGreaterThan(0.2);
      expect(Math.sqrt(q / a.length)).toBeLessThan(0.3);
      expect(m).toBeLessThanOrEqual(1);
    }
  });
  it('bruit bouclable : pas de saut à la jointure', () => {
    for (const k of ['white', 'pink', 'brown'] as const) {
      const a = fillNoise(k, 16384, 9);
      let m = 0;
      for (let i = 1; i < a.length; i++) m = Math.max(m, Math.abs(a[i] - a[i - 1]));
      // la jointure (fin → début) ne dépasse pas les plus grands écarts du bruit lui-même
      expect(Math.abs(a[0] - a[a.length - 1])).toBeLessThanOrEqual(m + 1e-6);
    }
  });
  it('rose : moins d\'aigus que le blanc ; brun : encore moins', () => {
    const rough = (k: 'white' | 'pink' | 'brown') => { const a = fillNoise(k, 16384, 3); let s = 0; for (let i = 1; i < a.length; i++) s += Math.abs(a[i] - a[i - 1]); return s; };
    expect(rough('pink')).toBeLessThan(rough('white'));
    expect(rough('brown')).toBeLessThan(rough('pink'));
  });
  it('saturation : impaire, monotone, bornée, y(±1) = ±1', () => {
    const c = saturationCurve(1025, 1.6);
    expect(c[0]).toBeCloseTo(-1, 6);
    expect(c[1024]).toBeCloseTo(1, 6);
    expect(c[512]).toBeCloseTo(0, 6);
    for (let i = 1; i < c.length; i++) expect(c[i]).toBeGreaterThanOrEqual(c[i - 1]);
    for (let i = 0; i < c.length; i++) expect(c[i] + c[c.length - 1 - i]).toBeCloseTo(0, 5);
  });
  it('écrêtage doux : identité sous le genou, jamais au-dessus du plafond, monotone', () => {
    const c = softClipCurve(2049);
    let max = 0;
    for (let i = 0; i < c.length; i++) max = Math.max(max, Math.abs(c[i]));
    expect(max).toBeLessThanOrEqual(PLAFOND);
    expect(20 * Math.log10(max)).toBeLessThan(-1);
    const x = (i: number) => (i / 2048) * 2 - 1;
    for (let i = 0; i < c.length; i++) if (Math.abs(x(i)) < 0.5) expect(c[i]).toBeCloseTo(x(i), 5);
    for (let i = 1; i < c.length; i++) expect(c[i]).toBeGreaterThanOrEqual(c[i - 1]);
  });
});
