import { DEG } from '../math/vec';
import type { AssistParams, ModeId } from './types';

export const MODE_IDS: ModeId[] = ['arcade', 'semi', 'exigeant'];

export const MODE_NOMS: Record<ModeId, string> = { arcade: 'Arcade', semi: 'Semi-arcade', exigeant: 'Exigeant' };

/** Aides par mode (spec §4.3). Valeurs de départ, réglables avec ?debug. */
export const MODES: Record<ModeId, AssistParams> = {
  arcade: {
    counterSteer: 1, counterSteerDeadzone: 3 * DEG, speedRetention: 0.7,
    arcadeDrift: true, arcadeBeta: 40 * DEG, arcadeRearGrip: 0.6, arcadePathRate: 0.9, arcadeYawAccel: 4,
  },
  semi: {
    counterSteer: 0.5, counterSteerDeadzone: 3 * DEG, speedRetention: 0.35,
    arcadeDrift: false, arcadeBeta: 0, arcadeRearGrip: 1, arcadePathRate: 0, arcadeYawAccel: 0,
  },
  exigeant: {
    counterSteer: 0, counterSteerDeadzone: 0, speedRetention: 0,
    arcadeDrift: false, arcadeBeta: 0, arcadeRearGrip: 1, arcadePathRate: 0, arcadeYawAccel: 0,
  },
};
