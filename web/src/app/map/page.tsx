"use client";

import { useEffect, useState, useCallback } from 'react';
import { 
  MapIcon, Layers, Filter, X, ShieldAlert, CheckCircle2, 
  Clock, Shield, AlertTriangle, AlertCircle, Eye, ArrowRight, UserCheck
} from 'lucide-react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { getIncidents, getShelters, Incident, Shelter, VerificationStatus } from '@/lib/storage';

// Dynamic import with SSR disabled is required for react-leaflet
const MapComponent = dynamic(() => import('@/components/MapComponent'), { 
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex flex-col items-center justify-center text-zinc-500 bg-zinc-950">
      <MapIcon className="w-16 h-16 mb-4 opacity-50 animate-pulse" />
      <p>Initializing Geospatial Engine...</p>
    </div>
  )
});

export default function MapPage() {
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [shelters, setShelters] = useState<Shelter[]>([]);
  
  const [filterHazard, setFilterHazard] = useState<string>('ALL');
  const [filterSeverity, setFilterSeverity] = useState<string>('ALL');
  const [filterVerification, setFilterVerification] = useState<string>('ALL');
  
  const [selectedIncident, setSelectedIncident] = useState<Incident | null>(null);

  const refreshData = useCallback(() => {
    setIncidents(getIncidents());
    setShelters(getShelters());
  }, []);

  useEffect(() => {
    refreshData();
    const interval = setInterval(refreshData, 5000);

    const handleVerified = () => refreshData();
    window.addEventListener('incidentVerified', handleVerified);
    window.addEventListener('routeRiskUpdated', handleVerified);

    return () => {
      clearInterval(interval);
      window.removeEventListener('incidentVerified', handleVerified);
      window.removeEventListener('routeRiskUpdated', handleVerified);
    };
  }, [refreshData]);

  const filteredIncidents = incidents.filter(inc => {
    if (filterHazard !== 'ALL' && inc.hazard !== filterHazard) return false;
    if (filterSeverity !== 'ALL' && inc.severity !== filterSeverity) return false;
    if (filterVerification !== 'ALL') {
      const vs = inc.verificationStatus ?? (inc.status === 'VERIFIED' ? 'VERIFIED' : 'UNVERIFIED');
      if (vs !== filterVerification) return false;
    }
    return true;
  });

  const severityColor = (sev: string) => {
    if (sev === 'CRITICAL') return 'text-red-400 bg-red-500/10 border-red-500/30';
    if (sev === 'HIGH') return 'text-amber-400 bg-amber-500/10 border-amber-500/30';
    if (sev === 'MEDIUM') return 'text-yellow-400 bg-yellow-500/10 border-yellow-500/30';
    return 'text-green-400 bg-green-500/10 border-green-500/30';
  };

  const getSourceDisplay = (sources: string[] = []) => {
    return sources.map(s => {
      if (s === 'Photo') return '📷 PHOTO';
      if (s === 'SMS') return '💬 SMS';
      if (s === 'Voice') return '📞 VOICE';
      return s;
    }).join(' • ');
  };

  const getVerificationBadge = (incident: Incident) => {
    const vs: VerificationStatus = incident.verificationStatus ?? (incident.status === 'VERIFIED' ? 'VERIFIED' : 'UNVERIFIED');
    if (vs === 'VERIFIED' || vs === 'PARTIALLY_VERIFIED') {
      return { label: 'VERIFIED', color: 'text-emerald-400 border-emerald-500/40 bg-emerald-500/10', dot: 'bg-emerald-500' };
    }
    if (vs === 'VERIFICATION_IN_PROGRESS') {
      return { label: 'VERIFICATION IN PROGRESS', color: 'text-blue-400 border-blue-500/40 bg-blue-500/10', dot: 'bg-blue-500' };
    }
    if (vs === 'FIELD_VERIFICATION_REQUIRED' || incident.isBlurry || incident.verificationRequired) {
      return { label: 'FIELD VERIFICATION REQUIRED', color: 'text-amber-400 border-amber-500/40 bg-amber-500/10', dot: 'bg-amber-500' };
    }
    if (vs === 'FALSE_REPORT' || incident.status === 'REJECTED') {
      return { label: 'FALSE REPORT', color: 'text-zinc-400 border-zinc-700 bg-zinc-900', dot: 'bg-zinc-600' };
    }
    return { label: 'UNVERIFIED', color: 'text-red-400 border-red-500/30 bg-red-500/10', dot: 'bg-red-500' };
  };

  return (
    <div className="h-full flex flex-col relative">
      {/* Top Bar */}
      <div className="p-4 border-b border-zinc-800 bg-zinc-950/90 backdrop-blur-md flex flex-wrap items-center justify-between gap-3 z-40 absolute top-0 left-0 right-0">
        <div>
          <h1 className="text-xl font-bold text-zinc-100 flex items-center">
            <MapIcon className="mr-3 text-indigo-500" />
            Live Incident Map
          </h1>
          <p className="text-zinc-500 text-xs mt-0.5">Real-time geospatial fusion & human verification tracking</p>
        </div>
        
        <div className="flex flex-wrap items-center gap-3">
          <select 
            value={filterVerification} 
            onChange={(e) => setFilterVerification(e.target.value)}
            className="bg-zinc-900 border border-zinc-700 text-zinc-300 text-xs rounded-lg px-3 py-2 focus:outline-none focus:border-indigo-500"
          >
            <option value="ALL">All Verification States</option>
            <option value="FIELD_VERIFICATION_REQUIRED">🟠 Verification Required</option>
            <option value="VERIFICATION_IN_PROGRESS">🔵 Verification In Progress</option>
            <option value="VERIFIED">🟢 Verified</option>
            <option value="UNVERIFIED">🔴 Unverified</option>
            <option value="FALSE_REPORT">⚫ False Report</option>
          </select>

          <select 
            value={filterSeverity} 
            onChange={(e) => setFilterSeverity(e.target.value)}
            className="bg-zinc-900 border border-zinc-700 text-zinc-300 text-xs rounded-lg px-3 py-2 focus:outline-none focus:border-indigo-500"
          >
            <option value="ALL">All Severities</option>
            <option value="CRITICAL">Critical</option>
            <option value="HIGH">High</option>
            <option value="MEDIUM">Medium</option>
            <option value="LOW">Low</option>
          </select>
        </div>
      </div>

      {/* Map Area */}
      <div className="flex-1 bg-zinc-950 relative z-0">
        <MapComponent 
          incidents={filteredIncidents} 
          shelters={shelters} 
          onIncidentClick={setSelectedIncident}
        />
      </div>

      {/* Bottom Map Legend */}
      <div className="absolute bottom-6 left-6 z-40 bg-zinc-950/90 backdrop-blur-md border border-zinc-800 rounded-xl p-3.5 shadow-2xl hidden md:flex items-center gap-4 text-xs">
        <span className="text-zinc-500 font-bold uppercase tracking-wider text-[10px]">Legend:</span>
        <div className="flex items-center gap-1.5 text-red-400">
          <div className="w-2.5 h-2.5 rounded-full bg-red-500 shadow-[0_0_8px_#ef4444]" />
          <span>Unverified</span>
        </div>
        <div className="flex items-center gap-1.5 text-amber-400">
          <div className="w-2.5 h-2.5 rounded-full bg-amber-500 shadow-[0_0_8px_#f97316]" />
          <span>Verification Required</span>
        </div>
        <div className="flex items-center gap-1.5 text-blue-400">
          <div className="w-2.5 h-2.5 rounded-full bg-blue-500 shadow-[0_0_8px_#3b82f6]" />
          <span>In Progress</span>
        </div>
        <div className="flex items-center gap-1.5 text-emerald-400">
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-[0_0_8px_#22c55e]" />
          <span>Verified</span>
        </div>
        <div className="flex items-center gap-1.5 text-zinc-400">
          <div className="w-2.5 h-2.5 rounded-full bg-zinc-600" />
          <span>False Report</span>
        </div>
      </div>

      {/* Incident Details Panel */}
      {selectedIncident && (
        <div className="absolute top-20 right-6 w-96 max-h-[calc(100vh-6rem)] overflow-y-auto bg-zinc-950/95 backdrop-blur-xl border border-zinc-800 rounded-2xl shadow-2xl z-50 p-6 animate-in slide-in-from-right-8 duration-300">
          <button 
            onClick={() => setSelectedIncident(null)}
            className="absolute top-4 right-4 text-zinc-500 hover:text-zinc-300 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
          
          <div className="mb-5 border-b border-zinc-800 pb-4">
            <div className="flex items-center gap-3 mb-2">
              <ShieldAlert className="w-6 h-6 text-indigo-500" />
              <h2 className="text-xl font-bold text-zinc-100">{selectedIncident.hazard}</h2>
            </div>
            <p className="text-zinc-500 text-xs font-mono">{selectedIncident.id}</p>
          </div>

          <div className="space-y-4">
            {/* Status & Verification Badge */}
            <div>
              <p className="text-zinc-500 text-[10px] uppercase tracking-wider font-bold mb-1.5">Verification Status</p>
              {(() => {
                const badge = getVerificationBadge(selectedIncident);
                return (
                  <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold border ${badge.color}`}>
                    <span className={`w-2 h-2 rounded-full ${badge.dot}`} />
                    {badge.label}
                  </span>
                );
              })()}
            </div>

            {/* AI Assessment Box */}
            <div className="bg-purple-950/30 border border-purple-500/20 rounded-xl p-3.5 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-purple-400 font-bold uppercase tracking-wider text-[10px]">AI Assessment</span>
                <span className="text-purple-300 font-mono font-bold">{selectedIncident.confidence}% Conf.</span>
              </div>
              <div className="text-xs text-zinc-300">
                Disaster: <strong className="text-white">{selectedIncident.hazard}</strong> · Severity: <strong className="text-white">{selectedIncident.severity}</strong>
              </div>
              {selectedIncident.isBlurry && (
                <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-2 text-[11px] text-amber-300">
                  ⚠ Citizen image was blurry (score {selectedIncident.blurScore}). Field verification required.
                </div>
              )}
            </div>

            {/* Human Verification Box */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-3.5 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-zinc-400 font-bold uppercase tracking-wider text-[10px]">Human Verification</span>
                <span className="text-zinc-500 text-[10px]">{selectedIncident.verifiedAt ? new Date(selectedIncident.verifiedAt).toLocaleTimeString() : 'Pending'}</span>
              </div>
              <p className="text-xs text-zinc-300">
                {selectedIncident.verificationStatus === 'VERIFIED' ? (
                  <span className="text-emerald-400 font-bold">✓ Field-confirmed by volunteer</span>
                ) : selectedIncident.verificationStatus === 'PARTIALLY_VERIFIED' ? (
                  <span className="text-cyan-400 font-bold">✓ Partially confirmed by volunteer</span>
                ) : selectedIncident.verificationStatus === 'FALSE_REPORT' ? (
                  <span className="text-zinc-400 font-bold">✕ Marked as false report by volunteer</span>
                ) : (
                  <span className="text-amber-400 font-medium">Awaiting volunteer field verification</span>
                )}
              </p>
              {selectedIncident.verificationNotes && (
                <p className="text-xs text-zinc-400 bg-zinc-950 p-2 rounded border border-zinc-800 italic">
                  "{selectedIncident.verificationNotes}"
                </p>
              )}
            </div>

            {/* Location & Sources */}
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-2.5">
                <span className="text-zinc-500 block font-bold text-[9px] uppercase">Location</span>
                <span className="font-mono text-zinc-300">{selectedIncident.latitude.toFixed(4)}, {selectedIncident.longitude.toFixed(4)}</span>
              </div>
              <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-2.5">
                <span className="text-zinc-500 block font-bold text-[9px] uppercase">Corroboration</span>
                <span className="text-cyan-400 font-bold">{selectedIncident.reportCount} reports ({getSourceDisplay(selectedIncident.sources)})</span>
              </div>
            </div>

            {/* Volunteer Action Link */}
            <Link
              href={`/volunteer/verify/${selectedIncident.id}`}
              className="w-full bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold py-2.5 rounded-xl transition-colors flex items-center justify-center gap-2 mt-4"
            >
              <UserCheck className="w-4 h-4" />
              Open Volunteer Verification
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
