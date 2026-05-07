/** --- YAML
 * name: MasterMiniAppPublicPage
 * description: Native Mini App превью + inline-редактор публичной страницы
 *              мастера. Все ключевые текстовые поля (имя, специализация, био,
 *              workplace, адрес) редактируются через ✎-кнопку рядом с секцией
 *              без выхода в браузер. Cover/портфолио/отзывы/услуги пока
 *              открываются в браузере (большая отдельная задача).
 * created: 2026-05-07
 * --- */

'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  X, Pencil, Star, MapPin, Clock, ExternalLink, Loader2, Share2, Users2, Globe,
} from 'lucide-react';
import { useAuthStore } from '@/stores/auth-store';
import { useTelegram } from '@/components/miniapp/telegram-provider';
import { getInitData } from '@/lib/telegram/webapp';
import { MobilePage, AvatarCircle } from '@/components/miniapp/shells';
import { MiniAppEditTextSheet } from '@/components/miniapp/edit-text-sheet';
import { T, R, TYPE, SHADOW, PAGE_PADDING_X } from '@/components/miniapp/design';
import { useMiniAppLocale, type MiniAppLang } from '@/lib/miniapp/use-locale';

interface MasterData {
  id: string;
  display_name: string | null;
  specialization: string | null;
  headline: string | null;
  bio: string | null;
  city: string | null;
  rating: number;
  total_reviews: number;
  avatar_url: string | null;
  cover_url: string | null;
  invite_code: string | null;
  slug: string | null;
  workplace: string | null;
  address: string | null;
  social_links: Record<string, string | null>;
  working_hours: unknown;
  total_appointments: number;
  total_clients: number;
}

interface ServiceRow {
  id: string;
  name: string;
  description: string | null;
  duration_minutes: number;
  price: number;
  currency: string;
  color: string | null;
  category: { name: string } | null;
}

interface PortfolioRow {
  id: string;
  image_url: string;
  caption: string | null;
  service_name: string | null;
  item_x: number | null;
  item_y: number | null;
  item_scale: number | null;
}

interface ReviewRow {
  id: string;
  score: number;
  comment: string | null;
  created_at: string;
  is_anonymous: boolean;
  reviewer_name: string | null;
  reviewer_avatar: string | null;
}

interface PartnerRow {
  id: string;
  display_name: string | null;
  specialization: string | null;
  city: string | null;
  avatar_url: string | null;
  invite_code: string | null;
}

interface WorkingHoursDay { open: string; close: string; closed?: boolean }
type WorkingHours = Record<string, WorkingHoursDay | null>;

const DAYS_RU = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
const DAY_KEYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];

const I18N: Record<MiniAppLang, {
  loading: string; notFound: string;
  close: string; share: string; editAll: string; editAllHint: string;
  worksLabel: string; clientsLabel: string; rating: string; reviews: (n: number) => string;
  bio: string; bioEmpty: string; bioEdit: string;
  name: string; nameEdit: string; nameFirst: string; nameLast: string;
  specialization: string; specEmpty: string; specEdit: string;
  workplace: string; workplaceEmpty: string; workplaceEdit: string;
  services: string; servicesEmpty: string;
  portfolio: string; portfolioEmpty: string;
  hours: string; hoursEmpty: string;
  address: string; addressEmpty: string; addressEdit: string;
  reviewsTitle: string; reviewsEmpty: string; anonReviewer: string;
  partners: string; partnersEmpty: string;
  closed: string; minutes: string;
}> = {
  uk: {
    loading: 'Завантажуємо…', notFound: 'Профіль не знайдено',
    close: 'Закрити', share: 'Поділитись',
    editAll: 'Решту — у браузері', editAllHint: 'Логотип, обкладинка, послуги, відгуки, графік',
    worksLabel: 'Робіт', clientsLabel: 'Клієнтів', rating: 'Рейтинг',
    reviews: (n) => `${n} відгуків`,
    bio: 'Про себе', bioEmpty: 'Тапни ✎ щоб додати опис', bioEdit: 'Про себе',
    name: 'Імʼя', nameEdit: 'Імʼя та прізвище', nameFirst: 'Імʼя', nameLast: 'Прізвище',
    specialization: 'Спеціалізація', specEmpty: 'Тапни ✎ щоб задати', specEdit: 'Спеціалізація',
    workplace: 'Місце роботи', workplaceEmpty: 'Тапни ✎ щоб задати', workplaceEdit: 'Місце роботи',
    services: 'Послуги', servicesEmpty: 'Послуг поки немає',
    portfolio: 'Портфоліо', portfolioEmpty: 'Робіт поки немає',
    hours: 'Графік роботи', hoursEmpty: 'Години не вказані',
    address: 'Адреса', addressEmpty: 'Тапни ✎ щоб додати', addressEdit: 'Адреса',
    reviewsTitle: 'Відгуки', reviewsEmpty: 'Відгуків поки немає',
    anonReviewer: 'Анонімний клієнт',
    partners: 'Рекомендую', partnersEmpty: 'Поки нікого не рекомендую',
    closed: 'вихідний', minutes: 'хв',
  },
  ru: {
    loading: 'Загружаем…', notFound: 'Профиль не найден',
    close: 'Закрыть', share: 'Поделиться',
    editAll: 'Остальное — в браузере', editAllHint: 'Логотип, обложка, услуги, отзывы, график',
    worksLabel: 'Работ', clientsLabel: 'Клиентов', rating: 'Рейтинг',
    reviews: (n) => `${n} отзывов`,
    bio: 'О себе', bioEmpty: 'Тапни ✎ чтобы добавить описание', bioEdit: 'О себе',
    name: 'Имя', nameEdit: 'Имя и фамилия', nameFirst: 'Имя', nameLast: 'Фамилия',
    specialization: 'Специализация', specEmpty: 'Тапни ✎ чтобы задать', specEdit: 'Специализация',
    workplace: 'Место работы', workplaceEmpty: 'Тапни ✎ чтобы задать', workplaceEdit: 'Место работы',
    services: 'Услуги', servicesEmpty: 'Услуг пока нет',
    portfolio: 'Портфолио', portfolioEmpty: 'Работ пока нет',
    hours: 'График работы', hoursEmpty: 'Часы не указаны',
    address: 'Адрес', addressEmpty: 'Тапни ✎ чтобы добавить', addressEdit: 'Адрес',
    reviewsTitle: 'Отзывы', reviewsEmpty: 'Отзывов пока нет',
    anonReviewer: 'Анонимный клиент',
    partners: 'Рекомендую', partnersEmpty: 'Пока никого не рекомендую',
    closed: 'выходной', minutes: 'мин',
  },
  en: {
    loading: 'Loading…', notFound: 'Profile not found',
    close: 'Close', share: 'Share',
    editAll: 'The rest — in the browser', editAllHint: 'Logo, cover, services, reviews, schedule',
    worksLabel: 'Visits', clientsLabel: 'Clients', rating: 'Rating',
    reviews: (n) => `${n} reviews`,
    bio: 'About', bioEmpty: 'Tap ✎ to add description', bioEdit: 'About',
    name: 'Name', nameEdit: 'First & last name', nameFirst: 'First name', nameLast: 'Last name',
    specialization: 'Specialization', specEmpty: 'Tap ✎ to set', specEdit: 'Specialization',
    workplace: 'Workplace', workplaceEmpty: 'Tap ✎ to set', workplaceEdit: 'Workplace',
    services: 'Services', servicesEmpty: 'No services yet',
    portfolio: 'Portfolio', portfolioEmpty: 'No works yet',
    hours: 'Hours', hoursEmpty: 'Hours not set',
    address: 'Address', addressEmpty: 'Tap ✎ to add', addressEdit: 'Address',
    reviewsTitle: 'Reviews', reviewsEmpty: 'No reviews yet',
    anonReviewer: 'Anonymous client',
    partners: 'I recommend', partnersEmpty: 'No recommendations yet',
    closed: 'closed', minutes: 'min',
  },
};

function openExternal(href: string) {
  const url = href.startsWith('http') ? href : `${typeof window !== 'undefined' ? window.location.origin : ''}${href}`;
  const w = window as { Telegram?: { WebApp?: { openLink?: (u: string) => void } } };
  if (w.Telegram?.WebApp?.openLink) {
    w.Telegram.WebApp.openLink(url);
  } else {
    window.open(url, '_blank');
  }
}

type EditField = null | 'name' | 'specialization' | 'bio' | 'workplace' | 'address';

export default function MasterMiniAppPublicPage() {
  const router = useRouter();
  const { haptic } = useTelegram();
  const { userId } = useAuthStore();
  const lang = useMiniAppLocale();
  const t = I18N[lang];
  const [master, setMaster] = useState<MasterData | null>(null);
  const [services, setServices] = useState<ServiceRow[]>([]);
  const [portfolio, setPortfolio] = useState<PortfolioRow[]>([]);
  const [reviews, setReviews] = useState<ReviewRow[]>([]);
  const [partners, setPartners] = useState<PartnerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [editField, setEditField] = useState<EditField>(null);

  async function loadData() {
    const initData = getInitData();
    const res = await fetch('/api/telegram/m/public-page-data', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(initData ? { 'X-TG-Init-Data': initData } : {}),
      },
      body: JSON.stringify({}),
    });
    if (!res.ok) { setLoading(false); return; }
    const json = await res.json() as {
      master: MasterData | null;
      services: ServiceRow[];
      portfolio: PortfolioRow[];
      reviews: ReviewRow[];
      partners: PartnerRow[];
    };
    setMaster(json.master);
    setServices(json.services ?? []);
    setPortfolio(json.portfolio ?? []);
    setReviews(json.reviews ?? []);
    setPartners(json.partners ?? []);
    setLoading(false);
  }

  useEffect(() => {
    if (!userId) return;
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  async function patchMaster(payload: Record<string, string | null>) {
    const initData = getInitData();
    const res = await fetch('/api/telegram/m/master-patch', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(initData ? { 'X-TG-Init-Data': initData } : {}),
      },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      throw new Error(j.detail || j.error || 'failed');
    }
  }

  function shareLink() {
    if (!master?.invite_code) return;
    haptic('light');
    const url = `${typeof window !== 'undefined' ? window.location.origin : ''}/m/${master.slug || master.invite_code}`;
    const w = window as unknown as { Telegram?: { WebApp?: { openTelegramLink?: (url: string) => void } } };
    if (w.Telegram?.WebApp?.openTelegramLink) {
      w.Telegram.WebApp.openTelegramLink(`https://t.me/share/url?url=${encodeURIComponent(url)}`);
    } else {
      navigator.clipboard?.writeText(url);
    }
  }

  function openFullEditor() {
    if (!master?.invite_code) return;
    haptic('light');
    openExternal(`/m/${master.slug || master.invite_code}?owner=1&from=miniapp-public`);
  }

  if (loading) {
    return (
      <MobilePage>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60dvh' }}>
          <Loader2 size={24} className="animate-spin" color={T.textTertiary} />
        </div>
      </MobilePage>
    );
  }

  if (!master) {
    return (
      <MobilePage>
        <div style={{ padding: '40px 20px', textAlign: 'center' }}>
          <p style={{ ...TYPE.body, color: T.textSecondary }}>{t.notFound}</p>
        </div>
      </MobilePage>
    );
  }

  const displayName = master.display_name || '—';
  const wh = (master.working_hours as WorkingHours | null) ?? null;
  // Cover показываем только если он явно отличается от аватара. Иначе у мастеров,
  // которые поставили лого и в аватар, и в обложку, не было бы двух копий лого.
  const showCover = !!master.cover_url && master.cover_url !== master.avatar_url;

  // Сортировка отзывов: с комментарием → без, внутри каждой группы по дате DESC.
  const sortedReviews = [...reviews].sort((a, b) => {
    const aHas = a.comment && a.comment.trim().length > 0 ? 1 : 0;
    const bHas = b.comment && b.comment.trim().length > 0 ? 1 : 0;
    if (aHas !== bHas) return bHas - aHas;
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });

  return (
    <MobilePage>
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25 }}
        style={{ display: 'flex', flexDirection: 'column', gap: 18, paddingBottom: 32 }}
      >
        {/* Cover (только если он отличается от аватара). flex-shrink:0 + явная
            высота 180 + overflow:hidden — гарантия что огромные PNG лого не
            растянут блок на полэкрана. */}
        {showCover ? (
          <div
            style={{
              position: 'relative',
              width: '100%',
              flexShrink: 0,
              height: 180,
              maxHeight: 180,
              background: T.bgSubtle,
              overflow: 'hidden',
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={master.cover_url!}
              alt=""
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                objectPosition: 'center',
                display: 'block',
              }}
            />
            <CloseBtn onClick={() => { haptic('light'); router.back(); }} />
          </div>
        ) : (
          <div style={{ position: 'relative', width: '100%', flexShrink: 0, height: 60 }}>
            <CloseBtn onClick={() => { haptic('light'); router.back(); }} />
          </div>
        )}

        {/* Hero: avatar + name + spec + city. Аватар крупный (96px) и больше
            не накладывается на cover (cover scrollable выше). */}
        <div
          style={{
            display: 'flex', alignItems: 'flex-end', gap: 12,
            padding: `0 ${PAGE_PADDING_X}px`,
            marginTop: showCover ? -52 : 0,
          }}
        >
          <div
            style={{
              width: 96, height: 96, borderRadius: '50%',
              border: `4px solid ${T.bg}`, overflow: 'hidden', flexShrink: 0,
              background: T.surface,
            }}
          >
            <AvatarCircle url={master.avatar_url} name={displayName} size={88} />
          </div>
          <div style={{ flex: 1, minWidth: 0, paddingBottom: 4 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <h1 style={{ ...TYPE.h2, color: T.text, margin: 0, fontSize: 22, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {displayName}
              </h1>
              <PencilBtn onClick={() => { haptic('selection'); setEditField('name'); }} />
            </div>
            <SpecRow t={t} value={master.headline || master.specialization} onEdit={() => setEditField('specialization')} />
            {(master.workplace || master.city) && (
              <p style={{ ...TYPE.micro, marginTop: 4, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                <MapPin size={11} />
                {[master.workplace, master.city].filter(Boolean).join(' · ')}
              </p>
            )}
          </div>
        </div>

        {/* Stats grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, padding: `0 ${PAGE_PADDING_X}px` }}>
          <Stat value={String(master.total_appointments ?? 0)} label={t.worksLabel} />
          <Stat value={String(master.total_clients ?? 0)} label={t.clientsLabel} />
          <Stat
            value={master.rating > 0 ? master.rating.toFixed(1) : '—'}
            label={master.total_reviews > 0 ? t.reviews(master.total_reviews) : t.rating}
            withStar={master.rating > 0}
          />
        </div>

        {/* Actions */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, padding: `0 ${PAGE_PADDING_X}px` }}>
          <button
            type="button"
            onClick={shareLink}
            disabled={!master.invite_code}
            style={pillBtn(false)}
          >
            <Share2 size={14} strokeWidth={2.2} />
            {t.share}
          </button>
          <button
            type="button"
            onClick={openFullEditor}
            disabled={!master.invite_code}
            style={pillBtn(true)}
          >
            <Pencil size={14} strokeWidth={2.2} />
            {t.editAll}
            <ExternalLink size={11} strokeWidth={2.2} />
          </button>
        </div>
        <p style={{ ...TYPE.micro, textAlign: 'center', padding: `0 ${PAGE_PADDING_X}px`, marginTop: -8 }}>
          {t.editAllHint}
        </p>

        {/* Bio (inline-edit) */}
        <SectionWithEdit title={t.bio} onEdit={() => setEditField('bio')}>
          {master.bio ? (
            <p style={{ ...TYPE.body, color: T.text, whiteSpace: 'pre-wrap', margin: 0 }}>{master.bio}</p>
          ) : (
            <Empty text={t.bioEmpty} />
          )}
        </SectionWithEdit>

        {/* Workplace (inline-edit) */}
        <SectionWithEdit title={t.workplace} onEdit={() => setEditField('workplace')}>
          {master.workplace ? (
            <p style={{ ...TYPE.body, color: T.text, margin: 0 }}>{master.workplace}</p>
          ) : (
            <Empty text={t.workplaceEmpty} />
          )}
        </SectionWithEdit>

        {/* Address (inline-edit) */}
        <SectionWithEdit title={t.address} onEdit={() => setEditField('address')}>
          {master.address ? (
            <p style={{ ...TYPE.body, color: T.text, margin: 0, display: 'inline-flex', alignItems: 'flex-start', gap: 8 }}>
              <MapPin size={16} style={{ marginTop: 2, flexShrink: 0 }} color={T.textSecondary} />
              <span>{master.address}</span>
            </p>
          ) : (
            <Empty text={t.addressEmpty} />
          )}
        </SectionWithEdit>

        {/* Services */}
        <Section title={t.services}>
          {services.length === 0 ? (
            <Empty text={t.servicesEmpty} />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {services.map((s) => (
                <div
                  key={s.id}
                  style={{
                    display: 'flex', alignItems: 'flex-start', gap: 12,
                    padding: '10px 12px', borderRadius: R.md,
                    border: `1px solid ${T.borderSubtle}`, background: T.surface,
                  }}
                >
                  <span style={{ width: 8, height: 8, marginTop: 6, borderRadius: 999, background: s.color || T.accent, flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ ...TYPE.bodyStrong, color: T.text, margin: 0 }}>{s.name}</p>
                    {s.category && (
                      <p style={{ ...TYPE.micro, marginTop: 2, color: T.textTertiary }}>{s.category.name}</p>
                    )}
                    <p style={{ ...TYPE.micro, marginTop: 4, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                      <Clock size={10} />
                      {s.duration_minutes} {t.minutes}
                    </p>
                  </div>
                  <p style={{ fontSize: 14, fontWeight: 800, color: T.text, fontVariantNumeric: 'tabular-nums', margin: 0, flexShrink: 0 }}>
                    {Number(s.price).toFixed(0)}{' '}
                    <span style={{ fontSize: 11, fontWeight: 500, color: T.textTertiary }}>
                      {s.currency === 'UAH' ? '₴' : s.currency}
                    </span>
                  </p>
                </div>
              ))}
            </div>
          )}
        </Section>

        {/* Portfolio */}
        <Section title={t.portfolio}>
          {portfolio.length === 0 ? (
            <Empty text={t.portfolioEmpty} />
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 4 }}>
              {portfolio.map((it) => {
                const x = typeof it.item_x === 'number' ? it.item_x : 50;
                const y = typeof it.item_y === 'number' ? it.item_y : 50;
                return (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    key={it.id}
                    src={it.image_url}
                    alt={it.caption ?? ''}
                    style={{
                      width: '100%', aspectRatio: '1', objectFit: 'cover',
                      objectPosition: `${x}% ${y}%`,
                      borderRadius: R.sm, display: 'block',
                    }}
                  />
                );
              })}
            </div>
          )}
        </Section>

        {/* Working hours */}
        <Section title={t.hours}>
          {wh ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {DAY_KEYS.map((k, i) => {
                const day = wh[k];
                const isClosed = !day || day.closed || (!day.open && !day.close);
                return (
                  <div key={k} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                    <span style={{ color: T.text, fontWeight: 600, width: 36 }}>{DAYS_RU[i]}</span>
                    <span style={{ color: isClosed ? T.textTertiary : T.text }}>
                      {isClosed ? t.closed : `${day.open} – ${day.close}`}
                    </span>
                  </div>
                );
              })}
            </div>
          ) : (
            <Empty text={t.hoursEmpty} />
          )}
        </Section>

        {/* Reviews */}
        <Section title={t.reviewsTitle}>
          {sortedReviews.length === 0 ? (
            <Empty text={t.reviewsEmpty} />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {sortedReviews.slice(0, 5).map((r) => (
                <div key={r.id} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <AvatarCircle url={r.reviewer_avatar} name={r.reviewer_name ?? '?'} size={32} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ ...TYPE.bodyStrong, fontSize: 13, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {r.reviewer_name || t.anonReviewer}
                      </p>
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 2, marginTop: 1 }}>
                        {Array.from({ length: 5 }).map((_, idx) => (
                          <Star
                            key={idx}
                            size={11}
                            fill={idx < r.score ? '#f59e0b' : 'none'}
                            color={idx < r.score ? '#f59e0b' : T.textTertiary}
                            strokeWidth={2}
                          />
                        ))}
                      </div>
                    </div>
                  </div>
                  {r.comment && (
                    <p style={{ ...TYPE.caption, color: T.text, whiteSpace: 'pre-wrap', margin: 0 }}>{r.comment}</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </Section>

        {/* Partners */}
        <Section title={t.partners}>
          {partners.length === 0 ? (
            <Empty text={t.partnersEmpty} />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {partners.map((p) => (
                <div
                  key={p.id}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '8px 10px', borderRadius: R.md,
                    border: `1px solid ${T.borderSubtle}`, background: T.surface,
                  }}
                >
                  <AvatarCircle url={p.avatar_url} name={p.display_name ?? '?'} size={36} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ ...TYPE.bodyStrong, fontSize: 13, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {p.display_name || '—'}
                    </p>
                    {(p.specialization || p.city) && (
                      <p style={{ ...TYPE.micro, marginTop: 1 }}>
                        {[p.specialization, p.city].filter(Boolean).join(' · ')}
                      </p>
                    )}
                  </div>
                  <Users2 size={14} color={T.textTertiary} />
                </div>
              ))}
            </div>
          )}
        </Section>

        {/* Social links */}
        {master.social_links && Object.values(master.social_links).some((v) => !!v) && (
          <Section title="—" hideTitle>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {Object.entries(master.social_links)
                .filter(([, v]) => !!v)
                .map(([k, v]) => (
                  <button
                    key={k}
                    type="button"
                    onClick={() => v && openExternal(String(v))}
                    style={{
                      padding: '6px 10px', borderRadius: 999,
                      border: `1px solid ${T.borderSubtle}`, background: T.surface,
                      fontSize: 12, color: T.text, fontWeight: 600,
                      display: 'inline-flex', alignItems: 'center', gap: 4,
                      cursor: 'pointer', fontFamily: 'inherit',
                    }}
                  >
                    <Globe size={12} />
                    {k}
                  </button>
                ))}
            </div>
          </Section>
        )}
      </motion.div>

      {/* Edit sheets — один per поле */}
      <MiniAppEditTextSheet
        open={editField === 'bio'}
        title={t.bioEdit}
        initialValue={master.bio ?? ''}
        multiline
        maxLength={500}
        onClose={() => setEditField(null)}
        onSave={async (v) => {
          await patchMaster({ bio: v });
          setMaster({ ...master, bio: v.trim() || null });
        }}
      />
      <MiniAppEditTextSheet
        open={editField === 'specialization'}
        title={t.specEdit}
        initialValue={master.headline ?? master.specialization ?? ''}
        multiline={false}
        maxLength={120}
        onClose={() => setEditField(null)}
        onSave={async (v) => {
          // Пишем в headline (приоритетное поле для публички); специализация
          // отдельная категория.
          await patchMaster({ headline: v });
          setMaster({ ...master, headline: v.trim() || null });
        }}
      />
      <MiniAppEditTextSheet
        open={editField === 'workplace'}
        title={t.workplaceEdit}
        initialValue={master.workplace ?? ''}
        multiline={false}
        maxLength={120}
        onClose={() => setEditField(null)}
        onSave={async (v) => {
          await patchMaster({ workplace_name: v });
          setMaster({ ...master, workplace: v.trim() || null });
        }}
      />
      <MiniAppEditTextSheet
        open={editField === 'address'}
        title={t.addressEdit}
        initialValue={master.address ?? ''}
        multiline
        maxLength={300}
        onClose={() => setEditField(null)}
        onSave={async (v) => {
          await patchMaster({ address: v });
          setMaster({ ...master, address: v.trim() || null });
        }}
      />
      {editField === 'name' && (
        <NameEditSheet
          t={t}
          fullName={master.display_name ?? ''}
          onClose={() => setEditField(null)}
          onSave={async (fn, ln) => {
            await patchMaster({ first_name: fn, last_name: ln });
            const composed = [fn, ln].filter(Boolean).join(' ');
            setMaster({ ...master, display_name: composed || null });
          }}
        />
      )}
    </MobilePage>
  );
}

function CloseBtn({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Закрыть"
      style={{
        position: 'absolute',
        left: 12,
        top: 'calc(12px + var(--tg-content-top, 0px))',
        width: 36, height: 36,
        borderRadius: '50%',
        border: `1px solid ${T.border}`,
        background: T.surface,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        cursor: 'pointer',
        boxShadow: SHADOW.card,
      }}
    >
      <X size={18} strokeWidth={2.4} color={T.text} />
    </button>
  );
}

function PencilBtn({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Редактировать"
      style={{
        flexShrink: 0,
        width: 28, height: 28, borderRadius: '50%',
        border: `1px solid ${T.borderSubtle}`,
        background: T.surface,
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        cursor: 'pointer', padding: 0,
      }}
    >
      <Pencil size={12} color={T.textSecondary} strokeWidth={2.2} />
    </button>
  );
}

function SpecRow({ t, value, onEdit }: { t: typeof I18N['ru']; value: string | null; onEdit: () => void }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
      {value ? (
        <p style={{ ...TYPE.caption, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, minWidth: 0 }}>
          {value}
        </p>
      ) : (
        <p style={{ ...TYPE.caption, color: T.textTertiary, margin: 0, fontStyle: 'italic' }}>{t.specEmpty}</p>
      )}
      <PencilBtn onClick={onEdit} />
    </div>
  );
}

function pillBtn(primary: boolean): React.CSSProperties {
  return {
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
    padding: '12px 14px', borderRadius: R.pill,
    border: primary ? 'none' : `1px solid ${T.border}`,
    background: primary ? T.text : T.surface,
    color: primary ? T.bg : T.text,
    fontSize: 13, fontWeight: primary ? 700 : 600,
    cursor: 'pointer', fontFamily: 'inherit',
  };
}

function Section({ title, children, hideTitle }: { title: string; children: React.ReactNode; hideTitle?: boolean }) {
  return (
    <div style={{ padding: `0 ${PAGE_PADDING_X}px` }}>
      {!hideTitle && (
        <h2 style={{ ...TYPE.h3, color: T.text, margin: '0 0 8px', fontSize: 16 }}>{title}</h2>
      )}
      <div
        style={{
          background: T.surface,
          border: `1px solid ${T.borderSubtle}`,
          borderRadius: R.md,
          padding: 14,
          boxShadow: SHADOW.card,
        }}
      >
        {children}
      </div>
    </div>
  );
}

function SectionWithEdit({ title, onEdit, children }: { title: string; onEdit: () => void; children: React.ReactNode }) {
  return (
    <div style={{ padding: `0 ${PAGE_PADDING_X}px` }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', margin: '0 0 8px' }}>
        <h2 style={{ ...TYPE.h3, color: T.text, margin: 0, fontSize: 16 }}>{title}</h2>
        <PencilBtn onClick={onEdit} />
      </div>
      <div
        style={{
          background: T.surface,
          border: `1px solid ${T.borderSubtle}`,
          borderRadius: R.md,
          padding: 14,
          boxShadow: SHADOW.card,
        }}
      >
        {children}
      </div>
    </div>
  );
}

function Stat({ value, label, withStar }: { value: string; label: string; withStar?: boolean }) {
  return (
    <div
      style={{
        background: T.surface,
        border: `1px solid ${T.borderSubtle}`,
        borderRadius: R.md,
        padding: 12,
        textAlign: 'center',
        boxShadow: SHADOW.card,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, fontSize: 18, fontWeight: 800, color: T.text }}>
        {withStar && <Star size={14} fill="#f59e0b" color="#f59e0b" />}
        <span>{value}</span>
      </div>
      <p style={{ marginTop: 2, fontSize: 10, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: T.textTertiary }}>
        {label}
      </p>
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return <p style={{ ...TYPE.caption, color: T.textTertiary, margin: 0 }}>{text}</p>;
}

/** Отдельный sheet для имени — два поля (Имя + Фамилия). */
function NameEditSheet({
  t, fullName, onClose, onSave,
}: {
  t: typeof I18N['ru'];
  fullName: string;
  onClose: () => void;
  onSave: (firstName: string, lastName: string) => Promise<void>;
}) {
  const trimmed = fullName.trim();
  const space = trimmed.indexOf(' ');
  const initFirst = space === -1 ? trimmed : trimmed.slice(0, space);
  const initLast = space === -1 ? '' : trimmed.slice(space + 1);
  const [fn, setFn] = useState(initFirst);
  const [ln, setLn] = useState(initLast);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit() {
    if (busy) return;
    setBusy(true);
    setErr(null);
    try {
      await onSave(fn.trim(), ln.trim());
      onClose();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      onClick={() => !busy && onClose()}
      style={{
        position: 'fixed', inset: 0, zIndex: 80,
        display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
        background: 'rgba(0,0,0,0.5)',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: 480,
          borderRadius: `${R.lg}px ${R.lg}px 0 0`,
          background: T.surface,
          padding: `20px ${PAGE_PADDING_X}px`,
          paddingBottom: 'max(24px, env(safe-area-inset-bottom))',
          boxShadow: SHADOW.elevated,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <h3 style={{ ...TYPE.h3, color: T.text, margin: 0 }}>{t.nameEdit}</h3>
          <button
            type="button"
            onClick={() => !busy && onClose()}
            style={{
              width: 36, height: 36, borderRadius: '50%',
              border: `1px solid ${T.border}`, background: T.surface,
              display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
            }}
            aria-label="Закрыть"
          >
            <X size={16} color={T.text} />
          </button>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <div style={{ borderRadius: R.md, border: `1px solid ${T.borderSubtle}`, background: T.bg, padding: 12 }}>
            <p style={{ ...TYPE.micro, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', margin: 0, color: T.textTertiary }}>{t.nameFirst}</p>
            <input
              autoFocus
              value={fn}
              onChange={(e) => setFn(e.target.value.slice(0, 60))}
              style={{ width: '100%', marginTop: 4, background: 'transparent', border: 'none', outline: 'none', ...TYPE.body, color: T.text, fontFamily: 'inherit' }}
            />
          </div>
          <div style={{ borderRadius: R.md, border: `1px solid ${T.borderSubtle}`, background: T.bg, padding: 12 }}>
            <p style={{ ...TYPE.micro, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', margin: 0, color: T.textTertiary }}>{t.nameLast}</p>
            <input
              value={ln}
              onChange={(e) => setLn(e.target.value.slice(0, 60))}
              style={{ width: '100%', marginTop: 4, background: 'transparent', border: 'none', outline: 'none', ...TYPE.body, color: T.text, fontFamily: 'inherit' }}
            />
          </div>
        </div>
        {err && <p style={{ ...TYPE.caption, color: T.danger, marginTop: 8 }}>{err}</p>}
        <button
          type="button"
          onClick={submit}
          disabled={busy || !fn.trim()}
          style={{
            marginTop: 12, width: '100%',
            padding: '14px 16px', borderRadius: R.md, border: 'none',
            background: T.text, color: T.bg,
            fontSize: 15, fontWeight: 700,
            cursor: busy ? 'wait' : 'pointer', fontFamily: 'inherit',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            opacity: (busy || !fn.trim()) ? 0.6 : 1,
          }}
        >
          {busy && <Loader2 size={14} className="animate-spin" />}
          Сохранить
        </button>
      </div>
    </div>
  );
}
