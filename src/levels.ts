import premiersVirages from '../levels/premiers-virages.json';
import foretDesPins from '../levels/foret-des-pins.json';
import colDuLoup from '../levels/col-du-loup.json';

export interface NiveauOfficiel {
  id: string;
  data: unknown;
}

export const NIVEAUX_OFFICIELS: NiveauOfficiel[] = [
  { id: 'premiers-virages', data: premiersVirages },
  { id: 'foret-des-pins', data: foretDesPins },
  { id: 'col-du-loup', data: colDuLoup },
];

export const cleNiveauOfficiel = (id: string): string => `off:${id}`;
