-- Drift Club : place du joueur connecté dans le classement de plusieurs niveaux (affichée sous chaque niveau).
-- À coller dans Supabase → SQL Editor → Run, après 0002. Le script peut être relancé sans danger.
--
-- Pour chaque niveau demandé où le joueur a un score : son meilleur score (tous modes confondus),
-- son rang (1 + nombre de lignes strictement meilleures, comme classement_niveau) et le nombre total de lignes.
-- security invoker : ne lit que ce que les policies de lecture autorisent déjà (lecture publique des scores).

create or replace function public.mes_places(p_niveaux text[])
returns table (niveau text, rang int, total int, score int, mode text)
language sql
stable
set search_path = public
as $$
  with moi as (
    select distinct on (s.niveau) s.niveau, s.score, s.mode
      from public.scores s
     where s.joueur = auth.uid()
       and s.niveau = any (p_niveaux[1:200])
     order by s.niveau, s.score desc
  )
  select m.niveau,
         (1 + (select count(*) from public.scores t where t.niveau = m.niveau and t.score > m.score))::int,
         (select count(*) from public.scores t where t.niveau = m.niveau)::int,
         m.score,
         m.mode
    from moi m;
$$;

revoke all on function public.mes_places(text[]) from public, anon;
grant execute on function public.mes_places(text[]) to authenticated;
