import { defiDuJour } from '../src/core/defi';
import { prepareLevel } from '../src/game/prepare';
import { analyseLevel } from '../src/core/editor/analyse';
const t0 = Date.now();
const envs: Record<string, number> = {};
let pb = 0;
for (let i = 0; i < 365; i++) {
  const d = new Date(Date.UTC(2026, 9, 7 + i)).toISOString().slice(0, 10);
  const f = defiDuJour(d);
  envs[f.level.environnement] = (envs[f.level.environnement] ?? 0) + 1;
  const r = prepareLevel('x', f.level);
  const a = analyseLevel(f.level);
  if (!r.ok || !a.ok || a.problemes.length) { pb++; if (pb < 6) console.log(d, r.ok, a.ok, a.ok ? a.problemes.map((p) => p.message).slice(0, 2) : a.erreurs.slice(0, 2)); }
  if (i < 3) console.log(d, f.level.nom, f.level.environnement, f.level.ambiance, f.level.meteo ?? '', f.voiture, f.level.route.length, f.level.clipping?.length, f.level.barrieres.length, r.ok && Math.round(r.prepared.track.length));
}
console.log('problèmes', pb, envs, (Date.now() - t0) / 365, 'ms/défi');
