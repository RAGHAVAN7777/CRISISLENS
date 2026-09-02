"use client";

import { useEffect, useState } from 'react';
import { ShieldAlert, CheckCircle, XCircle, AlertTriangle, Eye, Layers, Activity } from 'lucide-react';
import { getIncidents, updateIncident, Incident, getShelters, Shelter } from '@/lib/storage';
import { syncIncidentsToRoadGraph } from '@/lib/services/routeRiskService';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';

// Dynamic import with SSR disabled is required for react-leaflet
const MapComponent = dynamic(() => import('@/components/MapComponent'), { 
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex items-center justify-center text-zinc-500 bg-zinc-900 rounded-2xl animate-pulse border border-zinc-800">
      Geospatial Engine Loading...
    </div>
  )
});

export default function ResponderPage() {
  const router = useRouter();
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [shelters, setShelters] = useState<Shelter[]>([]);
  const [notification, setNotification] = useState<{ msg: string; type: 'success' | 'danger' | 'info' } | null>(null);

  const showNotif = (msg: string, type: 'success' | 'danger' | 'info' = 'info') => {
    setNotification({ msg, type });
    setTimeout(() => setNotification(null), 4000);
  };

  const loadData = () => {
    setIncidents(getIncidents());
    setShelters(getShelters());
  };

  useEffect(() => {
    loadData();
    // Auto refresh every 5 seconds to catch new incoming SMS/Voice/Photo reports
    const interval = setInterval(loadData, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleStatusChange = (id: string, newStatus: 'VERIFIED' | 'REJECTED' | 'RESOLVED') => {
    updateIncident(id, { status: newStatus });
    // Re-sync road risks: verified incidents get stronger penalties
    const updated = getIncidents();
    syncIncidentsToRoadGraph(updated);
    
    if (newStatus === 'VERIFIED') showNotif(`Incident ${id.slice(-4)} VERIFIED. Road risk escalated.`, 'success');
    if (newStatus === 'REJECTED') showNotif(`Incident ${id.slice(-4)} REJECTED and removed from queue.`, 'danger');
    if (newStatus === 'RESOLVED') showNotif(`Incident ${id.slice(-4)} RESOLVED.`, 'info');
    
    loadData(); // Force re-render immediately
  };

  const getSourceDisplay = (sources: string[] = []) => {
    return sources.map(s => {
      if (s === 'Photo') return '📷 PHOTO';
      if (s === 'SMS') return '💬 SMS';
      if (s === 'Voice') return '📞 VOICE';
      return s;
    }).join(' • ');
  };

  const severityColor = (sev: string) => {
    if (sev === 'CRITICAL') return 'text-red-500 bg-red-500/10 border-red-500/20';
    if (sev === 'HIGH') return 'text-amber-500 bg-amber-500/10 border-amber-500/20';
    if (sev === 'MEDIUM') return 'text-yellow-500 bg-yellow-500/10 border-yellow-500/20';
    return 'text-green-500 bg-green-500/10 border-green-500/20';
  };

  // --- Statistics Calculations ---
  const totalIncidents = incidents.length;
  const criticalCount = incidents.filter(i => i.severity === 'CRITICAL').length;
  const highCount = incidents.filter(i => i.severity === 'HIGH').length;
  
  // Unverified means AI caught it but human hasn't verified/rejected/resolved yet
  const unverifiedCount = incidents.filter(i => i.status === 'PENDING' || i.status === 'AI_CLASSIFIED').length;
  const verifiedCount = incidents.filter(i => i.status === 'VERIFIED').length;

  const severityRank = { CRITICAL: 4, HIGH: 3, MEDIUM: 2, LOW: 1, UNCERTAIN: 0 };
  const verificationQueue = incidents
    .filter(i => i.status === 'PENDING' || i.status === 'AI_CLASSIFIED')
    .sort((a, b) => {
      const sevDiff = (severityRank[b.severity as keyof typeof severityRank] || 0) - (severityRank[a.severity as keyof typeof severityRank] || 0);
      if (sevDiff !== 0) return sevDiff;
      return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    });

  return (
    <div className="p-8 max-w-[1600px] mx-auto h-full flex flex-col relative">
      
      {/* Toast Notification */}
      {notification && (
        <div className={`absolute top-10 left-1/2 -translate-x-1/2 z-50 flex items-center px-6 py-3 rounded-xl shadow-2xl transition-all duration-300 animate-in slide-in-from-top-5 ${
          notification.type === 'success' ? 'bg-emerald-950 border border-emerald-500/50 text-emerald-400' :
          notification.type === 'danger' ? 'bg-red-950 border border-red-500/50 text-red-400' :
          'bg-blue-950 border border-blue-500/50 text-blue-400'
        }`}>
          <CheckCircle className="w-5 h-5 mr-3" />
          <span className="font-bold text-sm">{notification.msg}</span>
        </div>
      )}

      <div className="mb-8 border-b border-zinc-800 pb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-zinc-100 flex items-center">
            <ShieldAlert className="mr-3 text-red-500" />
            Emergency Operations Center
          </h1>
          <p className="text-zinc-400 mt-2">Master incident overview and verification queue.</p>
        </div>
        <div className="flex items-center text-green-500 bg-green-500/10 border border-green-500/20 px-4 py-2 rounded-lg text-sm font-bold animate-pulse">
          <Activity className="w-4 h-4 mr-2" /> LIVE SYNC ACTIVE
        </div>
      </div>

      {/* Top Statistics Bar */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
        <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-5 shadow-lg">
          <p className="text-zinc-500 text-xs font-bold uppercase tracking-widest mb-1">Total Incidents</p>
          <p className="text-3xl font-black text-zinc-100">{totalIncidents}</p>
        </div>
        <div className="bg-zinc-950 border border-red-500/30 rounded-xl p-5 shadow-lg relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4 opacity-10">
            <AlertTriangle className="w-16 h-16 text-red-500" />
          </div>
          <p className="text-red-500/70 text-xs font-bold uppercase tracking-widest mb-1">Critical</p>
          <p className="text-3xl font-black text-red-500">{criticalCount}</p>
        </div>
        <div className="bg-zinc-950 border border-amber-500/30 rounded-xl p-5 shadow-lg">
          <p className="text-amber-500/70 text-xs font-bold uppercase tracking-widest mb-1">High</p>
          <p className="text-3xl font-black text-amber-500">{highCount}</p>
        </div>
        <div className="bg-zinc-950 border border-indigo-500/30 rounded-xl p-5 shadow-lg">
          <p className="text-indigo-500/70 text-xs font-bold uppercase tracking-widest mb-1">Unverified Queue</p>
          <p className="text-3xl font-black text-indigo-400">{unverifiedCount}</p>
        </div>
        <div className="bg-zinc-950 border border-green-500/30 rounded-xl p-5 shadow-lg">
          <p className="text-green-500/70 text-xs font-bold uppercase tracking-widest mb-1">Verified Active</p>
          <p className="text-3xl font-black text-green-500">{verifiedCount}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 flex-1">
        
        {/* Left Side: Live Map */}
        <div className="lg:col-span-7 flex flex-col">
          <h2 className="text-xl font-bold text-zinc-100 mb-4 flex items-center">
            <Activity className="w-5 h-5 mr-2 text-cyan-500" />
            LIVE INCIDENT MAP
          </h2>
          <div className="flex-1 bg-zinc-950 border border-zinc-800 rounded-2xl overflow-hidden min-h-[500px] shadow-2xl relative">
            <MapComponent 
              incidents={incidents} 
              shelters={shelters} 
              onIncidentClick={(inc) => {
                // In a fuller implementation, this could scroll to the queue item
              }}
            />
          </div>
        </div>

        {/* Right Side: Verification Queue */}
        <div className="lg:col-span-5 flex flex-col h-full">
          <h2 className="text-xl font-bold text-zinc-100 mb-4 flex items-center">
            <Layers className="w-5 h-5 mr-2 text-indigo-500" />
            VERIFICATION QUEUE
          </h2>
          
          <div className="flex-1 bg-zinc-950 border border-zinc-800 rounded-2xl p-4 overflow-y-auto min-h-[500px]">
            {verificationQueue.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-zinc-600">
                <CheckCircle className="w-16 h-16 mb-4 opacity-30 text-green-500" />
                <p>Queue is empty. All incidents verified.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {verificationQueue.map((inc) => (
                  <div key={inc.id} className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 relative">
                    
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="text-lg font-bold text-zinc-100">{inc.hazard}</h3>
                          <span className={`px-2 py-0.5 rounded text-xs font-bold border ${severityColor(inc.severity)}`}>
                            {inc.severity}
                          </span>
                        </div>
                        <p className="text-xs font-mono text-zinc-500">ID: {inc.id}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-xl font-black text-green-500">{inc.confidence}%</p>
                        <p className="text-[10px] uppercase tracking-wider text-zinc-500">AI Confidence</p>
                      </div>
                    </div>

                    <div className="mb-4 bg-black/30 rounded-lg p-3 border border-zinc-800">
                      <p className="text-sm text-zinc-300 mb-1">
                        <strong>Location:</strong> {inc.latitude.toFixed(4)}, {inc.longitude.toFixed(4)}
                      </p>
                      <p className="text-sm text-zinc-300 mb-2">
                        <strong className="text-cyan-400">{inc.reportCount} Corroborating Reports</strong>
                      </p>
                      <p className="text-xs text-zinc-400">
                        SOURCES: {getSourceDisplay(inc.sources)}
                      </p>
                    </div>

                    {/* Action Buttons */}
                    <div className="grid grid-cols-4 gap-2">
                      <button 
                        onClick={() => router.push('/map')}
                        className="flex flex-col items-center justify-center py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg transition-colors group"
                      >
                        <Eye className="w-4 h-4 mb-1 group-hover:text-white" />
                        <span className="text-[10px] font-bold tracking-wider">VIEW</span>
                      </button>
                      <button 
                        onClick={() => handleStatusChange(inc.id, 'VERIFIED')}
                        className="flex flex-col items-center justify-center py-2 bg-green-900/50 hover:bg-green-600 text-green-400 hover:text-white border border-green-800 hover:border-green-500 rounded-lg transition-colors group"
                      >
                        <CheckCircle className="w-4 h-4 mb-1" />
                        <span className="text-[10px] font-bold tracking-wider">VERIFY</span>
                      </button>
                      <button 
                        onClick={() => handleStatusChange(inc.id, 'REJECTED')}
                        className="flex flex-col items-center justify-center py-2 bg-red-900/50 hover:bg-red-600 text-red-400 hover:text-white border border-red-800 hover:border-red-500 rounded-lg transition-colors group"
                      >
                        <XCircle className="w-4 h-4 mb-1" />
                        <span className="text-[10px] font-bold tracking-wider">REJECT</span>
                      </button>
                      <button 
                        onClick={() => handleStatusChange(inc.id, 'RESOLVED')}
                        className="flex flex-col items-center justify-center py-2 bg-blue-900/50 hover:bg-blue-600 text-blue-400 hover:text-white border border-blue-800 hover:border-blue-500 rounded-lg transition-colors group"
                      >
                        <ShieldAlert className="w-4 h-4 mb-1" />
                        <span className="text-[10px] font-bold tracking-wider">RESOLVE</span>
                      </button>
                    </div>

                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
