import type { HudData } from '../core/race/race';
import { formatScore, formatTime } from '../ui/format';
import { aiguille, svgJaugeAngle } from './jaugeAngle';

export class Hud {
  private readonly el: Record<string, HTMLElement> = {};
  private last = { score: '', time: '', drift: '', mult: '', bar: -1, combo: -1, count: '', wrong: false, speed: '', facteurs: '', angle: '' };
  private flashUntil = 0;
  private goUntil = 0;

  constructor(private readonly root: HTMLElement) {
    root.innerHTML = `
      <div class="hud-top">
        <div class="hud-box"><small>Score</small><b data-k="score">0</b></div>
        <div class="hud-box"><small>Temps</small><b data-k="time">0:00.00</b></div>
      </div>
      <div class="hud-drift" data-k="driftBox"><div class="hud-facteurs" data-k="facteurs"><span class="f f-base"><i data-k="fBase"></i><small>base</small></span><span class="x">×</span><span class="f f-kmh"><i data-k="fKmh"></i><small>vitesse moy.</small></span><span class="x">×</span><span class="f f-ms"><i data-k="fMs"></i><small>durée</small></span><span class="x">×</span><span class="f f-angle"><i data-k="fAngle"></i><small>angle moy.</small></span><span class="x f-combo-x" data-k="fComboX">×</span><span class="f f-combo" data-k="fComboBox"><i data-k="fCombo"></i><small>combo</small></span></div><b data-k="drift"></b><span data-k="mult"></span><div class="hud-combo" data-k="combo"><i data-k="comboBar"></i></div></div>
      <div class="hud-count" data-k="count"></div>
      <div class="hud-wrong" data-k="wrong">Mauvais sens !</div>
      <div class="hud-progress"><div class="hud-bar"><i data-k="bar"></i></div></div>
      <div class="hud-angle" data-k="angleBox">${svgJaugeAngle()}<b data-k="angleVal">0°</b></div>
      <div class="hud-speed"><b data-k="speed">0</b> km/h</div>`;
    root.querySelectorAll<HTMLElement>('[data-k]').forEach((e) => { this.el[e.dataset.k!] = e; });
  }

  show(v: boolean): void {
    this.root.classList.toggle('on', v);
  }

  reset(): void {
    this.last = { score: '', time: '', drift: '', mult: '', bar: -1, combo: -1, count: '', wrong: false, speed: '', facteurs: '', angle: '' };
    this.el.facteurs.classList.remove('on');
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
    // décomposition exacte du drift en cours : base × km/h moyens × secondes × angle moyen (× combo) = points affichés
    const g = h.glisse;
    const texte = g ? libellesFacteurs(g) : null;
    const facteurs = texte ? texte.join('|') : '';
    if (facteurs !== this.last.facteurs) {
      this.last.facteurs = facteurs;
      this.el.facteurs.classList.toggle('on', !!texte);
      if (texte) {
        [this.el.fBase.textContent, this.el.fKmh.textContent, this.el.fMs.textContent, this.el.fAngle.textContent, this.el.fCombo.textContent] = texte;
        const avecCombo = texte[4] !== '';
        this.el.fComboX.hidden = !avecCombo;
        this.el.fComboBox.hidden = !avecCombo;
      }
    }
    // indicateur d'angle sous la voiture
    const angle = String(Math.round(h.angle));
    if (angle !== this.last.angle) {
      this.last.angle = angle;
      const a = Math.abs(h.angle);
      this.el.aiguille.setAttribute('transform', `rotate(${aiguille(h.angle).toFixed(1)} 100 100)`);
      this.el.angleVal.textContent = `${Math.round(a)}°`;
      this.el.angleBox.className = 'hud-angle' + (a > 90 ? ' trop' : a > 60 ? ' large' : a >= 25 ? ' ideal' : a >= 15 ? ' moyen' : '');
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

/** Valeurs des facteurs affichés au-dessus des points (vitesse et angle : moyennes du drift ; combo vide à x1). */
export function libellesFacteurs(g: { base: number; kmh: number; secondes: number; angle: number; combo: number }): [string, string, string, string, string] {
  const fr = (v: number, d: number) => v.toLocaleString('fr-FR', { minimumFractionDigits: d, maximumFractionDigits: d });
  return [String(g.base), `${fr(g.kmh, 0)} km/h`, `${fr(g.secondes, 2)} s`, fr(g.angle, 2), g.combo > 1 ? `x${g.combo}` : ''];
}
