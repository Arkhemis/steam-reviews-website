import { describe, expect, it } from "vitest";
import { pool } from "@/lib/db";
import {
  gameTopReviewInWindowQuery,
  reviewDuelQuery,
  windowMoversQuery,
  windowRankingQuery,
} from "@/lib/data/gameData";
import { hasMartColumn, hasWindow } from "@/lib/data/martAvailability";

type PlanNode = {
  "Node Type": string;
  "Relation Name"?: string;
  Plans?: PlanNode[];
};

// Les marts du carrousel peuvent manquer à une base plus ancienne que le
// site : EXPLAIN échouerait sur une relation absente, on saute alors le cas.
const HAS_WINDOW_SCORE = await hasWindow("week");
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

  // `review_highlight` porte le texte complet des reviews : la citation du
  // gagnant doit passer par l'index `app_id`, jamais balayer la table.
  it.skipIf(!HAS_HIGHLIGHT_CREATED_AT)("lit la citation de la fenêtre par l'index app_id", async () => {
    const plan = await planFor(gameTopReviewInWindowQuery(1086940, "2026-09-07", "2026-09-13", "english"));

    expect(scannedRelations(plan)).toContain("review_highlight");
    expect(seqScannedRelations(plan)).not.toContain("review_highlight");
  });
});
