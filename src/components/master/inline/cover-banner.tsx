/** --- YAML
 * name: InlineCoverBanner
 * description: Cover-баннер сверху публичной страницы. Для клиента: image cover если
 *              есть, иначе ничего не рендерится. Для владельца: image + pencil + редактор
 *              позиции и зума прямо в попапе (drag для пан, scroll для зума).
 *              Загрузка в Supabase storage `avatars` → public URL. Пропорции превью
 *              соответствуют реальному баннеру на странице.
 * created: 2026-04-26
 * updated: 2026-05-05
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
  initialBannerX?: number | null;
  initialBannerScale?: number | null;
}

export function InlineCoverBanner({ masterId, masterProfileId, initialCoverUrl, initialBannerY, initialBannerX, initialBannerScale }: Props) {
  const isOwner = useIsOwner(masterProfileId);
  const [coverUrl, setCoverUrl] = useState<string | null>(initialCoverUrl);
  const [bannerY, setBannerY] = useState(initialBannerY ?? 50);
  const [bannerX, setBannerX] = useState(initialBannerX ?? 50);
  const [bannerScale, setBannerScale] = useState(initialBannerScale ?? 1);
  const [open, setOpen] = useState(false);
  const [draftY, setDraftY] = useState(bannerY);
  const [draftX, setDraftX] = useState(bannerX);
  const [draftScale, setDraftScale] = useState(bannerScale);
  const [draftUrl, setDraftUrl] = useState<string | null>(coverUrl);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ lastX: number; lastY: number } | null>(null);

  function startEdit() {
    setDraftY(bannerY);
    setDraftX(bannerX);
    setDraftScale(bannerScale);
    setDraftUrl(coverUrl);
    setOpen(true);
  }

  async function uploadFile(file: File): Promise<string | null> {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;
    const ext = file.type === 'image/png' ? 'png' : file.type === 'image/gif' ? 'gif' : 'jpg';
    const path = `${user.id}/cover-${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from('avatars').upload(path, file, {
      contentType: file.type,
      cacheControl: '3600',
      upsert: false,
    });
    if (error) {
      toast.error(`Не удалось загрузить: ${error.message}`);
      return null;
    }
    return supabase.storage.from('avatars').getPublicUrl(path).data.publicUrl;
  }

  async function onFilePicked(file: File | null) {
    if (!file) return;
    if (!file.type.startsWith('image/')) return;
    if (file.size > 8 * 1024 * 1024) { toast.error('Файл больше 8 MB'); return; }
    setUploading(true);
    const url = await uploadFile(file);
    setUploading(false);
    if (url) {
      setDraftUrl(url);
      setDraftX(50);
      setDraftY(50);
      setDraftScale(1);
    }
  }

  function handlePointerDown(e: React.PointerEvent<HTMLDivElement>) {
    if (!draftUrl) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    dragRef.current = { lastX: e.clientX, lastY: e.clientY };
  }

  function handlePointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (!dragRef.current || !previewRef.current) return;
    const rect = previewRef.current.getBoundingClientRect();
    const dx = (e.clientX - dragRef.current.lastX) / rect.width * 100;
    const dy = (e.clientY - dragRef.current.lastY) / rect.height * 100;
    dragRef.current.lastX = e.clientX;
    dragRef.current.lastY = e.clientY;
    setDraftX(x => Math.max(0, Math.min(100, x - dx)));
    setDraftY(y => Math.max(0, Math.min(100, y - dy)));
  }

  function handlePointerUp() {
    dragRef.current = null;
  }

  function handleWheel(e: React.WheelEvent<HTMLDivElement>) {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.08 : 0.08;
    setDraftScale(s => Math.max(1, Math.min(4, s + delta)));
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
          banner_position_x: draftX,
          banner_scale: draftScale,
        })
        .eq('id', masterId);
      if (error) {
        toast.error(error.message || 'Не удалось сохранить');
        return;
      }
      setCoverUrl(draftUrl);
      setBannerY(draftY);
      setBannerX(draftX);
      setBannerScale(draftScale);
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
      title="Обложка профиля"
      footer={
        <div className="flex justify-end gap-2">
          <button type="button" onClick={() => setOpen(false)} className="cres-popup-btn-cancel">
            Отмена
          </button>
          <button type="button" onClick={save} disabled={saving || uploading} className="cres-popup-btn-save">
            {saving && <Loader2 className="size-3.5 animate-spin" />}
            Сохранить
          </button>
        </div>
      }
    >
      <p className="mb-3 text-[13px] text-neutral-500">
        Большое фото на шапке страницы. Лицо твоего бренда. Рекомендуем 16:9.
      </p>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => { void onFilePicked(e.target.files?.[0] ?? null); e.target.value = ''; }}
      />

      {/* Preview — aspect ratio ~4:1 как реальный баннер. Drag для пан, scroll для зума. */}
      <div
        ref={previewRef}
        className="relative mb-3 overflow-hidden rounded-2xl bg-neutral-100 select-none"
        style={{ aspectRatio: '4 / 1', cursor: draftUrl ? (dragRef.current ? 'grabbing' : 'grab') : 'default' }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
        onWheel={handleWheel}
      >
        {draftUrl ? (
          <Image
            src={draftUrl}
            alt=""
            fill
            draggable={false}
            className="object-cover pointer-events-none"
            style={{
              objectPosition: `${draftX}% ${draftY}%`,
              transform: `scale(${draftScale})`,
              transformOrigin: `${draftX}% ${draftY}%`,
            }}
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
        {draftUrl && !uploading && (
          <p className="absolute bottom-2 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-black/50 px-3 py-1 text-[11px] text-white backdrop-blur-sm pointer-events-none">
            Потяни · Скролл для зума · {Math.round(draftScale * 100)}%
          </p>
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
            onClick={() => { setDraftUrl(null); setDraftX(50); setDraftY(50); setDraftScale(1); }}
            className="inline-flex items-center justify-center gap-1.5 rounded-full border border-neutral-200 bg-white px-4 py-2.5 text-[13px] font-semibold text-rose-700 hover:bg-rose-50"
          >
            <Trash2 className="size-4" />
            Убрать
          </button>
        )}
      </div>
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
          className="group flex h-32 w-full items-center justify-center gap-3 transition-colors sm:h-44"
          style={{
            background: 'var(--m-bg-subtle)',
            color: 'var(--m-text-secondary)',
            borderTop: '1px solid var(--m-border)',
            borderBottom: '1px solid var(--m-border)',
          }}
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
          style={{
            objectPosition: `${bannerX}% ${bannerY}%`,
            transform: bannerScale !== 1 ? `scale(${bannerScale})` : undefined,
            transformOrigin: `${bannerX}% ${bannerY}%`,
          }}
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
