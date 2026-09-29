import { clamp, smoothstep } from '../core/math/vec';

/** Frequence de base du moteur (4 cylindres : 2 explosions par tour). */
export function engineFrequency(rpm: number): number {
  return (rpm / 60) * 2;
}

export function screechGain(slip: number, speed: number): number {
  return clamp(slip, 0, 1) * smoothstep(3, 10, speed) * 0.22;
}

interface EngineNodes { osc1: OscillatorNode; osc2: OscillatorNode; filter: BiquadFilterNode; gain: GainNode; noise: AudioBufferSourceNode; screech: GainNode }

export class AudioEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private engine: EngineNodes | null = null;
  private volume = 0.8;
  private muted = false;
  private noiseBuffer: AudioBuffer | null = null;

  /** A appeler lors d\'un geste de l\'utilisateur (exigence des navigateurs). */
  unlock(): void {
    if (typeof window === 'undefined') return;
    if (this.ctx) {
      if (this.ctx.state === 'suspended') void this.ctx.resume();
      return;
    }
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    try {
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.connect(this.ctx.destination);
      this.applyVolume();
      const len = this.ctx.sampleRate * 2;
      this.noiseBuffer = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const data = this.noiseBuffer.getChannelData(0);
      let seed = 12345;
      for (let i = 0; i < len; i++) {
        seed = (seed * 1103515245 + 12345) & 0x7fffffff;
        data[i] = (seed / 0x7fffffff) * 2 - 1;
      }
    } catch {
      this.ctx = null;
      this.master = null;
    }
  }

  private applyVolume(): void {
    if (this.master && this.ctx) this.master.gain.setTargetAtTime(this.muted ? 0 : this.volume, this.ctx.currentTime, 0.02);
  }

  setVolume(v: number): void { this.volume = clamp(v, 0, 1); this.applyVolume(); }
  setMuted(m: boolean): void { this.muted = m; this.applyVolume(); }
  toggleMute(): boolean { this.setMuted(!this.muted); return this.muted; }

  startEngine(): void {
    const ctx = this.ctx, master = this.master;
    if (!ctx || !master || this.engine || !this.noiseBuffer) return;
    const osc1 = ctx.createOscillator(); osc1.type = 'sawtooth';
    const osc2 = ctx.createOscillator(); osc2.type = 'square';
    const filter = ctx.createBiquadFilter(); filter.type = 'lowpass'; filter.frequency.value = 600;
    const gain = ctx.createGain(); gain.gain.value = 0.0;
    osc1.connect(filter); osc2.connect(filter); filter.connect(gain); gain.connect(master);
    const noise = ctx.createBufferSource(); noise.buffer = this.noiseBuffer; noise.loop = true;
    const band = ctx.createBiquadFilter(); band.type = 'bandpass'; band.frequency.value = 1800; band.Q.value = 3;
    const screech = ctx.createGain(); screech.gain.value = 0;
    noise.connect(band); band.connect(screech); screech.connect(master);
    osc1.start(); osc2.start(); noise.start();
    this.engine = { osc1, osc2, filter, gain, noise, screech };
  }

  stopEngine(): void {
    const e = this.engine;
    if (!e) return;
    try { e.osc1.stop(); e.osc2.stop(); e.noise.stop(); } catch { /* deja arretes */ }
    e.gain.disconnect(); e.screech.disconnect();
    this.engine = null;
  }

  updateEngine(rpm: number, throttle: number, slip: number, speed: number): void {
    const e = this.engine, ctx = this.ctx;
    if (!e || !ctx) return;
    const t = ctx.currentTime;
    const f = engineFrequency(rpm);
    e.osc1.frequency.setTargetAtTime(f, t, 0.03);
    e.osc2.frequency.setTargetAtTime(f / 2, t, 0.03);
    e.filter.frequency.setTargetAtTime(400 + rpm * 0.25, t, 0.05);
    e.gain.gain.setTargetAtTime(0.06 + Math.max(0, throttle) * 0.06, t, 0.05);
    e.screech.gain.setTargetAtTime(screechGain(slip, speed), t, 0.05);
  }

  private blip(freq: number, dur: number, type: OscillatorType, gain: number, endFreq?: number, delay = 0): void {
    const ctx = this.ctx, master = this.master;
    if (!ctx || !master) return;
    const t = ctx.currentTime + delay;
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (endFreq) o.frequency.exponentialRampToValueAtTime(endFreq, t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(master);
    o.start(t); o.stop(t + dur + 0.02);
  }

  playBank(multiplier: number): void {
    this.blip(660, 0.08, 'sine', 0.2);
    this.blip(990 + multiplier * 40, 0.14, 'sine', 0.2, undefined, 0.08);
  }

  playLose(): void {
    this.blip(300, 0.3, 'square', 0.12, 120);
  }

  playCrash(impact: number): void {
    const ctx = this.ctx, master = this.master;
    if (!ctx || !master || !this.noiseBuffer) return;
    const t = ctx.currentTime;
    const src = ctx.createBufferSource(); src.buffer = this.noiseBuffer;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 600;
    const g = ctx.createGain();
    g.gain.setValueAtTime(Math.min(0.5, impact * 0.05), t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.25);
    src.connect(lp); lp.connect(g); g.connect(master);
    src.start(t); src.stop(t + 0.3);
  }

  playCountdown(n: number): void {
    if (n > 0) this.blip(440, 0.15, 'triangle', 0.25);
    else this.blip(880, 0.4, 'triangle', 0.3);
  }
}
