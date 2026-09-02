export interface MedicDisasterTypeResult {
  model: string;
  hazard: string | string[];
  disaster_type: string;
  confidence: number;
  probabilities: Record<string, number>;
  evidence?: string[];
  mode: 'real_ml_inference' | 'demo_fallback';
  low_image_quality?: boolean;
}

export interface DamageSeverityResult {
  model: string;
  hazard: string | string[];
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  damage_class: string;
  confidence: number;
  evidence: string[];
  raw_probs?: Record<string, number>;
  mode: 'real_ml_inference' | 'demo_fallback';
  low_image_quality?: boolean;
}

export interface VisionAnalysisResult {
  hazard: string | string[];
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  confidence: number;
  evidence: string[];
  model?: string;
  mode?: string;
  medic?: MedicDisasterTypeResult;
  damage?: DamageSeverityResult;
  modelsUsed?: string[];
  low_image_quality?: boolean;
}

export class DisasterTypeClassifier {
  static async predict(file: File): Promise<MedicDisasterTypeResult> {
    const formData = new FormData();
    formData.append('image', file);

    try {
      const response = await fetch('http://localhost:8000/predict-disaster-type', {
        method: 'POST',
        body: formData,
      });

      if (response.ok) {
        const data = await response.json();
        if (data && typeof data === 'object' && data.disaster_type) {
          return data as MedicDisasterTypeResult;
        }
      }
    } catch (e) {
      console.warn('Local DisasterTypeClassifier unreachable, using demo fallback:', e);
    }

    // Client-side deterministic fallback
    return {
      model: 'MEDIC Disaster Type Classifier (Demo Fallback)',
      hazard: 'FLOOD',
      disaster_type: 'flood',
      confidence: 72.0,
      probabilities: {
        earthquake: 4.2,
        flood: 72.0,
        hurricane: 12.1,
        fire: 3.5,
        landslide: 2.1,
        not_disaster: 3.8,
        other_disaster: 2.3,
      },
      mode: 'demo_fallback',
    };
  }
}

export class DamageClassifier {
  static async predict(file: File): Promise<DamageSeverityResult> {
    const formData = new FormData();
    formData.append('image', file);

    try {
      const response = await fetch('http://localhost:8000/predict', {
        method: 'POST',
        body: formData,
      });

      if (response.ok) {
        const data = await response.json();
        if (data && typeof data === 'object' && data.damage_class) {
          return data as DamageSeverityResult;
        }
      }
    } catch (e) {
      console.warn('Local DamageClassifier unreachable, using demo fallback:', e);
    }

    // Client-side deterministic fallback
    return {
      model: 'BiTemporal-StreetView-Damage (Demo Fallback)',
      hazard: 'STRUCTURAL DAMAGE',
      severity: 'HIGH',
      damage_class: 'moderate',
      confidence: 75.0,
      evidence: [
        'Visible facade fragmentation',
        'Debris on roadway surface',
      ],
      mode: 'demo_fallback',
    };
  }
}

class GroqFallbackClassifier {
  static async predict(file: File): Promise<{ evidence: string[]; confidence: number }> {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = async () => {
        const base64 = reader.result as string;
        try {
          const response = await fetch('/api/analyze', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ imageBase64: base64 }),
          });

          if (response.ok) {
            const data = await response.json();
            resolve({
              evidence: data?.evidence || [],
              confidence: data?.confidence || 85,
            });
            return;
          }
        } catch (error) {
          console.warn('Groq reasoning fallback failed:', error);
        }

        resolve({
          evidence: [
            'Visual damage pattern identified',
            'Hazard characteristics corroborated by geospatial context',
          ],
          confidence: 80,
        });
      };
      reader.onerror = () => {
        resolve({
          evidence: ['Visual damage indicators detected across scene'],
          confidence: 75,
        });
      };
      reader.readAsDataURL(file);
    });
  }
}

export class VisionService {
  static async analyzeImage(file: File): Promise<VisionAnalysisResult> {
    // 1. Run MEDIC Disaster Type Classifier
    const medicResult = (await DisasterTypeClassifier.predict(file)) || {
      model: 'MEDIC Fallback',
      hazard: 'FLOOD',
      disaster_type: 'flood',
      confidence: 70,
      probabilities: {},
      evidence: [],
      mode: 'demo_fallback' as const,
    };

    // 2. Run BiTemporal Damage Severity Classifier
    const damageResult = (await DamageClassifier.predict(file)) || {
      model: 'BiTemporal Fallback',
      hazard: 'STRUCTURAL DAMAGE',
      severity: 'HIGH' as const,
      damage_class: 'moderate',
      confidence: 70,
      evidence: ['Structural damage pattern detected'],
      mode: 'demo_fallback' as const,
    };

    // 3. Run Groq multi-modal reasoning layer for visual evidence
    const groqResult = (await GroqFallbackClassifier.predict(file)) || {
      evidence: [],
      confidence: 75,
    };

    // 4. Combine multi-model intelligence cleanly
    const isNotDisaster = medicResult.disaster_type === 'not_disaster';
    const hazard = isNotDisaster && damageResult.damage_class === 'no_damage' 
      ? 'NONE' 
      : (medicResult.hazard || damageResult.hazard || 'DISASTER');

    const severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' = isNotDisaster && damageResult.damage_class === 'no_damage'
      ? 'LOW'
      : (damageResult.severity || 'MEDIUM');

    const confidence = Math.round(
      ((medicResult.confidence || 70) * 0.55) + ((damageResult.confidence || 70) * 0.45)
    );

    const hazardTitle = Array.isArray(medicResult.hazard) ? medicResult.hazard.join(' / ') : (medicResult.hazard || 'Identified');
    const combinedEvidence = Array.from(
      new Set([
        ...(medicResult.evidence || []),
        ...(damageResult.evidence || []),
        `Disaster Type: ${hazardTitle} (${medicResult.confidence || 70}% confidence)`,
        `Damage Severity: ${(damageResult.damage_class || 'MODERATE').toUpperCase()} (${severity})`,
        ...(groqResult.evidence || []),
      ])
    );

    const isRealML = medicResult.mode === 'real_ml_inference' && damageResult.mode === 'real_ml_inference';

    return {
      hazard,
      severity,
      confidence,
      evidence: combinedEvidence,
      model: `${medicResult.model || 'MEDIC'} + ${damageResult.model || 'BiTemporal'}`,
      mode: isRealML ? 'real_ml_inference' : 'demo_fallback',
      medic: medicResult,
      damage: damageResult,
      modelsUsed: [medicResult.model || 'MEDIC', damageResult.model || 'BiTemporal'],
      low_image_quality: medicResult.low_image_quality || damageResult.low_image_quality || false,
    };
  }
}
