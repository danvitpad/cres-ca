/** --- YAML
 * name: ImageCropDialog
 * description: Универсальный кроппер для аватаров / лого / баннеров / портфолио.
 *              Открывается когда пользователь выбрал файл, показывает картинку
 *              с реальной рамкой (круг для аватара/лого, прямоугольник с aspect
 *              для баннера), позволяет зумировать (slider + колёсико) и таскать.
 *              По «Применить» возвращает Blob уже обрезанной картинки нужного
 *              размера. Полностью адаптивен (mobile / tablet / desktop).
 * created: 2026-04-27
 * --- */

'use client';

import { useState, useCallback, useEffect } from 'react';
import Cropper, { type Area } from 'react-easy-crop';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ZoomIn, ZoomOut, Check, X } from 'lucide-react';

export type CropShape = 'rect' | 'round';

interface ImageCropDialogProps {
  /** Открыт ли диалог */
  open: boolean;
  /** Source — URL (object URL) выбранной картинки или null */
  src: string | null;
  /** Соотношение сторон (1 = квадрат, 16/9, 3/1 для баннера и т.п.) */
  aspect?: number;
  /** Форма рамки кропа */
  shape?: CropShape;
  /** Заголовок диалога — «Аватар», «Логотип», «Баннер», «Фото портфолио» */
  title?: string;
  /** Целевой размер выходного изображения по короткой стороне (px). По умолчанию 1024 */
  outputSize?: number;
  /** Тип файла — image/jpeg или image/webp. По умолчанию webp (меньше) */
  outputType?: 'image/jpeg' | 'image/webp' | 'image/png';
  /** Качество 0..1 для jpeg/webp. По умолчанию 0.92 */
  outputQuality?: number;
  onClose: () => void;
  onCropped: (blob: Blob) => void;
}

export function ImageCropDialog({
  open,
  src,
  aspect = 1,
  shape = 'rect',
  title = 'Кадрирование',
  outputSize = 1024,
  outputType = 'image/webp',
  outputQuality = 0.92,
  onClose,
  onCropped,
}: ImageCropDialogProps) {
  const [crop, setCrop] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  const [busy, setBusy] = useState(false);

  // Сброс при смене картинки
  useEffect(() => {
    if (open) {
      setCrop({ x: 0, y: 0 });
      setZoom(1);
      setCroppedAreaPixels(null);
    }
  }, [open, src]);

  const onCropComplete = useCallback((_: Area, areaPixels: Area) => {
    setCroppedAreaPixels(areaPixels);
  }, []);

  async function handleApply() {
    if (!src || !croppedAreaPixels) return;
    setBusy(true);
    try {
      const blob = await getCroppedBlob(src, croppedAreaPixels, outputSize, outputType, outputQuality);
      onCropped(blob);
      onClose();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-[min(92vw,640px)] gap-0 p-0 overflow-hidden">
        <DialogHeader className="border-b px-5 py-4">
          <DialogTitle className="text-base">{title}</DialogTitle>
        </DialogHeader>

        {/* Crop surface — adaptive height */}
        <div
          className="relative bg-black"
          style={{ height: 'min(60vh, 480px)' }}
        >
          {src && (
            <Cropper
              image={src}
              crop={crop}
              zoom={zoom}
              aspect={aspect}
              cropShape={shape === 'round' ? 'round' : 'rect'}
              showGrid={shape === 'rect'}
              onCropChange={setCrop}
              onZoomChange={setZoom}
              onCropComplete={onCropComplete}
              minZoom={1}
              maxZoom={4}
              zoomSpeed={0.5}
              objectFit="contain"
              restrictPosition
            />
          )}
        </div>

        {/* Zoom slider */}
        <div className="flex items-center gap-3 border-t px-5 py-4">
          <button
            type="button"
            onClick={() => setZoom((z) => Math.max(1, +(z - 0.2).toFixed(2)))}
            aria-label="Уменьшить"
            className="flex size-9 shrink-0 items-center justify-center rounded-lg border bg-card transition-colors hover:bg-muted"
          >
            <ZoomOut className="size-4" />
          </button>
          <input
            type="range"
            min={1}
            max={4}
            step={0.01}
            value={zoom}
            onChange={(e) => setZoom(parseFloat(e.target.value))}
            className="flex-1 accent-[var(--primary,_#8b5cf6)]"
            aria-label="Зум"
          />
          <button
            type="button"
            onClick={() => setZoom((z) => Math.min(4, +(z + 0.2).toFixed(2)))}
            aria-label="Увеличить"
            className="flex size-9 shrink-0 items-center justify-center rounded-lg border bg-card transition-colors hover:bg-muted"
          >
            <ZoomIn className="size-4" />
          </button>
        </div>

        <DialogFooter className="gap-2 border-t px-5 py-4 sm:gap-2">
          <Button variant="outline" onClick={onClose} disabled={busy}>
            <X className="mr-2 size-4" />
            Отмена
          </Button>
          <Button onClick={handleApply} disabled={!croppedAreaPixels || busy}>
            <Check className="mr-2 size-4" />
            {busy ? 'Применяем…' : 'Применить'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ─── helpers ─── */

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = (e) => reject(e);
    img.src = src;
  });
}

async function getCroppedBlob(
  src: string,
  area: Area,
  outputSize: number,
  type: string,
  quality: number,
): Promise<Blob> {
  const img = await loadImage(src);
  const canvas = document.createElement('canvas');

  // Масштабируем результат: короткая сторона = outputSize, пропорция aspect сохраняется
  const aspect = area.width / area.height;
  let outW: number;
  let outH: number;
  if (aspect >= 1) {
    outH = Math.min(outputSize, area.height);
    outW = Math.round(outH * aspect);
  } else {
    outW = Math.min(outputSize, area.width);
    outH = Math.round(outW / aspect);
  }
  canvas.width = outW;
  canvas.height = outH;

  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('canvas 2d ctx unavailable');

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, area.x, area.y, area.width, area.height, 0, 0, outW, outH);

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('toBlob failed'))),
      type,
      quality,
    );
  });
}

/**
 * Вспомогательная функция — открыть file picker и сразу получить ObjectURL.
 * Используется парно с ImageCropDialog: parent держит src и open в state,
 * вызывает pickImage() в onClick.
 */
export function pickImage(accept = 'image/*'): Promise<{ file: File; url: string } | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = accept;
    input.onchange = () => {
      const f = input.files?.[0];
      if (!f) { resolve(null); return; }
      resolve({ file: f, url: URL.createObjectURL(f) });
    };
    input.oncancel = () => resolve(null);
    input.click();
  });
}
