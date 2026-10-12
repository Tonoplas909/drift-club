-- Drift Club : motos (La Supermotard), v0.5.25.
-- À coller dans Supabase → SQL Editor → Run, après 0013, PUIS relancer 0006_catalogue_skins.sql (régénéré avec les
-- livrées de la moto). Les deux scripts peuvent être relancés sans danger.
--
-- Tant que ce script n'est pas passé, le jeu reste utilisable : une course à moto se joue et s'enregistre sur
-- l'appareil, et l'envoi du score affiche « Ce véhicule n'est pas encore accepté au classement en ligne ». Les scores
-- des voitures ne changent pas. L'Edge Function verifier-course (redéployée automatiquement) sait déjà rejouer les
-- courses à moto.
--   * scores_voiture_valide          : « supermotard » accepté ;
--   * enregistrer_score_verifie()    : comme 0011, avec la moto ;
--   * ajouter_statistiques()         : comme 0013, distance à moto comptée.
-- Les livrées de l'Atelier restent réservées aux voitures (contrainte livrees_voiture_valide de 0010 inchangée).

-- ---------------------------------------------------------------------------
-- 1. scores : identifiant de la moto accepté
-- ---------------------------------------------------------------------------

alter table public.scores drop constraint if exists scores_voiture_valide;
alter table public.scores
  add constraint scores_voiture_valide check (voiture in ('equilibree', 'legere', 'turbo', 'kei', 'muscle', 'rotative', 'break', 'supermotard'));

-- ---------------------------------------------------------------------------
-- 2. enregistrer_score_verifie : comme 0011, avec la moto
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
  if p_niveau is null or p_niveau !~ '^((off|perso):[A-Za-z0-9_-]{1,80}|jour:[0-9]{4}-[0-9]{2}-[0-9]{2})$' then
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

-- ---------------------------------------------------------------------------
-- 3. ajouter_statistiques : comme 0013, avec la moto
-- ---------------------------------------------------------------------------

create or replace function public.ajouter_statistiques(p_ajout jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_joueur uuid := auth.uid();
  v_avant  jsonb;
  v_voit   jsonb;
  v_depuis text;
  v_total  jsonb;
  -- un envoi ne peut pas ajouter plus que ça (un envoi couvre au plus quelques heures de jeu)
  c_max float8 := 1e7;
begin
  if v_joueur is null or not exists (select 1 from public.profils p where p.id = v_joueur) then
    raise exception 'Connexion requise.';
  end if;
  if p_ajout is null or jsonb_typeof(p_ajout) <> 'object' or octet_length(p_ajout::text) > 4000 then
    raise exception 'Statistiques invalides.';
  end if;
  select s.donnees into v_avant from public.statistiques_comptes s where s.joueur = v_joueur for update;
  v_avant := coalesce(v_avant, '{}'::jsonb);

  -- distance par voiture : somme voiture par voiture (voitures connues seulement)
  select coalesce(jsonb_object_agg(t.voiture, t.d), '{}'::jsonb) into v_voit
    from (
      select v.voiture, sum(v.d) as d
        from (
          select key as voiture, public.stat_nombre(coalesce(v_avant -> 'parVoiture', '{}'::jsonb), key, 1e12) as d
            from jsonb_object_keys(coalesce(v_avant -> 'parVoiture', '{}'::jsonb)) as key
          union all
          select key, public.stat_nombre(p_ajout -> 'parVoiture', key, c_max)
            from jsonb_object_keys(case when jsonb_typeof(p_ajout -> 'parVoiture') = 'object' then p_ajout -> 'parVoiture' else '{}'::jsonb end) as key
        ) v
       where v.voiture in ('equilibree', 'legere', 'turbo', 'kei', 'muscle', 'rotative', 'break', 'supermotard')
       group by v.voiture
    ) t
   where t.d > 0;

  -- date de début : la plus ancienne des deux (format AAAA-MM-JJ)
  select min(d) into v_depuis
    from (values (v_avant ->> 'depuis'), (p_ajout ->> 'depuis')) as x(d)
   where d ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$';

  v_total := jsonb_build_object(
    'distanceCourse', public.stat_nombre(v_avant, 'distanceCourse', 1e12) + public.stat_nombre(p_ajout, 'distanceCourse', c_max),
    'distanceZen',    public.stat_nombre(v_avant, 'distanceZen', 1e12)    + public.stat_nombre(p_ajout, 'distanceZen', c_max),
    'tempsGlisse',    public.stat_nombre(v_avant, 'tempsGlisse', 1e12)    + public.stat_nombre(p_ajout, 'tempsGlisse', c_max),
    'drifts',         floor(public.stat_nombre(v_avant, 'drifts', 1e12)   + public.stat_nombre(p_ajout, 'drifts', c_max)),
    'courses',        floor(public.stat_nombre(v_avant, 'courses', 1e12)  + public.stat_nombre(p_ajout, 'courses', c_max)),
    'plusLongDrift',  greatest(public.stat_nombre(v_avant, 'plusLongDrift', 1e6), public.stat_nombre(p_ajout, 'plusLongDrift', 1e6)),
    'meilleurDrift',  greatest(public.stat_nombre(v_avant, 'meilleurDrift', 2e6), public.stat_nombre(p_ajout, 'meilleurDrift', 2e6)),
    'parVoiture',     v_voit,
    'depuis',         v_depuis
  );

  insert into public.statistiques_comptes as s (joueur, donnees) values (v_joueur, v_total)
  on conflict (joueur) do update set donnees = excluded.donnees, maj = now();
  return v_total;
end;
$$;
revoke all on function public.ajouter_statistiques(jsonb) from public, anon;
grant execute on function public.ajouter_statistiques(jsonb) to authenticated;
