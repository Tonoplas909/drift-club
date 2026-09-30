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

Cinq niveaux : **Premiers virages**, **Forêt des Pins**, **Col du Loup**, **Lacets du Belvédère** (montée en épingles) et **Vallée des Crêtes** (descente rapide au coucher du soleil).

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

Depuis l'accueil, **Éditeur** ouvre « Mes niveaux » : **Nouveau niveau**, **Copier un niveau officiel**, **Importer un .json**, puis pour chaque niveau **Modifier**, **Jouer**, **Renommer**, **Dupliquer**, **Exporter** (fichier `.json` lisible) et **Supprimer** (avec confirmation). Tes niveaux apparaissent aussi dans **Jouer → Mes niveaux**, avec leurs records.

Dans l'éditeur, la route est vue de dessus (grille en mètres, largeur réelle de la chaussée). Cinq outils :

| Outil | Ce qu'il fait |
|---|---|
| **Route** | Clic dans le vide : ajoute un point à la fin. Glisser un point : le déplacer. Clic sur la route : insère un point. Point sélectionné : largeur, hauteur, Supprimer. |
| **Barrières** | Choisis Gauche, Droite ou Extérieur (extérieur du virage), puis clique sur un tronçon (entre deux points, repérés par des tirets) pour poser ou retirer sa barrière. |
| **Objets** | Palette (arbre, sapin, rocher, pneus, barrière, panneau) : clic pour poser, glisser pour déplacer, boutons ±15° pour tourner, Supprimer. |
| **Décor** | Ambiance (Jour / Coucher), densité, « Autre décor » (nouvelle graine). |
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

Chaque push sur `main` lance les tests puis publie le jeu sur GitHub Pages (Settings → Pages → Source : GitHub Actions).

## Crédits

Décor 3D : [Kenney](https://www.kenney.nl) (Nature Kit), licence CC0 — voir `public/models/LICENCE-kenney.txt`. Les voitures, d'inspiration japonaise, sont générées par le code du jeu.
