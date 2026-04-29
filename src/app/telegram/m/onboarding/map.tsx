/** --- YAML
 * name: OnboardingAddressMap
 * description: Leaflet map with draggable pin for Mini App onboarding.
 *   attributionControl:false hides the OSM footer bar. On drag-end fires
 *   onMove(lat, lng) so parent can reverse-geocode the new position.
 * created: 2026-04-29
 * --- */

'use client';

import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

interface Props {
  center: [number, number];
  accent: string;
  onMove: (lat: number, lng: number) => void;
}

export default function OnboardingAddressMap({ center, accent, onMove }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef    = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const icon = L.divIcon({
      html: `<div style="
        width:32px;height:32px;
        background:${accent};
        border-radius:50% 50% 50% 0;
        transform:rotate(-45deg);
        border:3px solid #fff;
        box-shadow:0 2px 8px rgba(0,0,0,.28);
        display:flex;align-items:center;justify-content:center;
      "><div style="
        width:8px;height:8px;
        background:#fff;border-radius:50%;
        transform:rotate(45deg);
      "></div></div>`,
      iconSize: [32, 32],
      iconAnchor: [16, 32],
      className: '',
    });

    const map = L.map(containerRef.current, {
      center,
      zoom: 16,
      zoomControl: false,
      attributionControl: false, // ← hides "© OpenStreetMap" footer
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);
    L.control.zoom({ position: 'bottomright' }).addTo(map);

    const marker = L.marker(center, { icon, draggable: true }).addTo(map);
    marker.on('dragend', () => {
      const { lat, lng } = marker.getLatLng();
      onMove(lat, lng);
    });

    mapRef.current   = map;
    markerRef.current = marker;
    setTimeout(() => map.invalidateSize(), 80);

    return () => {
      map.remove();
      mapRef.current   = null;
      markerRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sync center when parent updates it (after address search pick)
  useEffect(() => {
    if (!mapRef.current || !markerRef.current) return;
    mapRef.current.setView(center, mapRef.current.getZoom(), { animate: true });
    markerRef.current.setLatLng(center);
  }, [center]);

  return <div ref={containerRef} style={{ width: '100%', height: '100%' }} />;
}
