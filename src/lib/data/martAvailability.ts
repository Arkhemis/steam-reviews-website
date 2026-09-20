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
  // La colonne peut exister et la lecture échouer quand même (mart remplacé en
  // plein `dbt run`, droits) : on saute les cas plutôt que de faire tomber le
  // fichier de test entier.
  try {
    const { rows } = await pool.query(`SELECT 1 FROM marts.game_window_score WHERE window_name = $1 LIMIT 1`, [
      windowName,
    ]);
    return rows.length > 0;
  } catch {
    return false;
  }
}

/**
 * La fenêtre a-t-elle un jeu qui franchit le plancher d'un classement ?
 * `hasWindow` ne répond que de l'existence de la fenêtre : une base
 * d'échantillon la porte bien, mais avec des volumes si maigres (quelques
 * dizaines d'avis sur trente jours, là où la prod en compte des dizaines de
 * milliers) qu'aucun jeu ne passe le seuil. Les cas qui exigent un podium
 * garni sont alors sautés — le classement vide vient des données, pas du code.
 */
export async function hasWindowRanking(windowName: string, minReviews: number): Promise<boolean> {
  try {
    const { rows } = await pool.query(
      `SELECT 1
       FROM marts.game_window_score s
       JOIN marts.game_stats g ON g.steam_app_id = s.app_id
       WHERE s.window_name = $1 AND s.total_reviews >= $2 AND g.cover_url IS NOT NULL
       LIMIT 1`,
      [windowName, minReviews],
    );
    return rows.length > 0;
  } catch {
    return false;
  }
}

/**
 * `review_highlight` couvre-t-il assez du catalogue pour que le tirage du duel
 * tombe juste ? Le duel tire une vingtaine de jeux au hasard dans `game_stats`
 * puis va chercher leur avis saillant : en prod le mart couvre 98 % des jeux
 * au-dessus du seuil et le tirage aboutit toujours, alors qu'une base
 * d'échantillon n'en highlighte que quelques dizaines sur des milliers — il
 * revient alors vide une fois sur deux, sans que le duel soit en cause.
 */
export async function hasDuelCoverage(minReviews = 5000): Promise<boolean> {
  try {
    const { rows } = await pool.query<{ covered: string; eligible: string }>(
      `SELECT
         COUNT(*) FILTER (WHERE h.app_id IS NOT NULL) AS covered,
         COUNT(*) AS eligible
       FROM marts.game_stats g
       LEFT JOIN (
         SELECT app_id
         FROM marts.review_highlight
         WHERE rank_in_game = 1
         GROUP BY app_id
         HAVING COUNT(DISTINCT voted_up) = 2
       ) h ON h.app_id = g.steam_app_id
       WHERE g.total_reviews > $1`,
      [minReviews],
    );
    const { covered, eligible } = rows[0];
    return Number(eligible) > 0 && Number(covered) / Number(eligible) >= 0.9;
  } catch {
    return false;
  }
}
