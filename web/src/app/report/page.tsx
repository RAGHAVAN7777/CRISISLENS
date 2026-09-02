"use client";

import { useState, useRef, useEffect } from 'react';
import dynamic from 'next/dynamic';
import {
  UploadCloud, MapPin, CheckCircle2, ChevronRight,
  Shield, AlertCircle, Users, Cpu, Camera, RefreshCw,
  Eye, Navigation, ArrowRight, Zap, AlertTriangle
} from 'lucide-react';
import { VisionService, VisionAnalysisResult } from '@/lib/services/vision';
import { AIReasoningService } from '@/lib/services/ai';
import { computeBlurScore, BlurResult } from '@/lib/services/blur';
import { seedVolunteers, getIncidents, Incident, SmsDeliveryRecord } from '@/lib/storage';
import { TwilioService } from '@/lib/services/twilio';
import Link from 'next/link';

// Dynamically import Leaflet MapComponent with SSR disabled
const MapComponent = dynamic(() => import('@/components/MapComponent'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-72 flex flex-col items-center justify-center text-zinc-500 bg-zinc-950 rounded-2xl border border-zinc-800">
      <RefreshCw className="w-8 h-8 mb-2 animate-spin text-indigo-500" />
      <p className="text-xs">Loading Live Leaflet Map...</p>
    </div>
  )
});

interface ProcessingStage {
  id: string;
  label: string;
  detail?: string;
  done: boolean;
  active: boolean;
}

export default function ReportPage() {
  const [step, setStep] = useState<'IDLE' | 'PROCESSING' | 'LOCATION_ERROR' | 'RESULT'>('IDLE');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  // GPS state
  const [lat, setLat] = useState<number | null>(null);
  const [lng, setLng] = useState<number | null>(null);
  const [accuracy, setAccuracy] = useState<number | null>(null);
  const [locationSource, setLocationSource] = useState<'GPS' | 'DEMO' | 'MANUAL'>('GPS');
  const [locationErrorMessage, setLocationErrorMessage] = useState<string>('');

  const [manualLat, setManualLat] = useState<string>('');
  const [manualLng, setManualLng] = useState<string>('');

  // Processing checklist state
  const [stages, setStages] = useState<ProcessingStage[]>([
    { id: 'upload', label: 'Image uploaded', done: false, active: false },
    { id: 'gps', label: 'GPS location detected', done: false, active: false },
    { id: 'disaster', label: 'Disaster identified (MEDIC Classifier)', done: false, active: false },
    { id: 'damage', label: 'Damage severity assessed (BiTemporal Model)', done: false, active: false },
    { id: 'blur', label: 'Blur detection computed', done: false, active: false },
    { id: 'incident', label: 'Incident created & pinned to map', done: false, active: false },
    { id: 'volunteers', label: 'All volunteers notified', done: false, active: false },
    { id: 'sms', label: 'SMS alerts dispatched', done: false, active: false },
  ]);

  // SMS delivery results for current submission
  const [smsResults, setSmsResults] = useState<SmsDeliveryRecord[]>([]);
  const [smsMode, setSmsMode] = useState<'real_twilio' | 'demo_simulation' | null>(null);

  // Results
  const [blurResult, setBlurResult] = useState<BlurResult | null>(null);
  const [visionResult, setVisionResult] = useState<VisionAnalysisResult | null>(null);
  const [createdIncident, setCreatedIncident] = useState<Incident | null>(null);

  const processingRef = useRef(false);

  useEffect(() => {
    seedVolunteers();
  }, []);

  // Update specific stage in the progress checklist
  const updateStage = (id: string, updates: Partial<ProcessingStage>) => {
    setStages(prev => prev.map(s => s.id === id ? { ...s, ...updates } : s));
  };

  // ─────────────────────────────────────────────────────────────────────────────
  // Core Automated Pipeline Trigger
  // ─────────────────────────────────────────────────────────────────────────────
  const resizeImage = (file: File, maxEdge: number = 1024, quality: number = 0.7): Promise<File> => {
    return new Promise((resolve, reject) => {
      if (!file.type.startsWith('image/')) {
        reject(new Error('Not an image file'));
        return;
      }
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          let width = img.width;
          let height = img.height;
          if (width > maxEdge || height > maxEdge) {
            if (width > height) {
              height = Math.round((height * maxEdge) / width);
              width = maxEdge;
            } else {
              width = Math.round((width * maxEdge) / height);
              height = maxEdge;
            }
          }
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            resolve(file);
            return;
          }
          ctx.drawImage(img, 0, 0, width, height);
          canvas.toBlob((blob) => {
            if (blob) {
              resolve(new File([blob], file.name, { type: 'image/jpeg', lastModified: Date.now() }));
            } else {
              resolve(file);
            }
          }, 'image/jpeg', quality);
        };
        img.onerror = () => reject(new Error('Failed to load image'));
        img.src = e.target?.result as string;
      };
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsDataURL(file);
    });
  };

  const handleImageUpload = async (file: File) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      alert("Please upload a valid image file.");
      return;
    }
    
    let processedFile = file;
    try {
      processedFile = await resizeImage(file, 1024, 0.7);
    } catch (e) {
      console.warn("Failed to resize client-side, proceeding with original:", e);
    }

    setImageFile(processedFile);
    const previewUrl = URL.createObjectURL(processedFile);
    setImagePreview(previewUrl);

    // Start immediate automated workflow
    startPipeline(processedFile, previewUrl);
  };

  const handleManualSubmit = async () => {
    const latNum = parseFloat(manualLat);
    const lngNum = parseFloat(manualLng);

    try {
      const res = await fetch('/api/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lat: latNum, lon: lngNum })
      });
      if (!res.ok) {
        const data = await res.json();
        setLocationErrorMessage(data.error || 'Invalid coordinates');
        return;
      }
    } catch (err) {
      setLocationErrorMessage('Failed to validate coordinates with backend');
      return;
    }

    setLocationSource('MANUAL');
    setLocationErrorMessage('');
    if (imageFile && imagePreview) {
      startPipeline(imageFile, imagePreview, latNum, lngNum, 10);
    }
  };

  const startPipeline = async (file: File, previewUrl: string, forcedLat?: number, forcedLng?: number, forcedAccuracy?: number) => {
    if (processingRef.current) return;
    processingRef.current = true;

    setStep('PROCESSING');

    // Reset stages
    setSmsResults([]);
    setSmsMode(null);
    setStages([
      { id: 'upload', label: 'Image uploaded', detail: file.name, done: true, active: false },
      { id: 'gps', label: 'Detecting GPS location...', done: false, active: true },
      { id: 'disaster', label: 'Identifying disaster type (MEDIC Model)...', done: false, active: false },
      { id: 'damage', label: 'Assessing structural damage (BiTemporal Model)...', done: false, active: false },
      { id: 'blur', label: 'Evaluating image sharpness (Laplacian variance)...', done: false, active: false },
      { id: 'incident', label: 'Creating incident record in localStorage...', done: false, active: false },
      { id: 'volunteers', label: 'Dispatching notifications to ALL volunteers...', done: false, active: false },
      { id: 'sms', label: 'Sending SMS alerts to volunteers...', done: false, active: false },
    ]);

    // ── STAGE 1: Automatic GPS Location ──────────────────────────────────────
    let detectedLat = forcedLat ?? lat;
    let detectedLng = forcedLng ?? lng;
    let detectedAccuracy = forcedAccuracy ?? accuracy;

    if (!detectedLat || !detectedLng) {
      try {
        const coords = await fetchBrowserCoordinates();
        detectedLat = coords.latitude;
        detectedLng = coords.longitude;
        detectedAccuracy = coords.accuracy;
        setLat(detectedLat);
        setLng(detectedLng);
        setAccuracy(detectedAccuracy);
        setLocationSource('GPS');
        updateStage('gps', {
          label: 'GPS location detected',
          detail: `Lat: ${detectedLat.toFixed(4)}, Lng: ${detectedLng.toFixed(4)} (±${Math.round(detectedAccuracy || 0)}m)`,
          done: true,
          active: false
        });
      } catch (err: any) {
        console.warn('Browser GPS acquisition failed:', err);
        setLocationErrorMessage(err?.message || 'Location permission was denied or timed out.');
        setStep('LOCATION_ERROR');
        processingRef.current = false;
        return;
      }
    } else {
      updateStage('gps', {
        label: 'Location confirmed',
        detail: `Lat: ${detectedLat.toFixed(4)}, Lng: ${detectedLng.toFixed(4)} (${locationSource})`,
        done: true,
        active: false
      });
    }

    // ── STAGE 2: Blur Detection ──────────────────────────────────────────────
    updateStage('blur', { active: true });
    const blur = await computeBlurScore(file);
    setBlurResult(blur);
    updateStage('blur', {
      label: blur.isBlurry ? '⚠ Blurry image detected' : '✓ Image quality good',
      detail: `Sharpness Score: ${blur.blurScore} (Threshold: ${blur.threshold})`,
      done: true,
      active: false
    });

    // ── STAGE 3 & 4: Dual-Model ML Vision Inference ─────────────────────────
    updateStage('disaster', { active: true });
    updateStage('damage', { active: true });

    const vision = await VisionService.analyzeImage(file);
    setVisionResult(vision);

    updateStage('disaster', {
      label: `Disaster identified: ${vision.hazard}`,
      detail: `${vision.medic?.confidence || vision.confidence}% confidence · MEDIC Disaster Classifier`,
      done: true,
      active: false
    });

    updateStage('damage', {
      label: `Damage severity: ${vision.severity}`,
      detail: `${vision.damage?.damage_class ? `Class: ${vision.damage.damage_class.toUpperCase()}` : ''} · BiTemporal Model`,
      done: true,
      active: false
    });

    // ── STAGE 5 & 6: Automatic Incident Creation & Volunteer Dispatch ───────
    updateStage('incident', { active: true });
    updateStage('volunteers', { active: true });

    const { incident } = await AIReasoningService.processPhotoReport(
      vision,
      detectedLat,
      detectedLng,
      'Automated Citizen Photo Report',
      previewUrl,
      blur.blurScore,
      blur.isBlurry,
      detectedAccuracy || undefined
    );

    setCreatedIncident(incident);

    updateStage('incident', {
      label: 'Incident created & pinned to Leaflet map',
      detail: `ID: ${incident.id} · Status: ${incident.verificationStatus}`,
      done: true,
      active: false
    });

    updateStage('volunteers', {
      label: 'All 5 volunteers notified',
      detail: 'Individual alerts dispatched in localStorage',
      done: true,
      active: false
    });

    // ── STAGE 7: SMS Volunteer Alerts ─────────────────────────────────────────
    updateStage('sms', { active: true });
    try {
      const smsResponse = await TwilioService.sendVolunteerAlerts(incident);
      setSmsResults(smsResponse.results || []);
      setSmsMode(smsResponse.mode);
      const sentCount = smsResponse.results?.filter(r => r.status === 'sent' || r.status === 'simulated').length || 0;
      const modeLabel = smsResponse.mode === 'demo_simulation' ? '📲 Demo SMS Mode' : '✅ Twilio SMS';
      updateStage('sms', {
        label: `SMS alerts dispatched to ${sentCount} volunteer${sentCount !== 1 ? 's' : ''}`,
        detail: modeLabel,
        done: true,
        active: false
      });
    } catch (err) {
      console.warn('SMS dispatch failed (non-blocking):', err);
      updateStage('sms', {
        label: 'SMS alerts skipped (network error)',
        detail: 'Non-blocking — incident still created',
        done: true,
        active: false
      });
    }

    await new Promise(r => setTimeout(r, 600));

    // Transition to Result Screen
    setStep('RESULT');
    processingRef.current = false;
  };

  // Helper: Request browser geolocation as a promise
  const fetchBrowserCoordinates = (): Promise<{ latitude: number; longitude: number; accuracy: number }> => {
    return new Promise((resolve, reject) => {
      if (!('geolocation' in navigator)) {
        return reject(new Error('Geolocation is not supported by this browser.'));
      }
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          resolve({
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
            accuracy: pos.coords.accuracy,
          });
        },
        (err) => reject(err),
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
      );
    });
  };

  // Demo Location Fallback (LA city center demo coordinates)
  const useDemoLocation = () => {
    const demoLat = 34.0522;
    const demoLng = -118.2437;
    const demoAcc = 15;
    setLat(demoLat);
    setLng(demoLng);
    setAccuracy(demoAcc);
    setLocationSource('DEMO');

    if (imageFile && imagePreview) {
      startPipeline(imageFile, imagePreview, demoLat, demoLng, demoAcc);
    }
  };

  const handleRetryGPS = () => {
    if (imageFile && imagePreview) {
      setLat(null);
      setLng(null);
      startPipeline(imageFile, imagePreview);
    }
  };

  const resetForm = () => {
    setStep('IDLE');
    setImageFile(null);
    setImagePreview(null);
    setLat(null);
    setLng(null);
    setAccuracy(null);
    setBlurResult(null);
    setVisionResult(null);
    setCreatedIncident(null);
    processingRef.current = false;
  };

  const severityBadge = (sev: string) => {
    if (sev === 'CRITICAL') return 'text-red-400 bg-red-500/10 border-red-500/30';
    if (sev === 'HIGH') return 'text-amber-400 bg-amber-500/10 border-amber-500/30';
    if (sev === 'MEDIUM') return 'text-yellow-400 bg-yellow-500/10 border-yellow-500/30';
    return 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30';
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-[#030305] text-zinc-100 p-4 md:p-8">
      <div className="max-w-4xl mx-auto space-y-6">

        {/* ── HEADER ──────────────────────────────────────────────────────── */}
        <div className="border-b border-zinc-800 pb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-red-500/10 border border-red-500/30 text-red-400 text-xs font-bold tracking-wider mb-2">
              <Camera size={13} /> CITIZEN REPORTING PORTAL
            </div>
            <h1 className="text-3xl font-black tracking-tight text-white">
              Instant Disaster Photo Report
            </h1>
            <p className="text-zinc-400 text-sm mt-1">
              Select or take a photo. GPS coordinates, AI classification, Leaflet map pinning, and volunteer mobilization happen automatically.
            </p>
          </div>
          {step === 'RESULT' && (
            <button
              onClick={resetForm}
              className="self-start md:self-auto bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-bold py-2.5 px-4 rounded-xl transition-colors flex items-center gap-2"
            >
              <Camera size={14} /> Submit Another Report
            </button>
          )}
        </div>

        {/* ── STEP 1: INITIAL UPLOAD DROPZONE ─────────────────────────────── */}
        {step === 'IDLE' && (
          <div className="space-y-6">
            <div className="bg-zinc-950/60 border border-zinc-800 hover:border-zinc-700 rounded-3xl p-10 md:p-14 text-center transition-all group relative overflow-hidden">
              <input
                type="file"
                accept="image/*"
                onChange={(e) => e.target.files?.[0] && handleImageUpload(e.target.files[0])}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-20"
                id="photo-upload-input"
              />

              <div className="relative z-10 flex flex-col items-center justify-center space-y-4">
                <div className="p-4 rounded-2xl bg-zinc-900 border border-zinc-800 text-zinc-400 group-hover:text-red-400 group-hover:border-red-500/30 transition-all duration-300">
                  <UploadCloud className="w-10 h-10" />
                </div>
                <div>
                  <button
                    type="button"
                    className="inline-flex items-center gap-2 bg-zinc-900 hover:bg-zinc-800 text-zinc-100 border border-zinc-700/80 group-hover:border-red-500/40 font-bold text-sm tracking-wide px-6 py-3 rounded-xl shadow-md transition-all pointer-events-none"
                  >
                    <UploadCloud className="w-4 h-4 text-red-400" />
                    [ UPLOAD DISASTER IMAGE ]
                  </button>
                  <p className="text-zinc-400 text-sm mt-3 font-medium">or drag and drop your photo anywhere here</p>
                  <p className="text-zinc-600 text-xs mt-1">Supports JPG, PNG, WEBP (Max 15MB)</p>
                </div>
              </div>
            </div>

            {/* Quick explanation cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-zinc-950/40 border border-zinc-800/80 rounded-2xl p-5">
                <div className="w-8 h-8 rounded-xl bg-blue-500/10 text-blue-400 flex items-center justify-center font-bold text-xs mb-3">1</div>
                <h3 className="font-bold text-sm text-zinc-200 mb-1">Instant Auto-GPS</h3>
                <p className="text-xs text-zinc-500">Your device's precise location is detected on upload. No manual typing required.</p>
              </div>
              <div className="bg-zinc-950/40 border border-zinc-800/80 rounded-2xl p-5">
                <div className="w-8 h-8 rounded-xl bg-purple-500/10 text-purple-400 flex items-center justify-center font-bold text-xs mb-3">2</div>
                <h3 className="font-bold text-sm text-zinc-200 mb-1">Dual AI Models</h3>
                <p className="text-xs text-zinc-500">MEDIC classifies disaster type; BiTemporal assesses damage severity.</p>
              </div>
              <div className="bg-zinc-950/40 border border-zinc-800/80 rounded-2xl p-5">
                <div className="w-8 h-8 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center font-bold text-xs mb-3">3</div>
                <h3 className="font-bold text-sm text-zinc-200 mb-1">Live Map & Volunteers</h3>
                <p className="text-xs text-zinc-500">Incident is immediately pinned to the Leaflet map and alerts all volunteers.</p>
              </div>
            </div>
          </div>
        )}

        {/* ── STEP 2: LOCATION ERROR / PERMISSION FALLBACK ─────────────────── */}
        {step === 'LOCATION_ERROR' && (
          <div className="bg-zinc-950 border border-red-500/40 rounded-3xl p-8 text-center space-y-6 animate-in zoom-in duration-300">
            <div className="w-16 h-16 rounded-full bg-red-500/10 text-red-400 flex items-center justify-center mx-auto">
              <AlertTriangle className="w-8 h-8" />
            </div>
            <div>
              <h2 className="text-2xl font-black text-white">⚠ LOCATION REQUIRED</h2>
              <p className="text-zinc-400 text-sm max-w-md mx-auto mt-2">
                {locationErrorMessage || 'Please enable browser location access to submit a disaster report.'}
              </p>
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 max-w-md mx-auto">
              <button
                onClick={handleRetryGPS}
                className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 px-6 rounded-xl transition-colors flex items-center justify-center gap-2 text-sm"
              >
                <RefreshCw size={14} /> [TRY AGAIN]
              </button>
              <button
                onClick={useDemoLocation}
                className="w-full bg-amber-600/20 hover:bg-amber-600/30 text-amber-400 border border-amber-500/40 font-bold py-3 px-6 rounded-xl transition-colors flex items-center justify-center gap-2 text-sm"
              >
                <MapPin size={14} /> [USE DEMO LOCATION]
              </button>
            </div>

            <p className="text-zinc-600 text-xs">
              Demo location uses simulated emergency coordinates (34.0522, -118.2437) for demonstration purposes.
            </p>

            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 mt-6 max-w-md mx-auto text-left animate-in fade-in">
              <h3 className="text-white font-bold text-sm mb-2 flex items-center gap-2"><MapPin size={16}/> Set Location Manually</h3>
              <p className="text-zinc-400 text-[11px] mb-3 leading-relaxed">Click on the map below or enter exact GPS coordinates. This ensures rescue teams know precisely where to find the incident.</p>
              
              <div className="flex gap-3 mb-4">
                <input 
                  type="number" 
                  step="any"
                  placeholder="Latitude (e.g. 34.05)"
                  className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-2.5 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500"
                  value={manualLat}
                  onChange={(e) => setManualLat(e.target.value)}
                />
                <input 
                  type="number" 
                  step="any"
                  placeholder="Longitude (e.g. -118.24)"
                  className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-2.5 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500"
                  value={manualLng}
                  onChange={(e) => setManualLng(e.target.value)}
                />
              </div>

              <div className="h-56 rounded-xl overflow-hidden border border-zinc-800 mb-4 relative z-10 bg-zinc-950">
                <MapComponent
                  incidents={[]}
                  center={manualLat && manualLng && !isNaN(parseFloat(manualLat)) && !isNaN(parseFloat(manualLng)) ? [parseFloat(manualLat), parseFloat(manualLng)] : undefined}
                  onMapClick={(lat, lng) => {
                    setManualLat(lat.toFixed(5));
                    setManualLng(lng.toFixed(5));
                  }}
                  clickedLocation={manualLat && manualLng && !isNaN(parseFloat(manualLat)) && !isNaN(parseFloat(manualLng)) ? [parseFloat(manualLat), parseFloat(manualLng)] : undefined}
                />
              </div>

              <button
                onClick={handleManualSubmit}
                disabled={!manualLat || !manualLng}
                className="w-full bg-red-600 hover:bg-red-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-3 px-4 rounded-xl transition-colors text-sm flex items-center justify-center gap-2 shadow-lg shadow-red-900/20"
              >
                Submit with Manual Location <ArrowRight size={16}/>
              </button>
            </div>
          </div>
        )}

        {/* ── STEP 3: LIVE PROCESSING CHECKLIST ───────────────────────────── */}
        {step === 'PROCESSING' && (
          <div className="bg-zinc-950 border border-zinc-800 rounded-3xl p-8 md:p-10 space-y-8 animate-in fade-in duration-300">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-6">
              <div className="flex items-center gap-4">
                <div className="relative w-12 h-12 flex-shrink-0">
                  <div className="absolute inset-0 rounded-full border-2 border-red-500/20" />
                  <div className="absolute inset-0 rounded-full border-2 border-t-red-500 animate-spin" />
                  <Cpu className="absolute inset-0 m-auto w-5 h-5 text-red-400" />
                </div>
                <div>
                  <h2 className="text-xl font-black text-white tracking-wider">REPORT PROCESSING</h2>
                  <p className="text-zinc-500 text-xs font-mono">Analyzing disaster image & dispatching intelligence...</p>
                </div>
              </div>

              {imagePreview && (
                <div className="w-14 h-14 rounded-xl overflow-hidden border border-zinc-800 flex-shrink-0">
                  <img src={imagePreview} alt="Preview" className="w-full h-full object-cover" />
                </div>
              )}
            </div>

            {/* Checklist items */}
            <div className="space-y-3.5">
              {stages.map((stage) => (
                <div
                  key={stage.id}
                  className={`flex items-start gap-3.5 p-3.5 rounded-2xl border transition-all duration-300 ${
                    stage.done ? 'bg-emerald-500/5 border-emerald-500/30' :
                    stage.active ? 'bg-red-500/5 border-red-500/40 shadow-[0_0_15px_rgba(239,68,68,0.1)]' :
                    'bg-zinc-900/30 border-zinc-900 opacity-40'
                  }`}
                >
                  <div className="mt-0.5 flex-shrink-0">
                    {stage.done ? (
                      <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                    ) : stage.active ? (
                      <RefreshCw className="w-5 h-5 text-red-400 animate-spin" />
                    ) : (
                      <div className="w-5 h-5 rounded-full border-2 border-zinc-700" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-bold ${
                      stage.done ? 'text-emerald-300' :
                      stage.active ? 'text-white' : 'text-zinc-500'
                    }`}>
                      {stage.label}
                    </p>
                    {stage.detail && (
                      <p className="text-xs text-zinc-400 mt-0.5 font-mono">{stage.detail}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── STEP 4: FINAL RESULT & REAL-TIME LEAFLET PIN ────────────────── */}
        {step === 'RESULT' && visionResult && createdIncident && (
          <div className="space-y-6 animate-in fade-in duration-500">

            {/* Banner: Disaster Detected */}
            <div className="bg-zinc-950 border border-zinc-800 rounded-3xl p-6 md:p-8 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-64 h-64 bg-red-500/10 blur-[100px] rounded-full pointer-events-none" />

              <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold tracking-widest text-zinc-400 uppercase">DISASTER DETECTED</span>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${severityBadge(visionResult.severity)}`}>
                      {visionResult.severity}
                    </span>
                  </div>
                  <h2 className="text-4xl font-black text-white flex items-center gap-3">
                    <span>🌊</span> {visionResult.hazard}
                  </h2>
                  <div className="flex flex-wrap items-center gap-4 text-xs text-zinc-400 pt-1">
                    <span>AI Confidence: <strong className="text-emerald-400 font-mono">{visionResult.confidence}%</strong></span>
                    <span>•</span>
                    <span className="font-mono">Lat: {createdIncident.latitude.toFixed(4)}, Lng: {createdIncident.longitude.toFixed(4)}</span>
                    <span>•</span>
                    <span className={`font-bold ${blurResult?.isBlurry ? 'text-amber-400' : 'text-emerald-400'}`}>
                      {blurResult?.isBlurry ? '⚠ Blurry Image' : '✓ Image Quality Clear'}
                    </span>
                  </div>
                </div>

                <div className="flex flex-col items-start md:items-end gap-2 flex-shrink-0">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">Incident Status</div>
                  <div className={`px-3.5 py-1.5 rounded-xl border text-xs font-black ${
                    createdIncident.verificationStatus === 'VERIFIED' ? 'border-emerald-500/40 text-emerald-400 bg-emerald-500/10' :
                    createdIncident.verificationStatus === 'FIELD_VERIFICATION_REQUIRED' || createdIncident.isBlurry ? 'border-amber-500/40 text-amber-400 bg-amber-500/10' :
                    'border-orange-500/40 text-orange-400 bg-orange-500/10'
                  }`}>
                    {createdIncident.isBlurry || createdIncident.verificationRequired ? '🟠 UNVERIFIED (FIELD VERIFICATION REQ)' : '🟠 UNVERIFIED'}
                  </div>
                </div>
              </div>
            </div>

            {/* Blurry Notice Banner */}
            {blurResult?.isBlurry && (
              <div className="bg-amber-500/10 border-2 border-amber-500/40 rounded-2xl p-5 flex items-start gap-4">
                <AlertCircle className="w-6 h-6 text-amber-400 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold text-amber-300 text-sm">⚠ BLURRY IMAGE — FIELD VERIFICATION REQUIRED</p>
                  <p className="text-xs text-zinc-300 mt-1">
                    Citizen image quality is insufficient for reliable visual verification (Sharpness score: {blurResult.blurScore}).
                    AI classification was completed, but all volunteers have been alerted to physically inspect this location before confirmation.
                  </p>
                </div>
              </div>
            )}

            {/* SMS Volunteer Alert Status Card */}
            {smsResults.length > 0 && (
              <div className={`rounded-2xl border p-5 space-y-3 ${
                smsMode === 'demo_simulation'
                  ? 'bg-indigo-950/30 border-indigo-500/30'
                  : 'bg-emerald-950/30 border-emerald-500/30'
              }`}>
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">📱</span>
                    <span className="text-xs font-bold uppercase tracking-wider text-zinc-200">
                      SMS Volunteer Alerts
                    </span>
                  </div>
                  <span className={`text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full border ${
                    smsMode === 'demo_simulation'
                      ? 'bg-indigo-500/10 border-indigo-400/40 text-indigo-300'
                      : 'bg-emerald-500/10 border-emerald-400/40 text-emerald-300'
                  }`}>
                    {smsMode === 'demo_simulation' ? '📲 DEMO SMS MODE' : '✅ TWILIO LIVE'}
                  </span>
                </div>

                {smsMode === 'demo_simulation' && (
                  <p className="text-[11px] text-zinc-400 italic">
                    Twilio credentials not configured — SMS simulated safely. In production, real SMS will be delivered to all volunteer numbers.
                  </p>
                )}

                <div className="space-y-2">
                  {smsResults.map((rec, i) => (
                    <div key={i} className="flex items-center justify-between gap-3 bg-zinc-900/60 rounded-xl px-4 py-2.5 border border-zinc-800/60">
                      <div className="flex items-center gap-2 text-xs text-zinc-300 font-mono">
                        <span className={`w-2 h-2 rounded-full flex-shrink-0 ${rec.status === 'sent' || rec.status === 'simulated' ? 'bg-emerald-400' : 'bg-red-400'}`} />
                        {rec.recipient}
                      </div>
                      <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border ${
                        rec.status === 'sent' || rec.status === 'simulated'
                          ? 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10'
                          : 'text-red-400 border-red-500/30 bg-red-500/10'
                      }`}>
                        {rec.status === 'simulated' ? 'SIMULATED ✓' : rec.status.toUpperCase()}
                      </span>
                    </div>
                  ))}
                </div>

                {/* Collapsible SMS Message Preview */}
                {smsResults[0]?.message && (
                  <details className="group">
                    <summary className="text-[11px] text-zinc-500 hover:text-zinc-300 cursor-pointer font-bold tracking-wider transition-colors select-none">
                      ▸ VIEW SMS MESSAGE BODY
                    </summary>
                    <pre className="mt-2 text-[11px] text-zinc-300 font-mono whitespace-pre-wrap bg-zinc-950 border border-zinc-800 rounded-xl p-4 leading-relaxed overflow-x-auto">
                      {smsResults[0].message}
                    </pre>
                  </details>
                )}
              </div>
            )}

            {/* ── EMBEDDED LEAFLET MAP (PINNED IMMEDIATELY) ──────────────── */}

            <div className="bg-zinc-950 border border-zinc-800 rounded-3xl overflow-hidden shadow-2xl">
              <div className="p-4 bg-zinc-900/80 border-b border-zinc-800 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-red-500" />
                  <span className="text-xs font-bold uppercase tracking-wider text-zinc-200">Live Incident Map Marker</span>
                  <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                    PINNED AT {createdIncident.latitude.toFixed(4)}, {createdIncident.longitude.toFixed(4)}
                  </span>
                </div>
                <Link
                  href="/map"
                  className="text-xs font-bold text-cyan-400 hover:text-cyan-300 flex items-center gap-1"
                >
                  Full EOC Map <ChevronRight size={14} />
                </Link>
              </div>

              <div className="h-80 w-full relative">
                <MapComponent
                  incidents={[createdIncident, ...getIncidents().filter(i => i.id !== createdIncident.id)]}
                  center={[createdIncident.latitude, createdIncident.longitude]}
                  zoom={14}
                />
              </div>
            </div>

            {/* AI Model Intelligence Breakdown */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-zinc-950/60 border border-zinc-800 rounded-2xl p-5 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-purple-400 font-bold uppercase tracking-wider">MEDIC Disaster Type</span>
                  <span className="text-zinc-500 font-mono">MobileNetV2</span>
                </div>
                <p className="text-xl font-black text-zinc-100">{visionResult.hazard}</p>
                <p className="text-xs text-zinc-400">{visionResult.medic?.confidence || visionResult.confidence}% model certainty on disaster category</p>
              </div>

              <div className="bg-zinc-950/60 border border-zinc-800 rounded-2xl p-5 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-blue-400 font-bold uppercase tracking-wider">BiTemporal Damage Severity</span>
                  <span className="text-zinc-500 font-mono">MobileNetV2</span>
                </div>
                <p className="text-xl font-black text-zinc-100">{visionResult.severity}</p>
                <p className="text-xs text-zinc-400">Structural integrity assessment</p>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <Link
                href="/volunteer"
                className="flex-1 bg-amber-600 hover:bg-amber-500 text-white font-bold py-3.5 px-6 rounded-2xl transition-colors flex items-center justify-center gap-2 text-sm shadow-lg shadow-amber-600/20"
              >
                <Users size={16} /> Open Volunteer Center
              </Link>
              <Link
                href="/route"
                className="flex-1 bg-cyan-700 hover:bg-cyan-600 text-white font-bold py-3.5 px-6 rounded-2xl transition-colors flex items-center justify-center gap-2 text-sm shadow-lg shadow-cyan-700/20"
              >
                <Zap size={16} /> View Evacuation Routes
              </Link>
            </div>

          </div>
        )}

      </div>
    </div>
  );
}
