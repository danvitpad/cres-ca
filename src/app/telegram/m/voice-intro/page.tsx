/** --- YAML
 * name: VoiceAssistantIntro
 * description: One-time onboarding screen introducing the voice assistant — demo commands, open bot CTA. Gated by localStorage flag `cres:voice-intro-seen` (Phase 8.1).
 * created: 2026-04-18
 * updated: 2026-04-18
 * --- */

'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { Mic, Calendar, Receipt, NotebookPen, Clock, UserPlus, Sparkles } from 'lucide-react';
import { useTelegram } from '@/components/miniapp/telegram-provider';

const SAMPLES = [
  { icon: Calendar, title: 'Запись', text: '«Запиши Марию на окрашивание в пятницу в 3»' },
  { icon: Receipt, title: 'Расход', text: '«Потратил 500 грн на краску»' },
  { icon: UserPlus, title: 'Клиент', text: '«Новая клиентка Марина, телефон 0671234567»' },
  { icon: NotebookPen, title: 'Заметка', text: '«У Ани аллергия на аммиак»' },
  { icon: Clock, title: 'Перенос', text: '«Перенеси Машу на субботу на 14»' },
];

const BOT_USERNAME = process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME || 'crescacom_bot';

export default function VoiceAssistantIntro() {
  const router = useRouter();
  const { haptic } = useTelegram();

  useEffect(() => {
    try { localStorage.setItem('cres:voice-intro-seen', '1'); } catch { /* ignore */ }
  }, []);

  const openBot = () => {
    haptic('medium');
    const w = window as { Telegram?: { WebApp?: { openTelegramLink?: (url: string) => void } } };
    const url = `https://t.me/${BOT_USERNAME}?start=voice_demo`;
    if (w.Telegram?.WebApp?.openTelegramLink) w.Telegram.WebApp.openTelegramLink(url);
    else window.open(url, '_blank');
  };

  const skip = () => {
    haptic('light');
    router.replace('/telegram/m/home');
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="space-y-6 px-5 pt-8 pb-10"
    >
      <div className="text-center">
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.05, type: 'spring', stiffness: 220, damping: 20 }}
          className="mx-auto flex size-16 items-center justify-center rounded-2xl border border-neutral-200 bg-white"
        >
          <Mic className="size-7 text-violet-600" />
        </motion.div>
        <p className="mt-4 text-[10px] font-semibold uppercase tracking-[0.2em] text-violet-600">Новое</p>
        <h1 className="mt-1 text-2xl font-bold">Познакомься с голосом</h1>
        <p className="mx-auto mt-2 max-w-sm text-[13px] text-neutral-600">
          Управляй CRM голосом из Telegram. Запись, расход, клиент, напоминание — одна команда и готово.
        </p>
      </div>

      <div className="relative overflow-hidden rounded-2xl border border-neutral-200 bg-white p-4">
        <span className="absolute inset-y-3 left-0 w-1 rounded-r-full bg-violet-500" />
        <div className="pl-3">
          <div className="flex items-center gap-2">
            <Sparkles className="size-4 text-violet-600" />
            <p className="text-[11px] font-semibold uppercase tracking-wide text-violet-700">Как это работает</p>
          </div>
          <ol className="mt-2 space-y-1.5 text-[13px] text-neutral-700">
            <li><span className="text-neutral-400">1.</span> Открой чат бота в Telegram</li>
            <li><span className="text-neutral-400">2.</span> Запиши голосовое — одна фраза</li>
            <li><span className="text-neutral-400">3.</span> Получи подтверждение — запись в базе</li>
          </ol>
        </div>
      </div>

      <div>
        <p className="mb-2 px-1 text-[10px] font-semibold uppercase tracking-wide text-neutral-400">
          Попробуй одну из команд
        </p>
        <ul className="space-y-2">
          {SAMPLES.map((s, i) => {
            const Icon = s.icon;
            return (
              <motion.li
                key={s.title}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 + i * 0.04 }}
                className="flex items-start gap-3 rounded-2xl border border-neutral-200 bg-white p-3.5"
              >
                <div className="flex size-9 shrink-0 items-center justify-center rounded-xl border border-neutral-200 bg-white">
                  <Icon className="size-4 text-neutral-700" />
                </div>
                <div className="min-w-0">
                  <p className="text-[12px] font-semibold">{s.title}</p>
                  <p className="mt-0.5 text-[12px] italic text-neutral-600">{s.text}</p>
                </div>
              </motion.li>
            );
          })}
        </ul>
      </div>

      <div className="space-y-2 pt-2">
        <button
          onClick={openBot}
          className="flex w-full items-center justify-center gap-2 rounded-2xl bg-white py-4 text-sm font-semibold text-black transition-colors active:bg-white/80"
        >
          <Mic className="size-4" /> Отправить тестовое в @{BOT_USERNAME}
        </button>
        <button
          onClick={skip}
          className="w-full rounded-2xl border border-neutral-200 bg-white py-3 text-[13px] font-semibold text-neutral-700 transition-colors active:bg-neutral-50"
        >
          Позже
        </button>
      </div>
    </motion.div>
  );
}
