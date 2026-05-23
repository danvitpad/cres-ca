/** --- YAML
 * name: Client Detail Page
 * description: Compact one-screen client card. Hero on top, 2×2 grid (Personal / Notes / History / Analytics),
 *              AI chat input pinned at the bottom on full width. Master cannot edit personal data
 *              (name/phone/email/DOB), but can add/edit/delete notes manually or via AI chat.
 * created: 2026-04-12
 * updated: 2026-04-25
 * --- */

'use client';

import { useState, useEffect, useCallback, useRef, use } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';
import { formatPhone } from '@/lib/phone';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { BehaviorIndicators } from '@/components/shared/behavior-indicators';
import { useMaster } from '@/hooks/use-master';
import { motion } from 'framer-motion';
import { LoyaltyCreditButton } from '@/components/clients/loyalty-credit-button';
import { ClientBehaviorAnalysis } from '@/components/clients/client-behavior-analysis';
import { differenceInYears, differenceInDays, setYear, getYear, startOfDay } from 'date-fns';
import {
  ArrowLeft, RefreshCw, AlertTriangle, ShieldAlert, ShieldCheck,
  BarChart3, Phone, Mail, Cake,
  Calendar as CalendarIcon, FileText, Heart, User as UserIcon,
  Pencil, Trash2, Plus, Check, X, Bot, Send, Star,
  Pin, PinOff,
} from 'lucide-react';
import {
  FONT, FONT_FEATURES, CURRENCY,
  usePageTheme, pageContainer,
  type PageTheme,
} from '@/lib/dashboard-theme';
import type { BehaviorIndicator, AppointmentStatus } from '@/types';
import { humanizeError } from '@/lib/format/error';

/* ────────────────────── Types ────────────────────── */

interface ClientDetail {
  id: string;
  profile_id: string | null;
  full_name: string;
  phone: string | null;
  email: string | null;
  date_of_birth: string | null;
  notes: string | null;
  allergies: string[];
  contraindications: string[];
  has_health_alert: boolean;
  total_visits: number;
  total_spent: number;
  avg_check: number;
  last_visit_at: string | null;
  rating: number;
  behavior_indicators: BehaviorIndicator[];
  family_link_id: string | null;
  is_blacklisted: boolean;
  blacklist_reason: string | null;
  tier?: 'new' | 'regular' | 'vip';
  manual_tier?: 'new' | 'regular' | 'vip' | null;
  cancellation_count: number;
  late_cancellation_count: number;
  master_cancellation_count: number;
  no_show_count: number;
  /** Если клиент пришёл с публичной страницы партнёра-мастера. Партнёрская атрибуция. */
  referrer_master_id: string | null;
}

interface AppointmentRow {
  id: string;
  starts_at: string;
  ends_at: string;
  status: AppointmentStatus;
  service: { id: string; name: string; duration_minutes: number; price: number } | null;
}

interface ReviewRow {
  id: string;
  score: number;
  comment: string | null;
  is_published: boolean;
  created_at: string;
}

/* ────────────────────── Main Page ────────────────────── */

export default function ClientDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const t = useTranslations('clients');
  const tc = useTranslations('common');
  const router = useRouter();
  const { master } = useMaster();
  const { C } = usePageTheme();
  const [client, setClient] = useState<ClientDetail | null>(null);
  const [blacklist, setBlacklist] = useState<{ warning: boolean; total: number } | null>(null);
  const [appointments, setAppointments] = useState<AppointmentRow[]>([]);
  const [reviews, setReviews] = useState<ReviewRow[]>([]);
  const [referrerMasterName, setReferrerMasterName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const loadClient = useCallback(async () => {
    const supabase = createClient();
    const { data } = await supabase.from('clients').select('*').eq('id', id).single();
    if (data) {
      const c = data as unknown as ClientDetail;
      setClient(c);
      if (c.profile_id) {
        try {
          const res = await fetch('/api/blacklist/check', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ profile_id: c.profile_id }),
          });
          if (res.ok) setBlacklist(await res.json());
        } catch { /* ignore */ }
      } else {
        setBlacklist(null);
      }
      // Подтягиваем имя партнёра-источника, если клиент пришёл по реф-ссылке.
      if (c.referrer_master_id) {
        const { data: rm } = await supabase
          .from('masters')
          .select('display_name, profile:profiles!masters_profile_id_fkey(full_name)')
          .eq('id', c.referrer_master_id)
          .maybeSingle();
        const profile = rm ? (Array.isArray(rm.profile) ? rm.profile[0] : rm.profile) : null;
        setReferrerMasterName(rm?.display_name ?? profile?.full_name ?? null);
      } else {
        setReferrerMasterName(null);
      }
    }
    setLoading(false);
  }, [id]);

  const loadAppointments = useCallback(async () => {
    const supabase = createClient();
    const { data } = await supabase
      .from('appointments')
      .select('id, starts_at, ends_at, status, service:services(id, name, duration_minutes, price)')
      .eq('client_id', id)
      .order('starts_at', { ascending: false })
      .limit(50);
    if (data) setAppointments(data as unknown as AppointmentRow[]);
  }, [id]);

  // eslint-disable-next-line react-hooks/preserve-manual-memoization
  const loadReviews = useCallback(async () => {
    if (!client?.profile_id || !master?.id) {
      setReviews([]);
      return;
    }
    const supabase = createClient();
    const { data } = await supabase
      .from('reviews')
      .select('id, score, comment, is_published, created_at')
      .eq('reviewer_id', client.profile_id)
      .eq('target_type', 'master')
      .eq('target_id', master.id)
      .order('created_at', { ascending: false });
    setReviews((data ?? []) as ReviewRow[]);
  }, [client?.profile_id, master?.id]);

  useEffect(() => {
    loadClient(); // eslint-disable-line react-hooks/set-state-in-effect
    loadAppointments();
  }, [loadClient, loadAppointments]);

  useEffect(() => {
    loadReviews(); // eslint-disable-line react-hooks/set-state-in-effect
  }, [loadReviews]);

  if (loading) {
    return (
      <div style={{ ...pageContainer, background: C.bg, display: 'flex', flexDirection: 'column', gap: 16 }}>
        <Skeleton className="h-8 w-64" /><Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!client) {
    return (
      <div style={{ ...pageContainer, background: C.bg, color: C.text, display: 'flex', flexDirection: 'column', gap: 16 }}>
        <Button variant="ghost" onClick={() => router.back()}>
          <ArrowLeft style={{ width: 16, height: 16, marginRight: 8 }} />{tc('back')}
        </Button>
        <p style={{ color: C.textSecondary }}>{tc('error')}</p>
      </div>
    );
  }

  // ─── Derived data ───
  const age = client.date_of_birth ? differenceInYears(new Date(), new Date(client.date_of_birth)) : null;
  const daysToBday = (() => {
    if (!client.date_of_birth) return null;
    const birth = new Date(client.date_of_birth);
    const now = new Date();
    let next = setYear(birth, getYear(now));
    if (next < startOfDay(now)) next = setYear(birth, getYear(now) + 1);
    return differenceInDays(startOfDay(next), startOfDay(now));
  })();
  const totalSpent = client.avg_check * client.total_visits;
  const avatarGrad = (() => {
    let hash = 0;
    for (let i = 0; i < client.full_name.length; i++) hash = client.full_name.charCodeAt(i) + ((hash << 5) - hash);
    const grads = [
      'linear-gradient(135deg, var(--color-accent) 0%, var(--color-accent-text) 100%)',
      'linear-gradient(135deg, #ec4899 0%, #f472b6 100%)',
      'linear-gradient(135deg, #06b6d4 0%, #67e8f9 100%)',
      'linear-gradient(135deg, #10b981 0%, #34d399 100%)',
      'linear-gradient(135deg, #f59e0b 0%, #fbbf24 100%)',
      'linear-gradient(135deg, #6366f1 0%, #818cf8 100%)',
    ];
    return grads[Math.abs(hash) % grads.length];
  })();
  const initials = client.full_name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase() || '?';

  return (
    <div style={{ ...pageContainer, background: C.bg, color: C.text, minHeight: '100%', paddingBottom: 32 }}>
      {/* ═══ Back button ═══ */}
      <button
        onClick={() => router.back()}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          padding: '6px 12px', borderRadius: 8, border: 'none',
          background: 'transparent', color: C.textSecondary,
          cursor: 'pointer', fontSize: 13, fontWeight: 550,
          fontFamily: FONT, fontFeatureSettings: FONT_FEATURES,
          marginBottom: 12,
        }}
      >
        <ArrowLeft size={14} />
        {tc('back') || 'Назад'}
      </button>

      {/* ═══ Compact hero ═══ */}
      <motion.div
        initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}
        style={{
          background: C.surface,
          border: `1px solid ${C.border}`,
          borderRadius: 16,
          padding: 16,
          marginBottom: 12,
          display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap',
        }}
      >
        <div style={{
          width: 48, height: 48, borderRadius: '50%',
          background: avatarGrad, color: '#fff',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 18, fontWeight: 600, flexShrink: 0,
        }}>
          {initials}
        </div>

        <div style={{ flex: 1, minWidth: 200 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <h1 style={{ fontSize: 17, fontWeight: 650, color: C.text, margin: 0, letterSpacing: '-0.3px' }}>
              {client.full_name}
            </h1>
            {client.has_health_alert && (
              <span
                title="Есть аллергии или противопоказания — учитывай при процедуре"
                style={{ display: 'inline-flex', alignItems: 'center' }}
              >
                <AlertTriangle size={14} style={{ color: C.danger }} />
              </span>
            )}
            <ManualTierPicker
              clientId={id}
              effectiveTier={(client.manual_tier ?? client.tier ?? 'new') as 'new' | 'regular' | 'vip'}
              isManual={!!client.manual_tier}
              onSaved={loadClient}
              C={C}
            />
            {client.is_blacklisted && <Badge variant="destructive">{t('manuallyBlacklisted')}</Badge>}
            {daysToBday !== null && daysToBday <= 14 && (
              <span style={{
                display: 'inline-flex', alignItems: 'center', gap: 4,
                padding: '2px 7px', borderRadius: 5,
                background: C.warningSoft, color: C.warning,
                fontSize: 11, fontWeight: 600,
              }}>
                <Cake size={11} />
                {daysToBday === 0 ? 'сегодня' : daysToBday === 1 ? 'завтра' : `через ${daysToBday} дн.`}
              </span>
            )}
            <BehaviorIndicators indicators={client.behavior_indicators} />
          </div>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', fontSize: 12, color: C.textSecondary, marginTop: 3 }}>
            {age !== null && (
              <span><Cake size={11} style={{ display: 'inline', marginRight: 3, color: C.textTertiary }} />{age} лет</span>
            )}
            {client.phone && (
              <a href={`tel:${client.phone}`} style={{ color: C.textSecondary, textDecoration: 'none' }}>
                <Phone size={11} style={{ display: 'inline', marginRight: 3, color: C.textTertiary }} />{formatPhone(client.phone)}
              </a>
            )}
            {client.email && (
              <a href={`mailto:${client.email}`} style={{ color: C.textSecondary, textDecoration: 'none' }}>
                <Mail size={11} style={{ display: 'inline', marginRight: 3, color: C.textTertiary }} />{client.email}
              </a>
            )}
            {referrerMasterName && (
              <span title="Клиент пришёл с публичной страницы партнёра-мастера" style={{ color: C.accent, fontWeight: 500 }}>
                🤝 Пришёл от {referrerMasterName}
              </span>
            )}
          </div>
        </div>

        <div style={{ display: 'flex', gap: 16, alignItems: 'center', flexShrink: 0 }}>
          <Stat label="Визитов" value={String(client.total_visits)} C={C} />
          <Divider C={C} />
          <Stat label="Потрачено" value={`${totalSpent.toLocaleString()} ${CURRENCY}`} C={C} />
          <Divider C={C} />
          <Stat label="Ср. чек" value={`${Math.round(client.avg_check).toLocaleString()} ${CURRENCY}`} C={C} />
        </div>

        {master?.id && (
          <LoyaltyCreditButton
            masterId={master.id}
            profileId={client.profile_id ?? null}
          />
        )}

        {/* Иконка-кнопка «В чёрный список» — всегда в хедере, без подписи.
            Tooltip объясняет действие при наведении. Реальная блокировка
            требует ввода причины в диалоге внизу. */}
        {!client.is_blacklisted ? (
          <HeaderBlacklistButton clientId={id} onDone={loadClient} C={C} />
        ) : (
          <HeaderUnblacklistButton clientId={id} reason={client.blacklist_reason} onDone={loadClient} C={C} />
        )}

        <Link
          href={`/calendar?client_id=${id}`}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            padding: '8px 14px', borderRadius: 10,
            background: C.accent, color: '#fff', textDecoration: 'none',
            fontSize: 13, fontWeight: 600, flexShrink: 0,
          }}
        >
          <CalendarIcon size={14} />
          Записать
        </Link>
      </motion.div>

      {/* ═══ Blacklist warning ═══ */}
      {blacklist?.warning && (
        <div style={{
          display: 'flex', alignItems: 'flex-start', gap: 12, borderRadius: 14,
          border: `1px solid ${C.danger}33`, background: C.dangerSoft,
          padding: 12, marginBottom: 12,
        }}>
          <ShieldAlert style={{ marginTop: 2, width: 18, height: 18, flexShrink: 0, color: C.danger }} />
          <div>
            <p style={{ fontWeight: 600, color: C.danger, margin: 0, fontSize: 13 }}>{t('blacklistWarning')}</p>
            <p style={{ fontSize: 12, color: C.danger, opacity: 0.8, margin: '2px 0 0' }}>
              {t('blacklistWarningDesc', { count: blacklist.total })}
            </p>
          </div>
        </div>
      )}

      {/* ═══ AI floating chat — между хедером и табами.
          Иконка превращается в строку ввода при клике, мастер
          печатает заметки → AI разносит по категориям и дописывает их в client.notes. */}
      <ClientAiChat clientId={id} onApplied={loadClient} C={C} />

      {/* ═══ AI-анализ поведения клиента (MAX-фича) ═══ */}
      <div style={{ marginBottom: 16 }}>
        <ClientBehaviorAnalysis clientId={id} />
      </div>

      {/* ═══ Tabs ═══ */}
      <ClientTabs
        client={client}
        appointments={appointments}
        reviews={reviews}
        clientId={id}
        onSaved={loadClient}
        C={C}
      />
    </div>
  );
}

/* ────────────────────── Tab Container ────────────────────── */
type ClientTabKey = 'profile' | 'history' | 'analytics';

function ClientTabs({
  client, appointments, reviews, clientId, onSaved, C,
}: {
  client: ClientDetail;
  appointments: AppointmentRow[];
  reviews: ReviewRow[];
  clientId: string;
  onSaved: () => void;
  C: PageTheme;
}) {
  const [tab, setTab] = useState<ClientTabKey>('profile');

  const tabs: { key: ClientTabKey; label: string; count?: number }[] = [
    { key: 'profile', label: 'Профиль' },
    { key: 'history', label: 'История посещений', count: appointments.length },
    { key: 'analytics', label: 'Аналитика' },
  ];

  return (
    <div>
      {/* Underline tabs — match Finance / Catalog / Marketing visual language */}
      <div style={{
        display: 'flex', gap: 4, flexWrap: 'wrap',
        borderBottom: `1px solid ${C.border}`,
        marginBottom: 16,
      }}>
        {tabs.map((tdef) => {
          const isActive = tab === tdef.key;
          return (
            <button
              key={tdef.key}
              type="button"
              onClick={() => setTab(tdef.key)}
              style={{
                padding: '10px 16px',
                background: 'transparent', border: 'none',
                borderBottom: `2px solid ${isActive ? C.accent : 'transparent'}`,
                color: isActive ? C.text : C.textSecondary,
                fontSize: 14, fontWeight: isActive ? 600 : 500,
                cursor: 'pointer', marginBottom: -1,
                transition: 'all 150ms ease',
                whiteSpace: 'nowrap',
                display: 'inline-flex', alignItems: 'center', gap: 6,
                fontFamily: FONT,
              }}
            >
              {tdef.label}
              {typeof tdef.count === 'number' && tdef.count > 0 && (
                <span style={{
                  fontSize: 10, fontWeight: 600, padding: '1px 6px', borderRadius: 999,
                  background: isActive ? C.accentSoft : C.surfaceElevated,
                  color: isActive ? C.accent : C.textSecondary,
                }}>{tdef.count}</span>
              )}
            </button>
          );
        })}
      </div>

      {tab === 'profile' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <PersonalDataBlock client={client} C={C} />
          <NotesBlock client={client} clientId={clientId} onSaved={onSaved} C={C} />
        </div>
      )}

      {tab === 'history' && (
        <div>
          <HistoryBlock appointments={appointments} reviews={reviews} clientId={clientId} C={C} />
        </div>
      )}

      {tab === 'analytics' && (
        <div style={{ display: 'grid', gap: 12 }}>
          <ViolationsBlock client={client} C={C} />
          <AnalyticsBlock client={client} C={C} />
        </div>
      )}
    </div>
  );
}

/* ────────────────────── Hero helpers ────────────────────── */

function Stat({ label, value, C }: { label: string; value: string; C: PageTheme }) {
  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{ fontSize: 16, fontWeight: 650, color: C.text, lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>
        {value}
      </div>
      <div style={{ fontSize: 10, color: C.textTertiary, marginTop: 2, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        {label}
      </div>
    </div>
  );
}

function Divider({ C }: { C: PageTheme }) {
  return <div style={{ width: 1, height: 26, background: C.border }} />;
}

/* ────────────────────── Block frame ────────────────────── */

function BlockFrame({
  icon, title, accent, badge, children, C,
}: {
  icon: React.ReactNode;
  title: string;
  accent?: string;
  badge?: React.ReactNode;
  children: React.ReactNode;
  C: PageTheme;
}) {
  return (
    <section
      style={{
        background: C.surface,
        border: `1px solid ${C.border}`,
        borderRadius: 14,
        padding: 16,
        display: 'flex',
        flexDirection: 'column',
        minHeight: 0,
      }}
    >
      <header style={{
        display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12,
      }}>
        <span style={{ color: accent ?? C.accent, display: 'inline-flex' }}>{icon}</span>
        <h3 style={{ fontSize: 13, fontWeight: 650, color: C.text, margin: 0, letterSpacing: '-0.1px' }}>
          {title}
        </h3>
        {badge && <div style={{ marginLeft: 'auto' }}>{badge}</div>}
      </header>
      <div style={{ flex: 1, minHeight: 0 }}>{children}</div>
    </section>
  );
}

/* ────────────────────── Personal Data block (read-only) ────────────────────── */

function PersonalDataBlock({ client, C }: { client: ClientDetail; C: PageTheme }) {
  const t = useTranslations('clients');
  const dobLabel = client.date_of_birth
    ? new Date(client.date_of_birth).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })
    : '—';
  const isLinked = !!client.profile_id;

  const fieldLabel: React.CSSProperties = {
    fontSize: 11, fontWeight: 600, color: C.textTertiary,
    letterSpacing: '0.04em', textTransform: 'uppercase', margin: 0,
  };
  const fieldValue: React.CSSProperties = {
    fontSize: 13, color: C.text, margin: '3px 0 0', wordBreak: 'break-word',
  };

  const hasHealth = (client.allergies?.length ?? 0) > 0 || (client.contraindications?.length ?? 0) > 0;

  return (
    <BlockFrame
      icon={<UserIcon size={15} />}
      title="Личные данные"
      C={C}
      badge={
        isLinked ? (
          <span style={{
            fontSize: 10, fontWeight: 500, padding: '2px 8px',
            borderRadius: 999, background: C.accentSoft, color: C.accent,
          }}>
            Клиент управляет сам
          </span>
        ) : null
      }
    >
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div>
          <p style={fieldLabel}>{t('name')}</p>
          <p style={fieldValue}>{client.full_name || '—'}</p>
        </div>
        <div>
          <p style={fieldLabel}>{t('phone')}</p>
          <p style={fieldValue}>{client.phone ? formatPhone(client.phone) : '—'}</p>
        </div>
        <div>
          <p style={fieldLabel}>{t('email')}</p>
          <p style={fieldValue}>{client.email || '—'}</p>
        </div>
        <div>
          <p style={fieldLabel}>{t('dateOfBirth')}</p>
          <p style={fieldValue}>{dobLabel}</p>
        </div>
      </div>

      {/* Health summary inline */}
      <div style={{ marginTop: 14, paddingTop: 12, borderTop: `1px solid ${C.border}` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
          <Heart size={13} style={{ color: client.has_health_alert ? C.danger : C.textTertiary }} />
          <span style={{ fontSize: 11, fontWeight: 600, color: C.textTertiary, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
            Здоровье
          </span>
          {client.has_health_alert && (
            <span style={{
              fontSize: 10, fontWeight: 600, padding: '1px 6px',
              borderRadius: 999, background: 'rgba(239,68,68,0.12)', color: C.danger,
              marginLeft: 'auto',
            }}>
              Внимание
            </span>
          )}
        </div>
        {hasHealth ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {client.allergies?.length > 0 && (
              <div>
                <span style={{ fontSize: 11, color: C.textTertiary }}>Аллергии: </span>
                <span style={{ fontSize: 12, color: C.danger }}>{client.allergies.join(', ')}</span>
              </div>
            )}
            {client.contraindications?.length > 0 && (
              <div>
                <span style={{ fontSize: 11, color: C.textTertiary }}>Противопоказания: </span>
                <span style={{ fontSize: 12, color: C.text }}>{client.contraindications.join(', ')}</span>
              </div>
            )}
          </div>
        ) : (
          <p style={{ fontSize: 12, color: C.textTertiary, margin: 0 }}>
            Нет аллергий и противопоказаний.
          </p>
        )}
      </div>

      <p style={{
        marginTop: 12, paddingTop: 10, borderTop: `1px solid ${C.border}`,
        fontSize: 11, color: C.textTertiary, lineHeight: 1.5,
      }}>
        {isLinked
          ? 'Имя, телефон, e-mail и дата рождения — управляет клиент. Аллергии добавляются через чат снизу.'
          : 'Данные подтянутся, когда клиент войдёт через Telegram. Аллергии — добавляй через чат.'}
      </p>
    </BlockFrame>
  );
}

/* ────────────────────── Notes block (editable) ────────────────────── */

type NoteCategory = 'personal' | 'family' | 'preferences' | 'health' | 'other';

const NOTE_CATEGORIES: { key: NoteCategory; label: string; emoji: string }[] = [
  { key: 'family',      label: 'Семья',         emoji: '👨‍👩‍👧' },
  { key: 'preferences', label: 'Предпочтения',  emoji: '✨' },
  { key: 'personal',    label: 'Личное',        emoji: '🪄' },
  { key: 'health',      label: 'Здоровье',      emoji: '🩺' },
  { key: 'other',       label: 'Прочее',        emoji: '📎' },
];

interface NoteEntry {
  index: number;
  date: string | null;
  category: NoteCategory;
  body: string;
  pinned: boolean;
  raw: string;
}

/** Формат строки notes: `[<DD.MM.YYYY>|<category>|<flags?>] body`.
 *  flags может содержать `pin` — заметка закреплена. Старый формат
 *  `[<DD.MM.YYYY>] body` тоже поддерживается. */
function parseNotes(notes: string | null): NoteEntry[] {
  if (!notes) return [];
  return notes
    .split('\n')
    .map((line, index) => {
      const raw = line.trim();
      if (!raw) return null;
      const m = raw.match(/^\[([^\]]+)\]\s*(.*)$/);
      let date: string | null = null;
      let category: NoteCategory = 'other';
      let pinned = false;
      if (m) {
        const headParts = m[1]!.split('|').map((s) => s.trim());
        date = headParts[0] || null;
        for (let i = 1; i < headParts.length; i++) {
          const part = headParts[i];
          if (!part) continue;
          if (part === 'pin') pinned = true;
          else if (NOTE_CATEGORIES.some((c) => c.key === part)) {
            category = part as NoteCategory;
          }
        }
      }
      return {
        index,
        date,
        category,
        body: m ? m[2]! : raw,
        pinned,
        raw,
      };
    })
    .filter((x): x is NoteEntry => x !== null);
}

/** Перестраивает префикс `[date|category|pin]` обратно в строку. */
function buildNoteLine(entry: { date: string | null; category: NoteCategory; pinned: boolean; body: string }): string {
  const parts: string[] = [];
  if (entry.date) parts.push(entry.date);
  if (entry.category && entry.category !== 'other') parts.push(entry.category);
  if (entry.pinned) parts.push('pin');
  const head = parts.length ? `[${parts.join('|')}] ` : '';
  return `${head}${entry.body.trim()}`;
}

function NotesBlock({
  client, clientId, onSaved, C,
}: {
  client: ClientDetail;
  clientId: string;
  onSaved: () => void;
  C: PageTheme;
}) {
  const entries = parseNotes(client.notes);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [draft, setDraft] = useState('');
  const [adding, setAdding] = useState(false);
  const [newDraft, setNewDraft] = useState('');
  const [busy, setBusy] = useState(false);

  async function persist(nextLines: string[]) {
    setBusy(true);
    const next = nextLines.map((l) => l.trim()).filter(Boolean).join('\n');
    const supabase = createClient();
    const { error } = await supabase
      .from('clients')
      .update({ notes: next.length ? next : null })
      .eq('id', clientId);
    setBusy(false);
    if (error) {
      toast.error(humanizeError(error));
      return false;
    }
    onSaved();
    return true;
  }

  async function startEdit(entry: NoteEntry) {
    setEditingIndex(entry.index);
    setDraft(entry.body);
  }

  async function saveEdit() {
    if (editingIndex === null) return;
    const lines = (client.notes ?? '').split('\n');
    const orig = lines[editingIndex] ?? '';
    const m = orig.match(/^\s*\[[^\]]+\]\s*/);
    const prefix = m ? m[0] : '';
    lines[editingIndex] = `${prefix}${draft.trim()}`;
    const ok = await persist(lines);
    if (ok) {
      toast.success('Сохранено');
      setEditingIndex(null);
      setDraft('');
    }
  }

  async function deleteEntry(entry: NoteEntry) {
    const lines = (client.notes ?? '').split('\n');
    lines.splice(entry.index, 1);
    const ok = await persist(lines);
    if (ok) toast.success('Удалено');
  }

  async function togglePin(entry: NoteEntry) {
    const lines = (client.notes ?? '').split('\n');
    lines[entry.index] = buildNoteLine({
      date: entry.date,
      category: entry.category,
      pinned: !entry.pinned,
      body: entry.body,
    });
    const ok = await persist(lines);
    if (ok) toast.success(entry.pinned ? 'Откреплено' : 'Закреплено');
  }

  async function addNew() {
    const value = newDraft.trim();
    if (!value) return;
    const stamp = new Date().toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' });
    const block = `[${stamp}] ${value}`;
    const lines = [...(client.notes ?? '').split('\n'), block];
    const ok = await persist(lines);
    if (ok) {
      toast.success('Добавлено');
      setAdding(false);
      setNewDraft('');
    }
  }

  return (
    <BlockFrame
      icon={<FileText size={15} />}
      title="Заметки мастера"
      C={C}
      badge={
        !adding && editingIndex === null ? (
          <button
            onClick={() => setAdding(true)}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 4,
              padding: '4px 10px', borderRadius: 8, border: 'none',
              background: C.accentSoft, color: C.accent,
              fontSize: 11, fontWeight: 600, cursor: 'pointer',
            }}
          >
            <Plus size={12} />
            Добавить
          </button>
        ) : null
      }
    >
      {/* Add new */}
      {adding && (
        <div style={{
          marginBottom: 10, padding: 10, borderRadius: 10,
          background: C.surfaceElevated, border: `1px solid ${C.border}`,
        }}>
          <textarea
            value={newDraft}
            onChange={(e) => setNewDraft(e.target.value)}
            placeholder="Например: «Любит зелёный чай, не пьёт кофе»"
            rows={2}
            autoFocus
            style={{
              width: '100%', padding: '8px 10px', borderRadius: 8,
              border: `1px solid ${C.border}`, background: C.surface,
              color: C.text, fontSize: 13, fontFamily: 'inherit', resize: 'vertical',
              outline: 'none', boxSizing: 'border-box',
            }}
          />
          <div style={{ display: 'flex', gap: 6, marginTop: 8, justifyContent: 'flex-end' }}>
            <button
              onClick={() => { setAdding(false); setNewDraft(''); }}
              style={{
                padding: '6px 10px', borderRadius: 8, border: `1px solid ${C.border}`,
                background: 'transparent', color: C.textSecondary, fontSize: 12, cursor: 'pointer',
              }}
            >
              Отмена
            </button>
            <button
              onClick={addNew}
              disabled={busy || !newDraft.trim()}
              style={{
                padding: '6px 12px', borderRadius: 8, border: 'none',
                background: C.accent, color: '#fff', fontSize: 12, fontWeight: 600,
                cursor: busy || !newDraft.trim() ? 'not-allowed' : 'pointer',
                opacity: busy || !newDraft.trim() ? 0.5 : 1,
              }}
            >
              Сохранить
            </button>
          </div>
        </div>
      )}

      {/* List: closed-pinned (top) + grouped by category */}
      {entries.length === 0 && !adding ? (
        <p style={{ fontSize: 12, color: C.textTertiary, margin: 0, lineHeight: 1.5 }}>
          Пусто. Нажми «AI заметка» сверху над карточкой — AI разнесёт по категориям.
        </p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, maxHeight: 420, overflowY: 'auto', paddingRight: 4 }}>
          {(() => {
            const pinned = entries.filter((e) => e.pinned);
            const unpinnedGroups = NOTE_CATEGORIES
              .map((cat) => ({ ...cat, items: entries.filter((e) => !e.pinned && e.category === cat.key) }))
              .filter((g) => g.items.length > 0);

            const renderEntry = (entry: NoteEntry) => {
              const isEditing = editingIndex === entry.index;
              return (
                <div
                  key={entry.index}
                  style={{
                    padding: '8px 10px', borderRadius: 8,
                    background: entry.pinned ? C.accentSoft : C.surfaceElevated,
                    border: `1px solid ${entry.pinned ? C.accent : C.border}`,
                    display: 'flex', flexDirection: 'column', gap: 4,
                  }}
                >
                  {isEditing ? (
                    <>
                      <textarea
                        value={draft}
                        onChange={(e) => setDraft(e.target.value)}
                        rows={2}
                        autoFocus
                        style={{
                          width: '100%', padding: 8, borderRadius: 6,
                          border: `1px solid ${C.border}`, background: C.surface,
                          color: C.text, fontSize: 13, fontFamily: 'inherit', resize: 'vertical',
                          outline: 'none', boxSizing: 'border-box',
                        }}
                      />
                      <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
                        <button
                          onClick={() => { setEditingIndex(null); setDraft(''); }}
                          title="Отмена"
                          style={{
                            padding: '4px 8px', borderRadius: 6, border: 'none',
                            background: 'transparent', color: C.textSecondary, cursor: 'pointer',
                            display: 'inline-flex', alignItems: 'center',
                          }}
                        >
                          <X size={13} />
                        </button>
                        <button
                          onClick={saveEdit}
                          disabled={busy || !draft.trim()}
                          title="Сохранить"
                          style={{
                            padding: '4px 8px', borderRadius: 6, border: 'none',
                            background: C.accent, color: '#fff', cursor: 'pointer',
                            display: 'inline-flex', alignItems: 'center',
                            opacity: busy || !draft.trim() ? 0.5 : 1,
                          }}
                        >
                          <Check size={13} />
                        </button>
                      </div>
                    </>
                  ) : (
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        {entry.date && (
                          <div style={{
                            fontSize: 10, color: C.textTertiary, marginBottom: 2,
                            letterSpacing: '0.04em',
                          }}>
                            {entry.date}
                          </div>
                        )}
                        <div style={{ fontSize: 13, color: C.text, lineHeight: 1.45, wordBreak: 'break-word' }}>
                          {entry.body}
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: 2, flexShrink: 0, opacity: 0.85 }}>
                        <button
                          onClick={() => togglePin(entry)}
                          title={entry.pinned ? 'Открепить' : 'Закрепить'}
                          style={{
                            padding: 4, borderRadius: 6, border: 'none',
                            background: 'transparent',
                            color: entry.pinned ? C.accent : C.textSecondary,
                            cursor: 'pointer', display: 'inline-flex',
                          }}
                        >
                          {entry.pinned ? <PinOff size={12} /> : <Pin size={12} />}
                        </button>
                        <button
                          onClick={() => startEdit(entry)}
                          title="Редактировать"
                          style={{
                            padding: 4, borderRadius: 6, border: 'none',
                            background: 'transparent', color: C.textSecondary, cursor: 'pointer',
                            display: 'inline-flex',
                          }}
                        >
                          <Pencil size={12} />
                        </button>
                        <button
                          onClick={() => deleteEntry(entry)}
                          title="Удалить"
                          style={{
                            padding: 4, borderRadius: 6, border: 'none',
                            background: 'transparent', color: C.danger, cursor: 'pointer',
                            display: 'inline-flex',
                          }}
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            };

            return (
              <>
                {pinned.length > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <div style={{
                      fontSize: 10, fontWeight: 700, letterSpacing: '0.06em',
                      textTransform: 'uppercase', color: C.accent,
                      display: 'inline-flex', alignItems: 'center', gap: 5,
                      padding: '2px 0',
                    }}>
                      <Pin size={11} />
                      Закреплённые
                      <span style={{ color: C.textTertiary, fontWeight: 500 }}>· {pinned.length}</span>
                    </div>
                    {pinned.map(renderEntry)}
                  </div>
                )}
                {unpinnedGroups.map((group) => (
                  <div key={group.key} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <div style={{
                      fontSize: 10, fontWeight: 700, letterSpacing: '0.06em',
                      textTransform: 'uppercase', color: C.textTertiary,
                      display: 'inline-flex', alignItems: 'center', gap: 5,
                      padding: '2px 0',
                    }}>
                      <span style={{ fontSize: 12 }}>{group.emoji}</span>
                      {group.label}
                      <span style={{ color: C.textTertiary, fontWeight: 500 }}>· {group.items.length}</span>
                    </div>
                    {group.items.map(renderEntry)}
                  </div>
                ))}
              </>
            );
          })()}
        </div>
      )}
    </BlockFrame>
  );
}

/* ────────────────────── History block ────────────────────── */

function HistoryBlock({
  appointments, reviews, clientId, C,
}: {
  appointments: AppointmentRow[];
  reviews: ReviewRow[];
  clientId: string;
  C: PageTheme;
}) {
  const tc = useTranslations('calendar');
  const router = useRouter();
  const recent = appointments.slice(0, 8);

  return (
    <BlockFrame
      icon={<CalendarIcon size={15} />}
      title="История посещений"
      C={C}
      badge={
        reviews.length > 0 ? (
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 4,
            padding: '2px 8px', borderRadius: 999,
            background: 'rgba(245,158,11,0.10)', color: C.warning,
            fontSize: 11, fontWeight: 600,
          }}>
            <Star size={11} />
            {reviews.length}
          </span>
        ) : null
      }
    >
      {recent.length === 0 ? (
        <p style={{ fontSize: 12, color: C.textTertiary, margin: 0 }}>
          Записей пока нет.
        </p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 280, overflowY: 'auto', paddingRight: 4 }}>
          {recent.map((a) => (
            <div
              key={a.id}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '8px 10px', borderRadius: 8,
                background: C.surfaceElevated, border: `1px solid ${C.border}`,
              }}
            >
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 510, color: C.text, marginBottom: 2 }}>
                  {a.service?.name ?? '—'}
                </div>
                <div style={{ fontSize: 11, color: C.textSecondary }}>
                  {new Date(a.starts_at).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' })}{' '}
                  {new Date(a.starts_at).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })}
                  {' · '}{tc(`status.${a.status}`)}
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                {a.service && (
                  <span style={{ fontSize: 12, fontWeight: 600, color: C.text, fontVariantNumeric: 'tabular-nums' }}>
                    {a.service.price} {CURRENCY}
                  </span>
                )}
                {a.service && (
                  <button
                    onClick={() => router.push(`/calendar?repeat=${a.id}&client=${clientId}&service=${a.service!.id}&duration=${a.service!.duration_minutes}`)}
                    title="Повторить"
                    style={{
                      padding: 4, borderRadius: 6, border: 'none',
                      background: 'transparent', color: C.textSecondary, cursor: 'pointer',
                      display: 'inline-flex',
                    }}
                  >
                    <RefreshCw size={12} />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </BlockFrame>
  );
}

/* ────────────────────── Analytics block ────────────────────── */

function AnalyticsBlock({ client, C }: { client: ClientDetail; C: PageTheme }) {
  const totalSpent = client.avg_check * client.total_visits;
  return (
    <BlockFrame icon={<BarChart3 size={15} />} title="Аналитика" C={C}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <Tile label="Визитов" value={client.total_visits} accent="violet" C={C} />
        <Tile label="Потрачено" value={`${totalSpent.toLocaleString()} ${CURRENCY}`} accent="violet" C={C} />
        <Tile label="Средний чек" value={`${Math.round(client.avg_check).toLocaleString()} ${CURRENCY}`} accent="violet" C={C} />
        <Tile
          label="Рейтинг"
          value={client.rating > 0 ? client.rating.toFixed(1) : '—'}
          accent="violet"
          C={C}
        />
      </div>
    </BlockFrame>
  );
}

/* ────────────────────── Violations block ────────────────────── */
/* История нарушений — отдельный заметный блок над «Аналитикой».
   Источник данных:
   - no_show_count: auto-tracked триггером trg_sync_no_show_count
     при appointments.status='no_show'.
   - cancellation_count: общий счётчик отмен клиентом.
   - late_cancellation_count / master_cancellation_count: пока optional
     (без отдельных триггеров) — показываем только если бэкенд их выдаёт. */

function ViolationsBlock({ client, C }: { client: ClientDetail; C: PageTheme }) {
  const noShow = client.no_show_count ?? 0;
  const cancellations = client.cancellation_count ?? 0;
  const lateCancellations = client.late_cancellation_count ?? 0;
  const masterCancellations = client.master_cancellation_count ?? 0;
  const total = noShow + cancellations;

  if (total === 0) {
    return (
      <BlockFrame icon={<AlertTriangle size={15} />} title="История нарушений" C={C}>
        <p style={{ fontSize: 13, color: C.success ?? '#10b981', margin: 0 }}>
          Нарушений нет — клиент надёжный.
        </p>
      </BlockFrame>
    );
  }

  return (
    <BlockFrame icon={<AlertTriangle size={15} />} title="История нарушений" C={C}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <Tile
          label="Не пришёл"
          value={noShow}
          accent={noShow > 0 ? 'rose' : 'muted'}
          hint="Клиент не явился на запись"
          C={C}
        />
        <Tile
          label="Всего отмен"
          value={cancellations}
          accent={cancellations > 0 ? 'amber' : 'muted'}
          hint="Отмены клиентом (учитываются для блокировок)"
          C={C}
        />
      </div>
      {(lateCancellations > 0 || masterCancellations > 0) && (
        <div
          style={{
            marginTop: 10, paddingTop: 10, borderTop: `1px solid ${C.border}`,
            display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8,
          }}
        >
          {lateCancellations > 0 && (
            <Tile
              label="Поздних отмен"
              value={lateCancellations}
              accent="amber"
              hint="Отмена клиентом позже разрешённого срока"
              C={C}
            />
          )}
          {masterCancellations > 0 && (
            <Tile
              label="Отменил мастер"
              value={masterCancellations}
              accent="muted"
              hint="Не учитывается против клиента"
              C={C}
            />
          )}
        </div>
      )}
    </BlockFrame>
  );
}

function Tile({
  label, value, accent, hint, C,
}: {
  label: string;
  value: number | string;
  accent: 'violet' | 'rose' | 'amber' | 'muted';
  hint?: string;
  C: PageTheme;
}) {
  const map: Record<typeof accent, { bg: string; fg: string }> = {
    violet: { bg: C.accentSoft, fg: C.accent },
    rose: { bg: 'rgba(239,68,68,0.10)', fg: C.danger },
    amber: { bg: 'rgba(245,158,11,0.10)', fg: C.warning },
    muted: { bg: C.surfaceElevated, fg: C.textSecondary },
  };
  const acc = map[accent];
  return (
    <div
      title={hint}
      style={{
        padding: '8px 10px', borderRadius: 10,
        background: acc.bg, border: `1px solid ${C.border}`,
      }}
    >
      <div style={{ fontSize: 16, fontWeight: 650, color: acc.fg, lineHeight: 1.1, fontVariantNumeric: 'tabular-nums', wordBreak: 'break-word' }}>
        {value}
      </div>
      <div style={{ marginTop: 4, fontSize: 11, color: C.textSecondary, letterSpacing: '0.02em' }}>
        {label}
      </div>
    </div>
  );
}

/* ────────────────────── AI Chat (bottom, full-width) ────────────────────── */

/** Плавающий AI-помощник в карточке клиента.
 *  collapsed: компактная пилюля «✨ AI заметка» по центру.
 *  expanded:  одна строка ввода с placeholder и иконкой отправки.
 *  Enter — отправить, поле остаётся открытым (мастер пишет несколько коротких заметок подряд).
 *  Click outside / Escape — закрыть.
 *  AI разносит каждый факт в свою категорию (см. /api/clients/[id]/parse-note). */
function ClientAiChat({
  clientId, onApplied, C,
}: {
  clientId: string;
  onApplied: () => void;
  C: PageTheme;
}) {
  const [expanded, setExpanded] = useState(false);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const send = useCallback(async () => {
    const value = text.trim();
    if (!value || busy) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/clients/${clientId}/parse-note`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: value }),
      });
      const data = await res.json().catch(() => ({} as Record<string, unknown>));
      if (!res.ok) {
        toast.error((data as { error?: string }).error || 'AI не смог обработать');
        return;
      }
      const d = data as { applied: boolean; summary?: string };
      if (d.applied) {
        setText('');
        toast.success(d.summary || 'Сохранено');
        onApplied();
        // оставляем поле открытым — мастер пишет следующую заметку
        setTimeout(() => inputRef.current?.focus(), 50);
      } else {
        toast(d.summary || 'Ничего не сохранено', { icon: '⚠️' });
      }
    } catch (e) {
      toast.error((e as Error).message || 'Ошибка');
    } finally {
      setBusy(false);
    }
  }, [text, busy, clientId, onApplied]);

  // Click outside → collapse (но не закрываем если есть несохранённый текст с busy=false)
  useEffect(() => {
    if (!expanded) return;
    function onPointer(e: MouseEvent) {
      if (!wrapRef.current) return;
      if (wrapRef.current.contains(e.target as Node)) return;
      // Если мастер начал печатать, не сбрасываем мгновенно — сохраняем что есть.
      // Иначе — просто схлопываем.
      if (text.trim()) {
        setExpanded(false);
        // не очищаем text, чтобы при повторном открытии он продолжил
      } else {
        setExpanded(false);
      }
    }
    document.addEventListener('mousedown', onPointer);
    return () => document.removeEventListener('mousedown', onPointer);
  }, [expanded, text]);

  // Escape → close
  useEffect(() => {
    if (!expanded) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault();
        setExpanded(false);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [expanded]);

  function open() {
    setExpanded(true);
    setTimeout(() => inputRef.current?.focus(), 50);
  }

  return (
    <div
      ref={wrapRef}
      style={{
        display: 'flex', justifyContent: 'center',
        margin: '4px 0 16px',
        position: 'relative',
      }}
    >
      {!expanded ? (
        <button
          type="button"
          onClick={open}
          title="Записать заметку через AI — он разнесёт по категориям"
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            padding: '8px 16px', borderRadius: 999,
            background: C.accentSoft, border: `1px solid ${C.accent}33`,
            color: C.accent, fontSize: 13, fontWeight: 600, cursor: 'pointer',
            fontFamily: FONT, transition: 'transform 120ms ease',
          }}
          onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-1px)'}
          onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}
        >
          <Bot size={14} />
          AI заметка
        </button>
      ) : (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          width: '100%', maxWidth: 600,
          padding: '6px 8px 6px 16px', borderRadius: 999,
          background: C.surface, border: `1px solid ${C.accent}`,
          boxShadow: `0 0 0 4px ${C.accent}15`,
        }}>
          <Bot size={14} style={{ color: C.accent, flexShrink: 0 }} />
          <input
            ref={inputRef}
            type="text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
            placeholder="Аллергия на латекс. Любит зелёный чай. Сын Артём…"
            disabled={busy}
            style={{
              flex: 1, border: 'none', outline: 'none', background: 'transparent',
              color: C.text, fontSize: 14, fontFamily: FONT,
            }}
          />
          <button
            type="button"
            onClick={send}
            disabled={busy || text.trim().length < 2}
            title="Отправить (Enter)"
            style={{
              width: 36, height: 36, borderRadius: 999,
              border: 'none', background: C.accent, color: '#fff',
              cursor: busy || text.trim().length < 2 ? 'not-allowed' : 'pointer',
              opacity: busy || text.trim().length < 2 ? 0.5 : 1,
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            {busy ? '…' : <Send size={14} />}
          </button>
        </div>
      )}
    </div>
  );
}

/* ────────────────────── Manual Tier Picker ────────────────────── */
/* Кликабельный chip в хедере, показывающий текущий tier (Новый / Постоянный / VIP).
   Левый клик — циклом меняет вручную (manual_tier override). Длительный клик /
   правый — сбрасывает на авто (manual_tier = null). Если tier выставлен вручную
   — chip получает рамку acent-цвета, чтобы мастер видел: «здесь не автомат». */

const TIER_LABELS: Record<'new' | 'regular' | 'vip', string> = {
  new: 'Новый',
  regular: 'Постоянный',
  vip: 'VIP',
};
const TIER_CYCLE: ('new' | 'regular' | 'vip')[] = ['new', 'regular', 'vip'];

function ManualTierPicker({
  clientId, effectiveTier, isManual, onSaved, C,
}: {
  clientId: string;
  effectiveTier: 'new' | 'regular' | 'vip';
  isManual: boolean;
  onSaved: () => void;
  C: PageTheme;
}) {
  const [busy, setBusy] = useState(false);

  async function setManual(next: 'new' | 'regular' | 'vip' | null) {
    setBusy(true);
    const supabase = createClient();
    const { error } = await supabase.from('clients').update({
      manual_tier: next,
      manual_tier_set_at: next ? new Date().toISOString() : null,
    }).eq('id', clientId);
    setBusy(false);
    if (error) { toast.error(humanizeError(error)); return; }
    toast.success(next ? `Tier: ${TIER_LABELS[next]}` : 'Авто-tier');
    onSaved();
  }

  function nextTier() {
    const idx = TIER_CYCLE.indexOf(effectiveTier);
    return TIER_CYCLE[(idx + 1) % TIER_CYCLE.length]!;
  }

  const isVip = effectiveTier === 'vip';
  const isRegular = effectiveTier === 'regular';

  return (
    <button
      type="button"
      disabled={busy}
      onClick={() => setManual(nextTier())}
      onContextMenu={(e) => { e.preventDefault(); setManual(null); }}
      title={`Кликни — следующий tier (${TIER_LABELS[nextTier()]}). Правый клик — сбросить в авто.${isManual ? '\nСейчас: ручной override.' : '\nСейчас: автоматически по визитам.'}`}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 4,
        padding: '2px 8px', borderRadius: 5, border: 'none', cursor: 'pointer',
        background: isVip ? C.accent : isRegular ? C.accentSoft : C.surfaceElevated,
        color: isVip ? '#fff' : isRegular ? C.accent : C.textSecondary,
        fontSize: 10, fontWeight: 650, letterSpacing: '0.04em',
        outline: isManual ? `1.5px dashed ${C.accent}` : 'none',
        outlineOffset: 1,
        opacity: busy ? 0.6 : 1,
      }}
    >
      {isVip ? <Star size={10} fill="currentColor" stroke="currentColor" /> : null}
      {TIER_LABELS[effectiveTier]}
    </button>
  );
}

/* ────────────────────── Header Blacklist Button ────────────────────── */
/* Иконка-кнопка ⛔ в хедере карточки клиента. На наведении — tooltip
   «Добавить в чёрный список». При клике открывается inline-popup с textarea
   для причины (обязательно) + confirm. */

function HeaderBlacklistButton({ clientId, onDone, C }: { clientId: string; onDone: () => void; C: PageTheme }) {
  const t = useTranslations('clients');
  const tc = useTranslations('common');
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);

  async function confirmBlacklist() {
    if (!reason.trim()) return;
    setSaving(true);
    const supabase = createClient();
    const { error } = await supabase.from('clients').update({
      is_blacklisted: true,
      blacklist_reason: reason.trim(),
    }).eq('id', clientId);
    setSaving(false);
    if (error) { toast.error(humanizeError(error)); return; }
    toast.success(tc('success'));
    setOpen(false);
    setReason('');
    onDone();
  }

  return (
    <div style={{ position: 'relative' }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        title={t('addToBlacklist') || 'Добавить в чёрный список'}
        aria-label={t('addToBlacklist') || 'Добавить в чёрный список'}
        style={{
          width: 36, height: 36, borderRadius: 10,
          border: `1px solid ${C.border}`,
          background: open ? C.dangerSoft : 'transparent',
          color: C.danger,
          cursor: 'pointer',
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        <ShieldAlert size={16} />
      </button>

      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 8px)', right: 0,
          width: 320, padding: 12, borderRadius: 12,
          background: C.surface, border: `1px solid ${C.border}`,
          boxShadow: '0 8px 32px rgba(0,0,0,0.18)',
          display: 'flex', flexDirection: 'column', gap: 8,
          zIndex: 50,
        }}>
          <Label style={{ fontSize: 12, color: C.textSecondary }}>
            {t('blacklistReason') || 'Причина (обязательно)'}
          </Label>
          <Textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder={t('blacklistReasonPlaceholder') || 'Например: грубое поведение / no-show 3 раза подряд'}
            rows={3}
            autoFocus
          />
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <Button variant="ghost" size="sm" onClick={() => { setOpen(false); setReason(''); }}>
              {tc('cancel') || 'Отмена'}
            </Button>
            <Button variant="destructive" size="sm" onClick={confirmBlacklist} disabled={saving || !reason.trim()}>
              {saving ? '…' : (t('addToBlacklist') || 'В чёрный список')}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────
   HeaderUnblacklistButton — иконка «снять с чёрного списка». Показывается
   когда client.is_blacklisted=true. Popover с показом причины блокировки
   + кнопкой подтверждения. UPDATE clients SET is_blacklisted=false,
   blacklist_reason=NULL.
   ───────────────────────────────────────────────────────────────────── */

function HeaderUnblacklistButton({ clientId, reason, onDone, C }: { clientId: string; reason: string | null; onDone: () => void; C: PageTheme }) {
  const t = useTranslations('clients');
  const tc = useTranslations('common');
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  async function confirmUnblacklist() {
    setSaving(true);
    const supabase = createClient();
    const { error } = await supabase.from('clients').update({
      is_blacklisted: false,
      blacklist_reason: null,
    }).eq('id', clientId);
    setSaving(false);
    if (error) { toast.error(humanizeError(error)); return; }
    toast.success(tc('success'));
    setOpen(false);
    onDone();
  }

  const successColor = '#16a34a';
  const successSoft = 'rgba(22, 163, 74, 0.12)';

  return (
    <div style={{ position: 'relative' }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        title={t('removeFromBlacklist') || 'Снять с чёрного списка'}
        aria-label={t('removeFromBlacklist') || 'Снять с чёрного списка'}
        style={{
          width: 36, height: 36, borderRadius: 10,
          border: `1px solid ${C.border}`,
          background: open ? successSoft : 'transparent',
          color: successColor,
          cursor: 'pointer',
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        <ShieldCheck size={16} />
      </button>

      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 8px)', right: 0,
          width: 320, padding: 12, borderRadius: 12,
          background: C.surface, border: `1px solid ${C.border}`,
          boxShadow: '0 8px 32px rgba(0,0,0,0.18)',
          display: 'flex', flexDirection: 'column', gap: 8,
          zIndex: 50,
        }}>
          <div style={{ fontSize: 12, color: C.textSecondary }}>
            {t('blacklistReason') || 'Причина блокировки'}
          </div>
          <div style={{
            fontSize: 13, color: C.text,
            padding: 8, borderRadius: 8,
            background: C.dangerSoft,
            border: `1px solid ${C.border}`,
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
          }}>
            {reason && reason.trim() ? reason : (t('noReason') || '—')}
          </div>
          <div style={{ fontSize: 12, color: C.textSecondary, marginTop: 4 }}>
            {t('removeFromBlacklistConfirm') || 'Снять блокировку? Клиент снова сможет записываться.'}
          </div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>
              {tc('cancel') || 'Отмена'}
            </Button>
            <Button
              size="sm"
              onClick={confirmUnblacklist}
              disabled={saving}
              style={{ background: successColor, color: '#fff', border: 'none' }}
            >
              {saving ? '…' : (t('removeFromBlacklist') || 'Разблокировать')}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
