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
import serpentinDesAigles from '../levels/serpentin-des-aigles.json';
import anglesDroits from '../levels/angles-droits.json';
import spiraleDuBelvedere from '../levels/spirale-du-belvedere.json';
import troisEpingles from '../levels/trois-epingles.json';
import chicanesDuPort from '../levels/chicanes-du-port.json';
import grandeDescente from '../levels/grande-descente.json';
import viragesEnCascade from '../levels/virages-en-cascade.json';
import routeDesVignes from '../levels/route-des-vignes.json';
import tougeDeMinuit from '../levels/touge-de-minuit.json';
import tireBouchon from '../levels/tire-bouchon.json';

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
  { id: 'serpentin-des-aigles', data: serpentinDesAigles },
  { id: 'angles-droits', data: anglesDroits },
  { id: 'spirale-du-belvedere', data: spiraleDuBelvedere },
  { id: 'trois-epingles', data: troisEpingles },
  { id: 'chicanes-du-port', data: chicanesDuPort },
  { id: 'grande-descente', data: grandeDescente },
  { id: 'virages-en-cascade', data: viragesEnCascade },
  { id: 'route-des-vignes', data: routeDesVignes },
  { id: 'touge-de-minuit', data: tougeDeMinuit },
  { id: 'tire-bouchon', data: tireBouchon },
];

export const cleNiveauOfficiel = (id: string): string => `off:${id}`;
