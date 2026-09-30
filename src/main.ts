import './styles.css';
import { App } from './app';
import { DebugPanel, isDebug } from './debug/panel';
import { VERSION, BUILD } from './version';
import { brancherBoutonVersion } from './ui/nouveautes';

brancherBoutonVersion(document.getElementById('version')!, document.getElementById('ui')!, VERSION, BUILD);
void new App(isDebug(location.search) ? new DebugPanel() : null).start();
