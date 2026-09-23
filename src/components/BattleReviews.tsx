"use client";

import { useState } from "react";
import { EmptyReviewCard, ReviewCard, ThumbIcon } from "@/components/ReviewCard";
import type { GameTopReview } from "@/lib/data/types";

// Ce que chaque camp crie avant le combat : la review positive la plus
// votée de chaque jeu, ou — un clic plus loin — la négative la plus votée,
// celle que les fans adverses citeraient.

type Corner = { name: string; positive?: GameTopReview; negative?: GameTopReview };

type Mode = "cries" | "trash";

const MODES: { key: Mode; label: string; up: boolean }[] = [
  { key: "cries", label: "Battle cries", up: true },
  { key: "trash", label: "Trash talk", up: false },
];

export function BattleReviews({ left, right }: { left: Corner; right: Corner }) {
  const [mode, setMode] = useState<Mode>("cries");

  return (
    <div>
      <div className="mb-[18px] flex flex-wrap items-baseline justify-between gap-3">
        <div className="flex flex-wrap items-baseline gap-3">
          <h2 className="m-0 text-[26px] font-extrabold tracking-tight">
            {mode === "cries" ? "Battle cries" : "Trash talk"}
          </h2>
          <span className="text-sm text-[#7d919c]">
            {mode === "cries" ? "the most upvoted fan on each side" : "the most upvoted hater on each side"}
          </span>
        </div>
        <div role="tablist" aria-label="Which reviews" className="flex rounded-full border border-[#24333f] p-0.5">
          {MODES.map((m) => (
            <button
              key={m.key}
              type="button"
              role="tab"
              aria-selected={mode === m.key}
              onClick={() => setMode(m.key)}
              className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 font-mono text-[10px] tracking-[0.1em] uppercase transition-colors ${
                mode === m.key ? "bg-brand-blue font-bold text-[#0c1116]" : "text-[#9fb2bd] hover:text-[#eef2f4]"
              }`}
            >
              <ThumbIcon up={m.up} className="h-3 w-3" />
              {m.label}
            </button>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {[left, right].map((corner, i) => {
          const review = mode === "cries" ? corner.positive : corner.negative;
          return (
            <div key={i}>
              <div
                className="mb-2 font-mono text-[10px] tracking-[0.14em] uppercase"
                style={{ color: i === 0 ? "var(--color-brand-blue)" : "var(--series-1)" }}
              >
                {i === 0 ? "P1" : "P2"} · {corner.name}
              </div>
              {review ? (
                <ReviewCard key={review.recommendationId} review={review} />
              ) : (
                <EmptyReviewCard label={mode === "cries" ? "No fan has spoken yet." : "No hater to quote. Suspicious."} />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
