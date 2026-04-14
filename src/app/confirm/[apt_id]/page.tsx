/** --- YAML
 * name: Public Confirm Page
 * description: Клиент открывает ссылку из напоминания и подтверждает визит. Обновляет status='confirmed'.
 * created: 2026-04-13
 * updated: 2026-04-13
 * --- */

import { createClient as createAdminClient } from '@supabase/supabase-js';
import { CheckCircle, XCircle } from 'lucide-react';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export default async function ConfirmAppointmentPage({
  params,
}: {
  params: Promise<{ apt_id: string }>;
}) {
  const { apt_id } = await params;
  const supabase = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );

  const { data: apt } = await supabase
    .from('appointments')
    .select('id, starts_at, status, service:services(name), master:masters(handle)')
    .eq('id', apt_id)
    .maybeSingle();

  let ok = false;
  let message = '';

  if (!apt) {
    message = 'Запись не найдена.';
  } else if (apt.status === 'cancelled_by_client' || apt.status === 'cancelled_by_master' || apt.status === 'no_show') {
    message = 'Эта запись уже отменена.';
  } else if (apt.status === 'completed') {
    message = 'Эта запись уже завершена.';
    ok = true;
  } else {
    const { error } = await supabase
      .from('appointments')
      .update({ status: 'confirmed' })
      .eq('id', apt_id);
    if (error) {
      message = 'Не удалось подтвердить. Попробуйте позже.';
    } else {
      ok = true;
      message = 'Спасибо! Ваш визит подтверждён.';
    }
  }

  type A = { starts_at: string; service: { name: string | null } | { name: string | null }[] | null };
  const a = apt as unknown as A | null;
  const svc = a ? (Array.isArray(a.service) ? a.service[0] : a.service) : null;
  const date = a ? new Date(a.starts_at) : null;

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
        fontFamily: 'ui-sans-serif, system-ui, -apple-system, sans-serif',
        background: '#fafafa',
      }}
    >
      <div
        style={{
          maxWidth: 440,
          width: '100%',
          background: '#fff',
          borderRadius: 16,
          padding: 32,
          textAlign: 'center',
          boxShadow: '0 10px 40px rgba(0,0,0,0.08)',
        }}
      >
        {ok ? (
          <CheckCircle style={{ width: 56, height: 56, color: '#22c55e', margin: '0 auto 16px' }} />
        ) : (
          <XCircle style={{ width: 56, height: 56, color: '#ef4444', margin: '0 auto 16px' }} />
        )}
        <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 8 }}>{message}</h1>
        {date && svc && (
          <p style={{ color: '#666', fontSize: 14 }}>
            {svc.name ?? '—'} · {date.toLocaleString('ru-RU')}
          </p>
        )}
      </div>
    </div>
  );
}
