export function formatScore(n: number): string {
  return Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}

export function formatTime(s: number): string {
  const cs = Math.round(Math.max(0, s) * 100);
  const m = Math.floor(cs / 6000);
  const rest = cs - m * 6000;
  const sec = Math.floor(rest / 100);
  const c = rest % 100;
  return `${m}:${String(sec).padStart(2, '0')}.${String(c).padStart(2, '0')}`;
}

export function formatDistance(m: number): string {
  return m >= 1000 ? `${(m / 1000).toFixed(1).replace('.', ',')} km` : `${Math.round(m)} m`;
}

/** Nom du niveau rappelé à l'arrivée : « Niveau 3 · Col du Loup » pour un niveau officiel (`index` ≥ 0), sinon son nom seul. */
export function titreNiveau(index: number, nom: string): string {
  return index >= 0 ? `Niveau ${index + 1} · ${nom}` : nom;
}
