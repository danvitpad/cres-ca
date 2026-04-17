/** --- YAML
 * name: Client Detail Page
 * description: Full client card with tabs — Info, History, Notes, Health, Files, Family, Analytics. Includes voice note recording, manual blacklist, dynamic anamnesis per vertical, CLV analytics.
 * created: 2026-04-12
 * updated: 2026-04-17
 * --- */

'use client';

import { useState, useEffect, useRef, useCallback, use } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';
import { useSubscription } from '@/hooks/use-subscription';
import { useFeatures } from '@/hooks/use-features';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { TagInput } from '@/components/shared/tag-input';
import { BehaviorIndicators } from '@/components/shared/behavior-indicators';
import { FileUpload } from '@/components/client-card/file-upload';
import { ClientDebtBanner } from '@/components/finance/client-debt-banner';
import { useMaster } from '@/hooks/use-master';
import { useLocale } from 'next-intl';
import { ImageComparisonSlider } from '@/components/ui/image-comparison-slider';
import { getIntakeFields } from '@/lib/verticals/intake-fields';
import { motion } from 'framer-motion';
import { differenceInYears, differenceInDays, setYear, getYear, startOfDay } from 'date-fns';
import {
  ArrowLeft, RefreshCw, AlertTriangle, ShieldAlert,
  Mic, Square, Users, BarChart3, Bell,
  Phone, Mail, Cake, Calendar as CalendarIcon, FileText,
  Heart, Sparkles, Camera,
} from 'lucide-react';
import {
  FONT, FONT_FEATURES, CURRENCY, KPI_GRADIENTS,
  usePageTheme, pageContainer, cardStyle, headingStyle, labelStyle,
  type PageTheme,
} from '@/lib/dashboard-theme';
import type { BehaviorIndicator, AppointmentStatus } from '@/types';

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
}

interface ClientIntake {
  allergies: string | null;
  chronic_conditions: string | null;
  medications: string | null;
  pregnancy: boolean | null;
  contraindications: string | null;
  updated_at: string | null;
}

interface AppointmentRow {
  id: string;
  starts_at: string;
  ends_at: string;
  status: AppointmentStatus;
  service: { id: string; name: string; duration_minutes: number; price: number } | null;
}

interface FamilyMember {
  id: string;
  member_name: string;
  relationship: string;
  linked_profile_id: string | null;
}

/* ────────────────────── Main Page ────────────────────── */

export default function ClientDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const t = useTranslations('clients');
  const tc = useTranslations('common');
  const router = useRouter();
  const locale = useLocale();
  const { master } = useMaster();
  const features = useFeatures();
  const { C } = usePageTheme();
  const [client, setClient] = useState<ClientDetail | null>(null);
  const [intake, setIntake] = useState<ClientIntake | null>(null);
  const [blacklist, setBlacklist] = useState<{ warning: boolean; total: number } | null>(null);
  const [appointments, setAppointments] = useState<AppointmentRow[]>([]);
  const [familyMembers, setFamilyMembers] = useState<FamilyMember[]>([]);
  const [loading, setLoading] = useState(true);

  const loadClient = useCallback(async () => {
    const supabase = createClient();
    const { data } = await supabase.from('clients').select('*').eq('id', id).single();
    if (data) {
      const c = data as unknown as ClientDetail;
      setClient(c);
      if (c.profile_id) {
        const { data: intakeRow } = await supabase
          .from('client_health_profiles')
          .select('allergies, chronic_conditions, medications, pregnancy, contraindications, updated_at')
          .eq('profile_id', c.profile_id)
          .maybeSingle();
        setIntake((intakeRow as ClientIntake) ?? null);

        // Load family members
        const { data: fam } = await supabase
          .from('family_links')
          .select('id, member_name, relationship, linked_profile_id')
          .eq('parent_profile_id', c.profile_id)
          .order('created_at');
        setFamilyMembers((fam as FamilyMember[]) ?? []);

        try {
          const res = await fetch('/api/blacklist/check', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ profile_id: c.profile_id }),
          });
          if (res.ok) setBlacklist(await res.json());
        } catch {
          // ignore
        }
      } else {
        setIntake(null);
        setBlacklist(null);
        setFamilyMembers([]);
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

  useEffect(() => {
    loadClient(); // eslint-disable-line react-hooks/set-state-in-effect
    loadAppointments();
  }, [loadClient, loadAppointments]);

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

  const vertical = master?.vertical ?? null;

  // ─── Derived client data ───
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
  const completedAppts = appointments.filter(a => a.status === 'completed');
  const avatarGrad = (() => {
    let hash = 0;
    for (let i = 0; i < client.full_name.length; i++) hash = client.full_name.charCodeAt(i) + ((hash << 5) - hash);
    const grads = [
      'linear-gradient(135deg, #7c3aed 0%, #a78bfa 100%)',
      'linear-gradient(135deg, #ec4899 0%, #f472b6 100%)',
      'linear-gradient(135deg, #06b6d4 0%, #67e8f9 100%)',
      'linear-gradient(135deg, #10b981 0%, #34d399 100%)',
      'linear-gradient(135deg, #f59e0b 0%, #fbbf24 100%)',
      'linear-gradient(135deg, #6366f1 0%, #818cf8 100%)',
    ];
    return grads[Math.abs(hash) % grads.length];
  })();
  const initials = client.full_name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase() || '?';

  const sectionStyle: React.CSSProperties = {
    background: C.surface,
    border: `1px solid ${C.border}`,
    borderRadius: 16,
    padding: 24,
    marginBottom: 16,
  };

  const sectionTitle: React.CSSProperties = {
    fontSize: 15, fontWeight: 650, color: C.text,
    margin: '0 0 16px', display: 'flex', alignItems: 'center', gap: 8,
  };

  return (
    <div style={{ ...pageContainer, background: C.bg, color: C.text, minHeight: '100%', paddingBottom: 48 }}>
      {/* ═══ Back button ═══ */}
      <button
        onClick={() => router.back()}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          padding: '6px 12px', borderRadius: 8, border: 'none',
          background: 'transparent', color: C.textSecondary,
          cursor: 'pointer', fontSize: 13, fontWeight: 550,
          fontFamily: FONT, fontFeatureSettings: FONT_FEATURES,
          marginBottom: 16,
        }}
      >
        <ArrowLeft size={14} />
        {tc('back') || 'Клиенты'}
      </button>

      {/* ═══ Hero card ═══ */}
      <motion.div
        initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}
        style={{
          ...sectionStyle,
          padding: 28,
          background: C.surface,
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 20, flexWrap: 'wrap' }}>
          {/* Avatar */}
          <div style={{
            width: 80, height: 80, borderRadius: '50%',
            background: avatarGrad, color: '#fff',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 30, fontWeight: 600, flexShrink: 0,
            boxShadow: '0 8px 24px rgba(124,58,237,0.25)',
          }}>
            {initials}
          </div>

          {/* Name + info */}
          <div style={{ flex: 1, minWidth: 240 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 6 }}>
              <h1 style={{ fontSize: 24, fontWeight: 650, color: C.text, margin: 0, letterSpacing: '-0.4px' }}>
                {client.full_name}
              </h1>
              {client.has_health_alert && (
                <AlertTriangle size={18} style={{ color: C.danger }} />
              )}
              {client.tier === 'vip' && (
                <span style={{
                  display: 'inline-flex', alignItems: 'center', gap: 4,
                  background: KPI_GRADIENTS.revenue, color: '#fff',
                  padding: '3px 10px', borderRadius: 8, fontSize: 11, fontWeight: 650, letterSpacing: '0.04em',
                }}>
                  ⭐ VIP
                </span>
              )}
              {client.is_blacklisted && (
                <Badge variant="destructive">{t('manuallyBlacklisted')}</Badge>
              )}
              <BehaviorIndicators indicators={client.behavior_indicators} />
            </div>

            <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', fontSize: 13, color: C.textSecondary }}>
              {age !== null && (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                  <Cake size={13} style={{ color: C.textTertiary }} />
                  {age} лет
                </span>
              )}
              {client.phone && (
                <a href={`tel:${client.phone}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: C.textSecondary, textDecoration: 'none' }}>
                  <Phone size={13} style={{ color: C.textTertiary }} />
                  {client.phone}
                </a>
              )}
              {client.email && (
                <a href={`mailto:${client.email}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: C.textSecondary, textDecoration: 'none' }}>
                  <Mail size={13} style={{ color: C.textTertiary }} />
                  {client.email}
                </a>
              )}
            </div>

            {/* Birthday banner */}
            {daysToBday !== null && daysToBday <= 30 && (
              <div style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                marginTop: 10, padding: '6px 12px', borderRadius: 8,
                background: C.warningSoft, color: C.warning,
                fontSize: 12, fontWeight: 600,
              }}>
                <Cake size={13} />
                {daysToBday === 0 ? 'День рождения сегодня!' :
                 daysToBday === 1 ? 'День рождения завтра!' :
                 `День рождения через ${daysToBday} дн.`}
              </div>
            )}
          </div>

          {/* Action button */}
          <Link
            href={`/calendar?client_id=${id}`}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              padding: '10px 18px', borderRadius: 10,
              background: C.accent, color: '#fff', textDecoration: 'none',
              fontSize: 13, fontWeight: 600, flexShrink: 0,
            }}
          >
            <CalendarIcon size={14} />
            Записать
          </Link>
        </div>
      </motion.div>

      {/* ═══ KPI gradient row ═══ */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 16 }}>
        {[
          { label: 'Визитов', value: String(client.total_visits), grad: KPI_GRADIENTS.revenue },
          { label: 'Потрачено', value: `${totalSpent.toLocaleString()} ${CURRENCY}`, grad: KPI_GRADIENTS.profit },
          { label: 'Средний чек', value: `${Math.round(client.avg_check).toLocaleString()} ${CURRENCY}`, grad: KPI_GRADIENTS.neutral },
        ].map((k, i) => (
          <motion.div
            key={k.label}
            initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.06, duration: 0.3 }}
            style={{
              background: k.grad, borderRadius: 16, padding: '20px 22px',
              color: '#fff', position: 'relative', overflow: 'hidden',
              boxShadow: '0 4px 20px rgba(124,58,237,0.1)',
            }}
          >
            <div style={{ position: 'absolute', right: -20, top: -20, width: 80, height: 80, borderRadius: '50%', background: 'rgba(255,255,255,0.1)' }} />
            <div style={{ fontSize: 11, fontWeight: 600, opacity: 0.85, letterSpacing: '0.04em', textTransform: 'uppercase', marginBottom: 8 }}>
              {k.label}
            </div>
            <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-0.3px', fontVariantNumeric: 'tabular-nums' }}>
              {k.value}
            </div>
          </motion.div>
        ))}
      </div>

      {/* ═══ Debt banner ═══ */}
      {master?.id && (
        <ClientDebtBanner clientId={id} masterId={master.id} locale={locale} />
      )}

      {/* ═══ Blacklist warning ═══ */}
      {blacklist?.warning && (
        <div style={{
          display: 'flex', alignItems: 'flex-start', gap: 12, borderRadius: 14,
          border: `1px solid ${C.danger}33`, background: C.dangerSoft,
          padding: 16, marginBottom: 16,
        }}>
          <ShieldAlert style={{ marginTop: 2, width: 20, height: 20, flexShrink: 0, color: C.danger }} />
          <div>
            <p style={{ fontWeight: 600, color: C.danger, margin: 0, fontSize: 14 }}>{t('blacklistWarning')}</p>
            <p style={{ fontSize: 13, color: C.danger, opacity: 0.8, margin: '4px 0 0' }}>
              {t('blacklistWarningDesc', { count: blacklist.total })}
            </p>
          </div>
        </div>
      )}

      {/* ═══ Section: Info ═══ */}
      <motion.section initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} style={sectionStyle}>
        <h3 style={sectionTitle}><FileText size={15} style={{ color: C.accent }} />{t('infoTab')}</h3>
        <InfoTab client={client} onSaved={loadClient} C={C} />
      </motion.section>

      {/* ═══ Section: Notes (voice + manual) ═══ */}
      <motion.section initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.12 }} style={sectionStyle}>
        <h3 style={sectionTitle}><Mic size={15} style={{ color: C.accent }} />Заметки мастера</h3>
        <NotesTab client={client} clientId={id} onSaved={loadClient} C={C} />
      </motion.section>

      {/* ═══ Section: Health / consents (hidden when healthProfile disabled) ═══ */}
      {features.healthProfile && (
        <motion.section initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.14 }} style={sectionStyle}>
          <h3 style={sectionTitle}><Heart size={15} style={{ color: C.danger }} />Медицинское и согласия</h3>
          <HealthTab client={client} intake={intake} vertical={vertical} onSaved={loadClient} C={C} />
        </motion.section>
      )}

      {/* ═══ Section: Visit history ═══ */}
      <motion.section initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.16 }} style={sectionStyle}>
        <h3 style={sectionTitle}><CalendarIcon size={15} style={{ color: C.accent }} />История посещений</h3>
        <HistoryTab appointments={appointments} clientId={id} C={C} />
      </motion.section>

      {/* ═══ Section: Analytics / CLV ═══ */}
      <motion.section initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.18 }} style={sectionStyle}>
        <h3 style={sectionTitle}><BarChart3 size={15} style={{ color: C.accent }} />Аналитика</h3>
        <AnalyticsTab client={client} appointments={appointments} C={C} />
      </motion.section>

      {/* ═══ Section: Family (only if familyLinks feature on) ═══ */}
      {features.familyLinks && familyMembers.length > 0 && (
        <motion.section initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.20 }} style={sectionStyle}>
          <h3 style={sectionTitle}><Users size={15} style={{ color: C.accent }} />{t('familyTab')}</h3>
          <FamilyTab members={familyMembers} C={C} />
        </motion.section>
      )}

      {/* ═══ Section: Files + Before/After (only if gallery feature on) ═══ */}
      {features.gallery && (
        <motion.section initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.22 }} style={sectionStyle}>
          <h3 style={sectionTitle}><Camera size={15} style={{ color: C.accent }} />Файлы и фото до/после</h3>
          <FileUpload clientId={id} />
          <BeforeAfterSection clientId={id} C={C} />
        </motion.section>
      )}

      {/* ═══ Blacklist action (bottom) ═══ */}
      {!client.is_blacklisted && (
        <div style={{ marginTop: 16 }}>
          <BlacklistButton clientId={id} onDone={loadClient} C={C} />
        </div>
      )}
    </div>
  );
}

/* ────────────────────── Info Tab ────────────────────── */

function InfoTab({ client, onSaved, C }: { client: ClientDetail; onSaved: () => void; C: PageTheme }) {
  const t = useTranslations('clients');
  const tc = useTranslations('common');
  const [saving, setSaving] = useState(false);
  const [fullName, setFullName] = useState(client.full_name);
  const [phone, setPhone] = useState(client.phone ?? '');
  const [email, setEmail] = useState(client.email ?? '');
  const [dob, setDob] = useState(client.date_of_birth ?? '');

  async function handleSave() {
    setSaving(true);
    const supabase = createClient();
    const { error } = await supabase.from('clients').update({
      full_name: fullName,
      phone: phone || null,
      email: email || null,
      date_of_birth: dob || null,
    }).eq('id', client.id);
    setSaving(false);
    if (error) toast.error(error.message);
    else { toast.success(tc('success')); onSaved(); }
  }

  return (
    <div style={{ ...cardStyle(C), display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, fontSize: 13 }}>
        <div><span style={{ color: C.textSecondary }}>{t('totalVisits')}:</span> {client.total_visits}</div>
        <div><span style={{ color: C.textSecondary }}>{t('totalSpent')}:</span> {client.total_spent}</div>
        <div><span style={{ color: C.textSecondary }}>{t('avgCheck')}:</span> {client.avg_check}</div>
        <div><span style={{ color: C.textSecondary }}>{t('rating')}:</span> {client.rating}</div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <Label>{t('name')}</Label>
          <Input value={fullName} onChange={(e) => setFullName(e.target.value)} />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <Label>{t('phone')}</Label>
          <Input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <Label>{t('email')}</Label>
          <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <Label>{t('dateOfBirth')}</Label>
          <Input type="date" value={dob} onChange={(e) => setDob(e.target.value)} />
        </div>
      </div>
      <Button onClick={handleSave} disabled={saving}>{saving ? tc('loading') : tc('save')}</Button>
    </div>
  );
}

/* ────────────────────── History Tab ────────────────────── */

function HistoryTab({ appointments, clientId, C }: { appointments: AppointmentRow[]; clientId: string; C: PageTheme }) {
  const tc = useTranslations('calendar');
  const router = useRouter();

  if (appointments.length === 0) {
    return <p style={{ fontSize: 13, color: C.textSecondary, padding: 16 }}>{tc('noAppointments')}</p>;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {appointments.map((a) => (
        <div key={a.id} style={{
          ...cardStyle(C), display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '12px 16px',
        }}>
          <div>
            <p style={{ fontWeight: 510, fontSize: 13, margin: 0, color: C.text }}>{a.service?.name ?? '—'}</p>
            <p style={{ fontSize: 12, color: C.textSecondary, margin: '2px 0 0' }}>
              {new Date(a.starts_at).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' })}{' '}
              {new Date(a.starts_at).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })}
            </p>
            <Badge variant="outline" className="text-xs mt-1">{tc(`status.${a.status}`)}</Badge>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {a.service && <span style={{ fontSize: 13, fontWeight: 510, color: C.text }}>{a.service.price}</span>}
            {a.service && (
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => router.push(`/calendar?repeat=${a.id}&client=${clientId}&service=${a.service!.id}&duration=${a.service!.duration_minutes}`)}
              >
                <RefreshCw style={{ width: 12, height: 12 }} />
              </Button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

/* ────────────────────── Notes Tab (D8: with voice note) ────────────────────── */

interface SpeechRecognitionAlt {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> & { length: number } }) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
}

function NotesTab({ client, clientId, onSaved, C }: { client: ClientDetail; clientId: string; onSaved: () => void; C: PageTheme }) {
  const t = useTranslations('clients');
  const tc = useTranslations('common');
  const [notes, setNotes] = useState(client.notes ?? '');
  const [saving, setSaving] = useState(false);
  const [recording, setRecording] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [transcribing, setTranscribing] = useState(false);
  const recRef = useRef<SpeechRecognitionAlt | null>(null);
  const [speechSupported, setSpeechSupported] = useState(true);

  useEffect(() => {
    const w = window as unknown as {
      SpeechRecognition?: new () => SpeechRecognitionAlt;
      webkitSpeechRecognition?: new () => SpeechRecognitionAlt;
    };
    const Ctor = w.SpeechRecognition ?? w.webkitSpeechRecognition;
    if (!Ctor) { setSpeechSupported(false); return; } // eslint-disable-line react-hooks/set-state-in-effect
    const r = new Ctor();
    r.lang = 'ru-RU';
    r.continuous = true;
    r.interimResults = true;
    r.onresult = (e) => {
      let text = '';
      for (let i = 0; i < e.results.length; i++) {
        text += e.results[i][0].transcript + ' ';
      }
      setTranscript(text.trim());
    };
    r.onerror = () => setRecording(false);
    r.onend = () => setRecording(false);
    recRef.current = r;
  }, []);

  function toggleRecord() {
    if (!recRef.current) return;
    if (recording) {
      recRef.current.stop();
      setRecording(false);
    } else {
      setTranscript('');
      recRef.current.start();
      setRecording(true);
    }
  }

  async function appendVoiceNote() {
    if (!transcript.trim()) return;
    setTranscribing(true);
    // Try AI parse
    let parsedText = transcript.trim();
    try {
      const res = await fetch('/api/ai/transcribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: transcript }),
      });
      if (res.ok) {
        const json = await res.json();
        if (json?.notes) parsedText = json.notes;
      }
    } catch { /* use raw transcript */ }

    const timestamp = new Date().toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
    const updated = notes
      ? `${notes}\n\n[${timestamp}] ${parsedText}`
      : `[${timestamp}] ${parsedText}`;
    setNotes(updated);
    setTranscript('');
    setTranscribing(false);

    // Auto-save
    const supabase = createClient();
    await supabase.from('clients').update({ notes: updated }).eq('id', clientId);
    toast.success(tc('success'));
    onSaved();
  }

  async function handleSave() {
    setSaving(true);
    const supabase = createClient();
    const { error } = await supabase.from('clients').update({ notes }).eq('id', client.id);
    setSaving(false);
    if (error) toast.error(error.message);
    else { toast.success(tc('success')); onSaved(); }
  }

  return (
    <div style={{ ...cardStyle(C), display: 'flex', flexDirection: 'column', gap: 16 }}>
      <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={6} placeholder={t('notes')} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <Button onClick={handleSave} disabled={saving}>{saving ? tc('loading') : tc('save')}</Button>

        {speechSupported && (
          <Button
            variant={recording ? 'destructive' : 'outline'}
            size="icon"
            onClick={toggleRecord}
            title={t('recordVoiceNote')}
          >
            {recording ? <Square style={{ width: 16, height: 16 }} /> : <Mic style={{ width: 16, height: 16 }} />}
          </Button>
        )}
      </div>

      {(recording || transcript) && (
        <div style={{
          borderRadius: 8, border: `1px solid ${C.border}`,
          background: C.surfaceElevated, padding: 12,
          display: 'flex', flexDirection: 'column', gap: 8,
        }}>
          {recording && (
            <p style={{ fontSize: 12, color: C.danger, margin: 0 }}>{t('recording')}</p>
          )}
          {transcript && (
            <>
              <p style={{ fontSize: 13, margin: 0, color: C.text }}>{transcript}</p>
              <Button size="sm" onClick={appendVoiceNote} disabled={transcribing}>
                {transcribing ? t('transcribing') : t('voiceNote')}
              </Button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

/* ────────────────────── Health Tab (D2: dynamic per vertical) ────────────────────── */

function HealthTab({ client, intake, vertical, onSaved, C }: {
  client: ClientDetail;
  intake: ClientIntake | null;
  vertical: string | null;
  onSaved: () => void;
  C: PageTheme;
}) {
  const t = useTranslations('clients');
  const ti = useTranslations('clients.intake');
  const tc = useTranslations('common');
  const { canUse } = useSubscription();
  const [allergies, setAllergies] = useState(client.allergies);
  const [contraindications, setContraindications] = useState(client.contraindications);
  const [saving, setSaving] = useState(false);

  const intakeFields = getIntakeFields(vertical);

  if (!canUse('allergies')) return <p style={{ padding: 16, fontSize: 13, color: C.textSecondary }}>Перейдите на тариф Pro для ведения медицинских данных клиентов.</p>;

  if (intakeFields.length === 0) {
    return (
      <div style={{ ...cardStyle(C) }}>
        <p style={{ fontSize: 13, color: C.textSecondary, margin: 0 }}>{ti('noAnamnesisNeeded')}</p>
      </div>
    );
  }

  const intakeHasContent = !!intake && (
    !!intake.allergies?.trim() ||
    !!intake.chronic_conditions?.trim() ||
    !!intake.medications?.trim() ||
    !!intake.contraindications?.trim() ||
    intake.pregnancy === true
  );

  async function handleSave() {
    setSaving(true);
    const hasAlert = allergies.length > 0 || contraindications.length > 0 || intakeHasContent;
    const supabase = createClient();
    const { error } = await supabase.from('clients').update({
      allergies,
      contraindications,
      has_health_alert: hasAlert,
    }).eq('id', client.id);
    setSaving(false);
    if (error) toast.error(error.message);
    else { toast.success(tc('success')); onSaved(); }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Intake from client */}
      <div style={cardStyle(C)}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          {intakeHasContent && <AlertTriangle style={{ width: 16, height: 16, color: C.danger }} />}
          <span style={{ fontSize: 15, fontWeight: 510, color: C.text }}>{t('intakeFromClient')}</span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 13 }}>
          {!intake && <p style={{ color: C.textSecondary, margin: 0 }}>{t('noIntakeYet')}</p>}
          {intake && !intakeHasContent && <p style={{ color: C.textSecondary, margin: 0 }}>{t('intakeEmpty')}</p>}
          {intake && intakeHasContent && (
            <>
              {intakeFields.map((field) => {
                const rec = intake as unknown;
                const val = (rec as Record<string, unknown>)[field.key];
                if (!val || (typeof val === 'string' && !val.trim())) return null;
                if (field.type === 'boolean' && val !== true) return null;
                return (
                  <div key={field.key}>
                    <span style={{ color: C.textSecondary }}>{ti(field.labelKey)}:</span>{' '}
                    {field.type === 'boolean' ? '✓' : String(val)}
                  </div>
                );
              })}
              {intake.updated_at && (
                <div style={{ fontSize: 12, color: C.textTertiary, paddingTop: 4 }}>
                  {t('intakeUpdatedAt')}: {new Date(intake.updated_at).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Master notes */}
      <div style={cardStyle(C)}>
        <div style={{ fontSize: 15, fontWeight: 510, color: C.text, marginBottom: 16 }}>{t('masterNotes')}</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <Label>{t('allergies')}</Label>
            <TagInput value={allergies} onChange={setAllergies} placeholder={t('addAllergy')} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <Label>{t('contraindications')}</Label>
            <TagInput value={contraindications} onChange={setContraindications} placeholder={t('addContraindication')} />
          </div>
          <Button onClick={handleSave} disabled={saving}>{saving ? tc('loading') : tc('save')}</Button>
        </div>
      </div>
    </div>
  );
}

/* ────────────────────── Family Tab (D6) ────────────────────── */

function FamilyTab({ members, C }: { members: FamilyMember[]; C: PageTheme }) {
  const t = useTranslations('clients');

  return (
    <div style={cardStyle(C)}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <Users style={{ width: 16, height: 16, color: C.accent }} />
        <span style={{ fontSize: 15, fontWeight: 510, color: C.text }}>{t('familyMembers')}</span>
      </div>
      {members.length === 0 ? (
        <p style={{ fontSize: 13, color: C.textSecondary, margin: 0 }}>{t('noFamilyMembers')}</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {members.map((m) => (
            <div key={m.id} style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              borderRadius: 8, border: `1px solid ${C.border}`, padding: 12,
            }}>
              <div>
                <p style={{ fontSize: 13, fontWeight: 510, margin: 0, color: C.text }}>{m.member_name}</p>
                <p style={{ fontSize: 12, color: C.textSecondary, margin: '2px 0 0' }}>{m.relationship}</p>
              </div>
              {m.linked_profile_id && (
                <Badge variant="outline" className="text-xs">
                  {t('infoTab')}
                </Badge>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ────────────────────── Analytics Tab (D7) ────────────────────── */

function AnalyticsTab({ client, appointments, C }: { client: ClientDetail; appointments: AppointmentRow[]; C: PageTheme }) {
  const t = useTranslations('clients');

  // CLV = avg_check * estimated_annual_visits
  const completedAppointments = appointments.filter((a) => a.status === 'completed');
  const totalMonths = completedAppointments.length >= 2
    ? Math.max(1, Math.ceil(
        (new Date(completedAppointments[0]?.starts_at).getTime() -
         new Date(completedAppointments[completedAppointments.length - 1]?.starts_at).getTime()) /
        (1000 * 60 * 60 * 24 * 30)
      ))
    : 12;
  const visitsPerMonth = totalMonths > 0 ? completedAppointments.length / totalMonths : 0;
  const estimatedAnnualVisits = Math.round(visitsPerMonth * 12);
  const clv = Math.round(client.avg_check * estimatedAnnualVisits);

  // Visit frequency sparkline — last 12 months
  const now = new Date();
  const monthBuckets: number[] = Array.from({ length: 12 }, () => 0);
  completedAppointments.forEach((a) => {
    const d = new Date(a.starts_at);
    const diff = (now.getFullYear() - d.getFullYear()) * 12 + (now.getMonth() - d.getMonth());
    if (diff >= 0 && diff < 12) {
      monthBuckets[11 - diff]++;
    }
  });
  const maxBucket = Math.max(...monthBuckets, 1);

  // "Time to remind" badge
  const daysSinceLastVisit = client.last_visit_at
    ? Math.floor((now.getTime() - new Date(client.last_visit_at).getTime()) / (1000 * 60 * 60 * 24))
    : null;
  const averageCadence = completedAppointments.length >= 2
    ? Math.round(totalMonths * 30 / completedAppointments.length)
    : 30;
  const shouldRemind = daysSinceLastVisit !== null && daysSinceLastVisit > averageCadence;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Reminder badge */}
      {shouldRemind && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8, borderRadius: 8,
          border: `1px solid ${C.warning}33`, background: C.warningSoft, padding: 12,
        }}>
          <Bell style={{ width: 16, height: 16, color: C.warning }} />
          <span style={{ fontSize: 13, fontWeight: 510, color: C.warning }}>
            {t('timeToRemind')} — {daysSinceLastVisit}d
          </span>
        </div>
      )}

      {/* KPI cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
        {[
          { label: t('clv'), value: clv },
          { label: t('estimatedAnnualVisits'), value: estimatedAnnualVisits },
          { label: t('avgCheck'), value: client.avg_check },
        ].map((kpi) => (
          <div key={kpi.label} style={{ ...cardStyle(C), textAlign: 'center' as const }}>
            <p style={{ ...labelStyle(C), margin: '0 0 4px' }}>{kpi.label}</p>
            <p style={{ fontSize: 24, fontWeight: 510, letterSpacing: '-0.5px', color: C.text, margin: 0 }}>{kpi.value}</p>
          </div>
        ))}
      </div>

      {/* Sparkline */}
      <div style={cardStyle(C)}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <BarChart3 style={{ width: 16, height: 16, color: C.accent }} />
          <span style={{ fontSize: 15, fontWeight: 510, color: C.text }}>{t('visitFrequency')}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: 64 }}>
          {monthBuckets.map((count, i) => (
            <div
              key={i}
              style={{
                flex: 1, borderRadius: '3px 3px 0 0',
                background: `${C.accent}b3`,
                height: `${(count / maxBucket) * 100}%`,
                minHeight: count > 0 ? 4 : 1,
                transition: 'height 0.2s ease',
              }}
              title={`${count} visits`}
            />
          ))}
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4, fontSize: 10, color: C.textTertiary }}>
          <span>-12m</span>
          <span>-6m</span>
          <span>now</span>
        </div>
      </div>
    </div>
  );
}

/* ────────────────────── Blacklist Button (D5) ────────────────────── */

function BlacklistButton({ clientId, onDone, C }: { clientId: string; onDone: () => void; C: PageTheme }) {
  const t = useTranslations('clients');
  const tc = useTranslations('common');
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);

  async function handleBlacklist() {
    if (!reason.trim()) return;
    setSaving(true);
    const supabase = createClient();
    const { error } = await supabase.from('clients').update({
      is_blacklisted: true,
      blacklist_reason: reason.trim(),
    }).eq('id', clientId);
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(tc('success'));
    setOpen(false);
    setReason('');
    onDone();
  }

  if (!open) {
    return (
      <div style={{ paddingTop: 16, borderTop: `1px solid ${C.border}` }}>
        <Button variant="outline" size="sm" style={{ color: C.danger }} onClick={() => setOpen(true)}>
          <ShieldAlert style={{ width: 16, height: 16, marginRight: 4 }} />
          {t('addToBlacklist')}
        </Button>
      </div>
    );
  }

  return (
    <div style={{ paddingTop: 16, borderTop: `1px solid ${C.border}`, display: 'flex', flexDirection: 'column', gap: 12 }}>
      <Label>{t('blacklistReason')}</Label>
      <Textarea
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder={t('blacklistReasonPlaceholder')}
        rows={3}
      />
      <div style={{ display: 'flex', gap: 8 }}>
        <Button variant="destructive" size="sm" onClick={handleBlacklist} disabled={saving || !reason.trim()}>
          {saving ? tc('loading') : t('addToBlacklist')}
        </Button>
        <Button variant="ghost" size="sm" onClick={() => { setOpen(false); setReason(''); }}>
          {tc('back')}
        </Button>
      </div>
    </div>
  );
}

/* ────────────────────── Before/After Section ────────────────────── */

function BeforeAfterSection({ clientId, C }: { clientId: string; C: PageTheme }) {
  const { canUse } = useSubscription();
  const [files, setFiles] = useState<{ id: string; file_url: string; is_before_photo: boolean }[]>([]);

  useEffect(() => {
    if (!canUse('file_storage')) return;
    const supabase = createClient();
    supabase
      .from('client_files')
      .select('id, file_url, is_before_photo')
      .eq('client_id', clientId)
      .like('file_type', 'image/%')
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        if (data) setFiles(data);
      });
  }, [clientId, canUse]);

  if (!canUse('file_storage') || files.length < 2) return null;

  const beforeImg = files.find((f) => f.is_before_photo)?.file_url || files[1]?.file_url;
  const afterImg = files.find((f) => !f.is_before_photo)?.file_url || files[0]?.file_url;

  if (!beforeImg || !afterImg) return null;

  return (
    <div style={{ marginTop: 24, display: 'flex', flexDirection: 'column', gap: 8 }}>
      <h4 style={{ fontSize: 13, fontWeight: 510, color: C.text, margin: 0 }}>Before / After</h4>
      <div style={{ borderRadius: 12, border: `1px solid ${C.border}`, overflow: 'hidden', aspectRatio: '16/10' }}>
        <ImageComparisonSlider
          leftImage={beforeImg}
          rightImage={afterImg}
          altLeft="До"
          altRight="После"
        />
      </div>
    </div>
  );
}
