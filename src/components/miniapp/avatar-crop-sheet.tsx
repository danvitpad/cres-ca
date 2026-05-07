/** --- YAML
 * name: MiniAppAvatarCropSheet
 * description: Fullscreen crop UI для Mini App клиента — после выбора фото
 *              в iOS picker открывается этот листок с круглой рамкой,
 *              можно дотащить и зумировать. Не использует shadcn Dialog
 *              (Radix Portal иногда не работает поверх Telegram WebView)
 *              — обычный fixed-positioned div с z-index 9999.
 * created: 2026-05-07
 * --- */

'use client';

import { useCallback, useEffect, useState } from 'react';
import Cropper, { type Area } from 'react-easy-crop';
import { X, Check, ZoomIn, ZoomOut, Loader2 } from 'lucide-react';

interface Props {
  /** ObjectURL картинки или null. !!src управляет видимостью. */
  src: string | null;
  /** Целевой размер выходного фото по короткой стороне (px). */
  outputSize?: number;
  /** Заголовок sheet. */
  title?: string;
  /** Локализованные подписи. */
  cancelLabel?: string;
  applyLabel?: string;
  applyingLabel?: string;
  onClose: () => void;
  onCropped: (blob: Blob) => void;
}

export function MiniAppAvatarCropSheet({
  src,
  outputSize = 512,
  title = 'Аватар',
  cancelLabel = 'Скасувати',
  applyLabel = 'Застосувати',
  applyingLabel = 'Застосовуємо…',
  onClose,
  onCropped,
}: Props) {
  const [crop, setCrop] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [area, setArea] = useState<Area | null>(null);
  const [busy, setBusy] = useState(false);

  // Сброс при смене картинки
  useEffect(() => {
    if (src) {
      setCrop({ x: 0, y: 0 });
      setZoom(1);
      setArea(null);
      setBusy(false);
    }
  }, [src]);

  const onCropComplete = useCallback((_: Area, areaPixels: Area) => {
    setArea(areaPixels);
  }, []);

  async function apply() {
    if (!src || !area) return;
    setBusy(true);
    try {
      const blob = await cropToBlob(src, area, outputSize);
      onCropped(blob);
      onClose();
    } catch {
      setBusy(false);
    }
  }

  if (!src) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        background: '#000',
        display: 'flex',
        flexDirection: 'column',
        // safe-area для iOS notch
        paddingTop: 'env(safe-area-inset-top, 0px)',
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
      }}
    >
      {/* Top bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '12px 16px',
          color: '#fff',
        }}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          style={{
            width: 36,
            height: 36,
            borderRadius: '50%',
            background: 'rgba(255,255,255,0.12)',
            color: '#fff',
            border: 'none',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
          }}
        >
          <X size={18} />
        </button>
        <div style={{ fontSize: 16, fontWeight: 700 }}>{title}</div>
        <button
          type="button"
          onClick={apply}
          disabled={!area || busy}
          aria-label="Apply"
          style={{
            width: 36,
            height: 36,
            borderRadius: '50%',
            background: !area || busy ? 'rgba(255,255,255,0.2)' : '#2dd4bf',
            color: !area || busy ? 'rgba(255,255,255,0.5)' : '#000',
            border: 'none',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: !area || busy ? 'wait' : 'pointer',
          }}
        >
          {busy ? <Loader2 size={18} className="animate-spin" /> : <Check size={18} />}
        </button>
      </div>

      {/* Crop area */}
      <div style={{ position: 'relative', flex: 1, background: '#000' }}>
        <Cropper
          image={src}
          crop={crop}
          zoom={zoom}
          aspect={1}
          cropShape="round"
          showGrid={false}
          onCropChange={setCrop}
          onZoomChange={setZoom}
          onCropComplete={onCropComplete}
          minZoom={1}
          maxZoom={4}
          zoomSpeed={0.5}
          objectFit="contain"
          restrictPosition
        />
      </div>

      {/* Zoom slider */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: '16px 20px 12px',
          background: '#000',
          color: '#fff',
        }}
      >
        <button
          type="button"
          onClick={() => setZoom((z) => Math.max(1, +(z - 0.2).toFixed(2)))}
          aria-label="Zoom out"
          style={zoomBtnStyle}
        >
          <ZoomOut size={16} />
        </button>
        <input
          type="range"
          min={1}
          max={4}
          step={0.01}
          value={zoom}
          onChange={(e) => setZoom(parseFloat(e.target.value))}
          style={{ flex: 1, accentColor: '#2dd4bf' }}
        />
        <button
          type="button"
          onClick={() => setZoom((z) => Math.min(4, +(z + 0.2).toFixed(2)))}
          aria-label="Zoom in"
          style={zoomBtnStyle}
        >
          <ZoomIn size={16} />
        </button>
      </div>

      {/* Bottom action row — крупная кнопка для пальца */}
      <div style={{ padding: '4px 16px 16px', background: '#000' }}>
        <button
          type="button"
          onClick={apply}
          disabled={!area || busy}
          style={{
            width: '100%',
            padding: '14px',
            borderRadius: 999,
            border: 'none',
            background: !area || busy ? 'rgba(255,255,255,0.15)' : '#fff',
            color: !area || busy ? 'rgba(255,255,255,0.5)' : '#000',
            fontSize: 15,
            fontWeight: 700,
            cursor: !area || busy ? 'wait' : 'pointer',
            fontFamily: 'inherit',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
          }}
        >
          {busy ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
          {busy ? applyingLabel : applyLabel}
        </button>
        <button
          type="button"
          onClick={onClose}
          style={{
            width: '100%',
            marginTop: 8,
            padding: '12px',
            borderRadius: 999,
            border: 'none',
            background: 'transparent',
            color: 'rgba(255,255,255,0.7)',
            fontSize: 14,
            fontWeight: 600,
            cursor: 'pointer',
            fontFamily: 'inherit',
          }}
        >
          {cancelLabel}
        </button>
      </div>
    </div>
  );
}

const zoomBtnStyle: React.CSSProperties = {
  width: 36,
  height: 36,
  borderRadius: 8,
  border: '1px solid rgba(255,255,255,0.2)',
  background: 'rgba(255,255,255,0.08)',
  color: '#fff',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  cursor: 'pointer',
};

/* ─── Image crop helpers ─── */

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

async function cropToBlob(src: string, area: Area, outputSize: number): Promise<Blob> {
  const img = await loadImage(src);
  const canvas = document.createElement('canvas');
  // Аватар квадратный — outputSize × outputSize (или меньше, если фрейм мельче)
  const target = Math.min(outputSize, Math.round(area.width));
  canvas.width = target;
  canvas.height = target;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('no 2d ctx');
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, area.x, area.y, area.width, area.height, 0, 0, target, target);
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('toBlob failed'))),
      'image/webp',
      0.92,
    );
  });
}
