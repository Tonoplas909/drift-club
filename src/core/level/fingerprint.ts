import type { Level } from './types';

/** Calcule l'empreinte SHA-256 d'un niveau (sans nom ni auteur). */
export async function empreinteNiveau(level: Level): Promise<string> {
  // Crée un objet canonique sans nom ni auteur
  const canonical = {
    format: level.format,
    environnement: level.environnement,
    ambiance: level.ambiance,
    route: level.route,
    barrieres: level.barrieres,
    decor: level.decor,
    objets: level.objets,
    // les lacs n'entrent dans l'empreinte que s'il y en a : les niveaux sans eau gardent leur empreinte d'avant
    ...(level.eau && level.eau.length > 0
      ? { eau: level.eau.map((l) => ({ niveau: l.niveau, points: l.points.map((p) => ({ x: p.x, z: p.z })) })) }
      : {}),
    // de même pour les zones de clipping
    ...(level.clipping && level.clipping.length > 0 ? { clipping: level.clipping.map((z) => ({ de: z.de, a: z.a, cote: z.cote })) } : {}),
    // et pour la météo
    ...(level.meteo ? { meteo: level.meteo } : {}),
  };

  // Sérialise en JSON canonique (clés fixes, minifié)
  const json = JSON.stringify(canonical);

  // Calcule SHA-256
  const encoder = new TextEncoder();
  const data = encoder.encode(json);
  const hashBuffer = await globalThis.crypto.subtle.digest('SHA-256', data);

  // Convertit en hex
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');

  return hashHex;
}
