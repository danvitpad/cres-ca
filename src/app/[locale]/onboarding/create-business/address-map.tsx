/** --- YAML
 * name: AddressMap
 * description: Leaflet map with draggable marker for address selection in onboarding
 * --- */

'use client';

import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

interface AddressMapProps {
  center: [number, number];
  onMove: (lat: number, lng: number) => void;
}

export default function AddressMap({ center, onMove }: AddressMapProps) {
  const mapRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    // Custom marker icon
    const icon = L.divIcon({
      html: `<div style="
        width: 32px; height: 32px;
        background: hsl(var(--primary));
        border-radius: 50% 50% 50% 0;
        transform: rotate(-45deg);
        border: 3px solid white;
        box-shadow: 0 2px 8px rgba(0,0,0,0.3);
        display: flex; align-items: center; justify-content: center;
      "><div style="
        width: 8px; height: 8px;
        background: white;
        border-radius: 50%;
        transform: rotate(45deg);
      "></div></div>`,
      iconSize: [32, 32],
      iconAnchor: [16, 32],
      className: '',
    });

    const map = L.map(containerRef.current, {
      center,
      zoom: 16,
      zoomControl: false,
    });

    L.control.zoom({ position: 'bottomright' }).addTo(map);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap',
    }).addTo(map);

    const marker = L.marker(center, { icon, draggable: true }).addTo(map);

    marker.on('dragend', () => {
      const pos = marker.getLatLng();
      onMove(pos.lat, pos.lng);
    });

    mapRef.current = map;
    markerRef.current = marker;

    // Force resize after mount
    setTimeout(() => map.invalidateSize(), 100);

    return () => {
      map.remove();
      mapRef.current = null;
      markerRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Update center when it changes
  useEffect(() => {
    if (mapRef.current && markerRef.current) {
      mapRef.current.setView(center, mapRef.current.getZoom());
      markerRef.current.setLatLng(center);
    }
  }, [center]);

  return <div ref={containerRef} className="h-full w-full" />;
}
