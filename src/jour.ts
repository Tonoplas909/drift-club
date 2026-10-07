/** Dates des défis du jour : un jour commence à minuit, heure de Paris (jeu et serveur font le même calcul). */

/** « AAAA-MM-JJ » de l'instant `d` à Paris. */
export function jourParis(d: Date): string {
  // fr-CA écrit les dates en AAAA-MM-JJ
  return new Intl.DateTimeFormat('fr-CA', { timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
}

/** Jour décalé de `n` jours (−1 : la veille). */
export function decalerJour(jour: string, n: number): string {
  const [a, m, j] = jour.split('-').map(Number);
  return new Date(Date.UTC(a, m - 1, j + n)).toISOString().slice(0, 10);
}
