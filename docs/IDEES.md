# Idées pour la suite de Drift Club

Carnet d'idées : ce qui pourrait venir après la v0.5.30. Rien ici n'est promis ni planifié ; on pioche dedans, et on met
à jour la colonne **État** (et la section « Fait » en bas) au fil des versions.

Repères d'effort : **petit** = une session, **moyen** = une ou deux sessions, **gros** = une vraie mise à jour (v0.x.0).
« Serveur » : il faut une migration SQL (`supabase/migrations/`) ou modifier la simulation, puis régénérer et redéployer
la fonction `verifier-course` (`npx vite-node tools/gen-fonction.ts`).

## Vue d'ensemble

| Idée | Effort | Serveur | État |
| --- | --- | --- | --- |
| [Manette](#manette) | petit | non | fait (0.5.3) |
| [Mode photo](#mode-photo) | petit | non | fait (0.5.3) |
| [Ambiance sonore par décor](#ambiance-sonore-par-décor) | petit | non | fait (0.5.3) |
| [Niveau rappelé à l'arrivée](#niveau-rappelé-à-larrivée) | petit | non | fait (0.5.6) |
| [Médailles par niveau](#médailles-par-niveau) | petit | non | fait (0.5.7) |
| [Vibrations de la manette](#vibrations-de-la-manette) | petit | non | fait (0.5.8) |
| [Touches personnalisables](#touches-personnalisables) | petit | non | fait (0.5.9) |
| [Carte de score à partager](#carte-de-score-à-partager) | petit | non | fait (0.5.10) |
| [Statistiques du pilote](#statistiques-du-pilote) | petit | non | fait (0.5.11) |
| [Défi du jour](#défi-du-jour) | moyen | oui (migration) | fait (0.5.17) |
| [Caméras embarquées](#caméras-embarquées) | moyen | non | fait (0.5.12) |
| [Revoir sa course](#revoir-sa-course) | moyen | non | fait (0.5.13) |
| [Fantôme de son record (local)](#fantôme-de-son-record-local) | moyen | non | fait (0.5.14) |
| [Zones de clipping](#zones-de-clipping) | moyen | oui (simulation) | fait (0.5.15) |
| [Votes dans l'Atelier](#votes-dans-latelier) | moyen | oui (migration) | fait (0.5.18) |
| [Pluie et nuit](#pluie-et-nuit) | moyen | oui (simulation) | fait (0.5.16) |
| [Ponts dans l'éditeur](#ponts-dans-léditeur) | moyen | oui (simulation) | fait (0.5.21) |
| [Niveau aléatoire dans l'éditeur](#niveau-aléatoire-dans-léditeur) | petit | non | fait (0.5.22) |
| [Motos](#motos) | gros | oui (simulation + migration) | en cours (0.5.25 → 0.5.31 : deux motos, wheelie, classement, défi) |
| [Fantômes et tandem](#fantômes-et-tandem) | gros | oui (migration + stockage) | à faire |
| [Clubs](#clubs) | gros | oui (migration) | à faire |
| [Saison](#saison) | gros | oui (migration) | à faire |
| [Réglages de voiture](#réglages-de-voiture) | gros | oui (simulation) | à discuter |
| [Figures](#figures) | moyen | oui (simulation) | à faire |
| [Wheelie à moto](#wheelie-à-moto) | gros | oui (simulation) | fait (0.5.27 → 0.5.30) |
| [Deuxième moto](#deuxième-moto) | moyen | oui (simulation + migration) | fait (0.5.31 : La Sportive) |
| [Défi du jour à moto](#défi-du-jour-à-moto) | petit | oui (simulation + migration) | fait (0.5.31) |

Recommandation actuelle : les motos ont pris le relais depuis la 0.5.25 (deux motos, wheelie, classement à part,
défi du jour à moto) ; il leur reste surtout des livrées dessinées. Pour la suite, **fantômes et tandem** : les
replays, le film (« Revoir ») et le fantôme local existent déjà, il reste à stocker les replays sur le serveur pour
courir contre le premier du classement.

## Petites

### Manette

Jouer à la manette (Xbox, PlayStation) avec l'API Gamepad du navigateur : gâchettes pour l'accélérateur et le frein
(dosage progressif), stick gauche pour la direction, un bouton pour le frein à main. Réglages : zone morte du stick,
sensibilité. À brancher sur `src/input/manager.ts`, à côté du clavier et du tactile. Les commandes passent déjà par
`quantifier()` (déterminisme du rejeu) : rien à changer côté serveur.

### Mode photo

Depuis la pause : caméra libre (elle existe déjà sous `?debug`, `src/debug/camLibre.ts`), HUD masqué, puis capture
d'écran téléchargée ou partagée (`canvas.toBlob`, `navigator.share` sur téléphone). Idéal pour montrer sa livrée de
l'Atelier. Option : quelques filtres (noir et blanc, grain, vignette).

### Ambiance sonore par décor

Un fond sonore léger par thème, en boucle et en mélange avec le moteur : vent et oiseaux (montagne), vent glacé (neige),
cigales (japon), vagues (pirate), bourdonnement électrique des néons (backrooms), rumeur de ville et pluie (cyberpunk).
Sons générés comme le reste de l'audio (`src/audio/`), volume lié au réglage existant.

### Niveau rappelé à l'arrivée

L'écran de victoire affiche seulement « Arrivée ! » : y réafficher le numéro et le nom du niveau (par exemple
« Niveau 3 · Col du Loup »), pour savoir d'un coup d'œil quelle course on vient de finir, surtout avant
« Niveau suivant » ou une capture d'écran. Pour un niveau de l'éditeur ou le mode Zen, son nom seul. À faire dans
`resultats()` (`src/ui/screens.ts`), appelé depuis `src/app.ts`.

### Médailles par niveau

Bronze, argent et or sur chaque niveau officiel (seuils de score fixés par niveau, l'or demandant un vrai bon run),
affichées sur la liste des niveaux et à l'arrivée. Donne un objectif clair aux joueurs qui ne regardent pas le
classement en ligne. Les records locaux suffisent ; récompenser les médailles en clés demanderait le serveur
(les clés ne se créditent que pour des courses vérifiées).

### Vibrations de la manette

Prolonge la manette : petite vibration quand un drift est encaissé (plus forte avec le multiplicateur), secousse au
choc, grondement léger hors piste (`gamepad.vibrationActuator`, Chrome et Edge ; ignoré ailleurs). Réglage pour la couper.

### Touches personnalisables

Changer les touches dans les Réglages (cliquer sur une action puis appuyer sur la touche voulue), et faire de même
pour les boutons de la manette. Utile pour les gauchers, les claviers exotiques et ceux qui veulent le frein à main
ailleurs que sur Espace.

### Carte de score à partager

À l'arrivée, un bouton « Partager » qui produit une image : capture de la course (même mécanique que le mode photo),
nom du niveau, score, meilleur drift, voiture et livrée, avec le lien du jeu. Le partage sur téléphone passe par
`navigator.share`, comme pour les photos.

### Statistiques du pilote

Une page dans le Compte (ou les Réglages hors ligne) : kilomètres parcourus, temps passé en glisse, plus long drift,
courses finies, voiture la plus jouée, kilomètres en mode Zen. Tout est compté sur l'appareil ; plus tard, les mêmes
chiffres pourraient nourrir les succès ou la saison.

### Défi du jour à moto

Le défi du jour tire sa voiture dans une liste figée de sept voitures (`VEHICULES_DEFI`, pour ne pas changer les défis
passés). Un défi moto à côté : même niveau du jour, classement « moto:jour:… », moto imposée tirée de la date dans une
autre liste figée (`MOTOS_DEFI`). Fait en 0.5.31 : onglets « En voiture » et « À moto » sur l'écran du défi, podium
à moto récompensé comme celui des voitures (5, 3, 2 clés), vainqueurs des défis à moto (migration 0016).

## Moyennes

### Caméras embarquées

Plusieurs caméras en plus de la poursuite et de la vue éloignée (`src/render/camera.ts`), qu'on fait défiler avec la
touche C (et un bouton de la manette) :

- **capot** : posée sur le capot, très basse, sensation de vitesse maximale ;
- **calandre** : au ras du pare-chocs avant, la route défile juste sous l'objectif ;
- **conducteur** : à la place du pilote, avec le tableau de bord, le volant qui tourne avec la direction et les mains
  (il faut modéliser un intérieur simple pour chaque voiture : c'est ce qui en fait une idée moyenne) ;
- et pourquoi pas : **roue arrière** (vue sur le pneu qui fume), **toit**, **rétroviseur** en incrustation (pas encore
  fait : le décor derrière la voiture n'est pas dessiné, seul ce qui est devant la caméra l'est).

La dernière caméra choisie est retenue dans les Réglages. Rien à changer côté serveur : la caméra ne touche pas la
simulation.

### Revoir sa course

Le jeu enregistre déjà chaque course (replay binaire envoyé au serveur) et la simulation est déterministe : à
l'arrivée, « Revoir » rejoue la course dans le navigateur avec des caméras de télévision (bord de route, hélicoptère,
poursuite), avance rapide et ralenti. On peut y ouvrir le mode photo pour capturer le plus beau drift.

### Fantôme de son record (local)

Première marche vers les fantômes, sans serveur : garder sur l'appareil le replay de son meilleur score par niveau
(quelques ko) et le rejouer en voiture translucide pendant la course. Le fantôme du premier du classement viendra
avec le stockage des replays côté serveur (voir [Fantômes et tandem](#fantômes-et-tandem)).

### Défi du jour

Chaque jour, un niveau tiré de la date (le dessinateur du mode Zen, `src/core/zen/designer.ts`, sait tracer une route
d'une graine), avec une voiture et un décor imposés. Classement du jour (le score passe par la même vérification
serveur que les niveaux officiels), podium récompensé en clés, historique des défis passés.
Serveur : une migration pour le classement du jour et les récompenses ; la fonction doit savoir reconstruire le niveau
d'une date (même code que le client, empaqueté par `tools/gen-fonction.ts`).

### Zones de clipping

Comme les juges des compétitions de drift : des zones au bord de la route (près d'un mur, à l'extérieur d'un virage) à
frôler en glisse pour un bonus de points ; plus on passe près, plus ça rapporte. Affichage au sol et dans le HUD.
Les niveaux officiels en reçoivent quelques-unes, l'éditeur permet d'en placer. C'est une règle de score : elle vit
dans `src/core` (déterministe), la fonction serveur est à régénérer, et les records existants ne sont plus comparables
sur les niveaux qui en reçoivent (nouveaux classements, ou zones seulement sur de nouveaux niveaux).

### Votes dans l'Atelier

Les joueurs voient les propositions en attente et votent (j'aime / j'aime pas) ; l'administrateur les trie par
popularité avant de valider. Une « livrée de la semaine » mise en avant (bannière sur l'écran des caisses, chances un peu
plus hautes ? — pas encore fait : le tirage des caisses du compte se fait sur le serveur). Serveur : table des votes (un vote par joueur et par proposition), fonctions dédiées, RLS comme le reste.
Attention à ne pas exposer d'adresses email : on ne montre que le pseudo de l'auteur.

### Pluie et nuit

Une ambiance « Nuit » en plus de Jour et Coucher : phares de la voiture (lumière qui suit), lampadaires allumés,
fenêtres éclairées (la ville et le japon savent déjà le faire au coucher). Une option « Pluie » sur un niveau :
gouttes (la pluie du cyberpunk existe), reflets sur la route, et **adhérence réduite**. L'adhérence change la physique :
elle passe dans la simulation (`src/core`), le niveau la déclare (format de niveau à étendre), et la fonction serveur
est à régénérer.

### Ponts dans l'éditeur

Pouvoir faire se croiser la route : si les deux portions ont assez de différence de hauteur, celle du dessus devient un
pont (tablier, garde-corps, piliers) et l'autre passe dessous ; à la même hauteur, le croisement reste refusé. La
voiture doit savoir sur quelle portion elle roule (le sol n'a plus une seule hauteur) : ça passe dans la simulation
(`src/core`) et la fonction serveur est à régénérer.

### Niveau aléatoire dans l'éditeur

Partir d'une base tirée au sort plutôt que d'une page blanche : la route du dessinateur du mode Zen (celle du défi du
jour), dans le décor choisi ou au hasard, avec ses barrières et ses zones de clipping, puis la retoucher.

### Figures

Des points pour des figures en glisse, comme en compétition : un tour complet (360°), un demi-tour (180°), un tête-
queue, et ainsi de suite. La voiture garde son lacet cumulé (l'angle total tourné depuis le début de la figure), ce qui
permet de compter les rotations sans se tromper quand on repart en arrière. Chaque figure rapporte des points fixes,
avec un bonus pour un enchaînement propre (deux figures sans toucher un mur ni perdre l'adhérence) et une figure annulée
en cas de choc. Affichage dans le HUD (« 360° ! ») et, pour la carte de score, la meilleure figure de la course.
C'est une règle de score : elle vit dans `src/core` (déterministe), le serveur doit la rejouer, donc fonction à
régénérer ; les records des niveaux existants restent comparables tant que les figures ne rapportent rien de plus que le
drift (ou nouveaux classements, comme pour les zones de clipping).

### Deuxième moto

Une moto de caractère différent de La Supermotard, par exemple une sportive (plus rapide, plus lourde, couchée plus
loin, wheelie difficile) ou une petite 125 (légère, joueuse, peu de puissance). Le modèle de moto
(`src/render/motos.ts`, `MOTO_SHAPES`) et les paramètres (`src/core/physics/cars.ts`) sont prêts à en accueillir
d'autres ; l'onglet Motos du Garage aussi. Le jeu de paramètres change la simulation : fonction serveur à régénérer.
Fait en 0.5.31 : **La Sportive**, carénée (bulle, guidons bracelets, pilote couché), quatre cylindres qui hurle jusqu'à
14 000 tr/min, 230 km/h, couchée jusqu'à 55° mais chute dès 60° de travers, wheelie qui demande plus d'élan ; huit
livrées en teintes (migration 0016 et catalogue 0006). Reste possible : une petite 125.

## Grosses

### Motos

Des deux-roues jouables partout : la moto penche dans les virages, glisse de l'arrière au frein et tombe si elle part
trop en travers. Plan détaillé dans la doc « Ajouter des motos à Drift Club ». Fait en 0.5.25 : fondations (genre de
véhicule, inclinaison, chute, liste du défi figée), La Supermotard (physique, modèle et pilote, son, livrées en
teintes, vues embarquées), migration 0014. Puis : roulis en ressort amorti et adhérence liée à l'inclinaison (0.5.26),
pneus arrondis et [wheelie](#wheelie-à-moto) (0.5.27 → 0.5.30), classement séparé et Garage en onglets Voitures / Motos
(0.5.28, migration 0015), [La Sportive](#deuxième-moto) et le [défi du jour à moto](#défi-du-jour-à-moto) (0.5.31,
migration 0016). Reste : des livrées dessinées pour les motos (l'Atelier ne connaît que les voitures).

### Fantômes et tandem

- **Fantôme** : courir contre son propre record, ou contre le premier du classement (voiture translucide qui rejoue son
  replay). Le serveur rejoue déjà les courses ; il faudrait **garder les replays** (stockage Supabase, quelques ko par
  course compressée) et pouvoir les télécharger.
- **Tandem en différé** : suivre le fantôme d'un autre joueur et marquer des points en restant proche de lui en glisse
  (meneur / suiveur, comme en compétition). Règle de score dans `src/core`, vérifiée par le serveur avec le replay du
  meneur.
- Plus tard peut-être : du vrai multijoueur en direct (Supabase Realtime), beaucoup plus lourd (latence, triche).

### Clubs

Le jeu s'appelle Drift Club : créer ou rejoindre une équipe (nom, blason dessiné dans l'Atelier), classement par club
(somme des meilleurs scores de ses membres), défis de club de la semaine, page du club. Serveur : tables des clubs et
des membres, invitations, modération (même principe que les administrateurs de l'Atelier).

### Saison

De l'expérience gagnée en jouant (courses finies, drifts longs, défis), des paliers qui débloquent des cosmétiques
exclusifs à la saison (livrées, fumées, un futur « cadre » de pseudo…), remise à zéro tous les un ou deux mois avec un
souvenir de son rang. Serveur : l'expérience se crédite comme les clés (seulement pour des courses vérifiées, jamais
plus vite qu'on ne joue).

### Réglages de voiture

Régler sa voiture : angle de braquage, répartition des freins, adhérence avant / arrière, raideur. Intéressant pour les
puristes, mais délicat pour la justice des classements : classements séparés « réglage libre », ou réglages bornés et
enregistrés avec le replay (le serveur rejoue avec les mêmes réglages). Touche la physique : simulation et fonction
serveur à mettre à jour.

### Wheelie à moto

Suite des [Motos](#motos). Sur une moto, un wheelie (roue avant en l'air) rapporte des points comme un drift, d'autant
plus qu'il dure. Ce qui existe :

- **cabrage physique** autour de la roue arrière (centre de masse haut, amortissement du tangage), dans
  `src/core/physics/car.ts` ; la simulation et la fonction serveur le rejouent (0.5.27) ;
- **coup d'embrayage** : gaz + frein tenus pour charger, puis lâcher le frein ; seulement moto droite et sous ~50 km/h,
  jamais par accident au simple coup de gaz (0.5.27) ;
- **pompage de fourche** en sortie de virage : deux ou trois coups de guidon gauche-droite rapides, sans glisser, puis
  les gaz en se redressant, jusqu'à ~90 km/h ; un virage normal ou une chicane ne lèvent rien (0.5.29) ;
- **direction au corps** pendant le wheelie : la moto penche et tourne un peu, en courbe large (0.5.29) ;
- **dosage** : frein arrière (frein à main) pour rabattre l'avant, aide anti-cabrage en Arcade (30°) et Semi (35°),
  chute en arrière en Exigeant au-delà de 65° (0.5.27) ;
- **jauges** dans le HUD : « Embrayage » (« Lâche ! », « Trop vite », « Redresse ») et « Fourche » (« Gaz ! ») (0.5.30) ;
- classement des motos à part (clé « moto:… », 0.5.28), puisque les voitures n'ont pas de wheelie.

Reste, en pistes : un bonus propre au wheelie (points par seconde, palier au-delà de quelques secondes) au lieu du
barème du drift ; le pompage plus facile à doser au clavier si la fenêtre (~0,25 s) se révèle trop courte.

## Fait (pour mémoire)

| Version | Ce qui a été fait |
| --- | --- |
| 0.4.4 → 0.4.9 | Anti-triche : courses rejouées par le serveur, clés gagnées seulement en jouant, pas de points en repassant au même endroit ; redéploiement automatique de la fonction ; mise à jour automatique du jeu ; ouverture de plusieurs caisses d'un coup |
| 0.4.10 → 0.4.12 | Moteur simulé physiquement (et vrai moteur rotatif), performances (seul le décor visible est dessiné) |
| 0.5.0 | **Atelier** (livrées créées par les joueurs, validées par l'administrateur, qui entrent dans les caisses) ; Backrooms en couloir sous plafond, Japon avec villages et rues commerçantes, décor **Cyberpunk** et niveau Néo-Shinjuku. Les fantômes ont été mis de côté au profit de l'Atelier. |
| 0.5.1 | Menu principal animé (la voiture du joueur en drift), Garage où l'on tourne la voiture à la main et où l'on voit sa fumée |
| 0.5.2 | Correctifs : l'arrivée compte même en glisse hors chaussée, le Garage ne remonte plus en haut de la liste |
| 0.5.3 | **Manette** (gâchettes progressives, zone morte et sensibilité réglables), **mode photo** depuis la pause (caméra libre, filtres, capture enregistrée ou partagée), **ambiance sonore** propre à chaque décor (réglable, fondu enchaîné entre régions en mode Zen) |
| 0.5.4 | **Bonus de temps** enfin gagnable : temps cible réaliste (× 1,25), 2 500 points par seconde d'avance sur le double du temps cible, plafonné aux points de drift |
| 0.5.5 | Bonus de temps adouci : 1 000 points par seconde d'avance sur 1,5 × le temps cible, plafonné à la moitié des points de drift |
| 0.5.6 | Numéro et nom du niveau rappelés sur l'écran d'arrivée |
| 0.5.7 | **Médailles** bronze, argent et or sur les niveaux officiels (seuils calés sur le temps cible), sur la liste des niveaux et à l'arrivée |
| 0.5.8 | **Vibrations de la manette** : drift encaissé (plus fort avec le combo), choc, grondement hors piste ; réglage pour les couper |
| 0.5.9 | **Touches personnalisables** : clavier (deux touches par commande) et boutons de la manette, dans Réglages › Touches |
| 0.5.10 | **Carte de score** à partager depuis l'arrivée : capture de la course, niveau, score, médaille, meilleur drift, voiture |
| 0.5.11 | **Statistiques du pilote** (accueil) : distance en course et en Zen, temps en glisse, plus long et meilleur drift, courses finies, voiture la plus jouée, médailles |
| 0.5.12 | **Caméras embarquées** : capot, calandre, conducteur (planche de bord, volant qui tourne), roue arrière, toit ; choix retenu dans les Réglages |
| 0.5.13 | **Revoir sa course** depuis l'arrivée : la course rejouée avec des caméras de télévision (bord de route, hélicoptère, poursuite, embarquée), ralenti, accéléré, mode photo |
| 0.5.14 | **Fantôme de son record** (sur l'appareil) : voiture translucide qui refait la meilleure course du niveau dans le mode choisi |
| 0.5.15 | **Zones de clipping** : bords de route à frôler en glisse (jusqu'à × 2 sur les points du drift), sur tous les niveaux officiels (records gardés) et dans l'éditeur |
| 0.5.16 | **Nuit** (ciel étoilé, lune, phares, fenêtres et lampadaires allumés ; Touge de Minuit passe de nuit) et **pluie** (route mouillée, adhérence −20 %, simulation et serveur) dans l'éditeur |
| 0.5.17 | **Défi du jour** : un niveau tiré de la date (dessinateur du mode Zen) avec voiture, ambiance et météo imposées, classement du jour vérifié par le serveur, podium récompensé (5, 3, 2 clés), défis passés (migration 0011) |
| 0.5.18 | **Votes dans l'Atelier** : j'aime / j'aime pas sur les propositions en attente, modération triée par popularité, livrée de la semaine sur l'écran des caisses (migration 0012) |
| 0.5.19 | **Statistiques du pilote rattachées au compte** : envoi des ajouts, total additionné par le serveur, plusieurs appareils (migration 0013) |
| 0.5.20 | Correctif : le mode Zen restait bloqué sur « Préparation de la route » depuis la 0.5.12 (caméra choisie avant que la route existe) |
| 0.5.21 | **Ponts dans l'éditeur** : la route peut se croiser avec au moins 7 m de différence de hauteur, la portion du dessus devient un pont (tablier, garde-corps, piliers), le croisement à la même hauteur reste refusé |
| 0.5.22 | **Niveau aléatoire** dans « Mes niveaux » : route tirée au sort (dessinateur du mode Zen) dans le décor choisi ou au hasard, avec barrières et zones de clipping, à retoucher dans l'éditeur |
| 0.5.23 | **19 nouveaux niveaux officiels** (50 au total) : quatre avec un pont, quatre sous la pluie, sept de nuit, dans tous les décors (Irohazaka, Col de la Bonette, Mirage de midi, Pluie sous les néons…) |
| 0.5.24 | Repère sur la jauge de vitesse : la vitesse (30 km/h) à partir de laquelle un drift rapporte des points |
| 0.5.25 | **Première moto, La Supermotard** : elle penche dans les virages, glisse de l'arrière au frein, tombe trop en travers ; modèle et pilote, son de monocylindre, livrées en teintes, vues embarquées (migration 0014) |
| 0.5.26 | Moto : roulis en ressort amorti (plus d'à-coups) et adhérence liée à l'inclinaison (il faut pencher pour tourner fort) |
| 0.5.27 | **Wheelie à moto** : coup d'embrayage (frein + gaz, puis relâcher le frein), cabrage physique autour de la roue arrière, aide anti-cabrage en Arcade et Semi, chute en arrière en Exigeant, points comme un drift ; pneus de moto arrondis |
| 0.5.28 | **Classement séparé des motos** (clés « moto:… », migration 0015) et Garage en deux onglets, Voitures et Motos |
| 0.5.29 | Moto : **pompage de fourche** (coups de guidon gauche-droite puis gaz pour lever l'avant en sortie de virage) et direction au corps pendant le wheelie |
| 0.5.30 | Moto : jauges **Embrayage** et **Fourche** dans le HUD, pour savoir quand lâcher le frein ou mettre les gaz |
| 0.5.31 | **La Sportive** (deuxième moto, carénée, 230 km/h) et **défi du jour à moto** (même niveau, moto imposée, classement et podium à part), migration 0016 |
| 0.5.32 | Correctifs d'affichage (barrières et décor écartés à tort sur les bords de l'écran), fuite de mémoire graphique (écran blanc), contours lointains allégés |
