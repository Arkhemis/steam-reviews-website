"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { type ReactNode, useCallback, useEffect, useRef, useState, useTransition } from "react";
import { BLEEP_MS, DuelAudio, type Sfx } from "@/components/duel/sound";
import { DuelVoices, quoteParts, warmUpVoices } from "@/components/duel/voice";
import { GameSearchCombobox } from "@/components/GameSearchCombobox";
import { battleHref, DEFAULT_OPPONENTS, RIVALRIES, type Side } from "@/lib/battle";
import { splitCensored } from "@/lib/censored";
import {
  aiMove,
  BOMB_MULTIPLIER,
  bombAccuracy,
  canUse,
  createDuel,
  opponent,
  PATCH_HEAL,
  REFUND_MULTIPLIER,
  shuffle,
  takeTurn,
  SUCKS_ACCURACY,
  type DuelEvent,
  type DuelState,
  type DuelStats,
  type MoveId,
} from "@/lib/duel";

// L'arène du battle : le joueur choisit son jeu, l'ordinateur prend l'autre,
// et chacun joue un coup à son tour. Le moteur (`@/lib/duel`) tient l'état ;
// ce composant n'en garde qu'un instantané pour le rendu, et enchaîne les
// tours de l'ordinateur au rythme des animations.

/** Ce que l'arène affiche d'un jeu : sa jaquette, son nom, sa note Steam. */
export type BattleFighter = {
  appId: number;
  name: string;
  coverUrl: string | null;
  pct: number;
  ratingLabel: string;
  ratingColor: string;
  totalReviews: number;
};

export type DuelQuote = { text: string; author: string; hours: number };

export type DuelCorner = {
  fighter: BattleFighter;
  stats: DuelStats;
  /** Les chiffres de Steam derrière chaque stat, déjà formatés. */
  sources: { reviews: string; hours: string; positive: string; refunded: string; deck: string };
  /** Répliques tirées des reviews anglaises les plus votées : fans et haters. */
  cheers: DuelQuote[];
  jeers: DuelQuote[];
};

const SIDE_COLOR: Record<Side, string> = { left: "var(--color-brand-blue)", right: "var(--series-1)" };
/** Le temps d'un tour à l'écran : l'élan, le choc, le chiffre qui s'envole. */
const TURN_MS = 1900;

const MOVE_KEYS: MoveId[] = ["sucks", "bomb", "refund", "patch"];

const MOVE_NAME: Record<MoveId, string> = {
  sucks: "Your Game Sucks",
  bomb: "Review Bomb",
  refund: "Refund Request",
  patch: "Patch Day",
};

type Snapshot = Pick<DuelState, "hp" | "turn" | "stunned" | "bombCooldown" | "patches" | "over" | "winner" | "turns">;

function snapshot(s: DuelState): Snapshot {
  return {
    hp: { ...s.hp },
    turn: s.turn,
    stunned: { ...s.stunned },
    bombCooldown: { ...s.bombCooldown },
    patches: { ...s.patches },
    over: s.over,
    winner: s.winner,
    turns: s.turns,
  };
}

type LogLine = { id: number; actor: Side | null; icon: string; text: ReactNode; quote?: LogQuote };

type Pop = { id: number; side: Side; text: string; tone: "damage" | "crit" | "heal" | "info" };

function prefersReducedMotion(): boolean {
  return typeof window !== "undefined" && (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false);
}

/** Une graine neuve par duel : hors du composant, le tirage n'a rien d'un rendu. */
function freshSeed(): number {
  return (Math.random() * 2 ** 32) >>> 0;
}

const pct = (x: number) => `${Math.round(x * 100)}%`;
const hoursLabel = (h: number) => `${new Intl.NumberFormat("en-US").format(h)}h`;

// --- Pièces d'interface ------------------------------------------------------

function HpBar({ hp, max }: { hp: number; max: number }) {
  const share = max > 0 ? hp / max : 0;
  const color = share > 0.5 ? "#5cc26b" : share > 0.2 ? "#e0b341" : "#d03b3b";
  return (
    <div>
      <div className="relative h-2.5 overflow-hidden rounded-[2px] bg-[#05080b]">
        {/* La traîne blanche rattrape la barre avec retard : on voit le coup encaissé. */}
        <div className="absolute inset-y-0 left-0 bg-white/60 transition-[width] delay-300 duration-700" style={{ width: `${share * 100}%` }} />
        <div className="absolute inset-y-0 left-0 transition-[width,background-color] duration-300" style={{ width: `${share * 100}%`, backgroundColor: color }} />
      </div>
      <div className="mt-1 text-right font-mono text-[11px] text-[#9fb2bd]">
        <span className="text-[#eef2f4]">{hp}</span>/{max} HP
      </div>
    </div>
  );
}

function InfoBox({
  side,
  corner,
  hp,
  role,
  stunned,
  active,
}: {
  side: Side;
  corner: DuelCorner;
  hp: number;
  role: "you" | "cpu";
  stunned: boolean;
  active: boolean;
}) {
  return (
    <div
      className={`w-full max-w-[340px] rounded-md border bg-[#0a0f14]/90 p-3 backdrop-blur transition-shadow ${
        active ? "shadow-[0_0_0_1px_rgba(255,255,255,0.18),0_10px_40px_rgba(0,0,0,0.5)]" : ""
      }`}
      style={{ borderColor: "#1e2b36", borderTopColor: SIDE_COLOR[side], borderTopWidth: 3 }}
    >
      <div className="flex items-baseline justify-between gap-2">
        <span className="font-mono text-[10px] tracking-[0.14em] uppercase" style={{ color: SIDE_COLOR[side] }}>
          {role === "you" ? "you" : "cpu"}
          {active && <span className="ml-1.5 text-[#eef2f4]">· to move</span>}
        </span>
        {stunned && (
          <span className="rounded-[3px] bg-[#d03b3b] px-1.5 py-0.5 font-mono text-[9px] font-bold tracking-[0.1em] text-[#0c1116] uppercase">
            refund pending
          </span>
        )}
      </div>
      <div className="mt-0.5 line-clamp-1 text-[17px] leading-tight font-extrabold tracking-tight">{corner.fighter.name}</div>
      <div className="mt-2">
        <HpBar hp={hp} max={corner.stats.maxHp} />
      </div>
      <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5 font-mono text-[10px] tracking-[0.06em] text-[#7d919c] uppercase">
        <span title={`Crit chance, from ${corner.sources.reviews} reviews`}>crit {pct(corner.stats.crit)}</span>
        <span title={`Dodge chance, from ${corner.sources.deck} Steam Deck share`}>dodge {pct(corner.stats.dodge)}</span>
        <span title={`Chance a Refund Request stuns it, from ${corner.sources.refunded} refunded`}>
          refund risk {pct(corner.stats.refundWeakness)}
        </span>
      </div>
    </div>
  );
}

function Fighter({
  side,
  corner,
  state,
  pops,
  coverRef,
  size,
  bubble,
}: {
  side: Side;
  corner: DuelCorner;
  state: "fighting" | "winner" | "loser";
  pops: Pop[];
  coverRef: React.RefObject<HTMLSpanElement | null>;
  size: "near" | "far";
  bubble?: { id: number; quote: LogQuote; language: string; censored: boolean };
}) {
  return (
    <div className="relative flex flex-col items-center">
      {/* Le joueur, en bas à gauche, parle vers la droite ; l'ordinateur, en haut à droite, vers la gauche. */}
      {bubble && <Bubble key={bubble.id} quote={bubble.quote} language={bubble.language} censored={bubble.censored} placement={size === "near" ? "right" : "left"} />}
      <span
        ref={coverRef}
        className={`relative block aspect-[2/3] overflow-hidden rounded-[4px] bg-white/5 shadow-[0_18px_50px_rgba(0,0,0,0.6)] transition-[filter,transform] duration-500 ${
          size === "near" ? "w-[108px] sm:w-[170px]" : "w-[88px] sm:w-[136px]"
        } ${state === "loser" ? "rotate-[-4deg] grayscale" : ""}`}
        style={{ outline: `2px solid ${state === "winner" ? SIDE_COLOR[side] : "transparent"}`, outlineOffset: 3 }}
      >
        {corner.fighter.coverUrl && <Image src={corner.fighter.coverUrl} alt="" fill sizes="170px" priority className="object-cover" />}
        {state === "winner" && <Image src="/chad.png" alt="" fill sizes="170px" className="animate-chad-blink object-cover" />}
        {state === "loser" && <Image src="/virgin.png" alt="" fill sizes="170px" className="animate-chad-blink object-cover" />}
        {state === "loser" && (
          <span className="animate-battle-ko absolute inset-0 flex items-center justify-center bg-[#0c1116]/55 font-mono text-2xl font-black tracking-[0.1em] text-[#d03b3b] sm:text-4xl">
            K.O.
          </span>
        )}
      </span>
      {/* Le socle : une ellipse de lumière aux couleurs du camp. */}
      <span
        aria-hidden
        className="-mt-3 h-6 w-[150%] rounded-[50%] opacity-70 blur-[2px]"
        style={{ background: `radial-gradient(closest-side, color-mix(in srgb, ${SIDE_COLOR[side]} 55%, transparent), transparent)` }}
      />
      {pops.map((pop) => (
        <span
          key={pop.id}
          className={`animate-duel-pop pointer-events-none absolute top-1/3 left-1/2 font-mono font-black whitespace-nowrap drop-shadow-[0_2px_8px_rgba(0,0,0,0.9)] ${
            pop.tone === "crit" ? "text-3xl text-[#ffd166] sm:text-4xl" : "text-2xl sm:text-3xl"
          }`}
          style={{ color: pop.tone === "heal" ? "#5cc26b" : pop.tone === "info" ? "#eef2f4" : pop.tone === "damage" ? "#ff5a4f" : undefined }}
        >
          {pop.text}
        </span>
      ))}
    </div>
  );
}

function MoveButton({
  move,
  index,
  corner,
  foe,
  cooldown,
  patches,
  disabled,
  onPlay,
}: {
  move: MoveId;
  index: number;
  corner: DuelCorner;
  foe: DuelCorner;
  cooldown: number;
  patches: number;
  disabled: boolean;
  onPlay: (move: MoveId) => void;
}) {
  const { stats } = corner;
  const detail: Record<MoveId, { main: string; hint: string }> = {
    sucks: {
      main: `${stats.power} dmg · ${pct(SUCKS_ACCURACY)} acc`,
      hint: `power from ${corner.sources.positive} positive`,
    },
    bomb: {
      main: `${Math.round(stats.power * BOMB_MULTIPLIER)} dmg · ${pct(bombAccuracy(stats))} acc`,
      hint: cooldown > 0 ? `recharging · ${cooldown} turn${cooldown > 1 ? "s" : ""}` : "a miss blows up in your face",
    },
    refund: {
      main: `${Math.round(stats.power * REFUND_MULTIPLIER)} dmg · ${pct(foe.stats.refundWeakness)} stun`,
      hint: `stun from their ${foe.sources.refunded} refund rate`,
    },
    patch: {
      main: `+${Math.round(stats.maxHp * PATCH_HEAL)} HP`,
      hint: `${patches} patch${patches === 1 ? "" : "es"} left`,
    },
  };
  return (
    <button
      type="button"
      onClick={() => onPlay(move)}
      disabled={disabled}
      className="group relative rounded-md border border-[#24333f] bg-[#0c1116] px-3 py-2.5 text-left transition-colors enabled:hover:border-brand-blue enabled:hover:bg-[#111a21] disabled:opacity-40"
    >
      <span className="absolute top-2 right-2.5 hidden font-mono text-[10px] text-[#5f7481] sm:inline">{index + 1}</span>
      <span className="block text-[15px] leading-tight font-extrabold tracking-tight group-enabled:group-hover:text-brand-blue">
        {MOVE_NAME[move]}
      </span>
      <span className="mt-1 block font-mono text-[11px] text-[#cfdae1]">{detail[move].main}</span>
      <span className="mt-0.5 block font-mono text-[10px] text-[#7d919c]">{detail[move].hint}</span>
    </button>
  );
}

// --- Récit -------------------------------------------------------------------

/**
 * La review qu'un coup brandit. Patch Day lance une review positive du jeu
 * qui joue ; les trois attaques, une négative du jeu visé. Sans review en
 * vedette, une réplique toute faite.
 */
type LogQuote = { text: string; fan: boolean; of: string; author?: string; hours?: number };

const CANNED: Record<MoveId, string> = {
  sucks: "Uninstalled. Best decision of my life.",
  patch: "Bug fixes and performance improvements.",
  bomb: "Mostly Negative. Do not buy.",
  refund: "Played 1.9 hours. Refunded.",
};

/** Seul le soin vient des fans : toute attaque cite un hater de l'adversaire. */
const isFanMove = (move: MoveId) => move === "patch";

/** La réserve où puise un coup : les fans du jeu qui soigne, les haters du jeu visé. */
function quoteKey(move: MoveId, actor: Side): string {
  const fan = isFanMove(move);
  return `${fan ? "cheer" : "jeer"}-${fan ? actor : opponent(actor)}`;
}

/** Les quatre réserves d'un duel, chacune mélangée : l'ordre change à chaque partie. */
function shuffledPools(corners: Record<Side, DuelCorner>): Record<string, DuelQuote[]> {
  return {
    "cheer-left": shuffle(corners.left.cheers),
    "cheer-right": shuffle(corners.right.cheers),
    "jeer-left": shuffle(corners.left.jeers),
    "jeer-right": shuffle(corners.right.jeers),
  };
}

function quoteFor(move: MoveId, actor: Side, corners: Record<Side, DuelCorner>, pool: DuelQuote[], count: number): LogQuote {
  const fan = isFanMove(move);
  const owner = corners[fan ? actor : opponent(actor)];
  const quote = pool.length ? pool[count % pool.length] : undefined;
  return quote
    ? { text: quote.text, fan, of: owner.fighter.name, author: quote.author, hours: quote.hours }
    : { text: CANNED[move], fan, of: owner.fighter.name };
}

/** L'icône d'une ligne du journal : ce que le tour a produit, d'un coup d'œil. */
function eventIcon(event: DuelEvent): string {
  switch (event.outcome) {
    case "skip":
      return "⏳";
    case "heal":
      return "🩹";
    case "backfire":
      return "🤦";
    case "miss":
      return "💨";
    case "dodge":
      return "🎮";
    case "stun":
      return "🧊";
    case "crit":
      return "⚡";
    default:
      return event.move === "bomb" ? "💣" : event.move === "refund" ? "💸" : "👎";
  }
}

/** Les couleurs du journal, les mêmes que les chiffres qui jaillissent des jaquettes. */
const LOG_TONE = { damage: "#ff5a4f", heal: "#5cc26b", crit: "#ffd166", stun: "#66c0f4" } as const;

/** Un fait saillant du journal : dégâts, soin, critique… */
function Key({ color, children }: { color: string; children: ReactNode }) {
  return (
    <span className="font-bold" style={{ color }}>
      {children}
    </span>
  );
}

/** La réplique d'un tour, en prose, ses chiffres et ses noms en couleur. */
function narrate(event: DuelEvent, corners: Record<Side, DuelCorner>): ReactNode {
  const me = corners[event.actor];
  const foe = opponent(event.actor);
  const a = <Key color={SIDE_COLOR[event.actor]}>{me.fighter.name}</Key>;
  const b = <Key color={SIDE_COLOR[foe]}>{corners[foe].fighter.name}</Key>;
  const damage = (n?: number) => <Key color={LOG_TONE.damage}>{n} damage</Key>;

  switch (event.outcome) {
    case "skip":
      return (
        <>
          {a} is still processing refunds and <Key color={LOG_TONE.stun}>loses the turn</Key>.
        </>
      );
    case "heal":
      return (
        <>
          {a} ships a patch: <Key color={LOG_TONE.heal}>+{event.heal} HP</Key>.
        </>
      );
    case "backfire":
      return (
        <>
          The Review Bomb blows up in {a}&apos;s face: {damage(event.selfDamage)} to itself.
        </>
      );
    case "miss":
      return (
        <>
          {a}&apos;s {MOVE_NAME[event.move!]} whiffs. Nobody found that helpful.
        </>
      );
    case "dodge":
      return (
        <>
          {b} sidesteps the {MOVE_NAME[event.move!]}: it was playing on a Steam Deck.
        </>
      );
    default: {
      const crit = event.outcome === "crit" && (
        <>
          <Key color={LOG_TONE.crit}>Critical!</Key> {me.sources.reviews} reviewers roar.{" "}
        </>
      );
      if (event.move === "bomb") {
        return (
          <>
            {crit}
            {a} drops a Review Bomb on {b}: {damage(event.damage)}.
          </>
        );
      }
      if (event.move === "refund") {
        const tail = event.stunned ? (
          <>
            {b} is stuck processing it and <Key color={LOG_TONE.stun}>loses its next turn</Key>.
          </>
        ) : (
          <>{b}&apos;s players keep their copies.</>
        );
        return (
          <>
            {crit}
            {a} files a Refund Request: {damage(event.damage)}. {tail}
          </>
        );
      }
      return (
        <>
          {crit}
          {a} tells {b} its game sucks: {damage(event.damage)}.
        </>
      );
    }
  }
}

function QuoteFooter({ quote }: { quote: LogQuote }) {
  return (
    <span className="mt-1 block font-mono text-[9px] tracking-[0.06em] text-[#5f7481] not-italic uppercase">
      {quote.author
        ? `${quote.fan ? "a fan" : "a hater"} of ${quote.of}, ${hoursLabel(quote.hours ?? 0)} played · ${quote.author}`
        : `${quote.fan ? "the fans" : "the haters"} of ${quote.of}`}
    </span>
  );
}

const graphemes = (text: string) => Array.from(new Intl.Segmenter().segment(text), (s) => s.segment);

/**
 * Le texte d'une review, ses « ♥♥♥♥ » ondulant en arc-en-ciel : rendus en
 * insulte, ou laissés en cœurs quand le joueur a choisi la version censurée.
 */
function CensoredText({ text, language, censored }: { text: string; language: string; censored: boolean }) {
  return splitCensored(text, language).map((segment, i) =>
    segment.censored ? (
      <span key={i} className="font-black not-italic">
        {graphemes(censored ? segment.hearts : segment.text).map((char, j) => (
          <span key={j} className="animate-censor-wave inline-block" style={{ animationDelay: `${j * -0.09}s` }}>
            {char}
          </span>
        ))}
      </span>
    ) : (
      segment.text
    ),
  );
}

/** La bulle : la review lancée, qui jaillit de la jaquette de l'attaquant. */
function Bubble({
  quote,
  placement,
  language,
  censored,
}: {
  quote: LogQuote;
  placement: "right" | "left";
  language: string;
  censored: boolean;
}) {
  const accent = quote.fan ? "#5cc26b" : "#d03b3b";
  return (
    <span
      className={`animate-duel-bubble pointer-events-none absolute z-20 block rounded-[10px] border-2 bg-[#eef2f4] px-3 py-2 text-left text-[12px] leading-snug text-[#0c1116] shadow-[0_12px_40px_rgba(0,0,0,0.6)] max-sm:text-[11px] sm:w-[300px] sm:text-[13px] ${
        // L'ordinateur parle depuis le bas de sa jaquette : plus haut, la bulle couvrirait sa barre de vie.
        placement === "right"
          ? "top-2 left-[calc(100%+14px)] w-[min(260px,52vw)] origin-top-left"
          : "-bottom-10 right-[calc(100%+12px)] w-[min(260px,calc(100vw-256px))] origin-bottom-right"
      }`}
      style={{ borderColor: accent }}
    >
      {/* La pointe de la bulle, tournée vers la jaquette. */}
      <span
        aria-hidden
        className={`absolute h-3 w-3 rotate-45 border-2 bg-[#eef2f4] ${
          placement === "right" ? "top-4 -left-[8px] border-t-0 border-r-0" : "top-3 -right-[8px] border-b-0 border-l-0"
        }`}
        style={{ borderColor: accent }}
      />
      {/* Assez de place pour une réplique entière (120 caractères, `QUOTE_MAX`). */}
      <span className="line-clamp-5 font-semibold italic">
        “<CensoredText text={quote.text} language={language} censored={censored} />”
      </span>
      <span className="mt-1 block font-mono text-[9px] tracking-[0.06em] uppercase" style={{ color: accent }}>
        {quote.fan ? "👍" : "👎"} {quote.author ?? (quote.fan ? "the fans" : "the haters")}
        {quote.author && quote.hours !== undefined ? ` · ${hoursLabel(quote.hours)}` : ""}
      </span>
    </span>
  );
}

// --- Arène -------------------------------------------------------------------

type Props = {
  left: DuelCorner;
  right: DuelCorner;
  /** Langue Steam des reviews lancées : les voix la parlent. */
  language: string;
  /** Langues où les deux jeux ont des reviews en vedette, pour le sélecteur. */
  languages: { key: string; label: string }[];
  /** La langue telle que l'URL l'impose ; absente, elle suit le navigateur et reste hors des liens. */
  langParam?: string;
};

const CHIP =
  "rounded-full border border-[#24333f] bg-[#0a0f14]/80 px-2.5 py-1 font-mono text-[10px] tracking-[0.1em] text-[#9fb2bd] uppercase hover:border-white/30 hover:text-[#eef2f4]";

// D'où vient ce qu'on entend : musique et bruitages sont synthétisés par
// `duel/sound.ts` (aucun fichier tiers), les voix sont celles du système.
function AudioCredits() {
  return (
    // Le panneau s'ancre à la rangée de pastilles, pas au (i) : sur mobile il
    // déborderait de l'arène, qui coupe tout ce qui dépasse.
    <details className="group flex">
      <summary
        aria-label="Audio credits"
        title="Audio credits"
        className="flex h-[22px] w-[22px] cursor-pointer list-none items-center justify-center rounded-full text-[#9fb2bd] hover:text-[#eef2f4] group-open:text-[#eef2f4] [&::-webkit-details-marker]:hidden"
      >
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
          <circle cx="12" cy="12" r="10" />
          <path d="M12 16v-4" />
          <circle cx="12" cy="8" r="0.5" fill="currentColor" />
        </svg>
      </summary>
      <div className="absolute top-7 left-0 w-[min(300px,calc(100vw-64px))] rounded-md border border-[#24333f] bg-[#0a0f14] p-3 text-[11px] leading-relaxed text-[#c6d4df] shadow-lg">
        <p className="mb-1.5 font-mono text-[10px] tracking-[0.1em] text-[#9fb2bd] uppercase">Audio credits</p>
        <dl className="space-y-1.5">
          <div>
            <dt className="font-semibold text-[#eef2f4]">Music &amp; sound effects</dt>
            <dd>
              An original chiptune loop, plus every hit, crit, miss, refund &ldquo;ka-ching&rdquo; and fanfare, all
              synthesized live in your browser with the Web Audio API. No samples, no third-party tracks.
            </dd>
          </div>
          <div>
            <dt className="font-semibold text-[#eef2f4]">Voices</dt>
            <dd>
              Your device&rsquo;s own text-to-speech voices, through the Web Speech API. When it has none for the
              language, Google Translate&rsquo;s speech steps in, re-pitched and run through effects in your browser.
            </dd>
          </div>
          <div>
            <dt className="font-semibold text-[#eef2f4]">Quotes</dt>
            <dd>Real Steam reviews, credited to their authors in the battle log.</dd>
          </div>
        </dl>
      </div>
    </details>
  );
}

export function DuelArena({ left, right, language, languages, langParam }: Props) {
  const router = useRouter();
  const [isNavigating, startNavigation] = useTransition();
  const corners: Record<Side, DuelCorner> = { left, right };

  const duelRef = useRef<DuelState | null>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const nextId = useRef(1);
  /** Reviews déjà lancées par réserve (fans/haters de chaque camp) : on les fait tourner. */
  const quoteCount = useRef<Record<string, number>>({});
  /** Les réserves du duel en cours, mélangées à son lancement. */
  const quotePools = useRef<Record<string, DuelQuote[]>>({});
  const logRef = useRef<HTMLDivElement>(null);
  const coverRefs = { left: useRef<HTMLSpanElement>(null), right: useRef<HTMLSpanElement>(null) };

  const [player, setPlayer] = useState<Side | null>(null);
  const [snap, setSnap] = useState<Snapshot | null>(null);
  const [busy, setBusy] = useState(false);
  // Une manche par clic sur « Play as… » ou Rematch : le premier tour de
  // l'ordinateur en dépend, `player` ne changeant pas d'une revanche à l'autre.
  const [round, setRound] = useState(0);
  const [log, setLog] = useState<LogLine[]>([]);
  const [pops, setPops] = useState<Pop[]>([]);
  const [bubble, setBubble] = useState<{ id: number; side: Side; quote: LogQuote } | null>(null);
  const [copied, setCopied] = useState(false);
  const [muted, setMuted] = useState(false);
  const audioRef = useRef<DuelAudio | null>(null);
  const [voicesOn, setVoicesOn] = useState(true);
  const voicesRef = useRef<DuelVoices | null>(null);
  // Les callbacks du duel lisent ces réglages sans dépendre de leur rendu.
  const speechEnabled = useRef(true);
  const [censoredOn, setCensoredOn] = useState(false);
  const censorship = useRef(false);
  const speechToken = useRef(0);
  /** Change à chaque duel : une suite de tour d'un duel abandonné ne joue plus. */
  const generation = useRef(0);

  const later = useCallback((fn: () => void, ms: number) => {
    timers.current.push(setTimeout(fn, ms));
  }, []);

  useEffect(
    () => () => {
      timers.current.forEach(clearTimeout);
      generation.current++;
      audioRef.current?.dispose();
      voicesRef.current?.cancel();
    },
    [],
  );

  // Chrome charge la liste des voix en différé : on la demande dès l'arrivée.
  useEffect(() => warmUpVoices(() => {}), []);

  const sound = useCallback((sfx: Sfx, delayMs = 0) => audioRef.current?.play(sfx, delayMs), []);

  const pop = useCallback(
    (side: Side, text: string, tone: Pop["tone"]) => {
      const id = nextId.current++;
      setPops((list) => [...list, { id, side, text, tone }]);
      later(() => setPops((list) => list.filter((p) => p.id !== id)), 1200);
    },
    [later],
  );

  const animate = useCallback(
    (event: DuelEvent) => {
      const reduced = prefersReducedMotion();
      const actorEl = coverRefs[event.actor].current;
      const target = opponent(event.actor);
      const targetEl = coverRefs[target].current;
      // L'attaquant prend son élan vers l'adversaire : en diagonale, comme la scène.
      const toward = event.actor === player ? { x: 28, y: -18 } : { x: -28, y: 18 };
      if (!reduced && event.move && event.move !== "patch") {
        actorEl?.animate?.(
          [
            { transform: "translate(0,0)" },
            { transform: `translate(${toward.x}px, ${toward.y}px) scale(1.06)` },
            { transform: "translate(0,0)" },
          ],
          { duration: 420, easing: "ease-in-out" },
        );
      }
      const shake = (el: HTMLSpanElement | null, strong: boolean) => {
        if (reduced || !el) return;
        const d = strong ? 14 : 8;
        el.animate?.(
          [
            { transform: "translateX(0)", filter: "brightness(1)" },
            { transform: `translateX(${-d}px) rotate(-2deg)`, filter: "brightness(2.4) saturate(0.3)" },
            { transform: `translateX(${d * 0.7}px) rotate(1deg)`, filter: "brightness(1.3)" },
            { transform: "translateX(0)", filter: "brightness(1)" },
          ],
          { duration: strong ? 520 : 380, delay: 200, easing: "ease-out" },
        );
      };

      switch (event.outcome) {
        case "hit":
        case "stun":
        case "crit":
          shake(targetEl, event.outcome === "crit" || event.move === "bomb");
          later(() => pop(target, `-${event.damage}`, event.outcome === "crit" ? "crit" : "damage"), 220);
          sound(event.move === "bomb" ? "bomb" : event.move === "refund" ? "refund" : "hit", 200);
          if (event.outcome === "crit") sound("crit", 220);
          if (event.stunned) {
            later(() => pop(target, "REFUND?", "info"), 650);
            sound("stun", 650);
          }
          break;
        case "backfire":
          shake(actorEl, true);
          sound("backfire", 200);
          later(() => pop(event.actor, `-${event.selfDamage}`, "damage"), 220);
          break;
        case "dodge":
          if (!reduced) {
            targetEl?.animate?.(
              [{ transform: "translateX(0)" }, { transform: "translateX(26px) rotate(4deg)" }, { transform: "translateX(0)" }],
              { duration: 420, delay: 150, easing: "ease-out" },
            );
          }
          later(() => pop(target, "DODGED", "info"), 200);
          sound("dodge", 150);
          break;
        case "miss":
          later(() => pop(target, "MISS", "info"), 200);
          sound("miss", 120);
          break;
        case "heal":
          later(() => pop(event.actor, `+${event.heal}`, "heal"), 100);
          sound("heal", 60);
          break;
        case "skip":
          later(() => pop(event.actor, "…", "info"), 100);
          sound("skip", 80);
          break;
      }
    },
    // Les refs des jaquettes sont stables ; seul le camp du joueur oriente l'élan.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [player, pop, later, sound],
  );

  // Joue un tour — celui du joueur ou de l'ordinateur — puis enchaîne. Le tour
  // suivant passe par une ref : un callback ne peut pas s'appeler lui-même.
  const resolveRef = useRef<(move: MoveId) => void>(() => {});
  const resolve = useCallback(
    (move: MoveId) => {
      const duel = duelRef.current;
      if (!duel || duel.over || !player) return;
      const event = takeTurn(duel, move);
      let quote: LogQuote | undefined;
      if (event.move) {
        const key = quoteKey(event.move, event.actor);
        const count = quoteCount.current[key] ?? 0;
        quoteCount.current[key] = count + 1;
        quote = quoteFor(event.move, event.actor, corners, quotePools.current[key] ?? [], count);
      }
      const id = nextId.current++;
      setSnap(snapshot(duel));
      setLog((lines) => [...lines, { id, actor: event.actor, icon: eventIcon(event), text: narrate(event, corners), quote }]);
      setBubble(quote ? { id, side: event.actor, quote } : null);
      animate(event);
      const audio = audioRef.current;
      if (duel.over) {
        audio?.stopMusic(0.6);
        sound(duel.winner === player ? "victory" : "defeat", 750);
      } else {
        audio?.setDanger(duel.hp.left / duel.stats.left.maxHp < 0.3 || duel.hp.right / duel.stats.right.maxHp < 0.3);
      }
      setBusy(true);

      // La review est lue à voix haute. L'ordinateur laisse finir la réplique
      // du joueur (6 s au plus) avant de répondre ; le joueur, lui, reprend la
      // main dès la fin de l'animation, et son coup coupe la voix adverse.
      let speech: Promise<void> = Promise.resolve();
      const voices = voicesRef.current;
      const role = event.actor === player ? "player" : "cpu";
      if (quote && voices && speechEnabled.current) {
        audio?.duck(true);
        // Une voix coupée par la suivante finit elle aussi : seule la dernière rend le volume.
        const token = ++speechToken.current;
        // Les gros mots passent au ralenti ; censurée, la voix s'interrompt sur
        // un bip à la place de chaque série de cœurs.
        const said = voices.speakParts(
          quoteParts(quote.text, language, censorship.current),
          role,
          () => {
            audio?.play("bleep");
            return new Promise((done) => later(done, BLEEP_MS));
          },
        );
        speech = said.then(() => {
          if (token === speechToken.current) audio?.duck(false);
        });
      } else if (quote && censorship.current && splitCensored(quote.text, language).some((s) => s.censored)) {
        // Sans voix, le bip seul marque la censure.
        sound("bleep", 150);
      }
      const gen = generation.current;
      const settled = new Promise<void>((done) => later(done, TURN_MS));
      const cpuNext = !duel.over && (duel.turn !== player || duel.stunned[duel.turn]);
      const listened = cpuNext
        ? Promise.race([speech, new Promise<void>((done) => later(done, TURN_MS + 6000))])
        : Promise.resolve();
      void Promise.all([listened, settled]).then(() => {
        if (gen !== generation.current) return;
        if (duel.over) {
          setBusy(false);
          return;
        }
        // Au tour de l'ordinateur, ou d'un joueur bloqué par un remboursement :
        // le moteur ignore le coup et fait sauter le tour.
        if (duel.turn !== player || duel.stunned[duel.turn]) {
          resolveRef.current(duel.turn === player ? "sucks" : aiMove(duel));
        } else {
          setBusy(false);
        }
      });
    },
    // `corners` change à chaque rendu mais ne dépend que des props.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [player, animate, later, sound, left, right],
  );

  useEffect(() => {
    resolveRef.current = resolve;
  }, [resolve]);

  // Le son démarre au clic sur « Play as… » (ou Rematch) : les navigateurs
  // exigent un geste avant de jouer quoi que ce soit.
  function startSound() {
    let musicOff = muted;
    let voices = voicesOn;
    let censored = censoredOn;
    try {
      censored = window.localStorage.getItem("duel-censored") === "1";
      musicOff = window.localStorage.getItem("duel-music") === "0";
      voices = window.localStorage.getItem("duel-voices") !== "0";
    } catch {
      // Stockage indisponible : on garde l'état courant.
    }
    setVoicesOn(voices);
    speechEnabled.current = voices;
    setCensoredOn(censored);
    censorship.current = censored;
    const cast = (voicesRef.current ??= DuelVoices.supported() ? new DuelVoices() : null);
    cast?.cancel();
    cast?.unlock();
    cast?.recast(language);
    const audio = (audioRef.current ??= new DuelAudio());
    audio.setMusicMuted(musicOff);
    setMuted(musicOff);
    audio.unlock();
    audio.startMusic();
    audio.play("fight", 100);
  }

  // Le bouton ne coupe que la musique : bruitages et voix ont chacun le leur.
  const toggleMute = useCallback(() => {
    setMuted((was) => {
      const next = !was;
      audioRef.current?.setMusicMuted(next);
      try {
        window.localStorage.setItem("duel-music", next ? "0" : "1");
      } catch {
        // Stockage indisponible : le réglage vaut pour cette page seulement.
      }
      return next;
    });
  }, []);

  const toggleVoices = useCallback(() => {
    setVoicesOn((was) => {
      const next = !was;
      speechEnabled.current = next;
      if (!next) voicesRef.current?.cancel();
      try {
        window.localStorage.setItem("duel-voices", next ? "1" : "0");
      } catch {
        // Stockage indisponible : le réglage vaut pour cette page seulement.
      }
      return next;
    });
  }, []);

  const toggleCensored = useCallback(() => {
    setCensoredOn((was) => {
      const next = !was;
      censorship.current = next;
      try {
        window.localStorage.setItem("duel-censored", next ? "1" : "0");
      } catch {
        // Stockage indisponible : le réglage vaut pour cette page seulement.
      }
      return next;
    });
  }, []);

  // « M » coupe ou remet la musique, à tout moment du duel.
  useEffect(() => {
    if (!player) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLElement && e.target.closest("input, textarea")) return;
      if (e.key === "m" || e.key === "M") toggleMute();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [player, toggleMute]);

  function start(side: Side) {
    generation.current++;
    startSound();
    timers.current.forEach(clearTimeout);
    timers.current = [];
    const duel = createDuel(left.stats, right.stats, freshSeed());
    duelRef.current = duel;
    quoteCount.current = {};
    quotePools.current = shuffledPools(corners);
    setPlayer(side);
    setRound((r) => r + 1);
    setSnap(snapshot(duel));
    // Un Rematch lancé pendant l'animation du dernier coup : sa fin, périmée,
    // ne rendrait jamais la main.
    setBusy(false);
    setPops([]);
    setBubble(null);
    const first = corners[duel.turn];
    setLog([
      {
        id: nextId.current++,
        actor: null,
        icon: "🔔",
        text: `FIGHT! ${first.fighter.name} moves first: ${first.sources.reviews} reviews make it the crowd favourite.`,
      },
    ]);
  }

  // Retour à l'écran de choix : le duel en cours s'arrête net, voix et musique comprises.
  function backToMenu() {
    generation.current++;
    timers.current.forEach(clearTimeout);
    timers.current = [];
    voicesRef.current?.cancel();
    const audio = audioRef.current;
    audio?.setDanger(false);
    audio?.duck(false);
    audio?.stopMusic(0.3);
    duelRef.current = null;
    setPlayer(null);
    setSnap(null);
    setBusy(false);
    setPops([]);
    setBubble(null);
    setLog([]);
  }

  // Le premier tour de l'ordinateur part tout seul, une fois l'arène montée.
  useEffect(() => {
    const duel = duelRef.current;
    if (!player || !duel || duel.turns > 0 || duel.turn === player) return;
    const t = setTimeout(() => resolve(aiMove(duel)), 1100);
    return () => clearTimeout(t);
  }, [player, round, resolve]);

  // Le journal défile tout seul jusqu'à la dernière réplique.
  useEffect(() => {
    const el = logRef.current;
    el?.scrollTo?.({ top: el.scrollHeight, behavior: prefersReducedMotion() ? "auto" : "smooth" });
  }, [log.length]);

  // Raccourcis clavier : 1 à 4 pour les coups.
  const canPlay = !!(player && snap && !snap.over && !busy && snap.turn === player);
  useEffect(() => {
    if (!canPlay || !player) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLElement && e.target.closest("input, textarea")) return;
      const move = MOVE_KEYS[Number(e.key) - 1];
      if (move && duelRef.current && canUse(duelRef.current, player, move)) {
        sound("click");
        resolve(move);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [canPlay, player, resolve, sound]);

  const go = (l: number, r: number) => startNavigation(() => router.push(battleHref(l, r, langParam)));

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}${battleHref(left.fighter.appId, right.fighter.appId, langParam)}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // Presse-papiers refusé : l'adresse de la page suffit.
    }
  }

  // Le serveur tire deux jeux à 5 000 reviews ou plus ; s'il ne répond pas,
  // on retombe sur un des grands classiques.
  function randomRivalry() {
    startNavigation(async () => {
      try {
        const response = await fetch("/api/battle/random", { cache: "no-store" });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const { leftAppId, rightAppId } = (await response.json()) as { leftAppId: number; rightAppId: number };
        router.push(battleHref(leftAppId, rightAppId, langParam));
      } catch {
        const others = RIVALRIES.filter((r) => !(r.left.appId === left.fighter.appId && r.right.appId === right.fighter.appId));
        const r = others[Math.floor(Math.random() * others.length)];
        router.push(battleHref(r.left.appId, r.right.appId, langParam));
      }
    });
  }

  // Relance un seul camp : même tirage serveur que « Random rivalry », dont on
  // garde un jeu différent de celui d'en face ; hors ligne, le panel par défaut.
  function randomSide(side: Side) {
    const kept = side === "left" ? right.fighter.appId : left.fighter.appId;
    const current = corners[side].fighter.appId;
    startNavigation(async () => {
      let appId: number;
      try {
        const response = await fetch("/api/battle/random", { cache: "no-store" });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const { leftAppId, rightAppId } = (await response.json()) as { leftAppId: number; rightAppId: number };
        appId = leftAppId !== kept ? leftAppId : rightAppId;
      } catch {
        const pool = DEFAULT_OPPONENTS.filter((id) => id !== kept && id !== current);
        appId = pool[Math.floor(Math.random() * pool.length)];
      }
      router.push(side === "left" ? battleHref(appId, kept, langParam) : battleHref(kept, appId, langParam));
    });
  }

  const btn =
    "rounded-full border border-[#24333f] bg-[#0c1116]/60 px-4 py-1.5 text-sm font-semibold text-[#cfdae1] hover:border-white/30 disabled:opacity-40";

  // --- Choix du camp ---
  if (!player || !snap) {
    return (
      <div className="rounded-md border border-[#1e2b36] bg-[radial-gradient(ellipse_at_top,#1b2733_0%,#0a0f14_70%)] p-5 sm:p-8">
        <p className="text-center font-mono text-[11px] tracking-[0.16em] text-[#7d919c] uppercase">choose your fighter</p>
        <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-[1fr_auto_1fr] md:items-center">
          {(["left", "right"] as const).map((side, i) => {
            const c = corners[side];
            return (
              <div key={side} className={`flex flex-col items-center gap-3 text-center ${i === 1 ? "md:order-3" : ""}`}>
                <button
                  type="button"
                  onClick={() => start(side)}
                  className="group flex flex-col items-center gap-3"
                  aria-label={`Play as ${c.fighter.name}`}
                >
                  <span className="relative block aspect-[2/3] w-[120px] overflow-hidden rounded-[4px] bg-white/5 shadow-[0_18px_50px_rgba(0,0,0,0.6)] outline-2 outline-offset-4 outline-transparent transition-[outline-color,transform] group-hover:-translate-y-1 group-hover:outline-[var(--c)] sm:w-[160px]" style={{ ["--c" as string]: SIDE_COLOR[side] }}>
                    {c.fighter.coverUrl && <Image src={c.fighter.coverUrl} alt="" fill sizes="160px" priority className="object-cover" />}
                  </span>
                  <span className="line-clamp-2 max-w-[260px] text-xl leading-tight font-extrabold tracking-tight group-hover:text-brand-blue">
                    {c.fighter.name}
                  </span>
                  <span className="grid grid-cols-2 gap-x-4 gap-y-0.5 font-mono text-[11px] text-[#9fb2bd]">
                    <span className="text-right">{c.stats.maxHp} HP</span>
                    <span className="text-left text-[#5f7481]">{c.sources.hours} median</span>
                    <span className="text-right">{c.stats.power} power</span>
                    <span className="text-left text-[#5f7481]">{c.sources.positive} positive</span>
                    <span className="text-right">{pct(c.stats.crit)} crit</span>
                    <span className="text-left text-[#5f7481]">{c.sources.reviews} reviews</span>
                  </span>
                  <span
                    className="rounded-full px-5 py-2 text-sm font-bold text-[#0c1116] transition-transform group-hover:scale-105"
                    style={{ backgroundColor: SIDE_COLOR[side] }}
                  >
                    Play as {c.fighter.name.length > 22 ? "this one" : c.fighter.name}
                  </span>
                </button>
                <div className="flex w-full max-w-[280px] items-center gap-2">
                  <GameSearchCombobox
                    placeholder="Change game…"
                    ariaLabel={side === "left" ? "Change the first game" : "Change the second game"}
                    busy={isNavigating}
                    onSelect={(hit) => (side === "left" ? go(hit.appId, right.fighter.appId) : go(left.fighter.appId, hit.appId))}
                    containerClassName="min-w-0 flex-1"
                    inputClassName="w-full rounded-full border border-[#24333f] bg-[#111a21] px-3 py-1 text-xs text-[#eef2f4] placeholder:text-[#7d919c] focus:border-white/25 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => randomSide(side)}
                    disabled={isNavigating}
                    aria-label={side === "left" ? "Random first game" : "Random second game"}
                    title="Random game"
                    className="shrink-0 rounded-full border border-[#24333f] bg-[#111a21] px-2.5 py-1 text-xs hover:border-white/30 disabled:opacity-40"
                  >
                    🎲
                  </button>
                </div>
              </div>
            );
          })}
          <div className="text-center text-5xl font-black text-brand-red italic md:order-2">
            <span className="inline-block px-[0.14em] leading-none">VS</span>
          </div>
        </div>
        <p className="mt-6 text-center text-sm text-[#7d919c]">The CPU takes the other one. Moves are picked by you, stats by Steam.</p>
        <div className="mt-3 flex justify-center">
          <button type="button" onClick={randomRivalry} disabled={isNavigating} className={btn}>
            {isNavigating ? "Rolling…" : "🎲 Random rivalry"}
          </button>
        </div>
        {languages.length > 1 && (
          <div className="mt-4 flex items-center justify-center gap-2 font-mono text-[10px] tracking-[0.1em] text-[#7d919c] uppercase">
            <label htmlFor="duel-language">Reviews &amp; voices in</label>
            <select
              id="duel-language"
              value={language}
              disabled={isNavigating}
              onChange={(e) =>
                startNavigation(() =>
                  router.push(battleHref(left.fighter.appId, right.fighter.appId, e.target.value), { scroll: false }),
                )
              }
              className="rounded-full border border-[#24333f] bg-[#111a21] px-3 py-1.5 font-mono text-[10px] tracking-[0.1em] text-[#cfdae1] uppercase disabled:opacity-40"
            >
              {languages.map((l) => (
                <option key={l.key} value={l.key}>
                  {l.label}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>
    );
  }

  // --- Duel ---
  const cpu = opponent(player);
  const fighterState = (side: Side) => (!snap.over || !snap.winner ? "fighting" : snap.winner === side ? "winner" : "loser");
  const you = corners[player];
  // Les mêmes règles que `canUse`, lues sur l'instantané plutôt que sur l'état du moteur.
  const available = (move: MoveId) =>
    move === "bomb"
      ? snap.bombCooldown[player] === 0
      : move === "patch"
        ? snap.patches[player] > 0 && snap.hp[player] < you.stats.maxHp
        : true;
  const won = snap.over && snap.winner === player;

  // À la fin, la bulle céderait la place au verdict : la review reste dans le journal.
  const bubbleFor = (side: Side) => (bubble && bubble.side === side && !snap.over ? { ...bubble, language, censored: censoredOn } : undefined);

  return (
    <div>
      <div className="grid overflow-hidden rounded-md border border-[#1e2b36] bg-[linear-gradient(180deg,#152029_0%,#0c1116_55%,#0f1a14_100%)] lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="relative">
          <div className="absolute top-2 left-2 z-30 flex items-center gap-1.5">
            <button type="button" onClick={backToMenu} aria-label="Back to the fighter menu" className={CHIP}>
              ← menu
            </button>
            <button
              type="button"
              onClick={toggleMute}
              aria-label={muted ? "Turn music on" : "Turn music off"}
              aria-pressed={muted}
              title={muted ? "Music on (M)" : "Music off (M)"}
              className={CHIP}
            >
              {muted ? "🔇 music off" : "🎵 music on"}
            </button>
            {DuelVoices.supported() && (
              <button
                type="button"
                onClick={toggleVoices}
                aria-pressed={!voicesOn}
                aria-label={voicesOn ? "Stop reading reviews aloud" : "Read reviews aloud"}
                className={CHIP}
              >
                {voicesOn ? "🗣 voices on" : "🤐 voices off"}
              </button>
            )}
            <button
              type="button"
              onClick={toggleCensored}
              aria-pressed={censoredOn}
              aria-label={censoredOn ? "Show swear words" : "Bleep swear words"}
              className={CHIP}
            >
              {censoredOn ? "♥ censored" : "🤬 uncensored"}
            </button>
            <AudioCredits />
          </div>
          {/* Le sol en perspective : une grille qui fuit vers l'horizon. */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 bottom-0 h-1/2 opacity-30 [mask-image:linear-gradient(to_top,black,transparent)]"
            style={{
              backgroundImage:
                "linear-gradient(#24333f 1px, transparent 1px), linear-gradient(90deg, #24333f 1px, transparent 1px)",
              backgroundSize: "44px 28px",
              transform: "perspective(400px) rotateX(55deg)",
              transformOrigin: "bottom",
            }}
          />
          <div className="relative mx-auto grid max-w-[900px] grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-2 px-4 pt-5 pb-3 sm:gap-x-10 sm:px-8 sm:pt-8">
            {/* L'ordinateur, au fond à droite. */}
            <div className="flex justify-start">
              <InfoBox side={cpu} corner={corners[cpu]} hp={snap.hp[cpu]} role="cpu" stunned={snap.stunned[cpu]} active={!snap.over && snap.turn === cpu} />
            </div>
            <div className="pr-2 sm:pr-8">
              <Fighter
                side={cpu}
                corner={corners[cpu]}
                state={fighterState(cpu)}
                pops={pops.filter((p) => p.side === cpu)}
                coverRef={coverRefs[cpu]}
                size="far"
                bubble={bubbleFor(cpu)}
              />
            </div>
            {/* Le joueur, au premier plan à gauche. */}
            <div className="col-start-1 row-start-2 pl-2 sm:pl-8">
              <Fighter
                side={player}
                corner={you}
                state={fighterState(player)}
                pops={pops.filter((p) => p.side === player)}
                coverRef={coverRefs[player]}
                size="near"
                bubble={bubbleFor(player)}
              />
            </div>
            <div className="col-start-2 row-start-2 flex w-[min(340px,48vw)] justify-end sm:w-[300px]">
              <InfoBox side={player} corner={you} hp={snap.hp[player]} role="you" stunned={snap.stunned[player]} active={!snap.over && snap.turn === player} />
            </div>
          </div>

          {snap.over && (
            <div className="pointer-events-none absolute inset-x-0 top-1/2 z-30 -translate-y-1/2 text-center">
              <span
                className={`animate-battle-fight inline-block px-[0.14em] text-5xl font-black tracking-tight italic drop-shadow-[0_4px_30px_rgba(0,0,0,0.9)] sm:text-7xl ${
                  won ? "text-[#ffd166]" : snap.winner ? "text-[#d03b3b]" : "text-[#eef2f4]"
                }`}
              >
                {snap.winner ? (won ? "VICTORY" : "DEFEAT") : "DRAW"}
              </span>
            </div>
          )}
        </div>

        {/* Le journal du combat, dans l'arène : chaque tour et la review qu'il a lancée. */}
        <div className="relative border-t border-[#1e2b36] bg-[#0a0f14]/80 lg:border-t-0 lg:border-l">
          <div ref={logRef} className="max-h-[240px] overflow-y-auto overscroll-contain px-4 pb-4 lg:absolute lg:inset-0 lg:max-h-none" aria-live="polite">
            <div className="sticky top-0 z-10 -mx-4 mb-1 bg-[#0a0f14] px-4 pt-3 pb-2 font-mono text-[10px] tracking-[0.14em] text-[#7d919c] uppercase">
              battle log · {Math.max(0, log.length - 1)} moves
            </div>
            {log.map((line, i) => {
              const latest = i === log.length - 1;
              return (
                <div key={line.id} className={`border-t border-[#1a2530] py-2.5 first-of-type:border-t-0 ${latest ? "animate-battle-line" : ""}`}>
                  <p className={`text-[13px] leading-snug ${latest ? "font-semibold text-[#eef2f4]" : "text-[#9fb2bd]"}`}>
                    {/* L'icône dit ce qui s'est passé, son anneau qui l'a fait. */}
                    <span
                      aria-hidden
                      className="mr-1.5 inline-flex h-5 w-5 items-center justify-center rounded-full bg-[#111a21] align-middle text-[11px] leading-none"
                      style={{ boxShadow: `inset 0 0 0 1.5px ${line.actor ? SIDE_COLOR[line.actor] : "#24333f"}` }}
                    >
                      {line.icon}
                    </span>
                    {line.text}
                  </p>
                  {line.quote && (
                    <blockquote
                      className="mt-1.5 border-l-2 pl-2.5 text-[12px] leading-snug text-[#9fb2bd] italic"
                      style={{ borderColor: line.quote.fan ? "#5cc26b" : "#d03b3b" }}
                    >
                      “<CensoredText text={line.quote.text} language={language} censored={censoredOn} />”
                      <QuoteFooter quote={line.quote} />
                    </blockquote>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="mt-4">
        {snap.over ? (
          <div className="flex flex-col items-center justify-center gap-3 rounded-md border border-[#1e2b36] bg-[#0a0f14] p-5 text-center">
            <p className="text-2xl font-extrabold tracking-tight">
              {won
                ? `${you.fighter.name} wins in ${Math.ceil(snap.turns / 2)} turns.`
                : snap.winner
                  ? `${corners[cpu].fighter.name} takes it. The CPU sends its regards.`
                  : "Time's up. Nobody wins."}
            </p>
            <div className="flex flex-wrap justify-center gap-2">
              <button type="button" onClick={() => start(player)} className="rounded-full bg-brand-blue px-5 py-1.5 text-sm font-bold text-[#0c1116]">
                Rematch
              </button>
              <button type="button" onClick={() => start(cpu)} className={btn}>
                Switch sides
              </button>
              <button type="button" onClick={randomRivalry} disabled={isNavigating} className={btn}>
                🎲 Random rivalry
              </button>
              <button type="button" onClick={backToMenu} className={btn}>
                Menu
              </button>
              <button type="button" onClick={copyLink} className={btn}>
                {copied ? "Copied!" : "Copy link"}
              </button>
            </div>
          </div>
        ) : (
          <div>
            <div className="mb-2 flex items-baseline justify-between font-mono text-[10px] tracking-[0.12em] text-[#7d919c] uppercase">
              <span>{canPlay ? "your move" : snap.turn === cpu ? "cpu is thinking…" : "…"}</span>
              <span className="hidden sm:inline">keys 1–4</span>
            </div>
            <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
              {MOVE_KEYS.map((move, i) => (
                <MoveButton
                  key={move}
                  move={move}
                  index={i}
                  corner={you}
                  foe={corners[cpu]}
                  cooldown={snap.bombCooldown[player]}
                  patches={snap.patches[player]}
                  disabled={!canPlay || !available(move)}
                  onPlay={(m) => {
                    sound("click");
                    resolve(m);
                  }}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
