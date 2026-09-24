import type { Fighter, Side } from "@/lib/battle";

// Le battle : un duel au tour par tour, façon RPG. Le joueur prend un camp
// et choisit une attaque à chaque tour ; l'ordinateur joue l'autre. Les chiffres
// de chaque jeu ne décident plus du résultat, ils fixent les stats — PV,
// puissance, critique, esquive, fragilité aux remboursements — et c'est le
// joueur qui en tire (ou non) le meilleur. Le moteur est pur : une graine, les
// mêmes coups, le même duel — ce qui le rend testable.

export type MoveId = "sucks" | "bomb" | "refund" | "patch";

/** Les stats d'un jeu en duel. */
export type DuelStats = {
  maxHp: number;
  /** Dégâts de base d'un coup, d'après la part d'avis positifs. */
  power: number;
  /** Part d'avis positifs, reprise par la précision du Review Bomb. */
  approval: number;
  /** Chance de coup critique, d'après le volume d'avis : la foule pousse. */
  crit: number;
  /** Chance d'esquiver un coup, d'après la part de joueurs Steam Deck. */
  dodge: number;
  /** Chance qu'un Refund Request adverse fasse perdre son tour à ce jeu. */
  refundWeakness: number;
  /** Initiative : le jeu le plus commenté ouvre le duel. */
  initiative: number;
};

/** 0 h → 80 PV, 4 h → 102, 12 h → 124, 60 h → 168, plafonné à 200 : en log. */
export function hpFor(playtimeMedianMinutes: number): number {
  const hours = Math.max(playtimeMedianMinutes, 0) / 60;
  return Math.round(Math.min(200, 80 + 22 * Math.log2(1 + hours / 4)));
}

/** 95 % positif → 31 de puissance, 70 % → 25, 40 % → 18. */
export function powerFor(pctPositive: number): number {
  return Math.round(8 + 24 * Math.min(1, Math.max(pctPositive, 0)));
}

/** 1 k avis → 5 %, 1 M → 11 %, 10 M → 13 %, entre 5 et 20 %. */
export function critFor(totalReviews: number): number {
  const raw = 0.05 + 0.02 * (Math.log10(Math.max(totalReviews, 1)) - 3);
  return Math.min(0.2, Math.max(0.05, raw));
}

/**
 * La médiane du Deck tient à 0,5 % : 3 % d'esquive de base, plus huit fois la
 * part Deck — 7 % à la médiane, 19 % pour un jeu joué à 2 % sur Deck.
 */
export function dodgeFor(pctSteamDeck: number): number {
  return Math.min(0.3, 0.03 + Math.max(pctSteamDeck, 0) * 8);
}

/** 15 % de base, plus trente fois le taux de remboursement : 1 % → 45 %. */
export function refundWeaknessFor(pctRefunded: number): number {
  return Math.min(0.75, 0.15 + Math.max(pctRefunded, 0) * 30);
}

export function duelStats(game: Fighter): DuelStats {
  return {
    maxHp: hpFor(game.playtimeMedianMinutes),
    power: powerFor(game.pctPositive),
    approval: game.pctPositive,
    crit: critFor(game.totalReviews),
    dodge: dodgeFor(game.pctSteamDeck),
    refundWeakness: refundWeaknessFor(game.pctRefunded),
    initiative: game.totalReviews,
  };
}

// --- Coups -------------------------------------------------------------------

/** Multiplicateurs et règles fixes des quatre coups. */
export const SUCKS_ACCURACY = 0.95;
export const BOMB_MULTIPLIER = 1.8;
/** Tours d'attente après un Review Bomb : utilisable un tour sur trois. */
export const BOMB_COOLDOWN = 2;
export const BACKFIRE_MULTIPLIER = 0.6;
export const REFUND_MULTIPLIER = 0.35;
export const PATCH_HEAL = 0.3;
export const PATCHES = 2;
export const CRIT_MULTIPLIER = 1.5;
/** Au-delà, le duel s'arrête et le jeu qui garde la plus grande part de PV gagne. */
export const MAX_TURNS = 80;

/** Précision du Review Bomb : 30 % de base, plus 55 % de la part positive. */
export function bombAccuracy(stats: DuelStats): number {
  return 0.3 + 0.55 * stats.approval;
}

export function opponent(side: Side): Side {
  return side === "left" ? "right" : "left";
}

// --- État --------------------------------------------------------------------

export type DuelState = {
  stats: Record<Side, DuelStats>;
  hp: Record<Side, number>;
  /** À qui de jouer. */
  turn: Side;
  /** Un Refund Request a porté : le prochain tour de ce camp saute. */
  stunned: Record<Side, boolean>;
  /** Tours restants avant de pouvoir relancer un Review Bomb. */
  bombCooldown: Record<Side, number>;
  patches: Record<Side, number>;
  turns: number;
  random: () => number;
  winner: Side | null;
  over: boolean;
};

export type DuelOutcome = "hit" | "crit" | "miss" | "dodge" | "backfire" | "stun" | "heal" | "skip";

/** Ce qu'un tour a produit, pour le texte et les animations. */
export type DuelEvent = {
  actor: Side;
  /** `null` quand le tour a sauté (remboursement en cours). */
  move: MoveId | null;
  outcome: DuelOutcome;
  /** Dégâts infligés à l'adversaire. */
  damage: number;
  /** Dégâts encaissés par l'attaquant lui-même (Review Bomb raté). */
  selfDamage: number;
  heal: number;
  /** Le coup a aussi mis l'adversaire en attente de remboursement. */
  stunned: boolean;
};

/** mulberry32, comme pour les armées de Battle 2. */
export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function createDuel(left: DuelStats, right: DuelStats, seed: number): DuelState {
  return {
    stats: { left, right },
    hp: { left: left.maxHp, right: right.maxHp },
    // Le plus commenté ouvre ; à égalité, la gauche.
    turn: right.initiative > left.initiative ? "right" : "left",
    stunned: { left: false, right: false },
    bombCooldown: { left: 0, right: 0 },
    patches: { left: PATCHES, right: PATCHES },
    turns: 0,
    random: rng(seed),
    winner: null,
    over: false,
  };
}

/** Les coups que le camp peut jouer maintenant. */
export function canUse(state: DuelState, side: Side, move: MoveId): boolean {
  if (move === "bomb") return state.bombCooldown[side] === 0;
  if (move === "patch") return state.patches[side] > 0 && state.hp[side] < state.stats[side].maxHp;
  return true;
}

function roll(state: DuelState, base: number, crit: number): { damage: number; critical: boolean } {
  const critical = state.random() < crit;
  const spread = 0.85 + state.random() * 0.3;
  return { damage: Math.max(1, Math.round(base * spread * (critical ? CRIT_MULTIPLIER : 1))), critical };
}

/**
 * Joue le tour du camp dont c'est le tour. Si ce camp attend un
 * remboursement, le coup est ignoré et le tour saute.
 */
export function takeTurn(state: DuelState, move: MoveId): DuelEvent {
  if (state.over) throw new Error("Le duel est terminé");
  const actor = state.turn;
  const target = opponent(actor);
  const me = state.stats[actor];
  const them = state.stats[target];
  const event: DuelEvent = { actor, move, outcome: "miss", damage: 0, selfDamage: 0, heal: 0, stunned: false };

  if (state.stunned[actor]) {
    state.stunned[actor] = false;
    event.move = null;
    event.outcome = "skip";
  } else {
    if (!canUse(state, actor, move)) throw new Error(`Coup indisponible : ${move}`);

    if (move === "patch") {
      const heal = Math.min(Math.round(me.maxHp * PATCH_HEAL), me.maxHp - state.hp[actor]);
      state.hp[actor] += heal;
      state.patches[actor]--;
      event.outcome = "heal";
      event.heal = heal;
    } else {
      const accuracy = move === "bomb" ? bombAccuracy(me) : SUCKS_ACCURACY;
      if (state.random() >= accuracy) {
        // Un Review Bomb raté retombe sur son auteur.
        if (move === "bomb") {
          const selfDamage = Math.round(me.power * BACKFIRE_MULTIPLIER);
          state.hp[actor] = Math.max(0, state.hp[actor] - selfDamage);
          event.outcome = "backfire";
          event.selfDamage = selfDamage;
        } else {
          event.outcome = "miss";
        }
      } else if (state.random() < them.dodge) {
        event.outcome = "dodge";
      } else {
        const multiplier = move === "bomb" ? BOMB_MULTIPLIER : move === "refund" ? REFUND_MULTIPLIER : 1;
        const { damage, critical } = roll(state, me.power * multiplier, me.crit);
        state.hp[target] = Math.max(0, state.hp[target] - damage);
        event.damage = damage;
        event.outcome = critical ? "crit" : "hit";
        if (move === "refund" && state.random() < them.refundWeakness) {
          state.stunned[target] = true;
          event.stunned = true;
          if (!critical) event.outcome = "stun";
        }
      }
    }
    state.bombCooldown[actor] = move === "bomb" ? BOMB_COOLDOWN : Math.max(0, state.bombCooldown[actor] - 1);
  }

  state.turns++;
  state.turn = target;

  if (state.hp.left === 0 || state.hp.right === 0) {
    state.over = true;
    // Les deux à zéro n'arrive qu'avec un Review Bomb raté : l'auteur tombe.
    state.winner = state.hp.left === state.hp.right ? target : state.hp.left > 0 ? "left" : "right";
  } else if (state.turns >= MAX_TURNS) {
    const share = (s: Side) => state.hp[s] / state.stats[s].maxHp;
    state.over = true;
    state.winner = share("left") === share("right") ? null : share("left") > share("right") ? "left" : "right";
  }
  return event;
}

/**
 * Le coup de l'ordinateur : il se soigne quand il est bas, lance son Review
 * Bomb dès qu'il le peut une fois sur deux, et tente un remboursement quand
 * l'adversaire y est fragile. Rien de brillant — juste assez pour qu'on ne
 * gagne pas en martelant le même bouton.
 */
export function aiMove(state: DuelState): MoveId {
  const side = state.turn;
  const me = state.stats[side];
  const them = state.stats[opponent(side)];
  if (canUse(state, side, "patch") && state.hp[side] / me.maxHp < 0.35 && state.random() < 0.75) return "patch";
  if (canUse(state, side, "bomb") && state.random() < 0.5) return "bomb";
  if (!state.stunned[opponent(side)] && state.random() < 0.1 + them.refundWeakness * 0.5) return "refund";
  return "sucks";
}

// --- Répliques ---------------------------------------------------------------

/** Au-delà, une review ne tient plus dans une bulle ni dans une réplique parlée. */
export const QUOTE_MAX = 120;
const QUOTE_MIN = 20;

/** Une copie mélangée (Fisher-Yates) : chaque duel lance ses répliques dans un ordre neuf. */
export function shuffle<T>(items: readonly T[], random: () => number = Math.random): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** Ce qu'il faut d'une review pour en faire une réplique. */
export type QuoteSource = { reviewText: string; votedUp: boolean; votesFunny: number; votesUp: number };

function cleanText(text: string): string {
  return text
    .replace(/\[[^\]]*\]/g, " ")
    .replace(/https?:\/\/\S+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * La réplique qu'on peut tirer d'une review : elle entière si elle tient sous
 * `max`, sinon sa première phrase si celle-ci y tient, sinon rien — une
 * review coupée en plein milieu ne fait rire personne.
 */
export function quoteText(text: string, max = QUOTE_MAX): string | null {
  const clean = cleanText(text);
  if (clean.length < QUOTE_MIN) return null;
  if (clean.length <= max) return clean;
  // Les ponctuations chinoises et japonaises ferment une phrase sans espace derrière.
  const first = clean.match(/^.+?(?:[.!?](?=\s|$)|[。！？])/u)?.[0];
  return first && first.length >= QUOTE_MIN && first.length <= max ? first : null;
}

/** La part des répliques réservée aux reviews censurées par Steam (« ♥♥♥♥ ») : le battle les rend, c'est le sel du duel. */
export const HEART_SHARE = 0.25;

/**
 * Les répliques d'un camp : les reviews du bon bord qui tiennent en une
 * bulle, les plus drôles d'abord (votes « Funny »), puis les reviews entières
 * avant les premières phrases, puis les plus votées. Un quart des places va
 * d'abord aux reviews à cœurs, quand il y en a.
 */
export function pickQuotes<T extends QuoteSource>(reviews: T[], up: boolean, limit = 8): (T & { text: string })[] {
  const ranked = reviews
    .filter((r) => r.votedUp === up)
    .flatMap((review) => {
      const text = quoteText(review.reviewText);
      return text ? [{ quote: { ...review, text }, whole: text === cleanText(review.reviewText) }] : [];
    })
    .sort(
      (a, b) =>
        b.quote.votesFunny - a.quote.votesFunny || Number(b.whole) - Number(a.whole) || b.quote.votesUp - a.quote.votesUp,
    )
    .map(({ quote }) => quote);
  const hearts = new Set(ranked.filter((quote) => quote.text.includes("♥")).slice(0, Math.round(limit * HEART_SHARE)));
  const others = ranked.filter((quote) => !hearts.has(quote)).slice(0, limit - hearts.size);
  const picked = new Set([...hearts, ...others]);
  return ranked.filter((quote) => picked.has(quote));
}
