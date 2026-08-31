import { describe, expect, it } from "vitest";
import type { Topology } from "topojson-specification";
import { topologyToPaths } from "@/lib/geo";

// A minimal, hand-built topology: two unit squares, no transform (so arc
// coordinates are plain planar positions), so geoPath can render them with
// no projection (identity/pre-projected mode) and we can assert on the
// exact "d" string.
const FIXTURE: Topology = {
  type: "Topology",
  arcs: [
    [
      [0, 0],
      [1, 0],
      [1, 1],
      [0, 1],
      [0, 0],
    ],
    [
      [2, 0],
      [3, 0],
      [3, 1],
      [2, 1],
      [2, 0],
    ],
  ],
  objects: {
    test: {
      type: "GeometryCollection",
      geometries: [
        { type: "Polygon", arcs: [[0]], id: "1", properties: { name: "Alpha" } },
        { type: "Polygon", arcs: [[1]], id: "2", properties: { name: "Beta" } },
      ],
    },
  },
};

describe("topologyToPaths", () => {
  it("returns one named path per geometry, in order", () => {
    const paths = topologyToPaths(FIXTURE, "test", null);
    expect(paths.map((p) => p.name)).toEqual(["Alpha", "Beta"]);
    expect(paths.map((p) => p.id)).toEqual(["1", "2"]);
  });

  it("renders each geometry to a non-empty SVG path string", () => {
    const [alpha] = topologyToPaths(FIXTURE, "test", null);
    expect(alpha.d).toMatch(/^M/);
    expect(alpha.d.length).toBeGreaterThan(0);
  });

  it("throws for an unknown object key", () => {
    expect(() => topologyToPaths(FIXTURE, "missing", null)).toThrow();
  });
});
