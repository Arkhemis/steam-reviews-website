import { describe, expect, it } from "vitest";
import { pool } from "@/lib/db";
import {
  awardReviewQuery,
  catalogueTrendQuery,
  cataloguePageQuery,
  recentDeltasQuery,
  reviewDuelQuery,
  siteStatsQuery,
  trendingGamesQuery,
  windowMoversQuery,
  windowRankingQuery,
} from "@/lib/data/gameData";
import { hasMartColumn, hasWindow } from "@/lib/data/martAvailability";
import { RANKINGS } from "@/lib/rankings";

type PlanNode = {
  "Node Type": string;
  "Relation Name"?: string;
  Plans?: PlanNode[];
};

// Les marts du carrousel peuvent manquer à une base plus ancienne que le
// site : EXPLAIN échouerait sur une relation absente, on saute alors le cas.
const HAS_WINDOW_SCORE = await hasWindow("week");
const HAS_PREVIOUS_MONTH = await hasWindow("previous_month");
const HAS_HIGHLIGHT_CREATED_AT = await hasMartColumn("review_highlight", "created_at");

async function planFor(query: { text: string; values: unknown[] }): Promise<PlanNode> {
  const { rows } = await pool.query(`EXPLAIN (FORMAT JSON) ${query.text}`, query.values);
  return rows[0]["QUERY PLAN"][0].Plan as PlanNode;
}

function scannedRelations(node: PlanNode): string[] {
  const here = node["Relation Name"] ? [node["Relation Name"]] : [];
  return here.concat(...(node.Plans ?? []).map(scannedRelations));
}

// Returns the relations whose rows pass through a Sort node. `ORDER BY RANDOM()`
// over a wide table is the pathological case: Postgres has to materialise and
// sort every candidate row — review_text included — to hand back a single one.
function sortedRelations(node: PlanNode): string[] {
  const below =
    node["Node Type"] === "Sort" ? scannedRelations(node) : [];
  return below.concat(...(node.Plans ?? []).map(sortedRelations));
}

// Les relations lues d'un bout à l'autre, sans index.
function seqScannedRelations(node: PlanNode): string[] {
  const here = node["Node Type"] === "Seq Scan" && node["Relation Name"] ? [node["Relation Name"]] : [];
  return here.concat(...(node.Plans ?? []).map(seqScannedRelations));
}

describe("query plans", () => {
  it("never sorts review_highlight rows to pick the duel", async () => {
    const plan = await planFor(reviewDuelQuery(5000));

    expect(scannedRelations(plan)).toContain("review_highlight");
    expect(sortedRelations(plan)).not.toContain("review_highlight");
  });

  // Tout l'intérêt de `game_window_score` : les classements de fenêtre ne
  // réagrègent plus le mart quotidien à chaque expiration de cache.
  it.skipIf(!HAS_WINDOW_SCORE)("classe une fenêtre sans réagréger game_review_trend_daily", async () => {
    const plan = await planFor(windowRankingQuery("month", "best", { limit: 5, minReviews: 500 }));

    expect(scannedRelations(plan)).toContain("game_window_score");
    expect(scannedRelations(plan)).not.toContain("game_review_trend_daily");
  });

  it.skipIf(!HAS_WINDOW_SCORE)("compare les deux semaines sans réagréger game_review_trend_daily", async () => {
    const plan = await planFor(windowMoversQuery(100));

    expect(scannedRelations(plan)).toContain("game_window_score");
    expect(scannedRelations(plan)).not.toContain("game_review_trend_daily");
  });

  // La bascule trente jours contre trente jours est la question la plus chère
  // du site : posée au mart quotidien, elle agrège un demi-million de lignes de
  // (jeu, jour). `previous_month` la ramène à un join de deux lignes par jeu.
  it.skipIf(!HAS_PREVIOUS_MONTH)("compare les deux mois sans réagréger game_review_trend_daily", async () => {
    const plan = await planFor(trendingGamesQuery(5, 30));

    expect(scannedRelations(plan)).toContain("game_window_score");
    expect(scannedRelations(plan)).not.toContain("game_review_trend_daily");
  });

  it.skipIf(!HAS_PREVIOUS_MONTH)("trie le catalogue par variation sans réagréger game_review_trend_daily", async () => {
    const plan = await planFor(cataloguePageQuery({ sort: "trending", limit: 25, minReviews: 30 }));

    expect(scannedRelations(plan)).toContain("game_window_score");
    expect(scannedRelations(plan)).not.toContain("game_review_trend_daily");
  });

  // Celle-ci part sur chaque chargement de `/charts`, hors cache : c'est le
  // seul coût que le lecteur paie à tous les coups.
  it.skipIf(!HAS_PREVIOUS_MONTH)("date les vignettes sans réagréger game_review_trend_daily", async () => {
    const plan = await planFor(recentDeltasQuery([1086940, 570, 730], 30));

    expect(scannedRelations(plan)).toContain("game_window_score");
    expect(scannedRelations(plan)).not.toContain("game_review_trend_daily");
  });

  // `game_review_trend_daily` compte vingt millions de lignes : la somme du
  // corpus a son rollup, `catalogue_review_trend_daily`, qui en fait cinq
  // mille. Les deux donnent le même nombre.
  it("annonce la taille du corpus sans balayer game_review_trend_daily", async () => {
    const plan = await planFor(siteStatsQuery());

    expect(scannedRelations(plan)).toContain("catalogue_review_trend_daily");
    expect(scannedRelations(plan)).not.toContain("game_review_trend_daily");
  });

  // La courbe de la home ne trace qu'un point par jour, mais la posait au mart
  // par (jeu, jour) : trois millions de lignes réagrégées pour en rendre 354.
  it("trace la courbe du catalogue sans réagréger game_review_trend_daily", async () => {
    const plan = await planFor(catalogueTrendQuery());

    expect(scannedRelations(plan)).toContain("catalogue_review_trend_daily");
    expect(scannedRelations(plan)).not.toContain("game_review_trend_daily");
  });

  // `review_highlight` porte le texte complet des reviews : la citation du
  // gagnant doit passer par l'index `app_id`, jamais balayer la table.
  it.skipIf(!HAS_HIGHLIGHT_CREATED_AT)("lit la citation de la fenêtre par l'index app_id", async () => {
    const plan = await planFor(
      awardReviewQuery(1086940, { startsOn: "2026-09-07", endsOn: "2026-09-13" }),
    );

    expect(scannedRelations(plan)).toContain("review_highlight");
    expect(seqScannedRelations(plan)).not.toContain("review_highlight");
  });
});

// Les huit classements de `/charts` se ramènent à deux requêtes, mais chacun
// pose ses propres bornes et son propre ORDER BY. Les faire tous passer par
// EXPLAIN vérifie d'un coup qu'aucun ne demande au mart une colonne qu'il n'a
// pas — une faute qu'un test sur les seules chaînes ne verrait jamais.
describe("les classements de /charts", () => {
  for (const entry of RANKINGS) {
    const needsPreviousMonth = entry.source.kind === "movers";

    it.skipIf(needsPreviousMonth && !HAS_PREVIOUS_MONTH)(`sait servir « ${entry.label} »`, async () => {
      const plan = await planFor(cataloguePageQuery({ sort: entry.key, limit: 8 }));

      expect(scannedRelations(plan).length, entry.key).toBeGreaterThan(0);
    });

    it.skipIf(needsPreviousMonth && !HAS_PREVIOUS_MONTH)(`pagine et filtre « ${entry.label} »`, async () => {
      const plan = await planFor(
        cataloguePageQuery({ sort: entry.key, limit: 24, offset: 48, search: "half" }),
      );

      expect(scannedRelations(plan).length, entry.key).toBeGreaterThan(0);
    });
  }
});
