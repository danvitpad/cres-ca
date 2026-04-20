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

  useEffect(() => {
    (async () => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user?.id) {
        setTelegramLinked(false);
        return;
      }
      const { data } = await supabase
        .from('profiles')
        .select('telegram_id')
        .eq('id', user.id)
        .maybeSingle();
      setTelegramLinked(Boolean(data?.telegram_id));
    })();
  }, []);

  function switchLocale(next: string) {
    if (next === locale || !pathname) return;
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
    if (error) toast.error(error.message);
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
    if (error) { toast.error(error.message); return; }
    toast.success(t('changeEmailSent') || 'Проверьте почту для подтверждения');
  }

  async function deleteAccount() {
    const ok = await confirm({
      title: t('deleteConfirmTitle'),
      description: t('deleteConfirm'),
      confirmLabel: t('deleteAccount'),
      destructive: true,
    });
    if (!ok) return;
    const confirmText = window.prompt('Введите "УДАЛИТЬ" для подтверждения', '');
    if (confirmText !== 'УДАЛИТЬ') { toast.error('Отменено'); return; }
    const password = window.prompt('Введите текущий пароль', '');
    if (!password) return;
    const res = await fetch('/api/account/delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ confirmation: confirmText, password }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      toast.error(json.error || tc('error'));
      return;
    }
    const supabase = createClient();
    await supabase.auth.signOut();
    clearAuth();
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
          onClick={() => toast.info(t('twoFactorHint'))}
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
          <Button variant="destructive" onClick={deleteAccount}>
            <Trash2 className="mr-2 size-4" />
            {t('deleteAccount')}
          </Button>
        </div>
      </Section>
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
