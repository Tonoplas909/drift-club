# Supabase : comptes, classement et niveaux en ligne

Le jeu utilise Supabase pour les comptes (email + mot de passe), le classement et les niveaux publiés depuis l'éditeur. Sans Supabase, tout le reste du jeu fonctionne (records locaux, éditeur…).

## 1. Créer les tables (une seule fois)

1. Ouvre le projet dans le tableau de bord Supabase → **SQL Editor** → **New query**.
2. Colle tout le contenu de [`migrations/0001_comptes_classement.sql`](migrations/0001_comptes_classement.sql), puis fais de même avec [`migrations/0002_classement_tous_modes.sql`](migrations/0002_classement_tous_modes.sql).
3. Fais de même avec [`migrations/0003_niveaux_publics.sql`](migrations/0003_niveaux_publics.sql) (niveaux en ligne, voir plus bas).
4. Clique sur **Run** après chaque collage. Chaque script peut être relancé sans danger (il est idempotent).

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

- L'expéditeur d'emails intégré à Supabase est **limité en débit** (quelques emails par heure pour tout le projet) : beaucoup d'inscriptions ou de « mot de passe oublié » d'un coup seront refusées. Pour un vrai lancement, configure un SMTP personnalisé (Authentication → SMTP Settings).
- Le score est calculé dans le navigateur : le serveur ne peut pas le vérifier. `soumettre_score` refuse seulement les valeurs absurdes (temps hors de 5 à 1800 s, score hors de 0 à 2 000 000, meilleur drift supérieur au score). Un joueur motivé peut donc tricher ; supprime la ligne concernée dans **Table Editor → scores** si besoin.
- Le serveur ne rejoue pas la validation complète d'un niveau (croisements de route…) ni ne recalcule son empreinte : le jeu re-valide chaque niveau reçu et vérifie l'empreinte avant de le charger. Un niveau publié par un joueur malveillant peut donc figurer dans la liste mais sera refusé au chargement. Retire-le dans **Table Editor → niveaux_publics** si besoin.
- Un joueur ne peut publier qu'une fois le même contenu (hors nom et auteur). Deux joueurs peuvent publier le même contenu : ils partagent alors le même classement (même empreinte).
- Les liens de partage `#n=<code>` contiennent tout le niveau et fonctionnent sans Supabase ; seuls les liens `#en-ligne=<id>` et l'onglet « En ligne » en dépendent.
