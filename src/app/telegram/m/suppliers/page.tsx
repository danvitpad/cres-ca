/** --- YAML
 * name: MasterMiniAppSuppliers
 * description: Поставщики мастера в Mini App. Список (имя, контакт, телефон) +
 *              CRUD через bottom-sheet. Архив отдельной секцией ниже активных.
 *              Чтение через /api/telegram/m/suppliers-list (initData auth +
 *              admin client минует RLS, иначе список пустой в TG WebApp).
 * created: 2026-05-10
 * --- */

'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Truck, Plus, X, Check, Loader2, Trash2, ArrowLeft, Archive, RotateCcw, Phone, Mail, Send } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/auth-store';
import { useTelegram } from '@/components/miniapp/telegram-provider';
import { getInitData } from '@/lib/telegram/webapp';
import { MobilePage, PageHeader } from '@/components/miniapp/shells';
import { T, R, TYPE, SHADOW, PAGE_PADDING_X, SPRING, FONT_BASE } from '@/components/miniapp/design';
import { useMiniAppLocale, type MiniAppLang } from '@/lib/miniapp/use-locale';
import '@/styles/od-master-suppliers.css';

interface Supplier {
  id: string;
  name: string;
  contact_person: string | null;
  phone: string | null;
  email: string | null;
  telegram_id: string | null;
  note: string | null;
  is_active: boolean;
}

const I18N: Record<MiniAppLang, {
  title: string;
  subtitle: (active: number, archived: number) => string;
  empty: string; emptyHint: string;
  add: string; back: string;
  archived: string;
  sheetCreate: string; sheetEdit: string;
  fieldName: string; fieldContact: string; fieldPhone: string; fieldEmail: string; fieldTelegram: string; fieldNote: string;
  placeholderName: string; placeholderContact: string; placeholderPhone: string; placeholderEmail: string; placeholderTelegram: string; placeholderNote: string;
  save: string; saving: string;
  archiveBtn: string; restoreBtn: string;
  errName: string; errSave: string;
  noContact: string;
}> = {
  uk: {
    title: 'Постачальники',
    subtitle: (a, ar) => ar > 0 ? `${a} активних · ${ar} в архіві` : `${a} активних`,
    empty: 'Поки немає постачальників', emptyHint: 'Додайте першого — тапните «+ Додати»',
    add: 'Додати постачальника', back: 'Назад',
    archived: 'В архіві',
    sheetCreate: 'Новий постачальник', sheetEdit: 'Редагувати постачальника',
    fieldName: 'Назва', fieldContact: 'Контактна особа', fieldPhone: 'Телефон', fieldEmail: 'Email',
    fieldTelegram: 'Telegram chat ID', fieldNote: 'Нотатка',
    placeholderName: 'Salon Pro, Beauty Mart…', placeholderContact: 'Олена', placeholderPhone: '+380...',
    placeholderEmail: 'order@example.com', placeholderTelegram: '123456789', placeholderNote: 'Графік, умови, мінімум…',
    save: 'Зберегти', saving: 'Зберігаємо…',
    archiveBtn: 'В архів', restoreBtn: 'Активувати',
    errName: 'Введите назву', errSave: 'Не вдалось зберегти',
    noContact: 'без контактів',
  },
  ru: {
    title: 'Поставщики',
    subtitle: (a, ar) => ar > 0 ? `${a} активных · ${ar} в архиве` : `${a} активных`,
    empty: 'Пока нет поставщиков', emptyHint: 'Добавьте первого — тапните «+ Добавить»',
    add: 'Добавить поставщика', back: 'Назад',
    archived: 'В архиве',
    sheetCreate: 'Новый поставщик', sheetEdit: 'Редактировать поставщика',
    fieldName: 'Название', fieldContact: 'Контактное лицо', fieldPhone: 'Телефон', fieldEmail: 'Email',
    fieldTelegram: 'Telegram chat ID', fieldNote: 'Заметка',
    placeholderName: 'Salon Pro, Beauty Mart…', placeholderContact: 'Елена', placeholderPhone: '+380...',
    placeholderEmail: 'order@example.com', placeholderTelegram: '123456789', placeholderNote: 'График, условия, минимум…',
    save: 'Сохранить', saving: 'Сохраняем…',
    archiveBtn: 'В архив', restoreBtn: 'Активировать',
    errName: 'Введите название', errSave: 'Не удалось сохранить',
    noContact: 'без контактов',
  },
  en: {
    title: 'Suppliers',
    subtitle: (a, ar) => ar > 0 ? `${a} active · ${ar} archived` : `${a} active`,
    empty: 'No suppliers yet', emptyHint: 'Add your first — tap «+ Add»',
    add: 'Add supplier', back: 'Back',
    archived: 'Archived',
    sheetCreate: 'New supplier', sheetEdit: 'Edit supplier',
    fieldName: 'Name', fieldContact: 'Contact person', fieldPhone: 'Phone', fieldEmail: 'Email',
    fieldTelegram: 'Telegram chat ID', fieldNote: 'Note',
    placeholderName: 'Salon Pro, Beauty Mart…', placeholderContact: 'Helen', placeholderPhone: '+380...',
    placeholderEmail: 'order@example.com', placeholderTelegram: '123456789', placeholderNote: 'Schedule, terms, min order…',
    save: 'Save', saving: 'Saving…',
    archiveBtn: 'Archive', restoreBtn: 'Activate',
    errName: 'Enter name', errSave: 'Failed to save',
    noContact: 'no contacts',
  },
};

export default function MasterMiniAppSuppliers() {
  const { userId } = useAuthStore();
  const { haptic } = useTelegram();
  const router = useRouter();
  const lang = useMiniAppLocale();
  const t = I18N[lang];
  const [items, setItems] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);
  const [sheet, setSheet] = useState<{ mode: 'create' | 'edit'; supplier?: Supplier } | null>(null);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    (async () => {
      const initData = getInitData();
      if (!initData) { setLoading(false); return; }
      const res = await fetch('/api/telegram/m/suppliers-list', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ initData }),
      });
      if (cancelled) return;
      if (!res.ok) { setLoading(false); return; }
      const json = await res.json() as { items: Supplier[] };
      if (cancelled) return;
      setItems(json.items ?? []);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [userId, refreshKey]);

  const active = items.filter((s) => s.is_active);
  const archived = items.filter((s) => !s.is_active);

  return (
    <MobilePage className="od-master-suppliers">
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
      <PageHeader title={t.title} subtitle={loading ? undefined : t.subtitle(active.length, archived.length)} />

      <div style={{ padding: `8px ${PAGE_PADDING_X}px 0`, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {loading ? (
          [0, 1, 2].map((i) => (
            <div key={i} style={{ height: 64, borderRadius: R.md, background: T.bgSubtle }} />
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
              <Truck size={20} color={T.textTertiary} />
            </div>
            <p style={{ marginTop: 12, ...TYPE.bodyStrong, color: T.text }}>{t.empty}</p>
            <p style={{ marginTop: 4, ...TYPE.caption, color: T.textTertiary }}>{t.emptyHint}</p>
          </div>
        ) : (
          <>
            {active.map((s, i) => (
              <SupplierRow key={s.id} s={s} i={i} t={t} onTap={() => { haptic('light'); setSheet({ mode: 'edit', supplier: s }); }} />
            ))}

            {archived.length > 0 && (
              <>
                <p style={{ ...TYPE.micro, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: T.textTertiary, margin: '12px 4px 4px' }}>
                  {t.archived}
                </p>
                {archived.map((s, i) => (
                  <SupplierRow key={s.id} s={s} i={i} t={t} onTap={() => { haptic('light'); setSheet({ mode: 'edit', supplier: s }); }} />
                ))}
              </>
            )}
          </>
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
          <SupplierSheet
            mode={sheet.mode}
            supplier={sheet.supplier}
            t={t}
            onClose={() => setSheet(null)}
            onSaved={() => { setSheet(null); setRefreshKey((k) => k + 1); }}
          />
        )}
      </AnimatePresence>
    </MobilePage>
  );
}

function SupplierRow({ s, i, t, onTap }: { s: Supplier; i: number; t: typeof I18N['ru']; onTap: () => void }) {
  const contactBits = [s.contact_person, s.phone, s.email].filter(Boolean) as string[];
  const subtitle = contactBits.length > 0 ? contactBits.join(' · ') : t.noContact;
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
        border: `1px solid ${T.borderSubtle}`,
        background: s.is_active ? T.surface : T.bgSubtle,
        opacity: s.is_active ? 1 : 0.6,
        boxShadow: SHADOW.card,
        cursor: 'pointer',
        textAlign: 'left',
        fontFamily: 'inherit',
        width: '100%',
      }}
    >
      <div style={{
        width: 36, height: 36, borderRadius: R.sm,
        background: T.bgSubtle, color: T.textSecondary,
        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
      }}>
        <Truck size={16} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ margin: 0, ...TYPE.bodyStrong, color: T.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {s.name}
        </p>
        <p style={{ margin: '2px 0 0', ...TYPE.caption, color: T.textTertiary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {subtitle}
        </p>
      </div>
    </motion.button>
  );
}

function SupplierSheet({ mode, supplier, t, onClose, onSaved }: {
  mode: 'create' | 'edit';
  supplier?: Supplier;
  t: typeof I18N['ru'];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(supplier?.name ?? '');
  const [contact, setContact] = useState(supplier?.contact_person ?? '');
  const [phone, setPhone] = useState(supplier?.phone ?? '');
  const [email, setEmail] = useState(supplier?.email ?? '');
  const [tg, setTg] = useState(supplier?.telegram_id ?? '');
  const [note, setNote] = useState(supplier?.note ?? '');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  async function callMutate(payload: Record<string, unknown>) {
    const initData = getInitData();
    const res = await fetch('/api/telegram/m/supplier-mutate', {
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

    setBusy(true);
    try {
      const common = {
        name: n,
        contact_person: contact.trim() || null,
        phone: phone.trim() || null,
        email: email.trim() || null,
        telegram_id: tg.trim() || null,
        note: note.trim() || null,
      };
      if (mode === 'create') {
        await callMutate({ action: 'create', ...common });
      } else if (supplier) {
        await callMutate({ action: 'update', id: supplier.id, ...common });
      }
      onSaved();
    } catch (e) {
      setErr(e instanceof Error ? e.message : t.errSave);
    } finally {
      setBusy(false);
    }
  }

  async function archiveOrRestore() {
    if (!supplier || busy) return;
    setBusy(true);
    setErr(null);
    try {
      await callMutate({
        action: 'update',
        id: supplier.id,
        is_active: !supplier.is_active,
      });
      onSaved();
    } catch (e) {
      setErr(e instanceof Error ? e.message : t.errSave);
    } finally {
      setBusy(false);
    }
  }

  async function deleteSupplier() {
    if (!supplier || busy) return;
    if (!confirmDelete) { setConfirmDelete(true); return; }
    setBusy(true);
    setErr(null);
    try {
      await callMutate({ action: 'delete', id: supplier.id });
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
        {/* Header */}
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

        {/* Поля — плоский iOS-список без дополнительной карточки */}
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
        <FlatRow label={t.fieldContact}>
          <input
            value={contact}
            onChange={(e) => setContact(e.target.value.slice(0, 120))}
            placeholder={t.placeholderContact}
            style={inputStyle}
          />
        </FlatRow>
        <FullDivider />
        <FlatRow label={t.fieldPhone} icon={<Phone size={12} color={T.textTertiary} />}>
          <input
            type="tel"
            inputMode="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value.slice(0, 32))}
            placeholder={t.placeholderPhone}
            style={inputStyle}
          />
        </FlatRow>
        <FullDivider />
        <FlatRow label={t.fieldEmail} icon={<Mail size={12} color={T.textTertiary} />}>
          <input
            type="email"
            inputMode="email"
            value={email}
            onChange={(e) => setEmail(e.target.value.slice(0, 120))}
            placeholder={t.placeholderEmail}
            style={inputStyle}
          />
        </FlatRow>
        <FullDivider />
        <FlatRow label={t.fieldTelegram} icon={<Send size={12} color={T.textTertiary} />}>
          <input
            type="text"
            inputMode="numeric"
            value={tg}
            onChange={(e) => setTg(e.target.value.replace(/\D/g, '').slice(0, 32))}
            placeholder={t.placeholderTelegram}
            style={inputStyle}
          />
        </FlatRow>
        <FullDivider />
        <FlatRow label={t.fieldNote}>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value.slice(0, 500))}
            placeholder={t.placeholderNote}
            rows={2}
            style={{ ...inputStyle, resize: 'none' }}
          />
        </FlatRow>
        <FullDivider />

        <p style={{
          ...TYPE.micro, color: T.textTertiary,
          padding: `12px ${PAGE_PADDING_X}px 4px`,
          margin: 0, lineHeight: 1.5,
        }}>
          Telegram chat ID — числовой ID для отправки заказов через бота. Узнать — переслать своё сообщение @userinfobot.
        </p>

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

          {mode === 'edit' && supplier && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 4 }}>
              <button
                type="button"
                onClick={archiveOrRestore}
                disabled={busy}
                style={secondaryBtn(false)}
              >
                {supplier.is_active ? <Archive size={14} /> : <RotateCcw size={14} />}
                {supplier.is_active ? t.archiveBtn : t.restoreBtn}
              </button>
              <button
                type="button"
                onClick={deleteSupplier}
                disabled={busy}
                style={secondaryBtn(true)}
              >
                <Trash2 size={14} />
                {confirmDelete ? 'Удалить?' : 'Удалить'}
              </button>
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}

function FlatRow({ label, icon, children }: { label: string; icon?: React.ReactNode; children: React.ReactNode }) {
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
          display: 'flex', alignItems: 'center', gap: 6,
        }}
      >
        {icon}
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
