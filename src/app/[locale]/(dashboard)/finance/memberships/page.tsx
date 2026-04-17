/** --- YAML
 * name: MembershipsPage
 * description: Fresha-exact sold memberships page — empty state with setup link to catalogue
 * --- */

'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { usePageTheme, FONT, FONT_FEATURES, CURRENCY } from '@/lib/dashboard-theme';
import { motion } from 'framer-motion';
import { Search, SlidersHorizontal, Ticket } from 'lucide-react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { useMaster } from '@/hooks/use-master';
import { format, type Locale } from 'date-fns';
import { ru } from 'date-fns/locale/ru';
import { uk } from 'date-fns/locale/uk';
import { enUS } from 'date-fns/locale/en-US';

const dateFnsLocales: Record<string, Locale> = { ru, uk, en: enUS };

interface MembershipRow {
  id: string;
  client_id: string;
  visits_remaining: number;
  purchased_at: string;
  expires_at: string;
  package?: { name: string; total_visits: number; price: number } | null;
  client?: { full_name: string } | null;
}

export default function MembershipsPage() {
  const t = useTranslations('sales');
  const locale = useLocale();
  const dfLocale = dateFnsLocales[locale] || ru;
  const { C, isDark, mounted } = usePageTheme();

  const { master } = useMaster();
  const [memberships, setMemberships] = useState<MembershipRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const loadMemberships = useCallback(async () => {
    if (!master?.id) return;
    setLoading(true);
    const supabase = createClient();
    const { data } = await supabase
      .from('client_packages')
      .select('id, client_id, visits_remaining, purchased_at, expires_at, package:service_packages(name, total_visits, price), client:clients(full_name)')
      .order('purchased_at', { ascending: false });
    setMemberships((data as unknown as MembershipRow[]) || []);
    setLoading(false);
  }, [master?.id]);

  useEffect(() => { loadMemberships(); }, [loadMemberships]);

  const filtered = useMemo(() => {
    if (!search.trim()) return memberships;
    const q = search.toLowerCase();
    return memberships.filter(m =>
      (m.client?.full_name || '').toLowerCase().includes(q) ||
      (m.package?.name || '').toLowerCase().includes(q)
    );
  }, [memberships, search]);

  return (
    <div style={{ fontFamily: FONT, fontFeatureSettings: FONT_FEATURES, color: C.text, background: C.bg, padding: '24px 28px', maxWidth: 860, height: '100%', overflowY: 'auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0 }}>{t('memberships')}</h1>
          <p style={{ fontSize: 14, color: C.textSecondary, marginTop: 4 }}>
            {t('membershipsDesc')} <span style={{ color: C.accent, cursor: 'pointer' }}>{t('learnMore')}</span>
          </p>
        </div>
        <button
          style={{
            padding: '8px 16px', borderRadius: 8, border: `1px solid ${C.border}`,
            background: C.surface, color: C.text, fontSize: 13, fontWeight: 500, cursor: 'pointer',
          }}
        >
          {t('options')}
        </button>
      </div>

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
            <Ticket size={32} style={{ color: C.accent }} />
          </div>
          <p style={{ fontSize: 16, fontWeight: 600, color: C.text, marginBottom: 8 }}>{t('noMemberships')}</p>
          <p style={{ fontSize: 13, color: C.textTertiary, maxWidth: 360, marginBottom: 20 }}>{t('noMembershipsDesc')}</p>
          <Link
            href={`/${locale}/services`}
            style={{
              padding: '10px 24px', borderRadius: 8, border: 'none',
              background: C.accent, color: '#fff', fontSize: 14, fontWeight: 600,
              cursor: 'pointer', fontFamily: FONT, textDecoration: 'none', display: 'inline-block',
            }}
          >
            {t('install')}
          </Link>
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
                <th style={{ padding: '12px 20px', textAlign: 'left', fontSize: 12, fontWeight: 500, color: C.textTertiary }}>ID</th>
                <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: 12, fontWeight: 500, color: C.textTertiary }}>{t('service')}</th>
                <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: 12, fontWeight: 500, color: C.textTertiary }}>{t('teamMember')}</th>
                <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: 12, fontWeight: 500, color: C.textTertiary }}>{t('created')}</th>
                <th style={{ padding: '12px 16px', textAlign: 'right', fontSize: 12, fontWeight: 500, color: C.textTertiary }}>{t('price')}</th>
                <th style={{ padding: '12px 20px', textAlign: 'right', fontSize: 12, fontWeight: 500, color: C.textTertiary }}>{t('status')}</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((m, i) => {
                const isExpired = new Date(m.expires_at) < new Date();
                return (
                  <motion.tr
                    key={m.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: i * 0.02 }}
                    style={{ borderBottom: `1px solid ${C.border}`, cursor: 'pointer' }}
                    onMouseEnter={e => (e.currentTarget.style.background = C.rowHover)}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                  >
                    <td style={{ padding: '12px 20px', fontSize: 13, color: C.accent, fontWeight: 500 }}>
                      #{m.id.slice(0, 7).toUpperCase()}
                    </td>
                    <td style={{ padding: '12px 16px', fontSize: 13, color: C.text }}>{m.package?.name || '—'}</td>
                    <td style={{ padding: '12px 16px', fontSize: 13, color: C.text }}>{m.client?.full_name || '—'}</td>
                    <td style={{ padding: '12px 16px', fontSize: 13, color: C.textTertiary }}>
                      {format(new Date(m.purchased_at), 'd MMM yyyy', { locale: dfLocale })}
                    </td>
                    <td style={{ padding: '12px 16px', textAlign: 'right', fontSize: 13, fontWeight: 600, color: C.text }}>
                      {(m.package?.price || 0).toLocaleString()} {CURRENCY}
                    </td>
                    <td style={{ padding: '12px 20px', textAlign: 'right' }}>
                      <span style={{
                        display: 'inline-block', padding: '4px 10px', borderRadius: 6,
                        fontSize: 12, fontWeight: 500,
                        background: isExpired ? C.dangerSoft : C.successSoft,
                        color: isExpired ? C.danger : C.success,
                      }}>
                        {isExpired ? t('cancelled') : `${m.visits_remaining}/${m.package?.total_visits || 0}`}
                      </span>
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
