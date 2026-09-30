import { describe, it, expect } from 'vitest';
import { AudioEngine, engineFrequency, screechGain } from '../../src/audio/audio';

describe('audio', () => {
  it('frequence moteur : 4 cylindres', () => {
    expect(engineFrequency(3000)).toBe(100);
  });
  it('crissement selon la glisse et la vitesse', () => {
    expect(screechGain(1, 20)).toBeGreaterThan(0.1);
    expect(screechGain(0.5, 0)).toBe(0);
    expect(screechGain(0, 30)).toBe(0);
  });
  it('sans AudioContext : aucune methode ne leve d\'erreur', () => {
    const a = new AudioEngine();
    expect(() => {
      a.unlock();
      a.setVolume(0.5);
      a.startEngine('turbo');
      a.updateEngine(4000, 1, 0.5, 20);
      a.updateEngine(4000, 1, 0.5, 20, { gear: 3, onRoad: false });
      a.playBank(3); a.playLose(); a.playCrash(8); a.playCountdown(0); a.playFinish(); a.playClick(); a.playScrape(0.5);
      a.playTick(); a.playTick(0.9); a.playOuvrirCaisse();
      for (const r of ['commune', 'rare', 'epique', 'legendaire', 'exotique'] as const) a.playReveal(r);
      a.stopEngine();
    }).not.toThrow();
    expect(a.toggleMute()).toBe(true);
    expect(a.toggleMute()).toBe(false);
  });
});
