import type { EditorJunction, EditorWire, EndpointRef } from "../../stores/editorStore";
import { wireLengthM } from "./feedpoint";

export interface PolylineLeg {
  wireTag: number;
  reversed: boolean;
  lengthM: number;
  startDistanceM: number;
}

export interface PolylinePath {
  legs: PolylineLeg[];
  totalLengthM: number;
  branched: boolean;
  closed: boolean;
}

function endpointKey(endpoint: EndpointRef): string {
  return `${endpoint.wireTag}:${endpoint.endpoint}`;
}

function nodeMap(junctions: readonly EditorJunction[]): Map<string, string> {
  const result = new Map<string, string>();
  for (const junction of junctions) {
    for (const endpoint of junction.endpoints) result.set(endpointKey(endpoint), `junction:${junction.id}`);
  }
  return result;
}

/** Return a deterministic path for the unbranched connected component containing a wire. */
export function connectedPolylinePath(
  wires: readonly EditorWire[],
  junctions: readonly EditorJunction[],
  selectedWireTag: number,
): PolylinePath {
  const nodes = nodeMap(junctions);
  const endpointNode = (wireTag: number, endpoint: "start" | "end") =>
    nodes.get(`${wireTag}:${endpoint}`) ?? `free:${wireTag}:${endpoint}`;
  const wireByTag = new Map(wires.map((wire) => [wire.tag, wire]));
  if (!wireByTag.has(selectedWireTag)) return { legs: [], totalLengthM: 0, branched: false, closed: false };

  const junctionByWire = new Map<number, Set<number>>();
  for (const junction of junctions) {
    const tags = [...new Set(junction.endpoints.map((endpoint) => endpoint.wireTag))];
    for (const tag of tags) {
      const connected = junctionByWire.get(tag) ?? new Set<number>();
      for (const peer of tags) if (peer !== tag) connected.add(peer);
      junctionByWire.set(tag, connected);
    }
  }
  const component = new Set<number>();
  const pending = [selectedWireTag];
  while (pending.length > 0) {
    const tag = pending.pop()!;
    if (component.has(tag) || !wireByTag.has(tag)) continue;
    component.add(tag);
    for (const peer of junctionByWire.get(tag) ?? []) pending.push(peer);
  }

  const nodeEdges = new Map<string, number[]>();
  for (const tag of component) {
    for (const endpoint of ["start", "end"] as const) {
      const node = endpointNode(tag, endpoint);
      nodeEdges.set(node, [...(nodeEdges.get(node) ?? []), tag]);
    }
  }
  const branched = [...nodeEdges.values()].some((edges) => edges.length > 2);
  if (branched) {
    const legs = [...component].sort((a, b) => a - b).map((wireTag) => ({
      wireTag,
      reversed: false,
      lengthM: wireLengthM(wireByTag.get(wireTag)!),
      startDistanceM: 0,
    }));
    return { legs, totalLengthM: legs.reduce((sum, leg) => sum + leg.lengthM, 0), branched: true, closed: false };
  }

  const endNodes = [...nodeEdges.entries()].filter(([, edges]) => edges.length === 1).map(([node]) => node).sort();
  const closed = endNodes.length === 0 && component.size > 1;
  let currentNode = endNodes[0];
  if (!currentNode) {
    const firstTag = Math.min(...component);
    currentNode = endpointNode(firstTag, "start");
  }
  const unused = new Set(component);
  const legs: PolylineLeg[] = [];
  let distance = 0;
  while (unused.size > 0) {
    const candidates = (nodeEdges.get(currentNode) ?? []).filter((tag) => unused.has(tag)).sort((a, b) => a - b);
    const wireTag = candidates[0];
    if (wireTag === undefined) break;
    const wire = wireByTag.get(wireTag)!;
    const startNode = endpointNode(wireTag, "start");
    const reversed = currentNode !== startNode;
    const lengthM = wireLengthM(wire);
    legs.push({ wireTag, reversed, lengthM, startDistanceM: distance });
    distance += lengthM;
    unused.delete(wireTag);
    currentNode = endpointNode(wireTag, reversed ? "start" : "end");
  }
  return { legs, totalLengthM: distance, branched: false, closed };
}

export function polylineDistanceForRatio(path: PolylinePath, wireTag: number, wireRatio: number): number | null {
  const leg = path.legs.find((candidate) => candidate.wireTag === wireTag);
  if (!leg) return null;
  const alongLeg = (leg.reversed ? 1 - wireRatio : wireRatio) * leg.lengthM;
  return leg.startDistanceM + alongLeg;
}

export function polylinePositionAtDistance(path: PolylinePath, requestedDistanceM: number): { wireTag: number; wireRatio: number } | null {
  if (path.branched || path.legs.length === 0) return null;
  const distance = Math.min(path.totalLengthM, Math.max(0, requestedDistanceM));
  const leg = path.legs.find((candidate, index) =>
    distance <= candidate.startDistanceM + candidate.lengthM || index === path.legs.length - 1,
  );
  if (!leg) return null;
  const alongLeg = Math.min(leg.lengthM, Math.max(0, distance - leg.startDistanceM));
  const pathRatio = leg.lengthM > 0 ? alongLeg / leg.lengthM : 0;
  return { wireTag: leg.wireTag, wireRatio: leg.reversed ? 1 - pathRatio : pathRatio };
}
