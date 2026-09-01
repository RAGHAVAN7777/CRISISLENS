/**
 * Route Risk Service
 *
 * Bridges the incident system and the road graph.
 *
 * Pipeline:
 *   Incident Created/Updated in localStorage
 *   → syncIncidentsToRoadGraph()
 *   → edges near each incident get risk updated
 *   → 'routeRiskUpdated' CustomEvent dispatched on window
 *   → /route page hears it, checks active route, recalculates if affected
 *
 * Verification-aware risk model:
 *   FALSE_REPORT   → NONE  (road cleared)
 *   VERIFIED       → maximum risk based on severity
 *   PARTIALLY_VERIFIED → same as VERIFIED
 *   FIELD_VERIFICATION_REQUIRED / VERIFICATION_IN_PROGRESS → MEDIUM caution
 *   UNVERIFIED / AI_CLASSIFIED → slightly downgraded from VERIFIED
 */

import { Incident, VerificationStatus } from '@/lib/storage';
import { ROAD_EDGES, ROAD_NODES, RoadEdge, updateRoadRisk, resetRoadGraph } from '@/lib/roadGraph';
import { ROAD_PROXIMITY_THRESHOLD } from '@/lib/config';

type IncidentRisk = RoadEdge['risk'];

function incidentToRoadRisk(
  severity: string,
  status: string,
  verificationStatus?: VerificationStatus
): IncidentRisk {
  // False reports clear road risk completely
  if (verificationStatus === 'FALSE_REPORT' || status === 'REJECTED') return 'NONE';

  const humanVerified =
    verificationStatus === 'VERIFIED' || verificationStatus === 'PARTIALLY_VERIFIED';
  const fieldRequired =
    verificationStatus === 'FIELD_VERIFICATION_REQUIRED' ||
    verificationStatus === 'VERIFICATION_IN_PROGRESS';
  const aiClassified = status === 'AI_CLASSIFIED' || status === 'PENDING';

  if (severity === 'CRITICAL') {
    if (humanVerified) return 'BLOCKED';
    if (fieldRequired) return 'HIGH';
    return aiClassified ? 'HIGH' : 'BLOCKED';
  }
  if (severity === 'HIGH') {
    if (humanVerified) return 'HIGH';
    if (fieldRequired) return 'MEDIUM';
    return aiClassified ? 'MEDIUM' : 'HIGH';
  }
  if (severity === 'MEDIUM') {
    if (humanVerified) return 'MEDIUM';
    return 'LOW';
  }
  // LOW severity
  return 'LOW';
}

// Proximity: find road edges whose midpoint is within threshold of
// an incident's lat/lng.
function edgesNearIncident(incident: Incident): RoadEdge[] {
  return ROAD_EDGES.filter(edge => {
    const fromNode = ROAD_NODES.find(n => n.id === edge.from);
    const toNode   = ROAD_NODES.find(n => n.id === edge.to);
    if (!fromNode || !toNode) return false;

    const midLat = (fromNode.latitude  + toNode.latitude)  / 2;
    const midLng = (fromNode.longitude + toNode.longitude) / 2;

    return (
      Math.abs(midLat - incident.latitude)  < ROAD_PROXIMITY_THRESHOLD &&
      Math.abs(midLng - incident.longitude) < ROAD_PROXIMITY_THRESHOLD
    );
  });
}

// Risk priority ordering (higher index = worse)
const RISK_PRIORITY: Record<IncidentRisk, number> = {
  NONE: 0, LOW: 1, MEDIUM: 2, HIGH: 3, BLOCKED: 4,
};

function worseRisk(a: IncidentRisk, b: IncidentRisk): IncidentRisk {
  return RISK_PRIORITY[a] >= RISK_PRIORITY[b] ? a : b;
}

// Main sync function — called after any incident write
export function syncIncidentsToRoadGraph(incidents: Incident[]): void {
  resetRoadGraph();

  const edgeRiskMap = new Map<string, IncidentRisk>();

  const activeIncidents = incidents.filter(
    i => i.status !== 'RESOLVED' && i.status !== 'REJECTED' && i.verificationStatus !== 'FALSE_REPORT'
  );

  for (const incident of activeIncidents) {
    const nearbyEdges = edgesNearIncident(incident);
    const risk = incidentToRoadRisk(incident.severity, incident.status, incident.verificationStatus);

    for (const edge of nearbyEdges) {
      const current = edgeRiskMap.get(edge.id) ?? 'NONE';
      edgeRiskMap.set(edge.id, worseRisk(current, risk));
    }
  }

  for (const [edgeId, risk] of edgeRiskMap.entries()) {
    updateRoadRisk(edgeId, risk, risk === 'BLOCKED');
  }

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('routeRiskUpdated', {
      detail: { updatedEdgeCount: edgeRiskMap.size, incidentCount: activeIncidents.length }
    }));
  }
}

export const ROUTE_RISK_UPDATED_EVENT = 'routeRiskUpdated';
