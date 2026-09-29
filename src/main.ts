import './styles.css';
import { App } from './app';
import { DebugPanel, isDebug } from './debug/panel';

void new App(isDebug(location.search) ? new DebugPanel() : null).start();
