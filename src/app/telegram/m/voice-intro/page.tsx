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
import { T, R } from '@/components/miniapp/design';

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
      style={{ background: T.bg, color: T.text, minHeight: '100dvh' }}
    >
      <div className="text-center">
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.05, type: 'spring', stiffness: 220, damping: 20 }}
          className="mx-auto flex size-16 items-center justify-center"
          style={{
            background: T.accentSoft,
            border: `1px solid ${T.borderSubtle}`,
            borderRadius: R.lg,
          }}
        >
          <Mic className="size-7" style={{ color: T.accent }} />
        </motion.div>
        <p
          className="mt-4 text-[10px] font-semibold uppercase tracking-[0.2em]"
          style={{ color: T.accent }}
        >
          Новое
        </p>
        <h1 className="mt-1 text-2xl font-bold" style={{ color: T.text }}>Познакомься с голосом</h1>
        <p
          className="mx-auto mt-2 max-w-sm text-[13px]"
          style={{ color: T.textSecondary }}
        >
          Управляй CRM голосом из Telegram. Запись, расход, клиент, напоминание — одна команда и готово.
        </p>
      </div>

      <div
        className="relative overflow-hidden p-4"
        style={{
          background: T.surface,
          border: `1px solid ${T.border}`,
          borderRadius: R.lg,
        }}
      >
        <span
          className="absolute inset-y-3 left-0 w-1 rounded-r-full"
          style={{ background: T.accent }}
        />
        <div className="pl-3">
          <div className="flex items-center gap-2">
            <Sparkles className="size-4" style={{ color: T.accent }} />
            <p
              className="text-[11px] font-semibold uppercase tracking-wide"
              style={{ color: T.accent }}
            >
              Как это работает
            </p>
          </div>
          <ol
            className="mt-2 space-y-1.5 text-[13px]"
            style={{ color: T.textSecondary }}
          >
            <li><span style={{ color: T.textTertiary }}>1.</span> Открой чат бота в Telegram</li>
            <li><span style={{ color: T.textTertiary }}>2.</span> Запиши голосовое — одна фраза</li>
            <li><span style={{ color: T.textTertiary }}>3.</span> Получи подтверждение — запись в базе</li>
          </ol>
        </div>
      </div>

      <div>
        <p
          className="mb-2 px-1 text-[10px] font-semibold uppercase tracking-wide"
          style={{ color: T.textTertiary }}
        >
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
                className="flex items-start gap-3 p-3.5"
                style={{
                  background: T.surface,
                  border: `1px solid ${T.border}`,
                  borderRadius: R.lg,
                }}
              >
                <div
                  className="flex size-9 shrink-0 items-center justify-center"
                  style={{
                    background: T.accentSoft,
                    border: `1px solid ${T.borderSubtle}`,
                    borderRadius: R.sm,
                  }}
                >
                  <Icon className="size-4" style={{ color: T.accent }} />
                </div>
                <div className="min-w-0">
                  <p className="text-[12px] font-semibold" style={{ color: T.text }}>{s.title}</p>
                  <p
                    className="mt-0.5 text-[12px] italic"
                    style={{ color: T.textSecondary }}
                  >
                    {s.text}
                  </p>
                </div>
              </motion.li>
            );
          })}
        </ul>
      </div>

      <div className="space-y-2 pt-2">
        <button
          onClick={openBot}
          className="flex w-full items-center justify-center gap-2 py-4 text-sm font-semibold transition-colors active:opacity-90"
          style={{
            background: T.accent,
            color: T.accentText,
            borderRadius: R.lg,
          }}
        >
          <Mic className="size-4" /> Отправить тестовое в @{BOT_USERNAME}
        </button>
        <button
          onClick={skip}
          className="w-full py-3 text-[13px] font-semibold transition-colors active:opacity-80"
          style={{
            background: 'transparent',
            border: `1px solid ${T.border}`,
            color: T.textSecondary,
            borderRadius: R.lg,
          }}
        >
          Позже
        </button>
      </div>
    </motion.div>
  );
}
