// Le kicker du héros annonce la fenêtre du podium : « 07 Sep – 13 Sep ».
//
// En `en-US`, `Intl` place le mois devant (« Sep 07 »). On garde son
// abréviation — c'est la locale du site, et `en-GB` dirait « Sept » — mais on
// remonte le jour en premier, comme la maquette : sur une plage de dates, le
// jour est ce qui change, et le répéter en second se lit moins bien.
const DAY_AND_MONTH = new Intl.DateTimeFormat("en-US", {
  day: "2-digit",
  month: "short",
  timeZone: "UTC",
});

// Les dates viennent du mart en ISO nu (`2026-09-07`) : on les lit en UTC,
// sinon un fuseau à l'ouest de Greenwich les recule d'un jour.
function dayFirst(isoDate: string): string {
  const parts = DAY_AND_MONTH.formatToParts(new Date(`${isoDate}T00:00:00Z`));
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === type)?.value ?? "";
  return `${part("day")} ${part("month")}`;
}

/** « 07 Sep – 13 Sep », ou `null` tant que la fenêtre n'a sacré personne. */
export function formatReviewWindow(startsOn: string | null, endsOn: string | null): string | null {
  if (!startsOn || !endsOn) return null;
  return `${dayFirst(startsOn)} – ${dayFirst(endsOn)}`;
}
