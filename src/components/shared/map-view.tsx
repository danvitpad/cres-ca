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
  userLocation?: [number, number] | null;
}

const userLocationIcon = L.divIcon({
  html: `<div style="position:relative;width:22px;height:22px">
    <div style="position:absolute;inset:0;background:#3b82f6;border-radius:50%;opacity:0.25;animation:cresPulse 2s ease-out infinite"></div>
    <div style="position:absolute;inset:5px;background:#3b82f6;border:3px solid white;border-radius:50%;box-shadow:0 2px 8px rgba(59,130,246,0.6)"></div>
  </div>
  <style>@keyframes cresPulse{0%{transform:scale(0.6);opacity:0.6}100%{transform:scale(2.2);opacity:0}}</style>`,
  className: '',
  iconSize: [22, 22],
  iconAnchor: [11, 11],
});

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

export default function MapView({ markers, center, zoom = 13, className, onMarkerClick, userLocation }: MapViewProps) {
  const mapRef = useRef<L.Map | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const masterLayerRef = useRef<L.LayerGroup | null>(null);
  const userLayerRef = useRef<L.LayerGroup | null>(null);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current).setView(center, zoom);
    mapRef.current = map;

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(map);

    // Two independent layer groups so master updates never wipe the user pin
    masterLayerRef.current = L.layerGroup().addTo(map);
    userLayerRef.current = L.layerGroup().addTo(map);

    return () => {
      map.remove();
      mapRef.current = null;
      masterLayerRef.current = null;
      userLayerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!mapRef.current) return;
    mapRef.current.setView(center, zoom);
  }, [center, zoom]);

  useEffect(() => {
    const group = masterLayerRef.current;
    if (!group) return;
    group.clearLayers();

    markers.forEach((m) => {
      const marker = L.marker([m.lat, m.lng], { icon: createIcon(m.rating) });
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
      group.addLayer(marker);
    });
  }, [markers, onMarkerClick]);

  useEffect(() => {
    const group = userLayerRef.current;
    if (!group) return;
    group.clearLayers();
    if (userLocation) {
      L.marker(userLocation, { icon: userLocationIcon, zIndexOffset: 1000 }).addTo(group);
    }
  }, [userLocation]);

  return <div ref={containerRef} className={className} style={{ minHeight: '300px' }} />;
}
