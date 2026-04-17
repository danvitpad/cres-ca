/** --- YAML
 * name: Help & Support
 * description: Knowledge-base style guide for master — categorized articles + link to Telegram support chat.
 * created: 2026-04-17
 * updated: 2026-04-17
 * --- */

'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  LayoutDashboard, Calendar, Users, Scissors, DollarSign,
  MessageSquare, Settings as SettingsIcon, Zap,
  HelpCircle, ExternalLink, Mic, Bell, Shield,
} from 'lucide-react';
import { usePageTheme, FONT, FONT_FEATURES, pageContainer } from '@/lib/dashboard-theme';
import { BentoGrid, type BentoItem } from '@/components/ui/bento-grid';

const TELEGRAM_SUPPORT_URL = 'https://t.me/cres_ca_support'; // TODO: replace with real bot

interface GuideCategory {
  key: string;
  title: string;
  description: string;
  icon: typeof LayoutDashboard;
  articles: { title: string; slug: string }[];
}

const CATEGORIES: GuideCategory[] = [
  {
    key: 'getting-started',
    title: 'Начало работы',
    description: 'Первые шаги после регистрации',
    icon: Zap,
    articles: [
      { title: 'Как выбрать свою сферу деятельности', slug: 'choose-vertical' },
      { title: 'Настройка рабочих часов', slug: 'working-hours' },
      { title: 'Добавление первых услуг', slug: 'add-services' },
      { title: 'Импорт клиентов из другой системы', slug: 'import-clients' },
    ],
  },
  {
    key: 'calendar',
    title: 'Календарь и записи',
    description: 'Управление расписанием',
    icon: Calendar,
    articles: [
      { title: 'Создание записи вручную', slug: 'create-appointment' },
      { title: 'Блокировка времени (перерыв, отпуск)', slug: 'block-time' },
      { title: 'Перенос и отмена записи', slug: 'reschedule-cancel' },
      { title: 'Правила отмены для клиента', slug: 'cancellation-policy' },
    ],
  },
  {
    key: 'clients',
    title: 'Клиенты',
    description: 'База клиентов и заметки',
    icon: Users,
    articles: [
      { title: 'Добавление клиента', slug: 'add-client' },
      { title: 'Заметки мастера (голос и текст)', slug: 'client-notes' },
      { title: 'Группировка по сегментам', slug: 'segments' },
      { title: 'Умные фильтры (VIP, просрочки, риск)', slug: 'smart-filters' },
    ],
  },
  {
    key: 'finance',
    title: 'Финансы',
    description: 'Продажи, расходы, отчёты',
    icon: DollarSign,
    articles: [
      { title: 'Запись дохода и расхода', slug: 'record-income-expense' },
      { title: 'Категории расходов', slug: 'expense-categories' },
      { title: 'AI-помощник по финансам', slug: 'finance-ai' },
      { title: 'Налоговый отчёт', slug: 'tax-report' },
    ],
  },
  {
    key: 'voice-telegram',
    title: 'Telegram и голосовые',
    description: 'Голосовое управление через бота',
    icon: Mic,
    articles: [
      { title: 'Подключение Telegram-бота', slug: 'connect-telegram' },
      { title: 'Голосовая запись клиента', slug: 'voice-booking' },
      { title: 'Голосовые заметки к клиенту', slug: 'voice-notes' },
      { title: 'Голосовой учёт расходов', slug: 'voice-expense' },
      { title: 'Списание материалов голосом', slug: 'voice-inventory' },
    ],
  },
  {
    key: 'catalogue',
    title: 'Каталог услуг',
    description: 'Услуги, абонементы, склад',
    icon: Scissors,
    articles: [
      { title: 'Создание услуги', slug: 'create-service' },
      { title: 'Подкатегории и цвета', slug: 'service-categories' },
      { title: 'Продажа абонементов', slug: 'memberships' },
      { title: 'Учёт расходников на складе', slug: 'inventory' },
    ],
  },
  {
    key: 'marketing',
    title: 'Рассылки и автоматика',
    description: 'Напоминания и кампании',
    icon: MessageSquare,
    articles: [
      { title: 'Автоматические напоминания клиентам', slug: 'auto-reminders' },
      { title: 'Массовая рассылка по сегменту', slug: 'bulk-campaign' },
      { title: 'Шаблоны сообщений', slug: 'templates' },
      { title: 'Промокоды и акции', slug: 'promo-codes' },
    ],
  },
  {
    key: 'notifications',
    title: 'Уведомления',
    description: 'Настройка напоминаний',
    icon: Bell,
    articles: [
      { title: 'Уведомления мастеру о записях', slug: 'master-notifications' },
      { title: 'Уведомления клиентам', slug: 'client-notifications' },
      { title: 'Выбор каналов (Telegram / email / push)', slug: 'channels' },
    ],
  },
  {
    key: 'settings',
    title: 'Настройки аккаунта',
    description: 'Профиль, подписка, безопасность',
    icon: SettingsIcon,
    articles: [
      { title: 'Смена email, пароля, телефона', slug: 'change-credentials' },
      { title: 'Управление подпиской', slug: 'subscription' },
      { title: 'Удаление аккаунта', slug: 'delete-account' },
      { title: 'Включение/выключение модулей', slug: 'feature-toggles' },
    ],
  },
  {
    key: 'security',
    title: 'Безопасность и приватность',
    description: 'Защита данных',
    icon: Shield,
    articles: [
      { title: 'Как мы защищаем данные клиентов', slug: 'data-protection' },
      { title: 'Двухфакторная аутентификация', slug: '2fa' },
      { title: 'Политика конфиденциальности', slug: 'privacy' },
      { title: 'Экспорт данных (GDPR)', slug: 'data-export' },
    ],
  },
];

export default function HelpPage() {
  const { C, isDark, mounted } = usePageTheme();

  if (!mounted) return null;

  return (
    <div style={{
      ...pageContainer,
      color: C.text, background: C.bg, minHeight: '100%',
    }}>
      {/* ─── Hero ─── */}
      <motion.div
        initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
        style={{
          background: C.accentSoft,
          border: `1px solid ${C.aiBorder}`,
          borderRadius: 16,
          padding: '28px 32px',
          marginBottom: 28,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          flexWrap: 'wrap', gap: 20,
        }}
      >
        <div style={{ minWidth: 0, flex: 1 }}>
          <h1 style={{
            fontSize: 26, fontWeight: 650, color: C.text, letterSpacing: '-0.5px',
            margin: 0, display: 'flex', alignItems: 'center', gap: 10,
          }}>
            <HelpCircle size={24} style={{ color: C.accent }} />
            Помощь и поддержка
          </h1>
          <p style={{ fontSize: 14, color: C.textSecondary, margin: '6px 0 0', lineHeight: 1.5 }}>
            Здесь собраны гайды по всем возможностям CRES-CA. Если ничего не нашли —&nbsp;
            <a
              href={TELEGRAM_SUPPORT_URL}
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: C.accent, fontWeight: 600, textDecoration: 'none' }}
            >
              напишите нам в Telegram
            </a>.
          </p>
        </div>
        <a
          href={TELEGRAM_SUPPORT_URL}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            padding: '12px 20px', borderRadius: 10,
            background: C.accent, color: '#fff', textDecoration: 'none',
            fontSize: 14, fontWeight: 600, flexShrink: 0,
            boxShadow: isDark ? '0 4px 16px rgba(0,0,0,0.3)' : '0 4px 16px rgba(124,58,237,0.2)',
          }}
        >
          <MessageSquare size={15} />
          Чат с менеджером
          <ExternalLink size={13} style={{ opacity: 0.6 }} />
        </a>
      </motion.div>

      {/* ─── Categories (BentoGrid — 21st.dev) ─── */}
      <BentoGrid
        columns={3}
        items={CATEGORIES.map((cat): BentoItem => {
          const Icon = cat.icon;
          return {
            title: cat.title,
            description: cat.description,
            icon: <Icon className="w-4 h-4" />,
            meta: `${cat.articles.length} статей`,
            tags: cat.articles.slice(0, 2).map(a => a.title.split(' ')[0]),
            cta: 'Открыть →',
            href: `/help/${cat.key}`,
          };
        })}
      />

      {/* ─── Contact block bottom ─── */}
      <motion.div
        initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        style={{
          marginTop: 32,
          padding: '24px 28px',
          background: C.surface,
          border: `1px solid ${C.border}`,
          borderRadius: 16,
          textAlign: 'center',
        }}
      >
        <h3 style={{ fontSize: 16, fontWeight: 650, color: C.text, margin: 0 }}>
          Не нашли ответ?
        </h3>
        <p style={{ fontSize: 13, color: C.textSecondary, margin: '6px 0 14px' }}>
          Напишите нам в Telegram — отвечаем в течение рабочего дня.
        </p>
        <a
          href={TELEGRAM_SUPPORT_URL}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            padding: '10px 20px', borderRadius: 10,
            background: C.accent, color: '#fff', textDecoration: 'none',
            fontSize: 14, fontWeight: 600,
          }}
        >
          <MessageSquare size={15} />
          Открыть чат поддержки
        </a>
      </motion.div>
    </div>
  );
}
