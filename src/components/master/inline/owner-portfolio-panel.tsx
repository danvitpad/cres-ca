/** --- YAML
 * name: OwnerPortfolioPanel
 * description: Wrapper для портфолио на публичной странице мастера —
 *              для владельца показывает кнопку «Добавить работу»
 *              (inline upload form), на существующих work-items появляются
 *              кнопки удаления. Для не-владельца ничего не рендерит.
 *              Не дублирует PortfolioGrid view — он отдельно ниже в layout
 *              (если есть items). Просто даёт owner'у quick-action чтобы
 *              не уходить в /portfolio.
 * created: 2026-05-02
 * --- */

'use client';

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { Plus, Trash2, X, Loader2, Upload, ImagePlus } from 'lucide-react';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';
import { useConfirm } from '@/hooks/use-confirm';

interface PortfolioItem {
  id: string;
  image_url: string;
  caption: string | null;
}

export function OwnerPortfolioPanel({
  masterProfileId,
  initialItems,
}: {
  masterProfileId: string | null;
  initialItems: PortfolioItem[];
}) {
  const [isOwner, setIsOwner] = useState(false);
  const [items, setItems] = useState<PortfolioItem[]>(initialItems);
  const [showForm, setShowForm] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [caption, setCaption] = useState('');
  const [uploading, setUploading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const confirm = useConfirm();

  useEffect(() => {
    if (!masterProfileId) return;
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      if (data.user?.id === masterProfileId) setIsOwner(true);
    });
  }, [masterProfileId]);

  // Preview file
  useEffect(() => {
    if (!file) { setPreview(null); return; }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  if (!isOwner) return null;

  async function handleUpload() {
    if (!file || !masterProfileId) return;
    setUploading(true);
    try {
      const supabase = createClient();
      const { data: master } = await supabase
        .from('masters')
        .select('id')
        .eq('profile_id', masterProfileId)
        .maybeSingle();
      if (!master) { toast.error('Не найден профиль мастера'); return; }

      const ext = file.name.split('.').pop() ?? 'jpg';
      const path = `${masterProfileId}/${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from('portfolio').upload(path, file, {
        cacheControl: '3600', upsert: false,
      });
      if (upErr) { toast.error(`Upload: ${upErr.message}`); return; }
      const { data: pub } = supabase.storage.from('portfolio').getPublicUrl(path);

      const { data: row, error: insErr } = await supabase.from('master_portfolio').insert({
        master_id: (master as { id: string }).id,
        image_url: pub.publicUrl,
        caption: caption.trim() || null,
        tags: [],
        is_published: true,
      }).select('id, image_url, caption').single();
      if (insErr || !row) { toast.error(insErr?.message ?? 'Не удалось сохранить'); return; }

      setItems((prev) => [{
        id: (row as { id: string }).id,
        image_url: (row as { image_url: string }).image_url,
        caption: (row as { caption: string | null }).caption,
      }, ...prev]);
      toast.success('Работа добавлена');
      setFile(null);
      setCaption('');
      setShowForm(false);
    } finally {
      setUploading(false);
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
      const supabase = createClient();
      const { error } = await supabase.from('master_portfolio').delete().eq('id', id);
      if (error) { toast.error(error.message); return; }
      setItems((prev) => prev.filter((x) => x.id !== id));
      toast.success('Удалено');
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <section
      className="rounded-2xl p-4"
      style={{ background: 'var(--m-surface)', border: '1px solid var(--m-border)' }}
    >
      <div className="mb-3 flex items-center justify-between gap-2">
        <h3 className="text-sm font-bold text-neutral-900">
          Управление портфолио
          <span className="ml-1.5 rounded-full bg-neutral-100 px-2 py-0.5 text-[11px] font-semibold text-neutral-600">
            {items.length}
          </span>
        </h3>
        {!showForm && (
          <button
            type="button"
            onClick={() => setShowForm(true)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--ds-accent,#14b8a6)] px-3 py-1.5 text-xs font-semibold text-white hover:opacity-90"
          >
            <Plus className="size-3.5" />
            Добавить работу
          </button>
        )}
      </div>

      {/* Inline upload form */}
      {showForm && (
        <div className="mb-3 rounded-xl border border-neutral-200 bg-neutral-50 p-3">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs font-semibold text-neutral-700">Новая работа</span>
            <button
              type="button"
              onClick={() => { setShowForm(false); setFile(null); setCaption(''); }}
              className="rounded-md p-1 text-neutral-500 hover:bg-neutral-200"
            >
              <X className="size-3.5" />
            </button>
          </div>

          {/* File picker */}
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="relative block h-32 w-full overflow-hidden rounded-lg transition-colors"
            style={{
              background: 'var(--m-bg-subtle)',
              border: '1px dashed var(--m-border)',
            }}
          >
            {preview ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={preview} alt="" className="size-full object-cover" />
            ) : (
              <div className="flex h-full flex-col items-center justify-center gap-1 text-neutral-500">
                <ImagePlus className="size-5" />
                <span className="text-[11px]">Выбрать фото</span>
              </div>
            )}
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              hidden
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
          </button>

          <input
            type="text"
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            placeholder="Подпись (необязательно)"
            maxLength={200}
            className="mt-2 w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-xs outline-none focus:border-[var(--ds-accent,#14b8a6)]"
          />

          <button
            type="button"
            onClick={handleUpload}
            disabled={!file || uploading}
            className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-lg bg-[var(--ds-accent,#14b8a6)] py-2 text-xs font-semibold text-white disabled:opacity-50"
          >
            {uploading ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
            {uploading ? 'Загрузка…' : 'Добавить в портфолио'}
          </button>
        </div>
      )}

      {/* Compact thumbnails grid for owner — for quick delete */}
      {items.length > 0 && (
        <div>
          <p className="mb-2 text-[11px] text-neutral-500">
            Клик корзинки — удалить с публичной страницы.
          </p>
          <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
            {items.slice(0, 12).map((it) => (
              <div key={it.id} className="group relative aspect-square overflow-hidden rounded-md bg-neutral-100">
                <Image
                  src={it.image_url}
                  alt={it.caption ?? ''}
                  fill
                  sizes="100px"
                  className="object-cover"
                />
                <button
                  type="button"
                  onClick={() => handleDelete(it.id)}
                  disabled={deletingId === it.id}
                  className="absolute right-1 top-1 flex size-6 items-center justify-center rounded-full bg-white/90 text-rose-600 opacity-0 shadow transition-opacity hover:bg-white group-hover:opacity-100"
                  title="Удалить"
                >
                  {deletingId === it.id ? (
                    <Loader2 className="size-3 animate-spin" />
                  ) : (
                    <Trash2 className="size-3" />
                  )}
                </button>
              </div>
            ))}
            {items.length > 12 && (
              <div className="flex aspect-square items-center justify-center rounded-md border border-neutral-200 bg-neutral-50 text-[11px] text-neutral-500">
                +{items.length - 12}
              </div>
            )}
          </div>
        </div>
      )}

      {items.length === 0 && !showForm && (
        <p className="text-[11px] text-neutral-500">
          Добавь хотя бы 3-5 работ, чтобы клиенты могли увидеть твой стиль.
        </p>
      )}
    </section>
  );
}
