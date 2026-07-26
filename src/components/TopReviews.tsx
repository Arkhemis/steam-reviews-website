import type { GameTopReview } from "@/lib/data/types";

type TopReviewsProps = {
  reviews: GameTopReview[];
};

export function TopReviews({ reviews }: TopReviewsProps) {
  return (
    <div className="space-y-3">
      {reviews.map((review) => (
        <div key={review.recommendationId} className="rounded-xl border border-white/10 bg-white/5 p-4">
          <div className="mb-2 flex items-center justify-between text-xs text-neutral-400">
            <span
              className="font-bold"
              style={{ color: review.votedUp ? "var(--status-good)" : "var(--status-critical)" }}
            >
              {review.votedUp ? "Recommandé" : "Non recommandé"}
            </span>
            <span>{review.votesUp.toLocaleString("fr-FR")} personnes ont trouvé cette review utile</span>
          </div>
          <p className="text-sm text-neutral-200">{review.reviewText}</p>
          <div className="mt-2 text-xs text-neutral-500">
            {Math.round(review.authorPlaytimeAtReviewMinutes / 60)}h jouées · {review.language}
          </div>
        </div>
      ))}
    </div>
  );
}
