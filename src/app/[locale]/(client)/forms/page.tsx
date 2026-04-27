/** --- YAML
 * name: ClientIntakeFormPage
 * description: Anamnesis / health questionnaire. One-time interactive form prompted on first booking, editable later.
 * created: 2026-04-13
 * updated: 2026-04-13
 * --- */

'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { Heart, Plus, X, CheckCircle2, AlertCircle, ArrowRight } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useAuthStore } from '@/stores/auth-store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { humanizeError } from '@/lib/format/error';

interface HealthProfile {
  allergies: string[];
  chronic_conditions: string[];
  medications: string[];
  contraindications: string[];
  pregnancy: boolean;
  notes: string | null;
}

const EMPTY: HealthProfile = {
  allergies: [],
  chronic_conditions: [],
  medications: [],
  contraindications: [],
  pregnancy: false,
  notes: '',
};

export default function ClientIntakeFormPage() {
  const t = useTranslations('intake');
  const tc = useTranslations('common');
  const { userId } = useAuthStore();
  const router = useRouter();
  const searchParams = useSearchParams();
  const isPrompt = searchParams.get('prompt') === 'intake';

  const [data, setData] = useState<HealthProfile>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [existed, setExisted] = useState(false);

  useEffect(() => {
    if (!userId) return;
    async function load() {
      const supabase = createClient();
      const { data: row } = await supabase
        .from('client_health_profiles')
        .select('allergies, chronic_conditions, medications, contraindications, pregnancy, notes')
        .eq('profile_id', userId)
        .maybeSingle();
      if (row) {
        setData({
          allergies: row.allergies ?? [],
          chronic_conditions: row.chronic_conditions ?? [],
          medications: row.medications ?? [],
          contraindications: row.contraindications ?? [],
          pregnancy: row.pregnancy ?? false,
          notes: row.notes ?? '',
        });
        setExisted(true);
      }
      setLoading(false);
    }
    load();
  }, [userId]);

  async function save() {
    if (!userId) return;
    setSaving(true);
    const supabase = createClient();
    const { error } = await supabase.from('client_health_profiles').upsert({
      profile_id: userId,
      allergies: data.allergies,
      chronic_conditions: data.chronic_conditions,
      medications: data.medications,
      contraindications: data.contraindications,
      pregnancy: data.pregnancy,
      notes: data.notes,
      updated_at: new Date().toISOString(),
    });
    setSaving(false);
    if (error) {
      toast.error(humanizeError(error));
      return;
    }
    toast.success(t('saved'));
    if (isPrompt) router.push('/appointments');
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-2xl space-y-6 p-[var(--space-page)]">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6 p-[var(--space-page)]">
      {/* Hero */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="overflow-hidden rounded-3xl border border-border/60 bg-gradient-to-br from-rose-500/10 via-pink-500/5 to-card p-6 shadow-[var(--shadow-card)]"
      >
        <div className="flex items-start gap-4">
          <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-rose-500 to-pink-500 text-white shadow-md">
            <Heart className="size-5" />
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="text-xl font-semibold tracking-tight">{t('title')}</h1>
            <p className="mt-1 text-sm text-muted-foreground">{t('subtitle')}</p>
            {existed && (
              <p className="mt-2 flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 className="size-3.5" />
                {t('alreadyFilled')}
              </p>
            )}
          </div>
        </div>
      </motion.div>

      {/* Sections */}
      <TagSection
        title={t('allergiesTitle')}
        desc={t('allergiesDesc')}
        placeholder={t('allergiesPlaceholder')}
        items={data.allergies}
        onChange={(v) => setData({ ...data, allergies: v })}
      />
      <TagSection
        title={t('chronicTitle')}
        desc={t('chronicDesc')}
        placeholder={t('chronicPlaceholder')}
        items={data.chronic_conditions}
        onChange={(v) => setData({ ...data, chronic_conditions: v })}
      />
      <TagSection
        title={t('medicationsTitle')}
        desc={t('medicationsDesc')}
        placeholder={t('medicationsPlaceholder')}
        items={data.medications}
        onChange={(v) => setData({ ...data, medications: v })}
      />
      <TagSection
        title={t('contraindicationsTitle')}
        desc={t('contraindicationsDesc')}
        placeholder={t('contraindicationsPlaceholder')}
        items={data.contraindications}
        onChange={(v) => setData({ ...data, contraindications: v })}
      />

      {/* Pregnancy toggle */}
      <label className="flex cursor-pointer items-center justify-between rounded-2xl border border-border/60 bg-card p-5 shadow-[var(--shadow-card)]">
        <div>
          <p className="text-sm font-semibold">{t('pregnancyTitle')}</p>
          <p className="text-xs text-muted-foreground">{t('pregnancyDesc')}</p>
        </div>
        <input
          type="checkbox"
          checked={data.pregnancy}
          onChange={(e) => setData({ ...data, pregnancy: e.target.checked })}
          className="size-5 cursor-pointer accent-[var(--ds-accent)]"
        />
      </label>

      {/* Free-text notes */}
      <div className="space-y-2 rounded-2xl border border-border/60 bg-card p-5 shadow-[var(--shadow-card)]">
        <Label htmlFor="notes" className="text-sm font-semibold">{t('notesTitle')}</Label>
        <p className="text-xs text-muted-foreground">{t('notesDesc')}</p>
        <Textarea
          id="notes"
          value={data.notes ?? ''}
          onChange={(e) => setData({ ...data, notes: e.target.value })}
          placeholder={t('notesPlaceholder')}
          className="min-h-[96px]"
        />
      </div>

      {/* Privacy disclaimer */}
      <div className="flex items-start gap-3 rounded-2xl border border-amber-300/40 bg-amber-50/60 p-4 text-xs text-amber-900 dark:bg-amber-950/40 dark:text-amber-100">
        <AlertCircle className="size-4 shrink-0 mt-0.5" />
        <p>{t('privacy')}</p>
      </div>

      {/* Save */}
      <div className="sticky bottom-20 z-10 flex justify-end">
        <Button
          onClick={save}
          disabled={saving}
          size="lg"
          className="gap-2 shadow-[var(--shadow-elevated)]"
        >
          {saving ? tc('loading') : existed ? t('update') : t('finish')}
          <ArrowRight className="size-4" />
        </Button>
      </div>
    </div>
  );
}

function TagSection({
  title, desc, placeholder, items, onChange,
}: {
  title: string;
  desc: string;
  placeholder: string;
  items: string[];
  onChange: (items: string[]) => void;
}) {
  const [draft, setDraft] = useState('');

  function add() {
    const v = draft.trim();
    if (!v) return;
    if (items.includes(v)) { setDraft(''); return; }
    onChange([...items, v]);
    setDraft('');
  }

  function remove(idx: number) {
    onChange(items.filter((_, i) => i !== idx));
  }

  return (
    <div className="space-y-3 rounded-2xl border border-border/60 bg-card p-5 shadow-[var(--shadow-card)]">
      <div>
        <p className="text-sm font-semibold">{title}</p>
        <p className="text-xs text-muted-foreground">{desc}</p>
      </div>
      <div className="flex gap-2">
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); add(); } }}
          placeholder={placeholder}
          className="h-10"
        />
        <Button type="button" onClick={add} variant="outline" size="icon" className="shrink-0">
          <Plus className="size-4" />
        </Button>
      </div>
      {items.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {items.map((it, i) => (
            <span
              key={`${it}-${i}`}
              className="inline-flex items-center gap-1 rounded-full bg-[var(--ds-accent)]/10 px-3 py-1 text-xs font-medium text-[var(--ds-accent)]"
            >
              {it}
              <button type="button" onClick={() => remove(i)} className="opacity-60 hover:opacity-100">
                <X className="size-3" />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
