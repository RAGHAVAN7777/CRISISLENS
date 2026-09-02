/**
 * Real Routing & Dynamic Incident Risk Evaluation Service
 *
 * Uses Open Source Routing Machine (OSRM) for real street-level routing
 * and dynamically evaluates geometric proximity to active citizen incident reports.
 */

import { Incident, VerificationStatus } from '@/lib/storage';

export interface RouteGeometry {
  id: string;
  name: string;
  waypoints: [number, number][]; // [lat, lng] pairs for Leaflet Polyline
  totalDistanceKm: number;
  totalTimeMinutes: number;
  summary: string;
}

export interface IntersectingHazard {
  incidentId: string;
  hazard: string;
  severity: Incident['severity'];
  verificationStatus?: VerificationStatus;
  distanceM: number;
  lat: number;
  lng: number;
}

export interface EvaluatedRoute extends RouteGeometry {
  overallRisk: 'LOW' | 'MEDIUM' | 'HIGH';
  riskScore: number; // 0–100+
  intersectingHazards: IntersectingHazard[];
  isSafest: boolean;
  recommendationReason: string;
}

/** Haversine distance in meters */
export function distMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(Δφ / 2) ** 2 +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Fetch real street-level route geometry from OSRM
 */
export async function fetchOSRMRoute(
  origin: { lat: number; lng: number },
  destination: { lat: number; lng: number }
): Promise<RouteGeometry[]> {
  const url = `https://router.project-osrm.org/route/v1/driving/${origin.lng},${origin.lat};${destination.lng},${destination.lat}?overview=full&geometries=geojson&alternatives=true&steps=true`;

  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) throw new Error(`OSRM HTTP error: ${res.status}`);

    const data = await res.json();
    if (!data.routes || !Array.isArray(data.routes) || data.routes.length === 0) {
      throw new Error('No OSRM routes found');
    }

    return data.routes.map((r: any, idx: number) => {
      // OSRM coordinates are [lng, lat] -> convert to Leaflet [lat, lng]
      const waypoints: [number, number][] = (r.geometry?.coordinates || []).map(
        ([lng, lat]: [number, number]) => [lat, lng]
      );

      const distKm = Math.round((r.distance / 1000) * 10) / 10;
      const timeMins = Math.round(r.duration / 60);
      const legName = r.legs?.[0]?.summary || (idx === 0 ? 'Primary Street Route' : `Alternative Bypass ${idx}`);

      return {
        id: `osrm_route_${idx}_${Date.now()}`,
        name: idx === 0 ? 'Direct City Corridor' : `Secondary Safe Bypass (${legName})`,
        waypoints: waypoints.length > 0 ? waypoints : [[origin.lat, origin.lng], [destination.lat, destination.lng]],
        totalDistanceKm: distKm || 1.0,
        totalTimeMinutes: Math.max(timeMins, 2),
        summary: legName
      };
    });
  } catch (err) {
    console.warn('OSRM routing fetch failed or timed out, generating direct path:', err);
    // Direct interpolated fallback geometry
    const steps = 12;
    const waypoints: [number, number][] = [];
    for (let i = 0; i <= steps; i++) {
      const fraction = i / steps;
      const lat = origin.lat + (destination.lat - origin.lat) * fraction;
      const lng = origin.lng + (destination.lng - origin.lng) * fraction;
      waypoints.push([lat, lng]);
    }
    const dist = Math.round((distMeters(origin.lat, origin.lng, destination.lat, destination.lng) / 1000) * 10) / 10;

    return [
      {
        id: `direct_route_${Date.now()}`,
        name: 'Direct Evacuation Path',
        waypoints,
        totalDistanceKm: Math.max(dist, 0.5),
        totalTimeMinutes: Math.max(Math.round(dist * 3.5), 3),
        summary: 'Direct GPS Corridor'
      }
    ];
  }
}

/**
 * Evaluate safety and risk for a single route against active citizen disaster reports
 */
export function evaluateRouteRisk(
  route: RouteGeometry,
  activeIncidents: Incident[]
): EvaluatedRoute {
  const PROXIMITY_HAZARD_THRESHOLD_M = 350; // 350 meters
  const hazards: IntersectingHazard[] = [];
  let penaltyScore = 0;

  const validIncidents = activeIncidents.filter(
    i => i.status !== 'RESOLVED' && i.status !== 'REJECTED' && i.verificationStatus !== 'FALSE_REPORT'
  );

  for (const inc of validIncidents) {
    if (!inc.latitude || !inc.longitude) continue;

    let minDistanceM = Infinity;
    for (const [wLat, wLng] of route.waypoints) {
      const d = distMeters(wLat, wLng, inc.latitude, inc.longitude);
      if (d < minDistanceM) {
        minDistanceM = d;
      }
    }

    if (minDistanceM <= PROXIMITY_HAZARD_THRESHOLD_M) {
      const isVerified = inc.verificationStatus === 'VERIFIED' || inc.status === 'VERIFIED';
      const weightMult = isVerified ? 1.5 : 1.0;

      let basePenalty = 15;
      if (inc.severity === 'CRITICAL') basePenalty = 85;
      else if (inc.severity === 'HIGH') basePenalty = 45;
      else if (inc.severity === 'MEDIUM') basePenalty = 25;

      penaltyScore += Math.round(basePenalty * weightMult);

      hazards.push({
        incidentId: inc.id,
        hazard: Array.isArray(inc.hazard) ? inc.hazard.join(' / ') : inc.hazard || 'Disaster Hazard',
        severity: inc.severity,
        verificationStatus: inc.verificationStatus,
        distanceM: Math.round(minDistanceM),
        lat: inc.latitude,
        lng: inc.longitude
      });
    }
  }

  let overallRisk: EvaluatedRoute['overallRisk'] = 'LOW';
  if (penaltyScore >= 60 || hazards.some(h => h.severity === 'CRITICAL')) {
    overallRisk = 'HIGH';
  } else if (penaltyScore >= 25 || hazards.some(h => h.severity === 'HIGH')) {
    overallRisk = 'MEDIUM';
  }

  let recommendationReason = 'Route is clear of all active verified disaster perimeters.';
  if (overallRisk === 'HIGH') {
    const worst = hazards.sort((a, b) => (b.severity === 'CRITICAL' ? 1 : 0) - (a.severity === 'CRITICAL' ? 1 : 0))[0];
    recommendationReason = `High hazard risk: Passes within ${worst?.distanceM ?? 150}m of active ${worst?.hazard ?? 'disaster'} (${worst?.severity ?? 'HIGH'}).`;
  } else if (overallRisk === 'MEDIUM') {
    recommendationReason = `Moderate caution: ${hazards.length} incident(s) reported in surrounding corridor.`;
  }

  return {
    ...route,
    overallRisk,
    riskScore: penaltyScore,
    intersectingHazards: hazards,
    isSafest: false,
    recommendationReason
  };
}

/**
 * Compare all available route candidates and flag the safest option
 */
export function selectSafestRoute(
  routes: RouteGeometry[],
  activeIncidents: Incident[]
): {
  primarySafeRoute: EvaluatedRoute;
  allEvaluatedRoutes: EvaluatedRoute[];
  alternativeRoute: EvaluatedRoute | null;
} {
  const evaluated = routes.map(r => evaluateRouteRisk(r, activeIncidents));

  // Sort: Lowest risk score first, then shortest distance
  const sorted = [...evaluated].sort((a, b) => {
    const riskPriority = { LOW: 0, MEDIUM: 1, HIGH: 2 };
    if (riskPriority[a.overallRisk] !== riskPriority[b.overallRisk]) {
      return riskPriority[a.overallRisk] - riskPriority[b.overallRisk];
    }
    if (a.riskScore !== b.riskScore) {
      return a.riskScore - b.riskScore;
    }
    return a.totalDistanceKm - b.totalDistanceKm;
  });

  const primary = sorted[0] || evaluateRouteRisk(routes[0], activeIncidents);
  primary.isSafest = true;

  const alternative = sorted.length > 1 ? sorted[1] : null;

  return {
    primarySafeRoute: primary,
    allEvaluatedRoutes: sorted,
    alternativeRoute: alternative
  };
}

/**
 * Check if a single incoming incident directly intersects an active route
 */
export function isRouteIntersectingIncident(
  route: EvaluatedRoute,
  incident: Incident,
  thresholdM = 350
): { intersects: boolean; distanceM: number } {
  if (!incident.latitude || !incident.longitude) return { intersects: false, distanceM: Infinity };

  let minDistance = Infinity;
  for (const [wLat, wLng] of route.waypoints) {
    const d = distMeters(wLat, wLng, incident.latitude, incident.longitude);
    if (d < minDistance) minDistance = d;
  }

  return {
    intersects: minDistance <= thresholdM,
    distanceM: Math.round(minDistance)
  };
}
