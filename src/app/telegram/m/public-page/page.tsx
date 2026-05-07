/** --- YAML
 * name: MasterMiniAppPublicPage
 * description: Native Mini App превью публичной страницы мастера — паритет с
 *              /m/{handle} в вебе и /telegram/(app)/search/[id] у клиента.
 *              Секции: cover, hero (avatar+name+spec+city+rating), stats,
 *              actions (share + полное редактирование), bio, услуги, портфолио,
 *              часы работы, языки, адрес, отзывы, рекомендации (партнёры).
 *              Контактных данных (телефон / email) тут нет — они живут в
 *              Settings под тумблерами «Показывать на публичной».
 * created: 2026-05-07
 * --- */

'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  X, Pencil, Star, MapPin, Globe, Clock,
  ExternalLink, Loader2, Share2, Users2,
} from 'lucide-react';
import { useAuthStore } from '@/stores/auth-store';
import { useTelegram } from '@/components/miniapp/telegram-provider';
import { getInitData } from '@/lib/telegram/webapp';
import { MobilePage, AvatarCircle } from '@/components/miniapp/shells';
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
  languages: string[];
  interests: string[];
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
  bio: string; bioEmpty: string;
  services: string; servicesEmpty: string;
  portfolio: string; portfolioEmpty: string;
  hours: string; hoursEmpty: string;
  languages: string; languagesEmpty: string;
  address: string; addressEmpty: string;
  reviewsTitle: string; reviewsEmpty: string; anonReviewer: string;
  partners: string; partnersEmpty: string;
  closed: string; minutes: string;
}> = {
  uk: {
    loading: 'Завантажуємо…', notFound: 'Профіль не знайдено',
    close: 'Закрити', share: 'Поділитись',
    editAll: 'Повне редагування', editAllHint: 'Логотип, обкладинка, послуги, відгуки — у браузері',
    worksLabel: 'Робіт', clientsLabel: 'Клієнтів', rating: 'Рейтинг',
    reviews: (n) => `${n} відгуків`,
    bio: 'Про себе', bioEmpty: 'Розкажи про себе у браузерному редакторі',
    services: 'Послуги', servicesEmpty: 'Послуг поки немає',
    portfolio: 'Портфоліо', portfolioEmpty: 'Робіт поки немає',
    hours: 'Графік роботи', hoursEmpty: 'Години не вказані',
    languages: 'Мови', languagesEmpty: 'Мови не вказані',
    address: 'Адреса', addressEmpty: 'Адреса не вказана',
    reviewsTitle: 'Відгуки', reviewsEmpty: 'Відгуків поки немає',
    anonReviewer: 'Анонімний клієнт',
    partners: 'Рекомендую', partnersEmpty: 'Поки нікого не рекомендую',
    closed: 'вихідний', minutes: 'хв',
  },
  ru: {
    loading: 'Загружаем…', notFound: 'Профиль не найден',
    close: 'Закрыть', share: 'Поделиться',
    editAll: 'Полное редактирование', editAllHint: 'Логотип, обложка, услуги, отзывы — в браузере',
    worksLabel: 'Работ', clientsLabel: 'Клиентов', rating: 'Рейтинг',
    reviews: (n) => `${n} отзывов`,
    bio: 'О себе', bioEmpty: 'Расскажи о себе в браузерном редакторе',
    services: 'Услуги', servicesEmpty: 'Услуг пока нет',
    portfolio: 'Портфолио', portfolioEmpty: 'Работ пока нет',
    hours: 'График работы', hoursEmpty: 'Часы не указаны',
    languages: 'Языки', languagesEmpty: 'Языки не указаны',
    address: 'Адрес', addressEmpty: 'Адрес не указан',
    reviewsTitle: 'Отзывы', reviewsEmpty: 'Отзывов пока нет',
    anonReviewer: 'Анонимный клиент',
    partners: 'Рекомендую', partnersEmpty: 'Пока никого не рекомендую',
    closed: 'выходной', minutes: 'мин',
  },
  en: {
    loading: 'Loading…', notFound: 'Profile not found',
    close: 'Close', share: 'Share',
    editAll: 'Full editor', editAllHint: 'Logo, cover, services, reviews — in the browser',
    worksLabel: 'Visits', clientsLabel: 'Clients', rating: 'Rating',
    reviews: (n) => `${n} reviews`,
    bio: 'About', bioEmpty: 'Tell about yourself in the browser editor',
    services: 'Services', servicesEmpty: 'No services yet',
    portfolio: 'Portfolio', portfolioEmpty: 'No works yet',
    hours: 'Hours', hoursEmpty: 'Hours not set',
    languages: 'Languages', languagesEmpty: 'Languages not set',
    address: 'Address', addressEmpty: 'Address not set',
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

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    (async () => {
      const initData = getInitData();
      const res = await fetch('/api/telegram/m/public-page-data', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(initData ? { 'X-TG-Init-Data': initData } : {}),
        },
        body: JSON.stringify({}),
      });
      if (cancelled) return;
      if (!res.ok) { setLoading(false); return; }
      const json = await res.json() as {
        master: MasterData | null;
        services: ServiceRow[];
        portfolio: PortfolioRow[];
        reviews: ReviewRow[];
        partners: PartnerRow[];
      };
      if (cancelled) return;
      setMaster(json.master);
      setServices(json.services ?? []);
      setPortfolio(json.portfolio ?? []);
      setReviews(json.reviews ?? []);
      setPartners(json.partners ?? []);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [userId]);

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

  return (
    <MobilePage>
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25 }}
        style={{ display: 'flex', flexDirection: 'column', gap: 18, paddingBottom: 32 }}
      >
        {/* Cover — фиксированная высота 180px, фон-плейсхолдер серый чтобы
            прозрачные PNG не накладывались на контент ниже. Аватар не
            пересекается с cover — рендерится отдельной строкой. */}
        <div
          style={{
            position: 'relative',
            width: '100%',
            height: 180,
            background: T.bgSubtle,
            overflow: 'hidden',
          }}
        >
          {master.cover_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={master.cover_url}
              alt=""
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                objectPosition: 'center',
                display: 'block',
              }}
            />
          ) : (
            <div
              style={{
                width: '100%',
                height: '100%',
                background: `linear-gradient(135deg, ${T.gradientFrom}, ${T.gradientTo})`,
                opacity: 0.35,
              }}
            />
          )}
          <button
            type="button"
            onClick={() => { haptic('light'); router.back(); }}
            aria-label={t.close}
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
        </div>

        {/* Hero: avatar + name. Avatar overlap'ит cover на 30px (классический
            Fresha-стиль), но строго в своём grid-row, не накладываясь на контент. */}
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 12, padding: `0 ${PAGE_PADDING_X}px`, marginTop: -50 }}>
          <div
            style={{
              width: 84, height: 84, borderRadius: '50%',
              border: `4px solid ${T.bg}`, overflow: 'hidden', flexShrink: 0,
              background: T.surface,
            }}
          >
            <AvatarCircle url={master.avatar_url} name={displayName} size={76} />
          </div>
          <div style={{ flex: 1, minWidth: 0, paddingBottom: 4 }}>
            <h1 style={{ ...TYPE.h2, color: T.text, margin: 0, fontSize: 22 }}>{displayName}</h1>
            {(master.headline || master.specialization) && (
              <p style={{ ...TYPE.caption, marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {master.headline || master.specialization}
              </p>
            )}
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

        {/* Actions: Share + Full editor */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, padding: `0 ${PAGE_PADDING_X}px` }}>
          <button
            type="button"
            onClick={shareLink}
            disabled={!master.invite_code}
            style={{
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              padding: '12px 14px', borderRadius: R.pill,
              border: `1px solid ${T.border}`, background: T.surface, color: T.text,
              fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
              opacity: master.invite_code ? 1 : 0.5,
            }}
          >
            <Share2 size={14} strokeWidth={2.2} />
            {t.share}
          </button>
          <button
            type="button"
            onClick={openFullEditor}
            disabled={!master.invite_code}
            style={{
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              padding: '12px 14px', borderRadius: R.pill,
              border: 'none', background: T.text, color: T.bg,
              fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
              opacity: master.invite_code ? 1 : 0.5,
            }}
          >
            <Pencil size={14} strokeWidth={2.2} />
            {t.editAll}
            <ExternalLink size={11} strokeWidth={2.2} />
          </button>
        </div>
        <p style={{ ...TYPE.micro, textAlign: 'center', padding: `0 ${PAGE_PADDING_X}px`, marginTop: -8 }}>
          {t.editAllHint}
        </p>

        {/* Bio */}
        <Section title={t.bio}>
          {master.bio ? (
            <p style={{ ...TYPE.body, color: T.text, whiteSpace: 'pre-wrap', margin: 0 }}>{master.bio}</p>
          ) : (
            <Empty text={t.bioEmpty} />
          )}
        </Section>

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
                const scale = typeof it.item_scale === 'number' ? it.item_scale : 1;
                return (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    key={it.id}
                    src={it.image_url}
                    alt={it.caption ?? ''}
                    style={{
                      width: '100%',
                      aspectRatio: '1',
                      objectFit: 'cover',
                      objectPosition: `${x}% ${y}%`,
                      transform: scale !== 1 ? `scale(${scale})` : undefined,
                      borderRadius: R.sm,
                      display: 'block',
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

        {/* Languages */}
        <Section title={t.languages}>
          {master.languages && master.languages.length > 0 ? (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {master.languages.map((l) => (
                <span
                  key={l}
                  style={{
                    padding: '4px 10px', borderRadius: 999,
                    border: `1px solid ${T.borderSubtle}`, background: T.bgSubtle,
                    fontSize: 12, color: T.text, fontWeight: 600,
                  }}
                >
                  {l}
                </span>
              ))}
            </div>
          ) : (
            <Empty text={t.languagesEmpty} />
          )}
        </Section>

        {/* Address */}
        <Section title={t.address}>
          {master.address ? (
            <p style={{ ...TYPE.body, color: T.text, margin: 0, display: 'inline-flex', alignItems: 'flex-start', gap: 8 }}>
              <MapPin size={16} style={{ marginTop: 2, flexShrink: 0 }} color={T.textSecondary} />
              <span>{master.address}</span>
            </p>
          ) : (
            <Empty text={t.addressEmpty} />
          )}
        </Section>

        {/* Reviews */}
        <Section title={t.reviewsTitle}>
          {reviews.length === 0 ? (
            <Empty text={t.reviewsEmpty} />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {reviews.slice(0, 5).map((r) => (
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

        {/* Partners / Recommendations */}
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

        {/* Social links — Instagram / TikTok / YouTube etc. */}
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
    </MobilePage>
  );
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
