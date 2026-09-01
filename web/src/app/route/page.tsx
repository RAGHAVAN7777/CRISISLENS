"use client";

import { useEffect, useRef, useState, useCallback } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import {
  Navigation as NavIcon, MapPin, ShieldCheck, AlertTriangle,
  CheckCircle2, Clock, Ruler, ArrowRight, Zap,
  RefreshCw, Siren, X, TriangleAlert, Activity, Wifi,
  Shield, Compass, Info, Check, Eye
} from 'lucide-react';
import {
  fetchOSRMRoute, selectSafestRoute, evaluateRouteRisk,
  isRouteIntersectingIncident, EvaluatedRoute
} from '@/lib/services/realRoutingService';
import { NearbyDestination } from '@/app/api/destinations/route';
import { getIncidents, addIncident, Incident } from '@/lib/storage';
import { ROUTE_RISK_UPDATED_EVENT } from '@/lib/services/routeRiskService';

const RouteMapComponent = dynamic(() => import('@/components/RouteMapComponent'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex flex-col items-center justify-center text-zinc-500 bg-zinc-950 text-sm gap-2">
      <RefreshCw className="w-6 h-6 animate-spin text-indigo-400" />
      <span>Loading Live Geospatial Map...</span>
    </div>
  ),
});

const RISK_BADGE: Record<string, string> = {
  LOW:    'text-emerald-400 border-emerald-500/30 bg-emerald-500/10',
  MEDIUM: 'text-amber-400 border-amber-500/30 bg-amber-500/10',
  HIGH:   'text-red-400 border-red-500/30 bg-red-500/10',
};

type Phase = 'idle' | 'route_ready' | 'disaster_detected' | 'recalculating' | 'rerouted' | 'live_rerouted';

interface AutoRerouteAlert {
  triggerIncident: Incident;
  oldRoute: EvaluatedRoute;
  newRoute: EvaluatedRoute;
}

export default function RoutePage() {
  const [incidents, setIncidents]                     = useState<Incident[]>([]);
  const [destinations, setDestinations]               = useState<NearbyDestination[]>([]);
  const [selectedDestId, setSelectedDestId]           = useState<string>('');
  const [destLoading, setDestLoading]                 = useState(false);

  // Routes
  const [activeRoute, setActiveRoute]                 = useState<EvaluatedRoute | null>(null);
  const [alternativeRoute, setAlternativeRoute]       = useState<EvaluatedRoute | null>(null);
  const [previousRoute, setPreviousRoute]             = useState<EvaluatedRoute | null>(null);

  // UI state
  const [phase, setPhase]                             = useState<Phase>('idle');
  const [isCalculating, setIsCalculating]             = useState(false);
  const [notification, setNotification]               = useState<{ msg: string; type: 'danger' | 'success' | 'info' } | null>(null);
  const [autoRerouteAlert, setAutoRerouteAlert]       = useState<AutoRerouteAlert | null>(null);
  const [liveConnected, setLiveConnected]             = useState(false);

  // GPS state
  const [gpsLocation, setGpsLocation]                 = useState<{ lat: number; lng: number } | null>(null);
  const [gpsStatus, setGpsStatus]                     = useState<'DETECTING' | 'DETECTED' | 'DENIED' | 'ERROR'>('DETECTING');
  const [gpsErrorMsg, setGpsErrorMsg]                 = useState<string>('');
  const [mapCenter, setMapCenter]                     = useState<{ lat: number; lng: number } | null>(null);

  const activeRouteRef     = useRef<EvaluatedRoute | null>(null);
  const selectedDestIdRef  = useRef(selectedDestId);
  const gpsLocationRef     = useRef(gpsLocation);
  const notifTimer         = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => { activeRouteRef.current = activeRoute; }, [activeRoute]);
  useEffect(() => { selectedDestIdRef.current = selectedDestId; }, [selectedDestId]);
  useEffect(() => { gpsLocationRef.current = gpsLocation; }, [gpsLocation]);

  function showNotif(msg: string, type: 'danger' | 'success' | 'info' = 'info', ms = 5000) {
    setNotification({ msg, type });
    if (notifTimer.current) clearTimeout(notifTimer.current);
    notifTimer.current = setTimeout(() => setNotification(null), ms);
  }

  // ── 1. Fetch Real Nearby Destinations ──────────────────────────────
  const loadNearbyDestinations = useCallback(async (lat: number, lng: number) => {
    setDestLoading(true);
    try {
      const res = await fetch(`/api/destinations?lat=${lat}&lng=${lng}&radius=8000`);
      if (res.ok) {
        const data = await res.json();
        const list: NearbyDestination[] = data.destinations || [];
        setDestinations(list);
        if (list.length > 0) {
          setSelectedDestId(prev => (list.some(d => d.id === prev) ? prev : list[0].id));
        } else {
          setSelectedDestId('');
        }
      } else {
        setDestinations([]);
      }
    } catch (e) {
      console.warn('Destinations lookup error:', e);
      setDestinations([]);
    } finally {
      setDestLoading(false);
    }
  }, []);

  // ── 2. Real Browser GPS Acquisition ─────────────────────────────────
  const acquireGps = useCallback(() => {
    if (typeof window === 'undefined' || !('geolocation' in navigator)) {
      setGpsStatus('ERROR');
      setGpsErrorMsg('Geolocation is not supported by your browser.');
      return;
    }

    setGpsStatus('DETECTING');
    setGpsErrorMsg('');

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const coords = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude
        };
        setGpsLocation(coords);
        setMapCenter(coords);
        setGpsStatus('DETECTED');
        loadNearbyDestinations(coords.lat, coords.lng);
        showNotif(`✓ GPS Location Detected: ${coords.lat.toFixed(5)}, ${coords.lng.toFixed(5)}`, 'success', 4000);
      },
      (err) => {
        console.warn('GPS location error:', err);
        setGpsStatus('DENIED');
        setGpsErrorMsg(
          err.code === 1
            ? 'Location permission denied. Please allow GPS access in your browser to calculate safe routes.'
            : 'Unable to acquire GPS signal. Please click Refresh Location to try again.'
        );
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  }, [loadNearbyDestinations]);

  useEffect(() => {
    acquireGps();
  }, [acquireGps]);

  // Initial load of active incidents
  useEffect(() => {
    setIncidents(getIncidents());
  }, []);

  // ── 3. Calculate Safest Route ───────────────────────────────────────
  const handleCalculateRoute = useCallback(async () => {
    if (!gpsLocation) {
      showNotif('Location permission required to calculate a safe route.', 'danger');
      return;
    }

    const selectedDest = destinations.find(d => d.id === selectedDestId);
    if (!selectedDest) {
      showNotif('Please select a destination shelter.', 'info');
      return;
    }

    setIsCalculating(true);
    setPreviousRoute(null);
    setAutoRerouteAlert(null);
    setPhase('idle');

    try {
      const freshIncidents = getIncidents();
      setIncidents(freshIncidents);

      const rawRoutes = await fetchOSRMRoute(
        { lat: gpsLocation.lat, lng: gpsLocation.lng },
        { lat: selectedDest.latitude, lng: selectedDest.longitude }
      );

      const { primarySafeRoute, alternativeRoute } = selectSafestRoute(rawRoutes, freshIncidents);

      setActiveRoute(primarySafeRoute);
      setAlternativeRoute(alternativeRoute);
      setPhase('route_ready');

      if (primarySafeRoute.overallRisk === 'HIGH') {
        showNotif('⚠ CAUTION: Active hazards detected near route. Review safety advisory.', 'danger', 6000);
      } else {
        showNotif('✓ Safest street route calculated. Live monitoring active.', 'success', 5000);
      }
    } catch (e: any) {
      console.error('Route calculation error:', e);
      showNotif('Routing service unavailable. Please try again.', 'danger');
    } finally {
      setIsCalculating(false);
    }
  }, [gpsLocation, destinations, selectedDestId]);

  // ── 4. Dynamic Incident Rerouting Pipeline ──────────────────────────
  const handleLiveRiskUpdate = useCallback(async () => {
    const currentRoute = activeRouteRef.current;
    const currentGps = gpsLocationRef.current;
    const currentDestId = selectedDestIdRef.current;

    if (!currentRoute || !currentGps) return;

    const freshIncidents = getIncidents();
    setIncidents(freshIncidents);

    // Check if any fresh high/critical incident intersects the current active route
    const triggeringIncident = freshIncidents.find(inc => {
      if (inc.status === 'RESOLVED' || inc.status === 'REJECTED' || inc.verificationStatus === 'FALSE_REPORT') {
        return false;
      }
      return isRouteIntersectingIncident(currentRoute, inc, 350).intersects;
    });

    if (!triggeringIncident) return; // Route unaffected

    const selectedDest = destinations.find(d => d.id === currentDestId);
    if (!selectedDest) return;

    // Save old route as ghost and trigger reroute
    const oldRoute = currentRoute;
    setPreviousRoute(oldRoute);
    setActiveRoute(null);
    setPhase('recalculating');
    showNotif(`⚠ Route affected by ${triggeringIncident.hazard} incident — Recalculating safe bypass…`, 'danger', 6000);

    setTimeout(async () => {
      try {
        const rawRoutes = await fetchOSRMRoute(
          { lat: currentGps.lat, lng: currentGps.lng },
          { lat: selectedDest.latitude, lng: selectedDest.longitude }
        );
        const { primarySafeRoute, alternativeRoute } = selectSafestRoute(rawRoutes, freshIncidents);

        setActiveRoute(primarySafeRoute);
        setAlternativeRoute(alternativeRoute);
        setPhase('live_rerouted');
        setAutoRerouteAlert({ triggerIncident: triggeringIncident, oldRoute, newRoute: primarySafeRoute });
        showNotif('✓ DYNAMIC REROUTE COMPLETE — Hazard avoided on street network.', 'success', 7000);
      } catch (e) {
        setActiveRoute(oldRoute);
        setPhase('route_ready');
      }
    }, 1200);
  }, [destinations]);

  useEffect(() => {
    window.addEventListener(ROUTE_RISK_UPDATED_EVENT, handleLiveRiskUpdate);
    window.addEventListener('incidentVerified', handleLiveRiskUpdate);
    window.addEventListener('storage', handleLiveRiskUpdate);
    setLiveConnected(true);

    const interval = setInterval(() => {
      setIncidents(getIncidents());
    }, 6000);

    return () => {
      window.removeEventListener(ROUTE_RISK_UPDATED_EVENT, handleLiveRiskUpdate);
      window.removeEventListener('incidentVerified', handleLiveRiskUpdate);
      window.removeEventListener('storage', handleLiveRiskUpdate);
      clearInterval(interval);
      setLiveConnected(false);
    };
  }, [handleLiveRiskUpdate]);

  // ── 5. Isolated Simulation Mode ─────────────────────────────────────
  async function handleSimulateDisaster() {
    if (!gpsLocation) return;

    // Place simulated disaster along user's real route / near GPS
    const offsetLat = (Math.random() - 0.5) * 0.006;
    const offsetLng = (Math.random() - 0.5) * 0.006;
    const simLat = gpsLocation.lat + (activeRoute?.waypoints?.[Math.floor(activeRoute.waypoints.length / 2)]?.[0] ? (activeRoute.waypoints[Math.floor(activeRoute.waypoints.length / 2)][0] - gpsLocation.lat) * 0.5 : offsetLat);
    const simLng = gpsLocation.lng + (activeRoute?.waypoints?.[Math.floor(activeRoute.waypoints.length / 2)]?.[1] ? (activeRoute.waypoints[Math.floor(activeRoute.waypoints.length / 2)][1] - gpsLocation.lng) * 0.5 : offsetLng);

    const simIncident: Incident = {
      id: `sim_${Date.now()}`,
      hazard: 'Flash Flood & Road Submersion',
      severity: 'CRITICAL',
      latitude: simLat,
      longitude: simLng,
      confidence: 98,
      reportIds: [],
      reportCount: 1,
      sources: ['Live Sensor Simulation'],
      status: 'VERIFIED',
      verificationStatus: 'VERIFIED',
      createdAt: new Date().toISOString(),
    };

    addIncident(simIncident);
    setIncidents(getIncidents());
    showNotif('⚠ DEMO DISASTER SIMULATED: New flood blockage reported on route!', 'danger', 6000);
    handleLiveRiskUpdate();
  }

  const selectedDest = destinations.find(d => d.id === selectedDestId);
  const activeIncidentsCount = incidents.filter(i => i.status !== 'RESOLVED' && i.status !== 'REJECTED' && i.verificationStatus !== 'FALSE_REPORT').length;

  return (
    <div className="h-[calc(100vh-4rem)] flex flex-col bg-[#030305] text-zinc-100 relative overflow-hidden font-sans">
      {/* ── Toast notification ── */}
      {notification && (
        <div className={`fixed top-4 right-4 z-50 flex items-center gap-3 px-4 py-3 rounded-xl border shadow-2xl backdrop-blur-md max-w-sm text-xs font-bold transition-all ${
          notification.type === 'danger'  ? 'bg-red-950/95 border-red-500/50 text-red-200' :
          notification.type === 'success' ? 'bg-emerald-950/95 border-emerald-500/50 text-emerald-200' :
          'bg-indigo-950/95 border-indigo-500/50 text-indigo-200'
        }`}>
          <span className="flex-1 leading-snug">{notification.msg}</span>
          <button onClick={() => setNotification(null)}><X size={12} /></button>
        </div>
      )}

      {/* ── Header ── */}
      <div className="flex-shrink-0 border-b border-zinc-800/80 bg-zinc-950/90 backdrop-blur-md px-6 py-3.5 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-indigo-500/10 border border-indigo-500/30 rounded-xl">
            <NavIcon className="w-5 h-5 text-indigo-400" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-black tracking-tight text-zinc-100 leading-none">
                Safe Evacuation Routing
              </h1>
              <span className="text-[10px] font-black tracking-wider text-sky-400 bg-sky-500/10 border border-sky-500/30 px-2 py-0.5 rounded">
                OSRM · REAL STREET NETWORK
              </span>
              <span className={`text-[10px] font-black tracking-wider px-2 py-0.5 rounded flex items-center gap-1 ${
                liveConnected ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30' : 'bg-zinc-800 text-zinc-400'
              }`}>
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                LIVE HAZARD PIPELINE
              </span>
            </div>
            <p className="text-[11px] text-zinc-500 mt-1">
              Location-driven safe navigation avoiding real-time citizen disaster perimeters.
            </p>
          </div>
        </div>

        {/* Top metrics */}
        <div className="flex items-center gap-3 text-xs">
          <div className="px-3 py-1.5 bg-zinc-900 border border-zinc-800 rounded-xl flex items-center gap-2">
            <span className="text-[10px] text-zinc-500 font-bold uppercase">Active Hazards:</span>
            <span className="text-sm font-black text-red-400">{activeIncidentsCount}</span>
          </div>

          <div className="px-3 py-1.5 bg-zinc-900 border border-zinc-800 rounded-xl flex items-center gap-2">
            <span className="text-[10px] text-zinc-500 font-bold uppercase">Nearby Shelters:</span>
            <span className="text-sm font-black text-emerald-400">{destinations.length}</span>
          </div>
        </div>
      </div>

      {/* ── Main Workspace ── */}
      <div className="flex flex-1 overflow-hidden">
        {/* ── LEFT CONTROL PANEL ── */}
        <div className="w-96 flex-shrink-0 bg-zinc-950 border-r border-zinc-800/80 overflow-y-auto p-4 space-y-4 text-xs">
          {/* 1. CURRENT GPS LOCATION */}
          <div className="bg-zinc-900/90 border border-zinc-800 rounded-xl p-3.5 space-y-2.5">
            <div className="flex items-center justify-between text-[10px] font-black tracking-wider uppercase">
              <span className="flex items-center gap-1.5 text-blue-400">
                <MapPin className="w-3.5 h-3.5 text-blue-400" />
                1. CURRENT LOCATION
              </span>
              <span className={`px-2 py-0.5 rounded font-black text-[9px] flex items-center gap-1 ${
                gpsStatus === 'DETECTED' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30' :
                gpsStatus === 'DETECTING' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30 animate-pulse' :
                'bg-red-500/10 text-red-400 border border-red-500/30'
              }`}>
                {gpsStatus === 'DETECTED' ? '✓ GPS DETECTED' :
                 gpsStatus === 'DETECTING' ? 'DETECTING GPS…' :
                 '⚠ PERMISSION DENIED'}
              </span>
            </div>

            {gpsStatus === 'DETECTED' && gpsLocation ? (
              <div className="space-y-1.5 text-zinc-300 font-mono text-[11px] bg-black/40 p-2.5 rounded-lg border border-zinc-800/60">
                <div className="flex justify-between">
                  <span className="text-zinc-500 font-sans">Latitude:</span>
                  <span className="font-bold text-zinc-200">{gpsLocation.lat.toFixed(6)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-500 font-sans">Longitude:</span>
                  <span className="font-bold text-zinc-200">{gpsLocation.lng.toFixed(6)}</span>
                </div>
              </div>
            ) : gpsStatus === 'DENIED' || gpsStatus === 'ERROR' ? (
              <div className="p-3 bg-red-950/40 border border-red-500/30 rounded-lg text-red-300 text-[11px] leading-relaxed">
                <p className="font-bold mb-1">Location permission required to calculate a safe route.</p>
                <p className="text-[10px] text-zinc-400">{gpsErrorMsg}</p>
              </div>
            ) : (
              <div className="p-3 bg-zinc-800/40 rounded-lg text-zinc-400 text-[11px] flex items-center gap-2">
                <RefreshCw className="w-3.5 h-3.5 animate-spin text-amber-400" />
                <span>Detecting your current location...</span>
              </div>
            )}

            <button
              onClick={acquireGps}
              className="w-full flex items-center justify-center gap-2 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-bold rounded-xl border border-zinc-700 transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5 text-sky-400" />
              [ REFRESH LOCATION ]
            </button>
          </div>

          {/* 2. DESTINATION SELECTION */}
          <div className="bg-zinc-900/90 border border-zinc-800 rounded-xl p-3.5 space-y-2.5">
            <div className="flex items-center justify-between text-[10px] font-black tracking-wider uppercase text-emerald-400">
              <span className="flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                2. EVACUATION DESTINATION
              </span>
              <span className="text-zinc-500 text-[9px]">{destinations.length} found nearby</span>
            </div>

            {destLoading ? (
              <div className="p-3 text-center text-zinc-500 text-xs flex items-center justify-center gap-2">
                <RefreshCw className="w-3.5 h-3.5 animate-spin text-emerald-400" />
                <span>Querying nearby real facilities…</span>
              </div>
            ) : destinations.length === 0 ? (
              <div className="p-3 bg-amber-950/30 border border-amber-500/30 rounded-lg text-amber-300 text-[11px]">
                No verified evacuation destinations found nearby within 10 km.
              </div>
            ) : (
              <div className="space-y-2">
                <select
                  value={selectedDestId}
                  onChange={e => setSelectedDestId(e.target.value)}
                  className="w-full p-2.5 bg-zinc-950 border border-zinc-700 rounded-xl text-zinc-200 text-xs font-bold focus:border-indigo-500 outline-none"
                >
                  {destinations.map(d => (
                    <option key={d.id} value={d.id}>
                      {d.name} ({d.distanceKm} km · {d.status})
                    </option>
                  ))}
                </select>

                {selectedDest && (
                  <div className="p-2.5 bg-black/40 border border-zinc-800/80 rounded-lg space-y-1.5 text-[11px] text-zinc-300">
                    <div className="flex justify-between items-center">
                      <span className="text-zinc-500">Distance from GPS:</span>
                      <span className="font-bold text-sky-400">{selectedDest.distanceKm} km</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-zinc-500">Capacity / Status:</span>
                      <span className="font-bold text-emerald-400">{selectedDest.capacity} beds · {selectedDest.status}</span>
                    </div>
                    {selectedDest.address && (
                      <div className="text-[10px] text-zinc-500 truncate pt-1 border-t border-zinc-800/60">
                        {selectedDest.address}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            <button
              onClick={handleCalculateRoute}
              disabled={!gpsLocation || !selectedDestId || isCalculating}
              className="w-full flex items-center justify-center gap-2 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-black rounded-xl border border-indigo-500 shadow-lg shadow-indigo-600/30 transition-all"
            >
              {isCalculating ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Calculating Real Route…
                </>
              ) : (
                <>
                  <Compass className="w-3.5 h-3.5" /> Find Safest Route →
                </>
              )}
            </button>
          </div>

          {/* 3. ROUTE SAFETY & ADVISORY */}
          {activeRoute && (
            <div className={`border rounded-xl p-3.5 space-y-2.5 ${
              activeRoute.overallRisk === 'HIGH' ? 'bg-red-950/20 border-red-500/40' :
              activeRoute.overallRisk === 'MEDIUM' ? 'bg-amber-950/20 border-amber-500/30' :
              'bg-emerald-950/20 border-emerald-500/30'
            }`}>
              <div className="flex items-center justify-between text-[10px] font-black tracking-wider uppercase">
                <span className={
                  activeRoute.overallRisk === 'HIGH' ? 'text-red-400' :
                  activeRoute.overallRisk === 'MEDIUM' ? 'text-amber-400' :
                  'text-emerald-400'
                }>
                  3. ROUTE SAFETY STATUS
                </span>
                <span className={`px-2 py-0.5 rounded font-black border ${RISK_BADGE[activeRoute.overallRisk]}`}>
                  {activeRoute.overallRisk} RISK
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="p-2 bg-black/40 rounded-lg border border-zinc-800/80">
                  <div className="text-[9px] text-zinc-500 uppercase font-bold flex items-center gap-1">
                    <Ruler className="w-3 h-3" /> Road Distance
                  </div>
                  <div className="text-sm font-black text-zinc-100 mt-0.5">{activeRoute.totalDistanceKm} km</div>
                </div>

                <div className="p-2 bg-black/40 rounded-lg border border-zinc-800/80">
                  <div className="text-[9px] text-zinc-500 uppercase font-bold flex items-center gap-1">
                    <Clock className="w-3 h-3" /> Estimated Time
                  </div>
                  <div className="text-sm font-black text-zinc-100 mt-0.5">{activeRoute.totalTimeMinutes} mins</div>
                </div>
              </div>

              <div className="p-2.5 bg-black/30 rounded-lg text-[11px] space-y-1">
                <p className="font-bold text-zinc-300">{activeRoute.recommendationReason}</p>
                {activeRoute.intersectingHazards.length > 0 && (
                  <div className="mt-1 space-y-1 pt-1 border-t border-red-500/20 text-[10px] text-red-300">
                    {activeRoute.intersectingHazards.map((h, i) => (
                      <div key={i} className="flex items-center gap-1.5">
                        <AlertTriangle className="w-3 h-3 text-red-400 flex-shrink-0" />
                        <span>{h.hazard} ({h.severity}) within {h.distanceM}m</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {alternativeRoute && (
                <div className="p-2 bg-sky-950/40 border border-sky-500/30 rounded-lg text-[10px] text-sky-300 space-y-1">
                  <div className="font-black text-sky-400 flex items-center justify-between">
                    <span>✨ SAFER BYPASS AVAILABLE</span>
                    <span>{alternativeRoute.totalDistanceKm} km</span>
                  </div>
                  <p>Alternative corridor avoids active incident perimeter.</p>
                </div>
              )}
            </div>
          )}

          {/* 4. MAP VALIDATION & DEBUG PANEL */}
          <div className="p-3 bg-zinc-900/60 border border-zinc-800/80 rounded-xl space-y-1 text-[10px] text-zinc-400">
            <div className="font-black text-zinc-300 text-[10px] uppercase tracking-wider mb-1 flex items-center justify-between">
              <span>LOCATION VALIDATION</span>
              <span className="text-emerald-400">AUTHENTIC GPS</span>
            </div>
            <div className="flex justify-between font-mono">
              <span>CURRENT GPS:</span>
              <span className="text-zinc-200">{gpsLocation ? `${gpsLocation.lat.toFixed(6)}, ${gpsLocation.lng.toFixed(6)}` : 'Awaiting Permission'}</span>
            </div>
            <div className="flex justify-between font-mono">
              <span>MAP CENTER:</span>
              <span className="text-zinc-200">{mapCenter ? `${mapCenter.lat.toFixed(6)}, ${mapCenter.lng.toFixed(6)}` : 'Centered on GPS'}</span>
            </div>
            <div className="flex justify-between pt-1 border-t border-zinc-800/60">
              <span>GPS STATUS:</span>
              <span className={gpsStatus === 'DETECTED' ? 'text-emerald-400 font-bold' : 'text-red-400 font-bold'}>
                {gpsStatus === 'DETECTED' ? '✓ GPS DETECTED' : '⚠ ' + gpsStatus}
              </span>
            </div>
          </div>

          {/* 5. ISOLATED SIMULATION CONTROLS */}
          <div className="pt-2 border-t border-zinc-800/80 space-y-2">
            <button
              onClick={handleSimulateDisaster}
              disabled={!gpsLocation}
              className="w-full flex items-center justify-center gap-2 py-2 bg-red-600/20 hover:bg-red-600/30 border border-red-500/40 text-red-300 text-xs font-bold rounded-xl transition-colors"
            >
              <Siren className="w-3.5 h-3.5 text-red-400" />
              SIMULATE DISASTER NEAR GPS (TEST REROUTING)
            </button>

            <Link
              href="/forecast"
              className="w-full flex items-center justify-center gap-2 py-2 bg-purple-600/20 hover:bg-purple-600/30 border border-purple-500/40 text-purple-300 text-xs font-bold rounded-xl transition-colors"
            >
              <Zap className="w-3.5 h-3.5 text-purple-400" />
              VIEW IN DISASTER TIME MACHINE (+15m/+30m/+60m)
            </Link>
          </div>
        </div>

        {/* ── RIGHT MAP CANVAS ── */}
        <div className="flex-1 relative">
          <RouteMapComponent
            userLocation={gpsLocation}
            destinations={destinations}
            selectedDestinationId={selectedDestId}
            activeRoute={activeRoute}
            alternativeRoute={alternativeRoute}
            previousRoute={previousRoute}
            incidents={incidents}
            onSelectDestination={(d) => setSelectedDestId(d.id)}
          />

          {/* Floating dynamic reroute alert banner */}
          {autoRerouteAlert && (
            <div className="absolute top-4 left-1/2 -translate-x-1/2 z-40 bg-red-950/95 border border-red-500 px-5 py-3 rounded-2xl shadow-2xl backdrop-blur-md flex items-center gap-4 text-xs font-bold text-red-200 animate-bounce">
              <Siren className="w-5 h-5 text-red-400 animate-pulse" />
              <div>
                <div className="font-black text-white">⚠ DYNAMIC REROUTE ENGAGED</div>
                <div className="text-[11px] text-red-300">
                  New {autoRerouteAlert.triggerIncident.hazard} report detected on path. Rerouted via safe street network.
                </div>
              </div>
              <button
                onClick={() => setAutoRerouteAlert(null)}
                className="p-1 hover:bg-red-800/40 rounded"
              >
                <X size={14} />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
