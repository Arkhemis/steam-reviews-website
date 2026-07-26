# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project status

This repository is currently empty (bootstrap phase) — no application code,
no framework, no build tooling has been chosen yet. There are no build,
lint, or test commands to run. When code is added, this file should be
updated with the actual commands and architecture.

## Purpose

`steam-reviews-website` is the future public website (target: steam.reviews)
that will present statistics and analysis built from Steam review data. It
is a presentation layer only — it must not reimplement data collection or
transformation logic, which belongs to the sibling project
`steam-reviews-analysis` (`../steam-reviews-analysis`).

## Upstream data source

`steam-reviews-analysis` is a Dagster + dbt pipeline that loads a PostgreSQL
database this site is meant to read from:

- `raw.steam_reviews` — one row per Steam review, raw JSON payload
  (`recommendation_id` PK, `app_id`, `timestamp_created`, `timestamp_updated`).
- `raw.steam_review_counts` — aggregated review counts per `app_id`
  (total/positive/negative, Steam review score).
- `raw.igdb_games` — IGDB game metadata, joined to Steam via `steam_app_id`.
- dbt staging model `stg_steam_review` — flattens the raw review JSON payload
  into typed columns (author info, playtime in minutes, vote counts,
  language, purchase/refund flags, etc.). See
  `../steam-reviews-analysis/dbt/models/staging/steam_review.sql`.
- dbt `marts` models do not exist yet upstream — nothing to build reporting
  queries against beyond staging until they're added.

Before writing any query or data-access code against this schema, check the
current state of `../steam-reviews-analysis` (it's an active, evolving
project) rather than assuming the shape above is still accurate.

## Open decisions

Not yet settled — don't assume any of these without checking with the user:

- Front-end stack/framework.
- Data-access path: direct Postgres reads, a dedicated API, or dbt mart
  exports.
- Hosting/deployment target.
