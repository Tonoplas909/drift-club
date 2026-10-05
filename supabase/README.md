# Supabase : comptes, classement et niveaux en ligne

Le jeu utilise Supabase pour les comptes (email + mot de passe), le classement et les niveaux publiés depuis l'éditeur. Sans Supabase, tout le reste du jeu fonctionne (records locaux, éditeur…).

## 1. Créer les tables (une seule fois)

1. Ouvre le projet dans le tableau de bord Supabase → **SQL Editor** → **New query**.
2. Colle tout le contenu de [`migrations/0001_comptes_classement.sql`](migrations/0001_comptes_classement.sql), puis fais de même avec [`migrations/0002_classement_tous_modes.sql`](migrations/0002_classement_tous_modes.sql).
3. Fais de même avec [`migrations/0003_niveaux_publics.sql`](migrations/0003_niveaux_publics.sql) (niveaux en ligne, voir plus bas).
4. Fais de même avec [`migrations/0004_mes_places.sql`](migrations/0004_mes_places.sql) (place du joueur dans chaque niveau), puis avec [`migrations/0005_progression_compte.sql`](migrations/0005_progression_compte.sql), [`migrations/0007_nouvelles_voitures.sql`](migrations/0007_nouvelles_voitures.sql) (La Kei, La Muscle, La Rotative et Le Break acceptées au classement) et enfin [`migrations/0006_catalogue_skins.sql`](migrations/0006_catalogue_skins.sql) (clés et livrées dans le compte, voir plus bas). **Ne relance pas `0002` ni `0005` après `0007`** (ils remettraient l'ancienne liste de voitures ; `0007` est sans danger à relancer) : `0005` change le résultat de `soumettre_score` (colonnes de clés ajoutées).
5. **Vérification des scores (anti-triche)** : déploie d'abord l'Edge Function `verifier-course` (voir [« Vérification des scores »](#vérification-des-scores) plus bas), PUIS colle [`migrations/0008_scores_verifies.sql`](migrations/0008_scores_verifies.sql). **Ne relance plus `0002`, `0005` ni `0007` après `0008`** : ils rouvriraient `soumettre_score` aux joueurs.
   Puis, **après avoir redéployé la fonction de la version 0.4.5**, colle [`migrations/0009_cles_en_jouant.sql`](migrations/0009_cles_en_jouant.sql) : une même course ne rapporte qu'une fois, pas de clé plus vite qu'on ne joue, reprise de la progression locale fermée. Si tu relances `0008`, relance `0009` juste après.
6. Clique sur **Run** après chaque collage. Chaque script peut être relancé sans danger (il est idempotent), sauf la remarque ci-dessus.

Il crée :

- `profils` : le pseudo public de chaque compte (3 à 20 caractères : lettres, chiffres, `_`, `-`, espace ; unique sans tenir compte de la casse) ;
- `scores` : une ligne par joueur, niveau et mode, qui garde le meilleur score ;
- `soumettre_score(...)` : l'ancienne façon d'écrire un score (vérifie la connexion, le pseudo et la vraisemblance des valeurs) ; fermée aux joueurs par `0008`, qui la remplace par `enregistrer_score_verifie(...)`, appelée seulement par l'Edge Function `verifier-course` après avoir rejoué la course ;
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
- `importer_progression_locale(debloques, cles)` : reprenait **une seule fois** la progression de l'appareil (livrées du catalogue, 30 clés au plus) ; **fermée par `0009`** (le contenu de l'appareil est modifiable par le joueur : un compte ne gagne plus rien qu'en jouant) ;
- `ouvrir_caisse()` : paie 3 clés, tire la rareté (79,9 / 16 / 3,2 / 0,64 / 0,26 %, poids renormalisés si une rareté est vide) puis une livrée au hasard côté serveur ; un doublon rend 1 clé ; la ligne est verrouillée pendant l'appel (pas de double dépense) ;
- `soumettre_score(...)` (même résultat qu'avant, plus `cles_gagnees`, `cles_record`, `cles`) : +1 clé par arrivée, +1 sur un record en ligne, sans clé si la précédente date de moins de 20 s.

**Livrées et fumées** : `0006_catalogue_skins.sql` est **générée** depuis `src/core/skins.ts` et `src/core/fumees.ts` (les fumées de pneus y sont des lignes `('fumee', id, rareté)`, tirées par les mêmes caisses). Après avoir ajouté ou retiré des livrées, relance `npx vite-node tools/gen-catalogue-sql.ts` puis colle le nouveau `0006` dans le SQL Editor (upsert et suppression, sans danger) ; sinon les nouvelles livrées ne sortent pas des caisses du compte. Un test échoue tant que le fichier n'est pas régénéré.

La sécurité repose sur le RLS : la clé publiable est dans le code du jeu, mais elle ne permet que de lire les profils et scores et d'écrire son propre profil. Aucune écriture directe dans `scores` ni dans `niveaux_publics` ; avec `0008`, les scores ne s'écrivent plus que par l'Edge Function `verifier-course`.

## Vérification des scores

Le jeu tourne dans le navigateur : n'importe qui peut y modifier la variable du score, ou appeler l'API avec le score de son choix. Depuis la version 0.4.4, le serveur **rejoue chaque course** pour vérifier le score.

- Pendant la course, le jeu enregistre les commandes de chaque pas de simulation (1/120 s) : gaz, frein, direction, frein à main, replacement. À l'arrivée, il envoie le score **et** cet enregistrement (quelques ko) à l'Edge Function `verifier-course`.
- La simulation est déterministe : `src/core` n'utilise que des calculs identiques au bit près dans tous les navigateurs (`src/core/math/dmath.ts` remplace `Math.sin`, `Math.atan2`, `Math.hypot`…). La fonction rejoue donc la course avec le même code que le jeu (`course.js`) et retrouve le même score.
- **Score rejoué proche du score envoyé** (écart ≤ 1 % ou 100 points, ≤ 0,5 s) : le score envoyé est gardé, le joueur voit exactement son score. **Écart plus grand** : c'est le score rejoué qui est enregistré, et l'écran des résultats le dit. **Course qui n'atteint pas l'arrivée** (replay tronqué, inventé…) : rien n'est enregistré. Réglages : `TOLERANCE` dans `src/core/replay/verifier.ts`.
- Niveaux officiels : embarqués dans la fonction. Niveaux perso : le jeu envoie le contenu du niveau, la fonction vérifie qu'il correspond à son empreinte (la clé `perso:…`).
- Chaque course vérifiée est notée dans la table **`verifications`** (score annoncé, score rejoué, score retenu, empreinte du replay). Avec `0009`, **une même course n'est enregistrée qu'une fois** (tous joueurs confondus) et les clés ne se gagnent pas plus vite qu'on ne joue : entre deux gains, au moins la durée de la course (et 20 s). Une ligne `corrige` avec un score annoncé bien plus haut que le score rejoué signale une tentative de triche.
- Courses de plus de 10 minutes refusées (temps de calcul du serveur borné).
- Il reste possible de « tricher » en programmant un pilote automatique qui conduit vraiment : il faut alors réellement réussir la course.

### Déployer la fonction

Une seule fois : installe la [CLI Supabase](https://supabase.com/docs/guides/cli), puis `supabase login`.

```bash
supabase functions deploy verifier-course --project-ref studzxweqmgpuhgsvxmi --no-verify-jwt --use-api
```

`--no-verify-jwt` est voulu : la fonction vérifie elle-même le jeton du joueur (sinon la requête CORS préalable du navigateur est refusée). Elle utilise les clés que Supabase lui fournit (`SUPABASE_URL`, clé secrète) : rien à configurer.

**À chaque version qui touche la simulation** (`src/core`, niveaux officiels), il faut régénérer puis redéployer la fonction : `npx vite-node tools/gen-fonction.ts` (un test échoue tant que ce n'est pas fait), puis la commande ci-dessus. Le jeu envoie l'empreinte de sa simulation (`src/online/empreinteSimulation.ts`) ; si la fonction déployée n'a pas la même, le score est refusé avec « recharge la page » et reste enregistré en local.

Ordre de mise en place : 1) déployer la fonction, 2) coller `0008` (puis `0009`, toujours après la fonction de la même version). Tant que la fonction n'est pas déployée ou que `0008` n'est pas passée, le jeu se rabat sur l'ancien envoi (`soumettre_score`, non vérifié).

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

- **Progression du compte** : tout passe par des fonctions du serveur, mais deux points restent basés sur la confiance. (1) Avant `0009`, l'import unique de la progression de l'appareil laissait chaque nouveau compte reprendre une progression locale modifiée (toutes les livrées du catalogue, 30 clés) ; `0009` le ferme. (2) Sans la vérification des scores (`0008`), quelqu'un qui envoie de faux scores gagne des clés, au plus 2 par 20 s (soit environ 360 clés par heure, une caisse toutes les 30 s) ; avec `0008` et `0009`, il faut vraiment finir des courses, chacune une seule fois, et on ne gagne pas plus vite qu'en jouant. Reste possible : un pilote automatique programmé qui conduit vraiment. La progression locale (jeu sans connexion) reste modifiable dans le navigateur, mais elle ne quitte jamais l'appareil. Pour corriger un compte : **Table Editor → progressions**.

- L'expéditeur d'emails intégré à Supabase est **limité en débit** (quelques emails par heure pour tout le projet) : beaucoup d'inscriptions ou de « mot de passe oublié » d'un coup seront refusées. Pour un vrai lancement, configure un SMTP personnalisé (Authentication → SMTP Settings).
- **Avant la migration `0008`** (ou si l'Edge Function n'est pas déployée), le score est calculé dans le navigateur et le serveur ne peut pas le vérifier : `soumettre_score` refuse seulement les valeurs absurdes. Avec `0008` et l'Edge Function, les scores sont rejoués par le serveur (voir plus haut). Pour retirer un score : **Table Editor → scores**.
- Le serveur ne rejoue pas la validation complète d'un niveau (croisements de route…) ni ne recalcule son empreinte : le jeu re-valide chaque niveau reçu et vérifie l'empreinte avant de le charger. Un niveau publié par un joueur malveillant peut donc figurer dans la liste mais sera refusé au chargement. Retire-le dans **Table Editor → niveaux_publics** si besoin.
- Un joueur ne peut publier qu'une fois le même contenu (hors nom et auteur). Deux joueurs peuvent publier le même contenu : ils partagent alors le même classement (même empreinte).
- Les liens de partage `#n=<code>` contiennent tout le niveau et fonctionnent sans Supabase ; seuls les liens `#en-ligne=<id>` et l'onglet « En ligne » en dépendent.
