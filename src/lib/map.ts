// Steam's review-language codes (matches the `language` column in
// stg_steam_review / marts.language_review_score_global), plus the French label
// shown for each in the ranking list and map tooltips.
export type LanguageKey =
  | "arabic"
  | "bulgarian"
  | "schinese"
  | "tchinese"
  | "czech"
  | "danish"
  | "dutch"
  | "english"
  | "finnish"
  | "french"
  | "german"
  | "greek"
  | "hungarian"
  | "italian"
  | "japanese"
  | "koreana"
  | "norwegian"
  | "polish"
  | "portuguese"
  | "brazilian"
  | "romanian"
  | "russian"
  | "spanish"
  | "latam"
  | "swedish"
  | "thai"
  | "turkish"
  | "ukrainian"
  | "vietnamese";

export const LANGUAGE_LABELS: Record<LanguageKey, string> = {
  arabic: "Arabe",
  bulgarian: "Bulgare",
  schinese: "Chinois simplifié",
  tchinese: "Chinois traditionnel",
  czech: "Tchèque",
  danish: "Danois",
  dutch: "Néerlandais",
  english: "Anglais",
  finnish: "Finnois",
  french: "Français",
  german: "Allemand",
  greek: "Grec",
  hungarian: "Hongrois",
  italian: "Italien",
  japanese: "Japonais",
  koreana: "Coréen",
  norwegian: "Norvégien",
  polish: "Polonais",
  portuguese: "Portugais",
  brazilian: "Portugais (Brésil)",
  romanian: "Roumain",
  russian: "Russe",
  spanish: "Espagnol",
  latam: "Espagnol (Amérique latine)",
  swedish: "Suédois",
  thai: "Thaï",
  turkish: "Turc",
  ukrainian: "Ukrainien",
  vietnamese: "Vietnamien",
};

export const FALLBACK_COLOR = "var(--series-fallback)";

// Red/yellow/green, matching the site's own status tokens (--status-critical/
// -warning/-good) so the map's gradient reads consistently with the rest of
// the site's sentiment coloring (e.g. games/[appId]/page.tsx's score labels).
// Chosen deliberately over an accessible diverging pair — literal
// red-to-green is not colorblind-safe (~8% of men can't tell the endpoints
// apart), a tradeoff made knowingly here.
const SCORE_LOW: readonly [number, number, number] = [0xd0, 0x3b, 0x3b];
const SCORE_MID: readonly [number, number, number] = [0xfa, 0xb2, 0x19];
const SCORE_HIGH: readonly [number, number, number] = [0x0c, 0xa3, 0x0c];

function lerpChannel(a: number, b: number, t: number): number {
  return Math.round(a + (b - a) * t);
}

function lerpHex(c1: readonly [number, number, number], c2: readonly [number, number, number], t: number): string {
  return `#${c1.map((v, i) => lerpChannel(v, c2[i], t).toString(16).padStart(2, "0")).join("")}`;
}

// Maps a 0..1 pct_positive to a point on the red -> yellow -> green gradient.
export function scoreToColor(pctPositive: number): string {
  const t = Math.min(1, Math.max(0, pctPositive));
  return t <= 0.5 ? lerpHex(SCORE_LOW, SCORE_MID, t / 0.5) : lerpHex(SCORE_MID, SCORE_HIGH, (t - 0.5) / 0.5);
}

// ISO 3166-1 numeric id (matches world-atlas country ids) -> dominant Steam
// review language. A country is left unmapped, falling back to the neutral
// "non classé" color, when: its dominant language genuinely isn't tracked
// (rare — most countries have one clear official language), the pick would
// be inaccurate (e.g. Taiwan is Traditional not Simplified Chinese, Portugal
// is European not Brazilian Portuguese), or a language split would track a
// contested border or active conflict (Cyprus, Ukraine, Cameroon's
// Anglophone regions, Rwanda, most ex-Soviet Central Asian states beyond
// Belarus/Kazakhstan...) — deliberately left as neutral rather than guessed.
export const COUNTRY_LANGUAGE: Record<string, LanguageKey> = {
  "840": "english", // United States
  "826": "english", // United Kingdom
  "036": "english", // Australia
  "554": "english", // New Zealand
  "372": "english", // Ireland
  "710": "english", // South Africa
  "356": "english", // India
  "124": "english", // Canada
  "044": "english", // Bahamas
  "084": "english", // Belize
  "072": "english", // Botswana
  "748": "english", // eSwatini
  "238": "english", // Falkland Islands
  "242": "english", // Fiji
  "270": "english", // Gambia
  "288": "english", // Ghana
  "328": "english", // Guyana
  "388": "english", // Jamaica
  "404": "english", // Kenya
  "426": "english", // Lesotho
  "430": "english", // Liberia
  "454": "english", // Malawi
  "516": "english", // Namibia
  "566": "english", // Nigeria
  "586": "english", // Pakistan
  "598": "english", // Papua New Guinea
  "608": "english", // Philippines
  "728": "english", // South Sudan
  "694": "english", // Sierra Leone
  "090": "english", // Solomon Islands
  "834": "english", // Tanzania
  "780": "english", // Trinidad and Tobago
  "800": "english", // Uganda
  "894": "english", // Zambia
  "716": "english", // Zimbabwe

  "250": "french", // France
  "056": "french", // Belgium
  "120": "french", // Cameroon
  "450": "french", // Madagascar
  "686": "french", // Senegal
  "466": "french", // Mali
  "562": "french", // Niger
  "854": "french", // Burkina Faso
  "324": "french", // Guinea
  "768": "french", // Togo
  "204": "french", // Benin
  "180": "french", // Democratic Republic of the Congo
  "178": "french", // Republic of the Congo
  "266": "french", // Gabon
  "148": "french", // Chad
  "140": "french", // Central African Republic
  "384": "french", // Côte d'Ivoire
  "108": "french", // Burundi
  "332": "french", // Haiti
  "540": "french", // New Caledonia

  "756": "german", // Switzerland
  "276": "german", // Germany
  "040": "german", // Austria

  "643": "russian", // Russia
  "112": "russian", // Belarus
  "398": "russian", // Kazakhstan

  "076": "brazilian", // Brazil

  "156": "schinese", // China
  "158": "tchinese", // Taiwan

  "392": "japanese", // Japan
  "410": "koreana", // South Korea

  // Steam distinguishes European Spanish from Latin American Spanish.
  "724": "spanish", // Spain
  "032": "latam", // Argentina
  "068": "latam", // Bolivia
  "152": "latam", // Chile
  "170": "latam", // Colombia
  "188": "latam", // Costa Rica
  "192": "latam", // Cuba
  "214": "latam", // Dominican Republic
  "218": "latam", // Ecuador
  "222": "latam", // El Salvador
  "320": "latam", // Guatemala
  "340": "latam", // Honduras
  "484": "latam", // Mexico
  "558": "latam", // Nicaragua
  "591": "latam", // Panama
  "600": "latam", // Paraguay
  "604": "latam", // Peru
  "630": "latam", // Puerto Rico
  "858": "latam", // Uruguay
  "862": "latam", // Venezuela

  "380": "italian", // Italy
  "528": "dutch", // Netherlands
  "740": "dutch", // Suriname
  "616": "polish", // Poland
  "792": "turkish", // Turkey
  "620": "portuguese", // Portugal
  "024": "portuguese", // Angola
  "624": "portuguese", // Guinea-Bissau
  "508": "portuguese", // Mozambique
  "764": "thai", // Thailand
  "704": "vietnamese", // Vietnam
  "752": "swedish", // Sweden
  "208": "danish", // Denmark
  "578": "norwegian", // Norway
  "642": "romanian", // Romania
  "498": "romanian", // Moldova
  "348": "hungarian", // Hungary
  "203": "czech", // Czechia
  "300": "greek", // Greece
  "100": "bulgarian", // Bulgaria

  "012": "arabic", // Algeria
  "818": "arabic", // Egypt
  "368": "arabic", // Iraq
  "400": "arabic", // Jordan
  "414": "arabic", // Kuwait
  "422": "arabic", // Lebanon
  "434": "arabic", // Libya
  "478": "arabic", // Mauritania
  "504": "arabic", // Morocco
  "512": "arabic", // Oman
  "634": "arabic", // Qatar
  "682": "arabic", // Saudi Arabia
  "729": "arabic", // Sudan
  "760": "arabic", // Syria
  "788": "arabic", // Tunisia
  "784": "arabic", // United Arab Emirates
  "887": "arabic", // Yemen
};

// A language with a handful of reviews for one game would otherwise paint a
// whole country red or green off pure noise, so per-game coloring ignores
// languages under this many reviews (they stay "non classé"). The global map
// never needs it: every tracked language has thousands of reviews site-wide.
export const MIN_REVIEWS_FOR_GAME_COLOR = 10;

// Turns the per-language rows into the `language -> pct_positive` lookup the
// map colors from, dropping anything below `minReviews`.
export function buildScoreMap(
  rows: readonly { language: string; totalReviews: number; pctPositive: number }[],
  minReviews = 0,
): Record<string, number> {
  return Object.fromEntries(
    rows.filter((row) => row.totalReviews >= minReviews).map((row) => [row.language, row.pctPositive]),
  );
}

export function getCountryScoreColor(isoNumericId: string, scores: Record<string, number>): string {
  const lang = COUNTRY_LANGUAGE[isoNumericId];
  if (!lang) return FALLBACK_COLOR;
  const score = scores[lang];
  return score === undefined ? FALLBACK_COLOR : scoreToColor(score);
}
