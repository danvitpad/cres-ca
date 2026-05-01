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

export function PublicBackButton() {
  const router = useRouter();
  const [show, setShow] = useState(false);

  useEffect(() => {
    // В Mini App за back уже отвечает Telegram WebApp BackButton — здесь
    // лишний крестик только запутает. Скрываем если внутри TG.
    const isTg = typeof window !== 'undefined'
      && !!(window as { Telegram?: { WebApp?: unknown } }).Telegram?.WebApp;
    setShow(!isTg);
  }, []);

  if (!show) return null;

  function onClick() {
    // history.length включает и текущую страницу — поэтому > 1 значит «есть
    // куда возвращаться». Если ровно 1 (прямой переход) — уходим на feed.
    if (typeof window !== 'undefined' && window.history.length > 1) {
      router.back();
    } else {
      router.push(`/${detectLocale()}/feed`);
    }
  }

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Назад"
      style={{
        position: 'fixed',
        top: 16,
        left: 16,
        zIndex: 50,
        width: 40,
        height: 40,
        borderRadius: 999,
        border: '1px solid rgba(0,0,0,0.08)',
        background: 'rgba(255,255,255,0.94)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        color: '#111',
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
