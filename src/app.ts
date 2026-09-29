import * as THREE from 'three';
import { loadAssets } from './render/assets';
import { QualityManager } from './render/quality';
import { AudioEngine } from './audio/audio';
import { KeyboardInput } from './input/keyboard';
import { TouchControls } from './input/touch';
import { InputManager } from './input/manager';
import { Store, safeStorage } from './storage/store';
import { Hud } from './game/hud';
import { GameSession } from './game/session';
import { prepareLevel } from './game/prepare';
import { NIVEAUX_OFFICIELS, cleNiveauOfficiel } from './levels';
import { formatScore, formatTime } from './ui/format';

const $ = (id: string) => document.getElementById(id) as HTMLElement;

/** Version minimale : lance directement le premier niveau (utile pour vérifier le rendu et la conduite). */
export async function startApp(): Promise<void> {
  const ui = $('ui');
  const touch = matchMedia('(pointer: coarse)').matches;
  let renderer: THREE.WebGLRenderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas: $('scene') as HTMLCanvasElement, antialias: true, powerPreference: 'high-performance' });
  } catch {
    ui.innerHTML = '<div class="screen"><h2>WebGL indisponible</h2><p>Essaie avec un navigateur récent.</p></div>';
    return;
  }
  const store = new Store(safeStorage().kv);
  const reglages = store.loadReglages(touch);
  const audio = new AudioEngine();
  audio.setVolume(reglages.volume);
  const unlock = () => audio.unlock();
  window.addEventListener('pointerdown', unlock);
  window.addEventListener('keydown', unlock);
  const keyboard = new KeyboardInput();
  keyboard.attach(window);
  keyboard.capture = true;
  const touchControls = new TouchControls($('touch'));
  touchControls.show(touch);
  const input = new InputManager(keyboard, touchControls);
  ui.innerHTML = '<div class="screen"><h2>Chargement…</h2></div>';
  const assets = await loadAssets(import.meta.env.BASE_URL + 'models/');
  const n = NIVEAUX_OFFICIELS[0];
  const res = prepareLevel(cleNiveauOfficiel(n.id), n.data);
  if (!res.ok) { ui.innerHTML = `<div class="screen"><h2>Niveau invalide</h2><p>${res.erreurs.join('<br>')}</p></div>`; return; }
  ui.innerHTML = '';
  const session: GameSession = new GameSession(res.prepared, {
    renderer, assets, hud: new Hud($('hud')), audio, input, quality: new QualityManager(reglages.qualite, touch), reglages,
  }, {
    onPause: () => {
      session.pause();
      ui.innerHTML = '<div class="screen"><h2>Pause</h2><button class="btn" id="go">Reprendre</button></div>';
      $('go').onclick = () => { ui.innerHTML = ''; session.resume(); };
    },
    onFinish: (r) => {
      session.pause();
      ui.innerHTML = `<div class="screen"><h2>Arrivée !</h2><p>Score ${formatScore(r.score)} — ${formatTime(r.time)}</p><button class="btn" id="go">Rejouer</button></div>`;
      $('go').onclick = () => { ui.innerHTML = ''; session.restart(); };
    },
  });
  session.start();
}
