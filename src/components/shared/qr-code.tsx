/** --- YAML
 * name: QRCode
 * description: QR code generator for master booking URLs with download and share options
 * --- */

'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Download, Share2, Copy, Check } from 'lucide-react';
import QRCodeLib from 'qrcode';

interface QRCodeProps {
  url: string;
  size?: number;
  label?: string;
}

export function QRCode({ url, size = 256, label }: QRCodeProps) {
  const t = useTranslations('qrCode');
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!canvasRef.current) return;
    QRCodeLib.toCanvas(canvasRef.current, url, {
      width: size,
      margin: 2,
      color: { dark: '#000000', light: '#ffffff' },
    });
  }, [url, size]);

  const downloadPng = useCallback(() => {
    if (!canvasRef.current) return;
    const link = document.createElement('a');
    link.download = 'qr-code.png';
    link.href = canvasRef.current.toDataURL('image/png');
    link.click();
  }, []);

  async function copyUrl() {
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function share() {
    if (!canvasRef.current) return;
    if (navigator.share) {
      try {
        canvasRef.current.toBlob(async (blob) => {
          if (!blob) return;
          const file = new File([blob], 'qr-code.png', { type: 'image/png' });
          await navigator.share({ title: label ?? 'CRES-CA', files: [file] });
        });
      } catch {
        // User cancelled share
      }
    }
  }

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="rounded-xl border bg-white p-3 shadow-[var(--shadow-card)]">
        <canvas ref={canvasRef} />
      </div>
      {label && <p className="text-sm font-medium text-muted-foreground">{label}</p>}
      <div className="flex gap-2">
        <button
          onClick={downloadPng}
          className="inline-flex items-center gap-1.5 rounded-[var(--radius-button)] border px-3 py-1.5 text-xs font-medium transition-colors hover:bg-muted"
        >
          <Download className="h-3.5 w-3.5" />
          PNG
        </button>
        <button
          onClick={copyUrl}
          className="inline-flex items-center gap-1.5 rounded-[var(--radius-button)] border px-3 py-1.5 text-xs font-medium transition-colors hover:bg-muted"
        >
          {copied ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
          {copied ? t('copied') : t('copyLink')}
        </button>
        {'share' in navigator && (
          <button
            onClick={share}
            className="inline-flex items-center gap-1.5 rounded-[var(--radius-button)] border px-3 py-1.5 text-xs font-medium transition-colors hover:bg-muted"
          >
            <Share2 className="h-3.5 w-3.5" />
            {t('share')}
          </button>
        )}
      </div>
    </div>
  );
}
