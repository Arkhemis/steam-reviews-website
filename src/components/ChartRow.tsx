import Image from "next/image";
import Link from "next/link";
import { verdictColor } from "@/components/GameCoverTile";

type ChartRowProps = {
  rank: number;
  appId: number;
  name: string;
  coverUrl: string | null;
  reviews: string;
  pct: number;
  delta?: { formatted: string; rising: boolean };
};

export function ChartRow({ rank, appId, name, coverUrl, reviews, pct, delta }: ChartRowProps) {
  return (
    <Link
      href={`/games/${appId}`}
      className="grid grid-cols-[24px_34px_minmax(0,1fr)_110px_74px_68px] items-center gap-4 border-t border-[#16202a] py-3.5"
    >
      <span className="font-mono text-xs text-[#5f7481]">{String(rank).padStart(2, "0")}</span>
      <span className="relative block h-[34px] w-[34px] overflow-hidden rounded-[3px] bg-white/5">
        {coverUrl && <Image src={coverUrl} alt="" fill sizes="34px" className="object-cover" />}
      </span>
      <span className="truncate text-base font-semibold">{name}</span>
      <span className="text-right font-mono text-sm text-[#7d919c]">{reviews}</span>
      <span className="text-right font-mono text-lg" style={{ color: verdictColor(pct) }}>
        {Math.round(pct)}
        <span className="text-[11px] text-[#5f7481]">%</span>
      </span>
      <span
        className="text-right font-mono text-sm"
        style={{ color: delta ? (delta.rising ? "var(--status-good)" : "var(--status-critical)") : "#5f7481" }}
      >
        {delta ? delta.formatted : "—"}
      </span>
    </Link>
  );
}

type ChartRowHeaderProps = {
  reviewsLabel: string;
  positiveLabel: string;
  shiftLabel: string;
};

export function ChartRowHeader({ reviewsLabel, positiveLabel, shiftLabel }: ChartRowHeaderProps) {
  return (
    <div className="grid grid-cols-[24px_34px_minmax(0,1fr)_110px_74px_68px] items-center gap-4 pb-2 font-mono text-[10px] tracking-[0.14em] text-[#5f7481] uppercase">
      <span />
      <span />
      <span />
      <span className="text-right">{reviewsLabel}</span>
      <span className="text-right">{positiveLabel}</span>
      <span className="text-right">{shiftLabel}</span>
    </div>
  );
}
