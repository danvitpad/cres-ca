/** --- YAML
 * name: Public Reviews List
 * description: Список отзывов на публичной странице мастера. Показывает первые
 *              N штук, остальные — по кнопке «Показать все». Анонимные авторы
 *              получают зверюшку-эмодзи (стабильно по review.id). Комментарий +
 *              фото если есть.
 * created: 2026-05-06
 * --- */

'use client';

import { useState } from 'react';
import Image from 'next/image';
import { Star } from 'lucide-react';

const ANIMAL_EMOJIS = ['🦊', '🐱', '🐶', '🐼', '🦁', '🐻', '🐨', '🐰', '🦉', '🐯', '🐸', '🦄', '🐧', '🦝', '🐹'] as const;
function pickAnonymousEmoji(reviewId: string): string {
  let h = 0;
  for (let i = 0; i < reviewId.length; i++) h = ((h << 5) - h + reviewId.charCodeAt(i)) | 0;
  return ANIMAL_EMOJIS[Math.abs(h) % ANIMAL_EMOJIS.length];
}

export interface PublicReviewItem {
  id: string;
  score: number;
  comment: string | null;
  photos: string[] | null;
  created_at: string;
  is_anonymous: boolean;
  reviewer: { full_name: string | null; avatar_url: string | null } | null;
}

interface Props {
  reviews: PublicReviewItem[];
  anonymousLabel: string;
  dateLocale: string;
  initialCount?: number;
  showAllLabel: string;
  collapseLabel: string;
}

export function PublicReviewsList({
  reviews,
  anonymousLabel,
  dateLocale,
  initialCount = 4,
  showAllLabel,
  collapseLabel,
}: Props) {
  const [expanded, setExpanded] = useState(false);
  const visible = expanded ? reviews : reviews.slice(0, initialCount);
  const hasMore = reviews.length > initialCount;

  return (
    <>
      <ul className="grid gap-4 sm:grid-cols-2">
        {visible.map((r) => {
          const anon = r.is_anonymous;
          const displayName = anon
            ? anonymousLabel
            : r.reviewer?.full_name ?? anonymousLabel;
          const avatarEmoji = anon ? pickAnonymousEmoji(r.id) : null;
          return (
            <li
              key={r.id}
              className="rounded-2xl border border-neutral-200 bg-white p-5"
            >
              <div className="mb-2 flex items-center gap-2">
                {avatarEmoji ? (
                  <div className="flex size-9 items-center justify-center rounded-full bg-amber-50 text-[20px]">
                    {avatarEmoji}
                  </div>
                ) : r.reviewer?.avatar_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={r.reviewer.avatar_url}
                    alt=""
                    className="size-9 rounded-full object-cover"
                  />
                ) : (
                  <div className="flex size-9 items-center justify-center rounded-full bg-neutral-100 text-[14px] font-semibold text-neutral-600">
                    {displayName.charAt(0).toUpperCase()}
                  </div>
                )}
                <div className="min-w-0">
                  <p className="truncate text-[13px] font-semibold text-neutral-900">{displayName}</p>
                  <p className="text-[11px] text-neutral-500">
                    {new Date(r.created_at).toLocaleDateString(dateLocale)}
                  </p>
                </div>
              </div>
              <div className="mb-1 flex items-center gap-1">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star
                    key={i}
                    className={`size-4 ${i < r.score ? 'fill-amber-400 text-amber-400' : 'text-neutral-200'}`}
                    strokeWidth={0}
                  />
                ))}
              </div>
              {r.comment && (
                <p className="mt-1 whitespace-pre-line text-[14px] leading-relaxed text-neutral-800">
                  {r.comment}
                </p>
              )}
              {r.photos && r.photos.length > 0 && (
                <div className="mt-3 grid grid-cols-3 gap-2">
                  {r.photos.map((url, i) => (
                    <div
                      key={`${r.id}-${i}`}
                      className="relative aspect-square overflow-hidden rounded-lg bg-neutral-100"
                    >
                      <Image src={url} alt="" fill className="object-cover" />
                    </div>
                  ))}
                </div>
              )}
            </li>
          );
        })}
      </ul>

      {hasMore && (
        <div className="mt-5 flex justify-center">
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="rounded-full border border-neutral-300 bg-white px-5 py-2.5 text-[14px] font-semibold text-neutral-900 transition hover:bg-neutral-50"
          >
            {expanded ? collapseLabel : `${showAllLabel} (${reviews.length})`}
          </button>
        </div>
      )}
    </>
  );
}
