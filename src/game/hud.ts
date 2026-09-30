import type { HudData } from '../core/race/race';
import { formatScore, formatTime } from '../ui/format';

export class Hud {
  private readonly el: Record<string, HTMLElement> = {};
  private last = { score: '', time: '', drift: '', mult: '', bar: -1, combo: -1, count: '', wrong: false, speed: '' };
  private flashUntil = 0;
  private goUntil = 0;

  constructor(private readonly root: HTMLElement) {
    root.innerHTML = `
      <div class="hud-top">
        <div class="hud-box"><small>Score</small><b data-k="score">0</b></div>
        <div class="hud-box"><small>Temps</small><b data-k="time">0:00.00</b></div>
      </div>
      <div class="hud-drift" data-k="driftBox"><b data-k="drift"></b><span data-k="mult"></span><div class="hud-combo" data-k="combo"><i data-k="comboBar"></i></div></div>
      <div class="hud-count" data-k="count"></div>
      <div class="hud-wrong" data-k="wrong">Mauvais sens !</div>
      <div class="hud-progress"><div class="hud-bar"><i data-k="bar"></i></div></div>
      <div class="hud-speed"><b data-k="speed">0</b> km/h</div>`;
    root.querySelectorAll<HTMLElement>('[data-k]').forEach((e) => { this.el[e.dataset.k!] = e; });
  }

  show(v: boolean): void {
    this.root.classList.toggle('on', v);
  }

  reset(): void {
    this.last = { score: '', time: '', drift: '', mult: '', bar: -1, combo: -1, count: '', wrong: false, speed: '' };
    this.el.combo.classList.remove('on');
    this.flashUntil = 0;
    this.goUntil = 0;
    this.el.driftBox.className = 'hud-drift';
  }

  private set(key: 'score' | 'time' | 'drift' | 'mult' | 'count' | 'speed', value: string): void {
    if (this.last[key] === value) return;
    this.last[key] = value;
    this.el[key].textContent = value;
  }

  update(h: HudData): void {
    const now = performance.now();
    this.set('score', formatScore(h.score));
    this.set('time', formatTime(h.time));
    this.set('speed', String(Math.round(h.speedKmh)));
    if (now >= this.flashUntil) {
      const box = this.el.driftBox;
      if (h.drift > 0) {
        this.set('drift', formatScore(h.drift));
        this.set('mult', `x${h.multiplier}`);
        box.className = 'hud-drift on' + (h.driftActive ? ' active' : '');
      } else if (h.multiplier > 1) {
        this.set('drift', '');
        this.set('mult', `Combo x${h.multiplier}`);
        box.className = 'hud-drift on';
      } else {
        box.className = 'hud-drift';
      }
    }
    // barre du combo : temps restant avant le retour à x1, visible aussi pendant « Encaissé ! »
    const combo = h.combo === null ? -1 : Math.round(h.combo * 200);
    if (combo !== this.last.combo) {
      this.last.combo = combo;
      this.el.combo.classList.toggle('on', combo >= 0);
      if (combo >= 0) {
        this.el.comboBar.style.transform = `scaleX(${combo / 200})`;
        this.el.combo.classList.toggle('bas', combo < 70);
      }
    }
    let count = '';
    if (h.phase === 'compte') count = String(Math.max(1, Math.ceil(h.countdown - 1e-9)));
    else if (now < this.goUntil) count = 'Partez !';
    this.set('count', count);
    if (h.wrongWay !== this.last.wrong) {
      this.last.wrong = h.wrongWay;
      this.el.wrong.classList.toggle('on', h.wrongWay);
    }
    const bar = Math.round(h.progress * 1000);
    if (bar !== this.last.bar) {
      this.last.bar = bar;
      this.el.bar.style.width = `${bar / 10}%`;
    }
  }

  flash(kind: 'bank' | 'lose', points: number): void {
    const box = this.el.driftBox;
    this.set('drift', (kind === 'bank' ? '+' : '−') + formatScore(points));
    this.set('mult', kind === 'bank' ? 'Encaissé !' : 'Perdu !');
    box.className = 'hud-drift on';
    void box.offsetWidth; // relance l'animation CSS
    box.className = `hud-drift on ${kind}`;
    this.flashUntil = performance.now() + 800;
  }

  go(): void {
    this.goUntil = performance.now() + 800;
  }
}
