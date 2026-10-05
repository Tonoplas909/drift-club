-- Drift Club : scores vérifiés par le serveur (anti-triche).
-- À coller dans Supabase → SQL Editor → Run, APRÈS avoir déployé l'Edge Function verifier-course (voir supabase/README.md).
-- Le script peut être relancé sans danger. Ne relance PAS 0002, 0005 ni 0007 après lui : ils rouvriraient soumettre_score.
--
-- Avant : le jeu envoyait son score à soumettre_score() et le serveur le croyait (seules les valeurs absurdes étaient
-- refusées). Quelqu'un pouvait donc modifier la variable du score dans son navigateur, ou appeler soumettre_score()
-- lui-même avec le score de son choix.
--
-- Maintenant : le jeu envoie le score ET les commandes de la course à l'Edge Function verifier-course, qui rejoue la
-- course avec le même code que le jeu, puis appelle enregistrer_score_verifie() avec la clé secrète du serveur.
--   * score rejoué proche du score envoyé  → score envoyé gardé (statut « conforme ») ;
--   * score envoyé trop éloigné            → score rejoué gardé (statut « corrige ») ;
--   * course qui n'atteint pas l'arrivée   → rien n'est enregistré.
-- soumettre_score() est fermée aux joueurs : plus aucun score ne s'écrit sans être passé par la vérification.

-- ---------------------------------------------------------------------------
-- 1. verifications : journal des courses vérifiées (pour repérer les tricheurs)
-- ---------------------------------------------------------------------------
-- Lisible par le propriétaire seulement (Table Editor) : aucune policy, aucun droit pour les joueurs.
-- Une ligne « corrige » avec un score annoncé bien plus haut que le score rejoué = tentative de triche probable.

create table if not exists public.verifications (
  id            bigint generated always as identity primary key,
  joueur        uuid not null references public.profils (id) on delete cascade,
  niveau        text not null,
  mode          text not null,
  voiture       text not null,
  statut        text not null,
  score_annonce integer not null,
  score_rejoue  integer not null,
  score_retenu  integer not null,
  temps         real not null,
  cree_le       timestamptz not null default now(),
  constraint verifications_statut_valide check (statut in ('conforme', 'corrige'))
);

create index if not exists verifications_joueur on public.verifications (joueur, cree_le desc);

alter table public.verifications enable row level security;
revoke all on public.verifications from anon, authenticated;

-- ---------------------------------------------------------------------------
-- 2. enregistrer_score_verifie : même travail que soumettre_score, pour un score vérifié
-- ---------------------------------------------------------------------------
-- Appelée UNIQUEMENT par l'Edge Function (clé secrète, rôle service_role), qui passe l'id du joueur
-- après avoir vérifié son jeton. Même résultat que soumettre_score (rang, total, clés).

create or replace function public.enregistrer_score_verifie(
  p_joueur          uuid,
  p_niveau          text,
  p_mode            text,
  p_voiture         text,
  p_score           int,
  p_temps           real,
  p_meilleur_drift  int,
  p_statut          text,
  p_score_annonce   int,
  p_score_rejoue    int
)
returns table (ameliore boolean, rang int, total int, cles_gagnees int, cles_record int, cles int)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_avant  int;
  v_mon    int;
  v_derniere timestamptz;
begin
  if p_joueur is null then
    raise exception 'Connexion requise pour envoyer un score.';
  end if;
  if not exists (select 1 from public.profils p where p.id = p_joueur) then
    raise exception 'Choisis un pseudo avant d''envoyer un score.';
  end if;
  if p_niveau is null or p_niveau !~ '^(off|perso):[A-Za-z0-9_-]{1,80}$' then
    raise exception 'Niveau invalide.';
  end if;
  if p_mode is null or p_mode not in ('arcade', 'semi', 'exigeant') then
    raise exception 'Mode invalide.';
  end if;
  if p_voiture is null or p_voiture not in ('equilibree', 'legere', 'turbo', 'kei', 'muscle', 'rotative', 'break') then
    raise exception 'Voiture invalide.';
  end if;
  if p_score is null or p_score < 0 or p_score > 2000000 then
    raise exception 'Score invalide.';
  end if;
  if p_temps is null or p_temps < 5 or p_temps > 1800 then
    raise exception 'Temps invalide.';
  end if;
  if p_meilleur_drift is null or p_meilleur_drift < 0 or p_meilleur_drift > p_score then
    raise exception 'Meilleur drift invalide.';
  end if;
  if p_statut is null or p_statut not in ('conforme', 'corrige') then
    raise exception 'Statut de vérification invalide.';
  end if;

  insert into public.verifications (joueur, niveau, mode, voiture, statut, score_annonce, score_rejoue, score_retenu, temps)
  values (p_joueur, p_niveau, p_mode, p_voiture, p_statut, coalesce(p_score_annonce, 0), coalesce(p_score_rejoue, 0), p_score, p_temps);

  select s.score into v_avant
    from public.scores s
   where s.joueur = p_joueur and s.niveau = p_niveau and s.mode = p_mode;

  -- On ne remplace la ligne que si le nouveau score est strictement meilleur.
  insert into public.scores as s (joueur, niveau, mode, score, temps, voiture, meilleur_drift)
  values (p_joueur, p_niveau, p_mode, p_score, p_temps, p_voiture, p_meilleur_drift)
  on conflict (joueur, niveau, mode) do update
     set score          = excluded.score,
         temps          = excluded.temps,
         voiture        = excluded.voiture,
         meilleur_drift = excluded.meilleur_drift,
         maj            = now()
   where excluded.score > s.score;

  ameliore := v_avant is null or p_score > v_avant;

  select s.score into v_mon
    from public.scores s
   where s.joueur = p_joueur and s.niveau = p_niveau and s.mode = p_mode;

  select 1 + count(*) filter (where s.score > v_mon), count(*)
    into rang, total
    from public.scores s
   where s.niveau = p_niveau;

  -- Clés : comme soumettre_score (1 par arrivée, +1 sur un record, au plus une fois toutes les 20 s).
  perform public.progression_assurer(p_joueur);
  select g.derniere_cle into v_derniere from public.progressions g where g.joueur = p_joueur for update;

  if v_derniere is null or now() - v_derniere >= interval '20 seconds' then
    cles_record := case when ameliore then 1 else 0 end;
    cles_gagnees := 1 + cles_record;
    update public.progressions g
       set cles = g.cles + 1 + (case when ameliore then 1 else 0 end), derniere_cle = now(), maj = now()
     where g.joueur = p_joueur;
  else
    cles_record := 0;
    cles_gagnees := 0;
  end if;
  select g.cles into cles from public.progressions g where g.joueur = p_joueur;

  return next;
end;
$$;

-- Réservée au serveur : ni anon ni authenticated (un joueur ne peut pas l'appeler avec son propre score).
revoke all on function public.enregistrer_score_verifie(uuid, text, text, text, int, real, int, text, int, int) from public, anon, authenticated;
grant execute on function public.enregistrer_score_verifie(uuid, text, text, text, int, real, int, text, int, int) to service_role;

-- ---------------------------------------------------------------------------
-- 3. soumettre_score : fermée aux joueurs
-- ---------------------------------------------------------------------------
-- La fonction reste en place (les anciennes versions du jeu reçoivent un refus au lieu d'une erreur « introuvable »).
revoke all on function public.soumettre_score(text, text, int, real, text, int) from public, anon, authenticated;
