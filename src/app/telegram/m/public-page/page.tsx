/** --- YAML
 * name: MasterMiniAppPublicPage
 * description: Native Mini App превью + inline-редактор публичной страницы.
 *              Cover 120px (с кнопкой замены/удаления), аватар overlap с
 *              кнопкой замены, имя/спец/город под ним. Последовательность
 *              блоков как на вебе /m/{handle}: Hero → Stats → Bio → Услуги →
 *              Портфолио → Отзывы → Адрес → График → Рекомендую. Раздела
 *              «Место работы» нет (его и в вебе как отдельного блока нет —
 *              workplace_name живёт внутри Hero).
 * created: 2026-05-07
 * --- */

'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X, Pencil, Star, MapPin, Clock, Loader2, Users2, Globe,
  Camera, Trash2, Copy, Check,
} from 'lucide-react';
import { useAuthStore } from '@/stores/auth-store';
import { useTelegram } from '@/components/miniapp/telegram-provider';
import { getInitData } from '@/lib/telegram/webapp';
import { MobilePage, AvatarCircle } from '@/components/miniapp/shells';
import '@/styles/od-master-public-page.css';
import { MiniAppEditTextSheet } from '@/components/miniapp/edit-text-sheet';
import { AddressPickerSheet } from '@/components/miniapp/address-picker-sheet';
import { MiniAppAvatarCropSheet } from '@/components/miniapp/avatar-crop-sheet';
import { T, R, TYPE, SHADOW, PAGE_PADDING_X, SPRING } from '@/components/miniapp/design';
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
  latitude: number | null;
  longitude: number | null;
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
  close: string;
  cresIdLabel: string; cresIdCopied: string;
  worksLabel: string; clientsLabel: string; rating: string; reviews: (n: number) => string;
  bio: string; bioEmpty: string; bioEdit: string;
  name: string; nameEdit: string; nameFirst: string; nameLast: string;
  specialization: string; specEmpty: string; specEdit: string;
  services: string; servicesEmpty: string;
  portfolio: string; portfolioEmpty: string;
  hours: string; hoursEmpty: string;
  address: string; addressEmpty: string; addressEdit: string;
  reviewsTitle: string; reviewsEmpty: string; anonReviewer: string;
  partners: string; partnersEmpty: string;
  closed: string; minutes: string;
  coverSheet: string; coverReplace: string; coverDelete: string; coverDeleteConfirm: string;
  avatarTitle: string;
  saveError: string;
}> = {
  uk: {
    loading: 'Завантажуємо…', notFound: 'Профіль не знайдено',
    close: 'Закрити',
    cresIdLabel: 'CRES-ID', cresIdCopied: 'Посилання скопійовано',
    worksLabel: 'Робіт', clientsLabel: 'Клієнтів', rating: 'Рейтинг',
    reviews: (n) => `${n} відгуків`,
    bio: 'Про себе', bioEmpty: 'Тапни ✎ щоб додати опис', bioEdit: 'Про себе',
    name: 'Імʼя', nameEdit: 'Імʼя та прізвище', nameFirst: 'Імʼя', nameLast: 'Прізвище',
    specialization: 'Спеціалізація', specEmpty: 'Тапни ✎ щоб задати', specEdit: 'Спеціалізація',
    services: 'Послуги', servicesEmpty: 'Послуг поки немає',
    portfolio: 'Портфоліо', portfolioEmpty: 'Робіт поки немає',
    hours: 'Графік роботи', hoursEmpty: 'Години не вказані',
    address: 'Адреса', addressEmpty: 'Тапни ✎ щоб додати', addressEdit: 'Адреса',
    reviewsTitle: 'Відгуки', reviewsEmpty: 'Відгуків поки немає',
    anonReviewer: 'Анонімний клієнт',
    partners: 'Рекомендую', partnersEmpty: 'Поки нікого не рекомендую',
    closed: 'вихідний', minutes: 'хв',
    coverSheet: 'Обкладинка', coverReplace: 'Завантажити нову', coverDelete: 'Видалити обкладинку', coverDeleteConfirm: 'Видалити обкладинку?',
    avatarTitle: 'Аватар',
    saveError: 'Не вдалось зберегти',
  },
  ru: {
    loading: 'Загружаем…', notFound: 'Профиль не найден',
    close: 'Закрыть',
    cresIdLabel: 'CRES-ID', cresIdCopied: 'Ссылка скопирована',
    worksLabel: 'Работ', clientsLabel: 'Клиентов', rating: 'Рейтинг',
    reviews: (n) => `${n} отзывов`,
    bio: 'О себе', bioEmpty: 'Тапни ✎ чтобы добавить описание', bioEdit: 'О себе',
    name: 'Имя', nameEdit: 'Имя и фамилия', nameFirst: 'Имя', nameLast: 'Фамилия',
    specialization: 'Специализация', specEmpty: 'Тапни ✎ чтобы задать', specEdit: 'Специализация',
    services: 'Услуги', servicesEmpty: 'Услуг пока нет',
    portfolio: 'Портфолио', portfolioEmpty: 'Работ пока нет',
    hours: 'График работы', hoursEmpty: 'Часы не указаны',
    address: 'Адрес', addressEmpty: 'Тапни ✎ чтобы добавить', addressEdit: 'Адрес',
    reviewsTitle: 'Отзывы', reviewsEmpty: 'Отзывов пока нет',
    anonReviewer: 'Анонимный клиент',
    partners: 'Рекомендую', partnersEmpty: 'Пока никого не рекомендую',
    closed: 'выходной', minutes: 'мин',
    coverSheet: 'Обложка', coverReplace: 'Загрузить новую', coverDelete: 'Удалить обложку', coverDeleteConfirm: 'Удалить обложку?',
    avatarTitle: 'Аватар',
    saveError: 'Не удалось сохранить',
  },
  en: {
    loading: 'Loading…', notFound: 'Profile not found',
    close: 'Close',
    cresIdLabel: 'CRES-ID', cresIdCopied: 'Link copied',
    worksLabel: 'Visits', clientsLabel: 'Clients', rating: 'Rating',
    reviews: (n) => `${n} reviews`,
    bio: 'About', bioEmpty: 'Tap ✎ to add description', bioEdit: 'About',
    name: 'Name', nameEdit: 'First & last name', nameFirst: 'First name', nameLast: 'Last name',
    specialization: 'Specialization', specEmpty: 'Tap ✎ to set', specEdit: 'Specialization',
    services: 'Services', servicesEmpty: 'No services yet',
    portfolio: 'Portfolio', portfolioEmpty: 'No works yet',
    hours: 'Hours', hoursEmpty: 'Hours not set',
    address: 'Address', addressEmpty: 'Tap ✎ to add', addressEdit: 'Address',
    reviewsTitle: 'Reviews', reviewsEmpty: 'No reviews yet',
    anonReviewer: 'Anonymous client',
    partners: 'I recommend', partnersEmpty: 'No recommendations yet',
    closed: 'closed', minutes: 'min',
    coverSheet: 'Cover', coverReplace: 'Upload new', coverDelete: 'Remove cover', coverDeleteConfirm: 'Remove cover?',
    avatarTitle: 'Avatar',
    saveError: 'Failed to save',
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

// 'specialization' (направление мастера) удалён из inline-edit на публичке —
// направление выбирается при регистрации и меняется в Настройках, а не на
// публичной странице (по запросу 2026-05-08).
type EditField = null | 'name' | 'bio' | 'address' | 'slug';

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
  const [coverSheetOpen, setCoverSheetOpen] = useState(false);
  const [avatarCropSrc, setAvatarCropSrc] = useState<string | null>(null);
  const [imageBusy, setImageBusy] = useState(false);
  const coverInputRef = useRef<HTMLInputElement | null>(null);
  const avatarInputRef = useRef<HTMLInputElement | null>(null);
  // Portfolio lightbox + add
  const [lightboxItem, setLightboxItem] = useState<PortfolioRow | null>(null);
  const [editCaptionOpen, setEditCaptionOpen] = useState(false);
  const portfolioInputRef = useRef<HTMLInputElement | null>(null);
  // Hours editor
  const [hoursSheetOpen, setHoursSheetOpen] = useState(false);

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

  async function patchMaster(payload: Record<string, string | number | null>) {
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

  async function uploadImage(target: 'avatar' | 'cover', blob: Blob) {
    setImageBusy(true);
    try {
      const initData = getInitData();
      const form = new FormData();
      form.append('target', target);
      form.append('file', blob, `${target}-${Date.now()}.webp`);
      const res = await fetch('/api/telegram/m/master-image', {
        method: 'POST',
        headers: { ...(initData ? { 'X-TG-Init-Data': initData } : {}) },
        body: form,
      });
      if (!res.ok) { haptic('error'); return; }
      const json = await res.json() as { url?: string };
      if (json.url && master) {
        setMaster({ ...master, [target === 'avatar' ? 'avatar_url' : 'cover_url']: json.url });
        haptic('success');
      }
    } finally {
      setImageBusy(false);
    }
  }

  async function uploadPortfolioPhoto(file: File) {
    setImageBusy(true);
    try {
      const initData = getInitData();
      const form = new FormData();
      form.append('file', file);
      const res = await fetch('/api/telegram/m/master-portfolio', {
        method: 'POST',
        headers: { ...(initData ? { 'X-TG-Init-Data': initData } : {}) },
        body: form,
      });
      if (!res.ok) { haptic('error'); return; }
      await loadData();
      haptic('success');
    } finally {
      setImageBusy(false);
    }
  }

  async function updatePortfolioCaption(id: string, caption: string) {
    const initData = getInitData();
    const res = await fetch('/api/telegram/m/master-portfolio', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(initData ? { 'X-TG-Init-Data': initData } : {}),
      },
      body: JSON.stringify({ action: 'update', id, caption }),
    });
    if (!res.ok) throw new Error('failed');
    setPortfolio((arr) => arr.map((p) => p.id === id ? { ...p, caption: caption.trim() || null } : p));
    if (lightboxItem?.id === id) setLightboxItem({ ...lightboxItem, caption: caption.trim() || null });
  }

  async function deletePortfolioItem(id: string) {
    const initData = getInitData();
    const res = await fetch('/api/telegram/m/master-portfolio', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(initData ? { 'X-TG-Init-Data': initData } : {}),
      },
      body: JSON.stringify({ action: 'delete', id }),
    });
    if (!res.ok) { haptic('error'); return; }
    setPortfolio((arr) => arr.filter((p) => p.id !== id));
    setLightboxItem(null);
    haptic('success');
  }

  async function saveWorkingHours(next: WorkingHours) {
    const initData = getInitData();
    const res = await fetch('/api/telegram/m/master-patch', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(initData ? { 'X-TG-Init-Data': initData } : {}),
      },
      body: JSON.stringify({ working_hours: next }),
    });
    if (!res.ok) throw new Error('failed');
    if (master) setMaster({ ...master, working_hours: next });
  }

  async function deleteCover() {
    setImageBusy(true);
    try {
      const initData = getInitData();
      const res = await fetch('/api/telegram/m/master-image', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(initData ? { 'X-TG-Init-Data': initData } : {}),
        },
        body: JSON.stringify({ action: 'delete-cover' }),
      });
      if (!res.ok) { haptic('error'); return; }
      if (master) setMaster({ ...master, cover_url: null });
      setCoverSheetOpen(false);
      haptic('success');
    } finally {
      setImageBusy(false);
    }
  }

  // CRES-ID badge: тап копирует ссылку на публичку. Слаg/invite_code
  // редактируется в Settings (отдельная задача, тут только read-only badge).
  const [cresIdCopied, setCresIdCopied] = useState(false);
  function copyCresLink() {
    if (!master?.invite_code) return;
    haptic('light');
    const handle = master.slug || master.invite_code;
    const url = `${typeof window !== 'undefined' ? window.location.origin : ''}/m/${handle}`;
    navigator.clipboard?.writeText(url);
    setCresIdCopied(true);
    setTimeout(() => setCresIdCopied(false), 1500);
  }

  if (loading) {
    return (
      <MobilePage className="od-master-public-page">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60dvh' }}>
          <Loader2 size={24} className="animate-spin" color={T.textTertiary} />
        </div>
      </MobilePage>
    );
  }

  if (!master) {
    return (
      <MobilePage className="od-master-public-page">
        <div style={{ padding: '40px 20px', textAlign: 'center' }}>
          <p style={{ ...TYPE.body, color: T.textSecondary }}>{t.notFound}</p>
        </div>
      </MobilePage>
    );
  }

  const displayName = master.display_name || '—';
  const wh = (master.working_hours as WorkingHours | null) ?? null;
  const hasRealCover = !!master.cover_url && master.cover_url !== master.avatar_url;

  // Сортировка отзывов: с комментариями вверх, потом по дате DESC.
  const sortedReviews = [...reviews].sort((a, b) => {
    const aHas = a.comment && a.comment.trim().length > 0 ? 1 : 0;
    const bHas = b.comment && b.comment.trim().length > 0 ? 1 : 0;
    if (aHas !== bHas) return bHas - aHas;
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });

  return (
    <MobilePage className="od-master-public-page">
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25 }}
        style={{ display: 'flex', flexDirection: 'column', gap: 18, paddingBottom: 32 }}
      >
        {/* Cover — фиксированные 120px (НЕ растягивается). aspect-ratio
            явный, чтобы прозрачные PNG-логотипы не подняли блок выше. */}
        <div
          style={{
            position: 'relative',
            width: '100%',
            flexShrink: 0,
            height: 120,
            minHeight: 120,
            maxHeight: 120,
            background: hasRealCover ? T.bgSubtle : `linear-gradient(135deg, ${T.gradientFrom}, ${T.gradientTo})`,
            overflow: 'hidden',
          }}
        >
          {hasRealCover && (
            // eslint-disable-next-line @next/next/no-img-element
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
          )}
          <CloseBtn onClick={() => { haptic('light'); router.back(); }} />

          {/* Edit cover — pencil справа снизу */}
          <button
            type="button"
            onClick={() => { haptic('light'); setCoverSheetOpen(true); }}
            aria-label={t.coverSheet}
            style={{
              position: 'absolute',
              right: 12,
              bottom: 12,
              width: 36, height: 36,
              borderRadius: '50%',
              border: 'none',
              background: 'rgba(0,0,0,0.55)',
              color: '#fff',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', padding: 0,
              backdropFilter: 'blur(4px)',
            }}
          >
            <Camera size={18} strokeWidth={2.4} />
          </button>
        </div>

        {/* Hero: avatar overlap'ит cover на 40px (не больше), имя + спец + город снизу. */}
        <div
          style={{
            display: 'flex', flexDirection: 'column',
            padding: `0 ${PAGE_PADDING_X}px`,
            marginTop: -40,
          }}
        >
          <div style={{ position: 'relative', width: 92, height: 92 }}>
            <div
              style={{
                width: 92, height: 92, borderRadius: '50%',
                border: `4px solid ${T.bg}`, overflow: 'hidden', flexShrink: 0,
                background: T.surface,
                boxShadow: SHADOW.card,
              }}
            >
              <AvatarCircle url={master.avatar_url} name={displayName} size={84} />
            </div>
            {/* Edit avatar — маленький pencil справа снизу */}
            <button
              type="button"
              onClick={() => { haptic('light'); avatarInputRef.current?.click(); }}
              aria-label={t.avatarTitle}
              disabled={imageBusy}
              style={{
                position: 'absolute',
                right: -2, bottom: -2,
                width: 28, height: 28,
                borderRadius: '50%',
                border: `2px solid ${T.bg}`,
                background: T.text, color: T.bg,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer', padding: 0,
              }}
            >
              <Pencil size={12} strokeWidth={2.4} />
            </button>
          </div>
          <div style={{ marginTop: 10, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <h1 style={{ ...TYPE.h2, color: T.text, margin: 0, fontSize: 24, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {displayName}
              </h1>
              <PencilBtn onClick={() => { haptic('selection'); setEditField('name'); }} />
            </div>
            {(master.headline || master.specialization) && (
              <p style={{ ...TYPE.caption, marginTop: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {master.headline || master.specialization}
              </p>
            )}
            {master.city && (
              <p style={{ ...TYPE.micro, marginTop: 6, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                <MapPin size={11} />
                {master.city}
              </p>
            )}
            {/* CRES-ID badge — прямо под именем/спец/город. Тап = копия
                ссылки на публичку, ✎ = редактировать slug. */}
            {master.invite_code && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8 }}>
                <button
                  type="button"
                  onClick={copyCresLink}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 6,
                    padding: '5px 10px', borderRadius: R.pill,
                    border: `1px solid ${T.borderSubtle}`,
                    background: T.surface, color: T.text,
                    fontSize: 12, fontWeight: 600,
                    cursor: 'pointer', fontFamily: 'inherit',
                  }}
                >
                  {cresIdCopied ? <Check size={12} color={T.success} /> : <Copy size={12} color={T.textSecondary} />}
                  <span style={{ color: T.textTertiary, fontWeight: 500 }}>{t.cresIdLabel}</span>
                  <span style={{ fontWeight: 700 }}>@{master.slug || master.invite_code}</span>
                </button>
                <PencilBtn onClick={() => { haptic('selection'); setEditField('slug'); }} />
              </div>
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

        {/* Bio (как в вебе — сразу после Hero и Stats) */}
        <SectionWithEdit title={t.bio} onEdit={() => setEditField('bio')}>
          {master.bio ? (
            <p style={{ ...TYPE.body, color: T.text, whiteSpace: 'pre-wrap', margin: 0 }}>{master.bio}</p>
          ) : (
            <Empty text={t.bioEmpty} />
          )}
        </SectionWithEdit>

        {/* Услуги */}
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

        {/* Портфолио — тап на фото = lightbox с управлением, кнопка «+» снизу */}
        <Section title={t.portfolio}>
          {portfolio.length === 0 ? (
            <Empty text={t.portfolioEmpty} />
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 4 }}>
              {portfolio.map((it) => {
                const x = typeof it.item_x === 'number' ? it.item_x : 50;
                const y = typeof it.item_y === 'number' ? it.item_y : 50;
                return (
                  <button
                    key={it.id}
                    type="button"
                    onClick={() => { haptic('light'); setLightboxItem(it); }}
                    style={{ padding: 0, border: 'none', background: 'transparent', cursor: 'pointer', position: 'relative', overflow: 'hidden', borderRadius: R.sm }}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={it.image_url}
                      alt={it.caption ?? ''}
                      style={{
                        width: '100%', aspectRatio: '1', objectFit: 'cover',
                        objectPosition: `${x}% ${y}%`,
                        display: 'block',
                      }}
                    />
                    {it.caption && (
                      <div
                        style={{
                          position: 'absolute', left: 0, right: 0, bottom: 0,
                          padding: '14px 6px 4px',
                          background: 'linear-gradient(to top, rgba(0,0,0,0.65), transparent)',
                          color: '#fff',
                          fontSize: 10, fontWeight: 600,
                          lineHeight: 1.2,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          display: '-webkit-box',
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: 'vertical',
                          textAlign: 'left',
                        }}
                      >
                        {it.caption}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          )}
          <button
            type="button"
            onClick={() => { haptic('light'); portfolioInputRef.current?.click(); }}
            disabled={imageBusy}
            style={{
              marginTop: 10,
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              width: '100%', padding: '12px 14px',
              borderRadius: R.md,
              border: `1px dashed ${T.border}`, background: 'transparent',
              color: T.text, fontSize: 13, fontWeight: 600,
              cursor: 'pointer', fontFamily: 'inherit',
              opacity: imageBusy ? 0.6 : 1,
            }}
          >
            {imageBusy ? <Loader2 size={14} className="animate-spin" /> : <Camera size={14} />}
            Добавить фото
          </button>
        </Section>

        {/* Отзывы */}
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

        {/* Адрес (inline-edit) */}
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

        {/* График работы — read view + кнопка ✎ → bottom sheet с 7 днями */}
        <SectionWithEdit title={t.hours} onEdit={() => { haptic('selection'); setHoursSheetOpen(true); }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {DAY_KEYS.map((k, i) => {
              const day = wh ? wh[k] : null;
              const isClosed = !day || day.closed || (!day.open && !day.close);
              return (
                <div key={k} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                  <span style={{ color: T.text, fontWeight: 600, width: 36 }}>{DAYS_RU[i]}</span>
                  <span style={{ color: isClosed ? T.textTertiary : T.text }}>
                    {isClosed ? t.closed : `${day!.open} – ${day!.close}`}
                  </span>
                </div>
              );
            })}
          </div>
        </SectionWithEdit>

        {/* Рекомендую (партнёры) — тап на карточку открывает публичку
            партнёра. Пока через openExternal /m/{handle} с ref=
            текущего мастера, чтобы партнёрская атрибуция сохранялась
            (RefCapture на /m/{handle} читает ref). Клиент видит публичку
            рекомендованного мастера. */}
        <Section title={t.partners}>
          {partners.length === 0 ? (
            <Empty text={t.partnersEmpty} />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {partners.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => {
                    if (!p.invite_code) return;
                    haptic('light');
                    const myCode = master.invite_code ?? '';
                    const url = `/m/${p.invite_code}${myCode ? `?ref=${myCode}` : ''}`;
                    openExternal(url);
                  }}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '8px 10px', borderRadius: R.md,
                    border: `1px solid ${T.borderSubtle}`, background: T.surface,
                    width: '100%', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left',
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
                </button>
              ))}
            </div>
          )}
        </Section>

        {/* Соцсети — если заполнены */}
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

      {/* hidden file inputs */}
      <input
        ref={coverInputRef}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (!f) return;
          if (f.size > 8 * 1024 * 1024) { haptic('error'); return; }
          uploadImage('cover', f);
          setCoverSheetOpen(false);
          e.target.value = '';
        }}
      />
      <input
        ref={avatarInputRef}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (!f) return;
          if (f.size > 8 * 1024 * 1024) { haptic('error'); return; }
          setAvatarCropSrc(URL.createObjectURL(f));
          e.target.value = '';
        }}
      />
      <input
        ref={portfolioInputRef}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (!f) return;
          if (f.size > 8 * 1024 * 1024) { haptic('error'); return; }
          uploadPortfolioPhoto(f);
          e.target.value = '';
        }}
      />

      {/* Avatar crop — Mini App native fullscreen sheet */}
      <MiniAppAvatarCropSheet
        src={avatarCropSrc}
        title={t.avatarTitle}
        onClose={() => { if (avatarCropSrc) URL.revokeObjectURL(avatarCropSrc); setAvatarCropSrc(null); }}
        onCropped={(blob) => uploadImage('avatar', blob)}
      />

      {/* Cover sheet: «Заменить» + «Удалить» */}
      <AnimatePresence>
        {coverSheetOpen && (
          <CoverActionSheet
            t={t}
            hasCover={hasRealCover}
            busy={imageBusy}
            onPickFile={() => coverInputRef.current?.click()}
            onDelete={deleteCover}
            onClose={() => setCoverSheetOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* Inline edit text sheets */}
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
      <AddressPickerSheet
        open={editField === 'address'}
        title={t.addressEdit}
        initial={{
          address: master.address,
          latitude: master.latitude,
          longitude: master.longitude,
        }}
        onClose={() => setEditField(null)}
        onSave={async ({ address, latitude, longitude }) => {
          await patchMaster({ address, latitude, longitude });
          setMaster({ ...master, address: address || null, latitude, longitude });
        }}
      />
      <MiniAppEditTextSheet
        open={editField === 'slug'}
        title="CRES-ID"
        initialValue={master.slug ?? master.invite_code ?? ''}
        multiline={false}
        maxLength={32}
        placeholder="username (3–32 символа: латиница, цифры, . _ -)"
        onClose={() => setEditField(null)}
        onSave={async (v) => {
          const slug = v.trim().toLowerCase().replace(/[^a-z0-9._-]/g, '');
          await patchMaster({ slug });
          setMaster({ ...master, slug: slug || null });
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

      {/* Portfolio lightbox */}
      <AnimatePresence>
        {lightboxItem && (
          <PortfolioLightbox
            item={lightboxItem}
            onClose={() => setLightboxItem(null)}
            onEditCaption={() => setEditCaptionOpen(true)}
            onDelete={async () => { await deletePortfolioItem(lightboxItem.id); }}
          />
        )}
      </AnimatePresence>

      {/* Edit portfolio caption */}
      <MiniAppEditTextSheet
        open={editCaptionOpen}
        title="Подпись"
        initialValue={lightboxItem?.caption ?? ''}
        multiline
        maxLength={200}
        onClose={() => setEditCaptionOpen(false)}
        onSave={async (v) => {
          if (lightboxItem) await updatePortfolioCaption(lightboxItem.id, v);
        }}
      />

      {/* Working hours sheet */}
      <AnimatePresence>
        {hoursSheetOpen && (
          <HoursSheet
            initial={(master.working_hours as WorkingHours | null) ?? {}}
            onClose={() => setHoursSheetOpen(false)}
            onSave={async (next) => { await saveWorkingHours(next); setHoursSheetOpen(false); }}
          />
        )}
      </AnimatePresence>
    </MobilePage>
  );
}

function CoverActionSheet({
  t, hasCover, busy, onPickFile, onDelete, onClose,
}: {
  t: typeof I18N['ru'];
  hasCover: boolean;
  busy: boolean;
  onPickFile: () => void;
  onDelete: () => void;
  onClose: () => void;
}) {
  const [confirm, setConfirm] = useState(false);
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={() => !busy && onClose()}
      style={{
        position: 'fixed', inset: 0, zIndex: 80,
        display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
        background: 'rgba(0,0,0,0.5)',
      }}
    >
      <motion.div
        initial={{ y: 40, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 40, opacity: 0 }}
        transition={SPRING.default}
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: 480,
          borderRadius: `${R.lg}px ${R.lg}px 0 0`,
          background: T.surface,
          padding: `20px ${PAGE_PADDING_X}px`,
          paddingBottom: 'calc(96px + env(safe-area-inset-bottom, 0px))',
          boxShadow: SHADOW.elevated,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <h3 style={{ ...TYPE.h3, color: T.text, margin: 0 }}>{t.coverSheet}</h3>
          <button
            type="button" onClick={() => !busy && onClose()}
            aria-label={t.close}
            style={{
              width: 36, height: 36, borderRadius: '50%',
              border: `1px solid ${T.border}`, background: T.surface,
              display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
            }}
          >
            <X size={16} color={T.text} />
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <button
            type="button"
            onClick={onPickFile}
            disabled={busy}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              padding: '14px 16px',
              borderRadius: R.md, border: 'none',
              background: T.text, color: T.bg,
              fontSize: 15, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
              opacity: busy ? 0.6 : 1,
            }}
          >
            {busy ? <Loader2 size={16} className="animate-spin" /> : <Camera size={16} />}
            {t.coverReplace}
          </button>
          {hasCover && (
            <button
              type="button"
              onClick={() => {
                if (!confirm) { setConfirm(true); return; }
                onDelete();
              }}
              disabled={busy}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                padding: '14px 16px',
                borderRadius: R.md,
                border: `1px solid ${T.dangerSoft}`,
                background: T.dangerSoft,
                color: T.danger,
                fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
              }}
            >
              <Trash2 size={14} />
              {confirm ? t.coverDeleteConfirm : t.coverDelete}
            </button>
          )}
        </div>
      </motion.div>
    </motion.div>
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
          paddingBottom: 'calc(96px + env(safe-area-inset-bottom, 0px))',
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

function PortfolioLightbox({
  item, onClose, onEditCaption, onDelete,
}: {
  item: PortfolioRow;
  onClose: () => void;
  onEditCaption: () => void;
  onDelete: () => Promise<void>;
}) {
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 90,
        background: 'rgba(0,0,0,0.92)',
        display: 'flex', flexDirection: 'column',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '12px 16px' }}>
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onClose(); }}
          aria-label="Закрыть"
          style={{
            width: 36, height: 36, borderRadius: '50%',
            border: 'none', background: 'rgba(255,255,255,0.18)',
            color: '#fff',
            display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
          }}
        >
          <X size={18} />
        </button>
      </div>
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 16px', minHeight: 0 }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={item.image_url}
          alt={item.caption ?? ''}
          style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', borderRadius: 12 }}
        />
      </div>
      <div onClick={(e) => e.stopPropagation()} style={{ padding: '16px', color: '#fff' }}>
        {item.caption ? (
          <p style={{ fontSize: 14, margin: 0, marginBottom: 12, whiteSpace: 'pre-wrap' }}>{item.caption}</p>
        ) : (
          <p style={{ fontSize: 13, margin: 0, marginBottom: 12, opacity: 0.6, fontStyle: 'italic' }}>Без подписи</p>
        )}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <button
            type="button"
            onClick={onEditCaption}
            style={{
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              padding: '12px', borderRadius: R.pill,
              border: '1px solid rgba(255,255,255,0.25)', background: 'rgba(255,255,255,0.08)',
              color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
            }}
          >
            <Pencil size={14} />
            Подпись
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={async () => {
              if (!confirm) { setConfirm(true); return; }
              setBusy(true);
              try { await onDelete(); } finally { setBusy(false); }
            }}
            style={{
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              padding: '12px', borderRadius: R.pill,
              border: '1px solid rgba(239,68,68,0.6)', background: 'rgba(239,68,68,0.18)',
              color: '#fca5a5', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
              opacity: busy ? 0.6 : 1,
            }}
          >
            {busy ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
            {confirm ? 'Удалить?' : 'Удалить'}
          </button>
        </div>
      </div>
    </motion.div>
  );
}

function HoursSheet({
  initial, onClose, onSave,
}: {
  initial: WorkingHours;
  onClose: () => void;
  onSave: (next: WorkingHours) => Promise<void>;
}) {
  const [days, setDays] = useState<WorkingHours>(() => {
    const out: WorkingHours = {};
    for (const k of DAY_KEYS) {
      const d = initial[k];
      out[k] = d
        ? { open: d.open || '09:00', close: d.close || '18:00', closed: d.closed ?? (!d.open && !d.close) }
        : { open: '09:00', close: '18:00', closed: true };
    }
    return out;
  });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  function update(key: string, patch: Partial<{ open: string; close: string; closed: boolean }>) {
    setDays((prev) => {
      const cur = prev[key] ?? { open: '09:00', close: '18:00', closed: true };
      return { ...prev, [key]: { ...cur, ...patch } };
    });
  }

  async function submit() {
    if (busy) return;
    setBusy(true);
    setErr(null);
    try {
      // Чистим выходные от time'ов чтобы не вводить в заблуждение публичку.
      const out: WorkingHours = {};
      for (const k of DAY_KEYS) {
        const d = days[k];
        if (!d || d.closed) { out[k] = { open: '', close: '', closed: true }; continue; }
        out[k] = { open: d.open, close: d.close, closed: false };
      }
      await onSave(out);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={() => !busy && onClose()}
      style={{
        position: 'fixed', inset: 0, zIndex: 80,
        display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
        background: 'rgba(0,0,0,0.5)',
      }}
    >
      <motion.div
        initial={{ y: 40, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 40, opacity: 0 }}
        transition={SPRING.default}
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: 480,
          borderRadius: `${R.lg}px ${R.lg}px 0 0`,
          background: T.surface,
          padding: `20px ${PAGE_PADDING_X}px`,
          paddingBottom: 'calc(96px + env(safe-area-inset-bottom, 0px))',
          boxShadow: SHADOW.elevated,
          maxHeight: '90dvh', overflowY: 'auto',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <h3 style={{ ...TYPE.h3, color: T.text, margin: 0 }}>График работы</h3>
          <button
            type="button"
            onClick={() => !busy && onClose()}
            aria-label="Закрыть"
            style={{
              width: 36, height: 36, borderRadius: '50%',
              border: `1px solid ${T.border}`, background: T.surface,
              display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
            }}
          >
            <X size={16} color={T.text} />
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {DAY_KEYS.map((k, i) => {
            const d = days[k] ?? { open: '09:00', close: '18:00', closed: true };
            return (
              <div
                key={k}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '10px 12px', borderRadius: R.md,
                  border: `1px solid ${T.borderSubtle}`,
                  background: d.closed ? T.bgSubtle : T.bg,
                }}
              >
                <span style={{ width: 32, fontSize: 13, fontWeight: 700, color: T.text }}>{DAYS_RU[i]}</span>
                {d.closed ? (
                  <span style={{ flex: 1, fontSize: 13, color: T.textTertiary }}>выходной</span>
                ) : (
                  <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <input
                      type="time"
                      value={d.open}
                      onChange={(e) => update(k, { open: e.target.value })}
                      style={{
                        flex: 1, fontSize: 14, fontWeight: 600,
                        background: 'transparent', border: 'none', outline: 'none',
                        color: T.text, fontFamily: 'inherit',
                      }}
                    />
                    <span style={{ color: T.textTertiary }}>–</span>
                    <input
                      type="time"
                      value={d.close}
                      onChange={(e) => update(k, { close: e.target.value })}
                      style={{
                        flex: 1, fontSize: 14, fontWeight: 600,
                        background: 'transparent', border: 'none', outline: 'none',
                        color: T.text, fontFamily: 'inherit',
                      }}
                    />
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => update(k, { closed: !d.closed })}
                  style={{
                    width: 40, height: 24, borderRadius: 12,
                    border: 'none', padding: 0,
                    background: d.closed ? T.borderSubtle : T.accent,
                    position: 'relative', cursor: 'pointer',
                    flexShrink: 0,
                  }}
                  aria-label="Выходной"
                >
                  <span
                    style={{
                      position: 'absolute', top: 3,
                      left: d.closed ? 3 : 19,
                      width: 18, height: 18, borderRadius: '50%',
                      background: '#fff',
                      transition: 'left 0.2s',
                    }}
                  />
                </button>
              </div>
            );
          })}
        </div>

        {err && <p style={{ ...TYPE.caption, color: T.danger, marginTop: 8 }}>{err}</p>}

        <button
          type="button"
          onClick={submit}
          disabled={busy}
          style={{
            marginTop: 14, width: '100%',
            padding: '14px 16px', borderRadius: R.md, border: 'none',
            background: T.text, color: T.bg,
            fontSize: 15, fontWeight: 700,
            cursor: busy ? 'wait' : 'pointer', fontFamily: 'inherit',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            opacity: busy ? 0.6 : 1,
          }}
        >
          {busy && <Loader2 size={14} className="animate-spin" />}
          Сохранить
        </button>
      </motion.div>
    </motion.div>
  );
}
