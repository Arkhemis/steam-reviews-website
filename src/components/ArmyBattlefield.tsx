"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import type { BattleFighter } from "@/components/BattleArena";
import { GameSearchCombobox } from "@/components/GameSearchCombobox";
import {
  createBattle,
  FIELD_H,
  FIELD_W,
  odds as computeOdds,
  step,
  tally,
  type ArmySpec,
  type ArmyTally,
  type BattleEvent,
  type BattleState,
  type Odds,
} from "@/lib/armyBattle";
import { battleHref, type Side } from "@/lib/battle";
import type { ArmyScene } from "@/components/army3d/scene";

// Le champ de bataille de « Battle 2 ». Le moteur (`armyBattle.ts`) avance
// d'un tic par image — deux ou quatre en accéléré — et le canvas redessine
// tout à chaque fois ; React ne voit passer que le décompte des troupes,
// quelques fois par seconde. Sur un écran étroit, le champ pivote d'un quart
// de tour : les armées s'affrontent de haut en bas, et les pions gardent une
// taille lisible.

export type ArmySheet = {
  fighter: BattleFighter;
  spec: ArmySpec;
  /** Les chiffres d'origine, déjà formatés, en regard de chaque statistique. */
  sources: { reviews: string; hours: string; positive: string; refunded: string; deck: string };
};

type Props = { left: ArmySheet; right: ArmySheet; initialSeed: number };

type Phase = "ready" | "running" | "paused" | "over";

type Particle = { x: number; y: number; vx: number; vy: number; life: number; max: number; color: string; text?: string };

const COLORS: Record<Side, { main: string; dark: string }> = {
  left: { main: "#e8622a", dark: "#6b2a10" },
  right: { main: "#3987e5", dark: "#173a66" },
};
const SIDE_VAR: Record<Side, string> = { left: "var(--color-brand-blue)", right: "var(--series-1)" };

const ODDS_RUNS = 40;
const SPEEDS = [1, 2, 4] as const;
/** Sous cette largeur, le champ passe à la verticale. */
const PORTRAIT_BELOW = 640;
const PORTRAIT_MAX_H = 620;

const EMPTY_TALLY: ArmyTally = { standing: 0, dead: 0, fled: 0 };

function randomSeed(): number {
  return Math.floor(Math.random() * 2 ** 31);
}

// --- Dessin ------------------------------------------------------------------

type View = { scale: number; portrait: boolean; dpr: number };

function toScreen(view: View, x: number, y: number): [number, number] {
  return view.portrait ? [y * view.scale, x * view.scale] : [x * view.scale, y * view.scale];
}

function drawPawn(ctx: CanvasRenderingContext2D, sx: number, sy: number, k: number, fill: string, stroke: string) {
  ctx.fillStyle = fill;
  ctx.strokeStyle = stroke;
  ctx.lineWidth = Math.max(1, k * 0.9);
  ctx.beginPath();
  ctx.ellipse(sx, sy + 4 * k, 5 * k, 2 * k, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(sx - 3.6 * k, sy + 4 * k);
  ctx.lineTo(sx - 1.6 * k, sy - 2 * k);
  ctx.lineTo(sx + 1.6 * k, sy - 2 * k);
  ctx.lineTo(sx + 3.6 * k, sy + 4 * k);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(sx, sy - 4.2 * k, 3 * k, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
}

// Le cavalier : une pointe de flèche tournée vers le camp adverse.
function drawRider(ctx: CanvasRenderingContext2D, sx: number, sy: number, k: number, angle: number, fill: string, stroke: string) {
  ctx.save();
  ctx.translate(sx, sy);
  ctx.rotate(angle);
  ctx.fillStyle = fill;
  ctx.strokeStyle = stroke;
  ctx.lineWidth = Math.max(1, k * 0.9);
  ctx.beginPath();
  ctx.moveTo(8 * k, 0);
  ctx.lineTo(-6 * k, -6 * k);
  ctx.lineTo(-3 * k, 0);
  ctx.lineTo(-6 * k, 6 * k);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

function draw(ctx: CanvasRenderingContext2D, view: View, state: BattleState, particles: Particle[]) {
  const w = (view.portrait ? FIELD_H : FIELD_W) * view.scale;
  const h = (view.portrait ? FIELD_W : FIELD_H) * view.scale;
  const k = Math.max(0.7, view.scale);
  ctx.setTransform(view.dpr, 0, 0, view.dpr, 0, 0);

  ctx.fillStyle = "#0a0f14";
  ctx.fillRect(0, 0, w, h);
  // Le quadrillage et la ligne de front.
  ctx.strokeStyle = "#111a21";
  ctx.lineWidth = 1;
  for (let gx = 40; gx < FIELD_W; gx += 40) {
    const [ax, ay] = toScreen(view, gx, 0);
    const [bx, by] = toScreen(view, gx, FIELD_H);
    ctx.beginPath();
    ctx.moveTo(ax, ay);
    ctx.lineTo(bx, by);
    ctx.stroke();
  }
  for (let gy = 40; gy < FIELD_H; gy += 40) {
    const [ax, ay] = toScreen(view, 0, gy);
    const [bx, by] = toScreen(view, FIELD_W, gy);
    ctx.beginPath();
    ctx.moveTo(ax, ay);
    ctx.lineTo(bx, by);
    ctx.stroke();
  }
  ctx.strokeStyle = "#24333f";
  ctx.setLineDash([6, 8]);
  {
    const [ax, ay] = toScreen(view, FIELD_W / 2, 0);
    const [bx, by] = toScreen(view, FIELD_W / 2, FIELD_H);
    ctx.beginPath();
    ctx.moveTo(ax, ay);
    ctx.lineTo(bx, by);
    ctx.stroke();
  }
  ctx.setLineDash([]);

  // Les morts d'abord, sous les vivants.
  for (const u of state.units) {
    if (u.status !== "dead") continue;
    const [sx, sy] = toScreen(view, u.x, u.y);
    ctx.strokeStyle = COLORS[u.side].main;
    ctx.globalAlpha = 0.35;
    ctx.lineWidth = Math.max(1, 1.4 * k);
    ctx.beginPath();
    ctx.moveTo(sx - 3.5 * k, sy - 3.5 * k);
    ctx.lineTo(sx + 3.5 * k, sy + 3.5 * k);
    ctx.moveTo(sx + 3.5 * k, sy - 3.5 * k);
    ctx.lineTo(sx - 3.5 * k, sy + 3.5 * k);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  for (const u of state.units) {
    if (u.status === "dead" || u.status === "fled") continue;
    const [sx, sy] = toScreen(view, u.x, u.y);
    const fleeing = u.status === "fleeing";
    const fill = u.flash > 0 ? "#ffffff" : COLORS[u.side].main;
    ctx.globalAlpha = fleeing ? 0.45 : 1;
    if (u.rider) {
      // Vers l'ennemi, ou vers son propre bord quand il fuit.
      const forward = (u.side === "left") !== fleeing ? 0 : Math.PI;
      const angle = view.portrait ? forward + Math.PI / 2 : forward;
      drawRider(ctx, sx, sy, k, angle, fill, COLORS[u.side].dark);
    } else {
      drawPawn(ctx, sx, sy, k, fill, COLORS[u.side].dark);
    }
    ctx.globalAlpha = 1;
    if (!fleeing && u.hp < u.maxHp) {
      const bw = 12 * k;
      ctx.fillStyle = "#05080b";
      ctx.fillRect(sx - bw / 2, sy - 10.5 * k, bw, 2 * k);
      ctx.fillStyle = u.hp / u.maxHp > 0.34 ? "#0ca30c" : "#d03b3b";
      ctx.fillRect(sx - bw / 2, sy - 10.5 * k, bw * (u.hp / u.maxHp), 2 * k);
    }
  }

  for (const p of particles) {
    const [sx, sy] = toScreen(view, p.x, p.y);
    ctx.globalAlpha = Math.max(0, p.life / p.max);
    if (p.text) {
      ctx.font = `700 ${Math.round(Math.max(10, 11 * k))}px ui-monospace, monospace`;
      ctx.textAlign = "center";
      ctx.fillStyle = p.color;
      ctx.fillText(p.text, sx, sy);
    } else {
      ctx.fillStyle = p.color;
      ctx.fillRect(sx - k, sy - k, 2 * k, 2 * k);
    }
  }
  ctx.globalAlpha = 1;
}

function spawn(particles: Particle[], events: BattleEvent[], random: () => number) {
  for (const e of events) {
    if (e.type === "miss") continue;
    if (e.type === "flee") {
      particles.push({ x: e.x, y: e.y - 12, vx: 0, vy: -0.5, life: 70, max: 70, color: "#fab219", text: "refund!" });
      continue;
    }
    const n = e.type === "kill" ? 9 : 3;
    for (let i = 0; i < n; i++) {
      const a = random() * Math.PI * 2;
      const v = 0.6 + random() * (e.type === "kill" ? 2.2 : 1.2);
      particles.push({
        x: e.x,
        y: e.y,
        vx: Math.cos(a) * v,
        vy: Math.sin(a) * v,
        life: 22,
        max: 22,
        color: e.type === "kill" ? COLORS[e.side].main : "#ffffff",
      });
    }
  }
}

// --- Fiches ------------------------------------------------------------------

function SheetRow({ label, value, source }: { label: string; value: string; source: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-t border-[#16202a] py-1.5 first:border-t-0">
      <span className="font-mono text-[10px] tracking-[0.1em] text-[#7d919c] uppercase">{label}</span>
      <span className="text-right">
        <span className="font-mono text-sm text-[#eef2f4]">{value}</span>
        <span className="ml-2 font-mono text-[10px] text-[#5f7481]">{source}</span>
      </span>
    </div>
  );
}

function Sheet({
  side,
  sheet,
  winner,
  onPick,
  busy,
}: {
  side: Side;
  sheet: ArmySheet;
  winner: boolean;
  onPick: (appId: number) => void;
  busy: boolean;
}) {
  const { fighter, spec, sources } = sheet;
  return (
    <div className="rounded-md border border-[#1e2b36] bg-[#0a0f14] p-4" style={{ borderTopColor: SIDE_VAR[side], borderTopWidth: 3 }}>
      <div className="grid grid-cols-[64px_minmax(0,1fr)] items-center gap-3.5">
        <Link href={`/games/${fighter.appId}`} className="relative block aspect-[2/3] overflow-hidden rounded-[3px] bg-white/5">
          {fighter.coverUrl && <Image src={fighter.coverUrl} alt="" fill sizes="64px" className="object-cover" />}
          {winner && <Image src="/chad.png" alt="" fill sizes="64px" className="animate-chad-blink object-cover" />}
        </Link>
        <div className="min-w-0">
          <div className="font-mono text-[10px] tracking-[0.14em] uppercase" style={{ color: SIDE_VAR[side] }}>
            {side === "left" ? "P1 army" : "P2 army"}
          </div>
          <Link href={`/games/${fighter.appId}`} className="mt-0.5 line-clamp-2 text-lg leading-tight font-extrabold tracking-tight hover:text-brand-blue">
            {fighter.name}
          </Link>
          <div className="mt-2">
            <GameSearchCombobox
              placeholder="Change army…"
              ariaLabel={side === "left" ? "Change player 1 army" : "Change player 2 army"}
              busy={busy}
              onSelect={(hit) => onPick(hit.appId)}
              containerClassName="w-full max-w-[240px]"
              inputClassName="w-full rounded-full border border-[#24333f] bg-[#111a21] px-3 py-1 text-xs text-[#eef2f4] placeholder:text-[#7d919c] focus:border-white/25 focus:outline-none"
            />
          </div>
        </div>
      </div>
      <div className="mt-3">
        <SheetRow label="soldiers" value={String(spec.troops)} source={`${sources.reviews} reviews`} />
        <SheetRow label="hp each" value={String(spec.hp)} source={`${sources.hours} median`} />
        <SheetRow label="accuracy" value={`${Math.round(spec.accuracy * 100)}%`} source={`${sources.positive} positive`} />
        <SheetRow label="desertion / hit" value={`${(spec.desertion * 100).toFixed(1)}%`} source={`${sources.refunded} refunded`} />
        <SheetRow label="riders" value={String(spec.riders)} source={`${sources.deck} on Deck`} />
      </div>
    </div>
  );
}

// --- Champ de bataille -------------------------------------------------------

export function ArmyBattlefield({ left, right, initialSeed }: Props) {
  const router = useRouter();
  const [isNavigating, startNavigation] = useTransition();
  const [seed, setSeed] = useState(initialSeed);
  const [phase, setPhase] = useState<Phase>("ready");
  const [speed, setSpeed] = useState<(typeof SPEEDS)[number]>(1);
  const [tallies, setTallies] = useState<Record<Side, ArmyTally>>({
    left: { ...EMPTY_TALLY, standing: left.spec.troops },
    right: { ...EMPTY_TALLY, standing: right.spec.troops },
  });
  const [winner, setWinner] = useState<Side | null | undefined>(undefined);
  const [odds, setOdds] = useState<Odds | null>(null);
  const [copied, setCopied] = useState(false);
  const [portrait, setPortrait] = useState(false);
  // La 3D se charge à la demande ; sans WebGL, on retombe sur le canvas 2D.
  const [mode, setMode] = useState<"pending" | "3d" | "2d">("pending");

  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const canvas3dRef = useRef<HTMLCanvasElement>(null);
  const sceneRef = useRef<ArmyScene | null>(null);
  const stateRef = useRef<BattleState | null>(null);
  const particlesRef = useRef<Particle[]>([]);
  const viewRef = useRef<View>({ scale: 1, portrait: false, dpr: 1 });
  const speedRef = useRef<number>(1);
  const phaseRef = useRef<Phase>("ready");
  const visibleRef = useRef(true);
  // Les étincelles ont leur propre dé : les tirer au dé de la bataille
  // changerait l'issue selon qu'on regarde ou non.
  const fxRandom = useRef<() => number>(Math.random);

  useEffect(() => {
    speedRef.current = speed;
  }, [speed]);
  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);

  const paint = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!ctx || !stateRef.current) return;
    draw(ctx, viewRef.current, stateRef.current, particlesRef.current);
  }, []);

  const syncTallies = useCallback(() => {
    const state = stateRef.current;
    if (!state) return;
    setTallies({ left: tally(state, "left"), right: tally(state, "right") });
  }, []);

  // three.js n'arrive qu'ici, dans son propre chunk.
  useEffect(() => {
    let cancelled = false;
    import("@/components/army3d/scene")
      .then(({ ArmyScene }) => {
        if (cancelled || !canvas3dRef.current) return;
        try {
          sceneRef.current = new ArmyScene(canvas3dRef.current);
          setMode("3d");
        } catch {
          setMode("2d");
        }
      })
      .catch(() => !cancelled && setMode("2d"));
    return () => {
      cancelled = true;
      sceneRef.current?.dispose();
      sceneRef.current = null;
    };
  }, []);

  // Une nouvelle graine, ou d'autres armées, redéploient le champ.
  useEffect(() => {
    if (mode === "pending") return;
    stateRef.current = createBattle(left.spec, right.spec, seed);
    particlesRef.current = [];
    if (sceneRef.current) sceneRef.current.load(stateRef.current);
    else paint();
  }, [left.spec, right.spec, seed, paint, mode]);

  useEffect(() => {
    if (mode !== "3d") return;
    sceneRef.current?.setCovers({ left: left.fighter.coverUrl, right: right.fighter.coverUrl });
  }, [mode, left.fighter.coverUrl, right.fighter.coverUrl]);

  // Le Chad de la jaquette 3D suit le vainqueur affiché.
  useEffect(() => {
    sceneRef.current?.setWinner(phase === "over" ? (winner ?? null) : null);
  }, [phase, winner, mode]);

  // Le champ suit la largeur de son conteneur. En 2D, il passe à la verticale
  // sur un écran étroit ; en 3D, c'est la caméra qui se replace.
  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap || mode === "pending") return;
    const resize = () => {
      const width = wrap.clientWidth;
      const isPortrait = width < PORTRAIT_BELOW;
      setPortrait(isPortrait);
      const scene = sceneRef.current;
      const canvas3d = canvas3dRef.current;
      if (scene && canvas3d) {
        // Carré sur téléphone : assez haut pour la mêlée, sans avaler la page.
        const height = Math.round(isPortrait ? Math.min(width, PORTRAIT_MAX_H) : Math.min(width * 0.52, 640));
        canvas3d.style.width = `${width}px`;
        canvas3d.style.height = `${height}px`;
        scene.resize(width, height);
        return;
      }
      const canvas = canvasRef.current;
      if (!canvas) return;
      // À la verticale, le champ ferait près de 800 px de haut sur un
      // téléphone, vides pour moitié : on le plafonne, quitte à le rétrécir.
      const scale = isPortrait ? Math.min(width / FIELD_H, PORTRAIT_MAX_H / FIELD_W) : width / FIELD_W;
      const canvasW = (isPortrait ? FIELD_H : FIELD_W) * scale;
      const height = (isPortrait ? FIELD_W : FIELD_H) * scale;
      const dpr = window.devicePixelRatio || 1;
      canvas.width = Math.round(canvasW * dpr);
      canvas.height = Math.round(height * dpr);
      canvas.style.width = `${canvasW}px`;
      canvas.style.height = `${height}px`;
      viewRef.current = { scale, portrait: isPortrait, dpr };
      paint();
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(wrap);
    return () => observer.disconnect();
  }, [paint, mode]);

  // Hors de l'écran, la scène ne se redessine plus.
  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(([entry]) => {
      visibleRef.current = entry.isIntersecting;
    });
    observer.observe(wrap);
    return () => observer.disconnect();
  }, []);

  // Une seule boucle : le moteur n'avance que pendant la bataille, mais la 3D
  // continue de vivre — caméra qui tourne, étincelles qui retombent.
  useEffect(() => {
    if (mode === "pending") return;
    let frame = 0;
    let raf = 0;
    const loop = () => {
      raf = requestAnimationFrame(loop);
      const state = stateRef.current;
      if (!state) return;
      const events: BattleEvent[] = [];
      const running = phaseRef.current === "running";
      if (running) {
        for (let i = 0; i < speedRef.current && !state.over; i++) events.push(...step(state));
      }
      if (visibleRef.current) {
        const scene = sceneRef.current;
        if (scene) {
          scene.frame(state, events);
        } else if (running || particlesRef.current.length > 0) {
          spawn(particlesRef.current, events, fxRandom.current);
          const particles = particlesRef.current;
          for (const p of particles) {
            p.x += p.vx;
            p.y += p.vy;
            p.vx *= 0.92;
            p.vy *= p.text ? 1 : 0.92;
            p.life--;
          }
          particlesRef.current = particles.filter((p) => p.life > 0);
          paint();
        }
      }
      if (running) {
        if (++frame % 6 === 0) syncTallies();
        if (state.over) {
          syncTallies();
          setWinner(state.winner);
          setPhase("over");
          phaseRef.current = "over";
        }
      }
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [mode, paint, syncTallies]);

  // Les chances, calculées à l'aveugle par paquets pour ne pas geler la page.
  useEffect(() => {
    let cancelled = false;
    const total: Odds = { left: 0, right: 0, draws: 0, runs: 0 };
    const chunk = (from: number) => {
      if (cancelled) return;
      const part = computeOdds(left.spec, right.spec, 4, from);
      total.left += part.left;
      total.right += part.right;
      total.draws += part.draws;
      total.runs += part.runs;
      if (total.runs >= ODDS_RUNS) setOdds({ ...total });
      else setTimeout(() => chunk(from + 4), 0);
    };
    const start = setTimeout(() => chunk(1), 50);
    return () => {
      cancelled = true;
      clearTimeout(start);
    };
  }, [left.spec, right.spec]);

  function reset(nextSeed: number) {
    setSeed(nextSeed);
    setWinner(undefined);
    setTallies({
      left: { ...EMPTY_TALLY, standing: left.spec.troops },
      right: { ...EMPTY_TALLY, standing: right.spec.troops },
    });
    setPhase("ready");
    // Rejouer la même graine ne change aucune dépendance : on redéploie ici.
    stateRef.current = createBattle(left.spec, right.spec, nextSeed);
    particlesRef.current = [];
    if (sceneRef.current) sceneRef.current.load(stateRef.current);
    else paint();
    // La graine va dans l'URL : le lien copié rejoue cette bataille-là.
    const url = `${battleHref(left.fighter.appId, right.fighter.appId, "/battle-2")}&seed=${nextSeed}`;
    window.history.replaceState(null, "", url);
  }

  function skipToEnd() {
    const state = stateRef.current;
    if (!state) return;
    while (!state.over) step(state);
    particlesRef.current = [];
    if (!sceneRef.current) paint();
    syncTallies();
    setWinner(state.winner);
    setPhase("over");
    phaseRef.current = "over";
  }

  async function copyLink() {
    try {
      const url = `${window.location.origin}${battleHref(left.fighter.appId, right.fighter.appId, "/battle-2")}&seed=${seed}`;
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // Presse-papiers refusé : l'adresse de la page porte déjà la graine.
    }
  }

  const go = (l: number, r: number) => startNavigation(() => router.push(battleHref(l, r, "/battle-2")));

  const over = phase === "over";
  const total = tallies.left.standing + tallies.right.standing;
  const leftShare = total > 0 ? (tallies.left.standing / total) * 100 : 50;
  const winnerSheet = winner === "left" ? left : winner === "right" ? right : null;
  const winnerOdds = odds && winner ? odds[winner] / odds.runs : null;

  const btn =
    "rounded-full border border-[#24333f] bg-[#0c1116]/60 px-4 py-1.5 text-sm font-semibold text-[#cfdae1] hover:border-white/30 disabled:opacity-40";

  return (
    <div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Sheet side="left" sheet={left} winner={over && winner === "left"} onPick={(id) => go(id, right.fighter.appId)} busy={isNavigating} />
        <Sheet side="right" sheet={right} winner={over && winner === "right"} onPick={(id) => go(left.fighter.appId, id)} busy={isNavigating} />
      </div>

      {/* Le HUD : ce qui tient encore debout de chaque côté. */}
      <div className="mt-6 grid grid-cols-2 items-end gap-x-4 gap-y-3 font-mono sm:grid-cols-[1fr_auto_1fr]">
        {(["left", "right"] as const).map((side) => (
          <div key={side} className={side === "right" ? "text-right sm:order-3" : "sm:order-1"}>
            <div className="text-[26px] leading-none" style={{ color: SIDE_VAR[side] }}>
              {tallies[side].standing}
              <span className="text-sm text-[#5f7481]">/{(side === "left" ? left : right).spec.troops}</span>
            </div>
            <div className="mt-1 text-[10px] tracking-[0.1em] text-[#7d919c] uppercase">
              {tallies[side].dead} fallen · {tallies[side].fled} refunded
            </div>
          </div>
        ))}
        <div className="col-span-2 flex justify-center gap-1 sm:order-2 sm:col-span-1" role="group" aria-label="Speed">
          {SPEEDS.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setSpeed(s)}
              aria-pressed={speed === s}
              className={`rounded-full px-2.5 py-1 text-[10px] tracking-[0.1em] uppercase ${
                speed === s ? "bg-[#24333f] text-[#eef2f4]" : "text-[#7d919c] hover:text-[#eef2f4]"
              }`}
            >
              {s}×
            </button>
          ))}
        </div>
      </div>
      <div className="mt-2 flex h-2 overflow-hidden rounded-[2px] bg-[#05080b]" aria-hidden>
        <div className="h-full transition-[width] duration-300" style={{ width: `${leftShare}%`, backgroundColor: SIDE_VAR.left }} />
        <div className="h-full flex-1" style={{ backgroundColor: SIDE_VAR.right }} />
      </div>

      <div ref={wrapRef} className="relative mt-3 overflow-hidden rounded-md border border-[#1e2b36] bg-[#0a0f14]">
        {/* Deux canvas : un contexte WebGL ne peut plus redevenir 2D. */}
        <canvas
          ref={canvas3dRef}
          className={`block cursor-grab touch-pan-y active:cursor-grabbing ${mode === "3d" ? "" : "hidden"}`}
          role="img"
          aria-label={`${left.fighter.name}'s army of ${left.spec.troops} against ${right.fighter.name}'s army of ${right.spec.troops}, in 3D. Drag to rotate.`}
        />
        <canvas
          ref={canvasRef}
          className={`mx-auto block ${mode === "2d" ? "" : "hidden"}`}
          role="img"
          aria-label={`${left.fighter.name}'s army of ${left.spec.troops} against ${right.fighter.name}'s army of ${right.spec.troops}`}
        />
        {mode === "pending" && <div className="aspect-[2/1] w-full animate-pulse bg-white/5" />}
        {mode === "3d" && (
          <span className="pointer-events-none absolute top-2 right-3 font-mono text-[9px] tracking-[0.12em] text-[#5f7481] uppercase">
            drag to rotate
          </span>
        )}
        {portrait && mode === "2d" && (
          <>
            <span className="pointer-events-none absolute top-2 left-3 font-mono text-[10px] tracking-[0.12em] uppercase" style={{ color: SIDE_VAR.left }}>
              P1 · {left.fighter.name}
            </span>
            <span className="pointer-events-none absolute right-3 bottom-2 font-mono text-[10px] tracking-[0.12em] uppercase" style={{ color: SIDE_VAR.right }}>
              P2 · {right.fighter.name}
            </span>
          </>
        )}
        {phase === "ready" && mode !== "pending" && (
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-end gap-3 bg-gradient-to-t from-[#0c1116]/70 via-transparent to-transparent pb-8">
            <button
              type="button"
              onClick={() => setPhase("running")}
              className="pointer-events-auto rounded-full bg-gradient-to-r from-brand-blue to-brand-red px-7 py-3 text-lg font-black tracking-tight text-[#0c1116] shadow-[0_10px_40px_rgba(232,98,42,0.35)] transition-transform hover:scale-105"
            >
              Charge!
            </button>
            <span className="font-mono text-[10px] tracking-[0.12em] text-[#9fb2bd] uppercase">battle #{seed}</span>
          </div>
        )}
        {over && (
          <div className="pointer-events-none absolute inset-x-0 top-4 px-4 text-center">
            <div className="animate-battle-ko inline-block rounded-md border border-[#24333f] bg-[#0c1116]/85 px-5 py-3 backdrop-blur-sm">
              <div className="font-mono text-[10px] tracking-[0.2em] uppercase" style={{ color: winner ? SIDE_VAR[winner] : "#fab219" }}>
                {winner ? "victory" : "mutual destruction"}
              </div>
              <div className="mt-1 text-xl font-black tracking-tight sm:text-3xl">
                {winnerSheet ? `${winnerSheet.fighter.name} holds the field` : "Nobody is left standing"}
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
        {phase === "running" && (
          <button type="button" onClick={() => setPhase("paused")} className={btn}>
            Pause
          </button>
        )}
        {phase === "paused" && (
          <button type="button" onClick={() => setPhase("running")} className={btn}>
            Resume
          </button>
        )}
        {(phase === "running" || phase === "paused") && (
          <button type="button" onClick={skipToEnd} className={btn}>
            Skip to the end
          </button>
        )}
        {over && (
          <>
            <button type="button" onClick={() => reset(seed)} className="rounded-full bg-brand-blue px-4 py-1.5 text-sm font-bold text-[#0c1116]">
              Replay this battle
            </button>
            <button type="button" onClick={() => reset(randomSeed())} className={btn}>
              🎲 New battle
            </button>
            <button type="button" onClick={copyLink} className={btn}>
              {copied ? "Link copied ✓" : "Copy link"}
            </button>
          </>
        )}
      </div>

      {/* La bataille affichée n'est qu'un tirage : les chances disent ce que
          valent vraiment les deux armées. */}
      <div className="mx-auto mt-6 max-w-[640px] rounded-md border border-[#1e2b36] bg-[#0a0f14] px-5 py-4">
        <div className="flex items-baseline justify-between gap-3 font-mono text-[10px] tracking-[0.12em] text-[#7d919c] uppercase">
          <span>odds · {ODDS_RUNS} simulated battles</span>
          {odds && odds.draws > 0 && <span>{odds.draws} draws</span>}
        </div>
        {odds ? (
          <>
            <div className="mt-2 flex items-baseline justify-between font-mono text-lg">
              <span style={{ color: SIDE_VAR.left }}>{Math.round((odds.left / odds.runs) * 100)}%</span>
              <span style={{ color: SIDE_VAR.right }}>{Math.round((odds.right / odds.runs) * 100)}%</span>
            </div>
            <div className="mt-1.5 flex h-1.5 overflow-hidden rounded-[2px] bg-[#24333f]">
              <div style={{ width: `${(odds.left / odds.runs) * 100}%`, backgroundColor: SIDE_VAR.left }} />
              <div className="flex-1" />
              <div style={{ width: `${(odds.right / odds.runs) * 100}%`, backgroundColor: SIDE_VAR.right }} />
            </div>
            <p className="mt-3 text-sm text-[#cfdae1]">
              {!over || !winnerSheet || winnerOdds === null
                ? "Same armies, different dice: each battle plays out differently."
                : winnerOdds < 0.5
                  ? `Upset! ${winnerSheet.fighter.name} only wins ${Math.round(winnerOdds * 100)}% of the time.`
                  : winnerOdds >= 0.9
                    ? `No surprise: ${winnerSheet.fighter.name} wins ${odds[winner!]} out of ${odds.runs}.`
                    : `${winnerSheet.fighter.name} was the favourite, and it showed.`}
            </p>
          </>
        ) : (
          <div className="mt-2 h-[58px] animate-pulse rounded bg-white/5" />
        )}
      </div>
    </div>
  );
}
