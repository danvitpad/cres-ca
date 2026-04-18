/** --- YAML
 * name: InviteLanding
 * description: Handles two invite types by code. (1) salon_invites (team mode) — renders accept UI for master/receptionist
 *              to join a salon. (2) masters.invite_code (legacy solo-master) — auto-links authed client to the master.
 *              Checks salon_invites first; falls back to legacy flow.
 * created: 2026-04-13
 * updated: 2026-04-19
 * --- */

import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import TeamInviteCard from './team-invite-card';

interface Props {
  params: Promise<{ locale: string; code: string }>;
  searchParams: Promise<{ ref?: string }>;
}

export default async function InvitePage({ params, searchParams }: Props) {
  const { locale, code } = await params;
  const { ref } = await searchParams;

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );

  const { data: teamInvite } = await admin
    .from('salon_invites')
    .select('id, salon_id, role, expires_at, used_at')
    .eq('code', code)
    .maybeSingle();

  if (teamInvite) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      const jar = await cookies();
      jar.set('pending_team_invite', code, {
        maxAge: 60 * 60 * 24 * 7,
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
      });
      redirect(`/${locale}/login?team_invite=${code}`);
    }

    const { data: salon } = await admin
      .from('salons')
      .select('id, name, logo_url, team_mode')
      .eq('id', teamInvite.salon_id)
      .maybeSingle();

    const expired = new Date(teamInvite.expires_at).getTime() < Date.now();

    return (
      <TeamInviteCard
        code={code}
        locale={locale}
        salon={salon ? { id: salon.id, name: salon.name, logoUrl: salon.logo_url, teamMode: salon.team_mode } : null}
        role={teamInvite.role as 'master' | 'receptionist'}
        usedAt={teamInvite.used_at}
        expired={expired}
      />
    );
  }

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
      const { data: refClient } = await supabase
        .from('clients').select('id').eq('profile_id', ref).maybeSingle();
      const { data: meClient } = await supabase
        .from('clients').select('id').eq('profile_id', user.id).maybeSingle();
      if (refClient?.id && meClient?.id) {
        await supabase.from('referrals').insert({
          referrer_client_id: refClient.id,
          referred_client_id: meClient.id,
          bonus_points: 0,
        }).then(() => {}, () => {});
      }
    }
    redirect(`/${locale}/masters/${master.id}`);
  }

  const jar = await cookies();
  jar.set('pending_invite', JSON.stringify({ master_id: master.id, ref: ref ?? null }), {
    maxAge: 60 * 60 * 24 * 7,
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
  });
  redirect(`/${locale}/login?invite=${master.id}`);
}
