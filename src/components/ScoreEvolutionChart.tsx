"use client";

import { useState } from "react";
import type { GameReviewTrend } from "@/lib/data/types";

type ScoreEvolutionChartProps = {
  trends: GameReviewTrend[];
};

const WIDTH = 640;
const HEIGHT = 220;
const PADDING = 24;

function formatMonth(periodMonth: string): string {
  return new Date(periodMonth).toLocaleDateString("fr-FR", { month: "short", year: "numeric" });
}

export function ScoreEvolutionChart({ trends }: ScoreEvolutionChartProps) {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  if (trends.length === 0) {
    return <p className="text-sm text-neutral-400">Pas encore assez de données.</p>;
  }

  const plotWidth = WIDTH - PADDING * 2;
  const plotHeight = HEIGHT - PADDING * 2;
  const stepX = trends.length > 1 ? plotWidth / (trends.length - 1) : 0;

  const points = trends.map((trend, index) => ({
    x: PADDING + index * stepX,
    y: PADDING + plotHeight * (1 - trend.pctPositivePeriod),
    trend,
  }));

  const linePath = points.map((p, i) => `${i === 0 ? "M" : "L"}${p.x},${p.y}`).join(" ");
  const annotationIndex = trends.findIndex((t) => t.annotation);

  function handlePointerMove(event: React.PointerEvent<SVGRectElement>) {
    const bounds = event.currentTarget.getBoundingClientRect();
    const relativeX = event.clientX - bounds.left - PADDING;
    const index = Math.round(relativeX / stepX);
    setHoverIndex(Math.min(Math.max(index, 0), trends.length - 1));
  }

  const hovered = hoverIndex !== null ? points[hoverIndex] : null;

  return (
    <div className="relative">
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        role="img"
        aria-label="Évolution du score positif dans le temps"
        className="w-full"
      >
        {[0, 0.5, 1].map((fraction) => (
          <line
            key={fraction}
            x1={PADDING}
            x2={WIDTH - PADDING}
            y1={PADDING + plotHeight * (1 - fraction)}
            y2={PADDING + plotHeight * (1 - fraction)}
            stroke="var(--gridline)"
            strokeWidth={1}
          />
        ))}

        <path d={linePath} fill="none" stroke="var(--series-1)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />

        {points.map((p, i) => (
          <circle
            key={p.trend.periodMonth}
            cx={p.x}
            cy={p.y}
            r={i === annotationIndex ? 6 : 5}
            fill={i === annotationIndex ? "var(--status-critical)" : "var(--series-1)"}
            stroke="var(--chart-surface)"
            strokeWidth={2}
          />
        ))}

        {hovered && (
          <line
            x1={hovered.x}
            x2={hovered.x}
            y1={PADDING}
            y2={HEIGHT - PADDING}
            stroke="var(--ink-secondary)"
            strokeWidth={1}
            strokeDasharray="3 3"
          />
        )}

        <rect
          x={PADDING}
          y={0}
          width={plotWidth}
          height={HEIGHT}
          fill="transparent"
          onPointerMove={handlePointerMove}
          onPointerLeave={() => setHoverIndex(null)}
        />
      </svg>

      {annotationIndex !== -1 && (
        <div
          className="absolute top-2 text-xs text-[color:var(--status-critical)]"
          style={{ left: `${(points[annotationIndex].x / WIDTH) * 100}%` }}
        >
          <span>⚠</span> {trends[annotationIndex].annotation}
        </div>
      )}

      {hovered && (
        <div
          className="pointer-events-none absolute rounded-md border border-white/10 bg-black/90 px-2 py-1 text-xs text-white"
          style={{ left: `${(hovered.x / WIDTH) * 100}%`, top: 0 }}
        >
          <div className="font-semibold">{Math.round(hovered.trend.pctPositivePeriod * 100)}%</div>
          <div className="text-neutral-400">{formatMonth(hovered.trend.periodMonth)}</div>
        </div>
      )}
    </div>
  );
}
