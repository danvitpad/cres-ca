/** --- YAML
 * name: PaymentsPage
 * description: Fresha-exact payment transactions — search, date range filter, transaction list
 * --- */

'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { useTheme } from 'next-themes';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, SlidersHorizontal, CreditCard } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useMaster } from '@/hooks/use-master';
import { format, subMonths, type Locale } from 'date-fns';
import { ru } from 'date-fns/locale/ru';
import { uk } from 'date-fns/locale/uk';
import { enUS } from 'date-fns/locale/en-US';

const FONT = '"Roobert PRO", AktivGroteskVF, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
const dateFnsLocales: Record<string, Locale> = { ru, uk, en: enUS };

const LIGHT = {
  bg: '#ffffff', cardBg: '#ffffff', cardBorder: '#e5e5e5',
  text: '#0d0d0d', textMuted: '#737373',
  accent: '#6950f3', accentSoft: '#f0f0ff',
  tableBg: '#000000', tableText: '#f0f0f0', tableTextMuted: '#b3b3b3',
  tableBorder: '#2a2a2a', rowHover: '#111111',
  inputBg: '#ffffff', inputBorder: '#e0e0e0',
  emptyBg: '#000000',
};

const DARK = {
  bg: '#000000', cardBg: '#000000', cardBorder: '#1a1a1a',
  text: '#f0f0f0', textMuted: '#b3b3b3',
  accent: '#8b7cf6', accentSoft: 'rgba(105,80,243,0.15)',
  tableBg: '#000000', tableText: '#f0f0f0', tableTextMuted: '#b3b3b3',
  tableBorder: '#1a1a1a', rowHover: '#0a0a0a',
  inputBg: '#000000', inputBorder: '#1a1a1a',
  emptyBg: '#000000',
};

interface PaymentRow {
  id: string;
  amount: number;
  currency: string;
  type: string;
  status: string;
  created_at: string;
  services: { name: string } | null;
}

export default function PaymentsPage() {
  const t = useTranslations('sales');
  const locale = useLocale();
  const dfLocale = dateFnsLocales[locale] || ru;
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const C = mounted && resolvedTheme === 'dark' ? DARK : LIGHT;

  const { master } = useMaster();
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const dateRange = useMemo(() => {
    const now = new Date();
    const from = subMonths(now, 1);
    return `${format(from, 'MMM d, yyyy', { locale: dfLocale })} — ${format(now, 'MMM d, yyyy', { locale: dfLocale })}`;
  }, [dfLocale]);

  const loadPayments = useCallback(async () => {
    if (!master?.id) return;
    setLoading(true);
    const supabase = createClient();
    const monthAgo = subMonths(new Date(), 1).toISOString();

    const { data } = await supabase
      .from('payments')
      .select('id, amount, currency, type, status, created_at, services(name)')
      .gte('created_at', monthAgo)
      .order('created_at', { ascending: false });

    setPayments((data as unknown as PaymentRow[]) || []);
    setLoading(false);
  }, [master?.id]);

  useEffect(() => { loadPayments(); }, [loadPayments]);

  const filtered = useMemo(() => {
    if (!search.trim()) return payments;
    const q = search.toLowerCase();
    return payments.filter(p =>
      p.id.toLowerCase().includes(q) ||
      (p.services?.name || '').toLowerCase().includes(q)
    );
  }, [payments, search]);

  return (
    <div style={{ fontFamily: FONT, color: C.text, height: '100%', overflowY: 'auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0 }}>{t('paymentsTitle')}</h1>
          <p style={{ fontSize: 14, color: C.textMuted, marginTop: 4 }}>{t('paymentsDesc')}</p>
        </div>
        <button
          style={{
            padding: '8px 16px', borderRadius: 8, border: `1px solid ${C.cardBorder}`,
            background: C.cardBg, color: C.text, fontSize: 13, fontWeight: 500, cursor: 'pointer',
          }}
        >
          {t('options')}
        </button>
      </div>

      {/* Search + filters */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24, marginTop: 16, flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: '1 1 240px', maxWidth: 320 }}>
          <Search size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: C.textMuted }} />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder={t('search')}
            style={{
              width: '100%', padding: '9px 12px 9px 36px', borderRadius: 8,
              border: `1px solid ${C.inputBorder}`, background: C.inputBg, color: C.text,
              fontSize: 13, outline: 'none', fontFamily: FONT,
            }}
          />
        </div>
        <button
          style={{
            padding: '9px 14px', borderRadius: 8, border: `1px solid ${C.inputBorder}`,
            background: C.inputBg, color: C.textMuted, fontSize: 13, cursor: 'pointer', fontFamily: FONT,
          }}
        >
          {dateRange}
        </button>
        <button
          style={{
            padding: '9px 14px', borderRadius: 8, border: `1px solid ${C.inputBorder}`,
            background: C.inputBg, color: C.textMuted, fontSize: 13, cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: 6, fontFamily: FONT,
          }}
        >
          <SlidersHorizontal size={14} />
          {t('filters')}
        </button>
      </div>

      {/* Content */}
      {loading ? (
        <div style={{ background: C.emptyBg, borderRadius: 12, padding: '40px 20px' }}>
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} style={{ height: 48, borderRadius: 8, background: C.rowHover, marginBottom: 8 }} />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          style={{
            background: C.emptyBg, borderRadius: 16, padding: '80px 40px',
            display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center',
          }}
        >
          <div style={{
            width: 72, height: 72, borderRadius: 16,
            background: C.accentSoft, display: 'flex', alignItems: 'center', justifyContent: 'center',
            marginBottom: 20,
          }}>
            <CreditCard size={32} style={{ color: C.accent }} />
          </div>
          <p style={{ fontSize: 16, fontWeight: 600, color: C.tableText, marginBottom: 8 }}>{t('nothingFound')}</p>
          <p style={{ fontSize: 13, color: C.tableTextMuted }}>{t('nothingFoundDesc')}</p>
        </motion.div>
      ) : (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          style={{ background: C.tableBg, borderRadius: 12, overflow: 'hidden' }}
        >
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: `1px solid ${C.tableBorder}` }}>
                <th style={{ padding: '12px 20px', textAlign: 'left', fontSize: 12, fontWeight: 500, color: C.tableTextMuted }}>ID</th>
                <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: 12, fontWeight: 500, color: C.tableTextMuted }}>{t('service')}</th>
                <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: 12, fontWeight: 500, color: C.tableTextMuted }}>{t('paymentType')}</th>
                <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: 12, fontWeight: 500, color: C.tableTextMuted }}>{t('created')}</th>
                <th style={{ padding: '12px 16px', textAlign: 'right', fontSize: 12, fontWeight: 500, color: C.tableTextMuted }}>{t('totalAmount')}</th>
                <th style={{ padding: '12px 20px', textAlign: 'right', fontSize: 12, fontWeight: 500, color: C.tableTextMuted }}>{t('status')}</th>
              </tr>
            </thead>
            <tbody>
              <AnimatePresence>
                {filtered.map((payment, i) => (
                  <motion.tr
                    key={payment.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: i * 0.02 }}
                    style={{ borderBottom: `1px solid ${C.tableBorder}`, cursor: 'pointer' }}
                    onMouseEnter={e => (e.currentTarget.style.background = C.rowHover)}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                  >
                    <td style={{ padding: '12px 20px', fontSize: 13, color: C.accent, fontWeight: 500 }}>
                      #{payment.id.slice(0, 7).toUpperCase()}
                    </td>
                    <td style={{ padding: '12px 16px', fontSize: 13, color: C.tableText }}>{payment.services?.name || '—'}</td>
                    <td style={{ padding: '12px 16px', fontSize: 13, color: C.tableTextMuted }}>{payment.type}</td>
                    <td style={{ padding: '12px 16px', fontSize: 13, color: C.tableTextMuted }}>
                      {format(new Date(payment.created_at), 'd MMM yyyy, HH:mm', { locale: dfLocale })}
                    </td>
                    <td style={{ padding: '12px 16px', textAlign: 'right', fontSize: 13, fontWeight: 600, color: C.tableText }}>
                      {Number(payment.amount).toLocaleString()} {payment.currency}
                    </td>
                    <td style={{ padding: '12px 20px', textAlign: 'right' }}>
                      <span style={{
                        display: 'inline-block', padding: '4px 10px', borderRadius: 6,
                        fontSize: 12, fontWeight: 500,
                        background: payment.status === 'completed' ? 'rgba(16,185,129,0.12)' : 'rgba(245,158,11,0.12)',
                        color: payment.status === 'completed'
                          ? (mounted && resolvedTheme === 'dark' ? '#34d399' : '#059669')
                          : (mounted && resolvedTheme === 'dark' ? '#fbbf24' : '#d97706'),
                      }}>
                        {payment.status === 'completed' ? t('completed') : payment.status}
                      </span>
                    </td>
                  </motion.tr>
                ))}
              </AnimatePresence>
            </tbody>
          </table>
        </motion.div>
      )}
    </div>
  );
}
