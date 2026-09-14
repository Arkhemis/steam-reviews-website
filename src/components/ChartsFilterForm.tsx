import { DEFAULT_CHART_FILTER, type ChartFilterKey } from "@/lib/charts";

// Le champ qui restreint le classement affiché. Un formulaire GET, et non un
// champ contrôlé : la page est rendue sur le serveur, le tri et la pagination
// vivent déjà dans la query string, et le filtre n'a aucune raison de faire
// basculer toute la grille côté client.
//
// Le tri en cours voyage en champ caché : sans lui, filtrer renverrait le
// lecteur sur le tri par défaut, qui n'est pas celui qu'il regardait.

type ChartsFilterFormProps = {
  filter: ChartFilterKey;
  defaultValue?: string;
  className?: string;
};

export function ChartsFilterForm({ filter, defaultValue, className }: ChartsFilterFormProps) {
  return (
    <form action="/charts" method="GET" className={`relative ${className ?? ""}`}>
      {filter !== DEFAULT_CHART_FILTER && <input type="hidden" name="filter" value={filter} />}
      <input
        type="text"
        name="q"
        defaultValue={defaultValue}
        aria-label="Filter the ranking by game name"
        placeholder="Filter this ranking, e.g. Baldur's…"
        className="w-full rounded-full border border-[#24333f] bg-[#111a21] py-[9px] pr-4 pl-[34px] font-sans text-[13px] text-[#eef2f4] placeholder:text-[#5f7481] focus:border-brand-blue focus:outline-none"
      />
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="#7d919c"
        strokeWidth={1.8}
        aria-hidden
        className="pointer-events-none absolute top-[11px] left-[13px] h-3.5 w-3.5"
      >
        <circle cx="11" cy="11" r="7" />
        <path d="m16.5 16.5 4 4" />
      </svg>
    </form>
  );
}
