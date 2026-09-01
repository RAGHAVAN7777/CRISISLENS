import { NextResponse } from 'next/server';
import { VOLUNTEER_PHONE_NUMBERS } from '@/lib/config';

export interface VolunteerAlertPayload {
  incidentId: string;
  disasterType: string;
  severity: string;
  confidence: number;
  latitude: number;
  longitude: number;
  isBlurry: boolean;
  blurScore?: number;
  verificationRequired: boolean;
  source?: string;
  status?: string;
}

export interface SmsDeliveryResult {
  incidentId: string;
  recipient: string;
  status: 'sent' | 'failed' | 'simulated';
  mode: 'real_twilio' | 'demo_simulation';
  message: string;
  messageId?: string;
  error?: string;
  timestamp: string;
}

/**
 * Format the standard emergency SMS message text for volunteers
 */
export function formatVolunteerSmsBody(data: VolunteerAlertPayload): string {
  const isBlurry = data.isBlurry;
  const isLowConfidence = data.confidence < 70;
  const needsVerification = data.verificationRequired || isBlurry || isLowConfidence;

  let qualityLine = `Image Quality:\n${isBlurry ? '⚠ BLURRY' : 'CLEAR'}`;
  let verificationNotice = '';

  if (isBlurry) {
    verificationNotice = `\n⚠ Image Quality: BLURRY\nFIELD VERIFICATION REQUIRED\n\nA citizen has reported a possible ${data.disasterType.toLowerCase()}. The image is blurry, so physical verification is required.`;
  } else if (isLowConfidence) {
    verificationNotice = `\n⚠ LOW AI CONFIDENCE (${data.confidence}%)\nFIELD VERIFICATION REQUIRED\n\nPlease physically verify the situation.`;
  } else {
    verificationNotice = `\nA citizen has reported a possible ${data.disasterType.toLowerCase()} at the above location.\n\nPlease open the Volunteer Dashboard and verify the incident.`;
  }

  return `🚨 DISASTER ALERT

Disaster: ${data.disasterType}
Severity: ${data.severity}
AI Confidence: ${data.confidence}%

Location:
${data.latitude.toFixed(4)}, ${data.longitude.toFixed(4)}

${qualityLine}

Source:
${data.source || 'Citizen Photo'}

Status:
${needsVerification ? 'FIELD VERIFICATION REQUIRED' : (data.status || 'UNVERIFIED')}
${verificationNotice}

Incident ID:
${data.incidentId}`;
}

export async function POST(request: Request) {
  try {
    const payload: VolunteerAlertPayload = await request.json();

    if (!payload || !payload.incidentId || !payload.disasterType) {
      return NextResponse.json({ error: 'Invalid incident payload for volunteer alert' }, { status: 400 });
    }

    const recipients = VOLUNTEER_PHONE_NUMBERS;
    const body = formatVolunteerSmsBody(payload);

    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const fromNumber = process.env.TWILIO_PHONE_NUMBER;

    const hasTwilioCredentials = Boolean(accountSid && authToken && fromNumber);

    const deliveryResults: SmsDeliveryResult[] = [];

    for (const recipient of recipients) {
      const now = new Date().toISOString();

      if (hasTwilioCredentials) {
        try {
          // Send via Twilio REST API without exposing credentials to frontend
          const basicAuth = Buffer.from(`${accountSid}:${authToken}`).toString('base64');
          const twilioEndpoint = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;

          const params = new URLSearchParams();
          params.append('To', recipient);
          params.append('From', fromNumber!);
          params.append('Body', body);

          const response = await fetch(twilioEndpoint, {
            method: 'POST',
            headers: {
              'Authorization': `Basic ${basicAuth}`,
              'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: params.toString()
          });

          if (response.ok) {
            const data = await response.json();
            deliveryResults.push({
              incidentId: payload.incidentId,
              recipient,
              status: 'sent',
              mode: 'real_twilio',
              messageId: data.sid,
              message: body,
              timestamp: now
            });
          } else {
            const errText = await response.text();
            console.error(`[Twilio Error] Failed to send SMS to ${recipient}:`, errText);
            deliveryResults.push({
              incidentId: payload.incidentId,
              recipient,
              status: 'failed',
              mode: 'real_twilio',
              error: errText,
              message: body,
              timestamp: now
            });
          }
        } catch (err: any) {
          console.error(`[Twilio Network Error] ${recipient}:`, err);
          deliveryResults.push({
            incidentId: payload.incidentId,
            recipient,
            status: 'failed',
            mode: 'real_twilio',
            error: err?.message || 'Network failure',
            message: body,
            timestamp: now
          });
        }
      } else {
        // Safe Demo / Simulation Mode
        console.log(`[DEMO SMS] Simulated volunteer alert to ${recipient}:\n${body}`);
        deliveryResults.push({
          incidentId: payload.incidentId,
          recipient,
          status: 'sent',
          mode: 'demo_simulation',
          messageId: `demo_msg_${Date.now()}_${recipient.replace(/\+/g, '')}`,
          message: body,
          timestamp: now
        });
      }
    }

    return NextResponse.json({
      success: true,
      incidentId: payload.incidentId,
      mode: hasTwilioCredentials ? 'real_twilio' : 'demo_simulation',
      results: deliveryResults,
      sampleMessage: body
    });

  } catch (error: any) {
    console.error('Error in /api/sms/volunteer-alert:', error);
    return NextResponse.json({ error: error?.message || 'Internal Server Error' }, { status: 500 });
  }
}
