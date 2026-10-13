-- Drift Club : classement séparé des motos (v0.5.28).
-- À coller dans Supabase → SQL Editor → Run, après 0014. Le script peut être relancé sans danger.
--
-- Une course à moto est rangée sous la clé du niveau précédée de « moto: » (« moto:off:col-du-loup »,
-- « moto:perso:… ») : les motos ont leur propre classement sur chaque niveau, sans changer la table des scores.
-- Les fonctions de lecture (classement_niveau, mes_places) marchent telles quelles avec ces clés.
--   * scores_niveau_format         : clés « moto:off:… » et « moto:perso:… » acceptées ;
--   * enregistrer_score_verifie()  : comme 0014, avec ces clés (l'Edge Function vérifie que la clé va avec le véhicule) ;
--   * les scores de moto déjà envoyés (classés avec les voitures depuis la 0.5.25) passent dans le classement des motos.
-- Tant que ce script n'est pas passé, un score de moto est refusé avec un message clair ; le jeu reste utilisable.

-- ---------------------------------------------------------------------------
-- 1. scores : clés des motos acceptées
-- ---------------------------------------------------------------------------

alter table public.scores drop constraint if exists scores_niveau_format;
alter table public.scores add constraint scores_niveau_format
  check (niveau ~ '^((moto:)?(off|perso):[A-Za-z0-9_-]{1,80}|jour:[0-9]{4}-[0-9]{2}-[0-9]{2})$');

-- ---------------------------------------------------------------------------
-- 2. Scores de moto déjà envoyés : dans le classement des motos
-- ---------------------------------------------------------------------------

update public.scores s
   set niveau = 'moto:' || s.niveau
 where s.voiture = 'supermotard'
   and s.niveau !~ '^(moto|jour):';

-- ---------------------------------------------------------------------------
-- 3. enregistrer_score_verifie : comme 0014, avec les clés des motos
-- ---------------------------------------------------------------------------

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
  if p_niveau is null or p_niveau !~ '^((moto:)?(off|perso):[A-Za-z0-9_-]{1,80}|jour:[0-9]{4}-[0-9]{2}-[0-9]{2})$' then
    raise exception 'Niveau invalide.';
  end if;
  if p_mode is null or p_mode not in ('arcade', 'semi', 'exigeant') then
    raise exception 'Mode invalide.';
  end if;
  if p_voiture is null or p_voiture not in ('equilibree', 'legere', 'turbo', 'kei', 'muscle', 'rotative', 'break', 'supermotard') then
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

revoke all on function public.enregistrer_score_verifie(uuid, text, text, text, int, real, int, text, int, int, text) from public, anon, authenticated;
grant execute on function public.enregistrer_score_verifie(uuid, text, text, text, int, real, int, text, int, int, text) to service_role;
