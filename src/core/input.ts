/** Intention de pilotage, identique pour le clavier et le tactile. */
export interface InputState {
  /** Accélérateur 0..1 */
  gaz: number;
  /** Frein / marche arrière 0..1 */
  frein: number;
  /** Direction −1..1 (+1 = gauche) */
  direction: number;
  /** Frein à main (bouton Drift en mode Arcade) */
  freinAMain: boolean;
}

export const NO_INPUT: Readonly<InputState> = Object.freeze({ gaz: 0, frein: 0, direction: 0, freinAMain: false });
