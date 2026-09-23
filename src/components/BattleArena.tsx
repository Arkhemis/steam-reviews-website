"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, useTransition, type ReactNode } from "react";
import { GameSearchCombobox } from "@/components/GameSearchCombobox";
import { battleHref, healthAfter, RIVALRIES, type BattleOutcome, type BattleRound, type Side } from "@/lib/battle";

// L'écran de versus : les deux jeux face à face sur leur illustration Steam,
// les barres de vie en haut, puis les rounds qui tombent un par un. La
// séquence ne vit que côté client — le serveur rend l'arène avant le premier
// round, le composant la rejoue, et « Skip » ou `prefers-reduced-motion`
// sautent directement au résultat.

export type BattleFighter = {
  appId: number;
  name: string;
  coverUrl: string | null;
  pct: number;
  ratingLabel: string;
  ratingColor: string;
  totalReviews: number;
};

type BattleArenaProps = {
  left: BattleFighter;
  right: BattleFighter;
  /** Illustrations panoramiques, rendues côté serveur dans leur propre boundary. */
  leftArt?: ReactNode;
  rightArt?: ReactNode;
  rounds: BattleRound[];
  outcome: BattleOutcome;
};

// P1 prend l'orange du site, P2 le bleu de la première série des graphes.
const SIDE_COLOR: Record<Side, string> = { left: "var(--color-brand-blue)", right: "var(--series-1)" };

const INTRO_MS = 1800;
const ROUND_MS = 2400;

const enFull = new Intl.NumberFormat("en-US");

type Phase = "intro" | "fighting" | "done";

function prefersReducedMotion(): boolean {
  return typeof window !== "undefined" && (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false);
}

function HealthBar({ side, health, name }: { side: Side; health: number; name: string }) {
  const low = health <= 34;
  return (
    <div className={`min-w-0 flex-1 ${side === "right" ? "text-right" : ""}`}>
      <div
        className={`flex items-baseline gap-2 font-mono text-[10px] tracking-[0.14em] uppercase ${side === "right" ? "flex-row-reverse" : ""}`}
      >
        <span className="font-bold" style={{ color: SIDE_COLOR[side] }}>
          {side === "left" ? "P1" : "P2"}
        </span>
        <span className="truncate text-[#cfdae1]">{name}</span>
      </div>
      <div
        className="mt-1.5 h-3.5 overflow-hidden rounded-[2px] border border-white/15 bg-[#05080b] skew-x-[-12deg]"
        role="meter"
        aria-label={`${name} health`}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(health)}
      >
        <div className={`flex h-full ${side === "right" ? "justify-end" : ""}`}>
          <div
            className="h-full transition-[width] duration-700 ease-out"
            style={{
              width: `${health}%`,
              background: low
                ? "linear-gradient(90deg, #d03b3b, #ff6a3d)"
                : side === "left"
                  ? "linear-gradient(90deg, #ff7a45, #e8622a)"
                  : "linear-gradient(90deg, #3987e5, #6fb0ff)",
            }}
          />
        </div>
      </div>
    </div>
  );
}

function FighterPicker({ side, onPick, busy }: { side: Side; onPick: (appId: number) => void; busy: boolean }) {
  return (
    <GameSearchCombobox
      placeholder="Change fighter…"
      ariaLabel={side === "left" ? "Change player 1" : "Change player 2"}
      busy={busy}
      onSelect={(hit) => onPick(hit.appId)}
      containerClassName="w-full max-w-[240px]"
      inputClassName="w-full rounded-full border border-[#24333f] bg-[#0c1116]/80 px-3.5 py-1.5 text-xs text-[#eef2f4] backdrop-blur-sm placeholder:text-[#7d919c] focus:border-white/25 focus:outline-none"
    />
  );
}

function FighterPanel({
  side,
  fighter,
  state,
  hitKey,
  onPick,
  busy,
}: {
  side: Side;
  fighter: BattleFighter;
  state: "fighting" | "winner" | "loser" | "draw";
  /** Change à chaque round perdu : la jaquette encaisse le coup. */
  hitKey: number;
  onPick: (appId: number) => void;
  busy: boolean;
}) {
  const mirrored = side === "right";
  const coverRef = useRef<HTMLSpanElement>(null);

  // Le choc passe par l'API Web Animations plutôt que par une clé React :
  // remonter la jaquette rechargerait l'image à chaque round perdu.
  useEffect(() => {
    if (hitKey === 0 || prefersReducedMotion()) return;
    coverRef.current?.animate?.(
      [
        { transform: "translateX(0)", filter: "brightness(1)" },
        { transform: `translateX(${mirrored ? 10 : -10}px) rotate(${mirrored ? 2 : -2}deg)`, filter: "brightness(2.2) saturate(0.4)" },
        { transform: `translateX(${mirrored ? -6 : 6}px)`, filter: "brightness(1.2)" },
        { transform: "translateX(0)", filter: "brightness(1)" },
      ],
      { duration: 380, easing: "ease-out" },
    );
  }, [hitKey, mirrored]);

  return (
    <div className={`flex min-w-0 flex-col gap-3 ${mirrored ? "items-end text-right" : "items-start"}`}>
      <Link href={`/games/${fighter.appId}`} className="block">
      <span
        ref={coverRef}
        className={`relative block aspect-[2/3] w-[110px] overflow-hidden rounded-[4px] bg-white/5 shadow-[0_18px_50px_rgba(0,0,0,0.6)] transition-[filter,transform] duration-500 sm:w-[170px] ${
          state === "loser" ? "rotate-[-3deg] grayscale" : ""
        } ${state === "winner" ? "scale-[1.04]" : ""}`}
        style={{ outline: `2px solid ${state === "winner" ? SIDE_COLOR[side] : "transparent"}`, outlineOffset: 3 }}
      >
        {fighter.coverUrl && <Image src={fighter.coverUrl} alt="" fill sizes="170px" priority className="object-cover" />}
        {state === "winner" && (
          <Image src="/chad.png" alt="" fill sizes="170px" className="animate-chad-blink object-cover" />
        )}
        <span className="absolute inset-x-0 top-0 h-[3px]" style={{ backgroundColor: fighter.ratingColor }} />
        {state === "loser" && (
          <span className="absolute inset-0 flex items-center justify-center bg-[#0c1116]/55 font-mono text-2xl font-black tracking-[0.1em] text-[#d03b3b] sm:text-4xl">
            K.O.
          </span>
        )}
      </span>
      </Link>
      <div className="min-w-0 max-w-full">
        <Link
          href={`/games/${fighter.appId}`}
          className="line-clamp-2 text-xl leading-[1.02] font-extrabold tracking-tight text-balance drop-shadow-[0_2px_18px_rgba(12,17,22,0.9)] hover:text-brand-blue sm:text-[34px]"
        >
          {fighter.name}
        </Link>
        <div className={`mt-2 flex flex-wrap items-baseline gap-x-2.5 font-mono ${mirrored ? "justify-end" : ""}`}>
          <span className="text-2xl leading-none sm:text-[32px]" style={{ color: fighter.ratingColor }}>
            {Math.round(fighter.pct * 100)}%
          </span>
          <span className="text-[10px] tracking-[0.1em] text-[#9fb2bd] uppercase">
            {fighter.ratingLabel}
            <span className="hidden sm:inline"> · {enFull.format(fighter.totalReviews)} reviews</span>
          </span>
        </div>
      </div>
      <FighterPicker side={side} onPick={onPick} busy={busy} />
    </div>
  );
}

function RoundRow({ round, index, revealed, current }: { round: BattleRound; index: number; revealed: boolean; current: boolean }) {
  const tag = (side: Side) =>
    revealed && round.winner === side ? (
      <span
        className="rounded-[3px] px-1.5 py-0.5 font-mono text-[9px] font-bold tracking-[0.12em] text-[#0c1116] uppercase"
        style={{ backgroundColor: SIDE_COLOR[side] }}
      >
        {round.critical ? "crit" : "win"}
      </span>
    ) : null;

  const value = (side: Side) => {
    const won = round.winner === side;
    return (
      <span
        className={`font-mono text-lg leading-none transition-colors sm:text-2xl ${revealed ? "" : "blur-[6px]"}`}
        style={{ color: revealed ? (won ? SIDE_COLOR[side] : round.winner ? "#7d919c" : "#eef2f4") : "#3c4c58" }}
      >
        {revealed ? round[side] : "88"}
      </span>
    );
  };

  const bar = (side: Side) => {
    const pct = side === "left" ? round.leftFillPct : round.rightFillPct;
    const won = round.winner === side;
    return (
      <div className={`flex h-2 flex-1 ${side === "left" ? "justify-end" : "justify-start"}`}>
        <div
          className={`h-full transition-[width] duration-700 ease-out ${side === "left" ? "rounded-l-[3px]" : "rounded-r-[3px]"}`}
          style={{
            width: revealed ? `${Math.max(pct, 1.5)}%` : "0%",
            backgroundColor: SIDE_COLOR[side],
            opacity: !round.winner || won ? 1 : 0.3,
          }}
        />
      </div>
    );
  };

  return (
    <li
      data-revealed={revealed}
      className={`rounded-md border bg-[#0a0f14] px-4 py-3.5 transition-[border-color,opacity] duration-300 sm:px-5 ${
        current ? "border-brand-blue" : "border-[#1e2b36]"
      } ${revealed || current ? "" : "opacity-45"}`}
    >
      <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-baseline gap-3">
        <span className="flex items-center gap-2">{value("left")}{tag("left")}</span>
        <span className="min-w-0 text-center">
          <span className="block font-mono text-[9px] tracking-[0.16em] text-[#7d919c] uppercase">round {index + 1}</span>
          <span className="block text-sm font-extrabold tracking-tight sm:text-base">{round.title}</span>
        </span>
        <span className="flex flex-row-reverse items-center gap-2">{value("right")}{tag("right")}</span>
      </div>
      <div className="mt-2.5 flex items-center gap-[3px]">
        {bar("left")}
        {bar("right")}
      </div>
      <div className="mt-2 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <span className="font-mono text-[10px] tracking-[0.08em] text-[#5f7481] uppercase">{round.stat}</span>
        <span className={`text-[13px] text-[#cfdae1] transition-opacity duration-500 ${revealed ? "opacity-100" : "opacity-0"}`}>
          {round.commentary}
        </span>
      </div>
    </li>
  );
}

/**
 * Chaque duel, et chaque « Rematch », remonte l'arène : la clé remet la
 * séquence à zéro sans qu'un effet ait à réinitialiser l'état lui-même.
 */
export function BattleArena(props: BattleArenaProps) {
  const [replay, setReplay] = useState(0);
  return (
    <Arena
      key={`${props.left.appId}-${props.right.appId}-${replay}`}
      {...props}
      onRematch={() => setReplay((n) => n + 1)}
    />
  );
}

function Arena({ left, right, leftArt, rightArt, rounds, outcome, onRematch }: BattleArenaProps & { onRematch: () => void }) {
  const router = useRouter();
  const [isNavigating, startNavigation] = useTransition();
  const [phase, setPhase] = useState<Phase>("intro");
  const [played, setPlayed] = useState(0);
  const [copied, setCopied] = useState(false);

  // Les minuteurs de la séquence : « Skip » les coupe, sans quoi un round
  // encore en attente viendrait rembobiner le résultat.
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const clearTimers = useCallback(() => {
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];
  }, []);

  const finish = useCallback(() => {
    clearTimers();
    setPlayed(rounds.length);
    setPhase("done");
  }, [rounds.length, clearTimers]);

  useEffect(() => {
    const timers = timersRef.current;
    if (prefersReducedMotion()) {
      timers.push(setTimeout(finish, 0));
    } else {
      timers.push(setTimeout(() => setPhase("fighting"), INTRO_MS));
      for (let i = 0; i < rounds.length; i++) {
        timers.push(setTimeout(() => setPlayed(i + 1), INTRO_MS + i * ROUND_MS + ROUND_MS / 2));
      }
      timers.push(setTimeout(() => setPhase("done"), INTRO_MS + rounds.length * ROUND_MS));
    }
    return clearTimers;
  }, [rounds.length, finish, clearTimers]);

  const health = healthAfter(rounds, played);
  const lastRound = played > 0 ? rounds[played - 1] : null;
  const done = phase === "done";

  function stateOf(side: Side): "fighting" | "winner" | "loser" | "draw" {
    if (!done) return "fighting";
    if (!outcome.winner) return "draw";
    return outcome.winner === side ? "winner" : "loser";
  }

  // Le nombre de coups encaissés : la clé de la jaquette change à chaque
  // round perdu, ce qui relance l'animation de choc.
  const hits = (side: Side) => rounds.slice(0, played).filter((r) => r.winner && r.winner !== side).length;

  const go = (leftId: number, rightId: number) => startNavigation(() => router.push(battleHref(leftId, rightId)));

  function randomRivalry() {
    const others = RIVALRIES.filter((r) => !(r.left.appId === left.appId && r.right.appId === right.appId));
    const pick = others[Math.floor(Math.random() * others.length)];
    go(pick.left.appId, pick.right.appId);
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}${battleHref(left.appId, right.appId)}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // Presse-papiers refusé (contexte non sécurisé, permission) : le lien
      // reste dans la barre d'adresse.
    }
  }

  const winnerName = outcome.winner === "left" ? left.name : outcome.winner === "right" ? right.name : null;
  // Le vainqueur annonce son score en premier : « wins 3–1 », jamais « 1–3 ».
  const score =
    outcome.winner === "right" ? `${outcome.rightWins}–${outcome.leftWins}` : `${outcome.leftWins}–${outcome.rightWins}`;

  return (
    <>
      <section className="relative overflow-hidden border-b border-[#1a2530] bg-[linear-gradient(115deg,#2a1206_0%,#0c1116_50%,#071526_100%)]">
        {/* Les deux illustrations, coupées en biais comme un écran de versus. */}
        <div aria-hidden className="pointer-events-none absolute inset-0">
          <div className="absolute inset-0 [clip-path:polygon(0_0,56%_0,44%_100%,0_100%)]">
            <div className="absolute inset-0 opacity-45">{leftArt}</div>
            <span className="absolute inset-0 bg-[linear-gradient(90deg,rgba(42,18,6,0.35)_0%,rgba(12,17,22,0.85)_58%)]" />
          </div>
          <div className="absolute inset-0 [clip-path:polygon(56%_0,100%_0,100%_100%,44%_100%)]">
            <div className="absolute inset-0 opacity-45">{rightArt}</div>
            <span className="absolute inset-0 bg-[linear-gradient(270deg,rgba(7,21,38,0.35)_0%,rgba(12,17,22,0.85)_58%)]" />
          </div>
          {/* La couture du biais. */}
          <span className="absolute inset-y-0 left-1/2 w-[3px] -translate-x-1/2 rotate-[6.8deg] scale-y-125 bg-gradient-to-b from-brand-blue via-white/70 to-[#3987e5] opacity-70 [mask-image:linear-gradient(180deg,#000_0%,#000_45%,transparent_68%)]" />
          <span className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-b from-transparent to-[#0c1116]" />
        </div>

        <div className="relative mx-auto max-w-[1320px] px-5 pt-6 pb-8 sm:px-8 sm:pt-7 sm:pb-10">
          {/* Le HUD : les deux barres de vie, et le score au milieu. */}
          <div className="flex items-end gap-3 sm:gap-6">
            <HealthBar side="left" health={health.left} name={left.name} />
            <div className="shrink-0 text-center font-mono">
              <div className="text-[9px] tracking-[0.16em] text-[#7d919c] uppercase">
                {done ? "final" : played === 0 ? "ready" : `round ${played}/${rounds.length}`}
              </div>
              <div className="mt-0.5 text-xl leading-none text-[#eef2f4] sm:text-2xl" aria-live="polite">
                {rounds.slice(0, played).filter((r) => r.winner === "left").length}
                <span className="px-1.5 text-[#3c4c58]">–</span>
                {rounds.slice(0, played).filter((r) => r.winner === "right").length}
              </div>
            </div>
            <HealthBar side="right" health={health.right} name={right.name} />
          </div>

          <div className="mt-8 grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-3 sm:mt-10 sm:gap-8">
            <FighterPanel
              side="left"
              fighter={left}
              state={stateOf("left")}
              hitKey={hits("left")}
              onPick={(id) => go(id, right.appId)}
              busy={isNavigating}
            />

            <div className="flex flex-col items-center gap-3 self-center">
              {/* Le padding horizontal rend à l'italique ce qu'il déborde de sa
                  boîte : `bg-clip-text` coupe tout ce qui en sort. */}
              <span
                key={phase}
                className={`bg-gradient-to-b from-[#ffd3bf] via-brand-red to-brand-blue bg-clip-text px-[0.14em] py-[0.04em] leading-none font-black tracking-tighter text-transparent italic ${
                  phase === "intro" ? "animate-battle-fight text-4xl sm:text-7xl" : "text-5xl sm:text-8xl"
                }`}
              >
                {phase === "intro" ? "FIGHT!" : "VS"}
              </span>
              <button
                type="button"
                onClick={() => go(right.appId, left.appId)}
                className="rounded-full border border-[#24333f] bg-[#0c1116]/70 px-3 py-1 font-mono text-[10px] tracking-[0.12em] text-[#9fb2bd] uppercase backdrop-blur-sm hover:border-white/30 hover:text-[#eef2f4]"
                aria-label="Swap sides"
              >
                ⇄ swap
              </button>
            </div>

            <FighterPanel
              side="right"
              fighter={right}
              state={stateOf("right")}
              hitKey={hits("right")}
              onPick={(id) => go(left.appId, id)}
              busy={isNavigating}
            />
          </div>

          {/* Le commentateur, puis le verdict. Hauteur réservée : le bandeau
              ne doit pas pousser la page quand il change de contenu. */}
          <div className="mt-8 flex min-h-[112px] flex-col items-center justify-center text-center" aria-live="polite">
            {done ? (
              <div className="animate-battle-ko">
                <div className="font-mono text-[11px] tracking-[0.2em] uppercase" style={{ color: outcome.winner ? SIDE_COLOR[outcome.winner] : "#fab219" }}>
                  {outcome.verdict}
                </div>
                <div className="mt-1.5 text-2xl font-black tracking-tight sm:text-4xl">
                  {winnerName ? (
                    <>
                      {winnerName} wins <span className="font-mono font-normal text-[#9fb2bd]">{score}</span>
                    </>
                  ) : (
                    <>
                      Nobody wins <span className="font-mono font-normal text-[#9fb2bd]">{score}</span>
                    </>
                  )}
                </div>
                <div className="mt-4 flex flex-wrap justify-center gap-2">
                  <button
                    type="button"
                    onClick={onRematch}
                    className="rounded-full bg-brand-blue px-[18px] py-2 text-sm font-bold text-[#0c1116]"
                  >
                    Rematch
                  </button>
                  <button
                    type="button"
                    onClick={randomRivalry}
                    className="rounded-full border border-[#24333f] bg-[#0c1116]/60 px-[18px] py-2 text-sm font-semibold text-[#cfdae1] hover:border-white/30"
                  >
                    🎲 Random rivalry
                  </button>
                  <button
                    type="button"
                    onClick={copyLink}
                    className="rounded-full border border-[#24333f] bg-[#0c1116]/60 px-[18px] py-2 text-sm font-semibold text-[#cfdae1] hover:border-white/30"
                  >
                    {copied ? "Link copied ✓" : "Copy link"}
                  </button>
                </div>
              </div>
            ) : (
              <div>
                <div className="font-mono text-[10px] tracking-[0.16em] text-[#7d919c] uppercase">
                  {lastRound ? `round ${played} · ${lastRound.title}` : "round 1 · get ready"}
                </div>
                <p key={played} className="mt-1.5 animate-battle-line text-lg font-bold sm:text-xl">
                  {lastRound ? lastRound.commentary : `${left.name} and ${right.name} step into the ring.`}
                  {lastRound?.critical && (
                    <span className="ml-2 align-middle font-mono text-[10px] tracking-[0.14em] text-[#fab219] uppercase">critical hit</span>
                  )}
                </p>
                <button
                  type="button"
                  onClick={finish}
                  className="mt-3 font-mono text-[10px] tracking-[0.12em] text-brand-blue uppercase hover:underline"
                >
                  skip to the result →
                </button>
              </div>
            )}
          </div>
        </div>
      </section>

      <div className="px-5 py-8 sm:px-8">
        <div className="mx-auto max-w-[980px]">
          <div className="mb-[18px] flex flex-wrap items-baseline gap-3">
            <h2 className="m-0 text-[26px] font-extrabold tracking-tight">Round by round</h2>
            <span className="text-sm text-[#7d919c]">each stat is a round — lose one, lose a slice of health</span>
          </div>
          <ol className="grid gap-2.5">
            {rounds.map((round, i) => (
              <RoundRow key={round.key} round={round} index={i} revealed={i < played} current={!done && phase === "fighting" && i === played} />
            ))}
          </ol>
        </div>
      </div>
    </>
  );
}
