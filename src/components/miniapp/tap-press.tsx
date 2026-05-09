/** --- YAML
 * name: TapPress / TapLink / TapButton
 * description: Универсальные «нажиматели» для Mini App. Drop-in замены
 *              <div onClick> / <Link> / <button>, дающие мгновенный визуальный
 *              отклик на тап (scale 0.97 за ~180мс) и опциональную тактильную
 *              отдачу. Уважают prefers-reduced-motion. Используют framer-motion
 *              + GPU transforms для 60fps.
 * created: 2026-05-09
 * --- */

'use client';

import { motion, useReducedMotion, type HTMLMotionProps } from 'framer-motion';
import Link from 'next/link';
import { forwardRef, type ComponentProps, type ReactNode } from 'react';
import { useHaptic } from './use-haptic';
import { EASE } from './design';

type HapticStyle = 'light' | 'medium' | 'heavy' | 'selection' | false;

interface TapBaseProps {
  children: ReactNode;
  haptic?: HapticStyle;
  className?: string;
  style?: React.CSSProperties;
  disabled?: boolean;
}

function useTapHandler(haptic: HapticStyle) {
  const h = useHaptic();
  return () => {
    if (!haptic) return;
    if (haptic === 'selection') h.selection();
    else h.impact(haptic);
  };
}

const SCALE_DOWN = { scale: 0.97 };

/** Универсальная обёртка для произвольного контейнера. Принимает onClick. */
export function TapPress({
  children,
  onClick,
  haptic = false,
  className,
  style,
  disabled,
  ...rest
}: TapBaseProps & {
  onClick?: () => void;
} & Omit<HTMLMotionProps<'div'>, 'onClick' | 'children' | 'style' | 'className'>) {
  const reduce = useReducedMotion();
  const fire = useTapHandler(haptic);
  return (
    <motion.div
      whileTap={reduce || disabled ? undefined : SCALE_DOWN}
      transition={EASE.standard}
      onClick={() => {
        if (disabled) return;
        fire();
        onClick?.();
      }}
      className={className}
      style={{ WebkitTapHighlightColor: 'transparent', cursor: 'pointer', ...style }}
      {...rest}
    >
      {children}
    </motion.div>
  );
}

/** Native HTML event handlers, конфликтующие с framer-motion. Их фильтруем
 *  из spread'a, иначе TS ругается на `(definition: AnimationDefinition) => void`. */
type ConflictingHandlers =
  | 'onAnimationStart'
  | 'onAnimationEnd'
  | 'onAnimationIteration'
  | 'onTransitionEnd'
  | 'onDrag'
  | 'onDragEnd'
  | 'onDragStart';

/** Ссылка с tap-feedback. Наследует props у next/link. */
type TapLinkProps = Omit<ComponentProps<typeof Link>, ConflictingHandlers> & TapBaseProps;

const MotionLinkInner = motion(Link);

export const TapLink = forwardRef<HTMLAnchorElement, TapLinkProps>(
  function TapLink({ children, haptic = false, className, style, disabled, onClick, ...linkProps }, ref) {
    const reduce = useReducedMotion();
    const fire = useTapHandler(haptic);
    return (
      <MotionLinkInner
        ref={ref}
        whileTap={reduce || disabled ? undefined : SCALE_DOWN}
        transition={EASE.standard}
        onClick={(e) => {
          if (disabled) {
            e.preventDefault();
            return;
          }
          fire();
          onClick?.(e);
        }}
        className={className}
        style={{ WebkitTapHighlightColor: 'transparent', textDecoration: 'none', ...style }}
        {...linkProps}
      >
        {children}
      </MotionLinkInner>
    );
  },
);

/** Кнопка с tap-feedback. Стилей не задаёт — наследуется от потребителя. */
type TapButtonProps = Omit<ComponentProps<'button'>, ConflictingHandlers> & TapBaseProps;

export const TapButton = forwardRef<HTMLButtonElement, TapButtonProps>(function TapButton(
  { children, haptic = false, className, style, disabled, onClick, type = 'button', ...rest },
  ref,
) {
  const reduce = useReducedMotion();
  const fire = useTapHandler(haptic);
  return (
    <motion.button
      ref={ref}
      type={type}
      whileTap={reduce || disabled ? undefined : SCALE_DOWN}
      transition={EASE.standard}
      onClick={(e) => {
        if (disabled) return;
        fire();
        onClick?.(e);
      }}
      disabled={disabled}
      className={className}
      style={{ WebkitTapHighlightColor: 'transparent', cursor: disabled ? 'not-allowed' : 'pointer', ...style }}
      {...rest}
    >
      {children}
    </motion.button>
  );
});
