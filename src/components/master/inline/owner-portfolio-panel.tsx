/** --- YAML
 * name: OwnerPortfolioPanel
 * description: Единый блок «Работы» на публичной странице. Для всех: квадратная
 *              сетка 3×N с лайтбоксом (стрелки + ESC). Для владельца: кнопка
 *              «Добавить» открывает попап с превью 9:16 (drag = пан, scroll = зум),
 *              удаление через корзинку на превью. Позиция и зум сохраняются в DB
 *              (item_x, item_y, item_scale) — кадрирование без потери оригинала.
 * created: 2026-05-02
 * updated: 2026-05-05
 * --- */

'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { Plus, Trash2, Loader2, ImagePlus, ChevronLeft, ChevronRight, X } from 'lucide-react';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';
import { useConfirm } from '@/hooks/use-confirm';
import { InlineEditSheet } from './inline-edit-sheet';

interface PortfolioItem {
  id: string;
  image_url: string;
  caption: string | null;
  item_x: number | null;
  item_y: number | null;
  item_scale: number | null;
}

export function OwnerPortfolioPanel({
  masterProfileId,
  masterId,
  initialItems,
}: {
  masterProfileId: string | null;
  masterId: string;
  initialItems: PortfolioItem[];
}) {
  const [isOwner, setIsOwner] = useState(false);
  const [items, setItems] = useState<PortfolioItem[]>(initialItems);
  const [open, setOpen] = useState(false);
  const [lightboxIdx, setLightboxIdx] = useState<number | null>(null);

  // Upload draft state
  const [draftFile, setDraftFile] = useState<File | null>(null);
  const [draftUrl, setDraftUrl] = useState<string | null>(null);
  const [draftX, setDraftX] = useState(50);
  const [draftY, setDraftY] = useState(50);
  const [draftScale, setDraftScale] = useState(1);
  const [draftCaption, setDraftCaption] = useState('');
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ lastX: number; lastY: number } | null>(null);
  const confirm = useConfirm();

  useEffect(() => {
    if (!masterProfileId) return;
    createClient().auth.getUser().then(({ data }) => {
      if (data.user?.id === masterProfileId) setIsOwner(true);
    });
  }, [masterProfileId]);

  // Object URL for local preview of picked file
  useEffect(() => {
    if (!draftFile) { setDraftUrl(null); return; }
    const url = URL.createObjectURL(draftFile);
    setDraftUrl(url);
    setDraftX(50); setDraftY(50); setDraftScale(1);
    return () => URL.revokeObjectURL(url);
  }, [draftFile]);

  // Non-passive wheel listener — zoom without page scroll
  useEffect(() => {
    if (!open) return;
    const el = previewRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      setDraftScale(s => Math.max(1, Math.min(4, s + (e.deltaY > 0 ? -0.08 : 0.08))));
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [open]);

  // Lightbox keyboard nav
  const closeLightbox = useCallback(() => setLightboxIdx(null), []);
  const prev = useCallback(() => setLightboxIdx(i => i === null ? null : (i - 1 + items.length) % items.length), [items.length]);
  const next = useCallback(() => setLightboxIdx(i => i === null ? null : (i + 1) % items.length), [items.length]);

  useEffect(() => {
    if (lightboxIdx === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeLightbox();
      else if (e.key === 'ArrowLeft') prev();
      else if (e.key === 'ArrowRight') next();
    };
    window.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = prevOverflow; };
  }, [lightboxIdx, closeLightbox, prev, next]);

  function startAdd() {
    setDraftFile(null);
    setDraftUrl(null);
    setDraftX(50); setDraftY(50); setDraftScale(1);
    setDraftCaption('');
    setOpen(true);
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
    dragRef.current = { lastX: e.clientX, lastY: e.clientY };
    setDraftX(x => Math.max(0, Math.min(100, x - dx)));
    setDraftY(y => Math.max(0, Math.min(100, y - dy)));
  }

  function handlePointerUp() { dragRef.current = null; }

  function onFilePicked(file: File | null) {
    if (!file) return;
    if (!file.type.startsWith('image/')) return;
    if (file.size > 15 * 1024 * 1024) { toast.error('Файл больше 15 MB'); return; }
    setDraftFile(file);
  }

  async function save() {
    if (!draftFile || !masterProfileId) return;
    setSaving(true);
    try {
      const supabase = createClient();
      const ext = draftFile.type === 'image/png' ? 'png' : draftFile.type === 'image/gif' ? 'gif' : 'jpg';
      const path = `${masterProfileId}/${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from('portfolio').upload(path, draftFile, {
        contentType: draftFile.type, cacheControl: '3600', upsert: false,
      });
      if (upErr) { toast.error(`Ошибка загрузки: ${upErr.message}`); return; }
      const imageUrl = supabase.storage.from('portfolio').getPublicUrl(path).data.publicUrl;

      const { data: row, error: insErr } = await supabase
        .from('master_portfolio')
        .insert({
          master_id: masterId,
          image_url: imageUrl,
          caption: draftCaption.trim() || null,
          tags: [],
          is_published: true,
          item_x: draftX,
          item_y: draftY,
          item_scale: draftScale,
        })
        .select('id, image_url, caption, item_x, item_y, item_scale')
        .single();

      if (insErr || !row) { toast.error(insErr?.message ?? 'Не удалось сохранить'); return; }

      setItems(prev => [row as PortfolioItem, ...prev]);
      toast.success('Работа добавлена');
      setOpen(false);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    const ok = await confirm({
      title: 'Удалить работу?',
      description: 'Фото исчезнет с публичной страницы. Действие нельзя отменить.',
      confirmLabel: 'Удалить',
      destructive: true,
    });
    if (!ok) return;
    setDeletingId(id);
    try {
      const { error } = await createClient().from('master_portfolio').delete().eq('id', id);
      if (error) { toast.error(error.message); return; }
      setItems(prev => prev.filter(x => x.id !== id));
      toast.success('Удалено');
    } finally {
      setDeletingId(null);
    }
  }

  const hasItems = items.length > 0;
  const activeItem = lightboxIdx !== null ? items[lightboxIdx] : null;

  if (!hasItems && !isOwner) return null;

  return (
    <section>
      {/* Section header */}
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-[22px] font-bold text-neutral-900">Работы</h2>
        {isOwner && (
          <button
            type="button"
            onClick={startAdd}
            className="inline-flex items-center gap-1.5 rounded-full border border-neutral-200 bg-white px-3 py-1.5 text-[13px] font-semibold text-neutral-900 hover:bg-neutral-50"
          >
            <Plus className="size-3.5" />
            Добавить
          </button>
        )}
      </div>

      {/* Owner empty-state CTA */}
      {!hasItems && isOwner && (
        <button
          type="button"
          onClick={startAdd}
          className="group flex w-full items-start gap-4 rounded-2xl p-5 text-left transition-colors"
          style={{
            background: 'var(--m-accent-soft)',
            border: '1.5px solid color-mix(in oklab, var(--m-accent) 30%, transparent)',
          }}
        >
          <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-neutral-100 text-neutral-700 group-hover:bg-neutral-900 group-hover:text-white">
            <Plus className="size-5" />
          </span>
          <span className="flex-1">
            <span className="block text-[15px] font-bold text-neutral-900">Добавь работы в портфолио</span>
            <span className="mt-1 block text-[13px] text-neutral-500">
              Фотографии работ — клиенты выбирают глазами. Рекомендуем формат 9:16.
            </span>
          </span>
        </button>
      )}

      {/* Square grid */}
      {hasItems && (
        <div className="grid grid-cols-3 gap-1.5">
          {items.map((item, idx) => {
            const x = item.item_x ?? 50;
            const y = item.item_y ?? 50;
            const s = item.item_scale ?? 1;
            return (
              <div key={item.id} className="group relative aspect-square overflow-hidden rounded-xl bg-neutral-100">
                <button
                  type="button"
                  onClick={() => setLightboxIdx(idx)}
                  className="absolute inset-0"
                  aria-label={item.caption ?? 'Работа'}
                >
                  <Image
                    src={item.image_url}
                    alt={item.caption ?? ''}
                    fill
                    sizes="(max-width: 640px) 33vw, 200px"
                    className="object-cover pointer-events-none transition-transform group-hover:scale-105"
                    style={{
                      objectPosition: `${x}% ${y}%`,
                      transform: s !== 1 ? `scale(${s})` : undefined,
                      transformOrigin: `${x}% ${y}%`,
                    }}
                  />
                </button>
                {isOwner && (
                  <button
                    type="button"
                    onClick={() => handleDelete(item.id)}
                    disabled={deletingId === item.id}
                    className="absolute right-1.5 top-1.5 flex size-7 items-center justify-center rounded-full bg-white/90 text-rose-600 opacity-0 shadow transition-opacity group-hover:opacity-100 hover:bg-white"
                    aria-label="Удалить"
                  >
                    {deletingId === item.id
                      ? <Loader2 className="size-3.5 animate-spin" />
                      : <Trash2 className="size-3.5" />}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Upload sheet */}
      <InlineEditSheet
        open={open}
        onClose={() => setOpen(false)}
        title="Новая работа"
        footer={
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setOpen(false)} className="cres-popup-btn-cancel">
              Отмена
            </button>
            <button
              type="button"
              onClick={save}
              disabled={!draftFile || saving}
              className="cres-popup-btn-save"
            >
              {saving && <Loader2 className="size-3.5 animate-spin" />}
              Добавить
            </button>
          </div>
        }
      >
        <p className="mb-3 text-[13px] text-neutral-500">
          Формат 9:16 — идеально для работ. Потяни фото чтобы выбрать кадр, скролл — зум.
        </p>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          hidden
          onChange={(e) => { onFilePicked(e.target.files?.[0] ?? null); e.target.value = ''; }}
        />

        {/* 9:16 preview with drag+zoom */}
        <div
          ref={previewRef}
          className="relative mx-auto mb-3 overflow-hidden rounded-2xl bg-neutral-100 select-none"
          style={{
            aspectRatio: '9 / 16',
            maxHeight: '55vh',
            cursor: draftUrl ? (dragRef.current ? 'grabbing' : 'grab') : 'default',
          }}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerLeave={handlePointerUp}
        >
          {draftUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={draftUrl}
              alt=""
              draggable={false}
              className="absolute inset-0 size-full object-cover pointer-events-none"
              style={{
                objectPosition: `${draftX}% ${draftY}%`,
                transform: `scale(${draftScale})`,
                transformOrigin: `${draftX}% ${draftY}%`,
              }}
            />
          ) : (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex h-full w-full flex-col items-center justify-center gap-2 text-neutral-400 hover:text-neutral-600"
            >
              <ImagePlus className="size-8" />
              <span className="text-[13px] font-medium">Выбрать фото</span>
            </button>
          )}
        </div>

        {/* Replace photo + caption */}
        <div className="space-y-2">
          {draftUrl && (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex w-full items-center justify-center gap-1.5 rounded-full border border-neutral-200 bg-white px-4 py-2.5 text-[13px] font-semibold text-neutral-900 hover:bg-neutral-50"
            >
              <ImagePlus className="size-4" />
              Заменить фото
            </button>
          )}
          <input
            type="text"
            value={draftCaption}
            onChange={(e) => setDraftCaption(e.target.value)}
            placeholder="Подпись (необязательно)"
            maxLength={200}
            className="block w-full rounded-xl border border-neutral-200 bg-white px-3 py-2.5 text-[14px] text-neutral-900 outline-none focus:border-neutral-400"
          />
        </div>
      </InlineEditSheet>

      {/* Lightbox */}
      {activeItem && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-[300] flex items-center justify-center bg-black/90 p-4"
          onClick={closeLightbox}
        >
          <button
            type="button"
            aria-label="Закрыть"
            onClick={closeLightbox}
            className="absolute right-4 top-4 rounded-full bg-white/10 p-2 text-white backdrop-blur hover:bg-white/20"
          >
            <X className="size-5" />
          </button>
          {items.length > 1 && (
            <>
              <button
                type="button"
                aria-label="Предыдущее"
                onClick={(e) => { e.stopPropagation(); prev(); }}
                className="absolute left-4 top-1/2 -translate-y-1/2 rounded-full bg-white/10 p-2 text-white backdrop-blur hover:bg-white/20"
              >
                <ChevronLeft className="size-6" />
              </button>
              <button
                type="button"
                aria-label="Следующее"
                onClick={(e) => { e.stopPropagation(); next(); }}
                className="absolute right-4 top-1/2 -translate-y-1/2 rounded-full bg-white/10 p-2 text-white backdrop-blur hover:bg-white/20"
              >
                <ChevronRight className="size-6" />
              </button>
            </>
          )}
          <div
            className="relative max-h-[90vh] max-w-[90vw]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={activeItem.image_url}
              alt={activeItem.caption ?? ''}
              className="max-h-[88vh] max-w-[88vw] rounded-xl object-contain shadow-2xl"
            />
            {activeItem.caption && (
              <div className="mt-3 text-center text-sm text-white">{activeItem.caption}</div>
            )}
            {items.length > 1 && (
              <div className="mt-2 text-center text-xs text-white/50">
                {lightboxIdx! + 1} / {items.length}
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
