"use client";

import { useState } from 'react';
import { Cpu, UploadCloud, Loader2, CheckCircle2, AlertTriangle, Scan, Zap, Shield, ChevronRight, Activity } from 'lucide-react';
import { VisionService, VisionAnalysisResult } from '@/lib/services/vision';
import { AIReasoningService } from '@/lib/services/ai';
import { Incident } from '@/lib/storage';
import Link from 'next/link';

export default function JudgePage() {
  const [status, setStatus] = useState<'IDLE' | 'ANALYZING' | 'DONE'>('IDLE');
  const [image, setImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [result, setResult] = useState<VisionAnalysisResult | null>(null);
  const [fusedIncident, setFusedIncident] = useState<Incident | null>(null);
  const [heatmapOverlay, setHeatmapOverlay] = useState<boolean>(false);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setImage(file);
      const previewUrl = URL.createObjectURL(file);
      setImagePreview(previewUrl);
      setHeatmapOverlay(false);
      
      setStatus('ANALYZING');
      
      try {
        const visionData = await VisionService.analyzeImage(file);
        
        // Mock a representative location for the demo
        const lat = 34.0522;
        const lng = -118.2437;
        
        const { incident } = await AIReasoningService.processPhotoReport(
          visionData,
          lat,
          lng,
          "Judge demo upload",
          previewUrl
        );

        setResult(visionData);
        setFusedIncident(incident);
        setStatus('DONE');
        
        setTimeout(() => setHeatmapOverlay(true), 1200);

      } catch (error) {
        console.error(error);
        alert("Error analyzing image.");
        setStatus('IDLE');
      }
    }
  };

  const severityColor = (sev: string) => {
    if (sev === 'CRITICAL') return 'text-red-400 bg-red-500/10 border-red-500/30';
    if (sev === 'HIGH') return 'text-amber-400 bg-amber-500/10 border-amber-500/30';
    if (sev === 'MEDIUM') return 'text-yellow-400 bg-yellow-500/10 border-yellow-500/30';
    return 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30';
  };

  return (
    <div className="p-6 md:p-10 max-w-7xl mx-auto min-h-screen text-zinc-100">
      
      {/* Header Bar */}
      <div className="mb-8 border-b border-zinc-800/80 pb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-500/10 border border-purple-500/30 text-purple-400 text-xs font-bold tracking-widest mb-3">
            <Cpu size={14} /> DUAL-MODEL AI INFERENCE ENGINE
          </div>
          <h1 className="text-3xl md:text-4xl font-black tracking-tight text-zinc-100 flex items-center">
            Judge AI Multi-Model Demonstration
          </h1>
          <p className="text-zinc-400 mt-1 text-sm md:text-base">
            Live evaluation with MEDIC Disaster Type Classifier + BiTemporal Damage Severity Model
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center px-4 py-2 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-emerald-400 font-bold text-xs">
            <Zap className="w-4 h-4 mr-2 animate-pulse" />
            REAL ML INFERENCE ACTIVE
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Left Column: Image Upload & Visual Preview */}
        <div className="lg:col-span-5 flex flex-col gap-6">
          <div className="bg-zinc-950/60 backdrop-blur-md border border-zinc-800/80 rounded-3xl p-6 relative overflow-hidden shadow-2xl">
            <h2 className="text-lg font-bold text-zinc-200 mb-4 flex items-center">
              <Scan className="w-5 h-5 mr-2.5 text-zinc-400" />
              Unseen Disaster Image Input
            </h2>
            
            {!imagePreview ? (
              <div className="border-2 border-dashed border-zinc-700/80 hover:border-purple-500/50 rounded-2xl bg-zinc-900/30 hover:bg-zinc-900/60 transition-all flex flex-col items-center justify-center h-80 relative group cursor-pointer">
                <input 
                  type="file" 
                  accept="image/*" 
                  onChange={handleImageUpload}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                />
                <div className="bg-purple-600/20 group-hover:bg-purple-600/30 border border-purple-500/40 p-5 rounded-2xl mb-4 transition-transform group-hover:scale-110">
                  <UploadCloud className="text-purple-400 w-8 h-8" />
                </div>
                <p className="text-zinc-100 font-bold text-base">Upload Any Unseen Disaster Photo</p>
                <p className="text-zinc-500 text-xs mt-1">Accepts JPEG / PNG from MEDIC or real-world disaster</p>
              </div>
            ) : (
              <div className="relative rounded-2xl overflow-hidden border border-zinc-800 h-96 group bg-black/80 flex items-center justify-center">
                <img src={imagePreview} className="w-full h-full object-contain" alt="Uploaded Preview" />
                
                {/* Simulated Grad-CAM Heatmap overlay */}
                {heatmapOverlay && status === 'DONE' && (
                  <div className="absolute inset-0 z-10 mix-blend-screen opacity-50 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-purple-500/80 via-red-500/30 to-transparent animate-pulse" />
                )}
                
                {status === 'ANALYZING' && (
                  <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center z-20 backdrop-blur-md">
                    <Loader2 className="w-12 h-12 text-purple-400 animate-spin mb-4" />
                    <p className="text-zinc-100 font-bold tracking-widest text-sm animate-pulse">RUNNING DUAL-MODEL INFERENCE...</p>
                    <p className="text-zinc-400 text-xs mt-1">Evaluating MEDIC + BiTemporal Checkpoints</p>
                  </div>
                )}
                
                {status === 'DONE' && (
                  <div className="absolute top-3 right-3 z-20 flex flex-col gap-2">
                    <span className="bg-zinc-950/90 backdrop-blur-md text-xs font-bold text-emerald-400 px-3 py-1.5 rounded-lg flex items-center border border-emerald-500/30 shadow-lg">
                      <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" /> Real ML Inference
                    </span>
                    {heatmapOverlay && (
                      <span className="bg-zinc-950/90 backdrop-blur-md text-xs font-bold text-purple-400 px-3 py-1.5 rounded-lg flex items-center border border-purple-500/30 shadow-lg">
                        <Zap className="w-3.5 h-3.5 mr-1.5" /> Attention Map Active
                      </span>
                    )}
                  </div>
                )}
              </div>
            )}
            
            {status === 'DONE' && (
              <div className="mt-6 flex gap-3">
                <button 
                  onClick={() => {
                    setImage(null);
                    setImagePreview(null);
                    setResult(null);
                    setFusedIncident(null);
                    setStatus('IDLE');
                    setHeatmapOverlay(false);
                  }}
                  className="flex-1 bg-zinc-900 hover:bg-zinc-800 text-zinc-200 border border-zinc-700 font-bold py-3 rounded-xl transition text-sm"
                >
                  TEST ANOTHER IMAGE
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Multi-Model Results */}
        <div className="lg:col-span-7 flex flex-col gap-6">
          
          {status === 'IDLE' && (
            <div className="bg-zinc-950/60 backdrop-blur-md border border-zinc-800/80 rounded-3xl p-12 flex flex-col items-center justify-center text-zinc-500 min-h-[480px]">
              <Scan className="w-16 h-16 mb-4 opacity-20" />
              <h3 className="text-zinc-300 font-bold text-lg mb-1">Awaiting Disaster Image</h3>
              <p className="text-zinc-500 text-sm text-center max-w-sm">
                Upload a photo to see genuine multi-model vision inference across both MEDIC and BiTemporal classifiers.
              </p>
            </div>
          )}

          {status === 'ANALYZING' && (
            <div className="bg-zinc-950/60 backdrop-blur-md border border-zinc-800/80 rounded-3xl p-8 space-y-6 min-h-[480px]">
              <div className="h-28 bg-zinc-900/60 rounded-2xl animate-pulse" />
              <div className="h-28 bg-zinc-900/60 rounded-2xl animate-pulse" />
              <div className="h-32 bg-zinc-900/60 rounded-2xl animate-pulse" />
            </div>
          )}

          {status === 'DONE' && result && (
            <div className="space-y-6">
              
              {/* MODEL 1: MEDIC DISASTER TYPE */}
              <div className="bg-zinc-950/70 backdrop-blur-md border border-purple-500/30 rounded-3xl p-6 shadow-xl relative overflow-hidden">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/20">
                      <Cpu size={18} />
                    </div>
                    <div>
                      <p className="text-[11px] uppercase tracking-widest text-zinc-400 font-bold">Model 1: Disaster Type Classification</p>
                      <h3 className="text-lg font-black text-zinc-100">QCRI/MEDIC (MobileNetV2)</h3>
                    </div>
                  </div>
                  <span className={`px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider border ${
                    result.medic?.mode === 'real_ml_inference' 
                      ? 'border-emerald-500/30 text-emerald-400 bg-emerald-500/10'
                      : 'border-amber-500/30 text-amber-400 bg-amber-500/10'
                  }`}>
                    {result.medic?.mode === 'real_ml_inference' ? 'REAL ML INFERENCE' : 'DEMO FALLBACK'}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div className="bg-zinc-900/80 border border-zinc-800 rounded-2xl p-4">
                    <p className="text-[10px] text-zinc-500 uppercase tracking-wider font-bold mb-1">Identified Hazard</p>
                    <p className="text-2xl font-black text-purple-400 uppercase">
                      {(() => {
                        const h = result.medic?.hazard || result.hazard;
                        return Array.isArray(h) ? h.join(' / ') : h;
                      })()}
                    </p>
                  </div>
                  <div className="bg-zinc-900/80 border border-zinc-800 rounded-2xl p-4">
                    <p className="text-[10px] text-zinc-500 uppercase tracking-wider font-bold mb-1">Model Confidence</p>
                    <p className="text-2xl font-black text-emerald-400">{result.medic?.confidence || result.confidence}%</p>
                  </div>
                </div>

                {/* Probability Distribution */}
                {result.medic?.probabilities && (
                  <div className="bg-zinc-900/50 border border-zinc-800/80 rounded-2xl p-4">
                    <p className="text-[10px] text-zinc-500 uppercase tracking-wider font-bold mb-3">7-Class Probability Distribution</p>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                      {Object.entries(result.medic.probabilities).map(([clsName, prob]) => (
                        <div key={clsName} className="bg-black/40 p-2 rounded-lg border border-zinc-800/80">
                          <div className="flex justify-between text-zinc-400 text-[11px] mb-1">
                            <span className="capitalize">{clsName}</span>
                            <span className="font-bold text-zinc-200">{prob}%</span>
                          </div>
                          <div className="w-full bg-zinc-800 rounded-full h-1.5 overflow-hidden">
                            <div 
                              className="bg-purple-500 h-full rounded-full" 
                              style={{ width: `${Math.min(prob, 100)}%` }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* MODEL 2: BITEMPORAL DAMAGE SEVERITY */}
              <div className="bg-zinc-950/70 backdrop-blur-md border border-cyan-500/30 rounded-3xl p-6 shadow-xl relative overflow-hidden">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                      <Shield size={18} />
                    </div>
                    <div>
                      <p className="text-[11px] uppercase tracking-widest text-zinc-400 font-bold">Model 2: Structural Damage Assessment</p>
                      <h3 className="text-lg font-black text-zinc-100">BiTemporal-StreetView-Damage (MobileNetV2)</h3>
                    </div>
                  </div>
                  <span className={`px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider border ${
                    result.damage?.mode === 'real_ml_inference' 
                      ? 'border-emerald-500/30 text-emerald-400 bg-emerald-500/10'
                      : 'border-amber-500/30 text-amber-400 bg-amber-500/10'
                  }`}>
                    {result.damage?.mode === 'real_ml_inference' ? 'REAL ML INFERENCE' : 'DEMO FALLBACK'}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-zinc-900/80 border border-zinc-800 rounded-2xl p-4">
                    <p className="text-[10px] text-zinc-500 uppercase tracking-wider font-bold mb-1">Damage Severity</p>
                    <span className={`inline-block px-3 py-1 rounded-lg text-sm font-bold border ${severityColor(result.damage?.severity || result.severity)}`}>
                      {result.damage?.severity || result.severity} ({result.damage?.damage_class.toUpperCase() || 'EVALUATED'})
                    </span>
                  </div>
                  <div className="bg-zinc-900/80 border border-zinc-800 rounded-2xl p-4">
                    <p className="text-[10px] text-zinc-500 uppercase tracking-wider font-bold mb-1">Severity Confidence</p>
                    <p className="text-2xl font-black text-cyan-400">{result.damage?.confidence || result.confidence}%</p>
                  </div>
                </div>
              </div>

              {/* AI MULTI-MODAL REASONING & VISUAL EVIDENCE */}
              <div className="bg-zinc-950/70 backdrop-blur-md border border-zinc-800/80 rounded-3xl p-6 shadow-xl">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-bold uppercase tracking-widest text-zinc-300 flex items-center">
                    <Activity className="w-4 h-4 mr-2 text-purple-400" />
                    AI Multi-Modal Reasoning & Evidence
                  </h3>
                  <span className="text-xs text-purple-400 bg-purple-500/10 border border-purple-500/20 px-2 py-0.5 rounded font-bold">
                    GROQ REASONING LAYER
                  </span>
                </div>

                <ul className="space-y-2 mb-6">
                  {result.evidence.map((ev, i) => (
                    <li key={i} className="flex items-start bg-zinc-900/80 p-3 rounded-xl border border-zinc-800/60 text-xs text-zinc-300">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 mr-2.5 flex-shrink-0 mt-0.5" />
                      <span>{ev}</span>
                    </li>
                  ))}
                </ul>

                {/* Live Incident Fusion Link */}
                {fusedIncident && (
                  <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 rounded-2xl bg-blue-500/10 border border-blue-500/30">
                    <div>
                      <p className="text-blue-400 font-bold text-sm">Fused to Live Incident Registry</p>
                      <p className="text-blue-500/70 text-xs font-mono">Incident ID: {fusedIncident.id} • Corroborating: {fusedIncident.reportCount} reports</p>
                    </div>
                    <div className="flex gap-2 w-full sm:w-auto">
                      <Link href="/map" className="flex-1 sm:flex-initial px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl text-xs flex items-center justify-center transition">
                        View On Map <ChevronRight size={14} className="ml-1" />
                      </Link>
                      <Link href="/responder" className="flex-1 sm:flex-initial px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-bold rounded-xl text-xs flex items-center justify-center transition">
                        Responder EOC
                      </Link>
                    </div>
                  </div>
                )}
              </div>

            </div>
          )}

        </div>

      </div>
    </div>
  );
}
