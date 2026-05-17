/** --- YAML
 * name: MiniAppProfilePage
 * description: «Профіль» Mini App — визуал из mobile-client/profile мокапа.
 *              Аватар + ім'я + телефон → редактор (карандаш справа сверху).
 *              3-кол. карточка stats (Відвідувань / Майстри / Витрачено).
 *              Меню: Мої майстри / Налаштування / Підтримка / Вийти.
 * created: 2026-04-13
 * updated: 2026-05-17
 * --- */

'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Pencil, Users, Settings, MessageCircle, LogOut, ChevronRight, Loader2,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useAuthStore } from '@/stores/auth-store';
import { useTelegram } from '@/components/miniapp/telegram-provider';
import { showConfirm } from '@/lib/telegram/webapp';
import { MobilePage } from '@/components/miniapp/shells';
import '@/styles/od-client-mini-app.css';
import { useMiniAppLocale } from '@/lib/miniapp/use-locale';

type Lang = 'uk' | 'ru' | 'en';

const T_LABELS: Record<Lang, {
  notSet: string;
  stat_visits: string; stat_masters: string; stat_spent: string;
  menuMasters: string; menuSettings: string; menuSupport: string; logout: string;
  logoutConfirm: string; user: string; edit: string;
}> = {
  uk: {
    notSet: 'Не вказано',
    stat_visits: 'Відвідувань', stat_masters: 'Майстри', stat_spent: 'Витрачено',
    menuMasters: 'Мої майстри', menuSettings: 'Налаштування', menuSupport: 'Підтримка',
    logout: 'Вийти',
    logoutConfirm: 'Вийти з акаунту?',
    user: 'Користувач', edit: 'Редагувати',
  },
  ru: {
    notSet: 'Не указано',
    stat_visits: 'Посещений', stat_masters: 'Мастера', stat_spent: 'Потрачено',
    menuMasters: 'Мои мастера', menuSettings: 'Настройки', menuSupport: 'Поддержка',
    logout: 'Выйти',
    logoutConfirm: 'Выйти из аккаунта?',
    user: 'Пользователь', edit: 'Редактировать',
  },
  en: {
    notSet: 'Not set',
    stat_visits: 'Visits', stat_masters: 'Masters', stat_spent: 'Spent',
    menuMasters: 'My masters', menuSettings: 'Settings', menuSupport: 'Support',
    logout: 'Sign out',
    logoutConfirm: 'Sign out?',
    user: 'User', edit: 'Edit',
  },
};

function initialsOf(name: string): string {
  return name.trim().split(/\s+/).slice(0, 2).map((p) => p.charAt(0).toUpperCase()).join('') || '?';
}

interface ProfileData {
  full_name: string;
  phone: string | null;
  avatar_url: string | null;
}

export default function MiniAppProfilePage() {
  const router = useRouter();
  const { haptic } = useTelegram();
  const { userId, clearAuth } = useAuthStore();
  const lang = useMiniAppLocale();
  const t = T_LABELS[lang];

  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [stats, setStats] = useState({ visits: 0, masters: 0, spent: 0 });
  const [loading, setLoading] = useState(true);
  const [signingOut, setSigningOut] = useState(false);

  useEffect(() => {
    // userId может ещё не быть загруженным (AuthProvider hydrate в TG WebApp).
    // Ждём — loading остаётся true, exit early. useEffect перезапустится когда
    // userId появится.
    if (!userId) return;
    let cancelled = false;
    (async () => {
      const supabase = createClient();
      const { data: prof } = await supabase
        .from('profiles')
        .select('full_name, first_name, last_name, phone, avatar_url')
        .eq('id', userId)
        .maybeSingle();
      if (cancelled) return;
      if (prof) {
        const p = prof as { full_name: string | null; first_name: string | null; last_name: string | null; phone: string | null; avatar_url: string | null };
        // Чистое склеивание first+last — если оба null, fallback на full_name.
        const composed = [p.first_name, p.last_name].filter(Boolean).join(' ').trim();
        const fullName = composed || p.full_name || t.user;
        setProfile({
          full_name: fullName,
          phone: p.phone,
          avatar_url: p.avatar_url,
        });
      }

      // Stats: completed visits + unique masters + total spent
      const { data: clientRows } = await supabase
        .from('clients').select('id').eq('profile_id', userId);
      const clientIds = (clientRows ?? []).map((c) => (c as { id: string }).id);
      let visits = 0, masters = 0, spent = 0;
      if (clientIds.length > 0) {
        const { data: appts } = await supabase
          .from('appointments')
          .select('master_id, price, status')
          .in('client_id', clientIds)
          .eq('status', 'completed');
        const rows = (appts ?? []) as Array<{ master_id: string | null; price: number | string | null }>;
        visits = rows.length;
        masters = new Set(rows.map((r) => r.master_id).filter(Boolean)).size;
        spent = rows.reduce((s, r) => s + (r.price ? Number(r.price) : 0), 0);
      }
      if (!cancelled) {
        setStats({ visits, masters, spent });
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [userId, t.user]);

  // Safety: если AuthProvider за 5 сек не подтянул userId (например cookie
  // отсутствует в TG WebApp) — снимаем skeleton чтобы юзер видел хотя бы
  // empty state, а не вечный спиннер.
  useEffect(() => {
    const timer = setTimeout(() => {
      if (!userId) setLoading(false);
    }, 5000);
    return () => clearTimeout(timer);
  }, [userId]);

  async function signOut() {
    if (signingOut) return;
    const ok = await showConfirm(t.logoutConfirm);
    if (!ok) return;
    setSigningOut(true);
    haptic('warning');
    try {
      const supabase = createClient();
      await supabase.auth.signOut();
      clearAuth();
      router.push('/');
    } finally {
      setSigningOut(false);
    }
  }

  const initials = useMemo(() => initialsOf(profile?.full_name ?? '?'), [profile?.full_name]);

  if (loading) {
    return (
      <MobilePage className="od-client-mini-app">
        <div className="mc-loading"><Loader2 size={24} className="animate-spin" /></div>
      </MobilePage>
    );
  }

  return (
    <MobilePage className="od-client-mini-app">
      {/* Header: avatar + name + phone + edit */}
      <div className="mp-hd">
        <Link
          href="/telegram/profile/edit"
          onClick={() => haptic('light')}
          className="mp-edit"
          aria-label={t.edit}
        >
          <Pencil size={16} />
        </Link>
        <div className="mp-av">
          {profile?.avatar_url
            ? <img src={profile.avatar_url} alt="" style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
            : initials}
        </div>
        <div className="mp-name">{profile?.full_name ?? t.user}</div>
        <div className="mp-phone">{profile?.phone ?? t.notSet}</div>
      </div>

      {/* 3-col stats */}
      <div className="mp-stats">
        <div>
          <div className="mp-stat-n">{stats.visits}</div>
          <div className="mp-stat-l">{t.stat_visits}</div>
        </div>
        <div>
          <div className="mp-stat-n">{stats.masters}</div>
          <div className="mp-stat-l">{t.stat_masters}</div>
        </div>
        <div>
          <div className="mp-stat-n">₴{Math.round(stats.spent).toLocaleString('uk-UA').replace(/\s/g, ' ')}</div>
          <div className="mp-stat-l">{t.stat_spent}</div>
        </div>
      </div>

      {/* Menu list */}
      <div className="mp-menu">
        <Link href="/telegram/connections" onClick={() => haptic('light')} className="mp-row">
          <div className="mp-row-i"><Users size={18} /></div>
          <div className="mp-row-l">{t.menuMasters}</div>
          {stats.masters > 0 && <div className="mp-row-c">{stats.masters}</div>}
          <div className="mp-row-arr"><ChevronRight size={16} /></div>
        </Link>
        <Link href="/telegram/settings" onClick={() => haptic('light')} className="mp-row">
          <div className="mp-row-i"><Settings size={18} /></div>
          <div className="mp-row-l">{t.menuSettings}</div>
          <div className="mp-row-arr"><ChevronRight size={16} /></div>
        </Link>
        <a
          href="https://t.me/cres_ca_bot?start=support"
          target="_blank"
          rel="noreferrer"
          onClick={() => haptic('light')}
          className="mp-row"
        >
          <div className="mp-row-i"><MessageCircle size={18} /></div>
          <div className="mp-row-l">{t.menuSupport}</div>
          <div className="mp-row-arr"><ChevronRight size={16} /></div>
        </a>
        <button
          className="mp-row danger"
          onClick={signOut}
          disabled={signingOut}
        >
          <div className="mp-row-i"><LogOut size={18} /></div>
          <div className="mp-row-l">{t.logout}</div>
        </button>
      </div>

      <div style={{ height: 16 }} />
    </MobilePage>
  );
}
