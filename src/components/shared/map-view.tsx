/** --- YAML
 * name: MapView
 * description: Leaflet map with master/salon markers. At zoom ≥14 shows
 *              permanent name labels under each marker. Tap on marker fires
 *              onMarkerClick / onSalonClick — parent shows a bottom-sheet
 *              card with full info.
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
  address?: string;
  masterId: string;
}

export interface SalonMarker {
  lat: number;
  lng: number;
  name: string;
  address?: string;
  salonId: string;
}

interface MapViewProps {
  markers: MapMarker[];
  salonMarkers?: SalonMarker[];
  center: [number, number];
  zoom?: number;
  className?: string;
  onMarkerClick?: (masterId: string) => void;
  onSalonClick?: (salonId: string) => void;
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

const salonIcon = L.divIcon({
  html: `<div style="
    background:#2dd4bf;
    width:36px;height:36px;
    border-radius:10px;
    border:3px solid white;
    box-shadow:0 2px 10px rgba(45,212,191,0.45);
    display:flex;align-items:center;justify-content:center;
    color:white;font-size:16px;font-weight:800;
  ">S</div>`,
  className: '',
  iconSize: [36, 36],
  iconAnchor: [18, 18],
  popupAnchor: [0, -22],
});

const ZOOM_NAME_THRESHOLD = 13;

export default function MapView({
  markers,
  salonMarkers = [],
  center,
  zoom = 13,
  className,
  onMarkerClick,
  onSalonClick,
  userLocation,
}: MapViewProps) {
  const mapRef = useRef<L.Map | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const masterLayerRef = useRef<L.LayerGroup | null>(null);
  const salonLayerRef = useRef<L.LayerGroup | null>(null);
  const userLayerRef = useRef<L.LayerGroup | null>(null);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current, {
      zoomControl: false,
      attributionControl: false,
    }).setView(center, zoom);
    mapRef.current = map;

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);

    masterLayerRef.current = L.layerGroup().addTo(map);
    salonLayerRef.current = L.layerGroup().addTo(map);
    userLayerRef.current = L.layerGroup().addTo(map);

    // Toggle marker labels visibility based on zoom level
    const updateLabelVisibility = () => {
      const showLabels = map.getZoom() >= ZOOM_NAME_THRESHOLD;
      const root = containerRef.current;
      if (root) root.classList.toggle('cres-zoom-far', !showLabels);
    };
    updateLabelVisibility();
    map.on('zoomend', updateLabelVisibility);

    return () => {
      map.off('zoomend', updateLabelVisibility);
      map.remove();
      mapRef.current = null;
      masterLayerRef.current = null;
      salonLayerRef.current = null;
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
      // Permanent label visible at high zoom (CSS class hides at low zoom)
      marker.bindTooltip(escapeHtml(m.name), {
        permanent: true,
        direction: 'bottom',
        offset: [0, 6],
        className: 'cres-marker-label',
      });
      if (onMarkerClick) {
        marker.on('click', () => onMarkerClick(m.masterId));
      }
      group.addLayer(marker);
    });
  }, [markers, onMarkerClick]);

  useEffect(() => {
    const group = salonLayerRef.current;
    if (!group) return;
    group.clearLayers();

    salonMarkers.forEach((s) => {
      const marker = L.marker([s.lat, s.lng], { icon: salonIcon });
      marker.bindTooltip(escapeHtml(s.name), {
        permanent: true,
        direction: 'bottom',
        offset: [0, 8],
        className: 'cres-marker-label cres-marker-label-salon',
      });
      if (onSalonClick) {
        marker.on('click', () => onSalonClick(s.salonId));
      }
      group.addLayer(marker);
    });
  }, [salonMarkers, onSalonClick]);

  useEffect(() => {
    const group = userLayerRef.current;
    if (!group) return;
    group.clearLayers();
    if (userLocation) {
      L.marker(userLocation, { icon: userLocationIcon, zIndexOffset: 1000 }).addTo(group);
    }
  }, [userLocation]);

  return (
    <>
      <style jsx global>{`
        .cres-marker-label {
          background: rgba(255, 255, 255, 0.95);
          color: #1f1f22;
          border: none;
          border-radius: 8px;
          padding: 3px 8px;
          font-size: 11px;
          font-weight: 600;
          box-shadow: 0 2px 6px rgba(0, 0, 0, 0.15);
          font-family: system-ui, -apple-system, sans-serif;
          white-space: nowrap;
          max-width: 160px;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .cres-marker-label::before {
          display: none !important;
        }
        .cres-marker-label-salon {
          background: rgba(45, 212, 191, 0.95);
          color: white;
        }
        .cres-zoom-far .cres-marker-label {
          display: none !important;
        }
      `}</style>
      <div ref={containerRef} className={className} style={{ width: '100%', height: '100%', minHeight: '300px' }} />
    </>
  );
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
