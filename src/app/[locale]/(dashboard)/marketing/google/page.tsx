/** --- YAML
 * name: Google Business Profile Preview
 * description: Generates a ready-to-paste GBP listing preview (name, hours, services, phone, address) from master data. Copy & paste to Google Business Profile.
 * created: 2026-04-13
 * updated: 2026-04-13
 * --- */

'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Globe, Copy, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';
import { useMaster } from '@/hooks/use-master';
import { Button } from '@/components/ui/button';

interface ServiceRow {
  name: string;
  price: number;
  currency: string;
  duration_minutes: number;
}

const WEEKDAY_NAMES: Record<string, string> = {
  monday: 'Пн',
  tuesday: 'Вт',
  wednesday: 'Ср',
  thursday: 'Чт',
  friday: 'Пт',
  saturday: 'Сб',
  sunday: 'Вс',
};

export default function GoogleBusinessPage() {
  const { master } = useMaster();
  const [services, setServices] = useState<ServiceRow[]>([]);
  const [profile, setProfile] = useState<{ full_name: string | null; phone: string | null } | null>(null);

  const load = useCallback(async () => {
    if (!master?.id || !master?.profile_id) return;
    const supabase = createClient();
    const [svc, prof] = await Promise.all([
      supabase
        .from('services')
        .select('name, price, currency, duration_minutes')
        .eq('master_id', master.id)
        .eq('is_active', true)
        .order('price'),
      supabase
        .from('profiles')
        .select('full_name, phone')
        .eq('id', master.profile_id)
        .single(),
    ]);
    setServices((svc.data ?? []) as ServiceRow[]);
    setProfile((prof.data ?? null) as typeof profile);
  }, [master?.id, master?.profile_id]);

  useEffect(() => {
    load();
  }, [load]);

  const hoursLines = useMemo(() => {
    const wh = (master?.working_hours ?? {}) as Record<
      string,
      { start: string; end: string } | null
    >;
    return Object.entries(WEEKDAY_NAMES).map(([key, label]) => {
      const h = wh[key];
      return h ? `${label}: ${h.start}–${h.end}` : `${label}: выходной`;
    });
  }, [master?.working_hours]);

  const exportText = useMemo(() => {
    const title = profile?.full_name ?? master?.profile?.full_name ?? 'Мой салон';
    const phoneLine = profile?.phone ? `Телефон: ${profile.phone}` : '';
    const addressLine = master?.address ? `Адрес: ${master.address}` : '';
    const bio = master?.bio ? master.bio : '';
    const serviceLines = services
      .map(
        (s) =>
          `• ${s.name} — ${Number(s.price).toFixed(0)} ${s.currency} (${s.duration_minutes} мин)`,
      )
      .join('\n');

    return [
      `🏢 ${title}`,
      bio,
      '',
      addressLine,
      phoneLine,
      '',
      '🕐 Часы работы:',
      ...hoursLines,
      '',
      '💼 Услуги:',
      serviceLines,
      '',
      `🔗 Онлайн-запись: https://cres.ca/m/${master?.invite_code ?? ''}`,
    ]
      .filter(Boolean)
      .join('\n');
  }, [master, profile, services, hoursLines]);

  async function copyText() {
    try {
      await navigator.clipboard.writeText(exportText);
      toast.success('Скопировано');
    } catch {
      toast.error('Не удалось скопировать');
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-semibold">
          <Globe className="h-6 w-6 text-primary" />
          Google Business Profile
        </h1>
        <p className="text-sm text-muted-foreground">
          Скопируй карточку ниже и вставь в свой Google Business Profile — название, часы, услуги, телефон, ссылку на онлайн-запись.
        </p>
      </div>

      <div className="rounded-lg border bg-card p-5">
        <pre className="whitespace-pre-wrap font-sans text-sm">{exportText}</pre>
        <div className="mt-4 flex gap-2">
          <Button onClick={copyText}>
            <Copy className="mr-1 h-4 w-4" />
            Копировать
          </Button>
          <a
            href="https://business.google.com/"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 rounded-md border px-3 py-2 text-sm hover:bg-muted"
          >
            <ExternalLink className="h-4 w-4" />
            Открыть GBP
          </a>
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        Прямая OAuth-интеграция с Google Business Profile API требует верификации Google — планируется в следующих фазах.
      </p>
    </div>
  );
}
