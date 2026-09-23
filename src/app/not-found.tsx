import type { Metadata } from "next";
import Link from "next/link";
import { Nav } from "@/components/Nav";
import { ReviewBombGame } from "@/components/ReviewBombGame";

// La 404 se présente comme une fiche Steam : une page sans jeu, notée
// « Overwhelmingly Not Found », avec les reviews de ceux qui sont tombés
// dessus — puis un mini-jeu pour lui refaire une note. Aucune requête : une
// URL cassée ne doit pas coûter un aller-retour Postgres, ni tomber avec lui.

export const metadata: Metadata = {
  title: "Page not found",
  robots: { index: false },
};

type FakeReview = { verdict: "up" | "down"; hours: string; text: string; helpful: number; funny: number };

const REVIEWS: FakeReview[] = [
  {
    verdict: "down",
    hours: "0.0",
    text: "Clicked a link, got nothing. The loading screen was the best part. Would not 404 again.",
    helpful: 404,
    funny: 128,
  },
  {
    verdict: "up",
    hours: "0.1",
    text: "Finally a page with zero microtransactions, zero bugs and zero content. Masterpiece of minimalism.",
    helpful: 97,
    funny: 311,
  },
  {
    verdict: "down",
    hours: "1,337",
    text: "Been waiting here since 2019 for the content update. Devs said Valve Time. It has been Valve Time.",
    helpful: 212,
    funny: 64,
  },
];

function Thumb({ up }: { up: boolean }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className={`h-5 w-5 ${up ? "" : "rotate-180"}`} fill="currentColor">
      <path d="M1 21h4V9H1v12zm22-11c0-1.1-.9-2-2-2h-6.31l.95-4.57.03-.32c0-.41-.17-.79-.44-1.06L14.17 1 7.59 7.59C7.22 7.95 7 8.45 7 9v10c0 1.1.9 2 2 2h9c.83 0 1.54-.5 1.84-1.22l3.02-7.05c.09-.23.14-.47.14-.73v-2z" />
    </svg>
  );
}

function ReviewSnippet({ review }: { review: FakeReview }) {
  const up = review.verdict === "up";
  const color = up ? "var(--status-good)" : "var(--status-critical)";
  return (
    <article className="rounded-[5px] border border-[#1e2b36] bg-[#0c1116] p-4">
      <header className="flex items-center gap-2.5" style={{ color }}>
        <Thumb up={up} />
        <span className="text-sm font-bold">{up ? "Recommended" : "Not Recommended"}</span>
        <span className="ml-auto font-mono text-[10px] text-[#7d919c]">{review.hours} hrs on record</span>
      </header>
      <p className="mt-2.5 text-sm leading-relaxed text-[#c3cdd2]">{review.text}</p>
      <footer className="mt-3 font-mono text-[10px] tracking-[0.08em] text-[#56656f] uppercase">
        {review.helpful} found this helpful · {review.funny} found this funny
      </footer>
    </article>
  );
}

export default function NotFound() {
  return (
    <div className="min-h-screen bg-[#0c1116] text-[#eef2f4]">
      <Nav variant="banded" />

      <div className="bg-[linear-gradient(115deg,#2a1206_0%,#0c1116_62%)]">
        <div className="mx-auto grid max-w-[1320px] gap-10 px-6 pt-12 pb-10 sm:px-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:items-center lg:pt-16">
          <div>
            <p className="font-mono text-[10px] tracking-[0.14em] text-[#7d919c] uppercase">
              error · http 404 · app id not found
            </p>
            <h1 className="mt-3 text-[clamp(96px,18vw,220px)] leading-[0.85] font-black tracking-tighter">
              <span className="glitch-404 bg-gradient-to-r from-brand-blue to-brand-red bg-clip-text text-transparent" data-text="404">
                404
              </span>
            </h1>
            <p className="mt-4 text-3xl font-black tracking-tight sm:text-4xl">Overwhelmingly Not Found</p>
            <div className="mt-4 flex flex-wrap items-baseline gap-x-2 text-sm">
              <span className="text-[#7d919c]">All Reviews:</span>
              <span className="font-bold text-[var(--status-critical)]">Very Negative</span>
              <span className="font-mono text-xs text-[#7d919c]">(0% of 404 reviews are positive)</span>
            </div>
            <p className="mt-5 max-w-[46ch] border-l-[3px] border-brand-blue pl-4 text-[#a9b6bd]">
              This page was delisted, never released, or is stuck in Early Access forever. The link you followed
              leads nowhere — but the {""}
              <Link href="/games" className="font-bold text-[#eef2f4] underline decoration-brand-blue underline-offset-4">
                rest of the catalogue
              </Link>{" "}
              is still very much online.
            </p>
            <div className="mt-6 flex flex-wrap gap-2.5">
              <Link
                href="/"
                className="rounded-full bg-gradient-to-r from-brand-blue to-brand-red px-5 py-2.5 font-bold text-black"
              >
                Back to the homepage
              </Link>
              <Link
                href="/charts"
                className="rounded-full border border-[#2a3a46] px-5 py-2.5 font-bold text-[#eef2f4] hover:border-brand-blue"
              >
                Browse the charts
              </Link>
              <Link
                href="/battle"
                className="rounded-full border border-[#2a3a46] px-5 py-2.5 font-bold text-[#eef2f4] hover:border-brand-blue"
              >
                Start a battle
              </Link>
            </div>
          </div>

          <div className="grid gap-3">
            <p className="font-mono text-[10px] tracking-[0.14em] text-[#7d919c] uppercase">
              most helpful reviews · this page
            </p>
            {REVIEWS.map((review) => (
              <ReviewSnippet key={review.text} review={review} />
            ))}
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-[1320px] px-6 py-10 sm:px-8">
        <ReviewBombGame />
      </div>
    </div>
  );
}
