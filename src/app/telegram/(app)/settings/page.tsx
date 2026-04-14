/** --- YAML
 * name: MiniAppSettingsPage
 * description: Mini App settings — account, CRES-ID slug, language, sign-out. Stub for CG6.
 * created: 2026-04-14
 * updated: 2026-04-14
 * --- */

'use client';

import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { ChevronLeft, LogOut, User, Globe, Shield, HelpCircle } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useAuthStore } from '@/stores/auth-store';
import { useTelegram } from '@/components/miniapp/telegram-provider';

export default function MiniAppSettingsPage() {
  const router = useRouter();
  const { haptic } = useTelegram();
  const { clearAuth } = useAuthStore();

  async function signOut() {
    haptic('medium');
    const supabase = createClient();
    await supabase.auth.signOut();
    clearAuth();
    try {
      sessionStorage.removeItem('cres:tg');
    } catch {}
    router.replace('/telegram');
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="space-y-5 px-5 pt-4 pb-20"
    >
      <div className="flex items-center gap-3">
        <button
          onClick={() => router.back()}
          className="flex size-9 items-center justify-center rounded-full bg-white/5"
          aria-label="Назад"
        >
          <ChevronLeft className="size-5" />
        </button>
        <h1 className="text-[22px] font-bold">Настройки</h1>
      </div>

      <ul className="divide-y divide-white/5 rounded-2xl border border-white/10 bg-white/5">
        <Row icon={User} label="Аккаунт" hint="Имя, CRES-ID, био" onClick={() => haptic('light')} />
        <Row icon={Globe} label="Язык" hint="Русский" onClick={() => haptic('light')} />
        <Row icon={Shield} label="Приватность" hint="Видимость профиля" onClick={() => haptic('light')} />
        <Row icon={HelpCircle} label="Помощь" hint="FAQ и поддержка" onClick={() => haptic('light')} />
      </ul>

      <button
        onClick={signOut}
        className="flex w-full items-center justify-center gap-2 rounded-2xl border border-rose-500/30 bg-rose-500/10 py-4 text-[14px] font-semibold text-rose-200 active:scale-[0.98] transition-transform"
      >
        <LogOut className="size-4" /> Выйти из аккаунта
      </button>
    </motion.div>
  );
}

function Row({
  icon: Icon,
  label,
  hint,
  onClick,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  hint?: string;
  onClick: () => void;
}) {
  return (
    <li>
      <button onClick={onClick} className="flex w-full items-center gap-3 px-4 py-3.5 text-left">
        <div className="flex size-9 items-center justify-center rounded-xl bg-white/5">
          <Icon className="size-4" />
        </div>
        <div className="flex-1">
          <p className="text-sm">{label}</p>
          {hint && <p className="text-[11px] text-white/45">{hint}</p>}
        </div>
      </button>
    </li>
  );
}
