"use client";

import { useState, useEffect } from 'react';
import {
  Users, Bell, CheckCircle2, AlertCircle, Clock, Shield, Eye,
  MapPin, Cpu, ChevronRight, RefreshCw, AlertTriangle, Zap,
  UserCheck, ClipboardCheck
} from 'lucide-react';
import Link from 'next/link';
import {
  getVolunteers, getIncidents, updateVolunteer, updateIncident,
  markNotificationRead, seedVolunteers, getSmsDeliveries,
  Volunteer, Incident, VerificationStatus, SmsDeliveryRecord
} from '@/lib/storage';
import { syncIncidentsToRoadGraph as syncRoutes } from '@/lib/services/routeRiskService';

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

const VERIFICATION_STATUS_LABELS: Record<VerificationStatus, { label: string; color: string; emoji: string }> = {
  UNVERIFIED:                  { label: 'Unverified',              color: 'text-zinc-400 border-zinc-600 bg-zinc-800/50',            emoji: '🔴' },
  FIELD_VERIFICATION_REQUIRED: { label: 'Field Verification Req.', color: 'text-amber-400 border-amber-500/40 bg-amber-500/10',      emoji: '🟠' },
  VERIFICATION_IN_PROGRESS:    { label: 'Verification In Progress',color: 'text-blue-400 border-blue-500/40 bg-blue-500/10',         emoji: '🔵' },
  VERIFIED:                    { label: 'Verified',                color: 'text-emerald-400 border-emerald-500/40 bg-emerald-500/10', emoji: '🟢' },
  PARTIALLY_VERIFIED:          { label: 'Partially Verified',      color: 'text-cyan-400 border-cyan-500/40 bg-cyan-500/10',         emoji: '🟢' },
  FALSE_REPORT:                { label: 'False Report',            color: 'text-zinc-500 border-zinc-700 bg-zinc-900',               emoji: '⚫' },
  UNABLE_TO_VERIFY:            { label: 'Unable to Verify',        color: 'text-zinc-400 border-zinc-600 bg-zinc-800/50',            emoji: '⚪' },
};

function severityColor(sev: string) {
  if (sev === 'CRITICAL') return 'text-red-400 bg-red-500/10 border-red-500/30';
  if (sev === 'HIGH') return 'text-amber-400 bg-amber-500/10 border-amber-500/30';
  if (sev === 'MEDIUM') return 'text-yellow-400 bg-yellow-500/10 border-yellow-500/30';
  return 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30';
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Incident Card
// ─────────────────────────────────────────────────────────────────────────────

function IncidentCard({
  incident,
  activeVolunteerId,
  onAccept,
}: {
  incident: Incident;
  activeVolunteerId: string;
  onAccept: (incidentId: string) => void;
}) {
  const vs = incident.verificationStatus ?? 'UNVERIFIED';
  const badge = VERIFICATION_STATUS_LABELS[vs] ?? VERIFICATION_STATUS_LABELS.UNVERIFIED;
  const isAssignedToMe = incident.assignedVolunteerId === activeVolunteerId;
  const isVerified = vs === 'VERIFIED' || vs === 'PARTIALLY_VERIFIED' || vs === 'FALSE_REPORT';
  const canAccept = (vs === 'FIELD_VERIFICATION_REQUIRED' || vs === 'UNVERIFIED') && !incident.assignedVolunteerId;

  return (
    <div className={`rounded-2xl border bg-zinc-950/60 backdrop-blur-sm p-5 transition-all duration-200 hover:border-zinc-600 ${
      incident.verificationRequired ? 'border-amber-500/30' : 'border-zinc-800'
    }`}>
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <span className="text-base font-bold text-zinc-100 truncate">{incident.hazard}</span>
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${severityColor(incident.severity)}`}>
              {incident.severity}
            </span>
          </div>
          <p className="text-xs text-zinc-500 font-mono">
            {incident.latitude.toFixed(4)}, {incident.longitude.toFixed(4)}
          </p>
        </div>
        <div className="flex flex-col items-end gap-1 flex-shrink-0">
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${badge.color}`}>
            {badge.emoji} {badge.label}
          </span>
          <span className="text-[10px] text-zinc-500">{timeAgo(incident.createdAt)}</span>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3 mb-3">
        <div className="bg-zinc-900/80 rounded-lg p-2.5 text-center">
          <p className="text-[9px] text-zinc-500 uppercase font-bold mb-0.5">AI Confidence</p>
          <p className={`text-sm font-black ${incident.confidence >= 70 ? 'text-emerald-400' : 'text-amber-400'}`}>
            {incident.confidence}%
          </p>
        </div>
        <div className="bg-zinc-900/80 rounded-lg p-2.5 text-center">
          <p className="text-[9px] text-zinc-500 uppercase font-bold mb-0.5">Sources</p>
          <p className="text-sm font-black text-cyan-400">{incident.reportCount}</p>
        </div>
        <div className="bg-zinc-900/80 rounded-lg p-2.5 text-center">
          <p className="text-[9px] text-zinc-500 uppercase font-bold mb-0.5">Image</p>
          <p className={`text-xs font-bold ${incident.isBlurry ? 'text-amber-400' : 'text-emerald-400'}`}>
            {incident.isBlurry ? '⚠ Blurry' : '✓ Clear'}
          </p>
        </div>
      </div>

      {/* Blur / Conflict Alerts */}
      {incident.isBlurry && (
        <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2 mb-3 flex items-center gap-2">
          <AlertCircle className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
          <p className="text-[11px] text-amber-300">Blurry citizen image — physical on-site verification needed</p>
        </div>
      )}
      {incident.conflictingReports && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2 mb-3 flex items-center gap-2">
          <AlertTriangle className="w-3.5 h-3.5 text-red-400 flex-shrink-0" />
          <p className="text-[11px] text-red-300">⚠ Conflicting reports nearby — verification required</p>
        </div>
      )}

      {/* Source badges */}
      <div className="flex flex-wrap gap-1 mb-3">
        {incident.sources.map(s => (
          <span key={s} className="text-[9px] px-1.5 py-0.5 bg-zinc-800 text-zinc-400 rounded border border-zinc-700 font-mono">
            {s === 'Photo' ? '📷' : s === 'SMS' ? '💬' : s === 'Voice' ? '📞' : '🔗'} {s.toUpperCase()}
          </span>
        ))}
        {incident.sources.length >= 3 && (
          <span className="text-[9px] px-1.5 py-0.5 bg-cyan-500/10 text-cyan-400 rounded border border-cyan-500/20 font-bold">
            CORROBORATED
          </span>
        )}
      </div>

      {/* Actions */}
      <div className="flex flex-wrap gap-2 pt-1">
        {canAccept && (
          <button
            onClick={() => onAccept(incident.id)}
            className="flex-1 min-w-[120px] bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold py-2 px-3 rounded-lg transition-colors flex items-center justify-center gap-1.5"
          >
            <UserCheck className="w-3.5 h-3.5" />
            Accept Verification
          </button>
        )}
        {isAssignedToMe && (
          <Link
            href={`/volunteer/verify/${incident.id}`}
            className="flex-1 min-w-[120px] bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold py-2 px-3 rounded-lg transition-colors flex items-center justify-center gap-1.5"
          >
            <ClipboardCheck className="w-3.5 h-3.5" />
            Verify Now
          </Link>
        )}
        {isVerified && (
          <div className="flex-1 min-w-[120px] bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-bold py-2 px-3 rounded-lg flex items-center justify-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5" />
            {vs === 'FALSE_REPORT' ? 'Marked False' : 'Verified'}
          </div>
        )}
        <Link
          href={`/map`}
          className="bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 text-xs font-medium py-2 px-3 rounded-lg transition-colors flex items-center gap-1"
        >
          <MapPin className="w-3.5 h-3.5" />
          View on Map
        </Link>
        <Link
          href={`/volunteer/verify/${incident.id}`}
          className="bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-medium py-2 px-3 rounded-lg transition-colors flex items-center gap-1"
        >
          <Eye className="w-3.5 h-3.5" />
          Details
        </Link>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────────────────────────────────────

type Tab = 'new' | 'verification' | 'mine' | 'verified';

export default function VolunteerPage() {
  const [volunteers, setVolunteers] = useState<Volunteer[]>([]);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [activeTab, setActiveTab] = useState<Tab>('verification');
  const [activeVolunteerId, setActiveVolunteerId] = useState<string>('vol_1');
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  const [smsDeliveries, setSmsDeliveries] = useState<SmsDeliveryRecord[]>([]);
  const [showSmsLog, setShowSmsLog] = useState(false);
  const [mounted, setMounted] = useState(false);

  const loadData = () => {
    seedVolunteers();
    const vols = getVolunteers();
    const incs = getIncidents();
    setVolunteers(vols);
    setIncidents(incs);
    setSmsDeliveries(getSmsDeliveries());
    setLastRefresh(new Date());
  };

  useEffect(() => {
    setMounted(true);
    loadData();

    // React to volunteer notifications in real-time
    const handler = () => loadData();
    window.addEventListener('volunteerNotification', handler);
    window.addEventListener('incidentVerified', handler);
    window.addEventListener('smsDeliveryUpdated', handler);

    // Poll every 5s
    const interval = setInterval(loadData, 5000);
    return () => {
      window.removeEventListener('volunteerNotification', handler);
      window.removeEventListener('incidentVerified', handler);
      window.removeEventListener('smsDeliveryUpdated', handler);
      clearInterval(interval);
    };
  }, []);

  const activeVolunteer = volunteers.find(v => v.volunteerId === activeVolunteerId);

  const handleAcceptVerification = (incidentId: string) => {
    // Update incident
    updateIncident(incidentId, {
      verificationStatus: 'VERIFICATION_IN_PROGRESS',
      assignedVolunteerId: activeVolunteerId,
    });

    // Update volunteer's assigned tasks
    const vol = volunteers.find(v => v.volunteerId === activeVolunteerId);
    if (vol && !vol.assignedTasks.includes(incidentId)) {
      updateVolunteer(activeVolunteerId, {
        assignedTasks: [...vol.assignedTasks, incidentId],
        status: 'BUSY',
      });
    }

    // Sync road graph
    const fresh = getIncidents();
    syncRoutes(fresh);

    loadData();
  };

  // Partition incidents
  const newIncidents = incidents.filter(i =>
    !['RESOLVED', 'REJECTED'].includes(i.status) &&
    !['VERIFIED', 'PARTIALLY_VERIFIED', 'FALSE_REPORT'].includes(i.verificationStatus ?? '')
  ).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const verificationRequired = incidents.filter(i =>
    i.verificationRequired &&
    !['VERIFIED', 'PARTIALLY_VERIFIED', 'FALSE_REPORT', 'UNABLE_TO_VERIFY'].includes(i.verificationStatus ?? '')
  ).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const myTasks = incidents.filter(i => i.assignedVolunteerId === activeVolunteerId);

  const verifiedIncidents = incidents.filter(i =>
    ['VERIFIED', 'PARTIALLY_VERIFIED', 'FALSE_REPORT', 'UNABLE_TO_VERIFY'].includes(i.verificationStatus ?? '')
  ).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const myUnread = activeVolunteer?.notifications.filter(n => !n.read).length ?? 0;

  const tabs: { id: Tab; label: string; count: number; color: string }[] = [
    { id: 'new',          label: 'New Reports',            count: newIncidents.length,        color: 'text-blue-400 border-blue-500/40 bg-blue-500/10' },
    { id: 'verification', label: 'Verification Required',  count: verificationRequired.length, color: 'text-amber-400 border-amber-500/40 bg-amber-500/10' },
    { id: 'mine',         label: 'My Tasks',               count: myTasks.length,             color: 'text-purple-400 border-purple-500/40 bg-purple-500/10' },
    { id: 'verified',     label: 'Verified Incidents',     count: verifiedIncidents.length,    color: 'text-emerald-400 border-emerald-500/40 bg-emerald-500/10' },
  ];

  const currentList =
    activeTab === 'new'          ? newIncidents :
    activeTab === 'verification' ? verificationRequired :
    activeTab === 'mine'         ? myTasks :
    verifiedIncidents;

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-[#030305] text-zinc-100 relative overflow-hidden">
      {/* Background glows */}
      <div className="absolute top-0 left-0 w-[40%] h-[40%] bg-amber-900/10 blur-[120px] rounded-full pointer-events-none" />
      <div className="absolute bottom-0 right-0 w-[40%] h-[40%] bg-indigo-900/10 blur-[120px] rounded-full pointer-events-none" />

      <div className="relative z-10 max-w-7xl mx-auto px-6 py-8">

        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/20">
                <Shield className="w-6 h-6 text-amber-400" />
              </div>
              <h1 className="text-3xl font-black text-zinc-100 tracking-tight">
                Volunteer Response Center
              </h1>
            </div>
            <p className="text-zinc-500 text-sm ml-14" suppressHydrationWarning>
              Field verification system · {mounted ? lastRefresh.toLocaleTimeString() : 'Live'}
            </p>
          </div>

          <div className="flex items-center gap-3">
            {/* Volunteer selector */}
            <div className="flex items-center gap-2 bg-zinc-900 border border-zinc-700 rounded-xl px-3 py-2">
              <Users className="w-4 h-4 text-zinc-400" />
              <select
                value={activeVolunteerId}
                onChange={e => setActiveVolunteerId(e.target.value)}
                className="bg-transparent text-zinc-200 text-sm font-medium focus:outline-none"
              >
                {volunteers.map(v => (
                  <option key={v.volunteerId} value={v.volunteerId}>{v.name}</option>
                ))}
              </select>
              {activeVolunteer && (
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                  activeVolunteer.status === 'AVAILABLE' ? 'text-emerald-400 bg-emerald-500/10' :
                  activeVolunteer.status === 'BUSY' ? 'text-amber-400 bg-amber-500/10' :
                  'text-zinc-500 bg-zinc-800'
                }`}>
                  {activeVolunteer.status}
                </span>
              )}
            </div>

            {/* Notifications badge */}
            <div className="relative">
              <div className="p-2.5 bg-zinc-900 border border-zinc-700 rounded-xl">
                <Bell className="w-5 h-5 text-zinc-400" />
              </div>
              {myUnread > 0 && (
                <span className="absolute -top-1.5 -right-1.5 bg-red-500 text-white text-[10px] font-black w-5 h-5 rounded-full flex items-center justify-center animate-pulse">
                  {myUnread}
                </span>
              )}
            </div>

            {/* Refresh */}
            <button
              onClick={loadData}
              className="p-2.5 bg-zinc-900 border border-zinc-700 rounded-xl hover:bg-zinc-800 transition-colors"
            >
              <RefreshCw className="w-5 h-5 text-zinc-400" />
            </button>
          </div>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {[
            { label: 'Total Incidents', value: incidents.filter(i => !['RESOLVED','REJECTED'].includes(i.status)).length, color: 'text-zinc-100' },
            { label: 'Needs Verification', value: verificationRequired.length, color: 'text-amber-400' },
            { label: 'My Tasks', value: myTasks.length, color: 'text-purple-400' },
            { label: 'Verified Today', value: verifiedIncidents.length, color: 'text-emerald-400' },
          ].map(stat => (
            <div key={stat.label} className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-5 text-center backdrop-blur-sm">
              <p className="text-[10px] text-zinc-500 uppercase tracking-widest font-bold mb-2">{stat.label}</p>
              <p className={`text-3xl font-black ${stat.color}`}>{stat.value}</p>
            </div>
          ))}
        </div>

        {/* My Notifications panel */}
        {activeVolunteer && activeVolunteer.notifications.length > 0 && (
          <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-5 mb-8">
            <h2 className="text-sm font-bold text-zinc-400 uppercase tracking-widest mb-4 flex items-center gap-2">
              <Bell className="w-4 h-4 text-amber-400" />
              My Notifications
              {myUnread > 0 && (
                <span className="text-[10px] bg-red-500 text-white px-2 py-0.5 rounded-full font-black">{myUnread} new</span>
              )}
            </h2>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {activeVolunteer.notifications.slice(0, 8).map(n => (
                <div
                  key={n.id}
                  onClick={() => markNotificationRead(activeVolunteerId, n.id)}
                  className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-colors hover:bg-zinc-800 ${
                    n.read ? 'border-zinc-800 opacity-60' : 'border-amber-500/30 bg-amber-500/5'
                  }`}
                >
                  <span className="text-base">{n.isBlurry ? '🟠' : '🔴'}</span>
                  <div className="flex-1 min-w-0">
                    <p className={`text-xs ${n.read ? 'text-zinc-400' : 'text-zinc-200 font-semibold'}`}>
                      {n.message}
                    </p>
                    <p className="text-[10px] text-zinc-600 mt-0.5">{timeAgo(n.timestamp)}</p>
                  </div>
                  {!n.read && <div className="w-2 h-2 rounded-full bg-amber-400 flex-shrink-0 mt-1" />}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* SMS Alert Log Panel */}
        {smsDeliveries.length > 0 && (
          <div className="bg-indigo-950/20 border border-indigo-500/25 rounded-2xl mb-8 overflow-hidden">
            <button
              onClick={() => setShowSmsLog(s => !s)}
              className="w-full flex items-center justify-between px-5 py-4 hover:bg-indigo-500/5 transition-colors"
            >
              <div className="flex items-center gap-3">
                <span className="text-lg">📱</span>
                <span className="text-sm font-bold text-zinc-200 uppercase tracking-wider">SMS Volunteer Alert Log</span>
                <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-indigo-500/15 border border-indigo-400/30 text-indigo-300">
                  {smsDeliveries.length} message{smsDeliveries.length !== 1 ? 's' : ''}
                </span>
                {smsDeliveries.some(r => r.mode === 'demo_simulation') && (
                  <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-400/30 text-amber-300">
                    📲 DEMO MODE
                  </span>
                )}
              </div>
              <span className="text-zinc-500 text-xs">{showSmsLog ? '▲ Hide' : '▼ Show'}</span>
            </button>

            {showSmsLog && (
              <div className="px-5 pb-5 space-y-3">
                {smsDeliveries.slice(0, 10).map((rec, i) => (
                  <div key={i} className="bg-zinc-950 border border-zinc-800 rounded-xl overflow-hidden">
                    <div className="flex items-center justify-between px-4 py-2.5 border-b border-zinc-800">
                      <div className="flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full flex-shrink-0 ${
                          rec.status === 'sent' || rec.status === 'simulated' ? 'bg-emerald-400' : 'bg-red-400'
                        }`} />
                        <span className="text-xs font-mono text-zinc-300">{rec.recipient}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border ${
                          rec.status === 'sent' || rec.status === 'simulated'
                            ? 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10'
                            : 'text-red-400 border-red-500/30 bg-red-500/10'
                        }`}>
                          {rec.status === 'simulated' ? 'SIMULATED ✓' : rec.status.toUpperCase()}
                        </span>
                        <span className="text-[10px] text-zinc-600">{new Date(rec.timestamp).toLocaleTimeString()}</span>
                      </div>
                    </div>
                    <details>
                      <summary className="text-[11px] text-zinc-500 hover:text-zinc-300 cursor-pointer px-4 py-2 font-bold tracking-wider select-none transition-colors">
                        ▸ VIEW MESSAGE · Incident: {rec.incidentId}
                      </summary>
                      <pre className="text-[11px] text-zinc-300 font-mono whitespace-pre-wrap px-4 pb-4 leading-relaxed">
                        {rec.message}
                      </pre>
                    </details>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Tabs */}
        <div className="flex flex-wrap gap-2 mb-6">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl border text-sm font-semibold transition-all ${
                activeTab === tab.id
                  ? tab.color
                  : 'border-zinc-800 text-zinc-500 hover:border-zinc-600 hover:text-zinc-300'
              }`}
            >
              {tab.label}
              <span className={`text-[10px] font-black px-1.5 py-0.5 rounded ${
                activeTab === tab.id ? 'bg-black/20' : 'bg-zinc-800'
              }`}>
                {tab.count}
              </span>
            </button>
          ))}
        </div>

        {/* Incident Grid */}
        {currentList.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-zinc-600">
            <Shield className="w-16 h-16 mb-4 opacity-20" />
            <p className="text-sm">No incidents in this category.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {currentList.map(inc => (
              <IncidentCard
                key={inc.id}
                incident={inc}
                activeVolunteerId={activeVolunteerId}
                onAccept={handleAcceptVerification}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
