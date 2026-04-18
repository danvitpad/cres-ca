/** --- YAML
 * name: Help & Support
 * description: Knowledge-base style guide for master. Categories + articles rendered inline (no clickable cards → no 404s). Article content is WIP per-category.
 * created: 2026-04-17
 * updated: 2026-04-18
 * --- */

'use client';

import { motion } from 'framer-motion';
import {
  LayoutDashboard, Calendar, Users, Scissors, DollarSign,
  MessageSquare, Settings as SettingsIcon, Zap,
  HelpCircle, Mic, Bell, Shield,
} from 'lucide-react';
import { usePageTheme, FONT, FONT_FEATURES, pageContainer } from '@/lib/dashboard-theme';

interface GuideCategory {
  key: string;
  title: string;
  description: string;
  icon: typeof LayoutDashboard;
  articles: string[];
}

const CATEGORIES: GuideCategory[] = [
  { key: 'getting-started', title: 'Начало работы', description: 'Первые шаги после регистрации', icon: Zap,
    articles: ['Как выбрать свою сферу деятельности', 'Настройка рабочих часов', 'Добавление первых услуг', 'Импорт клиентов из другой системы'] },
  { key: 'calendar', title: 'Календарь и записи', description: 'Управление расписанием', icon: Calendar,
    articles: ['Создание записи вручную', 'Блокировка времени (перерыв, отпуск)', 'Перенос и отмена записи', 'Правила отмены для клиента'] },
  { key: 'clients', title: 'Клиенты', description: 'База клиентов и заметки', icon: Users,
    articles: ['Добавление клиента', 'Заметки мастера (голос и текст)', 'Группировка по сегментам', 'Умные фильтры (VIP, просрочки, риск)'] },
  { key: 'finance', title: 'Финансы', description: 'Продажи, расходы, отчёты', icon: DollarSign,
    articles: ['Запись дохода и расхода', 'Категории расходов', 'AI-помощник по финансам', 'Налоговый отчёт'] },
  { key: 'voice-telegram', title: 'Telegram и голосовые', description: 'Голосовое управление через бота', icon: Mic,
    articles: ['Подключение Telegram-бота', 'Голосовая запись клиента', 'Голосовые заметки к клиенту', 'Голосовой учёт расходов', 'Списание материалов голосом'] },
  { key: 'catalogue', title: 'Каталог услуг', description: 'Услуги, абонементы, склад', icon: Scissors,
    articles: ['Создание услуги', 'Подкатегории и цвета', 'Продажа абонементов', 'Учёт расходников на складе'] },
  { key: 'marketing', title: 'Рассылки и автоматика', description: 'Напоминания и кампании', icon: MessageSquare,
    articles: ['Автоматические напоминания клиентам', 'Массовая рассылка по сегменту', 'Шаблоны сообщений', 'Промокоды и акции'] },
  { key: 'notifications', title: 'Уведомления', description: 'Настройка напоминаний', icon: Bell,
    articles: ['Уведомления мастеру о записях', 'Уведомления клиентам', 'Выбор каналов (Telegram / email / push)'] },
  { key: 'settings', title: 'Настройки аккаунта', description: 'Профиль, подписка, безопасность', icon: SettingsIcon,
    articles: ['Смена email, пароля, телефона', 'Управление подпиской', 'Удаление аккаунта', 'Включение/выключение модулей'] },
  { key: 'security', title: 'Безопасность и приватность', description: 'Защита данных', icon: Shield,
    articles: ['Как мы защищаем данные клиентов', 'Двухфакторная аутентификация', 'Политика конфиденциальности', 'Экспорт данных (GDPR)'] },
];

export default function HelpPage() {
  const { C, mounted } = usePageTheme();

  if (!mounted) return null;

  return (
    <div style={{
      ...pageContainer,
      color: C.text, background: C.bg, minHeight: '100%',
      paddingBottom: 96,
      fontFamily: FONT, fontFeatureSettings: FONT_FEATURES,
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
        }}
      >
        <h1 style={{
          fontSize: 26, fontWeight: 650, color: C.text, letterSpacing: '-0.5px',
          margin: 0, display: 'flex', alignItems: 'center', gap: 10,
        }}>
          <HelpCircle size={24} style={{ color: C.accent }} />
          Помощь и поддержка
        </h1>
        <p style={{ fontSize: 14, color: C.textSecondary, margin: '6px 0 0', lineHeight: 1.5 }}>
          Здесь собраны темы по всем возможностям CRES-CA. Подробные статьи готовятся — пока что разделы ниже дают навигацию по функциям.
        </p>
      </motion.div>

      {/* ─── Categories rendered inline (no navigation → no 404s) ─── */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
        gap: 14,
      }}>
        {CATEGORIES.map((cat, i) => {
          const Icon = cat.icon;
          return (
            <motion.div
              key={cat.key}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.03 }}
              style={{
                background: C.surface,
                border: `1px solid ${C.border}`,
                borderRadius: 14,
                padding: 18,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                <div style={{
                  width: 32, height: 32, borderRadius: 8,
                  background: C.accentSoft, color: C.accent,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <Icon size={16} />
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 650, color: C.text, lineHeight: 1.2 }}>{cat.title}</div>
                  <div style={{ fontSize: 11, color: C.textTertiary, marginTop: 2 }}>{cat.description}</div>
                </div>
              </div>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
                {cat.articles.map((title) => (
                  <li key={title} style={{
                    fontSize: 12, color: C.textSecondary,
                    padding: '6px 0',
                    borderTop: `1px solid ${C.border}`,
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8,
                  }}>
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{title}</span>
                    <span style={{
                      fontSize: 10, fontWeight: 600, flexShrink: 0,
                      color: C.textTertiary, padding: '2px 6px',
                      border: `1px solid ${C.border}`, borderRadius: 4,
                    }}>скоро</span>
                  </li>
                ))}
              </ul>
            </motion.div>
          );
        })}
      </div>

      {/* ─── Contact footer (chat button removed — no support bot yet) ─── */}
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
        <p style={{ fontSize: 13, color: C.textSecondary, margin: '6px 0 0' }}>
          Напишите нам через форму обратной связи в настройках — ответим в течение рабочего дня.
        </p>
      </motion.div>
    </div>
  );
}
