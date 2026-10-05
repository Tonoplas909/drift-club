-- Drift Club : clés gagnées seulement en jouant vraiment (anti-triche, suite de 0008).
-- À coller dans Supabase → SQL Editor → Run, APRÈS avoir redéployé l'Edge Function verifier-course de la version 0.4.5.
-- Le script peut être relancé sans danger. Ne relance PAS 0005 après lui (il rouvrirait la reprise de la progression locale).
--
-- Ce qu'il ferme :
--   1. Renvoyer plusieurs fois la même course (le même replay) rapportait 1 clé toutes les 20 s : chaque replay a
--      maintenant une empreinte, et une course déjà enregistrée est refusée.
--   2. Les clés ne se gagnent plus plus vite qu'on ne joue : au moins la durée de la course entre deux gains.
--   3. La reprise de la progression locale (importer_progression_locale) acceptait toutes les livrées du catalogue
--      et 30 clés annoncées par le navigateur, où elles sont modifiables : elle est fermée. Un compte ne gagne
--      plus de clés ni de livrées qu'en jouant (soumettre une course vérifiée) et en ouvrant des caisses.

-- ---------------------------------------------------------------------------
-- 1. Empreinte des replays dans le journal des vérifications
-- ---------------------------------------------------------------------------

alter table public.verifications add column if not exists empreinte_replay text;
create unique index if not exists verifications_empreinte_replay on public.verifications (empreinte_replay) where empreinte_replay is not null;

-- ---------------------------------------------------------------------------
-- 2. enregistrer_score_verifie : avec l'empreinte du replay (remplace la version de 0008)
-- ---------------------------------------------------------------------------

drop function if exists public.enregistrer_score_verifie(uuid, text, text, text, int, real, int, text, int, int);

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
  p_score_rejoue    int,
  p_empreinte_replay text
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
  if p_empreinte_replay is null or p_empreinte_replay !~ '^[0-9a-f]{64}$' then
    raise exception 'Empreinte de replay invalide.';
  end if;

  -- Une course (un replay) n'est enregistrée qu'une fois, tous joueurs confondus : la renvoyer ne rapporte rien.
  begin
    insert into public.verifications (joueur, niveau, mode, voiture, statut, score_annonce, score_rejoue, score_retenu, temps, empreinte_replay)
    values (p_joueur, p_niveau, p_mode, p_voiture, p_statut, coalesce(p_score_annonce, 0), coalesce(p_score_rejoue, 0), p_score, p_temps, p_empreinte_replay);
  exception when unique_violation then
    raise exception 'Cette course a déjà été envoyée.';
  end;

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

  -- Clés : 1 par arrivée, +1 sur un record. Pas plus vite qu'on ne joue : depuis la clé précédente, il doit s'être
  -- écoulé au moins la durée de cette course (et au moins 20 s). Un pilote automatique ne gagne donc pas plus
  -- qu'un joueur qui enchaîne les courses.
  perform public.progression_assurer(p_joueur);
  select g.derniere_cle into v_derniere from public.progressions g where g.joueur = p_joueur for update;

  if v_derniere is null or now() - v_derniere >= greatest(interval '20 seconds', make_interval(secs => p_temps)) then
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

-- Réservée au serveur : ni anon ni authenticated.
revoke all on function public.enregistrer_score_verifie(uuid, text, text, text, int, real, int, text, int, int, text) from public, anon, authenticated;
grant execute on function public.enregistrer_score_verifie(uuid, text, text, text, int, real, int, text, int, int, text) to service_role;

-- ---------------------------------------------------------------------------
-- 3. Reprise de la progression locale : fermée
-- ---------------------------------------------------------------------------
-- La fonction reste en place (les versions 0.4.4 et antérieures l'appellent à la connexion et ignorent l'échec).
revoke all on function public.importer_progression_locale(text[], int) from public, anon, authenticated;
