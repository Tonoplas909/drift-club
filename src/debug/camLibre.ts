/** Caméra libre (développement, sous `?debug`) : `?cam=x,y,z,tx,ty,tz` place la caméra en (x, y, z) regardant (tx, ty, tz). */
export interface CamLibre { pos: [number, number, number]; cible: [number, number, number]; /** champ de vision (degrés), sinon celui de la poursuite */ fov?: number }

export function camDepuisUrl(search: string): CamLibre | null {
  const q = new URLSearchParams(search);
  if (!q.has('debug')) return null;
  const v = q.get('cam');
  if (!v) return null;
  const n = v.split(',').map(Number);
  if (n.length !== 6 || n.some((x) => !Number.isFinite(x))) return null;
  return { pos: [n[0], n[1], n[2]], cible: [n[3], n[4], n[5]] };
}
