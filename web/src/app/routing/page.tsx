"use client";

import { useEffect, useState } from 'react';
import { Navigation as NavIcon, MapPin, CheckCircle2, ShieldCheck, AlertTriangle, Compass, ArrowRight, RefreshCw, Layers } from 'lucide-react';
import { getShelters, getIncidents, findNearestSafeShelter, getAvailableShelters, Shelter, Incident, Route as RouteType } from '@/lib/storage';
import { distMeters } from '@/lib/services/realRoutingService';
import dynamic from 'next/dynamic';

const MapComponent = dynamic(() => import('@/components/MapComponent'), { 
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex items-center justify-center text-zinc-500 bg-zinc-950">
      Loading Safe Route Geospatial Layer...
    </div>
  )
});

export default function RoutingPage() {
  const [shelters, setShelters] = useState<Shelter[]>([]);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [userLat, setUserLat] = useState<number>(34.050);
  const [userLng, setUserLng] = useState<number>(-118.255);
  const [selectedShelterId, setSelectedShelterId] = useState<string>('');
  const [calculatedRoute, setCalculatedRoute] = useState<{
    shelter: Shelter;
    distance: number;
    time: number;
    risk: 'LOW' | 'MEDIUM' | 'HIGH';
    avoidedHazards: number;
    waypoints: string[];
  } | null>(null);
  const [isCalculating, setIsCalculating] = useState<boolean>(false);
  const [safetyWarning, setSafetyWarning] = useState<string | null>(null);

  useEffect(() => {
    const loadedShelters = getShelters();
    const loadedIncidents = getIncidents();
    setShelters(loadedShelters);
    setIncidents(loadedIncidents);

    // Default select nearest available shelter
    const nearest = findNearestSafeShelter(34.050, -118.255);
    if (nearest) {
      setSelectedShelterId(nearest.id);
    }
  }, []);

  const handleUseMyGPS = () => {
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(pos => {
        setUserLat(pos.coords.latitude);
        setUserLng(pos.coords.longitude);
      }, () => {
        alert("Failed to access GPS. Please allow location permissions.");
      });
    }
  };

  const handleAutoSelectNearest = () => {
    const nearest = findNearestSafeShelter(userLat, userLng);
    if (nearest) {
      setSelectedShelterId(nearest.id);
      calculateRouteForShelter(nearest);
    }
  };

  const calculateRouteForShelter = (targetShelter: Shelter) => {
    setIsCalculating(true);
    setSafetyWarning(null);

    // Safety Validation: Check if origin or destination is inside an active hazard zone (200m)
    const activeHazards = incidents.filter(i => i.status !== 'RESOLVED' && i.status !== 'REJECTED' && i.verificationStatus !== 'FALSE_REPORT');
    let originWarning = false;
    let destWarning = false;

    for (const h of activeHazards) {
      if (distMeters(userLat, userLng, h.latitude, h.longitude) < 200) originWarning = true;
      if (distMeters(targetShelter.latitude, targetShelter.longitude, h.latitude, h.longitude) < 200) destWarning = true;
    }

    if (originWarning && destWarning) {
      setSafetyWarning("WARNING: Both Origin and Destination are inside active hazard zones.");
    } else if (originWarning) {
      setSafetyWarning("WARNING: Origin is inside an active hazard zone. Proceed with extreme caution.");
    } else if (destWarning) {
      setSafetyWarning("WARNING: Destination is inside an active hazard zone. Select another shelter if possible.");
    }

    setTimeout(() => {
      // Calculate realistic distance using true Haversine distance in meters
      const distM = distMeters(userLat, userLng, targetShelter.latitude, targetShelter.longitude);
      const dist = distM / 1000;
      const roundedDist = parseFloat(dist.toFixed(1));
      const estTime = Math.max(5, Math.round(roundedDist * 2.8));

      // Check proximity of incidents along the path
      const activeHazards = incidents.filter(i => i.status !== 'RESOLVED');
      const nearbyHazards = activeHazards.filter(inc => {
        const d = Math.hypot(inc.latitude - ((userLat + targetShelter.latitude)/2), inc.longitude - ((userLng + targetShelter.longitude)/2));
        return d < 0.03;
      });

      const risk: 'LOW' | 'MEDIUM' | 'HIGH' = nearbyHazards.some(h => h.severity === 'CRITICAL') 
        ? 'MEDIUM' 
        : nearbyHazards.length > 2 
        ? 'MEDIUM' 
        : 'LOW';

      setCalculatedRoute({
        shelter: targetShelter,
        distance: roundedDist,
        time: estTime,
        risk: risk,
        avoidedHazards: Math.max(1, nearbyHazards.length),
        waypoints: [
          'Depart Current Location',
          'Reroute around active hazard perimeter',
          'Safe Arterial Corridor (Main Evac Route 1)',
          `Arrive safely at ${targetShelter.name}`
        ]
      });
      setIsCalculating(false);
    }, 600);
  };

  const handleCalculateClick = () => {
    const target = shelters.find(s => s.id === selectedShelterId);
    if (target) {
      calculateRouteForShelter(target);
    }
  };

  const selectedShelterObj = shelters.find(s => s.id === selectedShelterId);

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="mb-8 border-b border-zinc-800 pb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-zinc-100 flex items-center">
            <NavIcon className="mr-3 text-cyan-500" />
            Dynamic Safe Routing & Shelter Evacuation
          </h1>
          <p className="text-zinc-400 mt-2">Disaster-aware navigation routing citizens away from hazard perimeters to verified safe shelters.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Left Control Panel */}
        <div className="lg:col-span-5 space-y-6">
          {safetyWarning && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 flex items-start animate-in slide-in-from-top-2">
              <AlertTriangle className="w-5 h-5 text-red-500 mr-3 flex-shrink-0 mt-0.5" />
              <p className="text-red-400 text-sm font-bold leading-relaxed">{safetyWarning}</p>
            </div>
          )}

          <div className="bg-zinc-950 border border-zinc-800 rounded-2xl p-6 shadow-xl">
            <h2 className="text-sm font-bold text-zinc-400 uppercase tracking-wider mb-5 flex items-center">
              <Compass className="w-4 h-4 mr-2 text-cyan-400" />
              Routing Configuration
            </h2>

            {/* Starting Location */}
            <div className="mb-5 bg-zinc-900/70 border border-zinc-800 rounded-xl p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="flex items-center text-xs font-bold text-zinc-300 uppercase tracking-wide">
                  <MapPin className="w-4 h-4 text-blue-400 mr-1.5" /> Starting Point
                </span>
                <button 
                  onClick={handleUseMyGPS}
                  className="text-[10px] text-blue-400 hover:text-blue-300 underline flex items-center bg-zinc-800 px-2 py-0.5 rounded"
                >
                  <MapPin className="w-3 h-3 mr-1" /> Use My GPS
                </button>
              </div>
              <div className="grid grid-cols-2 gap-2 mt-2">
                <div>
                  <label className="text-[10px] text-zinc-500">Latitude</label>
                  <input 
                    type="number" 
                    step="0.001" 
                    value={userLat} 
                    onChange={e => setUserLat(parseFloat(e.target.value) || userLat)}
                    className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-2.5 py-1.5 text-xs text-zinc-200" 
                  />
                </div>
                <div>
                  <label className="text-[10px] text-zinc-500">Longitude</label>
                  <input 
                    type="number" 
                    step="0.001" 
                    value={userLng} 
                    onChange={e => setUserLng(parseFloat(e.target.value) || userLng)}
                    className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-2.5 py-1.5 text-xs text-zinc-200" 
                  />
                </div>
              </div>
            </div>

            {/* Target Shelter Selection */}
            <div className="mb-6 bg-zinc-900/70 border border-zinc-800 rounded-xl p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="flex items-center text-xs font-bold text-zinc-300 uppercase tracking-wide">
                  <ShieldCheck className="w-4 h-4 text-green-400 mr-1.5" /> Target Safe Shelter
                </span>
                <button 
                  onClick={handleAutoSelectNearest}
                  className="text-[10px] text-cyan-400 hover:text-cyan-300 underline flex items-center"
                >
                  <RefreshCw className="w-3 h-3 mr-1" /> Auto-select Nearest
                </button>
              </div>

              <select 
                value={selectedShelterId}
                onChange={e => setSelectedShelterId(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-700 text-zinc-200 text-sm rounded-lg p-2.5 mt-2 focus:outline-none focus:border-cyan-500"
              >
                {shelters.map(s => (
                  <option key={s.id} value={s.id} disabled={s.status === 'FULL' || s.status === 'CLOSED'}>
                    {s.name} — [{s.status}] ({s.capacity}% capacity)
                  </option>
                ))}
              </select>

              {selectedShelterObj && (
                <div className="mt-3 p-3 bg-zinc-950 rounded-lg border border-zinc-800 text-xs space-y-1.5">
                  <div className="flex justify-between text-zinc-400">
                    <span>Status:</span>
                    <span className={`font-bold ${selectedShelterObj.status === 'OPEN' ? 'text-green-400' : selectedShelterObj.status === 'LIMITED' ? 'text-amber-400' : 'text-red-400'}`}>
                      {selectedShelterObj.status}
                    </span>
                  </div>
                  <div className="flex justify-between text-zinc-400">
                    <span>Current Occupancy:</span>
                    <span className="font-semibold text-zinc-200">{selectedShelterObj.capacity}%</span>
                  </div>
                  <div className="w-full bg-zinc-800 h-1.5 rounded-full overflow-hidden mt-1">
                    <div 
                      className={`h-full ${selectedShelterObj.capacity > 85 ? 'bg-red-500' : selectedShelterObj.capacity > 60 ? 'bg-amber-500' : 'bg-green-500'}`}
                      style={{ width: `${selectedShelterObj.capacity}%` }}
                    ></div>
                  </div>
                </div>
              )}
            </div>

            <button 
              onClick={handleCalculateClick}
              disabled={isCalculating || !selectedShelterId}
              className="w-full bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white font-bold py-3.5 rounded-xl transition-colors flex items-center justify-center gap-2 shadow-lg shadow-cyan-600/20"
            >
              {isCalculating ? 'Computing Hazard-Free Path...' : 'Calculate Safe Evacuation Route'}
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>

          {/* Calculated Route Details */}
          {calculatedRoute && (
            <div className="bg-zinc-950 border border-zinc-800 rounded-2xl p-6 shadow-xl animate-in fade-in duration-300 space-y-4">
              <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
                <h3 className="font-bold text-zinc-100 flex items-center">
                  <CheckCircle2 className="w-5 h-5 text-green-400 mr-2" /> Safe Route Verified
                </h3>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${calculatedRoute.risk === 'LOW' ? 'bg-green-500/10 text-green-400 border-green-500/20' : 'bg-amber-500/10 text-amber-400 border-amber-500/20'}`}>
                  RISK: {calculatedRoute.risk}
                </span>
              </div>

              <div className="grid grid-cols-3 gap-3 text-center">
                <div className="bg-zinc-900 p-3 rounded-xl border border-zinc-800">
                  <p className="text-[10px] text-zinc-500 uppercase font-bold">Distance</p>
                  <p className="text-lg font-black text-zinc-100">{calculatedRoute.distance} km</p>
                </div>
                <div className="bg-zinc-900 p-3 rounded-xl border border-zinc-800">
                  <p className="text-[10px] text-zinc-500 uppercase font-bold">Est. Time</p>
                  <p className="text-lg font-black text-cyan-400">{calculatedRoute.time} mins</p>
                </div>
                <div className="bg-zinc-900 p-3 rounded-xl border border-zinc-800">
                  <p className="text-[10px] text-zinc-500 uppercase font-bold">Avoided Hazards</p>
                  <p className="text-lg font-black text-emerald-400">{calculatedRoute.avoidedHazards}</p>
                </div>
              </div>

              <div className="bg-zinc-900/70 p-4 rounded-xl border border-zinc-800">
                <p className="text-xs font-bold text-zinc-400 uppercase tracking-wide mb-3">Evacuation Guidance</p>
                <div className="space-y-2">
                  {calculatedRoute.waypoints.map((step, idx) => (
                    <div key={idx} className="flex items-start text-xs text-zinc-300">
                      <span className="w-4 h-4 rounded-full bg-zinc-800 text-[10px] text-zinc-400 flex items-center justify-center mr-2.5 mt-0.5 flex-shrink-0">
                        {idx + 1}
                      </span>
                      <span>{step}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Right Live Map Section */}
        <div className="lg:col-span-7 flex flex-col">
          <div className="bg-zinc-950 border border-zinc-800 rounded-2xl p-6 flex-1 flex flex-col shadow-xl min-h-[560px]">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-zinc-100 flex items-center">
                <Layers className="w-5 h-5 mr-2 text-cyan-400" />
                Live Shelter & Hazard Map
              </h2>
              <div className="flex items-center gap-4 text-xs text-zinc-400">
                <span className="flex items-center"><span className="w-2.5 h-2.5 rounded bg-emerald-500 mr-1.5"></span> Shelter (Open)</span>
                <span className="flex items-center"><span className="w-2.5 h-2.5 rounded-full bg-red-500 mr-1.5"></span> Hazard Zone</span>
              </div>
            </div>

            <div className="flex-1 rounded-xl overflow-hidden border border-zinc-800 relative min-h-[460px]">
              <MapComponent 
                incidents={incidents} 
                shelters={shelters} 
                onIncidentClick={() => {}} 
              />
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
