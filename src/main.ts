import './styles.css';
import { App } from './app';
import { DebugPanel, isDebug } from './debug/panel';
import { VERSION } from './version';

document.getElementById('version')!.textContent = VERSION;
void new App(isDebug(location.search) ? new DebugPanel() : null).start();
