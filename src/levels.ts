import premiersVirages from '../levels/premiers-virages.json';
import foretDesPins from '../levels/foret-des-pins.json';
import colDuLoup from '../levels/col-du-loup.json';
import lacetsDuBelvedere from '../levels/lacets-du-belvedere.json';
import valleDesCretes from '../levels/vallee-des-cretes.json';
import circuitDuLac from '../levels/circuit-du-lac.json';
import epinglesDuDiable from '../levels/epingles-du-diable.json';
import cretesNord from '../levels/cretes-nord.json';
import descenteDuMoulin from '../levels/descente-du-moulin.json';
import grandHuit from '../levels/grand-huit.json';

export interface NiveauOfficiel {
  id: string;
  data: unknown;
}

export const NIVEAUX_OFFICIELS: NiveauOfficiel[] = [
  { id: 'premiers-virages', data: premiersVirages },
  { id: 'foret-des-pins', data: foretDesPins },
  { id: 'col-du-loup', data: colDuLoup },
  { id: 'lacets-du-belvedere', data: lacetsDuBelvedere },
  { id: 'vallee-des-cretes', data: valleDesCretes },
  { id: 'circuit-du-lac', data: circuitDuLac },
  { id: 'epingles-du-diable', data: epinglesDuDiable },
  { id: 'cretes-nord', data: cretesNord },
  { id: 'descente-du-moulin', data: descenteDuMoulin },
  { id: 'grand-huit', data: grandHuit },
];

export const cleNiveauOfficiel = (id: string): string => `off:${id}`;
