/** --- YAML
 * name: Share Story Card
 * description: Генерирует 1080x1920 картинку «Я рекомендую X» — для постинга в IG/TG Stories. Query `from` — имя рекомендующего.
 * created: 2026-04-14
 * updated: 2026-04-14
 * --- */

import { ImageResponse } from 'next/og';
import { createClient as createAdminClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';

export async function GET(request: Request, { params }: { params: Promise<{ master_id: string }> }) {
  const { master_id } = await params;
  const url = new URL(request.url);
  const fromName = url.searchParams.get('from') ?? '';

  const supabase = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );
  const { data: m } = await supabase
    .from('masters')
    .select('display_name, specialization, city, rating, total_reviews, invite_code, profile:profiles(full_name, avatar_url)')
    .eq('id', master_id)
    .maybeSingle();

  type M = {
    display_name: string | null;
    specialization: string | null;
    city: string | null;
    rating: number | null;
    total_reviews: number | null;
    invite_code: string | null;
    profile: { full_name: string; avatar_url: string | null } | { full_name: string; avatar_url: string | null }[] | null;
  };
  const master = m as unknown as M | null;
  const p = Array.isArray(master?.profile) ? master?.profile?.[0] : master?.profile;
  const name = master?.display_name ?? p?.full_name ?? 'мастер';
  const spec = master?.specialization ?? '';
  const city = master?.city ?? '';
  const avatar = p?.avatar_url ?? null;
  const rating = Number(master?.rating ?? 0);
  const handle = master?.invite_code ?? '';

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(180deg, #0f0f1a 0%, #2a1740 50%, #4a1540 100%)',
          color: 'white',
          padding: 80,
          fontFamily: 'system-ui',
        }}
      >
        <div style={{ fontSize: 36, opacity: 0.6, textTransform: 'uppercase', letterSpacing: 8, marginBottom: 40 }}>
          {fromName ? `${fromName} рекомендует` : 'Рекомендую'}
        </div>

        {avatar ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={avatar}
            alt=""
            width={360}
            height={360}
            style={{ borderRadius: 9999, border: '8px solid rgba(255,255,255,0.2)', objectFit: 'cover' }}
          />
        ) : (
          <div
            style={{
              width: 360,
              height: 360,
              borderRadius: 9999,
              background: 'linear-gradient(135deg, #a855f7, #ec4899)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 180,
              fontWeight: 900,
            }}
          >
            {name[0]}
          </div>
        )}

        <div style={{ fontSize: 84, fontWeight: 900, marginTop: 60, textAlign: 'center' }}>{name}</div>
        {spec && (
          <div style={{ fontSize: 44, opacity: 0.75, marginTop: 12, textAlign: 'center' }}>{spec}</div>
        )}
        {city && (
          <div style={{ fontSize: 36, opacity: 0.55, marginTop: 12 }}>📍 {city}</div>
        )}

        {rating > 0 && (
          <div style={{ fontSize: 48, marginTop: 40, display: 'flex', alignItems: 'center', gap: 16 }}>
            <span>⭐</span>
            <span style={{ fontWeight: 800 }}>{rating.toFixed(1)}</span>
            <span style={{ opacity: 0.5 }}>/ 5</span>
          </div>
        )}

        <div style={{ flex: 1 }} />

        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            padding: '32px 64px',
            borderRadius: 40,
            background: 'rgba(255,255,255,0.1)',
            marginTop: 40,
          }}
        >
          <div style={{ fontSize: 32, opacity: 0.7 }}>Запись в пару тапов</div>
          <div style={{ fontSize: 44, fontWeight: 800, marginTop: 8 }}>cres.ca/m/{handle}</div>
        </div>
      </div>
    ),
    {
      width: 1080,
      height: 1920,
    },
  );
}
