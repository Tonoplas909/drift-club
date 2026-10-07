/**
 * Tout ce qui décide du résultat d'une course rejouée : simulation, niveaux officiels, préparation des niveaux.
 * L'empreinte de version (`EMPREINTE_SIMULATION`) est calculée sur ce seul module (voir tools/fonction.ts) :
 * changer la façon dont la fonction traite les requêtes (course.ts) ne demande pas de republier le jeu.
 */
export { NIVEAUX_OFFICIELS } from '../levels';
export { prepareLevel } from '../game/prepare';
export { empreinteNiveau } from '../core/level/fingerprint';
export { CAR_IDS } from '../core/physics/cars';
export { MODE_IDS } from '../core/physics/assists';
export { depuisBase64, decompresserReplay } from '../core/replay/replay';
export { verifierCourse, PAS_MAX } from '../core/replay/verifier';
export { defiDuJour, estJourValide } from '../core/defi';
