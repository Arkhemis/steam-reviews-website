"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { getSteamRating } from "@/lib/steamRating";

// « Review Bomb Defense » : le mini-jeu de la page 404. La page introuvable
// a une note Steam, et le joueur a une semaine de lancement — soixante
// secondes — pour la faire remonter : attraper un pouce levé ajoute des avis
// positifs (plus la série est longue, plus il en rapporte), un pouce baissé en
// ajoute une salve de négatifs et casse la série, un trophée en rapporte une
// poignée d'un coup. Le verdict final reprend les libellés de Steam.
//
// La boucle vit dans un `requestAnimationFrame` et ne touche jamais React à
// chaque image : l'état du jeu est dans une ref, et seul le tableau de bord
// (avis, série, temps) remonte dans le state, quand il change.

const DURATION_S = 60;
const HEIGHT = 440;
const PADDLE_W = 112;
const PADDLE_H = 16;
const DROP_SIZE = 30;
const DOWN_PENALTY = 5;
const TROPHY_BONUS = 25;
// Sous ce plancher, la page est « delistée » avant la fin du chrono : assez
// d'avis pour que le score ne soit pas du bruit, et un score vraiment mauvais.
const DELIST_MIN_REVIEWS = 30;
const DELIST_PCT = 0.2;
const BEST_KEY = "steam-reviews:404-best";
const BEST_EVENT = "steam-reviews:404-best-changed";

// Le pouce de Material Symbols, dessiné dans une boîte de 24 × 24.
const THUMB_PATH =
  "M1 21h4V9H1v12zm22-11c0-1.1-.9-2-2-2h-6.31l.95-4.57.03-.32c0-.41-.17-.79-.44-1.06L14.17 1 7.59 7.59C7.22 7.95 7 8.45 7 9v10c0 1.1.9 2 2 2h9c.83 0 1.54-.5 1.84-1.22l3.02-7.05c.09-.23.14-.47.14-.73v-2z";

type DropKind = "up" | "down" | "trophy";

type Drop = { x: number; y: number; vy: number; spin: number; angle: number; kind: DropKind };

type Particle = { x: number; y: number; vx: number; vy: number; life: number; color: string; text?: string };

type Phase = "idle" | "playing" | "over";

type Hud = { positive: number; negative: number; streak: number; timeLeft: number };

type Outcome = { positive: number; negative: number; delisted: boolean };

const EMPTY_HUD: Hud = { positive: 0, negative: 0, streak: 0, timeLeft: DURATION_S };

const enFull = new Intl.NumberFormat("en-US");

/** Le multiplicateur de la série : +1 tous les cinq pouces levés d'affilée, plafonné à ×5. */
function multiplier(streak: number): number {
  return Math.min(5, 1 + Math.floor(streak / 5));
}

function readBest(): number {
  try {
    return Number(window.localStorage.getItem(BEST_KEY)) || 0;
  } catch {
    return 0;
  }
}

function writeBest(value: number) {
  try {
    window.localStorage.setItem(BEST_KEY, String(value));
    window.dispatchEvent(new Event(BEST_EVENT));
  } catch {
    // Navigation privée ou stockage bloqué : le record n'est qu'un confort.
  }
}

// Le record vit dans le navigateur : le serveur rend 0, puis le client lit le
// stockage et suit ses changements, y compris depuis un autre onglet.
function subscribeBest(onChange: () => void) {
  window.addEventListener("storage", onChange);
  window.addEventListener(BEST_EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(BEST_EVENT, onChange);
  };
}

/** Le score qu'on garde en record : les avis positifs, pondérés par la note. */
function runScore({ positive, negative }: Pick<Outcome, "positive" | "negative">): number {
  const total = positive + negative;
  return total === 0 ? 0 : Math.round(positive * (positive / total));
}

function verdictLine(outcome: Outcome): string {
  if (outcome.delisted) return "Valve delisted your page. The review bombers won this round.";
  const total = outcome.positive + outcome.negative;
  const pct = total === 0 ? 0 : outcome.positive / total;
  if (total === 0) return "Zero reviews. Not even a refund request. Impressive, in a way.";
  if (pct >= 0.8 && total >= 500) return "Overwhelmingly Positive. The page still doesn't exist, but people love it.";
  if (pct >= 0.8) return "Great score — now get it past 500 reviews for the Overwhelmingly badge.";
  if (pct >= 0.7) return "Solid launch. A few haters, but the Steam Deck crowd is on board.";
  if (pct >= 0.4) return "Mixed. Somewhere, a forum thread titled \"is this page dead?\" is 40 pages long.";
  return "The review bombers are celebrating. Try dodging the thumbs down this time.";
}

export function ReviewBombGame() {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const [hud, setHud] = useState<Hud>(EMPTY_HUD);
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const best = useSyncExternalStore(subscribeBest, readBest, () => 0);

  // L'état mutable de la partie : lu et écrit par la boucle, jamais rendu.
  const game = useRef({
    width: 640,
    paddleX: 320,
    targetX: 320,
    keys: { left: false, right: false },
    drops: [] as Drop[],
    particles: [] as Particle[],
    positive: 0,
    negative: 0,
    streak: 0,
    elapsed: 0,
    spawnIn: 0,
    shake: 0,
    flash: 0,
    running: false,
  });

  // Le canvas suit la largeur de son conteneur, à la densité de l'écran.
  useEffect(() => {
    const wrap = wrapRef.current;
    const canvas = canvasRef.current;
    if (!wrap || !canvas) return;

    const resize = () => {
      const width = wrap.clientWidth;
      const dpr = window.devicePixelRatio || 1;
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(HEIGHT * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${HEIGHT}px`;
      const g = game.current;
      const ratio = width / g.width;
      g.paddleX *= ratio;
      g.targetX *= ratio;
      g.width = width;
    };

    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(wrap);
    return () => observer.disconnect();
  }, []);

  const start = useCallback(() => {
    const g = game.current;
    Object.assign(g, {
      paddleX: g.width / 2,
      targetX: g.width / 2,
      drops: [],
      particles: [],
      positive: 0,
      negative: 0,
      streak: 0,
      elapsed: 0,
      spawnIn: 0.4,
      shake: 0,
      flash: 0,
      running: true,
    });
    setHud(EMPTY_HUD);
    setOutcome(null);
    setPhase("playing");
    canvasRef.current?.focus();
  }, []);

  // Clavier : flèches, A/D ou Q/D (AZERTY).
  useEffect(() => {
    const g = game.current;
    const onKey = (event: KeyboardEvent, down: boolean) => {
      // Laisse la saisie et la navigation au curseur intactes dans les champs de la page.
      const target = event.target;
      if (
        target instanceof HTMLElement &&
        (target.isContentEditable || target.closest("input, textarea, select, [contenteditable]"))
      )
        return;
      const key = event.key.toLowerCase();
      if (key === "arrowleft" || key === "a" || key === "q") g.keys.left = down;
      else if (key === "arrowright" || key === "d") g.keys.right = down;
      else return;
      if (g.running) event.preventDefault();
    };
    const onDown = (event: KeyboardEvent) => onKey(event, true);
    const onUp = (event: KeyboardEvent) => onKey(event, false);
    window.addEventListener("keydown", onDown);
    window.addEventListener("keyup", onUp);
    return () => {
      window.removeEventListener("keydown", onDown);
      window.removeEventListener("keyup", onUp);
    };
  }, []);

  // La boucle de jeu, montée une fois : elle dessine aussi l'écran d'attente,
  // où des pouces tombent sans raquette, pour que le cadre ne soit jamais vide.
  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    const styles = getComputedStyle(document.documentElement);
    const good = styles.getPropertyValue("--status-good").trim() || "#0ca30c";
    const bad = styles.getPropertyValue("--status-critical").trim() || "#d03b3b";
    const gold = styles.getPropertyValue("--status-warning").trim() || "#fab219";
    const thumb = new Path2D(THUMB_PATH);
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const g = game.current;
    let raf = 0;
    let last = performance.now();
    let lastSecond = -1;

    const burst = (x: number, y: number, color: string, count: number, text?: string) => {
      for (let i = 0; i < count; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = 60 + Math.random() * 180;
        g.particles.push({ x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed - 80, life: 0.7, color });
      }
      if (text) g.particles.push({ x, y: y - 10, vx: 0, vy: -60, life: 1, color, text });
    };

    const pushHud = () => {
      setHud({
        positive: g.positive,
        negative: g.negative,
        streak: g.streak,
        timeLeft: Math.max(0, Math.ceil(DURATION_S - g.elapsed)),
      });
    };

    const finish = (delisted: boolean) => {
      g.running = false;
      g.keys.left = g.keys.right = false;
      const result = { positive: g.positive, negative: g.negative, delisted };
      const score = runScore(result);
      if (score > readBest()) writeBest(score);
      pushHud();
      setOutcome(result);
      setPhase("over");
    };

    const spawn = (progress: number) => {
      // Plus la semaine avance, plus les review bombers s'organisent.
      const roll = Math.random();
      const downShare = 0.25 + progress * 0.3;
      const kind: DropKind = roll < 0.04 ? "trophy" : roll < 0.04 + downShare ? "down" : "up";
      const margin = DROP_SIZE;
      g.drops.push({
        kind,
        x: margin + Math.random() * Math.max(1, g.width - margin * 2),
        y: -DROP_SIZE,
        vy: 140 + progress * 220 + Math.random() * 80,
        spin: (Math.random() - 0.5) * (reduceMotion ? 0 : 3),
        angle: 0,
      });
    };

    const step = (dt: number) => {
      const progress = Math.min(1, g.elapsed / DURATION_S);

      if (g.running) {
        g.elapsed += dt;
        const speed = 620;
        if (g.keys.left) g.targetX -= speed * dt;
        if (g.keys.right) g.targetX += speed * dt;
        g.targetX = Math.max(PADDLE_W / 2, Math.min(g.width - PADDLE_W / 2, g.targetX));
        g.paddleX += (g.targetX - g.paddleX) * Math.min(1, dt * 18);
      }

      g.spawnIn -= dt;
      // Pas de pluie décorative à l'arrêt quand l'utilisateur limite les animations.
      if (g.spawnIn <= 0 && (g.running || !reduceMotion)) {
        spawn(g.running ? progress : 0.1);
        const base = g.running ? 0.75 - progress * 0.5 : 0.9;
        g.spawnIn = base * (0.6 + Math.random() * 0.8);
      }

      const paddleTop = HEIGHT - 34;
      for (const drop of g.drops) {
        drop.y += drop.vy * dt;
        drop.angle += drop.spin * dt;
        if (!g.running) continue;
        const hit =
          drop.y + DROP_SIZE / 2 >= paddleTop &&
          drop.y - DROP_SIZE / 2 <= paddleTop + PADDLE_H &&
          Math.abs(drop.x - g.paddleX) <= PADDLE_W / 2 + DROP_SIZE / 3;
        if (!hit) continue;
        drop.y = HEIGHT * 2; // retirée au filtrage ci-dessous
        if (drop.kind === "up") {
          const gain = multiplier(g.streak);
          g.positive += gain;
          g.streak += 1;
          burst(drop.x, paddleTop, good, 8, `+${gain}`);
        } else if (drop.kind === "trophy") {
          g.positive += TROPHY_BONUS;
          burst(drop.x, paddleTop, gold, 24, `+${TROPHY_BONUS} AWARD`);
        } else {
          g.negative += DOWN_PENALTY;
          g.streak = 0;
          g.shake = reduceMotion ? 0 : 0.35;
          g.flash = 0.25;
          burst(drop.x, paddleTop, bad, 14, `−${DOWN_PENALTY} REVIEW BOMB`);
        }
        pushHud();
      }
      g.drops = g.drops.filter((drop) => drop.y < HEIGHT + DROP_SIZE);

      for (const p of g.particles) {
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        if (!p.text) p.vy += 420 * dt;
        p.life -= dt;
      }
      g.particles = g.particles.filter((p) => p.life > 0);
      g.shake = Math.max(0, g.shake - dt);
      g.flash = Math.max(0, g.flash - dt);

      if (!g.running) return;
      const second = Math.floor(g.elapsed);
      if (second !== lastSecond) {
        lastSecond = second;
        pushHud();
      }
      const total = g.positive + g.negative;
      if (total >= DELIST_MIN_REVIEWS && g.positive / total < DELIST_PCT) finish(true);
      else if (g.elapsed >= DURATION_S) finish(false);
    };

    const drawThumb = (drop: Drop) => {
      ctx.save();
      ctx.translate(drop.x, drop.y);
      ctx.rotate(drop.angle + (drop.kind === "down" ? Math.PI : 0));
      if (drop.kind === "trophy") {
        ctx.fillStyle = gold;
        ctx.shadowColor = gold;
        ctx.shadowBlur = 18;
        ctx.beginPath();
        for (let i = 0; i < 10; i++) {
          const r = i % 2 === 0 ? DROP_SIZE / 2 : DROP_SIZE / 4.5;
          const a = (i * Math.PI) / 5 - Math.PI / 2;
          ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
        }
        ctx.closePath();
        ctx.fill();
      } else {
        const color = drop.kind === "up" ? good : bad;
        ctx.fillStyle = `${color}22`;
        ctx.strokeStyle = color;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.roundRect(-DROP_SIZE / 2 - 4, -DROP_SIZE / 2 - 4, DROP_SIZE + 8, DROP_SIZE + 8, 6);
        ctx.fill();
        ctx.stroke();
        ctx.scale(DROP_SIZE / 24 * 0.8, DROP_SIZE / 24 * 0.8);
        ctx.translate(-12, -12);
        ctx.fillStyle = color;
        ctx.fill(thumb);
      }
      ctx.restore();
    };

    const draw = () => {
      const dpr = canvas.width / g.width;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, g.width, HEIGHT);

      if (g.shake > 0) ctx.translate((Math.random() - 0.5) * 10 * g.shake * 3, (Math.random() - 0.5) * 10 * g.shake * 3);

      // Le quadrillage des graphes du site, en fond.
      ctx.strokeStyle = "#16202a";
      ctx.lineWidth = 1;
      for (let y = 40; y < HEIGHT; y += 40) {
        ctx.beginPath();
        ctx.moveTo(0, y + 0.5);
        ctx.lineTo(g.width, y + 0.5);
        ctx.stroke();
      }

      for (const drop of g.drops) drawThumb(drop);

      if (g.running) {
        const paddleTop = HEIGHT - 34;
        const left = g.paddleX - PADDLE_W / 2;
        const gradient = ctx.createLinearGradient(left, 0, left + PADDLE_W, 0);
        gradient.addColorStop(0, "#e8622a");
        gradient.addColorStop(1, "#ff7a45");
        ctx.fillStyle = gradient;
        ctx.shadowColor = "#e8622a";
        ctx.shadowBlur = multiplier(g.streak) > 1 ? 10 + multiplier(g.streak) * 4 : 0;
        ctx.beginPath();
        ctx.roundRect(left, paddleTop, PADDLE_W, PADDLE_H, 8);
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.fillStyle = "#000";
        ctx.font = "700 9px ui-monospace, monospace";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("404.EXE", g.paddleX, paddleTop + PADDLE_H / 2 + 0.5);
      }

      for (const p of g.particles) {
        ctx.globalAlpha = Math.max(0, Math.min(1, p.life * 1.6));
        ctx.fillStyle = p.color;
        if (p.text) {
          ctx.font = "700 13px ui-monospace, monospace";
          ctx.textAlign = "center";
          ctx.fillText(p.text, p.x, p.y);
        } else {
          ctx.fillRect(p.x - 2, p.y - 2, 4, 4);
        }
      }
      ctx.globalAlpha = 1;

      if (g.flash > 0) {
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.fillStyle = `rgba(208, 59, 59, ${g.flash})`;
        ctx.fillRect(0, 0, g.width, HEIGHT);
      }
    };

    const frame = (now: number) => {
      // Un onglet revenu de l'arrière-plan ne doit pas faire un bond d'une minute.
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      step(dt);
      draw();
      raf = requestAnimationFrame(frame);
    };

    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, []);

  // Souris et doigt : la raquette suit le pointeur tant qu'il est sur le canvas.
  const onPointer = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    game.current.targetX = event.clientX - rect.left;
  };

  const total = hud.positive + hud.negative;
  const pct = total === 0 ? 0 : hud.positive / total;
  const rating = total === 0 ? { label: "No user reviews", color: "var(--ink-muted)" } : getSteamRating(pct, total);

  return (
    <section aria-labelledby="game-title" className="overflow-hidden rounded-md border border-[#1e2b36] bg-[#0a0f14]">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-[#16202a] px-5 py-3">
        <div>
          <h2 id="game-title" className="text-lg font-black tracking-tight text-[#eef2f4]">
            Review Bomb Defense
          </h2>
          <p className="font-mono text-[10px] tracking-[0.12em] text-[#7d919c] uppercase">
            catch 👍 · dodge 👎 · grab ★ · {DURATION_S}s launch week
          </p>
        </div>
        <dl className="flex gap-5 font-mono text-[11px] text-[#7d919c] uppercase">
          <div>
            <dt className="tracking-[0.12em]">time</dt>
            <dd className={`text-lg leading-none ${hud.timeLeft <= 10 && phase === "playing" ? "text-[var(--status-critical)]" : "text-[#eef2f4]"}`}>
              {hud.timeLeft}s
            </dd>
          </div>
          <div>
            <dt className="tracking-[0.12em]">reviews</dt>
            <dd className="text-lg leading-none text-[#eef2f4]">{enFull.format(total)}</dd>
          </div>
          <div>
            <dt className="tracking-[0.12em]">combo</dt>
            <dd className="text-lg leading-none text-brand-red">×{multiplier(hud.streak)}</dd>
          </div>
          <div>
            <dt className="tracking-[0.12em]">best</dt>
            <dd className="text-lg leading-none text-[#eef2f4]">{enFull.format(best)}</dd>
          </div>
        </dl>
      </header>

      {/* Le verdict en direct, façon bandeau « All Reviews » de la boutique. */}
      <div className="flex flex-wrap items-baseline gap-x-2 border-b border-[#16202a] px-5 py-2 text-sm" aria-live="polite">
        <span className="text-[#7d919c]">This page&apos;s reviews:</span>
        <span className="font-bold" style={{ color: rating.color }}>
          {rating.label}
        </span>
        {total > 0 && (
          <span className="font-mono text-xs text-[#7d919c]">
            ({Math.round(pct * 100)}% of {enFull.format(total)})
          </span>
        )}
        <span className="ml-auto h-1.5 w-32 overflow-hidden rounded-full bg-[var(--status-critical)]/40">
          <span
            className="block h-full rounded-full bg-[var(--status-good)] transition-[width] duration-200"
            style={{ width: `${total === 0 ? 0 : pct * 100}%` }}
          />
        </span>
      </div>

      <div ref={wrapRef} className="relative">
        <canvas
          ref={canvasRef}
          tabIndex={0}
          role="img"
          aria-label="Review Bomb Defense game area. Use the arrow keys or your mouse to move the paddle."
          onPointerMove={onPointer}
          onPointerDown={onPointer}
          className="block touch-none outline-none"
        />

        {phase !== "playing" && (
          <div className="absolute inset-0 flex items-center justify-center bg-[#0a0f14]/75 p-6 backdrop-blur-[2px]">
            <div className="max-w-md text-center">
              {phase === "idle" ? (
                <>
                  <p className="font-mono text-[10px] tracking-[0.14em] text-brand-red uppercase">
                    early access · single player
                  </p>
                  <p className="mt-2 text-2xl font-black text-[#eef2f4]">
                    This page has no reviews yet. Fix that.
                  </p>
                  <p className="mt-2 text-sm text-[#a9b6bd]">
                    Every 👍 you catch is a positive review — chain them for a combo. Every 👎 is a review bomb
                    worth {DOWN_PENALTY} negatives. Hit 500 reviews at 80%+ to go Overwhelmingly Positive.
                  </p>
                </>
              ) : (
                outcome && (
                  <>
                    <p className="font-mono text-[10px] tracking-[0.14em] text-[#7d919c] uppercase">
                      {outcome.delisted ? "delisted" : "launch week is over"}
                    </p>
                    <p className="mt-2 text-3xl font-black" style={{ color: rating.color }}>
                      {outcome.delisted ? "Removed from Steam" : rating.label}
                    </p>
                    <p className="mt-2 text-sm text-[#a9b6bd]">{verdictLine(outcome)}</p>
                    <p className="mt-3 font-mono text-xs text-[#7d919c]">
                      score {enFull.format(runScore(outcome))} · best {enFull.format(best)}
                    </p>
                  </>
                )
              )}
              <button
                type="button"
                onClick={start}
                className="mt-5 rounded-full bg-gradient-to-r from-brand-blue to-brand-red px-6 py-2.5 font-bold text-black transition-transform hover:scale-105 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-red"
              >
                {phase === "idle" ? "▶ Play now — free" : "↻ Launch a sequel"}
              </button>
              <p className="mt-3 font-mono text-[10px] tracking-[0.12em] text-[#56656f] uppercase">
                ← → / A D · or move your mouse / finger
              </p>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
