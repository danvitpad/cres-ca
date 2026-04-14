/** --- YAML
 * name: Client Detail Page
 * description: Full client card with tabs — Info, History, Notes, Health, Files
 * --- */

'use client';

import { useState, useEffect, use } from 'react';
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
import { ArrowLeft, RefreshCw, AlertTriangle, ShieldAlert } from 'lucide-react';
import type { BehaviorIndicator, AppointmentStatus } from '@/types';

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
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadClient();
    loadAppointments();
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  async function loadClient() {
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
      }
    }
    setLoading(false);
  }

  async function loadAppointments() {
    const supabase = createClient();
    const { data } = await supabase
      .from('appointments')
      .select('id, starts_at, ends_at, status, service:services(id, name, duration_minutes, price)')
      .eq('client_id', id)
      .order('starts_at', { ascending: false })
      .limit(50);
    if (data) setAppointments(data as unknown as AppointmentRow[]);
  }

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
        <TabsList>
          <TabsTrigger value="info">{t('infoTab')}</TabsTrigger>
          <TabsTrigger value="history">{t('visitHistory')}</TabsTrigger>
          <TabsTrigger value="notes">{t('notes')}</TabsTrigger>
          <TabsTrigger value="health">{t('healthTab')}</TabsTrigger>
          <TabsTrigger value="files">{t('filesTab')}</TabsTrigger>
        </TabsList>

        <TabsContent value="info">
          <InfoTab client={client} onSaved={loadClient} />
        </TabsContent>
        <TabsContent value="history">
          <HistoryTab appointments={appointments} clientId={id} />
        </TabsContent>
        <TabsContent value="notes">
          <NotesTab client={client} onSaved={loadClient} />
        </TabsContent>
        <TabsContent value="health">
          <HealthTab client={client} intake={intake} onSaved={loadClient} />
        </TabsContent>
        <TabsContent value="files">
          <FileUpload clientId={id} />
          {/* Before/After slider for Business tier */}
          <BeforeAfterSection clientId={id} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

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

function HistoryTab({ appointments, clientId }: { appointments: AppointmentRow[]; clientId: string }) {
  const t = useTranslations('clients');
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

function NotesTab({ client, onSaved }: { client: ClientDetail; onSaved: () => void }) {
  const t = useTranslations('clients');
  const tc = useTranslations('common');
  const [notes, setNotes] = useState(client.notes ?? '');
  const [saving, setSaving] = useState(false);

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
        <Button onClick={handleSave} disabled={saving}>{saving ? tc('loading') : tc('save')}</Button>
      </CardContent>
    </Card>
  );
}

function HealthTab({ client, intake, onSaved }: { client: ClientDetail; intake: ClientIntake | null; onSaved: () => void }) {
  const t = useTranslations('clients');
  const tc = useTranslations('common');
  const { canUse } = useSubscription();
  const [allergies, setAllergies] = useState(client.allergies);
  const [contraindications, setContraindications] = useState(client.contraindications);
  const [saving, setSaving] = useState(false);

  if (!canUse('allergies')) return <p className="p-4 text-sm text-muted-foreground">Upgrade to Pro for health tracking.</p>;

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
              {intake.allergies?.trim() && (
                <div><span className="text-muted-foreground">{t('allergies')}:</span> {intake.allergies}</div>
              )}
              {intake.chronic_conditions?.trim() && (
                <div><span className="text-muted-foreground">{t('chronicConditions')}:</span> {intake.chronic_conditions}</div>
              )}
              {intake.medications?.trim() && (
                <div><span className="text-muted-foreground">{t('medications')}:</span> {intake.medications}</div>
              )}
              {intake.contraindications?.trim() && (
                <div><span className="text-muted-foreground">{t('contraindications')}:</span> {intake.contraindications}</div>
              )}
              {intake.pregnancy === true && (
                <div><span className="text-muted-foreground">{t('pregnancy')}:</span> ✓</div>
              )}
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
