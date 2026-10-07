import { describe, it, expect } from 'vitest';
import { GamepadInput, MANETTE_DEFAUT, courbeStick, etatManette, vibrationChoc, vibrationDrift, vibrationHorsPiste, type ManetteBrute } from '../../src/input/gamepad';
import { InputManager } from '../../src/input/manager';
import { KeyboardInput, NO_ACTIONS } from '../../src/input/keyboard';
import { quantifier } from '../../src/core/replay/replay';

function manette(o: { axes?: number[]; boutons?: Record<number, number> } = {}): ManetteBrute {
  const buttons = Array.from({ length: 17 }, (_, i) => {
    const v = o.boutons?.[i] ?? 0;
    return { pressed: v > 0.5, value: v };
  });
  return { connected: true, axes: o.axes ?? [0, 0, 0, 0], buttons };
}

describe('manette', () => {
  it('zone morte : petit mouvement du stick = tout droit', () => {
    expect(courbeStick(0.1, MANETTE_DEFAUT)).toBe(0);
    expect(courbeStick(-0.15, MANETTE_DEFAUT)).toBe(0);
    expect(courbeStick(1, MANETTE_DEFAUT)).toBe(1);
    expect(courbeStick(-1, MANETTE_DEFAUT)).toBe(-1);
    expect(courbeStick(NaN, MANETTE_DEFAUT)).toBe(0);
  });
  it('sensibilité : plus précise au centre quand elle est basse, monotone', () => {
    const precise = courbeStick(0.5, { zoneMorte: 0, sensibilite: 0 });
    const vive = courbeStick(0.5, { zoneMorte: 0, sensibilite: 1 });
    expect(precise).toBeLessThan(vive);
    expect(vive).toBeCloseTo(0.5);
    let prec = 0;
    for (let x = 0; x <= 1; x += 0.05) { const y = courbeStick(x, MANETTE_DEFAUT); expect(y).toBeGreaterThanOrEqual(prec); prec = y; }
  });
  it('gâchettes progressives, stick à droite = tourner à droite, A = frein à main', () => {
    const e = etatManette(manette({ axes: [1, 0], boutons: { 7: 0.5, 6: 1, 0: 1 } }), MANETTE_DEFAUT);
    expect(e.gaz).toBeGreaterThan(0.4);
    expect(e.gaz).toBeLessThan(0.6);
    expect(e.frein).toBe(1);
    expect(e.direction).toBe(-1);
    expect(e.freinAMain).toBe(true);
  });
  it('croix directionnelle si le stick est au repos ; jamais de −0', () => {
    expect(etatManette(manette({ boutons: { 14: 1 } }), MANETTE_DEFAUT).direction).toBe(1);
    const repos = etatManette(manette({ axes: [0.05, 0] }), MANETTE_DEFAUT);
    expect(Object.is(repos.direction, -0)).toBe(false);
    expect(Object.is(quantifier(repos).direction, -0)).toBe(false);
  });
  it('actions sur le front montant seulement, la dernière manette touchée pilote', () => {
    const pads: (ManetteBrute | null)[] = [manette(), null];
    const g = new GamepadInput(() => pads);
    pads[0] = manette({ boutons: { 7: 1 } });
    g.poll();
    expect(g.active).toBe(true);
    expect(g.state().gaz).toBe(1);
    pads[0] = manette({ boutons: { 7: 1, 9: 1 } });
    g.poll();
    expect(g.consumeActions().pause).toBe(true);
    g.poll();
    expect(g.consumeActions()).toEqual(NO_ACTIONS);
    pads[1] = manette({ axes: [-1, 0] });
    g.poll();
    expect(g.state().direction).toBe(1);
    pads[0] = manette(); pads[1] = null;
    g.poll();
    expect(g.active).toBe(false);
    expect(g.state().gaz).toBe(0);
  });
  it('InputManager : clavier et manette se combinent', () => {
    const pads = [manette({ boutons: { 7: 0.6 } })];
    const k = new KeyboardInput();
    const m = new InputManager(k, null, new GamepadInput(() => pads));
    m.consumeActions();
    expect(m.state(false).gaz).toBeGreaterThan(0.5);
    k.keyDown('KeyA');
    expect(m.state(false).direction).toBe(1);
  });
});

describe('vibrations de la manette', () => {
  it('drift : plus fort avec le multiplicateur ; choc selon l\'impact ; hors piste seulement en roulant', () => {
    expect(vibrationDrift(5).fort).toBeGreaterThan(vibrationDrift(1).fort);
    expect(vibrationChoc(20).fort).toBe(1);
    expect(vibrationChoc(2).fort).toBeLessThan(1);
    expect(vibrationHorsPiste(0)).toBeNull();
    expect(vibrationHorsPiste(20)!.fort).toBeGreaterThan(vibrationHorsPiste(5)!.fort);
  });
  it('vibre la manette qui pilote, sans couper une secousse plus forte, et jamais si c\'est désactivé', () => {
    const effets: number[] = [];
    const pad = { ...manette({ boutons: { 7: 1 } }), vibrationActuator: { playEffect: (_t: string, p: { strongMagnitude: number }) => { effets.push(p.strongMagnitude); return Promise.resolve(); } } };
    const g = new GamepadInput(() => [pad]);
    g.vibrer(vibrationChoc(20), 0);
    expect(effets).toEqual([]); // aucune manette n'a encore piloté
    g.poll();
    g.vibrer(vibrationChoc(20), 0);
    g.vibrer(vibrationHorsPiste(10), 50); // plus faible, pendant la secousse : ignoré
    g.vibrer(vibrationHorsPiste(10), 1000);
    expect(effets.length).toBe(2);
    g.reglages = { ...g.reglages, vibrations: false };
    g.vibrer(vibrationChoc(20), 5000);
    expect(effets.length).toBe(2);
  });
  it('sans moteur de vibration (Firefox, Safari) : rien ne casse', () => {
    const g = new GamepadInput(() => [manette({ boutons: { 7: 1 } })]);
    g.poll();
    expect(() => { g.vibrer(vibrationChoc(10), 0); g.arreterVibrations(); }).not.toThrow();
  });
});
