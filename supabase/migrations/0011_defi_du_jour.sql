-- Drift Club : défi du jour (v0.5.17).
-- À coller dans Supabase → SQL Editor → Run, après 0010. Le script peut être relancé sans danger.
-- L'Edge Function verifier-course de la version 0.5.17 (redéployée automatiquement) sait déjà vérifier les
-- courses des défis ; tant que ce script n'est pas passé, leurs scores sont refusés (« Niveau invalide. »).
--
-- Chaque jour (heure de Paris), le jeu et l'Edge Function tirent de la date le même niveau, une voiture, une
-- ambiance et une météo. Son classement a pour clé « jour:AAAA-MM-JJ » dans la table scores, comme un niveau.
--   * enregistrer_score_verifie() accepte ces clés (l'Edge Function vérifie la date et la voiture imposée) ;
--   * reclamer_recompenses_defi() : le joueur connecté reçoit les clés du podium des défis passés (14 derniers jours),
--     une seule fois par défi : 5 clés au 1er, 3 au 2e, 2 au 3e (rang du meilleur score de chaque joueur) ;
--   * defis_passes(jours) : le vainqueur de chacun des derniers défis, lisible par tout le monde.

-- ---------------------------------------------------------------------------
-- 1. scores : clés « jour:AAAA-MM-JJ » acceptées
-- ---------------------------------------------------------------------------

alter table public.scores drop constraint if exists scores_niveau_format;
alter table public.scores add constraint scores_niveau_format
  check (niveau ~ '^((off|perso):[A-Za-z0-9_-]{1,80}|jour:[0-9]{4}-[0-9]{2}-[0-9]{2})$');

-- ---------------------------------------------------------------------------
-- 2. enregistrer_score_verifie : comme 0009, avec les clés des défis
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
-- 3. Podium des défis : récompenses (une fois par joueur et par défi)
-- ---------------------------------------------------------------------------

create table if not exists public.defi_recompenses (
  joueur  uuid not null references public.profils (id) on delete cascade,
  jour    date not null,
  rang    int not null,
  cles    int not null,
  le      timestamptz not null default now(),
  primary key (joueur, jour)
);
alter table public.defi_recompenses enable row level security;
revoke all on public.defi_recompenses from anon, authenticated;

-- Meilleur score de chaque joueur sur un défi, classés (même rang pour les ex æquo).
create or replace function public.podium_defi(p_jour date)
returns table (joueur uuid, score int, rang int)
language sql
stable
security definer
set search_path = public
as $$
  select m.joueur, m.score, (rank() over (order by m.score desc))::int as rang
    from (
      select s.joueur, max(s.score) as score
        from public.scores s
       where s.niveau = 'jour:' || to_char(p_jour, 'YYYY-MM-DD')
       group by s.joueur
    ) m;
$$;
revoke all on function public.podium_defi(date) from public, anon, authenticated;

create or replace function public.reclamer_recompenses_defi()
returns table (jour date, rang int, cles int)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_joueur uuid := auth.uid();
  v_aujourdhui date := (now() at time zone 'Europe/Paris')::date;
  v_jour date;
  v_rang int;
  v_cles int;
begin
  if v_joueur is null or not exists (select 1 from public.profils p where p.id = v_joueur) then
    return;
  end if;
  perform public.progression_assurer(v_joueur);
  -- défis terminés (jusqu'à hier), des 14 derniers jours
  for v_jour in select generate_series(v_aujourdhui - 14, v_aujourdhui - 1, interval '1 day')::date loop
    if exists (select 1 from public.defi_recompenses r where r.joueur = v_joueur and r.jour = v_jour) then
      continue;
    end if;
    select p.rang into v_rang from public.podium_defi(v_jour) p where p.joueur = v_joueur;
    if v_rang is null or v_rang > 3 then
      continue;
    end if;
    v_cles := case v_rang when 1 then 5 when 2 then 3 else 2 end;
    insert into public.defi_recompenses (joueur, jour, rang, cles) values (v_joueur, v_jour, v_rang, v_cles)
      on conflict do nothing;
    if found then
      update public.progressions g set cles = g.cles + v_cles, maj = now() where g.joueur = v_joueur;
      jour := v_jour; rang := v_rang; cles := v_cles;
      return next;
    end if;
  end loop;
end;
$$;
revoke all on function public.reclamer_recompenses_defi() from public, anon;
grant execute on function public.reclamer_recompenses_defi() to authenticated;

-- ---------------------------------------------------------------------------
-- 4. Défis passés : le vainqueur de chacun des derniers jours
-- ---------------------------------------------------------------------------

create or replace function public.defis_passes(p_jours int default 7)
returns table (jour date, pseudo text, score int, voiture text, joueurs int)
language sql
stable
security definer
set search_path = public
as $$
  with jours as (
    select generate_series((now() at time zone 'Europe/Paris')::date - least(greatest(coalesce(p_jours, 7), 1), 30),
                           (now() at time zone 'Europe/Paris')::date - 1, interval '1 day')::date as jour
  )
  select j.jour, v.pseudo, v.score, v.voiture,
         (select count(distinct s.joueur)::int from public.scores s where s.niveau = 'jour:' || to_char(j.jour, 'YYYY-MM-DD')) as joueurs
    from jours j
    left join lateral (
      select p.pseudo, s.score, s.voiture
        from public.scores s
        join public.profils p on p.id = s.joueur
       where s.niveau = 'jour:' || to_char(j.jour, 'YYYY-MM-DD')
       order by s.score desc, s.temps asc, s.maj asc
       limit 1
    ) v on true
   order by j.jour desc;
$$;
revoke all on function public.defis_passes(int) from public;
grant execute on function public.defis_passes(int) to anon, authenticated;
