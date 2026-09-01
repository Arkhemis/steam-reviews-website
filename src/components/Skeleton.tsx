import type { CSSProperties } from "react";

// Placeholders shown while a Suspense boundary waits on its Postgres query, or
// while a lazily-imported client chunk lands. Each one must reserve the same box
// as the content it stands in for: streaming is only a win if the reader doesn't
// get the layout yanked out from under them when the real thing arrives.

export function Skeleton({ className = "", style }: { className?: string; style?: CSSProperties }) {
  return <div aria-hidden style={style} className={`animate-pulse rounded-md bg-white/10 ${className}`} />;
}

// Ragged line lengths so a paragraph placeholder reads as text rather than as a
// solid block. `widths` are CSS lengths, one per line.
export function SkeletonLines({ widths }: { widths: string[] }) {
  return (
    <div className="space-y-2">
      {widths.map((width, i) => (
        <Skeleton key={i} className="h-3" style={{ width }} />
      ))}
    </div>
  );
}
