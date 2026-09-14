# Home éditoriale — ce qu'elle lit, ce qui lui manque

La home (`src/app/page.tsx` + `src/components/HomeEditorial.tsx`) est
entièrement dérivée d'agrégats. Ce document liste, bloc par bloc, le modèle
amont qu'elle lit aujourd'hui, et le modèle qu'il faudrait dans
`steam-reviews-analysis` pour que le bloc dise exactement ce qu'il promet.

Rappel : les marts existants au moment de l'écriture sont `game_stats`,
`game_review_trend_daily`, `review_highlight`, `game_event_highlight`,
`language_review_score_global` et `game_distinctive_term`. Toute fenêtre
temporelle est ancrée sur `MAX(review_date)` du mart, jamais sur
`CURRENT_DATE` : le pipeline peut avoir des jours de retard.

## Ce qui tourne sur des marts existants

| Bloc | Fonction | Lit | État |
| --- | --- | --- | --- |
| Héros + dauphins | `getTopRatedGamesInWindow("week", …)` | `game_review_trend_daily` + `game_stats` | ✅ réel |
| « Best of \<année\> » | `getTopRatedGamesInWindow("year-to-date", …)` | idem | ✅ réel |
| « Nobody agrees » | `getPolarisedGames()` | `game_stats` | ✅ réel |
| Courbe de sentiment, barres/jour, compteur de la semaine | `getCatalogueTrend()` + `@/lib/cataloguePulse` | `game_review_trend_daily` | ✅ réel, mais coûteux (cf. plus bas) |
| Compteurs catalogue / langues (bande d'échelle et bandeau de pouls) | `getSiteStats`, `getLanguageReviewScores` | `game_review_trend_daily`, `game_stats`, `language_review_score_global` | ✅ réel, mais `getSiteStats` balaie tout le mart quotidien |
| Citation du héros | `getGameTopReviews(appId, { perSide: 1 })` | `review_highlight` | ⚠️ placeholder (cf. `review_of_the_week`) |

Tout est caché par `unstable_cache` pendant 900 s : la home ne déclenche au
plus qu'une passe de chaque requête par quart d'heure.

Le compteur d'ouverture (« 182,431,904 steam reviews collected ») est la
somme des `total_reviews` de `game_review_trend_daily`, qui agrège les lignes
de `steam_review` : c'est le corpus réellement chargé. Surtout pas la somme
des `total_reviews` de `game_stats`, qui est ce que **Steam déclare** pour les
mêmes jeux, avis jamais téléchargés compris — un nombre plus gros, et faux
pour annoncer la taille de la base.

Deux filtres valent d'être connus, parce qu'ils écartent des jeux que les
données contiennent pourtant :

- **jaquette obligatoire** sur les podiums et sur « Nobody agrees » — une
  fenêtre courte fait remonter des titres qu'IGDB ne couvre pas encore, et le
  héros les affichait sur un cadre vide ;
- **citation en anglais uniquement** — sans filtre de langue, la review la plus
  utile d'un jeu est souvent chinoise ou russe. Un jeu dont le mart n'a retenu
  aucune review anglaise passe donc sans citation.

## Modèles manquants, par ordre d'utilité

### 1. `marts.review_of_the_week` — citation du héros *(placeholder en place)*

`review_highlight` ne porte aucune date : impossible d'y demander « la review
la plus utile publiée cette semaine ». La home affiche donc la meilleure
review positive du gagnant, toutes périodes confondues — un texte qui peut
dater de trois ans sous un bandeau « best of last 7 days ». C'est le seul écart
assumé entre ce que la page dit et ce qu'elle montre.

Deux façons de le combler, par ordre de coût :

- ajouter `created_at` (et `timestamp_updated`) aux colonnes remontées par
  `review_highlight` — suffisant, puisque le classement par
  `weighted_vote_score` est déjà fait ;
- ou un mart dédié, une ligne par semaine ISO :
  `week_start`, `app_id`, `recommendation_id`, `review_text`, `language`,
  `voted_up`, `votes_up`, `weighted_vote_score`, `author_*`.

Le site changerait alors `heroQuote()` (`src/app/page.tsx`) pour lire la
semaine plutôt que le jeu.

### 2. `marts.catalogue_review_trend_daily` — pouls du catalogue

`getCatalogueTrend()` agrège aujourd'hui ~365 jours × tous les app_id de
`game_review_trend_daily` à chaque recalcul de cache. Le grain utile est
minuscule : une ligne par jour, tous jeux confondus.

```sql
-- review_date (PK), total_reviews, total_positive, total_negative,
-- pct_positive, games_reviewed
SELECT review_date, SUM(total_reviews), SUM(total_positive), …
FROM {{ ref('game_review_trend_daily') }}
GROUP BY review_date
```

Environ 4 000 lignes pour dix ans d'historique, contre plusieurs millions
balayées aujourd'hui. Le site remplacerait le corps de `getCatalogueTrend()`
par un `SELECT … WHERE review_date >= …`, sans rien changer au reste.

Ce mart réglerait aussi le compteur d'ouverture : `getSiteStats()` somme
aujourd'hui `total_reviews` sur tout `game_review_trend_daily`, sans filtre de
date, donc un balayage complet à chaque recalcul de cache. Sur le mart agrégé,
la même somme porterait sur quelques milliers de lignes — ou sur une seule, si
le modèle expose en plus un total courant.

### 3. `marts.game_window_score` — podiums de fenêtre

Même logique pour `getTopRatedGamesInWindow()` : un modèle pré-agrégé par
(app_id, fenêtre) éviterait de regrouper la table de tendance à chaque
fenêtre demandée.

```sql
-- app_id, window ('week' | 'month' | 'year_to_date'),
-- starts_on, ends_on, total_reviews, total_positive, pct_positive
```

Utile surtout si les podiums se multiplient (semaine dernière, mois dernier,
par genre…). Tant qu'il y en a trois, la requête actuelle suffit.

### 4. `marts.game_polarisation` — « Nobody agrees »

Aujourd'hui : `ORDER BY ABS(pct_positive_reviews - 50)` sur `game_stats`. Ça
répond à la question « qui est le plus proche de 50 % », qui n'est pas tout à
fait « qui divise le plus » : un jeu à 50 % dont les avis sont tous tièdes
divise moins qu'un jeu à 55 % dont les deux camps s'écrivent des romans.

Un mart pourrait porter un vrai indice de polarisation (écart-type des votes,
part d'avis très longs de chaque bord, part de reviews signalées utiles dans
chaque camp) plutôt qu'une distance à 50 %.

### 5. Artwork large (`igdb_game.artworks` / `screenshots`)

Le panneau droit du héros affiche la jaquette 2:3 faute de mieux.
`stg_igdb_game` ne remonte que `cover_url` ; IGDB expose `artworks` et
`screenshots`, qui donneraient une vraie image large pour ce panneau (le
design d'origine visait `library_hero.jpg` côté Steam, non garanti présent et
sur un CDN qu'il faudrait ajouter à `next.config.ts`).

## Seuils de volume

Ils vivent dans `src/app/page.tsx` et font partie des clés de cache. Ils ne
sont pas mesurés sur les données de prod — la base n'était pas joignable à
l'écriture — et méritent d'être revus une fois la page en ligne :

| Constante | Valeur | Rôle |
| --- | --- | --- |
| `WEEK_MIN_REVIEWS` | 100 | plancher du podium hebdomadaire |
| `MONTH_MIN_REVIEWS` | 500 | plancher du repli à 30 jours |
| `YEAR_MIN_REVIEWS` | 1 000 | plancher de « Best of \<année\> » |
| `POLARISED_MIN_REVIEWS` | 5 000 | plancher de « Nobody agrees » |

Si une semaine ne sacre personne (pipeline en retard, ou seuil trop haut), la
page bascule d'elle-même sur la fenêtre de 30 jours et le dit dans son kicker.
