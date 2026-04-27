/** --- YAML
 * name: InlineAvatarEdit
 * description: Wrapper аватара в hero card с inline-загрузкой для владельца.
 *              Pencil/camera-icon в правом нижнем углу аватара. Click → файл-пикер.
 *              Загрузка в storage `avatars`, обновление profiles.avatar_url.
 *              Для клиента — обычный MasterAvatar.
 * created: 2026-04-26
 * --- */

'use client';

import { useRef, useState } from 'react';
import { Camera, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';
import { MasterAvatar } from '../master-avatar';
import { useIsOwner } from './use-is-owner';
import { ImageCropDialog } from '@/components/ui/image-crop-dialog';

interface Props {
  masterProfileId: string | null;
  initialUrl: string | null;
  name: string;
  /** Tailwind size class — used both for outer wrapper and avatar itself */
  className?: string;
}

export function InlineAvatarEdit({ masterProfileId, initialUrl, name, className }: Props) {
  const isOwner = useIsOwner(masterProfileId);
  const [url, setUrl] = useState<string | null>(initialUrl);
  const [busy, setBusy] = useState(false);
  const [cropSrc, setCropSrc] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  function onFilePicked(file: File | null) {
    if (!file) return;
    if (file.size > 8 * 1024 * 1024) {
      toast.error('Файл больше 8 MB');
      return;
    }
    if (!file.type.startsWith('image/')) return;
    setCropSrc(URL.createObjectURL(file));
  }

  async function onCropped(blob: Blob) {
    setBusy(true);
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const path = `${user.id}/avatar-${Date.now()}.webp`;
      const { error: upErr } = await supabase.storage.from('avatars').upload(path, blob, {
        contentType: blob.type,
        cacheControl: '3600',
        upsert: false,
      });
      if (upErr) {
        toast.error(`Не удалось загрузить: ${upErr.message}`);
        return;
      }
      const publicUrl = supabase.storage.from('avatars').getPublicUrl(path).data.publicUrl;
      const { error: updErr } = await supabase
        .from('profiles')
        .update({ avatar_url: publicUrl })
        .eq('id', user.id);
      if (updErr) {
        toast.error(updErr.message || 'Не удалось обновить профиль');
        return;
      }
      setUrl(publicUrl);
      toast.success('Аватар обновлён');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={'relative ' + (className ?? '')}>
      <MasterAvatar url={url} name={name} />
      {isOwner && (
        <>
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            hidden
            onChange={(e) => { onFilePicked(e.target.files?.[0] ?? null); e.target.value = ''; }}
          />
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={busy}
            className="absolute -bottom-1 -right-1 flex size-9 items-center justify-center rounded-full border-2 border-white bg-neutral-900 text-white shadow-md transition-transform hover:scale-105 disabled:opacity-60"
            aria-label="Сменить аватар"
            title="Сменить аватар"
          >
            {busy ? <Loader2 className="size-4 animate-spin" /> : <Camera className="size-4" />}
          </button>
          <ImageCropDialog
            open={!!cropSrc}
            src={cropSrc}
            onClose={() => { if (cropSrc) URL.revokeObjectURL(cropSrc); setCropSrc(null); }}
            onCropped={onCropped}
            title="Аватар"
            aspect={1}
            shape="round"
            outputSize={512}
          />
        </>
      )}
    </div>
  );
}
