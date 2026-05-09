/** --- YAML
 * name: Skeleton blocks
 * description: Серые плейсхолдеры формы реальных Mini App карточек. Мгновенно
 *              показываются через loading.tsx во время навигации. Используют
 *              CSS-keyframe pulsing (НЕ framer-motion — нативный CSS быстрее
 *              на mount). Цвета — токены T.borderSubtle, чтобы автоматически
 *              работать в light/dark теме.
 * created: 2026-05-09
 * --- */

import type { CSSProperties } from 'react';
import { T, R, PAGE_PADDING_X } from './design';

const PULSE_KEYFRAMES = `
@keyframes mini-skeleton-pulse {
  0% { opacity: 0.55; }
  50% { opacity: 0.9; }
  100% { opacity: 0.55; }
}
`;

const baseBlock: CSSProperties = {
  background: T.borderSubtle,
  borderRadius: R.md,
  animation: 'mini-skeleton-pulse 1.4s ease-in-out infinite',
};

export function SkeletonStyles() {
  return <style>{PULSE_KEYFRAMES}</style>;
}

export function SkeletonHero({ height = 140 }: { height?: number }) {
  return <div style={{ ...baseBlock, height, marginInline: PAGE_PADDING_X, marginTop: 16 }} />;
}

export function SkeletonText({
  lines = 3,
  widthPattern = ['100%', '85%', '60%'] as const,
}: {
  lines?: number;
  widthPattern?: readonly string[];
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {Array.from({ length: lines }).map((_, i) => (
        <div
          key={i}
          style={{
            ...baseBlock,
            height: 12,
            width: widthPattern[i % widthPattern.length] ?? '100%',
            borderRadius: R.sm,
          }}
        />
      ))}
    </div>
  );
}

export function SkeletonCardRow({ count = 3, height = 88 }: { count?: number; height?: number }) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        paddingInline: PAGE_PADDING_X,
        marginTop: 16,
      }}
    >
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} style={{ ...baseBlock, height }} />
      ))}
    </div>
  );
}

export function SkeletonAvatarRow({ count = 5, size = 64 }: { count?: number; size?: number }) {
  return (
    <div
      style={{
        display: 'flex',
        gap: 12,
        paddingInline: PAGE_PADDING_X,
        marginTop: 16,
        overflow: 'hidden',
      }}
    >
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          style={{
            ...baseBlock,
            width: size,
            height: size,
            borderRadius: R.pill,
            flexShrink: 0,
          }}
        />
      ))}
    </div>
  );
}

export function SkeletonNavBar() {
  return (
    <div
      style={{
        position: 'fixed',
        left: 12,
        right: 12,
        bottom: 'calc(12px + env(safe-area-inset-bottom, 0px))',
        height: 64,
        background: T.surface,
        border: `1px solid ${T.borderSubtle}`,
        borderRadius: R.pill,
        opacity: 0.6,
      }}
    />
  );
}

/** Композитный layout — hero + список карточек. Используется как default для
 *  loading.tsx в большинстве вкладок. */
export function SkeletonPageDefault() {
  return (
    <>
      <SkeletonStyles />
      <SkeletonHero />
      <div style={{ height: 16 }} />
      <SkeletonCardRow count={4} />
      <SkeletonNavBar />
    </>
  );
}
