import { verdictColor } from "@/components/GameCoverTile";
import type { AwardId } from "@/lib/rankings";
import { formatReviewWindow } from "@/lib/reviewWindow";
import type {
  GameStats,
  RankedWindow,
  WindowMover,
  WindowReviewHighlight,
  WindowReviewHighlights,
} from "@/lib/data/types";

// Le carrousel de récompenses de la home : une diapositive par récompense,
// déjà rédigée ici — le composant ne fait que rendre. Chaque récompense se
// cache d'elle-même quand sa requête n'a rien rendu (mart pas encore en base,
// fenêtre trop creuse, écart du mauvais signe) : on ne montre jamais une
// diapositive vide ou un palmarès qui dirait le contraire de son titre.

const enFull = new Intl.NumberFormat("en-US");
const enHours = new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 });

// Les chiffres qui ne sont pas un verdict (un nombre d'avis, de votes) restent
// dans la couleur du texte : seul un score a droit au code couleur.
const NEUTRAL_FIGURE = "#eef2f4";

// L'identité des récompenses vit dans `rankings.ts`, avec le classement de
// `/charts` qui prolonge chacune : c'est ce qui empêche la vitrine de primer
// une catégorie que la page de classements ne saurait pas servir. Ce module ne
// garde que la rédaction des diapositives.
export type { AwardId } from "@/lib/rankings";

export type AwardSlide = {
  id: AwardId;
  /** Libellé court de la puce qui sert d'onglet. */
  chip: string;
  /** Kicker de la diapositive, e.g. « best of last 7 days ». */
  label: string;
  /** Dates de la fenêtre, `null` pour un classement de toujours. */
  range: string | null;
  /** La règle et son seuil, en une phrase, pour la bulle du kicker. */
  hint: string;
  appId: number;
  name: string;
  coverUrl: string | null;
  /** Illustration panoramique Steam, résolue par la page après coup. */
  art: string | null;
  /** Le grand chiffre : « 96% », « +18 pts », « 12,043 »… */
  figure: string;
  figureColor: string;
  /** Ce que compte le grand chiffre, quand il n'est pas un score. */
  figureLabel?: string;
  /** Ligne de contexte déjà rédigée. */
  meta: string;
  /** Texte d'avis déjà coupé, BBCode Steam compris. */
  quote?: string;
};

export type AwardThresholds = {
  moverMinReviews: number;
  yearMinReviews: number;
  hatedMinReviews: number;
  hiddenGemMinReviews: number;
  hiddenGemMaxTotalReviews: number;
  polarisedMinReviews: number;
  reviewMinVotes: number;
};

export type AwardSources = {
  /** Le podium de tête : la semaine, ou trente jours quand la semaine est creuse. */
  podium: { window: RankedWindow; days: 7 | 30; minReviews: number };
  movers: { up: WindowMover | null; down: WindowMover | null };
  mostReviewed: RankedWindow;
  reviews: WindowReviewHighlights;
  year: RankedWindow;
  hated: RankedWindow;
  hiddenGem: RankedWindow;
  polarised: GameStats[];
  /**
   * La review à citer sous chaque récompense, brute : la page la lit dans le
   * camp et la fenêtre qui vont avec la récompense (cf. `AWARD_QUOTES` côté
   * home), et c'est ici qu'elle est coupée. Une récompense absente de la table
   * s'affiche simplement sans citation.
   *
   * Les deux diapositives de review primée n'y figurent pas : leur citation
   * *est* leur sujet, et vient de `reviews`.
   */
  quotes: Partial<Record<AwardId, string>>;
};

const QUOTE_MAX_CHARS = 420;

/**
 * Les blancs d'une review, ramenés à ce qu'une citation de quatre à six lignes
 * peut se permettre : les lignes blanches entre paragraphes en coûtaient une
 * chacune — le lecteur y perdait une ligne de texte, et la citation se
 * terminait souvent sur un vide, la coupe tombant dans l'entre-deux.
 */
function tidy(text: string): string {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line !== "")
    .join("\n");
}

// Une review fait parfois plusieurs milliers de caractères : on coupe côté
// serveur pour ne pas embarquer le roman entier dans le flux RSC, `line-clamp`
// fait le reste à l'écran. La coupe tombe sur une espace, et on jette un
// éventuel `[spoiler` resté ouvert pour ne pas afficher un bout de balise BBCode.
export function excerpt(text: string): string {
  const clean = tidy(text);
  if (clean.length <= QUOTE_MAX_CHARS) return clean;

  const cut = clean.slice(0, QUOTE_MAX_CHARS);
  const lastSpace = cut.lastIndexOf(" ");
  const trimmed = lastSpace > 0 ? cut.slice(0, lastSpace) : cut;
  return `${trimmed.replace(/\[[^\]]*$/, "").trimEnd()}…`;
}

/**
 * « +18 pts » ou « −24 pts », avec un vrai signe moins (U+2212) : le trait
 * d'union est plus court que le plus et se lit mal en grand. Un écart que
 * l'arrondi au point effacerait garde une décimale.
 */
export function formatDeltaPoints(delta: number): string {
  const magnitude = Math.abs(delta);
  const digits = Math.round(magnitude) === 0 ? magnitude.toFixed(1) : String(Math.round(magnitude));
  return `${delta < 0 ? "−" : "+"}${digits} pts`;
}

/** Temps de jeu au moment de la review : « 42 min », « 1.5 hrs », « 1,204 hrs ». */
export function formatPlaytime(minutes: number): string {
  if (minutes < 60) return `${Math.round(minutes)} min`;

  const hours = minutes / 60;
  const text = hours < 10 ? enHours.format(hours) : enFull.format(Math.round(hours));
  return `${text} ${text === "1" ? "hr" : "hrs"}`;
}

function pct(share: number): string {
  return `${Math.round(share * 100)}%`;
}

/**
 * La review la plus drôle et la plus utile de la fenêtre. Une même review peut
 * gagner les deux classements : la plus drôle garde alors la sienne, et la plus
 * utile passe à son rang suivant — sauf si la plus drôle n'est pas affichée,
 * auquel cas il n'y a pas de doublon à éviter.
 *
 * Le seuil de votes se juge sur la review retenue : en dessous, une poignée de
 * lecteurs suffirait à sacrer n'importe quoi, et la diapositive se cache.
 */
export function pickReviewHighlights(
  highlights: WindowReviewHighlights,
  minVotes: number,
): { funny: WindowReviewHighlight | null; helpful: WindowReviewHighlight | null } {
  const topFunny = highlights.funny[0];
  const funny = topFunny && topFunny.votesFunny >= minVotes ? topFunny : null;

  const topHelpful = highlights.helpful.find((review) => review.recommendationId !== funny?.recommendationId);
  const helpful = topHelpful && topHelpful.votesUp >= minVotes ? topHelpful : null;

  return { funny, helpful };
}

function bestOfPodium({ window, days, minReviews }: AwardSources["podium"], quote?: string): AwardSlide | null {
  const winner = window.games[0];
  if (!winner) return null;

  return {
    id: "best-of-week",
    chip: days === 7 ? "Best of the week" : "Best of the month",
    label: `best of last ${days} days`,
    range: formatReviewWindow(window.startsOn, window.endsOn),
    hint:
      `Highest share of positive reviews written in the last ${days} days, among games with at least ` +
      `${enFull.format(minReviews)} reviews over that window. The window ends on the most recent day of ` +
      `reviews we have loaded, not today.`,
    appId: winner.appId,
    name: winner.name,
    coverUrl: winner.coverUrl,
    art: null,
    figure: pct(winner.pctPositive),
    figureColor: verdictColor(winner.pctPositive * 100),
    meta: `${enFull.format(winner.reviews)} reviews in the last ${days} days`,
    quote,
  };
}

function moverSlide(
  mover: WindowMover | null,
  direction: "up" | "down",
  minReviews: number,
  quote?: string,
): AwardSlide | null {
  // La requête ne rend déjà que des écarts du bon signe ; on le revérifie ici
  // parce qu'un « comeback » à −3 pts serait un titre qui ment.
  if (!mover || (direction === "up" ? mover.deltaPts <= 0 : mover.deltaPts >= 0)) return null;

  const rising = direction === "up";
  return {
    id: rising ? "comeback" : "freefall",
    chip: rising ? "Comeback" : "Freefall",
    label: rising ? "comeback of the week" : "freefall of the week",
    range: formatReviewWindow(mover.startsOn, mover.endsOn),
    hint:
      `${rising ? "Biggest gain" : "Steepest drop"} in positive review share between the last 7 days and the ` +
      `7 days before, among games with at least ${enFull.format(minReviews)} reviews in each week.`,
    appId: mover.appId,
    name: mover.name,
    coverUrl: mover.coverUrl,
    art: null,
    figure: formatDeltaPoints(mover.deltaPts),
    figureColor: rising ? "var(--status-good)" : "var(--status-critical)",
    meta: `${pct(mover.previousPctPositive)} → ${pct(mover.pctPositive)} · ${enFull.format(mover.reviews)} reviews this week`,
    quote,
  };
}

function mostReviewedSlide(window: RankedWindow, quote?: string): AwardSlide | null {
  const winner = window.games[0];
  if (!winner) return null;

  return {
    id: "most-reviewed",
    chip: "Most reviewed",
    label: "most reviewed · last 7 days",
    range: formatReviewWindow(window.startsOn, window.endsOn),
    hint: "The game that received the most reviews in the last 7 days, whatever their verdict.",
    appId: winner.appId,
    name: winner.name,
    coverUrl: winner.coverUrl,
    art: null,
    figure: enFull.format(winner.reviews),
    figureColor: NEUTRAL_FIGURE,
    figureLabel: "reviews",
    meta: `${pct(winner.pctPositive)} positive in the last 7 days`,
    quote,
  };
}

function reviewSlide(review: WindowReviewHighlight | null, category: "funny" | "helpful", minVotes: number): AwardSlide | null {
  if (!review || review.reviewText.trim() === "") return null;

  const funny = category === "funny";
  return {
    id: funny ? "funniest-review" : "most-helpful-review",
    chip: funny ? "Funniest review" : "Most helpful review",
    label: `${funny ? "funniest" : "most helpful"} review · last 30 days`,
    range: formatReviewWindow(review.startsOn, review.endsOn),
    hint: funny
      ? `The English review written in the last 30 days that the most Steam users marked as funny — one review ` +
        `per game, and only once at least ${minVotes} people have.`
      : `The English review written in the last 30 days that Steam rates most helpful — one review per game, ` +
        `and only once at least ${minVotes} people have voted it up.`,
    appId: review.appId,
    name: review.gameName,
    coverUrl: review.coverUrl,
    art: null,
    figure: enFull.format(funny ? review.votesFunny : review.votesUp),
    figureColor: NEUTRAL_FIGURE,
    figureLabel: funny ? "found it funny" : "found it helpful",
    meta: `by ${review.authorPersonaname} · ${formatPlaytime(review.authorPlaytimeAtReviewMinutes)} at review`,
    quote: excerpt(review.reviewText),
  };
}

function bestOfYearSlide(window: RankedWindow, minReviews: number, quote?: string): AwardSlide | null {
  const winner = window.games[0];
  if (!winner) return null;

  const year = window.endsOn?.slice(0, 4) ?? String(new Date().getUTCFullYear());
  return {
    id: "best-of-year",
    chip: `Best of ${year}`,
    label: `best of ${year} · year to date`,
    range: formatReviewWindow(window.startsOn, window.endsOn),
    hint: `Highest share of positive reviews written this year, among games with at least ${enFull.format(minReviews)} reviews this year.`,
    appId: winner.appId,
    name: winner.name,
    coverUrl: winner.coverUrl,
    art: null,
    figure: pct(winner.pctPositive),
    figureColor: verdictColor(winner.pctPositive * 100),
    meta: `${enFull.format(winner.reviews)} reviews this year`,
    quote,
  };
}

function mostHatedSlide(window: RankedWindow, minReviews: number, quote?: string): AwardSlide | null {
  const loser = window.games[0];
  if (!loser) return null;

  return {
    id: "most-hated",
    chip: "Most hated",
    label: "most hated · last 30 days",
    range: formatReviewWindow(window.startsOn, window.endsOn),
    hint:
      `Lowest share of positive reviews written in the last 30 days, among games with at least ` +
      `${enFull.format(minReviews)} reviews over that window.`,
    appId: loser.appId,
    name: loser.name,
    coverUrl: loser.coverUrl,
    art: null,
    figure: pct(loser.pctPositive),
    figureColor: verdictColor(loser.pctPositive * 100),
    meta: `${enFull.format(loser.reviews)} reviews in the last 30 days`,
    quote,
  };
}

function hiddenGemSlide(
  window: RankedWindow,
  minReviews: number,
  maxTotalReviews: number,
  quote?: string,
): AwardSlide | null {
  const gem = window.games[0];
  if (!gem) return null;

  return {
    id: "hidden-gem",
    chip: "Hidden gem",
    label: "hidden gem · last 30 days",
    range: formatReviewWindow(window.startsOn, window.endsOn),
    hint:
      `Highest share of positive reviews written in the last 30 days, among games with at least ` +
      `${enFull.format(minReviews)} reviews that month but fewer than ${enFull.format(maxTotalReviews)} on Steam overall.`,
    appId: gem.appId,
    name: gem.name,
    coverUrl: gem.coverUrl,
    art: null,
    figure: pct(gem.pctPositive),
    figureColor: verdictColor(gem.pctPositive * 100),
    meta: `${enFull.format(gem.reviews)} reviews in the last 30 days · ${enFull.format(gem.totalReviews)} on Steam overall`,
    quote,
  };
}

function nobodyAgreesSlide(game: GameStats | undefined, minReviews: number, quote?: string): AwardSlide | null {
  if (!game) return null;

  return {
    id: "nobody-agrees",
    chip: "Nobody agrees",
    label: "nobody agrees · all time",
    range: null,
    hint:
      `The game whose all-time score sits closest to 50%, among games with at least ${enFull.format(minReviews)} ` +
      `reviews — read both camps before you buy.`,
    appId: game.appId,
    name: game.name,
    coverUrl: game.coverUrl,
    art: null,
    figure: pct(game.pctPositive),
    figureColor: verdictColor(game.pctPositive * 100),
    meta: `${enFull.format(game.totalReviews)} reviews · all time`,
    quote,
  };
}

/**
 * Les récompenses à montrer, dans l'ordre du carrousel. Celles dont la source
 * est vide sont simplement absentes : le carrousel n'affiche que ce qui reste,
 * et un tableau vide ne rend pas de carrousel du tout.
 */
export function buildAwards(sources: AwardSources, thresholds: AwardThresholds): AwardSlide[] {
  const reviews = pickReviewHighlights(sources.reviews, thresholds.reviewMinVotes);

  // Une citation vide — texte blanc, review sans corps — vaut pas de citation
  // du tout : la diapositive ne doit pas ouvrir un filet de guillemets sur du
  // vide.
  const quote = (id: AwardId): string | undefined => {
    const text = sources.quotes[id];
    return text && text.trim() !== "" ? excerpt(text) : undefined;
  };

  return [
    bestOfPodium(sources.podium, quote("best-of-week")),
    moverSlide(sources.movers.up, "up", thresholds.moverMinReviews, quote("comeback")),
    moverSlide(sources.movers.down, "down", thresholds.moverMinReviews, quote("freefall")),
    mostReviewedSlide(sources.mostReviewed, quote("most-reviewed")),
    reviewSlide(reviews.funny, "funny", thresholds.reviewMinVotes),
    reviewSlide(reviews.helpful, "helpful", thresholds.reviewMinVotes),
    bestOfYearSlide(sources.year, thresholds.yearMinReviews, quote("best-of-year")),
    mostHatedSlide(sources.hated, thresholds.hatedMinReviews, quote("most-hated")),
    hiddenGemSlide(
      sources.hiddenGem,
      thresholds.hiddenGemMinReviews,
      thresholds.hiddenGemMaxTotalReviews,
      quote("hidden-gem"),
    ),
    nobodyAgreesSlide(sources.polarised[0], thresholds.polarisedMinReviews, quote("nobody-agrees")),
  ].filter((slide): slide is AwardSlide => slide !== null);
}
