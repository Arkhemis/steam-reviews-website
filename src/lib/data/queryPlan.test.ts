import { describe, expect, it } from "vitest";
import { pool } from "@/lib/db";
import { reviewDuelQuery } from "@/lib/data/gameData";

type PlanNode = {
  "Node Type": string;
  "Relation Name"?: string;
  Plans?: PlanNode[];
};

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

describe("query plans", () => {
  it("never sorts review_highlight rows to pick the duel", async () => {
    const plan = await planFor(reviewDuelQuery(5000));

    expect(scannedRelations(plan)).toContain("review_highlight");
    expect(sortedRelations(plan)).not.toContain("review_highlight");
  });
});
