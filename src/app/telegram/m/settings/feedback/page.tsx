/** --- YAML
 * name: MasterMiniAppSettings/Feedback
 * description: Mobile feedback form for Mini App master. Sends to /api/feedback.
 * created: 2026-04-20
 * --- */

'use client';

import { useState } from 'react';
import { PaperPlaneTilt, Heart } from '@phosphor-icons/react';
import { useTelegram } from '@/components/miniapp/telegram-provider';
import { SettingsShell } from '@/components/miniapp/settings-shell';

const MAX = 2000;

export default function MiniAppFeedbackPage() {
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
      <SettingsShell title="Обратная связь">
        <div className="flex flex-col items-center rounded-2xl border border-emerald-200 bg-emerald-50 px-6 py-10 text-center">
          <div className="flex size-12 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-600">
            <Heart size={22} weight="fill" />
          </div>
          <p className="mt-4 text-[16px] font-semibold text-emerald-700">Команда CRES-CA благодарит вас за отзыв</p>
          <p className="mt-2 text-[12.5px] leading-relaxed text-emerald-700/80">
            Мы стараемся сделать сервис максимально удобным и полезным. Ваш отзыв очень ценен для нас — мы прочитаем каждое сообщение лично!
          </p>
          <button
            onClick={() => { setText(''); setSent(false); }}
            className="mt-6 rounded-full border border-neutral-200 bg-neutral-50 px-4 py-2 text-[12px] font-semibold text-neutral-800 active:bg-neutral-100"
          >
            Написать ещё
          </button>
        </div>
      </SettingsShell>
    );
  }

  return (
    <SettingsShell title="Обратная связь" subtitle="Напиши что улучшить, что сломано, какая фича нужна">
      <div>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value.slice(0, MAX))}
          placeholder="Например: в календаре тяжело попадать пальцем по 15-минутным слотам, было бы удобнее…"
          rows={8}
          className="w-full resize-none rounded-2xl border border-neutral-200 bg-white px-4 py-3 text-[13px] leading-relaxed text-neutral-900 placeholder:text-neutral-400 focus:border-violet-400 focus:outline-none"
        />
        <div className="mt-1.5 flex items-center justify-between px-1">
          <p className="text-[11px] text-neutral-400">{text.length} / {MAX}</p>
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
            <PaperPlaneTilt size={15} weight="fill" />
            Отправить
          </>
        )}
      </button>
      <div className="rounded-2xl border border-neutral-200 bg-white p-4">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500">или голосом — в Telegram</p>
        <p className="mt-1.5 text-[12px] leading-relaxed text-neutral-700">
          Открой нашего <a href="https://t.me/crescacom_bot" target="_blank" rel="noreferrer" className="font-semibold text-violet-600 underline">Telegram-бота</a> и отправь команду <code className="rounded bg-white/10 px-1 text-violet-700">/feedback</code> или голосовое со словами «обратная связь». AI расшифрует и передаст команде CRES-CA.
        </p>
      </div>
    </SettingsShell>
  );
}
