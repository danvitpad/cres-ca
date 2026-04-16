/** --- YAML
 * name: Client Detail Page
 * description: Full client card with tabs — Info, History, Notes, Health, Files, Family, Analytics. Includes voice note recording, manual blacklist, dynamic anamnesis per vertical, CLV analytics.
 * created: 2026-04-12
 * updated: 2026-04-16
 * --- */

'use client';

import { useState, useEffect, useRef, useCallback, use } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';
import { useSubscription } from '@/hooks/use-subscription';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
import {
  ArrowLeft, RefreshCw, AlertTriangle, ShieldAlert,
  Mic, Square, Users, BarChart3, Bell,
} from 'lucide-react';
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
    return <div className="space-y-4"><Skeleton className="h-8 w-64" /><Skeleton className="h-64 w-full" /></div>;
  }

  if (!client) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" onClick={() => router.back()}><ArrowLeft className="h-4 w-4 mr-2" />{tc('back')}</Button>
        <p className="text-muted-foreground">{tc('error')}</p>
      </div>
    );
  }

  const vertical = master?.vertical ?? null;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h2 className="text-2xl font-bold">
          {client.has_health_alert && <AlertTriangle className="inline h-5 w-5 text-red-500 mr-1" />}
          {client.full_name}
        </h2>
        <BehaviorIndicators indicators={client.behavior_indicators} />
        {client.is_blacklisted && (
          <Badge variant="destructive">{t('manuallyBlacklisted')}</Badge>
        )}
      </div>

      {master?.id && (
        <ClientDebtBanner clientId={id} masterId={master.id} locale={locale} />
      )}

      {blacklist?.warning && (
        <div className="flex items-start gap-3 rounded-2xl border border-red-300 bg-red-50 p-4 dark:border-red-900 dark:bg-red-950/30">
          <ShieldAlert className="mt-0.5 size-5 shrink-0 text-red-600 dark:text-red-400" />
          <div className="space-y-1">
            <p className="font-medium text-red-900 dark:text-red-200">{t('blacklistWarning')}</p>
            <p className="text-sm text-red-800/80 dark:text-red-300/80">
              {t('blacklistWarningDesc', { count: blacklist.total })}
            </p>
          </div>
        </div>
      )}

      <Tabs defaultValue="info">
        <TabsList className="flex-wrap">
          <TabsTrigger value="info">{t('infoTab')}</TabsTrigger>
          <TabsTrigger value="history">{t('visitHistory')}</TabsTrigger>
          <TabsTrigger value="notes">{t('notes')}</TabsTrigger>
          <TabsTrigger value="health">{t('healthTab')}</TabsTrigger>
          <TabsTrigger value="files">{t('filesTab')}</TabsTrigger>
          <TabsTrigger value="family">{t('familyTab')}</TabsTrigger>
          <TabsTrigger value="analytics">{t('analyticsTab')}</TabsTrigger>
        </TabsList>

        <TabsContent value="info">
          <InfoTab client={client} onSaved={loadClient} />
        </TabsContent>
        <TabsContent value="history">
          <HistoryTab appointments={appointments} clientId={id} />
        </TabsContent>
        <TabsContent value="notes">
          <NotesTab client={client} clientId={id} onSaved={loadClient} />
        </TabsContent>
        <TabsContent value="health">
          <HealthTab client={client} intake={intake} vertical={vertical} onSaved={loadClient} />
        </TabsContent>
        <TabsContent value="files">
          <FileUpload clientId={id} />
          <BeforeAfterSection clientId={id} />
        </TabsContent>
        <TabsContent value="family">
          <FamilyTab members={familyMembers} />
        </TabsContent>
        <TabsContent value="analytics">
          <AnalyticsTab client={client} appointments={appointments} />
        </TabsContent>
      </Tabs>

      {/* D5: Manual blacklist button */}
      {!client.is_blacklisted && (
        <BlacklistButton clientId={id} onDone={loadClient} />
      )}
    </div>
  );
}

/* ────────────────────── Info Tab ────────────────────── */

function InfoTab({ client, onSaved }: { client: ClientDetail; onSaved: () => void }) {
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
    <Card>
      <CardContent className="p-4 space-y-4">
        <div className="grid gap-4 grid-cols-2 text-sm">
          <div><span className="text-muted-foreground">{t('totalVisits')}:</span> {client.total_visits}</div>
          <div><span className="text-muted-foreground">{t('totalSpent')}:</span> {client.total_spent}</div>
          <div><span className="text-muted-foreground">{t('avgCheck')}:</span> {client.avg_check}</div>
          <div><span className="text-muted-foreground">{t('rating')}:</span> {client.rating}</div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>{t('name')}</Label>
            <Input value={fullName} onChange={(e) => setFullName(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>{t('phone')}</Label>
            <Input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>{t('email')}</Label>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>{t('dateOfBirth')}</Label>
            <Input type="date" value={dob} onChange={(e) => setDob(e.target.value)} />
          </div>
        </div>
        <Button onClick={handleSave} disabled={saving}>{saving ? tc('loading') : tc('save')}</Button>
      </CardContent>
    </Card>
  );
}

/* ────────────────────── History Tab ────────────────────── */

function HistoryTab({ appointments, clientId }: { appointments: AppointmentRow[]; clientId: string }) {
  const tc = useTranslations('calendar');
  const router = useRouter();

  if (appointments.length === 0) {
    return <p className="text-sm text-muted-foreground p-4">{tc('noAppointments')}</p>;
  }

  return (
    <div className="space-y-2">
      {appointments.map((a) => (
        <Card key={a.id}>
          <CardContent className="p-3 flex items-center justify-between">
            <div>
              <p className="font-medium text-sm">{a.service?.name ?? '—'}</p>
              <p className="text-xs text-muted-foreground">
                {new Date(a.starts_at).toLocaleDateString()} {new Date(a.starts_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </p>
              <Badge variant="outline" className="text-xs mt-1">{tc(`status.${a.status}`)}</Badge>
            </div>
            <div className="flex items-center gap-2">
              {a.service && <span className="text-sm font-medium">{a.service.price}</span>}
              {a.service && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => router.push(`/calendar?repeat=${a.id}&client=${clientId}&service=${a.service!.id}&duration=${a.service!.duration_minutes}`)}
                >
                  <RefreshCw className="h-3 w-3" />
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
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

function NotesTab({ client, clientId, onSaved }: { client: ClientDetail; clientId: string; onSaved: () => void }) {
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

    const timestamp = new Date().toLocaleString();
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
    <Card>
      <CardContent className="p-4 space-y-4">
        <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={6} placeholder={t('notes')} />
        <div className="flex items-center gap-2">
          <Button onClick={handleSave} disabled={saving}>{saving ? tc('loading') : tc('save')}</Button>

          {/* D8: Voice note mic button */}
          {speechSupported && (
            <Button
              variant={recording ? 'destructive' : 'outline'}
              size="icon"
              onClick={toggleRecord}
              title={t('recordVoiceNote')}
            >
              {recording ? <Square className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
            </Button>
          )}
        </div>

        {(recording || transcript) && (
          <div className="rounded-lg border bg-muted/30 p-3 space-y-2">
            {recording && (
              <p className="text-xs text-red-500 animate-pulse">{t('recording')}</p>
            )}
            {transcript && (
              <>
                <p className="text-sm">{transcript}</p>
                <Button
                  size="sm"
                  onClick={appendVoiceNote}
                  disabled={transcribing}
                >
                  {transcribing ? t('transcribing') : t('voiceNote')}
                </Button>
              </>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/* ────────────────────── Health Tab (D2: dynamic per vertical) ────────────────────── */

function HealthTab({ client, intake, vertical, onSaved }: {
  client: ClientDetail;
  intake: ClientIntake | null;
  vertical: string | null;
  onSaved: () => void;
}) {
  const t = useTranslations('clients');
  const ti = useTranslations('clients.intake');
  const tc = useTranslations('common');
  const { canUse } = useSubscription();
  const [allergies, setAllergies] = useState(client.allergies);
  const [contraindications, setContraindications] = useState(client.contraindications);
  const [saving, setSaving] = useState(false);

  const intakeFields = getIntakeFields(vertical);

  if (!canUse('allergies')) return <p className="p-4 text-sm text-muted-foreground">Upgrade to Pro for health tracking.</p>;

  // D2: If vertical has no anamnesis fields (e.g., auto), show message
  if (intakeFields.length === 0) {
    return (
      <Card>
        <CardContent className="p-4">
          <p className="text-sm text-muted-foreground">{ti('noAnamnesisNeeded')}</p>
        </CardContent>
      </Card>
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
    <div className="space-y-4">
      {/* D2: Dynamic intake fields display based on vertical */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            {intakeHasContent && <AlertTriangle className="h-4 w-4 text-red-500" />}
            {t('intakeFromClient')}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4 pt-0 space-y-3 text-sm">
          {!intake && <p className="text-muted-foreground">{t('noIntakeYet')}</p>}
          {intake && !intakeHasContent && <p className="text-muted-foreground">{t('intakeEmpty')}</p>}
          {intake && intakeHasContent && (
            <>
              {intakeFields.map((field) => {
                const rec = intake as unknown;
                const val = (rec as Record<string, unknown>)[field.key];
                if (!val || (typeof val === 'string' && !val.trim())) return null;
                if (field.type === 'boolean' && val !== true) return null;
                return (
                  <div key={field.key}>
                    <span className="text-muted-foreground">{ti(field.labelKey)}:</span>{' '}
                    {field.type === 'boolean' ? '✓' : String(val)}
                  </div>
                );
              })}
              {intake.updated_at && (
                <div className="text-xs text-muted-foreground pt-1">
                  {t('intakeUpdatedAt')}: {new Date(intake.updated_at).toLocaleDateString()}
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">{t('masterNotes')}</CardTitle>
        </CardHeader>
        <CardContent className="p-4 pt-0 space-y-4">
          <div className="space-y-2">
            <Label>{t('allergies')}</Label>
            <TagInput value={allergies} onChange={setAllergies} placeholder={t('addAllergy')} />
          </div>
          <div className="space-y-2">
            <Label>{t('contraindications')}</Label>
            <TagInput value={contraindications} onChange={setContraindications} placeholder={t('addContraindication')} />
          </div>
          <Button onClick={handleSave} disabled={saving}>{saving ? tc('loading') : tc('save')}</Button>
        </CardContent>
      </Card>
    </div>
  );
}

/* ────────────────────── Family Tab (D6) ────────────────────── */

function FamilyTab({ members }: { members: FamilyMember[] }) {
  const t = useTranslations('clients');

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <Users className="h-4 w-4" />
          {t('familyMembers')}
        </CardTitle>
      </CardHeader>
      <CardContent className="p-4 pt-0">
        {members.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t('noFamilyMembers')}</p>
        ) : (
          <div className="space-y-2">
            {members.map((m) => (
              <div key={m.id} className="flex items-center justify-between rounded-lg border p-3">
                <div>
                  <p className="text-sm font-medium">{m.member_name}</p>
                  <p className="text-xs text-muted-foreground">{m.relationship}</p>
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
      </CardContent>
    </Card>
  );
}

/* ────────────────────── Analytics Tab (D7) ────────────────────── */

function AnalyticsTab({ client, appointments }: { client: ClientDetail; appointments: AppointmentRow[] }) {
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
    <div className="space-y-4">
      {/* Reminder badge */}
      {shouldRemind && (
        <div className="flex items-center gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3 dark:border-amber-900 dark:bg-amber-950/30">
          <Bell className="h-4 w-4 text-amber-600" />
          <span className="text-sm font-medium text-amber-800 dark:text-amber-300">
            {t('timeToRemind')} — {daysSinceLastVisit}d
          </span>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-xs text-muted-foreground">{t('clv')}</p>
            <p className="text-2xl font-bold">{clv}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-xs text-muted-foreground">{t('estimatedAnnualVisits')}</p>
            <p className="text-2xl font-bold">{estimatedAnnualVisits}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-xs text-muted-foreground">{t('avgCheck')}</p>
            <p className="text-2xl font-bold">{client.avg_check}</p>
          </CardContent>
        </Card>
      </div>

      {/* Sparkline */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            {t('visitFrequency')}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4 pt-0">
          <div className="flex items-end gap-1 h-16">
            {monthBuckets.map((count, i) => (
              <div
                key={i}
                className="flex-1 rounded-t bg-primary/70 transition-all"
                style={{ height: `${(count / maxBucket) * 100}%`, minHeight: count > 0 ? '4px' : '1px' }}
                title={`${count} visits`}
              />
            ))}
          </div>
          <div className="flex justify-between mt-1 text-[10px] text-muted-foreground">
            <span>-12m</span>
            <span>-6m</span>
            <span>now</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

/* ────────────────────── Blacklist Button (D5) ────────────────────── */

function BlacklistButton({ clientId, onDone }: { clientId: string; onDone: () => void }) {
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
      <div className="pt-4 border-t">
        <Button variant="outline" size="sm" className="text-red-600" onClick={() => setOpen(true)}>
          <ShieldAlert className="h-4 w-4 mr-1" />
          {t('addToBlacklist')}
        </Button>
      </div>
    );
  }

  return (
    <div className="pt-4 border-t space-y-3">
      <Label>{t('blacklistReason')}</Label>
      <Textarea
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder={t('blacklistReasonPlaceholder')}
        rows={3}
      />
      <div className="flex gap-2">
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

function BeforeAfterSection({ clientId }: { clientId: string }) {
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
    <div className="mt-6 space-y-2">
      <h4 className="text-sm font-medium">Before / After</h4>
      <div className="rounded-xl border overflow-hidden aspect-[16/10]">
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
