/** --- YAML
 * name: ClientFormsPage
 * description: Medical intake form, digital consents, and file archive (PDF analyses, before/after photos)
 * created: 2026-04-12
 * updated: 2026-04-12
 * --- */

'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { FileText, FileCheck2, Upload, AlertTriangle, Pill, Heart, Baby } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useAuthStore } from '@/stores/auth-store';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';

interface IntakeForm {
  allergies: string;
  chronic: string;
  meds: string;
  pregnancy: boolean;
  contraindications: string;
}

interface ConsentItem {
  id: string;
  form_text: string;
  client_agreed: boolean;
  agreed_at: string | null;
  created_at: string;
  master: { display_name: string | null; profile: { full_name: string | null } | null } | { display_name: string | null; profile: { full_name: string | null } | null }[] | null;
}

export default function FormsPage() {
  const t = useTranslations('clientForms');
  const searchParams = useSearchParams();
  const showIntakePrompt = searchParams.get('prompt') === 'intake';
  const { userId } = useAuthStore();
  const [form, setForm] = useState<IntakeForm>({
    allergies: '',
    chronic: '',
    meds: '',
    pregnancy: false,
    contraindications: '',
  });
  const [saving, setSaving] = useState(false);
  const [consents, setConsents] = useState<ConsentItem[]>([]);
  const [signing, setSigning] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) return;
    async function load() {
      const supabase = createClient();
      const { data } = await supabase
        .from('client_health_profiles')
        .select('allergies, chronic_conditions, medications, pregnancy, contraindications')
        .eq('profile_id', userId)
        .maybeSingle();
      if (data) {
        setForm({
          allergies: data.allergies ?? '',
          chronic: data.chronic_conditions ?? '',
          meds: data.medications ?? '',
          pregnancy: data.pregnancy ?? false,
          contraindications: data.contraindications ?? '',
        });
      }

      const { data: cons } = await supabase
        .from('consent_forms')
        .select('id, form_text, client_agreed, agreed_at, created_at, master:masters(display_name, profile:profiles(full_name))')
        .order('created_at', { ascending: false });
      setConsents((cons as unknown as ConsentItem[] | null) ?? []);
    }
    load();
  }, [userId]);

  async function signConsent(id: string) {
    setSigning(id);
    const supabase = createClient();
    const { error } = await supabase
      .from('consent_forms')
      .update({ client_agreed: true, agreed_at: new Date().toISOString() })
      .eq('id', id);
    setSigning(null);
    if (error) {
      toast.error(error.message);
      return;
    }
    setConsents((prev) =>
      prev.map((c) => (c.id === id ? { ...c, client_agreed: true, agreed_at: new Date().toISOString() } : c)),
    );
    toast.success('Подписано');
  }

  function masterName(m: ConsentItem['master']): string {
    const obj = Array.isArray(m) ? m[0] : m;
    return obj?.display_name ?? obj?.profile?.full_name ?? '—';
  }

  async function save() {
    if (!userId) return;
    setSaving(true);
    const supabase = createClient();
    const { error } = await supabase.from('client_health_profiles').upsert({
      profile_id: userId,
      allergies: form.allergies,
      chronic_conditions: form.chronic,
      medications: form.meds,
      pregnancy: form.pregnancy,
      contraindications: form.contraindications,
      updated_at: new Date().toISOString(),
    });
    setSaving(false);
    if (error) toast.error(error.message);
    else toast.success('✓');
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className="space-y-6"
    >
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{t('title')}</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">{t('desc')}</p>
      </div>

      {showIntakePrompt && (
        <div className="flex items-start gap-3 rounded-2xl border border-amber-300 bg-amber-50 p-4 dark:border-amber-900 dark:bg-amber-950/30">
          <AlertTriangle className="mt-0.5 size-5 shrink-0 text-amber-600 dark:text-amber-400" />
          <div className="space-y-1">
            <p className="font-medium text-amber-900 dark:text-amber-200">{t('promptTitle')}</p>
            <p className="text-sm text-amber-800/80 dark:text-amber-300/80">{t('promptDesc')}</p>
          </div>
        </div>
      )}

      <Tabs defaultValue="intake" className="w-full">
        <TabsList className="grid w-full grid-cols-3 max-w-[420px]">
          <TabsTrigger value="intake">{t('tab_intake')}</TabsTrigger>
          <TabsTrigger value="consents">{t('tab_consents')}</TabsTrigger>
          <TabsTrigger value="archive">{t('tab_archive')}</TabsTrigger>
        </TabsList>

        <TabsContent value="intake" className="mt-6">
          <div className="rounded-3xl border bg-card p-6 sm:p-8 space-y-6">
            <div>
              <h2 className="text-xl font-bold">{t('intakeTitle')}</h2>
              <p className="mt-1 text-sm text-muted-foreground">{t('intakeDesc')}</p>
            </div>

            <div className="space-y-5 max-w-2xl">
              <FieldBlock icon={AlertTriangle} label={t('allergies')}>
                <Textarea
                  value={form.allergies}
                  onChange={(e) => setForm({ ...form, allergies: e.target.value })}
                  rows={2}
                />
              </FieldBlock>
              <FieldBlock icon={Heart} label={t('chronicConditions')}>
                <Textarea
                  value={form.chronic}
                  onChange={(e) => setForm({ ...form, chronic: e.target.value })}
                  rows={2}
                />
              </FieldBlock>
              <FieldBlock icon={Pill} label={t('medications')}>
                <Textarea
                  value={form.meds}
                  onChange={(e) => setForm({ ...form, meds: e.target.value })}
                  rows={2}
                />
              </FieldBlock>
              <div className="flex items-center gap-3 rounded-xl border bg-muted/30 p-4">
                <Checkbox
                  id="pregnancy"
                  checked={form.pregnancy}
                  onCheckedChange={(v) => setForm({ ...form, pregnancy: Boolean(v) })}
                />
                <Label htmlFor="pregnancy" className="flex items-center gap-2 cursor-pointer">
                  <Baby className="size-4" />
                  {t('pregnancy')}
                </Label>
              </div>
              <FieldBlock icon={AlertTriangle} label={t('contraindications')}>
                <Textarea
                  value={form.contraindications}
                  onChange={(e) => setForm({ ...form, contraindications: e.target.value })}
                  rows={2}
                />
              </FieldBlock>

              <Button onClick={save} disabled={saving}>
                {t('save')}
              </Button>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="consents" className="mt-6">
          <div className="rounded-3xl border bg-card p-6 sm:p-8 space-y-5">
            <div>
              <div className="flex size-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                <FileCheck2 className="size-7" />
              </div>
              <h2 className="mt-5 text-xl font-bold">{t('consentsTitle')}</h2>
              <p className="mt-2 max-w-md text-sm text-muted-foreground">{t('consentsDesc')}</p>
            </div>

            {consents.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t('noConsents')}</p>
            ) : (
              <div className="space-y-3">
                {consents.map((c) => (
                  <div
                    key={c.id}
                    className={`rounded-2xl border p-4 ${
                      c.client_agreed
                        ? 'border-emerald-200 bg-emerald-50/40 dark:border-emerald-900 dark:bg-emerald-950/20'
                        : 'border-amber-200 bg-amber-50/40 dark:border-amber-900 dark:bg-amber-950/20'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="text-xs font-medium text-muted-foreground">
                        от {masterName(c.master)} • {new Date(c.created_at).toLocaleDateString()}
                      </div>
                      {c.client_agreed && (
                        <span className="text-xs font-medium text-emerald-700 dark:text-emerald-400">
                          ✓ подписано {c.agreed_at ? new Date(c.agreed_at).toLocaleDateString() : ''}
                        </span>
                      )}
                    </div>
                    <p className="mt-3 whitespace-pre-wrap text-sm">{c.form_text}</p>
                    {!c.client_agreed && (
                      <Button
                        className="mt-4"
                        size="sm"
                        onClick={() => signConsent(c.id)}
                        disabled={signing === c.id}
                      >
                        {signing === c.id ? '...' : 'Подписать'}
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="archive" className="mt-6">
          <div className="rounded-3xl border bg-card p-8">
            <div className="flex size-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <FileText className="size-7" />
            </div>
            <h2 className="mt-5 text-xl font-bold">{t('archiveTitle')}</h2>
            <p className="mt-2 max-w-md text-sm text-muted-foreground">{t('archiveDesc')}</p>
            <div className="mt-6">
              <Button>
                <Upload className="mr-2 size-4" />
                {t('uploadFile')}
              </Button>
            </div>
            <p className="mt-6 text-sm text-muted-foreground">{t('noFiles')}</p>
          </div>
        </TabsContent>
      </Tabs>
    </motion.div>
  );
}

function FieldBlock({
  icon: Icon,
  label,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <Label className="flex items-center gap-2 text-sm">
        <Icon className="size-4 text-muted-foreground" />
        {label}
      </Label>
      {children}
    </div>
  );
}
