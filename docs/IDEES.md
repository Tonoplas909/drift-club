# Idées pour la suite de Drift Club

Carnet d'idées : ce qui pourrait venir après la v0.5.1. Rien ici n'est promis ni planifié ; on pioche dedans, et on met
à jour la colonne **État** (et la section « Fait » en bas) au fil des versions.

Repères d'effort : **petit** = une session, **moyen** = une ou deux sessions, **gros** = une vraie mise à jour (v0.x.0).
« Serveur » : il faut une migration SQL (`supabase/migrations/`) ou modifier la simulation, puis régénérer et redéployer
la fonction `verifier-course` (`npx vite-node tools/gen-fonction.ts`).

## Vue d'ensemble

| Idée | Effort | Serveur | État |
| --- | --- | --- | --- |
| [Manette](#manette) | petit | non | à faire |
| [Mode photo](#mode-photo) | petit | non | à faire |
| [Ambiance sonore par décor](#ambiance-sonore-par-décor) | petit | non | à faire |
| [Défi du jour](#défi-du-jour) | moyen | oui (migration) | **recommandé** |
| [Zones de clipping](#zones-de-clipping) | moyen | oui (simulation) | **recommandé** |
| [Votes dans l'Atelier](#votes-dans-latelier) | moyen | oui (migration) | à faire |
| [Pluie et nuit](#pluie-et-nuit) | moyen | oui (simulation) | à faire |
| [Fantômes et tandem](#fantômes-et-tandem) | gros | oui (migration + stockage) | à faire |
| [Clubs](#clubs) | gros | oui (migration) | à faire |
| [Saison](#saison) | gros | oui (migration) | à faire |
| [Réglages de voiture](#réglages-de-voiture) | gros | oui (simulation) | à discuter |

Recommandation actuelle : **défi du jour** puis **zones de clipping** (la manette peut venir dans la même version).
Le défi du jour fait revenir les joueurs chaque jour ; les zones de clipping rendent le drift plus riche à jouer ; les deux
réutilisent ce qui existe (dessinateur du mode Zen, éditeur, rejeu des courses par le serveur).

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

## Moyennes

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
plus hautes ?). Serveur : table des votes (un vote par joueur et par proposition), fonctions dédiées, RLS comme le reste.
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
