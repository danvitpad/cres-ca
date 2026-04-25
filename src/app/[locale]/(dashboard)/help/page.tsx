/** --- YAML
 * name: Help & Support
 * description: Knowledge-base style guide for master. Categories with expandable articles
 *              (full content from `lib/help/articles`) — no more "скоро" placeholders.
 *              Footer has CTA to Telegram support bot (stub URL until real bot is wired).
 * created: 2026-04-17
 * updated: 2026-04-25
 * --- */

'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard, Calendar, Users, Scissors, DollarSign,
  MessageSquare, Settings as SettingsIcon, Zap,
  HelpCircle, Mic, Bell, Shield, ChevronDown, Send,
} from 'lucide-react';
import { usePageTheme, FONT, FONT_FEATURES, pageContainer } from '@/lib/dashboard-theme';
import { HELP_CATEGORIES, type HelpCategory } from '@/lib/help/articles';

/**
 * Replace this URL once the real support bot is configured.
 * Currently a stub — see CLAUDE.md TODO "TG support bot stub".
 */
const SUPPORT_BOT_URL = 'https://t.me/cres_ca_bot?start=support';

const ICON_BY_KEY: Record<string, typeof LayoutDashboard> = {
  'getting-started': Zap,
  'calendar': Calendar,
  'clients': Users,
  'finance': DollarSign,
  'voice-telegram': Mic,
  'catalogue': Scissors,
  'marketing': MessageSquare,
  'notifications': Bell,
  'settings': SettingsIcon,
  'security': Shield,
};

export default function HelpPage() {
  const { C, mounted } = usePageTheme();
  const [openArticle, setOpenArticle] = useState<string | null>(null);

  if (!mounted) return null;

  return (
    <div style={{
      ...pageContainer,
      color: C.text, background: C.bg, minHeight: '100%',
      paddingBottom: 96,
      fontFamily: FONT, fontFeatureSettings: FONT_FEATURES,
    }}>
      {/* Hero */}
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
          Здесь собраны темы по всем возможностям CRES-CA. Кликни на статью, чтобы прочитать ответ.
        </p>
      </motion.div>

      {/* Categories — expandable articles */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
        gap: 14,
      }}>
        {HELP_CATEGORIES.map((cat: HelpCategory, i) => {
          const Icon = ICON_BY_KEY[cat.key] ?? LayoutDashboard;
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
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
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
              <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column' }}>
                {cat.articles.map((article) => {
                  const articleId = `${cat.key}/${article.slug}`;
                  const isOpen = openArticle === articleId;
                  return (
                    <li key={articleId} style={{ borderTop: `1px solid ${C.border}` }}>
                      <button
                        type="button"
                        onClick={() => setOpenArticle(isOpen ? null : articleId)}
                        style={{
                          width: '100%',
                          background: 'transparent',
                          border: 'none',
                          padding: '10px 0',
                          textAlign: 'left',
                          cursor: 'pointer',
                          color: C.text,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: 8,
                          fontSize: 13,
                          fontWeight: isOpen ? 600 : 500,
                          fontFamily: FONT,
                        }}
                      >
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{article.title}</span>
                        <ChevronDown
                          size={14}
                          style={{
                            color: C.textTertiary,
                            flexShrink: 0,
                            transition: 'transform 0.2s',
                            transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                          }}
                        />
                      </button>
                      <AnimatePresence initial={false}>
                        {isOpen && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.18 }}
                            style={{ overflow: 'hidden' }}
                          >
                            <p style={{
                              fontSize: 13,
                              color: C.textSecondary,
                              lineHeight: 1.6,
                              margin: '0 0 12px',
                              padding: '0 4px 4px',
                            }}>
                              {article.body}
                            </p>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </li>
                  );
                })}
              </ul>
            </motion.div>
          );
        })}
      </div>

      {/* Contact footer — TG support bot CTA */}
      <motion.div
        initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        style={{
          marginTop: 32,
          padding: '28px 32px',
          background: C.surface,
          border: `1px solid ${C.border}`,
          borderRadius: 16,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 14,
        }}
      >
        <h3 style={{ fontSize: 16, fontWeight: 650, color: C.text, margin: 0, textAlign: 'center' }}>
          Не нашли ответ?
        </h3>
        <p style={{ fontSize: 13, color: C.textSecondary, margin: 0, textAlign: 'center', lineHeight: 1.5, maxWidth: 480 }}>
          Напишите или продиктуйте свой вопрос нашему менеджеру в Telegram — отвечаем в течение рабочего дня. Это единая точка связи для мастеров, клиентов и команд.
        </p>
        <a
          href={SUPPORT_BOT_URL}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            padding: '10px 20px',
            background: C.accent,
            color: '#fff',
            borderRadius: 10,
            fontSize: 13,
            fontWeight: 600,
            textDecoration: 'none',
            transition: 'opacity 0.15s',
          }}
        >
          <Send size={14} />
          Написать в поддержку
        </a>
        <p style={{ fontSize: 11, color: C.textTertiary, margin: 0, textAlign: 'center' }}>
          Можно текстом или голосом — поддерживаются вопросы любой сложности.
        </p>
      </motion.div>
    </div>
  );
}
