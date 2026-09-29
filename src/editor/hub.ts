import type { Screens } from '../ui/screens';
import { h } from '../ui/screens';
import { dialogue } from '../ui/dialog';
import { formatDistance } from '../ui/format';
import type { Level } from '../core/level/types';
import { LIMITES } from '../core/level/types';
import { loadLevel } from '../core/loadLevel';
import { validateLevel } from '../core/level/validate';
import { analyseLevel } from '../core/editor/analyse';
import { newLevel, copyLevel } from '../core/editor/ops';
import type { Store, MonNiveau } from '../storage/store';
import { NIVEAUX_OFFICIELS } from '../levels';
import { dateCourte, jsonLisible, nomFichier, longueurRoute } from './format';
import { icone } from './icones';

export interface OptionsHub {
  store: Store;
  persistent: boolean;
  root: HTMLElement;
  onModifier(n: MonNiveau): void;
  onJouer(n: MonNiveau): void;
  onRetour(): void;
}

/** « Nom (copie) » sans dépasser la longueur maximale du nom. */
export function nomCopie(nom: string): string {
  const suffixe = ' (copie)';
  return nom.slice(0, LIMITES.nomMax - suffixe.length).trimEnd() + suffixe;
}

/** Télécharge un niveau au format lisible (§5.1). */
export function telecharger(level: Level): void {
  const url = URL.createObjectURL(new Blob([jsonLisible(level)], { type: 'application/json' }));
  const a = h('a', { href: url, download: nomFichier(level.nom) });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Écran « Mes niveaux » : liste, création, copie d'un officiel, import et export. */
export function afficherHub(screens: Screens, o: OptionsHub): void {
  const { store } = o;
  const ajouter = (level: Level): MonNiveau => {
    const n: MonNiveau = { id: store.nouvelId(), level, maj: new Date().toISOString() };
    store.saveNiveau(n);
    return n;
  };

  const importer = async (fichier: File): Promise<void> => {
    let raw: unknown;
    try { raw = JSON.parse(await fichier.text()); }
    catch { await dialogue(o.root, { titre: 'Import impossible', lignes: ["Ce fichier n'est pas un JSON valide."], annuler: null }); return; }
    const r = loadLevel(raw);
    if (!r.ok) { await dialogue(o.root, { titre: 'Niveau refusé', lignes: r.erreurs, annuler: null }); return; }
    ajouter(r.level);
    render();
  };

  const copierOfficiel = async (): Promise<void> => {
    const choix = NIVEAUX_OFFICIELS.flatMap((n) => {
      const v = validateLevel(n.data);
      return v.ok ? [{ label: v.level.nom, detail: `${formatDistance(longueurRoute(v.level))} · ${v.level.ambiance === 'jour' ? 'Jour' : 'Coucher de soleil'}`, valeur: n.id }] : [];
    });
    const r = await dialogue(o.root, { titre: 'Copier un niveau officiel', choix, ok: '' });
    if (!r.ok || !r.choix) return;
    const off = NIVEAUX_OFFICIELS.find((n) => n.id === r.choix);
    const v = off && validateLevel(off.data);
    if (!v || !v.ok) return;
    o.onModifier(ajouter(copyLevel(v.level, nomCopie(v.level.nom))));
  };

  const fichier = h('input', { type: 'file', accept: '.json,application/json', class: 'cache' });
  fichier.addEventListener('change', () => { const f = fichier.files?.[0]; fichier.value = ''; if (f) void importer(f); });

  const ligne = (n: MonNiveau): HTMLElement => {
    const a = analyseLevel(n.level);
    const raison = a.ok ? '' : (a.erreurs[0] ?? a.problemes[0]?.message ?? 'Niveau invalide.');
    const btn = (icon: string, label: string, f: () => void, off = ''): HTMLElement =>
      h('button', { class: 'btn sec sm' + (off ? ' off' : ''), title: off || label, onclick: off ? () => void dialogue(o.root, { titre: label, lignes: [off], annuler: null }) : f }, icone(icon), label);
    return h('div', { class: 'niv' },
      h('div', { class: 'niv-info' },
        h('b', {}, n.level.nom),
        h('small', {}, [formatDistance(longueurRoute(n.level)), a.ok ? '' : '⚠ à corriger', dateCourte(n.maj), n.level.auteur && `par ${n.level.auteur}`].filter(Boolean).join(' · '))),
      h('div', { class: 'niv-actions' },
        btn('route', 'Modifier', () => o.onModifier(n)),
        btn('jouer', 'Jouer', () => o.onJouer(n), a.ok ? '' : `Niveau à corriger : ${raison}`),
        btn('infos', 'Renommer', () => void renommer(n)),
        btn('objets', 'Dupliquer', () => { ajouter(copyLevel(n.level, nomCopie(n.level.nom))); render(); }),
        btn('profil', 'Exporter', () => telecharger(n.level), a.ok ? '' : `Niveau à corriger : ${raison}`),
        btn('corbeille', 'Supprimer', () => void supprimer(n)),
      ));
  };

  const renommer = async (n: MonNiveau): Promise<void> => {
    const r = await dialogue(o.root, { titre: 'Renommer le niveau', champ: { valeur: n.level.nom, max: LIMITES.nomMax, label: `Nom (1–${LIMITES.nomMax} caractères)` }, ok: 'Renommer' });
    const nom = r.texte.trim();
    if (!r.ok) return;
    if (nom.length < 1) { await dialogue(o.root, { titre: 'Nom invalide', lignes: [`Le nom doit faire de 1 à ${LIMITES.nomMax} caractères.`], annuler: null }); return; }
    store.saveNiveau({ ...n, level: { ...n.level, nom }, maj: new Date().toISOString() });
    render();
  };

  const supprimer = async (n: MonNiveau): Promise<void> => {
    const r = await dialogue(o.root, { titre: 'Supprimer ce niveau ?', lignes: [`« ${n.level.nom} » sera supprimé définitivement.`], ok: 'Supprimer' });
    if (!r.ok) return;
    store.deleteNiveau(n.id);
    render();
  };

  const render = (): void => {
    const niveaux = store.listNiveaux();
    screens.monter(h('div', { class: 'screen' }, h('div', { class: 'panel wide hub' },
      h('h2', {}, 'Mes niveaux'),
      h('div', { class: 'row' },
        h('button', { class: 'btn', onclick: () => o.onModifier(ajouter(newLevel())) }, 'Nouveau niveau'),
        h('button', { class: 'btn sec', onclick: () => void copierOfficiel() }, 'Copier un niveau officiel'),
        h('button', { class: 'btn sec', onclick: () => fichier.click() }, 'Importer un .json'),
      ),
      !o.persistent && h('p', { class: 'warn' }, 'Stockage indisponible : tes niveaux ne seront pas conservés après fermeture.'),
      niveaux.length === 0
        ? h('p', { class: 'sub' }, "Aucun niveau pour l'instant : crée-en un, copie un niveau officiel ou importe un fichier.")
        : h('div', { class: 'niv-liste' }, ...niveaux.map(ligne)),
      h('div', { class: 'row' }, h('button', { class: 'btn sec', onclick: o.onRetour }, 'Retour')),
      fichier,
    )));
  };
  render();
}
