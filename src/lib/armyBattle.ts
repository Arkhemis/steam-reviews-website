import type { Fighter, Side } from "@/lib/battle";

// « Battle 2 » : deux armées de pions sur un champ de bataille, levées à partir
// des chiffres de chaque jeu. Le moteur est pur et déterministe — une graine,
// une bataille — pour que le lien partagé rejoue exactement le même combat, et
// pour que la page puisse simuler des dizaines de batailles à l'aveugle et en
// tirer des chances de victoire honnêtes : la bataille affichée n'est qu'un
// tirage parmi d'autres, et elle peut être une surprise.

export const FIELD_W = 960;
export const FIELD_H = 440;

/** Ce que les chiffres d'un jeu donnent comme armée. */
export type ArmySpec = {
  side: Side;
  /** Soldats, d'après le nombre d'avis — en échelle log, cf. `troopsFor`. */
  troops: number;
  /** Points de vie de chaque soldat, d'après le temps de jeu médian. */
  hp: number;
  /** Chance qu'un coup porte : la part d'avis positifs, telle quelle. */
  accuracy: number;
  /** Chance de déserter après chaque coup encaissé, d'après le taux de remboursement. */
  desertion: number;
  /** Cavaliers parmi les soldats, d'après la part de joueurs Steam Deck. */
  riders: number;
};

/**
 * En échelle log : linéaire, les 9,8 M d'avis de Counter-Strike 2 lèveraient
 * 56 fois l'armée de Starfield, et la bataille serait jouée d'avance. Ici
 * chaque facteur dix d'avis ajoute huit soldats : 1 k → 10, 1 M → 34, 10 M → 42.
 */
export function troopsFor(totalReviews: number): number {
  const raw = 10 + 8 * (Math.log10(Math.max(totalReviews, 1)) - 3);
  return Math.round(Math.min(48, Math.max(6, raw)));
}

/** 0 h → 2 PV, 10 h → 5, 150 h → 14, plafonné à 20 : là aussi en log. */
export function hpFor(playtimeMedianMinutes: number): number {
  const hours = Math.max(playtimeMedianMinutes, 0) / 60;
  return Math.round(Math.min(20, 2 + 3 * Math.log2(1 + hours / 10)));
}

/**
 * Un taux de remboursement tient sous 1 % pour neuf jeux sur dix : tel quel,
 * personne ne fuirait jamais. Multiplié par six et tiré à chaque coup encaissé,
 * il se voit — 5 % par coup au 9e décile — sans vider une armée à lui seul.
 */
export function desertionFor(pctRefunded: number): number {
  return Math.min(0.4, Math.max(pctRefunded, 0) * 6);
}

/**
 * La part « portable » de l'armée monte à cheval. La médiane du Deck est à
 * 0,5 % : on la multiplie par dix, jusqu'à 30 % de cavaliers.
 */
export function ridersFor(troops: number, pctSteamDeck: number): number {
  return Math.round(troops * Math.min(0.3, Math.max(pctSteamDeck, 0) * 10));
}

export function raiseArmy(game: Fighter, side: Side): ArmySpec {
  const troops = troopsFor(game.totalReviews);
  return {
    side,
    troops,
    hp: hpFor(game.playtimeMedianMinutes),
    accuracy: Math.max(0.05, game.pctPositive),
    desertion: desertionFor(game.pctRefunded),
    riders: ridersFor(troops, game.pctSteamDeck),
  };
}

// --- Moteur ------------------------------------------------------------------

/** mulberry32 : court, rapide, et assez bon pour lancer des dés de bataille. */
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

/** La graine par défaut d'un duel : la même paire donne toujours la même bataille. */
export function defaultSeed(leftAppId: number, rightAppId: number): number {
  return (Math.imul(leftAppId, 2654435761) ^ Math.imul(rightAppId, 40503)) >>> 0;
}

export type UnitStatus = "alive" | "fleeing" | "dead" | "fled";

export type Unit = {
  id: number;
  side: Side;
  rider: boolean;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  status: UnitStatus;
  cooldown: number;
  target: number;
  /** Tics restants de l'éclair blanc après un coup reçu. */
  flash: number;
};

export type BattleEvent =
  | { type: "hit"; x: number; y: number; side: Side }
  | { type: "miss"; x: number; y: number; side: Side }
  | { type: "kill"; x: number; y: number; side: Side }
  | { type: "flee"; x: number; y: number; side: Side };

export type BattleState = {
  tick: number;
  units: Unit[];
  specs: Record<Side, ArmySpec>;
  random: () => number;
  winner: Side | null;
  over: boolean;
};

const RANGE = 13;
/** En deçà, un soldat quitte la ligne et fond sur sa cible. */
const ENGAGE = 70;
const COOLDOWN = 22;
const FOOT_SPEED = 1.1;
const RIDER_SPEED = 2.3;
const FLEE_SPEED = 1.8;
const SPACING = 15;
const RETARGET_EVERY = 6;
/** Au-delà, la bataille s'arrête et le camp qui a le plus de PV debout gagne. */
export const MAX_TICKS = 4000;

function deploy(spec: ArmySpec, firstId: number): Unit[] {
  const rows = Math.min(spec.troops, 12);
  const gap = FIELD_H / (rows + 1);
  const units: Unit[] = [];
  for (let i = 0; i < spec.troops; i++) {
    const col = Math.floor(i / rows);
    const row = i % rows;
    // Les cavaliers ferment la marche : les derniers levés montent à cheval.
    const rider = i >= spec.troops - spec.riders;
    const depth = 70 + col * 24;
    units.push({
      id: firstId + i,
      side: spec.side,
      rider,
      x: spec.side === "left" ? depth : FIELD_W - depth,
      y: gap * (row + 1) + (col % 2 ? gap / 2 : 0) * 0.5,
      hp: spec.hp,
      maxHp: spec.hp,
      status: "alive",
      cooldown: 0,
      target: -1,
      flash: 0,
    });
  }
  return units;
}

export function createBattle(left: ArmySpec, right: ArmySpec, seed: number): BattleState {
  const units = [...deploy(left, 0), ...deploy(right, left.troops)];
  return { tick: 0, units, specs: { left, right }, random: rng(seed), winner: null, over: false };
}

function fighting(u: Unit): boolean {
  return u.status === "alive";
}

export function standing(state: BattleState, side: Side): number {
  return state.units.filter((u) => u.side === side && fighting(u)).length;
}

function count(state: BattleState, side: Side, status: UnitStatus): number {
  return state.units.filter((u) => u.side === side && u.status === status).length;
}

export type ArmyTally = { standing: number; dead: number; fled: number };

export function tally(state: BattleState, side: Side): ArmyTally {
  return {
    standing: standing(state, side),
    dead: count(state, side, "dead"),
    fled: count(state, side, "fled") + count(state, side, "fleeing"),
  };
}

/** Avance la bataille d'un tic et rend ce qui s'y est passé, pour les effets. */
export function step(state: BattleState): BattleEvent[] {
  if (state.over) return [];
  const events: BattleEvent[] = [];
  const { units, random } = state;
  state.tick++;

  for (const u of units) {
    if (u.flash > 0) u.flash--;

    if (u.status === "fleeing") {
      u.x += u.side === "left" ? -FLEE_SPEED : FLEE_SPEED;
      if (u.x < -12 || u.x > FIELD_W + 12) u.status = "fled";
      continue;
    }
    if (u.status !== "alive") continue;

    let target = u.target >= 0 ? units[u.target] : undefined;
    if (!target || !fighting(target) || state.tick % RETARGET_EVERY === 0) {
      let best = -1;
      let bestDist = Infinity;
      for (const e of units) {
        if (e.side === u.side || !fighting(e)) continue;
        const d = (e.x - u.x) ** 2 + (e.y - u.y) ** 2;
        if (d < bestDist) {
          bestDist = d;
          best = e.id;
        }
      }
      u.target = best;
      target = best >= 0 ? units[best] : undefined;
    }
    if (!target) continue;

    const dx = target.x - u.x;
    const dy = target.y - u.y;
    const dist = Math.hypot(dx, dy);
    if (u.cooldown > 0) u.cooldown--;

    if (dist > RANGE) {
      const speed = u.rider ? RIDER_SPEED : FOOT_SPEED;
      if (dist > ENGAGE) {
        // Loin du front, on marche en ligne : vers sa cible, mais surtout
        // dans l'axe du champ, le pas latéral écrasé au quart. Sans ça, toute
        // l'armée court vers le premier ennemi venu et la bataille se joue
        // dans un seul tas. Toujours vers la cible, jamais « droit devant » :
        // un soldat qui a dépassé les lignes adverses doit faire demi-tour.
        const ly = dy * 0.25;
        const norm = Math.hypot(dx, ly);
        u.x += (dx / norm) * speed;
        u.y += (ly / norm) * speed;
      } else {
        u.x += (dx / dist) * speed;
        u.y += (dy / dist) * speed;
      }
    } else if (u.cooldown === 0) {
      u.cooldown = COOLDOWN;
      if (random() < state.specs[u.side].accuracy) {
        target.hp--;
        target.flash = 5;
        if (target.hp <= 0) {
          target.status = "dead";
          events.push({ type: "kill", x: target.x, y: target.y, side: target.side });
        } else if (random() < state.specs[target.side].desertion) {
          target.status = "fleeing";
          events.push({ type: "flee", x: target.x, y: target.y, side: target.side });
        } else {
          events.push({ type: "hit", x: target.x, y: target.y, side: target.side });
        }
      } else {
        events.push({ type: "miss", x: target.x, y: target.y, side: target.side });
      }
    }
  }

  // Les soldats d'un même camp s'écartent les uns des autres : sans ça, toute
  // l'armée converge sur un seul point et la mêlée devient un pixel.
  for (let i = 0; i < units.length; i++) {
    const a = units[i];
    if (!fighting(a)) continue;
    for (let j = i + 1; j < units.length; j++) {
      const b = units[j];
      if (!fighting(b)) continue;
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const d2 = dx * dx + dy * dy;
      if (d2 >= SPACING * SPACING || d2 === 0) continue;
      const d = Math.sqrt(d2);
      const push = ((SPACING - d) / d) * 0.25;
      a.x -= dx * push;
      a.y -= dy * push;
      b.x += dx * push;
      b.y += dy * push;
    }
    a.x = Math.min(FIELD_W - 6, Math.max(6, a.x));
    a.y = Math.min(FIELD_H - 6, Math.max(6, a.y));
  }

  const left = standing(state, "left");
  const right = standing(state, "right");
  if (left === 0 || right === 0) {
    state.over = true;
    state.winner = left === right ? null : left > 0 ? "left" : "right";
  } else if (state.tick >= MAX_TICKS) {
    // Personne ne tombe : le camp qui a le plus de PV debout tient le terrain.
    const hp = (side: Side) => units.filter((u) => u.side === side && fighting(u)).reduce((s, u) => s + u.hp, 0);
    state.over = true;
    state.winner = hp("left") === hp("right") ? null : hp("left") > hp("right") ? "left" : "right";
  }
  return events;
}

export function simulate(left: ArmySpec, right: ArmySpec, seed: number): BattleState {
  const state = createBattle(left, right, seed);
  while (!state.over) step(state);
  return state;
}

export type Odds = { left: number; right: number; draws: number; runs: number };

/** Les chances de chaque camp sur `runs` batailles aux graines 1 … runs. */
export function odds(left: ArmySpec, right: ArmySpec, runs: number, firstSeed = 1): Odds {
  const result: Odds = { left: 0, right: 0, draws: 0, runs };
  for (let seed = firstSeed; seed < firstSeed + runs; seed++) {
    const { winner } = simulate(left, right, seed);
    if (winner) result[winner]++;
    else result.draws++;
  }
  return result;
}
