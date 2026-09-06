"use client";

import { useState } from "react";
import { EmptyReviewCard, ReviewCard, ThumbIcon } from "@/components/ReviewCard";
import { ReviewLanguageSelect } from "@/components/ReviewLanguageSelect";
import type { GameReviewLanguage, GameTopReview } from "@/lib/data/types";

type ReviewBattleProps = {
  reviews: GameTopReview[];
  /** Langues disponibles pour ce jeu ; vide = pas de sélecteur. */
  languages?: GameReviewLanguage[];
  /** Langue appliquée à `reviews`, `null` quand elles sont toutes langues confondues. */
  selectedLanguage?: string | null;
};

function pickDifferentIndex(length: number, current: number): number {
  if (length <= 1) return current;
  let next = current;
  while (next === current) {
    next = Math.floor(Math.random() * length);
  }
  return next;
}

export function ReviewBattle({ reviews, languages = [], selectedLanguage = null }: ReviewBattleProps) {
  const positives = reviews.filter((review) => review.votedUp);
  const negatives = reviews.filter((review) => !review.votedUp);

  const [positiveIndex, setPositiveIndex] = useState(0);
  const [negativeIndex, setNegativeIndex] = useState(0);

  const languageSelect = <ReviewLanguageSelect languages={languages} selected={selectedLanguage} />;

  if (positives.length === 0 && negatives.length === 0) {
    return (
      <div>
        <div className="mb-3">{languageSelect}</div>
        <p className="text-sm text-neutral-400">Aucune review disponible pour ce jeu.</p>
      </div>
    );
  }

  const randomizeUp = () => setPositiveIndex((i) => pickDifferentIndex(positives.length, i));
  const randomizeDown = () => setNegativeIndex((i) => pickDifferentIndex(negatives.length, i));
  const randomizeBoth = () => {
    randomizeUp();
    randomizeDown();
  };

  return (
    <div>
      <div className="mb-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={randomizeUp}
          disabled={positives.length <= 1}
          className="flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-neutral-300 disabled:opacity-40"
        >
          🎲 Autre review positive <ThumbIcon up className="h-3 w-3" />
        </button>
        <button
          type="button"
          onClick={randomizeDown}
          disabled={negatives.length <= 1}
          className="flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-neutral-300 disabled:opacity-40"
        >
          🎲 Autre review négative <ThumbIcon up={false} className="h-3 w-3" />
        </button>
        <button
          type="button"
          onClick={randomizeBoth}
          disabled={positives.length <= 1 && negatives.length <= 1}
          className="rounded-full bg-gradient-to-r from-brand-blue to-brand-red px-3 py-1 text-xs font-bold text-black disabled:opacity-40"
        >
          🎲 Les deux
        </button>
        {languageSelect}
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {positives[positiveIndex] ? (
          <ReviewCard review={positives[positiveIndex]} />
        ) : (
          <EmptyReviewCard label="Pas de review positive." />
        )}
        {negatives[negativeIndex] ? (
          <ReviewCard review={negatives[negativeIndex]} />
        ) : (
          <EmptyReviewCard label="Pas de review négative." />
        )}
      </div>
    </div>
  );
}
