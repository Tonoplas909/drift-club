/**
 * Voix continues : moteur, pneus, surface hors piste, vent. Construites sur n'importe quel BaseAudioContext (jeu ou rendu hors ligne).
 * Tous les paramètres évoluent par `setTargetAtTime` (aucun saut, donc aucun « zipper noise »).
 */
import type { CarId } from '../core/physics/types';
import { clamp } from '../core/math/vec';
import type { Env } from './bus';
import { saturationCurve } from './noise';
import {
  CAR_SOUND, boostCible, engineTargets, limiteurQuantite, screechCentre, screechLevel, sifflementFreq, sifflementGain,
  smoothAsym, soufflageDeclenche, surfaceLevel, ventLevel, type CarSound,
} from './params';
import { soufflage } from './shots';

/** Niveau de sortie du moteur avant le bus (le mixage relatif se règle ici et dans `bus.ts`). */
const NIVEAU_MOTEUR = 0.2;
const NIVEAU_PNEUS = 0.45;
const NIVEAU_SURFACE = 0.12;
const NIVEAU_VENT = 0.1;

function bruit(env: Env, kind: 'white' | 'pink' | 'brown', decalage: number): AudioBufferSourceNode {
  const s = env.ctx.createBufferSource();
  s.buffer = env.noise[kind];
  s.loop = true;
  s.start(0, decalage % s.buffer.duration);
  return s;
}

function lfo(env: Env, freq: number, profondeur: number, cibles: AudioParam[], type: OscillatorType = 'sine'): OscillatorNode {
  const o = env.ctx.createOscillator(); o.type = type; o.frequency.value = freq;
  const g = env.ctx.createGain(); g.gain.value = profondeur;
  o.connect(g);
  for (const c of cibles) g.connect(c);
  o.start();
  return o;
}

export class EngineVoice {
  private readonly p: CarSound;
  private readonly oscs: { sawA: OscillatorNode; sawB: OscillatorNode; sub: OscillatorNode; h2: OscillatorNode; h3: OscillatorNode };
  private readonly gains: { sub: GainNode; h2: GainNode; h3: GainNode; noise: GainNode };
  private readonly lp: BiquadFilterNode;
  private readonly noiseBp: BiquadFilterNode;
  private readonly charge: GainNode;
  private readonly creux: GainNode;
  private readonly lim: GainNode;
  private readonly limDepth: GainNode;
  private readonly fondu: GainNode;
  private readonly sources: AudioScheduledSourceNode[] = [];
  private turbo: { osc: OscillatorNode; bp: BiquadFilterNode; g: GainNode; gn: GainNode } | null = null;
  private boost = 0;
  private gear = 0;
  private dernierSouffle = -10;

  constructor(private readonly env: Env, private readonly out: AudioNode, car: CarId) {
    const ctx = env.ctx;
    const p = this.p = CAR_SOUND[car];
    const mix = ctx.createGain(); mix.gain.value = 0.45;
    const mk = (type: OscillatorType, detune = 0): OscillatorNode => {
      const o = ctx.createOscillator(); o.type = type; o.detune.value = detune; o.frequency.value = 60;
      o.start();
      this.sources.push(o);
      return o;
    };
    const sawA = mk('sawtooth', -p.detune), sawB = mk('sawtooth', p.detune);
    const sub = mk('triangle'), h2 = mk('triangle'), h3 = mk('sine');
    this.oscs = { sawA, sawB, sub, h2, h3 };
    const gSaw = ctx.createGain(); gSaw.gain.value = p.saw;
    sawA.connect(gSaw); sawB.connect(gSaw); gSaw.connect(mix);
    const g = (o: OscillatorNode, v: number): GainNode => { const n = ctx.createGain(); n.gain.value = v; o.connect(n); n.connect(mix); return n; };
    this.gains = { sub: g(sub, p.sub), h2: g(h2, p.upper * 0.6), h3: g(h3, p.upper * 0.4), noise: ctx.createGain() };
    // léger vibrato lent : le moteur « vit » sans jamais sonner mécanique
    this.sources.push(lfo(env, 5.3, 3, [sawA.detune, sawB.detune, sub.detune, h2.detune, h3.detune]));

    this.lp = ctx.createBiquadFilter(); this.lp.type = 'lowpass'; this.lp.frequency.value = 600; this.lp.Q.value = p.q;
    const shaper = ctx.createWaveShaper(); shaper.curve = saturationCurve(1025, p.drive); shaper.oversample = '4x';
    const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 28; hp.Q.value = 0.5;
    const tonalite = ctx.createBiquadFilter(); tonalite.type = 'lowpass'; tonalite.frequency.value = 3400; tonalite.Q.value = 0.4;
    this.charge = ctx.createGain(); this.charge.gain.value = 0;
    this.creux = ctx.createGain();
    this.lim = ctx.createGain();
    this.limDepth = ctx.createGain(); this.limDepth.gain.value = 0;
    const limOsc = ctx.createOscillator(); limOsc.frequency.value = 13;
    limOsc.connect(this.limDepth); this.limDepth.connect(this.lim.gain);
    limOsc.start();
    this.sources.push(limOsc);
    this.fondu = ctx.createGain(); this.fondu.gain.value = 0;
    mix.connect(this.lp); this.lp.connect(shaper); shaper.connect(hp); hp.connect(tonalite);

    // combustion : bruit rose passe-bande, suit le régime
    const noise = bruit(env, 'pink', 0.3);
    this.sources.push(noise);
    this.noiseBp = ctx.createBiquadFilter(); this.noiseBp.type = 'bandpass'; this.noiseBp.frequency.value = 500; this.noiseBp.Q.value = 0.9;
    noise.connect(this.noiseBp); this.noiseBp.connect(this.gains.noise); this.gains.noise.connect(tonalite);

    tonalite.connect(this.charge); this.charge.connect(this.creux); this.creux.connect(this.lim); this.lim.connect(this.fondu);
    const sortie = ctx.createGain(); sortie.gain.value = NIVEAU_MOTEUR;
    this.fondu.connect(sortie); sortie.connect(out);

    if (p.turbo) {
      const osc = ctx.createOscillator(); osc.frequency.value = 1300;
      const gOsc = ctx.createGain(); gOsc.gain.value = 0;
      osc.connect(gOsc); gOsc.connect(out);
      const n = bruit(env, 'white', 1.1);
      const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 1300; bp.Q.value = 7;
      const gn = ctx.createGain(); gn.gain.value = 0;
      n.connect(bp); bp.connect(gn); gn.connect(out);
      osc.start();
      this.sources.push(osc, n);
      this.turbo = { osc, bp, g: gOsc, gn };
    }
    this.fondu.gain.setTargetAtTime(1, ctx.currentTime, 0.08);
  }

  /** `t` : temps du contexte ; `dt` : temps écoulé depuis le dernier appel. */
  update(t: number, dt: number, rpm: number, throttle: number, gear: number): void {
    const T = engineTargets(this.p, rpm, throttle);
    const o = this.oscs;
    o.sawA.frequency.setTargetAtTime(T.freq, t, 0.03);
    o.sawB.frequency.setTargetAtTime(T.freq, t, 0.03);
    o.sub.frequency.setTargetAtTime(T.freq / 2, t, 0.03);
    o.h2.frequency.setTargetAtTime(T.freq * 2, t, 0.03);
    o.h3.frequency.setTargetAtTime(T.freq * 3, t, 0.03);
    this.lp.frequency.setTargetAtTime(T.cutoff, t, 0.05);
    this.charge.gain.setTargetAtTime(T.gain, t, 0.06);
    this.gains.sub.gain.setTargetAtTime(T.sub, t, 0.08);
    this.gains.h2.gain.setTargetAtTime(T.upper * 0.6, t, 0.08);
    this.gains.h3.gain.setTargetAtTime(T.upper * 0.4, t, 0.08);
    this.gains.noise.gain.setTargetAtTime(T.noiseGain, t, 0.08);
    this.noiseBp.frequency.setTargetAtTime(T.noiseFreq, t, 0.06);

    // changement de rapport : le couple se coupe un instant, puis revient
    if (this.gear !== 0 && gear !== this.gear && gear > 0) {
      const montee = gear > this.gear;
      const c = this.creux.gain;
      c.cancelScheduledValues(t);
      c.setTargetAtTime(montee ? 0.5 : 0.75, t, 0.012);
      c.setTargetAtTime(1, t + 0.05, 0.05);
    }
    this.gear = gear;

    // limiteur : le son « rebondit » près de 7500 tr/min
    const a = limiteurQuantite(rpm);
    this.lim.gain.setTargetAtTime(1 - 0.3 * a, t, 0.03);
    this.limDepth.gain.setTargetAtTime(0.3 * a, t, 0.03);

    if (this.turbo) {
      const prec = this.boost;
      this.boost = smoothAsym(this.boost, boostCible(throttle, rpm), dt, 0.35, 0.22);
      const f = sifflementFreq(this.boost);
      this.turbo.osc.frequency.setTargetAtTime(f, t, 0.08);
      this.turbo.bp.frequency.setTargetAtTime(f * 1.02, t, 0.08);
      this.turbo.g.gain.setTargetAtTime(sifflementGain(this.boost), t, 0.06);
      this.turbo.gn.gain.setTargetAtTime(sifflementGain(this.boost) * 1.6, t, 0.06);
      if (soufflageDeclenche(prec, throttle, rpm) && t - this.dernierSouffle > 0.7) {
        this.dernierSouffle = t;
        soufflage(this.env, this.out, t + 0.005, prec);
      }
    }
  }

  /** Fondu de sortie puis arrêt et libération de tous les nœuds. */
  stop(t: number): void {
    this.fondu.gain.cancelScheduledValues(t);
    this.fondu.gain.setTargetAtTime(0, t, 0.05);
    const fin = t + 0.5;
    for (const s of this.sources) { try { s.stop(fin); } catch { /* déjà arrêté */ } }
    this.sources[0].onended = () => { this.fondu.disconnect(); this.turbo?.g.disconnect(); this.turbo?.gn.disconnect(); };
  }
}

/** Crissement des pneus : bruit blanc passe-bande (≈ 800–1900 Hz) à centre légèrement modulé, adouci par un passe-bas. */
export class TyreVoice {
  private level = 0;
  private readonly g: GainNode;
  private readonly bands: BiquadFilterNode[];
  private readonly sources: AudioScheduledSourceNode[] = [];

  constructor(env: Env, out: AudioNode) {
    const ctx = env.ctx;
    this.g = ctx.createGain(); this.g.gain.value = 0;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 3200; lp.Q.value = 0.5;
    const mk = (offset: number, q: number, mixLevel: number): BiquadFilterNode => {
      const n = bruit(env, 'white', offset); this.sources.push(n);
      const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 1200; bp.Q.value = q;
      const m = ctx.createGain(); m.gain.value = mixLevel;
      n.connect(bp); bp.connect(m); m.connect(lp);
      return bp;
    };
    // deux bandes : le « mordant » et le corps plus grave
    this.bands = [mk(0.2, 4, 1), mk(0.9, 2.5, 0.8)];
    // modulation lente + rapide de la fréquence centrale (crissement vivant, pas un sifflet fixe)
    this.sources.push(lfo(env, 6.5, 70, this.bands.map((b) => b.frequency)));
    this.sources.push(lfo(env, 1.1, 130, this.bands.map((b) => b.frequency)));
    lp.connect(this.g); this.g.connect(out);
  }

  update(t: number, dt: number, slip: number, speed: number): void {
    this.level = smoothAsym(this.level, screechLevel(slip, speed), dt, 0.05, 0.14);
    const c = screechCentre(slip, speed);
    this.bands[0].frequency.setTargetAtTime(c, t, 0.08);
    this.bands[1].frequency.setTargetAtTime(c * 0.62, t, 0.08);
    this.g.gain.setTargetAtTime(this.level * NIVEAU_PNEUS, t, 0.03);
  }

  stop(t: number): void {
    this.g.gain.setTargetAtTime(0, t, 0.04);
    for (const s of this.sources) { try { s.stop(t + 0.4); } catch { /* déjà arrêté */ } }
  }
}

/** Grondement gravier / herbe hors piste (bruit brun passe-bas, légère granulation) et souffle du vent. */
export class AmbianceVoice {
  private surface = 0;
  private vent = 0;
  private readonly surfLp: BiquadFilterNode;
  private readonly surfG: GainNode;
  private readonly ventBp: BiquadFilterNode;
  private readonly ventG: GainNode;
  private readonly sources: AudioScheduledSourceNode[] = [];

  constructor(env: Env, out: AudioNode) {
    const ctx = env.ctx;
    const s = bruit(env, 'brown', 0.7);
    this.surfLp = ctx.createBiquadFilter(); this.surfLp.type = 'lowpass'; this.surfLp.frequency.value = 400; this.surfLp.Q.value = 0.7;
    const am = ctx.createGain(); am.gain.value = 0.75;
    this.surfG = ctx.createGain(); this.surfG.gain.value = 0;
    s.connect(this.surfLp); this.surfLp.connect(am); am.connect(this.surfG); this.surfG.connect(out);
    this.sources.push(s, lfo(env, 17, 0.25, [am.gain]));

    const w = bruit(env, 'pink', 1.3);
    this.ventBp = ctx.createBiquadFilter(); this.ventBp.type = 'bandpass'; this.ventBp.frequency.value = 500; this.ventBp.Q.value = 0.6;
    this.ventG = ctx.createGain(); this.ventG.gain.value = 0;
    w.connect(this.ventBp); this.ventBp.connect(this.ventG); this.ventG.connect(out);
    this.sources.push(w);
  }

  update(t: number, dt: number, onRoad: boolean, speed: number): void {
    this.surface = smoothAsym(this.surface, surfaceLevel(onRoad, speed), dt, 0.12, 0.25);
    this.vent = smoothAsym(this.vent, ventLevel(speed), dt, 0.4, 0.4);
    this.surfLp.frequency.setTargetAtTime(260 + clamp(speed, 0, 60) * 12, t, 0.1);
    this.surfG.gain.setTargetAtTime(this.surface * NIVEAU_SURFACE, t, 0.05);
    this.ventBp.frequency.setTargetAtTime(350 + clamp(speed, 0, 60) * 22, t, 0.15);
    this.ventG.gain.setTargetAtTime(this.vent * NIVEAU_VENT, t, 0.1);
  }

  stop(t: number): void {
    this.surfG.gain.setTargetAtTime(0, t, 0.04);
    this.ventG.gain.setTargetAtTime(0, t, 0.04);
    for (const s of this.sources) { try { s.stop(t + 0.4); } catch { /* déjà arrêté */ } }
  }
}
