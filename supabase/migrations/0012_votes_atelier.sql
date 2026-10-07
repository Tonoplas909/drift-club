-- Drift Club : votes dans l'Atelier (v0.5.18).
-- À coller dans Supabase → SQL Editor → Run, après 0010. Le script peut être relancé sans danger.
--
-- Les joueurs voient les propositions en attente et votent (j'aime / j'aime pas, un vote par joueur et par
-- proposition, pas sur les siennes) ; l'administrateur les voit triées par popularité avant de valider ; la
-- « livrée de la semaine » (la plus aimée des livrées validées ces 7 derniers jours) est mise en avant sur l'écran
-- des caisses. Seul le pseudo des auteurs est montré, jamais leur adresse email.
--   * livrees_en_vote(limite) : propositions en attente, avec les votes et celui du joueur connecté ;
--   * voter_livree(id, vote)  : 1 j'aime, -1 j'aime pas, 0 retire le vote (200 votes par 24 h au plus) ;
--   * livrees_a_moderer()     : comme 0010, avec les votes, les plus aimées d'abord ;
--   * livree_de_la_semaine()  : lisible par tout le monde.

-- ---------------------------------------------------------------------------
-- 1. livrees_votes
-- ---------------------------------------------------------------------------

create table if not exists public.livrees_votes (
  livree uuid not null references public.livrees_atelier (id) on delete cascade,
  joueur uuid not null references public.profils (id) on delete cascade,
  vote   smallint not null,
  le     timestamptz not null default now(),
  primary key (livree, joueur),
  constraint livrees_votes_valeur check (vote in (-1, 1))
);
create index if not exists livrees_votes_joueur on public.livrees_votes (joueur, le desc);
alter table public.livrees_votes enable row level security;
revoke all on public.livrees_votes from anon, authenticated;

-- ---------------------------------------------------------------------------
-- 2. livrees_en_vote
-- ---------------------------------------------------------------------------

create or replace function public.livrees_en_vote(p_limite int default 40)
returns table (id uuid, voiture text, nom text, description text, donnees jsonb, pseudo text, cree_le timestamptz,
               pour int, contre int, mon_vote int, mienne boolean)
language sql
stable
security definer
set search_path = public
as $$
  select l.id, l.voiture, l.nom, l.description, l.donnees, p.pseudo, l.cree_le,
         (select count(*)::int from public.livrees_votes v where v.livree = l.id and v.vote = 1),
         (select count(*)::int from public.livrees_votes v where v.livree = l.id and v.vote = -1),
         (select v.vote::int from public.livrees_votes v where v.livree = l.id and v.joueur = auth.uid()),
         l.auteur = auth.uid()
    from public.livrees_atelier l
    join public.profils p on p.id = l.auteur
   where l.statut = 'proposee'
   order by l.cree_le desc
   limit least(greatest(coalesce(p_limite, 40), 1), 100);
$$;
revoke all on function public.livrees_en_vote(int) from public;
grant execute on function public.livrees_en_vote(int) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 3. voter_livree
-- ---------------------------------------------------------------------------

create or replace function public.voter_livree(p_id uuid, p_vote int)
returns table (pour int, contre int, mon_vote int)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_joueur uuid := auth.uid();
  v_l public.livrees_atelier%rowtype;
begin
  if v_joueur is null then
    raise exception 'Connexion requise pour voter.';
  end if;
  if not exists (select 1 from public.profils p where p.id = v_joueur) then
    raise exception 'Choisis un pseudo avant de voter.';
  end if;
  if p_vote is null or p_vote not in (-1, 0, 1) then
    raise exception 'Vote invalide.';
  end if;
  select * into v_l from public.livrees_atelier l where l.id = p_id;
  if not found or v_l.statut <> 'proposee' then
    raise exception 'Cette proposition n''est plus soumise au vote.';
  end if;
  if v_l.auteur = v_joueur then
    raise exception 'Tu ne peux pas voter pour ta propre livrée.';
  end if;
  if p_vote = 0 then
    delete from public.livrees_votes v where v.livree = p_id and v.joueur = v_joueur;
  else
    if (select count(*) from public.livrees_votes v where v.joueur = v_joueur and v.le > now() - interval '24 hours') >= 200 then
      raise exception 'Limite atteinte : 200 votes par 24 h.';
    end if;
    insert into public.livrees_votes as v (livree, joueur, vote) values (p_id, v_joueur, p_vote)
    on conflict (livree, joueur) do update set vote = excluded.vote, le = now();
  end if;
  select count(*) filter (where v.vote = 1)::int, count(*) filter (where v.vote = -1)::int
    into pour, contre
    from public.livrees_votes v where v.livree = p_id;
  mon_vote := nullif(p_vote, 0);
  return next;
end;
$$;
revoke all on function public.voter_livree(uuid, int) from public, anon;
grant execute on function public.voter_livree(uuid, int) to authenticated;

-- ---------------------------------------------------------------------------
-- 4. livrees_a_moderer : avec les votes, les plus aimées d'abord (remplace la version de 0010)
-- ---------------------------------------------------------------------------

drop function if exists public.livrees_a_moderer();
create function public.livrees_a_moderer()
returns table (id uuid, voiture text, nom text, description text, donnees jsonb, pseudo text, cree_le timestamptz, pour int, contre int)
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
    select t.id, t.voiture, t.nom, t.description, t.donnees, t.pseudo, t.cree_le, t.pour, t.contre
      from (
        select l.id, l.voiture, l.nom, l.description, l.donnees, p.pseudo, l.cree_le,
               (select count(*)::int from public.livrees_votes v where v.livree = l.id and v.vote = 1) as pour,
               (select count(*)::int from public.livrees_votes v where v.livree = l.id and v.vote = -1) as contre
          from public.livrees_atelier l
          join public.profils p on p.id = l.auteur
         where l.statut = 'proposee'
      ) t
     order by t.pour - t.contre desc, t.cree_le
     limit 50;
end;
$$;
revoke all on function public.livrees_a_moderer() from public, anon;
grant execute on function public.livrees_a_moderer() to authenticated;

-- ---------------------------------------------------------------------------
-- 5. livree_de_la_semaine : la plus aimée des livrées validées ces 7 derniers jours
-- ---------------------------------------------------------------------------

create or replace function public.livree_de_la_semaine()
returns table (id uuid, voiture text, nom text, pseudo text, pour int)
language sql
stable
security definer
set search_path = public
as $$
  select t.id, t.voiture, t.nom, t.pseudo, t.pour
    from (
      select l.id, l.voiture, l.nom, p.pseudo, l.modere_le,
             (select count(*)::int from public.livrees_votes v where v.livree = l.id and v.vote = 1) as pour,
             (select count(*)::int from public.livrees_votes v where v.livree = l.id and v.vote = -1) as contre
        from public.livrees_atelier l
        join public.profils p on p.id = l.auteur
       where l.statut = 'validee' and l.modere_le > now() - interval '7 days'
    ) t
   where t.pour > 0
   order by t.pour - t.contre desc, t.pour desc, t.modere_le desc
   limit 1;
$$;
revoke all on function public.livree_de_la_semaine() from public;
grant execute on function public.livree_de_la_semaine() to anon, authenticated;
