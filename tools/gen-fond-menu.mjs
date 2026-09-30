// Génère le fond illustré des menus : node tools/gen-fond-menu.mjs src/assets/fond-menu.svg
import { writeFileSync } from 'node:fs';
const OUT = process.argv[2];
const INK = '#15131c';
let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const f = (n) => +n.toFixed(1);

// route : segments bézier [p0, c1, c2, p1, largeur]
const SEG = [
  [[-60, 800], [250, 845], [800, 835], [1120, 765], 118],
  [[1120, 765], [1300, 722], [1340, 655], [1180, 628], 90],
  [[1180, 628], [900, 580], [640, 665], [470, 590], 68],
  [[470, 590], [350, 562], [350, 512], [520, 500], 50],
  [[520, 500], [760, 478], [930, 535], [1040, 490], 36],
  [[1040, 490], [1110, 462], [1100, 432], [1000, 424], 26],
  [[1000, 424], [930, 418], [890, 430], [880, 400], 17],
];
const bez = (s, t) => { const [a, b, c, d] = s; const u = 1 - t; return [0, 1].map((i) => u*u*u*a[i] + 3*u*u*t*b[i] + 3*u*t*t*c[i] + t*t*t*d[i]); };
const roadPts = []; for (const s of SEG) for (let i = 0; i <= 24; i++) roadPts.push([...bez(s, i / 24), s[4]]);
const dPath = (s) => `M${s[0]} C${s[1]} ${s[2]} ${s[3]}`;
const nearRoad = (x, y, m) => roadPts.some(([rx, ry, w]) => Math.hypot(rx - x, (ry - y) * 1.4) < w / 2 + m);

const HILL = [[-60, 720], [100, 660], [250, 520], [400, 450], [560, 415], [700, 395], [870, 370], [1010, 375], [1150, 420], [1240, 500], [1350, 590], [1500, 640], [1660, 660]];
function hillTop(x) {
  for (let i = 1; i < HILL.length; i++) if (x <= HILL[i][0]) { const [a, b] = [HILL[i - 1], HILL[i]]; return a[1] + (b[1] - a[1]) * (x - a[0]) / (b[0] - a[0]); }
  return 660;
}

let o = '';
const add = (s) => { o += s + '\n'; };
add(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 900" preserveAspectRatio="xMidYMax slice">`);
add(`<style>
.nu{animation:nu 70s ease-in-out infinite alternate}.nu2{animation-duration:95s;animation-direction:alternate-reverse}
.fu{transform-box:fill-box;transform-origin:20% 90%;animation:fu 7s ease-out infinite}.f2{animation-delay:-2.3s}.f3{animation-delay:-4.6s}
@keyframes nu{to{transform:translateX(90px)}}
@keyframes fu{0%{transform:translate(0,0) scale(.85);opacity:.9}100%{transform:translate(-46px,-22px) scale(1.15);opacity:.55}}
@media (prefers-reduced-motion:reduce){.nu,.fu{animation:none}}
</style>`);
add(`<defs>
<linearGradient id="ciel" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1c2052"/><stop offset=".38" stop-color="#4a3f8a"/><stop offset=".64" stop-color="#c85c80"/><stop offset=".84" stop-color="#ff8f6b"/><stop offset="1" stop-color="#ffc27a"/></linearGradient>
<radialGradient id="lueur"><stop offset="0" stop-color="#ffd23f" stop-opacity=".55"/><stop offset="1" stop-color="#ff8a1f" stop-opacity="0"/></radialGradient>
<g id="pin" stroke="${INK}" stroke-width="5" stroke-linejoin="round"><rect x="-5" y="-16" width="10" height="16" fill="#2a1f36"/><path fill="currentColor" d="M-36-14H36L0-64Z M-30-42H30L0-88Z M-22-68H22L0-112Z"/></g>
<g id="torii" stroke="${INK}" stroke-width="6" stroke-linejoin="round" fill="#e63b2e"><rect x="-44" y="-100" width="12" height="100"/><rect x="32" y="-100" width="12" height="100"/><path d="M-62-108Q0-96 62-108L66-124Q0-108-66-124Z"/><rect x="-50" y="-88" width="100" height="10"/></g>
</defs>`);
add(`<rect width="1600" height="620" fill="url(#ciel)"/>`);
// étoiles
for (let i = 0; i < 46; i++) { const y = rnd() * 300, x = rnd() * 1600; add(`<circle cx="${f(x)}" cy="${f(y)}" r="${f(1.2 + rnd() * 2)}" fill="#fff7e8" opacity="${f(0.35 + (1 - y / 300) * .5)}"/>`); }
// soleil
add(`<circle cx="1330" cy="430" r="260" fill="url(#lueur)"/>`);
add(`<circle cx="1330" cy="430" r="150" fill="#ffb347" opacity=".55"/>`);
add(`<circle cx="1330" cy="430" r="112" fill="#ffd23f" stroke="${INK}" stroke-width="5"/>`);
// nuages
const nuage = (x, y, w, c, op, cls) => add(`<g class="nu ${cls}" opacity="${op}"><path d="M${x} ${y}h${w}a14 14 0 0 0 0-28h-${w * .25}a20 20 0 0 0-${w * .3}-16a30 30 0 0 0-${w * .35} 16h-${w * .1}a14 14 0 0 0 0 28Z" fill="${c}"/></g>`);
nuage(120, 250, 240, '#ff9a86', .55, '');
nuage(760, 190, 300, '#7a68b8', .5, 'nu2');
nuage(1050, 330, 260, '#ffb08a', .6, '');
nuage(-40, 380, 200, '#ff9a86', .5, 'nu2');
// crêtes lointaines
add(`<path d="M0 540L110 490L200 520L300 470L420 520L560 480L700 530L840 495L960 530L1100 490L1210 520L1330 505L1440 470L1540 500L1600 490V900H0Z" fill="#8a5f9e" stroke="${INK}" stroke-width="4" stroke-linejoin="round"/>`);
// fuji
add(`<path d="M-20 570Q250 530 302 338L330 300L358 338Q410 530 720 570Z" fill="#6a5ba6" stroke="${INK}" stroke-width="5" stroke-linejoin="round"/>`);
add(`<path d="M302 338L330 300L358 338L344 352L332 338L318 358L306 342Z" fill="#fff7e8" stroke="${INK}" stroke-width="4" stroke-linejoin="round"/>`);
// crête moyenne
add(`<path d="M0 600L90 560L180 590L300 545L420 590L560 570L700 610V900H0Z M1180 640L1290 580L1400 620L1500 570L1600 610V900H1180Z" fill="#4d4382" stroke="${INK}" stroke-width="5" stroke-linejoin="round"/>`);
// pins lointains sur la crête moyenne
for (let i = 0; i < 14; i++) { const x = rnd() < .5 ? 20 + rnd() * 620 : 1220 + rnd() * 360; add(`<use href="#pin" transform="translate(${f(x)} ${f(625 + rnd() * 30)}) scale(.42)" color="#3a3675"/>`); }
// colline principale
const COL = 'M-60 900V720C100 660 250 500 400 450C560 400 700 395 870 370C1010 350 1150 420 1240 500C1350 590 1500 640 1660 660V900Z';
add(`<path d="${COL}" fill="#2f2b5c" stroke="${INK}" stroke-width="6" stroke-linejoin="round"/>`);
add(`<path d="M870 370C1010 350 1150 420 1240 500C1350 590 1500 640 1660 660V900H1100C1150 700 1050 520 870 370Z" fill="#241f4c" opacity=".55"/>`);
// pins sur la colline (hors route)
const pins = [];
for (let n = 0; n < 2500 && pins.length < 130; n++) {
  const x = -40 + rnd() * 1700, y = 400 + rnd() * 500;
  if (y < hillTop(x) + 30 || nearRoad(x, y, 34)) continue; pins.push([x, y]);
}
pins.sort((a, b) => a[1] - b[1]);
for (const [x, y] of pins) { const s = 0.2 + (y - 380) / 520 * 0.95; add(`<use href="#pin" transform="translate(${f(x)} ${f(y)}) scale(${f(s)})" color="${y > 650 ? '#1f2350' : '#2b2a63'}"/>`); }
// torii au col
add(`<use href="#torii" transform="translate(858 384) scale(.42)"/>`);
// route : contours, bord crème, asphalte, ligne
const linecap = 'stroke-linecap="round" stroke-linejoin="round" fill="none"';
add(`<g ${linecap}>`);
for (const s of SEG) add(`<path d="${dPath(s)}" stroke="${INK}" stroke-width="${s[4] + 14}"/>`);
for (const s of SEG) add(`<path d="${dPath(s)}" stroke="#fff7e8" stroke-width="${s[4] + 2}"/>`);
for (const s of SEG) add(`<path d="${dPath(s)}" stroke="#454358" stroke-width="${s[4] - 9}"/>`);
for (const s of SEG) add(`<path d="${dPath(s)}" stroke="#ffd23f" stroke-width="${f(Math.max(2.5, s[4] * .05))}" stroke-linecap="butt" stroke-dasharray="${f(s[4] * .42)} ${f(s[4] * .32)}"/>`);
add(`</g>`);
// glissières (côté vide, sous les courbes)
const rail = (i) => { const s = SEG[i]; const w = s[4]; add(`<g transform="translate(0 ${f(w / 2 + 14)})" ${linecap}><path d="${dPath(s)}" stroke="${INK}" stroke-width="${f(w * .09 + 5)}"/><path d="${dPath(s)}" stroke="#dcdcf0" stroke-width="${f(w * .09)}"/><path d="${dPath(s)}" stroke="${INK}" stroke-width="${f(w * .32)}" stroke-linecap="butt" stroke-dasharray="3 ${f(w * .5)}" opacity=".8"/></g>`); };
rail(2);
// traces de pneus
add(`<g fill="none" stroke="${INK}" stroke-linecap="round" opacity=".45"><path d="M330 852C240 862 110 856 -40 822" stroke-width="7"/><path d="M334 830C244 840 114 834 -40 800" stroke-width="7"/></g>`);
// voiture en drift
add(`<g transform="translate(345 828) rotate(-9) scale(1.3)">
<g stroke="${INK}" stroke-width="5" stroke-linejoin="round" stroke-linecap="round">
<path d="M-102-16L-104-34L-84-44L-54-48L-30-70L26-72L54-46L92-38L106-30L106-16Z" fill="#e63b2e"/>
<path d="M-102-16L-104-24L106-24L106-16Z" fill="#b82a20" stroke="none"/>
<path d="M-26-63L20-65L40-49L-44-49Z" fill="#a8dcff"/>
<path d="M-108-52H-78" stroke-width="7"/><path d="M-96-50V-38M-86-50V-40" stroke-width="4"/>
<path d="M98-34L106-32V-26L96-28Z" fill="#ffd23f" stroke-width="3"/>
<circle cx="-64" cy="-14" r="18" fill="${INK}"/><circle cx="64" cy="-14" r="18" fill="${INK}"/>
<circle cx="-64" cy="-14" r="7" fill="#fff7e8" stroke="none"/><circle cx="64" cy="-14" r="7" fill="#fff7e8" stroke="none"/>
</g></g>`);
// fumée
[[206, 844, 32, ''], [148, 830, 44, 'f2'], [82, 810, 36, 'f3'], [44, 782, 26, ''], [226, 812, 24, 'f2']].forEach(([x, y, r, c]) => add(`<circle class="fu ${c}" cx="${x}" cy="${y}" r="${r}" fill="#fff7e8" stroke="${INK}" stroke-width="4" opacity=".85"/>`));
// pins de premier plan
add(`<use href="#pin" transform="translate(-20 960) scale(2.4)" color="#141a36"/>`);
add(`<use href="#pin" transform="translate(-60 950) scale(2.2)" color="#10152e"/>`);
add(`<use href="#pin" transform="translate(1520 940) scale(3.1)" color="#141a36"/>`);
add(`<use href="#pin" transform="translate(1380 930) scale(1.9)" color="#10152e"/>`);
add(`<use href="#pin" transform="translate(1630 960) scale(2.4)" color="#0f142c"/>`);
add(`</svg>`);
writeFileSync(OUT, o);
console.log(o.length, 'octets');
