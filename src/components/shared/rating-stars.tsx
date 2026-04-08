/** --- YAML
 * name: RatingStars
 * description: Interactive rating component (1-5) — stars or emoji mode with hover effects
 * --- */

'use client';

import { useState } from 'react';
import { Star } from 'lucide-react';
import { cn } from '@/lib/utils';

interface RatingStarsProps {
  value: number;
  onChange?: (value: number) => void;
  readonly?: boolean;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'stars' | 'emoji';
}

const SIZES = { sm: 'size-4', md: 'size-5', lg: 'size-6' };
const EMOJI_SIZES = { sm: 'text-lg', md: 'text-xl', lg: 'text-2xl' };

const EMOJI_DATA = [
  { emoji: '😔', label: 'Terrible', gradient: 'from-red-400 to-red-500' },
  { emoji: '😕', label: 'Poor', gradient: 'from-orange-400 to-orange-500' },
  { emoji: '😐', label: 'Okay', gradient: 'from-yellow-400 to-yellow-500' },
  { emoji: '🙂', label: 'Good', gradient: 'from-lime-400 to-lime-500' },
  { emoji: '😍', label: 'Amazing', gradient: 'from-emerald-400 to-emerald-500' },
];

export function RatingStars({ value, onChange, readonly = false, size = 'md', variant = 'stars' }: RatingStarsProps) {
  const [hover, setHover] = useState(0);

  if (variant === 'emoji') {
    const displayRating = hover || value;
    const activeData = displayRating > 0 ? EMOJI_DATA[displayRating - 1] : null;

    return (
      <div className="flex flex-col items-center gap-2">
        <div className="flex items-center gap-2">
          {EMOJI_DATA.map((item, i) => {
            const val = i + 1;
            const isActive = val <= displayRating;
            const isExact = val === displayRating;

            return (
              <button
                key={val}
                type="button"
                disabled={readonly}
                onClick={() => onChange?.(val)}
                onMouseEnter={() => !readonly && setHover(val)}
                onMouseLeave={() => setHover(0)}
                className={cn(
                  'relative transition-all duration-200 focus:outline-none',
                  !readonly && 'cursor-pointer',
                  readonly && 'cursor-default',
                  EMOJI_SIZES[size],
                )}
              >
                <span
                  className={cn(
                    'block transition-all duration-200',
                    isActive ? 'scale-110 opacity-100' : 'scale-90 opacity-40 grayscale',
                    isExact && !readonly && 'scale-125',
                  )}
                >
                  {item.emoji}
                </span>
                {isExact && (
                  <span className={cn(
                    'absolute -bottom-1.5 left-1/2 -translate-x-1/2 h-1 w-4 rounded-full bg-gradient-to-r',
                    item.gradient,
                  )} />
                )}
              </button>
            );
          })}
        </div>
        {activeData && !readonly && (
          <p className="text-xs font-medium text-muted-foreground animate-in fade-in-0 duration-200">
            {activeData.label}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          disabled={readonly}
          onClick={() => onChange?.(star)}
          onMouseEnter={() => !readonly && setHover(star)}
          onMouseLeave={() => setHover(0)}
          className={cn(
            'transition-transform',
            !readonly && 'hover:scale-110 cursor-pointer',
            readonly && 'cursor-default',
          )}
        >
          <Star
            className={cn(
              SIZES[size],
              'transition-colors',
              (hover || value) >= star
                ? 'fill-amber-400 text-amber-400'
                : 'text-muted-foreground/30',
            )}
          />
        </button>
      ))}
    </div>
  );
}
