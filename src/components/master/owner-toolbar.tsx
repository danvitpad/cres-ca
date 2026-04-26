/** --- YAML
 * name: OwnerToolbar
 * description: Floating top-bar для мастера на /m/{handle}. Видна только владельцу
 *              (по совпадению auth.user.id с master.profile_id).
 *              Содержит:
 *                ← Кабинет — возврат в Mini App home (или /calendar для web)
 *                Настроить — открывает PublicPageCustomizer drawer (как раньше)
 *              Заменяет старый floating-кнопку «Настроить страницу» в правом нижнем углу.
 *              Видна сверху, прилипает к safe-area-top.
 * created: 2026-04-26
 * --- */

'use client';

import { useEffect, useState } from 'react';
import { ArrowLeft, Settings as SettingsIcon } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { PublicPageCustomizer } from './public-page-customizer';

interface MasterCfg {
  id: string;
  profile_id: string | null;
  bio: string | null;
  cover_url: string | null;
  theme_primary_color: string | null;
  theme_background_color: string | null;
  banner_position_y: number | null;
  phone_public: boolean | null;
  email_public: boolean | null;
  dob_public: boolean | null;
  interests: string[] | null;
  social_links: Record<string, string> | null;
  page_type: string | null;
  is_public: boolean | null;
  languages: string[] | null;
  workplace_name: string | null;
  workplace_photo_url: string | null;
  profile?: { avatar_url: string | null } | null;
}

/** Detect Mini App context — used to decide back-button target. */
function isInsideTelegramMiniApp(): boolean {
  if (typeof window === 'undefined') return false;
  const w = window as { Telegram?: { WebApp?: { initData?: string } } };
  if (w.Telegram?.WebApp?.initData) return true;
  // Fallback: check sessionStorage cres:tg (set by /telegram/page.tsx) or pathname referer
  try {
    if (sessionStorage.getItem('cres:tg')) return true;
  } catch { /* ignore */ }
  return false;
}

export function OwnerToolbar({ masterProfileId }: { masterProfileId: string | null }) {
  const [isOwner, setIsOwner] = useState(false);
  const [open, setOpen] = useState(false);
  const [master, setMaster] = useState<MasterCfg | null>(null);

  useEffect(() => {
    if (!masterProfileId) return;
    const supabase = createClient();
    supabase.auth.getUser().then(async ({ data }) => {
      if (data.user?.id !== masterProfileId) return;
      setIsOwner(true);
      const { data: row } = await supabase
        .from('masters')
        .select('id, profile_id, bio, cover_url, theme_primary_color, theme_background_color, banner_position_y, phone_public, email_public, dob_public, interests, social_links, page_type, is_public, languages, workplace_name, workplace_photo_url, profile:profiles!masters_profile_id_fkey(avatar_url)')
        .eq('profile_id', masterProfileId)
        .maybeSingle();
      if (row) setMaster(row as unknown as MasterCfg);
    });
  }, [masterProfileId]);

  if (!isOwner || !master) return null;

  function goBack() {
    if (isInsideTelegramMiniApp()) {
      window.location.href = '/telegram/m/profile';
    } else {
      // Web flow — back to dashboard home
      window.location.href = '/calendar';
    }
  }

  return (
    <>
      {/* Top floating toolbar — owner-only */}
      <div
        className="fixed left-0 right-0 z-40 flex items-center justify-between gap-2 px-3"
        style={{
          top: 'max(env(safe-area-inset-top, 0px), 8px)',
          pointerEvents: 'none',
        }}
      >
        <button
          type="button"
          onClick={goBack}
          className="inline-flex items-center gap-1.5 rounded-full bg-white/95 px-3 py-2 text-sm font-semibold text-neutral-900 shadow-lg backdrop-blur transition-all hover:bg-white ring-1 ring-black/5"
          style={{ pointerEvents: 'auto' }}
          title="Вернуться в кабинет"
        >
          <ArrowLeft className="h-4 w-4" />
          Кабинет
        </button>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="inline-flex items-center gap-1.5 rounded-full bg-foreground/95 px-3 py-2 text-sm font-semibold text-background shadow-lg backdrop-blur transition-all hover:bg-foreground"
          style={{ pointerEvents: 'auto' }}
          title="Открыть редактор страницы"
        >
          <SettingsIcon className="h-4 w-4" />
          Настроить
        </button>
      </div>
      <PublicPageCustomizer
        open={open}
        onOpenChange={setOpen}
        master={master}
        onSaved={() => {
          window.location.reload();
        }}
      />
    </>
  );
}
