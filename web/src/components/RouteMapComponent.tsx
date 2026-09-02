import { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, CircleMarker, useMap, Circle } from 'react-leaflet';
import MarkerClusterGroup from 'react-leaflet-cluster';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { EvaluatedRoute } from '@/lib/services/realRoutingService';
import { NearbyDestination } from '@/app/api/destinations/route';
import { Incident, VerificationStatus } from '@/lib/storage';

const RISK_COLORS: Record<string, string> = {
  LOW:     '#10b981', // Emerald
  MEDIUM:  '#f59e0b', // Amber
  HIGH:    '#ef4444', // Red
};

function makeUserGpsIcon() {
  return L.divIcon({
    html: `
      <div style="position:relative;width:44px;height:44px;display:flex;align-items:center;justify-content:center;">
        <div style="
          position:absolute;inset:0;border-radius:50%;
          background:#3b82f6;opacity:0.35;
          animation:pulse-ring 1.5s ease-out infinite;
        "></div>
        <div style="
          position:absolute;inset:6px;border-radius:50%;
          background:#2563eb;border:2.5px solid #ffffff;
          box-shadow:0 0 16px rgba(59,130,246,0.9);
          display:flex;align-items:center;justify-content:center;
          font-size:16px;color:#ffffff;
        ">📍</div>
      </div>
      <style>
        @keyframes pulse-ring {
          0%   { transform: scale(0.7); opacity: 0.6; }
          80%  { transform: scale(2.2); opacity: 0; }
          100% { transform: scale(2.2); opacity: 0; }
        }
      </style>
    `,
    className: 'custom-gps-leaflet-icon',
    iconSize: [44, 44],
    iconAnchor: [22, 22],
  });
}

function makeShelterIcon(shelter: NearbyDestination, isSelected = false) {
  let bg = '#10b981';
  if (shelter.status === 'LIMITED') bg = '#f59e0b';
  if (shelter.status === 'FULL') bg = '#ef4444';

  const size = isSelected ? 34 : 26;

  return L.divIcon({
    html: `
      <div style="
        background:${bg};
        width:${size}px;
        height:${size}px;
        border-radius:8px;
        border:${isSelected ? '3px solid #38bdf8' : '2px solid #ffffff'};
        box-shadow:${isSelected ? '0 0 20px #38bdf8' : `0 0 10px ${bg}`};
        display:flex;
        align-items:center;
        justify-content:center;
        color:#ffffff;
        font-size:${isSelected ? 16 : 13}px;
        font-weight:bold;
        transition:all 0.2s;
      ">
        ⌂
      </div>
    `,
    className: 'custom-shelter-leaflet-icon',
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}

function makeIncidentIcon(incident: Incident) {
  let color = '#f97316';
  if (incident.severity === 'CRITICAL') color = '#ef4444';
  else if (incident.severity === 'HIGH') color = '#ea580c';
  else if (incident.severity === 'LOW') color = '#eab308';

  const isUncertain = incident.hazard === 'UNCERTAIN' || incident.hazard === 'uncertain';
  if (isUncertain) color = '#52525b';

  const isVerified = incident.verificationStatus === 'VERIFIED' || incident.status === 'VERIFIED';
  const borderStyle = isUncertain ? '2px dashed #a1a1aa' : `2px solid ${isVerified ? '#22c55e' : '#ffffff'}`;
  
  const isStale = incident.status === 'STALE';
  const opacity = isStale ? 0.4 : 1;

  return L.divIcon({
    html: `
      <div style="
        opacity: ${opacity};
        background:${color};
        width:26px;
        height:26px;
        border-radius:50%;
        border:${borderStyle};
        box-shadow:0 0 14px ${color};
        display:flex;
        align-items:center;
        justify-content:center;
        color:#ffffff;
        font-size:12px;
        font-weight:bold;
        filter: ${isStale ? 'grayscale(100%)' : 'none'};
      ">
        ${isStale ? 'S' : '⚠'}
      </div>
    `,
    className: 'custom-incident-leaflet-icon',
    iconSize: [26, 26],
    iconAnchor: [13, 13],
  });
}

function ChangeMapView({
  center,
  zoom,
  routeWaypoints,
}: {
  center: [number, number];
  zoom: number;
  routeWaypoints?: [number, number][];
}) {
  const map = useMap();

  useEffect(() => {
    if (!center || isNaN(center[0]) || isNaN(center[1])) return;

    if (routeWaypoints && routeWaypoints.length > 1) {
      try {
        const bounds = L.latLngBounds(routeWaypoints.map(([lat, lng]) => [lat, lng]));
        map.fitBounds(bounds, { padding: [50, 50], maxZoom: 16, animate: true });
        return;
      } catch (e) {
        console.warn('Could not fit bounds to route:', e);
      }
    }

    try {
      map.setView(center, zoom, { animate: true });
      const timer = setTimeout(() => map.invalidateSize(), 100);
      return () => clearTimeout(timer);
    } catch (e) {
      console.warn('Map view update ignored:', e);
    }
  }, [center[0], center[1], zoom, routeWaypoints, map]);

  return null;
}

export default function RouteMapComponent({
  userLocation,
  destinations = [],
  selectedDestinationId,
  activeRoute,
  alternativeRoute,
  previousRoute,
  incidents = [],
  onSelectDestination,
}: {
  userLocation: { lat: number; lng: number } | null;
  destinations?: NearbyDestination[];
  selectedDestinationId?: string;
  activeRoute: EvaluatedRoute | null;
  alternativeRoute: EvaluatedRoute | null;
  previousRoute: EvaluatedRoute | null;
  incidents?: Incident[];
  onSelectDestination?: (dest: NearbyDestination) => void;
}) {
  // Default to user GPS, or first destination if GPS still loading
  const center: [number, number] = userLocation
    ? [userLocation.lat, userLocation.lng]
    : destinations.length > 0
    ? [destinations[0].latitude, destinations[0].longitude]
    : [13.0827, 80.2707];

  const selectedDest = destinations.find(d => d.id === selectedDestinationId);

  return (
    <MapContainer
      center={center}
      zoom={14}
      style={{ height: '100%', width: '100%', background: '#09090b' }}
      zoomControl={true}
    >
      <ChangeMapView
        center={center}
        zoom={14}
        routeWaypoints={activeRoute?.waypoints}
      />

      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        className="route-map-tiles"
      />

      <style dangerouslySetInnerHTML={{ __html: `
        .route-map-tiles { filter: invert(100%) hue-rotate(180deg) brightness(92%) contrast(88%); }
        .leaflet-popup-content-wrapper { background: #18181b !important; color: #f4f4f5 !important; border: 1px solid #3f3f46 !important; border-radius: 12px !important; }
        .leaflet-popup-tip { background: #18181b !important; }
      `}} />

      {/* 📍 USER GPS MARKER */}
      {userLocation && (
        <Marker position={[userLocation.lat, userLocation.lng]} icon={makeUserGpsIcon()}>
          <Popup>
            <div className="text-xs space-y-1 p-1">
              <div className="font-black text-blue-400 flex items-center gap-1.5">
                📍 YOUR CURRENT LOCATION
              </div>
              <div className="text-zinc-300 font-mono text-[10px]">
                {userLocation.lat.toFixed(6)}, {userLocation.lng.toFixed(6)}
              </div>
              <div className="text-emerald-400 font-bold text-[10px]">
                ✓ High-Accuracy GPS Active
              </div>
            </div>
          </Popup>
        </Marker>
      )}

      {/* ⌂ REAL NEARBY DESTINATIONS */}
      {destinations.map(d => {
        const isSelected = d.id === selectedDestinationId;
        return (
          <Marker
            key={d.id}
            position={[d.latitude, d.longitude]}
            icon={makeShelterIcon(d, isSelected)}
            eventHandlers={{
              click: () => onSelectDestination?.(d),
            }}
          >
            <Popup>
              <div className="text-xs space-y-1.5 p-1 min-w-[180px]">
                <div className="font-black text-zinc-100">{d.name}</div>
                <div className="flex items-center justify-between text-[10px] text-zinc-400">
                  <span>Type: <b className="text-zinc-200 capitalize">{d.type.replace('_', ' ')}</b></span>
                  <span className={`px-1.5 py-0.5 rounded font-black ${
                    d.status === 'OPEN' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400'
                  }`}>
                    {d.status}
                  </span>
                </div>
                <div className="flex items-center justify-between text-[10px]">
                  <span className="text-zinc-400">Distance:</span>
                  <span className="font-bold text-sky-400">{d.distanceKm} km away</span>
                </div>
                <div className="flex items-center justify-between text-[10px]">
                  <span className="text-zinc-400">Capacity:</span>
                  <span className="font-bold text-zinc-200">{d.capacity} beds</span>
                </div>
                {d.address && (
                  <div className="text-[9px] text-zinc-500 truncate">{d.address}</div>
                )}
                <button
                  onClick={() => onSelectDestination?.(d)}
                  className="w-full mt-2 py-1 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded text-[10px] transition-colors"
                >
                  Select as Destination
                </button>
              </div>
            </Popup>
          </Marker>
        );
      })}

      {/* ⚠ REAL ACTIVE CITIZEN INCIDENTS */}
      <MarkerClusterGroup chunkedLoading>
      {incidents
        .filter(i => i.status !== 'RESOLVED' && i.status !== 'REJECTED' && i.verificationStatus !== 'FALSE_REPORT')
        .map(inc => {
          const isApproximate = inc.location_precision === 'approximate';

          const PopupContent = (
            <Popup>
              <div className="text-xs space-y-1 p-1">
                {isApproximate && (
                  <div className="font-bold text-indigo-400 text-[10px] mb-1 uppercase">
                    📍 Approximate SMS Location
                  </div>
                )}
                <div className="font-black text-red-400 uppercase flex items-center gap-1">
                  🚨 {Array.isArray(inc.hazard) ? inc.hazard.join(' / ') : (inc.hazard || 'Disaster Incident')}
                </div>
                <div className="text-zinc-300 text-[11px]">
                  Severity: <span className="font-bold text-red-300">{inc.severity}</span>
                </div>
                <div className="text-zinc-400 text-[10px]">
                  Verification: <span className="font-bold text-emerald-400">{inc.verificationStatus || inc.status}</span>
                </div>
                <div className="text-zinc-500 font-mono text-[9px]">
                  {inc.latitude.toFixed(5)}, {inc.longitude.toFixed(5)}
                </div>
              </div>
            </Popup>
          );

          if (isApproximate) {
            return (
              <Circle
                key={inc.id}
                center={[inc.latitude, inc.longitude]}
                radius={800}
                pathOptions={{
                  color: inc.severity === 'CRITICAL' ? '#ef4444' : inc.severity === 'HIGH' ? '#f59e0b' : '#3b82f6',
                  fillColor: inc.severity === 'CRITICAL' ? '#ef4444' : inc.severity === 'HIGH' ? '#f59e0b' : '#3b82f6',
                  fillOpacity: 0.3,
                  weight: 2,
                  dashArray: '5, 5'
                }}
              >
                {PopupContent}
              </Circle>
            );
          }

          return (
            <Marker
              key={inc.id}
              position={[inc.latitude, inc.longitude]}
              icon={makeIncidentIcon(inc)}
            >
              {PopupContent}
            </Marker>
          );
        })}
      </MarkerClusterGroup>

      {/* 🛣️ GHOST / PREVIOUS ROUTE (When rerouted) */}
      {previousRoute && previousRoute.waypoints && (
        <Polyline
          positions={previousRoute.waypoints}
          pathOptions={{
            color: '#ef4444',
            weight: 4,
            dashArray: '8, 8',
            opacity: 0.6,
          }}
        />
      )}

      {/* 🛣️ ALTERNATIVE ROUTE (Safe bypass) */}
      {alternativeRoute && alternativeRoute.waypoints && (
        <Polyline
          positions={alternativeRoute.waypoints}
          pathOptions={{
            color: '#38bdf8',
            weight: 4,
            dashArray: '6, 6',
            opacity: 0.75,
          }}
        />
      )}

      {/* 🛣️ PRIMARY ACTIVE ROUTE */}
      {activeRoute && activeRoute.waypoints && (
        <>
          {/* Glowing underlay polyline */}
          <Polyline
            positions={activeRoute.waypoints}
            pathOptions={{
              color: RISK_COLORS[activeRoute.overallRisk] || '#10b981',
              weight: 9,
              opacity: 0.35,
            }}
          />
          {/* Main solid route polyline */}
          <Polyline
            positions={activeRoute.waypoints}
            pathOptions={{
              color: RISK_COLORS[activeRoute.overallRisk] || '#10b981',
              weight: 5,
              opacity: 0.95,
            }}
          />
        </>
      )}

      {/* Intersecting Hazards Proximity Highlights */}
      {activeRoute?.intersectingHazards?.map(h => (
        <CircleMarker
          key={`hazard_ring_${h.incidentId}`}
          center={[h.lat, h.lng]}
          radius={18}
          pathOptions={{
            color: '#ef4444',
            fillColor: '#ef4444',
            fillOpacity: 0.25,
            weight: 2,
            dashArray: '4, 4',
          }}
        />
      ))}
    </MapContainer>
  );
}
