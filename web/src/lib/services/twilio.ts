import { Incident, addSmsDeliveryRecords, SmsDeliveryRecord } from '@/lib/storage';

export interface VolunteerAlertResponse {
  success: boolean;
  incidentId: string;
  mode: 'real_twilio' | 'demo_simulation';
  results: SmsDeliveryRecord[];
  sampleMessage?: string;
}

export class TwilioService {
  /**
   * Dispatches automated SMS alerts to ALL volunteer phone numbers via the backend API.
   * Runs in both Real Twilio Mode (when configured in .env) and Safe Demo Simulation Mode.
   * Stores per-volunteer delivery records in localStorage.
   */
  static async sendVolunteerAlerts(incident: Incident): Promise<VolunteerAlertResponse> {
    const payload = {
      incidentId: incident.id,
      disasterType: incident.hazard,
      severity: incident.severity,
      confidence: incident.confidence,
      latitude: incident.latitude,
      longitude: incident.longitude,
      isBlurry: Boolean(incident.isBlurry),
      blurScore: incident.blurScore,
      verificationRequired: Boolean(incident.verificationRequired || incident.isBlurry || incident.confidence < 70),
      source: incident.sources?.includes('Photo') ? 'Citizen Photo' : (incident.sources?.[0] || 'Citizen Report'),
      status: incident.verificationStatus || 'UNVERIFIED',
    };

    try {
      const response = await fetch('/api/sms/volunteer-alert', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        const data: VolunteerAlertResponse = await response.json();
        if (data.results && data.results.length > 0) {
          addSmsDeliveryRecords(data.results);
        }
        return data;
      }
    } catch (e) {
      console.warn('Backend /api/sms/volunteer-alert fetch failed, recording fallback simulation:', e);
    }

    // Client-side fallback if backend API is somehow unreachable
    const fallbackRecords: SmsDeliveryRecord[] = [
      {
        incidentId: incident.id,
        recipient: '+918838250227',
        status: 'simulated',
        mode: 'demo_simulation',
        message: `🚨 DISASTER ALERT: ${incident.hazard} at ${incident.latitude.toFixed(4)}, ${incident.longitude.toFixed(4)}`,
        timestamp: new Date().toISOString(),
      },
      {
        incidentId: incident.id,
        recipient: '+919444562413',
        status: 'simulated',
        mode: 'demo_simulation',
        message: `🚨 DISASTER ALERT: ${incident.hazard} at ${incident.latitude.toFixed(4)}, ${incident.longitude.toFixed(4)}`,
        timestamp: new Date().toISOString(),
      },
    ];
    addSmsDeliveryRecords(fallbackRecords);

    return {
      success: true,
      incidentId: incident.id,
      mode: 'demo_simulation',
      results: fallbackRecords,
    };
  }

  /**
   * Legacy simulation helper
   */
  static async sendSMS(to: string, body: string) {
    console.log(`[SIMULATION] Simulated sending SMS to ${to}: "${body}"`);
    return { success: true, mode: 'simulation' };
  }

  /**
   * Handles incoming SMS simulation
   */
  static async handleIncomingSMS(from: string, body: string) {
    console.log(`[SIMULATION] Received incoming SMS from ${from}: "${body}"`);
    return { success: true };
  }

  /**
   * Handles incoming Voice simulation
   */
  static async handleIncomingCall(from: string, recordingTranscription: string) {
    console.log(`[SIMULATION] Received incoming call transcription from ${from}: "${recordingTranscription}"`);
    return { success: true };
  }
}
