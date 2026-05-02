/** --- YAML
 * name: OwnerInlineQuickSettings
 * description: Компактная панель быстрых настроек публичной страницы,
 *              отображается ТОЛЬКО владельцу прямо на /m/{handle} (под
 *              hero-card). Содержит самые часто используемые toggle:
 *              «Опубликована», «Принимаю онлайн». Плюс inline-поле
 *              CRES-CA ID, шорткат к выбору фона/акцента и кнопка
 *              «Все настройки» открывает полный drawer (PublicPageCustomizer)
 *              для редких полей (соцсети, языки, интересы…).
 *              Удаляет необходимость открывать drawer для рутины.
 * created: 2026-05-02
 * --- */

'use client';

import { useEffect, useRef, useState } from 'react';
import { Globe, Wifi, Settings as SettingsIcon, Check, X, Palette, ImagePlus, Trash2, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';

interface MasterRow {
  id: string;
  profile_id: string | null;
  slug: string | null;
  is_public: boolean | null;
  works_online: boolean | null;
  theme_primary_color: string | null;
  theme_background_color: string | null;
  theme_background_image_url: string | null;
}

const BG_PRESETS: { label: string; value: string | null; sample: string }[] = [
  { label: 'Светлый', value: null, sample: '#ffffff' },
  { label: 'Молочный', value: '#fafaf7', sample: '#fafaf7' },
  { label: 'Серый', value: '#f3f4f6', sample: '#f3f4f6' },
  { label: 'Песок', value: '#fef9f0', sample: '#fef9f0' },
  { label: 'Розовый', value: '#fdf2f8', sample: '#fdf2f8' },
  { label: 'Мятный', value: '#ecfdf5', sample: '#ecfdf5' },
  { label: 'Голубой', value: '#eff6ff', sample: '#eff6ff' },
  { label: 'Лавандовый', value: '#f5f3ff', sample: '#f5f3ff' },
  { label: 'Графит', value: '#1f2937', sample: '#1f2937' },
  { label: 'Полночь', value: '#0f172a', sample: '#0f172a' },
];

const ACCENT_PRESETS = [
  '#14b8a6', '#3b82f6', '#10b981', '#eab308',
  '#f97316', '#ef4444', '#ec4899', '#6366f1',
];

export function OwnerInlineQuickSettings({
  masterProfileId,
  onOpenFullEditor,
}: {
  masterProfileId: string | null;
  onOpenFullEditor: () => void;
}) {
  const [isOwner, setIsOwner] = useState(false);
  const [master, setMaster] = useState<MasterRow | null>(null);
  const [draftSlug, setDraftSlug] = useState('');
  const [slugError, setSlugError] = useState<string | null>(null);
  const [savingField, setSavingField] = useState<string | null>(null);
  const [bgImageUploading, setBgImageUploading] = useState(false);
  const bgFileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!masterProfileId) return;
    const supabase = createClient();
    supabase.auth.getUser().then(async ({ data }) => {
      if (data.user?.id !== masterProfileId) return;
      setIsOwner(true);
      const { data: row } = await supabase
        .from('masters')
        .select('id, profile_id, slug, is_public, works_online, theme_primary_color, theme_background_color, theme_background_image_url')
        .eq('profile_id', masterProfileId)
        .maybeSingle();
      if (row) {
        setMaster(row as unknown as MasterRow);
        setDraftSlug((row as unknown as MasterRow).slug ?? '');
      }
    });
  }, [masterProfileId]);

  if (!isOwner || !master) return null;

  async function patch(field: keyof MasterRow, value: unknown) {
    setSavingField(String(field));
    try {
      const res = await fetch('/api/me/master-customization', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [field]: value }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error((data as { error?: string }).error || 'Не удалось сохранить');
        return false;
      }
      setMaster((m) => (m ? { ...m, [field]: value } : m));
      return true;
    } finally {
      setSavingField(null);
    }
  }

  async function uploadBgImage(file: File) {
    if (!masterProfileId) return;
    if (file.size > 8 * 1024 * 1024) {
      toast.error('Файл больше 8 MB');
      return;
    }
    setBgImageUploading(true);
    try {
      const supabase = createClient();
      const ext = file.name.split('.').pop() ?? 'jpg';
      const path = `${masterProfileId}/bg-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from('avatars').upload(path, file, {
        cacheControl: '3600', upsert: false,
      });
      if (upErr) { toast.error(`Загрузка: ${upErr.message}`); return; }
      const { data: pub } = supabase.storage.from('avatars').getPublicUrl(path);
      const ok = await patch('theme_background_image_url', pub.publicUrl);
      if (ok) toast.success('Фон обновлён');
    } finally {
      setBgImageUploading(false);
    }
  }

  async function clearBgImage() {
    const ok = await patch('theme_background_image_url', null);
    if (ok) toast.success('Фон-картинка убрана');
  }

  async function saveSlug() {
    setSlugError(null);
    if (!draftSlug.trim()) {
      setSlugError('Введите CRES-CA ID');
      return;
    }
    if (draftSlug === master?.slug) return; // ничего не поменялось
    setSavingField('slug');
    try {
      const res = await fetch('/api/me/master-customization', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug: draftSlug.trim().toLowerCase() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const err = data as { error?: string; field?: string };
        if (err.field === 'slug') {
          setSlugError(err.error || 'Неверный CRES-CA ID');
        } else {
          toast.error(err.error || 'Не удалось сохранить');
        }
        return;
      }
      toast.success('CRES-CA ID обновлён. Обновите ссылку у клиентов!');
      // Перезагружаем страницу — URL сменился, новый slug в адресной строке
      setTimeout(() => { window.location.href = `/m/${draftSlug.trim().toLowerCase()}`; }, 500);
    } finally {
      setSavingField(null);
    }
  }

  return (
    <div className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h3 className="text-sm font-bold text-neutral-900">Управление страницей</h3>
        <button
          type="button"
          onClick={onOpenFullEditor}
          className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-200 bg-white px-2.5 py-1 text-xs font-medium text-neutral-700 hover:bg-neutral-50"
          title="Открыть все настройки"
        >
          <SettingsIcon className="size-3.5" />
          Все настройки
        </button>
      </div>

      {/* Toggles */}
      <div className="space-y-2">
        <ToggleRow
          icon={<Globe className="size-4" />}
          label="Страница опубликована"
          hint="Когда выключено — посторонние видят 404"
          checked={master.is_public ?? true}
          loading={savingField === 'is_public'}
          onChange={(v) => patch('is_public', v)}
        />
        <ToggleRow
          icon={<Wifi className="size-4" />}
          label="Принимаю онлайн"
          hint="Бейдж «Online» на аватаре + блок адреса можно скрыть"
          checked={master.works_online ?? false}
          loading={savingField === 'works_online'}
          onChange={(v) => patch('works_online', v)}
        />
      </div>

      {/* CRES-CA ID */}
      <div className="mt-4 border-t border-neutral-100 pt-3">
        <div className="mb-1.5 text-xs font-semibold text-neutral-700">CRES-CA ID</div>
        <div className="flex items-center gap-2">
          <span className="rounded-md bg-neutral-100 px-2 py-1.5 text-xs font-mono text-neutral-500">
            cres-ca.com/m/
          </span>
          <input
            type="text"
            value={draftSlug}
            onChange={(e) => {
              setDraftSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''));
              setSlugError(null);
            }}
            placeholder={master.slug ?? 'твой-id'}
            maxLength={32}
            className="flex-1 rounded-md border border-neutral-200 bg-white px-2 py-1.5 text-xs font-mono outline-none focus:border-[var(--ds-accent,#14b8a6)]"
            style={slugError ? { borderColor: '#ef4444' } : undefined}
          />
          <button
            type="button"
            onClick={saveSlug}
            disabled={savingField === 'slug' || !draftSlug.trim() || draftSlug === master.slug}
            className="inline-flex size-8 shrink-0 items-center justify-center rounded-md bg-[var(--ds-accent,#14b8a6)] text-white disabled:opacity-40"
            title="Сохранить"
          >
            <Check className="size-4" />
          </button>
        </div>
        {slugError && <p className="mt-1 text-[11px] text-rose-500">{slugError}</p>}
      </div>

      {/* Background image uploader */}
      <div className="mt-4 border-t border-neutral-100 pt-3">
        <div className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-neutral-700">
          <ImagePlus className="size-3.5" />
          Картинка фона
        </div>
        {master.theme_background_image_url ? (
          <div className="flex items-center gap-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={master.theme_background_image_url}
              alt=""
              className="size-12 rounded-md object-cover ring-1 ring-black/10"
            />
            <button
              type="button"
              onClick={() => bgFileRef.current?.click()}
              disabled={bgImageUploading}
              className="flex-1 rounded-md border border-neutral-200 bg-white px-2 py-1.5 text-[11px] font-medium text-neutral-700 hover:bg-neutral-50 disabled:opacity-50"
            >
              {bgImageUploading ? 'Загрузка…' : 'Заменить'}
            </button>
            <button
              type="button"
              onClick={clearBgImage}
              disabled={bgImageUploading || savingField === 'theme_background_image_url'}
              className="rounded-md border border-neutral-200 bg-white p-1.5 text-rose-500 hover:bg-rose-50 disabled:opacity-50"
              title="Убрать фон-картинку"
            >
              <Trash2 className="size-3.5" />
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => bgFileRef.current?.click()}
            disabled={bgImageUploading}
            className="flex w-full items-center justify-center gap-1.5 rounded-md border border-dashed border-neutral-300 bg-neutral-50 py-3 text-[11px] font-medium text-neutral-600 hover:bg-neutral-100 disabled:opacity-50"
          >
            {bgImageUploading ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <ImagePlus className="size-4" />
            )}
            {bgImageUploading ? 'Загрузка…' : 'Загрузить свою картинку фона'}
          </button>
        )}
        <input
          ref={bgFileRef}
          type="file"
          accept="image/*"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) uploadBgImage(f);
            e.target.value = '';
          }}
        />
      </div>

      {/* Background color presets (используется когда нет картинки) */}
      <div className="mt-4 border-t border-neutral-100 pt-3">
        <div className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-neutral-700">
          <Palette className="size-3.5" />
          {master.theme_background_image_url ? 'Цвет фона (под картинкой)' : 'Фон'}
        </div>
        <div className="grid grid-cols-5 gap-1.5">
          {BG_PRESETS.map((p) => {
            const active = (master.theme_background_color ?? null) === p.value;
            return (
              <button
                key={p.label}
                type="button"
                onClick={() => patch('theme_background_color', p.value)}
                disabled={savingField === 'theme_background_color'}
                className={`group flex flex-col items-center gap-1 rounded-md border p-1 transition ${active ? 'border-[var(--ds-accent,#14b8a6)] ring-1 ring-[var(--ds-accent,#14b8a6)]' : 'border-neutral-200 hover:border-neutral-300'}`}
                title={p.label}
              >
                <span className="h-5 w-full rounded border border-black/5" style={{ background: p.sample }} />
                <span className="text-[9px] text-neutral-500 group-hover:text-neutral-900">{p.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Accent color */}
      <div className="mt-4 border-t border-neutral-100 pt-3">
        <div className="mb-1.5 text-xs font-semibold text-neutral-700">Акцентный цвет</div>
        <div className="flex flex-wrap gap-1.5">
          {ACCENT_PRESETS.map((c) => {
            const active = (master.theme_primary_color ?? '') === c;
            return (
              <button
                key={c}
                type="button"
                onClick={() => patch('theme_primary_color', c)}
                disabled={savingField === 'theme_primary_color'}
                className={`size-7 rounded-full transition ${active ? 'ring-2 ring-offset-1 ring-neutral-900' : 'ring-1 ring-black/10'}`}
                style={{ background: c }}
                title={c}
              />
            );
          })}
        </div>
      </div>

      <p className="mt-3 text-[10px] leading-relaxed text-neutral-500">
        Изменения применяются сразу. Закрытые настройки (соцсети, языки, тип
        страницы…) — в полном редакторе через «Все настройки».
      </p>
    </div>
  );
}

function ToggleRow({
  icon, label, hint, checked, loading, onChange,
}: {
  icon: React.ReactNode;
  label: string;
  hint?: string;
  checked: boolean;
  loading?: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-2.5 rounded-lg border border-neutral-100 bg-white px-3 py-2 hover:bg-neutral-50">
      <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-[var(--ds-accent-soft,rgba(20,184,166,0.12))] text-[var(--ds-accent,#14b8a6)]">
        {icon}
      </span>
      <span className="flex-1 min-w-0">
        <span className="block text-xs font-semibold text-neutral-900">{label}</span>
        {hint && <span className="block text-[10px] text-neutral-500">{hint}</span>}
      </span>
      <span
        role="checkbox"
        aria-checked={checked}
        className="relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full transition-colors"
        style={{
          background: checked ? 'var(--ds-accent, #14b8a6)' : '#d1d5db',
          opacity: loading ? 0.6 : 1,
        }}
      >
        <span
          className="pointer-events-none inline-block size-4 transform rounded-full bg-white shadow ring-0 transition"
          style={{ transform: `translate(${checked ? 18 : 2}px, 2px)` }}
        />
      </span>
      <input
        type="checkbox"
        className="hidden"
        checked={checked}
        disabled={loading}
        onChange={(e) => onChange(e.target.checked)}
      />
      {loading && (
        <X
          className="size-3.5 animate-spin text-neutral-400"
          style={{ animation: 'spin 1s linear infinite' }}
        />
      )}
    </label>
  );
}
