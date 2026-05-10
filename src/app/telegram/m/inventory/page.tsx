/** --- YAML
 * name: MasterMiniAppInventory
 * description: Склад мастера в Mini App. Список материалов (название, остаток, единица,
 *              порог низкого запаса). CRUD через bottom-sheet. Запрос остатка обновляется
 *              после восполнения вручную; auto-spis происходит при completed appointment
 *              через service_materials (рецепты). Cron low-stock пушит уведомление когда
 *              quantity ≤ low_stock_threshold.
 * created: 2026-05-10
 * --- */

'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Package, Plus, X, Check, Loader2, Trash2, ArrowLeft, AlertTriangle } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/auth-store';
import { useTelegram } from '@/components/miniapp/telegram-provider';
import { getInitData } from '@/lib/telegram/webapp';
import { MobilePage, PageHeader } from '@/components/miniapp/shells';
import { T, R, TYPE, SHADOW, PAGE_PADDING_X, SPRING, FONT_BASE } from '@/components/miniapp/design';
import { useMiniAppLocale, type MiniAppLang } from '@/lib/miniapp/use-locale';

interface Item {
  id: string;
  name: string;
  quantity: number;
  unit: string;
  low_stock_threshold: number | null;
  cost_per_unit: number | null;
  preferred_supplier_id: string | null;
}

interface SupplierOpt {
  id: string;
  name: string;
}

const UNITS: Array<{ value: Item['unit']; label: string }> = [
  { value: 'pcs', label: 'шт' },
  { value: 'ml', label: 'мл' },
  { value: 'g', label: 'г' },
  { value: 'bottles', label: 'бут' },
  { value: 'impulses', label: 'импульс' },
  { value: 'sessions', label: 'сеанс' },
];

const I18N: Record<MiniAppLang, {
  title: string;
  subtitle: (active: number, low: number) => string;
  empty: string; emptyHint: string;
  add: string; back: string;
  sheetCreate: string; sheetEdit: string;
  fieldName: string; fieldQuantity: string; fieldUnit: string; fieldThreshold: string;
  fieldCost: string; fieldSupplier: string; supplierNone: string; suppliersEmptyHint: string;
  thresholdHint: string;
  placeholderName: string;
  save: string; saving: string;
  deleteBtn: string; deleteConfirm: string;
  errName: string; errQuantity: string; errSave: string;
  lowStock: string;
  unitsLabel: string;
}> = {
  uk: {
    title: 'Склад',
    subtitle: (a, l) => l > 0 ? `${a} матеріалів · ${l} закінчуються` : `${a} матеріалів`,
    empty: 'Склад порожній', emptyHint: 'Додай перший матеріал — тапни «+ Додати»',
    add: 'Додати матеріал', back: 'Назад',
    sheetCreate: 'Новий матеріал', sheetEdit: 'Редагувати матеріал',
    fieldName: 'Назва', fieldQuantity: 'Залишок', fieldUnit: 'Одиниця',
    fieldThreshold: 'Поріг (опц.)',
    fieldCost: 'Ціна / од. (₴)', fieldSupplier: 'Постачальник',
    supplierNone: 'Без постачальника',
    suppliersEmptyHint: 'Спочатку додай постачальника у вкладці «Постачальники» — тоді при формуванні замовлення сюди потраплять тільки його товари',
    thresholdHint: 'Коли залишок впаде нижче — отримаєш push',
    placeholderName: 'Гель, олія, голка…',
    save: 'Зберегти', saving: 'Зберігаємо…',
    deleteBtn: 'Видалити', deleteConfirm: 'Видалити повністю?',
    errName: 'Введи назву', errQuantity: 'Введи залишок', errSave: 'Не вдалось зберегти',
    lowStock: 'Закінчується',
    unitsLabel: 'Одиниця',
  },
  ru: {
    title: 'Склад',
    subtitle: (a, l) => l > 0 ? `${a} материалов · ${l} заканчиваются` : `${a} материалов`,
    empty: 'Склад пустой', emptyHint: 'Добавь первый материал — тапни «+ Добавить»',
    add: 'Добавить материал', back: 'Назад',
    sheetCreate: 'Новый материал', sheetEdit: 'Редактировать материал',
    fieldName: 'Название', fieldQuantity: 'Остаток', fieldUnit: 'Единица',
    fieldThreshold: 'Порог (опц.)',
    fieldCost: 'Цена / ед. (₴)', fieldSupplier: 'Поставщик',
    supplierNone: 'Без поставщика',
    suppliersEmptyHint: 'Сначала добавь поставщика во вкладке «Поставщики» — тогда при формировании заказа сюда попадут только его товары',
    thresholdHint: 'Когда остаток опустится ниже — получишь push',
    placeholderName: 'Гель, масло, иголка…',
    save: 'Сохранить', saving: 'Сохраняем…',
    deleteBtn: 'Удалить', deleteConfirm: 'Удалить полностью?',
    errName: 'Введи название', errQuantity: 'Введи остаток', errSave: 'Не удалось сохранить',
    lowStock: 'Заканчивается',
    unitsLabel: 'Единица',
  },
  en: {
    title: 'Inventory',
    subtitle: (a, l) => l > 0 ? `${a} items · ${l} running low` : `${a} items`,
    empty: 'Inventory empty', emptyHint: 'Add your first item — tap «+ Add»',
    add: 'Add item', back: 'Back',
    sheetCreate: 'New item', sheetEdit: 'Edit item',
    fieldName: 'Name', fieldQuantity: 'In stock', fieldUnit: 'Unit',
    fieldThreshold: 'Low threshold (optional)',
    fieldCost: 'Cost / unit (₴)', fieldSupplier: 'Supplier',
    supplierNone: 'No supplier',
    suppliersEmptyHint: 'Add a supplier in the Suppliers tab first — then when you form an order only their items will appear here',
    thresholdHint: 'You’ll get a push when stock drops below this',
    placeholderName: 'Gel, oil, needle…',
    save: 'Save', saving: 'Saving…',
    deleteBtn: 'Delete', deleteConfirm: 'Delete permanently?',
    errName: 'Enter name', errQuantity: 'Enter quantity', errSave: 'Failed to save',
    lowStock: 'Running low',
    unitsLabel: 'Unit',
  },
};

export default function MasterMiniAppInventory() {
  const { userId } = useAuthStore();
  const { haptic } = useTelegram();
  const router = useRouter();
  const lang = useMiniAppLocale();
  const t = I18N[lang];
  const [items, setItems] = useState<Item[]>([]);
  const [suppliers, setSuppliers] = useState<SupplierOpt[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);
  const [sheet, setSheet] = useState<{ mode: 'create' | 'edit'; item?: Item } | null>(null);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    (async () => {
      const initData = getInitData();
      if (!initData) { setLoading(false); return; }
      // Тянем материалы и поставщиков параллельно — поставщики нужны для
      // дропдауна «Поставщик» в форме создания/редактирования материала.
      const [resItems, resSuppliers] = await Promise.all([
        fetch('/api/telegram/m/inventory-list', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ initData }),
        }),
        fetch('/api/telegram/m/suppliers-list', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ initData }),
        }),
      ]);
      if (cancelled) return;
      if (resItems.ok) {
        const json = await resItems.json() as { items: Item[] };
        if (!cancelled) setItems(json.items ?? []);
      }
      if (resSuppliers.ok) {
        const json = await resSuppliers.json() as { items: Array<{ id: string; name: string; is_active?: boolean }> };
        if (!cancelled) setSuppliers((json.items ?? []).filter((s) => s.is_active !== false).map((s) => ({ id: s.id, name: s.name })));
      }
      if (!cancelled) setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [userId, refreshKey]);

  const lowCount = items.filter((i) => i.low_stock_threshold != null && Number(i.quantity) <= Number(i.low_stock_threshold)).length;

  return (
    <MobilePage>
      <div style={{ padding: `12px ${PAGE_PADDING_X}px 0`, ...FONT_BASE }}>
        <button
          type="button"
          onClick={() => { haptic('light'); router.back(); }}
          aria-label={t.back}
          style={{
            width: 40, height: 40, borderRadius: 20,
            border: `1px solid ${T.border}`, background: T.surface, color: T.text,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', boxShadow: SHADOW.card,
          }}
        >
          <ArrowLeft size={18} strokeWidth={2.4} />
        </button>
      </div>
      <PageHeader title={t.title} subtitle={loading ? undefined : t.subtitle(items.length, lowCount)} />

      <div style={{ padding: `8px ${PAGE_PADDING_X}px 0`, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {loading ? (
          [0, 1, 2].map((i) => (
            <div key={i} style={{ height: 60, borderRadius: R.md, background: T.bgSubtle }} />
          ))
        ) : items.length === 0 ? (
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
              <Package size={20} color={T.textTertiary} />
            </div>
            <p style={{ marginTop: 12, ...TYPE.bodyStrong, color: T.text }}>{t.empty}</p>
            <p style={{ marginTop: 4, ...TYPE.caption, color: T.textTertiary }}>{t.emptyHint}</p>
          </div>
        ) : (
          items.map((it, i) => (
            <ItemRow key={it.id} item={it} i={i} t={t} onTap={() => { haptic('light'); setSheet({ mode: 'edit', item: it }); }} />
          ))
        )}

        <button
          type="button"
          onClick={() => { haptic('light'); setSheet({ mode: 'create' }); }}
          style={{
            marginTop: 8,
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
          <Plus size={16} strokeWidth={2.4} />
          {t.add}
        </button>
      </div>

      <AnimatePresence>
        {sheet && (
          <ItemSheet
            mode={sheet.mode}
            item={sheet.item}
            t={t}
            suppliers={suppliers}
            onClose={() => setSheet(null)}
            onSaved={() => { setSheet(null); setRefreshKey((k) => k + 1); }}
          />
        )}
      </AnimatePresence>
    </MobilePage>
  );
}

function ItemRow({ item, i, t, onTap }: { item: Item; i: number; t: typeof I18N['ru']; onTap: () => void }) {
  const isLow = item.low_stock_threshold != null && Number(item.quantity) <= Number(item.low_stock_threshold);
  const unitLabel = UNITS.find((u) => u.value === item.unit)?.label ?? item.unit;
  return (
    <motion.button
      type="button"
      onClick={onTap}
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: i * 0.02 }}
      style={{
        display: 'flex', alignItems: 'center', gap: 12,
        padding: '12px 14px', borderRadius: R.md,
        border: `1px solid ${isLow ? T.warning : T.borderSubtle}`,
        background: T.surface,
        boxShadow: SHADOW.card,
        cursor: 'pointer',
        textAlign: 'left',
        fontFamily: 'inherit',
        width: '100%',
      }}
    >
      <div style={{
        width: 36, height: 36, borderRadius: R.sm,
        background: isLow ? T.warningSoft : T.bgSubtle,
        color: isLow ? T.warning : T.textSecondary,
        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
      }}>
        {isLow ? <AlertTriangle size={16} /> : <Package size={16} />}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ margin: 0, ...TYPE.bodyStrong, color: T.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {item.name}
        </p>
        {isLow && (
          <p style={{ margin: '2px 0 0', ...TYPE.micro, color: T.warning, fontWeight: 600 }}>
            {t.lowStock}
          </p>
        )}
      </div>
      <p style={{ margin: 0, ...TYPE.bodyStrong, color: T.text, fontVariantNumeric: 'tabular-nums', textAlign: 'right' }}>
        {Number(item.quantity)}{' '}
        <span style={{ ...TYPE.caption, color: T.textTertiary, fontWeight: 500 }}>{unitLabel}</span>
      </p>
    </motion.button>
  );
}

function ItemSheet({ mode, item, t, suppliers, onClose, onSaved }: {
  mode: 'create' | 'edit';
  item?: Item;
  t: typeof I18N['ru'];
  suppliers: SupplierOpt[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(item?.name ?? '');
  const [quantity, setQuantity] = useState(String(item?.quantity ?? ''));
  const [unit, setUnit] = useState<Item['unit']>(item?.unit ?? 'pcs');
  const [threshold, setThreshold] = useState(item?.low_stock_threshold != null ? String(item.low_stock_threshold) : '');
  const [cost, setCost] = useState(item?.cost_per_unit != null && item.cost_per_unit > 0 ? String(item.cost_per_unit) : '');
  const [supplierId, setSupplierId] = useState<string | null>(item?.preferred_supplier_id ?? null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  async function callMutate(payload: Record<string, unknown>) {
    const initData = getInitData();
    const res = await fetch('/api/telegram/m/inventory-mutate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(initData ? { 'X-TG-Init-Data': initData } : {}),
      },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      throw new Error(j.error || 'failed');
    }
    return res.json();
  }

  async function save() {
    if (busy) return;
    setErr(null);
    const n = name.trim();
    if (!n) { setErr(t.errName); return; }
    const q = Number(quantity.replace(',', '.'));
    if (!Number.isFinite(q) || q < 0) { setErr(t.errQuantity); return; }
    const thrRaw = threshold.trim().replace(',', '.');
    const thr = thrRaw === '' ? null : Number(thrRaw);

    const costRaw = cost.trim().replace(',', '.');
    const costNum = costRaw === '' ? null : Number(costRaw);

    setBusy(true);
    try {
      const common = {
        name: n, quantity: q, unit,
        low_stock_threshold: thr,
        cost_per_unit: costNum,
        preferred_supplier_id: supplierId,
      };
      if (mode === 'create') {
        await callMutate({ action: 'create', ...common });
      } else if (item) {
        await callMutate({ action: 'update', id: item.id, ...common });
      }
      onSaved();
    } catch (e) {
      setErr(e instanceof Error ? e.message : t.errSave);
    } finally {
      setBusy(false);
    }
  }

  async function deleteItem() {
    if (!item || busy) return;
    if (!confirmDelete) { setConfirmDelete(true); return; }
    setBusy(true);
    setErr(null);
    try {
      await callMutate({ action: 'delete', id: item.id });
      onSaved();
    } catch (e) {
      setErr(e instanceof Error ? e.message : t.errSave);
    } finally {
      setBusy(false);
    }
  }

  return (
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
          padding: 0,
          paddingBottom: 'calc(96px + env(safe-area-inset-bottom, 0px))',
          boxShadow: SHADOW.elevated,
          maxHeight: '90dvh', overflowY: 'auto',
        }}
      >
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: `18px ${PAGE_PADDING_X}px 14px`,
        }}>
          <h3 style={{ ...TYPE.h3, color: T.text, margin: 0 }}>
            {mode === 'create' ? t.sheetCreate : t.sheetEdit}
          </h3>
          <button
            type="button" onClick={() => !busy && onClose()}
            aria-label="Закрыть"
            style={{
              width: 32, height: 32, borderRadius: '50%',
              border: 'none', background: T.bgSubtle, color: T.textSecondary,
              display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
            }}
          >
            <X size={14} />
          </button>
        </div>

        <FullDivider />

        <FlatRow label={t.fieldName}>
          <input
            autoFocus={mode === 'create'}
            value={name}
            onChange={(e) => setName(e.target.value.slice(0, 120))}
            placeholder={t.placeholderName}
            style={inputStyle}
          />
        </FlatRow>
        <FullDivider />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr' }}>
          <FlatRow label={t.fieldQuantity}>
            <input
              type="text"
              inputMode="decimal"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value.replace(/[^\d.,]/g, '').slice(0, 10))}
              style={inputStyle}
            />
          </FlatRow>
          <div style={{ borderLeft: `1px solid ${T.borderSubtle}` }}>
            <FlatRow label={t.fieldUnit}>
              <select
                value={unit}
                onChange={(e) => setUnit(e.target.value as Item['unit'])}
                style={{ ...inputStyle, fontSize: 16, appearance: 'none' }}
              >
                {UNITS.map((u) => (
                  <option key={u.value} value={u.value}>{u.label}</option>
                ))}
              </select>
            </FlatRow>
          </div>
        </div>
        <FullDivider />
        <FlatRow label={t.fieldCost}>
          <input
            type="text"
            inputMode="decimal"
            value={cost}
            onChange={(e) => setCost(e.target.value.replace(/[^\d.,]/g, '').slice(0, 10))}
            placeholder="—"
            style={inputStyle}
          />
        </FlatRow>
        <FullDivider />
        <FlatRow label={t.fieldThreshold}>
          <input
            type="text"
            inputMode="decimal"
            value={threshold}
            onChange={(e) => setThreshold(e.target.value.replace(/[^\d.,]/g, '').slice(0, 10))}
            placeholder="—"
            style={inputStyle}
          />
        </FlatRow>
        <FullDivider />
        <FlatRow label={t.fieldSupplier}>
          <select
            value={supplierId ?? '__none__'}
            onChange={(e) => setSupplierId(e.target.value === '__none__' ? null : e.target.value)}
            style={{ ...inputStyle, fontSize: 16, appearance: 'none' }}
          >
            <option value="__none__">{t.supplierNone}</option>
            {suppliers.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </FlatRow>
        <FullDivider />

        <p style={{
          ...TYPE.micro, color: T.textTertiary,
          padding: `12px ${PAGE_PADDING_X}px 4px`,
          margin: 0, lineHeight: 1.5,
        }}>
          {t.thresholdHint}
        </p>
        {suppliers.length === 0 && (
          <p style={{
            ...TYPE.micro, color: T.textTertiary,
            padding: `4px ${PAGE_PADDING_X}px 0`,
            margin: 0, lineHeight: 1.5,
          }}>
            {t.suppliersEmptyHint}
          </p>
        )}

        {err && (
          <p style={{
            ...TYPE.caption, color: T.danger,
            padding: `0 ${PAGE_PADDING_X}px`, margin: 0,
          }}>{err}</p>
        )}

        <div style={{ padding: `16px ${PAGE_PADDING_X}px 0`, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <button
            type="button"
            onClick={save}
            disabled={busy}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              width: '100%', padding: '15px 16px', borderRadius: R.lg, border: 'none',
              background: T.accent, color: '#fff',
              ...TYPE.bodyStrong, fontWeight: 700, cursor: busy ? 'wait' : 'pointer',
              fontFamily: 'inherit', opacity: busy ? 0.6 : 1,
            }}
          >
            {busy ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
            {busy ? t.saving : t.save}
          </button>

          {mode === 'edit' && item && (
            <button
              type="button"
              onClick={deleteItem}
              disabled={busy}
              style={{
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                padding: '12px 16px', borderRadius: R.pill,
                border: `1px solid ${T.dangerSoft}`,
                background: T.dangerSoft, color: T.danger,
                ...TYPE.bodyStrong, cursor: 'pointer', fontFamily: 'inherit',
                marginTop: 4,
              }}
            >
              <Trash2 size={14} />
              {confirmDelete ? t.deleteConfirm : t.deleteBtn}
            </button>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}

function FlatRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ padding: `12px ${PAGE_PADDING_X}px 14px` }}>
      <p
        style={{
          fontSize: 11,
          fontWeight: 600,
          textTransform: 'uppercase',
          letterSpacing: '0.06em',
          color: T.textTertiary,
          margin: 0,
          marginBottom: 6,
        }}
      >
        {label}
      </p>
      {children}
    </div>
  );
}

function FullDivider() {
  return <div style={{ height: 1, background: T.borderSubtle, width: '100%' }} />;
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  background: 'transparent', border: 'none', outline: 'none',
  fontSize: 16, // 16+ чтобы iOS не зумил при focus
  fontWeight: 500,
  lineHeight: 1.3,
  color: T.text,
  fontFamily: 'inherit',
  padding: 0,
};
