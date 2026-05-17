/** --- YAML
 * name: PublicBackButton
 * description: Плавающий крестик/стрелка «Назад» в левом верхнем углу публичной
 *              страницы мастера. Появляется только в обычном веб-контексте
 *              (не в Mini App, где есть встроенный TG BackButton). Клик —
 *              router.back(); если history пустая (юзер открыл прямую ссылку),
 *              уходим на /ru/feed (домашняя клиента) либо /ru.
 * created: 2026-05-01
 * --- */

'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

// /m/[handle] живёт вне /[locale] segment — там нет NextIntlClientProvider,
// поэтому useLocale() падает с 500. Локаль читаем вручную из cookie/URL,
// или берём 'ru' по дефолту.
function detectLocale(): string {
  if (typeof window === 'undefined') return 'ru';
  // 1. Cookie NEXT_LOCALE (next-intl ставит)
  const m = document.cookie.match(/(?:^|;\s*)NEXT_LOCALE=([^;]+)/);
  if (m && /^(ru|uk|en)$/.test(m[1])) return m[1];
  // 2. Document language
  const lang = (document.documentElement.lang || '').slice(0, 2);
  if (/^(ru|uk|en)$/.test(lang)) return lang;
  return 'ru';
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

/**
 * Единая кнопка «Назад» в левом верхнем углу публичной страницы.
 *
 * Поведение:
 *  - В Telegram Mini App не рендерится (там встроенный BackButton).
 *  - Для владельца страницы (auth.user.id === master.profile_id) — уводит в кабинет
 *    (`/telegram/m/profile` если внутри TG, иначе `/calendar`).
 *  - Для гостя — `router.back()` или fallback на `/feed`.
 *
 * Важно: если на странице есть `OwnerToolbar` со своей кнопкой «Кабинет» — она
 * скрыта, чтобы не дублировать UI. Эта кнопка — единственная.
 */
export function PublicBackButton({ masterProfileId }: { masterProfileId?: string | null }) {
  const router = useRouter();
  const [show, setShow] = useState(false);
  const [isOwner, setIsOwner] = useState(false);

  useEffect(() => {
    // Показываем всегда — даже в TG WebApp. Данил: «нет кнопки выйти»
    // (TG-native X-Close на iPhone сливается с темной темой страницы,
    // юзер не видит куда нажать). Дублируем явной web-кнопкой.
    setShow(true);
  }, []);

  useEffect(() => {
    if (!masterProfileId) return;
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      if (data.user?.id === masterProfileId) setIsOwner(true);
    });
  }, [masterProfileId]);

  if (!show) return null;

  function onClick() {
    // Владелец → возврат в кабинет
    if (isOwner) {
      if (isInsideTelegramMiniApp()) {
        window.location.href = '/telegram/m/profile';
      } else {
        window.location.href = '/calendar';
      }
      return;
    }
    // Гость → router.back() или feed
    if (typeof window !== 'undefined' && window.history.length > 1) {
      router.back();
    } else {
      router.push(`/${detectLocale()}/feed`);
    }
  }

  // Цвета через CSS-переменные публичной темы — чтобы кнопка читалась и в
  // светлой, и в тёмной теме мастера / системы.
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={isOwner ? 'Вернуться в кабинет' : 'Назад'}
      title={isOwner ? 'Вернуться в кабинет' : 'Назад'}
      style={{
        position: 'fixed',
        // Опускаем ниже TG controls (Close/Menu). На обычном вебе safe-area = 0,
        // плюс 12px паддинг сверху. В TG WebApp safe-area + еще 56px на TG header.
        top: 'calc(max(var(--tg-safe-top, 0px), env(safe-area-inset-top, 0px)) + 56px)',
        left: 12,
        zIndex: 50,
        width: 40,
        height: 40,
        borderRadius: 999,
        border: '1px solid var(--m-border, rgba(0,0,0,0.08))',
        background: 'var(--m-surface, rgba(255,255,255,0.94))',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        color: 'var(--m-text, #111)',
        boxShadow: '0 4px 14px rgba(0,0,0,0.08)',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
        transition: 'transform 120ms ease, box-shadow 120ms ease',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = 'scale(1.04)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = 'scale(1)';
      }}
    >
      <ArrowLeft size={18} strokeWidth={2.4} />
    </button>
  );
}
