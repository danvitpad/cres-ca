/** --- YAML
 * name: MasterMiniAppSettings/Help
 * description: Mobile FAQ/Help for Mini App master — collapsible Q&A + contact Telegram link.
 * created: 2026-04-20
 * --- */

'use client';

import { useState } from 'react';
import Link from 'next/link';
import { CaretDown, ChatCircle } from '@phosphor-icons/react';
import { AnimatePresence, motion } from 'framer-motion';
import { SettingsShell } from '@/components/miniapp/settings-shell';

const FAQ: Array<{ q: string; a: string }> = [
  {
    q: 'Как использовать голосового ассистента?',
    a: 'Отправь голосовое сообщение CRES-CA боту в Telegram. AI распознаёт: "напомни", "запиши", "потратил", "аренда каждое N-е число", "заказать у поставщика", "добавь ДР клиенту", и другие. Полный список — в настройках → Голосовой помощник.',
  },
  {
    q: 'Как пригласить клиента?',
    a: 'Открой профиль клиента в календаре, скопируй ссылку-приглашение и отправь в Telegram/Viber/email. Клиент переходит по ссылке → открывается Mini App → онбординг за 30 секунд.',
  },
  {
    q: 'Что делать если AI не понял?',
    a: 'AI отвечает "не понял" только если фраза слишком короткая или непонятная. Переформулируй: начни с глагола действия (напомни / запиши / потратил / отмени / заказать). Если AI-сервис перегружен — попробуй через 10-20 секунд.',
  },
  {
    q: 'Как перенести запись клиента?',
    a: 'Два способа: (1) голосом боту — "перенеси Иру с пятницы на субботу 14:00", AI найдёт запись и обновит. (2) Открой запись в календаре → кнопка Перенести.',
  },
  {
    q: 'Как заказать товар у поставщика?',
    a: 'Сначала добавь поставщика в Каталог → Поставщики (с email или Telegram-ID). Потом голосом: "заказать у Ивана 5 кг краски, отправить в телеграм". Бот покажет карточку заказа с кнопками [Telegram] [Email] [PDF].',
  },
  {
    q: 'Что значит пробный период?',
    a: 'Триал даёт полный доступ ко всем функциям на 14 дней. Никаких ограничений. После — выберешь тариф или останешься на бесплатном Старте. Данные не удаляются.',
  },
];

function Item({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <li className="border-b border-white/5 last:border-b-0">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-3 px-4 py-3.5 text-left active:bg-white border-neutral-200 transition-colors"
      >
        <span className="flex-1 text-[13px] font-medium leading-snug">{q}</span>
        <CaretDown
          size={14}
          weight="bold"
          className={`shrink-0 text-neutral-400 transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <p className="px-4 pb-3 pt-0 text-[12.5px] leading-relaxed text-neutral-700 whitespace-pre-wrap">
              {a}
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </li>
  );
}

export default function MiniAppHelpPage() {
  return (
    <SettingsShell title="Помощь">
      <ul className="overflow-hidden rounded-2xl border border-neutral-200 bg-white border-neutral-200">
        {FAQ.map((f, i) => <Item key={i} q={f.q} a={f.a} />)}
      </ul>
      <Link
        href="/telegram/m/settings/feedback"
        className="flex items-center gap-3 rounded-2xl border border-violet-300 bg-violet-100 px-4 py-3.5 active:bg-violet-500/25 transition-colors"
      >
        <ChatCircle size={18} weight="fill" className="text-violet-700" />
        <div>
          <p className="text-[13px] font-semibold text-violet-100">Нужна помощь с чем-то ещё?</p>
          <p className="text-[11px] text-violet-600/70">Напиши в обратную связь — отвечу лично</p>
        </div>
      </Link>
    </SettingsShell>
  );
}
