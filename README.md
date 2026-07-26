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
