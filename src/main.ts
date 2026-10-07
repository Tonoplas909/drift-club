import './styles.css';
import { App } from './app';
import { DebugPanel, isDebug } from './debug/panel';
import { VERSION, BUILD } from './version';
import { brancherBoutonVersion } from './ui/nouveautes';

brancherBoutonVersion(document.getElementById('version')!, document.getElementById('ui')!, VERSION, BUILD);
const debug = isDebug(location.search);
const app = new App(debug ? new DebugPanel() : null);
// ?debug : l'application est accessible depuis la console (essais, captures d'écran automatiques)
if (debug) (window as unknown as { app: App }).app = app;
void app.start();
