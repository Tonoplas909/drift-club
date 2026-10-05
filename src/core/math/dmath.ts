/**
 * Fonctions mathématiques DÉTERMINISTES : même résultat, au bit près, dans tous les navigateurs et sur le serveur.
 *
 * `Math.sin`, `Math.atan2`, `Math.hypot`… ne sont pas spécifiés au bit près : Chrome, Firefox et Safari peuvent
 * différer sur le dernier chiffre, et la course (très sensible) finit par diverger. Le serveur rejoue les courses
 * pour vérifier les scores : la simulation (`src/core`) n'utilise donc que ces fonctions, écrites avec les seules
 * opérations exactes de l'IEEE 754 (+, −, ×, ÷, `Math.sqrt`, `Math.floor`, `Math.round`).
 *
 * Algorithmes et coefficients de fdlibm (FreeBSD msun), précision de l'ordre de 1 ulp.
 */

// --- sin / cos ---------------------------------------------------------------------------------------------

const S1 = -1.66666666666666324348e-01, S2 = 8.33333333332248946124e-03, S3 = -1.98412698298579493134e-04;
const S4 = 2.75573137070700676789e-06, S5 = -2.50507602534068634195e-08, S6 = 1.58969099521155010221e-10;
const C1 = 4.16666666666666019037e-02, C2 = -1.38888888888741095749e-03, C3 = 2.48015872894767294178e-05;
const C4 = -2.75573143513906633035e-07, C5 = 2.08757232129817482790e-09, C6 = -1.13596475577881948265e-11;

/** sin(x + y) pour |x| ≤ π/4 (y : correction de la réduction). */
function kSin(x: number, y: number): number {
  const z = x * x, w = z * z;
  const r = S2 + z * (S3 + z * S4) + z * w * (S5 + z * S6);
  const v = z * x;
  return x - ((z * (0.5 * y - v * r) - y) - v * S1);
}

/** cos(x + y) pour |x| ≤ π/4. */
function kCos(x: number, y: number): number {
  const z = x * x;
  let w = z * z;
  const r = z * (C1 + z * (C2 + z * C3)) + w * w * (C4 + z * (C5 + z * C6));
  const hz = 0.5 * z;
  w = 1 - hz;
  return w + (((1 - w) - hz) + (z * r - x * y));
}

const INV_PIO2 = 6.36619772367581382433e-01;
const PIO2_1 = 1.57079632673412561417e+00, PIO2_2 = 6.07710050630396597660e-11, PIO2_2T = 2.02226624879595063154e-21;

let redY0 = 0, redY1 = 0;
/** Réduit x à y0 + y1 dans [−π/4, π/4] (Cody-Waite, π/2 en trois morceaux) et renvoie le quadrant. */
function reduire(x: number): number {
  if (x >= -0.7853981633974483 && x <= 0.7853981633974483) { redY0 = x; redY1 = 0; return 0; }
  const n = Math.round(x * INV_PIO2);
  let r = x - n * PIO2_1;
  let w = n * PIO2_2;
  const t = r;
  r = t - w;
  w = n * PIO2_2T - ((t - r) - w);
  redY0 = r - w;
  redY1 = (r - redY0) - w;
  return ((n % 4) + 4) % 4;
}

export function sin(x: number): number {
  if (!Number.isFinite(x)) return NaN;
  switch (reduire(x)) {
    case 0: return kSin(redY0, redY1);
    case 1: return kCos(redY0, redY1);
    case 2: return -kSin(redY0, redY1);
    default: return -kCos(redY0, redY1);
  }
}

export function cos(x: number): number {
  if (!Number.isFinite(x)) return NaN;
  switch (reduire(x)) {
    case 0: return kCos(redY0, redY1);
    case 1: return -kSin(redY0, redY1);
    case 2: return -kCos(redY0, redY1);
    default: return kSin(redY0, redY1);
  }
}

export function tan(x: number): number {
  return sin(x) / cos(x);
}

// --- atan / atan2 ------------------------------------------------------------------------------------------

const ATANHI = [4.63647609000806093515e-01, 7.85398163397448278999e-01, 9.82793723247329054082e-01, 1.57079632679489655800e+00];
const ATANLO = [2.26987774529616870924e-17, 3.06161699786838301793e-17, 1.39033110312309984516e-17, 6.12323399573676603587e-17];
const AT = [
  3.33333333333329318027e-01, -1.99999999998764832476e-01, 1.42857142725034663711e-01, -1.11111104054623557880e-01,
  9.09088713343650656196e-02, -7.69187620504482999495e-02, 6.66107313738753120669e-02, -5.83357013379057348645e-02,
  4.97687799461593236017e-02, -3.65315727442169155270e-02, 1.62858201153657823623e-02,
];

export function atan(x: number): number {
  if (Number.isNaN(x)) return NaN;
  const neg = x < 0;
  let a = neg ? -x : x;
  if (a >= 7.378697629483821e19) { // 2^66
    const z = ATANHI[3] + ATANLO[3];
    return neg ? -z : z;
  }
  let id = -1;
  if (a < 0.4375) {
    if (a < 7.450580596923828e-9) return x; // 2^-27
  } else if (a < 1.1875) {
    if (a < 0.6875) { id = 0; a = (2 * a - 1) / (2 + a); } else { id = 1; a = (a - 1) / (a + 1); }
  } else if (a < 2.4375) {
    id = 2; a = (a - 1.5) / (1 + 1.5 * a);
  } else {
    id = 3; a = -1 / a;
  }
  const z = a * a, w = z * z;
  const s1 = z * (AT[0] + w * (AT[2] + w * (AT[4] + w * (AT[6] + w * (AT[8] + w * AT[10])))));
  const s2 = w * (AT[1] + w * (AT[3] + w * (AT[5] + w * (AT[7] + w * AT[9]))));
  if (id < 0) return x - x * (s1 + s2);
  const r = ATANHI[id] - ((a * (s1 + s2) - ATANLO[id]) - a);
  return neg ? -r : r;
}

const PI = 3.1415926535897931160e+00, PI_LO = 1.2246467991473531772e-16, PI_O_2 = 1.5707963267948965580e+00;

const negatif = (v: number): boolean => v < 0 || Object.is(v, -0);

/** Angle de (x, y) dans ]−π, π], mêmes cas particuliers que `Math.atan2`. */
export function atan2(y: number, x: number): number {
  if (Number.isNaN(x) || Number.isNaN(y)) return NaN;
  if (x === 1) return atan(y);
  const m = (negatif(y) ? 1 : 0) + (negatif(x) ? 2 : 0);
  if (y === 0) return m === 0 || m === 1 ? y : m === 2 ? PI : -PI;
  if (x === 0) return m & 1 ? -PI_O_2 : PI_O_2;
  if (!Number.isFinite(x)) {
    if (!Number.isFinite(y)) return [PI / 4, -PI / 4, 3 * PI / 4, -3 * PI / 4][m];
    return [0, -0, PI, -PI][m];
  }
  if (!Number.isFinite(y)) return m & 1 ? -PI_O_2 : PI_O_2;
  const q = Math.abs(y / x);
  const z = m >= 2 && q < 8.673617379884035e-19 ? 0 : atan(q); // 2^-60
  switch (m) {
    case 0: return z;
    case 1: return -z;
    case 2: return PI - (z - PI_LO);
    default: return (z - PI_LO) - PI;
  }
}

// --- exp ---------------------------------------------------------------------------------------------------

const LN2_HI = 6.93147180369123816490e-01, LN2_LO = 1.90821492927058770002e-10, INV_LN2 = 1.44269504088896338700e+00;
const P1 = 1.66666666666666019037e-01, P2 = -2.77777777770155933842e-03, P3 = 6.61375632143793436117e-05;
const P4 = -1.65339022054652515390e-06, P5 = 4.13813679705723846039e-08;

const vue = new DataView(new ArrayBuffer(8));
/** 2^k exact pour −1022 ≤ k ≤ 1023 (écrit directement l'exposant). */
function puissance2(k: number): number {
  vue.setUint32(0, (k + 1023) << 20);
  vue.setUint32(4, 0);
  return vue.getFloat64(0);
}

export function exp(x: number): number {
  if (Number.isNaN(x)) return NaN;
  if (x > 7.09782712893383973096e+02) return Infinity;
  if (x < -7.45133219101941108420e+02) return 0;
  const ax = Math.abs(x);
  let k = 0, hi = 0, lo = 0;
  if (ax > 0.34657359027997264) { // ln2 / 2
    k = ax < 1.0397207708399179 ? (x < 0 ? -1 : 1) : Math.trunc(INV_LN2 * x + (x < 0 ? -0.5 : 0.5)); // 1,5 ln2
    hi = x - k * LN2_HI;
    lo = k * LN2_LO;
    x = hi - lo;
  } else if (ax < 3.725290298461914e-9) { // 2^-28
    return 1 + x;
  }
  const t = x * x;
  const c = x - t * (P1 + t * (P2 + t * (P3 + t * (P4 + t * P5))));
  if (k === 0) return 1 - ((x * c) / (c - 2) - x);
  let y = 1 - ((lo - (x * c) / (2 - c)) - hi);
  // y × 2^k en deux fois aux extrémités (dépassement ou nombres dénormalisés)
  if (k > 1023) { y *= puissance2(1023); k -= 1023; }
  if (k < -1000) { y *= puissance2(-1000); k += 1000; }
  return y * puissance2(k);
}

// --- hypot -------------------------------------------------------------------------------------------------

/** √(a² + b² [+ c²]) : pas de protection contre le dépassement (inutile aux échelles du jeu). */
export function hypot(a: number, b: number, c = 0): number {
  return Math.sqrt(a * a + b * b + c * c);
}
