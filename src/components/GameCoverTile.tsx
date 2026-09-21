import Image from "next/image";
import Link from "next/link";

const enCompact = new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 });

// Les paliers de Steam : sous 40 % c'est « Negative », sous 70 % « Mixed »,
// au-delà « Positive ». Le libellé du héros de la page jeu suit les mêmes
// seuils — une jaquette ne doit pas dire rouge quand Steam dit « Mixed ».
export function verdictColor(pct: number): string {
  if (pct >= 70) return "var(--status-good)";
  if (pct >= 40) return "var(--status-warning)";
  return "var(--status-critical)";
}

type GameCoverTileProps = {
  appId: number;
  name: string;
  coverUrl: string | null;
  pct: number;
  reviews?: number;
  deltaPct?: number;
  sizes: string;
};

export function GameCoverTile({ appId, name, coverUrl, pct, reviews, deltaPct, sizes }: GameCoverTileProps) {
  const color = verdictColor(pct);
  const rising = (deltaPct ?? 0) >= 0;

  return (
    <Link href={`/games/${appId}`} className="group relative block aspect-[2/3] overflow-hidden rounded-[3px] bg-white/5">
      {coverUrl && <Image src={coverUrl} alt="" fill sizes={sizes} className="object-cover" />}
      <span className="absolute inset-x-0 top-0 h-[3px]" style={{ backgroundColor: color }} />
      <span className="absolute inset-0 flex flex-col justify-center gap-1.5 bg-[#0c1116]/95 p-2.5 opacity-0 transition-opacity duration-150 group-hover:opacity-100">
        <span className="font-mono text-lg leading-none" style={{ color }}>
          {Math.round(pct)}%
        </span>
        <span className="line-clamp-2 text-[11px] font-bold leading-tight text-white">{name}</span>
        {reviews !== undefined && (
          <span className="font-mono text-[10px] text-neutral-400">{enCompact.format(reviews)}</span>
        )}
        {deltaPct !== undefined && (
          <span
            className="font-mono text-[10px]"
            style={{ color: rising ? "var(--status-good)" : "var(--status-critical)" }}
          >
            {rising ? "+" : ""}
            {deltaPct.toFixed(1)} pts
          </span>
        )}
      </span>
    </Link>
  );
}
