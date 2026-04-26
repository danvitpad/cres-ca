/** --- YAML
 * name: ClientMiniAppSettings/Feedback
 * description: Feedback form for client Mini App. Text + reference to voice via TG bot. POSTs to /api/feedback with source=mobile.
 * created: 2026-04-21
 * --- */

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { ChevronLeft, Heart, Send } from 'lucide-react';
import { useTelegram } from '@/components/miniapp/telegram-provider';

const MAX = 2000;

export default function ClientMiniAppFeedbackPage() {
  const router = useRouter();
  const { haptic } = useTelegram();
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  async function send() {
    const t = text.trim();
    if (t.length < 4 || sending) return;
    setSending(true);
    haptic('medium');
    try {
      const res = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: t, source: 'mobile' }),
      });
      if (res.ok) {
        setSent(true);
        haptic('success');
      } else {
        haptic('error');
      }
    } catch {
      haptic('error');
    } finally {
      setSending(false);
    }
  }

  if (sent) {
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
            className="flex size-9 items-center justify-center rounded-full border border-neutral-200 bg-white border-neutral-200 active:bg-neutral-50 transition-colors"
            aria-label="Назад"
          >
            <ChevronLeft className="size-5" />
          </button>
          <h1 className="text-[22px] font-bold">Обратная связь</h1>
        </div>

        <div className="flex flex-col items-center rounded-2xl border border-emerald-200 bg-emerald-50 px-6 py-10 text-center">
          <div className="flex size-12 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-600">
            <Heart size={22} fill="currentColor" />
          </div>
          <p className="mt-4 text-[16px] font-semibold text-emerald-100">Команда CRES-CA благодарит вас за отзыв</p>
          <p className="mt-2 text-[12.5px] leading-relaxed text-emerald-700/80">
            Мы стараемся сделать сервис максимально удобным и полезным. Ваш отзыв очень ценен для нас — я прочитаю каждое сообщение лично.
          </p>
          <button
            onClick={() => {
              setText('');
              setSent(false);
            }}
            className="mt-6 rounded-full border border-neutral-200 bg-neutral-50 px-4 py-2 text-[12px] font-semibold text-neutral-800 active:bg-neutral-100"
          >
            Написать ещё
          </button>
        </div>
      </motion.div>
    );
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
          className="flex size-9 items-center justify-center rounded-full border border-neutral-200 bg-white border-neutral-200 active:bg-neutral-50 transition-colors"
          aria-label="Назад"
        >
          <ChevronLeft className="size-5" />
        </button>
        <div>
          <h1 className="text-[22px] font-bold">Обратная связь</h1>
          <p className="text-[12px] text-neutral-500">Напишите что улучшить, что не работает, какая фича нужна</p>
        </div>
      </div>

      <div>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value.slice(0, MAX))}
          placeholder="Например: хотелось бы видеть напоминания за 2 часа, а не только за сутки…"
          rows={8}
          className="w-full resize-none rounded-2xl border border-neutral-200 bg-white border-neutral-200 px-4 py-3 text-[13px] leading-relaxed text-neutral-900 placeholder:text-neutral-400 focus:border-violet-400 focus:outline-none"
        />
        <div className="mt-1.5 flex items-center justify-between px-1">
          <p className="text-[11px] text-neutral-400">
            {text.length} / {MAX}
          </p>
          <p className="text-[11px] text-neutral-400">AI автоматически уберёт мусор</p>
        </div>
      </div>

      <button
        onClick={send}
        disabled={text.trim().length < 4 || sending}
        className="flex w-full items-center justify-center gap-2 rounded-2xl bg-violet-500 py-3.5 text-[14px] font-semibold text-neutral-900 active:bg-violet-600 transition-colors disabled:opacity-40"
      >
        {sending ? (
          'Отправка…'
        ) : (
          <>
            <Send size={15} />
            Отправить
          </>
        )}
      </button>

      <div className="rounded-2xl border border-neutral-200 bg-white border-neutral-200 p-4">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500">или голосом — в Telegram</p>
        <p className="mt-1.5 text-[12px] leading-relaxed text-neutral-700">
          Открой нашего <a href="https://t.me/cres_ca_bot" target="_blank" rel="noreferrer" className="font-semibold text-violet-600 underline">Telegram-бота</a> и отправь команду <code className="rounded bg-white/10 px-1 text-violet-700">/feedback</code> или голосовое со словами «обратная связь». AI расшифрует и передаст команде CRES-CA.
        </p>
      </div>
    </motion.div>
  );
}
