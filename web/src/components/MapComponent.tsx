import { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { Incident, Shelter, VerificationStatus } from '@/lib/storage';

const getVerificationColor = (incident: Incident): { color: string; emoji: string; label: string } => {
  const vs: VerificationStatus = incident.verificationStatus ?? (incident.status === 'VERIFIED' ? 'VERIFIED' : 'UNVERIFIED');

  switch (vs) {
    case 'VERIFIED':
    case 'PARTIALLY_VERIFIED':
      return { color: '#22c55e', emoji: '🟢', label: 'VERIFIED' }; // green
    case 'VERIFICATION_IN_PROGRESS':
      return { color: '#3b82f6', emoji: '🔵', label: 'VERIFICATION IN PROGRESS' }; // blue
    case 'FIELD_VERIFICATION_REQUIRED':
      return { color: '#ef4444', emoji: '🔴', label: 'FIELD VERIFICATION REQUIRED' }; // red
    case 'FALSE_REPORT':
      return { color: '#3f3f46', emoji: '⚫', label: 'FALSE REPORT' }; // dark zinc
    case 'UNVERIFIED':
    default:
      if (incident.verificationRequired || incident.isBlurry) {
        return { color: '#ef4444', emoji: '🔴', label: 'FIELD VERIFICATION REQUIRED' };
      }
      return { color: '#f97316', emoji: '🟠', label: 'UNVERIFIED' }; // orange
  }
};

const createIncidentIcon = (incident: Incident) => {
  const { color } = getVerificationColor(incident);
  const isVerified = incident.verificationStatus === 'VERIFIED' || incident.status === 'VERIFIED';
  const isFieldReq = incident.verificationStatus === 'FIELD_VERIFICATION_REQUIRED' || incident.isBlurry;
  const isFalseReport = incident.verificationStatus === 'FALSE_REPORT' || incident.status === 'REJECTED';

  return L.divIcon({
    html: `
      <div style="
        background-color: ${color};
        width: 26px;
        height: 26px;
        border-radius: 50%;
        border: 3px solid ${isVerified ? '#ffffff' : isFieldReq ? '#fecaca' : '#18181b'};
        box-shadow: 0 0 16px ${color};
        display: flex;
        align-items: center;
        justify-content: center;
        color: white;
        font-size: 11px;
        font-weight: bold;
        cursor: pointer;
      ">
        ${isVerified ? '✓' : isFieldReq ? '!' : isFalseReport ? '✕' : '•'}
      </div>
    `,
    className: 'custom-leaflet-icon',
    iconSize: [26, 26],
    iconAnchor: [13, 13],
  });
};

const createShelterIcon = (shelter: Shelter) => {
  let color = '#10b981'; // green for OPEN
  if (shelter.status === 'LIMITED') color = '#f59e0b'; // amber
  else if (shelter.status === 'FULL') color = '#ef4444'; // red
  else if (shelter.status === 'CLOSED') color = '#6b7280'; // gray

  return L.divIcon({
    html: `
      <div style="
        background-color: ${color};
        width: 24px;
        height: 24px;
        border-radius: 6px;
        border: 2px solid #ffffff;
        box-shadow: 0 0 12px ${color};
        display: flex;
        align-items: center;
        justify-content: center;
        color: white;
        font-size: 14px;
        font-weight: bold;
      ">
        ⌂
      </div>
    `,
    className: 'custom-leaflet-icon',
    iconSize: [24, 24],
    iconAnchor: [12, 12],
  });
};

function ChangeMapView({ center, zoom }: { center: [number, number]; zoom: number }) {
  const map = useMap();
  useEffect(() => {
    if (
      center && 
      typeof center[0] === 'number' && 
      !isNaN(center[0]) && 
      typeof center[1] === 'number' && 
      !isNaN(center[1])
    ) {
      try {
        map.setView(center, zoom, { animate: false });
        // Invalidate size after short delay to ensure container is laid out
        const timer = setTimeout(() => {
          map.invalidateSize();
        }, 100);
        return () => clearTimeout(timer);
      } catch (e) {
        console.warn('Map view update ignored:', e);
      }
    }
  }, [center?.[0], center?.[1], zoom, map]);
  return null;
}

export default function MapComponent({ 
  incidents, 
  shelters = [], 
  onIncidentClick,
  center = [34.05, -118.24],
  zoom = 13,
  autoOpenLatest = false
}: { 
  incidents: Incident[], 
  shelters?: Shelter[],
  onIncidentClick?: (inc: Incident) => void,
  center?: [number, number],
  zoom?: number,
  autoOpenLatest?: boolean
}) {
  return (
    <MapContainer 
      center={center} 
      zoom={zoom} 
      style={{ height: '100%', width: '100%', background: '#09090b' }}
      zoomControl={true}
    >
      <ChangeMapView center={center} zoom={zoom} />
      
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        className="map-tiles"
      />
      <style dangerouslySetInnerHTML={{__html: `
        .map-tiles {
          filter: invert(100%) hue-rotate(180deg) brightness(95%) contrast(90%);
        }
        .leaflet-popup-content-wrapper {
          background: #18181b !important;
          color: #f4f4f5 !important;
          border: 1px solid #3f3f46 !important;
          border-radius: 12px !important;
          box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.7) !important;
        }
        .leaflet-popup-tip {
          background: #18181b !important;
        }
      `}} />
      
      {shelters.filter(s => typeof s.latitude === 'number' && !isNaN(s.latitude) && typeof s.longitude === 'number' && !isNaN(s.longitude)).map(s => (
        <Marker 
          key={s.id} 
          position={[s.latitude, s.longitude]} 
          icon={createShelterIcon(s)}
        >
          <Popup>
            <div className="text-zinc-200 font-sans p-1 min-w-[180px]">
              <div className="flex items-center justify-between gap-2 mb-1.5">
                <strong className="block text-sm font-bold text-white">{s.name}</strong>
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                  s.status === 'OPEN' ? 'bg-emerald-500/20 text-emerald-400' :
                  s.status === 'LIMITED' ? 'bg-amber-500/20 text-amber-400' : 'bg-red-500/20 text-red-400'
                }`}>
                  {s.status}
                </span>
              </div>
              <div className="text-xs text-zinc-400 mb-1 flex justify-between">
                <span>Occupancy</span>
                <span className="font-semibold text-zinc-200">{s.capacity}%</span>
              </div>
              <div style={{ width: '100%', height: '6px', backgroundColor: '#27272a', borderRadius: '9999px', overflow: 'hidden' }}>
                <div style={{
                  width: `${Math.min(100, s.capacity)}%`,
                  height: '100%',
                  backgroundColor: s.capacity > 85 ? '#ef4444' : s.capacity > 60 ? '#f59e0b' : '#10b981',
                  borderRadius: '9999px'
                }}></div>
              </div>
              <div className="text-[10px] text-zinc-500 mt-1.5 font-mono">
                Lat: {s.latitude.toFixed(4)}, Lng: {s.longitude.toFixed(4)}
              </div>
            </div>
          </Popup>
        </Marker>
      ))}

      {incidents.filter(inc => typeof inc.latitude === 'number' && !isNaN(inc.latitude) && typeof inc.longitude === 'number' && !isNaN(inc.longitude)).map((inc, index) => {
        const { emoji, label, color } = getVerificationColor(inc);
        const timeStr = new Date(inc.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const isLatest = index === 0;

        return (
          <Marker 
            key={inc.id} 
            position={[inc.latitude, inc.longitude]} 
            icon={createIncidentIcon(inc)}
            eventHandlers={{
              click: () => onIncidentClick && onIncidentClick(inc)
            }}
          >
            <Popup autoPan={true}>
              <div className="text-zinc-200 font-sans p-1 min-w-[210px] space-y-2">
                <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
                  <div className="flex items-center gap-1.5 font-bold text-sm text-white">
                    <span>🚨</span>
                    <span>{inc.hazard}</span>
                  </div>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${
                    inc.severity === 'CRITICAL' ? 'border-red-500/40 text-red-400 bg-red-500/10' :
                    inc.severity === 'HIGH' ? 'border-amber-500/40 text-amber-400 bg-amber-500/10' :
                    inc.severity === 'MEDIUM' ? 'border-yellow-500/40 text-yellow-400 bg-yellow-500/10' :
                    'border-emerald-500/40 text-emerald-400 bg-emerald-500/10'
                  }`}>
                    {inc.severity}
                  </span>
                </div>

                <div className="space-y-1 text-xs">
                  <div className="flex justify-between">
                    <span className="text-zinc-400">AI Confidence:</span>
                    <strong className="text-emerald-400 font-mono">{inc.confidence}%</strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-400">Source:</span>
                    <span className="text-zinc-200 font-medium">
                      {inc.sources?.includes('Photo') ? 'Citizen Photo' : (inc.sources?.[0] || 'Citizen Report')}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-400">Image Quality:</span>
                    <span className={`font-semibold ${inc.isBlurry ? 'text-amber-400' : 'text-emerald-400'}`}>
                      {inc.isBlurry ? '⚠ BLURRY' : '✓ CLEAR'}
                    </span>
                  </div>
                  <div className="flex justify-between items-center pt-1 border-t border-zinc-800/80">
                    <span className="text-zinc-400">Status:</span>
                    <span className="font-bold text-[11px]" style={{ color }}>
                      {emoji} {label}
                    </span>
                  </div>
                  <div className="flex justify-between text-[10px] text-zinc-500 pt-0.5">
                    <span>Time: {timeStr}</span>
                    <span className="font-mono">{inc.latitude.toFixed(3)}, {inc.longitude.toFixed(3)}</span>
                  </div>
                </div>

                {inc.imageUrl && inc.imageUrl !== '/placeholder-disaster.jpg' && (
                  <div className="mt-2 rounded-lg overflow-hidden border border-zinc-800 max-h-24">
                    <img src={inc.imageUrl} alt="Incident" className="w-full h-24 object-cover" />
                  </div>
                )}
              </div>
            </Popup>
          </Marker>
        );
      })}
    </MapContainer>
  );
}
