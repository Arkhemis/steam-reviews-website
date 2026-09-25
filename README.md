# steam-reviews-website

Public website for `steam.reviews` — presenting statistics and analysis built from Steam review data.

## Overview

This is a Next.js-based presentation layer that reads data from the `steam-reviews-analysis` pipeline (a Dagster + dbt project in the sibling directory). The site provides interactive visualizations and insights into Steam game reviews and user sentiment.

## Data Source

The site reads from a PostgreSQL database populated by `steam-reviews-analysis` (`../steam-reviews-analysis`):

- `raw.steam_reviews` — raw review data
- `raw.steam_review_counts` — aggregated counts by game
- `raw.igdb_games` — IGDB game metadata
- `stg_steam_review` — dbt staging model with flattened review data
- `marts.*` — future reporting models (pending upstream development)

## Development

### Prerequisites

- Node.js 20+
- npm

### Getting Started

```bash
# Install dependencies
npm install

# Run the development server
npm run dev

# Open http://localhost:3000 in your browser
```

### Environment variables

Set in `.env.local` for development, and in the container environment in production.

| Variable | Used by | Notes |
|---|---|---|
| `POSTGRES_HOST`, `POSTGRES_PORT`, `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB` | every data page | The database loaded by `steam-reviews-analysis`. |
| `STEAM_API_KEY` | `/library` | Steam Web API key from https://steamcommunity.com/dev/apikey (domain: `steam.reviews`). Reads a player's profile and owned games, and resolves custom profile URLs. |
| `SESSION_SECRET` | Sign in through Steam | At least 32 random characters (`openssl rand -hex 32`). Signs the session cookie; changing it signs everyone out. Without it, sign-in is disabled but profile lookup still works. |
| `AUTH_ORIGIN` | Sign in through Steam | Optional. Overrides the origin sent to Steam as the OpenID realm. Defaults to `https://steam.reviews` in production and to the request origin in development. |

### Steam sign-in and libraries

`/library` shows how players rate the games in a Steam account: a playtime-weighted score, Steam's verdicts across the library, the most played games with their AI review summaries, the best unplayed games, and more. Readers get there two ways:

- **Sign in through Steam** (`/api/auth/steam/login`): Steam OpenID 2.0. The callback (`/api/auth/steam/callback`) sends the whole assertion back to Steam (`check_authentication`) before trusting the SteamID, and checks a state cookie, the `return_to` URL and the nonce age. The session is a signed cookie holding only the SteamID. There is no user table.
- **Profile lookup** (`/api/library/lookup`): a SteamID64, a profile URL or a custom URL. It only works for profiles whose game details are public, which is also true of signed-in readers.

### Testing

```bash
# Run tests with Vitest
npm test

# Build for production
npm run build

# Run production server
npm start
```

### Linting

```bash
npm run lint
```

## Project Structure

- `src/app/` — Next.js App Router pages and layouts
- `src/lib/` — Shared utilities and data access functions
- `src/components/` — Reusable React components
- `public/` — Static assets
- `vitest.config.ts` — Test runner configuration
- `tailwind.config.ts` — Tailwind CSS configuration

## Technology Stack

- **Framework:** Next.js 16 with App Router
- **Language:** TypeScript
- **Styling:** Tailwind CSS
- **Testing:** Vitest + React Testing Library
- **Linting:** ESLint

## Deployment

Deployment target and process TBD.

## License

See LICENSE file (if applicable).
