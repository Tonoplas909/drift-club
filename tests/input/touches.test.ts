import { describe, it, expect } from 'vitest';
import { attribuerBouton, attribuerTouche, lireTouches, nomTouche, retirerTouche, touchesParDefaut, TOUCHES_DEFAUT } from '../../src/input/touches';
import { KeyboardInput } from '../../src/input/keyboard';
import { etatManette, MANETTE_DEFAUT, GamepadInput, type ManetteBrute } from '../../src/input/gamepad';

const pad = (boutons: Record<number, number>): ManetteBrute => ({
  connected: true, axes: [0, 0, 0, 0],
  buttons: Array.from({ length: 17 }, (_, i) => ({ pressed: (boutons[i] ?? 0) > 0.5, value: boutons[i] ?? 0 })),
});

describe('touches personnalisables', () => {
  it('une touche attribuée quitte son ancienne commande', () => {
    const t = attribuerTouche(touchesParDefaut().clavier, 'freinAMain', 0, 'KeyS');
    expect(t.freinAMain).toEqual(['KeyS']);
    expect(t.frein).toEqual(['ArrowDown']);
    expect(attribuerTouche(t, 'freinAMain', 1, 'ShiftLeft').freinAMain).toEqual(['KeyS', 'ShiftLeft']);
    expect(retirerTouche(t, 'frein', 0).frein).toEqual([]);
  });
  it('Échap ne s\'attribue pas', () => {
    const d = touchesParDefaut().clavier;
    expect(attribuerTouche(d, 'gaz', 0, 'Escape')).toBe(d);
  });
  it('relecture : valeurs invalides ignorées, pas de doublon, défauts sinon', () => {
    expect(lireTouches(null)).toEqual(touchesParDefaut());
    const t = lireTouches({ clavier: { gaz: ['KeyI', 42, 'Escape'], frein: ['KeyI', 'KeyK'] }, manette: { gaz: 5, frein: -1 } });
    expect(t.clavier.gaz).toEqual(['KeyI']);
    expect(t.clavier.frein).toEqual(['KeyK']);
    expect(t.clavier.gauche).toEqual(TOUCHES_DEFAUT.clavier.gauche);
    expect(t.manette.gaz).toBe(5);
    expect(t.manette.frein).toBe(TOUCHES_DEFAUT.manette.frein);
  });
  it('bouton de manette déjà pris : les deux commandes s\'échangent', () => {
    const m = attribuerBouton(touchesParDefaut().manette, 'freinAMain', 1);
    expect(m.freinAMain).toBe(1);
    expect(m.replacer).toBe(0);
  });
  it('noms des touches', () => {
    expect(nomTouche('Space')).toBe('Espace');
    expect(nomTouche('KeyW')).toBe('Z/W');
    expect(nomTouche('KeyD')).toBe('D');
    expect(nomTouche('KeyW', new Map([['KeyW', 'z']]))).toBe('Z');
  });
  it('le clavier suit les touches choisies ; Échap met toujours en pause', () => {
    const k = new KeyboardInput();
    k.touches = attribuerTouche(touchesParDefaut().clavier, 'gaz', 0, 'KeyI');
    k.keyDown('KeyI');
    expect(k.state().gaz).toBe(1);
    k.touches = { ...k.touches, pause: [] };
    k.keyDown('Escape');
    expect(k.consumeActions().pause).toBe(true);
    k.touches = attribuerTouche(k.touches, 'camera', 0, 'KeyV');
    k.keyDown('KeyV');
    expect(k.consumeActions().camera).toBe(true);
  });
  it('la manette suit les boutons choisis ; la croix ne tourne plus si elle sert à autre chose', () => {
    const b = { ...touchesParDefaut().manette, gaz: 0, freinAMain: 14 };
    const e = etatManette(pad({ 0: 1, 14: 1 }), MANETTE_DEFAUT, b);
    expect(e.gaz).toBe(1);
    expect(e.freinAMain).toBe(true);
    expect(e.direction).toBe(0);
    const g = new GamepadInput(() => [pad({ 2: 1 })]);
    g.boutons = { ...g.boutons, camera: 2 };
    g.poll();
    expect(g.consumeActions().camera).toBe(false); // appui déjà là à la première lecture
    expect(g.lireBouton()).toBe(2);
  });
});
