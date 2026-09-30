-- Drift Club : progression du joueur (clés et livrées débloquées) dans son compte.
-- À coller dans Supabase → SQL Editor → Run, après 0001 et 0002 ; coller ensuite 0006 (catalogue des livrées).
-- Le script peut être relancé sans danger.
--
-- Principe : quand le joueur est connecté (avec pseudo), c'est le SERVEUR qui fait foi.
--   * progressions : une ligne par joueur, lisible par son propriétaire seulement, AUCUNE écriture directe.
--   * les clés ne se gagnent que par soumettre_score() (1 par arrivée, +1 sur un record, une fois par 20 s) ;
--   * ouvrir_caisse() paie 3 clés, tire la livrée AU HASARD CÔTÉ SERVEUR et la débloque : le client ne choisit rien ;
--   * importer_progression_locale() reprend UNE SEULE FOIS la progression de l'appareil (seule confiance donnée au client).

-- ---------------------------------------------------------------------------
-- 1. catalogue_skins : les livrées qui sortent des caisses (« unie » est toujours débloquée, elle n'y figure pas)
-- ---------------------------------------------------------------------------
-- Remplie par 0006_catalogue_skins.sql, générée depuis src/core/skins.ts (tools/gen-catalogue-sql.ts).

create table if not exists public.catalogue_skins (
  id      text not null,
  voiture text not null,
  rarete  text not null,
  primary key (voiture, id),
  constraint catalogue_skins_id_format      check (id ~ '^[A-Za-z0-9_-]{1,40}$'),
  constraint catalogue_skins_voiture_format check (voiture ~ '^[A-Za-z0-9_-]{1,40}$'),
  constraint catalogue_skins_rarete_valide  check (rarete in ('commune', 'rare', 'epique', 'legendaire', 'exotique'))
);

alter table public.catalogue_skins enable row level security;

drop policy if exists "catalogue_skins_lecture" on public.catalogue_skins;
create policy "catalogue_skins_lecture" on public.catalogue_skins
  for select to anon, authenticated using (true);

-- Écriture réservée au propriétaire (SQL Editor) : aucune policy insert/update/delete.
revoke all on public.catalogue_skins from anon, authenticated;
grant select on public.catalogue_skins to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 2. progressions : une ligne par joueur
-- ---------------------------------------------------------------------------

create table if not exists public.progressions (
  joueur        uuid primary key references public.profils (id) on delete cascade,
  cles          integer not null default 0,
  -- livrées débloquées au format « voiture:skin » (ex. « turbo:flammes »)
  debloques     text[] not null default '{}',
  caisse_offerte boolean not null default false,
  ouvertes      integer not null default 0,
  -- vrai une fois la progression de l'appareil reprise (importer_progression_locale ne marche qu'une fois)
  importee      boolean not null default false,
  -- dernier gain de clés par une arrivée (limite de débit)
  derniere_cle  timestamptz,
  maj           timestamptz not null default now(),
  constraint progressions_cles_positives check (cles >= 0),
  constraint progressions_ouvertes_positives check (ouvertes >= 0)
);

alter table public.progressions enable row level security;

-- Lecture de SA ligne seulement ; jamais d'écriture directe (tout passe par les fonctions ci-dessous).
drop policy if exists "progressions_lecture" on public.progressions;
create policy "progressions_lecture" on public.progressions
  for select to authenticated using (joueur = auth.uid());

revoke all on public.progressions from anon, authenticated;
grant select on public.progressions to authenticated;

-- ---------------------------------------------------------------------------
-- 3. progression_assurer : crée la ligne à la première utilisation (3 clés offertes = 1 caisse)
-- ---------------------------------------------------------------------------
-- Usage interne : appelée par les fonctions security definer ci-dessous, pas par le client.

create or replace function public.progression_assurer(p_joueur uuid)
returns void
language sql
security definer
set search_path = public
as $$
  insert into public.progressions (joueur, cles, caisse_offerte)
  values (p_joueur, 3, true)
  on conflict (joueur) do nothing;
$$;

revoke all on function public.progression_assurer(uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 4. ma_progression : la progression du joueur connecté (créée à la première demande)
-- ---------------------------------------------------------------------------

create or replace function public.ma_progression()
returns setof public.progressions
language plpgsql
security definer
set search_path = public
as $$
declare
  v_joueur uuid := auth.uid();
begin
  if v_joueur is null then
    raise exception 'Connexion requise pour lire ta progression.';
  end if;
  if not exists (select 1 from public.profils p where p.id = v_joueur) then
    raise exception 'Choisis un pseudo pour garder ta progression en ligne.';
  end if;

  perform public.progression_assurer(v_joueur);

  return query select g.* from public.progressions g where g.joueur = v_joueur;
end;
$$;

revoke all on function public.ma_progression() from public, anon;
grant execute on function public.ma_progression() to authenticated;

-- ---------------------------------------------------------------------------
-- 5. importer_progression_locale : reprise UNIQUE de la progression de l'appareil
-- ---------------------------------------------------------------------------
-- Compromis de confiance : le serveur ne peut pas vérifier ce que contenait l'appareil. Il borne donc l'import :
-- seules les livrées du catalogue sont retenues, au plus 30 clés sont reprises, et une seule fois par compte.

create or replace function public.importer_progression_locale(p_debloques text[], p_cles int)
returns setof public.progressions
language plpgsql
security definer
set search_path = public
as $$
declare
  v_joueur uuid := auth.uid();
  v_ligne  public.progressions%rowtype;
  v_valides text[];
begin
  if v_joueur is null then
    raise exception 'Connexion requise pour reprendre ta progression.';
  end if;
  if not exists (select 1 from public.profils p where p.id = v_joueur) then
    raise exception 'Choisis un pseudo pour garder ta progression en ligne.';
  end if;

  perform public.progression_assurer(v_joueur);

  -- verrou de la ligne : deux imports simultanés ne peuvent pas passer tous les deux
  select g.* into v_ligne from public.progressions g where g.joueur = v_joueur for update;

  if not v_ligne.importee then
    -- au plus 500 entrées lues, seules celles du catalogue sont gardées (sans doublon)
    select coalesce(array_agg(distinct d.valeur), '{}') into v_valides
      from unnest((coalesce(p_debloques, '{}'::text[]))[1:500]) as d (valeur)
     where exists (select 1 from public.catalogue_skins c where c.voiture || ':' || c.id = d.valeur);

    update public.progressions g
       set debloques = (select coalesce(array_agg(distinct u.valeur), '{}')
                          from unnest(g.debloques || v_valides) as u (valeur)),
           -- on garde le plus favorable des deux : pas de cumul (les 3 clés offertes sont déjà comptées des deux côtés)
           cles      = greatest(g.cles, least(greatest(coalesce(p_cles, 0), 0), 30)),
           importee  = true,
           maj       = now()
     where g.joueur = v_joueur;
  end if;

  return query select g.* from public.progressions g where g.joueur = v_joueur;
end;
$$;

revoke all on function public.importer_progression_locale(text[], int) from public, anon;
grant execute on function public.importer_progression_locale(text[], int) to authenticated;

-- ---------------------------------------------------------------------------
-- 6. ouvrir_caisse : 3 clés, tirage au hasard côté serveur
-- ---------------------------------------------------------------------------
-- Raretés (mêmes poids que src/core/raretes.ts) : 79,9 / 16 / 3,2 / 0,64 / 0,26 %. Une rareté sans livrée dans
-- le catalogue est ignorée (poids renormalisés). Ensuite une livrée au hasard de cette rareté, toutes voitures confondues.
-- Doublon : la livrée reste débloquée et 1 clé est rendue.

create or replace function public.ouvrir_caisse()
returns table (voiture text, skin text, rarete text, doublon boolean, cles int)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_joueur uuid := auth.uid();
  v_ligne  public.progressions%rowtype;
  v_total  double precision;
  v_x      double precision;
  v_rarete text;
  v_voiture text;
  v_skin   text;
  v_cle    text;
  v_doublon boolean;
begin
  if v_joueur is null then
    raise exception 'Connexion requise pour ouvrir une caisse.';
  end if;
  if not exists (select 1 from public.profils p where p.id = v_joueur) then
    raise exception 'Choisis un pseudo pour ouvrir des caisses avec ton compte.';
  end if;

  perform public.progression_assurer(v_joueur);

  -- verrou de la ligne pendant toute la fonction : impossible de dépenser deux fois les mêmes clés
  select g.* into v_ligne from public.progressions g where g.joueur = v_joueur for update;

  if v_ligne.cles < 3 then
    raise exception 'Pas assez de clés : il en faut 3 pour ouvrir une caisse.';
  end if;

  -- rareté : poids cumulés des raretés qui ont au moins une livrée
  select sum(w.poids) into v_total
    from (values ('commune', 79.9), ('rare', 16.0), ('epique', 3.2), ('legendaire', 0.64), ('exotique', 0.26)) as w (rarete, poids)
   where exists (select 1 from public.catalogue_skins c where c.rarete = w.rarete);
  if v_total is null then
    raise exception 'Aucune livrée disponible pour le moment.';
  end if;

  v_x := random() * v_total;
  select t.rarete into v_rarete
    from (
      select w.rarete, w.ordre, sum(w.poids) over (order by w.ordre) as cumul
        from (values (1, 'commune', 79.9), (2, 'rare', 16.0), (3, 'epique', 3.2), (4, 'legendaire', 0.64), (5, 'exotique', 0.26)) as w (ordre, rarete, poids)
       where exists (select 1 from public.catalogue_skins c where c.rarete = w.rarete)
    ) t
   where t.cumul > v_x
   order by t.ordre
   limit 1;
  -- (arrondis flottants : si rien n'est trouvé, on retombe sur la rareté la plus courante)
  if v_rarete is null then
    select c.rarete into v_rarete from public.catalogue_skins c
     order by array_position(array['commune', 'rare', 'epique', 'legendaire', 'exotique'], c.rarete) limit 1;
  end if;

  select c.voiture, c.id into v_voiture, v_skin
    from public.catalogue_skins c
   where c.rarete = v_rarete
   order by random()
   limit 1;

  v_cle := v_voiture || ':' || v_skin;
  v_doublon := v_cle = any (v_ligne.debloques);

  update public.progressions g
     set cles      = g.cles - 3 + (case when v_doublon then 1 else 0 end),
         debloques = case when v_doublon then g.debloques else array_append(g.debloques, v_cle) end,
         ouvertes  = g.ouvertes + 1,
         maj       = now()
   where g.joueur = v_joueur;

  voiture := v_voiture;
  skin := v_skin;
  rarete := v_rarete;
  doublon := v_doublon;
  select g.cles into cles from public.progressions g where g.joueur = v_joueur;
  return next;
end;
$$;

revoke all on function public.ouvrir_caisse() from public, anon;
grant execute on function public.ouvrir_caisse() to authenticated;

-- ---------------------------------------------------------------------------
-- 7. soumettre_score : mêmes contrôles et même résultat qu'en 0002, plus les clés gagnées
-- ---------------------------------------------------------------------------
-- +1 clé par arrivée, +1 de plus si le score bat le meilleur du joueur sur ce niveau/mode (le premier compte).
-- Limite de débit : pas de clé si la précédente a été gagnée il y a moins de 20 secondes (le score est enregistré quand même).
-- Colonnes ajoutées à la FIN du résultat (cles_gagnees, cles_record, cles) : les anciens clients les ignorent.
-- Le type de retour change : il faut supprimer l'ancienne fonction avant de la recréer.

drop function if exists public.soumettre_score(text, text, int, real, text, int);

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
