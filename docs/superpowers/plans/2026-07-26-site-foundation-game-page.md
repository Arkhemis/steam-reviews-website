# Site Foundation + Game Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Scaffold the Next.js site and build the game detail page (`/games/[appId]`) against mock data shaped exactly like the dbt marts defined in `steam-reviews-analysis/docs/superpowers/plans/2026-07-26-game-marts.md`, so swapping mocks for real Postgres queries later is a single-file change.

**Architecture:** Next.js (App Router, TypeScript, Tailwind). A small data-access module (`src/lib/data/gameData.ts`) exposes four async functions mirroring the four marts; today they read from in-memory fixtures, later they'll run SQL against `marts.*`. Components are split by responsibility: layout/nav, stat tiles, the score-evolution chart, the language distribution panel, and the top-reviews list. Chart components follow the `dataviz` skill's method (form → validated color → mark specs → hover layer), not ad-hoc styling.

**Tech Stack:** Next.js (App Router), TypeScript, Tailwind CSS, pnpm, Vitest + React Testing Library for component tests.

## Global Constraints

- Visual direction is the validated "dark neon" spike (`steam-reviews-website/docs/superpowers/specs/2026-07-26-visual-design-spike-design.md`): near-black page surface, cyan→purple gradient for brand/UI chrome (nav logo, headings, buttons) — **not** for chart data marks.
- Chart/data-mark colors come from the `dataviz` skill's validated reference palette (`references/palette.md`), re-validated against this site's actual dark surface `#05050a` (verified via `node scripts/validate_palette.js` from the skill's directory — all 6 checks pass for the first 6 categorical dark slots, and status colors clear ≥3:1 contrast against `#05050a`). Never introduce a chart color that hasn't been run through that validator.
  - Categorical dark slots (fixed order, never reordered/cycled): 1 blue `#3987e5`, 2 orange `#d95926`, 3 aqua `#199e70`, 4 yellow `#c98500`, 5 magenta `#d55181`, 6 green `#008300`. Beyond 6 languages, fold the remainder into a non-categorical "Autres" bucket in muted gray `#6b6b76` — never generate a 7th/8th hue ad hoc.
  - Sequential/single-series hue: blue `#3987e5` (same as categorical slot 1).
  - Status colors (fixed, reserved, always icon+label): critical `#d03b3b`, warning `#fab219`, good `#0ca30c`.
  - Chart chrome: primary ink `#ffffff`, secondary ink `#c3c2b7`, muted `#898781`, gridline `#2c2c2a` (hairline, 1px, solid), chart surface ring/gap color `#05050a` (this site's actual page surface, not the skill's own `#1a1a19` default).
- Mark specs (from `dataviz` skill): lines 2px round join/cap; bars ≤24px thick, 4px rounded data-end, square at baseline; end-markers ≥8px with a 2px surface-color ring; gridlines hairline recessive; a legend is mandatory for ≥2 series and absent for exactly 1 series; text/labels never take the data color, only text tokens.
- Data field names/types must match the marts exactly (see `steam-reviews-analysis`'s marts plan): `game_stats`, `game_review_trends` (grain `app_id`+`period_month`), `game_language_distribution` (grain `app_id`+`language`), `game_top_reviews` (grain `recommendation_id`, top 5 per `app_id`+`voted_up`).
- This plan does not implement Home, Carte, Nuage de mots, or Battle — those are separate future plans. It also does not connect to a real database — that's a follow-up once the marts from the other repo's plan are actually built and running.

---

### Task 1: Scaffold the Next.js project

**Files:**
- Create: entire Next.js project at repo root (`package.json`, `src/app/*`, `tailwind.config.ts`, etc.)

**Interfaces:** none yet — this task produces the project shell other tasks build on.

- [ ] **Step 1: Scaffold into a temp directory (repo root already has `CLAUDE.md`/`docs/`, so scaffold clean then merge)**

```bash
cd /mnt/storage/steam-reviews-website
pnpm create next-app@latest .tmp-scaffold \
  --typescript --tailwind --eslint --app --src-dir \
  --import-alias "@/*" --use-pnpm
```

- [ ] **Step 2: Merge the scaffold into the repo root**

```bash
cd /mnt/storage/steam-reviews-website
shopt -s dotglob
mv .tmp-scaffold/* .
rmdir .tmp-scaffold
```

- [ ] **Step 3: Verify the dev server runs**

```bash
pnpm install
pnpm dev &
sleep 3
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000
kill %1
```

Expected: `200`.

- [ ] **Step 4: Add Vitest + React Testing Library**

```bash
pnpm add -D vitest @vitejs/plugin-react jsdom @testing-library/react @testing-library/jest-dom @testing-library/user-event
```

Create `vitest.config.ts`:

```typescript
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    setupFiles: ["./vitest.setup.ts"],
  },
  resolve: {
    alias: {
      "@": new URL("./src", import.meta.url).pathname,
    },
  },
});
```

Create `vitest.setup.ts`:

```typescript
import "@testing-library/jest-dom/vitest";
```

Add to `package.json` `scripts`:

```json
"test": "vitest run"
```

- [ ] **Step 5: Verify the test runner works with a throwaway smoke test**

Create `src/lib/__smoke__.test.ts`:

```typescript
import { describe, expect, it } from "vitest";

describe("smoke", () => {
  it("runs", () => {
    expect(1 + 1).toBe(2);
  });
});
```

Run: `pnpm test`
Expected: PASS (1 test). Then delete `src/lib/__smoke__.test.ts` — it was only to confirm the runner works.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: scaffold Next.js site (App Router, TypeScript, Tailwind, Vitest)"
```

---

### Task 2: Design tokens (brand chrome + validated chart palette)

**Files:**
- Modify: `src/app/globals.css`
- Modify: `tailwind.config.ts`

**Interfaces:**
- Produces: Tailwind theme colors `brand-bg`, `brand-glow`, `brand-cyan`, `brand-purple` (UI chrome only) and CSS custom properties `--series-1` … `--series-6`, `--status-critical`, `--status-warning`, `--status-good`, `--ink-primary`, `--ink-secondary`, `--ink-muted`, `--gridline` (chart data marks only — consumed by Task 5/6/7 components).

- [ ] **Step 1: Add chart-token CSS custom properties**

In `src/app/globals.css`, add at the top (after Tailwind's `@import`/directives):

```css
:root {
  /* Chart data-mark tokens — validated via the dataviz skill's palette validator
     against this site's surface (#05050a). Never hand-edit without re-validating. */
  --series-1: #3987e5; /* blue */
  --series-2: #d95926; /* orange */
  --series-3: #199e70; /* aqua */
  --series-4: #c98500; /* yellow */
  --series-5: #d55181; /* magenta */
  --series-6: #008300; /* green */
  --series-fallback: #6b6b76; /* "Autres" bucket — not a categorical identity */

  --status-critical: #d03b3b;
  --status-warning: #fab219;
  --status-good: #0ca30c;

  --ink-primary: #ffffff;
  --ink-secondary: #c3c2b7;
  --ink-muted: #898781;
  --gridline: #2c2c2a;
  --chart-surface: #05050a;
}
```

- [ ] **Step 2: Extend Tailwind theme with brand (UI-only) colors**

In `tailwind.config.ts`, inside `theme.extend.colors`, add:

```typescript
      brand: {
        bg: "#05050a",
        glow: "#1a0b2e",
        cyan: "#7dffea",
        purple: "#b16dff",
      },
```

- [ ] **Step 3: Verify the build still compiles**

Run: `pnpm build`
Expected: build succeeds with no type/lint errors.

- [ ] **Step 4: Commit**

```bash
git add src/app/globals.css tailwind.config.ts
git commit -m "feat: add design tokens (brand chrome + validated chart palette)"
```

---

### Task 3: Domain types + mock data layer

**Files:**
- Create: `src/lib/data/types.ts`
- Create: `src/lib/data/fixtures/baldursGate3.ts`
- Create: `src/lib/data/gameData.ts`
- Test: `src/lib/data/gameData.test.ts`

**Interfaces:**
- Produces:
  - Types: `GameStats`, `GameReviewTrend`, `GameLanguageDistribution`, `GameTopReview` (exact shapes below).
  - Functions: `getGameStats(appId: number): Promise<GameStats | null>`, `getGameReviewTrends(appId: number): Promise<GameReviewTrend[]>`, `getGameLanguageDistribution(appId: number): Promise<GameLanguageDistribution[]>`, `getGameTopReviews(appId: number): Promise<GameTopReview[]>`.

- [ ] **Step 1: Write the failing test**

Create `src/lib/data/gameData.test.ts`:

```typescript
import { describe, expect, it } from "vitest";
import {
  getGameLanguageDistribution,
  getGameReviewTrends,
  getGameStats,
  getGameTopReviews,
} from "@/lib/data/gameData";

const BALDURS_GATE_3_APP_ID = 1086940;

describe("gameData", () => {
  it("returns stats for a known game", async () => {
    const stats = await getGameStats(BALDURS_GATE_3_APP_ID);
    expect(stats).not.toBeNull();
    expect(stats?.name).toBe("Baldur's Gate 3");
  });

  it("returns null stats for an unknown game", async () => {
    const stats = await getGameStats(999999999);
    expect(stats).toBeNull();
  });

  it("returns review trends ordered by period", async () => {
    const trends = await getGameReviewTrends(BALDURS_GATE_3_APP_ID);
    expect(trends.length).toBeGreaterThan(0);
    const months = trends.map((t) => t.periodMonth);
    expect(months).toEqual([...months].sort());
  });

  it("returns language distribution summing close to 1", async () => {
    const languages = await getGameLanguageDistribution(BALDURS_GATE_3_APP_ID);
    expect(languages.length).toBeGreaterThan(0);
    const total = languages.reduce((sum, l) => sum + l.pctOfTotal, 0);
    expect(total).toBeCloseTo(1, 1);
  });

  it("returns at most 5 top reviews per voted_up side", async () => {
    const reviews = await getGameTopReviews(BALDURS_GATE_3_APP_ID);
    const positiveCount = reviews.filter((r) => r.votedUp).length;
    const negativeCount = reviews.filter((r) => !r.votedUp).length;
    expect(positiveCount).toBeLessThanOrEqual(5);
    expect(negativeCount).toBeLessThanOrEqual(5);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm test src/lib/data/gameData.test.ts`
Expected: FAIL — `Cannot find module '@/lib/data/gameData'`.

- [ ] **Step 3: Write the types**

Create `src/lib/data/types.ts`:

```typescript
export type GameStats = {
  appId: number;
  name: string;
  genres: string[];
  developers: string[];
  publishers: string[];
  coverUrl: string | null;
  firstReleaseDate: string | null;
  totalReviews: number;
  totalPositive: number;
  totalNegative: number;
  reviewScore: number;
  reviewScoreDesc: string;
  pctPositive: number;
  collectedReviewCount: number;
  playtimeMedianMinutes: number;
  pctSteamDeck: number;
  pctRefunded: number;
};

export type GameReviewTrend = {
  appId: number;
  periodMonth: string; // ISO date, first of month, e.g. "2023-09-01"
  reviewsInPeriod: number;
  positiveInPeriod: number;
  pctPositivePeriod: number;
  annotation?: string; // optional callout, e.g. "Patch controversé"
};

export type GameLanguageDistribution = {
  appId: number;
  language: string;
  reviewCount: number;
  pctOfTotal: number;
};

export type GameTopReview = {
  recommendationId: number;
  appId: number;
  reviewText: string;
  language: string;
  votedUp: boolean;
  votesUp: number;
  weightedVoteScore: number;
  authorPlaytimeAtReviewMinutes: number;
  rankInGame: number;
};
```

- [ ] **Step 4: Write the fixture**

Create `src/lib/data/fixtures/baldursGate3.ts`:

```typescript
import type {
  GameLanguageDistribution,
  GameReviewTrend,
  GameStats,
  GameTopReview,
} from "@/lib/data/types";

export const BALDURS_GATE_3_APP_ID = 1086940;

export const baldursGate3Stats: GameStats = {
  appId: BALDURS_GATE_3_APP_ID,
  name: "Baldur's Gate 3",
  genres: ["Role-playing (RPG)", "Strategy", "Turn-based strategy (TBS)"],
  developers: ["Larian Studios"],
  publishers: ["Larian Studios"],
  coverUrl: "https://images.igdb.com/igdb/image/upload/t_cover_big/co670h.jpg",
  firstReleaseDate: "2023-08-03",
  totalReviews: 87412,
  totalPositive: 84790,
  totalNegative: 2622,
  reviewScore: 9,
  reviewScoreDesc: "Extrêmement positif",
  pctPositive: 0.97,
  collectedReviewCount: 87412,
  playtimeMedianMinutes: 3720,
  pctSteamDeck: 0.18,
  pctRefunded: 0.031,
};

export const baldursGate3ReviewTrends: GameReviewTrend[] = [
  { appId: BALDURS_GATE_3_APP_ID, periodMonth: "2023-08-01", reviewsInPeriod: 21000, positiveInPeriod: 18900, pctPositivePeriod: 0.9 },
  { appId: BALDURS_GATE_3_APP_ID, periodMonth: "2023-09-01", reviewsInPeriod: 15000, positiveInPeriod: 13650, pctPositivePeriod: 0.91 },
  { appId: BALDURS_GATE_3_APP_ID, periodMonth: "2023-10-01", reviewsInPeriod: 9000, positiveInPeriod: 7830, pctPositivePeriod: 0.87 },
  {
    appId: BALDURS_GATE_3_APP_ID,
    periodMonth: "2023-11-01",
    reviewsInPeriod: 7000,
    positiveInPeriod: 3500,
    pctPositivePeriod: 0.5,
    annotation: "Patch controversé",
  },
  { appId: BALDURS_GATE_3_APP_ID, periodMonth: "2023-12-01", reviewsInPeriod: 6500, positiveInPeriod: 5525, pctPositivePeriod: 0.85 },
  { appId: BALDURS_GATE_3_APP_ID, periodMonth: "2024-01-01", reviewsInPeriod: 5000, positiveInPeriod: 4500, pctPositivePeriod: 0.9 },
  { appId: BALDURS_GATE_3_APP_ID, periodMonth: "2024-02-01", reviewsInPeriod: 4200, positiveInPeriod: 3948, pctPositivePeriod: 0.94 },
  { appId: BALDURS_GATE_3_APP_ID, periodMonth: "2024-03-01", reviewsInPeriod: 3900, positiveInPeriod: 3705, pctPositivePeriod: 0.95 },
  { appId: BALDURS_GATE_3_APP_ID, periodMonth: "2024-04-01", reviewsInPeriod: 3600, positiveInPeriod: 3492, pctPositivePeriod: 0.97 },
  { appId: BALDURS_GATE_3_APP_ID, periodMonth: "2024-05-01", reviewsInPeriod: 3400, positiveInPeriod: 3298, pctPositivePeriod: 0.97 },
  { appId: BALDURS_GATE_3_APP_ID, periodMonth: "2024-06-01", reviewsInPeriod: 3100, positiveInPeriod: 3007, pctPositivePeriod: 0.97 },
  { appId: BALDURS_GATE_3_APP_ID, periodMonth: "2024-07-01", reviewsInPeriod: 2900, positiveInPeriod: 2842, pctPositivePeriod: 0.98 },
];

export const baldursGate3LanguageDistribution: GameLanguageDistribution[] = [
  { appId: BALDURS_GATE_3_APP_ID, language: "english", reviewCount: 45454, pctOfTotal: 0.52 },
  { appId: BALDURS_GATE_3_APP_ID, language: "schinese", reviewCount: 12238, pctOfTotal: 0.14 },
  { appId: BALDURS_GATE_3_APP_ID, language: "french", reviewCount: 7867, pctOfTotal: 0.09 },
  { appId: BALDURS_GATE_3_APP_ID, language: "german", reviewCount: 6119, pctOfTotal: 0.07 },
  { appId: BALDURS_GATE_3_APP_ID, language: "russian", reviewCount: 5245, pctOfTotal: 0.06 },
  { appId: BALDURS_GATE_3_APP_ID, language: "brazilian", reviewCount: 3496, pctOfTotal: 0.04 },
  { appId: BALDURS_GATE_3_APP_ID, language: "spanish", reviewCount: 2622, pctOfTotal: 0.03 },
  { appId: BALDURS_GATE_3_APP_ID, language: "polish", reviewCount: 1748, pctOfTotal: 0.02 },
  { appId: BALDURS_GATE_3_APP_ID, language: "japanese", reviewCount: 1748, pctOfTotal: 0.02 },
  { appId: BALDURS_GATE_3_APP_ID, language: "italian", reviewCount: 875, pctOfTotal: 0.01 },
];

export const baldursGate3TopReviews: GameTopReview[] = [
  {
    recommendationId: 1,
    appId: BALDURS_GATE_3_APP_ID,
    reviewText:
      "140 heures et je n'ai même pas fini l'acte 2. Chaque quête a l'air d'avoir été écrite par quelqu'un qui l'aime vraiment.",
    language: "french",
    votedUp: true,
    votesUp: 2481,
    weightedVoteScore: 0.98,
    authorPlaytimeAtReviewMinutes: 20820,
    rankInGame: 1,
  },
  {
    recommendationId: 2,
    appId: BALDURS_GATE_3_APP_ID,
    reviewText: "Mon perso est resté bloqué dans le décor pendant 3h après le patch 5. Génial le jeu sinon.",
    language: "french",
    votedUp: false,
    votesUp: 892,
    weightedVoteScore: 0.91,
    authorPlaytimeAtReviewMinutes: 3720,
    rankInGame: 1,
  },
];
```

- [ ] **Step 5: Write the data-access module**

Create `src/lib/data/gameData.ts`:

```typescript
import {
  BALDURS_GATE_3_APP_ID,
  baldursGate3LanguageDistribution,
  baldursGate3ReviewTrends,
  baldursGate3Stats,
  baldursGate3TopReviews,
} from "@/lib/data/fixtures/baldursGate3";
import type {
  GameLanguageDistribution,
  GameReviewTrend,
  GameStats,
  GameTopReview,
} from "@/lib/data/types";

// TODO(future plan): once `marts.game_stats` etc. exist, replace these
// in-memory lookups with SQL queries against Postgres. The function
// signatures below are the contract the rest of the app depends on.

const STATS_BY_APP_ID: Record<number, GameStats> = {
  [BALDURS_GATE_3_APP_ID]: baldursGate3Stats,
};

const TRENDS_BY_APP_ID: Record<number, GameReviewTrend[]> = {
  [BALDURS_GATE_3_APP_ID]: baldursGate3ReviewTrends,
};

const LANGUAGES_BY_APP_ID: Record<number, GameLanguageDistribution[]> = {
  [BALDURS_GATE_3_APP_ID]: baldursGate3LanguageDistribution,
};

const TOP_REVIEWS_BY_APP_ID: Record<number, GameTopReview[]> = {
  [BALDURS_GATE_3_APP_ID]: baldursGate3TopReviews,
};

export async function getGameStats(appId: number): Promise<GameStats | null> {
  return STATS_BY_APP_ID[appId] ?? null;
}

export async function getGameReviewTrends(appId: number): Promise<GameReviewTrend[]> {
  return TRENDS_BY_APP_ID[appId] ?? [];
}

export async function getGameLanguageDistribution(appId: number): Promise<GameLanguageDistribution[]> {
  return LANGUAGES_BY_APP_ID[appId] ?? [];
}

export async function getGameTopReviews(appId: number): Promise<GameTopReview[]> {
  return TOP_REVIEWS_BY_APP_ID[appId] ?? [];
}
```

- [ ] **Step 6: Run the test to verify it passes**

Run: `pnpm test src/lib/data/gameData.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 7: Commit**

```bash
git add src/lib/data
git commit -m "feat: add game data types, fixtures, and mock data-access layer"
```

---

### Task 4: Nav component

**Files:**
- Create: `src/components/Nav.tsx`
- Test: `src/components/Nav.test.tsx`

**Interfaces:**
- Produces: `Nav` component (no props), rendering brand logo + links (Jeux, Classements, Carte, Battle).

- [ ] **Step 1: Write the failing test**

Create `src/components/Nav.test.tsx`:

```typescript
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Nav } from "@/components/Nav";

describe("Nav", () => {
  it("renders the brand name and nav links", () => {
    render(<Nav />);
    expect(screen.getByText("steam.reviews")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Battle" })).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm test src/components/Nav.test.tsx`
Expected: FAIL — `Cannot find module '@/components/Nav'`.

- [ ] **Step 3: Write the component**

Create `src/components/Nav.tsx`:

```tsx
import Link from "next/link";

export function Nav() {
  return (
    <nav className="flex items-center justify-between py-3">
      <span className="bg-gradient-to-r from-brand-cyan to-brand-purple bg-clip-text text-lg font-black text-transparent">
        steam.reviews
      </span>
      <div className="flex items-center gap-5 text-sm text-neutral-300">
        <Link href="/games">Jeux</Link>
        <Link href="/classements">Classements</Link>
        <Link href="/carte">Carte</Link>
        <Link
          href="/battle"
          className="rounded-full bg-gradient-to-r from-brand-cyan to-brand-purple px-3 py-1 font-bold text-black"
        >
          Battle
        </Link>
      </div>
    </nav>
  );
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm test src/components/Nav.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/Nav.tsx src/components/Nav.test.tsx
git commit -m "feat: add Nav component"
```

---

### Task 5: Stat tile / KPI row

**Files:**
- Create: `src/components/StatTile.tsx`
- Test: `src/components/StatTile.test.tsx`

**Interfaces:**
- Produces: `StatTile({ label: string, value: string }): JSX.Element`. Follows the `dataviz` skill's stat-tile contract: label in sentence case (no trailing colon), value in the system sans, proportional (not tabular) figures.

- [ ] **Step 1: Write the failing test**

Create `src/components/StatTile.test.tsx`:

```typescript
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { StatTile } from "@/components/StatTile";

describe("StatTile", () => {
  it("renders the label and value", () => {
    render(<StatTile label="Score positif" value="97%" />);
    expect(screen.getByText("97%")).toBeInTheDocument();
    expect(screen.getByText("Score positif")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm test src/components/StatTile.test.tsx`
Expected: FAIL — `Cannot find module '@/components/StatTile'`.

- [ ] **Step 3: Write the component**

Create `src/components/StatTile.tsx`:

```tsx
type StatTileProps = {
  label: string;
  value: string;
};

export function StatTile({ label, value }: StatTileProps) {
  return (
    <div className="rounded-lg border border-white/10 bg-white/5 px-4 py-3">
      <div className="text-xl font-extrabold text-white">{value}</div>
      <div className="text-[0.65rem] uppercase tracking-wide text-neutral-400">{label}</div>
    </div>
  );
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm test src/components/StatTile.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/StatTile.tsx src/components/StatTile.test.tsx
git commit -m "feat: add StatTile component"
```

---

### Task 6: Score evolution chart

**Files:**
- Create: `src/components/ScoreEvolutionChart.tsx`
- Test: `src/components/ScoreEvolutionChart.test.tsx`

**Interfaces:**
- Consumes: `GameReviewTrend[]` (Task 3).
- Produces: `ScoreEvolutionChart({ trends: GameReviewTrend[] }): JSX.Element` — client component (needs pointer state for the hover crosshair).

Single series → sequential hue (`--series-1`, blue), no legend box (title names the series), 2px line, hairline gridlines, ≥8px end-marker with a 2px surface-color ring, crosshair + tooltip on hover, and a status-critical annotation (icon + label) on any point carrying an `annotation` field.

- [ ] **Step 1: Write the failing test**

Create `src/components/ScoreEvolutionChart.test.tsx`:

```typescript
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ScoreEvolutionChart } from "@/components/ScoreEvolutionChart";
import type { GameReviewTrend } from "@/lib/data/types";

const trends: GameReviewTrend[] = [
  { appId: 1, periodMonth: "2024-01-01", reviewsInPeriod: 100, positiveInPeriod: 90, pctPositivePeriod: 0.9 },
  {
    appId: 1,
    periodMonth: "2024-02-01",
    reviewsInPeriod: 100,
    positiveInPeriod: 50,
    pctPositivePeriod: 0.5,
    annotation: "Patch controversé",
  },
];

describe("ScoreEvolutionChart", () => {
  it("renders an SVG line chart with the annotation label visible", () => {
    render(<ScoreEvolutionChart trends={trends} />);
    expect(screen.getByRole("img", { name: /évolution du score positif/i })).toBeInTheDocument();
    expect(screen.getByText("Patch controversé")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm test src/components/ScoreEvolutionChart.test.tsx`
Expected: FAIL — `Cannot find module '@/components/ScoreEvolutionChart'`.

- [ ] **Step 3: Write the component**

Create `src/components/ScoreEvolutionChart.tsx`:

```tsx
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
          ⚠ {trends[annotationIndex].annotation}
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
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm test src/components/ScoreEvolutionChart.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/ScoreEvolutionChart.tsx src/components/ScoreEvolutionChart.test.tsx
git commit -m "feat: add ScoreEvolutionChart component"
```

---

### Task 7: Language distribution panel

**Files:**
- Create: `src/components/LanguageDistribution.tsx`
- Test: `src/components/LanguageDistribution.test.tsx`

**Interfaces:**
- Consumes: `GameLanguageDistribution[]` (Task 3).
- Produces: `LanguageDistribution({ languages: GameLanguageDistribution[] }): JSX.Element`.

Categorical color job (identity, ≥2 series → legend mandatory). Colors assigned by a **fixed** language→slot mapping (never by rank within a given game, so "English" is always the same color across every game). Top 6 languages shown as bars; the rest fold into a muted-gray "Autres" bucket. Bars ≤24px thick, 4px rounded data-end.

- [ ] **Step 1: Write the failing test**

Create `src/components/LanguageDistribution.test.tsx`:

```typescript
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { LanguageDistribution } from "@/components/LanguageDistribution";
import type { GameLanguageDistribution } from "@/lib/data/types";

const languages: GameLanguageDistribution[] = [
  { appId: 1, language: "english", reviewCount: 500, pctOfTotal: 0.5 },
  { appId: 1, language: "french", reviewCount: 300, pctOfTotal: 0.3 },
  { appId: 1, language: "german", reviewCount: 200, pctOfTotal: 0.2 },
];

describe("LanguageDistribution", () => {
  it("renders a bar and legend entry per language", () => {
    render(<LanguageDistribution languages={languages} />);
    expect(screen.getByText("english")).toBeInTheDocument();
    expect(screen.getByText("50%")).toBeInTheDocument();
  });

  it("folds languages beyond the top 6 into an Autres bucket", () => {
    const many: GameLanguageDistribution[] = Array.from({ length: 9 }, (_, i) => ({
      appId: 1,
      language: `lang${i}`,
      reviewCount: 10 - i,
      pctOfTotal: (10 - i) / 55,
    }));
    render(<LanguageDistribution languages={many} />);
    expect(screen.getByText("Autres")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm test src/components/LanguageDistribution.test.tsx`
Expected: FAIL — `Cannot find module '@/components/LanguageDistribution'`.

- [ ] **Step 3: Write the component**

Create `src/components/LanguageDistribution.tsx`:

```tsx
"use client";

import { useState } from "react";
import type { GameLanguageDistribution } from "@/lib/data/types";

// Fixed language -> categorical slot mapping. Order never changes: it's the
// CVD-safety mechanism from the dataviz skill's validated palette. A language
// not in this list, or any language past the top 6 by share, folds into the
// muted "Autres" bucket rather than generating a new hue.
const LANGUAGE_SLOT_ORDER = ["english", "schinese", "french", "german", "russian", "brazilian"] as const;

const CATEGORICAL_DARK = ["#3987e5", "#d95926", "#199e70", "#c98500", "#d55181", "#008300"];

function colorForLanguage(language: string): string {
  const index = LANGUAGE_SLOT_ORDER.indexOf(language as (typeof LANGUAGE_SLOT_ORDER)[number]);
  return index === -1 ? "var(--series-fallback)" : CATEGORICAL_DARK[index];
}

type LanguageDistributionProps = {
  languages: GameLanguageDistribution[];
};

export function LanguageDistribution({ languages }: LanguageDistributionProps) {
  const [hovered, setHovered] = useState<string | null>(null);

  const sorted = [...languages].sort((a, b) => b.pctOfTotal - a.pctOfTotal);
  const top = sorted.slice(0, 6);
  const rest = sorted.slice(6);

  const rows =
    rest.length > 0
      ? [
          ...top,
          {
            appId: top[0]?.appId ?? 0,
            language: "Autres",
            reviewCount: rest.reduce((sum, l) => sum + l.reviewCount, 0),
            pctOfTotal: rest.reduce((sum, l) => sum + l.pctOfTotal, 0),
          },
        ]
      : top;

  return (
    <div>
      <div className="mb-3 flex flex-wrap gap-3 text-xs text-neutral-300">
        {rows.map((row) => (
          <span key={row.language} className="flex items-center gap-1.5">
            <span
              className="inline-block h-2.5 w-2.5 rounded-sm"
              style={{ backgroundColor: row.language === "Autres" ? "var(--series-fallback)" : colorForLanguage(row.language) }}
            />
            {row.language}
          </span>
        ))}
      </div>

      <div className="space-y-2">
        {rows.map((row) => (
          <div
            key={row.language}
            className="flex items-center gap-3 text-xs"
            onPointerEnter={() => setHovered(row.language)}
            onPointerLeave={() => setHovered(null)}
            role="group"
            aria-label={`${row.language}: ${Math.round(row.pctOfTotal * 100)}%`}
          >
            <span className="w-24 truncate text-neutral-300">{row.language}</span>
            <div className="h-[10px] flex-1 overflow-hidden rounded-full bg-white/5">
              <div
                className="h-full rounded-full"
                style={{
                  width: `${row.pctOfTotal * 100}%`,
                  maxHeight: 24,
                  backgroundColor: row.language === "Autres" ? "var(--series-fallback)" : colorForLanguage(row.language),
                }}
              />
            </div>
            <span className="w-10 text-right font-semibold text-white">{Math.round(row.pctOfTotal * 100)}%</span>
            {hovered === row.language && (
              <span className="text-neutral-400">{row.reviewCount.toLocaleString("fr-FR")} reviews</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm test src/components/LanguageDistribution.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/LanguageDistribution.tsx src/components/LanguageDistribution.test.tsx
git commit -m "feat: add LanguageDistribution component"
```

---

### Task 8: Top reviews list

**Files:**
- Create: `src/components/TopReviews.tsx`
- Test: `src/components/TopReviews.test.tsx`

**Interfaces:**
- Consumes: `GameTopReview[]` (Task 3).
- Produces: `TopReviews({ reviews: GameTopReview[] }): JSX.Element`.

`votedUp` is state, not series identity — uses status tokens (`--status-good` / `--status-critical`), always paired with an icon + label, never color alone.

- [ ] **Step 1: Write the failing test**

Create `src/components/TopReviews.test.tsx`:

```typescript
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { TopReviews } from "@/components/TopReviews";
import type { GameTopReview } from "@/lib/data/types";

const reviews: GameTopReview[] = [
  {
    recommendationId: 1,
    appId: 1,
    reviewText: "Chef-d'œuvre.",
    language: "french",
    votedUp: true,
    votesUp: 100,
    weightedVoteScore: 0.9,
    authorPlaytimeAtReviewMinutes: 600,
    rankInGame: 1,
  },
  {
    recommendationId: 2,
    appId: 1,
    reviewText: "Trop de bugs.",
    language: "french",
    votedUp: false,
    votesUp: 50,
    weightedVoteScore: 0.5,
    authorPlaytimeAtReviewMinutes: 120,
    rankInGame: 1,
  },
];

describe("TopReviews", () => {
  it("renders each review with its recommendation status", () => {
    render(<TopReviews reviews={reviews} />);
    expect(screen.getByText("Chef-d'œuvre.")).toBeInTheDocument();
    expect(screen.getByText("Recommandé")).toBeInTheDocument();
    expect(screen.getByText("Non recommandé")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm test src/components/TopReviews.test.tsx`
Expected: FAIL — `Cannot find module '@/components/TopReviews'`.

- [ ] **Step 3: Write the component**

Create `src/components/TopReviews.tsx`:

```tsx
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
              {review.votedUp ? "▲ Recommandé" : "▼ Non recommandé"}
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
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm test src/components/TopReviews.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/TopReviews.tsx src/components/TopReviews.test.tsx
git commit -m "feat: add TopReviews component"
```

---

### Task 9: Game page route

**Files:**
- Create: `src/app/games/[appId]/page.tsx`
- Test: `src/app/games/[appId]/page.test.tsx`

**Interfaces:**
- Consumes: `getGameStats`, `getGameReviewTrends`, `getGameLanguageDistribution`, `getGameTopReviews` (Task 3); `Nav` (Task 4); `StatTile` (Task 5); `ScoreEvolutionChart` (Task 6); `LanguageDistribution` (Task 7); `TopReviews` (Task 8).
- Produces: the `/games/[appId]` route.

- [ ] **Step 1: Write the failing test**

Create `src/app/games/[appId]/page.test.tsx`:

```typescript
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import GamePage from "@/app/games/[appId]/page";
import { BALDURS_GATE_3_APP_ID } from "@/lib/data/fixtures/baldursGate3";

describe("GamePage", () => {
  it("renders the game name, KPIs, and reviews for a known app id", async () => {
    const jsx = await GamePage({ params: Promise.resolve({ appId: String(BALDURS_GATE_3_APP_ID) }) });
    render(jsx);

    expect(screen.getByText("Baldur's Gate 3")).toBeInTheDocument();
    expect(screen.getByText("97%")).toBeInTheDocument();
    expect(screen.getByText(/Chaque quête a l'air/)).toBeInTheDocument();
  });

  it("renders a not-found message for an unknown app id", async () => {
    const jsx = await GamePage({ params: Promise.resolve({ appId: "999999999" }) });
    render(jsx);

    expect(screen.getByText(/introuvable/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm test src/app/games/[appId]/page.test.tsx`
Expected: FAIL — `Cannot find module '@/app/games/[appId]/page'`.

- [ ] **Step 3: Write the page**

Create `src/app/games/[appId]/page.tsx`:

```tsx
import Link from "next/link";
import { LanguageDistribution } from "@/components/LanguageDistribution";
import { Nav } from "@/components/Nav";
import { ScoreEvolutionChart } from "@/components/ScoreEvolutionChart";
import { StatTile } from "@/components/StatTile";
import { TopReviews } from "@/components/TopReviews";
import {
  getGameLanguageDistribution,
  getGameReviewTrends,
  getGameStats,
  getGameTopReviews,
} from "@/lib/data/gameData";

type GamePageProps = {
  params: Promise<{ appId: string }>;
};

export default async function GamePage({ params }: GamePageProps) {
  const { appId } = await params;
  const numericAppId = Number(appId);

  const stats = await getGameStats(numericAppId);

  if (!stats) {
    return (
      <main className="mx-auto max-w-4xl px-6 py-8">
        <Nav />
        <p className="mt-12 text-center text-neutral-400">Ce jeu est introuvable.</p>
      </main>
    );
  }

  const [trends, languages, reviews] = await Promise.all([
    getGameReviewTrends(numericAppId),
    getGameLanguageDistribution(numericAppId),
    getGameTopReviews(numericAppId),
  ]);

  return (
    <main className="mx-auto max-w-5xl px-6 py-8">
      <Nav />

      <div className="mt-6 flex items-center gap-5">
        <div
          className="h-32 w-32 flex-shrink-0 rounded-2xl bg-cover bg-center"
          style={stats.coverUrl ? { backgroundImage: `url(${stats.coverUrl})` } : undefined}
        />
        <div>
          <h1 className="text-2xl font-bold text-white">{stats.name}</h1>
          <p className="text-xs text-neutral-400">
            {stats.developers.join(", ")}
            {stats.firstReleaseDate ? ` · Sorti le ${new Date(stats.firstReleaseDate).toLocaleDateString("fr-FR")}` : ""} ·{" "}
            {stats.totalReviews.toLocaleString("fr-FR")} reviews analysées
          </p>
          <div className="mt-2 flex gap-2">
            <span className="rounded-full px-2.5 py-1 text-xs font-bold" style={{ color: "var(--status-good)", backgroundColor: "rgba(12,163,12,0.12)" }}>
              {Math.round(stats.pctPositive * 100)}% positif — {stats.reviewScoreDesc}
            </span>
            {stats.genres[0] && (
              <span className="rounded-full bg-white/10 px-2.5 py-1 text-xs text-neutral-300">{stats.genres[0]}</span>
            )}
          </div>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-4 gap-3">
        <StatTile label="Score positif" value={`${Math.round(stats.pctPositive * 100)}%`} />
        <StatTile label="Playtime médian" value={`${Math.round(stats.playtimeMedianMinutes / 60)}h`} />
        <StatTile label="Reviews Steam Deck" value={`${Math.round(stats.pctSteamDeck * 100)}%`} />
        <StatTile label="Remboursées" value={`${(stats.pctRefunded * 100).toFixed(1)}%`} />
      </div>

      <div className="mt-8 grid grid-cols-[1.4fr_1fr] gap-5">
        <div className="rounded-xl border border-white/10 bg-white/5 p-4">
          <h2 className="mb-2 text-xs uppercase tracking-wide text-neutral-400">Évolution du score positif</h2>
          <ScoreEvolutionChart trends={trends} />
        </div>
        <div className="rounded-xl border border-white/10 bg-white/5 p-4">
          <h2 className="mb-2 text-xs uppercase tracking-wide text-neutral-400">Langues</h2>
          <LanguageDistribution languages={languages} />
          <Link href={`/carte?game=${stats.appId}`} className="mt-2 block text-center text-xs text-brand-cyan">
            Voir sur la carte →
          </Link>
        </div>
      </div>

      <h2 className="mt-8 mb-3 text-xs uppercase tracking-wide text-neutral-400">Reviews les plus votées</h2>
      <TopReviews reviews={reviews} />

      <div className="mt-8 flex items-center justify-between rounded-xl bg-gradient-to-r from-brand-glow via-brand-purple to-brand-cyan p-5">
        <div>
          <h3 className="font-bold text-white">⚔️ Comparer ce jeu</h3>
          <p className="text-xs text-white/80">Voir {stats.name} face à un autre jeu, stat contre stat.</p>
        </div>
        <Link href={`/battle?game=${stats.appId}`} className="rounded-full bg-white px-4 py-2 text-xs font-extrabold text-black">
          Lancer un Battle
        </Link>
      </div>
    </main>
  );
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm test src/app/games/[appId]/page.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 5: Run the full test suite and the dev server as a final sanity check**

```bash
pnpm test
pnpm dev &
sleep 3
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/games/1086940
kill %1
```

Expected: all tests pass; the curl request returns `200`.

- [ ] **Step 6: Commit**

```bash
git add src/app/games
git commit -m "feat: add game detail page route"
```
