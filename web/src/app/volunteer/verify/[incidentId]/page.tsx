"use client";

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  CheckCircle2, AlertCircle, XCircle, HelpCircle, MapPin, Cpu,
  Shield, Eye, ChevronLeft, AlertTriangle, Camera, Users, Zap
} from 'lucide-react';
import Link from 'next/link';
import {
  getIncidentById, getVolunteers, updateIncident, updateVolunteer,
  seedVolunteers, Incident, VerificationStatus
} from '@/lib/storage';
import { syncIncidentsToRoadGraph } from '@/lib/services/routeRiskService';
import { getIncidents } from '@/lib/storage';

// ─────────────────────────────────────────────────────────────────────────────
// Verification Actions
// ─────────────────────────────────────────────────────────────────────────────

interface VerificationAction {
  id: VerificationStatus;
  label: string;
  sublabel: string;
  icon: React.ElementType;
  color: string;
  bg: string;
  border: string;
  newStatus: 'VERIFIED' | 'AI_CLASSIFIED' | 'REJECTED' | 'PENDING';
}

const ACTIONS: VerificationAction[] = [
  {
    id: 'VERIFIED',
    label: 'Confirm',
    sublabel: 'Incident is exactly as reported',
    icon: CheckCircle2,
    color: 'text-emerald-400',
    bg: 'bg-emerald-500/10 hover:bg-emerald-500/20',
    border: 'border-emerald-500/40 hover:border-emerald-400',
    newStatus: 'VERIFIED',
  },
  {
    id: 'PARTIALLY_VERIFIED',
    label: 'Partially Confirm',
    sublabel: 'Incident exists but details differ',
    icon: Eye,
    color: 'text-cyan-400',
    bg: 'bg-cyan-500/10 hover:bg-cyan-500/20',
    border: 'border-cyan-500/40 hover:border-cyan-400',
    newStatus: 'VERIFIED',
  },
  {
    id: 'FALSE_REPORT',
    label: 'False Report',
    sublabel: 'No such incident at this location',
    icon: XCircle,
    color: 'text-zinc-400',
    bg: 'bg-zinc-800/50 hover:bg-zinc-800',
    border: 'border-zinc-700 hover:border-zinc-500',
    newStatus: 'REJECTED',
  },
  {
    id: 'UNABLE_TO_VERIFY',
    label: 'Unable to Verify',
    sublabel: 'Could not access the location safely',
    icon: HelpCircle,
    color: 'text-zinc-500',
    bg: 'bg-zinc-900/50 hover:bg-zinc-900',
    border: 'border-zinc-800 hover:border-zinc-600',
    newStatus: 'PENDING',
  },
];

function severityColor(sev: string) {
  if (sev === 'CRITICAL') return 'text-red-400 bg-red-500/10 border-red-500/30';
  if (sev === 'HIGH') return 'text-amber-400 bg-amber-500/10 border-amber-500/30';
  if (sev === 'MEDIUM') return 'text-yellow-400 bg-yellow-500/10 border-yellow-500/30';
  return 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30';
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────────────────────────────────────

export default function VerifyPage() {
  const params = useParams<{ incidentId: string }>();
  const router = useRouter();
  const incidentId = params?.incidentId ?? '';

  const [incident, setIncident] = useState<Incident | null>(null);
  const [volunteerId, setVolunteerId] = useState('vol_1');
  const [volunteers, setVolunteers] = useState<ReturnType<typeof getVolunteers>>([]);
  const [notes, setNotes] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [result, setResult] = useState<VerificationAction | null>(null);

  useEffect(() => {
    seedVolunteers();
    const inc = getIncidentById(incidentId);
    setIncident(inc ?? null);
    setVolunteers(getVolunteers());
    if (inc?.assignedVolunteerId) setVolunteerId(inc.assignedVolunteerId);
  }, [incidentId]);

  if (!incident) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-zinc-500">
        <AlertCircle className="w-16 h-16 mb-4 opacity-30" />
        <p className="text-lg font-semibold mb-2">Incident Not Found</p>
        <Link href="/volunteer" className="text-sm text-blue-400 hover:underline">← Back to Dashboard</Link>
      </div>
    );
  }

  const handleVerify = (action: VerificationAction) => {
    const now = new Date().toISOString();

    updateIncident(incidentId, {
      verificationStatus: action.id,
      status: action.newStatus,
      verificationNotes: notes,
      verifiedAt: now,
      assignedVolunteerId: volunteerId,
    });

    // Update volunteer — remove from assignedTasks if done
    const vol = volunteers.find(v => v.volunteerId === volunteerId);
    if (vol) {
      updateVolunteer(volunteerId, {
        assignedTasks: vol.assignedTasks.filter(t => t !== incidentId),
        status: 'AVAILABLE',
      });
    }

    // Sync road graph immediately
    const fresh = getIncidents();
    syncIncidentsToRoadGraph(fresh);

    // Dispatch event for live map / route page
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('incidentVerified', {
        detail: { incidentId, verificationStatus: action.id }
      }));
      window.dispatchEvent(new CustomEvent('routeRiskUpdated', {
        detail: { incidentId, verificationStatus: action.id }
      }));
    }

    setResult(action);
    setSubmitted(true);
  };

  if (submitted && result) {
    const isVerified = result.id === 'VERIFIED' || result.id === 'PARTIALLY_VERIFIED';
    const isFalse = result.id === 'FALSE_REPORT';

    return (
      <div className="min-h-[calc(100vh-4rem)] bg-[#030305] flex items-center justify-center p-6">
        <div className="max-w-md w-full text-center">
          <div className={`w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6 ${
            isVerified ? 'bg-emerald-500/20' : isFalse ? 'bg-zinc-800' : 'bg-zinc-800'
          }`}>
            <result.icon className={`w-10 h-10 ${result.color}`} />
          </div>
          <h2 className={`text-2xl font-black mb-2 ${result.color}`}>
            {isVerified ? '✓ INCIDENT VERIFIED' : isFalse ? 'MARKED AS FALSE REPORT' : result.label.toUpperCase()}
          </h2>
          <p className="text-zinc-400 text-sm mb-2">{incident.hazard} · {incident.severity}</p>

          {isVerified && (
            <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-4 mb-6 text-left">
              <p className="text-xs font-bold text-emerald-400 mb-2">EFFECTS OF THIS VERIFICATION:</p>
              <ul className="space-y-1 text-xs text-zinc-300">
                <li className="flex items-center gap-2"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" /> Incident status → VERIFIED</li>
                <li className="flex items-center gap-2"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" /> Map marker updated → 🟢 VERIFIED</li>
                <li className="flex items-center gap-2"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" /> Road risk maximized for nearby roads</li>
                <li className="flex items-center gap-2"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" /> Active routes will auto-recalculate</li>
              </ul>
            </div>
          )}

          {isFalse && (
            <div className="bg-zinc-900 border border-zinc-700 rounded-xl p-4 mb-6 text-left">
              <p className="text-xs font-bold text-zinc-400 mb-2">EFFECTS OF FALSE REPORT:</p>
              <ul className="space-y-1 text-xs text-zinc-400">
                <li className="flex items-center gap-2"><CheckCircle2 className="w-3.5 h-3.5 text-zinc-500 flex-shrink-0" /> Incident status → REJECTED</li>
                <li className="flex items-center gap-2"><CheckCircle2 className="w-3.5 h-3.5 text-zinc-500 flex-shrink-0" /> Map marker → ⚫ FALSE REPORT</li>
                <li className="flex items-center gap-2"><CheckCircle2 className="w-3.5 h-3.5 text-zinc-500 flex-shrink-0" /> Road risk cleared for affected roads</li>
                <li className="flex items-center gap-2"><CheckCircle2 className="w-3.5 h-3.5 text-zinc-500 flex-shrink-0" /> Affected routes can now use this road</li>
              </ul>
            </div>
          )}

          {notes && (
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 mb-6 text-left">
              <p className="text-xs font-bold text-zinc-500 mb-1 uppercase tracking-wider">Your Notes</p>
              <p className="text-sm text-zinc-300">{notes}</p>
            </div>
          )}

          <div className="flex gap-3">
            <Link href="/volunteer" className="flex-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-medium py-3 rounded-xl transition-colors flex items-center justify-center gap-2">
              <ChevronLeft className="w-4 h-4" />
              Back to Dashboard
            </Link>
            <Link href="/route" className="flex-1 bg-cyan-700 hover:bg-cyan-600 text-white font-bold py-3 rounded-xl transition-colors flex items-center justify-center gap-2">
              <Zap className="w-4 h-4" />
              Check Routes
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const vs = incident.verificationStatus ?? 'UNVERIFIED';
  const isAlreadyVerified = ['VERIFIED', 'PARTIALLY_VERIFIED', 'FALSE_REPORT', 'UNABLE_TO_VERIFY'].includes(vs);

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-[#030305] text-zinc-100">
      {/* Background glow */}
      <div className="fixed top-0 right-0 w-[50%] h-[50%] bg-amber-900/5 blur-[120px] rounded-full pointer-events-none" />

      <div className="relative z-10 max-w-4xl mx-auto px-6 py-8">

        {/* Back */}
        <Link href="/volunteer" className="inline-flex items-center gap-2 text-zinc-500 hover:text-zinc-300 text-sm mb-6 transition-colors">
          <ChevronLeft className="w-4 h-4" />
          Volunteer Dashboard
        </Link>

        {/* Title */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/20">
              <Shield className="w-6 h-6 text-amber-400" />
            </div>
            <div>
              <h1 className="text-2xl font-black text-zinc-100">Field Verification Task</h1>
              <p className="text-zinc-500 text-xs font-mono">{incidentId}</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

          {/* LEFT: Incident Details */}
          <div className="space-y-4">

            {/* Incident Header */}
            <div className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-5">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h2 className="text-xl font-black text-zinc-100">{incident.hazard}</h2>
                  <p className="text-xs text-zinc-500 mt-0.5">
                    {incident.disasterType ? `Type: ${incident.disasterType}` : ''}
                    {incident.damageClass ? ` · Damage: ${incident.damageClass}` : ''}
                  </p>
                </div>
                <span className={`text-xs font-bold px-2.5 py-1 rounded-lg border ${severityColor(incident.severity)}`}>
                  {incident.severity}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="bg-zinc-950/60 rounded-xl p-3">
                  <p className="text-[9px] text-zinc-500 uppercase font-bold mb-1">Location</p>
                  <p className="text-xs text-zinc-300 font-mono">
                    {incident.latitude.toFixed(5)},<br />{incident.longitude.toFixed(5)}
                  </p>
                </div>
                <div className="bg-zinc-950/60 rounded-xl p-3">
                  <p className="text-[9px] text-zinc-500 uppercase font-bold mb-1">Reports Fused</p>
                  <p className="text-xl font-black text-cyan-400">{incident.reportCount}</p>
                </div>
              </div>
            </div>

            {/* AI Assessment */}
            <div className="bg-zinc-900/60 border border-zinc-800 rounded-2xl overflow-hidden">
              <div className="bg-purple-500/10 border-b border-purple-500/20 px-5 py-3 flex items-center gap-2">
                <Cpu className="w-4 h-4 text-purple-400" />
                <span className="text-xs font-bold text-purple-400 uppercase tracking-widest">AI Assessment</span>
                <span className="ml-auto text-xs text-zinc-600">Not human-verified</span>
              </div>
              <div className="p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-zinc-500">Disaster Type (MEDIC)</span>
                  <span className="text-sm font-semibold text-zinc-200">{incident.hazard}</span>
                </div>
                {incident.damageClass && (
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-zinc-500">Damage (BiTemporal)</span>
                    <span className="text-sm font-semibold text-zinc-200">{incident.damageClass.toUpperCase()}</span>
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <span className="text-xs text-zinc-500">Confidence</span>
                  <span className={`text-sm font-bold ${incident.confidence >= 70 ? 'text-emerald-400' : 'text-amber-400'}`}>
                    {incident.confidence}%
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-zinc-500">Sources</span>
                  <div className="flex gap-1">
                    {incident.sources.map(s => (
                      <span key={s} className="text-[9px] px-1.5 py-0.5 bg-zinc-800 text-zinc-400 rounded border border-zinc-700">
                        {s}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Blur warning */}
            {incident.isBlurry && (
              <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-5">
                <div className="flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-bold text-amber-400 mb-1">⚠ BLURRY CITIZEN IMAGE</p>
                    <p className="text-xs text-zinc-400">
                      The citizen's image had a sharpness score of <strong>{incident.blurScore}</strong> (below threshold).
                      The AI classified the image, but physical on-site verification is required before this incident
                      can be treated as confirmed.
                    </p>
                    <p className="text-xs text-amber-500/70 mt-2 font-medium">
                      Reason: "Citizen image quality is insufficient for reliable visual verification."
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Conflicting reports */}
            {incident.conflictingReports && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-2xl p-5">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-bold text-red-400 mb-1">⚠ CONFLICTING REPORTS</p>
                    <p className="text-xs text-zinc-400">
                      Other reports near this location describe a different disaster type. Your physical verification
                      will resolve the conflict.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Citizen image */}
            {incident.imageUrl && incident.imageUrl !== '/placeholder-disaster.jpg' && (
              <div className="bg-zinc-900/60 border border-zinc-800 rounded-2xl overflow-hidden">
                <div className="px-5 py-3 border-b border-zinc-800 flex items-center gap-2">
                  <Camera className="w-4 h-4 text-zinc-400" />
                  <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Citizen Image</span>
                  {incident.isBlurry && (
                    <span className="ml-auto text-[10px] text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20 font-bold">
                      BLURRY
                    </span>
                  )}
                </div>
                <img
                  src={incident.imageUrl}
                  alt="Citizen report"
                  className="w-full h-48 object-cover opacity-80"
                />
              </div>
            )}
          </div>

          {/* RIGHT: Verification Form */}
          <div className="space-y-4">

            {/* Volunteer selector */}
            <div className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-5">
              <div className="flex items-center gap-2 mb-3">
                <Users className="w-4 h-4 text-zinc-400" />
                <p className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Verifying as</p>
              </div>
              <select
                value={volunteerId}
                onChange={e => setVolunteerId(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-700 text-zinc-200 text-sm rounded-lg p-3 focus:outline-none focus:border-amber-500"
              >
                {volunteers.map(v => (
                  <option key={v.volunteerId} value={v.volunteerId}>{v.name}</option>
                ))}
              </select>
            </div>

            {/* Already verified notice */}
            {isAlreadyVerified && (
              <div className="bg-zinc-900 border border-zinc-700 rounded-2xl p-5 text-center">
                <CheckCircle2 className="w-8 h-8 text-zinc-500 mx-auto mb-2" />
                <p className="text-sm font-semibold text-zinc-400">This incident has already been verified</p>
                <p className="text-xs text-zinc-600 mt-1">Status: {vs}</p>
              </div>
            )}

            {/* Verification reason */}
            {incident.verificationRequired && (
              <div className="bg-zinc-900/60 border border-amber-500/20 rounded-2xl p-5">
                <p className="text-xs font-bold text-amber-400 uppercase tracking-wider mb-2">
                  Why verification is required
                </p>
                <ul className="space-y-1.5">
                  {incident.isBlurry && (
                    <li className="text-xs text-zinc-400 flex items-center gap-2">
                      <AlertCircle className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
                      Image quality insufficient (blurry)
                    </li>
                  )}
                  {incident.confidence < 70 && (
                    <li className="text-xs text-zinc-400 flex items-center gap-2">
                      <AlertCircle className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
                      AI confidence below threshold ({incident.confidence}% &lt; 70%)
                    </li>
                  )}
                  {incident.conflictingReports && (
                    <li className="text-xs text-zinc-400 flex items-center gap-2">
                      <AlertTriangle className="w-3.5 h-3.5 text-red-400 flex-shrink-0" />
                      Conflicting reports at this location
                    </li>
                  )}
                </ul>
              </div>
            )}

            {/* Action buttons */}
            {!isAlreadyVerified && (
              <div className="space-y-3">
                <p className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Field Verification Result</p>
                {ACTIONS.map(action => {
                  const Icon = action.icon;
                  return (
                    <button
                      key={action.id}
                      onClick={() => handleVerify(action)}
                      className={`w-full flex items-center gap-4 p-4 rounded-xl border transition-all duration-200 text-left ${action.bg} ${action.border}`}
                    >
                      <div className={`p-2 rounded-lg bg-black/20 ${action.color}`}>
                        <Icon className="w-5 h-5" />
                      </div>
                      <div className="flex-1">
                        <p className={`text-sm font-bold ${action.color}`}>{action.label}</p>
                        <p className="text-xs text-zinc-500">{action.sublabel}</p>
                      </div>
                      <ChevronLeft className={`w-4 h-4 rotate-180 ${action.color} opacity-50`} />
                    </button>
                  );
                })}
              </div>
            )}

            {/* Notes */}
            {!isAlreadyVerified && (
              <div>
                <label className="block text-xs font-bold text-zinc-400 uppercase tracking-wider mb-2">
                  Verification Notes (Optional)
                </label>
                <textarea
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  className="w-full bg-zinc-900 border border-zinc-700 rounded-xl p-4 text-zinc-200 text-sm focus:outline-none focus:border-amber-500 min-h-[100px] resize-none"
                  placeholder="Describe what you observed on site…"
                />
              </div>
            )}

            {/* Already verified display */}
            {isAlreadyVerified && incident.verificationNotes && (
              <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4">
                <p className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-2">Verification Notes</p>
                <p className="text-sm text-zinc-300">{incident.verificationNotes}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
