/** --- YAML
 * name: MiniAppSettingsPage
 * description: «Налаштування» Mini App — визуал из mobile-client/profile-settings мокапа.
 *              Back + title, секции: Мова (3 кнопки), Тема (Світла/Темна/Авто),
 *              Email-сповіщення (4 toggle), Приватність (2 toggle).
 *              Тема — useMiniAppTheme. Мова — setMiniAppLocale. Тогглы — localStorage.
 * created: 2026-04-14
 * updated: 2026-05-17
 * --- */

'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Sun, Moon, Monitor, Bell, ChevronRight } from 'lucide-react';
import { useTelegram } from '@/components/miniapp/telegram-provider';
import { MobilePage } from '@/components/miniapp/shells';
import { useMiniAppTheme } from '@/components/miniapp/theme';
import { useMiniAppLocale, setMiniAppLocale } from '@/lib/miniapp/use-locale';
import '@/styles/od-client-mini-app.css';

type Lang = 'uk' | 'ru' | 'en';

const T_LABELS: Record<Lang, {
  title: string;
  sectionLang: string;
  langUK: string; langRU: string; langEN: string;
  sectionTheme: string; themeLight: string; themeDark: string; themeAuto: string;
  sectionReminders: string;
  remindersTitle: string; remindersSub: string;
  sectionNotif: string;
  notifReminder: string; notifReminderSub: string;
  notifConfirm: string; notifConfirmSub: string;
  notifPromo: string; notifPromoSub: string;
  notifReview: string; notifReviewSub: string;
  sectionPrivacy: string;
  privAllergy: string; privAllergySub: string;
  privAnalytics: string; privAnalyticsSub: string;
}> = {
  uk: {
    title: 'Налаштування',
    sectionLang: 'Мова',
    langUK: 'Українська', langRU: 'Російська', langEN: 'Англійська',
    sectionTheme: 'Тема', themeLight: 'Світла', themeDark: 'Темна', themeAuto: 'Авто',
    sectionReminders: 'Нагадування',
    remindersTitle: 'Налаштувати нагадування', remindersSub: 'За скільки до запису надсилати',
    sectionNotif: 'Email-сповіщення',
    notifReminder: 'Нагадування про візит', notifReminderSub: 'За 24 години до запису',
    notifConfirm: 'Підтвердження запису', notifConfirmSub: 'Одразу після створення',
    notifPromo: 'Акції та новини', notifPromoSub: 'Раз на тиждень',
    notifReview: 'Запит відгуку після візиту', notifReviewSub: 'Через 2 години',
    sectionPrivacy: 'Приватність',
    privAllergy: 'Доступ до анкети алергій', privAllergySub: 'Тільки під час активного запису',
    privAnalytics: 'Аналітика', privAnalyticsSub: 'Анонімні дані використання',
  },
  ru: {
    title: 'Настройки',
    sectionLang: 'Язык',
    langUK: 'Украинский', langRU: 'Русский', langEN: 'Английский',
    sectionTheme: 'Тема', themeLight: 'Светлая', themeDark: 'Тёмная', themeAuto: 'Авто',
    sectionReminders: 'Напоминания',
    remindersTitle: 'Настроить напоминания', remindersSub: 'За сколько до записи присылать',
    sectionNotif: 'Email-уведомления',
    notifReminder: 'Напоминание о визите', notifReminderSub: 'За 24 часа до записи',
    notifConfirm: 'Подтверждение записи', notifConfirmSub: 'Сразу после создания',
    notifPromo: 'Акции и новости', notifPromoSub: 'Раз в неделю',
    notifReview: 'Запрос отзыва после визита', notifReviewSub: 'Через 2 часа',
    sectionPrivacy: 'Приватность',
    privAllergy: 'Доступ к анкете аллергий', privAllergySub: 'Только во время активной записи',
    privAnalytics: 'Аналитика', privAnalyticsSub: 'Анонимные данные использования',
  },
  en: {
    title: 'Settings',
    sectionLang: 'Language',
    langUK: 'Ukrainian', langRU: 'Russian', langEN: 'English',
    sectionTheme: 'Theme', themeLight: 'Light', themeDark: 'Dark', themeAuto: 'Auto',
    sectionReminders: 'Reminders',
    remindersTitle: 'Set reminder timing', remindersSub: 'How long before the appointment',
    sectionNotif: 'Email notifications',
    notifReminder: 'Appointment reminder', notifReminderSub: '24 hours before',
    notifConfirm: 'Booking confirmation', notifConfirmSub: 'Right after creation',
    notifPromo: 'Promotions and news', notifPromoSub: 'Weekly',
    notifReview: 'Review request after visit', notifReviewSub: '2 hours after',
    sectionPrivacy: 'Privacy',
    privAllergy: 'Allergy form access', privAllergySub: 'Only during active appointment',
    privAnalytics: 'Analytics', privAnalyticsSub: 'Anonymous usage data',
  },
};

type ToggleKey = 'reminder' | 'confirm' | 'promo' | 'review' | 'allergy' | 'analytics';
const STORAGE_KEY = 'cres:client-settings-v1';
const DEFAULT_TOGGLES: Record<ToggleKey, boolean> = {
  reminder: true, confirm: true, promo: false, review: true,
  allergy: true, analytics: true,
};

export default function MiniAppSettingsPage() {
  const router = useRouter();
  const { haptic } = useTelegram();
  const lang = useMiniAppLocale();
  const t = T_LABELS[lang];
  const { override, setOverride } = useMiniAppTheme();

  const [toggles, setToggles] = useState<Record<ToggleKey, boolean>>(DEFAULT_TOGGLES);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<Record<ToggleKey, boolean>>;
        setToggles((prev) => ({ ...prev, ...parsed }));
      }
    } catch {}
  }, []);

  function setToggle(key: ToggleKey, value: boolean) {
    haptic('selection');
    setToggles((prev) => {
      const next = { ...prev, [key]: value };
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {}
      return next;
    });
  }

  function changeLang(code: Lang) {
    haptic('selection');
    setMiniAppLocale(code);
  }

  function changeTheme(t: 'light' | 'dark' | null) {
    haptic('selection');
    setOverride(t);
  }

  // Current theme value: override ('light' | 'dark') or null (auto)
  const themeValue: 'light' | 'dark' | 'auto' = override === null ? 'auto' : override;

  return (
    <MobilePage className="od-client-mini-app">
      {/* Back + title */}
      <button
        onClick={() => { haptic('light'); router.back(); }}
        className="mps-back"
      >
        <ArrowLeft size={20} />
        <span className="mps-back-t">{t.title}</span>
      </button>

      {/* Language */}
      <div className="mps-section-t">{t.sectionLang}</div>
      <div className="mps-card">
        <div className="mps-opt">
          <button className={`mps-o ${lang === 'uk' ? 'active' : ''}`} onClick={() => changeLang('uk')}>
            {t.langUK}
          </button>
          <button className={`mps-o ${lang === 'ru' ? 'active' : ''}`} onClick={() => changeLang('ru')}>
            {t.langRU}
          </button>
          <button className={`mps-o ${lang === 'en' ? 'active' : ''}`} onClick={() => changeLang('en')}>
            {t.langEN}
          </button>
        </div>
      </div>

      {/* Theme */}
      <div className="mps-section-t">{t.sectionTheme}</div>
      <div className="mps-card">
        <div className="mps-opt">
          <button className={`mps-o ${themeValue === 'light' ? 'active' : ''}`} onClick={() => changeTheme('light')}>
            <Sun size={18} /> {t.themeLight}
          </button>
          <button className={`mps-o ${themeValue === 'dark' ? 'active' : ''}`} onClick={() => changeTheme('dark')}>
            <Moon size={18} /> {t.themeDark}
          </button>
          <button className={`mps-o ${themeValue === 'auto' ? 'active' : ''}`} onClick={() => changeTheme(null)}>
            <Monitor size={18} /> {t.themeAuto}
          </button>
        </div>
      </div>

      {/* Reminders — custom-timing редактор: за сколько до визита получать
          напоминание. Юзер сам выбирает (10 мин / 1 час / 2 дня / неделя и т.д.). */}
      <div className="mps-section-t">{t.sectionReminders}</div>
      <div className="mps-card" style={{ padding: 0 }}>
        <Link
          href="/telegram/settings/notifications"
          onClick={() => haptic('light')}
          className="mp-row"
          style={{ margin: 0, borderRadius: 0 }}
        >
          <div className="mp-row-i"><Bell size={18} /></div>
          <div className="mp-row-l">
            {t.remindersTitle}
            <div style={{ fontSize: 11, fontWeight: 500, color: 'var(--fg-2)', marginTop: 2 }}>
              {t.remindersSub}
            </div>
          </div>
          <div className="mp-row-arr"><ChevronRight size={16} /></div>
        </Link>
      </div>

      {/* Email notifications */}
      <div className="mps-section-t">{t.sectionNotif}</div>
      <div className="mps-card">
        <ToggleRow title={t.notifReminder} sub={t.notifReminderSub} checked={toggles.reminder} onChange={(v) => setToggle('reminder', v)} />
        <ToggleRow title={t.notifConfirm} sub={t.notifConfirmSub} checked={toggles.confirm} onChange={(v) => setToggle('confirm', v)} />
        <ToggleRow title={t.notifPromo} sub={t.notifPromoSub} checked={toggles.promo} onChange={(v) => setToggle('promo', v)} />
        <ToggleRow title={t.notifReview} sub={t.notifReviewSub} checked={toggles.review} onChange={(v) => setToggle('review', v)} />
      </div>

      {/* Privacy */}
      <div className="mps-section-t">{t.sectionPrivacy}</div>
      <div className="mps-card">
        <ToggleRow title={t.privAllergy} sub={t.privAllergySub} checked={toggles.allergy} onChange={(v) => setToggle('allergy', v)} />
        <ToggleRow title={t.privAnalytics} sub={t.privAnalyticsSub} checked={toggles.analytics} onChange={(v) => setToggle('analytics', v)} />
      </div>

      <div style={{ height: 20 }} />
    </MobilePage>
  );
}

function ToggleRow({
  title, sub, checked, onChange,
}: {
  title: string;
  sub: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="mps-row">
      <div>
        <div className="mps-rt">{title}</div>
        <div className="mps-rs">{sub}</div>
      </div>
      <label className="mps-sw">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
        />
        <span className="mps-swt" />
        <span className="mps-swth" />
      </label>
    </div>
  );
}
