/** --- YAML
 * name: Voice Assistant (Mini App)
 * description: Master Mini App screen showcasing voice commands and recent AI action timeline. Instructs user to open the Telegram bot chat to speak. Flat cards (Phase 7.7).
 * created: 2026-04-18
 * updated: 2026-04-18
 * --- */

'use client';

import { useCallback, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Mic,
  Bell,
  Calendar,
  Receipt,
  Coins,
  NotebookPen,
  Package,
  XCircle,
  Clock,
  UserPlus,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useAuthStore } from '@/stores/auth-store';

type ActionLog = {
  id: string;
  source: 'voice' | 'automation' | 'rules';
  action_type: string;
  input_text: string | null;
  status: 'success' | 'needs_confirmation' | 'failed';
  created_at: string;
};

const COMMANDS = [
  { icon: Bell, title: 'Напоминание', example: '«Напомни позвонить Ане завтра в 10»' },
  { icon: Calendar, title: 'Новая запись', example: '«Запиши Марию на окрашивание в пятницу в 3»' },
  { icon: Receipt, title: 'Расход', example: '«Потратил 500 грн на краску»' },
  { icon: Coins, title: 'Выручка', example: '«Сегодня Аня стрижка 1200»' },
  { icon: NotebookPen, title: 'Заметка', example: '«У Марии чихуа-хуа Буся»' },
  { icon: Package, title: 'Склад', example: '«Потратил 200 мл краски»' },
  { icon: XCircle, title: 'Отмена', example: '«Отмени Анну на завтра»' },
  { icon: Clock, title: 'Перенос', example: '«Перенеси Машу на субботу на 14»' },
  { icon: UserPlus, title: 'Новый клиент', example: '«Новая клиентка Марина»' },
];

const BOT_USERNAME = process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME || 'cres_ca_bot';

export default function VoiceAssistantMiniApp() {
  const { userId } = useAuthStore();
  const [logs, setLogs] = useState<ActionLog[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!userId) return;
    const supabase = createClient();
    const { data: master } = await supabase
      .from('masters').select('id').eq('profile_id', userId).maybeSingle();
    if (!master) {
      setLoading(false);
      return;
    }
    const { data } = await supabase
      .from('ai_actions_log')
      .select('id, source, action_type, input_text, status, created_at')
      .eq('master_id', master.id)
      .order('created_at', { ascending: false })
      .limit(20);
    setLogs((data ?? []) as ActionLog[]);
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    load();
  }, [load]);

  const openBot = () => {
    const w = window as { Telegram?: { WebApp?: { openTelegramLink?: (url: string) => void } } };
    const url = `https://t.me/${BOT_USERNAME}`;
    if (w.Telegram?.WebApp?.openTelegramLink) w.Telegram.WebApp.openTelegramLink(url);
    else window.open(url, '_blank');
  };

  return (
    <div className="px-4 py-5 pb-10">
      <header className="mb-5">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-full border border-white/10 bg-white/[0.03] flex items-center justify-center">
            <Mic className="w-5 h-5 text-violet-300" />
          </div>
          <h1 className="text-xl font-semibold">Голосовой ассистент</h1>
        </div>
        <p className="text-sm text-white/50">
          Отправляй голосовые боту — я разбираю и действую.
        </p>
      </header>

      <button
        onClick={openBot}
        className="w-full rounded-2xl bg-white text-black font-medium py-3 mb-5 active:bg-white/80 transition-colors"
      >
        Открыть @{BOT_USERNAME}
      </button>

      <section className="mb-6">
        <h2 className="text-sm font-medium text-white/40 uppercase tracking-wide mb-2">
          Что я понимаю
        </h2>
        <div className="grid grid-cols-1 gap-2">
          {COMMANDS.map((cmd) => {
            const Icon = cmd.icon;
            return (
              <div
                key={cmd.title}
                className="rounded-xl border border-white/10 bg-white/[0.03] p-3 flex items-start gap-3"
              >
                <div className="w-8 h-8 rounded-lg border border-white/10 bg-white/[0.03] flex items-center justify-center shrink-0">
                  <Icon className="w-4 h-4 text-white/70" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium">{cmd.title}</div>
                  <div className="text-xs text-white/50 italic truncate">{cmd.example}</div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section>
        <h2 className="text-sm font-medium text-white/40 uppercase tracking-wide mb-2">
          Последние действия
        </h2>
        {loading ? (
          <div className="space-y-2">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-14 rounded-xl bg-white/[0.03] animate-pulse" />
            ))}
          </div>
        ) : logs.length === 0 ? (
          <div className="rounded-xl border border-dashed border-white/10 bg-white/[0.03] p-4 text-sm text-white/40 text-center">
            Пока нет голосовых команд.
          </div>
        ) : (
          <div className="space-y-2">
            {logs.map((log) => (
              <motion.div
                key={log.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                className="rounded-xl border border-white/10 bg-white/[0.03] p-3 flex items-start gap-3"
              >
                {log.status === 'success' ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                )}
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium">{log.action_type}</div>
                  {log.input_text && (
                    <div className="text-xs text-white/50 italic truncate">
                      «{log.input_text}»
                    </div>
                  )}
                  <div className="text-[11px] text-white/30 mt-0.5">
                    {new Date(log.created_at).toLocaleString('ru-RU', {
                      day: 'numeric',
                      month: 'short',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
