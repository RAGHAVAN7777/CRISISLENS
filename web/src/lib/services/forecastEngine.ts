/**
 * Disaster Time Machine — Forecast Engine
 *
 * ML-driven risk projection.
 * Relies entirely on the PyTorch GRU model output from POST /api/forecast.
 */

import { Incident } from '@/lib/storage';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type TimeStep = 'NOW' | 'T15' | 'T30' | 'T60';
export type RiskTrend = 'STRONGLY_INCREASING' | 'INCREASING' | 'STABLE' | 'DECREASING';
export type RiskLevel = 'MINIMAL' | 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export interface ForecastZone {
  incidentId: string;
  hazard: string;
  lat: number;
  lng: number;
  radiusM: number;
  riskScore: number;     // 0–100
  riskLevel: RiskLevel;
  isSimulated?: boolean;
}

export interface ForecastSummary {
  zones: ForecastZone[];
  overallRiskScore: number;
  overallRiskLevel: RiskLevel;
  trend: RiskTrend;
  forecastConfidence: number;  // 0–100
  dominantHazard: string | null;
  totalReports: number;
  uniqueSources: string[];
  verifiedCount: number;
  explainability: string[];
  whatHappensNext: Record<TimeStep, string>;
}

// ─────────────────────────────────────────────────────────────────────────────
// Core helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Haversine distance in metres */
function distM(lat1: number, lng1: number, lat2: number, lng2: number): number {
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

// ─────────────────────────────────────────────────────────────────────────────
// Generate Forecast Zones for a given TimeStep using ML Data
// ─────────────────────────────────────────────────────────────────────────────

export function generateForecastZones(
  incidents: Incident[],
  step: TimeStep,
  mlData: any
): ForecastZone[] {
  if (!mlData || !mlData.forecast) return [];

  const stepKey = step === 'NOW' ? 'now' : step === 'T15' ? '15min' : step === 'T30' ? '30min' : '60min';
  const mlForecast = mlData.forecast[stepKey];

  if (!mlForecast) return [];

  return incidents
    .filter(i => {
      if (i.status === 'RESOLVED' || i.status === 'REJECTED') return false;
      if (i.verificationStatus === 'FALSE_REPORT') return false;
      if (!i.latitude || !i.longitude || isNaN(i.latitude) || isNaN(i.longitude)) return false;
      return true;
    })
    .map(i => {
      return {
        incidentId: i.id,
        hazard: i.hazard || mlData.location?.district || 'Unknown',
        lat: i.latitude,
        lng: i.longitude,
        radiusM: mlForecast.radius_m || 0,
        riskScore: Math.round((mlForecast.probability || 0) * 100),
        riskLevel: mlForecast.risk || 'LOW',
        isSimulated: Boolean((i as any).isSimulated),
      } as ForecastZone;
    });
}

// ─────────────────────────────────────────────────────────────────────────────
// Check route waypoints vs forecast zones
// ─────────────────────────────────────────────────────────────────────────────

export function checkRouteIntersectsForecast(
  waypoints: [number, number][],
  zones: ForecastZone[]
): { intersects: boolean; reason: string; worstZone: ForecastZone | null } {
  let worstZone: ForecastZone | null = null;

  for (const zone of zones) {
    if (zone.radiusM === 0) continue;
    for (const [lat, lng] of waypoints) {
      const d = distM(lat, lng, zone.lat, zone.lng);
      if (d <= zone.radiusM * 1.3) { // 30% buffer for safety
        if (!worstZone || zone.riskScore > worstZone.riskScore) {
          worstZone = zone;
        }
      }
    }
  }

  if (!worstZone) {
    return { intersects: false, reason: 'Route is clear of all predicted risk zones.', worstZone: null };
  }

  return {
    intersects: true,
    reason: `Route passes through projected ${worstZone.hazard} risk zone (${worstZone.riskLevel} risk).`,
    worstZone,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Full Forecast Summary (Driven by ML)
// ─────────────────────────────────────────────────────────────────────────────

export function buildForecastSummary(incidents: Incident[], step: TimeStep, mlData: any): ForecastSummary | null {
  if (!mlData || !mlData.forecast) return null;

  const active = incidents.filter(
    i => i.status !== 'RESOLVED' && i.status !== 'REJECTED' && i.verificationStatus !== 'FALSE_REPORT'
  );

  const zones = generateForecastZones(incidents, step, mlData);
  
  const stepKey = step === 'NOW' ? 'now' : step === 'T15' ? '15min' : step === 'T30' ? '30min' : '60min';
  const mlForecast = mlData.forecast[stepKey];

  const overallRiskScore = Math.round((mlForecast?.probability || 0) * 100);
  const overallRiskLevel = mlForecast?.risk || 'LOW';

  // Determine trend from ML probabilities
  const pNow = mlData.forecast['now']?.probability || 0;
  const p60 = mlData.forecast['60min']?.probability || 0;
  const diff = p60 - pNow;
  let trend: RiskTrend = 'STABLE';
  if (diff > 0.3) trend = 'STRONGLY_INCREASING';
  else if (diff > 0.1) trend = 'INCREASING';
  else if (diff < -0.1) trend = 'DECREASING';

  const dominantHazard = zones.length > 0 ? zones[0].hazard : null;

  const allSources = new Set(active.flatMap(i => i.sources ?? []));
  const verified = active.filter(
    i => i.verificationStatus === 'VERIFIED' || i.verificationStatus === 'PARTIALLY_VERIFIED'
  ).length;

  return {
    zones,
    overallRiskScore,
    overallRiskLevel,
    trend,
    forecastConfidence: mlForecast?.confidence || 0,
    dominantHazard,
    totalReports: active.length,
    uniqueSources: [...allSources],
    verifiedCount: verified,
    explainability: mlData.explainability || [],
    whatHappensNext: mlData.what_may_happen_next || {},
  };
}
