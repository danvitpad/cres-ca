/** --- YAML
 * name: Settings → Feedback
 * description: Форма для отправки обратной связи в команду CRES-CA. Сохраняет в public.feedback,
 *              AI чистит, отправляет в внутренний TG-канал.
 * created: 2026-04-19
 * --- */

'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { MessageSquareHeart, Send, CheckCircle2 } from 'lucide-react';

export default function FeedbackPage() {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  async function submit() {
    if (text.trim().length < 4) {
      toast.error('Напишите подробнее — нам важен контекст');
      return;
    }
    setBusy(true);
    try {
      const res = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, source: 'web_settings' }),
      });
      if (!res.ok) {
        const j = await res.json();
        throw new Error(j.error || 'Ошибка');
      }
      setDone(true);
      setText('');
      toast.success('Команда CRES-CA благодарит вас за отзыв 💜 Мы прочитаем каждое сообщение лично!');
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <div className="mx-auto max-w-2xl space-y-6 p-6">
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-3xl border border-emerald-500/20 bg-emerald-50/30 p-10 text-center dark:bg-emerald-500/5"
        >
          <div className="mx-auto mb-4 flex size-16 items-center justify-center rounded-full bg-emerald-500/10">
            <CheckCircle2 className="size-8 text-emerald-600" />
          </div>
          <h1 className="text-xl font-bold">Команда CRES-CA благодарит вас за отзыв</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Мы стараемся сделать сервис максимально удобным и полезным. Ваш отзыв очень ценен для нас — мы прочитаем каждое сообщение лично!
          </p>
          <button
            type="button"
            onClick={() => setDone(false)}
            className="mt-6 inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-4 py-2 text-sm font-medium hover:bg-muted"
          >
            Отправить ещё
          </button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6 p-6 pb-12">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
          <MessageSquareHeart className="size-6 text-primary" />
          Обратная связь
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Что улучшить, что сломалось, какая фича нужна — напишите прямо и по делу.
          Текст автоматически очищается от мусора и попадает в нашу внутреннюю ленту.
        </p>
      </div>

      <div className="rounded-2xl border border-border bg-card p-5">
        <label className="text-sm font-medium">Ваше сообщение</label>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Пример: в календаре тяжело попадать пальцем по 15-минутным слотам на телефоне, было бы удобнее увеличить зону нажатия…"
          rows={8}
          maxLength={2000}
          className="mt-2 w-full resize-none rounded-xl border border-border bg-background p-3 text-sm outline-none focus:border-primary"
        />
        <div className="mt-1 flex items-center justify-between text-xs text-muted-foreground">
          <span>{text.length} / 2000</span>
          {text.length > 0 && text.length < 4 && <span className="text-destructive">Минимум 4 символа</span>}
        </div>

        <button
          type="button"
          onClick={submit}
          disabled={busy || text.trim().length < 4}
          className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-60"
        >
          <Send className="size-4" />
          {busy ? 'Отправка…' : 'Отправить feedback'}
        </button>
      </div>

      <div className="rounded-2xl border border-border bg-muted/20 p-5">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">или голосом — в Telegram</p>
        <p className="mt-1.5 text-sm text-muted-foreground">
          Открой нашего <a href="https://t.me/crescacom_bot" target="_blank" rel="noreferrer" className="font-semibold text-primary hover:underline">Telegram-бота</a> и отправь команду <code className="rounded bg-background px-1.5 py-0.5">/feedback</code> или просто голосовое со словами «обратная связь». AI расшифрует и передаст команде CRES-CA.
        </p>
      </div>
    </div>
  );
}
