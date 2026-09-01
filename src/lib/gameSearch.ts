// Contract shared by the /api/games/search route and the client-side search
// box. It lives outside both so the client bundle never pulls in the route
// handler (and, with it, `pg`).
export type GameSearchHit = {
  appId: number;
  name: string;
  coverUrl: string | null;
  totalReviews: number;
  pctPositive: number;
};

// One or two characters match nearly the whole catalogue: the query would be
// slow and the results useless, so neither side runs it.
export const MIN_QUERY_LENGTH = 2;

export const MAX_SEARCH_RESULTS = 8;
