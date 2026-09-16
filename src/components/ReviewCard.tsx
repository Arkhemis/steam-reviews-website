"use client";

import Image from "next/image";
import { useLayoutEffect, useRef, useState } from "react";
import { BBCodeText } from "@/components/BBCodeText";
import type { GameTopReview } from "@/lib/data/types";

export function ThumbIcon({ up, className }: { up: boolean; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
      className={className}
      style={up ? undefined : { transform: "scaleY(-1)" }}
    >
      <path d="M6.633 10.25c.806 0 1.533-.446 2.031-1.08a9.041 9.041 0 0 1 2.861-2.4c.723-.384 1.35-.956 1.653-1.715a4.498 4.498 0 0 0 .322-1.672V2.75a.75.75 0 0 1 .75-.75 2.25 2.25 0 0 1 2.25 2.25c0 1.152-.26 2.243-.723 3.218-.266.558.107 1.282.725 1.282h3.126c1.026 0 1.945.694 2.054 1.715.045.422.068.85.068 1.285a11.95 11.95 0 0 1-2.649 7.521c-.388.482-.987.729-1.605.729H14.23c-.483 0-.964-.078-1.423-.23l-3.114-1.04a4.501 4.501 0 0 0-1.423-.23H6.633ZM2.913 10.25a.75.75 0 0 0-.75.75v9c0 .414.336.75.75.75h1.5a.75.75 0 0 0 .75-.75v-9a.75.75 0 0 0-.75-.75h-1.5Z" />
    </svg>
  );
}

export function ReviewCard({ review }: { review: GameTopReview }) {
  const [expanded, setExpanded] = useState(false);
  const [isOverflowing, setIsOverflowing] = useState(false);
  const textRef = useRef<HTMLDivElement>(null);
  const color = review.votedUp ? "var(--status-good)" : "var(--status-critical)";

  useLayoutEffect(() => {
    const el = textRef.current;
    if (!el) return;
    setIsOverflowing(el.scrollHeight > el.clientHeight + 1);
  }, [review.reviewText]);

  return (
    <div className="rounded-md border border-[#1e2b36] bg-[#0a0f14] p-5">
      <div className="flex items-center justify-between gap-3 font-mono text-[11px] tracking-[0.1em] text-[#7d919c] uppercase">
        <span className="flex items-center gap-2 font-bold" style={{ color }}>
          <ThumbIcon up={review.votedUp} className="h-4 w-4" />
          {review.votedUp ? "Recommended" : "Not recommended"}
        </span>
        <span className="whitespace-nowrap">{review.votesUp.toLocaleString("en-US")} helpful votes</span>
      </div>
      <div className="mt-4 flex items-center gap-2.5">
        <Image
          src={review.authorAvatarUrl}
          alt=""
          width={32}
          height={32}
          className="h-8 w-8 rounded-full border border-[#24333f] object-cover"
        />
        <span className="text-sm font-semibold text-[#dfe7eb]">{review.authorPersonaname}</span>
        <span className="font-mono text-[10px] text-[#5f7481]">
          {Math.round(review.authorPlaytimeAtReviewMinutes / 60)}h played
        </span>
      </div>
      <div
        ref={textRef}
        className={`mt-3.5 max-w-[54ch] text-base leading-relaxed text-[#dfe7eb] ${!expanded ? "line-clamp-16" : ""}`}
      >
        <BBCodeText text={review.reviewText} />
      </div>
      {isOverflowing && (
        <button
          type="button"
          onClick={() => setExpanded((value) => !value)}
          className="mt-1.5 font-mono text-[10px] tracking-[0.1em] text-brand-blue uppercase hover:underline"
        >
          {expanded ? "Read less" : "Read more"}
        </button>
      )}
      <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[10px] text-[#5f7481]">
        {review.votesFunny > 0 && <span>{review.votesFunny.toLocaleString("en-US")} funny votes</span>}
        {review.authorLastPlayedAt && (
          <span>Last played on {new Date(review.authorLastPlayedAt).toLocaleDateString("en-US")}</span>
        )}
        <a
          href={review.reviewUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-brand-blue hover:underline"
        >
          view on steam ↗
        </a>
      </div>
    </div>
  );
}

export function EmptyReviewCard({ label }: { label: string }) {
  return (
    <div className="flex items-center justify-center rounded-md border border-[#1e2b36] bg-[#0a0f14] p-5 text-sm text-[#5f7481]">
      {label}
    </div>
  );
}
