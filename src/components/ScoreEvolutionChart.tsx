"use client";

import { useLayoutEffect, useRef, useState } from "react";
import type { GameEvent, GameReviewTrend } from "@/lib/data/types";

type ScoreEvolutionChartProps = {
  trends: GameReviewTrend[];
  events?: GameEvent[];
};

const WIDTH = 640;
// Hauteur plancher du viewBox, et seul ratio connu du serveur : le graphe
// occupe 640x220 tant que la carte n'a pas été mesurée. Au-delà, la hauteur
// suit celle du conteneur — voir useChartHeight().
const BASE_HEIGHT = 220;
const PADDING = 24;

// Demi-largeur de la zone qui capte le survol d'un repère. Les barres font 1 px
// de large : sans marge autour, il faudrait viser au pixel près.
const EVENT_HIT_RADIUS = 5;

const EVENT_STYLES = {
  update: { color: "var(--series-2)", label: "Update" },
  news: { color: "var(--ink-muted)", label: "News" },
} as const;

function formatMonth(periodMonth: string): string {
  return new Date(periodMonth).toLocaleDateString("en-US", { month: "short", year: "numeric" });
}

// Cinq repères sous la courbe, pas un par mois : le graphe couvre parfois
// soixante-dix mois, et autant d'étiquettes ne se lisent plus. Ils tombent sur
// des points réels (premier, dernier, et trois entre les deux), d'où l'indice
// rendu avec le libellé : l'arrondi ne donne pas des indices régulièrement
// espacés (douze points donnent 0, 3, 6, 8, 11), donc seule la position du
// point lui-même place l'étiquette au bon endroit.
const TICK_COUNT = 5;

function monthTicks(trends: GameReviewTrend[]): { index: number; label: string }[] {
  if (trends.length < 2) return [];

  const count = Math.min(TICK_COUNT, trends.length);
  const last = trends.length - 1;
  const indices = new Set(Array.from({ length: count }, (_, i) => Math.round((i * last) / (count - 1))));

  return [...indices].map((index) => ({
    index,
    label: new Date(`${trends[index].periodMonth}T00:00:00Z`).toLocaleDateString("en-US", {
      timeZone: "UTC",
      month: "short",
      year: "2-digit",
    }),
  }));
}

function formatDay(startedOn: string): string {
  return new Date(startedOn).toLocaleDateString("en-US", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function startOfNextMonth(time: number): number {
  const date = new Date(time);
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1);
}

/**
 * Où tombe une annonce sur un axe qui n'est pas temporel : les mois sont espacés
 * régulièrement et ceux sans review sont simplement absents. On rend donc une
 * position fractionnaire entre les deux mois qui encadrent la date, et `null`
 * pour ce qui sort de la plage couverte par la courbe.
 */
export function eventPosition(startedOn: string, monthTimes: number[]): number | null {
  const time = Date.parse(`${startedOn}T00:00:00Z`);
  if (Number.isNaN(time) || monthTimes.length === 0 || time < monthTimes[0]) return null;

  const last = monthTimes.length - 1;
  for (let i = 0; i < last; i += 1) {
    if (time < monthTimes[i + 1]) {
      return i + (time - monthTimes[i]) / (monthTimes[i + 1] - monthTimes[i]);
    }
  }

  // Passé le dernier point il n'y a plus de segment sur lequel interpoler : on
  // garde ce qui tombe dans son mois, on écarte ce qui vient après.
  return time < startOfNextMonth(monthTimes[last]) ? last : null;
}

// Les annonces embarquent des images de n'importe quel hôte (Steam, mais aussi
// imgur, blogspot, le CDN de l'éditeur…) et un bon quart d'entre elles sont en
// http, que le navigateur bloquerait sur steam.reviews. On n'affiche donc que
// les https, en <img> brut : passer un domaine ouvert par l'optimiseur d'images
// de Next reviendrait à héberger un proxy public.
function usableImage(imageUrl: string | null): string | null {
  return imageUrl?.startsWith("https://") ? imageUrl : null;
}

/**
 * Hauteur du viewBox, en unités utilisateur, pour que le dessin remplisse
 * exactement le cadre que le flex lui donne. La carte est étirée par la grille
 * à la hauteur de sa voisine (Languages), hauteur qu'aucun rendu serveur ne
 * connaît : sans cette mesure, le graphe garde son ratio 640x220 et laisse le
 * reste de la carte vide.
 *
 * On garde `WIDTH` fixe et on n'ajuste que la hauteur : l'échelle reste donc
 * uniforme (pas de `preserveAspectRatio="none"`), les traits gardent leur
 * épaisseur et les points restent ronds.
 */
function useChartHeight(frameRef: React.RefObject<HTMLDivElement | null>): number {
  const [height, setHeight] = useState(BASE_HEIGHT);

  useLayoutEffect(() => {
    const frame = frameRef.current;
    if (!frame) return;

    const observer = new ResizeObserver(([entry]) => {
      const { width, height: pixelHeight } = entry.contentRect;
      if (width === 0) return;
      // Le cadre a un `aspect-[640/220]` en plancher, donc la mesure ne
      // descend pas sous BASE_HEIGHT ; le max couvre les états transitoires.
      setHeight(Math.max(BASE_HEIGHT, (WIDTH * pixelHeight) / width));
    });

    observer.observe(frame);
    return () => observer.disconnect();
  }, [frameRef]);

  return height;
}

export function ScoreEvolutionChart({ trends, events = [] }: ScoreEvolutionChartProps) {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const [hoverGid, setHoverGid] = useState<string | null>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const height = useChartHeight(frameRef);

  if (trends.length === 0) {
    return <p className="text-sm text-neutral-400">Not enough data yet.</p>;
  }

  const plotWidth = WIDTH - PADDING * 2;
  const plotHeight = height - PADDING * 2;
  const stepX = trends.length > 1 ? plotWidth / (trends.length - 1) : 0;

  const points = trends.map((trend, index) => ({
    x: PADDING + index * stepX,
    y: PADDING + plotHeight * (1 - trend.pctPositivePeriod),
    trend,
  }));

  const linePath = points.map((p, i) => `${i === 0 ? "M" : "L"}${p.x},${p.y}`).join(" ");
  const lastIndex = points.length - 1;

  const monthTimes = trends.map((trend) => Date.parse(`${trend.periodMonth}T00:00:00Z`));
  const markers = events.flatMap((event) => {
    const position = eventPosition(event.startedOn, monthTimes);
    return position === null ? [] : [{ event, x: PADDING + position * stepX }];
  });

  const legend = (["update", "news"] as const).filter((category) =>
    markers.some((marker) => marker.event.category === category),
  );

  const ticks = monthTicks(trends);

  function handlePointerMove(event: React.PointerEvent<SVGRectElement>) {
    const svg = event.currentTarget.ownerSVGElement;
    if (!svg) return;
    const svgBounds = svg.getBoundingClientRect();
    if (svgBounds.width === 0) return;
    const xInViewBox = ((event.clientX - svgBounds.left) / svgBounds.width) * WIDTH;
    const index = Math.round((xInViewBox - PADDING) / stepX);
    setHoverIndex(Math.min(Math.max(index, 0), lastIndex));
  }

  const hoveredMarker = markers.find((marker) => marker.event.gid === hoverGid) ?? null;
  // Les zones de survol des events sont posées par-dessus celle des mois, donc
  // elles gagnent le pointeur — mais le dernier mois survolé reste en mémoire.
  // On l'efface tant qu'un repère est actif : jamais les deux infobulles.
  const hovered = hoveredMarker === null && hoverIndex !== null ? points[hoverIndex] : null;

  // Dots are reserved for the current point and the hovered point — not every
  // point, or 70 monthly dots read as noise instead of a trend.
  const markedIndices = new Set(
    [lastIndex, hovered ? hoverIndex : null].filter((i): i is number => i !== null && i >= 0),
  );

  const tooltipAnchor = (x: number) =>
    x <= WIDTH / 2 ? { left: `${(x / WIDTH) * 100}%` } : { right: `${100 - (x / WIDTH) * 100}%` };

  return (
    <div className="relative flex grow flex-col">
      {/* Le cadre porte la hauteur : `aspect-[640/220]` en base, `grow` pour
          prendre la place que la carte a en trop. Le SVG le remplit en absolu,
          ce qui évite une hauteur en pourcentage sur un parent en aspect-ratio. */}
      <div ref={frameRef} className="relative aspect-[640/220] w-full grow">
        <svg
          viewBox={`0 0 ${WIDTH} ${height}`}
          role="img"
          aria-label="Positive score over time"
          className="absolute inset-0 h-full w-full"
        >
          {[0, 0.5, 1].map((fraction) => (
            <line
              key={fraction}
              x1={PADDING}
              x2={WIDTH - PADDING}
              y1={PADDING + plotHeight * (1 - fraction)}
              y2={PADDING + plotHeight * (1 - fraction)}
              stroke="var(--gridline)"
              strokeWidth={1}
            />
          ))}

          {markers.map(({ event, x }) => (
            <line
              key={event.gid}
              data-event-gid={event.gid}
              x1={x}
              x2={x}
              y1={PADDING}
              y2={height - PADDING}
              stroke={EVENT_STYLES[event.category].color}
              strokeWidth={hoverGid === event.gid ? 2 : 1}
              strokeDasharray="4 4"
              opacity={hoverGid === event.gid ? 1 : 0.65}
            />
          ))}

          <path d={linePath} fill="none" stroke="var(--series-1)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />

          {points.map((p, i) =>
            markedIndices.has(i) ? (
              <circle
                key={p.trend.periodMonth}
                cx={p.x}
                cy={p.y}
                r={5}
                fill="var(--series-1)"
                stroke="var(--chart-surface)"
                strokeWidth={2}
              />
            ) : null,
          )}

          {hovered && (
            <line
              x1={hovered.x}
              x2={hovered.x}
              y1={PADDING}
              y2={height - PADDING}
              stroke="var(--ink-secondary)"
              strokeWidth={1}
              strokeDasharray="3 3"
            />
          )}

          <rect
            data-month-hit=""
            x={PADDING}
            y={0}
            width={plotWidth}
            height={height}
            fill="transparent"
            onPointerMove={handlePointerMove}
            onPointerLeave={() => setHoverIndex(null)}
          />

          {markers.map(({ event, x }) => (
            <rect
              key={event.gid}
              data-event-hit={event.gid}
              x={x - EVENT_HIT_RADIUS}
              y={0}
              width={EVENT_HIT_RADIUS * 2}
              height={height}
              fill="transparent"
              onPointerEnter={() => setHoverGid(event.gid)}
              onPointerLeave={() => setHoverGid(null)}
            />
          ))}
        </svg>
      </div>

      {ticks.length > 0 && (
        // Chaque étiquette est posée sur l'abscisse de son point, centrée
        // dessus, et non répartie à intervalle régulier : le bloc a donc une
        // hauteur explicite, ses enfants étant tous en absolu.
        <div className="relative mt-1.5 h-3.5 font-mono text-[10px] tracking-[0.1em] text-[#5f7481] uppercase">
          {ticks.map((tick) => (
            <span
              key={tick.index}
              className="absolute -translate-x-1/2 whitespace-nowrap"
              style={{ left: `${((PADDING + tick.index * stepX) / WIDTH) * 100}%` }}
            >
              {tick.label}
            </span>
          ))}
        </div>
      )}

      {legend.length > 0 && (
        <ul className="mt-2 flex gap-4 font-mono text-[10px] tracking-[0.1em] text-[#5f7481] uppercase">
          {legend.map((category) => (
            <li key={category} className="flex items-center gap-1.5">
              <svg width={18} height={8} aria-hidden className="shrink-0">
                <line
                  x1={0}
                  x2={18}
                  y1={4}
                  y2={4}
                  stroke={EVENT_STYLES[category].color}
                  strokeWidth={2}
                  strokeDasharray="4 4"
                />
              </svg>
              {EVENT_STYLES[category].label}
            </li>
          ))}
        </ul>
      )}

      {hoveredMarker && (
        <div
          data-testid="event-tooltip"
          className="pointer-events-none absolute top-0 z-10 w-56 rounded-md border bg-black/90 p-2 text-xs text-white shadow-lg"
          style={{
            ...tooltipAnchor(hoveredMarker.x),
            borderColor: hoveredMarker.event.isWellReceived
              ? "var(--status-good)"
              : "var(--status-critical)",
          }}
        >
          {usableImage(hoveredMarker.event.imageUrl) && (
            // Hôtes non maîtrisés, donc pas de next/image : voir usableImage().
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={usableImage(hoveredMarker.event.imageUrl) as string}
              alt=""
              className="mb-2 h-20 w-full rounded object-cover"
            />
          )}
          <p className="font-semibold leading-snug">{hoveredMarker.event.headline}</p>
          <p className="mt-0.5 text-neutral-400">
            {EVENT_STYLES[hoveredMarker.event.category].label} · {formatDay(hoveredMarker.event.startedOn)}
          </p>
          {!hoveredMarker.event.isWellReceived && (
            // Sans ce chiffre, le contour rouge ne dit pas de combien l'annonce
            // a été rejetée : 26 % et 92 % de votes négatifs s'affichent pareil.
            <p className="mt-1 font-medium text-[color:var(--status-critical)]">
              {Math.round(hoveredMarker.event.pctNegative * 100)}% negative votes
            </p>
          )}
          <p className="mt-1 flex gap-3 text-neutral-300">
            <span className="flex items-center gap-1" title="Upvotes">
              <span aria-hidden>▲</span>
              <span>{hoveredMarker.event.votesUp}</span>
            </span>
            <span className="flex items-center gap-1" title="Downvotes">
              <span aria-hidden>▼</span>
              <span>{hoveredMarker.event.votesDown}</span>
            </span>
            <span className="flex items-center gap-1" title="Comments">
              <span aria-hidden>💬</span>
              <span>{hoveredMarker.event.commentCount}</span>
            </span>
          </p>
        </div>
      )}

      {hovered && (
        <div
          data-testid="month-tooltip"
          className="pointer-events-none absolute top-0 rounded-md border border-white/10 bg-black/90 px-2 py-1 text-xs text-white"
          style={tooltipAnchor(hovered.x)}
        >
          <div className="font-semibold">{Math.round(hovered.trend.pctPositivePeriod * 100)}%</div>
          <div className="text-neutral-400">{formatMonth(hovered.trend.periodMonth)}</div>
        </div>
      )}
    </div>
  );
}
