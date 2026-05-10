/** --- YAML
 * name: Master Categories Editor
 * description: Универсальный редактор категорий и подкатегорий мастера.
 *              Multi-select категорий + одна основная + multi-select подкатегорий
 *              сгруппированных по категории. Свободный текст «+ Своя» для обоих:
 *              подкатегория уходит pending → автоапрув при 3+ мастерах,
 *              категория верхнего уровня → pending → ручной апрув суперадмина в TG.
 *              Используется в Settings (web и Mini App), будет перенесён в onboarding.
 * created: 2026-05-10
 * --- */

'use client';

import { useEffect, useMemo, useState } from 'react';
import { Plus, Check, Star } from 'lucide-react';
import { toast } from 'sonner';

interface Category {
  id: string;
  key: string;
  name_ru: string;
  name_uk: string;
  name_en: string;
  icon: string | null;
  master_count: number;
  subcategories?: Subcategory[];
}

interface Subcategory {
  id: string;
  category_id: string;
  key: string;
  name_ru: string;
  name_uk: string;
  name_en: string;
  master_count?: number;
  status?: string;
}

type Locale = 'ru' | 'uk' | 'en';

function localized(name: { name_ru: string; name_uk: string; name_en: string }, locale: Locale): string {
  if (locale === 'uk') return name.name_uk || name.name_ru || name.name_en;
  if (locale === 'en') return name.name_en || name.name_ru;
  return name.name_ru || name.name_en;
}

interface Props {
  locale?: Locale;
  /** Если задан — внешний onSave вместо встроенного PUT. Полезно для онбординга. */
  onSaved?: () => void;
}

export function CategoriesEditor({ locale = 'ru', onSaved }: Props) {
  const [catalog, setCatalog] = useState<Category[]>([]);
  const [selectedCatIds, setSelectedCatIds] = useState<string[]>([]);
  const [primaryCatId, setPrimaryCatId] = useState<string | null>(null);
  const [selectedSubIds, setSelectedSubIds] = useState<string[]>([]);
  const [customSubInput, setCustomSubInput] = useState<Record<string, string>>({});
  const [customCatInput, setCustomCatInput] = useState('');
  const [showCustomCat, setShowCustomCat] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [catRes, meRes] = await Promise.all([
          fetch('/api/categories?include=subs&order=popular'),
          fetch('/api/me/categories'),
        ]);
        const catJson = await catRes.json() as { categories: Category[] };
        const meJson = await meRes.json() as {
          categories: Array<{ id: string; is_primary: boolean }>;
          subcategories: Array<{ id: string }>;
        };
        if (cancelled) return;
        setCatalog(catJson.categories ?? []);
        setSelectedCatIds((meJson.categories ?? []).map(c => c.id));
        const primary = (meJson.categories ?? []).find(c => c.is_primary);
        setPrimaryCatId(primary?.id ?? null);
        setSelectedSubIds((meJson.subcategories ?? []).map(s => s.id));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const selectedCats = useMemo(
    () => catalog.filter(c => selectedCatIds.includes(c.id)),
    [catalog, selectedCatIds],
  );

  function toggleCategory(id: string) {
    setSelectedCatIds(prev => {
      if (prev.includes(id)) {
        const next = prev.filter(x => x !== id);
        if (primaryCatId === id) setPrimaryCatId(next[0] ?? null);
        // Сбросить подкатегории удалённой категории
        const cat = catalog.find(c => c.id === id);
        if (cat?.subcategories) {
          const subIds = new Set(cat.subcategories.map(s => s.id));
          setSelectedSubIds(s => s.filter(x => !subIds.has(x)));
        }
        return next;
      }
      const next = [...prev, id];
      if (!primaryCatId) setPrimaryCatId(id);
      return next;
    });
  }

  function toggleSubcategory(id: string) {
    setSelectedSubIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  }

  async function addCustomSubcategory(categoryId: string) {
    const text = (customSubInput[categoryId] || '').trim();
    if (text.length < 2) return;
    const res = await fetch('/api/me/categories/subcategory-request', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ categoryId, text }),
    });
    const json = await res.json() as { subcategory?: Subcategory; error?: string };
    if (!res.ok || !json.subcategory) {
      toast.error(json.error ?? 'Не удалось добавить');
      return;
    }
    setCatalog(prev => prev.map(c => {
      if (c.id !== categoryId) return c;
      const subs = c.subcategories ?? [];
      if (subs.some(s => s.id === json.subcategory!.id)) return c;
      return { ...c, subcategories: [...subs, json.subcategory!] };
    }));
    setSelectedSubIds(prev => prev.includes(json.subcategory!.id) ? prev : [...prev, json.subcategory!.id]);
    setCustomSubInput(prev => ({ ...prev, [categoryId]: '' }));
    if (json.subcategory.status === 'pending') {
      toast.success(`«${text}» добавлена. Когда 3 мастера её выберут — она появится у всех.`);
    } else {
      toast.success(`«${text}» добавлена в твой профиль.`);
    }
  }

  async function requestNewCategory() {
    const text = customCatInput.trim();
    if (text.length < 2) return;
    const res = await fetch('/api/me/categories/category-request', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    });
    if (!res.ok) {
      toast.error('Не удалось отправить заявку');
      return;
    }
    setCustomCatInput('');
    setShowCustomCat(false);
    toast.success(`Заявка «${text}» отправлена. Появится в каталоге после проверки.`);
  }

  async function save() {
    if (selectedCatIds.length === 0) {
      toast.error('Выбери хотя бы одну категорию');
      return;
    }
    if (!primaryCatId) {
      toast.error('Отметь основную категорию');
      return;
    }
    setSaving(true);
    const res = await fetch('/api/me/categories', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        categoryIds: selectedCatIds,
        primaryCategoryId: primaryCatId,
        subcategoryIds: selectedSubIds,
      }),
    });
    setSaving(false);
    if (!res.ok) {
      const j = await res.json().catch(() => ({})) as { error?: string };
      toast.error(j.error ?? 'Не удалось сохранить');
      return;
    }
    toast.success('Сохранено');
    onSaved?.();
  }

  if (loading) {
    return <div className="p-8 text-center text-muted-foreground">Загружаю категории…</div>;
  }

  return (
    <div className="space-y-6">
      {/* Категории */}
      <section>
        <div className="mb-2">
          <h3 className="text-base font-semibold">Категории твоих услуг</h3>
          <p className="text-sm text-muted-foreground">
            Можно выбрать несколько. Одну отметь как <span className="font-medium">основную</span> — её увидят первой в поиске.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
          {catalog.map(c => {
            const isSelected = selectedCatIds.includes(c.id);
            const isPrimary = primaryCatId === c.id;
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => toggleCategory(c.id)}
                className={`relative flex flex-col items-start gap-1 rounded-xl border p-3 text-left transition-all ${
                  isSelected
                    ? 'border-primary bg-primary/5'
                    : 'border-border bg-card hover:border-primary/30'
                }`}
              >
                <div className="flex w-full items-start justify-between gap-2">
                  <span className="text-sm font-medium leading-tight">{localized(c, locale)}</span>
                  {isSelected && (
                    <div className="flex size-5 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
                      <Check className="size-3" />
                    </div>
                  )}
                </div>
                {c.master_count > 0 && (
                  <span className="text-[11px] text-muted-foreground">
                    {c.master_count} {plural(c.master_count, 'мастер', 'мастера', 'мастеров')}
                  </span>
                )}
                {isSelected && (
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); setPrimaryCatId(c.id); }}
                    className={`mt-1 flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold transition-colors ${
                      isPrimary
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted text-muted-foreground hover:bg-muted/70'
                    }`}
                  >
                    <Star className="size-3" />
                    {isPrimary ? 'Основная' : 'Сделать основной'}
                  </button>
                )}
              </button>
            );
          })}
        </div>

        {/* + Своя категория */}
        <div className="mt-4">
          {!showCustomCat ? (
            <button
              type="button"
              onClick={() => setShowCustomCat(true)}
              className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
            >
              <Plus className="size-4" />
              Не нашёл свою? Предложи свою категорию
            </button>
          ) : (
            <div className="flex gap-2">
              <input
                type="text"
                value={customCatInput}
                onChange={(e) => setCustomCatInput(e.target.value)}
                placeholder="Например: Аэрография, Зооэкзотика"
                maxLength={60}
                className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
                autoFocus
              />
              <button
                type="button"
                onClick={requestNewCategory}
                disabled={customCatInput.trim().length < 2}
                className="rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground transition-opacity disabled:opacity-40"
              >
                Отправить
              </button>
              <button
                type="button"
                onClick={() => { setShowCustomCat(false); setCustomCatInput(''); }}
                className="rounded-lg border border-border px-3 text-sm transition-colors hover:bg-muted"
              >
                Отмена
              </button>
            </div>
          )}
        </div>
      </section>

      {/* Подкатегории для выбранных категорий */}
      {selectedCats.length > 0 && (
        <section>
          <div className="mb-2">
            <h3 className="text-base font-semibold">Что именно ты делаешь?</h3>
            <p className="text-sm text-muted-foreground">
              Чтобы клиенты находили тебя по запросу типа «парикмахер» или «груминг кошек».
            </p>
          </div>
          <div className="space-y-5">
            {selectedCats.map(c => (
              <div key={c.id}>
                <h4 className="mb-2 text-sm font-medium text-muted-foreground">{localized(c, locale)}</h4>
                <div className="flex flex-wrap gap-2">
                  {(c.subcategories ?? []).map(s => {
                    const isSel = selectedSubIds.includes(s.id);
                    const isPending = s.status === 'pending';
                    return (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => toggleSubcategory(s.id)}
                        className={`rounded-full border px-3 py-1.5 text-sm transition-colors ${
                          isSel
                            ? 'border-primary bg-primary text-primary-foreground'
                            : 'border-border bg-card text-muted-foreground hover:border-primary/40 hover:text-foreground'
                        }`}
                      >
                        {localized(s, locale)}
                        {isPending && (
                          <span className="ml-1 text-[10px] opacity-70">· на проверке</span>
                        )}
                      </button>
                    );
                  })}
                </div>
                {/* + Своя подкатегория */}
                <div className="mt-2 flex gap-2">
                  <input
                    type="text"
                    value={customSubInput[c.id] || ''}
                    onChange={(e) => setCustomSubInput(prev => ({ ...prev, [c.id]: e.target.value }))}
                    placeholder="+ Своя услуга, например «Стретчинг»"
                    maxLength={80}
                    className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        addCustomSubcategory(c.id);
                      }
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => addCustomSubcategory(c.id)}
                    disabled={(customSubInput[c.id] || '').trim().length < 2}
                    className="rounded-lg bg-primary px-3 text-sm font-medium text-primary-foreground transition-opacity disabled:opacity-40"
                  >
                    <Plus className="size-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <div className="flex justify-end pt-2">
        <button
          type="button"
          onClick={save}
          disabled={saving || selectedCatIds.length === 0}
          className="rounded-full bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground transition-opacity disabled:opacity-40"
        >
          {saving ? 'Сохраняю…' : 'Сохранить'}
        </button>
      </div>
    </div>
  );
}

function plural(n: number, one: string, few: string, many: string): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few;
  return many;
}
