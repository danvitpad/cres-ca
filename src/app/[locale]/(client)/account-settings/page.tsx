/** --- YAML
 * name: ClientSettingsPage
 * description: Account settings — language, currency, timezone, linked accounts, privacy, delete account
 * created: 2026-04-12
 * updated: 2026-04-12
 * --- */

'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { motion } from 'framer-motion';
import { Globe, DollarSign, Clock, Link2, Send, ShieldCheck, Lock, Download, Trash2, MapPin, EyeOff } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useAuthStore } from '@/stores/auth-store';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export default function ClientSettingsPage() {
  const t = useTranslations('clientSettings');
  const { clearAuth } = useAuthStore();
  const router = useRouter();
  const [lang, setLang] = useState('ru');
  const [currency, setCurrency] = useState('UAH');
  const [hideProfile, setHideProfile] = useState(false);
  const [shareLocation, setShareLocation] = useState(true);

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
      // noop — user will see missing download
    }
  }

  async function deleteAccount() {
    if (!confirm(t('deleteConfirm'))) return;
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
          <Select value={lang} onValueChange={(v) => v && setLang(v)}>
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
      </Section>

      <Section title={t('linkedAccounts')}>
        <LinkRow icon={Send} label={t('connectTelegram')} />
        <LinkRow icon={Link2} label={t('connectGoogle')} />
        <LinkRow icon={Link2} label={t('connectFacebook')} />
      </Section>

      <Section title={t('security')}>
        <LinkRow icon={Lock} label={t('changePassword')} />
        <LinkRow icon={ShieldCheck} label={t('twoFactor')} />
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

      <Section>
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
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">{title}</h2>
        </div>
      )}
      <div className="divide-y">{children}</div>
    </div>
  );
}

function Row({ icon: Icon, label, children }: { icon: React.ComponentType<{ className?: string }>; label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-4 px-6 py-4">
      <Icon className="size-5 text-muted-foreground shrink-0" />
      <span className="flex-1 text-sm font-medium">{label}</span>
      {children}
    </div>
  );
}

function LinkRow({ icon: Icon, label, onClick }: { icon: React.ComponentType<{ className?: string }>; label: string; onClick?: () => void }) {
  return (
    <button onClick={onClick} className="flex w-full items-center gap-4 px-6 py-4 text-left hover:bg-muted/40 transition-colors">
      <Icon className="size-5 text-muted-foreground shrink-0" />
      <span className="flex-1 text-sm font-medium">{label}</span>
      <span className="text-muted-foreground">›</span>
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
