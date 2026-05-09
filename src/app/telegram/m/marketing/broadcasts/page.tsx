/** --- YAML
 * name: MasterMiniAppMarketing/Broadcasts
 * description: Список рассылок мастера. Native Mini App (без перехода в браузер).
 *   Минимальный list: subject + audience + дата + статус. Создание/редактирование
 *   пока в веб-кабинете (отдельный sprint).
 * created: 2026-05-09
 * --- */

'use client';

import { useEffect, useState } from 'react';
import { Send, Loader2 } from 'lucide-react';
import { useAuthStore } from '@/stores/auth-store';
import { createClient } from '@/lib/supabase/client';
import { MobilePage, PageHeader } from '@/components/miniapp/shells';
import { T, R, PAGE_PADDING_X } from '@/components/miniapp/design';
import { useMiniAppLocale, type MiniAppLang } from '@/lib/miniapp/use-locale';

interface Broadcast {
  id: string;
  subject: string | null;
  body: string | null;
  audience: string | null;
  status: string | null;
  scheduled_for: string | null;
  sent_count: number | null;
  created_at: string;
}

const I18N: Record<MiniAppLang, { title: string; subtitle: string; empty: string; status: Record<string, string> }> = {
  uk: { title: 'Розсилки', subtitle: 'Останні повідомлення клієнтам', empty: 'Поки що жодної розсилки.', status: { sent: 'Надіслано', scheduled: 'Заплановано', draft: 'Чернетка', failed: 'Помилка' } },
  ru: { title: 'Рассылки', subtitle: 'Последние сообщения клиентам', empty: 'Пока ни одной рассылки.', status: { sent: 'Отправлено', scheduled: 'Запланировано', draft: 'Черновик', failed: 'Ошибка' } },
  en: { title: 'Broadcasts', subtitle: 'Recent messages to clients', empty: 'No broadcasts yet.', status: { sent: 'Sent', scheduled: 'Scheduled', draft: 'Draft', failed: 'Failed' } },
};

export default function BroadcastsPage() {
  const userId = useAuthStore((s) => s.userId);
  const lang = useMiniAppLocale();
  const t = I18N[lang];
  const [items, setItems] = useState<Broadcast[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    (async () => {
      const supabase = createClient();
      const { data: master } = await supabase.from('masters').select('id').eq('profile_id', userId).maybeSingle();
      if (cancelled || !master) { setLoading(false); return; }
      const { data } = await supabase
        .from('master_broadcasts')
        .select('id, subject, body, audience, status, scheduled_for, sent_count, created_at')
        .eq('master_id', master.id)
        .order('created_at', { ascending: false })
        .limit(50);
      if (cancelled) return;
      setItems((data as Broadcast[] | null) ?? []);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [userId]);

  return (
    <MobilePage>
      <PageHeader title={t.title} subtitle={t.subtitle} />
      <div style={{ padding: `8px ${PAGE_PADDING_X}px 0`, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {loading ? (
          <Loader2 className="mx-auto my-8 size-5 animate-spin" color={T.textTertiary} />
        ) : items.length === 0 ? (
          <div style={{ padding: 24, borderRadius: R.md, border: `1px dashed ${T.border}`, textAlign: 'center' }}>
            <Send size={20} color={T.textTertiary} style={{ margin: '0 auto 8px' }} />
            <p style={{ fontSize: 13, color: T.textTertiary, margin: 0 }}>{t.empty}</p>
          </div>
        ) : (
          items.map((b) => (
            <div key={b.id} style={{ padding: 14, borderRadius: R.md, border: `1px solid ${T.borderSubtle}`, background: T.surface }}>
              <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 }}>
                <p style={{ fontSize: 14, fontWeight: 700, color: T.text, margin: 0, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {b.subject || (b.body ? b.body.slice(0, 40) : '—')}
                </p>
                <span style={{ fontSize: 10, color: T.accent, padding: '2px 8px', borderRadius: 999, background: T.accentSoft, flexShrink: 0 }}>
                  {b.status ? (t.status[b.status] ?? b.status) : '—'}
                </span>
              </div>
              <p style={{ fontSize: 11, color: T.textTertiary, margin: '4px 0 0' }}>
                {b.audience ?? '—'}{b.sent_count != null && b.sent_count > 0 ? ` · отправлено ${b.sent_count}` : ''}
                {' · '}{new Date(b.created_at).toLocaleDateString(lang === 'uk' ? 'uk-UA' : lang === 'en' ? 'en-GB' : 'ru-RU')}
              </p>
            </div>
          ))
        )}
      </div>
    </MobilePage>
  );
}
