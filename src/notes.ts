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
    version: '0.5.19',
    date: '07/10/2026',
    titre: 'Statistiques sur ton compte',
    notes: [
      'Connecté, tes statistiques de pilote suivent ton compte : elles s\'additionnent d\'un appareil à l\'autre et ne se perdent plus en changeant de navigateur.',
      'La première fois, ce que tu avais déjà roulé sur cet appareil est versé sur ton compte.',
    ],
  },
  {
    version: '0.5.18',
    date: '07/10/2026',
    titre: 'Votes dans l\'Atelier',
    notes: [
      'Nouvel onglet « Votes » dans l\'Atelier : regarde les livrées proposées par les autres joueurs et donne ton avis (j\'aime / j\'aime pas). Un vote par livrée, et pas sur les tiennes.',
      'Les livrées les plus aimées passent en premier pour la validation, et la plus aimée de la semaine est mise en avant sur l\'écran des caisses.',
    ],
  },
  {
    version: '0.5.17',
    date: '07/10/2026',
    titre: 'Défi du jour',
    notes: [
      'Nouveau : le Défi du jour, depuis l\'accueil. Chaque jour à minuit, un nouveau niveau : un décor, une ambiance, parfois la pluie, des zones de clipping, et une voiture imposée pour tout le monde.',
      'Le classement du jour est vérifié par le serveur comme les autres. Le podium est récompensé : 5 clés au 1er, 3 au 2e, 2 au 3e, à récupérer le lendemain en revenant sur le défi.',
      'L\'écran montre aussi les vainqueurs des derniers défis.',
    ],
  },
  {
    version: '0.5.16',
    date: '07/10/2026',
    titre: 'Pluie et nuit',
    notes: [
      'Nouvelle ambiance « Nuit » : ciel étoilé et lune, tes phares éclairent la route, fenêtres et lampadaires allumés en ville et au Japon. Le Touge de Minuit se court enfin… à minuit.',
      'Nouvelle météo « Pluie » : ciel gris, route mouillée, embruns, et surtout 20 % d\'adhérence en moins : le drift se déclenche plus tôt et se rattrape plus tard.',
      'Les deux se choisissent dans l\'éditeur (Décor › Ambiance et Météo).',
    ],
  },
  {
    version: '0.5.15',
    date: '07/10/2026',
    titre: 'Zones de clipping',
    notes: [
      'Nouveau : les zones de clipping, comme chez les juges de drift. Des bandes hachurées jaunes et noires marquent certains bords de route, à l\'extérieur des grands virages.',
      'Frôle le bord dans la zone en glisse : plus tu passes près, plus le drift rapporte, jusqu\'à deux fois plus au ras du bord. Le facteur « clipping » s\'affiche avec le détail des points.',
      'Tous les niveaux officiels en ont, et l\'éditeur a un outil « Clipping » pour en poser sur tes routes. Les records déjà établis sont gardés.',
      'Les messages en course (caméra choisie, fantôme) s\'affichent enfin : ils n\'apparaissaient qu\'en mode Zen.',
    ],
  },
  {
    version: '0.5.14',
    date: '07/10/2026',
    titre: 'Fantôme de ton record',
    notes: [
      'Bats-toi contre toi-même : sur un niveau où tu as un record, une voiture translucide refait ta meilleure course en même temps que toi.',
      'Un fantôme par niveau et par mode de conduite, gardé sur ton appareil ; un nouveau record le remplace. Il se coupe dans les Réglages.',
    ],
  },
  {
    version: '0.5.13',
    date: '07/10/2026',
    titre: 'Revoir sa course',
    notes: [
      'À l\'arrivée, « Revoir » rejoue ta course comme à la télé : caméras au bord de la route qui zooment sur ta voiture, hélicoptère, poursuite ou caméra embarquée.',
      'Ralenti (×¼, ×½) ou accéléré (×2, ×4), barre de temps, ±5 s (flèches ← →), Espace pour la pause, C pour changer de caméra.',
      'Mets en pause et ouvre le mode photo pour immortaliser ton plus beau drift.',
    ],
  },
  {
    version: '0.5.12',
    date: '07/10/2026',
    titre: 'Caméras embarquées',
    notes: [
      'Cinq nouvelles caméras, à faire défiler avec la touche C (ou Y / Triangle) : capot, calandre au ras du pare-chocs, conducteur (planche de bord et volant qui tourne avec toi), roue arrière pour voir le pneu fumer, et toit.',
      'La caméra choisie est retenue, et se choisit aussi dans les Réglages.',
    ],
  },
  {
    version: '0.5.11',
    date: '07/10/2026',
    titre: 'Statistiques du pilote',
    notes: [
      'Nouvel écran Statistiques depuis l\'accueil : kilomètres parcourus (dont en mode Zen), temps passé en glisse, plus long drift, meilleur drift, courses finies, voiture la plus jouée et tes médailles.',
      'Tout est compté sur ton appareil, à partir de maintenant.',
    ],
  },
  {
    version: '0.5.10',
    date: '07/10/2026',
    titre: 'Carte de score à partager',
    notes: [
      'À l\'arrivée, le bouton « Partager » crée une image de ta course : ta voiture sur la ligne d\'arrivée, avec le niveau, ton score, ta médaille, ton meilleur drift, ton temps, ta voiture et l\'adresse du jeu.',
      'Sur téléphone, elle se partage directement ; sur ordinateur, elle s\'enregistre.',
    ],
  },
  {
    version: '0.5.9',
    date: '07/10/2026',
    titre: 'Touches personnalisables',
    notes: [
      'Change tes touches dans Réglages › Touches : clique sur une commande puis appuie sur la touche voulue. Tu peux mettre deux touches par commande.',
      'Les boutons de la manette se changent aussi : gâchettes, frein à main, replacer, caméra, pause, recommencer.',
      'Échap met toujours en pause. Le rappel des touches de l\'accueil suit tes choix.',
    ],
  },
  {
    version: '0.5.8',
    date: '07/10/2026',
    titre: 'Vibrations de la manette',
    notes: [
      'La manette vibre : une petite impulsion quand un drift est encaissé (plus forte avec le combo), une secousse aux chocs et un grondement léger hors piste. Ça marche dans Chrome et Edge.',
      'Les vibrations se coupent dans Réglages › Manette.',
    ],
  },
  {
    version: '0.5.7',
    date: '07/10/2026',
    titre: 'Médailles',
    notes: [
      'Chaque niveau officiel a ses médailles de bronze, d\'argent et d\'or. L\'or demande une course digne du haut du classement.',
      'À l\'arrivée, tu vois la médaille gagnée et les points qui manquent pour la suivante. Ta meilleure médaille s\'affiche sur la liste des niveaux, tous modes confondus.',
    ],
  },
  {
    version: '0.5.6',
    date: '07/10/2026',
    titre: 'Le niveau rappelé à l\'arrivée',
    notes: [
      'L\'écran d\'arrivée rappelle le niveau que tu viens de finir : son numéro et son nom (par exemple « Niveau 3 · Col du Loup »), ou seulement son nom pour un niveau de l\'éditeur.',
    ],
  },
  {
    version: '0.5.5',
    date: '06/10/2026',
    titre: 'Bonus de temps adouci',
    notes: [
      'Le bonus de temps était beaucoup trop fort : il passe à 1 000 points par seconde d\'avance sur une fois et demie le temps cible (au lieu de 2 500 points sur le double).',
      'Il ne dépasse plus la moitié de tes points de drift : le drift reste l\'essentiel du score.',
    ],
  },
  {
    version: '0.5.4',
    date: '06/10/2026',
    titre: 'Le bonus de temps compte enfin',
    notes: [
      'Le bonus de temps valait toujours 0 : le temps cible était impossible à battre. Il est maintenant calé sur une course rapide et propre.',
      'Nouveau barème : 2 500 points par seconde d\'avance sur le double du temps cible. Chaque seconde passée à traîner coûte donc 2 500 points.',
      'Le bonus ne peut pas dépasser tes points de drift : rouler vite sans glisser ne suffit pas.',
    ],
  },
  {
    version: '0.5.3',
    date: '06/10/2026',
    titre: 'Manette, mode photo et ambiances sonores',
    notes: [
      'Joue à la manette (Xbox, PlayStation…) : gâchettes pour accélérer et freiner en douceur, stick gauche pour tourner, A / Croix pour le frein à main, B / Rond pour replacer, Y / Triangle pour la caméra, Start pour la pause. Zone morte du stick et sensibilité de la direction dans les Réglages.',
      'Nouveau mode photo, depuis la pause : tourne autour de ta voiture, zoome, choisis un filtre (noir et blanc, grain, vignette) et enregistre la photo, ou partage-la depuis ton téléphone.',
      'Chaque décor a son ambiance sonore : vent et oiseaux en montagne, vent glacé dans la neige, cigales au Japon, vagues et mouettes chez les pirates, néons qui grésillent dans les Backrooms, ville et pluie en Cyberpunk… En mode Zen, elle change avec la région. Se coupe dans les Réglages.',
    ],
  },
  {
    version: '0.5.2',
    date: '06/10/2026',
    titre: 'Correctifs : arrivée et Garage',
    notes: [
      'L\'arrivée compte dès que tu passes la ligne, même en glisse sur le bas-côté : ton combo est encaissé, et ce qui se passe après la ligne (un arbre touché…) ne l\'annule plus.',
      'Au Garage, choisir une livrée, une couleur ou une fumée ne fait plus remonter la liste tout en haut.',
    ],
  },
  {
    version: '0.5.1',
    date: '06/10/2026',
    titre: 'Menu animé et Garage interactif',
    notes: [
      'Nouveau fond du menu principal : ta voiture (couleur, livrée et fumée choisies au Garage) enchaîne les drifts sur une ligne droite sans fin.',
      'Au Garage et dans l\'Atelier, fais glisser pour tourner la voiture comme tu veux, et utilise la molette ou le pincement pour zoomer. Elle ne tourne plus toute seule.',
      'Au Garage, les roues arrière patinent pour montrer la fumée équipée ; touche une fumée verrouillée pour la voir avant de la gagner.',
      'Une fumée gagnée dans une caisse s\'affiche sur ta voiture.',
    ],
  },
  {
    version: '0.5.0',
    date: '06/10/2026',
    titre: 'L\'Atelier et de nouveaux décors',
    notes: [
      'Nouveau : l\'Atelier, dans le Garage. Crée ta propre livrée avec 30 motifs (bandes, flammes, damier, numéro de course, camouflage, circuit imprimé…), règle couleurs, tailles et positions, et vois le résultat en 3D en direct.',
      'Propose ta livrée : si elle est validée, elle entre dans les caisses de tous les joueurs, avec ton pseudo dans sa description. Tu la reçois aussitôt, avec 5 clés en cadeau.',
      'Suis tes propositions dans « Mes propositions » : en attente, validée (avec sa rareté) ou refusée.',
      'Backrooms revisitées : la route passe dans un long couloir sous un faux plafond à néons, avec des ouvertures dans les murs sur un labyrinthe de pièces vides.',
      'Japon revisité : des villages de maisons traditionnelles, des rues commerçantes avec échoppes, lanternes rouges et enseignes verticales, des poteaux électriques et des distributeurs de boissons au bord de la route.',
      'Nouveau décor Cyberpunk : une mégapole de nuit, tours couvertes d\'écrans, néons magenta et cyan, hologrammes au-dessus de la route, échoppes de ramen et pluie fine. Disponible dans l\'éditeur et en mode Zen.',
      'Nouveau niveau : Néo-Shinjuku, à travers la ville cyberpunk.',
    ],
  },
  {
    version: '0.4.12',
    date: '05/10/2026',
    titre: 'Plus fluide',
    notes: [
      'Le décor n\'est plus dessiné quand il est derrière la caméra ou perdu dans le brouillard : jusqu\'à dix fois moins de travail pour la carte graphique sur les niveaux boisés.',
      'Plus d\'images par seconde, surtout sur téléphone et ordinateur portable ; le décor à l\'écran ne change pas.',
    ],
  },
  {
    version: '0.4.11',
    date: '05/10/2026',
    titre: 'Correctif : son du moteur',
    notes: [
      'Le moteur était muet depuis la 0.4.10 : il se fait de nouveau entendre, avec le nouveau son.',
      'Si le nouveau moteur ne peut pas fonctionner sur ton appareil, le jeu repasse tout seul sur l\'ancien son au lieu de rester silencieux.',
    ],
  },
  {
    version: '0.4.10',
    date: '05/10/2026',
    titre: 'Nouveau son moteur',
    notes: [
      'Le bruit du moteur est maintenant simulé physiquement : cylindres, admission, échappement et silencieux, comme un vrai moteur.',
      'Chaque voiture a son moteur : trois cylindres rageur pour la Kei, six en ligne pour la Turbo, V8 qui gronde pour la Muscle…',
      'La Rotative a un vrai moteur rotatif préparé façon RX-7 : ralenti haché « brap brap », puis hurlement régulier dans les tours.',
      'Le moteur s\'assombrit quand tu lâches l\'accélérateur et s\'ouvre à pleine charge ; turbo, rupteur et passages de rapports sont conservés.',
    ],
  },
  {
    version: '0.4.9',
    date: '05/10/2026',
    titre: 'Toutes les roulettes en même temps',
    notes: [
      'Ouvrir plusieurs caisses lance une roulette par caisse : elles tournent toutes ensemble et s\'arrêtent en même temps sur leur livrée, puis la fiche récapitule tout le lot.',
    ],
  },
  {
    version: '0.4.8',
    date: '05/10/2026',
    titre: 'Caisses par lots et mises à jour automatiques',
    notes: [
      'Caisses : nouveau bouton « Ouvrir ×N » pour ouvrir jusqu\'à 10 caisses d\'un coup. La roulette s\'arrête sur la plus rare, puis toutes les trouvailles s\'affichent ; touche une carte pour l\'équiper.',
      'Le jeu se met à jour tout seul : quand une nouvelle version sort, il se recharge dès que tu reviens dans un menu (jamais en pleine course, dans l\'éditeur ou dans les caisses).',
    ],
  },
  {
    version: '0.4.7',
    date: '05/10/2026',
    titre: 'Mises à jour sans coupure du classement',
    notes: [
      'Le serveur qui vérifie les scores se met à jour en même temps que le jeu : presque plus de message « recharge la page » juste après une mise à jour.',
    ],
  },
  {
    version: '0.4.6',
    date: '05/10/2026',
    titre: 'Pas de points en repassant',
    notes: [
      'Le drift ne rapporte plus de points sur une portion de route déjà parcourue : reculer puis repasser au même endroit ne fait plus gagner de points.',
      'Après un replacement, on repart normalement : la voiture est posée juste avant l\'endroit atteint.',
    ],
  },
  {
    version: '0.4.5',
    date: '05/10/2026',
    titre: 'Clés gagnées en jouant',
    notes: [
      'Les clés du compte ne se gagnent plus qu\'en terminant de vraies courses : renvoyer deux fois la même course ne rapporte rien.',
      'Pas de clé plus vite qu\'on ne joue : entre deux gains, au moins la durée de la course.',
      'La progression du jeu sans connexion n\'est plus versée dans un compte : un compte part de ses 3 clés offertes et progresse en jouant.',
    ],
  },
  {
    version: '0.4.4',
    date: '05/10/2026',
    titre: 'Classement anti-triche',
    notes: [
      'Les scores en ligne sont maintenant vérifiés : le serveur rejoue ta course à partir des commandes enregistrées pendant que tu conduis.',
      'Course honnête : ton score est gardé tel quel. Score modifié dans le navigateur : c\'est le score de la course rejouée qui compte.',
      'Une course qui ne va pas jusqu\'à l\'arrivée n\'entre plus au classement.',
      'Si le serveur a corrigé ton score, l\'écran des résultats l\'indique.',
    ],
  },
  {
    version: '0.4.3',
    date: '02/10/2026',
    titre: 'Fumées de pneus',
    notes: [
      '24 fumées de pneus à collectionner, de la commune à l\'exotique : couleurs unies, dégradés, damier, feu, néon, givre, arc-en-ciel, galaxie, poussière d\'or, prisme, aurore…',
      'Elles sortent des caisses, comme les livrées ; les plus rares brillent, changent de couleur ou lâchent des paillettes.',
      'Nouvelle section « Fumée des pneus » dans le garage : une fumée pour toutes les voitures, en niveau comme en mode Zen.',
      'Les fumées débloquées sont enregistrées dans ton compte.',
    ],
  },
  {
    version: '0.4.2',
    date: '01/10/2026',
    titre: 'Dix nouveaux niveaux',
    notes: [
      'Japon : Sentier des Cerisiers, Col du Torii et Dragon de Jade.',
      'Pirate : Baie des Naufragés, Crique du Perroquet et Récif du Kraken.',
      'Espace : Orbite Basse et Cratère Rouge.',
      'Backrooms : Couloirs Jaunes et Labyrinthe de Néons.',
      'De la balade facile au tracé technique : 30 niveaux officiels au total.',
    ],
  },
  {
    version: '0.4.1',
    date: '01/10/2026',
    titre: 'Quatre nouveaux décors',
    notes: [
      'Pirate : îles tropicales, mer turquoise, palmiers, épaves, pontons, canons et coffres au trésor.',
      'Backrooms : murs jaunes à perte de vue, piliers, néons qui grésillent et portes au milieu de nulle part.',
      'Espace : sol lunaire et cratères, cristaux, antennes, ciel étoilé et planètes dans le ciel.',
      'Japon : cerisiers en fleurs, pétales qui volent, torii, pagodes, bambous, rizières en terrasses et volcan enneigé.',
      'Les quatre décors sont disponibles dans l\'éditeur de niveaux et rejoignent la rotation du mode Zen.',
    ],
  },
  {
    version: '0.4.0',
    date: '01/10/2026',
    titre: 'Mode Zen',
    notes: [
      'Nouveau mode Zen (bouton « Mode Zen » à l\'accueil) : une route sans fin, sans points ni chrono, qui se crée au fur et à mesure que tu avances.',
      'Le décor change tous les 3 km environ, avec des transitions douces entre montagne, neige, canyon, automne et ville : ciel, lumière, végétation et relief se mélangent.',
      'Le jour et le coucher de soleil alternent le long de la route ; le nom de la région s\'affiche quand tu y entres, et un compteur indique les kilomètres parcourus.',
      'En pause : Reprendre, Nouvelle route ou Menu, avec le numéro de la route pour la retrouver.',
    ],
  },
  {
    version: '0.3.14',
    date: '30/09/2026',
    titre: 'Quatre nouvelles voitures',
    notes: [
      'La Kei : minuscule et très légère, elle pivote en un rien de temps mais plafonne vite.',
      'La Muscle : gros coupé à moteur avant, couple énorme, grosses glisses et direction paresseuse.',
      'La Rotative : coupé à moteur rotatif et phares escamotables, parfaitement équilibré, qui monte à 9000 tr/min.',
      'Le Break : le break familial stable et pardonnant… qui glisse très bien.',
      'Chaque nouvelle voiture a sa voix moteur et 32 livrées, dont 2 exotiques, à gagner dans les caisses.',
      'Le Garage présente les 7 voitures en grille (en rangée défilante sur téléphone).',
    ],
  },
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
