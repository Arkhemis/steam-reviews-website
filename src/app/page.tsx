import { unstable_cache } from "next/cache";
import { HomeEditorial, type HomeData, type ListBlock, type PodiumGame } from "@/components/HomeEditorial";
import { dailyVolume, monthlySentiment, reviewsInLastDays } from "@/lib/cataloguePulse";
import { CHART_FILTERS } from "@/lib/charts";
import {
  getCatalogueTrend,
  getGameTopReviews,
  getLanguageReviewScores,
  getPolarisedGames,
  getSiteStats,
  getTopRatedGamesInWindow,
} from "@/lib/data/gameData";
import type { GameStats, RankedWindow, WindowedGame } from "@/lib/data/types";

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

// Ici le seuil compte double : un jeu à douze avis tombe à 50 % par hasard, un
// jeu à cinquante mille avis y tombe parce que ses joueurs se déchirent.
const POLARISED_MIN_REVIEWS = 5000;

// Les seuils font partie de la clé : les changer doit invalider l'entrée, pas
// resservir l'ancien palmarès.
function cached<T>(key: string, read: () => Promise<T>) {
  return unstable_cache(read, [key], { revalidate: REVALIDATE_SECONDS });
}

const weekPodium = cached(`home-week-${WEEK_MIN_REVIEWS}`, () =>
  getTopRatedGamesInWindow("week", PODIUM_SIZE, WEEK_MIN_REVIEWS),
);
const monthPodium = cached(`home-month-${MONTH_MIN_REVIEWS}`, () =>
  getTopRatedGamesInWindow("month", PODIUM_SIZE, MONTH_MIN_REVIEWS),
);
const yearPodium = cached(`home-year-${YEAR_MIN_REVIEWS}`, () =>
  getTopRatedGamesInWindow("year-to-date", PODIUM_SIZE, YEAR_MIN_REVIEWS),
);
const polarisedGames = cached(`home-polarised-${POLARISED_MIN_REVIEWS}`, () =>
  getPolarisedGames(PODIUM_SIZE, POLARISED_MIN_REVIEWS),
);
const catalogueTrend = cached("home-catalogue-trend", getCatalogueTrend);
const siteStats = cached("home-site-stats", getSiteStats);
const languageScores = cached("home-language-scores", getLanguageReviewScores);

const enFull = new Intl.NumberFormat("en-US");
const dayAndMonth = new Intl.DateTimeFormat("en-US", { day: "2-digit", month: "short", timeZone: "UTC" });

/** « 07 Sep – 13 Sep », ou `null` tant que la fenêtre n'a sacré personne. */
function formatWindow({ startsOn, endsOn }: RankedWindow): string | null {
  if (!startsOn || !endsOn) return null;
  const from = dayAndMonth.format(new Date(`${startsOn}T00:00:00Z`));
  const to = dayAndMonth.format(new Date(`${endsOn}T00:00:00Z`));
  return `${from} – ${to}`;
}

function toPodium(game: WindowedGame, period: string): PodiumGame {
  return {
    appId: game.appId,
    name: game.name,
    coverUrl: game.coverUrl,
    pct: game.pctPositive * 100,
    meta: `${enFull.format(game.reviews)} reviews ${period}`,
  };
}

function toPolarisedPodium(game: GameStats): PodiumGame {
  return {
    appId: game.appId,
    name: game.name,
    coverUrl: game.coverUrl,
    pct: game.pctPositive * 100,
    meta: `${enFull.format(game.totalReviews)} reviews · all time`,
  };
}

const QUOTE_MAX_CHARS = 420;

// La review la plus utile d'un jeu fait parfois plusieurs milliers de
// caractères : on coupe côté serveur pour ne pas embarquer le roman entier
// dans le flux RSC, `line-clamp` fait le reste à l'écran. La coupe tombe sur
// une espace, et on jette un éventuel `[spoiler` resté ouvert pour ne pas
// afficher un bout de balise BBCode.
function excerpt(text: string): string {
  const clean = text.trim();
  if (clean.length <= QUOTE_MAX_CHARS) return clean;

  const cut = clean.slice(0, QUOTE_MAX_CHARS);
  const lastSpace = cut.lastIndexOf(" ");
  const trimmed = lastSpace > 0 ? cut.slice(0, lastSpace) : cut;
  return `${trimmed.replace(/\[[^\]]*$/, "").trimEnd()}…`;
}

// TODO(data) : la citation du héros devrait être la review la plus utile *de
// la semaine*. `marts.review_highlight` ne porte aucune date, donc on prend
// pour l'instant la meilleure review positive du gagnant, toutes périodes
// confondues. Voir `docs/home-data.md` (modèle `review_of_the_week`).
//
// Le gagnant ne change qu'avec le podium, lui-même caché : la citation se
// cache donc sous son `appId`, sans quoi elle serait la seule lecture SQL que
// chaque visiteur paierait.
async function heroQuote(appId: number): Promise<string | undefined> {
  const reviews = await cached(`home-quote-${appId}`, () => getGameTopReviews(appId, { perSide: 1 }))();
  const positive = reviews.find((review) => review.votedUp);
  return positive ? excerpt(positive.reviewText) : undefined;
}

export default async function HomePage() {
  const [week, year, polarised, trend, stats, languages] = await Promise.all([
    weekPodium(),
    yearPodium(),
    polarisedGames(),
    catalogueTrend(),
    siteStats(),
    languageScores(),
  ]);

  // Une semaine creuse — pipeline en retard, ou seuil trop haut pour la
  // période — ne doit pas laisser la home sans héros : on élargit alors à
  // trente jours, et le kicker dit laquelle des deux fenêtres est affichée.
  const podium = week.games.length > 0 ? week : await monthPodium();
  const isWeek = podium === week;

  const games = podium.games.map((game) => toPodium(game, isWeek ? "this week" : "in the last 30 days"));
  const winner = games[0];
  if (winner) winner.quote = await heroQuote(winner.appId);

  const yearLabel = year.endsOn?.slice(0, 4) ?? String(new Date().getUTCFullYear());

  const lists: [ListBlock, ListBlock] = [
    {
      title: `Best of ${yearLabel}`,
      unit: "year to date",
      blurb: `Highest positive share among games with at least ${enFull.format(YEAR_MIN_REVIEWS)} reviews this year.`,
      games: year.games.map((game) => toPodium(game, "this year")),
    },
    {
      title: "Nobody agrees",
      unit: "most polarised",
      blurb: "Games whose reviews split hardest — read both camps before you buy.",
      games: polarised.map(toPolarisedPodium),
    },
  ];

  const data: HomeData = {
    week: {
      label: isWeek ? "best of the week" : "best of the last 30 days",
      range: formatWindow(podium),
      games,
    },
    lists,
    sentiment: monthlySentiment(trend).map((point) => point.pctPositive),
    volume: dailyVolume(trend),
    totals: {
      reviews: stats.totalReviews,
      games: stats.totalGames,
      languages: languages.length,
      weekReviews: reviewsInLastDays(trend),
      lists: CHART_FILTERS.length,
    },
  };

  return <HomeEditorial data={data} />;
}
