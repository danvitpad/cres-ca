/** --- YAML
 * name: BroadcastsPage
 * description: Рассылка подписчикам — мастер пишет одно сообщение, выбирает аудиторию
 *              (Подписчики / Избранное / Все клиенты), видит счётчик «Получит N
 *              человек» в реалтайме, отправляет одним кликом — fanout в Telegram +
 *              in-app bell. История рассылок снизу с метриками
 *              (delivered/failed/recipients).
 * created: 2026-04-26
 * --- */

'use client';

import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Send, Users, Heart, UserCheck, AlertTriangle } from 'lucide-react';
import { usePageTheme, FONT, FONT_FEATURES } from '@/lib/dashboard-theme';
import { SettingsBlock, SettingsField, SettingsButton, SettingsSegmented, settingsInputStyle } from '@/components/settings/settings-block';

type Audience = 'subscribers' | 'favorites' | 'all_clients';

interface AudienceCounts {
  subscribers: number;
  favorites: number;
  all_clients: number;
}

interface BroadcastRow {
  id: string;
  subject: string | null;
  body: string;
  audience: Audience;
  recipients_count: number;
  delivered_count: number;
  failed_count: number;
  status: 'draft' | 'queued' | 'sending' | 'done' | 'failed';
  scheduled_for: string | null;
  sent_at: string | null;
  created_at: string;
}

const AUDIENCE_OPTIONS: { value: Audience; label: string; desc: string; icon: typeof Users }[] = [
  { value: 'subscribers', label: 'Подписчики', desc: 'Те кто follow\'нул тебя', icon: UserCheck },
  { value: 'favorites', label: 'Избранное', desc: 'Добавили в favorites', icon: Heart },
  { value: 'all_clients', label: 'Все клиенты', desc: 'Все кто записывался', icon: Users },
];

export default function BroadcastsPage() {
  const { C } = usePageTheme();
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [audience, setAudience] = useState<Audience>('subscribers');
  const [counts, setCounts] = useState<AudienceCounts | null>(null);
  const [history, setHistory] = useState<BroadcastRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(true);

  useEffect(() => {
    void refresh();
  }, []);

  async function refresh() {
    try {
      const [aRes, hRes] = await Promise.all([
        fetch('/api/marketing/broadcast/audience'),
        fetch('/api/marketing/broadcast'),
      ]);
      if (aRes.ok) setCounts(await aRes.json());
      if (hRes.ok) {
        const data = await hRes.json();
        setHistory(data.items ?? []);
      }
    } finally {
      setHistoryLoading(false);
    }
  }

  const recipientsForCurrent = useMemo(() => {
    if (!counts) return null;
    return counts[audience] ?? 0;
  }, [counts, audience]);

  async function sendBroadcast() {
    if (!body.trim()) {
      toast.error('Введите текст сообщения');
      return;
    }
    if (body.length > 2000) {
      toast.error('Сообщение длиннее 2000 символов');
      return;
    }
    if (!recipientsForCurrent || recipientsForCurrent === 0) {
      toast.error('Нет получателей в выбранной аудитории');
      return;
    }

    if (!confirm(`Отправить рассылку? Получит ${recipientsForCurrent} ${pluralize(recipientsForCurrent, ['человек', 'человека', 'человек'])}.`)) {
      return;
    }

    setBusy(true);
    try {
      const res = await fetch('/api/marketing/broadcast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subject: subject.trim() || undefined,
          body: body.trim(),
          audience,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.message || data.error || 'Не удалось отправить');
        return;
      }
      toast.success(`Отправлено ${data.recipients} получателям`);
      setSubject('');
      setBody('');
      void refresh();
    } catch {
      toast.error('Сетевая ошибка');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ padding: '0 36px', display: 'flex', flexDirection: 'column', gap: 14, fontFamily: FONT, fontFeatureSettings: FONT_FEATURES }}>
      {/* Composer */}
      <SettingsBlock
        title="Рассылка подписчикам"
        subtitle="Одно сообщение для всех — летит в Telegram-боте и в колокольчик клиента в приложении."
        C={C}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Audience selector с counts */}
          <SettingsField label="Кому" C={C}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 8 }}>
              {AUDIENCE_OPTIONS.map((opt) => {
                const active = audience === opt.value;
                const count = counts?.[opt.value] ?? null;
                const Icon = opt.icon;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setAudience(opt.value)}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'flex-start',
                      gap: 6,
                      padding: 14,
                      borderRadius: 12,
                      border: `2px solid ${active ? C.accent : C.border}`,
                      background: active ? C.accentSoft : C.surfaceElevated,
                      cursor: 'pointer',
                      fontFamily: 'inherit',
                      textAlign: 'left',
                      transition: 'all 120ms ease',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                      <Icon size={18} color={active ? C.accent : C.textSecondary} strokeWidth={2} />
                      {count != null && (
                        <span
                          style={{
                            padding: '2px 8px',
                            borderRadius: 999,
                            background: active ? C.accent : C.surface,
                            color: active ? '#fff' : C.text,
                            fontSize: 12,
                            fontWeight: 700,
                            border: active ? 'none' : `1px solid ${C.border}`,
                          }}
                        >
                          {count}
                        </span>
                      )}
                    </div>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: C.text }}>{opt.label}</div>
                      <div style={{ fontSize: 12, color: C.textSecondary, marginTop: 2 }}>{opt.desc}</div>
                    </div>
                  </button>
                );
              })}
            </div>
          </SettingsField>

          {/* Subject */}
          <SettingsField label="Тема (опционально)" hint="Видна как жирная первая строка в Telegram" C={C}>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value.slice(0, 120))}
              placeholder="Например: Новый календарь на ноябрь"
              style={settingsInputStyle(C)}
            />
          </SettingsField>

          {/* Body */}
          <SettingsField label="Сообщение" hint={`${body.length}/2000 символов`} C={C}>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value.slice(0, 2000))}
              rows={6}
              placeholder="Текст рассылки. Без приветствий типа «Привет» — клиент уже знает кто ты. Сразу к делу: что нового, акция, изменение и т.д."
              style={{
                ...settingsInputStyle(C),
                resize: 'vertical',
                minHeight: 120,
                fontFamily: 'inherit',
                lineHeight: 1.5,
              }}
            />
          </SettingsField>

          {/* Hint about recipient count */}
          {recipientsForCurrent === 0 && counts !== null && (
            <div
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: 10,
                padding: 12,
                borderRadius: 10,
                background: C.warningSoft,
                color: C.warning,
              }}
            >
              <AlertTriangle size={16} style={{ flexShrink: 0, marginTop: 2 }} />
              <div style={{ fontSize: 13, lineHeight: 1.4 }}>
                В выбранной аудитории пока нет получателей. Поделись ссылкой на свой профиль — клиенты добавят тебя в подписки или избранное.
              </div>
            </div>
          )}

          {/* Send button */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
            <div style={{ fontSize: 13, color: C.textSecondary }}>
              {recipientsForCurrent != null && (
                <>
                  Получит:{' '}
                  <strong style={{ color: C.text, fontVariantNumeric: 'tabular-nums' }}>
                    {recipientsForCurrent}
                  </strong>{' '}
                  {pluralize(recipientsForCurrent, ['человек', 'человека', 'человек'])}
                </>
              )}
            </div>
            <SettingsButton
              onClick={sendBroadcast}
              disabled={busy || !body.trim() || !recipientsForCurrent}
              C={C}
            >
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                <Send size={16} />
                {busy ? 'Отправка...' : 'Отправить'}
              </span>
            </SettingsButton>
          </div>
        </div>
      </SettingsBlock>

      {/* History */}
      <SettingsBlock title="История рассылок" subtitle="Последние 50 отправленных" C={C}>
        {historyLoading ? (
          <p style={{ fontSize: 13, color: C.textTertiary, padding: 12 }}>Загрузка...</p>
        ) : history.length === 0 ? (
          <p style={{ fontSize: 13, color: C.textTertiary, padding: 12 }}>Ещё ни одной рассылки. Напиши первое сообщение выше.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {history.map((b, idx) => (
              <BroadcastRow key={b.id} b={b} C={C} isLast={idx === history.length - 1} />
            ))}
          </div>
        )}
      </SettingsBlock>
    </div>
  );
}

function BroadcastRow({ b, C, isLast }: { b: BroadcastRow; C: ReturnType<typeof usePageTheme>['C']; isLast: boolean }) {
  const date = new Date(b.created_at).toLocaleString('ru-RU', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
  const audienceLabel =
    AUDIENCE_OPTIONS.find((a) => a.value === b.audience)?.label ?? b.audience;
  const statusLabel: Record<typeof b.status, { label: string; bg: string; color: string }> = {
    draft: { label: 'Черновик', bg: '#f3f4f6', color: C.textSecondary },
    queued: { label: 'В очереди', bg: '#dbeafe', color: '#1d4ed8' },
    sending: { label: 'Отправка', bg: '#fef3c7', color: '#b45309' },
    done: { label: 'Доставлено', bg: C.successSoft, color: C.success },
    failed: { label: 'Ошибка', bg: C.dangerSoft, color: C.danger },
  };
  const st = statusLabel[b.status] ?? statusLabel.draft;
  return (
    <div
      style={{
        padding: '14px 0',
        borderBottom: isLast ? 'none' : `1px solid ${C.border}`,
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        {b.subject && (
          <span style={{ fontSize: 14, fontWeight: 700, color: C.text }}>{b.subject}</span>
        )}
        <span
          style={{
            padding: '2px 8px',
            borderRadius: 999,
            background: st.bg,
            color: st.color,
            fontSize: 11,
            fontWeight: 700,
          }}
        >
          {st.label}
        </span>
        <span style={{ fontSize: 12, color: C.textTertiary, marginLeft: 'auto' }}>{date}</span>
      </div>
      <div
        style={{
          fontSize: 13,
          color: C.textSecondary,
          lineHeight: 1.45,
          whiteSpace: 'pre-wrap',
          maxHeight: 60,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          display: '-webkit-box',
          WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical' as const,
        }}
      >
        {b.body}
      </div>
      <div style={{ display: 'flex', gap: 14, fontSize: 12, color: C.textTertiary }}>
        <span>
          Аудитория: <strong style={{ color: C.text }}>{audienceLabel}</strong>
        </span>
        <span>
          Доставлено:{' '}
          <strong style={{ color: C.success }}>{b.delivered_count}</strong>
          /{b.recipients_count}
        </span>
        {b.failed_count > 0 && (
          <span>
            Ошибок: <strong style={{ color: C.danger }}>{b.failed_count}</strong>
          </span>
        )}
      </div>
    </div>
  );
}

function pluralize(n: number, forms: [string, string, string]): string {
  const m10 = n % 10;
  const m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return forms[0];
  if (m10 >= 2 && m10 <= 4 && (m100 < 10 || m100 >= 20)) return forms[1];
  return forms[2];
}

// Force-include unused exports for parity with broadcast page
void SettingsSegmented;
