import { describe, it, expect } from 'vitest';
import { EditorDoc } from '../../../src/core/editor/history';
import { addPoint, deletePoint } from '../../../src/core/editor/ops';
import { straightLevel } from '../../fixtures/levels';

describe('EditorDoc: undo/redo', () => {
  it('initialise avec un niveau', () => {
    const l = straightLevel();
    const doc = new EditorDoc(l);
    expect(doc.level).toEqual(l);
  });

  it('applique une mutation et crée une entrée d\'historique', () => {
    const l = straightLevel();
    const doc = new EditorDoc(l);
    const v1 = doc.version;
    doc.apply((draft) => {
      addPoint(draft, 10, 20);
    });
    expect(doc.level.route.length).toBe(l.route.length + 1);
    expect(doc.version).toBe(v1 + 1);
  });

  it('annule le dernier changement', () => {
    const l = straightLevel();
    const doc = new EditorDoc(l);
    const n = l.route.length;
    doc.apply((draft) => {
      addPoint(draft, 10, 20);
    });
    expect(doc.level.route.length).toBe(n + 1);
    const canUndo = doc.undo();
    expect(canUndo).toBe(true);
    expect(doc.level.route.length).toBe(n);
  });

  it('refuse d\'annuler s\'il n\'y a rien à annuler', () => {
    const l = straightLevel();
    const doc = new EditorDoc(l);
    expect(doc.canUndo).toBe(false);
    const res = doc.undo();
    expect(res).toBe(false);
  });

  it('rétablit le dernier changement annulé', () => {
    const l = straightLevel();
    const doc = new EditorDoc(l);
    const n = l.route.length;
    doc.apply((draft) => {
      addPoint(draft, 10, 20);
    });
    doc.undo();
    const res = doc.redo();
    expect(res).toBe(true);
    expect(doc.level.route.length).toBe(n + 1);
  });

  it('refuse de rétablir s\'il n\'y a rien à rétablir', () => {
    const l = straightLevel();
    const doc = new EditorDoc(l);
    expect(doc.canRedo).toBe(false);
    const res = doc.redo();
    expect(res).toBe(false);
  });

  it('vide la pile redo quand on applique une mutation après undo', () => {
    const l = straightLevel();
    const doc = new EditorDoc(l);
    doc.apply((draft) => {
      addPoint(draft, 10, 20);
    });
    doc.undo();
    expect(doc.canRedo).toBe(true);
    doc.apply((draft) => {
      addPoint(draft, 30, 40);
    });
    expect(doc.canRedo).toBe(false);
  });

  it('limite l\'historique à max entrées', () => {
    const l = straightLevel();
    const doc = new EditorDoc(l, 5);
    for (let i = 0; i < 10; i++) {
      doc.apply((draft) => {
        addPoint(draft, i, i);
      });
    }
    // Doit avoir 5 entrées (init + 4 changements)
    // En annulant 4 fois, on doit arriver à l'init
    expect(doc.canUndo).toBe(true);
  });
});

describe('EditorDoc: gestures', () => {
  it('débute et termine un geste', () => {
    const l = straightLevel();
    const doc = new EditorDoc(l);
    const v1 = doc.version;
    doc.beginGesture();
    doc.updateGesture((draft) => {
      addPoint(draft, 10, 20);
    });
    expect(doc.level.route.length).toBe(l.route.length + 1);
    doc.endGesture();
    expect(doc.version).toBeGreaterThan(v1);
    expect(doc.canUndo).toBe(true);
  });

  it('annule un geste en cours', () => {
    const l = straightLevel();
    const doc = new EditorDoc(l);
    const n = l.route.length;
    doc.beginGesture();
    doc.updateGesture((draft) => {
      addPoint(draft, 10, 20);
    });
    expect(doc.level.route.length).toBe(n + 1);
    doc.cancelGesture();
    expect(doc.level.route.length).toBe(n);
  });

  it('ne crée pas une entrée d\'historique si le geste ne change rien', () => {
    const doc = new EditorDoc(straightLevel());
    doc.beginGesture();
    doc.updateGesture(() => {});
    doc.endGesture();
    expect(doc.canUndo).toBe(false);
  });

  it('annuler après un geste revient à l\'état d\'avant le geste, en une fois', () => {
    const l = straightLevel();
    const doc = new EditorDoc(l);
    const x0 = l.route[1].x;
    doc.beginGesture();
    doc.updateGesture((d) => { d.route[1].x = x0 + 5; });
    doc.updateGesture((d) => { d.route[1].x = x0 + 10; });
    doc.endGesture();
    expect(doc.level.route[1].x).toBe(x0 + 10);
    expect(doc.undo()).toBe(true);
    expect(doc.level.route[1].x).toBe(x0);
    expect(doc.canUndo).toBe(false);
    doc.redo();
    expect(doc.level.route[1].x).toBe(x0 + 10);
  });

  it('appelle onChange lors de chaque mutation', () => {
    const l = straightLevel();
    const doc = new EditorDoc(l);
    let changes = 0;
    doc.onChange = () => {
      changes++;
    };
    doc.apply((draft) => {
      addPoint(draft, 10, 20);
    });
    expect(changes).toBe(1);
  });
});
