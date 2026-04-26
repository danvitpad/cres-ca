/** --- YAML
 * name: MiniAppShells
 * description: Шаблонные компоненты-блоки для Mini App страниц. Все используют
 *              единые токены из `./design.ts` чтобы переиспользоваться между
 *              ролями (клиент/мастер/команда). Импортируется на каждой странице,
 *              никаких inline-копипастов больше.
 * created: 2026-04-26
 * --- */

'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import type { CSSProperties, ReactNode } from 'react';
import { Search } from 'lucide-react';
import { T, R, TYPE, SHADOW, SPRING, HERO_GRADIENT, FONT_BASE, PAGE_PADDING_X } from './design';

/** Контейнер страницы — задаёт padding и шрифт. */
export function MobilePage({
  children,
  hideTabBar,
  bg = T.bg,
  className,
}: {
  children: ReactNode;
  hideTabBar?: boolean;
  bg?: string;
  className?: string;
}) {
  return (
    <div
      className={className}
      style={{
        ...FONT_BASE,
        minHeight: '100dvh',
        background: bg,
        color: T.text,
        paddingBottom: hideTabBar ? 0 : 96, // место под floating nav
      }}
    >
      {children}
    </div>
  );
}

/** Большой жирный заголовок страницы с опциональной правой кнопкой/иконкой. */
export function PageHeader({
  title,
  subtitle,
  right,
}: {
  title: string;
  subtitle?: string;
  right?: ReactNode;
}) {
  return (
    <header
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 12,
        padding: `28px ${PAGE_PADDING_X}px 8px`,
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <h1 style={{ ...TYPE.h1, color: T.text, margin: 0 }}>{title}</h1>
        {subtitle && (
          <p style={{ ...TYPE.caption, marginTop: 4 }}>{subtitle}</p>
        )}
      </div>
      {right && <div style={{ flexShrink: 0 }}>{right}</div>}
    </header>
  );
}

/** Section title + optional «Посмотреть все» link */
export function SectionHeader({
  title,
  href,
  rightLabel = 'Посмотреть все',
  accent = T.accent,
}: {
  title: string;
  href?: string;
  rightLabel?: string;
  accent?: string;
}) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'space-between',
        padding: `0 ${PAGE_PADDING_X}px`,
        marginBottom: 12,
      }}
    >
      <h2 style={{ ...TYPE.h2, color: T.text, margin: 0 }}>{title}</h2>
      {href && (
        <Link
          href={href}
          style={{
            fontSize: 14,
            fontWeight: 600,
            color: accent,
            textDecoration: 'none',
          }}
        >
          {rightLabel}
        </Link>
      )}
    </div>
  );
}

/** Hero gradient card (баланс кошелька / ваучер / акция) */
export function GradientHeroCard({
  label,
  value,
  cta,
  onCta,
}: {
  label: string;
  value: string;
  cta?: string;
  onCta?: () => void;
}) {
  return (
    <div
      style={{
        ...HERO_GRADIENT,
        margin: `0 ${PAGE_PADDING_X}px`,
        padding: '22px 24px 24px',
        borderRadius: R.lg,
        color: '#ffffff',
        boxShadow: SHADOW.elevated,
      }}
    >
      <p style={{ fontSize: 14, opacity: 0.9, margin: 0, fontWeight: 500 }}>{label}</p>
      <p
        style={{
          fontSize: 32,
          fontWeight: 800,
          letterSpacing: '-0.02em',
          marginTop: 6,
          marginBottom: cta ? 18 : 0,
          lineHeight: 1.05,
        }}
      >
        {value}
      </p>
      {cta && (
        <button
          type="button"
          onClick={onCta}
          style={{
            background: 'transparent',
            color: '#ffffff',
            border: '1.5px solid rgba(255,255,255,0.7)',
            borderRadius: R.pill,
            padding: '12px 28px',
            fontSize: 15,
            fontWeight: 600,
            cursor: 'pointer',
            fontFamily: 'inherit',
          }}
        >
          {cta}
        </button>
      )}
    </div>
  );
}

/** Карточка-список с пунктами меню (Профиль / Избранное / ...) — Fresha-style */
export interface MenuItem {
  key: string;
  icon: ReactNode;
  label: string;
  href?: string;
  onClick?: () => void;
  rightSlot?: ReactNode;
  danger?: boolean;
}

export function MenuList({ items }: { items: MenuItem[] }) {
  return (
    <div
      style={{
        margin: `0 ${PAGE_PADDING_X}px`,
        background: T.surface,
        border: `1px solid ${T.borderSubtle}`,
        borderRadius: R.lg,
        overflow: 'hidden',
      }}
    >
      {items.map((it, idx) => {
        const inner = (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 14,
              padding: '16px 18px',
              borderBottom: idx < items.length - 1 ? `1px solid ${T.borderSubtle}` : 'none',
              background: 'transparent',
              cursor: 'pointer',
              WebkitTapHighlightColor: 'transparent',
              fontFamily: 'inherit',
              border: 'none',
              width: '100%',
              textAlign: 'left',
              color: it.danger ? T.danger : T.text,
            }}
          >
            <div
              style={{
                width: 28,
                height: 28,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: it.danger ? T.danger : T.textSecondary,
                flexShrink: 0,
              }}
            >
              {it.icon}
            </div>
            <span style={{ flex: 1, ...TYPE.bodyStrong }}>{it.label}</span>
            {it.rightSlot}
          </div>
        );
        if (it.href) {
          return (
            <Link key={it.key} href={it.href} style={{ textDecoration: 'none', display: 'block' }}>
              {inner}
            </Link>
          );
        }
        return (
          <button key={it.key} type="button" onClick={it.onClick} style={{ background: 'transparent', border: 'none', width: '100%', padding: 0, cursor: 'pointer' }}>
            {inner}
          </button>
        );
      })}
    </div>
  );
}

/** Tab pills — чёрная активная (как Fresha screen 2) */
export function TabPills<T extends string>({
  value,
  onChange,
  options,
  accent = '#0a0a0c',
}: {
  value: T;
  onChange: (next: T) => void;
  options: { value: T; label: string }[];
  accent?: string;
}) {
  return (
    <div
      style={{
        display: 'flex',
        gap: 8,
        padding: `0 ${PAGE_PADDING_X}px`,
        overflowX: 'auto',
        scrollbarWidth: 'none',
        WebkitOverflowScrolling: 'touch',
      }}
    >
      <style>{`.tabpills-row::-webkit-scrollbar { display: none; }`}</style>
      <div className="tabpills-row" style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
        {options.map((opt) => {
          const active = value === opt.value;
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => onChange(opt.value)}
              style={{
                flexShrink: 0,
                padding: '10px 20px',
                borderRadius: R.pill,
                border: 'none',
                background: active ? accent : 'transparent',
                color: active ? '#ffffff' : T.textSecondary,
                fontSize: 15,
                fontWeight: 600,
                cursor: 'pointer',
                fontFamily: 'inherit',
                transition: 'all 200ms ease',
                whiteSpace: 'nowrap',
              }}
            >
              {opt.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** Empty state — Fresha-style: emoji/icon + bold title + secondary text + pill CTA */
export function EmptyState({
  icon,
  title,
  desc,
  ctaLabel,
  ctaHref,
  ctaOnClick,
}: {
  icon: ReactNode;
  title: string;
  desc?: string;
  ctaLabel?: string;
  ctaHref?: string;
  ctaOnClick?: () => void;
}) {
  const cta = ctaLabel ? (
    ctaHref ? (
      <Link
        href={ctaHref}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          padding: '14px 32px',
          borderRadius: R.pill,
          border: `1.5px solid ${T.border}`,
          color: T.text,
          fontSize: 15,
          fontWeight: 600,
          textDecoration: 'none',
          fontFamily: 'inherit',
        }}
      >
        {ctaLabel}
      </Link>
    ) : (
      <button
        type="button"
        onClick={ctaOnClick}
        style={{
          padding: '14px 32px',
          borderRadius: R.pill,
          border: `1.5px solid ${T.border}`,
          color: T.text,
          fontSize: 15,
          fontWeight: 600,
          background: 'transparent',
          cursor: 'pointer',
          fontFamily: 'inherit',
        }}
      >
        {ctaLabel}
      </button>
    )
  ) : null;

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        textAlign: 'center',
        padding: '64px 32px 32px',
        gap: 16,
      }}
    >
      <div style={{ fontSize: 48 }}>{icon}</div>
      <div>
        <h2 style={{ ...TYPE.h3, color: T.text, margin: 0 }}>{title}</h2>
        {desc && (
          <p
            style={{
              ...TYPE.body,
              color: T.textSecondary,
              marginTop: 8,
              maxWidth: 280,
            }}
          >
            {desc}
          </p>
        )}
      </div>
      {cta}
    </div>
  );
}

/** Plain card box for content groups */
export function MobileCard({
  children,
  onClick,
  href,
  style,
}: {
  children: ReactNode;
  onClick?: () => void;
  href?: string;
  style?: CSSProperties;
}) {
  const content = (
    <motion.div
      whileTap={{ scale: 0.98 }}
      transition={SPRING.snappy}
      style={{
        background: T.surface,
        border: `1px solid ${T.borderSubtle}`,
        borderRadius: R.md,
        boxShadow: SHADOW.card,
        cursor: onClick || href ? 'pointer' : 'default',
        ...style,
      }}
    >
      {children}
    </motion.div>
  );
  if (href) {
    return (
      <Link href={href} style={{ textDecoration: 'none', color: 'inherit' }}>
        {content}
      </Link>
    );
  }
  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        style={{ background: 'transparent', border: 'none', padding: 0, width: '100%', textAlign: 'left', fontFamily: 'inherit' }}
      >
        {content}
      </button>
    );
  }
  return content;
}

/** Search header pill — большой rounded поиск как у Fresha */
export function SearchHeaderPill({
  primary,
  secondary,
  onClick,
  rightAction,
}: {
  primary: string;
  secondary?: string;
  onClick?: () => void;
  rightAction?: ReactNode;
}) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        margin: `0 ${PAGE_PADDING_X}px`,
      }}
    >
      <button
        type="button"
        onClick={onClick}
        style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: '14px 16px',
          background: T.surface,
          borderRadius: R.pill,
          border: 'none',
          boxShadow: SHADOW.pill,
          cursor: 'pointer',
          textAlign: 'left',
          fontFamily: 'inherit',
        }}
      >
        <Search size={20} color={T.textSecondary} strokeWidth={2.2} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ ...TYPE.bodyStrong, color: T.text, margin: 0 }}>{primary}</div>
          {secondary && (
            <div style={{ ...TYPE.caption, marginTop: 1 }}>{secondary}</div>
          )}
        </div>
      </button>
      {rightAction}
    </div>
  );
}

/** Avatar circle — accented violet с буквой */
export function AvatarCircle({
  url,
  name,
  size = 48,
  bg = T.accent,
}: {
  url?: string | null;
  name: string;
  size?: number;
  bg?: string;
}) {
  if (url) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={url}
        alt={name}
        style={{
          width: size,
          height: size,
          borderRadius: '50%',
          objectFit: 'cover',
        }}
      />
    );
  }
  const initial = (name?.trim().charAt(0) || '?').toUpperCase();
  return (
    <div
      aria-label={name}
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        background: bg,
        color: '#ffffff',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: Math.round(size * 0.4),
        fontWeight: 700,
        flexShrink: 0,
      }}
    >
      {initial}
    </div>
  );
}
