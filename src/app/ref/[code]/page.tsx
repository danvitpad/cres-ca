/** --- YAML
 * name: ReferralByCodeLanding
 * description: Public landing for generic profile→profile referrals. /ref/[code] looks up profiles.referral_code,
 *              shows "Вас пригласил X, зарегистрируйтесь и получите бонус". Sets `ref` cookie, then redirects
 *              authed users to home / guests to /register?ref=<code>. Separate from master→client /r/[handle].
 * created: 2026-04-19
 * --- */

import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';
import { cookies } from 'next/headers';
import { Gift, ArrowRight } from 'lucide-react';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';

interface PageProps {
  params: Promise<{ code: string }>;
}

export default async function ReferralByCodePage({ params }: PageProps) {
  const { code } = await params;
  if (!code || code.length < 4) notFound();

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );

  const { data: inviter } = await admin
    .from('profiles')
    .select('id, full_name, avatar_url, role')
    .eq('referral_code', code.toLowerCase())
    .maybeSingle();

  if (!inviter) notFound();

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (user) {
    if (user.id === inviter.id) redirect('/');
    const jar = await cookies();
    jar.set('pending_ref', code.toLowerCase(), {
      maxAge: 60 * 60 * 24 * 30,
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
    });
    redirect('/');
  }

  const jar = await cookies();
  jar.set('pending_ref', code.toLowerCase(), {
    maxAge: 60 * 60 * 24 * 30,
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
  });

  const name = inviter.full_name || 'Пользователь';

  return (
    <div
      style={{
        minHeight: '100dvh',
        background: 'linear-gradient(180deg, #0f1011 0%, #1f2023 100%)',
        color: '#fff',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
        fontFamily: 'Inter, system-ui, sans-serif',
      }}
    >
      <div style={{ maxWidth: 480, width: '100%', textAlign: 'center' }}>
        <div
          style={{
            width: 88,
            height: 88,
            borderRadius: 24,
            margin: '0 auto 24px',
            background: 'linear-gradient(135deg, #6950f3 0%, #8b6cf7 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 12px 40px rgba(113, 112, 255, 0.35)',
          }}
        >
          <Gift size={40} color="#fff" />
        </div>
        <h1 style={{ fontSize: 28, fontWeight: 700, margin: '0 0 12px 0', letterSpacing: '-0.5px' }}>
          Вас пригласил {name}
        </h1>
        <p style={{ fontSize: 16, color: 'rgba(255,255,255,0.7)', lineHeight: 1.5, margin: '0 0 32px 0' }}>
          Зарегистрируйтесь в CRES-CA — и вы оба получите бонусы на счёт.
        </p>
        <Link
          href={`/register?ref=${code.toLowerCase()}`}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            padding: '14px 28px',
            borderRadius: 12,
            background: '#fff',
            color: '#0f1011',
            fontSize: 15,
            fontWeight: 600,
            textDecoration: 'none',
            boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
          }}
        >
          Зарегистрироваться
          <ArrowRight size={16} />
        </Link>
      </div>
    </div>
  );
}
