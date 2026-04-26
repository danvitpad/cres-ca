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
  const inputRef = useRef<HTMLInputElement>(null);

  async function onFile(file: File | null) {
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Файл больше 5 MB');
      return;
    }
    setBusy(true);
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const ext = file.name.split('.').pop() || 'jpg';
      const path = `${user.id}/avatar-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from('avatars').upload(path, file, {
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
            onChange={(e) => onFile(e.target.files?.[0] ?? null)}
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
        </>
      )}
    </div>
  );
}
