# Home éditoriale — ce qu'elle lit, ce qui lui manque

La home (`src/app/page.tsx` + `src/components/HomeEditorial.tsx`) est
entièrement dérivée d'agrégats. Ce document liste, bloc par bloc, le modèle
amont qu'elle lit, l'ordre de déploiement que ces lectures imposent, et les
modèles qu'il faudrait encore dans `steam-reviews-analysis`.

Toute fenêtre temporelle est ancrée sur `MAX(review_date)` de
`game_review_trend_daily`, jamais sur `CURRENT_DATE` : le pipeline peut avoir
des jours de retard. Les marts de fenêtre portent leurs bornes (`starts_on`,
`ends_on`), que le site affiche telles quelles.

## Le carrousel de récompenses

Le héros d'un seul jeu a laissé place à un carrousel (`AwardsCarousel`, client
component) : une rangée de puces qui sont de vrais onglets, une diapositive par
récompense. La page serveur fait toutes les lectures ; `@/lib/homeAwards`
choisit les lauréats, applique les règles d'affichage et rédige les chaînes ;
le composant ne fait que rendre et faire défiler.

Ordre de défilement, et ce que lit chaque diapositive :

| # | Récompense | Fonction | Lit | Règle |
| --- | --- | --- | --- | --- |
| 1 | Best of the week | `getTopRatedGamesInWindow("week")` | `game_window_score` (`week`) + `game_stats` | ≥ `WEEK_MIN_REVIEWS` avis, meilleure part positive ; repli sur `month` (≥ `MONTH_MIN_REVIEWS`) si la semaine est vide |
| 1′ | citation du n°1 | `getGameTopReviewInWindow`, puis `getGameTopReviews` | `review_highlight` (+ `created_at`) | meilleure review positive **anglaise** écrite dans la fenêtre ; sinon (aucune, ou colonne absente) la meilleure de toujours |
| 2 | Comeback | `getWindowMovers` | `game_window_score` (`week` ⨝ `previous_week`) | ≥ `MOVER_MIN_REVIEWS` avis chaque semaine, plus forte hausse ; cachée si l'écart n'est pas > 0 |
| 3 | Freefall | idem | idem | plus forte baisse ; cachée si l'écart n'est pas < 0 |
| 4 | Most reviewed | `getWindowRanking("week", "most-reviewed")` | `game_window_score` (`week`) | le plus d'avis sur 7 jours, quel que soit le verdict |
| 5 | Funniest review | `getWindowReviewHighlights("month")` | `review_window_highlight` (`month`/`funny`/`english`) | rang 1 ; cachée sous `REVIEW_MIN_VOTES` votes « funny » |
| 6 | Most helpful review | idem | idem (`helpful`) | premier rang qui n'est pas déjà la plus drôle affichée ; cachée sous `REVIEW_MIN_VOTES` votes « up » |
| 7 | Best of \<année\> | `getTopRatedGamesInWindow("year-to-date")` | `game_window_score` (`year_to_date`) | ≥ `YEAR_MIN_REVIEWS` avis |
| 8 | Most hated | `getWindowRanking("month", "worst")` | `game_window_score` (`month`) | ≥ `HATED_MIN_REVIEWS` avis, plus faible part positive |
| 9 | Hidden gem | `getWindowRanking("month", "best", { maxTotalReviews })` | `game_window_score` (`month`) + `game_stats.total_reviews` | ≥ `HIDDEN_GEM_MIN_REVIEWS` avis sur 30 jours et < `HIDDEN_GEM_MAX_TOTAL_REVIEWS` au total Steam |
| 10 | Nobody agrees | `getPolarisedGames` | `game_stats` | ≥ `POLARISED_MIN_REVIEWS` avis, score le plus proche de 50 % |

Chaque diapositive de jeu prend en fond l'illustration panoramique Steam
(`resolveSteamHeroArt`, cachée par `appId`), avec la jaquette floutée en repli.
Seule l'illustration de la première diapositive est préchargée (`preload`) :
c'est elle que le serveur rend visible, donc elle qui fait le LCP. Les autres
n'entrent dans le DOM qu'une fois montrées, ou quand elles sont la suivante du
défilement.

Défilement : toutes les 8 s ; pause au survol, tant que le focus est dans le
carrousel, et tant que l'onglet du navigateur est masqué ; jamais de
défilement automatique sous `prefers-reduced-motion: reduce`.

### Dégradation

**Une requête qui échoue ou ne rend rien cache sa diapositive, jamais la
page.** Chaque lecture du carrousel passe par `orEmpty()` (`page.tsx`), qui
journalise l'erreur (`[home] … unavailable, hiding it`) et rend la valeur
vide que `buildAwards` sait déjà cacher. `unstable_cache` ne garde pas les
erreurs : la lecture est retentée à la visite suivante, et la diapositive
réapparaît d'elle-même une fois le mart en base. Si aucune récompense ne
survit, le carrousel n'est pas rendu du tout ; bande d'échelle, bandeau de
pouls et portes de sortie tiennent sans lui.

## Les autres blocs

| Bloc | Fonction | Lit | État |
| --- | --- | --- | --- |
| Dauphins (« Runners-up ») | places 2 à 5 du podium de la diapositive 1 | `game_window_score` + `game_stats` | ✅ |
| Courbe de sentiment, barres/jour, compteur de la semaine | `getCatalogueTrend()` + `@/lib/cataloguePulse` | `game_review_trend_daily` | ✅ réel, mais coûteux (cf. plus bas) |
| Compteurs catalogue / langues (bande d'échelle et bandeau de pouls) | `getSiteStats`, `getLanguageReviewScores` | `game_review_trend_daily`, `game_stats`, `language_review_score_global` | ✅ réel, mais `getSiteStats` balaie tout le mart quotidien |

La rubrique « Two more questions » (meilleur de l'année, jeux clivants) a
disparu : ses deux classements sont devenus les diapositives 7 et 10.

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

- **jaquette obligatoire** sur toutes les diapositives de jeu et sur les
  dauphins — une fenêtre courte fait remonter des titres qu'IGDB ne couvre pas
  encore, et le bandeau les affichait sur un cadre vide. Les diapositives de
  review n'y sont pas soumises : c'est la citation qu'elles montrent ;
- **anglais uniquement** pour la citation du n°1 et pour les reviews primées —
  sans filtre de langue, la review la plus utile d'un jeu est souvent chinoise
  ou russe.

## Ordre de déploiement

Les diapositives 1 à 9 et les dauphins lisent des marts ajoutés ou modifiés
par `steam-reviews-analysis` (PR Arkhemis/steam-reviews-analysis#40) :

- `marts.game_window_score` — déjà en prod, mais la fenêtre `previous_week`
  (comeback, chute) est nouvelle ;
- `marts.review_window_highlight` — nouveau (reviews primées) ;
- `marts.review_highlight.created_at` — nouvelle colonne (citation de la
  semaine).

**Matérialiser ces marts en prod avant de déployer le site.** Le déploiement
du site ne rejoue pas dbt. Dans l'ordre inverse rien ne casse — les
diapositives concernées se cachent, la citation retombe sur la meilleure de
toujours — mais la home perd jusqu'à la moitié de son carrousel tant que le
pipeline n'a pas tourné.

## Modèles encore manquants

### 1. `marts.catalogue_review_trend_daily` — pouls du catalogue

`getCatalogueTrend()` agrège aujourd'hui ~365 jours × tous les app_id de
`game_review_trend_daily` à chaque recalcul de cache. Le modèle existe
désormais en amont (une ligne par jour, tous jeux confondus) ; il reste à
remplacer le corps de `getCatalogueTrend()` par un
`SELECT … WHERE review_date >= …` sur lui, sans rien changer au reste.

Ce mart réglerait aussi le compteur d'ouverture : `getSiteStats()` somme
aujourd'hui `total_reviews` sur tout `game_review_trend_daily`, sans filtre de
date, donc un balayage complet à chaque recalcul de cache. Sur le mart agrégé,
la même somme porterait sur quelques milliers de lignes.

### 2. `marts.game_polarisation` — « Nobody agrees »

Aujourd'hui : `ORDER BY ABS(pct_positive_reviews - 50)` sur `game_stats`. Ça
répond à la question « qui est le plus proche de 50 % », qui n'est pas tout à
fait « qui divise le plus » : un jeu à 50 % dont les avis sont tous tièdes
divise moins qu'un jeu à 55 % dont les deux camps s'écrivent des romans.

Un mart pourrait porter un vrai indice de polarisation (écart-type des votes,
part d'avis très longs de chaque bord, part de reviews signalées utiles dans
chaque camp) plutôt qu'une distance à 50 %.

### 3. Artwork large (`igdb_game.artworks` / `screenshots`)

Les diapositives prennent l'illustration `library_hero.jpg` de Steam, que tous
les jeux ne publient pas ; à défaut, la jaquette 2:3 floutée. `stg_igdb_game`
ne remonte que `cover_url` ; IGDB expose `artworks` et `screenshots`, qui
donneraient un repli large et net.

## Seuils

Ils vivent dans `src/app/page.tsx` et font partie des clés de cache. Ils ne
sont pas mesurés sur les données de prod et méritent d'être revus une fois la
page en ligne :

| Constante | Valeur | Rôle |
| --- | --- | --- |
| `WEEK_MIN_REVIEWS` | 100 | plancher du podium hebdomadaire (diapositive 1, dauphins) |
| `MONTH_MIN_REVIEWS` | 500 | plancher du repli à 30 jours |
| `MOVER_MIN_REVIEWS` | 100 | plancher de chacune des deux semaines comparées (comeback, chute) |
| `YEAR_MIN_REVIEWS` | 1 000 | plancher de « Best of \<année\> » |
| `HATED_MIN_REVIEWS` | 500 | plancher de « Most hated » (= `MONTH_MIN_REVIEWS`) |
| `HIDDEN_GEM_MIN_REVIEWS` | 50 | avis minimum sur 30 jours pour « Hidden gem » |
| `HIDDEN_GEM_MAX_TOTAL_REVIEWS` | 2 000 | plafond du total Steam pour « Hidden gem » (strictement inférieur) |
| `POLARISED_MIN_REVIEWS` | 5 000 | plancher de « Nobody agrees » |
| `REVIEW_MIN_VOTES` | 5 | votes « funny » / « up » minimum d'une review primée |

Si une semaine ne sacre personne (pipeline en retard, ou seuil trop haut), la
diapositive 1 bascule d'elle-même sur la fenêtre de 30 jours et le dit dans sa
puce et son kicker.
