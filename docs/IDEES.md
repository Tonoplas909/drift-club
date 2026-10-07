# Idées pour la suite de Drift Club

Carnet d'idées : ce qui pourrait venir après la v0.5.18. Rien ici n'est promis ni planifié ; on pioche dedans, et on met
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
| [Fantômes et tandem](#fantômes-et-tandem) | gros | oui (migration + stockage) | à faire |
| [Clubs](#clubs) | gros | oui (migration) | à faire |
| [Saison](#saison) | gros | oui (migration) | à faire |
| [Réglages de voiture](#réglages-de-voiture) | gros | oui (simulation) | à discuter |

Recommandation actuelle : toutes les petites et moyennes idées sont faites (0.5.6 à 0.5.18). Pour la suite, **fantômes
et tandem** : les replays, le film (« Revoir ») et le fantôme local existent déjà, il reste à stocker les replays sur le
serveur pour courir contre le premier du classement.

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

## Grosses

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
