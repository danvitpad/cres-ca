/** --- YAML
 * name: MiniAppAddressPickerSheet
 * description: Bottom-sheet редактор адреса с поиском Nominatim и картой OSM.
 *              Используется на публичной странице мастера вместо textarea-редактора —
 *              UX совпадает с шагом онбординга «Где ваш кабинет»: ввод текста в
 *              поиск → выбор результата → пин на карте → drag для уточнения →
 *              reverse-geocode подменяет строку. На «Зберегти» родитель получает
 *              { address, lat, lng } и сохраняет за один POST.
 * created: 2026-05-10
 * --- */

'use client';

import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, X as XIcon, Loader2, MapPin, Check } from 'lucide-react';
import dynamic from 'next/dynamic';
import { T as THEME, R, SHADOW } from '@/components/miniapp/design';

// Reuse onboarding map — нет смысла дублировать leaflet-инициализацию
const AddressMap = dynamic(() => import('@/app/telegram/m/onboarding/map'), { ssr: false });

interface NominatimResult {
  display_name: string;
  lat: string;
  lon: string;
}

export interface AddressPick {
  address: string;
  latitude: number | null;
  longitude: number | null;
}

interface Props {
  open: boolean;
  initial?: { address: string | null; latitude: number | null; longitude: number | null };
  title?: string;
  saveLabel?: string;
  cancelLabel?: string;
  searchPlaceholder?: string;
  hint?: string;
  onClose: () => void;
  onSave: (pick: AddressPick) => Promise<void> | void;
}

export function AddressPickerSheet({
  open,
  initial,
  title = 'Адрес',
  saveLabel = 'Зберегти',
  cancelLabel = 'Скасувати',
  searchPlaceholder = 'Введіть адресу…',
  hint = 'Перетягніть маркер, щоб уточнити',
  onClose,
  onSave,
}: Props) {
  const [address, setAddress] = useState(initial?.address ?? '');
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(
    initial?.latitude != null && initial?.longitude != null
      ? { lat: initial.latitude, lng: initial.longitude }
      : null,
  );
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<NominatimResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [saving, setSaving] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // При открытии — сбрасываем local state на initial
  useEffect(() => {
    if (open) {
      setAddress(initial?.address ?? '');
      setCoords(
        initial?.latitude != null && initial?.longitude != null
          ? { lat: initial.latitude, lng: initial.longitude }
          : null,
      );
      setQuery('');
      setResults([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Debounced Nominatim search
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!query.trim() || query.trim().length < 3) {
      setResults([]);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&limit=5&q=${encodeURIComponent(query)}`,
          { headers: { 'Accept-Language': 'ru,uk,en' } },
        );
        const data = (await res.json()) as NominatimResult[];
        setResults(data);
      } catch {
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, 500);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query]);

  function pickResult(r: NominatimResult) {
    setAddress(r.display_name);
    setCoords({ lat: Number(r.lat), lng: Number(r.lon) });
    setResults([]);
    setQuery('');
  }

  function clearAll() {
    setAddress('');
    setCoords(null);
    setQuery('');
    setResults([]);
  }

  // Reverse-geocode при drag пина
  async function handleMapMove(lat: number, lon: number) {
    setCoords({ lat, lng: lon });
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=18`,
        { headers: { 'Accept-Language': 'ru,uk,en' } },
      );
      if (res.ok) {
        const data = (await res.json()) as { display_name?: string };
        if (data.display_name) setAddress(data.display_name);
      }
    } catch { /* best-effort */ }
  }

  async function handleSave() {
    setSaving(true);
    try {
      await onSave({
        address: address.trim(),
        latitude: coords?.lat ?? null,
        longitude: coords?.lng ?? null,
      });
      onClose();
    } finally {
      setSaving(false);
    }
  }

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Overlay */}
          <motion.div
            key="overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            onClick={onClose}
            style={{
              position: 'fixed', inset: 0, zIndex: 70,
              background: 'rgba(10,10,12,0.5)',
              backdropFilter: 'blur(2px)',
            }}
          />

          {/* Sheet */}
          <motion.div
            key="sheet"
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', stiffness: 360, damping: 38, mass: 0.9 }}
            style={{
              position: 'fixed',
              left: 0, right: 0, bottom: 0,
              zIndex: 80,
              background: THEME.bg,
              borderTopLeftRadius: 20,
              borderTopRightRadius: 20,
              boxShadow: SHADOW.elevated,
              maxHeight: 'calc(var(--tg-viewport-height, 100dvh) - max(var(--tg-content-top, 0px), 80px))',
              display: 'flex',
              flexDirection: 'column',
              paddingBottom: 'env(safe-area-inset-bottom, 0px)',
            }}
          >
            {/* Drag handle + header */}
            <div style={{ padding: '8px 16px 4px', flexShrink: 0 }}>
              <div style={{
                width: 36, height: 4, borderRadius: 2,
                background: THEME.borderSubtle,
                margin: '0 auto 12px',
              }} />
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                marginBottom: 4,
              }}>
                <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: THEME.text }}>{title}</h2>
                <button
                  type="button"
                  onClick={onClose}
                  aria-label="Close"
                  style={{
                    width: 32, height: 32, borderRadius: 16,
                    border: `1px solid ${THEME.borderSubtle}`,
                    background: THEME.surface,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    cursor: 'pointer',
                    color: THEME.text,
                  }}
                >
                  <XIcon size={14} strokeWidth={2.5} />
                </button>
              </div>
            </div>

            {/* Body */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '8px 16px 16px' }}>
              {/* Selected chip OR search input */}
              {address ? (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 10,
                    padding: '12px 14px',
                    borderRadius: R.md,
                    border: `1.5px solid ${THEME.accent}`,
                    background: THEME.accentSoft,
                    marginBottom: 10,
                  }}
                >
                  <MapPin size={16} color={THEME.accent} style={{ marginTop: 2, flexShrink: 0 }} />
                  <span style={{ flex: 1, fontSize: 13, color: THEME.text, lineHeight: 1.4 }}>
                    {address}
                  </span>
                  <button
                    type="button"
                    onClick={clearAll}
                    style={{
                      background: 'none', border: 'none',
                      cursor: 'pointer', padding: 0, flexShrink: 0,
                    }}
                  >
                    <XIcon size={16} color={THEME.textTertiary} />
                  </button>
                </div>
              ) : (
                <div style={{ position: 'relative', marginBottom: 8 }}>
                  <div
                    style={{
                      display: 'flex', alignItems: 'center', gap: 10,
                      padding: '12px 14px',
                      borderRadius: R.md,
                      border: `1.5px solid ${THEME.border}`,
                      background: THEME.surface,
                    }}
                  >
                    {searching
                      ? <Loader2 size={16} color={THEME.textTertiary} className="animate-spin" style={{ flexShrink: 0 }} />
                      : <Search size={16} color={THEME.textTertiary} style={{ flexShrink: 0 }} />
                    }
                    <input
                      type="text"
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      placeholder={searchPlaceholder}
                      autoFocus
                      style={{
                        flex: 1,
                        border: 'none',
                        background: 'transparent',
                        outline: 'none',
                        fontSize: 14,
                        color: THEME.text,
                      }}
                    />
                    {query && (
                      <button
                        type="button"
                        onClick={() => { setQuery(''); setResults([]); }}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                      >
                        <XIcon size={14} color={THEME.textTertiary} />
                      </button>
                    )}
                  </div>

                  {results.length > 0 && (
                    <div
                      style={{
                        position: 'absolute',
                        top: 'calc(100% + 4px)',
                        left: 0, right: 0,
                        zIndex: 10,
                        borderRadius: R.md,
                        border: `1.5px solid ${THEME.border}`,
                        background: THEME.surface,
                        boxShadow: SHADOW.card,
                        overflow: 'hidden',
                      }}
                    >
                      {results.map((r, i) => (
                        <button
                          key={i}
                          type="button"
                          onClick={() => pickResult(r)}
                          style={{
                            display: 'flex', alignItems: 'flex-start', gap: 10,
                            width: '100%',
                            padding: '11px 14px',
                            borderTop: i === 0 ? 'none' : `1px solid ${THEME.borderSubtle}`,
                            background: 'transparent',
                            border: 'none',
                            cursor: 'pointer',
                            textAlign: 'left',
                            WebkitTapHighlightColor: 'transparent',
                          }}
                        >
                          <MapPin size={14} color={THEME.textTertiary} style={{ marginTop: 2, flexShrink: 0 }} />
                          <span style={{ fontSize: 12, color: THEME.text, lineHeight: 1.4 }}>
                            {r.display_name}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Map preview */}
              {coords && (
                <div style={{ marginTop: 8 }}>
                  <p style={{
                    margin: '0 0 8px',
                    fontSize: 12,
                    color: THEME.textTertiary,
                  }}>{hint}</p>
                  <div style={{
                    height: 220,
                    borderRadius: R.md,
                    overflow: 'hidden',
                    border: `1px solid ${THEME.border}`,
                  }}>
                    <AddressMap
                      center={[coords.lat, coords.lng]}
                      accent={THEME.accent}
                      onMove={handleMapMove}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Footer CTA */}
            <div style={{
              padding: '12px 16px',
              paddingBottom: 'max(12px, env(safe-area-inset-bottom, 0px))',
              borderTop: `1px solid ${THEME.borderSubtle}`,
              flexShrink: 0,
              display: 'flex',
              gap: 8,
            }}>
              <button
                type="button"
                onClick={onClose}
                style={{
                  flex: '0 0 auto',
                  padding: '14px 20px',
                  borderRadius: R.xl,
                  background: THEME.surface,
                  color: THEME.text,
                  border: `1px solid ${THEME.border}`,
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                {cancelLabel}
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={saving || !address.trim()}
                style={{
                  flex: 1,
                  padding: '14px 0',
                  borderRadius: R.xl,
                  background: THEME.accent,
                  color: '#fff',
                  fontSize: 15,
                  fontWeight: 700,
                  border: 'none',
                  cursor: saving || !address.trim() ? 'not-allowed' : 'pointer',
                  opacity: saving || !address.trim() ? 0.5 : 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                }}
              >
                {saving
                  ? <Loader2 size={16} className="animate-spin" />
                  : <Check size={16} strokeWidth={2.5} />
                }
                {saveLabel}
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
