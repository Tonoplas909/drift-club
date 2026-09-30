-- Drift Club : classement d'un niveau tous modes confondus (le mode est affiché dans le tableau).
-- À coller dans Supabase → SQL Editor → Run, après 0001. Le script peut être relancé sans danger.
-- L'ancienne fonction classement(p_niveau, p_mode, p_limite) est conservée pour les anciennes
-- versions du jeu encore ouvertes dans un navigateur ; elle pourra être supprimée plus tard.

-- ---------------------------------------------------------------------------
-- 1. classement_niveau : meilleurs scores d'un niveau, tous modes confondus
-- ---------------------------------------------------------------------------
-- Une ligne par joueur et par mode (un joueur peut donc apparaître jusqu'à 3 fois).

create or replace function public.classement_niveau(
  p_niveau text,
  p_limite int default 20
)
returns table (rang int, pseudo text, mode text, score int, temps real, voiture text, maj timestamptz, joueur uuid)
language sql
stable
as $$
  select t.rang, t.pseudo, t.mode, t.score, t.temps, t.voiture, t.maj, t.joueur
    from (
      select rank() over (order by s.score desc)::int as rang,
             p.pseudo, s.mode, s.score, s.temps, s.voiture, s.maj, s.joueur
        from public.scores s
        join public.profils p on p.id = s.joueur
       where s.niveau = p_niveau
    ) t
   order by t.score desc, t.temps asc, t.maj asc
   limit least(greatest(coalesce(p_limite, 20), 1), 100);
$$;

revoke all on function public.classement_niveau(text, int) from public;
grant execute on function public.classement_niveau(text, int) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 2. soumettre_score : le rang renvoyé est maintenant calculé tous modes confondus
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

  -- Rang du meilleur score du joueur dans ce mode, parmi les scores du niveau TOUS MODES confondus
  -- (1 + nombre de lignes strictement meilleures), et nombre total de lignes du niveau.
  select s.score into v_mon
    from public.scores s
   where s.joueur = v_joueur and s.niveau = p_niveau and s.mode = p_mode;

  select 1 + count(*) filter (where s.score > v_mon), count(*)
    into rang, total
    from public.scores s
   where s.niveau = p_niveau;

  return next;
end;
$$;

-- Supabase accorde par défaut l'exécution à anon : on la retire explicitement.
revoke all on function public.soumettre_score(text, text, int, real, text, int) from public, anon;
grant execute on function public.soumettre_score(text, text, int, real, text, int) to authenticated;

-- (droits inchangés, rappelés par sécurité)
revoke all on function public.soumettre_score(text, text, int, real, text, int) from public, anon;
grant execute on function public.soumettre_score(text, text, int, real, text, int) to authenticated;
