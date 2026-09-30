-- Drift Club : comptes joueurs et classement en ligne.
-- À coller dans Supabase → SQL Editor → Run. Le script peut être relancé sans danger.
--
-- Principe de sécurité : la clé publiable du client est publique, donc tout passe par RLS.
--   * profils : lecture pour tout le monde, écriture limitée à sa propre ligne.
--   * scores  : lecture pour tout le monde, AUCUNE écriture directe ; on n'écrit que via
--               la fonction soumettre_score() (security definer) qui contrôle les valeurs.

-- ---------------------------------------------------------------------------
-- 1. Profils (pseudo public d'un compte)
-- ---------------------------------------------------------------------------

create table if not exists public.profils (
  id      uuid primary key references auth.users (id) on delete cascade,
  pseudo  text not null,
  cree_le timestamptz not null default now(),
  constraint profils_pseudo_longueur check (char_length(pseudo) between 3 and 20),
  constraint profils_pseudo_format   check (pseudo ~ '^[A-Za-z0-9_ -]+$'),
  constraint profils_pseudo_espaces  check (pseudo = btrim(pseudo))
);

-- Unicité du pseudo sans tenir compte de la casse (« Max » et « max » sont le même pseudo).
create unique index if not exists profils_pseudo_unique on public.profils (lower(pseudo));

alter table public.profils enable row level security;

drop policy if exists "profils_lecture" on public.profils;
create policy "profils_lecture" on public.profils
  for select to anon, authenticated using (true);

drop policy if exists "profils_insertion" on public.profils;
create policy "profils_insertion" on public.profils
  for insert to authenticated with check (auth.uid() = id);

drop policy if exists "profils_modification" on public.profils;
create policy "profils_modification" on public.profils
  for update to authenticated using (auth.uid() = id) with check (auth.uid() = id);

-- Pas de suppression directe : le profil disparaît avec le compte (on delete cascade).
-- Supabase accorde par défaut tous les droits aux rôles anon/authenticated : on repart de zéro
-- et on n'autorise que la colonne utile (le pseudo) en écriture.
revoke all on public.profils from anon, authenticated;
grant select on public.profils to anon, authenticated;
grant insert (id, pseudo) on public.profils to authenticated;
-- id inclus car l'upsert de PostgREST le réécrit (la policy impose de toute façon id = auth.uid()).
grant update (id, pseudo) on public.profils to authenticated;

-- ---------------------------------------------------------------------------
-- 2. Scores : UNE ligne par joueur / niveau / mode, qui garde le meilleur score
-- ---------------------------------------------------------------------------

create table if not exists public.scores (
  id            bigint generated always as identity primary key,
  joueur        uuid not null references public.profils (id) on delete cascade,
  niveau        text not null,
  mode          text not null,
  score         integer not null,
  temps         real not null,
  voiture       text not null,
  meilleur_drift integer not null default 0,
  maj           timestamptz not null default now(),
  constraint scores_niveau_format check (niveau ~ '^(off|perso):[A-Za-z0-9_-]{1,80}$'),
  constraint scores_mode_valide   check (mode in ('arcade', 'semi', 'exigeant')),
  constraint scores_score_positif check (score >= 0),
  constraint scores_temps_positif check (temps > 0),
  constraint scores_voiture_valide check (voiture in ('equilibree', 'legere', 'turbo')),
  constraint scores_drift_positif check (meilleur_drift >= 0),
  constraint scores_unique_joueur unique (joueur, niveau, mode)
);

-- Sert au classement d'un niveau/mode (tri par score décroissant).
create index if not exists scores_classement_idx on public.scores (niveau, mode, score desc, temps);

alter table public.scores enable row level security;

drop policy if exists "scores_lecture" on public.scores;
create policy "scores_lecture" on public.scores
  for select to anon, authenticated using (true);

-- Volontairement AUCUNE policy insert/update/delete : seules les fonctions ci-dessous écrivent.
revoke all on public.scores from anon, authenticated;
grant select on public.scores to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 3. soumettre_score : enregistre le score s'il bat le meilleur du joueur
-- ---------------------------------------------------------------------------

create or replace function public.soumettre_score(
  p_niveau        text,
  p_mode          text,
  p_score         int,
  p_temps         real,
  p_voiture       text,
  p_meilleur_drift int
)
returns table (ameliore boolean, rang int, total int)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_joueur uuid := auth.uid();
  v_avant  int;
  v_mon    int;
begin
  if v_joueur is null then
    raise exception 'Connexion requise pour envoyer un score.';
  end if;
  if not exists (select 1 from public.profils p where p.id = v_joueur) then
    raise exception 'Choisis un pseudo avant d''envoyer un score.';
  end if;

  -- Vraisemblance des valeurs (ce n'est pas une protection anti-triche complète).
  if p_niveau is null or p_niveau !~ '^(off|perso):[A-Za-z0-9_-]{1,80}$' then
    raise exception 'Niveau invalide.';
  end if;
  if p_mode is null or p_mode not in ('arcade', 'semi', 'exigeant') then
    raise exception 'Mode invalide.';
  end if;
  if p_voiture is null or p_voiture not in ('equilibree', 'legere', 'turbo') then
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

  select s.score into v_avant
    from public.scores s
   where s.joueur = v_joueur and s.niveau = p_niveau and s.mode = p_mode;

  -- On ne remplace la ligne que si le nouveau score est strictement meilleur.
  insert into public.scores as s (joueur, niveau, mode, score, temps, voiture, meilleur_drift)
  values (v_joueur, p_niveau, p_mode, p_score, p_temps, p_voiture, p_meilleur_drift)
  on conflict (joueur, niveau, mode) do update
     set score          = excluded.score,
         temps          = excluded.temps,
         voiture        = excluded.voiture,
         meilleur_drift = excluded.meilleur_drift,
         maj            = now()
   where excluded.score > s.score;

  ameliore := v_avant is null or p_score > v_avant;

  -- Rang du meilleur score du joueur (1 + nombre de joueurs strictement meilleurs) et total.
  select s.score into v_mon
    from public.scores s
   where s.joueur = v_joueur and s.niveau = p_niveau and s.mode = p_mode;

  select 1 + count(*) filter (where s.score > v_mon), count(*)
    into rang, total
    from public.scores s
   where s.niveau = p_niveau and s.mode = p_mode;

  return next;
end;
$$;

-- Supabase accorde par défaut l'exécution à anon : on la retire explicitement.
revoke all on function public.soumettre_score(text, text, int, real, text, int) from public, anon;
grant execute on function public.soumettre_score(text, text, int, real, text, int) to authenticated;

-- ---------------------------------------------------------------------------
-- 4. classement : meilleurs scores d'un niveau/mode
-- ---------------------------------------------------------------------------
-- security invoker (par défaut) : la fonction lit profils et scores avec les droits de l'appelant,
-- et les policies de lecture ci-dessus l'autorisent pour tout le monde (anon compris).

create or replace function public.classement(
  p_niveau text,
  p_mode   text,
  p_limite int default 20
)
returns table (rang int, pseudo text, score int, temps real, voiture text, maj timestamptz, joueur uuid)
language sql
stable
as $$
  select t.rang, t.pseudo, t.score, t.temps, t.voiture, t.maj, t.joueur
    from (
      select rank() over (order by s.score desc)::int as rang,
             p.pseudo, s.score, s.temps, s.voiture, s.maj, s.joueur
        from public.scores s
        join public.profils p on p.id = s.joueur
       where s.niveau = p_niveau and s.mode = p_mode
    ) t
   order by t.score desc, t.temps asc, t.maj asc
   limit least(greatest(coalesce(p_limite, 20), 1), 100);
$$;

revoke all on function public.classement(text, text, int) from public;
grant execute on function public.classement(text, text, int) to anon, authenticated;
