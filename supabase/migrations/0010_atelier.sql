-- Drift Club : l'Atelier (livrées créées par les joueurs, validées par le propriétaire du jeu).
-- À coller dans Supabase → SQL Editor → Run, après 0009. Le script peut être relancé sans danger.
-- Puis, UNE fois, se déclarer administrateur (voir la fin du fichier).
--
-- Principe (comme le reste du projet) : aucune écriture directe, tout passe par des fonctions.
--   * proposer_livree()      : un joueur connecté avec pseudo propose une livrée (3 par 24 h, 10 en attente au plus) ;
--   * livrees_officielles()  : les livrées validées, lisibles par tout le monde (le jeu les ajoute à ses livrées) ;
--   * mes_livrees()          : les propositions du joueur et leur statut ;
--   * livrees_a_moderer(), moderer_livree() : réservées aux administrateurs (table admins, modifiable seulement
--     depuis le SQL Editor). Valider une livrée l'ajoute au catalogue des caisses avec la rareté choisie, la
--     débloque pour son créateur et lui offre 5 clés.
-- Le serveur borne la forme (tailles, nombre de motifs) ; le jeu re-valide chaque livrée reçue motif par motif
-- (src/core/atelier.ts) et ignore celles qui ne passent pas.

-- ---------------------------------------------------------------------------
-- 1. admins : comptes autorisés à modérer
-- ---------------------------------------------------------------------------

create table if not exists public.admins (
  joueur uuid primary key references public.profils (id) on delete cascade
);
alter table public.admins enable row level security;
revoke all on public.admins from anon, authenticated;

create or replace function public.est_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.admins a where a.joueur = auth.uid());
$$;
revoke all on function public.est_admin() from public, anon;
grant execute on function public.est_admin() to authenticated;

-- ---------------------------------------------------------------------------
-- 2. livrees_atelier : les propositions
-- ---------------------------------------------------------------------------

create table if not exists public.livrees_atelier (
  id          uuid primary key default gen_random_uuid(),
  auteur      uuid not null references public.profils (id) on delete cascade,
  voiture     text not null,
  nom         text not null,
  description text not null,
  -- { "elements": [...], "couleurForcee": "#rrggbb" (facultatif) }
  donnees     jsonb not null,
  statut      text not null default 'proposee',
  rarete      text,
  motif_refus text,
  cree_le     timestamptz not null default now(),
  modere_le   timestamptz,
  -- vrai une fois le créateur récompensé (livrée + 5 clés), pour ne jamais le faire deux fois
  recompensee boolean not null default false,
  constraint livrees_voiture_valide check (voiture in ('equilibree', 'legere', 'turbo', 'kei', 'muscle', 'rotative', 'break')),
  constraint livrees_nom_longueur check (char_length(nom) between 1 and 24),
  constraint livrees_description_longueur check (char_length(description) between 1 and 90),
  constraint livrees_donnees_taille check (octet_length(donnees::text) <= 6000),
  constraint livrees_statut_valide check (statut in ('proposee', 'validee', 'refusee')),
  constraint livrees_rarete_valide check (rarete is null or rarete in ('commune', 'rare', 'epique', 'legendaire', 'exotique'))
);

create index if not exists livrees_atelier_auteur on public.livrees_atelier (auteur, cree_le desc);
create index if not exists livrees_atelier_statut on public.livrees_atelier (statut, cree_le);

alter table public.livrees_atelier enable row level security;
revoke all on public.livrees_atelier from anon, authenticated;

-- ---------------------------------------------------------------------------
-- 3. proposer_livree
-- ---------------------------------------------------------------------------

create or replace function public.proposer_livree(p_voiture text, p_nom text, p_description text, p_donnees jsonb)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_joueur uuid := auth.uid();
  v_id uuid;
begin
  if v_joueur is null then
    raise exception 'Connexion requise pour proposer une livrée.';
  end if;
  if not exists (select 1 from public.profils p where p.id = v_joueur) then
    raise exception 'Choisis un pseudo avant de proposer une livrée.';
  end if;
  if p_donnees is null or jsonb_typeof(p_donnees) <> 'object' or jsonb_typeof(p_donnees -> 'elements') <> 'array'
     or jsonb_array_length(p_donnees -> 'elements') not between 1 and 10 then
    raise exception 'Livrée invalide : 1 à 10 motifs.';
  end if;
  if octet_length(p_donnees::text) > 6000 then
    raise exception 'Livrée trop lourde.';
  end if;
  if (select count(*) from public.livrees_atelier l where l.auteur = v_joueur and l.cree_le > now() - interval '24 hours') >= 3 then
    raise exception 'Limite atteinte : 3 propositions par 24 h.';
  end if;
  if (select count(*) from public.livrees_atelier l where l.auteur = v_joueur and l.statut = 'proposee') >= 10 then
    raise exception 'Limite atteinte : 10 propositions en attente de validation.';
  end if;

  insert into public.livrees_atelier (auteur, voiture, nom, description, donnees)
  values (v_joueur, p_voiture, btrim(p_nom), btrim(p_description),
          jsonb_strip_nulls(jsonb_build_object('elements', p_donnees -> 'elements', 'couleurForcee', p_donnees -> 'couleurForcee')))
  returning id into v_id;
  return v_id;
end;
$$;
revoke all on function public.proposer_livree(text, text, text, jsonb) from public, anon;
grant execute on function public.proposer_livree(text, text, text, jsonb) to authenticated;

-- ---------------------------------------------------------------------------
-- 4. lectures
-- ---------------------------------------------------------------------------

-- Livrées validées : lisibles par tout le monde (le jeu les ajoute à ses livrées et à ses caisses).
create or replace function public.livrees_officielles()
returns table (id uuid, voiture text, nom text, description text, donnees jsonb, rarete text, pseudo text)
language sql
stable
security definer
set search_path = public
as $$
  select l.id, l.voiture, l.nom, l.description, l.donnees, l.rarete, p.pseudo
    from public.livrees_atelier l
    join public.profils p on p.id = l.auteur
   where l.statut = 'validee'
   order by l.modere_le, l.id;
$$;
revoke all on function public.livrees_officielles() from public;
grant execute on function public.livrees_officielles() to anon, authenticated;

-- Propositions du joueur connecté, les plus récentes d'abord.
create or replace function public.mes_livrees()
returns table (id uuid, voiture text, nom text, description text, donnees jsonb, statut text, rarete text, motif_refus text, cree_le timestamptz)
language sql
stable
security definer
set search_path = public
as $$
  select l.id, l.voiture, l.nom, l.description, l.donnees, l.statut, l.rarete, l.motif_refus, l.cree_le
    from public.livrees_atelier l
   where l.auteur = auth.uid()
   order by l.cree_le desc
   limit 50;
$$;
revoke all on function public.mes_livrees() from public, anon;
grant execute on function public.mes_livrees() to authenticated;

-- ---------------------------------------------------------------------------
-- 5. modération (administrateurs)
-- ---------------------------------------------------------------------------

create or replace function public.livrees_a_moderer()
returns table (id uuid, voiture text, nom text, description text, donnees jsonb, pseudo text, cree_le timestamptz)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.est_admin() then
    raise exception 'Réservé aux administrateurs.';
  end if;
  return query
    select l.id, l.voiture, l.nom, l.description, l.donnees, p.pseudo, l.cree_le
      from public.livrees_atelier l
      join public.profils p on p.id = l.auteur
     where l.statut = 'proposee'
     order by l.cree_le
     limit 50;
end;
$$;
revoke all on function public.livrees_a_moderer() from public, anon;
grant execute on function public.livrees_a_moderer() to authenticated;

-- Valider (avec une rareté) ou refuser (avec un motif facultatif). Une livrée validée devient l'objet
-- « voiture:atelier-<12 premiers chiffres de son id> » du catalogue des caisses.
create or replace function public.moderer_livree(p_id uuid, p_valider boolean, p_rarete text, p_motif text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_l public.livrees_atelier%rowtype;
  v_skin text;
begin
  if not public.est_admin() then
    raise exception 'Réservé aux administrateurs.';
  end if;
  select * into v_l from public.livrees_atelier l where l.id = p_id for update;
  if not found then
    raise exception 'Livrée introuvable.';
  end if;

  if not p_valider then
    update public.livrees_atelier
       set statut = 'refusee', rarete = null, motif_refus = left(nullif(btrim(coalesce(p_motif, '')), ''), 200), modere_le = now()
     where id = p_id;
    -- une livrée déjà validée puis refusée sort des caisses (ceux qui l'ont gardent leur exemplaire)
    delete from public.catalogue_skins c where c.voiture = v_l.voiture and c.id = 'atelier-' || left(replace(p_id::text, '-', ''), 12);
    return;
  end if;

  if p_rarete is null or p_rarete not in ('commune', 'rare', 'epique', 'legendaire', 'exotique') then
    raise exception 'Rareté invalide.';
  end if;
  v_skin := 'atelier-' || left(replace(p_id::text, '-', ''), 12);

  update public.livrees_atelier
     set statut = 'validee', rarete = p_rarete, motif_refus = null, modere_le = now()
   where id = p_id;

  insert into public.catalogue_skins (voiture, id, rarete) values (v_l.voiture, v_skin, p_rarete)
  on conflict (voiture, id) do update set rarete = excluded.rarete;

  -- le créateur reçoit sa livrée et 5 clés, une seule fois (première validation)
  if not v_l.recompensee then
    perform public.progression_assurer(v_l.auteur);
    update public.progressions g
       set debloques = case when (v_l.voiture || ':' || v_skin) = any (g.debloques) then g.debloques
                            else array_append(g.debloques, v_l.voiture || ':' || v_skin) end,
           cles = g.cles + 5,
           maj = now()
     where g.joueur = v_l.auteur;
    update public.livrees_atelier set recompensee = true where id = p_id;
  end if;
end;
$$;
revoke all on function public.moderer_livree(uuid, boolean, text, text) from public, anon;
grant execute on function public.moderer_livree(uuid, boolean, text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- 6. Se déclarer administrateur (UNE fois, à adapter) : remplace l'email par celui de ton compte
-- ---------------------------------------------------------------------------
-- insert into public.admins (joueur)
-- select u.id from auth.users u where lower(u.email) = lower('ton.email@exemple.fr')
-- on conflict do nothing;
