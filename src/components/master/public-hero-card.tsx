/** --- YAML
 * name: PublicHeroCard
 * description: Sticky левая колонка публичной страницы мастера (Fresha-style).
 *              Контейнер с padding и тонкой границей. Внутри — share-кнопка top-right,
 *              avatar (большой круг), имя, специализация, рейтинг, город, главная CTA
 *              «Записаться», stats (завершённые + клиенты), workplace, языки, дата
 *              регистрации. Никаких overlay/налезаний — pure white card.
 *              На mobile (<lg) рендерится не sticky, а как обычная секция сверху.
 * created: 2026-04-26
 * --- */

import { Star, MapPin } from 'lucide-react';
import { ShareStoryButton } from './share-story-button';
import { BookingCTA } from './booking/booking-cta';
import { InlineAvatarEdit } from './inline/avatar-edit';

interface Props {
  masterId: string;
  masterProfileId: string | null;
  displayName: string;
  specialization: string | null;
  rating: number;
  reviewsCount: number;
  city: string | null;
  avatarUrl: string | null;
  completedAppointmentsCount: number;
  servedClientsCount: number;
  languages: string[] | null;
  workplaceName: string | null;
  workplaceAddress: string | null;
  joinedAt: string | null;
  bookHref: string;
  accent?: string;
}

export function PublicHeroCard({
  masterId,
  masterProfileId,
  displayName,
  specialization,
  rating,
  reviewsCount,
  city,
  avatarUrl,
  completedAppointmentsCount,
  servedClientsCount,
  languages,
  workplaceName,
  workplaceAddress,
  joinedAt,
  bookHref,
  accent = '#0a0a0a',
}: Props) {
  void masterId;
  void bookHref;
  void accent;

  const joinedLabel = (() => {
    if (!joinedAt) return null;
    const d = new Date(joinedAt);
    if (Number.isNaN(d.getTime())) return null;
    const months = ['янв.', 'февр.', 'март', 'апр.', 'май', 'июнь', 'июль', 'авг.', 'сент.', 'окт.', 'нояб.', 'дек.'];
    return `Участник с ${months[d.getMonth()]} ${d.getFullYear()} г.`;
  })();

  return (
    <aside className="relative flex flex-col gap-5 rounded-[20px] border border-neutral-200 bg-[#f7f7f7] p-6 lg:sticky lg:top-6">
      {/* Share top-right */}
      <div className="absolute right-4 top-4 z-10">
        <ShareStoryButton masterId={masterId} masterName={displayName} />
      </div>

      {/* Avatar (centered, large) — inline-editable for owner */}
      <div className="mx-auto mt-2 size-40 overflow-hidden rounded-full bg-neutral-200 ring-1 ring-black/5">
        <InlineAvatarEdit
          masterProfileId={masterProfileId}
          initialUrl={avatarUrl}
          name={displayName}
          className="size-full"
        />
      </div>

      {/* Identity */}
      <div className="text-center">
        <h1 className="text-[26px] font-bold leading-tight tracking-tight text-neutral-900">
          {displayName}
        </h1>
        {specialization && (
          <p className="mt-1.5 text-[15px] text-neutral-600">{specialization}</p>
        )}
        <div className="mt-2 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-[14px] text-neutral-700">
          {reviewsCount > 0 && (
            <span className="inline-flex items-center gap-1">
              <span className="font-semibold tabular-nums text-neutral-900">{rating.toFixed(1)}</span>
              <Star className="size-4 fill-amber-400 text-amber-400" strokeWidth={0} />
              <span className="text-neutral-500">({reviewsCount})</span>
            </span>
          )}
          {city && (
            <span className="inline-flex items-center gap-1 text-neutral-700">
              <MapPin className="size-3.5 text-neutral-500" /> {city}
            </span>
          )}
        </div>
      </div>

      {/* Main CTA — opens BookingDrawer via context */}
      <BookingCTA variant="hero">Записаться</BookingCTA>

      {/* Divider */}
      <div className="border-t border-neutral-200" />

      {/* Stats — only render when actually has visits/clients */}
      {(completedAppointmentsCount > 0 || servedClientsCount > 0) && (
        <dl className="space-y-2 text-[14px]">
          {completedAppointmentsCount > 0 && (
            <div className="flex items-center justify-between">
              <dt className="text-neutral-700">Завершённые записи</dt>
              <dd className="font-semibold tabular-nums text-neutral-900">
                {completedAppointmentsCount.toLocaleString('ru-RU')}
              </dd>
            </div>
          )}
          {servedClientsCount > 0 && (
            <div className="flex items-center justify-between">
              <dt className="text-neutral-700">Обслужено клиентов</dt>
              <dd className="font-semibold tabular-nums text-neutral-900">
                {servedClientsCount.toLocaleString('ru-RU')}
              </dd>
            </div>
          )}
        </dl>
      )}

      {/* Workplace — показываем только если есть осмысленное название
          (салон или собственный кабинет). Только город — это уже отображено
          под именем в hero, отдельный блок не нужен. */}
      {workplaceName && (
        <div>
          <p className="text-[12px] font-semibold uppercase tracking-wide text-neutral-500">
            Работает в
          </p>
          <p className="mt-1 text-[15px] font-semibold text-neutral-900">{workplaceName}</p>
          {workplaceAddress && (
            <p className="mt-0.5 text-[13px] text-neutral-600">{workplaceAddress}</p>
          )}
        </div>
      )}

      {/* Languages */}
      {(languages?.length ?? 0) > 0 && (
        <div>
          <p className="text-[12px] font-semibold uppercase tracking-wide text-neutral-500">
            Языки
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {languages!.map((lang) => (
              <span
                key={lang}
                className="rounded-full border border-neutral-200 bg-white px-2.5 py-0.5 text-[12px] text-neutral-700"
              >
                {lang}
              </span>
            ))}
          </div>
        </div>
      )}

      {joinedLabel && (
        <p className="text-center text-[12px] text-neutral-500">{joinedLabel}</p>
      )}
    </aside>
  );
}
