/** --- YAML
 * name: Master Categories Editor
 * description: Универсальный редактор категорий и подкатегорий мастера.
 *              Multi-select категорий + одна основная + multi-select подкатегорий
 *              сгруппированных по категории. Свободный текст «+ Своя» для обоих:
 *              подкатегория уходит pending → автоапрув при 3+ мастерах,
 *              категория верхнего уровня → pending → ручной апрув суперадмина в TG.
 *              Используется в Settings (standalone mode) и в onboarding (controlled mode,
 *              без своей кнопки «Сохранить» — родитель сам собирает финальный submit).
 * created: 2026-05-10
 * --- */

'use client';

import { useEffect, useState } from 'react';
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

/** Локальный текст подкатегории, накопленный в онбординге пока мастер не создан. */
export interface CustomSubText {
  categoryId: string;
  text: string;
}

export interface CategoriesSelection {
  categoryIds: string[];
  primaryId: string | null;
  subcategoryIds: string[];
  customSubs: CustomSubText[];
}

interface Props {
  locale?: Locale;
  /**
   * 'standalone' (default) — Settings: грузит текущий выбор мастера, имеет кнопку
   *   «Сохранить», custom-подкатегория сразу создаёт pending через API.
   * 'onboarding' — мастер ещё не создан. Controlled: state у родителя через
   *   value/onChange. Без кнопки. «+ Своя подкатегория» накапливается в
   *   selection.customSubs, родитель отправит их в финальный submit.
   */
  mode?: 'standalone' | 'onboarding';
  value?: CategoriesSelection;
  onChange?: (v: CategoriesSelection) => void;
  onSaved?: () => void;
  /** Из catalog можно скрыть «+ Своя категория» (например, когда родитель сам
   *  не хочет давать pending-категории в этом потоке). */
  allowNewCategoryRequest?: boolean;
}

const EMPTY: CategoriesSelection = {
  categoryIds: [],
  primaryId: null,
  subcategoryIds: [],
  customSubs: [],
};

export function CategoriesEditor({
  locale = 'ru',
  mode = 'standalone',
  value,
  onChange,
  onSaved,
  allowNewCategoryRequest = true,
}: Props) {
  const [catalog, setCatalog] = useState<Category[]>([]);
  const [internalSel, setInternalSel] = useState<CategoriesSelection>(EMPTY);
  const [customSubInput, setCustomSubInput] = useState<Record<string, string>>({});
  const [customCatInput, setCustomCatInput] = useState('');
  const [showCustomCat, setShowCustomCat] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const sel = mode === 'onboarding' ? (value ?? EMPTY) : internalSel;

  function update(patch: Partial<CategoriesSelection> | ((prev: CategoriesSelection) => CategoriesSelection)) {
    const next = typeof patch === 'function' ? patch(sel) : { ...sel, ...patch };
    if (mode === 'onboarding') onChange?.(next);
    else setInternalSel(next);
  }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const catRes = await fetch('/api/categories?include=subs&order=popular');
        const catJson = await catRes.json() as { categories: Category[] };
        if (cancelled) return;
        setCatalog(catJson.categories ?? []);

        if (mode === 'standalone') {
          const meRes = await fetch('/api/me/categories');
          const meJson = await meRes.json() as {
            categories: Array<{ id: string; is_primary: boolean }>;
            subcategories: Array<{ id: string }>;
          };
          if (cancelled) return;
          setInternalSel({
            categoryIds: (meJson.categories ?? []).map(c => c.id),
            primaryId: (meJson.categories ?? []).find(c => c.is_primary)?.id ?? null,
            subcategoryIds: (meJson.subcategories ?? []).map(s => s.id),
            customSubs: [],
          });
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [mode]);

  function toggleCategory(id: string) {
    update(prev => {
      if (prev.categoryIds.includes(id)) {
        const nextIds = prev.categoryIds.filter(x => x !== id);
        const nextPrimary = prev.primaryId === id ? (nextIds[0] ?? null) : prev.primaryId;
        // Сбросить подкатегории удалённой категории
        const cat = catalog.find(c => c.id === id);
        const subIds = new Set((cat?.subcategories ?? []).map(s => s.id));
        const nextSubs = prev.subcategoryIds.filter(x => !subIds.has(x));
        const nextCustom = prev.customSubs.filter(c => c.categoryId !== id);
        return { ...prev, categoryIds: nextIds, primaryId: nextPrimary, subcategoryIds: nextSubs, customSubs: nextCustom };
      }
      return {
        ...prev,
        categoryIds: [...prev.categoryIds, id],
        primaryId: prev.primaryId ?? id,
      };
    });
  }

  function setPrimary(id: string) {
    update({ primaryId: id });
  }

  function toggleSubcategory(id: string) {
    update(prev => ({
      ...prev,
      subcategoryIds: prev.subcategoryIds.includes(id)
        ? prev.subcategoryIds.filter(x => x !== id)
        : [...prev.subcategoryIds, id],
    }));
  }

  async function addCustomSubcategory(categoryId: string) {
    const text = (customSubInput[categoryId] || '').trim();
    if (text.length < 2) return;

    if (mode === 'onboarding') {
      // Накапливаем локально, родитель отправит в финальный submit
      update(prev => ({
        ...prev,
        customSubs: [...prev.customSubs, { categoryId, text }],
      }));
      setCustomSubInput(prev => ({ ...prev, [categoryId]: '' }));
      toast.success(`«${text}» добавлена в ваш профиль`);
      return;
    }

    // standalone: создаём через API
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
    update(prev => ({
      ...prev,
      subcategoryIds: prev.subcategoryIds.includes(json.subcategory!.id)
        ? prev.subcategoryIds
        : [...prev.subcategoryIds, json.subcategory!.id],
    }));
    setCustomSubInput(prev => ({ ...prev, [categoryId]: '' }));
    if (json.subcategory.status === 'pending') {
      toast.success(`«${text}» добавлена. Когда 3 мастера её выберут — она появится у всех.`);
    } else {
      toast.success(`«${text}» добавлена в ваш профиль.`);
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
    if (sel.categoryIds.length === 0) {
      toast.error('Выберите хотя бы одну категорию');
      return;
    }
    if (!sel.primaryId) {
      toast.error('Отметьте основную категорию');
      return;
    }
    setSaving(true);
    const res = await fetch('/api/me/categories', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        categoryIds: sel.categoryIds,
        primaryCategoryId: sel.primaryId,
        subcategoryIds: sel.subcategoryIds,
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

  const selectedCats = catalog.filter(c => sel.categoryIds.includes(c.id));

  return (
    <div className="space-y-6">
      <section>
        <div className="mb-2">
          <h3 className="text-base font-semibold">Категории ваших услуг</h3>
          <p className="text-sm text-muted-foreground">
            Можно выбрать несколько. Одну отметьте как <span className="font-medium">основную</span> — её увидят первой в поиске.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
          {catalog.map(c => {
            const isSelected = sel.categoryIds.includes(c.id);
            const isPrimary = sel.primaryId === c.id;
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
                    onClick={(e) => { e.stopPropagation(); setPrimary(c.id); }}
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

        {allowNewCategoryRequest && (
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
        )}
      </section>

      {selectedCats.length > 0 && (
        <section>
          <div className="mb-2">
            <h3 className="text-base font-semibold">Что именно вы делаешь?</h3>
            <p className="text-sm text-muted-foreground">
              Чтобы клиенты находили вас по запросу типа «парикмахер» или «груминг кошек».
            </p>
          </div>
          <div className="space-y-5">
            {selectedCats.map(c => {
              const localCustomForCat = sel.customSubs.filter(cs => cs.categoryId === c.id);
              return (
                <div key={c.id}>
                  <h4 className="mb-2 text-sm font-medium text-muted-foreground">{localized(c, locale)}</h4>
                  <div className="flex flex-wrap gap-2">
                    {(c.subcategories ?? []).map(s => {
                      const isSel = sel.subcategoryIds.includes(s.id);
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
                    {/* Локальные «свои» (только в onboarding mode) */}
                    {localCustomForCat.map((cs, i) => (
                      <span
                        key={`custom-${i}`}
                        className="rounded-full border border-primary bg-primary/10 px-3 py-1.5 text-sm text-foreground"
                      >
                        {cs.text}
                        <button
                          type="button"
                          onClick={() => update(prev => ({
                            ...prev,
                            customSubs: prev.customSubs.filter((_, idx) => !(prev.customSubs.indexOf(cs) === idx)),
                          }))}
                          className="ml-2 opacity-60 hover:opacity-100"
                          aria-label="Убрать"
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
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
              );
            })}
          </div>
        </section>
      )}

      {mode === 'standalone' && (
        <div className="flex justify-end pt-2">
          <button
            type="button"
            onClick={save}
            disabled={saving || sel.categoryIds.length === 0}
            className="rounded-full bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground transition-opacity disabled:opacity-40"
          >
            {saving ? 'Сохраняю…' : 'Сохранить'}
          </button>
        </div>
      )}
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
