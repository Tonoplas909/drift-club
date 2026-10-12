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
import sentierDesCerisiers from '../levels/sentier-des-cerisiers.json';
import colDuTorii from '../levels/col-du-torii.json';
import dragonDeJade from '../levels/dragon-de-jade.json';
import baieDesNaufrages from '../levels/baie-des-naufrages.json';
import criqueDuPerroquet from '../levels/crique-du-perroquet.json';
import recifDuKraken from '../levels/recif-du-kraken.json';
import orbiteBasse from '../levels/orbite-basse.json';
import cratereRouge from '../levels/cratere-rouge.json';
import couloirsJaunes from '../levels/couloirs-jaunes.json';
import labyrintheDeNeons from '../levels/labyrinthe-de-neons.json';
import neoShinjuku from '../levels/neo-shinjuku.json';
import mirageDeMidi from '../levels/mirage-de-midi.json';
import boulevardEcarlate from '../levels/boulevard-ecarlate.json';
import nuitPolaire from '../levels/nuit-polaire.json';
import colSousLAverse from '../levels/col-sous-l-averse.json';
import fortDesCorsaires from '../levels/fort-des-corsaires.json';
import vendangesTardives from '../levels/vendanges-tardives.json';
import sousBoisMouille from '../levels/sous-bois-mouille.json';
import echangeurDuPeriph from '../levels/echangeur-du-periph.json';
import echangeurHolographique from '../levels/echangeur-holographique.json';
import viaducDesChamois from '../levels/viaduc-des-chamois.json';
import canyonDuScorpion from '../levels/canyon-du-scorpion.json';
import belvedereOrageux from '../levels/belvedere-orageux.json';
import anneauxDeSaturne from '../levels/anneaux-de-saturne.json';
import stationDesCimes from '../levels/station-des-cimes.json';
import sousSolSansFin from '../levels/sous-sol-sans-fin.json';
import ileDeLaTortue from '../levels/ile-de-la-tortue.json';
import pluieSousLesNeons from '../levels/pluie-sous-les-neons.json';
import colDeLaBonette from '../levels/col-de-la-bonette.json';
import irohazaka from '../levels/irohazaka.json';

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
  { id: 'sentier-des-cerisiers', data: sentierDesCerisiers },
  { id: 'col-du-torii', data: colDuTorii },
  { id: 'dragon-de-jade', data: dragonDeJade },
  { id: 'baie-des-naufrages', data: baieDesNaufrages },
  { id: 'crique-du-perroquet', data: criqueDuPerroquet },
  { id: 'recif-du-kraken', data: recifDuKraken },
  { id: 'orbite-basse', data: orbiteBasse },
  { id: 'cratere-rouge', data: cratereRouge },
  { id: 'couloirs-jaunes', data: couloirsJaunes },
  { id: 'labyrinthe-de-neons', data: labyrintheDeNeons },
  { id: 'neo-shinjuku', data: neoShinjuku },
  { id: 'mirage-de-midi', data: mirageDeMidi },
  { id: 'boulevard-ecarlate', data: boulevardEcarlate },
  { id: 'nuit-polaire', data: nuitPolaire },
  { id: 'col-sous-l-averse', data: colSousLAverse },
  { id: 'fort-des-corsaires', data: fortDesCorsaires },
  { id: 'vendanges-tardives', data: vendangesTardives },
  { id: 'sous-bois-mouille', data: sousBoisMouille },
  { id: 'echangeur-du-periph', data: echangeurDuPeriph },
  { id: 'echangeur-holographique', data: echangeurHolographique },
  { id: 'viaduc-des-chamois', data: viaducDesChamois },
  { id: 'canyon-du-scorpion', data: canyonDuScorpion },
  { id: 'belvedere-orageux', data: belvedereOrageux },
  { id: 'anneaux-de-saturne', data: anneauxDeSaturne },
  { id: 'station-des-cimes', data: stationDesCimes },
  { id: 'sous-sol-sans-fin', data: sousSolSansFin },
  { id: 'ile-de-la-tortue', data: ileDeLaTortue },
  { id: 'pluie-sous-les-neons', data: pluieSousLesNeons },
  { id: 'col-de-la-bonette', data: colDeLaBonette },
  { id: 'irohazaka', data: irohazaka },
];

export const cleNiveauOfficiel = (id: string): string => `off:${id}`;
