/** --- YAML
 * name: Partners List Page
 * description: Список партнёрств мастера (master_partnerships) — карточки коллег,
 *              с которыми у мастера активный партнёрский договор. Заменяет
 *              удалённый раздел «Гильдии». Клик по карточке → /partners/[id]
 *              для детального экрана.
 * created: 2026-05-05
 * --- */

'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Handshake, ArrowRight, Users, Star, ChevronRight, Plus } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useMaster } from '@/hooks/use-master';
import { Skeleton } from '@/components/ui/skeleton';
import { FONT, FONT_FEATURES, pageContainer, usePageTheme } from '@/lib/dashboard-theme';

interface PartnershipRow {
  id: string;
  status: string;
  master_id: string;
  partner_id: string;
  cross_promotion: boolean | null;
  initiator: { id: string; specialization: string | null; profile: { full_name: string | null; avatar_url: string | null; slug: string | null } | null } | null;
  target: { id: string; specialization: string | null; profile: { full_name: string | null; avatar_url: string | null; slug: string | null } | null } | null;
}

interface PartnerCard {
  partnershipId: string;
  status: 'pending' | 'accepted' | 'declined' | 'ended';
  fullName: string | null;
  avatarUrl: string | null;
  specialization: string | null;
  slug: string | null;
  crossPromotion: boolean;
  isIncoming: boolean; // true если они нам прислали инвайт, мы получатель
}

export default function PartnersListPage() {
  const { master, loading: masterLoading } = useMaster();
  const { C, mounted } = usePageTheme();
  const [partners, setPartners] = useState<PartnerCard[]>([]);
  const [loading, setLoading] = useState(true);

  // Mobile state
  const [isMobileView, setIsMobileView] = useState(false);
  const [mobilePillTab, setMobilePillTab] = useState<'my' | 'invites' | 'recommended'>('my');

  useEffect(() => {
    const check = () => setIsMobileView(window.innerWidth < 768);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  const load = useCallback(async () => {
    if (!master?.id) return;
    setLoading(true);
    const supabase = createClient();
    const { data } = await supabase
      .from('master_partnerships')
      .select(`
        id, status, master_id, partner_id, cross_promotion,
        initiator:masters!master_partnerships_master_id_fkey(
          id, specialization,
          profile:profiles!masters_profile_id_fkey(full_name, avatar_url, slug)
        ),
        target:masters!master_partnerships_partner_id_fkey(
          id, specialization,
          profile:profiles!masters_profile_id_fkey(full_name, avatar_url, slug)
        )
      `)
      .or(`master_id.eq.${master.id},partner_id.eq.${master.id}`)
      .order('initiated_at', { ascending: false });

    const rows = (data ?? []) as unknown as PartnershipRow[];
    const cards: PartnerCard[] = rows.map((r) => {
      const youInitiated = r.master_id === master.id;
      const other = youInitiated ? r.target : r.initiator;
      return {
        partnershipId: r.id,
        status: r.status as PartnerCard['status'],
        fullName: other?.profile?.full_name ?? null,
        avatarUrl: other?.profile?.avatar_url ?? null,
        specialization: other?.specialization ?? null,
        slug: other?.profile?.slug ?? null,
        crossPromotion: !!r.cross_promotion,
        isIncoming: !youInitiated,
      };
    });
    setPartners(cards);
    setLoading(false);
  }, [master?.id]);

  useEffect(() => {
    if (masterLoading) return;
    load();
  }, [masterLoading, load]);

  if (!mounted) return null;

  const accepted = partners.filter((p) => p.status === 'accepted');
  const pending = partners.filter((p) => p.status === 'pending');

  // ── MOBILE VIEW ──────────────────────────────────────────────────────────
  if (isMobileView) {
    const mobileList = mobilePillTab === 'my' ? accepted : mobilePillTab === 'invites' ? pending : [];

    return (
      <div style={{ background: '#f8fafc', minHeight: '100vh', paddingBottom: 100 }}>
        {/* Header */}
        <div style={{ background: '#fff', borderBottom: '1px solid #e2e8f0', padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 18, fontWeight: 700, color: '#0f172a' }}>Партнери</span>
        </div>

        {/* KPI strip */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, padding: '12px 16px 0' }}>
          {[
            { label: 'Активних', value: String(accepted.length) },
            { label: 'Запрошення', value: String(pending.length) },
            { label: 'Дохід', value: '—' },
          ].map(k => (
            <div key={k.label} style={{ background: '#fff', borderRadius: 12, padding: '10px 12px', border: '1px solid #e2e8f0' }}>
              <div style={{ fontSize: 18, fontWeight: 700, color: '#0f172a' }}>{k.value}</div>
              <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>{k.label}</div>
            </div>
          ))}
        </div>

        {/* Pill tabs */}
        <div style={{ display: 'flex', gap: 8, padding: '12px 16px' }}>
          {([
            { key: 'my' as const,          label: `Мої (${accepted.length})` },
            { key: 'invites' as const,     label: `Запрошення (${pending.length})` },
            { key: 'recommended' as const, label: 'Рекомендовані' },
          ] as const).map(t => (
            <button
              key={t.key}
              onClick={() => setMobilePillTab(t.key)}
              style={{
                padding: '6px 12px', borderRadius: 18, fontSize: 12, fontWeight: 600, border: 'none', cursor: 'pointer',
                background: mobilePillTab === t.key ? '#2563eb' : '#fff',
                color: mobilePillTab === t.key ? '#fff' : '#64748b',
                boxShadow: mobilePillTab === t.key ? '0 2px 8px rgba(37,99,235,0.25)' : '0 1px 3px rgba(0,0,0,0.08)',
                whiteSpace: 'nowrap',
              }}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Partner list */}
        <div style={{ padding: '0 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {loading ? (
            [0,1,2].map(i => <div key={i} style={{ height: 68, background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0' }} />)
          ) : mobileList.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 0', color: '#94a3b8', fontSize: 14 }}>
              {mobilePillTab === 'recommended' ? 'Функція незабаром' : 'Список порожній'}
            </div>
          ) : (
            mobileList.map(p => {
              const initials = (p.fullName ?? '??').split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase();
              return (
                <Link
                  key={p.partnershipId}
                  href={`/partners/${p.partnershipId}`}
                  style={{ background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0', padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 12, textDecoration: 'none' }}
                >
                  <div style={{ width: 40, height: 40, borderRadius: 20, background: '#eff6ff', color: '#2563eb', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 700, flexShrink: 0 }}>
                    {initials}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: '#0f172a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.fullName ?? 'Невідомий'}</div>
                    <div style={{ fontSize: 12, color: '#64748b', marginTop: 2, display: 'flex', alignItems: 'center', gap: 4 }}>
                      {p.specialization ?? 'Майстер'}
                      {p.status === 'pending' && p.isIncoming && (
                        <span style={{ fontSize: 10, fontWeight: 600, color: '#d97706', background: '#fffbeb', padding: '1px 6px', borderRadius: 8, marginLeft: 4 }}>очікує</span>
                      )}
                    </div>
                  </div>
                  <ChevronRight style={{ width: 16, height: 16, color: '#cbd5e1', flexShrink: 0 }} />
                </Link>
              );
            })
          )}
        </div>

        {/* FAB */}
        <button
          style={{ position: 'fixed', bottom: 88, right: 20, width: 52, height: 52, borderRadius: 26, background: '#2563eb', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', boxShadow: '0 4px 16px rgba(37,99,235,0.35)', zIndex: 40 }}
        >
          <Plus style={{ width: 24, height: 24, color: '#fff' }} />
        </button>
      </div>
    );
  }

  return (
    <div style={{
      ...pageContainer,
      color: C.text,
      background: C.bg,
      minHeight: '100%',
      paddingBottom: 96,
      fontFamily: FONT,
      fontFeatureSettings: FONT_FEATURES,
    }}>
      {/* Hero */}
      <motion.div
        initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
        style={{
          background: C.accentSoft,
          border: `1px solid ${C.aiBorder}`,
          borderRadius: 16,
          padding: '24px 28px',
          marginBottom: 24,
        }}
      >
        <h1 style={{
          fontSize: 28, fontWeight: 700, color: C.text, letterSpacing: '-0.02em',
          margin: 0, display: 'flex', alignItems: 'center', gap: 10, lineHeight: 1,
        }}>
          <Handshake size={24} style={{ color: C.accent }} />
          Партнёры
        </h1>
        <p style={{ fontSize: 14, color: C.textSecondary, margin: '6px 0 0', lineHeight: 1.5 }}>
          Мастера, с которыми у вас есть договор о взаимной рекомендации, общем
          промокоде или совместной рекламе. Управляй условиями — они применяются
          автоматически.
        </p>
      </motion.div>

      {loading || masterLoading ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Skeleton className="h-28" />
          <Skeleton className="h-28" />
          <Skeleton className="h-28" />
        </div>
      ) : partners.length === 0 ? (
        <div style={{
          background: C.surface,
          border: `1px solid ${C.border}`,
          borderRadius: 14,
          padding: '40px 28px',
          textAlign: 'center',
        }}>
          <div style={{
            width: 48, height: 48, borderRadius: 12,
            background: C.accentSoft, color: C.accent,
            margin: '0 auto 14px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Users size={22} />
          </div>
          <p style={{ fontSize: 15, fontWeight: 600, color: C.text, margin: '0 0 6px' }}>
            Партнёров пока нет
          </p>
          <p style={{ fontSize: 13, color: C.textSecondary, margin: 0, maxWidth: 420, marginInline: 'auto' }}>
            Чтобы предложить партнёрство — откройте публичную страницу другого
            мастера и нажми «Предложить партнёрство». Он получит уведомление
            в Mini App и сможет принять или отклонить.
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
          {pending.length > 0 && (
            <section>
              <h2 style={{ fontSize: 14, fontWeight: 600, color: C.textSecondary, margin: '0 0 10px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Ожидают ответа · {pending.length}
              </h2>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {pending.map((p) => <PartnerTile key={p.partnershipId} card={p} C={C} />)}
              </div>
            </section>
          )}
          {accepted.length > 0 && (
            <section>
              <h2 style={{ fontSize: 14, fontWeight: 600, color: C.textSecondary, margin: '0 0 10px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Активные партнёры · {accepted.length}
              </h2>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {accepted.map((p) => <PartnerTile key={p.partnershipId} card={p} C={C} />)}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}

function PartnerTile({ card, C }: { card: PartnerCard; C: ReturnType<typeof usePageTheme>['C'] }) {
  return (
    <Link
      href={`/partners/${card.partnershipId}`}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: 14,
        borderRadius: 14,
        background: C.surface,
        border: `1px solid ${C.border}`,
        textDecoration: 'none',
        transition: 'border-color 0.15s, transform 0.15s',
      }}
      onMouseEnter={(e) => { e.currentTarget.style.borderColor = C.accent; }}
      onMouseLeave={(e) => { e.currentTarget.style.borderColor = C.border; }}
    >
      {/* Avatar */}
      <div style={{
        width: 48, height: 48, borderRadius: '50%', flexShrink: 0,
        background: card.avatarUrl ? `url(${card.avatarUrl}) center/cover no-repeat` : C.accentSoft,
        color: C.accent,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 18, fontWeight: 700,
      }}>
        {!card.avatarUrl && (card.fullName?.[0]?.toUpperCase() ?? '?')}
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: 14, fontWeight: 650, color: C.text, margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {card.fullName ?? 'Без имени'}
        </p>
        <p style={{ fontSize: 12, color: C.textTertiary, margin: '2px 0 0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {card.specialization ?? '—'}
        </p>
        {(card.crossPromotion || card.isIncoming) && (
          <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
            {card.crossPromotion && (
              <span style={{
                display: 'inline-flex', alignItems: 'center', gap: 3,
                padding: '2px 7px', borderRadius: 999,
                background: C.accentSoft, color: C.accent,
                fontSize: 10, fontWeight: 600,
              }}>
                <Star size={10} />
                Реклама
              </span>
            )}
            {card.isIncoming && card.status === 'pending' && (
              <span style={{
                padding: '2px 7px', borderRadius: 999,
                background: '#fef3c7', color: '#b45309',
                fontSize: 10, fontWeight: 600,
              }}>
                Входящее
              </span>
            )}
          </div>
        )}
      </div>

      <ArrowRight size={16} style={{ color: C.textTertiary, flexShrink: 0 }} />
    </Link>
  );
}
