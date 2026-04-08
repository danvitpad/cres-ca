/** --- YAML
 * name: MapView
 * description: Leaflet map component with master markers and popups, dynamically imported (no SSR)
 * --- */

'use client';

import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

export interface MapMarker {
  lat: number;
  lng: number;
  name: string;
  rating: number;
  specialization?: string;
  masterId: string;
}

interface MapViewProps {
  markers: MapMarker[];
  center: [number, number];
  zoom?: number;
  className?: string;
  onMarkerClick?: (masterId: string) => void;
}

function createIcon(rating: number) {
  const color = rating >= 4.5 ? '#10b981' : rating >= 3.5 ? '#3b82f6' : '#f59e0b';
  return L.divIcon({
    html: `<div style="
      background:${color};
      width:32px;height:32px;
      border-radius:50%;
      border:3px solid white;
      box-shadow:0 2px 8px rgba(0,0,0,0.25);
      display:flex;align-items:center;justify-content:center;
      color:white;font-size:12px;font-weight:700;
    ">${rating.toFixed(1)}</div>`,
    className: '',
    iconSize: [32, 32],
    iconAnchor: [16, 16],
    popupAnchor: [0, -20],
  });
}

export default function MapView({ markers, center, zoom = 13, className, onMarkerClick }: MapViewProps) {
  const mapRef = useRef<L.Map | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    mapRef.current = L.map(containerRef.current).setView(center, zoom);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(mapRef.current);

    return () => {
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!mapRef.current) return;
    mapRef.current.setView(center, zoom);
  }, [center, zoom]);

  useEffect(() => {
    if (!mapRef.current) return;

    // Clear existing markers
    mapRef.current.eachLayer((layer) => {
      if (layer instanceof L.Marker) {
        mapRef.current!.removeLayer(layer);
      }
    });

    markers.forEach((m) => {
      const marker = L.marker([m.lat, m.lng], { icon: createIcon(m.rating) })
        .addTo(mapRef.current!);

      marker.bindPopup(`
        <div style="min-width:160px;font-family:system-ui">
          <strong style="font-size:14px">${m.name}</strong>
          ${m.specialization ? `<br/><span style="color:#666;font-size:12px">${m.specialization}</span>` : ''}
          <br/><span style="color:#f59e0b">★</span> ${m.rating.toFixed(1)}
        </div>
      `);

      if (onMarkerClick) {
        marker.on('click', () => onMarkerClick(m.masterId));
      }
    });
  }, [markers, onMarkerClick]);

  return <div ref={containerRef} className={className} style={{ minHeight: '300px' }} />;
}
