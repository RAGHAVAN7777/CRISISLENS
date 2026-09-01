/**
 * Local Road Graph for Safe-Routing Prototype
 * All coordinates are in the 34.03–34.08 lat, -118.28 to -118.21 lng area
 * No external API required.
 */

export interface RoadNode {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
}

export interface RoadEdge {
  id: string;
  from: string;       // RoadNode id
  to: string;         // RoadNode id
  distance: number;   // km
  travelTime: number; // minutes
  risk: 'NONE' | 'LOW' | 'MEDIUM' | 'HIGH' | 'BLOCKED';
  blocked: boolean;
}

export interface RoutePath {
  nodes: RoadNode[];
  edges: RoadEdge[];
  totalDistance: number;
  totalTime: number;
  overallRisk: 'LOW' | 'MEDIUM' | 'HIGH';
  waypoints: [number, number][];   // lat/lng pairs for map polyline
}

// ------------------------------------------------------------------
// Node Registry
// ------------------------------------------------------------------
export const ROAD_NODES: RoadNode[] = [
  { id: 'n_origin_1',  name: 'City Center Plaza',          latitude: 34.050, longitude: -118.255 },
  { id: 'n_origin_2',  name: 'Riverside Market',           latitude: 34.043, longitude: -118.260 },
  { id: 'n_origin_3',  name: 'Eastside Residential Hub',   latitude: 34.057, longitude: -118.243 },
  { id: 'n_jct_1',     name: 'Main St / 1st Ave Junction',  latitude: 34.048, longitude: -118.252 },
  { id: 'n_jct_2',     name: 'Oak Ave Interchange',         latitude: 34.053, longitude: -118.248 },
  { id: 'n_jct_3',     name: 'Flood Underpass Junction',    latitude: 34.047, longitude: -118.242 },
  { id: 'n_jct_4',     name: 'North Bypass Connector',      latitude: 34.062, longitude: -118.250 },
  { id: 'n_jct_5',     name: 'West Arterial Merge',         latitude: 34.040, longitude: -118.265 },
  { id: 'n_jct_6',     name: 'Highway Overpass East',       latitude: 34.058, longitude: -118.237 },
  { id: 'n_jct_7',     name: 'Emergency Access Road',       latitude: 34.070, longitude: -118.245 },
  { id: 'n_shelter_s1', name: 'Government Model School',    latitude: 34.045, longitude: -118.250 },
  { id: 'n_shelter_s2', name: 'City Community Hall',        latitude: 34.055, longitude: -118.240 },
  { id: 'n_shelter_s3', name: 'Central Relief Center',      latitude: 34.062, longitude: -118.235 },
  { id: 'n_shelter_s4', name: 'Westside Sports Pavilion',   latitude: 34.030, longitude: -118.270 },
  { id: 'n_shelter_s5', name: 'East Memorial Disaster Center', latitude: 34.060, longitude: -118.220 },
  { id: 'n_shelter_s6', name: 'North Valley Emergency Camp', latitude: 34.080, longitude: -118.250 },
];

// ------------------------------------------------------------------
// Edge Registry  (bidirectional — algorithm handles both directions)
// ------------------------------------------------------------------
export const ROAD_EDGES: RoadEdge[] = [
  // City Center area
  { id: 'e1',  from: 'n_origin_1', to: 'n_jct_1',     distance: 0.4, travelTime: 2,  risk: 'LOW',     blocked: false },
  { id: 'e2',  from: 'n_jct_1',    to: 'n_jct_2',     distance: 0.6, travelTime: 3,  risk: 'LOW',     blocked: false },
  { id: 'e3',  from: 'n_jct_2',    to: 'n_shelter_s2', distance: 0.5, travelTime: 2, risk: 'LOW',     blocked: false },
  { id: 'e4',  from: 'n_jct_2',    to: 'n_jct_3',     distance: 0.7, travelTime: 4,  risk: 'HIGH',    blocked: false }, // Near flood zone
  { id: 'e5',  from: 'n_jct_3',    to: 'n_shelter_s2', distance: 0.4, travelTime: 2, risk: 'MEDIUM',  blocked: false },
  { id: 'e6',  from: 'n_origin_1', to: 'n_jct_5',     distance: 1.1, travelTime: 6,  risk: 'LOW',     blocked: false },
  { id: 'e7',  from: 'n_jct_5',    to: 'n_shelter_s4', distance: 0.9, travelTime: 5, risk: 'LOW',     blocked: false },
  { id: 'e8',  from: 'n_jct_5',    to: 'n_origin_2',  distance: 0.5, travelTime: 3,  risk: 'LOW',     blocked: false },
  { id: 'e9',  from: 'n_origin_2', to: 'n_shelter_s4', distance: 0.7, travelTime: 4, risk: 'LOW',     blocked: false },
  { id: 'e10', from: 'n_origin_2', to: 'n_jct_1',     distance: 0.8, travelTime: 5,  risk: 'MEDIUM',  blocked: false },
  { id: 'e11', from: 'n_jct_1',    to: 'n_shelter_s1', distance: 0.3, travelTime: 2, risk: 'LOW',     blocked: false },
  { id: 'e12', from: 'n_origin_1', to: 'n_jct_4',     distance: 1.3, travelTime: 7,  risk: 'LOW',     blocked: false },
  { id: 'e13', from: 'n_jct_4',    to: 'n_shelter_s3', distance: 0.6, travelTime: 3, risk: 'LOW',     blocked: false },
  { id: 'e14', from: 'n_jct_4',    to: 'n_jct_7',     distance: 0.9, travelTime: 5,  risk: 'LOW',     blocked: false },
  { id: 'e15', from: 'n_jct_7',    to: 'n_shelter_s6', distance: 1.0, travelTime: 6, risk: 'LOW',     blocked: false },
  { id: 'e16', from: 'n_origin_3', to: 'n_jct_2',     distance: 0.5, travelTime: 3,  risk: 'LOW',     blocked: false },
  { id: 'e17', from: 'n_origin_3', to: 'n_jct_6',     distance: 0.4, travelTime: 2,  risk: 'LOW',     blocked: false },
  { id: 'e18', from: 'n_jct_6',    to: 'n_shelter_s5', distance: 0.8, travelTime: 4, risk: 'MEDIUM',  blocked: false },
  { id: 'e19', from: 'n_jct_6',    to: 'n_shelter_s3', distance: 0.6, travelTime: 3, risk: 'LOW',     blocked: false },
  { id: 'e20', from: 'n_jct_3',    to: 'n_jct_6',     distance: 1.2, travelTime: 8,  risk: 'BLOCKED', blocked: true  }, // Submerged road
  { id: 'e21', from: 'n_jct_4',    to: 'n_shelter_s6', distance: 1.5, travelTime: 8, risk: 'LOW',     blocked: false },
  { id: 'e22', from: 'n_origin_3', to: 'n_jct_4',     distance: 0.8, travelTime: 4,  risk: 'LOW',     blocked: false },
  { id: 'e23', from: 'n_jct_2',    to: 'n_jct_4',     distance: 1.0, travelTime: 5,  risk: 'MEDIUM',  blocked: false },
  { id: 'e24', from: 'n_jct_1',    to: 'n_jct_3',     distance: 0.6, travelTime: 4,  risk: 'HIGH',    blocked: false }, // Hazard prone
];

// ------------------------------------------------------------------
// Risk Penalty Table (added to distance cost)
// ------------------------------------------------------------------
const RISK_PENALTY: Record<RoadEdge['risk'], number> = {
  NONE:    0,
  LOW:     0.1,
  MEDIUM:  0.8,
  HIGH:    2.5,
  BLOCKED: 999,
};

// ------------------------------------------------------------------
// Dijkstra — cost = distance + riskPenalty  (safety-first routing)
// ------------------------------------------------------------------
export function findSafeRoute(fromId: string, toId: string): RoutePath | null {
  const nodeMap = new Map<string, RoadNode>(ROAD_NODES.map(n => [n.id, n]));

  // Build adjacency list (bidirectional)
  const adj = new Map<string, { edge: RoadEdge; neighbor: string }[]>();
  for (const node of ROAD_NODES) adj.set(node.id, []);
  for (const edge of ROAD_EDGES) {
    if (edge.blocked) continue;
    adj.get(edge.from)!.push({ edge, neighbor: edge.to });
    adj.get(edge.to)!.push({ edge, neighbor: edge.from });
  }

  // Dijkstra
  const dist = new Map<string, number>();
  const prev = new Map<string, { node: string; edge: RoadEdge } | null>();
  const visited = new Set<string>();

  for (const node of ROAD_NODES) {
    dist.set(node.id, Infinity);
    prev.set(node.id, null);
  }
  dist.set(fromId, 0);

  const pq: { id: string; cost: number }[] = [{ id: fromId, cost: 0 }];

  while (pq.length > 0) {
    pq.sort((a, b) => a.cost - b.cost);
    const { id: current } = pq.shift()!;
    if (visited.has(current)) continue;
    visited.add(current);
    if (current === toId) break;

    for (const { edge, neighbor } of adj.get(current) ?? []) {
      const cost = (dist.get(current) ?? Infinity) + edge.distance + RISK_PENALTY[edge.risk];
      if (cost < (dist.get(neighbor) ?? Infinity)) {
        dist.set(neighbor, cost);
        prev.set(neighbor, { node: current, edge });
        pq.push({ id: neighbor, cost });
      }
    }
  }

  if ((dist.get(toId) ?? Infinity) === Infinity) return null; // No path

  // Reconstruct path
  const pathNodes: RoadNode[] = [];
  const pathEdges: RoadEdge[] = [];
  let cursor: string | null = toId;

  while (cursor) {
    pathNodes.unshift(nodeMap.get(cursor)!);
    const p = prev.get(cursor);
    if (p) {
      pathEdges.unshift(p.edge);
      cursor = p.node;
    } else {
      cursor = null;
    }
  }

  const totalDistance = parseFloat(pathEdges.reduce((s, e) => s + e.distance, 0).toFixed(2));
  const totalTime = Math.round(pathEdges.reduce((s, e) => s + e.travelTime, 0));

  const riskLevels = pathEdges.map(e => e.risk);
  let overallRisk: 'LOW' | 'MEDIUM' | 'HIGH' = 'LOW';
  if (riskLevels.includes('HIGH'))   overallRisk = 'HIGH';
  else if (riskLevels.includes('MEDIUM')) overallRisk = 'MEDIUM';

  const waypoints: [number, number][] = pathNodes.map(n => [n.latitude, n.longitude]);

  return { nodes: pathNodes, edges: pathEdges, totalDistance, totalTime, overallRisk, waypoints };
}

/** Update risk status of a road dynamically (e.g. after a new incident is reported) */
export function updateRoadRisk(edgeId: string, risk: RoadEdge['risk'], blocked: boolean) {
  const edge = ROAD_EDGES.find(e => e.id === edgeId);
  if (edge) {
    edge.risk = risk;
    edge.blocked = blocked;
  }
}

/** Snapshot of original edge states — used to reset after demo */
const ORIGINAL_EDGE_STATE: Map<string, { risk: RoadEdge['risk']; blocked: boolean }> = new Map(
  ROAD_EDGES.map(e => [e.id, { risk: e.risk, blocked: e.blocked }])
);

/** Restore all edges to their original state */
export function resetRoadGraph() {
  for (const edge of ROAD_EDGES) {
    const orig = ORIGINAL_EDGE_STATE.get(edge.id);
    if (orig) {
      edge.risk    = orig.risk;
      edge.blocked = orig.blocked;
    }
  }
}

/** Returns true if any edge in the given route is now blocked or HIGH risk */
export function isRouteAffected(route: RoutePath): { affected: boolean; blockedEdge: RoadEdge | null } {
  for (const re of route.edges) {
    const live = ROAD_EDGES.find(e => e.id === re.id);
    if (live && (live.blocked || live.risk === 'HIGH' || live.risk === 'BLOCKED')) {
      return { affected: true, blockedEdge: live };
    }
  }
  return { affected: false, blockedEdge: null };
}

// ------------------------------------------------------------------
// Scripted Disaster Scenarios — each blocks a different set of edges
// ensuring the route visibly changes every time.
// ------------------------------------------------------------------
export interface DisasterScenario {
  id: string;
  name: string;          // e.g. "FLOOD"
  hazardType: string;
  blockedEdges: string[];  // edge ids to block
  affectedNodeId: string;  // node near disaster for map pin
  lat: number;
  lng: number;
  description: string;
}

export const DISASTER_SCENARIOS: DisasterScenario[] = [
  {
    id: 'ds1',
    name: 'FLOOD',
    hazardType: 'Flood',
    blockedEdges: ['e1', 'e2'],   // blocks City Center → Main St → Oak Ave
    affectedNodeId: 'n_jct_1',
    lat: 34.049,
    lng: -118.252,
    description: 'Rising floodwater has submerged Main St / 1st Ave Junction and Oak Ave Interchange.',
  },
  {
    id: 'ds2',
    name: 'FIRE',
    hazardType: 'Fire',
    blockedEdges: ['e12', 'e23'],  // blocks North Bypass routes
    affectedNodeId: 'n_jct_4',
    lat: 34.062,
    lng: -118.250,
    description: 'Raging fire has closed North Bypass Connector approach roads.',
  },
  {
    id: 'ds3',
    name: 'STRUCTURAL COLLAPSE',
    hazardType: 'Structural Damage',
    blockedEdges: ['e11', 'e3'],   // blocks direct shelter access roads
    affectedNodeId: 'n_shelter_s1',
    lat: 34.046,
    lng: -118.251,
    description: 'Bridge collapse blocks direct access to Government Model School and City Community Hall.',
  },
  {
    id: 'ds4',
    name: 'ROAD BLOCKAGE',
    hazardType: 'Fallen Object / Road Blockage',
    blockedEdges: ['e2', 'e16'],   // blocks Oak Ave from two sides
    affectedNodeId: 'n_jct_2',
    lat: 34.053,
    lng: -118.248,
    description: 'Debris and fallen trees have blocked Oak Ave Interchange approach from both sides.',
  },
];

let scenarioIndex = 0;

/** Apply the next disaster scenario in rotation and return the scenario used */
export function applyNextDisasterScenario(): DisasterScenario {
  // Reset first so each demo starts clean
  resetRoadGraph();

  const scenario = DISASTER_SCENARIOS[scenarioIndex % DISASTER_SCENARIOS.length];
  scenarioIndex++;

  for (const eid of scenario.blockedEdges) {
    updateRoadRisk(eid, 'BLOCKED', true);
  }

  return scenario;
}

/**
 * Finds an alternative safe route by penalizing or completely avoiding specific edge IDs
 */
export function findAlternativeSafeRoute(fromId: string, toId: string, avoidEdgeIds: string[] = []): RoutePath | null {
  const nodeMap = new Map<string, RoadNode>(ROAD_NODES.map(n => [n.id, n]));
  const avoidSet = new Set(avoidEdgeIds);

  const adj = new Map<string, { edge: RoadEdge; neighbor: string }[]>();
  for (const node of ROAD_NODES) adj.set(node.id, []);
  for (const edge of ROAD_EDGES) {
    if (edge.blocked || avoidSet.has(edge.id)) continue;
    adj.get(edge.from)!.push({ edge, neighbor: edge.to });
    adj.get(edge.to)!.push({ edge, neighbor: edge.from });
  }

  const dist = new Map<string, number>();
  const prev = new Map<string, { node: string; edge: RoadEdge } | null>();
  const visited = new Set<string>();

  for (const node of ROAD_NODES) {
    dist.set(node.id, Infinity);
    prev.set(node.id, null);
  }
  dist.set(fromId, 0);

  const pq: { id: string; cost: number }[] = [{ id: fromId, cost: 0 }];

  while (pq.length > 0) {
    pq.sort((a, b) => a.cost - b.cost);
    const { id: current } = pq.shift()!;
    if (visited.has(current)) continue;
    visited.add(current);
    if (current === toId) break;

    for (const { edge, neighbor } of adj.get(current) ?? []) {
      const penalty = (avoidSet.has(edge.id) ? 100 : 0) + RISK_PENALTY[edge.risk];
      const cost = (dist.get(current) ?? Infinity) + edge.distance + penalty;
      if (cost < (dist.get(neighbor) ?? Infinity)) {
        dist.set(neighbor, cost);
        prev.set(neighbor, { node: current, edge });
        pq.push({ id: neighbor, cost });
      }
    }
  }

  if ((dist.get(toId) ?? Infinity) === Infinity) {
    // If fully blocked, fallback to normal Dijkstra with high penalties
    return findSafeRoute(fromId, toId);
  }

  const pathNodes: RoadNode[] = [];
  const pathEdges: RoadEdge[] = [];
  let cursor: string | null = toId;

  while (cursor) {
    pathNodes.unshift(nodeMap.get(cursor)!);
    const p = prev.get(cursor);
    if (p) {
      pathEdges.unshift(p.edge);
      cursor = p.node;
    } else {
      cursor = null;
    }
  }

  const totalDistance = parseFloat(pathEdges.reduce((s, e) => s + e.distance, 0).toFixed(2));
  const totalTime = Math.round(pathEdges.reduce((s, e) => s + e.travelTime, 0));

  const riskLevels = pathEdges.map(e => e.risk);
  let overallRisk: 'LOW' | 'MEDIUM' | 'HIGH' = 'LOW';
  if (riskLevels.includes('HIGH')) overallRisk = 'HIGH';
  else if (riskLevels.includes('MEDIUM')) overallRisk = 'MEDIUM';

  const waypoints: [number, number][] = pathNodes.map(n => [n.latitude, n.longitude]);
  return { nodes: pathNodes, edges: pathEdges, totalDistance, totalTime, overallRisk, waypoints };
}


