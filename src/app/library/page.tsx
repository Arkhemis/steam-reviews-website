import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { LibraryLookupForm, SteamSignInButton } from "@/components/LibraryLookupForm";
import { Nav } from "@/components/Nav";
import { getSessionSteamId } from "@/lib/auth/currentUser";

export const metadata: Metadata = {
  title: "Your Steam library",
  description:
    "Sign in through Steam or paste a profile URL to see how players rate the games you own, your backlog's best and AI summaries of their reviews.",
  alternates: { canonical: "/library" },
};

export const dynamic = "force-dynamic";

const ERRORS: Record<string, string> = {
  "sign-in-failed": "Steam didn't confirm the sign-in. Please try again.",
  "sign-in-unavailable": "Signing in through Steam isn't available right now. You can still look up a public profile.",
  invalid: "That doesn't look like a Steam ID or a Steam profile URL.",
  "not-found": "No Steam profile matches that URL.",
  "steam-unavailable": "Steam didn't answer. Please try again in a minute.",
};

type LibraryPageProps = {
  searchParams: Promise<{ profile?: string; error?: string }>;
};

export default async function LibraryPage({ searchParams }: LibraryPageProps) {
  const { profile, error: errorParam } = await searchParams;

  const error = errorParam && ERRORS[errorParam] ? ERRORS[errorParam] : undefined;
  // Connecté, le lien « My library » mène droit à sa propre bibliothèque ; un
  // message d'erreur, lui, doit rester lisible.
  if (!error) {
    const steamId = await getSessionSteamId();
    if (steamId) redirect(`/library/${steamId}`);
  }

  return (
    <div className="min-h-screen bg-[#0c1116] text-[#eef2f4]">
      <div className="mx-auto max-w-[1320px] px-5 py-8 sm:px-7">
        <Nav active="library" />

        <div className="mx-auto mt-16 max-w-xl">
          <h1 className="text-3xl font-extrabold tracking-tight">Your Steam library, reviewed</h1>
          <p className="mt-2 text-[15px] leading-relaxed text-[#9fb2bd]">
            How players rate the games you own, the best of your backlog, the ones you played far longer than most,
            and AI summaries of what reviewers say about your favourites.
          </p>

          {error && (
            <p role="alert" className="mt-6 rounded-md border border-[var(--status-critical)] px-4 py-3 text-sm text-[#eef2f4]">
              {error}
            </p>
          )}

          <div className="mt-8">
            <SteamSignInButton />
            <p className="mt-2 text-xs text-[#7d919c]">
              Steam only tells us your Steam ID: we never see your password, and there is no account to create. Your
              sign-in lives in a cookie on this browser.
            </p>
          </div>

          <div className="my-8 flex items-center gap-3 font-mono text-[10px] tracking-[0.12em] text-[#5f7481] uppercase">
            <span className="h-px flex-1 bg-[#1e2b36]" />
            or look up any public profile
            <span className="h-px flex-1 bg-[#1e2b36]" />
          </div>

          <LibraryLookupForm defaultValue={profile} />
          <p className="mt-2 text-xs text-[#7d919c]">
            The profile&apos;s game details must be public: Steam → Edit Profile → Privacy Settings → Game details.
          </p>
        </div>
      </div>
    </div>
  );
}
