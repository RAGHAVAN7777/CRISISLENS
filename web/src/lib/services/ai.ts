import { VisionAnalysisResult } from './vision';
import {
  Report, Incident, addReport, addIncident, getIncidents, updateIncident,
  notifyAllVolunteers, VerificationStatus
} from '@/lib/storage';
import { syncIncidentsToRoadGraph } from './routeRiskService';
import { CONFIDENCE_THRESHOLD, PROXIMITY_THRESHOLD_DEG } from '@/lib/config';

function notifyRouteSystem() {
  const all = getIncidents();
  syncIncidentsToRoadGraph(all);
}

function calculateHaversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371e3;
  const phi1 = lat1 * Math.PI/180;
  const phi2 = lat2 * Math.PI/180;
  const deltaPhi = (lat2-lat1) * Math.PI/180;
  const deltaLambda = (lon2-lon1) * Math.PI/180;

  const a = Math.sin(deltaPhi/2) * Math.sin(deltaPhi/2) +
            Math.cos(phi1) * Math.cos(phi2) *
            Math.sin(deltaLambda/2) * Math.sin(deltaLambda/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

function isDuplicateIncident(inc: Incident, reportLat: number, reportLng: number, reportCreatedAt: string): boolean {
  if (inc.status === 'RESOLVED' || inc.status === 'REJECTED') return false;
  const dist = calculateHaversineDistance(inc.latitude, inc.longitude, reportLat, reportLng);
  if (dist > 100) return false;
  const incTime = new Date(inc.createdAt).getTime();
  const reportTime = new Date(reportCreatedAt).getTime();
  if (Math.abs(incTime - reportTime) > 30 * 60 * 1000) return false;
  return true;
}

/**
 * Determine verificationStatus and verificationRequired based on:
 *  - image blur
 *  - AI confidence below threshold
 *  - conflicting classifications with existing incidents
 */
function assessVerificationNeed(
  isBlurry: boolean,
  confidence: number,
  conflictingReports: boolean
): { verificationRequired: boolean; verificationStatus: VerificationStatus } {
  const required = isBlurry || confidence < CONFIDENCE_THRESHOLD || conflictingReports;
  return {
    verificationRequired: required,
    verificationStatus: required ? 'FIELD_VERIFICATION_REQUIRED' : 'UNVERIFIED',
  };
}

export class AIReasoningService {
  static async processPhotoReport(
    visionData: VisionAnalysisResult,
    lat: number,
    lng: number,
    description: string,
    imageUrl: string = '/placeholder-disaster.jpg',
    blurScore: number = 999,
    isBlurry: boolean = false,
    accuracy?: number
  ): Promise<{ report: Report; incident: Incident }> {
    await new Promise(resolve => setTimeout(resolve, 800));

    const reportId = `rep_${Date.now()}`;
    const report: Report = {
      id: reportId,
      source: 'Photo',
      image: imageUrl,
      message: description,
      latitude: lat,
      longitude: lng,
      accuracy,
      hazard: visionData.hazard,
      severity: visionData.severity,
      confidence: visionData.confidence,
      evidence: visionData.evidence,
      blurScore,
      isBlurry,
      createdAt: new Date().toISOString()
    };

    const incidents = getIncidents();

    // ── Conflict detection: nearby incident with different hazard type ──
    const conflictingIncident = incidents.find(inc =>
      JSON.stringify(inc.hazard) !== JSON.stringify(report.hazard) &&
      isDuplicateIncident(inc, report.latitude, report.longitude, report.createdAt)
    );
    const conflictingReports = !!conflictingIncident;

    // ── Try to fuse with an existing incident of the SAME type ──
    let targetIncident = incidents.find(inc =>
      JSON.stringify(inc.hazard) === JSON.stringify(report.hazard) &&
      isDuplicateIncident(inc, report.latitude, report.longitude, report.createdAt)
    );

    const { verificationRequired, verificationStatus } = assessVerificationNeed(
      isBlurry,
      visionData.confidence,
      conflictingReports
    );

    if (targetIncident) {
      // Merge into existing incident
      targetIncident.reportIds.push(report.id);
      targetIncident.reportCount += 1;
      targetIncident.confidence = Math.min(100, targetIncident.confidence + 2);

      if (!targetIncident.sources.includes(report.source)) {
        targetIncident.sources.push(report.source);
      }

      // Escalate verificationRequired if this new report triggers it
      const escalatedVR = targetIncident.verificationRequired || verificationRequired;
      const escalatedVS: VerificationStatus = escalatedVR
        ? 'FIELD_VERIFICATION_REQUIRED'
        : (targetIncident.verificationStatus ?? 'UNVERIFIED');

      updateIncident(targetIncident.id, {
        reportIds: targetIncident.reportIds,
        reportCount: targetIncident.reportCount,
        confidence: targetIncident.confidence,
        sources: targetIncident.sources,
        verificationRequired: escalatedVR,
        verificationStatus: escalatedVS,
        conflictingReports: targetIncident.conflictingReports || conflictingReports,
        imageUrl: imageUrl !== '/placeholder-disaster.jpg' ? imageUrl : targetIncident.imageUrl,
        disasterType: visionData.medic?.disaster_type ?? targetIncident.disasterType,
        damageClass: visionData.damage?.damage_class ?? targetIncident.damageClass,
      });

      addReport(report);

      // Notify all volunteers
      notifyAllVolunteers(
        targetIncident.id,
        Array.isArray(visionData.hazard) ? visionData.hazard.join(' / ') : visionData.hazard,
        report.severity,
        visionData.confidence,
        isBlurry
      );

      notifyRouteSystem();
      return { report, incident: { ...targetIncident } };
    } else {
      // Create a new incident
      targetIncident = {
        id: `inc_${Date.now()}`,
        hazard: report.hazard,
        severity: report.severity,
        latitude: report.latitude,
        longitude: report.longitude,
        accuracy: report.accuracy,
        confidence: report.confidence,
        reportIds: [report.id],
        reportCount: 1,
        sources: [report.source],
        status: 'AI_CLASSIFIED',
        verificationStatus,
        verificationRequired,
        conflictingReports,
        blurScore,
        isBlurry,
        imageUrl: imageUrl !== '/placeholder-disaster.jpg' ? imageUrl : undefined,
        disasterType: visionData.medic?.disaster_type,
        damageClass: visionData.damage?.damage_class,
        createdAt: report.createdAt,
        location_precision: 'exact'
      };
      addIncident(targetIncident);
      addReport(report);

      // Notify all volunteers
      notifyAllVolunteers(
        targetIncident.id,
        Array.isArray(visionData.hazard) ? visionData.hazard.join(' / ') : visionData.hazard,
        report.severity,
        visionData.confidence,
        isBlurry
      );

      notifyRouteSystem();
      return { report, incident: targetIncident };
    }
  }

  static async processTextReport(
    text: string,
    source: 'SMS' | 'Voice',
    phoneNumber: string,
    twilioLat?: number,
    twilioLng?: number
  ): Promise<{ report: Report; incident: Incident }> {
    await new Promise(resolve => setTimeout(resolve, 1500));

    const textLower = text.toLowerCase();
    let hazard = 'UNKNOWN';
    let severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' = 'MEDIUM';

    if (textLower.includes('flood') || textLower.includes('water')) {
      hazard = 'FLOOD';
      severity = textLower.includes('stuck') || textLower.includes('trap') ? 'HIGH' : 'MEDIUM';
    } else if (textLower.includes('fire') || textLower.includes('smoke')) {
      hazard = 'FIRE';
      severity = 'CRITICAL';
    } else if (textLower.includes('collapse') || textLower.includes('damage') || textLower.includes('earthquake')) {
      hazard = 'STRUCTURAL DAMAGE';
      severity = 'HIGH';
    } else if (textLower.includes('block') || textLower.includes('tree')) {
      hazard = 'FALLEN OBJECT / ROAD BLOCKAGE';
      severity = 'LOW';
    } else {
      hazard = 'GENERAL EMERGENCY';
    }

    // Mock geolocation near LA for demo purposes
    const lat = twilioLat ?? (34.0522 + (Math.random() - 0.5) * 0.1);
    const lng = twilioLng ?? (-118.2437 + (Math.random() - 0.5) * 0.1);

    const reportId = `rep_${Date.now()}`;
    const location_precision = (source === 'SMS' || source === 'Voice') ? 'approximate' : 'exact';

    const report: Report = {
      id: reportId,
      source: source,
      message: text,
      transcript: source === 'Voice' ? text : undefined,
      latitude: lat,
      longitude: lng,
      hazard: hazard,
      severity: severity,
      confidence: 85,
      evidence: [`NLP Extraction from ${source}`, `Sender: ${phoneNumber}`],
      createdAt: new Date().toISOString(),
      location_precision
    };

    const incidents = getIncidents();

    let targetIncident = incidents.find(inc =>
      inc.hazard === report.hazard &&
      isDuplicateIncident(inc, report.latitude, report.longitude, report.createdAt)
    );

    if (targetIncident) {
      targetIncident.reportIds.push(report.id);
      targetIncident.reportCount += 1;
      targetIncident.confidence = Math.min(100, targetIncident.confidence + 5);

      if (!targetIncident.sources.includes(report.source)) {
        targetIncident.sources.push(report.source);
      }

      updateIncident(targetIncident.id, {
        reportIds: targetIncident.reportIds,
        reportCount: targetIncident.reportCount,
        confidence: targetIncident.confidence,
        sources: targetIncident.sources
      });
      addReport(report);
      notifyRouteSystem();
    } else {
      targetIncident = {
        id: `inc_${Date.now()}`,
        hazard: report.hazard,
        severity: report.severity,
        latitude: report.latitude,
        longitude: report.longitude,
        confidence: report.confidence,
        reportIds: [report.id],
        reportCount: 1,
        sources: [report.source],
        status: 'PENDING',
        verificationStatus: 'UNVERIFIED',
        verificationRequired: false,
        createdAt: report.createdAt,
        location_precision: report.location_precision
      };
      addIncident(targetIncident);
      addReport(report);
      notifyRouteSystem();
    }

    return { report, incident: targetIncident };
  }
}
