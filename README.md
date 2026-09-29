# Drift Club

Jeu de drift en 3D dans le navigateur : enchaîne les drifts sur des routes de montagne et fais le plus de points avant la ligne d'arrivée.

**Jouer :** https://tonoplas909.github.io/drift-club/

## Principe

- Un drift compte dès que la voiture glisse de plus de 15° au-dessus de 30 km/h. Plus l'angle et la vitesse sont grands, plus il rapporte.
- Enchaîne les drifts pour monter le **combo** (jusqu'à x5). Un drift est **encaissé** quand tu te redresses proprement.
- Un **choc** contre une barrière ou le décor, un tête-à-queue ou un replacement font **perdre** le drift en cours et le combo.
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
