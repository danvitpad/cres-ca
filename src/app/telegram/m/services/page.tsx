/** --- YAML
 * name: MasterMiniAppServicesTab
 * description: Услуги мастера (4-й таб). Native CRUD без выхода в браузер:
 *              кнопка «+ Добавить» открывает bottom-sheet с полями
 *              (название, длительность, цена, описание, цвет). Тап на
 *              существующую услугу — тот же sheet в режиме edit с
 *              кнопками «В архив» / «Активировать» и «Удалить».
 *              CRUD через service-role endpoint /api/telegram/m/service-mutate.
 *              Архив показывается отдельной секцией ниже активных.
 * created: 2026-05-07
 * --- */

'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Scissors, Clock, Plus, X, Check, Loader2, Archive, RotateCcw, Trash2, Package, ArrowRight, MoreHorizontal } from 'lucide-react';
import '@/styles/od-master-services.css';
import { useAuthStore } from '@/stores/auth-store';
import { useTelegram } from '@/components/miniapp/telegram-provider';
import { getInitData } from '@/lib/telegram/webapp';
import { createClient } from '@/lib/supabase/client';
import { MobilePage, PageHeader } from '@/components/miniapp/shells';
import { MiniAppPortal } from '@/components/miniapp/portal';
import { T, R, TYPE, SHADOW, PAGE_PADDING_X, SPRING } from '@/components/miniapp/design';
import { useMiniAppLocale, type MiniAppLang } from '@/lib/miniapp/use-locale';
import { useTrackSheetOpen } from '@/lib/miniapp/use-sheet-open';
import { getServiceName } from '@/lib/i18n/get-service-name';

interface Service {
  id: string;
  name: string;
  description: string | null;
  duration_minutes: number;
  price: number;
  currency: string;
  is_active: boolean;
  color: string | null;
  category_id: string | null;
  is_mobile: boolean | null;
  travel_buffer_minutes: number | null;
  requires_prepayment: boolean | null;
  prepayment_amount: number | null;
  name_i18n: Record<string, string> | null;
  description_i18n: Record<string, string> | null;
}

interface ServiceCategory {
  id: string;
  name: string;
  sort_order: number;
}

// Палитра 12 цветов — паритет с веб-формой (services dashboard).
const COLORS = [
  '#60a5fa', '#ec4899', '#ef4444', '#f59e0b', '#10b981', '#06b6d4',
  '#3b82f6', '#a78bfa', '#22c55e', '#f43f5e', '#64748b', '#1e293b',
];

const I18N: Record<MiniAppLang, {
  title: string;
  empty: string; emptyHint: string;
  emptyArchive: string; emptyArchiveHint: string;
  add: string;
  tabActive: string; tabArchived: string;
  minutes: string;
  sheetCreate: string; sheetEdit: string;
  fieldName: string; fieldDuration: string; fieldPrice: string; fieldDescription: string; fieldColor: string;
  placeholderName: string; placeholderDescription: string;
  save: string; saving: string;
  archiveBtn: string; restoreBtn: string; deleteBtn: string;
  uncategorized: string;
  categoryLabel: string; categoryManage: string; categoryDone: string;
  categoryNewPh: string; categoryAdd: string; categoryDelete: string;
  deleteConfirm: string;
  errName: string; errDuration: string; errPrice: string; errSave: string;
  toggleMobile: string; toggleMobileHint: string; fieldTravelBuffer: string;
  togglePrepayment: string; togglePrepaymentHint: string; fieldPrepaymentAmount: string;
  materialsTitle: string; materialsHint: string; materialsEmpty: string; materialsStock: string;
}> = {
  uk: {
    title: 'Послуги і ціни',
    empty: 'Поки немає послуг', emptyHint: 'Створи свою першу — тапните «+ Додати»',
    emptyArchive: 'В архіві порожньо', emptyArchiveHint: 'Послуги які ви заархівував — з\'являться тут',
    add: 'Додати послугу',
    tabActive: 'Активні', tabArchived: 'В архіві',
    minutes: 'хв',
    sheetCreate: 'Нова послуга', sheetEdit: 'Редагувати послугу',
    fieldName: 'Назва', fieldDuration: 'Тривалість, хв', fieldPrice: 'Ціна, ₴',
    fieldDescription: 'Опис (опційно)', fieldColor: 'Колір',
    placeholderName: 'Стрижка, манікюр…', placeholderDescription: 'Що включено, особливості…',
    save: 'Зберегти', saving: 'Зберігаємо…',
    archiveBtn: 'В архів', restoreBtn: 'Активувати', deleteBtn: 'Видалити',
    uncategorized: 'Без категорії',
    categoryLabel: 'Категорія', categoryManage: 'Керувати', categoryDone: 'Готово',
    categoryNewPh: 'Назва нової категорії', categoryAdd: 'Додати', categoryDelete: 'Видалити',
    deleteConfirm: 'Видалити послугу повністю?',
    errName: 'Введите назву', errDuration: 'Введите тривалість', errPrice: 'Введите ціну', errSave: 'Не вдалось зберегти',
    toggleMobile: 'Виїзна послуга', toggleMobileHint: 'Я їду до клієнта',
    fieldTravelBuffer: 'Буфер на дорогу, хв',
    togglePrepayment: 'Передоплата обов’язкова', togglePrepaymentHint: 'Клієнт оплачує перед записом',
    fieldPrepaymentAmount: 'Сума передоплати, ₴',
    materialsTitle: 'Витратники на 1 візит',
    materialsHint: 'Автоматично спишеться зі складу коли візит «Виконано»',
    materialsEmpty: 'Додати матеріали на склад',
    materialsStock: 'на складі',
  },
  ru: {
    title: 'Услуги и цены',
    empty: 'Пока нет услуг', emptyHint: 'Создай первую — тапните «+ Добавить»',
    emptyArchive: 'В архиве пусто', emptyArchiveHint: 'Услуги которые вы заархивировал — появятся здесь',
    add: 'Добавить услугу',
    tabActive: 'Активные', tabArchived: 'В архиве',
    minutes: 'мин',
    sheetCreate: 'Новая услуга', sheetEdit: 'Редактировать услугу',
    fieldName: 'Название', fieldDuration: 'Длительность, мин', fieldPrice: 'Цена, ₴',
    fieldDescription: 'Описание (опционально)', fieldColor: 'Цвет',
    placeholderName: 'Стрижка, маникюр…', placeholderDescription: 'Что включено, особенности…',
    save: 'Сохранить', saving: 'Сохраняем…',
    archiveBtn: 'В архив', restoreBtn: 'Активировать', deleteBtn: 'Удалить',
    uncategorized: 'Без категории',
    categoryLabel: 'Категория', categoryManage: 'Управлять', categoryDone: 'Готово',
    categoryNewPh: 'Название новой категории', categoryAdd: 'Добавить', categoryDelete: 'Удалить',
    deleteConfirm: 'Удалить услугу полностью?',
    errName: 'Введите название', errDuration: 'Введите длительность', errPrice: 'Введите цену', errSave: 'Не удалось сохранить',
    toggleMobile: 'Выездная услуга', toggleMobileHint: 'Я еду к клиенту',
    fieldTravelBuffer: 'Буфер на дорогу, мин',
    togglePrepayment: 'Предоплата обязательна', togglePrepaymentHint: 'Клиент оплачивает до записи',
    fieldPrepaymentAmount: 'Сумма предоплаты, ₴',
    materialsTitle: 'Расходники на 1 визит',
    materialsHint: 'Автоматически спишется со склада когда визит «Выполнено»',
    materialsEmpty: 'Добавить материалы на склад',
    materialsStock: 'на складе',
  },
  en: {
    title: 'Services & prices',
    empty: 'No services yet', emptyHint: 'Create your first — tap «+ Add»',
    emptyArchive: 'Archive is empty', emptyArchiveHint: 'Services you archive will appear here',
    add: 'Add service',
    tabActive: 'Active', tabArchived: 'Archived',
    minutes: 'min',
    sheetCreate: 'New service', sheetEdit: 'Edit service',
    fieldName: 'Name', fieldDuration: 'Duration, min', fieldPrice: 'Price, ₴',
    fieldDescription: 'Description (optional)', fieldColor: 'Color',
    placeholderName: 'Haircut, manicure…', placeholderDescription: 'What’s included, details…',
    save: 'Save', saving: 'Saving…',
    archiveBtn: 'Archive', restoreBtn: 'Activate', deleteBtn: 'Delete',
    uncategorized: 'Uncategorized',
    categoryLabel: 'Category', categoryManage: 'Manage', categoryDone: 'Done',
    categoryNewPh: 'New category name', categoryAdd: 'Add', categoryDelete: 'Delete',
    deleteConfirm: 'Delete service permanently?',
    errName: 'Enter name', errDuration: 'Enter duration', errPrice: 'Enter price', errSave: 'Failed to save',
    toggleMobile: 'Mobile service', toggleMobileHint: 'I travel to the client',
    fieldTravelBuffer: 'Travel buffer, min',
    togglePrepayment: 'Prepayment required', togglePrepaymentHint: 'Client pays before booking',
    fieldPrepaymentAmount: 'Prepayment amount, ₴',
    materialsTitle: 'Supplies per visit',
    materialsHint: 'Auto-deducted from inventory when visit marked «Completed»',
    materialsEmpty: 'Add materials to inventory',
    materialsStock: 'in stock',
  },
};

export default function MasterMiniAppServicesTab() {
  const { userId } = useAuthStore();
  const { haptic } = useTelegram();
  const lang = useMiniAppLocale();
  const t = I18N[lang];
  const [items, setItems] = useState<Service[]>([]);
  const [categories, setCategories] = useState<ServiceCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);
  const [sheet, setSheet] = useState<{ mode: 'create' | 'edit'; service?: Service } | null>(null);
  const [tab, setTab] = useState<'active' | 'archived'>('active');
  const [toggling, setToggling] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    (async () => {
      const supabase = createClient();
      const { data: master } = await supabase
        .from('masters').select('id').eq('profile_id', userId).maybeSingle();
      if (cancelled) return;
      if (!master) { setLoading(false); return; }
      // Параллельно тянем услуги и категории мастера
      const [servicesRes, catsRes] = await Promise.all([
        supabase
          .from('services')
          .select('id, name, description, duration_minutes, price, currency, is_active, color, category_id, is_mobile, travel_buffer_minutes, requires_prepayment, prepayment_amount, name_i18n, description_i18n')
          .eq('master_id', master.id)
          .order('is_active', { ascending: false })
          .order('price', { ascending: false }),
        supabase
          .from('service_categories')
          .select('id, name, sort_order')
          .eq('master_id', master.id)
          .order('sort_order', { ascending: true }),
      ]);
      if (cancelled) return;
      setItems((servicesRes.data as Service[] | null) ?? []);
      setCategories((catsRes.data as ServiceCategory[] | null) ?? []);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [userId, refreshKey]);

  // Toggle is_active через Supabase напрямую — RLS пускает мастера на свои.
  // Optimistic update + откат при ошибке.
  const toggleActive = async (s: Service) => {
    if (toggling.has(s.id)) return;
    haptic('selection');
    setToggling((p) => new Set(p).add(s.id));
    const next = !s.is_active;
    setItems((arr) => arr.map((x) => x.id === s.id ? { ...x, is_active: next } : x));
    try {
      const supabase = createClient();
      const { error } = await supabase.from('services').update({ is_active: next }).eq('id', s.id);
      if (error) {
        // revert
        setItems((arr) => arr.map((x) => x.id === s.id ? { ...x, is_active: !next } : x));
      }
    } catch {
      setItems((arr) => arr.map((x) => x.id === s.id ? { ...x, is_active: !next } : x));
    } finally {
      setToggling((p) => { const n = new Set(p); n.delete(s.id); return n; });
    }
  };

  const active = items.filter((s) => s.is_active);
  const archived = items.filter((s) => !s.is_active);
  const visible = tab === 'active' ? active : archived;

  // Группировка услуг по категориям — Open Design master-services mobile.
  // Категории в порядке sort_order, затем «Без категории» в конце если есть
  // услуги без category_id. Пустые категории не показываем.
  const grouped: Array<{ category: ServiceCategory | null; services: Service[] }> = (() => {
    const byCat = new Map<string, Service[]>();
    const orphan: Service[] = [];
    for (const s of visible) {
      if (s.category_id) {
        const list = byCat.get(s.category_id) ?? [];
        list.push(s);
        byCat.set(s.category_id, list);
      } else {
        orphan.push(s);
      }
    }
    const out: Array<{ category: ServiceCategory | null; services: Service[] }> = [];
    for (const cat of categories) {
      const list = byCat.get(cat.id);
      if (list && list.length) out.push({ category: cat, services: list });
    }
    if (orphan.length) out.push({ category: null, services: orphan });
    return out;
  })();

  return (
    <MobilePage className="od-master-services">
      <PageHeader title={t.title} />

      {/* Pill Tabs — литерально из OD master-services.html (.pill-tabs / .pill-tab).
          В оригинале «Активні (8)» / «В архіві (2)» — мы добавили count'ы в
          скобки чтобы текст 1-в-1 совпадал. */}
      {!loading && (
        <div
          role="tablist"
          className="pill-tabs"
          style={{ margin: `4px ${PAGE_PADDING_X}px 0` }}
        >
          {([
            { key: 'active' as const, label: t.tabActive, count: active.length },
            { key: 'archived' as const, label: t.tabArchived, count: archived.length },
          ]).map((it) => {
            const isActive = tab === it.key;
            return (
              <button
                key={it.key}
                role="tab"
                aria-selected={isActive}
                type="button"
                className={`pill-tab${isActive ? ' active' : ''}`}
                onClick={() => { haptic('selection'); setTab(it.key); }}
              >
                {it.label} ({it.count})
              </button>
            );
          })}
        </div>
      )}

      {/* Open Design master-services mobile: услуги сгруппированы по
          категориям (uppercase header «Нігті», «Волосся» и т.д.). Внутри —
          borderless rows с dashed bottom-border, 3px color-bar слева,
          inline toggle is_active и 3-точки. */}
      <div style={{ padding: `12px ${PAGE_PADDING_X}px 0`, display: 'flex', flexDirection: 'column' }}>
        {loading ? (
          [0, 1, 2].map((i) => (
            <div key={i} style={{ height: 56, marginBottom: 4, borderRadius: R.sm, background: T.bgSubtle }} />
          ))
        ) : visible.length === 0 ? (
          <div
            style={{
              padding: 28, border: `1px dashed ${T.border}`, borderRadius: R.md,
              background: T.surface, textAlign: 'center',
            }}
          >
            <div
              style={{
                width: 44, height: 44, margin: '0 auto', borderRadius: 12,
                background: T.bgSubtle, display: 'flex',
                alignItems: 'center', justifyContent: 'center',
              }}
            >
              <Scissors size={20} color={T.textTertiary} />
            </div>
            <p style={{ marginTop: 12, fontSize: 13, color: T.text, fontWeight: 600 }}>
              {tab === 'active' ? t.empty : t.emptyArchive}
            </p>
            <p style={{ marginTop: 4, fontSize: 11, color: T.textTertiary }}>
              {tab === 'active' ? t.emptyHint : t.emptyArchiveHint}
            </p>
          </div>
        ) : grouped.length > 0 ? (
          grouped.map((group, gi) => (
            <div key={group.category?.id ?? 'orphan'} style={{ marginTop: gi === 0 ? 0 : 4 }}>
              {/* Литерально .cat-header из OD master-services.html */}
              <div className="cat-header">
                {group.category?.name ?? t.uncategorized}
              </div>
              {group.services.map((s, i) => (
                <ServiceRowCard
                  key={s.id}
                  s={s}
                  i={i}
                  t={t}
                  lang={lang}
                  isLast={i === group.services.length - 1}
                  isToggling={toggling.has(s.id)}
                  onTap={() => { haptic('light'); setSheet({ mode: 'edit', service: s }); }}
                  onToggle={() => toggleActive(s)}
                />
              ))}
            </div>
          ))
        ) : null}
      </div>

      {/* По запросу 2026-05-19: вместо плавающего FAB — inline-кнопка
          в конце списка. Скроллится вместе с контентом и не закрывает
          функционал. Прежний position:fixed FAB (.fab CSS) удалён. */}
      {!loading && tab === 'active' && (
        <div style={{ padding: `12px ${PAGE_PADDING_X}px 8px` }}>
          <button
            type="button"
            onClick={() => { haptic('selection'); setSheet({ mode: 'create' }); }}
            aria-label={t.add}
            style={{
              width: '100%',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              padding: '14px 16px',
              borderRadius: R.md,
              border: `1px solid ${T.accent}`,
              background: T.accentSoft,
              color: T.accent,
              ...TYPE.bodyStrong,
              cursor: 'pointer', fontFamily: 'inherit',
            }}
          >
            <Plus size={16} strokeWidth={2.4} /> {t.add}
          </button>
        </div>
      )}

      <AnimatePresence>
        {sheet && (
          <ServiceSheet
            mode={sheet.mode}
            service={sheet.service}
            t={t}
            categories={categories}
            onCategoriesChange={(next) => setCategories(next)}
            onClose={() => setSheet(null)}
            onSaved={() => { setSheet(null); setRefreshKey((k) => k + 1); }}
          />
        )}
      </AnimatePresence>
    </MobilePage>
  );
}

function ServiceRowCard({ s, i, t, onTap, lang, isLast, isToggling, onToggle }: {
  s: Service;
  i: number;
  t: typeof I18N['ru'];
  onTap: () => void;
  lang: MiniAppLang;
  isLast: boolean;
  isToggling: boolean;
  onToggle: () => void;
}) {
  const color = s.color || 'var(--m-accent)';
  // Литеральная разметка из Open Design master-services.html (мобильный
  // экран, строки 1061-1075). Класс .service-row, .service-color-bar,
  // .service-info, .service-name, .service-meta, .sw, .more-btn.
  // Стили живут в /styles/od-master-services.css, импорт в этом файле сверху.
  return (
    <motion.div
      className={`service-row stagger-item s${Math.min(i, 8)}`}
      initial={false}
      animate={{ opacity: s.is_active ? 1 : 0.55 }}
      transition={{ duration: 0.18 }}
      // last child СNS-правило `:last-child` срабатывает на DOM-узле, но
      // когда у нас несколько групп категорий — последний row в каждой
      // группе всё равно нуждается в убирании bottom-border. Делаем явно.
      style={isLast ? { borderBottom: 'none' } : undefined}
    >
      <span
        className="service-color-bar"
        style={{ background: color }}
        aria-hidden
      />

      <button
        type="button"
        className="service-info"
        onClick={onTap}
      >
        <p className="service-name">{getServiceName(s, lang)}</p>
        <p className="service-meta">
          <span>{s.duration_minutes} {t.minutes}</span>
          <span className="service-meta-sep">—</span>
          <span style={{ fontVariantNumeric: 'tabular-nums' }}>
            {Number(s.price).toFixed(0)} {s.currency === 'UAH' ? '₴' : s.currency}
          </span>
        </p>
      </button>

      <button
        type="button"
        className={`sw${s.is_active ? ' on' : ''}`}
        onClick={(e) => { e.stopPropagation(); onToggle(); }}
        aria-pressed={s.is_active}
        aria-label={s.is_active ? t.archiveBtn : t.restoreBtn}
        disabled={isToggling}
      />

      <button
        type="button"
        className="more-btn"
        onClick={(e) => { e.stopPropagation(); onTap(); }}
        aria-label="Действия"
      >
        <MoreHorizontal size={16} />
      </button>
    </motion.div>
  );
}

function ServiceSheet({ mode, service, t, categories, onCategoriesChange, onClose, onSaved }: {
  mode: 'create' | 'edit';
  service?: Service;
  t: typeof I18N['ru'];
  categories: ServiceCategory[];
  onCategoriesChange: (next: ServiceCategory[]) => void;
  onClose: () => void;
  onSaved: () => void;
}) {
  const router = useRouter();
  const [name, setName] = useState(service?.name ?? '');
  const [duration, setDuration] = useState(String(service?.duration_minutes ?? 60));
  const [price, setPrice] = useState(String(service?.price ?? ''));
  const [description, setDescription] = useState(service?.description ?? '');
  const [color, setColor] = useState<string>(service?.color ?? COLORS[0]);
  const [categoryId, setCategoryId] = useState<string | null>(service?.category_id ?? null);
  const [isMobile, setIsMobile] = useState(!!service?.is_mobile);
  const [travelBuffer, setTravelBuffer] = useState(String(service?.travel_buffer_minutes ?? 0));
  const [requiresPrepayment, setRequiresPrepayment] = useState(!!service?.requires_prepayment);
  const [prepaymentAmount, setPrepaymentAmount] = useState(String(service?.prepayment_amount ?? 0));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  // Категория-CRUD состояние
  const [catManageOpen, setCatManageOpen] = useState(false);
  const [catBusy, setCatBusy] = useState(false);
  const [newCatName, setNewCatName] = useState('');
  const [renameId, setRenameId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  // Расходники: список доступного склада + map material_id → quantity_per_visit.
  // Загружаются при открытии sheet'а одним запросом /service-options.
  const [inventory, setInventory] = useState<Array<{ id: string; name: string; unit: string; quantity: number }>>([]);
  const [recipeMap, setRecipeMap] = useState<Record<string, number>>({});

  useTrackSheetOpen(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const initData = getInitData();
      const res = await fetch('/api/telegram/m/service-options', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(initData ? { 'X-TG-Init-Data': initData } : {}),
        },
        body: JSON.stringify({ service_id: service?.id ?? null }),
      });
      if (!res.ok || cancelled) return;
      const json = await res.json() as {
        inventory: Array<{ id: string; name: string; unit: string; quantity: number }>;
        materials: Array<{ material_id: string; quantity: number }>;
      };
      if (cancelled) return;
      setInventory(json.inventory ?? []);
      const m: Record<string, number> = {};
      for (const it of json.materials ?? []) m[it.material_id] = it.quantity;
      setRecipeMap(m);
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function callMutate(payload: Record<string, unknown>) {
    const initData = getInitData();
    const res = await fetch('/api/telegram/m/service-mutate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(initData ? { 'X-TG-Init-Data': initData } : {}),
      },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      throw new Error(j.detail || j.error || 'failed');
    }
    return res.json();
  }

  async function save() {
    if (busy) return;
    setErr(null);
    const n = name.trim();
    if (!n) { setErr(t.errName); return; }
    const dur = Number(duration.replace(',', '.'));
    if (!Number.isFinite(dur) || dur <= 0) { setErr(t.errDuration); return; }
    const pr = Number(price.replace(',', '.'));
    if (!Number.isFinite(pr) || pr < 0) { setErr(t.errPrice); return; }

    setBusy(true);
    try {
      // Расходники: только те, у кого qty>0. Нулевые удалятся через
      // полную замену service_materials в endpoint.
      const materials = Object.entries(recipeMap)
        .filter(([, q]) => Number(q) > 0)
        .map(([material_id, quantity]) => ({ material_id, quantity: Number(quantity) }));

      const common = {
        name: n,
        duration_minutes: dur,
        price: pr,
        description: description.trim() || null,
        color,
        category_id: categoryId,
        is_mobile: isMobile,
        travel_buffer_minutes: isMobile ? Math.max(0, Number(travelBuffer.replace(',', '.')) || 0) : 0,
        requires_prepayment: requiresPrepayment,
        prepayment_amount: requiresPrepayment ? Math.max(0, Number(prepaymentAmount.replace(',', '.')) || 0) : 0,
        materials,
      };
      if (mode === 'create') {
        await callMutate({ action: 'create', ...common });
      } else if (service) {
        await callMutate({ action: 'update', id: service.id, ...common });
      }
      onSaved();
    } catch (e) {
      setErr(e instanceof Error ? e.message : t.errSave);
    } finally {
      setBusy(false);
    }
  }

  async function archiveOrRestore() {
    if (!service || busy) return;
    setBusy(true);
    setErr(null);
    try {
      await callMutate({
        action: service.is_active ? 'archive' : 'restore',
        id: service.id,
      });
      onSaved();
    } catch (e) {
      setErr(e instanceof Error ? e.message : t.errSave);
    } finally {
      setBusy(false);
    }
  }

  async function deleteService() {
    if (!service || busy) return;
    if (!confirmDelete) { setConfirmDelete(true); return; }
    setBusy(true);
    setErr(null);
    try {
      // Soft-delete через archive — реальный DELETE может оставить orphans в
      // appointments. Архив = is_active=false.
      await callMutate({ action: 'archive', id: service.id });
      onSaved();
    } catch (e) {
      setErr(e instanceof Error ? e.message : t.errSave);
    } finally {
      setBusy(false);
    }
  }

  // ─── CRUD категорий ──────────────────────────────────────────────────
  async function callCatMutate(payload: Record<string, unknown>) {
    const initData = getInitData();
    const res = await fetch('/api/telegram/m/service-category-mutate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(initData ? { 'X-TG-Init-Data': initData } : {}),
      },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      throw new Error(j.detail || j.error || 'failed');
    }
    return res.json();
  }

  async function createCategory() {
    const n = newCatName.trim();
    if (!n || catBusy) return;
    setCatBusy(true);
    try {
      const j = await callCatMutate({ action: 'create', name: n }) as { category: ServiceCategory };
      const next = [...categories, j.category];
      onCategoriesChange(next);
      setCategoryId(j.category.id);
      setNewCatName('');
    } catch (e) {
      setErr(e instanceof Error ? e.message : t.errSave);
    } finally {
      setCatBusy(false);
    }
  }

  async function renameCategory(id: string) {
    const n = renameValue.trim();
    if (!n || catBusy) return;
    setCatBusy(true);
    try {
      await callCatMutate({ action: 'rename', id, name: n });
      onCategoriesChange(categories.map((c) => (c.id === id ? { ...c, name: n } : c)));
      setRenameId(null);
      setRenameValue('');
    } catch (e) {
      setErr(e instanceof Error ? e.message : t.errSave);
    } finally {
      setCatBusy(false);
    }
  }

  async function deleteCategory(id: string) {
    if (catBusy) return;
    setCatBusy(true);
    try {
      await callCatMutate({ action: 'delete', id });
      onCategoriesChange(categories.filter((c) => c.id !== id));
      if (categoryId === id) setCategoryId(null);
    } catch (e) {
      setErr(e instanceof Error ? e.message : t.errSave);
    } finally {
      setCatBusy(false);
    }
  }

  return (
    <MiniAppPortal>
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={() => !busy && onClose()}
      style={{
        position: 'fixed', inset: 0, zIndex: 80,
        display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
        background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)',
      }}
    >
      <motion.div
        initial={{ y: 40, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 40, opacity: 0 }}
        transition={SPRING.default}
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: 480,
          borderRadius: `${R.lg}px ${R.lg}px 0 0`,
          background: T.surface,
          padding: `20px ${PAGE_PADDING_X}px`,
          // 24px минимум под home-indicator — раньше было 96px, давало
          // огромное пустое пространство ниже кнопок «Удалить» (см. скрин
          // 2026-05-11). Шторка модальная, bottom-nav закрыт backdrop'ом —
          // лишнего запаса не нужно.
          paddingBottom: 'calc(24px + env(safe-area-inset-bottom, 0px))',
          boxShadow: SHADOW.elevated,
          // Учитываем top-chrome Telegram (× Закрыть, ⋯) — иначе шапка
          // шторки залезает под кнопки TG.
          maxHeight: 'calc(var(--tg-viewport-height, 100dvh) - max(var(--tg-content-top, 0px), 80px))',
          overflowY: 'auto',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <h3 style={{ ...TYPE.h3, color: T.text, margin: 0 }}>
            {mode === 'create' ? t.sheetCreate : t.sheetEdit}
          </h3>
          <button
            type="button" onClick={() => !busy && onClose()}
            aria-label="Закрыть"
            style={{
              width: 36, height: 36, borderRadius: '50%',
              border: `1px solid ${T.border}`, background: T.surface,
              display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
            }}
          >
            <X size={16} color={T.text} />
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <Field label={t.fieldName}>
            <input
              autoFocus={mode === 'create'}
              value={name}
              onChange={(e) => setName(e.target.value.slice(0, 120))}
              placeholder={t.placeholderName}
              style={inputStyle}
            />
          </Field>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <Field label={t.fieldDuration}>
              <input
                type="text"
                inputMode="numeric"
                value={duration}
                onChange={(e) => setDuration(e.target.value.replace(/\D/g, '').slice(0, 4))}
                style={inputStyle}
              />
            </Field>
            <Field label={t.fieldPrice}>
              <input
                type="text"
                inputMode="decimal"
                value={price}
                onChange={(e) => setPrice(e.target.value.replace(/[^\d.,]/g, '').slice(0, 10))}
                style={inputStyle}
              />
            </Field>
          </div>

          <Field label={t.fieldDescription}>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value.slice(0, 500))}
              placeholder={t.placeholderDescription}
              rows={3}
              style={{ ...inputStyle, resize: 'none' }}
            />
          </Field>

          <Field label={t.fieldColor}>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              {COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  aria-label={c}
                  style={{
                    width: 32, height: 32, borderRadius: '50%',
                    background: c,
                    border: c === color ? `3px solid ${T.text}` : `1px solid ${T.borderSubtle}`,
                    cursor: 'pointer', padding: 0,
                  }}
                />
              ))}
            </div>
          </Field>

          {/* Категория услуги ─────────────────────────────────────────
              Выбор существующей категории (чипсы) + раскладушка-управление
              «Управлять» с create / rename / delete. */}
          <div
            style={{
              borderRadius: R.md,
              border: `1px solid ${T.borderSubtle}`,
              background: T.bg,
              padding: '12px 14px 14px',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: 8,
              }}
            >
              <p
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                  color: T.textTertiary,
                  margin: 0,
                }}
              >
                {t.categoryLabel}
              </p>
              <button
                type="button"
                onClick={() => setCatManageOpen((v) => !v)}
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  color: T.accent,
                  background: 'transparent',
                  border: 0,
                  padding: 0,
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                }}
              >
                {catManageOpen ? t.categoryDone : t.categoryManage}
              </button>
            </div>

            {/* Чипсы выбора */}
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={() => setCategoryId(null)}
                style={{
                  padding: '6px 12px',
                  borderRadius: R.pill,
                  border: `1.5px solid ${categoryId === null ? T.accent : T.border}`,
                  background: categoryId === null ? T.accentSoft : T.surface,
                  color: categoryId === null ? T.accent : T.textSecondary,
                  fontSize: 12,
                  fontWeight: 500,
                  fontFamily: 'inherit',
                  cursor: 'pointer',
                }}
              >
                {t.uncategorized}
              </button>
              {categories.map((c) => {
                const on = categoryId === c.id;
                if (catManageOpen) {
                  return (
                    <div
                      key={c.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 4,
                        padding: '6px 8px 6px 12px',
                        borderRadius: R.pill,
                        border: `1.5px solid ${T.border}`,
                        background: T.surface,
                      }}
                    >
                      {renameId === c.id ? (
                        <input
                          autoFocus
                          value={renameValue}
                          onChange={(e) => setRenameValue(e.target.value.slice(0, 60))}
                          onBlur={() => { if (renameValue.trim()) renameCategory(c.id); else setRenameId(null); }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') renameCategory(c.id);
                            if (e.key === 'Escape') { setRenameId(null); setRenameValue(''); }
                          }}
                          style={{
                            background: 'transparent',
                            border: 'none',
                            outline: 'none',
                            fontSize: 12,
                            fontWeight: 500,
                            color: T.text,
                            fontFamily: 'inherit',
                            width: Math.max(80, renameValue.length * 8),
                          }}
                        />
                      ) : (
                        <button
                          type="button"
                          onClick={() => { setRenameId(c.id); setRenameValue(c.name); }}
                          style={{
                            background: 'transparent',
                            border: 0,
                            padding: 0,
                            cursor: 'pointer',
                            fontSize: 12,
                            fontWeight: 500,
                            color: T.text,
                            fontFamily: 'inherit',
                          }}
                        >
                          {c.name}
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => deleteCategory(c.id)}
                        disabled={catBusy}
                        aria-label={t.categoryDelete}
                        style={{
                          width: 18,
                          height: 18,
                          borderRadius: '50%',
                          background: T.dangerSoft ?? 'rgba(239, 68, 68, 0.1)',
                          color: T.danger ?? '#ef4444',
                          border: 0,
                          padding: 0,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <X size={11} />
                      </button>
                    </div>
                  );
                }
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setCategoryId(c.id)}
                    style={{
                      padding: '6px 12px',
                      borderRadius: R.pill,
                      border: `1.5px solid ${on ? T.accent : T.border}`,
                      background: on ? T.accentSoft : T.surface,
                      color: on ? T.accent : T.textSecondary,
                      fontSize: 12,
                      fontWeight: 500,
                      fontFamily: 'inherit',
                      cursor: 'pointer',
                    }}
                  >
                    {c.name}
                  </button>
                );
              })}
            </div>

            {/* Создание новой категории — видно только в режиме «Управлять» */}
            {catManageOpen && (
              <div style={{ display: 'flex', gap: 6, marginTop: 10 }}>
                <input
                  value={newCatName}
                  onChange={(e) => setNewCatName(e.target.value.slice(0, 60))}
                  onKeyDown={(e) => { if (e.key === 'Enter') createCategory(); }}
                  placeholder={t.categoryNewPh}
                  style={{
                    flex: 1,
                    padding: '8px 12px',
                    borderRadius: R.md,
                    border: `1px solid ${T.border}`,
                    background: T.surface,
                    color: T.text,
                    fontSize: 13,
                    fontFamily: 'inherit',
                    outline: 'none',
                  }}
                />
                <button
                  type="button"
                  onClick={createCategory}
                  disabled={catBusy || !newCatName.trim()}
                  style={{
                    padding: '8px 14px',
                    borderRadius: R.md,
                    background: T.accent,
                    color: '#fff',
                    border: 0,
                    fontSize: 13,
                    fontWeight: 600,
                    fontFamily: 'inherit',
                    cursor: 'pointer',
                    opacity: catBusy || !newCatName.trim() ? 0.5 : 1,
                  }}
                >
                  {t.categoryAdd}
                </button>
              </div>
            )}
          </div>

          {/* Тумблеры — выездная услуга и предоплата. Open conditional fields ниже. */}
          <ToggleRow
            label={t.toggleMobile} hint={t.toggleMobileHint}
            on={isMobile} onChange={setIsMobile}
          />
          {isMobile && (
            <Field label={t.fieldTravelBuffer}>
              <input
                type="text" inputMode="numeric"
                value={travelBuffer}
                onChange={(e) => setTravelBuffer(e.target.value.replace(/\D/g, '').slice(0, 4))}
                style={inputStyle}
              />
            </Field>
          )}
          <ToggleRow
            label={t.togglePrepayment} hint={t.togglePrepaymentHint}
            on={requiresPrepayment} onChange={setRequiresPrepayment}
          />
          {requiresPrepayment && (
            <Field label={t.fieldPrepaymentAmount}>
              <input
                type="text" inputMode="decimal"
                value={prepaymentAmount}
                onChange={(e) => setPrepaymentAmount(e.target.value.replace(/[^\d.,]/g, '').slice(0, 10))}
                style={inputStyle}
              />
            </Field>
          )}

          {/* Расходники на 1 визит — паритет с веб-формой. Если у мастера
              склад пуст, показываем подсказку добавить там. */}
          <div
            style={{
              borderRadius: R.md,
              border: `1px solid ${T.borderSubtle}`,
              background: T.bg,
              padding: 14,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <Package size={14} color={T.text} />
              <p style={{ fontSize: 13, fontWeight: 700, color: T.text, margin: 0 }}>{t.materialsTitle}</p>
            </div>
            <p style={{ fontSize: 11, color: T.textTertiary, margin: 0 }}>{t.materialsHint}</p>

            {inventory.length === 0 ? (
              // Раньше тут был курсивный hint в одну строку — клиент не понимал
              // что с ним делать. Теперь — tappable кнопка прямо на склад в
              // Mini App (см. скрин 2026-05-11 «не вижу возможности добавить
              // расходник»). После добавления материалов мастер вернётся сюда
              // и увидит список с количеством.
              <button
                type="button"
                onClick={() => router.push('/telegram/m/inventory')}
                style={{
                  marginTop: 10,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 10,
                  padding: '12px 14px',
                  borderRadius: R.sm,
                  border: `1px dashed ${T.accent}`,
                  background: T.accentSoft,
                  color: T.accent,
                  fontSize: 13,
                  fontWeight: 600,
                  fontFamily: 'inherit',
                  cursor: 'pointer',
                  width: '100%',
                  textAlign: 'left',
                }}
              >
                <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Plus size={14} />
                  {t.materialsEmpty}
                </span>
                <ArrowRight size={14} />
              </button>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 12 }}>
                {inventory.map((it) => {
                  const qty = recipeMap[it.id] ?? 0;
                  return (
                    <div
                      key={it.id}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 10,
                        padding: '10px 12px', borderRadius: R.sm,
                        background: T.surface,
                        border: `1px solid ${qty > 0 ? T.accent : T.borderSubtle}`,
                      }}
                    >
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ fontSize: 13, fontWeight: 600, color: T.text, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {it.name}
                        </p>
                        <p style={{ fontSize: 11, color: T.textTertiary, margin: '2px 0 0' }}>
                          {it.quantity} {it.unit} {t.materialsStock}
                        </p>
                      </div>
                      <input
                        type="text"
                        inputMode="decimal"
                        value={qty > 0 ? String(qty) : ''}
                        placeholder="0"
                        onChange={(e) => {
                          const raw = e.target.value.replace(/[^\d.,]/g, '').replace(',', '.').slice(0, 8);
                          const num = raw === '' ? 0 : Number(raw);
                          setRecipeMap((prev) => {
                            const next = { ...prev };
                            if (Number.isFinite(num) && num > 0) next[it.id] = num;
                            else delete next[it.id];
                            return next;
                          });
                        }}
                        style={{
                          width: 64, textAlign: 'right',
                          background: 'transparent', border: 'none', outline: 'none',
                          fontSize: 16, fontWeight: 700, color: T.text, fontFamily: 'inherit',
                        }}
                      />
                      <span style={{ fontSize: 11, color: T.textTertiary, minWidth: 24 }}>{it.unit}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {err && <p style={{ ...TYPE.caption, color: T.danger, margin: 0 }}>{err}</p>}

          <button
            type="button"
            onClick={save}
            disabled={busy}
            style={{
              marginTop: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              width: '100%', padding: '14px 16px', borderRadius: R.md, border: 'none',
              background: T.text, color: T.bg,
              fontSize: 15, fontWeight: 700, cursor: busy ? 'wait' : 'pointer',
              fontFamily: 'inherit', opacity: busy ? 0.6 : 1,
            }}
          >
            {busy ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
            {busy ? t.saving : t.save}
          </button>

          {mode === 'edit' && service && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 4 }}>
              <button
                type="button"
                onClick={archiveOrRestore}
                disabled={busy}
                style={secondaryBtn(false)}
              >
                {service.is_active ? <Archive size={14} /> : <RotateCcw size={14} />}
                {service.is_active ? t.archiveBtn : t.restoreBtn}
              </button>
              <button
                type="button"
                onClick={deleteService}
                disabled={busy}
                style={secondaryBtn(true)}
              >
                <Trash2 size={14} />
                {confirmDelete ? t.deleteConfirm : t.deleteBtn}
              </button>
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
    </MiniAppPortal>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div
      style={{
        borderRadius: R.md,
        border: `1px solid ${T.borderSubtle}`,
        background: T.bg,
        padding: '12px 14px 14px',
      }}
    >
      <p
        style={{
          fontSize: 10,
          fontWeight: 700,
          textTransform: 'uppercase',
          letterSpacing: '0.1em',
          color: T.textTertiary,
          margin: 0,
          marginBottom: 8,
        }}
      >
        {label}
      </p>
      {children}
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  background: 'transparent', border: 'none', outline: 'none',
  fontSize: 16, // 16+ чтобы iOS не зумил при focus
  fontWeight: 500,
  lineHeight: 1.3,
  color: T.text,
  caretColor: T.accent,
  fontFamily: 'inherit',
  padding: 0,
};

function ToggleRow({ label, hint, on, onChange }: { label: string; hint?: string; on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!on)}
      style={{
        display: 'flex', alignItems: 'center', gap: 12,
        padding: '14px',
        borderRadius: R.md,
        border: `1px solid ${T.borderSubtle}`,
        background: T.bg,
        textAlign: 'left',
        cursor: 'pointer',
        fontFamily: 'inherit',
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: 14, fontWeight: 600, color: T.text, margin: 0 }}>{label}</p>
        {hint && <p style={{ fontSize: 12, color: T.textTertiary, margin: '2px 0 0' }}>{hint}</p>}
      </div>
      <span
        style={{
          width: 44, height: 26, borderRadius: 13,
          background: on ? T.accent : T.borderSubtle,
          position: 'relative',
          transition: 'background 0.2s',
          flexShrink: 0,
        }}
      >
        <span
          style={{
            position: 'absolute', top: 3,
            left: on ? 21 : 3,
            width: 20, height: 20, borderRadius: '50%',
            background: '#fff',
            boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
            transition: 'left 0.2s',
          }}
        />
      </span>
    </button>
  );
}

function secondaryBtn(danger: boolean): React.CSSProperties {
  return {
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
    padding: '10px 12px', borderRadius: R.pill,
    border: `1px solid ${danger ? T.dangerSoft : T.border}`,
    background: danger ? T.dangerSoft : T.surface,
    color: danger ? T.danger : T.text,
    fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
  };
}
