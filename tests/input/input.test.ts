import { describe, it, expect } from 'vitest';
import { KeyboardInput, NO_ACTIONS } from '../../src/input/keyboard';
import { steerFromDrag } from '../../src/input/touch';
import { InputManager } from '../../src/input/manager';
import type { TouchSource } from '../../src/input/touch';
import type { InputState } from '../../src/core/input';

describe('KeyboardInput', () => {
  it('ZQSD (positions physiques) et fleches', () => {
    const k = new KeyboardInput();
    k.keyDown('KeyW'); k.keyDown('KeyA');
    expect(k.state()).toEqual({ gaz: 1, frein: 0, direction: 1, freinAMain: false });
    k.keyUp('KeyW'); k.keyUp('KeyA');
    k.keyDown('ArrowDown'); k.keyDown('ArrowRight'); k.keyDown('Space');
    expect(k.state()).toEqual({ gaz: 0, frein: 1, direction: -1, freinAMain: true });
  });
  it('gauche + droite s\'annulent', () => {
    const k = new KeyboardInput();
    k.keyDown('KeyA'); k.keyDown('KeyD');
    expect(k.state().direction).toBe(0);
  });
  it('actions : une fois par appui, repetition ignoree, videes a la lecture', () => {
    const k = new KeyboardInput();
    k.keyDown('KeyR');
    k.keyDown('KeyR', true);
    expect(k.consumeActions().replacer).toBe(true);
    expect(k.consumeActions()).toEqual(NO_ACTIONS);
    k.keyDown('Escape');
    expect(k.consumeActions().pause).toBe(true);
    k.keyDown('KeyP', false);
    expect(k.consumeActions().pause).toBe(true);
  });
  it('clear relache tout (perte de focus)', () => {
    const k = new KeyboardInput();
    k.keyDown('KeyW');
    k.clear();
    expect(k.state().gaz).toBe(0);
  });
});

describe('tactile', () => {
  it('glisser a droite = tourner a droite (direction negative), borne', () => {
    expect(steerFromDrag(0, 400)).toBeCloseTo(0, 9);
    expect(steerFromDrag(36, 400)).toBeCloseTo(-0.5, 9);
    expect(steerFromDrag(-500, 400)).toBe(1);
    expect(steerFromDrag(30, 100)).toBeCloseTo(-0.5, 9);
  });
});

describe('InputManager', () => {
  const fakeTouch = (s: InputState, active = true): TouchSource => ({
    active,
    state: (accel) => (accel ? { ...s, gaz: s.frein > 0 ? s.gaz : 1 } : s),
    consumeActions: () => ({ ...NO_ACTIONS, camera: true }),
    reset: () => {},
  });
  it('fusionne clavier et tactile', () => {
    const k = new KeyboardInput();
    k.keyDown('KeyW');
    const m = new InputManager(k, fakeTouch({ gaz: 0, frein: 0, direction: -0.4, freinAMain: true }));
    expect(m.state(false)).toEqual({ gaz: 1, frein: 0, direction: -0.4, freinAMain: true });
    k.keyDown('KeyA');
    expect(m.state(false).direction).toBe(1);
    expect(m.consumeActions().camera).toBe(true);
  });
  it('acceleration auto seulement via le tactile', () => {
    const m = new InputManager(new KeyboardInput(), fakeTouch({ gaz: 0, frein: 0, direction: 0, freinAMain: false }));
    expect(m.state(true).gaz).toBe(1);
    expect(m.state(false).gaz).toBe(0);
    expect(new InputManager(new KeyboardInput(), null).state(true).gaz).toBe(0);
  });
});

describe('touche Retour arrière', () => {
  it('déclenche l\'action « recommencer » une seule fois', () => {
    const k = new KeyboardInput();
    k.keyDown('Backspace');
    expect(k.consumeActions().recommencer).toBe(true);
    expect(k.consumeActions().recommencer).toBe(false);
    k.keyDown('Backspace', true);
    expect(k.consumeActions().recommencer).toBe(false);
  });
});
