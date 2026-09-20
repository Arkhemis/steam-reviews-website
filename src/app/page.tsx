import { unstable_cache } from "next/cache";
import { HomeEditorial, type HomeData, type PodiumGame } from "@/components/HomeEditorial";
import { dailyVolume, monthlySentiment, reviewsInLastDays } from "@/lib/cataloguePulse";
import { CHART_FILTERS } from "@/lib/charts";
import { buildAwards, type AwardId, type AwardSlide, type AwardThresholds } from "@/lib/homeAwards";
import { resolveSteamHeroArt } from "@/lib/steamArtwork";
import {
  getAwardReview,
  type AwardReviewOrder,
  type AwardReviewSentiment,
  getCatalogueTrend,
  getLanguageReviewScores,
  getPolarisedGames,
  getSiteStats,
  getTopRatedGamesInWindow,
  getWindowMovers,
  getWindowRanking,
  getWindowReviewHighlights,
} from "@/lib/data/gameData";
import type { RankedWindow, WindowedGame } from "@/lib/data/types";

// La base n'est pas joignable au build (image buildée hors du réseau docker
// compose), donc rien n'est prérendu. Les agrégats, eux, ne bougent qu'au
// rythme du pipeline : chacun est caché à part, et la page n'attend plus que
// le cache. Voir `docs/home-data.md` pour ce que chaque bloc lit vraiment.
export const dynamic = "force-dynamic";

const REVALIDATE_SECONDS = 900;

const PODIUM_SIZE = 5;

// Seuils de volume, par fenêtre. Ils font le même travail qu'ailleurs sur le
// site — empêcher qu'une poignée d'avis sacre un jeu confidentiel — mais une
// semaine ne brasse pas les volumes d'une année : un seuil unique viderait le
// podium hebdomadaire ou laisserait passer n'importe quoi sur l'année.
const WEEK_MIN_REVIEWS = 100;
const MONTH_MIN_REVIEWS = 500;
const YEAR_MIN_REVIEWS = 1000;

// Comeback et chute comparent deux semaines : le plancher vaut pour chacune,
// sans quoi dix avis la semaine d'avant suffiraient à faire un écart de trente
// points.
const MOVER_MIN_REVIEWS = 100;

// Le plus détesté se juge sur trente jours, au même plancher que le repli du
// podium : sur une semaine, un jeu confidentiel review-bombé l'emporterait.
const HATED_MIN_REVIEWS = MONTH_MIN_REVIEWS;

// La pépite cachée : assez d'avis ce mois-ci pour que le score tienne, assez
// peu depuis toujours pour que le jeu soit vraiment confidentiel.
const HIDDEN_GEM_MIN_REVIEWS = 50;
const HIDDEN_GEM_MAX_TOTAL_REVIEWS = 2000;

// Ici le seuil compte double : un jeu à douze avis tombe à 50 % par hasard, un
// jeu à cinquante mille avis y tombe parce que ses joueurs se déchirent.
const POLARISED_MIN_REVIEWS = 5000;

// Une review « drôle » ou « utile » aux yeux de trois lecteurs n'est pas un
// palmarès : sous ce nombre de votes, la diapositive se cache.
const REVIEW_MIN_VOTES = 5;

// Les reviews primées sont en anglais, comme le reste du site.
const REVIEW_LANGUAGE = "english";

const THRESHOLDS: AwardThresholds = {
  moverMinReviews: MOVER_MIN_REVIEWS,
  yearMinReviews: YEAR_MIN_REVIEWS,
  hatedMinReviews: HATED_MIN_REVIEWS,
  hiddenGemMinReviews: HIDDEN_GEM_MIN_REVIEWS,
  hiddenGemMaxTotalReviews: HIDDEN_GEM_MAX_TOTAL_REVIEWS,
  polarisedMinReviews: POLARISED_MIN_REVIEWS,
  reviewMinVotes: REVIEW_MIN_VOTES,
};

// Les seuils font partie de la clé : les changer doit invalider l'entrée, pas
// resservir l'ancien palmarès. Le préfixe `window-` signale la source
// (`marts.game_window_score`) : une entrée d'avant la migration, lue sur le
// mart quotidien et sans `totalReviews`, ne peut pas être resservie.
function cached<T>(key: string, read: () => Promise<T>) {
  return unstable_cache(read, [key], { revalidate: REVALIDATE_SECONDS });
}

const EMPTY_WINDOW: RankedWindow = { startsOn: null, endsOn: null, games: [] };

// Une récompense dont la requête échoue — mart pas encore matérialisé en prod,
// colonne pas encore remontée — disparaît du carrousel au lieu d'emporter la
// page : on journalise, et on rend la valeur « vide » de la requête, que
// `buildAwards` sait déjà cacher. `unstable_cache` ne garde pas les erreurs :
// la lecture est retentée à chaque visite, et reprend d'elle-même une fois le
// mart déployé.
async function orEmpty<T>(label: string, read: () => Promise<T>, empty: T): Promise<T> {
  try {
    return await read();
  } catch (error) {
    console.error(`[home] ${label} unavailable, hiding it:`, error);
    return empty;
  }
}

const weekPodium = cached(`home-window-week-best-${PODIUM_SIZE}-${WEEK_MIN_REVIEWS}`, () =>
  getTopRatedGamesInWindow("week", PODIUM_SIZE, WEEK_MIN_REVIEWS),
);
const monthPodium = cached(`home-window-month-best-${PODIUM_SIZE}-${MONTH_MIN_REVIEWS}`, () =>
  getTopRatedGamesInWindow("month", PODIUM_SIZE, MONTH_MIN_REVIEWS),
);
const weekMovers = cached(`home-window-movers-${MOVER_MIN_REVIEWS}`, () => getWindowMovers(MOVER_MIN_REVIEWS));
const weekMostReviewed = cached("home-window-week-most-reviewed", () =>
  getWindowRanking("week", "most-reviewed", { limit: 1, minReviews: 1 }),
);
const monthReviewHighlights = cached(`home-review-window-month-${REVIEW_LANGUAGE}`, () =>
  getWindowReviewHighlights("month", REVIEW_LANGUAGE),
);
const yearBest = cached(`home-window-year-best-${YEAR_MIN_REVIEWS}`, () =>
  getTopRatedGamesInWindow("year-to-date", 1, YEAR_MIN_REVIEWS),
);
const monthMostHated = cached(`home-window-month-worst-${HATED_MIN_REVIEWS}`, () =>
  getWindowRanking("month", "worst", { limit: 1, minReviews: HATED_MIN_REVIEWS }),
);
const monthHiddenGem = cached(
  `home-window-month-hidden-gem-${HIDDEN_GEM_MIN_REVIEWS}-${HIDDEN_GEM_MAX_TOTAL_REVIEWS}`,
  () =>
    getWindowRanking("month", "best", {
      limit: 1,
      minReviews: HIDDEN_GEM_MIN_REVIEWS,
      maxTotalReviews: HIDDEN_GEM_MAX_TOTAL_REVIEWS,
    }),
);
const polarisedGames = cached(`home-polarised-${POLARISED_MIN_REVIEWS}`, () =>
  getPolarisedGames(1, POLARISED_MIN_REVIEWS),
);
const catalogueTrend = cached("home-catalogue-trend", getCatalogueTrend);
const siteStats = cached("home-site-stats", getSiteStats);
const languageScores = cached("home-language-scores", getLanguageReviewScores);

const enFull = new Intl.NumberFormat("en-US");

function toPodium(game: WindowedGame, period: string): PodiumGame {
  return {
    appId: game.appId,
    name: game.name,
    coverUrl: game.coverUrl,
    pct: game.pctPositive * 100,
    meta: `${enFull.format(game.reviews)} reviews ${period}`,
  };
}

// L'illustration panoramique n'est qu'un appel à l'API du magasin Steam, mais
// elle ne change presque jamais pour un `appId` donné : la cacher comme le
// reste évite de tâter Steam à chaque visite, et de retarder la home quand il
// traîne. Une par diapositive, en parallèle : chacune a son propre délai
// d'abandon. Le `v2` de la clé écarte les URL de l'ancien hôte, que
// l'optimiseur d'images refuse désormais.
async function heroArt(appId: number): Promise<string | null> {
  return cached(`home-hero-art-v2-${appId}`, () => resolveSteamHeroArt(appId))();
}

// La citation est en anglais, comme le reste du site : sans filtre, la
// meilleure review d'un jeu est souvent chinoise ou russe, et le carrousel
// afficherait un paragraphe que son lecteur ne peut pas lire. Un jeu sans
// review anglaise retenue par le mart passe donc sans citation, plutôt
// qu'avec une citation illisible.
//
// On veut la review *écrite pendant la fenêtre* de la récompense. Il n'y en a
// pas toujours — le mart ne garde que les trente meilleures par jeu et par
// langue, toutes périodes confondues — et tant que
// `review_highlight.created_at` n'est pas remontée en base, la lecture
// échoue : dans les deux cas, on retombe sur la meilleure de toujours, dont la
// requête, elle, ne nomme pas la colonne.
//
// Le sujet ne change qu'avec sa récompense, elle-même cachée : la citation se
// cache donc sous son `appId`, sa fenêtre et son critère, sans quoi elle
// serait la seule lecture SQL que chaque visiteur paierait.
type QuoteCriteria = { sentiment?: AwardReviewSentiment; order?: AwardReviewOrder };

/** Le jeu primé et la fenêtre où chercher sa citation. */
type QuoteSubject = { appId: number; startsOn: string | null; endsOn: string | null };

async function awardQuote(
  label: string,
  appId: number,
  window: Pick<QuoteSubject, "startsOn" | "endsOn">,
  { sentiment = "positive", order = "top" }: QuoteCriteria = {},
): Promise<string | undefined> {
  const criteria = `${REVIEW_LANGUAGE}-${sentiment}-${order}`;
  const { startsOn, endsOn } = window;

  if (startsOn && endsOn) {
    const inWindow = await orEmpty(
      `${label} in-window quote`,
      cached(`home-quote-window-${criteria}-${appId}-${startsOn}-${endsOn}`, () =>
        getAwardReview(appId, { language: REVIEW_LANGUAGE, sentiment, order, startsOn, endsOn }),
      ),
      null,
    );
    if (inWindow) return inWindow.reviewText;
  }

  const allTime = await orEmpty(
    `${label} all-time quote`,
    cached(`home-quote-${criteria}-${appId}`, () =>
      getAwardReview(appId, { language: REVIEW_LANGUAGE, sentiment, order }),
    ),
    null,
  );
  return allTime?.reviewText;
}

/**
 * Ce que chaque récompense cite : le camp qui va avec son titre — un freefall
 * s'illustre d'une review négative, jamais d'un éloge — et, pour celles qui ne
 * jugent pas le verdict, la review que le plus de monde a votée utile.
 *
 * Les deux diapositives de review primée n'y sont pas : leur citation est leur
 * sujet, et vient déjà de `review_window_highlight`.
 */
const AWARD_QUOTE_CRITERIA: Record<Exclude<AwardId, "funniest-review" | "most-helpful-review">, QuoteCriteria> = {
  "best-of-week": { sentiment: "positive" },
  comeback: { sentiment: "positive" },
  freefall: { sentiment: "negative" },
  "most-reviewed": { sentiment: "any" },
  "best-of-year": { sentiment: "positive" },
  "most-hated": { sentiment: "negative" },
  "hidden-gem": { sentiment: "any", order: "helpful" },
  "nobody-agrees": { sentiment: "any", order: "helpful" },
};

const NO_WINDOW = { startsOn: null, endsOn: null };

type QuotedAward = keyof typeof AWARD_QUOTE_CRITERIA;

/**
 * Les citations du carrousel, lues en parallèle : une récompense sans gagnant
 * n'en demande aucune, et une lecture vide laisse simplement sa diapositive
 * sans citation.
 */
async function awardQuotes(
  subjects: Partial<Record<QuotedAward, QuoteSubject>>,
): Promise<Partial<Record<AwardId, string>>> {
  const asked = Object.entries(subjects).filter(
    (entry): entry is [QuotedAward, QuoteSubject] => entry[1] !== undefined,
  );

  const quotes = await Promise.all(
    asked.map(([id, subject]) =>
      awardQuote(id, subject.appId, subject, AWARD_QUOTE_CRITERIA[id]).then((quote) => [id, quote] as const),
    ),
  );

  return Object.fromEntries(quotes.filter(([, quote]) => quote !== undefined));
}

async function withArt(slides: AwardSlide[]): Promise<AwardSlide[]> {
  const arts = await Promise.all(slides.map((slide) => heroArt(slide.appId)));
  return slides.map((slide, i) => ({ ...slide, art: arts[i] }));
}

export default async function HomePage() {
  const [week, movers, mostReviewed, reviews, year, hated, hiddenGem, polarised, trend, stats, languages] =
    await Promise.all([
      orEmpty("week podium", weekPodium, EMPTY_WINDOW),
      orEmpty("week movers", weekMovers, { up: null, down: null }),
      orEmpty("most reviewed", weekMostReviewed, EMPTY_WINDOW),
      orEmpty("review highlights", monthReviewHighlights, { funny: [], helpful: [] }),
      orEmpty("best of year", yearBest, EMPTY_WINDOW),
      orEmpty("most hated", monthMostHated, EMPTY_WINDOW),
      orEmpty("hidden gem", monthHiddenGem, EMPTY_WINDOW),
      orEmpty("polarised", polarisedGames, []),
      catalogueTrend(),
      siteStats(),
      languageScores(),
    ]);

  // Une semaine creuse — pipeline en retard, ou seuil trop haut pour la
  // période — ne doit pas laisser la home sans lauréat : on élargit alors à
  // trente jours, et la puce comme le kicker disent laquelle des deux
  // fenêtres est affichée.
  const podium = week.games.length > 0 ? week : await orEmpty("month podium", monthPodium, EMPTY_WINDOW);
  const isWeek = podium === week;
  const windowDays = isWeek ? 7 : 30;

  // Le sujet de chaque récompense, avec la fenêtre sur laquelle elle est
  // décernée : c'est dans cette fenêtre-là que se cherche sa citation. Une
  // récompense sans gagnant n'en demande aucune.
  const subject = (window: RankedWindow) => {
    const game = window.games[0];
    return game ? { appId: game.appId, startsOn: window.startsOn, endsOn: window.endsOn } : undefined;
  };

  const quotes = await awardQuotes({
    "best-of-week": subject(podium),
    comeback: movers.up ?? undefined,
    freefall: movers.down ?? undefined,
    "most-reviewed": subject(mostReviewed),
    "best-of-year": subject(year),
    "most-hated": subject(hated),
    "hidden-gem": subject(hiddenGem),
    // Le jeu qui divise se juge sur toujours : sa citation aussi.
    "nobody-agrees": polarised[0] && { appId: polarised[0].appId, ...NO_WINDOW },
  });

  const awards = buildAwards(
    {
      podium: {
        window: podium,
        days: windowDays,
        minReviews: isWeek ? WEEK_MIN_REVIEWS : MONTH_MIN_REVIEWS,
      },
      movers,
      mostReviewed,
      reviews,
      year,
      hated,
      hiddenGem,
      polarised,
      quotes,
    },
    THRESHOLDS,
  );

  const data: HomeData = {
    awards: await withArt(awards),
    // Les dauphins restent ceux du podium dont le n°1 ouvre le carrousel.
    runnersUp: podium.games.slice(1).map((game) => toPodium(game, `in the last ${windowDays} days`)),
    sentiment: monthlySentiment(trend).map((point) => point.pctPositive),
    volume: dailyVolume(trend),
    totals: {
      reviews: stats.storedReviews,
      games: stats.totalGames,
      languages: languages.length,
      weekReviews: reviewsInLastDays(trend),
      lists: CHART_FILTERS.length,
    },
  };

  return <HomeEditorial data={data} />;
}
