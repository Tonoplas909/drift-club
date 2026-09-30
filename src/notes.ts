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
    version: '0.3.13',
    date: '30/09/2026',
    titre: 'Détail des points en haut de l\'écran',
    notes: [
      'Le détail des points du drift (base × vitesse moyenne × durée × angle moyen × combo) s\'affiche maintenant en haut au centre de l\'écran, entre le score et le temps.',
    ],
  },
  {
    version: '0.3.12',
    date: '30/09/2026',
    titre: 'Dix nouveaux niveaux',
    notes: [
      'Vingt niveaux au total ! Serpentin des Aigles, Angles Droits, Spirale du Belvédère, Trois Épingles, Chicanes du Port, Grande Descente, Virages en Cascade, Route des Vignes, Touge de Minuit et Tire-Bouchon.',
      'Au programme : une montée à épingles, des angles droits en ville, une double spirale, trois épingles géantes, des chicanes serrées, 2 km de descente, des virages qui se resserrent, une route facile dans les vignes, un touge nocturne et un grand tire-bouchon.',
      'La liste des niveaux défile maintenant seule : titre, onglets et boutons restent visibles, aussi sur téléphone.',
    ],
  },
  {
    version: '0.3.11',
    date: '30/09/2026',
    titre: 'Décors corrigés et un vrai lac',
    notes: [
      'Relief entièrement revu : fini les falaises verticales et les routes en crête entre les épingles (Col du Loup, Épingles du Diable…). Les talus sont réguliers et la route n\'est plus jamais enterrée.',
      'Arbres, rochers et bâtiments ne se retrouvent plus sur la route ni perchés dans les pentes.',
      'Le Circuit du Lac a enfin son lac ! Si tu tombes à l\'eau, la voiture est replacée sur la route.',
      'Éditeur : nouvel outil « Lac » pour dessiner des plans d\'eau dans tes niveaux ; ils sont conservés dans les liens, les .json et les niveaux publiés.',
    ],
  },
  {
    version: '0.3.10',
    date: '30/09/2026',
    titre: 'Affichage à la carte',
    notes: [
      'Dans les Réglages, tu peux désactiver le détail des points de drift et l\'indicateur d\'angle sous la voiture (activés par défaut).',
    ],
  },
  {
    version: '0.3.9',
    date: '30/09/2026',
    titre: 'Le détail de tes points de drift',
    notes: [
      'Pendant un drift, le calcul de tes points s\'affiche au-dessus du score : base × vitesse moyenne × durée × angle moyen (× combo). Le résultat est exactement le nombre de points affiché.',
      'Vitesse et angle sont des moyennes sur tout le drift : un libellé sous chaque valeur le rappelle.',
      'Nouvel indicateur d\'angle de glisse sous la voiture : l\'aiguille passe au vert dans la zone idéale (25 à 60°).',
    ],
  },
  {
    version: '0.3.8',
    date: '30/09/2026',
    titre: 'Nouveau son',
    notes: [
      'Tout le son du jeu est refait : moteur plus plein et plus doux, avec un creux à chaque rapport et le rebond du limiteur.',
      'Chaque voiture a sa voix : La Légère plus aiguë, La Turbo plus grave avec le sifflement du turbo et le « pschh » au lever de pied.',
      'Crissement des pneus moins strident, grondement hors piste, léger souffle du vent à haute vitesse.',
      'Nouveaux sons de décompte, d\'encaissement (qui montent avec le combo), de choc, d\'arrivée et de caisses (révélation selon la rareté).',
      'Mixage revu : plus de saturation.',
    ],
  },
  {
    version: '0.3.7',
    date: '30/09/2026',
    titre: 'Recommencer en un clic',
    notes: [
      'La touche Retour arrière (⌫) recommence le niveau depuis le début, en course, en pause ou sur l\'écran des résultats.',
    ],
  },
  {
    version: '0.3.6',
    date: '30/09/2026',
    titre: 'Livrées et clés liées à ton compte',
    notes: [
      'Connecté, tes livrées débloquées et tes clés sont enregistrées dans ton compte : tu les retrouves sur tous tes appareils.',
      'À la première connexion, la progression de cet appareil est ajoutée à ton compte (une seule fois, 30 clés au plus).',
      'Les caisses sont tirées par le serveur et les clés gagnées en fin de course sont créditées par le serveur.',
      'Sans compte, tout fonctionne comme avant, avec une progression propre à ton navigateur.',
    ],
  },
  {
    version: '0.3.5',
    date: '30/09/2026',
    titre: 'Plus de 100 livrées',
    notes: [
      'Plus de 50 nouvelles livrées, pleines de références : Livreur de tofu, Déjà vu, Eurobeat, 24 Heures, K-2000, 88 miles/h, Nyan, Stonks, Doge, Kachow, Rickroll, Tout va bien, Pas peur des fantômes, Grille néon…',
      'Quatre livrées exotiques pour les fans de courses de rue au cinéma : Dix secondes et Famille (La Turbo), Bleu nitro et Maître du drift (L\'Équilibrée).',
      'Chaque livrée a désormais une petite description, affichée dans le Garage et à l\'ouverture d\'une caisse.',
      'Les numéros de course sont redessinés : le 7 ne ressemble plus à un 1.',
    ],
  },
  {
    version: '0.3.4',
    date: '30/09/2026',
    titre: 'Décor Ville',
    notes: [
      'Nouveau décor Ville : rues bordées d\'immeubles colorés, tours vitrées au loin, lampadaires, abribus, voitures garées et arbres en bacs. Au coucher du soleil, fenêtres et lampadaires s\'allument.',
      'Les décors sont redistribués, deux niveaux par thème : Ville (Circuit du Lac, Grand Huit), Montagne (Col du Loup, Épingles du Diable), Montagne enneigée (Lacets du Belvédère, Route des Crêtes Nord), Canyon (Vallée des Crêtes, Descente du Moulin), Forêt d\'automne (Forêt des Pins, Premiers virages).',
      'Dans l\'éditeur, « Ville » est disponible dans l\'outil Décor.',
      'Nouvelle icône d\'onglet : une petite voiture en drift.',
    ],
  },
  {
    version: '0.3.3',
    date: '30/09/2026',
    titre: 'Des décors variés sur les niveaux officiels',
    notes: [
      'Montagne enneigée : Lacets du Belvédère et Route des Crêtes Nord.',
      'Canyon : Vallée des Crêtes et Grand Huit.',
      'Forêt d\'automne : Forêt des Pins, Circuit du Lac et Descente du Moulin.',
      'Premiers virages, Col du Loup et Épingles du Diable restent en montagne.',
      'Le thème est indiqué sous chaque niveau. Tes records et le classement en ligne sont conservés.',
    ],
  },
  {
    version: '0.3.2',
    date: '30/09/2026',
    titre: 'Thèmes de décor',
    notes: [
      'Trois nouveaux décors en plus de la montagne : Montagne enneigée (sapins enneigés, flocons, jalons rouge et blanc), Canyon (cactus, falaises rouges, mesas) et Forêt d\'automne (feuillages orange, jaunes et rouges).',
      'Chaque thème existe de jour et au coucher du soleil.',
      'Dans l\'éditeur, l\'outil Décor permet maintenant de choisir le thème de ton niveau ; il est conservé dans les liens, les .json et les niveaux publiés en ligne.',
    ],
  },
  {
    version: '0.3.1',
    date: '30/09/2026',
    titre: 'Cinq nouveaux niveaux',
    notes: [
      'Circuit du Lac : grandes courbes rapides et route large autour d\'un lac, idéal pour débuter.',
      'Épingles du Diable : 8 épingles très serrées sur une paroi raide, plus de 120 m de montée. Le plus difficile !',
      'Route des Crêtes Nord : près de 2 km de crête, longues courbes rapides et trois épingles.',
      'Descente du Moulin : une descente technique enchaînant les chicanes.',
      'Grand Huit : un long serpent de virages gauche-droite pour enchaîner les drifts.',
    ],
  },
  {
    version: '0.3.0',
    date: '30/09/2026',
    titre: 'Caisses et 48 livrées',
    notes: [
      '16 livrées par voiture (48 en tout) : damier, flammes, éclairs, camouflage, pois, taxi, carbone… et des livrées à couleur imposée comme Or massif, Chrome ou Noir et or.',
      'Chaque livrée a une rareté : Commune, Rare, Épique, Légendaire ou Exotique.',
      'Nouveau : les caisses ! Ouvre-en une (3 clés) pour gagner une livrée au hasard, avec la roulette qui défile et ralentit jusqu\'au gain. Les chances sont affichées à l\'écran.',
      'Gagne des clés en jouant : 1 par course terminée, +1 en cas de nouveau record. Une livrée déjà obtenue rend 1 clé.',
      'Une caisse offerte (3 clés) pour commencer. Les livrées que tu avais déjà choisies restent débloquées.',
      'Dans le Garage, les livrées verrouillées portent un cadenas mais se prévisualisent.',
    ],
  },
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
