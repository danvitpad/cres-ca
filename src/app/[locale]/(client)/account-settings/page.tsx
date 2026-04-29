/** --- YAML
 * name: ClientSettingsPage
 * description: Настройки клиента — язык, валюта, часовой пояс, тема, связанные аккаунты, безопасность, приватность, данные.
 * created: 2026-04-12
 * updated: 2026-04-19
 * --- */

'use client';

import { useEffect, useState } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { motion } from 'framer-motion';
import { usePathname, useRouter } from 'next/navigation';
import { useTheme } from 'next-themes';
import { toast } from 'sonner';
import {
  Globe,
  DollarSign,
  Clock,
  Link2,
  Send,
  ShieldCheck,
  Lock,
  Download,
  Trash2,
  MapPin,
  EyeOff,
  Sun,
  Moon,
  AtSign,
  Phone,
  Check,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useAuthStore } from '@/stores/auth-store';
import { useConfirm } from '@/hooks/use-confirm';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { humanizeError } from '@/lib/format/error';

export default function ClientSettingsPage() {
  const t = useTranslations('clientSettings');
  const tc = useTranslations('common');
  const { clearAuth } = useAuthStore();
  const router = useRouter();
  const pathname = usePathname();
  const locale = useLocale();
  const { theme, setTheme, resolvedTheme } = useTheme();
  const confirm = useConfirm();

  const [currency, setCurrency] = useState('UAH');
  const [hideProfile, setHideProfile] = useState(false);
  const [shareLocation, setShareLocation] = useState(true);
  const [telegramLinked, setTelegramLinked] = useState<boolean | null>(null);
  const [twoFactorEnabled, setTwoFactorEnabled] = useState<boolean | null>(null);
  const [profileId, setProfileId] = useState<string | null>(null);

  // Appointment reminders preferences
  type ReminderPref = { value: number; unit: 'hours' | 'days' };
  const DEFAULT_REMINDERS: ReminderPref[] = [{ value: 1, unit: 'days' }, { value: 2, unit: 'hours' }];
  const [reminders, setReminders] = useState<ReminderPref[]>(DEFAULT_REMINDERS);
  const [remindersSaving, setRemindersSaving] = useState(false);

  // Удаление аккаунта — кастомный диалог (без window.prompt)
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState('');
  const [deletePassword, setDeletePassword] = useState('');
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    (async () => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user?.id) {
        setTelegramLinked(false);
        setTwoFactorEnabled(false);
        return;
      }
      setProfileId(user.id);
      const { data } = await supabase
        .from('profiles')
        .select('telegram_id, tg_2fa_enabled, appointment_reminders_prefs')
        .eq('id', user.id)
        .maybeSingle();
      setTelegramLinked(Boolean(data?.telegram_id));
      setTwoFactorEnabled(Boolean(data?.tg_2fa_enabled));
      const raw = (data as { appointment_reminders_prefs?: ReminderPref[] | null } | null)?.appointment_reminders_prefs;
      if (Array.isArray(raw) && raw.length > 0) setReminders(raw);
    })();
  }, []);

  async function saveReminders(next: ReminderPref[]) {
    if (!profileId) return;
    setRemindersSaving(true);
    const supabase = createClient();
    const { error } = await supabase.from('profiles').update({ appointment_reminders_prefs: next }).eq('id', profileId);
    setRemindersSaving(false);
    if (error) { toast.error(humanizeError(error)); return; }
    setReminders(next);
  }

  function addReminder() {
    if (reminders.length >= 5) { toast.info('Максимум 5 напоминаний'); return; }
    const next: ReminderPref[] = [...reminders, { value: 1, unit: 'hours' }];
    saveReminders(next);
  }

  function updateReminder(idx: number, patch: Partial<ReminderPref>) {
    const next = reminders.map((r, i) => i === idx ? { ...r, ...patch } : r);
    saveReminders(next);
  }

  function removeReminder(idx: number) {
    const next = reminders.filter((_, i) => i !== idx);
    saveReminders(next);
  }

  function switchLocale(next: string) {
    if (next === locale || !pathname) return;
    // Сохраняем выбор в профиле — чтобы Mini App и web-сессии подхватили
    // тот же язык. Ошибки сети не блокируют переключение URL.
    fetch('/api/me/ui-prefs', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ui_language: next }),
    }).catch(() => {});
    const segs = pathname.split('/');
    segs[1] = next;
    router.replace(segs.join('/'));
  }

  const isDark = (resolvedTheme ?? theme) === 'dark';

  async function exportData() {
    try {
      const res = await fetch('/api/gdpr/self-export');
      if (!res.ok) throw new Error('Export failed');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `cres-ca-export-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error(tc('error'));
    }
  }

  async function changePassword() {
    const { data: { user } } = await createClient().auth.getUser();
    if (!user?.email) {
      toast.error(tc('error'));
      return;
    }
    const { error } = await createClient().auth.resetPasswordForEmail(user.email, {
      redirectTo: `${window.location.origin}/login`,
    });
    if (error) toast.error(humanizeError(error));
    else toast.success(t('passwordResetSent'));
  }

  async function changePhone() {
    const phone = window.prompt(t('changePhone') + ' (+380...)', '');
    if (!phone) return;
    const res = await fetch('/api/account/change-phone', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: phone.trim() }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      toast.error(json.error || tc('error'));
      return;
    }
    toast.success(tc('success'));
  }

  async function changeEmail() {
    const email = window.prompt(t('changeEmail'), '');
    if (!email || !email.includes('@')) return;
    const { error } = await createClient().auth.updateUser({ email: email.trim() });
    if (error) { toast.error(humanizeError(error)); return; }
    toast.success(t('changeEmailSent') || 'Проверьте почту для подтверждения');
  }

  async function toggle2FA() {
    if (!profileId) { toast.error(tc('error')); return; }

    // Disable flow
    if (twoFactorEnabled) {
      const ok = await confirm({
        title: 'Отключить 2FA?',
        description: 'Коды подтверждения в Telegram больше не будут запрашиваться при входе.',
        confirmLabel: 'Отключить',
        destructive: true,
      });
      if (!ok) return;
      const res = await fetch('/api/auth/2fa/toggle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enable: false }),
      });
      if (!res.ok) { toast.error(tc('error')); return; }
      setTwoFactorEnabled(false);
      toast.success('2FA отключена');
      return;
    }

    // Enable flow: requires Telegram linked
    if (!telegramLinked) {
      toast.error('Сначала привяжите Telegram для получения кода');
      return;
    }

    // Step 1: send code
    const sendRes = await fetch('/api/auth/2fa/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ profile_id: profileId }),
    });
    if (!sendRes.ok) {
      const j = await sendRes.json().catch(() => ({}));
      toast.error(j.error || 'Не удалось отправить код');
      return;
    }
    toast.info('Код отправлен в ваш Telegram');

    // Step 2: enter code
    const code = window.prompt('Введите 6-значный код из Telegram', '');
    if (!code || !/^\d{6}$/.test(code.trim())) {
      toast.error('Нужен 6-значный код');
      return;
    }

    // Step 3: toggle with code verification
    const toggleRes = await fetch('/api/auth/2fa/toggle', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enable: true, code: code.trim() }),
    });
    const j = await toggleRes.json().catch(() => ({}));
    if (!toggleRes.ok) {
      toast.error(j.error === 'invalid_or_expired' ? 'Код истёк или неверный' : (j.error || tc('error')));
      return;
    }
    setTwoFactorEnabled(true);
    toast.success('2FA включена');
  }

  // Открыть кастомный диалог удаления (без браузерного prompt)
  function openDeleteDialog() {
    setDeleteConfirmation('');
    setDeletePassword('');
    setDeleteOpen(true);
  }

  async function confirmDelete() {
    if (deleteConfirmation !== 'УДАЛИТЬ' || !deletePassword || deleting) return;
    setDeleting(true);
    const res = await fetch('/api/account/delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ confirmation: deleteConfirmation, password: deletePassword }),
    });
    const json = await res.json().catch(() => ({}));
    setDeleting(false);
    if (!res.ok) {
      toast.error(humanizeError(json.error) || tc('error'));
      return;
    }
    const supabase = createClient();
    await supabase.auth.signOut();
    clearAuth();
    setDeleteOpen(false);
    router.push('/');
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className="space-y-6"
    >
      <h1 className="text-3xl font-bold tracking-tight">{t('title')}</h1>

      <Section title={t('account')}>
        <Row icon={Globe} label={t('language')}>
          <Select value={locale} onValueChange={(v) => v && switchLocale(v)}>
            <SelectTrigger className="w-[160px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ru">Русский</SelectItem>
              <SelectItem value="en">English</SelectItem>
              <SelectItem value="uk">Українська</SelectItem>
            </SelectContent>
          </Select>
        </Row>
        <Row icon={DollarSign} label={t('currency')}>
          <Select value={currency} onValueChange={(v) => v && setCurrency(v)}>
            <SelectTrigger className="w-[160px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="UAH">₴ UAH</SelectItem>
              <SelectItem value="USD">$ USD</SelectItem>
              <SelectItem value="EUR">€ EUR</SelectItem>
            </SelectContent>
          </Select>
        </Row>
        <Row icon={Clock} label={t('timezone')}>
          <span className="text-sm text-muted-foreground">
            {Intl.DateTimeFormat().resolvedOptions().timeZone}
          </span>
        </Row>
        <Row icon={isDark ? Moon : Sun} label={t('theme')}>
          <div className="inline-flex rounded-full border p-0.5 text-xs">
            <button
              onClick={() => setTheme('light')}
              className={`rounded-full px-3 py-1.5 font-medium transition-colors ${
                !isDark ? 'bg-foreground text-background' : 'text-muted-foreground'
              }`}
            >
              {t('themeLight')}
            </button>
            <button
              onClick={() => setTheme('dark')}
              className={`rounded-full px-3 py-1.5 font-medium transition-colors ${
                isDark ? 'bg-foreground text-background' : 'text-muted-foreground'
              }`}
            >
              {t('themeDark')}
            </button>
          </div>
        </Row>
      </Section>

      <Section title={t('linkedAccounts')}>
        <LinkRow
          icon={Send}
          label={t('connectTelegram')}
          rightLabel={
            telegramLinked === null
              ? ''
              : telegramLinked
                ? t('connected')
                : t('connect')
          }
          connected={telegramLinked === true}
          onClick={() => {
            if (telegramLinked) return;
            toast.info(t('connectTelegramHint'));
          }}
        />
        <LinkRow icon={Link2} label={t('connectGoogle')} rightLabel={t('connect')} />
        <LinkRow icon={Link2} label={t('connectFacebook')} rightLabel={t('connect')} />
      </Section>

      <Section title={t('security')}>
        <LinkRow icon={Lock} label={t('changePassword')} onClick={changePassword} />
        <LinkRow
          icon={ShieldCheck}
          label={t('twoFactor')}
          rightLabel={twoFactorEnabled === null ? '' : twoFactorEnabled ? 'Включено' : 'Выключено'}
          connected={twoFactorEnabled === true}
          onClick={toggle2FA}
        />
        <LinkRow
          icon={AtSign}
          label={t('changeEmail')}
          onClick={changeEmail}
        />
        <LinkRow
          icon={Phone}
          label={t('changePhone')}
          onClick={changePhone}
        />
      </Section>

      <Section title="Напоминания о записях">
        <div className="px-6 py-4 space-y-3">
          <p className="text-sm text-muted-foreground">
            Уведомление в Telegram приходит за указанное время до визита. Можно добавить до 5 напоминаний.
          </p>
          <div className="space-y-2">
            {reminders.map((r, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground w-12">за</span>
                <Select
                  value={String(r.value)}
                  onValueChange={(v) => updateReminder(idx, { value: Number(v) })}
                  disabled={remindersSaving}
                >
                  <SelectTrigger className="w-[80px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
                      <SelectItem key={n} value={String(n)}>{n}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select
                  value={r.unit}
                  onValueChange={(v) => updateReminder(idx, { unit: v as 'hours' | 'days' })}
                  disabled={remindersSaving}
                >
                  <SelectTrigger className="w-[120px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="hours">часов</SelectItem>
                    <SelectItem value="days">дней</SelectItem>
                  </SelectContent>
                </Select>
                <span className="text-sm text-muted-foreground flex-1">до визита</span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => removeReminder(idx)}
                  disabled={remindersSaving}
                  aria-label="Удалить"
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            ))}
          </div>
          {reminders.length < 5 && (
            <Button
              variant="outline"
              size="sm"
              onClick={addReminder}
              disabled={remindersSaving}
            >
              + Добавить напоминание
            </Button>
          )}
          {reminders.length === 0 && (
            <p className="text-xs text-muted-foreground">Напоминаний нет — вы не получите уведомлений о визитах.</p>
          )}
        </div>
      </Section>

      <Section title={t('privacy')}>
        <ToggleRow
          icon={EyeOff}
          label={t('hideProfile')}
          checked={hideProfile}
          onToggle={() => setHideProfile((v) => !v)}
        />
        <ToggleRow
          icon={MapPin}
          label={t('shareLocation')}
          checked={shareLocation}
          onToggle={() => setShareLocation((v) => !v)}
        />
      </Section>

      <Section title={t('data')}>
        <LinkRow icon={Download} label={t('dataExport')} onClick={exportData} />
        <div className="px-6 py-4">
          <Button variant="destructive" onClick={openDeleteDialog}>
            <Trash2 className="mr-2 size-4" />
            {t('deleteAccount')}
          </Button>
        </div>
      </Section>

      {/* Кастомный диалог удаления аккаунта (вместо нативного window.prompt).
          Soft-delete: API ставит deleted_at = now(), у клиента есть 30 дней
          на восстановление — простой логин в течение этого срока возвращает
          аккаунт. После 30 дней cron account-purge удаляет данные навсегда. */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-destructive">Удалить аккаунт</DialogTitle>
            <DialogDescription className="text-sm leading-relaxed">
              Аккаунт будет помечен на удаление. У тебя есть <strong>30 дней на восстановление</strong> — просто войди снова под этим email и пароль.
              <br /><br />
              После 30 дней все данные (записи, история, бонусы, заметки) удаляются безвозвратно.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label htmlFor="del-confirm">Введи слово «УДАЛИТЬ» для подтверждения</Label>
              <Input
                id="del-confirm"
                value={deleteConfirmation}
                onChange={(e) => setDeleteConfirmation(e.target.value)}
                placeholder="УДАЛИТЬ"
                autoComplete="off"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="del-pwd">Текущий пароль</Label>
              <Input
                id="del-pwd"
                type="password"
                value={deletePassword}
                onChange={(e) => setDeletePassword(e.target.value)}
                autoComplete="current-password"
              />
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-2">
            <Button variant="outline" onClick={() => setDeleteOpen(false)} disabled={deleting}>
              Отмена
            </Button>
            <Button
              variant="destructive"
              onClick={confirmDelete}
              disabled={deleting || deleteConfirmation !== 'УДАЛИТЬ' || !deletePassword}
            >
              {deleting ? 'Удаляем…' : 'Удалить аккаунт'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}

function Section({ title, children }: { title?: string; children: React.ReactNode }) {
  return (
    <div className="rounded-3xl border bg-card overflow-hidden">
      {title && (
        <div className="border-b px-6 py-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            {title}
          </h2>
        </div>
      )}
      <div className="divide-y">{children}</div>
    </div>
  );
}

function Row({
  icon: Icon,
  label,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-4 px-6 py-4">
      <Icon className="size-5 text-muted-foreground shrink-0" />
      <span className="flex-1 text-sm font-medium">{label}</span>
      {children}
    </div>
  );
}

function LinkRow({
  icon: Icon,
  label,
  onClick,
  rightLabel,
  connected,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  onClick?: () => void;
  rightLabel?: string;
  connected?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className="flex w-full items-center gap-4 px-6 py-4 text-left hover:bg-muted/40 transition-colors"
    >
      <Icon className="size-5 text-muted-foreground shrink-0" />
      <span className="flex-1 text-sm font-medium">{label}</span>
      {rightLabel ? (
        <span
          className={`flex items-center gap-1 text-xs font-semibold ${
            connected ? 'text-emerald-600 dark:text-emerald-300' : 'text-muted-foreground'
          }`}
        >
          {connected && <Check className="size-3.5" />}
          {rightLabel}
        </span>
      ) : (
        <span className="text-muted-foreground">›</span>
      )}
    </button>
  );
}

function ToggleRow({
  icon: Icon,
  label,
  checked,
  onToggle,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  checked: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="flex items-center gap-4 px-6 py-4">
      <Icon className="size-5 text-muted-foreground shrink-0" />
      <span className="flex-1 text-sm font-medium">{label}</span>
      <Switch checked={checked} onCheckedChange={onToggle} />
    </div>
  );
}
