/** --- YAML
 * name: GiftCardsPage
 * description: Fresha-exact sold gift cards page — search, filters, empty state with gift illustration
 * --- */

'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { usePageTheme, FONT, FONT_FEATURES, CURRENCY } from '@/lib/dashboard-theme';
import { motion } from 'framer-motion';
import { Search, SlidersHorizontal, Gift, Plus, Trash2, X } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useMaster } from '@/hooks/use-master';
import { format, type Locale } from 'date-fns';
import { ru } from 'date-fns/locale/ru';
import { uk } from 'date-fns/locale/uk';
import { enUS } from 'date-fns/locale/en-US';

const dateFnsLocales: Record<string, Locale> = { ru, uk, en: enUS };

interface GiftCardRow {
  id: string;
  code: string;
  amount: number;
  balance_remaining: number | null;
  is_redeemed: boolean;
  expires_at: string | null;
  created_at: string;
}

export default function GiftCardsPage() {
  const t = useTranslations('sales');
  const locale = useLocale();
  const dfLocale = dateFnsLocales[locale] || ru;
  const { C, isDark, mounted } = usePageTheme();

  const { master } = useMaster();
  const [cards, setCards] = useState<GiftCardRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [newAmount, setNewAmount] = useState('');
  const [newExpiry, setNewExpiry] = useState('');

  const loadCards = useCallback(async () => {
    if (!master?.id) return;
    setLoading(true);
    const supabase = createClient();
    const { data } = await supabase
      .from('gift_certificates')
      .select('id, code, amount, balance_remaining, is_redeemed, expires_at, created_at')
      .eq('master_id', master.id)
      .order('created_at', { ascending: false });
    setCards((data as GiftCardRow[]) || []);
    setLoading(false);
  }, [master?.id]);

  const createCard = useCallback(async () => {
    if (!master?.id || !newAmount) return;
    const supabase = createClient();
    const amt = Number(newAmount);
    if (!amt || amt <= 0) return;
    const { data, error } = await supabase
      .from('gift_certificates')
      .insert({
        master_id: master.id,
        amount: amt,
        balance_remaining: amt,
        expires_at: newExpiry ? new Date(newExpiry).toISOString() : null,
      })
      .select('id, code, amount, balance_remaining, is_redeemed, expires_at, created_at')
      .single();
    if (!error && data) {
      setCards(prev => [data as GiftCardRow, ...prev]);
      setNewAmount('');
      setNewExpiry('');
      setShowCreate(false);
    }
  }, [master?.id, newAmount, newExpiry]);

  const deleteCard = useCallback(async (id: string) => {
    const supabase = createClient();
    await supabase.from('gift_certificates').delete().eq('id', id);
    setCards(prev => prev.filter(c => c.id !== id));
  }, []);

  useEffect(() => { loadCards(); }, [loadCards]);

  const filtered = useMemo(() => {
    if (!search.trim()) return cards;
    const q = search.toLowerCase();
    return cards.filter(c => c.code.toLowerCase().includes(q));
  }, [cards, search]);

  return (
    <div style={{ fontFamily: FONT, fontFeatureSettings: FONT_FEATURES, color: C.text, background: C.bg, height: '100%', overflowY: 'auto', padding: '24px 28px', maxWidth: 860 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0 }}>{t('giftCardsTitle')}</h1>
          <p style={{ fontSize: 14, color: C.textSecondary, marginTop: 4 }}>
            {t('giftCardsDesc')} <span style={{ color: C.accent, cursor: 'pointer' }}>{t('learnMore')}</span>
          </p>
        </div>
        <button
          onClick={() => setShowCreate(s => !s)}
          style={{
            padding: '8px 16px', borderRadius: 8, border: 'none',
            background: C.accent, color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: 6,
          }}
        >
          <Plus size={14} />
          {t('add')}
        </button>
      </div>

      {/* Create form */}
      {showCreate && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          style={{
            background: C.surface, borderRadius: 12, padding: 20, marginBottom: 16,
            display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap',
          }}
        >
          <div style={{ flex: '1 1 120px' }}>
            <div style={{ fontSize: 12, color: C.textTertiary, marginBottom: 4 }}>{t('totalAmount')}</div>
            <input
              type="number"
              value={newAmount}
              onChange={e => setNewAmount(e.target.value)}
              placeholder="500"
              style={{
                width: '100%', padding: '8px 12px', borderRadius: 8,
                border: `1px solid ${C.border}`, background: C.surface, color: C.text,
                fontSize: 13, fontFamily: FONT,
              }}
            />
          </div>
          <div style={{ flex: '1 1 160px' }}>
            <div style={{ fontSize: 12, color: C.textTertiary, marginBottom: 4 }}>{t('expiryDate') ?? 'Expiry'}</div>
            <input
              type="date"
              value={newExpiry}
              onChange={e => setNewExpiry(e.target.value)}
              style={{
                width: '100%', padding: '8px 12px', borderRadius: 8,
                border: `1px solid ${C.border}`, background: C.surface, color: C.text,
                fontSize: 13, fontFamily: FONT,
              }}
            />
          </div>
          <button
            onClick={createCard}
            style={{
              padding: '8px 20px', borderRadius: 8, border: 'none',
              background: C.accent, color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer',
            }}
          >
            {t('add')}
          </button>
          <button
            onClick={() => setShowCreate(false)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.textTertiary, padding: 4 }}
          >
            <X size={16} />
          </button>
        </motion.div>
      )}

      {/* Search + filters */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24, marginTop: 16, flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: '1 1 240px', maxWidth: 320 }}>
          <Search size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: C.textSecondary }} />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder={t('search')}
            style={{
              width: '100%', padding: '9px 12px 9px 36px', borderRadius: 8,
              border: `1px solid ${C.border}`, background: C.surface, color: C.text,
              fontSize: 13, outline: 'none', fontFamily: FONT,
            }}
          />
        </div>
        <button
          style={{
            padding: '9px 14px', borderRadius: 8, border: `1px solid ${C.border}`,
            background: C.surface, color: C.textSecondary, fontSize: 13, cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: 6, fontFamily: FONT,
          }}
        >
          <SlidersHorizontal size={14} />
          {t('filters')}
        </button>
      </div>

      {/* Content */}
      {loading ? (
        <div style={{ background: C.surface, borderRadius: 12, padding: '40px 20px' }}>
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} style={{ height: 48, borderRadius: 8, background: C.rowHover, marginBottom: 8 }} />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          style={{
            background: C.surface, borderRadius: 16, padding: '80px 40px',
            display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center',
          }}
        >
          <div style={{
            width: 72, height: 72, borderRadius: 16,
            background: C.accentSoft, display: 'flex', alignItems: 'center', justifyContent: 'center',
            marginBottom: 20,
          }}>
            <Gift size={32} style={{ color: C.accent }} />
          </div>
          <p style={{ fontSize: 16, fontWeight: 600, color: C.text, marginBottom: 8 }}>{t('noGiftCards')}</p>
          <p style={{ fontSize: 13, color: C.textTertiary }}>{t('nothingFoundDesc')}</p>
        </motion.div>
      ) : (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          style={{ background: C.surface, borderRadius: 12, overflow: 'hidden' }}
        >
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: `1px solid ${C.border}` }}>
                <th style={{ padding: '12px 20px', textAlign: 'left', fontSize: 12, fontWeight: 500, color: C.textTertiary }}>Code</th>
                <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: 12, fontWeight: 500, color: C.textTertiary }}>{t('created')}</th>
                <th style={{ padding: '12px 16px', textAlign: 'right', fontSize: 12, fontWeight: 500, color: C.textTertiary }}>{t('totalAmount')}</th>
                <th style={{ padding: '12px 16px', textAlign: 'right', fontSize: 12, fontWeight: 500, color: C.textTertiary }}>{t('balance') ?? 'Balance'}</th>
                <th style={{ padding: '12px 16px', textAlign: 'right', fontSize: 12, fontWeight: 500, color: C.textTertiary }}>{t('expiryDate') ?? 'Expires'}</th>
                <th style={{ padding: '12px 16px', textAlign: 'right', fontSize: 12, fontWeight: 500, color: C.textTertiary }}>{t('status')}</th>
                <th style={{ padding: '12px 16px', width: 40 }} />
              </tr>
            </thead>
            <tbody>
              {filtered.map((card, i) => {
                const isExpired = card.expires_at ? new Date(card.expires_at) < new Date() : false;
                const balance = card.balance_remaining ?? card.amount;
                const isPartial = balance > 0 && balance < card.amount;
                return (
                  <motion.tr
                    key={card.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: i * 0.02 }}
                    style={{ borderBottom: `1px solid ${C.border}`, cursor: 'pointer' }}
                    onMouseEnter={e => (e.currentTarget.style.background = C.rowHover)}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                  >
                    <td style={{ padding: '12px 20px', fontSize: 13, color: C.accent, fontWeight: 500 }}>{card.code}</td>
                    <td style={{ padding: '12px 16px', fontSize: 13, color: C.textTertiary }}>
                      {format(new Date(card.created_at), 'd MMM yyyy', { locale: dfLocale })}
                    </td>
                    <td style={{ padding: '12px 16px', textAlign: 'right', fontSize: 13, fontWeight: 600, color: C.text }}>
                      {card.amount.toLocaleString()} {CURRENCY}
                    </td>
                    <td style={{ padding: '12px 16px', textAlign: 'right', fontSize: 13, color: isPartial ? (isDark ? '#fbbf24' : '#d97706') : C.text }}>
                      {balance.toLocaleString()} {CURRENCY}
                    </td>
                    <td style={{ padding: '12px 16px', textAlign: 'right', fontSize: 13, color: isExpired ? '#ef4444' : C.textTertiary }}>
                      {card.expires_at ? format(new Date(card.expires_at), 'd MMM yyyy', { locale: dfLocale }) : '—'}
                    </td>
                    <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                      <span style={{
                        display: 'inline-block', padding: '4px 10px', borderRadius: 6,
                        fontSize: 12, fontWeight: 500,
                        background: isExpired ? 'rgba(220,38,38,0.12)' : card.is_redeemed ? 'rgba(245,158,11,0.12)' : 'rgba(16,185,129,0.12)',
                        color: isExpired ? '#ef4444' : card.is_redeemed
                          ? (isDark ? '#fbbf24' : '#d97706')
                          : (isDark ? '#34d399' : '#059669'),
                      }}>
                        {isExpired ? (t('expired') ?? 'Expired') : card.is_redeemed ? t('completed') : (t('active') ?? 'Active')}
                      </span>
                    </td>
                    <td style={{ padding: '12px 8px' }}>
                      <button
                        onClick={(e) => { e.stopPropagation(); deleteCard(card.id); }}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.textTertiary, padding: 4 }}
                      >
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </motion.tr>
                );
              })}
            </tbody>
          </table>
        </motion.div>
      )}
    </div>
  );
}
