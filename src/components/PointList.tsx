// Une colonne « Pros » ou « Cons » du résumé LLM des avis : la fiche jeu en
// montre une paire, la page bibliothèque une paire par jeu.
export function PointList({ tone, title, points }: { tone: "good" | "critical"; title: string; points: string[] }) {
  const color = `var(--status-${tone})`;
  return (
    <div
      className="rounded-md border border-[#1e2b36] border-l-[3px] p-4"
      style={{ borderLeftColor: color, backgroundColor: `color-mix(in srgb, ${color} 7%, #0a0f14)` }}
    >
      <h4 className="m-0 font-mono text-[11px] font-bold tracking-[0.12em] uppercase" style={{ color }}>
        {title}
      </h4>
      <ul className="mt-2.5 space-y-1.5">
        {points.map((point) => (
          <li key={point} className="flex gap-2.5 text-sm leading-snug text-[#cfdae1]">
            <span aria-hidden className="font-mono font-bold" style={{ color }}>
              {tone === "good" ? "+" : "−"}
            </span>
            {point}
          </li>
        ))}
      </ul>
    </div>
  );
}
