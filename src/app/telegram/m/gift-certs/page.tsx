/** --- YAML
 * name: MasterGiftCertsPage
 * description: >
 *   Master Mini App page to manage gift certificates — list existing,
 *   create new (amount + optional expiry). Auth via X-TG-Init-Data.
 * created: 2026-05-09
 * --- */

'use client';

import { useCallback, useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Gift, Plus, Loader2, X, Check } from 'lucide-react';
import { MobilePage, PageHeader } from '@/components/miniapp/shells';
import { useTelegram } from '@/components/miniapp/telegram-provider';
import { T, R, TYPE, SHADOW, PAGE_PADDING_X } from '@/components/miniapp/design';
import { useMiniAppLocale, type MiniAppLang } from '@/lib/miniapp/use-locale';
import { formatMoney } from '@/lib/format/money';

interface GiftCert {
  id: string;
  code: string;
  amount: number;
  balance_remaining: number | null;
  currency: string;
  is_redeemed: boolean;
  expires_at: string | null;
  created_at: string;
}

const I18N: Record<MiniAppLang, {
  title: string;
  empty: string;
  emptyHint: string;
  create: string;
  createTitle: string;
  amount: string;
  amountPlaceholder: string;
  expiresAt: string;
  save: string;
  saving: string;
  balance: string;
  redeemed: string;
  active: string;
  expires: string;
  invalidAmount: string;
  created: string;
}> = {
  uk: {
    title: 'Подарункові сертифікати',
    empty: 'Ще немає сертифікатів',
    emptyHint: 'Створіть перший подарунковий сертифікат',
    create: 'Новий сертифікат',
    createTitle: 'Новий сертифікат',
    amount: 'Сума',
    amountPlaceholder: 'Наприклад: 500',
    expiresAt: 'Дійсний до (необовʼязково)',
    save: 'Створити',
    saving: 'Створення...',
    balance: 'Залишок:',
    redeemed: 'Використано',
    active: 'Активний',
    expires: 'До:',
    invalidAmount: 'Введіть коректну суму',
    created: 'Сертифікат створено!',
  },
  ru: {
    title: 'Подарочные сертификаты',
    empty: 'Сертификатов пока нет',
    emptyHint: 'Создайте первый подарочный сертификат',
    create: 'Новый сертификат',
    createTitle: 'Новый сертификат',
    amount: 'Сумма',
    amountPlaceholder: 'Например: 500',
    expiresAt: 'Действует до (необязательно)',
    save: 'Создать',
    saving: 'Создание...',
    balance: 'Остаток:',
    redeemed: 'Использован',
    active: 'Активен',
    expires: 'До:',
    invalidAmount: 'Введите корректную сумму',
    created: 'Сертификат создан!',
  },
  en: {
    title: 'Gift certificates',
    empty: 'No certificates yet',
    emptyHint: 'Create your first gift certificate',
    create: 'New certificate',
    createTitle: 'New certificate',
    amount: 'Amount',
    amountPlaceholder: 'E.g. 500',
    expiresAt: 'Expires (optional)',
    save: 'Create',
    saving: 'Creating...',
    balance: 'Balance:',
    redeemed: 'Redeemed',
    active: 'Active',
    expires: 'Expires:',
    invalidAmount: 'Enter a valid amount',
    created: 'Certificate created!',
  },
};

function getInitData(): string | null {
  if (typeof window === 'undefined') return null;
  const w = window as { Telegram?: { WebApp?: { initData?: string } } };
  const live = w.Telegram?.WebApp?.initData;
  if (live) return live;
  try {
    const stash = sessionStorage.getItem('cres:tg');
    if (stash) {
      const parsed = JSON.parse(stash) as { initData?: string };
      if (parsed.initData) return parsed.initData;
    }
  } catch {}
  return null;
}

function formatDate(iso: string, lang: MiniAppLang): string {
  return new Date(iso).toLocaleDateString(
    lang === 'uk' ? 'uk-UA' : lang === 'ru' ? 'ru-RU' : 'en-US',
    { day: 'numeric', month: 'short', year: 'numeric' },
  );
}

export default function MasterGiftCertsPage() {
  const { haptic } = useTelegram();
  const lang = useMiniAppLocale();
  const t = I18N[lang];

  const [certs, setCerts] = useState<GiftCert[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [amount, setAmount] = useState('');
  const [expiresAt, setExpiresAt] = useState('');
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const loadCerts = useCallback(async () => {
    const initData = getInitData();
    const headers: Record<string, string> = {};
    if (initData) headers['X-TG-Init-Data'] = initData;
    const res = await fetch('/api/telegram/m/gift-certs', { headers }).catch(() => null);
    if (!res?.ok) { setLoading(false); return; }
    const json = await res.json() as { certs: GiftCert[] };
    setCerts(json.certs ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { loadCerts(); }, [loadCerts]);

  async function handleCreate() {
    const num = parseFloat(amount.replace(',', '.'));
    if (!amount || isNaN(num) || num <= 0) {
      haptic('error');
      setFormError(t.invalidAmount);
      return;
    }
    haptic('medium');
    setSaving(true);
    setFormError('');
    const initData = getInitData();
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (initData) headers['X-TG-Init-Data'] = initData;
    const body: { amount: number; expires_at?: string } = { amount: num };
    if (expiresAt) body.expires_at = expiresAt;
    const res = await fetch('/api/telegram/m/gift-certs', {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    }).catch(() => null);
    setSaving(false);
    if (!res?.ok) {
      haptic('error');
      setFormError('Error');
      return;
    }
    haptic('success');
    setShowForm(false);
    setAmount('');
    setExpiresAt('');
    setSuccessMsg(t.created);
    setTimeout(() => setSuccessMsg(''), 2500);
    await loadCerts();
  }

  return (
    <MobilePage>
      <PageHeader title={t.title} />

      <div style={{ padding: `16px ${PAGE_PADDING_X}px`, paddingBottom: 120 }}>
        {/* Success toast */}
        <AnimatePresence>
          {successMsg && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.25 }}
              style={{
                marginBottom: 12,
                borderRadius: R.md,
                background: T.successSoft,
                color: T.success,
                padding: '10px 14px',
                ...TYPE.body,
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                gap: 8,
              }}
            >
              <Check size={15} />
              {successMsg}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Create button */}
        <button
          onClick={() => { haptic('light'); setShowForm(true); setFormError(''); }}
          style={{
            width: '100%',
            marginBottom: 16,
            borderRadius: R.md,
            padding: '13px 16px',
            background: T.accent,
            color: '#fff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            border: 'none',
            ...TYPE.body,
            fontWeight: 600,
            cursor: 'pointer',
            boxShadow: SHADOW.card,
          }}
        >
          <Plus size={16} />
          {t.create}
        </button>

        {/* Create form */}
        <AnimatePresence>
          {showForm && (
            <motion.div
              initial={{ opacity: 0, y: -8, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8, scale: 0.98 }}
              transition={{ duration: 0.25 }}
              style={{
                marginBottom: 16,
                borderRadius: R.lg,
                background: T.surface,
                border: `1px solid ${T.border}`,
                padding: 16,
                boxShadow: SHADOW.card,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                <span style={{ ...TYPE.bodyStrong, color: T.text }}>{t.createTitle}</span>
                <button
                  onClick={() => { haptic('light'); setShowForm(false); setFormError(''); }}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: T.textSecondary }}
                >
                  <X size={16} />
                </button>
              </div>

              {/* Amount */}
              <label style={{ display: 'block', marginBottom: 10 }}>
                <span style={{ ...TYPE.micro, display: 'block', marginBottom: 4 }}>
                  {t.amount}
                </span>
                <input
                  type="number"
                  inputMode="decimal"
                  min="1"
                  value={amount}
                  onChange={(e) => { setAmount(e.target.value); setFormError(''); }}
                  placeholder={t.amountPlaceholder}
                  style={{
                    width: '100%',
                    borderRadius: R.sm,
                    border: `1px solid ${formError ? T.danger : T.borderSubtle}`,
                    background: T.bg,
                    color: T.text,
                    padding: '10px 12px',
                    fontSize: 15,
                    outline: 'none',
                    boxSizing: 'border-box',
                  }}
                />
                {formError && (
                  <span style={{ ...TYPE.micro, color: T.danger, display: 'block', marginTop: 4 }}>
                    {formError}
                  </span>
                )}
              </label>

              {/* Expires at */}
              <label style={{ display: 'block', marginBottom: 14 }}>
                <span style={{ ...TYPE.micro, display: 'block', marginBottom: 4 }}>
                  {t.expiresAt}
                </span>
                <input
                  type="date"
                  value={expiresAt}
                  min={new Date().toISOString().slice(0, 10)}
                  onChange={(e) => setExpiresAt(e.target.value)}
                  style={{
                    width: '100%',
                    borderRadius: R.sm,
                    border: `1px solid ${T.borderSubtle}`,
                    background: T.bg,
                    color: expiresAt ? T.text : T.textSecondary,
                    padding: '10px 12px',
                    fontSize: 15,
                    outline: 'none',
                    boxSizing: 'border-box',
                  }}
                />
              </label>

              <button
                onClick={handleCreate}
                disabled={saving}
                style={{
                  width: '100%',
                  borderRadius: R.md,
                  padding: '12px 16px',
                  background: T.text,
                  color: T.bg,
                  border: 'none',
                  ...TYPE.body,
                  fontWeight: 600,
                  cursor: saving ? 'default' : 'pointer',
                  opacity: saving ? 0.6 : 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                }}
              >
                {saving && <Loader2 size={15} className="animate-spin" />}
                {saving ? t.saving : t.save}
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* List */}
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 48 }}>
            <Loader2 size={24} className="animate-spin" style={{ color: T.textDisabled }} />
          </div>
        ) : certs.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            style={{
              textAlign: 'center',
              padding: '48px 16px',
              borderRadius: R.lg,
              border: `1px dashed ${T.borderSubtle}`,
            }}
          >
            <Gift size={32} style={{ color: T.textDisabled, margin: '0 auto 12px' }} />
            <p style={{ ...TYPE.bodyStrong, color: T.text, marginBottom: 6 }}>{t.empty}</p>
            <p style={{ ...TYPE.caption, color: T.textSecondary }}>{t.emptyHint}</p>
          </motion.div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {certs.map((cert, i) => {
              const balance = cert.balance_remaining ?? cert.amount;
              const isRedeemed = cert.is_redeemed || balance <= 0;
              return (
                <motion.div
                  key={cert.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.04 }}
                  style={{
                    borderRadius: R.lg,
                    background: T.surface,
                    border: `1px solid ${isRedeemed ? T.borderSubtle : T.border}`,
                    padding: '14px 16px',
                    opacity: isRedeemed ? 0.65 : 1,
                    boxShadow: SHADOW.card,
                  }}
                >
                  {/* Top row: code + status */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Gift size={15} style={{ color: T.accent, flexShrink: 0 }} />
                      <span
                        style={{
                          fontFamily: 'monospace',
                          fontSize: 14,
                          fontWeight: 700,
                          color: T.text,
                          letterSpacing: '0.08em',
                        }}
                      >
                        {cert.code}
                      </span>
                    </div>
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 700,
                        letterSpacing: '0.04em',
                        textTransform: 'uppercase',
                        padding: '2px 8px',
                        borderRadius: R.pill,
                        background: isRedeemed ? T.bgSubtle : T.accentSoft,
                        color: isRedeemed ? T.textSecondary : T.accent,
                      }}
                    >
                      {isRedeemed ? t.redeemed : t.active}
                    </span>
                  </div>

                  {/* Bottom row: balance + expiry */}
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
                    <span style={{ ...TYPE.caption }}>
                      {t.balance}{' '}
                      <span style={{ fontWeight: 700, color: T.text }}>
                        {formatMoney(balance, cert.currency)}
                      </span>
                    </span>
                    {cert.expires_at && (
                      <span style={{ ...TYPE.micro }}>
                        {t.expires} {formatDate(cert.expires_at, lang)}
                      </span>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
    </MobilePage>
  );
}
