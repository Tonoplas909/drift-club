# Drift Club

Jeu de drift en 3D dans le navigateur : enchaîne les drifts sur des routes de montagne et fais le plus de points avant la ligne d'arrivée.

**Jouer :** https://tonoplas909.github.io/drift-club/

## Principe

- Un drift compte dès que la voiture glisse de plus de 15° au-dessus de 30 km/h. Plus l'angle et la vitesse sont grands, plus il rapporte.
- Enchaîne les drifts pour monter le **combo** (jusqu'à x5). Un drift est **encaissé** quand tu te redresses proprement.
- Un **choc** contre une barrière ou le décor ou un replacement font **perdre** le drift en cours et le combo. Un tête-à-queue ne fait pas perdre, mais au-delà de 60° d'angle un drift rapporte de moins en moins.
- À l'arrivée, un **bonus de temps** récompense les courses rapides.

## Modes de conduite

| Mode | Pour qui |
|---|---|
| **Arcade** | Bouton Drift : glissade guidée (le tête-à-queue reste possible si on en fait trop). Idéal au tactile. |
| **Semi-arcade** | On lance le drift soi-même (frein à main, coup de gaz), contre-braquage aidé. |
| **Exigeant** | Aucune aide. |

Trois voitures : **L'Équilibrée** (pour débuter), **La Légère** (agile) et **La Turbo** (puissante). Les records sont enregistrés par niveau et par mode.

Au **Garage**, on choisit la voiture, sa **couleur** (8 teintes) et sa **livrée** (16 par voiture : Unie, double bande, damier, pois, camouflage, éclairs, flammes, taxi, noir et or…). La livrée se pose par-dessus la couleur choisie et est mémorisée pour chaque voiture ; quelques livrées (Or massif, Chrome, Noir mat, Taxi…) **imposent** leur couleur de carrosserie, et le Garage l'indique. Elles sont décrites par des données dans `src/core/skins.ts` : ajouter une livrée = ajouter une entrée dans `SKINS` (id, nom, rareté, éléments) ; elle entre alors toute seule dans les caisses. Les éléments de décor (bandes, damier, flammes, éclairs, camouflage, pois, diagonales, dents de scie…) sont générés en procédural dans `src/render/skins.ts`.

Chaque niveau a un **décor** (son champ `environnement`) : **Montagne**, **Neige** (sapins givrés, congères, flocons), **Canyon** (sable, cactus, mesas rouges) ou **Forêt d'automne** (feuillages roux et dorés). Il règle le sol, les arbres, les rochers, les objets de bord de route, le ciel et la brume, en Jour comme en Coucher. Dans l'éditeur, l'outil **Décor** propose ce choix ; il est conservé dans les liens de partage, les fichiers `.json` et les niveaux publiés en ligne.

### Raretés, clés et caisses

Chaque livrée a une **rareté** : Commune (bleu, 79,9 %), Rare (violet, 16 %), Épique (rose, 3,2 %), Légendaire (rouge, 0,64 %) et Exotique (or, 0,26 %). « Unie » est toujours débloquée ; les autres se gagnent dans des **caisses**, toutes voitures confondues (on peut tomber sur une livrée d'une autre voiture).

- Les **clés** se gagnent en jouant : 1 par arrivée, +1 sur un nouveau record local. Une **caisse** coûte 3 clés ; une caisse est offerte au premier lancement. Un doublon rend 1 clé. Tous ces nombres sont réunis dans `ECONOMIE` (`src/core/economie.ts`).
- Le bouton **Caisses** (accueil, Garage, résultats) ouvre la roulette façon CS:GO : les cartes défilent puis s'arrêtent sur la livrée gagnée (bouton « Passer », animation raccourcie si le système demande de réduire les animations). « Équiper » ouvre le Garage sur la livrée.
- Au Garage, les livrées verrouillées portent un cadenas : on peut les **prévisualiser** en 3D mais pas les équiper.
- Le tirage est pur et testé (`src/core/caisses.ts`, `tirer(rng, inventaire)` et `construireBande`) ; la progression est locale (`driftclub.v1.progression`), sans achat ni argent réel. Les livrées déjà choisies avant l'arrivée des caisses restent débloquées.

Dix niveaux : **Premiers virages**, **Forêt des Pins**, **Col du Loup**, **Lacets du Belvédère** (montée en épingles), **Vallée des Crêtes** (descente rapide au coucher du soleil), **Circuit du Lac** (grand fer à cheval de longs virages, le plus facile), **Épingles du Diable** (huit épingles empilées sur une face raide, le plus dur), **Route des Crêtes Nord** (longue crête rapide avec trois épingles), **Descente du Moulin** (descente technique en chicanes au coucher du soleil) et **Grand Huit** (un serpent de dix virages alternés).

## Commandes

| Action | Clavier |
|---|---|
| Accélérer | Z / W / ↑ |
| Freiner / reculer | S / ↓ |
| Tourner | Q / A / D / ← → |
| Frein à main (Drift en Arcade) | Espace |
| Replacer sur la route | R |
| Caméra proche / éloignée | C |
| Pause | Échap / P |
| Muet / plein écran | M / F |

Au tactile : glisse le pouce gauche pour tourner, boutons Gaz, Frein et Drift à droite (accélération automatique activable dans les réglages).

## Éditeur de niveaux

Depuis l'accueil, **Éditeur** ouvre « Mes niveaux » : **Nouveau niveau**, **Copier un niveau officiel**, **Importer**, puis pour chaque niveau **Modifier**, **Jouer**, **Renommer**, **Dupliquer**, **Exporter** (fichier `.json` lisible), **Partager** et **Supprimer** (avec confirmation). Tes niveaux apparaissent aussi dans **Jouer → Mes niveaux**, avec leurs records.

Dans l'éditeur, la route est vue de dessus (grille en mètres, largeur réelle de la chaussée). Cinq outils :

| Outil | Ce qu'il fait |
|---|---|
| **Route** | Clic dans le vide : ajoute un point à la fin. Glisser un point : le déplacer. Clic sur la route : insère un point. Point sélectionné : largeur, hauteur, Supprimer. |
| **Barrières** | Choisis Gauche, Droite ou Extérieur (extérieur du virage), puis clique sur un tronçon (entre deux points, repérés par des tirets) pour poser ou retirer sa barrière. |
| **Objets** | Palette (arbre, sapin, rocher, pneus, barrière, panneau ; dans le Canyon, l'arbre devient un arbre sec et le sapin un cactus) : clic pour poser, glisser pour déplacer, boutons ±15° pour tourner, Supprimer. |
| **Décor** | Ambiance (Jour / Coucher), densité, « Autre décor » (nouvelle graine), environnement (Montagne, Neige, Canyon, Forêt d'automne ; le fond de la carte prend la couleur du sol). |
| **Infos** | Nom (1 à 40 caractères) et auteur (0 à 30). |

Le **profil en long** (bandeau du bas, repliable) montre la hauteur en fonction de la distance : glisse un point verticalement pour modifier son altitude. La **barre de validation** est toujours visible : « ✔ Niveau valide · … » ou la liste des erreurs, avec les compteurs (points/150, objets/300, longueur/3 km). Les croisements et virages trop serrés sont entourés en rouge sur la carte. Un niveau invalide ne peut pas être testé.

**Tester** lance la course tout de suite (voiture et mode courants) ; depuis la pause ou les résultats, **Retour à l'éditeur** retrouve l'éditeur exactement dans le même état. Le niveau est **enregistré automatiquement** dans le navigateur (indicateur « Enregistré » ; si la structure est invalide, « Non enregistré : … »).

| Action | Commande |
|---|---|
| Déplacer la vue | Glisser dans le vide, clic droit ou clic milieu ; deux doigts au tactile |
| Zoom | Molette (vers le curseur) ; pincement au tactile ; « Recentrer » pour tout voir |
| Annuler / Rétablir | Ctrl+Z / Ctrl+Y ou Ctrl+Maj+Z (100 états) |
| Supprimer la sélection | Suppr ou Retour arrière |
| Désélectionner / annuler un glissement | Échap |

## Partager un niveau

Le bouton **Partager** (dans l'éditeur et dans « Mes niveaux » ; grisé tant que le niveau n'est pas valide) ouvre une fenêtre avec trois façons de faire jouer ton niveau :

| Façon | Ce que c'est |
|---|---|
| **Lien** | `https://…/#n=<code>` : le niveau tout entier est dans le lien (compressé, quelques centaines de caractères pour un niveau ordinaire ; un avertissement s'affiche au-delà de 8 000). Aucun compte ni serveur : il suffit de l'envoyer. **Copier le lien**, **Copier le code** ou, sur téléphone, **Partager…**. |
| **Fichier .json** | **Télécharger le .json** : format lisible, à envoyer tel quel. |
| **En ligne** | **Publier en ligne** (compte avec pseudo requis) : le niveau rejoint l'onglet **En ligne** de **Jouer**, visible de tous, avec un lien court `#en-ligne=<id>`. |

Ouvrir un lien affiche « Niveau partagé : *nom*, par *auteur* » avec **Jouer**, **Enregistrer dans mes niveaux** et **Modifier une copie**. **Importer** (dans **Jouer** ou dans « Mes niveaux ») accepte un code, un lien complet ou un fichier `.json`. Tout niveau reçu est vérifié comme s'il venait de l'éditeur : un niveau invalide affiche la liste des erreurs et n'est jamais chargé.

Dans **Jouer → En ligne**, les niveaux publiés se trient par **Récents** ou **Populaires** (nombre de parties). Chaque niveau a **Jouer**, **Classement** (comme les niveaux perso), **Enregistrer** dans Mes niveaux, et **Retirer** si tu en es l'auteur.

Bon à savoir : un lien ou une publication arrondit la route au décimètre (les records d'un niveau sont liés à son contenu arrondi, pas à ton brouillon exact). Le nom et l'auteur ne comptent pas dans les records. Les niveaux en ligne demandent la mise en place de Supabase (migration `0003`, voir [`supabase/README.md`](supabase/README.md)) ; sans elle, l'onglet **En ligne** affiche « pas encore disponible » et le reste du partage fonctionne.

## Classement en ligne

Un compte (email + mot de passe + pseudo) permet d'apparaître dans le classement de chaque niveau (tous modes de conduite confondus, le mode est affiché). Depuis l'accueil, **Compte** permet de s'inscrire, se connecter, changer de pseudo ou de mot de passe (lien « Mot de passe oublié ? »). Selon les réglages du projet, un email de confirmation peut être demandé à l'inscription.

- **Classement** : dans **Jouer**, chaque niveau (officiel ou « Mes niveaux ») a un bouton **Classement** : les 20 meilleurs scores, tous modes confondus (rang, pseudo, mode, score, temps, voiture), ta ligne en surbrillance.
- **Envoi automatique** : à l'arrivée, si tu es connecté avec un pseudo, le score est envoyé et l'écran affiche ton rang (« Classement : 3e sur 12 »). Seul ton meilleur score par niveau et par mode est gardé.
- **Ce qui est envoyé** : identifiant du niveau, mode, score, temps, voiture, meilleur drift. Rien d'autre (pas de niveau, pas de réglages). Ton email n'est jamais visible des autres joueurs ; seul le pseudo l'est.
- **Hors ligne** : si le service est injoignable, le jeu reste entièrement jouable (records locaux) et un court message l'indique.

Mise en place côté Supabase (tables, sécurité, réglages d'authentification) : voir [`supabase/README.md`](supabase/README.md).

## Développement

```bash
npm install
npm run dev      # serveur local
npm test         # tests
npm run build    # version publiée (dist/)
```

Ajoute `?debug` à l'adresse pour afficher le panneau de réglage de la conduite.

**Essayer les décors** sur les niveaux existants : `?theme=neige`, `?theme=desert` ou `?theme=automne` (et `?theme=montagne`) remplacent l'environnement de n'importe quel niveau au chargement ; `?ambiance=jour` ou `?ambiance=coucher` remplace l'ambiance. Le niveau lui-même n'est pas modifié (les records restent comptés sur le niveau d'origine). Exemple : `http://localhost:5173/drift-club/?theme=desert&ambiance=coucher`.

**Ajouter un décor** : ajouter son identifiant à la fin de `ENVIRONNEMENTS` (`src/core/level/types.ts` : l'ordre est figé, les liens de partage stockent l'indice), ses règles de placement dans `THEMES` (`src/core/env/themes.ts`), ses palettes Jour/Coucher dans `PALETTES_THEMES` (`src/render/palettes.ts`) et ses modèles dans `THEMES_VISUELS` (`src/render/themes.ts`). Les tests vérifient que chaque type de décor utilisé a un modèle, des variantes et un rayon de collision.

Chaque push sur `main` lance les tests puis publie le jeu sur GitHub Pages (Settings → Pages → Source : GitHub Actions).

## Crédits

Décor 3D : [Kenney](https://www.kenney.nl) (Nature Kit), licence CC0 — voir `public/models/LICENCE-kenney.txt`. Les voitures, d'inspiration japonaise, sont générées par le code du jeu.
