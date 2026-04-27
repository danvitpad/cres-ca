/** --- YAML
 * name: SalonInlineLogoEdit
 * description: Wraps salon hero logo with a small camera badge for owner.
 *              Click → upload to storage → save salons.logo_url.
 *              Render-prop pattern: caller renders the logo display, we add the badge.
 * created: 2026-04-26
 * --- */

'use client';

import { useRef, useState, type ReactNode } from 'react';
import { Loader2, Camera } from 'lucide-react';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';
import { useIsSalonOwner } from './use-is-salon-owner';
import { humanizeError } from '@/lib/format/error';
import { ImageCropDialog } from '@/components/ui/image-crop-dialog';

interface Props {
  salonId: string;
  salonOwnerId: string;
  initialLogoUrl: string | null;
  /** Render-prop: receives the current display URL (initial or after upload). */
  children: (logoUrl: string | null) => ReactNode;
}

export function SalonInlineLogoEdit({ salonId, salonOwnerId, initialLogoUrl, children }: Props) {
  const isOwner = useIsSalonOwner(salonOwnerId);
  const [logoUrl, setLogoUrl] = useState<string | null>(initialLogoUrl);
  const [uploading, setUploading] = useState(false);
  const [cropSrc, setCropSrc] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function onFilePicked(file: File | null) {
    if (!file) return;
    if (!file.type.startsWith('image/')) return;
    if (file.size > 8 * 1024 * 1024) { toast.error('Файл больше 8 MB'); return; }
    setCropSrc(URL.createObjectURL(file));
  }

  async function onCropped(blob: Blob) {
    setUploading(true);
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const path = `${user.id}/salon-logo-${Date.now()}.webp`;
      const { error } = await supabase.storage.from('avatars').upload(path, blob, {
        contentType: blob.type,
        cacheControl: '3600',
        upsert: false,
      });
      if (error) {
        toast.error(`Не удалось загрузить: ${error.message}`);
        return;
      }
      const url = supabase.storage.from('avatars').getPublicUrl(path).data.publicUrl;
      const { error: dbError } = await supabase
        .from('salons')
        .update({ logo_url: url })
        .eq('id', salonId);
      if (dbError) {
        toast.error(humanizeError(dbError));
        return;
      }
      setLogoUrl(url);
      toast.success('Логотип обновлён');
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="relative inline-block">
      {children(logoUrl)}
      {isOwner && (
        <>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            hidden
            onChange={(e) => { onFilePicked(e.target.files?.[0] ?? null); e.target.value = ''; }}
          />
          <ImageCropDialog
            open={!!cropSrc}
            src={cropSrc}
            onClose={() => { if (cropSrc) URL.revokeObjectURL(cropSrc); setCropSrc(null); }}
            onCropped={onCropped}
            title="Логотип салона"
            aspect={1}
            shape="round"
            outputSize={512}
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="absolute -bottom-1 -right-1 flex size-7 items-center justify-center rounded-full border-2 border-white bg-neutral-900 text-white shadow-md transition-colors hover:bg-neutral-800 disabled:opacity-60"
            aria-label="Изменить логотип"
            title="Изменить логотип"
          >
            {uploading ? <Loader2 className="size-3 animate-spin" /> : <Camera className="size-3" />}
          </button>
        </>
      )}
    </div>
  );
}
