import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ScoreEvolutionChart } from "@/components/ScoreEvolutionChart";
import type { GameEvent, GameReviewTrend } from "@/lib/data/types";

const trends: GameReviewTrend[] = [
  { appId: 1, periodMonth: "2024-01-01", reviewsInPeriod: 100, positiveInPeriod: 90, pctPositivePeriod: 0.9 },
  { appId: 1, periodMonth: "2024-02-01", reviewsInPeriod: 100, positiveInPeriod: 50, pctPositivePeriod: 0.5 },
  { appId: 1, periodMonth: "2024-03-01", reviewsInPeriod: 100, positiveInPeriod: 70, pctPositivePeriod: 0.7 },
];

function makeEvent(overrides: Partial<GameEvent> = {}): GameEvent {
  return {
    appId: 1,
    gid: "e1",
    startedOn: "2024-01-16",
    category: "update",
    headline: "Patch 1.2",
    votesUp: 900,
    votesDown: 12,
    commentCount: 44,
    imageUrl: "https://clan.cloudflare.steamstatic.com/images/patch.jpg",
    pctNegative: 0.013,
    isWellReceived: true,
    ...overrides,
  };
}

// Le viewBox du composant : 640x220, 24 de marge, donc 592 px de tracé répartis
// sur les intervalles entre les mois.
const PADDING = 24;
const STEP_X = (640 - PADDING * 2) / (trends.length - 1);

function bars(container: HTMLElement) {
  return Array.from(container.querySelectorAll<SVGLineElement>("line[data-event-gid]"));
}

function hitArea(container: HTMLElement, gid: string) {
  const rect = container.querySelector<SVGRectElement>(`rect[data-event-hit="${gid}"]`);
  if (!rect) throw new Error(`pas de zone de survol pour l'event ${gid}`);
  return rect;
}

describe("ScoreEvolutionChart", () => {
  it("renders an SVG line chart", () => {
    render(<ScoreEvolutionChart trends={trends} />);
    expect(screen.getByRole("img", { name: /positive score over time/i })).toBeInTheDocument();
  });

  it("places an event between the two months that bracket it", () => {
    const { container } = render(<ScoreEvolutionChart trends={trends} events={[makeEvent()]} />);
    const [bar] = bars(container);
    // 16 janvier : 15 jours après le 1er, sur un mois de 31 jours.
    expect(Number(bar.getAttribute("x1"))).toBeCloseTo(PADDING + (15 / 31) * STEP_X, 1);
    expect(bar.getAttribute("x1")).toBe(bar.getAttribute("x2"));
    expect(bar.getAttribute("stroke-dasharray")).toBeTruthy();
  });

  it("drops events that fall outside the range covered by the curve", () => {
    const { container } = render(
      <ScoreEvolutionChart
        trends={trends}
        events={[
          makeEvent({ gid: "avant", startedOn: "2023-11-04" }),
          makeEvent({ gid: "apres", startedOn: "2024-06-02" }),
          makeEvent({ gid: "dedans", startedOn: "2024-02-10" }),
        ]}
      />
    );
    expect(bars(container).map((b) => b.getAttribute("data-event-gid"))).toEqual(["dedans"]);
  });

  it("keeps an event landing inside the last month of the curve", () => {
    const { container } = render(
      <ScoreEvolutionChart trends={trends} events={[makeEvent({ startedOn: "2024-03-28" })]} />
    );
    const [bar] = bars(container);
    expect(Number(bar.getAttribute("x1"))).toBeCloseTo(PADDING + 2 * STEP_X, 1);
  });

  it("gives news and updates their own colour", () => {
    const { container } = render(
      <ScoreEvolutionChart
        trends={trends}
        events={[
          makeEvent({ gid: "maj", category: "update" }),
          makeEvent({ gid: "actu", category: "news", startedOn: "2024-02-16" }),
        ]}
      />
    );
    const [maj, actu] = bars(container);
    expect(maj.getAttribute("stroke")).not.toBe(actu.getAttribute("stroke"));
    expect(screen.getByText("Update")).toBeInTheDocument();
    expect(screen.getByText("News")).toBeInTheDocument();
  });

  it("only legends the categories actually present", () => {
    render(<ScoreEvolutionChart trends={trends} events={[makeEvent({ category: "update" })]} />);
    expect(screen.getByText("Update")).toBeInTheDocument();
    expect(screen.queryByText("News")).not.toBeInTheDocument();
  });

  it("shows the headline, stats and image of the hovered event", () => {
    const { container } = render(<ScoreEvolutionChart trends={trends} events={[makeEvent()]} />);
    fireEvent.pointerEnter(hitArea(container, "e1"));

    expect(screen.getByText("Patch 1.2")).toBeInTheDocument();
    expect(screen.getByText("900")).toBeInTheDocument();
    expect(screen.getByText("12")).toBeInTheDocument();
    expect(screen.getByText("44")).toBeInTheDocument();
    expect(container.querySelector("img")).toHaveAttribute(
      "src",
      "https://clan.cloudflare.steamstatic.com/images/patch.jpg"
    );
  });

  it("renders the tooltip without a thumbnail when the announcement has no usable image", () => {
    const { container } = render(
      <ScoreEvolutionChart
        trends={trends}
        events={[
          makeEvent({ gid: "sans", imageUrl: null }),
          // Mixed content : la prod est en https, le navigateur bloquerait l'image.
          makeEvent({ gid: "http", startedOn: "2024-02-16", imageUrl: "http://cdn.dota2.com/a.jpg" }),
        ]}
      />
    );

    fireEvent.pointerEnter(hitArea(container, "sans"));
    expect(screen.getByTestId("event-tooltip")).toBeInTheDocument();
    expect(container.querySelector("img")).toBeNull();

    fireEvent.pointerLeave(hitArea(container, "sans"));
    fireEvent.pointerEnter(hitArea(container, "http"));
    expect(container.querySelector("img")).toBeNull();
  });

  it("colours the tooltip border by how the event was received", () => {
    const { container, rerender } = render(
      <ScoreEvolutionChart trends={trends} events={[makeEvent({ isWellReceived: true })]} />
    );
    fireEvent.pointerEnter(hitArea(container, "e1"));
    expect(screen.getByTestId("event-tooltip").style.borderColor).toBe("var(--status-good)");

    fireEvent.pointerLeave(hitArea(container, "e1"));
    rerender(<ScoreEvolutionChart trends={trends} events={[makeEvent({ isWellReceived: false })]} />);
    fireEvent.pointerEnter(hitArea(container, "e1"));
    expect(screen.getByTestId("event-tooltip").style.borderColor).toBe("var(--status-critical)");
  });

  it("spells out the negative share on a controversial event", () => {
    const { container } = render(
      <ScoreEvolutionChart
        trends={trends}
        events={[
          makeEvent({ votesUp: 17494, votesDown: 190200, pctNegative: 0.9158, isWellReceived: false }),
        ]}
      />
    );
    fireEvent.pointerEnter(hitArea(container, "e1"));
    expect(screen.getByTestId("event-tooltip")).toHaveTextContent("92% negative votes");
  });

  it("keeps the negative share out of a well-received tooltip", () => {
    const { container } = render(<ScoreEvolutionChart trends={trends} events={[makeEvent()]} />);
    fireEvent.pointerEnter(hitArea(container, "e1"));
    expect(screen.getByTestId("event-tooltip")).not.toHaveTextContent("negative votes");
  });

  it("lets the event tooltip win over the month tooltip", () => {
    const { container } = render(<ScoreEvolutionChart trends={trends} events={[makeEvent()]} />);
    const svg = screen.getByRole("img", { name: /positive score over time/i });
    const pointerRect = svg.querySelector<SVGRectElement>("rect[data-month-hit]");
    if (!pointerRect) throw new Error("pas de zone de survol des mois");
    // jsdom ne fait aucune mise en page : sans ça le SVG mesure 0 et la
    // conversion clientX -> viewBox n'a rien sur quoi s'appuyer.
    svg.getBoundingClientRect = () => ({ left: 0, width: 640, top: 0, height: 220 }) as DOMRect;

    fireEvent.pointerMove(pointerRect, { clientX: 0 });
    expect(screen.getByTestId("month-tooltip")).toBeInTheDocument();

    fireEvent.pointerEnter(hitArea(container, "e1"));
    expect(screen.getByTestId("event-tooltip")).toBeInTheDocument();
    expect(screen.queryByTestId("month-tooltip")).not.toBeInTheDocument();
  });

  it("renders unchanged when no event is supplied", () => {
    const { container } = render(<ScoreEvolutionChart trends={trends} />);
    expect(bars(container)).toHaveLength(0);
  });
});
