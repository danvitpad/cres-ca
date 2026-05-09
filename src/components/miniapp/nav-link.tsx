/** --- YAML
 * name: NavLink
 * description: Замена next/link для нижней навигации. На onTouchStart явно
 *              вызывает router.prefetch(href) — Next начинает грузить целевой
 *              экран как только палец касается, не дожидаясь отжатия. Это
 *              даёт ощущение «мгновенного» перехода. Тапает с selection-haptic.
 * created: 2026-05-09
 * --- */

'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { forwardRef, type ComponentProps, useCallback } from 'react';
import { useHaptic } from './use-haptic';

interface NavLinkProps extends Omit<ComponentProps<typeof Link>, 'prefetch'> {
  /** Allow disabling prefetch warmup (rare). */
  warmupPrefetch?: boolean;
}

export const NavLink = forwardRef<HTMLAnchorElement, NavLinkProps>(function NavLink(
  { children, href, onTouchStart, onClick, warmupPrefetch = true, ...rest },
  ref,
) {
  const router = useRouter();
  const { selection } = useHaptic();

  const handleTouchStart = useCallback(
    (e: React.TouchEvent<HTMLAnchorElement>) => {
      if (warmupPrefetch && typeof href === 'string') {
        router.prefetch(href);
      }
      onTouchStart?.(e);
    },
    [router, href, warmupPrefetch, onTouchStart],
  );

  const handleClick = useCallback(
    (e: React.MouseEvent<HTMLAnchorElement>) => {
      selection();
      onClick?.(e);
    },
    [selection, onClick],
  );

  return (
    <Link
      ref={ref}
      href={href}
      prefetch
      onTouchStart={handleTouchStart}
      onClick={handleClick}
      {...rest}
    >
      {children}
    </Link>
  );
});
