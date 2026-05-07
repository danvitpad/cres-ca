/** --- YAML
 * name: MasterMiniAppPublicPage
 * description: Native Mini App превью публичной страницы мастера (как видят
 *              клиенты). Hero + статистика + био + услуги + портфолио +
 *              контакты + часы. Кнопка ✕ слева сверху для возврата.
 *              Полное редактирование (логотип / обложка / категории / отзывы)
 *              открывается во внешнем браузере через WebApp.openLink — там
 *              живёт inline-edit с шкалой полей и cookie session мастера.
 *              Раньше тап на «Моя страница» открывал тот же web-экран в TG
 *              WebView, но он секунду подгружался и не выглядел нативно.
 *              Этот экран рендерится мгновенно из supabase + Mini App tokens.
 * created: 2026-05-07
 * --- */

'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  X, Pencil, Star, MapPin, Phone, Mail, Globe, Clock,
  ExternalLink, Loader2, Share2,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useAuthStore } from '@/stores/auth-store';
import { useTelegram } from '@/components/miniapp/telegram-provider';
import { MobilePage, AvatarCircle } from '@/components/miniapp/shells';
import { T, R, TYPE, SHADOW, PAGE_PADDING_X } from '@/components/miniapp/design';
import { useMiniAppLocale, type MiniAppLang } from '@/lib/miniapp/use-locale';

interface MasterData {
  id: string;
  display_name: string | null;
  specialization: string | null;
  bio: string | null;
  city: string | null;
  rating: number;
  total_reviews: number;
  avatar_url: string | null;
  cover_url: string | null;
  invite_code: string | null;
  workplace: string | null;
  address: string | null;
  phone: string | null;
  instagram: string | null;
  total_appointments: number;
  total_clients: number;
}

interface ServiceRow {
  id: string;
  name: string;
  duration_minutes: number;
  price: number;
  currency: string;
  color: string | null;
}

interface PortfolioRow {
  id: string;
  image_url: string;
  caption: string | null;
}

const I18N: Record<MiniAppLang, {
  loading: string; notFound: string;
  close: string; share: string; editAll: string; editAllHint: string;
  worksLabel: string; clientsLabel: string; rating: string; reviews: (n: number) => string;
  bio: string; bioEmpty: string;
  services: string; servicesEmpty: string;
  portfolio: string; portfolioEmpty: string;
  contacts: string; contactsEmpty: string;
  hours: string;
  noPhone: string; noEmail: string; noInstagram: string;
  minutes: string;
}> = {
  uk: {
    loading: 'Завантажуємо…', notFound: 'Профіль не знайдено',
    close: 'Закрити', share: 'Поділитись',
    editAll: 'Повне редагування', editAllHint: 'Логотип, обкладинка, портфоліо, відгуки — у браузері',
    worksLabel: 'Робіт', clientsLabel: 'Клієнтів', rating: 'Рейтинг',
    reviews: (n) => `${n} відгуків`,
    bio: 'Про себе', bioEmpty: 'Розкажи про себе у браузерному редакторі',
    services: 'Послуги', servicesEmpty: 'Послуг поки немає',
    portfolio: 'Портфоліо', portfolioEmpty: 'Робіт поки немає',
    contacts: 'Контакти', contactsEmpty: 'Контактів поки немає',
    hours: 'Графік роботи',
    noPhone: 'Телефон не вказаний', noEmail: 'Email не вказаний', noInstagram: 'Instagram не вказаний',
    minutes: 'хв',
  },
  ru: {
    loading: 'Загружаем…', notFound: 'Профиль не найден',
    close: 'Закрыть', share: 'Поделиться',
    editAll: 'Полное редактирование', editAllHint: 'Логотип, обложка, портфолио, отзывы — в браузере',
    worksLabel: 'Работ', clientsLabel: 'Клиентов', rating: 'Рейтинг',
    reviews: (n) => `${n} отзывов`,
    bio: 'О себе', bioEmpty: 'Расскажи о себе в браузерном редакторе',
    services: 'Услуги', servicesEmpty: 'Услуг пока нет',
    portfolio: 'Портфолио', portfolioEmpty: 'Работ пока нет',
    contacts: 'Контакты', contactsEmpty: 'Контактов пока нет',
    hours: 'График работы',
    noPhone: 'Телефон не указан', noEmail: 'Email не указан', noInstagram: 'Instagram не указан',
    minutes: 'мин',
  },
  en: {
    loading: 'Loading…', notFound: 'Profile not found',
    close: 'Close', share: 'Share',
    editAll: 'Full editor', editAllHint: 'Logo, cover, portfolio, reviews — in the browser',
    worksLabel: 'Visits', clientsLabel: 'Clients', rating: 'Rating',
    reviews: (n) => `${n} reviews`,
    bio: 'About', bioEmpty: 'Tell about yourself in the browser editor',
    services: 'Services', servicesEmpty: 'No services yet',
    portfolio: 'Portfolio', portfolioEmpty: 'No works yet',
    contacts: 'Contacts', contactsEmpty: 'No contacts yet',
    hours: 'Working hours',
    noPhone: 'Phone not set', noEmail: 'Email not set', noInstagram: 'Instagram not set',
    minutes: 'min',
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
  const [profileEmail, setProfileEmail] = useState<string | null>(null);
  const [services, setServices] = useState<ServiceRow[]>([]);
  const [portfolio, setPortfolio] = useState<PortfolioRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    (async () => {
      const supabase = createClient();
      const { data: m } = await supabase
        .from('masters')
        .select('id, display_name, specialization, bio, city, rating, total_reviews, avatar_url, cover_url, invite_code, workplace, address, phone, instagram, total_appointments, total_clients')
        .eq('profile_id', userId)
        .maybeSingle<MasterData>();
      if (cancelled) return;
      if (!m) { setLoading(false); return; }
      setMaster(m);

      const { data: p } = await supabase
        .from('profiles')
        .select('email')
        .eq('id', userId)
        .maybeSingle<{ email: string | null }>();
      if (!cancelled && p) setProfileEmail(p.email);

      const [{ data: svc }, { data: port }] = await Promise.all([
        supabase
          .from('services')
          .select('id, name, duration_minutes, price, currency, color')
          .eq('master_id', m.id)
          .eq('is_active', true)
          .order('price', { ascending: false }),
        supabase
          .from('portfolio_items')
          .select('id, image_url, caption')
          .eq('master_id', m.id)
          .order('sort_order', { ascending: true })
          .limit(12),
      ]);
      if (cancelled) return;
      setServices((svc as ServiceRow[] | null) ?? []);
      setPortfolio((port as PortfolioRow[] | null) ?? []);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [userId]);

  function shareLink() {
    if (!master?.invite_code) return;
    haptic('light');
    const url = `${typeof window !== 'undefined' ? window.location.origin : ''}/m/${master.invite_code}`;
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
    openExternal(`/m/${master.invite_code}?owner=1&from=miniapp-public`);
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

  return (
    <MobilePage>
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25 }}
        style={{ display: 'flex', flexDirection: 'column', gap: 16, paddingBottom: 24 }}
      >
        {/* Cover + close button */}
        <div style={{ position: 'relative', width: '100%' }}>
          {master.cover_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={master.cover_url}
              alt=""
              style={{ width: '100%', height: 160, objectFit: 'cover', display: 'block' }}
            />
          ) : (
            <div
              style={{
                width: '100%',
                height: 120,
                background: `linear-gradient(135deg, ${T.gradientFrom}40, ${T.gradientTo}40)`,
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
              width: 36,
              height: 36,
              borderRadius: '50%',
              border: `1px solid ${T.border}`,
              background: T.surface,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              boxShadow: SHADOW.card,
            }}
          >
            <X size={18} strokeWidth={2.4} color={T.text} />
          </button>
        </div>

        {/* Hero: avatar + name + spec + city */}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: `0 ${PAGE_PADDING_X}px`, marginTop: -40 }}>
          <div
            style={{
              width: 80, height: 80, borderRadius: '50%',
              border: `4px solid ${T.bg}`, overflow: 'hidden', flexShrink: 0,
              background: T.surface,
            }}
          >
            <AvatarCircle url={master.avatar_url} name={displayName} size={72} />
          </div>
          <div style={{ flex: 1, minWidth: 0, paddingTop: 44 }}>
            <h1 style={{ ...TYPE.h2, color: T.text, margin: 0, fontSize: 22 }}>{displayName}</h1>
            {master.specialization && (
              <p style={{ ...TYPE.caption, marginTop: 2 }}>{master.specialization}</p>
            )}
            {master.city && (
              <p style={{ ...TYPE.micro, marginTop: 4, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                <MapPin size={11} />
                {master.city}
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
            <p style={{ ...TYPE.caption, color: T.textTertiary, margin: 0 }}>{t.bioEmpty}</p>
          )}
        </Section>

        {/* Services */}
        <Section title={t.services}>
          {services.length === 0 ? (
            <p style={{ ...TYPE.caption, color: T.textTertiary, margin: 0 }}>{t.servicesEmpty}</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {services.map((s) => (
                <div
                  key={s.id}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 12,
                    padding: '10px 12px', borderRadius: R.md,
                    border: `1px solid ${T.borderSubtle}`, background: T.surface,
                  }}
                >
                  <span style={{ width: 8, height: 8, borderRadius: 999, background: s.color || T.accent, flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ ...TYPE.bodyStrong, color: T.text, margin: 0 }}>{s.name}</p>
                    <p style={{ ...TYPE.micro, marginTop: 2, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                      <Clock size={10} />
                      {s.duration_minutes} {t.minutes}
                    </p>
                  </div>
                  <p style={{ fontSize: 14, fontWeight: 800, color: T.text, fontVariantNumeric: 'tabular-nums', margin: 0 }}>
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
            <p style={{ ...TYPE.caption, color: T.textTertiary, margin: 0 }}>{t.portfolioEmpty}</p>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 4 }}>
              {portfolio.map((it) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  key={it.id}
                  src={it.image_url}
                  alt={it.caption ?? ''}
                  style={{ width: '100%', aspectRatio: '1', objectFit: 'cover', borderRadius: R.sm, display: 'block' }}
                />
              ))}
            </div>
          )}
        </Section>

        {/* Contacts */}
        <Section title={t.contacts}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <ContactRow icon={<Phone size={14} />} value={master.phone} placeholder={t.noPhone} />
            <ContactRow icon={<Mail size={14} />} value={profileEmail} placeholder={t.noEmail} />
            <ContactRow icon={<Globe size={14} />} value={master.instagram} placeholder={t.noInstagram} />
            {master.address && (
              <ContactRow icon={<MapPin size={14} />} value={master.address} placeholder="" />
            )}
          </div>
        </Section>
      </motion.div>
    </MobilePage>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ padding: `0 ${PAGE_PADDING_X}px` }}>
      <h2 style={{ ...TYPE.h3, color: T.text, margin: '0 0 8px', fontSize: 16 }}>{title}</h2>
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

function ContactRow({ icon, value, placeholder }: { icon: React.ReactNode; value: string | null; placeholder: string }) {
  const empty = !value || !value.trim();
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <span style={{ color: empty ? T.textTertiary : T.text, flexShrink: 0 }}>{icon}</span>
      <span style={{ fontSize: 13, color: empty ? T.textTertiary : T.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {empty ? placeholder : value}
      </span>
    </div>
  );
}
