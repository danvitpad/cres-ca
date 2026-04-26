/** --- YAML
 * name: OwnerEditButton
 * description: Floating «Настроить страницу» button on /m/{handle}. Visible only when
 *              the logged-in user owns the page. Opens PublicPageCustomizer drawer.
 *              Refetches the master row on save and reloads the page so the public
 *              view reflects the change without manual F5.
 * created: 2026-04-26
 * --- */

'use client';

import { useEffect, useState } from 'react';
import { Settings as SettingsIcon } from 'lucide-react';
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
  profile?: { avatar_url: string | null } | null;
}

export function OwnerEditButton({ masterProfileId }: { masterProfileId: string | null }) {
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
        .select('id, profile_id, bio, cover_url, theme_primary_color, theme_background_color, banner_position_y, phone_public, email_public, dob_public, interests, social_links, page_type, is_public, profile:profiles!masters_profile_id_fkey(avatar_url)')
        .eq('profile_id', masterProfileId)
        .maybeSingle();
      if (row) setMaster(row as unknown as MasterCfg);
    });
  }, [masterProfileId]);

  if (!isOwner || !master) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed bottom-5 right-5 z-40 inline-flex items-center gap-2 rounded-full bg-foreground/90 px-4 py-2.5 text-sm font-semibold text-background shadow-lg backdrop-blur transition-all hover:bg-foreground"
        title="Открыть редактор страницы"
      >
        <SettingsIcon className="h-4 w-4" />
        Настроить страницу
      </button>
      <PublicPageCustomizer
        open={open}
        onOpenChange={setOpen}
        master={master}
        onSaved={() => {
          // Reload the server-rendered public page so the changes are visible.
          window.location.reload();
        }}
      />
    </>
  );
}
