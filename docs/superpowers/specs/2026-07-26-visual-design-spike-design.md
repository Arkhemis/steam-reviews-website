# steam.reviews — visual design spike

## Context

`steam-reviews-website` is a bootstrap-phase repo (see `CLAUDE.md`). Before
committing to any data contract or implementation, we ran a visual design
spike (mockups with stubbed data, no real code) to validate the site's look
and page structures. This spec captures the outcome of that spike and the
resulting backlog/dependencies — it is the input to the next planning cycle,
not an implementation plan itself.

Upstream data available today (`steam-reviews-analysis`, live Postgres):
4,049,767 reviews across 53,858 games with at least one review, 170,758
games catalogued via IGDB. No dbt marts exist yet — only `stg_steam_review`
(staging).

## Goal & audience

Public data-viz showcase (target: steam.reviews) aimed at gamers and general
visitors, not a portfolio piece or an internal tool. Priority is visual
impact ("ça claque") as much as analytical depth.

## Decisions made in this spike

- **Front-end stack**: Next.js + React + Tailwind. Server-rendered pages for
  SEO/large data, client components for interactive visuals (map, charts).
- **Visual direction**: "dark neon gamer" — near-black backgrounds
  (`#05050a`–`#14151a`), cyan→purple gradient accents (`#7dffea`→`#b16dff`),
  glowing stat numbers, green/pink for positive/negative signal
  (`#7dffb0`/`#ff7d9e`). Validated against two alternatives (editorial
  data-journalism, maximalist dashboard) — dark neon was the clear winner.
- **Data access path**: the website reads from **dbt marts**, not
  `stg_steam_review` directly. Marts must be built in `steam-reviews-analysis`
  first — this repo does not duplicate transformation logic (per `CLAUDE.md`).
- **Battle mechanic**: data-driven face-off only (no accounts, no write path,
  no community voting). Fully computed from existing aggregates, shareable
  via URL (e.g. `/battle/baldurs-gate-3-vs-starfield`).
- **Hosting**: deferred, not yet decided. Design stays host-agnostic.

## Page structures validated

### Home
Nav → hero (global stat: total reviews/games analyzed + search bar) →
"Ça monte / Ça descend" leaderboard in two columns (game cover, name, %
change, score badge) → feature band with two cards linking to Carte and
Battle.

### Carte (empreinte linguistique)
Real-world map at country granularity, **not** literal reviewer
geolocation — reviews only carry a self-selected Steam `language` field, no
geo data. This is stated explicitly on the page via a disclaimer banner.
Additionally: zoomed inset panels for a short list of known multilingual
countries, showing sub-national linguistic regions:
- Canada (Québec vs. rest of Canada)
- Belgium (Flanders / Wallonia / Brussels)
- Switzerland (Romandie / Deutschschweiz / Ticino)

Toggle between **Global** and **Par jeu** scope. Legend + detailed
ranked list of languages below the map.

**Explicitly out of scope for v1**: sub-national resolution for any country
beyond the three listed above. Rest of the world stays at country level to
avoid taking on a worldwide sub-national boundary dataset.

### Fiche jeu (game detail)
Banner (cover, title, studio, release date, review count, score badge) → KPI
row (score positif, playtime médian, % Steam Deck, % remboursées) → score
evolution chart over time with annotated events (e.g. a controversial patch)
→ mini language panel (links through to Carte, filtered to this game) → top
reviews (best-voted positive and negative) → word cloud section → CTA card
into Battle.

### Nuage de mots (word cloud)
Presented as a section within the fiche jeu. Size = token frequency, color =
simple positive/negative association (correlated via `voted_up` on reviews
containing the token — **not** ML sentiment analysis for v1). Per-language
toggle, since tokenization is already split by language upstream (Steam's
`language` field routes each review to the right tokenizer — no language
detection needed).

### Battle (backlog — visually validated, not scheduled for v1)
Two games side by side (cover, name, score) → auto-computed "winner" banner
→ per-criterion comparative bars (score positif, playtime médian, volume de
reviews, taux de remboursement) → best-voted quote from each side → copyable
share link. Liked in review but explicitly deprioritized by the user to a
later phase.

## Cross-repo dependencies (blocking implementation)

Both live in `steam-reviews-analysis`, not this repo:

1. **dbt marts contract** — aggregates needed: global leaderboards (rising/
   falling), per-game KPIs and score-over-time, language distribution
   (global and per-game, plus the 3-country sub-national breakdown),
   comparison-ready stats for two arbitrary games. Not yet specified in
   detail — next planning cycle should define the exact mart schema.
2. **NLP tokenization asset** — new Dagster asset, per-language tokenization
   routed via the existing `language` field (spaCy tokenizer only, or
   per-language equivalents — jieba/fugashi for CJK — no full linguistic
   pipeline needed for word-frequency use case). Writes token/frequency data
   to a new raw table for dbt to build on. Tracked in
   `steam-reviews-analysis/README.md` Progress checklist. Confirmed at this
   data volume (4M reviews) this is a lightweight CPU task, not a heavy
   compute undertaking.

## Open decisions (still deferred)

- Hosting/deployment target.
- Exact mart schema/column names (next planning cycle).
- Whether Battle and full NLP/sentiment beyond word-frequency ever get
  scheduled — currently backlog, revisit after v1 ships.

## Next step

Move to `writing-plans` for the next sub-project: defining and building the
dbt marts contract in `steam-reviews-analysis`, since the website's data
layer depends on it before any real page can be implemented against live
data.
