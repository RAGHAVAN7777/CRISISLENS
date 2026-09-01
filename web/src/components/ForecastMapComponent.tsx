'use client';
import { useEffect } from 'react';
import {
  MapContainer, TileLayer, CircleMarker, Circle, Polyline, Popup, Marker, useMap
} from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { ForecastZone, TimeStep } from '@/lib/services/forecastEngine';
import { Incident, Shelter } from '@/lib/storage';
import { RoutePath } from '@/lib/roadGraph';

function ChangeMapView({ center, zoom }: { center: [number, number]; zoom: number }) {
  const map = useMap();
  useEffect(() => {
    if (!center || isNaN(center[0]) || isNaN(center[1])) return;
    try {
      map.setView(center, zoom, { animate: false });
      const timer = setTimeout(() => map.invalidateSize(), 100);
      return () => clearTimeout(timer);
    } catch (e) {
      console.warn('Map view update ignored:', e);
    }
  }, [center[0], center[1], zoom, map]);
  return null;
}

// ── Icon helpers ──────────────────────────────────────────────────────────────

function makeIcon(bg: string, emoji: string, size = 28) {
  return L.divIcon({
    html: `<div style="
      background:${bg};width:${size}px;height:${size}px;border-radius:50%;
      border:2.5px solid #fff;box-shadow:0 0 10px ${bg}88;
      display:flex;align-items:center;justify-content:center;
      font-size:${Math.round(size * 0.45)}px;
    ">${emoji}</div>`,
    className: '',
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}

function makePulsingIcon(color: string, emoji: string) {
  return L.divIcon({
    html: `
      <div style="position:relative;width:42px;height:42px;">
        <div style="
          position:absolute;inset:0;border-radius:50%;
          background:${color};opacity:0.2;
          animation:pfx-pulse 1.5s ease-out infinite;
        "></div>
        <div style="
          position:absolute;inset:7px;border-radius:50%;
          background:${color};border:2px solid #fff;
          display:flex;align-items:center;justify-content:center;
          font-size:14px;
        ">${emoji}</div>
      </div>
      <style>
        @keyframes pfx-pulse {
          0%   { transform:scale(.8); opacity:.4; }
          80%  { transform:scale(2.2); opacity:0; }
          100% { transform:scale(2.2); opacity:0; }
        }
      </style>`,
    className: '',
    iconSize: [42, 42],
    iconAnchor: [21, 21],
  });
}

// ── Zone colors per risk level ────────────────────────────────────────────────
const ZONE_COLORS: Record<string, { fill: string; stroke: string }> = {
  CRITICAL: { fill: '#ef4444', stroke: '#dc2626' },
  HIGH:     { fill: '#f97316', stroke: '#ea580c' },
  MEDIUM:   { fill: '#f59e0b', stroke: '#d97706' },
  LOW:      { fill: '#84cc16', stroke: '#65a30d' },
  MINIMAL:  { fill: '#22d3ee', stroke: '#06b6d4' },
};

const STEP_OPACITY: Record<TimeStep, number> = {
  NOW: 0.32,
  T15: 0.22,
  T30: 0.16,
  T60: 0.12,
};

// ── Map legend ────────────────────────────────────────────────────────────────
function MapLegend({ step }: { step: TimeStep }) {
  return (
    <div style={{
      position: 'absolute', bottom: 20, left: 12, zIndex: 900,
      background: 'rgba(9,9,11,0.92)', border: '1px solid #27272a',
      borderRadius: 12, padding: '10px 14px', backdropFilter: 'blur(10px)',
      fontSize: 11, color: '#a1a1aa', lineHeight: 1.7,
    }}>
      <div style={{ fontWeight: 800, fontSize: 10, letterSpacing: 1.5, color: '#a1a1aa', marginBottom: 6 }}>
        🔮 TIME MACHINE SPATIAL LAYERS
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ display: 'inline-block', width: 12, height: 12, borderRadius: '50%', background: '#ef4444', border: '2px solid #fff' }} />
        🔴 Observed Incident (T0)
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ display: 'inline-block', width: 12, height: 12, borderRadius: '50%', background: '#f97316', opacity: 0.6 }} />
        🧠 Projected Risk ({step === 'NOW' ? 'NOW' : step === 'T15' ? '+15m' : step === 'T30' ? '+30m' : '+60m'})
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ display: 'inline-block', width: 24, height: 4, background: '#34d399', borderRadius: 2 }} />
        🛣️ Optimal Evacuation Route
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ display: 'inline-block', width: 24, height: 3, background: '#38bdf8', borderRadius: 2, borderTop: '2px dashed #38bdf8' }} />
        ✨ Proactive Safer Alternative
      </div>
      <div style={{ marginTop: 8, padding: '4px 8px', background: '#1c1c1e', borderRadius: 6, fontSize: 10, color: '#38bdf8', fontWeight: 600 }}>
        PyTorch GRU Neural Forecast Active
      </div>
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────

interface Props {
  incidents: Incident[];
  shelters: Shelter[];
  zones: ForecastZone[];
  step: TimeStep;
  activeRoute?: RoutePath | null;
  alternativeRoute?: RoutePath | null;
  routeAtRisk?: boolean;
  gpsLocation?: { lat: number; lng: number } | null;
  telemetryStation?: { name: string; rainfall_mm: number; lat?: number; lng?: number } | null;
}

export default function ForecastMapComponent({
  incidents,
  shelters,
  zones,
  step,
  activeRoute,
  alternativeRoute,
  routeAtRisk,
  gpsLocation,
  telemetryStation,
}: Props) {
  const center: [number, number] = gpsLocation
    ? [gpsLocation.lat, gpsLocation.lng]
    : zones.length > 0 && !isNaN(zones[0].lat) && !isNaN(zones[0].lng)
      ? [zones[0].lat, zones[0].lng]
      : [13.0827, 80.2707];

  const routeColor = routeAtRisk ? '#ef4444' : '#34d399';

  return (
    <MapContainer
      center={center}
      zoom={14}
      style={{ height: '100%', width: '100%', background: '#09090b' }}
      zoomControl
    >
      <ChangeMapView center={center} zoom={14} />
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        className="forecast-tiles"
      />
      <style dangerouslySetInnerHTML={{ __html: `
        .forecast-tiles { filter: invert(100%) hue-rotate(180deg) brightness(90%) contrast(85%); }
        .leaflet-popup { z-index: 1000 !important; }
        .leaflet-pane  { z-index: 1 !important; }
        .leaflet-top,.leaflet-bottom { z-index: 100 !important; }
      ` }} />

      {/* ── Forecast expansion circles (translucent risk zones) ── */}
      {zones.map(zone => {
        const c = ZONE_COLORS[zone.riskLevel] ?? ZONE_COLORS.MEDIUM;
        const fillOpacity = STEP_OPACITY[step];
        return (
          <Circle
            key={`zone-${zone.incidentId}-${step}`}
            center={[zone.lat, zone.lng]}
            radius={zone.radiusM}
            pathOptions={{
              color: c.stroke,
              fillColor: c.fill,
              fillOpacity,
              weight: 1.8,
              dashArray: step === 'NOW' ? undefined : '8,6',
            }}
          >
            <Popup>
              <div style={{ minWidth: 170 }}>
                <div style={{ fontWeight: 800, fontSize: 13, marginBottom: 4 }}>
                  🧠 ML Risk Forecast ({step === 'NOW' ? 'NOW' : step === 'T15' ? '+15 min' : step === 'T30' ? '+30 min' : '+60 min'})
                </div>
                <div style={{ fontSize: 11, color: '#444', lineHeight: 1.6 }}>
                  <div><b>Hazard:</b> {zone.hazard}</div>
                  <div><b>Risk Level:</b> <span style={{ color: c.fill, fontWeight: 700 }}>{zone.riskLevel}</span></div>
                  <div><b>Probability:</b> {Math.round(zone.riskScore)}%</div>
                  <div><b>Projected Radius:</b> {zone.radiusM}m</div>
                </div>
                {zone.isSimulated && (
                  <div style={{ marginTop: 6, fontSize: 10, color: '#f59e0b', fontWeight: 700 }}>
                    ⚠ DEMO SIMULATION
                  </div>
                )}
                <div style={{ marginTop: 6, fontSize: 9.5, color: '#6366f1', fontWeight: 600 }}>
                  Model: FloodTimeMachine-GRU v1.0.0
                </div>
              </div>
            </Popup>
          </Circle>
        );
      })}

      {/* ── Actual incident markers (always visible) ── */}
      {incidents
        .filter(i => i.status !== 'RESOLVED' && i.status !== 'REJECTED' && i.verificationStatus !== 'FALSE_REPORT')
        .filter(i => !isNaN(i.latitude) && !isNaN(i.longitude))
        .map(i => {
          const isVerified = i.verificationStatus === 'VERIFIED' || i.verificationStatus === 'PARTIALLY_VERIFIED';
          const color = isVerified ? '#ef4444' : '#f59e0b';
          return (
            <Marker
              key={i.id}
              position={[i.latitude, i.longitude]}
              icon={makePulsingIcon(color, isVerified ? '🔴' : '🟠')}
            >
              <Popup>
                <div style={{ minWidth: 190 }}>
                  <div style={{ fontWeight: 800, fontSize: 13 }}>🚨 {i.hazard}</div>
                  <div style={{ fontSize: 11, color: '#444', marginTop: 4, lineHeight: 1.7 }}>
                    <div><b>Severity:</b> {i.severity}</div>
                    <div><b>Confidence:</b> {i.confidence}%</div>
                    <div><b>Verification:</b> <span style={{ color: isVerified ? '#059669' : '#d97706', fontWeight: 700 }}>{i.verificationStatus || i.status}</span></div>
                    <div><b>Sources:</b> {(i.sources ?? []).join(', ')}</div>
                    {i.createdAt && <div style={{ fontSize: 10, color: '#888' }}>{new Date(i.createdAt).toLocaleString()}</div>}
                  </div>
                  {(i as any).isSimulated && (
                    <div style={{ fontSize: 10, color: '#f59e0b', fontWeight: 700, marginTop: 4 }}>⚠ DEMO SIMULATION</div>
                  )}
                </div>
              </Popup>
            </Marker>
          );
        })}

      {/* ── Active Route (Primary) ── */}
      {activeRoute && activeRoute.waypoints.length > 1 && (
        <>
          <Polyline
            positions={activeRoute.waypoints}
            pathOptions={{ color: routeColor, weight: 12, opacity: 0.15, lineCap: 'round' }}
          />
          <Polyline
            positions={activeRoute.waypoints}
            pathOptions={{
              color: routeColor,
              weight: 4.5,
              opacity: 0.95,
              lineCap: 'round',
              dashArray: routeAtRisk ? '10,6' : undefined,
            }}
          />
        </>
      )}

      {/* ── Alternative Safer Route (Rendered when active route is at risk) ── */}
      {routeAtRisk && alternativeRoute && alternativeRoute.waypoints.length > 1 && (
        <>
          <Polyline
            positions={alternativeRoute.waypoints}
            pathOptions={{ color: '#38bdf8', weight: 10, opacity: 0.20, lineCap: 'round' }}
          />
          <Polyline
            positions={alternativeRoute.waypoints}
            pathOptions={{
              color: '#38bdf8',
              weight: 4,
              opacity: 0.95,
              lineCap: 'round',
              dashArray: '6,4',
            }}
          />
        </>
      )}

      {/* ── Telemetry Weather Station Marker ── */}
      {telemetryStation && (
        <Marker
          position={[
            telemetryStation.lat ?? (center[0] + 0.006),
            telemetryStation.lng ?? (center[1] + 0.008)
          ]}
          icon={makeIcon('#0284c7', '📡', 26)}
        >
          <Popup>
            <div style={{ minWidth: 160 }}>
              <div style={{ fontWeight: 700, fontSize: 12 }}>📡 {telemetryStation.name}</div>
              <div style={{ fontSize: 11, color: '#555', marginTop: 2 }}>
                <b>Live Telemetry:</b> {telemetryStation.rainfall_mm} mm/hr
              </div>
              <div style={{ fontSize: 9.5, color: '#0284c7', marginTop: 3 }}>
                Tamil Nadu Hydrological Network
              </div>
            </div>
          </Popup>
        </Marker>
      )}

      {/* ── Citizen GPS marker ── */}
      {gpsLocation && (
        <Marker
          position={[gpsLocation.lat, gpsLocation.lng]}
          icon={makeIcon('#3b82f6', '📍', 30)}
        >
          <Popup>
            <div style={{ fontSize: 12, fontWeight: 700 }}>📍 Your Location</div>
            <div style={{ fontSize: 11, color: '#555' }}>
              {gpsLocation.lat.toFixed(5)}, {gpsLocation.lng.toFixed(5)}
            </div>
          </Popup>
        </Marker>
      )}

      {/* ── Shelter markers ── */}
      {shelters.map(s => (
        <CircleMarker
          key={s.id}
          center={[s.latitude, s.longitude]}
          radius={8}
          pathOptions={{
            color: s.status === 'OPEN' ? '#10b981' : s.status === 'LIMITED' ? '#f59e0b' : '#ef4444',
            fillColor: s.status === 'OPEN' ? '#10b981' : s.status === 'LIMITED' ? '#f59e0b' : '#ef4444',
            fillOpacity: 0.75,
            weight: 2,
          }}
        >
          <Popup>
            <div style={{ minWidth: 150 }}>
              <div style={{ fontWeight: 700, fontSize: 13 }}>🏫 {s.name}</div>
              <div style={{ fontSize: 11, color: '#555', marginTop: 2 }}>
                Status: {s.status} · Capacity: {s.capacity}%
              </div>
            </div>
          </Popup>
        </CircleMarker>
      ))}

      {/* ── Map legend (absolute positioned inside map) ── */}
      <MapLegend step={step} />
    </MapContainer>
  );
}
