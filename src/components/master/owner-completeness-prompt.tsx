/** --- YAML
 * name: OwnerCompletenessPrompt
 * description: Показывается ТОЛЬКО владельцу /m/{handle}, перечисляет недостающие
 *              блоки страницы (био, обложка, портфолио, часы работы, услуги, фото)
 *              с кнопками-ссылками куда заполнить. Каждый пункт ведёт либо в
 *              соответствующий раздел Mini App / dashboard, либо открывает
 *              PublicPageCustomizer. Прячется когда всё заполнено.
 * created: 2026-04-26
 * --- */

'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ChevronRight, CheckCircle2, Sparkles } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

interface ChecklistItem {
  key: string;
  label: string;
  done: boolean;
  href: string;
  hint: string;
}

interface MasterFull {
  bio: string | null;
  cover_url: string | null;
  working_hours: Record<string, unknown> | null;
  address: string | null;
  city: string | null;
  social_links: Record<string, string> | null;
}

function isInsideTelegramMiniApp(): boolean {
  if (typeof window === 'undefined') return false;
  const w = window as { Telegram?: { WebApp?: { initData?: string } } };
  if (w.Telegram?.WebApp?.initData) return true;
  try {
    if (sessionStorage.getItem('cres:tg')) return true;
  } catch { /* ignore */ }
  return false;
}

interface Counts {
  services: number;
  portfolio: number;
  reviews: number;
}

export function OwnerCompletenessPrompt({ masterProfileId }: { masterProfileId: string | null }) {
  const [isOwner, setIsOwner] = useState(false);
  const [data, setData] = useState<MasterFull | null>(null);
  const [counts, setCounts] = useState<Counts | null>(null);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    if (!masterProfileId) return;
    const supabase = createClient();
    supabase.auth.getUser().then(async ({ data: u }) => {
      if (u.user?.id !== masterProfileId) return;
      setIsOwner(true);

      const { data: m } = await supabase
        .from('masters')
        .select('id, bio, cover_url, working_hours, address, city, social_links')
        .eq('profile_id', masterProfileId)
        .maybeSingle();
      if (!m) return;
      const row = m as unknown as { id: string } & MasterFull;
      setData(row);

      const [{ count: sc }, { count: pc }, { count: rc }] = await Promise.all([
        supabase.from('services').select('id', { count: 'exact', head: true })
          .eq('master_id', row.id).eq('is_active', true),
        supabase.from('master_portfolio').select('id', { count: 'exact', head: true })
          .eq('master_id', row.id).eq('is_published', true),
        supabase.from('reviews').select('id', { count: 'exact', head: true })
          .eq('target_type', 'master').eq('target_id', row.id).eq('is_published', true),
      ]);
      setCounts({ services: sc ?? 0, portfolio: pc ?? 0, reviews: rc ?? 0 });
    });
  }, [masterProfileId]);

  if (!isOwner || !data || !counts || collapsed) return null;

  const inMiniApp = isInsideTelegramMiniApp();
  const servicesHref = inMiniApp ? '/telegram/m/settings/services' : '/services';
  const portfolioHref = inMiniApp ? '/telegram/m/settings' : '/portfolio';
  const profileHref = inMiniApp ? '/telegram/m/settings' : '/settings?section=profile';
  const scheduleHref = inMiniApp ? '/telegram/m/settings/schedule' : '/settings?section=hours';

  const items: ChecklistItem[] = [
    {
      key: 'bio',
      label: 'Описание о себе',
      hint: 'Расскажи в 2–3 предложениях про опыт и подход',
      done: !!data.bio && data.bio.trim().length >= 30,
      href: profileHref,
    },
    {
      key: 'cover',
      label: 'Обложка профиля',
      hint: 'Большое фото на шапке — лицо страницы',
      done: !!data.cover_url,
      href: profileHref,
    },
    {
      key: 'services',
      label: 'Услуги с ценами',
      hint: counts.services === 0 ? 'Добавь хотя бы 3 услуги — что ты умеешь делать' : `Сейчас услуг: ${counts.services}`,
      done: counts.services >= 3,
      href: servicesHref,
    },
    {
      key: 'portfolio',
      label: 'Портфолио работ',
      hint: counts.portfolio === 0 ? 'Загрузи фото своих работ — клиенты выбирают глазами' : `Сейчас работ: ${counts.portfolio}`,
      done: counts.portfolio >= 3,
      href: portfolioHref,
    },
    {
      key: 'hours',
      label: 'Часы работы',
      hint: 'Когда тебе можно записаться — клиент должен видеть',
      done: !!data.working_hours && Object.values(data.working_hours).some(
        (v) => v && typeof v === 'object' && !((v as { closed?: boolean }).closed),
      ),
      href: scheduleHref,
    },
    {
      key: 'address',
      label: 'Адрес или район',
      hint: 'Хотя бы город — иначе клиенту не найти',
      done: !!(data.address || data.city),
      href: profileHref,
    },
    {
      key: 'social',
      label: 'Соцсети / мессенджеры',
      hint: 'Чтобы клиент мог написать в TG/Instagram',
      done: !!data.social_links && Object.values(data.social_links).some((v) => v && typeof v === 'string' && v.length > 0),
      href: profileHref,
    },
  ];

  const doneCount = items.filter((i) => i.done).length;
  const totalCount = items.length;
  const pct = Math.round((doneCount / totalCount) * 100);

  if (doneCount === totalCount) return null;

  const todo = items.filter((i) => !i.done);

  return (
    <div className="mt-6 overflow-hidden rounded-2xl border border-violet-200 bg-gradient-to-br from-violet-50 via-white to-indigo-50">
      <div className="flex items-start justify-between gap-3 px-5 py-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <Sparkles className="size-4 text-violet-600" />
            <p className="text-sm font-bold text-neutral-900">Сделай страницу премиум · {pct}%</p>
          </div>
          <p className="mt-1 text-xs text-neutral-600">
            Заполни {todo.length === 1 ? 'последний пункт' : `ещё ${todo.length} ${todo.length < 5 ? 'пункта' : 'пунктов'}`} — клиенты доверяют заполненной странице.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setCollapsed(true)}
          className="shrink-0 rounded-md px-2 py-1 text-xs text-neutral-500 hover:bg-white/50 hover:text-neutral-900"
        >
          Скрыть
        </button>
      </div>
      <div className="h-1 bg-violet-100">
        <div className="h-full bg-violet-500 transition-all" style={{ width: `${pct}%` }} />
      </div>
      <ul className="divide-y divide-violet-100">
        {todo.map((item) => (
          <li key={item.key}>
            <Link
              href={item.href}
              className="group flex items-center gap-3 px-5 py-3 hover:bg-white/60"
            >
              <CheckCircle2 className="size-5 shrink-0 text-neutral-300 group-hover:text-violet-500" strokeWidth={2.2} />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-neutral-900">{item.label}</p>
                <p className="mt-0.5 text-xs text-neutral-500">{item.hint}</p>
              </div>
              <ChevronRight className="size-4 shrink-0 text-neutral-400 group-hover:text-violet-600" />
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
