'use client';

import { useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import { MapPin } from 'lucide-react';
import styles from './LocationMap.module.css';

// Fix Leaflet's default icon path issues in Next.js
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// Helper component to center map when location changes
function MapUpdater({ location }) {
  const map = useMap();
  useEffect(() => {
    if (location) {
      map.flyTo([location.lat, location.lng], 13, { animate: true, duration: 1.5 });
    }
  }, [location, map]);
  return null;
}

export default function LocationMap({ location, severity }) {
  const getMarkerIcon = () => {
    let color = '#888888'; // Default grey for unknown
    if (severity === 'low') color = '#22c55e'; // Green
    else if (severity === 'med') color = '#eab308'; // Yellow
    else if (severity === 'high') color = '#f97316'; // Orange
    else if (severity === 'severe') color = '#ef4444'; // Red

    const html = `
      <div style="
        background-color: ${color};
        width: 24px;
        height: 24px;
        border-radius: 50%;
        border: 3px solid white;
        box-shadow: 0 0 10px rgba(0,0,0,0.5);
      "></div>
    `;

    return L.divIcon({
      html: html,
      className: 'custom-leaflet-marker',
      iconSize: [24, 24],
      iconAnchor: [12, 12],
      popupAnchor: [0, -12]
    });
  };
  if (!location) {
    return (
      <div className={`glass-panel animate-fade-in ${styles.mapContainer} ${styles.emptyMap}`}>
        <MapPin size={48} className={styles.emptyIcon} />
        <h3>No Location Data</h3>
        <p>Upload an image with EXIF GPS data to see it on the map.</p>
      </div>
    );
  }

  return (
    <div className={`glass-panel animate-fade-in ${styles.mapContainer}`}>
      <h3 className={styles.title}>Extracted Location</h3>
      <div className={styles.mapWrapper}>
        <MapContainer 
          center={[location.lat, location.lng]} 
          zoom={13} 
          scrollWheelZoom={true} 
          style={{ height: '100%', width: '100%' }}
        >
          <TileLayer
            url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
          />
          <Marker position={[location.lat, location.lng]} icon={getMarkerIcon()}>
            <Popup>
              Image taken here. <br /> Lat: {location.lat.toFixed(4)}, Lng: {location.lng.toFixed(4)}
            </Popup>
          </Marker>
          <MapUpdater location={location} />
        </MapContainer>
      </div>
    </div>
  );
}
