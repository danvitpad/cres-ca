/** --- YAML
 * name: MasterMiniAppMarketing/PromoCodes
 * description: Промокоды мастера — список + bottom-sheet «Создать».
 *              MVP-форма: код (auto-generated), тип скидки (% / ₴), значение,
 *              срок действия, лимит использований. Insert через Supabase
 *              client (RLS пускает мастера на свои). Без service-picker и
 *              simulator'а — полный редактор остаётся в веб-кабинете.
 * created: 2026-05-09
 * updated: 2026-05-13
 * --- */

'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Ticket, Loader2, Plus, X, Check, Copy, Percent, Coins } from 'lucide-react';
import { toast } from 'sonner';
import { useAuthStore } from '@/stores/auth-store';
import { useTelegram } from '@/components/miniapp/telegram-provider';
import { createClient } from '@/lib/supabase/client';
import { MobilePage, PageHeader } from '@/components/miniapp/shells';
import { T, R, TYPE, PAGE_PADDING_X, SPRING, SHADOW } from '@/components/miniapp/design';
import { useMiniAppLocale, type MiniAppLang } from '@/lib/miniapp/use-locale';

interface Promo {
  id: string;
  code: string;
  discount_percent: number | null;
  discount_amount: number | null;
  discount_type: 'percentage' | 'fixed' | null;
  discount_value: number | null;
  is_active: boolean | null;
  max_uses: number | null;
  uses_count: number | null;
  expires_at: string | null;
}

const I18N: Record<MiniAppLang, {
  title: string; subtitle: string; empty: string; emptyHint: string;
  uses: string; expires: string;
  add: string; sheetTitle: string;
  fieldCode: string; codePh: string; generate: string;
  fieldType: string; typePercent: string; typeFixed: string;
  fieldValue: string; valuePctPh: string; valueFixedPh: string;
  fieldExpires: string; fieldExpiresHint: string;
  fieldMaxUses: string; fieldMaxUsesHint: string;
  save: string; saving: string;
  errCode: string; errValue: string; errSave: string;
  copied: string;
  noLimit: string;
}> = {
  uk: {
    title: 'Промокоди', subtitle: 'Унікальні знижки для клієнтів',
    empty: 'Поки що жодного коду', emptyHint: 'Створіть перший — тапніть «+ Створити»',
    uses: 'використано', expires: 'до',
    add: 'Створити',
    sheetTitle: 'Новий промокод',
    fieldCode: 'Код', codePh: 'SALE20', generate: 'Згенерувати',
    fieldType: 'Тип знижки', typePercent: 'Відсоток (%)', typeFixed: 'Фіксована (₴)',
    fieldValue: 'Значення', valuePctPh: '20', valueFixedPh: '100',
    fieldExpires: 'Діє до', fieldExpiresHint: 'Залиште пустим — діє без обмежень',
    fieldMaxUses: 'Ліміт використань', fieldMaxUsesHint: 'Скільки разів код можна застосувати. Пусто = без ліміту',
    save: 'Створити', saving: 'Створюємо…',
    errCode: 'Введіть код (мін. 3 символи)', errValue: 'Введіть значення знижки',
    errSave: 'Не вдалось зберегти',
    copied: 'Код скопійовано',
    noLimit: 'без ліміту',
  },
  ru: {
    title: 'Промокоды', subtitle: 'Уникальные скидки для клиентов',
    empty: 'Пока ни одного кода', emptyHint: 'Создай первый — тапни «+ Создать»',
    uses: 'использовано', expires: 'до',
    add: 'Создать',
    sheetTitle: 'Новый промокод',
    fieldCode: 'Код', codePh: 'SALE20', generate: 'Сгенерировать',
    fieldType: 'Тип скидки', typePercent: 'Процент (%)', typeFixed: 'Фиксированная (₴)',
    fieldValue: 'Значение', valuePctPh: '20', valueFixedPh: '100',
    fieldExpires: 'Действует до', fieldExpiresHint: 'Оставьте пустым — без срока',
    fieldMaxUses: 'Лимит использований', fieldMaxUsesHint: 'Сколько раз код можно применить. Пусто = без лимита',
    save: 'Создать', saving: 'Создаём…',
    errCode: 'Введите код (мин. 3 символа)', errValue: 'Введите значение скидки',
    errSave: 'Не удалось сохранить',
    copied: 'Код скопирован',
    noLimit: 'без лимита',
  },
  en: {
    title: 'Promo codes', subtitle: 'Unique discounts for clients',
    empty: 'No codes yet', emptyHint: 'Create one — tap «+ Create»',
    uses: 'used', expires: 'until',
    add: 'Create',
    sheetTitle: 'New promo code',
    fieldCode: 'Code', codePh: 'SALE20', generate: 'Generate',
    fieldType: 'Discount type', typePercent: 'Percentage (%)', typeFixed: 'Fixed (₴)',
    fieldValue: 'Value', valuePctPh: '20', valueFixedPh: '100',
    fieldExpires: 'Valid until', fieldExpiresHint: 'Leave empty for no expiry',
    fieldMaxUses: 'Max uses', fieldMaxUsesHint: 'How many times this code can be used. Empty = unlimited',
    save: 'Create', saving: 'Creating…',
    errCode: 'Enter a code (min 3 chars)', errValue: 'Enter discount value',
    errSave: 'Could not save',
    copied: 'Code copied',
    noLimit: 'no limit',
  },
};

function generateCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let r = '';
  for (let i = 0; i < 8; i++) r += chars[Math.floor(Math.random() * chars.length)];
  return r;
}

export default function PromoPage() {
  const userId = useAuthStore((s) => s.userId);
  const { haptic } = useTelegram();
  const lang = useMiniAppLocale();
  const t = I18N[lang];
  const [items, setItems] = useState<Promo[]>([]);
  const [loading, setLoading] = useState(true);
  const [masterId, setMasterId] = useState<string | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    (async () => {
      const supabase = createClient();
      const { data: master } = await supabase.from('masters').select('id').eq('profile_id', userId).maybeSingle();
      if (cancelled) return;
      if (!master) { setLoading(false); return; }
      setMasterId(master.id);
      const { data } = await supabase
        .from('promo_codes')
        .select('id, code, discount_percent, discount_amount, discount_type, discount_value, is_active, max_uses, uses_count, expires_at')
        .eq('master_id', master.id)
        .order('is_active', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(50);
      if (cancelled) return;
      setItems((data as Promo[] | null) ?? []);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [userId, refreshKey]);

  function fmtDiscount(p: Promo): string {
    if (p.discount_type === 'fixed') return `−${Number(p.discount_value ?? p.discount_amount ?? 0).toFixed(0)}₴`;
    const pct = p.discount_value ?? p.discount_percent ?? 0;
    return `−${Number(pct).toFixed(0)}%`;
  }

  async function copyCode(code: string) {
    haptic('selection');
    try {
      await navigator.clipboard.writeText(code);
      toast.success(t.copied);
    } catch { /* ignore */ }
  }

  return (
    <MobilePage>
      <PageHeader title={t.title} subtitle={t.subtitle} />
      <div style={{ padding: `8px ${PAGE_PADDING_X}px 96px`, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {loading ? (
          <Loader2 className="mx-auto my-8 size-5 animate-spin" color={T.textTertiary} />
        ) : items.length === 0 ? (
          <div style={{ padding: 28, borderRadius: R.md, border: `1px dashed ${T.border}`, textAlign: 'center', background: T.surface }}>
            <Ticket size={22} color={T.textTertiary} style={{ margin: '0 auto 10px' }} />
            <p style={{ fontSize: 14, fontWeight: 600, color: T.text, margin: 0 }}>{t.empty}</p>
            <p style={{ fontSize: 12, color: T.textTertiary, margin: '4px 0 0' }}>{t.emptyHint}</p>
          </div>
        ) : (
          items.map((p) => {
            const usesLine = `${p.uses_count ?? 0}${p.max_uses ? ` / ${p.max_uses}` : ''} ${t.uses}`;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => copyCode(p.code)}
                style={{
                  padding: 14, borderRadius: R.md,
                  border: `1px solid ${T.borderSubtle}`,
                  background: T.surface,
                  opacity: p.is_active ? 1 : 0.5,
                  textAlign: 'left',
                  cursor: 'pointer',
                  width: '100%',
                  fontFamily: 'inherit',
                  display: 'block',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <p style={{ fontSize: 16, fontWeight: 800, color: T.text, margin: 0, fontFamily: 'monospace', letterSpacing: 0.5 }}>{p.code}</p>
                    <Copy size={12} color={T.textTertiary} />
                  </div>
                  <span style={{ fontSize: 14, fontWeight: 700, color: T.accent }}>{fmtDiscount(p)}</span>
                </div>
                <p style={{ fontSize: 11, color: T.textTertiary, margin: '4px 0 0' }}>
                  {usesLine}
                  {p.expires_at ? ` · ${t.expires} ${new Date(p.expires_at).toLocaleDateString(lang === 'uk' ? 'uk-UA' : lang === 'en' ? 'en-GB' : 'ru-RU')}` : ''}
                </p>
              </button>
            );
          })
        )}
      </div>

      {/* FAB — поднят над bottom-nav. Поднимается выше safe-area. */}
      {masterId && (
        <button
          type="button"
          onClick={() => { haptic('selection'); setSheetOpen(true); }}
          aria-label={t.add}
          style={{
            position: 'fixed',
            right: 20,
            bottom: 'calc(88px + env(safe-area-inset-bottom, 0px))',
            width: 52, height: 52, borderRadius: '50%',
            background: T.accent, color: '#fff',
            border: 'none', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 4px 16px rgba(37, 99, 235, 0.4)',
            zIndex: 20,
            WebkitTapHighlightColor: 'transparent',
          }}
        >
          <Plus size={22} strokeWidth={2.4} />
        </button>
      )}

      <AnimatePresence>
        {sheetOpen && masterId && (
          <PromoCreateSheet
            masterId={masterId}
            t={t}
            onClose={() => setSheetOpen(false)}
            onSaved={() => { setSheetOpen(false); setRefreshKey((k) => k + 1); }}
          />
        )}
      </AnimatePresence>
    </MobilePage>
  );
}

function PromoCreateSheet({ masterId, t, onClose, onSaved }: {
  masterId: string;
  t: typeof I18N['ru'];
  onClose: () => void;
  onSaved: () => void;
}) {
  const { haptic } = useTelegram();
  const [code, setCode] = useState(() => generateCode());
  const [type, setType] = useState<'percentage' | 'fixed'>('percentage');
  const [value, setValue] = useState('20');
  const [expires, setExpires] = useState(''); // YYYY-MM-DD
  const [maxUses, setMaxUses] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function save() {
    if (busy) return;
    setErr(null);
    const c = code.trim().toUpperCase();
    if (c.length < 3) { setErr(t.errCode); return; }
    const v = Number(value.replace(',', '.'));
    if (!Number.isFinite(v) || v <= 0) { setErr(t.errValue); return; }
    setBusy(true);
    try {
      const supabase = createClient();
      const expiresIso = expires ? `${expires}T23:59:59Z` : null;
      const maxN = maxUses.trim() ? Math.max(1, parseInt(maxUses, 10) || 0) : null;
      const { error } = await supabase.from('promo_codes').insert({
        master_id: masterId,
        code: c,
        discount_type: type,
        discount_value: v,
        // Для обратной совместимости со старыми читателями оставляем
        // legacy discount_percent (если % — копируем значение, если ₴ — 0).
        discount_percent: type === 'percentage' ? v : 0,
        is_active: true,
        max_uses: maxN,
        expires_at: expiresIso,
      });
      if (error) throw error;
      haptic('success');
      onSaved();
    } catch (e) {
      haptic('error');
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
        position: 'fixed', inset: 0, zIndex: 60,
        display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
        background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)',
      }}
    >
      <motion.div
        initial={{ y: 60, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 60, opacity: 0 }}
        transition={SPRING.default}
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: 480,
          borderRadius: `${R.lg}px ${R.lg}px 0 0`,
          background: T.surface,
          padding: `20px ${PAGE_PADDING_X}px`,
          paddingBottom: 'calc(24px + env(safe-area-inset-bottom, 0px))',
          boxShadow: SHADOW.elevated,
          maxHeight: 'calc(var(--tg-viewport-height, 100dvh) - max(var(--tg-content-top, 0px), 12px) - 24px)',
          overflowY: 'auto',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <h3 style={{ ...TYPE.h3, color: T.text, margin: 0 }}>{t.sheetTitle}</h3>
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
          {/* Код */}
          <div style={fieldBoxStyle}>
            <Label>{t.fieldCode}</Label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 24))}
                placeholder={t.codePh}
                style={{ ...inputStyle, fontFamily: 'monospace', letterSpacing: 1, fontSize: 18, fontWeight: 700 }}
              />
              <button
                type="button"
                onClick={() => setCode(generateCode())}
                style={{
                  padding: '6px 10px', borderRadius: R.sm,
                  border: `1px solid ${T.border}`, background: T.bg,
                  color: T.text, fontSize: 11, fontWeight: 600, cursor: 'pointer',
                  fontFamily: 'inherit',
                }}
              >
                {t.generate}
              </button>
            </div>
          </div>

          {/* Тип */}
          <div style={fieldBoxStyle}>
            <Label>{t.fieldType}</Label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <TypeChip
                Icon={Percent}
                label={t.typePercent}
                on={type === 'percentage'}
                onClick={() => setType('percentage')}
              />
              <TypeChip
                Icon={Coins}
                label={t.typeFixed}
                on={type === 'fixed'}
                onClick={() => setType('fixed')}
              />
            </div>
          </div>

          {/* Значение */}
          <div style={fieldBoxStyle}>
            <Label>{t.fieldValue}</Label>
            <input
              type="text"
              inputMode="decimal"
              value={value}
              onChange={(e) => setValue(e.target.value.replace(/[^\d.,]/g, '').slice(0, 8))}
              placeholder={type === 'percentage' ? t.valuePctPh : t.valueFixedPh}
              style={{ ...inputStyle, fontSize: 22, fontWeight: 700 }}
            />
          </div>

          {/* Срок */}
          <div style={fieldBoxStyle}>
            <Label>{t.fieldExpires}</Label>
            <input
              type="date"
              value={expires}
              onChange={(e) => setExpires(e.target.value)}
              style={inputStyle}
            />
            <p style={{ ...TYPE.micro, color: T.textTertiary, margin: '6px 0 0' }}>
              {t.fieldExpiresHint}
            </p>
          </div>

          {/* Лимит */}
          <div style={fieldBoxStyle}>
            <Label>{t.fieldMaxUses}</Label>
            <input
              type="text"
              inputMode="numeric"
              value={maxUses}
              onChange={(e) => setMaxUses(e.target.value.replace(/\D/g, '').slice(0, 5))}
              placeholder={t.noLimit}
              style={inputStyle}
            />
            <p style={{ ...TYPE.micro, color: T.textTertiary, margin: '6px 0 0' }}>
              {t.fieldMaxUsesHint}
            </p>
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
        </div>
      </motion.div>
    </motion.div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <p style={{
      fontSize: 10, fontWeight: 700, textTransform: 'uppercase',
      letterSpacing: '0.1em', color: T.textTertiary, margin: 0, marginBottom: 8,
    }}>
      {children}
    </p>
  );
}

function TypeChip({ Icon, label, on, onClick }: {
  Icon: typeof Percent; label: string; on: boolean; onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
        padding: '10px 8px', borderRadius: R.md,
        border: `1.5px solid ${on ? T.accent : T.border}`,
        background: on ? T.accentSoft : T.surface,
        color: on ? T.accent : T.textSecondary,
        fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
      }}
    >
      <Icon size={14} />
      {label}
    </button>
  );
}

const fieldBoxStyle: React.CSSProperties = {
  borderRadius: R.md,
  border: `1px solid ${T.borderSubtle}`,
  background: T.bg,
  padding: '12px 14px 14px',
};

const inputStyle: React.CSSProperties = {
  width: '100%',
  background: 'transparent', border: 'none', outline: 'none',
  fontSize: 16,
  fontWeight: 500,
  lineHeight: 1.3,
  color: T.text,
  caretColor: T.accent,
  fontFamily: 'inherit',
  padding: 0,
};
