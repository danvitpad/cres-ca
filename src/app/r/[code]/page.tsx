/** --- YAML
 * name: ReferralLandingPage
 * description: Public referral landing — /r/{handle}. Shows master + reward for the referrer's invite, CTA to book. Reads masters (public) by handle.
 * created: 2026-04-18
 * updated: 2026-04-18
 * --- */

import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Gift, Calendar, ArrowRight } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';

interface MasterRecord {
  id: string;
  handle: string | null;
  client_referral_enabled: boolean | null;
  client_referral_reward_type: 'percent' | 'fixed' | 'service' | null;
  client_referral_reward_value: number | null;
  client_referral_min_visits: number | null;
  profile: { full_name: string | null; first_name: string | null; avatar_url: string | null } | null;
}

const CURRENCY = 'UAH';

function rewardText(type: string | null | undefined, value: number | null | undefined): string {
  if (type === 'percent') return `${value ?? 10}%`;
  if (type === 'fixed') return `${value ?? 100} ${CURRENCY}`;
  if (type === 'service') return 'бесплатную услугу';
  return 'бонус';
}

export default async function ReferralLandingPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const supabase = await createClient();

  const { data } = await supabase
    .from('masters')
    .select(`
      id, handle,
      client_referral_enabled, client_referral_reward_type,
      client_referral_reward_value, client_referral_min_visits,
      profile:profiles!masters_profile_id_fkey(full_name, first_name, avatar_url)
    `)
    .eq('handle', code)
    .maybeSingle();

  const master = data as unknown as MasterRecord | null;
  if (!master || !master.client_referral_enabled) notFound();

  const name = master.profile?.first_name || master.profile?.full_name || 'Мастер';
  const reward = rewardText(master.client_referral_reward_type, master.client_referral_reward_value);
  const minVisits = master.client_referral_min_visits ?? 1;

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
            background: 'linear-gradient(135deg, var(--color-accent) 0%, #8b6cf7 100%)',
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
          Запишитесь на первый визит и получите <b style={{ color: '#fff' }}>{reward}</b>
          {minVisits > 1 ? ` после ${minVisits} визитов` : ''}. Подарок — от друга, который рекомендует.
        </p>

        <Link
          href={`/m/${master.handle}`}
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
          <Calendar size={18} />
          Записаться к {name}
          <ArrowRight size={16} />
        </Link>

        <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', marginTop: 32 }}>
          Перейдя по ссылке, вы соглашаетесь с участием в программе рекомендаций.
        </p>
      </div>
    </div>
  );
}
