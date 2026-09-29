import type { Level } from '../level/types';
import { copyLevel } from './ops';

/** Gestionnaire d'historique pour l'éditeur. */
export class EditorDoc {
  private history: Level[] = [];
  private redoStack: Level[] = [];
  private version: number = 0;
  private gestureStart: Level | null = null;
  private gestureCurrent: Level | null = null;

  onChange?: () => void;

  constructor(level: Level, private max: number = 100) {
    this.history = [copyLevel(level)];
  }

  get level(): Level {
    return this.history[this.history.length - 1];
  }

  get canUndo(): boolean {
    return this.history.length > 1;
  }

  get canRedo(): boolean {
    return this.redoStack.length > 0;
  }

  get currentVersion(): number {
    return this.version;
  }

  /** Applique une mutation et crée une entrée d'historique. */
  apply(fn: (draft: Level) => void): void {
    const current = this.level;
    const next = copyLevel(current);
    fn(next);

    // Vérifie que le résultat est différent (deep equality)
    if (!deepEqual(current, next)) {
      this.history.push(next);
      if (this.history.length > this.max) {
        this.history.shift();
      }
      this.redoStack = [];
      this.version++;
      this.onChange?.();
    }
  }

  /** Débute un geste (drag). */
  beginGesture(): void {
    this.gestureStart = copyLevel(this.level);
    this.gestureCurrent = copyLevel(this.level);
  }

  /** Metà jour le geste en appliquant une mutation. */
  updateGesture(fn: (draft: Level) => void): void {
    if (!this.gestureCurrent) return;
    const next = copyLevel(this.gestureCurrent);
    fn(next);
    this.gestureCurrent = next;
    // Remplace l'état courant sans créer d'historique
    this.history[this.history.length - 1] = this.gestureCurrent;
    this.version++;
    this.onChange?.();
  }

  /** Termine le geste et crée une entrée d'historique si changé. */
  endGesture(): void {
    if (!this.gestureStart || !this.gestureCurrent) return;
    if (!deepEqual(this.gestureStart, this.gestureCurrent)) {
      // Crée une nouvelle entrée d'historique pour le geste
      this.history.push(copyLevel(this.gestureCurrent));
      if (this.history.length > this.max) {
        this.history.shift();
      }
      this.redoStack = [];
      this.version++;
      this.onChange?.();
    }
    this.gestureStart = null;
    this.gestureCurrent = null;
  }

  /** Annule le geste en cours. */
  cancelGesture(): void {
    if (!this.gestureStart) return;
    this.history[this.history.length - 1] = this.gestureStart;
    this.gestureStart = null;
    this.gestureCurrent = null;
    this.version++;
    this.onChange?.();
  }

  /** Annule le dernier changement. */
  undo(): boolean {
    if (!this.canUndo) return false;
    const current = this.history.pop()!;
    this.redoStack.push(current);
    this.version++;
    this.onChange?.();
    return true;
  }

  /** Rétablit le dernier changement annulé. */
  redo(): boolean {
    if (!this.canRedo) return false;
    const next = this.redoStack.pop()!;
    this.history.push(next);
    this.version++;
    this.onChange?.();
    return true;
  }
}

/** Comparaison profonde de deux niveaux. */
function deepEqual(a: Level, b: Level): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}
