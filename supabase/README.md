# Supabase : comptes et classement en ligne

Le jeu utilise Supabase pour les comptes (email + mot de passe) et le classement. Sans Supabase, tout le reste du jeu fonctionne (records locaux, éditeur…).

## 1. Créer les tables (une seule fois)

1. Ouvre le projet dans le tableau de bord Supabase → **SQL Editor** → **New query**.
2. Colle tout le contenu de [`migrations/0001_comptes_classement.sql`](migrations/0001_comptes_classement.sql).
3. Clique sur **Run**. Le script peut être relancé sans danger (il est idempotent).

Il crée :

- `profils` : le pseudo public de chaque compte (3 à 20 caractères : lettres, chiffres, `_`, `-`, espace ; unique sans tenir compte de la casse) ;
- `scores` : une ligne par joueur, niveau et mode, qui garde le meilleur score ;
- `soumettre_score(...)` : la seule façon d'écrire un score (vérifie la connexion, le pseudo et la vraisemblance des valeurs) ;
- `classement(niveau, mode, limite)` : les meilleurs scores, lisibles par tout le monde.

La sécurité repose sur le RLS : la clé publiable est dans le code du jeu, mais elle ne permet que de lire les profils et scores, d'écrire son propre profil et d'appeler `soumettre_score`. Aucune écriture directe dans `scores`.

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
