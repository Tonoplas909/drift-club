/** Une mise à jour du jeu, affichée dans « Nouveautés ». */
export interface NoteVersion {
  version: string;
  /** date de mise en ligne (JJ/MM/AAAA) */
  date: string;
  titre: string;
  notes: string[];
}

/**
 * Historique des mises à jour, la plus récente en premier.
 * À chaque mise en ligne : ajouter une entrée en tête avec la version de package.json (voir CLAUDE.md).
 */
export const NOTES: NoteVersion[] = [
  {
    version: '0.2.2',
    date: '30/09/2026',
    titre: 'Notes de version',
    notes: [
      'Nouveau bouton « Nouveautés » en bas à gauche des menus : l\'historique de toutes les mises à jour.',
      'Un badge signale quand une nouvelle version est sortie depuis ta dernière visite.',
    ],
  },
  {
    version: '0.2.1',
    date: '30/09/2026',
    titre: 'Nouveau décor des menus et barre de combo',
    notes: [
      'Les menus ont un fond illustré : une route de montagne au crépuscule, avec une voiture en pleine glisse.',
      'Après un drift encaissé, une barre sous les points indique le temps restant pour enchaîner avant que le combo (x2 à x5) retombe.',
      'L\'accueil est plus compact sur téléphone en paysage : le logo n\'est plus coupé.',
    ],
  },
  {
    version: '0.2.0',
    date: '30/09/2026',
    titre: 'Partage des niveaux et livrées',
    notes: [
      'Partage des niveaux : bouton « Partager » dans l\'éditeur et dans Mes niveaux, avec un lien qui contient tout le niveau, un code à copier ou un fichier .json.',
      'Onglet « Importer » : colle un lien, un code, ou charge un .json.',
      'Niveaux en ligne : publie ton niveau pour tout le monde (compte requis) et joue ceux des autres dans l\'onglet « En ligne », triés par récents ou populaires.',
      'Livrées : 4 à 5 livrées par voiture dans le Garage (bandes, bicolore, numéro de course, touge…), combinables avec la couleur.',
      'Sous chaque niveau, ta place au classement en ligne remplace le record local.',
      'Le numéro de version du jeu est affiché en bas à gauche des menus.',
      'Correctif : sur téléphone, la voiture n\'avance plus toute seule (l\'accélération automatique est désormais désactivée par défaut, activable dans les Réglages).',
    ],
  },
  {
    version: '0.1.7',
    date: '30/09/2026',
    titre: 'Classement tous modes',
    notes: [
      'Le classement d\'un niveau regroupe tous les modes de conduite ; le mode de chaque score est affiché dans le tableau.',
    ],
  },
  {
    version: '0.1.6',
    date: '30/09/2026',
    titre: 'Nouvelles règles de drift',
    notes: [
      'Un tête-à-queue ne fait plus perdre le drift en cours : seuls un choc ou un replacement le font.',
      'Au-delà de 60° d\'angle, un drift rapporte progressivement moins (0,7 à 90°, 0,4 à 120°…) au lieu d\'une coupure nette à 90°.',
    ],
  },
  {
    version: '0.1.5',
    date: '30/09/2026',
    titre: 'Jauge de vitesse plus parlante',
    notes: [
      'La jauge est pleine à la vitesse qu\'on atteint vraiment sur une courte ligne droite (≈ 107 km/h pour La Légère), plus à la vitesse max théorique.',
    ],
  },
  {
    version: '0.1.4',
    date: '30/09/2026',
    titre: 'Comptes et classement en ligne',
    notes: [
      'Crée un compte (email, mot de passe, pseudo) depuis le bouton « Compte » de l\'accueil.',
      'Bouton « Classement » sur chaque niveau : les 20 meilleurs scores, ta ligne en surbrillance.',
      'À l\'arrivée, ton score est envoyé automatiquement et ton rang s\'affiche.',
    ],
  },
  {
    version: '0.1.3',
    date: '30/09/2026',
    titre: 'Jauge de vitesse',
    notes: [
      'Une jauge verticale à côté de la voiture indique la vitesse : elle se remplit et vire du vert au rouge.',
    ],
  },
  {
    version: '0.1.2',
    date: '30/09/2026',
    titre: 'Éditeur de niveaux',
    notes: [
      'Éditeur de niveaux : dessine ta route vue de dessus, règle hauteurs et largeurs, ajoute barrières et objets, choisis le décor.',
      'Profil en long, validation en direct, annuler/rétablir et sauvegarde automatique.',
      '« Tester » lance la course tout de suite et « Retour à l\'éditeur » te ramène là où tu en étais.',
      'Mes niveaux : renommer, dupliquer, exporter, supprimer ; tes niveaux se jouent aussi depuis « Jouer ».',
      'Caméra placée plus haut : la fumée des pneus ne masque plus la route.',
      'Moteurs plus puissants pour les trois voitures (+1,05 m/s² d\'accélération chacune).',
    ],
  },
  {
    version: '0.1.1',
    date: '29/09/2026',
    titre: 'Conduite retravaillée et deux nouveaux niveaux',
    notes: [
      'Le limiteur de tête-à-queue est supprimé : on peut partir en toupie dans tous les modes, y compris en Arcade si on en fait trop.',
      'Conduite au clavier retravaillée : direction progressive, retour au centre rapide, contre-braquage vif, accélérateur lissé ; les drifts se tiennent bien plus longtemps.',
      'Deux nouveaux niveaux : Lacets du Belvédère (montée en épingles) et Vallée des Crêtes (descente rapide au coucher du soleil).',
    ],
  },
  {
    version: '0.1.0',
    date: '29/09/2026',
    titre: 'Lancement de Drift Club',
    notes: [
      'Enchaîne les drifts sur des routes de montagne et fais le plus de points avant l\'arrivée : combo jusqu\'à x5 et bonus de temps.',
      'Trois voitures (L\'Équilibrée, La Légère, La Turbo), huit couleurs et trois modes de conduite (Arcade, Semi-arcade, Exigeant).',
      'Trois niveaux : Premiers virages, Forêt des Pins et Col du Loup.',
      'Jouable au clavier et au tactile, avec sons synthétisés et records enregistrés par niveau et par mode.',
    ],
  },
];
