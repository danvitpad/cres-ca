/** --- YAML
 * name: InlineCoverBanner
 * description: Cover-баннер сверху публичной страницы. Для клиента: image cover если
 *              есть, иначе ничего не рендерится. Для владельца: image + pencil + slider
 *              позиции Y; если cover пуст — большая dashed-CTA «+ Добавь обложку».
 *              Загрузка в Supabase storage `avatars` → public URL.
 * created: 2026-04-26
 * --- */

'use client';

import { useRef, useState } from 'react';
import Image from 'next/image';
import { Pencil, Plus, Loader2, Trash2, ImagePlus } from 'lucide-react';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';
import { useIsOwner } from './use-is-owner';
import { InlineEditSheet } from './inline-edit-sheet';

interface Props {
  masterId: string;
  masterProfileId: string | null;
  initialCoverUrl: string | null;
  initialBannerY: number | null;
}

export function InlineCoverBanner({ masterId, masterProfileId, initialCoverUrl, initialBannerY }: Props) {
  const isOwner = useIsOwner(masterProfileId);
  const [coverUrl, setCoverUrl] = useState<string | null>(initialCoverUrl);
  const [bannerY, setBannerY] = useState(initialBannerY ?? 50);
  const [open, setOpen] = useState(false);
  const [draftY, setDraftY] = useState(bannerY);
  const [draftUrl, setDraftUrl] = useState<string | null>(coverUrl);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function startEdit() {
    setDraftY(bannerY);
    setDraftUrl(coverUrl);
    setOpen(true);
  }

  async function uploadCover(file: File): Promise<string | null> {
    if (!file) return null;
    if (file.size > 8 * 1024 * 1024) {
      toast.error('Файл больше 8 MB');
      return null;
    }
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;
    const ext = file.name.split('.').pop() || 'jpg';
    const path = `${user.id}/cover-${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from('avatars').upload(path, file, {
      cacheControl: '3600',
      upsert: false,
    });
    if (error) {
      toast.error(`Не удалось загрузить: ${error.message}`);
      return null;
    }
    return supabase.storage.from('avatars').getPublicUrl(path).data.publicUrl;
  }

  async function onFile(file: File | null) {
    if (!file) return;
    setUploading(true);
    const url = await uploadCover(file);
    setUploading(false);
    if (url) setDraftUrl(url);
  }

  async function save() {
    setSaving(true);
    try {
      const supabase = createClient();
      const { error } = await supabase
        .from('masters')
        .update({
          cover_url: draftUrl,
          banner_position_y: draftY,
        })
        .eq('id', masterId);
      if (error) {
        toast.error(error.message || 'Не удалось сохранить');
        return;
      }
      setCoverUrl(draftUrl);
      setBannerY(draftY);
      toast.success('Сохранено');
      setOpen(false);
    } finally {
      setSaving(false);
    }
  }

  async function removeCover() {
    setDraftUrl(null);
  }

  const sheet = (
    <InlineEditSheet
      open={open}
      onClose={() => setOpen(false)}
      title="Обложка профиля"
      footer={
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="rounded-full border border-neutral-200 px-5 py-2 text-[13px] font-semibold text-neutral-700 hover:bg-neutral-50"
          >
            Отмена
          </button>
          <button
            type="button"
            onClick={save}
            disabled={saving}
            className="inline-flex items-center gap-1.5 rounded-full bg-neutral-900 px-5 py-2 text-[13px] font-semibold text-white disabled:opacity-50"
          >
            {saving && <Loader2 className="size-3.5 animate-spin" />}
            Сохранить
          </button>
        </div>
      }
    >
      <p className="mb-4 text-[13px] text-neutral-500">
        Большое фото на шапке страницы. Лицо твоего бренда. Рекомендуем 16:9.
      </p>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => onFile(e.target.files?.[0] ?? null)}
      />

      {/* Preview */}
      <div className="relative mb-4 overflow-hidden rounded-2xl bg-neutral-100" style={{ aspectRatio: '16 / 9' }}>
        {draftUrl ? (
          <Image
            src={draftUrl}
            alt=""
            fill
            className="object-cover"
            style={{ objectPosition: `center ${draftY}%` }}
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-[13px] text-neutral-400">
            Обложка ещё не загружена
          </div>
        )}
        {uploading && (
          <div className="absolute inset-0 flex items-center justify-center bg-white/70">
            <Loader2 className="size-6 animate-spin text-neutral-700" />
          </div>
        )}
      </div>

      {/* Buttons */}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-full border border-neutral-200 bg-white px-4 py-2.5 text-[13px] font-semibold text-neutral-900 hover:bg-neutral-50 disabled:opacity-50"
        >
          <ImagePlus className="size-4" />
          {draftUrl ? 'Заменить фото' : 'Загрузить фото'}
        </button>
        {draftUrl && (
          <button
            type="button"
            onClick={removeCover}
            className="inline-flex items-center justify-center gap-1.5 rounded-full border border-neutral-200 bg-white px-4 py-2.5 text-[13px] font-semibold text-rose-700 hover:bg-rose-50"
          >
            <Trash2 className="size-4" />
            Убрать
          </button>
        )}
      </div>

      {/* Position slider */}
      {draftUrl && (
        <div className="mt-5">
          <label className="mb-2 block text-[12px] font-semibold uppercase tracking-wide text-neutral-500">
            Позиция фото · {Math.round(draftY)}%
          </label>
          <input
            type="range"
            min={0}
            max={100}
            value={draftY}
            onChange={(e) => setDraftY(Number(e.target.value))}
            className="block w-full"
          />
          <p className="mt-1 text-[11px] text-neutral-400">Подвинь, чтобы выбрать какая часть фото видна на шапке.</p>
        </div>
      )}
    </InlineEditSheet>
  );

  // Client view: nothing if no cover
  if (!coverUrl && !isOwner) return null;

  // Owner view: empty state CTA
  if (!coverUrl && isOwner) {
    return (
      <>
        <button
          type="button"
          onClick={startEdit}
          className="group flex h-32 w-full items-center justify-center gap-3 border-y-2 border-dashed border-neutral-300 bg-neutral-50 text-neutral-700 transition-colors hover:border-neutral-900 hover:bg-neutral-100 sm:h-44"
        >
          <Plus className="size-5" />
          <span className="text-[14px] font-semibold">Добавь обложку</span>
        </button>
        {sheet}
      </>
    );
  }

  // Has cover — show image + pencil for owner
  return (
    <div className="relative">
      <div className="relative h-40 w-full overflow-hidden bg-neutral-100 sm:h-52 lg:h-64">
        <Image
          src={coverUrl!}
          alt=""
          fill
          priority
          className="object-cover"
          style={{ objectPosition: `center ${bannerY}%` }}
        />
      </div>
      {isOwner && (
        <button
          type="button"
          onClick={startEdit}
          className="absolute right-3 top-3 inline-flex items-center gap-1.5 rounded-full bg-white/95 px-3 py-1.5 text-[12px] font-semibold text-neutral-900 shadow-sm backdrop-blur hover:bg-white"
        >
          <Pencil className="size-3.5" />
          Изменить
        </button>
      )}
      {sheet}
    </div>
  );
}
