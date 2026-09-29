# Drift Club

Jeu de drift en 3D dans le navigateur : enchaine les drifts sur des routes de montagne et fais le plus de points avant la ligne d'arrivee.

**Jouer :** https://tonoplas909.github.io/drift-club/

## Principe

- Un drift compte des que la voiture glisse de plus de 15° au-dessus de 30 km/h. Plus l'angle et la vitesse sont grands, plus il rapporte.
- Enchaine les drifts pour monter le **combo** (jusqu'a x5). Un drift est **encaisse** quand tu te redresses proprement.
- Un **choc** contre une barriere ou le decor, un tete-a-queue ou un replacement font **perdre** le drift en cours et le combo.
- A l'arrivee, un **bonus de temps** recompense les courses rapides.

## Modes de conduite

| Mode | Pour qui |
|---|---|
| **Arcade** | Bouton Drift : glissade guidee, pas de tete-a-queue. Ideal au tactile. |
| **Semi-arcade** | On lance le drift soi-meme (frein a main, coup de gaz), contre-braquage aide. |
| **Exigeant** | Aucune aide. |

Trois voitures : **L'Equilibree** (pour debuter), **La Legere** (agile) et **La Turbo** (puissante). Les records sont enregistres par niveau et par mode.

## Commandes

| Action | Clavier |
|---|---|
| Accelerer | Z / W / ↑ |
| Freiner / reculer | S / ↓ |
| Tourner | Q / A / D / ← → |
| Frein a main (Drift en Arcade) | Espace |
| Replacer sur la route | R |
| Camera proche / eloignee | C |
| Pause | Echap / P |
| Muet / plein ecran | M / F |

Au tactile : glisse le pouce gauche pour tourner, boutons Gaz, Frein et Drift a droite (acceleration automatique activable dans les reglages).

## Developpement

```bash
npm install
npm run dev      # serveur local
npm test         # tests
npm run build    # version publiee (dist/)
```

Ajoute `?debug` a l'adresse pour afficher le panneau de reglage de la conduite.

Chaque push sur `main` lance les tests puis publie le jeu sur GitHub Pages (Settings → Pages → Source : GitHub Actions).

## Credits

Decor 3D : [Kenney](https://www.kenney.nl) (Nature Kit), licence CC0 — voir `public/models/LICENCE-kenney.txt`. Les voitures, d'inspiration japonaise, sont generees par le code du jeu.
