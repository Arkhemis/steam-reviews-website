import { geoPath, type GeoProjection } from "d3-geo";
import { feature } from "topojson-client";
import type { GeometryCollection, Topology } from "topojson-specification";

function collectionOf(topology: Topology, objectKey: string) {
  const object = topology.objects[objectKey];
  if (!object) {
    throw new Error(`Unknown topojson object "${objectKey}"`);
  }
  return feature(topology, object as GeometryCollection);
}

// Thin wrapper around d3-geo's own fitSize: fits `makeProjection()` so the
// named topojson object exactly fills `size`. No independent logic beyond
// delegating to already-tested library calls, so left uncovered by a
// dedicated unit test (topologyToPaths below covers the geometry rendering
// this depends on).
export function fitProjection(
  makeProjection: () => GeoProjection,
  size: [number, number],
  topology: Topology,
  objectKey: string,
): GeoProjection {
  return makeProjection().fitSize(size, collectionOf(topology, objectKey));
}

export type NamedPath = {
  id: string | undefined;
  name: string;
  d: string;
};

// Renders every geometry of a topojson object to an SVG path "d" string.
// Pass `projection: null` for already-planar (pre-projected) coordinates —
// geoPath then uses them directly instead of applying spherical projection.
export function topologyToPaths(topology: Topology, objectKey: string, projection: GeoProjection | null): NamedPath[] {
  const collection = collectionOf(topology, objectKey);
  const path = geoPath(projection ?? undefined);

  return collection.features.map((f) => ({
    id: f.id?.toString(),
    name: (f.properties as { name?: string } | null)?.name ?? "",
    d: path(f) ?? "",
  }));
}
