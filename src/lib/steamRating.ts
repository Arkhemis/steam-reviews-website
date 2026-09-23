// Le verdict de Steam, avec ses propres libellés anglais : la fiche d'un jeu
// l'affiche en tête, et le mini-jeu de la page 404 le rejoue en direct.
export function getSteamRating(pctPositive: number, totalReviews: number): { label: string; color: string } {
  const pct = pctPositive * 100;

  if (pct < 20) {
    if (totalReviews >= 500) return { label: "Overwhelmingly Negative", color: "var(--status-critical)" };
    if (totalReviews >= 50) return { label: "Very Negative", color: "var(--status-critical)" };
    return { label: "Negative", color: "var(--status-critical)" };
  }
  if (pct < 40) return { label: "Mostly Negative", color: "var(--status-critical)" };
  if (pct < 70) return { label: "Mixed", color: "var(--status-warning)" };
  if (pct < 80) return { label: "Mostly Positive", color: "var(--status-good)" };
  if (totalReviews >= 500) return { label: "Overwhelmingly Positive", color: "var(--status-good)" };
  if (totalReviews >= 50) return { label: "Very Positive", color: "var(--status-good)" };
  return { label: "Positive", color: "var(--status-good)" };
}
