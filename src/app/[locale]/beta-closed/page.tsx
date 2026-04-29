/** --- YAML
 * name: Beta Closed Page
 * description: Welcome для тех, кто пытается зарегистрироваться вне бета-списка.
 *   Объясняет что сервис в стадии тестирования, как попасть в бета-список.
 *   Кнопка ведёт на TG-бота с deep-link `?start=beta` — там бот спросит почту
 *   и создаст заявку.
 * created: 2026-04-29
 * --- */

import Link from 'next/link';
import { ArrowLeft, Send, ShieldCheck, Sparkles } from 'lucide-react';

const BOT_BETA_URL = 'https://t.me/crescacom_bot?start=beta';

export default async function BetaClosedPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  return (
    <div className="min-h-[100dvh] bg-[var(--background)] text-[var(--foreground)]">
      <div className="mx-auto flex min-h-[100dvh] max-w-[640px] flex-col px-6 pt-16 pb-12">
        {/* Back link */}
        <Link
          href={`/${locale}`}
          className="mb-12 inline-flex w-fit items-center gap-2 text-sm text-[color-mix(in_oklab,var(--foreground)_60%,transparent)] transition-colors hover:text-[var(--foreground)]"
        >
          <ArrowLeft size={16} />
          На главную
        </Link>

        {/* Hero */}
        <div className="mb-10">
          <div className="mb-6 inline-flex size-14 items-center justify-center rounded-2xl bg-[color-mix(in_oklab,var(--color-accent)_15%,transparent)] text-[var(--color-accent)]">
            <ShieldCheck size={28} strokeWidth={1.8} />
          </div>
          <h1 className="text-3xl font-bold tracking-tight md:text-4xl">
            Сервис в бета-тестировании
          </h1>
          <p className="mt-4 text-base text-[color-mix(in_oklab,var(--foreground)_70%,transparent)] md:text-lg">
            Сейчас CRES-CA доступен только участникам закрытого тестирования. Мы дорабатываем продукт и хотим, чтобы первые пользователи получили качественный сервис без сюрпризов.
          </p>
        </div>

        {/* Benefits of joining beta */}
        <div className="mb-10 rounded-2xl border border-[color-mix(in_oklab,var(--foreground)_12%,transparent)] bg-[color-mix(in_oklab,var(--foreground)_3%,transparent)] p-6">
          <div className="mb-3 inline-flex items-center gap-2 text-sm font-semibold text-[var(--color-accent)]">
            <Sparkles size={16} />
            Что вы получаете как бета-тестировщик
          </div>
          <ul className="space-y-3 text-sm leading-relaxed">
            <li className="flex gap-3">
              <span className="mt-1 size-1.5 shrink-0 rounded-full bg-[var(--color-accent)]" />
              <span>
                <b>Полный функционал бесплатно</b> — все возможности максимального тарифа на 6 месяцев после релиза.
              </span>
            </li>
            <li className="flex gap-3">
              <span className="mt-1 size-1.5 shrink-0 rounded-full bg-[var(--color-accent)]" />
              <span>
                <b>Прямое влияние на продукт</b> — ваши пожелания и баг-репорты идут напрямую в работу.
              </span>
            </li>
            <li className="flex gap-3">
              <span className="mt-1 size-1.5 shrink-0 rounded-full bg-[var(--color-accent)]" />
              <span>
                <b>Ранний доступ</b> к новым функциям до того, как они появятся у всех.
              </span>
            </li>
          </ul>
        </div>

        {/* Honest disclaimer */}
        <div className="mb-10 rounded-2xl border border-amber-200/30 bg-amber-50/30 p-5 text-sm leading-relaxed dark:border-amber-200/10 dark:bg-amber-200/5">
          <p className="font-semibold">Будем честны</p>
          <p className="mt-1 text-[color-mix(in_oklab,var(--foreground)_75%,transparent)]">
            Бета-период — это когда продукт уже работает, но могут встречаться баги и неудобства. Мы быстро всё чиним по мере того, как вы сообщаете о проблемах. Если хотите идеально стабильный сервис — дождитесь публичного релиза.
          </p>
        </div>

        {/* CTA */}
        <div className="mt-auto">
          <a
            href={BOT_BETA_URL}
            target="_blank"
            rel="noopener"
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[var(--color-accent)] py-4 text-base font-semibold text-white transition-opacity hover:opacity-90"
          >
            <Send size={18} />
            Подать заявку через Telegram
          </a>
          <p className="mt-3 text-center text-xs text-[color-mix(in_oklab,var(--foreground)_50%,transparent)]">
            Откроется чат с ботом @crescacom_bot — он попросит вашу почту и передаст заявку нам. Обычно отвечаем в течение суток.
          </p>
        </div>
      </div>
    </div>
  );
}
