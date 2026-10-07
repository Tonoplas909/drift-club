-- Drift Club : statistiques du pilote rattachées au compte (v0.5.19).
-- À coller dans Supabase → SQL Editor → Run. Le script peut être relancé sans danger.
--
-- Le jeu compte les statistiques (distance, temps en glisse, drifts, courses…) et envoie de temps en temps ce qui
-- s'est ajouté depuis le dernier envoi ; le serveur l'ajoute au total du compte (sommes pour les compteurs, maximum
-- pour les records), ce qui marche aussi avec plusieurs appareils. Ces chiffres viennent du navigateur : ils servent
-- au panneau « Statistiques », jamais à une récompense.
--   * mes_statistiques()             : le total du compte connecté (null s'il n'y en a pas encore) ;
--   * ajouter_statistiques(ajout)    : ajoute au total et renvoie le nouveau total.

create table if not exists public.statistiques_comptes (
  joueur  uuid primary key references public.profils (id) on delete cascade,
  donnees jsonb not null,
  maj     timestamptz not null default now()
);
alter table public.statistiques_comptes enable row level security;
revoke all on public.statistiques_comptes from anon, authenticated;

-- Nombre positif lu dans un objet JSON (0 si absent, négatif ou pas un nombre), borné pour un seul envoi.
create or replace function public.stat_nombre(p jsonb, p_cle text, p_max float8)
returns float8
language sql
immutable
as $$
  select case when jsonb_typeof(p -> p_cle) = 'number' then least(greatest((p ->> p_cle)::float8, 0), p_max) else 0 end;
$$;

create or replace function public.mes_statistiques()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select s.donnees from public.statistiques_comptes s where s.joueur = auth.uid();
$$;
revoke all on function public.mes_statistiques() from public, anon;
grant execute on function public.mes_statistiques() to authenticated;

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
       where v.voiture in ('equilibree', 'legere', 'turbo', 'kei', 'muscle', 'rotative', 'break')
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
