import './styles.css';
import { App } from './app';
import { DebugPanel, isDebug } from './debug/panel';
import { VERSION, BUILD } from './version';

const version = document.getElementById('version')!;
version.textContent = VERSION;
version.title = BUILD;
void new App(isDebug(location.search) ? new DebugPanel() : null).start();
