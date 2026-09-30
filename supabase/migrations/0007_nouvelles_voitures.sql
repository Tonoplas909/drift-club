-- Drift Club : nouvelles voitures (La Kei, La Muscle, La Rotative, Le Break) côté serveur.
-- À coller dans Supabase → SQL Editor → Run, APRÈS 0005 et AVANT 0006 (à relancer : 0006 a été régénéré avec les livrées des nouvelles voitures).
-- Le script peut être relancé sans danger.
--
-- Tant qu'il n'est pas passé, le jeu reste utilisable : un score envoyé avec une nouvelle voiture est simplement refusé
-- par le serveur (le joueur voit le message d'erreur habituel), les scores des trois voitures d'origine ne changent pas.

-- 1. Contrainte de la table scores : liste des voitures autorisées (remplace celle de 0001).
alter table public.scores drop constraint if exists scores_voiture_valide;
alter table public.scores
  add constraint scores_voiture_valide check (voiture in ('equilibree', 'legere', 'turbo', 'kei', 'muscle', 'rotative', 'break'));

-- 2. soumettre_score : même corps que dans 0005, seule la liste des voitures change.
-- Signature et type de retour identiques : pas besoin de supprimer la fonction.
create or replace function public.soumettre_score(
  p_niveau        text,
  p_mode          text,
  p_score         int,
  p_temps         real,
  p_voiture       text,
  p_meilleur_drift int
)
returns table (ameliore boolean, rang int, total int, cles_gagnees int, cles_record int, cles int)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_joueur uuid := auth.uid();
  v_avant  int;
  v_mon    int;
  v_derniere timestamptz;
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

  -- Clés : ligne verrouillée pour que deux envois simultanés ne contournent pas la limite de débit.
  perform public.progression_assurer(v_joueur);
  select g.derniere_cle into v_derniere from public.progressions g where g.joueur = v_joueur for update;

  if v_derniere is null or now() - v_derniere >= interval '20 seconds' then
    cles_record := case when ameliore then 1 else 0 end;
    cles_gagnees := 1 + cles_record;
    update public.progressions g
       set cles = g.cles + 1 + (case when ameliore then 1 else 0 end), derniere_cle = now(), maj = now()
     where g.joueur = v_joueur;
  else
    cles_record := 0;
    cles_gagnees := 0;
  end if;
  select g.cles into cles from public.progressions g where g.joueur = v_joueur;

  return next;
end;
$$;

-- Supabase accorde par défaut l'exécution à anon : on la retire explicitement.
revoke all on function public.soumettre_score(text, text, int, real, text, int) from public, anon;
grant execute on function public.soumettre_score(text, text, int, real, text, int) to authenticated;
