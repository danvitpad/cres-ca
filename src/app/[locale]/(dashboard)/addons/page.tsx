/** --- YAML
 * name: AddonsPage
 * description: Roadmap placeholder page — shows planned marketplace addons honestly (was stub cards with non-functional "View Details" buttons). Actual feature toggles live under Settings → Modules.
 * created: 2026-04-17
 * updated: 2026-04-18
 * --- */

'use client';

import Link from 'next/link';
import { useLocale } from 'next-intl';
import { motion } from 'framer-motion';
import { Package, ArrowRight, Sparkles } from 'lucide-react';
import { usePageTheme, FONT, FONT_FEATURES, pageContainer } from '@/lib/dashboard-theme';

interface Planned {
  title: string;
  description: string;
  status: 'building' | 'research' | 'backlog';
}

const PLANNED: Planned[] = [
  { title: 'Онлайн-оплата предоплат', description: 'Привязка кассы и приём предоплат при записи', status: 'building' },
  { title: 'SMS-рассылки', description: 'Массовые SMS по сегменту клиентов', status: 'research' },
  { title: 'Программа лояльности', description: 'Бонусные баллы за визиты и рефералов', status: 'research' },
  { title: 'Google/Bing буст', description: 'Продвижение профиля мастера в поиске', status: 'backlog' },
];

const STATUS_LABEL: Record<Planned['status'], { text: string; color: 'green' | 'amber' | 'gray' }> = {
  building: { text: 'В разработке', color: 'green' },
  research: { text: 'В исследовании', color: 'amber' },
  backlog: { text: 'В бэклоге', color: 'gray' },
};

export default function AddonsPage() {
  const { C, mounted } = usePageTheme();
  const locale = useLocale();

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
          marginBottom: 24,
        }}
      >
        <h1 style={{
          fontSize: 26, fontWeight: 650, color: C.text, letterSpacing: '-0.5px',
          margin: 0, display: 'flex', alignItems: 'center', gap: 10,
        }}>
          <Package size={22} style={{ color: C.accent }} />
          Marketplace дополнений
        </h1>
        <p style={{ fontSize: 14, color: C.textSecondary, margin: '8px 0 0', lineHeight: 1.5 }}>
          Скоро здесь появится маркетплейс расширений. Пока что включение и выключение встроенных модулей живёт в&nbsp;
          <Link href={`/${locale}/settings?section=modules`} style={{ color: C.accent, fontWeight: 600, textDecoration: 'none' }}>
            Настройках → Модули
          </Link>.
        </p>
      </motion.div>

      <h2 style={{
        fontSize: 13, fontWeight: 600, color: C.textTertiary,
        textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 12,
      }}>
        Что планируем
      </h2>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
        gap: 14,
      }}>
        {PLANNED.map((p, i) => {
          const st = STATUS_LABEL[p.status];
          const statusColor =
            st.color === 'green' ? { bg: C.successSoft, fg: C.success } :
            st.color === 'amber' ? { bg: C.warningSoft, fg: C.warning } :
                                   { bg: C.surfaceElevated, fg: C.textTertiary };
          return (
            <motion.div
              key={p.title}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04 }}
              style={{
                background: C.surface,
                border: `1px solid ${C.border}`,
                borderRadius: 14,
                padding: 18,
                display: 'flex', flexDirection: 'column', gap: 8,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                <Sparkles size={16} style={{ color: C.accent, flexShrink: 0, marginTop: 2 }} />
                <span style={{
                  fontSize: 10, fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase',
                  padding: '3px 7px', borderRadius: 5,
                  background: statusColor.bg, color: statusColor.fg,
                }}>
                  {st.text}
                </span>
              </div>
              <div style={{ fontSize: 14, fontWeight: 650, color: C.text, lineHeight: 1.25 }}>
                {p.title}
              </div>
              <div style={{ fontSize: 12, color: C.textSecondary, lineHeight: 1.5 }}>
                {p.description}
              </div>
            </motion.div>
          );
        })}
      </div>

      <div style={{
        marginTop: 28,
        padding: '18px 22px',
        background: C.surface,
        border: `1px dashed ${C.border}`,
        borderRadius: 12,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
        flexWrap: 'wrap',
      }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, color: C.text }}>Хотите конкретное дополнение?</div>
          <div style={{ fontSize: 12, color: C.textSecondary, marginTop: 2 }}>
            Напишите нам через форму обратной связи в настройках — добавим в план.
          </div>
        </div>
        <Link
          href={`/${locale}/settings`}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            padding: '9px 16px', borderRadius: 10,
            background: C.accent, color: '#fff',
            fontSize: 13, fontWeight: 600, textDecoration: 'none',
          }}
        >
          В настройки <ArrowRight size={14} />
        </Link>
      </div>
    </div>
  );
}
