import { h } from './screens';

/**
 * Enregistre une image : partage du téléphone (`navigator.share`) si `partager` et si le navigateur sait partager un
 * fichier, sinon téléchargement. Renvoie le message à afficher (null si le joueur a annulé le partage).
 */
export async function enregistrerImage(blob: Blob, nom: string, partager: boolean, titre = 'Drift Club'): Promise<string | null> {
  if (partager && typeof File !== 'undefined') {
    const fichier = new File([blob], nom, { type: blob.type || 'image/png' });
    if (navigator.canShare?.({ files: [fichier] })) {
      try {
        await navigator.share({ files: [fichier], title: titre });
        return null;
      } catch (e) {
        // partage annulé par le joueur : rien d'autre à faire
        if (e instanceof DOMException && e.name === 'AbortError') return null;
      }
    }
  }
  const url = URL.createObjectURL(blob);
  const a = h('a', { href: url, download: nom });
  document.body.append(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
  return 'Image enregistrée';
}
