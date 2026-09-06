import type { GameReviewLanguage } from "@/lib/data/types";

/** Valeur du paramètre `?lang=` qui désactive le filtre par langue. */
export const ALL_LANGUAGES = "all";

const DEFAULT_LANGUAGE = "english";

/**
 * Décide quelle langue de reviews afficher sur une fiche de jeu.
 *
 * `available` liste les langues effectivement présentes dans
 * `marts.review_highlight` pour ce jeu, triées par volume décroissant ; un
 * retour `null` signifie « toutes les langues », donc requête non filtrée.
 */
export function resolveReviewLanguage(
  available: GameReviewLanguage[],
  requested: string | undefined,
): string | null {
  if (requested === ALL_LANGUAGES) return null;
  if (requested && available.some((entry) => entry.language === requested)) return requested;

  if (available.some((entry) => entry.language === DEFAULT_LANGUAGE)) return DEFAULT_LANGUAGE;

  // Pas d'anglais pour ce jeu : on ouvre sur la langue la mieux représentée
  // plutôt que sur un mélange, pour rester cohérent avec le sélecteur.
  const best = available.reduce<GameReviewLanguage | null>(
    (top, entry) => (top === null || entry.reviewCount > top.reviewCount ? entry : top),
    null,
  );
  return best?.language ?? null;
}
