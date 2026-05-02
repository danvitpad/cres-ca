/** --- YAML
 * name: OwnerInlineQuickSettings
 * description: Компактная панель быстрых настроек публичной страницы,
 *              отображается ТОЛЬКО владельцу прямо на /m/{handle} (под
 *              hero-card). Содержит: toggle «Опубликована» / «Принимаю
 *              онлайн», CRES-CA ID, переключатель светлая/тёмная тема.
 *              Картинка фона / акцентный цвет / drawer «Все настройки» —
 *              удалены по запросу пользователя (упрощение, ничего не
 *              конфликтует с текстом).
 * created: 2026-05-02
 * updated: 2026-05-02
 * --- */

'use client';

import { useEffect, useState } from 'react';
import { Globe, Wifi, Check, Sun, Moon } from 'lucide-react';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';

interface MasterRow {
  id: string;
  profile_id: string | null;
  slug: string | null;
  is_public: boolean | null;
  works_online: boolean | null;
  theme_background_color: string | null;
}

// Только две темы: светлая (null) и тёмная (полночь). Никаких цветных пресетов
// и кастомных картинок — текст должен быть читаем на любом фоне.
const THEMES: { key: 'light' | 'dark'; label: string; bg: string | null; sample: string; icon: typeof Sun }[] = [
  { key: 'light', label: 'Светлая', bg: null, sample: '#ffffff', icon: Sun },
  { key: 'dark',  label: 'Тёмная',  bg: '#0f172a', sample: '#0f172a', icon: Moon },
];

export function OwnerInlineQuickSettings({
  masterProfileId,
}: {
  masterProfileId: string | null;
}) {
  const [isOwner, setIsOwner] = useState(false);
  const [master, setMaster] = useState<MasterRow | null>(null);
  const [draftSlug, setDraftSlug] = useState('');
  const [slugError, setSlugError] = useState<string | null>(null);
  const [savingField, setSavingField] = useState<string | null>(null);

  useEffect(() => {
    if (!masterProfileId) return;
    const supabase = createClient();
    supabase.auth.getUser().then(async ({ data }) => {
      if (data.user?.id !== masterProfileId) return;
      setIsOwner(true);
      const { data: row } = await supabase
        .from('masters')
        .select('id, profile_id, slug, is_public, works_online, theme_background_color')
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

  async function saveSlug() {
    setSlugError(null);
    if (!draftSlug.trim()) {
      setSlugError('Введите CRES-CA ID');
      return;
    }
    if (draftSlug === master?.slug) return;
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
      setTimeout(() => { window.location.href = `/m/${draftSlug.trim().toLowerCase()}`; }, 500);
    } finally {
      setSavingField(null);
    }
  }

  // Determine current theme — null/light bg → light; dark hex → dark
  const currentTheme: 'light' | 'dark' =
    master.theme_background_color && /^#0/.test(master.theme_background_color) ? 'dark' : 'light';

  return (
    <div className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm">
      <div className="mb-3">
        <h3 className="text-sm font-bold text-neutral-900">Управление страницей</h3>
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
          hint="Зелёный значок «Online» рядом с аватаром"
          checked={master.works_online ?? false}
          loading={savingField === 'works_online'}
          onChange={(v) => patch('works_online', v)}
        />
      </div>

      {/* CRES-CA ID — одна строка, вертикальная компоновка чтобы не сжимался */}
      <div className="mt-4 border-t border-neutral-100 pt-3">
        <div className="mb-1.5 text-xs font-semibold text-neutral-700">CRES-CA ID</div>
        <div className="rounded-md bg-neutral-100 px-2 py-1.5 text-[11px] font-mono text-neutral-500 truncate">
          cres-ca.com/m/<span className="text-neutral-900">{master.slug ?? '...'}</span>
        </div>
        <div className="mt-2 flex items-center gap-2">
          <input
            type="text"
            value={draftSlug}
            onChange={(e) => {
              setDraftSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''));
              setSlugError(null);
            }}
            placeholder="ваш-id"
            maxLength={32}
            className="flex-1 min-w-0 rounded-md border border-neutral-200 bg-white px-2 py-1.5 text-xs font-mono outline-none focus:border-[var(--ds-accent,#14b8a6)]"
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

      {/* Theme — только Светлая / Тёмная */}
      <div className="mt-4 border-t border-neutral-100 pt-3">
        <div className="mb-1.5 text-xs font-semibold text-neutral-700">Тема страницы</div>
        <div className="grid grid-cols-2 gap-2">
          {THEMES.map((t) => {
            const Icon = t.icon;
            const active = currentTheme === t.key;
            return (
              <button
                key={t.key}
                type="button"
                onClick={() => patch('theme_background_color', t.bg)}
                disabled={savingField === 'theme_background_color'}
                className={`flex items-center justify-center gap-1.5 rounded-md border px-3 py-2 text-xs font-semibold transition ${
                  active
                    ? 'border-[var(--ds-accent,#14b8a6)] bg-[var(--ds-accent,#14b8a6)]/10 text-[var(--ds-accent,#14b8a6)]'
                    : 'border-neutral-200 text-neutral-700 hover:bg-neutral-50'
                }`}
              >
                <Icon className="size-3.5" />
                {t.label}
              </button>
            );
          })}
        </div>
      </div>
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
    </label>
  );
}
