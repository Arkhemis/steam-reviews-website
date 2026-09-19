import { pool } from "@/lib/db";

// Réservé aux tests qui tapent la base. Les marts du carrousel de la home
// (`game_window_score`, `review_window_highlight`, `review_highlight.created_at`)
// arrivent en base au rythme des déploiements de `steam-reviews-analysis` :
// une copie locale plus ancienne ne les a pas encore. Les cas qui en dépendent
// sont alors sautés plutôt qu'en échec — la page, elle, les cache d'elle-même.

export async function hasMartColumn(table: string, column: string): Promise<boolean> {
  try {
    const { rows } = await pool.query(
      `SELECT 1 FROM information_schema.columns
       WHERE table_schema = 'marts' AND table_name = $1 AND column_name = $2`,
      [table, column],
    );
    return rows.length > 0;
  } catch {
    return false;
  }
}

/** `game_window_score` porte-t-il déjà la fenêtre demandée ? */
export async function hasWindow(windowName: string): Promise<boolean> {
  if (!(await hasMartColumn("game_window_score", "window_name"))) return false;
  const { rows } = await pool.query(`SELECT 1 FROM marts.game_window_score WHERE window_name = $1 LIMIT 1`, [
    windowName,
  ]);
  return rows.length > 0;
}
