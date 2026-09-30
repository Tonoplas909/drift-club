-- Drift Club : niveaux publiés en ligne (partage public depuis l'éditeur).
-- À coller dans Supabase → SQL Editor → Run, après 0001. Le script peut être relancé sans danger.
--
-- Principe de sécurité (comme 0001) : la clé publiable du client est publique, donc tout passe par RLS.
--   * niveaux_publics : lecture pour tout le monde, AUCUNE écriture directe ; on n'écrit que via
--                       publier_niveau / retirer_niveau / compter_partie (security definer) qui contrôlent les valeurs.
--   * Le serveur ne peut pas rejouer la validation complète (croisements de route…) : le jeu
--     re-valide chaque niveau reçu avant de le charger et ne fait jamais confiance à la base.

-- ---------------------------------------------------------------------------
-- 1. Table des niveaux publiés
-- ---------------------------------------------------------------------------

create table if not exists public.niveaux_publics (
  id        uuid primary key default gen_random_uuid(),
  auteur    uuid not null references public.profils (id) on delete cascade,
  nom       text not null,
  donnees   jsonb not null,
  empreinte text not null,
  longueur  real not null,
  cree_le   timestamptz not null default now(),
  maj       timestamptz not null default now(),
  parties   integer not null default 0,
  constraint niveaux_publics_nom_longueur     check (char_length(nom) between 1 and 40),
  constraint niveaux_publics_empreinte_format check (empreinte ~ '^[0-9a-f]{64}$'),
  constraint niveaux_publics_longueur_valide  check (longueur >= 0 and longueur <= 3001),
  constraint niveaux_publics_donnees_objet    check (jsonb_typeof(donnees) = 'object'),
  constraint niveaux_publics_donnees_taille   check (octet_length(donnees::text) <= 60000),
  constraint niveaux_publics_parties_positif  check (parties >= 0)
);

-- Sert aux deux tris de la liste et aux limites par auteur.
create index if not exists niveaux_publics_recent_idx   on public.niveaux_publics (cree_le desc);
create index if not exists niveaux_publics_populaire_idx on public.niveaux_publics (parties desc, cree_le desc);
create index if not exists niveaux_publics_auteur_idx   on public.niveaux_publics (auteur, cree_le desc);
-- Un même contenu une seule fois PAR AUTEUR (une unicité globale permettrait de « squatter »
-- l'empreinte d'un niveau d'un autre joueur avec des données bidon avant qu'il ne le publie).
create unique index if not exists niveaux_publics_auteur_empreinte on public.niveaux_publics (auteur, empreinte);
create index if not exists niveaux_publics_empreinte_idx on public.niveaux_publics (empreinte);

alter table public.niveaux_publics enable row level security;

drop policy if exists "niveaux_publics_lecture" on public.niveaux_publics;
create policy "niveaux_publics_lecture" on public.niveaux_publics
  for select to anon, authenticated using (true);

-- Volontairement AUCUNE policy insert/update/delete : seules les fonctions ci-dessous écrivent.
-- Supabase accorde par défaut tous les droits à anon/authenticated : on repart de zéro.
revoke all on public.niveaux_publics from anon, authenticated;
grant select on public.niveaux_publics to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 2. publier_niveau : publie un niveau (une seule fois par contenu et par auteur)
-- ---------------------------------------------------------------------------

create or replace function public.publier_niveau(
  p_donnees   jsonb,
  p_empreinte text,
  p_longueur  real
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_joueur uuid := auth.uid();
  v_nom    text;
  v_id     uuid;
begin
  if v_joueur is null then
    raise exception 'Connexion requise pour publier un niveau.';
  end if;
  -- FOR UPDATE : deux publications simultanées du même joueur se suivent (les limites restent exactes).
  perform 1 from public.profils p where p.id = v_joueur for update;
  if not found then
    raise exception 'Choisis un pseudo avant de publier un niveau.';
  end if;

  -- Structure minimale (le jeu refait la validation complète à la lecture).
  if p_donnees is null or jsonb_typeof(p_donnees) <> 'object' then
    raise exception 'Niveau invalide : format de données inattendu.';
  end if;
  if p_donnees->'format' is distinct from '1'::jsonb then
    raise exception 'Niveau invalide : format non pris en charge.';
  end if;
  if jsonb_typeof(p_donnees->'nom') is distinct from 'string'
     or char_length(btrim(p_donnees->>'nom')) not between 1 and 40 then
    raise exception 'Niveau invalide : le nom doit faire de 1 à 40 caractères.';
  end if;
  if jsonb_typeof(p_donnees->'route') is distinct from 'array'
     or jsonb_array_length(p_donnees->'route') not between 2 and 150 then
    raise exception 'Niveau invalide : la route doit avoir de 2 à 150 points.';
  end if;
  if coalesce(jsonb_typeof(p_donnees->'objets'), 'array') <> 'array'
     or jsonb_array_length(coalesce(p_donnees->'objets', '[]'::jsonb)) > 300 then
    raise exception 'Niveau invalide : 300 objets au maximum.';
  end if;
  if coalesce(jsonb_typeof(p_donnees->'barrieres'), 'array') <> 'array'
     or jsonb_array_length(coalesce(p_donnees->'barrieres', '[]'::jsonb)) > 150 then
    raise exception 'Niveau invalide : 150 barrières au maximum.';
  end if;
  if octet_length(p_donnees::text) > 60000 then
    raise exception 'Niveau trop volumineux pour être publié.';
  end if;
  if p_empreinte is null or p_empreinte !~ '^[0-9a-f]{64}$' then
    raise exception 'Niveau invalide : empreinte incorrecte.';
  end if;
  if p_longueur is null or p_longueur < 0 or p_longueur > 3001 then
    raise exception 'Niveau invalide : longueur de route hors limites (3 km maximum).';
  end if;

  -- Déjà publié par ce joueur (même contenu) : on renvoie l'existant, pas de doublon.
  select n.id into v_id from public.niveaux_publics n where n.auteur = v_joueur and n.empreinte = p_empreinte;
  if found then
    return v_id;
  end if;

  if (select count(*) from public.niveaux_publics n where n.auteur = v_joueur) >= 50 then
    raise exception 'Limite atteinte : 50 niveaux publiés au maximum. Retire-en un avant d''en publier un autre.';
  end if;
  if (select count(*) from public.niveaux_publics n
       where n.auteur = v_joueur and n.cree_le > now() - interval '24 hours') >= 10 then
    raise exception 'Limite atteinte : 10 niveaux publiés par 24 heures. Réessaie plus tard.';
  end if;

  v_nom := btrim(p_donnees->>'nom');
  insert into public.niveaux_publics (auteur, nom, donnees, empreinte, longueur)
  values (v_joueur, v_nom, p_donnees, p_empreinte, p_longueur)
  returning id into v_id;
  return v_id;
end;
$$;

-- Supabase accorde par défaut l'exécution à anon : on la retire explicitement.
revoke all on function public.publier_niveau(jsonb, text, real) from public, anon;
grant execute on function public.publier_niveau(jsonb, text, real) to authenticated;

-- ---------------------------------------------------------------------------
-- 3. retirer_niveau : l'auteur retire son niveau
-- ---------------------------------------------------------------------------

create or replace function public.retirer_niveau(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Connexion requise pour retirer un niveau.';
  end if;
  delete from public.niveaux_publics n where n.id = p_id and n.auteur = auth.uid();
  if not found then
    raise exception 'Ce niveau n''existe pas ou ne t''appartient pas.';
  end if;
end;
$$;

revoke all on function public.retirer_niveau(uuid) from public, anon;
grant execute on function public.retirer_niveau(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 4. compter_partie : +1 partie (compteur approximatif, joueurs non connectés compris)
-- ---------------------------------------------------------------------------

create or replace function public.compter_partie(p_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update public.niveaux_publics set parties = parties + 1 where id = p_id;
$$;

revoke all on function public.compter_partie(uuid) from public;
grant execute on function public.compter_partie(uuid) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 5. Lecture : liste paginée et niveau complet
-- ---------------------------------------------------------------------------
-- security invoker (par défaut) : les policies de lecture ci-dessus l'autorisent pour tout le monde.

create or replace function public.niveaux_en_ligne(
  p_tri      text default 'recent',
  p_limite   int  default 30,
  p_decalage int  default 0
)
returns table (id uuid, nom text, auteur uuid, auteur_pseudo text, empreinte text, longueur real, cree_le timestamptz, parties int)
language sql
stable
as $$
  select n.id, n.nom, n.auteur, p.pseudo, n.empreinte, n.longueur, n.cree_le, n.parties
    from public.niveaux_publics n
    join public.profils p on p.id = n.auteur
   order by case when p_tri = 'populaire' then n.parties end desc nulls last,
            n.cree_le desc, n.id
   limit least(greatest(coalesce(p_limite, 30), 1), 50)
  offset greatest(coalesce(p_decalage, 0), 0);
$$;

revoke all on function public.niveaux_en_ligne(text, int, int) from public;
grant execute on function public.niveaux_en_ligne(text, int, int) to anon, authenticated;

create or replace function public.niveau_en_ligne(p_id uuid)
returns table (id uuid, nom text, auteur uuid, auteur_pseudo text, empreinte text, longueur real, cree_le timestamptz, parties int, donnees jsonb)
language sql
stable
as $$
  select n.id, n.nom, n.auteur, p.pseudo, n.empreinte, n.longueur, n.cree_le, n.parties, n.donnees
    from public.niveaux_publics n
    join public.profils p on p.id = n.auteur
   where n.id = p_id;
$$;

revoke all on function public.niveau_en_ligne(uuid) from public;
grant execute on function public.niveau_en_ligne(uuid) to anon, authenticated;
