// Language -> color follows the same validated 6-slot categorical ramp used
// elsewhere on the site (see LanguageDistribution.tsx): the world map's own
// legend only ever shows these 6 (the same 6 tracked in the ranking table
// below it). GlobalLanguageKey is that set.
//
// The subnational insets (Switzerland/Belgium/Canada/Finland) need more
// distinct identities than 6 slots. Since each inset has its own
// self-contained legend and never shares the screen with a *different*
// inset, four extra keys reuse a slot from a global language that never
// co-occurs with them in the same legend (Italian only appears in the
// Switzerland inset, alongside French/German but never English; Dutch only
// in Belgium, alongside French but never Simplified Chinese; Finnish/Swedish
// only in Finland, never alongside English or Simplified Chinese). Each
// reuse was checked pairwise with dataviz's validate_palette.js against
// everything else rendered in that same inset.
//
// Crucially, these 4 reused keys must never be used to color the world map
// itself — that map's legend says blue=English, and reusing blue for
// Finland there (even though blue=Finnish inside the Finland inset) would
// silently relabel Finland as English on the one legend a reader actually
// sees next to it. GlobalLanguageKey vs LanguageKey keeps that mistake from
// compiling.
export type GlobalLanguageKey = "english" | "schinese" | "french" | "german" | "russian" | "brazilian";

export type LanguageKey = GlobalLanguageKey | "italian" | "dutch" | "finnish" | "swedish";

export const FALLBACK_COLOR = "var(--series-fallback)";

export const LANGUAGE_COLORS: Record<LanguageKey, string> = {
  english: "var(--series-1)",
  schinese: "var(--series-2)",
  french: "var(--series-3)",
  german: "var(--series-4)",
  russian: "var(--series-5)",
  brazilian: "var(--series-6)",
  italian: "var(--series-1)", // reused: Switzerland inset only, never shown with English
  dutch: "var(--series-2)", // reused: Belgium inset only, never shown with Simplified Chinese
  finnish: "var(--series-1)", // reused: Finland inset only, never shown with English
  swedish: "var(--series-2)", // reused: Finland inset only, never shown with Simplified Chinese
};

export const LANGUAGE_LABELS: Record<LanguageKey, string> = {
  english: "Anglais",
  schinese: "Chinois simplifié",
  french: "Français",
  german: "Allemand",
  russian: "Russe",
  brazilian: "Portugais (Brésil)",
  italian: "Italien",
  dutch: "Néerlandais",
  finnish: "Finnois",
  swedish: "Suédois",
};

// ISO 3166-1 numeric id (matches world-atlas country ids) -> dominant
// language, restricted to the 6 GlobalLanguageKey values shown in this
// page's world-map legend. A country whose dominant Steam-review language
// isn't one of those 6 (Japan, Poland, Ukraine, Taiwan, Portugal, Turkey...)
// is intentionally left unmapped and falls back to the neutral "non classé"
// color, rather than being force-fit into an inaccurate bucket (e.g. Taiwan
// is Traditional, not Simplified, Chinese; Portugal is European, not
// Brazilian, Portuguese).
//
// Countries with a genuine, non-contested official bilingual/trilingual
// split (Switzerland, Belgium, Canada, Finland) get a detailed regional
// breakdown instead — see REGION_LANGUAGE — and are colored here by their
// overall-dominant language like any other country (or left unmapped, for
// Finland, since Finnish/Swedish aren't among the 6 global languages).
// Countries where a language split would track a contested border or an
// active conflict (Cyprus, Ukraine, Cameroon's Anglophone regions...) are
// deliberately left as a single dominant language rather than shown split.
// For the same reason, Central Asian ex-Soviet states beyond
// Belarus/Kazakhstan (Kyrgyzstan, Tajikistan, Turkmenistan, Uzbekistan) are
// left unmapped: Russian's official/lingua-franca status there is less
// settled and more politically loaded than in the two included.
//
// Every one of the ~177 countries in world-atlas's dataset was checked
// against this table on purpose (not just a "major markets" shortlist) — the
// ones missing are missing because their dominant language genuinely isn't
// one of the 6 tracked here, not because they were skipped.
export const COUNTRY_LANGUAGE: Record<string, GlobalLanguageKey> = {
  "840": "english", // United States
  "826": "english", // United Kingdom
  "036": "english", // Australia
  "554": "english", // New Zealand
  "372": "english", // Ireland
  "710": "english", // South Africa
  "356": "english", // India
  "124": "english", // Canada (dominant; see REGION_LANGUAGE for Québec)
  "250": "french", // France
  "056": "french", // Belgium (dominant; see REGION_LANGUAGE)
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
  "756": "german", // Switzerland (dominant; see REGION_LANGUAGE)
  "276": "german", // Germany
  "040": "german", // Austria
  "643": "russian", // Russia
  "112": "russian", // Belarus
  "398": "russian", // Kazakhstan
  "076": "brazilian", // Brazil
  "156": "schinese", // China

  // English: every other country where English is *the* (sole or primary)
  // official language — a verifiable, non-contested fact, unlike the
  // regional splits called out above.
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
};

export function getCountryColor(isoNumericId: string): string {
  const lang = COUNTRY_LANGUAGE[isoNumericId];
  return lang ? LANGUAGE_COLORS[lang] : FALLBACK_COLOR;
}

const GLOBAL_LANGUAGE_KEYS: readonly GlobalLanguageKey[] = [
  "english",
  "schinese",
  "french",
  "german",
  "russian",
  "brazilian",
];

function isGlobalLanguageKey(language: string): language is GlobalLanguageKey {
  return (GLOBAL_LANGUAGE_KEYS as readonly string[]).includes(language);
}

export type LanguageBucketRow = {
  key: GlobalLanguageKey | "other";
  reviewCount: number;
  pctOfTotal: number;
};

// Buckets a raw per-language breakdown (Steam's language codes) into the 6
// languages the world map's own legend tracks, folding everything else into
// a single "other" row — same top-N-plus-rest pattern as
// LanguageDistribution.tsx, applied here to the site-wide rollup instead of
// a per-game one.
export function bucketGlobalLanguages(
  rows: { language: string; reviewCount: number; pctOfTotal: number }[],
): LanguageBucketRow[] {
  const known: LanguageBucketRow[] = [];
  let otherReviewCount = 0;
  let otherPctOfTotal = 0;

  for (const row of rows) {
    if (isGlobalLanguageKey(row.language)) {
      known.push({ key: row.language, reviewCount: row.reviewCount, pctOfTotal: row.pctOfTotal });
    } else {
      otherReviewCount += row.reviewCount;
      otherPctOfTotal += row.pctOfTotal;
    }
  }

  known.sort((a, b) => b.pctOfTotal - a.pctOfTotal);

  if (otherReviewCount > 0) {
    known.push({ key: "other", reviewCount: otherReviewCount, pctOfTotal: otherPctOfTotal });
  }

  return known;
}

export type SubregionCountry = "switzerland" | "belgium" | "canada" | "finland";

const SWITZERLAND_REGIONS: Record<string, LanguageKey> = {
  Genève: "french",
  Jura: "french",
  Neuchâtel: "french",
  Vaud: "french",
  Valais: "french",
  Fribourg: "french",
  Ticino: "italian",
  Aargau: "german",
  Lucerne: "german",
  Nidwalden: "german",
  "Appenzell Ausserrhoden": "german",
  "Appenzell Innerrhoden": "german",
  "Sankt Gallen": "german",
  Glarus: "german",
  Graubünden: "german",
  Schaffhausen: "german",
  Schwyz: "german",
  Thurgau: "german",
  Uri: "german",
  Zürich: "german",
  Zug: "german",
  "Basel-Landschaft": "german",
  Bern: "german",
  "Basel-Stadt": "german",
  Solothurn: "german",
  Obwalden: "german",
};

const BELGIUM_REGIONS: Record<string, LanguageKey> = {
  Hainaut: "french",
  Namur: "french",
  Liege: "french",
  Luxembourg: "french",
  "Walloon Brabant": "french",
  Limburg: "dutch",
  "Flemish Brabant": "dutch",
  "East Flanders": "dutch",
  "West Flanders": "dutch",
  Antwerp: "dutch",
  Brussels: "french",
};

const CANADA_REGIONS: Record<string, LanguageKey> = {
  Québec: "french",
  Manitoba: "english",
  Saskatchewan: "english",
  Alberta: "english",
  "British Columbia": "english",
  Nunavut: "english",
  "Northwest Territories": "english",
  Yukon: "english",
  Ontario: "english",
  "New Brunswick": "english",
  "Nova Scotia": "english",
  "Newfoundland and Labrador": "english",
  "Prince Edward Island": "english",
};

const FINLAND_REGIONS: Record<string, LanguageKey> = {
  Lapland: "finnish",
  "Central Finland": "finnish",
  "Northern Savonia": "finnish",
  Kainuu: "finnish",
  "Northern Ostrobothnia": "finnish",
  "Central Ostrobothnia": "finnish",
  Ostrobothnia: "swedish",
  "Southern Ostrobothnia": "finnish",
  "Päijät-Häme": "finnish",
  "Tavastia Proper": "finnish",
  Pirkanmaa: "finnish",
  Kymenlaakso: "finnish",
  "South Karelia": "finnish",
  "Southern Savonia": "finnish",
  "North Karelia": "finnish",
  "Finland Proper": "finnish",
  Satakunta: "finnish",
  Uusimaa: "finnish",
};

const REGION_LANGUAGE: Record<SubregionCountry, Record<string, LanguageKey>> = {
  switzerland: SWITZERLAND_REGIONS,
  belgium: BELGIUM_REGIONS,
  canada: CANADA_REGIONS,
  finland: FINLAND_REGIONS,
};

export function getRegionColor(country: SubregionCountry, regionName: string | null | undefined): string {
  if (!regionName) return FALLBACK_COLOR;
  const lang = REGION_LANGUAGE[country][regionName];
  return lang ? LANGUAGE_COLORS[lang] : FALLBACK_COLOR;
}
