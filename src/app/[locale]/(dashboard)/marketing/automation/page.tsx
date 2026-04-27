/** --- YAML
 * name: Marketing Automations
 * description: Мастер видит список всех автоматизаций (24h reminder, 2h reminder, review request, cadence, win-back, NPS) и может их включать/выключать. Связано с `message_templates` и cron-джобами.
 * created: 2026-04-13
 * updated: 2026-04-13
 * --- */

'use client';

import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Clock, Star, Heart, TrendingUp, BarChart3, Bell, Settings, Cake, Sparkles, Pencil } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useMaster } from '@/hooks/use-master';
import { Switch } from '@/components/ui/switch';
import { BirthdaySettingsDialog } from '@/components/marketing/birthday-settings-dialog';
import { TemplateEditorDialog, AUTOMATION_KIND_SPECS } from '@/components/marketing/template-editor-dialog';
import { humanizeError } from '@/lib/format/error';

type AutomationKey =
  | 'reminder_24h'
  | 'reminder_2h'
  | 'pre_visit_master'
  | 'review_request'
  | 'cadence'
  | 'win_back'
  | 'nps';

interface Settings {
  reminder_24h: boolean;
  reminder_2h: boolean;
  pre_visit_master: boolean;
  review_request: boolean;
  cadence: boolean;
  win_back: boolean;
  nps: boolean;
}

const DEFAULTS: Settings = {
  reminder_24h: true,
  reminder_2h: true,
  pre_visit_master: true,
  review_request: true,
  cadence: false,
  win_back: false,
  nps: false,
};

const RULES: {
  key: AutomationKey;
  title: string;
  description: string;
  trigger: string;
  icon: React.ComponentType<{ className?: string }>;
  accent: string;
}[] = [
  {
    key: 'reminder_24h',
    title: 'Напоминание за 24 часа',
    description: 'TG-пуш клиенту и мастеру за день до визита',
    trigger: 'За 24 часа до визита',
    icon: Clock,
    accent: '#6366f1',
  },
  {
    key: 'reminder_2h',
    title: 'Напоминание за 2 часа',
    description: 'TG-пуш клиенту за 2 часа до визита',
    trigger: 'За 2 часа до визита',
    icon: Bell,
    accent: '#8b5cf6',
  },
  {
    key: 'pre_visit_master',
    title: 'Бриф мастеру за 30 мин',
    description: 'TG-пуш с заметкой, аллергиями, числом визитов клиента',
    trigger: 'За 30 минут до визита',
    icon: Sparkles,
    accent: '#22d3ee',
  },
  {
    key: 'review_request',
    title: 'Запрос отзыва',
    description: 'Через 2 часа после визита — предложение оставить отзыв',
    trigger: 'Через 2 часа после визита',
    icon: Star,
    accent: '#f59e0b',
  },
  {
    key: 'cadence',
    title: 'Умное возвращение',
    description: 'Клиент перестал приходить по своей привычке — напомнить',
    trigger: 'При просрочке визита',
    icon: TrendingUp,
    accent: '#10b981',
  },
  {
    key: 'win_back',
    title: 'Возврат «спящих»',
    description: 'Клиент не был 60+ дней — вернуть со скидкой',
    trigger: 'После 60 дней без визита',
    icon: Heart,
    accent: '#ec4899',
  },
  {
    key: 'nps',
    title: 'Опрос лояльности',
    description: 'После 3, 10, 20, 50 визитов — короткий опрос «насколько порекомендуете»',
    trigger: 'После 3/10/20/50 визитов',
    icon: BarChart3,
    accent: '#06b6d4',
  },
];

export default function AutomationPage() {
  const supabase = createClient();
  const { master } = useMaster();
  const [settings, setSettings] = useState<Settings>(DEFAULTS);
  const [loading, setLoading] = useState(true);
  const [bdayDialogOpen, setBdayDialogOpen] = useState(false);
  const [editingKind, setEditingKind] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!master?.id) return;
    setLoading(true);
    const { data } = await supabase
      .from('master_automation_settings')
      .select('*')
      .eq('master_id', master.id)
      .maybeSingle();
    if (data) {
      setSettings(data as Settings);
    }
    setLoading(false);
  }, [supabase, master?.id]);

  useEffect(() => {
    load();
  }, [load]);

  async function toggle(key: AutomationKey, value: boolean) {
    if (!master?.id) return;
    const next = { ...settings, [key]: value };
    setSettings(next);
    const { error } = await supabase
      .from('master_automation_settings')
      .upsert({ master_id: master.id, ...next, updated_at: new Date().toISOString() });
    if (error) {
      toast.error(humanizeError(error));
      setSettings(settings);
    } else {
      toast.success(value ? 'Включено' : 'Выключено');
    }
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6">
      <p className="text-sm text-muted-foreground">
        Встроенные правила автоматических сообщений. Настраивай тексты, включай/выключай нужные правила и пробуй на себе.
      </p>

      {loading ? (
        <p className="text-sm text-muted-foreground">Загрузка…</p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {RULES.map((r) => {
            const Icon = r.icon;
            const enabled = settings[r.key];
            const editable = !!AUTOMATION_KIND_SPECS[r.key];
            return (
              <div
                key={r.key}
                className="rounded-2xl border bg-card p-5 transition-shadow hover:shadow-sm"
              >
                <div className="flex items-start justify-between gap-3">
                  <div
                    className="flex size-10 items-center justify-center rounded-xl"
                    style={{ backgroundColor: `${r.accent}15`, color: r.accent }}
                  >
                    <Icon className="size-5" />
                  </div>
                  <Switch
                    checked={enabled}
                    onCheckedChange={(v) => toggle(r.key, v)}
                  />
                </div>
                <div className="mt-4 font-semibold">{r.title}</div>
                <div className="mt-1 text-sm text-muted-foreground">{r.description}</div>
                <div className="mt-3 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Settings className="size-3" />
                    {r.trigger}
                  </div>
                  {editable && (
                    <button
                      type="button"
                      onClick={() => setEditingKind(r.key)}
                      className="inline-flex items-center gap-1 rounded-md border border-border bg-muted/40 px-2 py-0.5 text-[11px] font-medium text-foreground hover:bg-primary/10 hover:border-primary/40"
                      title="Редактировать текст шаблона"
                    >
                      <Pencil className="size-2.5" />
                      Шаблон
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Birthday automation — opens settings dialog inline */}
      <div className="rounded-2xl border bg-card p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div
              className="flex size-10 items-center justify-center rounded-xl"
              style={{ backgroundColor: '#f472b615', color: '#f472b6' }}
            >
              <Cake className="size-5" />
            </div>
            <div>
              <div className="font-semibold">Поздравления с днём рождения</div>
              <div className="mt-1 text-sm text-muted-foreground">
                Автоматическое поздравление клиентов + скидка-подарок (% / визиты / услуги)
              </div>
              <div className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
                <Settings className="size-3" />
                В день рождения клиента
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setBdayDialogOpen(true)}
            className="flex items-center gap-1 whitespace-nowrap rounded-lg border px-3 py-1.5 text-xs font-medium hover:bg-muted"
          >
            <Settings className="size-3" /> Настроить
          </button>
        </div>
      </div>

      {master?.id && (
        <BirthdaySettingsDialog
          open={bdayDialogOpen}
          onOpenChange={setBdayDialogOpen}
          masterId={master.id}
        />
      )}

      {master?.id && editingKind && AUTOMATION_KIND_SPECS[editingKind] && (
        <TemplateEditorDialog
          open={true}
          onOpenChange={(o) => !o && setEditingKind(null)}
          spec={AUTOMATION_KIND_SPECS[editingKind]}
          masterId={master.id}
        />
      )}
    </div>
  );
}
