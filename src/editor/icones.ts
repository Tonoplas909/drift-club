const PATHS: Record<string, string> = {
  route: '<path d="M4 20c7 0 2-8 8-8s2-8 8-8"/><circle cx="4" cy="20" r="2" fill="currentColor"/><circle cx="20" cy="4" r="2" fill="currentColor"/>',
  barrieres: '<path d="M3 9h18M3 15h18M6 5v14M18 5v14"/>',
  clipping: '<path d="M4 20 20 4M4 14l10-10M10 20l10-10" /><path d="M3 21h18" stroke-dasharray="2 2"/>',
  objets: '<circle cx="12" cy="9" r="5.5"/><path d="M12 14.5V21M9 21h6"/>',
  lac: '<path d="M4 8c3-2 5 2 8 0s5-2 8 0M4 13c3-2 5 2 8 0s5-2 8 0M4 18c3-2 5 2 8 0s5-2 8 0"/>',
  decor: '<path d="M2.5 20 9 9l4 6 3-4 5.5 9z"/><circle cx="17" cy="5.5" r="2.5"/>',
  infos: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6"/><circle cx="12" cy="7.6" r=".8" fill="currentColor"/>',
  annuler: '<path d="M9 6 4 11l5 5M4 11h9a6 6 0 0 1 0 9h-3"/>',
  retablir: '<path d="m15 6 5 5-5 5M20 11h-9a6 6 0 0 0 0 9h3"/>',
  recentrer: '<path d="M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5"/><circle cx="12" cy="12" r="2.5"/>',
  jouer: '<path d="M7 4.5v15l13-7.5z" fill="currentColor"/>',
  retour: '<path d="m15 5-7 7 7 7"/>',
  corbeille: '<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/>',
  gauche: '<path d="M20 12a8 8 0 1 1-3-6.2M20 4v5h-5" transform="scale(-1 1) translate(-24 0)"/>',
  droite: '<path d="M20 12a8 8 0 1 1-3-6.2M20 4v5h-5"/>',
  partager: '<circle cx="18" cy="5.5" r="2.6"/><circle cx="6" cy="12" r="2.6"/><circle cx="18" cy="18.5" r="2.6"/><path d="m8.3 10.8 7.4-4M8.3 13.2l7.4 4"/>',
  profil: '<path d="M3 17l5-6 4 3 5-8 4 5"/><path d="M3 21h18"/>',
};

/** Petite icône SVG (trait, couleur du texte). */
export function icone(nom: string): SVGSVGElement {
  const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  s.setAttribute('viewBox', '0 0 24 24');
  s.setAttribute('class', 'ico');
  s.setAttribute('aria-hidden', 'true');
  s.setAttribute('fill', 'none');
  s.setAttribute('stroke', 'currentColor');
  s.setAttribute('stroke-width', '2.4');
  s.setAttribute('stroke-linecap', 'round');
  s.setAttribute('stroke-linejoin', 'round');
  s.innerHTML = PATHS[nom] ?? '';
  return s;
}
