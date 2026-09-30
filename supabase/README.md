# Supabase : comptes, classement et niveaux en ligne

Le jeu utilise Supabase pour les comptes (email + mot de passe), le classement et les niveaux publiés depuis l'éditeur. Sans Supabase, tout le reste du jeu fonctionne (records locaux, éditeur…).

## 1. Créer les tables (une seule fois)

1. Ouvre le projet dans le tableau de bord Supabase → **SQL Editor** → **New query**.
2. Colle tout le contenu de [`migrations/0001_comptes_classement.sql`](migrations/0001_comptes_classement.sql), puis fais de même avec [`migrations/0002_classement_tous_modes.sql`](migrations/0002_classement_tous_modes.sql).
3. Fais de même avec [`migrations/0003_niveaux_publics.sql`](migrations/0003_niveaux_publics.sql) (niveaux en ligne, voir plus bas).
4. Fais de même avec [`migrations/0004_mes_places.sql`](migrations/0004_mes_places.sql) (place du joueur dans chaque niveau), puis avec [`migrations/0005_progression_compte.sql`](migrations/0005_progression_compte.sql), [`migrations/0007_nouvelles_voitures.sql`](migrations/0007_nouvelles_voitures.sql) (La Kei, La Muscle, La Rotative et Le Break acceptées au classement) et enfin [`migrations/0006_catalogue_skins.sql`](migrations/0006_catalogue_skins.sql) (clés et livrées dans le compte, voir plus bas). **Ne relance pas `0002` ni `0005` après `0007`** (ils remettraient l'ancienne liste de voitures ; `0007` est sans danger à relancer) : `0005` change le résultat de `soumettre_score` (colonnes de clés ajoutées).
5. Clique sur **Run** après chaque collage. Chaque script peut être relancé sans danger (il est idempotent), sauf la remarque ci-dessus.

Il crée :

- `profils` : le pseudo public de chaque compte (3 à 20 caractères : lettres, chiffres, `_`, `-`, espace ; unique sans tenir compte de la casse) ;
- `scores` : une ligne par joueur, niveau et mode, qui garde le meilleur score ;
- `soumettre_score(...)` : la seule façon d'écrire un score (vérifie la connexion, le pseudo et la vraisemblance des valeurs) ;
- `classement_niveau(niveau, limite)` : les meilleurs scores d'un niveau tous modes confondus, lisibles par tout le monde (migration `0002`). L'ancienne `classement(niveau, mode, limite)` reste pour les versions déjà ouvertes du jeu.

La migration `0003` ajoute :

- `niveaux_publics` : les niveaux publiés (données JSON au format §5.1, empreinte SHA-256 unique, nombre de parties), lisibles par tout le monde ;
- `publier_niveau(donnees, empreinte, longueur)` : réservée aux comptes connectés avec pseudo ; contrôle la forme du niveau (nom, 2 à 150 points, 300 objets, 60 ko, 3 km) ; **50 niveaux au plus par joueur et 10 par 24 h** ; un contenu déjà publié par le même joueur renvoie l'existant (pas de doublon) ;
- `retirer_niveau(id)` : seul l'auteur peut retirer son niveau ;
- `compter_partie(id)` : +1 partie (compteur approximatif, ouvert aux joueurs non connectés) ;
- `niveaux_en_ligne(tri, limite, decalage)` et `niveau_en_ligne(id)` : liste (récents ou populaires, 50 au plus par page) et niveau complet, lisibles par tout le monde.

La migration `0005` ajoute la progression dans le compte :

- `catalogue_skins(voiture, id, rarete)` : les livrées qui sortent des caisses (« unie » exclue), lisible par tout le monde ; remplie par `0006` ;
- `progressions` : une ligne par joueur (clés, livrées `voiture:skin`, caisses ouvertes…), lisible par son propriétaire seulement, **aucune écriture directe** ;
- `ma_progression()` : renvoie la ligne, créée à la première demande avec les 3 clés offertes ;
- `importer_progression_locale(debloques, cles)` : reprend **une seule fois** la progression de l'appareil (livrées du catalogue seulement, 30 clés au plus) ;
- `ouvrir_caisse()` : paie 3 clés, tire la rareté (79,9 / 16 / 3,2 / 0,64 / 0,26 %, poids renormalisés si une rareté est vide) puis une livrée au hasard côté serveur ; un doublon rend 1 clé ; la ligne est verrouillée pendant l'appel (pas de double dépense) ;
- `soumettre_score(...)` (même résultat qu'avant, plus `cles_gagnees`, `cles_record`, `cles`) : +1 clé par arrivée, +1 sur un record en ligne, sans clé si la précédente date de moins de 20 s.

**Livrées** : `0006_catalogue_skins.sql` est **générée** depuis `src/core/skins.ts`. Après avoir ajouté ou retiré des livrées, relance `npx vite-node tools/gen-catalogue-sql.ts` puis colle le nouveau `0006` dans le SQL Editor (upsert et suppression, sans danger) ; sinon les nouvelles livrées ne sortent pas des caisses du compte. Un test échoue tant que le fichier n'est pas régénéré.

La sécurité repose sur le RLS : la clé publiable est dans le code du jeu, mais elle ne permet que de lire les profils et scores, d'écrire son propre profil et d'appeler `soumettre_score`. Aucune écriture directe dans `scores` ni dans `niveaux_publics`.

## 2. Réglages d'authentification recommandés

**Authentication → URL Configuration**

- **Site URL** : `https://tonoplas909.github.io/drift-club/`
- **Redirect URLs** : ajoute `http://localhost:5173/drift-club/` (pour développer en local).

Ces adresses servent aux liens des emails (confirmation d'inscription, mot de passe oublié) : le lien ramène le joueur dans le jeu, déjà connecté.

**Authentication → Providers → Email**

- Laisse **Confirm email** activé si le jeu est public. Le joueur doit alors cliquer sur le lien reçu par email avant de pouvoir envoyer des scores.
- Pour un jeu entre amis, tu peux désactiver **Confirm email** : l'inscription connecte immédiatement, sans email.
- Les connexions anonymes restent désactivées.

## 3. Limites à connaître

- **Progression du compte** : tout passe par des fonctions du serveur, mais deux points restent basés sur la confiance. (1) L'import unique de la progression de l'appareil : le serveur ne peut pas vérifier ce que contenait l'appareil, il se contente de le borner (livrées du catalogue, 30 clés, une fois par compte) ; chaque nouveau compte peut donc reprendre une fois une progression locale, éventuellement modifiée. (2) Le score est calculé dans le navigateur : quelqu'un qui envoie de faux scores gagne des clés, au plus 2 par 20 s (soit environ 360 clés par heure, une caisse toutes les 30 s). Pour corriger un compte : **Table Editor → progressions**.

- L'expéditeur d'emails intégré à Supabase est **limité en débit** (quelques emails par heure pour tout le projet) : beaucoup d'inscriptions ou de « mot de passe oublié » d'un coup seront refusées. Pour un vrai lancement, configure un SMTP personnalisé (Authentication → SMTP Settings).
- Le score est calculé dans le navigateur : le serveur ne peut pas le vérifier. `soumettre_score` refuse seulement les valeurs absurdes (temps hors de 5 à 1800 s, score hors de 0 à 2 000 000, meilleur drift supérieur au score). Un joueur motivé peut donc tricher ; supprime la ligne concernée dans **Table Editor → scores** si besoin.
- Le serveur ne rejoue pas la validation complète d'un niveau (croisements de route…) ni ne recalcule son empreinte : le jeu re-valide chaque niveau reçu et vérifie l'empreinte avant de le charger. Un niveau publié par un joueur malveillant peut donc figurer dans la liste mais sera refusé au chargement. Retire-le dans **Table Editor → niveaux_publics** si besoin.
- Un joueur ne peut publier qu'une fois le même contenu (hors nom et auteur). Deux joueurs peuvent publier le même contenu : ils partagent alors le même classement (même empreinte).
- Les liens de partage `#n=<code>` contiennent tout le niveau et fonctionnent sans Supabase ; seuls les liens `#en-ligne=<id>` et l'onglet « En ligne » en dépendent.
