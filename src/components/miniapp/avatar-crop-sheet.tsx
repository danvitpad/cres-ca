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
import { X, Check, Loader2 } from 'lucide-react';

interface Props {
  /** ObjectURL картинки или null. !!src управляет видимостью. */
  src: string | null;
  /** Целевой размер выходного фото по короткой стороне (px). */
  outputSize?: number;
  /** Заголовок sheet. */
  title?: string;
  onClose: () => void;
  onCropped: (blob: Blob) => void;
}

export function MiniAppAvatarCropSheet({
  src,
  outputSize = 512,
  title = 'Аватар',
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
            background: !area || busy ? 'rgba(255,255,255,0.2)' : '#60a5fa',
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

      {/* Crop area — занимает всё оставшееся пространство.
          Зум через pinch-жест на touch (react-easy-crop поддерживает),
          кнопки/слайдер удалены — UI чистый, только сама картинка с
          круглой рамкой. */}
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
    </div>
  );
}

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
