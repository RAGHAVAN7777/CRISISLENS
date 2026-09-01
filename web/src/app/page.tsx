"use client";

import { useEffect, useState } from 'react';
import { 
  Activity, ShieldAlert, Zap, AlertTriangle, MessageSquare, 
  Mic, Cpu, Map as MapIcon, ArrowRight, Navigation as NavIcon, 
  Route as RouteIcon, Network, Users, CheckCircle2
} from 'lucide-react';
import { getIncidents, getReports, Incident, seedInitialData, seedVolunteers } from '@/lib/storage';
import Link from 'next/link';

export default function OverviewPage() {
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [totalReports, setTotalReports] = useState(0);

  useEffect(() => {
    seedInitialData();
    seedVolunteers();
    const timer = setTimeout(() => {
      setIncidents(getIncidents());
      setTotalReports(getReports().length);
    }, 100);
    return () => clearTimeout(timer);
  }, []);

  const severityColor = (sev: string) => {
    if (sev === 'CRITICAL') return 'text-red-400 bg-red-500/10 border-red-500/30';
    if (sev === 'HIGH') return 'text-amber-400 bg-amber-500/10 border-amber-500/30';
    if (sev === 'MEDIUM') return 'text-yellow-400 bg-yellow-500/10 border-yellow-500/30';
    return 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30';
  };

  const verificationBadge = (inc: Incident) => {
    const vs = inc.verificationStatus ?? (inc.status === 'VERIFIED' ? 'VERIFIED' : 'UNVERIFIED');
    if (vs === 'VERIFIED' || vs === 'PARTIALLY_VERIFIED') {
      return { text: '🟢 VERIFIED', cls: 'border-emerald-500/30 text-emerald-400 bg-emerald-500/10' };
    }
    if (vs === 'FIELD_VERIFICATION_REQUIRED' || inc.isBlurry || inc.verificationRequired) {
      return { text: '🟠 VERIFICATION REQ', cls: 'border-amber-500/30 text-amber-400 bg-amber-500/10' };
    }
    if (vs === 'VERIFICATION_IN_PROGRESS') {
      return { text: '🔵 IN PROGRESS', cls: 'border-blue-500/30 text-blue-400 bg-blue-500/10' };
    }
    if (vs === 'FALSE_REPORT' || inc.status === 'REJECTED') {
      return { text: '⚫ FALSE REPORT', cls: 'border-zinc-700 text-zinc-500 bg-zinc-800/50' };
    }
    return { text: '🔴 UNVERIFIED', cls: 'border-red-500/30 text-red-400 bg-red-500/10' };
  };

  const demos = [
    { name: "Citizen Photo", path: "/report", icon: AlertTriangle, desc: "Vision AI + Blur Detection", color: "text-blue-400", bg: "bg-blue-500/5 border-blue-500/20 hover:bg-blue-500/10 hover:border-blue-500/50 hover:shadow-[0_0_20px_rgba(59,130,246,0.15)]" },
    { name: "Volunteer Center", path: "/volunteer", icon: Users, desc: "Field Verification Workflow", color: "text-amber-400", bg: "bg-amber-500/5 border-amber-500/20 hover:bg-amber-500/10 hover:border-amber-500/50 hover:shadow-[0_0_20px_rgba(245,158,11,0.15)]" },
    { name: "Live EOC Map", path: "/map", icon: MapIcon, desc: "Status Pins & Geospatial Fusion", color: "text-indigo-400", bg: "bg-indigo-500/5 border-indigo-500/20 hover:bg-indigo-500/10 hover:border-indigo-500/50 hover:shadow-[0_0_20px_rgba(99,102,241,0.15)]" },
    { name: "Route Planner", path: "/route", icon: RouteIcon, desc: "Dijkstra & Dynamic Rerouting", color: "text-orange-400", bg: "bg-orange-500/5 border-orange-500/20 hover:bg-orange-500/10 hover:border-orange-500/50 hover:shadow-[0_0_20px_rgba(249,115,22,0.15)]" },
    { name: "Citizen SMS", path: "/sms", icon: MessageSquare, desc: "NLP Intent Parsing", color: "text-emerald-400", bg: "bg-emerald-500/5 border-emerald-500/20 hover:bg-emerald-500/10 hover:border-emerald-500/50 hover:shadow-[0_0_20px_rgba(16,185,129,0.15)]" },
    { name: "Voice IVR", path: "/call", icon: Mic, desc: "Audio Transcription", color: "text-cyan-400", bg: "bg-cyan-500/5 border-cyan-500/20 hover:bg-cyan-500/10 hover:border-cyan-500/50 hover:shadow-[0_0_20px_rgba(6,182,212,0.15)]" },
    { name: "Judge AI Demo", path: "/judge", icon: Cpu, desc: "Dual Vision Model Inference", color: "text-purple-400", bg: "bg-purple-500/5 border-purple-500/20 hover:bg-purple-500/10 hover:border-purple-500/50 hover:shadow-[0_0_20px_rgba(168,85,247,0.15)]" },
    { name: "Safe Routing", path: "/routing", icon: NavIcon, desc: "Evacuation to Shelters", color: "text-teal-400", bg: "bg-teal-500/5 border-teal-500/20 hover:bg-teal-500/10 hover:border-teal-500/50 hover:shadow-[0_0_20px_rgba(20,184,166,0.15)]" },
  ];

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-[#030305] text-zinc-100 p-6 md:p-12 relative overflow-hidden">
      
      {/* Background glow elements */}
      <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-cyan-900/20 blur-[120px] rounded-full pointer-events-none" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] bg-amber-900/15 blur-[120px] rounded-full pointer-events-none" />

      <div className="max-w-7xl mx-auto relative z-10">
        
        {/* Hero Section */}
        <div className="mb-14 text-center space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 text-xs font-bold tracking-widest mb-4">
            <Network size={14} /> CITIZEN-TO-VOLUNTEER INTELLIGENCE PLATFORM
          </div>
          <h1 className="text-5xl md:text-6xl font-black tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-zinc-100 via-zinc-300 to-zinc-500">
            DISASTER INTELLIGENCE NETWORK
          </h1>
          <p className="text-zinc-400 text-lg md:text-xl max-w-2xl mx-auto font-light">
            Multi-modal citizen reporting with AI classification, blur detection, instant volunteer mobilization, and dynamic evacuation rerouting.
          </p>
        </div>

        {/* The Launchpad Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-16">
          {demos.map(demo => (
            <Link href={demo.path} key={demo.path} className={`group block p-5 md:p-6 rounded-2xl border bg-zinc-950/40 backdrop-blur-sm transition-all duration-300 transform hover:-translate-y-1 ${demo.bg}`}>
              <div className="flex items-start justify-between mb-4">
                <div className={`p-3 rounded-xl bg-black/40 ${demo.color} shadow-inner`}>
                  <demo.icon className="w-6 h-6 md:w-8 md:h-8" />
                </div>
                <ArrowRight className={`w-5 h-5 opacity-0 group-hover:opacity-100 transition-all transform group-hover:translate-x-1 ${demo.color}`} />
              </div>
              <h3 className="text-lg md:text-xl font-bold text-zinc-100 mb-1">{demo.name}</h3>
              <p className="text-xs md:text-sm text-zinc-500 font-medium group-hover:text-zinc-400 transition-colors">{demo.desc}</p>
            </Link>
          ))}
        </div>

        {/* Bottom Section */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Incident Feed */}
          <div className="lg:col-span-2 bg-zinc-900/40 backdrop-blur-md border border-zinc-800/60 rounded-3xl p-6 md:p-8 shadow-2xl">
            <div className="flex items-center justify-between mb-8">
              <h2 className="text-xl font-bold text-zinc-100 flex items-center gap-3">
                <Activity className="w-5 h-5 text-red-500 animate-pulse" />
                Live Global Incident Feed
              </h2>
              <span className="text-xs font-bold bg-zinc-800 text-zinc-400 px-2.5 py-1 rounded">Last 6 Incidents</span>
            </div>
            
            <div className="space-y-3">
              {incidents.slice(0, 6).map((inc) => {
                const timeStr = new Date(inc.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                const badge = verificationBadge(inc);
                return (
                  <div key={inc.id} className="p-4 rounded-2xl bg-zinc-950/50 border border-zinc-800/80 flex flex-col md:flex-row md:items-center gap-4 hover:border-zinc-700 transition-colors">
                    <div className="flex-1 flex items-start gap-4">
                      <div className={`h-2.5 w-2.5 rounded-full mt-1.5 flex-shrink-0 shadow-[0_0_10px_currentColor] ${
                        inc.verificationStatus === 'VERIFIED' ? 'text-emerald-500 bg-emerald-500' :
                        inc.verificationRequired || inc.isBlurry ? 'text-amber-500 bg-amber-500 animate-pulse' :
                        'text-red-500 bg-red-500 animate-pulse'
                      }`} />
                      <div>
                        <div className="flex flex-wrap items-center gap-2 mb-1">
                          <h3 className="font-bold text-zinc-200">{inc.hazard} Detected</h3>
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${severityColor(inc.severity)}`}>
                            {inc.severity}
                          </span>
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border ${badge.cls}`}>
                            {badge.text}
                          </span>
                        </div>
                        <p className="text-xs text-zinc-500">
                          Lat: {inc.latitude.toFixed(3)}, Lng: {inc.longitude.toFixed(3)} • <strong className="text-cyan-500">{inc.reportCount} Corroborating Reports</strong>
                          {inc.isBlurry && <span className="ml-2 text-amber-400 font-bold">· ⚠ Blurry Image</span>}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 self-start md:self-auto">
                      <div className="text-[10px] font-mono text-zinc-500 bg-zinc-900 px-2.5 py-1 rounded-md border border-zinc-800">{timeStr}</div>
                      <Link 
                        href={`/volunteer/verify/${inc.id}`}
                        className="text-[11px] font-bold text-amber-400 hover:text-amber-300 bg-amber-500/10 border border-amber-500/30 px-2.5 py-1 rounded-md transition-colors"
                      >
                        Verify →
                      </Link>
                    </div>
                  </div>
                );
              })}
              {incidents.length === 0 && (
                <div className="flex flex-col items-center justify-center py-12 text-zinc-500">
                  <Activity className="w-12 h-12 mb-4 opacity-20" />
                  <p className="text-sm">No active incidents found in localStorage.</p>
                </div>
              )}
            </div>
          </div>

          {/* Telemetry & Health */}
          <div className="flex flex-col gap-6">
            <div className="bg-zinc-900/40 backdrop-blur-md border border-zinc-800/60 rounded-3xl p-6 shadow-2xl">
              <h2 className="text-sm font-bold text-zinc-400 uppercase tracking-widest mb-6">System Telemetry</h2>
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-zinc-950/50 rounded-2xl p-5 border border-zinc-800/80 relative overflow-hidden group">
                  <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                  <p className="text-[10px] text-zinc-500 uppercase tracking-widest font-bold mb-2">Total Reports</p>
                  <p className="text-3xl font-black text-zinc-100">{totalReports}</p>
                </div>
                <div className="bg-zinc-950/50 rounded-2xl p-5 border border-zinc-800/80 relative overflow-hidden group">
                  <div className="absolute inset-0 bg-gradient-to-br from-amber-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                  <p className="text-[10px] text-zinc-500 uppercase tracking-widest font-bold mb-2">Needs Verification</p>
                  <p className="text-3xl font-black text-amber-400">
                    {incidents.filter(i => i.verificationRequired && !['VERIFIED', 'PARTIALLY_VERIFIED', 'FALSE_REPORT'].includes(i.verificationStatus ?? '')).length}
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-zinc-900/40 backdrop-blur-md border border-zinc-800/60 rounded-3xl p-6 shadow-2xl flex-1">
              <h2 className="text-sm font-bold text-zinc-400 uppercase tracking-widest mb-6">Service Health</h2>
              <div className="space-y-3">
                {[
                  { name: 'Blur Detection (Laplacian)', status: 'Operational' },
                  { name: 'MEDIC Classifier (QCRI)', status: 'Operational' },
                  { name: 'BiTemporal Damage Model', status: 'Operational' },
                  { name: 'Volunteer Dispatch (localStorage)', status: 'Operational' },
                  { name: 'Live Dynamic Rerouting', status: 'Operational' },
                ].map((sys, i) => (
                  <div key={i} className="flex items-center justify-between p-3.5 rounded-xl bg-zinc-950/50 border border-zinc-800/50">
                    <span className="text-xs font-medium text-zinc-300">{sys.name}</span>
                    <span className="flex items-center gap-1.5 text-[9px] font-bold tracking-widest text-emerald-400 bg-emerald-500/10 px-2 py-1 rounded border border-emerald-500/20">
                      <div className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)] animate-pulse" />
                      {sys.status.toUpperCase()}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
