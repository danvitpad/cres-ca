/** --- YAML
 * name: SalonInlineCoverBanner
 * description: Cover-баннер сверху публичной страницы салона.
 *              Client view: image cover если есть, иначе ничего.
 *              Owner view: pencil + dashed CTA если пусто.
 *              Загрузка в Supabase storage `avatars` → public URL → salons.cover_url.
 * created: 2026-04-26
 * --- */

'use client';

import { useRef, useState } from 'react';
import Image from 'next/image';
import { Pencil, Plus, Loader2, Trash2, ImagePlus } from 'lucide-react';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';
import { useIsSalonOwner } from './use-is-salon-owner';
import { InlineEditSheet } from '@/components/master/inline/inline-edit-sheet';
import { ImageCropDialog } from '@/components/ui/image-crop-dialog';

interface Props {
  salonId: string;
  salonOwnerId: string;
  initialCoverUrl: string | null;
}

export function SalonInlineCoverBanner({ salonId, salonOwnerId, initialCoverUrl }: Props) {
  const isOwner = useIsSalonOwner(salonOwnerId);
  const [coverUrl, setCoverUrl] = useState<string | null>(initialCoverUrl);
  const [open, setOpen] = useState(false);
  const [draftUrl, setDraftUrl] = useState<string | null>(coverUrl);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [cropSrc, setCropSrc] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function startEdit() {
    setDraftUrl(coverUrl);
    setOpen(true);
  }

  async function uploadBlob(blob: Blob): Promise<string | null> {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;
    const path = `${user.id}/salon-cover-${Date.now()}.webp`;
    const { error } = await supabase.storage.from('avatars').upload(path, blob, {
      contentType: blob.type,
      cacheControl: '3600',
      upsert: false,
    });
    if (error) {
      toast.error(`Не удалось загрузить: ${error.message}`);
      return null;
    }
    return supabase.storage.from('avatars').getPublicUrl(path).data.publicUrl;
  }

  function onFilePicked(file: File | null) {
    if (!file) return;
    if (!file.type.startsWith('image/')) return;
    if (file.size > 8 * 1024 * 1024) { toast.error('Файл больше 8 MB'); return; }
    setCropSrc(URL.createObjectURL(file));
  }

  async function onCropApplied(blob: Blob) {
    setUploading(true);
    const url = await uploadBlob(blob);
    setUploading(false);
    if (url) setDraftUrl(url);
  }

  async function save() {
    setSaving(true);
    try {
      const supabase = createClient();
      const { error } = await supabase
        .from('salons')
        .update({ cover_url: draftUrl })
        .eq('id', salonId);
      if (error) {
        toast.error(error.message || 'Не удалось сохранить');
        return;
      }
      setCoverUrl(draftUrl);
      toast.success('Сохранено');
      setOpen(false);
    } finally {
      setSaving(false);
    }
  }

  const sheet = (
    <InlineEditSheet
      open={open}
      onClose={() => setOpen(false)}
      title="Обложка салона"
      footer={
        <div className="flex justify-end gap-2">
          <button type="button" onClick={() => setOpen(false)} className="rounded-[var(--brand-radius-lg)] border border-neutral-200 px-5 py-2 text-[13px] font-semibold text-neutral-700 hover:bg-neutral-50">
            Отмена
          </button>
          <button type="button" onClick={save} disabled={saving} className="inline-flex items-center gap-1.5 rounded-[var(--brand-radius-lg)] bg-neutral-900 px-5 py-2 text-[13px] font-semibold text-white disabled:opacity-50">
            {saving && <Loader2 className="size-3.5 animate-spin" />}
            Сохранить
          </button>
        </div>
      }
    >
      <p className="mb-4 text-[13px] text-neutral-500">Большое фото в шапке страницы салона. Рекомендуем 16:9.</p>

      <input ref={fileInputRef} type="file" accept="image/*" hidden onChange={(e) => { onFilePicked(e.target.files?.[0] ?? null); e.target.value = ''; }} />
      <ImageCropDialog
        open={!!cropSrc}
        src={cropSrc}
        onClose={() => { if (cropSrc) URL.revokeObjectURL(cropSrc); setCropSrc(null); }}
        onCropped={onCropApplied}
        title="Обложка салона"
        aspect={16 / 9}
        shape="rect"
        outputSize={1600}
      />

      <div className="relative mb-4 overflow-hidden rounded-2xl bg-neutral-100" style={{ aspectRatio: '16 / 9' }}>
        {draftUrl ? (
          <Image src={draftUrl} alt="" fill className="object-cover" />
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

      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-[var(--brand-radius-lg)] border border-neutral-200 bg-white px-4 py-2.5 text-[13px] font-semibold text-neutral-900 hover:bg-neutral-50 disabled:opacity-50"
        >
          <ImagePlus className="size-4" />
          {draftUrl ? 'Заменить фото' : 'Загрузить фото'}
        </button>
        {draftUrl && (
          <button
            type="button"
            onClick={() => setDraftUrl(null)}
            className="inline-flex items-center justify-center gap-1.5 rounded-[var(--brand-radius-lg)] border border-neutral-200 bg-white px-4 py-2.5 text-[13px] font-semibold text-rose-700 hover:bg-rose-50"
          >
            <Trash2 className="size-4" />
            Убрать
          </button>
        )}
      </div>
    </InlineEditSheet>
  );

  if (!coverUrl && !isOwner) return null;

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

  return (
    <div className="relative">
      <div className="relative h-40 w-full overflow-hidden bg-neutral-100 sm:h-52 lg:h-64">
        <Image src={coverUrl!} alt="" fill priority className="object-cover" sizes="100vw" />
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
