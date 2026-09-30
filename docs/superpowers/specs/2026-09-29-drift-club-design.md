# Drift Club — spec de conception

- **Date :** 2026-09-29
- **Statut :** validée section par section en discussion, en attente de relecture de ce document
- **Repo :** `Tonoplas909/drift-club` — publié sur `https://tonoplas909.github.io/drift-club/`

---

## 1. Vision

Jeu web de drift en 3D, vue à la troisième personne. On pilote une voiture au clavier (ou au tactile) sur un niveau linéaire — une route de montagne avec départ et arrivée — et le but est de faire **le plus de points possible avant la ligne d'arrivée** en enchaînant les drifts. Direction artistique **toon léger** : cartoon, sans être « dessiné ». Un **éditeur de niveau** permet de créer et partager ses propres routes.

**Public :** Macalamar et ses potes/collègues, en français. PC au clavier en priorité, **jouable sur mobile** au tactile.

**Critères de réussite**
1. La **sensation de drift** est bonne : lancer, tenir et enchaîner un drift est satisfaisant au clavier comme au tactile. C'est le critère n°1 ; le reste passe après.
2. Une course dure 1 à 3 minutes et donne envie d'être rejouée pour battre son score.
3. 60 images/s sur un téléphone moyen (qualité Basse) ; le jeu suit la fréquence de l'écran (120/144 Hz) sur un PC qui le permet.
4. Créer un niveau jouable dans l'éditeur et l'envoyer à un pote par un lien prend quelques minutes.

**Hors périmètre (pour l'instant)** : classement en ligne, médailles, fantôme, multijoueur, cônes/objets renversables, musique, sauts, ponts et croisements de route, manette, environnements autres que « montagne », ambiance de nuit.

## 2. Découpage en lots

- **Lot 1 — jeu jouable** : physique, 3 voitures, 3 modes de conduite, score, décor généré, 3 niveaux officiels (écrits à la main en JSON), menus, contrôles tactiles, son, sauvegarde des records, mise en ligne automatique.
- **Lot 2 — éditeur et partage** : éditeur de niveau, « Mes niveaux », partage par lien / code / fichier `.json`, import.

Une seule spec (ce document), **deux plans d'implémentation**, le lot 1 d'abord.

## 3. Architecture

### 3.1 Pile technique
- **three.js** (seule dépendance d'exécution), **TypeScript**, **Vite** (compilation), **Vitest** (tests).
- Décor 3D : pack **Kenney Nature Kit**, licence CC0, inclus dans le repo. Voitures : **générées par code** (silhouettes d'inspiration japonaise).
- Pas de moteur physique externe : physique de voiture maison.

### 3.2 Principe : simulation séparée du rendu
- La **simulation** (physique, progression, score) est du TypeScript pur, **sans three.js**, testable sans navigateur.
- Elle avance à **pas fixe de 1/120 s**. La boucle de jeu accumule le temps réel écoulé (borné à 0,25 s pour éviter l'effet « spirale ») et exécute autant de pas que nécessaire.
- Le **rendu** tourne à la fréquence de l'écran (`requestAnimationFrame`, sans plafond) et **interpole** la pose de la voiture entre les deux derniers états simulés.
- La simulation est **déterministe** : aucune source de hasard (`Math.random` interdit dans `core/`), aucune dépendance au temps réel. Mêmes entrées ⇒ même résultat au bit près sur un même navigateur. (Limite connue : les fonctions `Math.sin/cos/atan2/exp` peuvent différer d'un moteur JS à l'autre ; une vérification inter-navigateurs — utile pour un futur classement — demanderait des versions maison de ces fonctions. Non nécessaire aujourd'hui.)
- Hasard du décor : générateur pseudo-aléatoire à graine (ex. mulberry32) dans `core/`.

### 3.3 Découpage du code
```
src/
  core/          logique pure, sans three.js, testée
    level/       format de niveau, validation, migration de versions, encodage lien/JSON
    track/       courbe de route, échantillons, terrain (hauteurs), progression, obstacles
    env/         génération procédurale de l'environnement (décor) à partir de la graine
    physics/     modèle de voiture, aides (3 modes), préréglages des 3 voitures, collisions
    scoring/     drift, combo, encaissement, bonus de temps
    math/        vecteurs 2D, PRNG à graine, utilitaires
  render/        three.js : route, terrain, décor instancié, matériaux toon, contours,
                 voiture, fumée, traces, ciel, caméra, qualité graphique
  game/          boucle de jeu, machine à états d'une course, HUD
  editor/        éditeur de niveau (lot 2)
  input/         clavier + tactile → une seule structure d'intention
  ui/            menus HTML/CSS superposés à la 3D
  audio/         sons synthétisés (Web Audio)
  storage/       réglages, records, mes niveaux (localStorage)
  debug/         panneau de réglage `?debug`
levels/          niveaux officiels (JSON)
public/models/   modèles Kenney (.glb) + licence
```

### 3.4 Flux de données
```
niveau JSON ──validation/migration──▶ Level
Level ──buildTrack()──▶ TrackData (échantillons, terrain, obstacles, temps cible)
Level.decor + TrackData ──generateEnvironment()──▶ Environment (objets placés, obstacles solides)
TrackData + Environment + InputState ──step(1/120 s)──▶ CarState, RaceState, ScoreState
TrackData + Environment + états interpolés ──render/──▶ image
```
La simulation et le rendu lisent **les mêmes** `TrackData` et `Environment` : ce qu'on voit est exactement ce qui est simulé.

## 4. Physique de conduite

### 4.1 Modèle
- Corps rigide **dans le plan du sol** : position `(x, z)`, cap `ψ`, vitesse `(vx, vz)`, vitesse de lacet `r`, angle de braquage `δ`.
- **Modèle bicyclette** : un essieu avant, un essieu arrière.
- **Force latérale des pneus** : formule de Pacejka simplifiée `F = μ·Fz·sin(C·atan(B·α))` (α = angle de dérive de l'essieu) — montée, pic, léger décrochage au-delà. Paramètres `μ, B, C` par essieu.
- **Cercle d'adhérence** : la force longitudinale (motricité, freinage) consomme l'adhérence disponible ; la capacité latérale restante vaut `√(1 − (Fx/μFz)²)`. Voitures **propulsion** : le coup de gaz fait décrocher l'arrière.
- **Transfert de masse longitudinal** : `Fz_av = m·g·b/L − m·ax·h/L`, `Fz_ar = m·g·a/L + m·ax·h/L` (a, b : distances centre de gravité → essieux, h : hauteur du centre de gravité).
- **Frein à main** : bloque l'arrière (force de freinage arrière + μ arrière × 0,5).
- **Pente** : la gravité projetée sur le gradient du terrain accélère en descente et freine en montée.
- **Résistances** : traînée aérodynamique + résistance au roulement. **Hors route (herbe)** : μ × 0,7 et résistance au roulement accrue.
- **Basse vitesse** (< 3 m/s) : transition vers un modèle cinématique pour éviter les instabilités des angles de dérive.
- **Marche arrière** : frein maintenu à l'arrêt ⇒ recule.
- **Boîte automatique** ; régime moteur calculé pour le son uniquement.
- **Affichage seulement** : hauteur, tangage et roulis de la caisse suivent le terrain et les accélérations. La voiture reste collée au sol (pas de sauts).
- Intégration : Euler semi-implicite à 120 Hz.

### 4.2 Direction
- Au clavier (tout ou rien), l'angle de braquage **monte progressivement** vers la consigne (vitesse de braquage paramétrable) et revient au centre au relâché.
- Braquage maximal **réduit avec la vitesse**.
- Au tactile, le « volant » donne une consigne analogique −1…1.

### 4.3 Modes de conduite (aides par-dessus la même physique)

| | Arcade | Semi-arcade (référence) | Exigeant |
|---|---|---|---|
| Lancer le drift | bouton Drift (Espace) | frein à main, freinage, coup de gaz | idem, sans aide |
| Contre-braquage auto `δ += k·β` | k = 1,0 | k = 0,5 | k = 0 |
| Angle de dérive visé | `β_cible = consigne × 40°` en maintenant Drift | — | — |
| Limiteur de tête-à-queue (couple anti-lacet au-delà de β_max) | β_max = 55° | β_max = 75° | aucun |
| Perte de vitesse en drift | très faible (traînée réduite) | modérée | réaliste |

β = angle entre la direction de la vitesse et le cap de la voiture.

**Bouton Drift en Arcade** : tant qu'il est maintenu au-delà de 30 km/h, μ arrière × 0,6 et un contrôleur de lacet amène β vers `β_cible` ; relâché, la voiture se redresse d'elle-même.

**Méthode de réglage** : le semi-arcade est réglé en premier jusqu'à ce qu'il soit bon ; Arcade et Exigeant en sont dérivés en ajoutant/retirant des aides.

### 4.4 Les 3 voitures (jeux de paramètres)
Paramètres par voiture : masse, courbe de force moteur, vitesse max, empattement L, position du centre de gravité (a/L), hauteur h, μ/B/C avant et arrière, braquage max, vitesse de braquage.

| Voiture | Caractère |
|---|---|
| **L'Équilibrée** | référence pour débuter, prévisible |
| **La Légère** | peu puissante, très agile, on la fait décrocher par transfert de masse |
| **La Turbo** | grosse GT, beaucoup de couple, décroche au gaz, plus dure à tenir |

Les voitures sont **d'inspiration japonaise** (culture drift), générées par code dans le même style toon, sans nom ni logo de marque : La Légère = petit coupé à hayon des années 80 à phares escamotables (esprit AE86), L'Équilibrée = coupé fastback à petit becquet (esprit Silvia), La Turbo = grosse GT à long capot et grand aileron (esprit Supra / Skyline). Couleur de carrosserie : 8 couleurs au choix.

### 4.5 Collisions
- Voiture ≈ **3 cercles** alignés sur son axe (avant, centre, arrière).
- Obstacles : **cercles** (arbres, rochers, piles de pneus, panneaux) et **segments** (barrières), rangés dans une **grille spatiale**.
- Réponse : séparation, rebond de la vitesse normale (restitution 0,3), frottement tangentiel (garde 80 %), impulsion de lacet selon le point de contact.
- Un contact est un **choc** (au sens du score) si la vitesse normale d'impact dépasse **2,5 m/s**.

### 4.6 Replacer (touche R / bouton tactile)
Remet la voiture au centre de la route, 5 m avant le point de progression maximale atteint, dans l'axe de la route, vitesse nulle. Le chrono continue.

### 4.7 Panneau de réglage `?debug`
Ajouter `?debug` à l'URL affiche un panneau avec des curseurs pour tous les paramètres (voitures, aides des modes, score, caméra), modifiables en direct, et un bouton « Copier les paramètres » (JSON) pour les reporter dans le code. Affiche aussi β, vitesse, forces des essieux, FPS.

## 5. Niveaux et piste

### 5.1 Format de niveau (v1)
```json
{
  "format": 1,
  "nom": "Col du Loup",
  "auteur": "Macalamar",
  "environnement": "montagne",
  "ambiance": "coucher",
  "route": [ { "x": 0, "z": 0, "y": 0, "l": 10 } ],
  "barrieres": [ { "de": 3, "a": 7, "cote": "ext" } ],
  "decor": { "graine": 4821, "densite": 0.6 },
  "objets": [ { "type": "rocher", "x": 12.5, "z": 40, "rot": 90 } ]
}
```

| Champ | Type / contraintes |
|---|---|
| `format` | entier ; 1 pour cette version. Les versions antérieures sont converties (migration) au chargement. |
| `nom` | 1–40 caractères |
| `auteur` | 0–30 caractères |
| `environnement` | `"montagne"` (seul disponible au lot 1) |
| `ambiance` | `"jour"` ou `"coucher"` |
| `route` | 2–150 points ; `x`, `z` en mètres ; `y` (hauteur) ∈ [−50, 150] ; `l` (largeur) ∈ [6, 20] ; distance entre points consécutifs ∈ [5, 150] m. Départ = premier point, arrivée = dernier. |
| `barrieres` | tronçons de `de` à `a` (indices de points, `de < a`), `cote` ∈ `gauche`, `droite`, `deux`, `ext` (extérieur du virage : suit le côté extérieur, change de côté aux inflexions). Ailleurs, le bord donne sur l'herbe. |
| `decor` | `graine` entier ∈ [0, 2³¹−1] ; `densite` ∈ [0, 1] |
| `objets` | 0–300 ; `type` ∈ `arbre`, `sapin`, `rocher`, `pneus`, `barriere`, `panneau` ; `rot` en degrés |

Longueur de route totale ≤ 3 km.

### 5.2 Construction de la piste (`buildTrack`)
- Courbe **Catmull-Rom centripète** passant par les points (évite boucles et pointes) ; hauteur et largeur interpolées le long de la courbe.
- **Échantillons tous les 1 m** : position 3D, tangente, normale latérale, largeur, abscisse curviligne `s`, courbure signée.
- **Temps cible** : `Σ ds / v_ref(κ)` avec `v_ref = clamp(√(a_lat / |κ|), 12 m/s, 30 m/s)`, `a_lat = 8 m/s²` (réglable).
- **Vibreurs** automatiques sur les bords intérieurs et extérieurs des tronçons de rayon < 40 m.

### 5.3 Terrain
- **Grille de hauteurs** couvrant une bande autour de la route : maille de 2 m jusqu'à 120 m de la route, maille de 8 m jusqu'à 400 m.
- Hauteur = hauteur de route au plus près (moins 0,15 m sous la chaussée), puis collines qui s'élèvent progressivement avec l'éloignement (bruit à graine).
- Requête de hauteur et de gradient par interpolation bilinéaire — **utilisée par la physique et par le rendu**.
- Anneau de montagnes lointaines (vers 600 m) : décor de fond purement visuel.

### 5.4 Progression et anti-raccourci
- La voiture est projetée sur l'échantillon de route le plus proche, en cherchant **uniquement dans une fenêtre** autour du dernier échantillon connu (−20 m / +30 m).
- Si la voiture est à plus de `largeur/2 + 25 m` de la route, la progression est gelée.
- On retient la **progression maximale** atteinte. L'arrivée est franchie quand la progression atteint la fin de la route, voiture sur la chaussée.
- **Mauvais sens** : si la progression recule pendant plus de 2 s, message « Mauvais sens ! ».
- **Limite de zone** : si la voiture s'éloigne à plus de 35 m de l'axe de la route, elle est automatiquement replacée (comme R, §4.6, avec les mêmes conséquences sur le score).

### 5.5 Environnement procédural (`generateEnvironment`)
Entièrement déterminé par `environnement`, `graine`, `densite` et la route. Pour « montagne » :
- **Forêt en bosquets** : un bruit à graine définit zones denses, clairières et lisières ; mélange sapins/feuillus, variations de taille et de rotation.
- **Rochers**, plus fréquents sur les pentes raides.
- **Bord de route** : panneaux à chevrons à l'extérieur des virages de rayon < 30 m, bornes le long des bords tous les ~25 m.
- **Couloir libre** : rien n'est généré à moins de `largeur/2 + 3 m` de l'axe, ni à moins de 4 m d'un objet placé à la main.
- **Solide** : tout objet à moins de 40 m de l'axe de la route (collision). Au-delà : visuel seulement — la voiture ne peut pas l'atteindre (§5.4, limite de zone).
- Un environnement est une **donnée** (palette, types d'objets, règles de placement) : ajouter « neige », « désert », etc. plus tard ne demande pas de nouveau code de génération.

### 5.6 Validation
Un niveau importé ou édité est validé : types, bornes du tableau 5.1, limites, **aucun croisement de route** (deux portions non voisines de la route à moins de `largeur_a/2 + largeur_b/2 + 4 m`), virages de rayon < 8 m signalés. Résultat : liste d'erreurs lisibles en français. Un niveau invalide n'est jamais chargé dans le jeu.

### 5.7 Niveaux officiels (lot 1)
Trois niveaux, du plus facile au plus dur (noms provisoires) :
1. **Premiers virages** — jour, route large, grandes courbes, ~1 min.
2. **Forêt des Pins** — jour, S enchaînés, dénivelé modéré, ~1 min 30.
3. **Col du Loup** — coucher, épingles, fort dénivelé, barrières, ~2 min.

## 6. Score

Toutes les valeurs ci-dessous sont des **valeurs de départ**, réglables dans `?debug`.

### 6.1 Drift
- Un drift est **actif** quand `β > 15°` et vitesse > 30 km/h.
- Gain par seconde : `10 × f(β) × vitesse_kmh`, où `f` vaut 0,5 à 15°, monte linéairement à 1,0 à 25°, reste à 1,0 jusqu'à 60°, redescend à 0,5 à 90°.
- **Tête-à-queue** (`β > 90°`) : drift en cours **perdu**, combo remis à x1.
- Les points ne s'accumulent que si la voiture **avance** (vitesse de progression le long de la route ≥ 2 m/s) et est **sur la chaussée**. Dans l'herbe, le drift continue mais ne rapporte rien.

### 6.2 Encaissement, combo, perte
- Un drift est **encaissé** quand il reste inactif pendant **0,5 s** : `score += points_du_drift × multiplicateur`. Si un nouveau drift démarre avant 0,5 s, c'est le **même** drift qui continue (enchaînement).
- Chaque encaissement augmente le **multiplicateur** d'un cran (x1 → x5 max).
- Le multiplicateur retombe à x1 après **2 s sans drift actif** depuis le dernier encaissement.
- **Perte** (drift en cours annulé, multiplicateur à x1) : choc (§4.5), replacer (R ou limite de zone), tête-à-queue.
- En franchissant l'arrivée, le drift en cours est encaissé automatiquement.

### 6.3 Bonus de temps
`bonus = max(0, temps_cible − temps) × 2000` points par seconde d'avance. Ordre de grandeur visé : une bonne course de 2 min ≈ 135 000 points de drift et ≈ 15 s d'avance ⇒ ≈ 30 000 de bonus. Le coefficient est calibré pendant le réglage pour que le bonus pèse **15–25 %** du score d'une bonne course.

**Score final** = points de drift encaissés + bonus de temps.

### 6.4 HUD
- En haut : score total, chrono.
- Au centre : points du drift en cours (× multiplicateur affiché), qui grossissent ; flash **vert** à l'encaissement, **rouge** à la perte.
- Barre de progression départ → arrivée.

### 6.5 Records
Un record par **niveau × mode** : score, temps, voiture, meilleur drift, date.

## 7. Contrôles

### 7.1 Intention de pilotage (`InputState`)
`{ gaz: 0..1, frein: 0..1, direction: −1..1, freinAMain: booléen }`, plus les actions `replacer`, `pause`, `camera`. Le clavier et le tactile produisent la même structure ; la simulation ne connaît qu'elle.

### 7.2 Clavier
Touches lues par **position physique** (`KeyboardEvent.code`) : AZERTY et QWERTY fonctionnent sans réglage.

| Action | Touches |
|---|---|
| Accélérer | Z/W, ↑ |
| Freiner / reculer | S, ↓ |
| Tourner | Q/A, D, ←, → |
| Frein à main (bouton Drift en Arcade) | Espace |
| Replacer | R |
| Caméra proche / éloignée | C |
| Pause | Échap, P |
| Muet / plein écran | M / F |

### 7.3 Tactile
- Affiché si l'appareil a un pointeur grossier (`pointer: coarse`) ou dès le premier toucher.
- **Pouce gauche** : zone « volant » — glisser horizontalement, consigne proportionnelle au déplacement.
- **Pouce droit** : boutons Gaz, Frein, Drift (le bouton Drift est le frein à main hors mode Arcade, comme Espace au clavier).
- **En haut** : Pause, Replacer.
- Option **accélération automatique** (activée par défaut au tactile).
- En **portrait** : message « Tourne ton téléphone ».
- Mode de conduite par défaut au tactile : **Arcade**.

## 8. Caméra, déroulé, interface, son

### 8.1 Caméra de poursuite
- Placée derrière la voiture selon la **direction de la vitesse** (lissée), pas selon le cap : en drift on voit la voiture de trois-quarts, en travers. Sous 2 m/s, suit le cap.
- Suivi amorti (`1 − e^(−k·dt)`), léger regard vers l'avant.
- Champ de vision 60° → 72° selon la vitesse ; secousse proportionnelle aux chocs.
- Deux distances (C) : proche (7 m, hauteur 2,8 m) et éloignée (10 m, hauteur 4 m).

### 8.2 Déroulé d'une course
`Accueil → Choix du niveau → Décompte 3-2-1 → Course → Résultats`
- **Résultats** : score (détail drift + bonus), chrono, meilleur drift, « Nouveau record ! » le cas échéant. Boutons **Recommencer**, **Niveau suivant** (niveaux officiels), **Menu**.
- **Pause** : Reprendre, Recommencer, Menu.
- Voiture, couleur et mode mémorisés d'une course à l'autre.
- Pause automatique quand l'onglet est masqué.

### 8.3 Écrans
- **Accueil** : Jouer, Éditeur (lot 2), Réglages.
- **Choix du niveau** : Officiels, Mes niveaux (lot 2), Importer (lot 2) ; record affiché pour le mode courant.
- **Garage** : 3 voitures (aperçu 3D tournant), 8 couleurs, plusieurs livrées par voiture (décors procéduraux posés sur la couleur choisie ; « Unie » par défaut ; livrée mémorisée par voiture).
- **Réglages** : mode de conduite, volume, qualité graphique (Auto/Basse/Haute), options tactiles.
- Style : menus HTML/CSS colorés, formes arrondies, contours marqués, cohérents avec le toon. Lisibles sur mobile.

### 8.4 Son (Web Audio, synthétisé, aucun fichier)
- Moteur : oscillateurs + filtre dont la fréquence suit le régime.
- Crissement : bruit filtré, volume selon la glisse des pneus arrière.
- Choc, encaissement, perte, décompte : sons courts.
- Démarre au premier clic/toucher (exigence des navigateurs). Pas de musique au lot 1.

## 9. Rendu et performance

### 9.1 Style toon
- `MeshToonMaterial` avec une rampe partagée à **3 tons** (filtrage « nearest »).
- **Contours** noirs fins (coque inversée) sur la voiture et le décor ; pas sur le sol ni la route.
- **Route** : asphalte, lignes blanches de bord, ligne centrale en pointillés, vibreurs rouge/blanc (§5.2).
- **Terrain** : couleurs par sommet (herbe claire/foncée par bruit, plus sombre sous la forêt, roche sur les pentes raides).
- **Ciel** en dégradé + **brouillard** de même teinte.
- **Ambiances** `jour` et `coucher` : palettes ciel/lumière/brouillard.
- Décor Kenney : ses matériaux sont remplacés par des matériaux toon de même couleur. Voitures : profil latéral extrudé (caisse, habitacle vitré, passages de roues), détails en blocs (feux, pare-chocs, aileron), roues procédurales.

### 9.2 Effets
- Fumée de pneus : particules instanciées, pool fixe.
- Traces de gomme sur la route : tampon circulaire (les plus anciennes disparaissent).

### 9.3 Performance
- Décor : un `InstancedMesh` par type d'objet.
- Terrain découpé en morceaux de 64 × 64 m, masqués hors du champ de la caméra.
- Une seule lumière à ombres, cadrée autour de la voiture.

| Qualité | Basse | Haute |
|---|---|---|
| Résolution | pixelRatio 1 | min(devicePixelRatio, 2) |
| Ombres | non | oui (2048, zone ~60 m) |
| Contours | voiture + décor < 40 m | tout le décor visible |
| Fin du brouillard | 180 m | 350 m |
| Décor lointain | 50 % | 100 % |
| Particules de fumée max | 60 | 150 |

- **Auto** (défaut) : démarre en Haute sur PC (`pointer: fine`), Basse sur mobile ; passe de Haute à Basse si la moyenne descend **sous 50 images/s pendant 3 s** en course. Pas de remontée automatique.
- Objectifs : 60 images/s en Basse sur téléphone moyen ; fréquence de l'écran (60/120/144 Hz) sur PC en Haute.

## 10. Éditeur de niveau (lot 2)

### 10.1 Accès
Accueil → Éditeur : **Nouveau niveau**, modifier un de **Mes niveaux**, ou **copie d'un niveau officiel**.

### 10.2 Vue
- **Vue de dessus** (caméra orthographique) avec le rendu du jeu ; déplacement par glisser, zoom à la molette ou par pincement.
- Bouton **Vue 3D libre** (orbite) pour vérifier le relief.

### 10.3 Outils
1. **Route** : clic = ajouter un point en fin de route ; glisser = déplacer ; clic sur un tronçon = insérer un point ; point sélectionné → largeur, hauteur, supprimer. **Profil en long** en bas d'écran (hauteur en fonction de la distance), où l'on fait glisser les points verticalement.
2. **Barrières** : clic sur un côté de tronçon = ajouter/retirer une barrière.
3. **Objets** : palette (arbre, sapin, rocher, pile de pneus, barrière, panneau) ; clic = poser ; glisser = déplacer ; tourner ; supprimer.
4. **Décor** : environnement, graine (bouton « Autre décor »), densité, ambiance.
5. **Infos** : nom, auteur.

### 10.4 Aides
- **Validation en direct** (§5.6) : croisements surlignés en rouge, virages trop serrés signalés, compteur points/objets vs limites. Un niveau invalide ne peut être ni testé ni partagé ; la raison est affichée.
- **Tester** : lance la course immédiatement (voiture et mode courants) ; Échap revient à l'éditeur dans le même état.
- **Annuler / Rétablir** : Ctrl+Z / Ctrl+Y et boutons ; historique de 100 états.
- **Sauvegarde automatique** dans le navigateur.
- **Mes niveaux** : renommer, dupliquer, exporter, supprimer (avec confirmation).
- **Tactile** : toucher, glisser, pincer, poignées agrandies. Pensé d'abord pour PC.

## 11. Partage (lot 2)

- **Encodage** : JSON compact (clés courtes, tableaux), coordonnées arrondies à 0,1 m et stockées en entiers, compression `deflate-raw` (API `CompressionStream` du navigateur), base64url.
- **Lien** : `https://tonoplas909.github.io/drift-club/#n=<code>` (le fragment `#` n'est jamais envoyé au serveur). Objectif : < 2 000 caractères pour un niveau typique (≈ 40 points, ≈ 30 objets) grâce au décor généré par graine.
- **Bouton Partager** : Copier le lien, Copier le code, Télécharger le `.json` (format lisible du §5.1).
- **Ouverture d'un lien** : carte « Niveau partagé : *nom*, par *auteur* » → Jouer / Enregistrer dans mes niveaux.
- **Importer** : coller un code ou charger un `.json`.
- Tout import passe par la validation (§5.6).
- **Précisions de mise en œuvre** : le code est `1.<base64url>` (le `1` est la version du code) ; le JSON compact stocke la route en différences successives ; le décodage plafonne le JSON à 200 ko et applique la validation complète. Le niveau reçu est le niveau **arrondi** (0,1 m, rotation au degré, densité au centième) : c'est lui qu'on publie et dont on calcule l'empreinte, pour que tous les joueurs partagent les mêmes records. Le lien `#en-ligne=<uuid>` désigne un niveau publié (Supabase, migration `0003`).
- **Records** d'un niveau non officiel : liés à une empreinte SHA-256 de son contenu canonique **hors `nom` et `auteur`** (renommer ne réinitialise pas les records ; modifier la route, si). Niveaux officiels : liés à leur identifiant.

## 12. Sauvegarde (localStorage)

| Clé | Contenu |
|---|---|
| `driftclub.v1.reglages` | mode, voiture, couleur, livrée par voiture (`skins`, optionnel : absent = « unie »), volume, qualité, options tactiles |
| `driftclub.v1.records` | `{ [cléNiveau]: { [mode]: { score, temps, voiture, meilleurDrift, date } } }` |
| `driftclub.v1.niveaux` | mes niveaux (lot 2) |

- Toutes les lectures/écritures sont protégées ; si le stockage est indisponible (navigation privée…), le jeu reste jouable et un message indique que rien ne sera enregistré.
- Le préfixe de version permet de migrer les données sans perdre les records.

## 13. Gestion des erreurs

| Situation | Comportement |
|---|---|
| WebGL indisponible | écran explicatif |
| Échec de chargement des modèles | écran avec « Réessayer » |
| Niveau importé invalide | message listant les erreurs, rien n'est chargé |
| Onglet masqué | pause automatique ; temps accumulé borné au retour |
| Audio bloqué | démarrage au premier clic/toucher |
| Stockage indisponible | jeu jouable, message d'avertissement |

## 14. Tests

- **Vitest, écrits avant le code** (TDD) sur `core/` :
  - format de niveau : validation (cas valides/invalides), migration ;
  - encodage : aller-retour lien et code (lot 2) ;
  - piste : échantillonnage, abscisse curviligne, temps cible, progression, **anti-raccourci dans une épingle** ;
  - terrain : hauteur et gradient, chaussée sous la route ;
  - environnement : même graine ⇒ même décor ; rien dans le couloir de la route ni près des objets manuels ;
  - score : encaissement, enchaînement, combo et plafond, retombée du combo, perte (choc, replacer, tête-à-queue), anti-donut, herbe ;
  - physique : accélération et vitesse max dans les plages attendues, le frein à main fait décrocher l'arrière (β > 20°), l'Arcade empêche le tête-à-queue, pente, collisions ;
  - **déterminisme** : une séquence d'entrées rejouée deux fois ⇒ états finaux identiques au bit près.
- **Rendu, menus, tactile, éditeur** : vérification manuelle dans le navigateur intégré, en taille ordinateur et mobile, à chaque étape du plan.

## 15. Mise en ligne

- Dépôt local relié à `Tonoplas909/drift-club`, branche `main`.
- **GitHub Action** à chaque push sur `main` : `npm ci` → `npm test` → `npm run build` → publication sur GitHub Pages. Un test en échec bloque la publication.
- Vite configuré avec `base: '/drift-club/'`.
- **Action manuelle de Macalamar** (une fois) : *Settings → Pages → Source : GitHub Actions*.
- `README.md` en français : présentation, lien de jeu, commandes, modes, crédits (décor Kenney, CC0). Licence Kenney jointe dans `public/models/`.
