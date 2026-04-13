/** --- YAML
 * name: InviteLanding
 * description: Resolves a master invite_code to a master profile, auto-links the authed client, and redirects. For anon visitors, stores code in a cookie for post-login claim.
 * created: 2026-04-13
 * updated: 2026-04-13
 * --- */

import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { createClient } from '@/lib/supabase/server';

interface Props {
  params: Promise<{ locale: string; code: string }>;
  searchParams: Promise<{ ref?: string }>;
}

export default async function InvitePage({ params, searchParams }: Props) {
  const { locale, code } = await params;
  const { ref } = await searchParams;

  const supabase = await createClient();
  const { data: master } = await supabase
    .from('masters')
    .select('id, is_active')
    .eq('invite_code', code)
    .maybeSingle();

  if (!master || !master.is_active) {
    redirect(`/${locale}/masters`);
  }

  const { data: { user } } = await supabase.auth.getUser();

  if (user) {
    await supabase
      .from('client_master_links')
      .upsert({ profile_id: user.id, master_id: master.id }, { onConflict: 'profile_id,master_id' });
    if (ref && ref !== user.id) {
      // Record the referral once — ignore conflicts.
      await supabase.from('referrals').insert({
        referrer_profile_id: ref,
        referee_profile_id: user.id,
        master_id: master.id,
        source: 'invite_link',
      }).then(() => {}, () => {});
    }
    redirect(`/${locale}/masters/${master.id}`);
  }

  // Anon: stash the code + ref in a short-lived cookie so we can claim after signup.
  const jar = await cookies();
  jar.set('pending_invite', JSON.stringify({ master_id: master.id, ref: ref ?? null }), {
    maxAge: 60 * 60 * 24 * 7,
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
  });
  redirect(`/${locale}/login?invite=${master.id}`);
}
