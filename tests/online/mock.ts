import type { SupabaseClient } from '@supabase/supabase-js';

type Rep = { data?: unknown; error?: unknown };

/** Faux client Supabase minimal : chaque appel est journalisé, les réponses se règlent dans `rep`. */
export function faussClient(rep: Partial<Record<string, Rep | (() => Rep | Promise<Rep>)>> = {}) {
  const appels: { nom: string; args: unknown[] }[] = [];
  let ecouteur: ((evt: string, session: unknown) => void) | null = null;
  const r = async (nom: string, args: unknown[]): Promise<Rep> => {
    appels.push({ nom, args });
    const v = rep[nom];
    const res = typeof v === 'function' ? await v() : v;
    return res ?? { data: null, error: null };
  };
  /** builder chaînable et « thenable » comme PostgREST */
  const builder = (nom: string, args: unknown[]) => {
    const b: Record<string, unknown> = {};
    for (const m of ['select', 'eq']) b[m] = (...a: unknown[]) => { appels.push({ nom: `${nom}.${m}`, args: a }); return b; };
    b.maybeSingle = () => r(`${nom}.maybeSingle`, args);
    b.then = (ok: (v: Rep) => unknown, ko: (e: unknown) => unknown) => r(nom, args).then(ok, ko);
    return b;
  };
  const client = {
    auth: {
      onAuthStateChange: (f: (evt: string, session: unknown) => void) => { ecouteur = f; return { data: { subscription: { unsubscribe() {} } } }; },
      signUp: (...a: unknown[]) => r('signUp', a),
      signInWithPassword: (...a: unknown[]) => r('signInWithPassword', a),
      signOut: (...a: unknown[]) => r('signOut', a),
      resetPasswordForEmail: (...a: unknown[]) => r('resetPasswordForEmail', a),
      updateUser: (...a: unknown[]) => r('updateUser', a),
    },
    from: (table: string) => ({
      select: (...a: unknown[]) => builder(`${table}.select`, a),
      insert: (...a: unknown[]) => builder(`${table}.insert`, a),
      upsert: (...a: unknown[]) => builder(`${table}.upsert`, a),
    }),
    rpc: (...a: unknown[]) => r(`rpc.${String(a[0])}`, a),
  };
  return {
    client: client as unknown as SupabaseClient,
    appels,
    emettre: (evt: string, session: unknown) => ecouteur?.(evt, session),
    ecoute: () => ecouteur !== null,
    fournisseur: async () => client as unknown as SupabaseClient,
  };
}

export const session = (id = 'u1', email = 'a@b.fr', pseudo?: string) => ({
  user: { id, email, user_metadata: pseudo ? { pseudo } : {} },
});
