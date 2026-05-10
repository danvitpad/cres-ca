/** --- YAML
 * name: MasterMiniAppPartnerCard
 * description: Партнёрская карточка мастера в Mini App. Структура: Hero (аватар + имя),
 *              секции Информация / Статистика / Заметки / Условия / Договорённости / Активность,
 *              кнопка Прекратить партнёрство, AI-чат внизу. Использует Mini App дизайн-токены
 *              (T/R/SHADOW/TYPE) — единый стиль с другими экранами.
 * created: 2026-04-25
 * updated: 2026-05-10
 * --- */

'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft, Loader2, Bot, Send, Pencil, Trash2, Plus,
  Check, X, XCircle, ExternalLink,
} from 'lucide-react';
import { useAuthStore } from '@/stores/auth-store';
import { useTelegram } from '@/components/miniapp/telegram-provider';
import { T, R, FONT_BASE, SHADOW, PAGE_PADDING_X, TYPE } from '@/components/miniapp/design';
import { AvatarCircle } from '@/components/miniapp/shells';

function getInitData(): string | null {
  if (typeof window === 'undefined') return null;
  const w = window as { Telegram?: { WebApp?: { initData?: string } } };
  const live = w.Telegram?.WebApp?.initData;
  if (live) return live;
  try {
    const stash = sessionStorage.getItem('cres:tg');
    if (stash) {
      const parsed = JSON.parse(stash) as { initData?: string };
      if (parsed.initData) return parsed.initData;
    }
  } catch { /* ignore */ }
  return null;
}

interface Profile {
  full_name: string | null;
  avatar_url: string | null;
  slug: string | null;
  username: string | null;
  phone: string | null;
  email: string | null;
  date_of_birth: string | null;
}
interface MasterEntry {
  id: string;
  specialization: string | null;
  vertical: string | null;
  bio: string | null;
  team_mode: string | null;
  salon_id: string | null;
  profile: Profile | null;
}
interface PartnerStats {
  clients_referred: number;
  appointments_completed: number;
  total_profit: number;
}
interface Partnership {
  id: string;
  master_id: string;
  partner_id: string;
  status: string;
  initiated_at: string;
  accepted_at: string | null;
  ended_at: string | null;
  note: string | null;
  contract_terms: string | null;
  commission_percent: number | null;
  promo_code: string | null;
  cross_promotion: boolean;
  partner: MasterEntry;
  youInitiated: boolean;
  stats?: PartnerStats;
}

function formatDob(iso: string | null): string {
  if (!iso) return '—';
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '—';
    return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' });
  } catch {
    return '—';
  }
}

interface NoteEntry { index: number; date: string | null; body: string }
function parseEntries(s: string | null): NoteEntry[] {
  if (!s) return [];
  return s.split('\n').map((line, index) => {
    const raw = line.trim();
    if (!raw) return null;
    const m = raw.match(/^\[([^\]]+)\]\s*(.*)$/);
    return { index, date: m ? m[1] : null, body: m ? m[2] : raw };
  }).filter((x): x is NoteEntry => x !== null);
}

const sectionLabelStyle: React.CSSProperties = {
  ...TYPE.micro,
  fontWeight: 700,
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
  color: T.textTertiary,
  margin: '4px 4px 8px',
};

function makeCardStyle(): React.CSSProperties {
  return {
    borderRadius: R.lg,
    border: `1px solid ${T.borderSubtle}`,
    background: T.surface,
    boxShadow: SHADOW.card,
    overflow: 'hidden',
  };
}

const dividerStyle: React.CSSProperties = {
  height: 1,
  background: T.borderSubtle,
  margin: '0 16px',
};

export default function MasterMiniAppPartnerCard() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { userId } = useAuthStore();
  const { haptic } = useTelegram();
  const [partnership, setPartnership] = useState<Partnership | null>(null);
  const [loading, setLoading] = useState(true);
  const [confirmEnd, setConfirmEnd] = useState(false);
  const [ending, setEnding] = useState(false);

  // eslint-disable-next-line react-hooks/preserve-manual-memoization
  const reload = useCallback(async () => {
    if (!params?.id) return;
    const initData = getInitData();
    if (!initData) { setLoading(false); return; }
    const res = await fetch('/api/telegram/m/partners/detail', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ initData, partnership_id: params.id }),
    });
    if (!res.ok) { setLoading(false); return; }
    const json = await res.json();
    setPartnership(json.partnership ?? null);
    setLoading(false);
  }, [params?.id]);

  useEffect(() => {
    if (!userId) return;
    reload(); // eslint-disable-line react-hooks/set-state-in-effect
  }, [userId, reload]);

  async function endPartnership() {
    const initData = getInitData();
    if (!initData) return;
    setEnding(true);
    haptic('light');
    const res = await fetch('/api/telegram/m/partners/end', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ initData, partnership_id: params.id }),
    });
    setEnding(false);
    if (!res.ok) { haptic('error'); setConfirmEnd(false); return; }
    haptic('success');
    router.back();
  }

  if (loading) {
    return (
      <div style={{ ...FONT_BASE, background: T.bg, minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Loader2 size={24} color={T.textTertiary} className="animate-spin" />
      </div>
    );
  }
  if (!partnership) {
    return (
      <div style={{ ...FONT_BASE, background: T.bg, padding: `60px ${PAGE_PADDING_X}px`, textAlign: 'center' }}>
        <p style={{ ...TYPE.body, color: T.textSecondary, margin: 0 }}>Партнёрство не найдено</p>
      </div>
    );
  }

  const partner = partnership.partner;
  const partnerName = partner.profile?.full_name || 'Партнёр';
  const isTeam = !!partner.salon_id;
  const cardStyle = makeCardStyle();

  return (
    <div style={{ ...FONT_BASE, background: T.bg, color: T.text }}>
      <div style={{
        padding: `16px ${PAGE_PADDING_X}px 96px`,
        display: 'flex', flexDirection: 'column', gap: 20,
      }}>
        {/* Back button */}
        <button
          type="button"
          onClick={() => { haptic('light'); router.back(); }}
          aria-label="Назад"
          style={{
            width: 40, height: 40, borderRadius: 20,
            border: `1px solid ${T.border}`, background: T.surface, color: T.text,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', boxShadow: SHADOW.card,
          }}
        >
          <ArrowLeft size={18} strokeWidth={2.4} />
        </button>

        {/* Hero — avatar + name + meta. Если партнёрство на паузе — отдельный бейдж. */}
        <div style={{ ...cardStyle, padding: 16, display: 'flex', alignItems: 'center', gap: 14 }}>
          <AvatarCircle url={partner.profile?.avatar_url} name={partnerName} size={56} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <h1 style={{ ...TYPE.h2, color: T.text, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {partnerName}
            </h1>
            <p style={{ ...TYPE.caption, color: T.textSecondary, margin: '2px 0 0' }}>
              {isTeam ? 'Команда' : 'Соло мастер'}{partner.specialization ? ` · ${partner.specialization}` : ''}
            </p>
            {partnership.status === 'paused' && (
              <span style={{
                display: 'inline-block', marginTop: 6,
                padding: '2px 8px', borderRadius: R.pill,
                background: T.warningSoft, color: T.warning,
                ...TYPE.micro, fontWeight: 700,
              }}>
                На паузе
              </span>
            )}
            {partnership.status === 'pending' && (
              <span style={{
                display: 'inline-block', marginTop: 6,
                padding: '2px 8px', borderRadius: R.pill,
                background: T.bgSubtle, color: T.textSecondary,
                ...TYPE.micro, fontWeight: 700,
              }}>
                Ожидает подтверждения
              </span>
            )}
          </div>
        </div>

        {/* Открыть публичный профиль */}
        {partner.profile?.slug && (
          <Link
            href={`/m/${partner.profile.slug}`}
            target="_blank"
            onClick={() => haptic('light')}
            style={{
              ...cardStyle,
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '14px 16px',
              textDecoration: 'none', color: T.text,
            }}
          >
            <span style={{ ...TYPE.bodyStrong, color: T.text }}>Публичный профиль</span>
            <ExternalLink size={16} color={T.textTertiary} />
          </Link>
        )}

        {/* ИНФОРМАЦИЯ */}
        <div>
          <p style={sectionLabelStyle}>Информация</p>
          <div style={cardStyle}>
            <InfoRow label="Телефон" value={partner.profile?.phone || '—'} />
            <div style={dividerStyle} />
            <InfoRow label="Email" value={partner.profile?.email || '—'} />
            <div style={dividerStyle} />
            <InfoRow label="Telegram" value={partner.profile?.username ? `@${partner.profile.username}` : '—'} />
            <div style={dividerStyle} />
            <InfoRow label="День рождения" value={formatDob(partner.profile?.date_of_birth ?? null)} />
          </div>
          {partner.bio && (
            <p style={{ ...TYPE.caption, color: T.textSecondary, margin: '10px 4px 0', lineHeight: 1.5 }}>
              {partner.bio}
            </p>
          )}
          <p style={{ ...TYPE.micro, color: T.textTertiary, margin: '6px 4px 0' }}>
            Эти поля заполняет сам партнёр.
          </p>
        </div>

        {/* ПРОФИТ ОТ ПАРТНЁРА */}
        {partnership.stats && (
          <div>
            <p style={sectionLabelStyle}>Профит от партнёра</p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
              <Tile label="Клиентов" value={partnership.stats.clients_referred} />
              <Tile label="Визитов" value={partnership.stats.appointments_completed} />
              <Tile label="Выручка, ₴" value={partnership.stats.total_profit} />
            </div>
            {!partnership.promo_code && (
              <p style={{ ...TYPE.caption, color: T.textSecondary, margin: '10px 4px 0', lineHeight: 1.5 }}>
                Чтобы считать клиентов от партнёра — задай промокод партнёрства в разделе «Условия» ниже.
              </p>
            )}
            {partnership.promo_code && partnership.stats.clients_referred === 0 && (
              <p style={{ ...TYPE.caption, color: T.textSecondary, margin: '10px 4px 0' }}>
                Пока никто не записался по промокоду «{partnership.promo_code}».
              </p>
            )}
          </div>
        )}

        {/* ЗАМЕТКИ */}
        <div>
          <p style={sectionLabelStyle}>Заметки о сотрудничестве</p>
          <NotesBlock partnership={partnership} field="note" haptic={haptic} onSaved={reload} cardStyle={cardStyle} />
        </div>

        {/* УСЛОВИЯ */}
        <div>
          <p style={sectionLabelStyle}>Условия</p>
          <div style={cardStyle}>
            <InfoRow label="Комиссия" value={partnership.commission_percent !== null ? `${partnership.commission_percent}%` : '—'} />
            <div style={dividerStyle} />
            <InfoRow
              label="Промокод нашим"
              value={partnership.promo_code || '—'}
              mono={!!partnership.promo_code}
            />
          </div>
          <p style={{ ...TYPE.micro, color: T.textTertiary, margin: '6px 4px 0' }}>
            Промокод нужен чтобы считать клиентов от партнёра.
          </p>
        </div>

        {/* Тумблер «Активно» / «На паузе» — для активных и приостановленных партнёрств */}
        {(partnership.status === 'active' || partnership.status === 'paused') && (
          <StatusToggleRow
            partnership={partnership}
            haptic={haptic}
            onSaved={reload}
            cardStyle={cardStyle}
          />
        )}

        {/* End partnership */}
        {partnership.status !== 'ended' && (
          confirmEnd ? (
            <div style={{
              borderRadius: R.lg, padding: 16, marginTop: 4,
              border: `1px solid ${T.dangerSoft}`, background: T.dangerSoft,
              display: 'flex', flexDirection: 'column', gap: 10, textAlign: 'center',
            }}>
              <p style={{ ...TYPE.bodyStrong, color: T.danger, margin: 0 }}>Прекратить партнёрство?</p>
              <p style={{ ...TYPE.caption, color: T.danger, margin: 0, opacity: 0.85 }}>
                Действие необратимо. Статус изменится на «Завершён».
              </p>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginTop: 4 }}>
                <button
                  onClick={() => setConfirmEnd(false)}
                  style={{
                    borderRadius: R.pill, border: `1px solid ${T.border}`,
                    background: T.surface, color: T.text,
                    padding: '10px 20px', ...TYPE.bodyStrong,
                    cursor: 'pointer', fontFamily: 'inherit',
                  }}
                >Отмена</button>
                <button
                  onClick={endPartnership}
                  disabled={ending}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    borderRadius: R.pill, border: 'none',
                    background: T.danger, color: '#fff',
                    padding: '10px 20px', ...TYPE.bodyStrong,
                    cursor: ending ? 'wait' : 'pointer', fontFamily: 'inherit',
                    opacity: ending ? 0.6 : 1,
                  }}
                >
                  {ending ? <Loader2 size={14} className="animate-spin" /> : <XCircle size={14} />}
                  Прекратить
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => { haptic('light'); setConfirmEnd(true); }}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                gap: 8, width: '100%', padding: '14px 16px', marginTop: 4,
                borderRadius: R.lg, border: `1px solid ${T.dangerSoft}`,
                background: T.dangerSoft, color: T.danger,
                ...TYPE.bodyStrong, cursor: 'pointer', fontFamily: 'inherit',
              }}
            >
              <XCircle size={16} strokeWidth={2.4} />
              Прекратить партнёрство
            </button>
          )
        )}
      </div>

      {/* AI chat — fixed снизу, focus-aware (поднимается над клавиатурой) */}
      <PartnerAiChat partnershipId={partnership.id} haptic={haptic} onApplied={reload} />
    </div>
  );
}

/* ─── Primitives ─── */

function InfoRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', gap: 12 }}>
      <span style={{ ...TYPE.body, color: T.textSecondary }}>{label}</span>
      <span style={{
        ...TYPE.bodyStrong, color: T.text,
        fontFamily: mono ? 'ui-monospace, SFMono-Regular, Menlo, monospace' : 'inherit',
        textAlign: 'right',
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        maxWidth: '60%',
      }}>
        {value}
      </span>
    </div>
  );
}

function Tile({ label, value }: { label: string; value: number | string }) {
  return (
    <div style={{
      borderRadius: R.md, padding: '14px 12px',
      background: T.surface, border: `1px solid ${T.borderSubtle}`,
      boxShadow: SHADOW.card,
    }}>
      <p style={{ ...TYPE.h3, color: T.text, margin: 0, fontVariantNumeric: 'tabular-nums' }}>{value}</p>
      <p style={{ ...TYPE.caption, margin: '2px 0 0' }}>{label}</p>
    </div>
  );
}

function StatusToggleRow({
  partnership, haptic, onSaved, cardStyle,
}: {
  partnership: Partnership;
  haptic: (k: 'light' | 'success' | 'error') => void;
  onSaved: () => void;
  cardStyle: React.CSSProperties;
}) {
  const [busy, setBusy] = useState(false);
  const isActive = partnership.status === 'active';

  async function toggle() {
    const initData = getInitData();
    if (!initData) return;
    setBusy(true);
    haptic('light');
    const res = await fetch('/api/telegram/m/partners/update', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        initData,
        partnership_id: partnership.id,
        field: 'status',
        value: isActive ? 'paused' : 'active',
      }),
    });
    setBusy(false);
    if (!res.ok) haptic('error');
    else { haptic('success'); onSaved(); }
  }

  return (
    <div style={cardStyle}>
      <button
        type="button"
        onClick={toggle}
        disabled={busy}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          width: '100%', padding: '14px 16px', gap: 12,
          background: 'transparent', border: 'none',
          cursor: busy ? 'wait' : 'pointer', fontFamily: 'inherit', textAlign: 'left',
        }}
      >
        <span style={{ flex: 1, minWidth: 0 }}>
          <span style={{ display: 'block', ...TYPE.bodyStrong, color: T.text }}>
            Активное партнёрство
          </span>
          <span style={{ display: 'block', ...TYPE.caption, marginTop: 2 }}>
            {isActive ? 'Партнёрство работает' : 'Партнёрство приостановлено'}
          </span>
        </span>
        <span
          aria-hidden
          style={{
            position: 'relative', width: 44, height: 26, borderRadius: 13,
            background: isActive ? T.accent : T.borderSubtle,
            transition: 'background 200ms', flexShrink: 0,
          }}
        >
          <span style={{
            position: 'absolute', top: 3, left: isActive ? 21 : 3,
            width: 20, height: 20, borderRadius: '50%', background: '#fff',
            boxShadow: '0 1px 3px rgba(0,0,0,0.2)', transition: 'left 0.2s',
          }} />
        </span>
      </button>
    </div>
  );
}

/* ─── Notes block — multi-entry с inline edit/add/delete ─── */

function NotesBlock({
  partnership, field, haptic, onSaved, cardStyle,
}: {
  partnership: Partnership;
  field: 'note' | 'contract_terms';
  haptic: (k: 'light' | 'success' | 'error' | 'selection') => void;
  onSaved: () => void;
  cardStyle: React.CSSProperties;
}) {
  const value = partnership[field];
  const entries = parseEntries(value ?? null);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [draft, setDraft] = useState('');
  const [adding, setAdding] = useState(false);
  const [newDraft, setNewDraft] = useState('');
  const [busy, setBusy] = useState(false);

  async function persist(nextLines: string[]): Promise<boolean> {
    setBusy(true);
    const initData = getInitData();
    if (!initData) { setBusy(false); return false; }
    const next = nextLines.map((l) => l.trim()).filter(Boolean).join('\n');
    const res = await fetch('/api/telegram/m/partners/update', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        initData, partnership_id: partnership.id, field,
        value: next.length ? next : null,
      }),
    });
    setBusy(false);
    if (!res.ok) { haptic('error'); return false; }
    haptic('success');
    onSaved();
    return true;
  }

  const placeholder = field === 'contract_terms'
    ? 'Например: «Комиссия 5%, отчёт раз в месяц»'
    : 'Что-то важное про партнёра...';

  // Empty state
  if (entries.length === 0 && !adding) {
    return (
      <div style={{ ...cardStyle, padding: 16, textAlign: 'center' }}>
        <p style={{ ...TYPE.caption, color: T.textSecondary, margin: '0 0 12px', lineHeight: 1.5 }}>
          Пусто. Добавь вручную или напиши в чат внизу — AI разнесёт.
        </p>
        <button
          type="button"
          onClick={() => { haptic('light'); setAdding(true); }}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            padding: '10px 18px', borderRadius: R.pill,
            border: `1px solid ${T.border}`, background: 'transparent', color: T.text,
            ...TYPE.bodyStrong, cursor: 'pointer', fontFamily: 'inherit',
          }}
        >
          <Plus size={14} strokeWidth={2.4} /> Добавить
        </button>
      </div>
    );
  }

  return (
    <div style={cardStyle}>
      {entries.map((entry, idx) => {
        const isEditing = editingIndex === entry.index;
        return (
          <div key={entry.index} style={{
            padding: '14px 16px',
            borderTop: idx === 0 ? 'none' : `1px solid ${T.borderSubtle}`,
          }}>
            {isEditing ? (
              <>
                <textarea
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  rows={2}
                  autoFocus
                  style={{
                    width: '100%', padding: 12, borderRadius: R.sm,
                    border: `1px solid ${T.border}`, background: T.bg, color: T.text,
                    ...TYPE.body, fontFamily: 'inherit', resize: 'none', outline: 'none',
                    boxSizing: 'border-box',
                  }}
                />
                <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 10 }}>
                  <button
                    onClick={() => { setEditingIndex(null); setDraft(''); }}
                    style={miniIconBtnStyle('neutral')}
                    aria-label="Отмена"
                  ><X size={14} /></button>
                  <button
                    onClick={async () => {
                      if (editingIndex === null) return;
                      const lines = (value ?? '').split('\n');
                      const orig = lines[editingIndex] ?? '';
                      const m = orig.match(/^\s*\[[^\]]+\]\s*/);
                      const prefix = m ? m[0] : '';
                      lines[editingIndex] = `${prefix}${draft.trim()}`;
                      const ok = await persist(lines);
                      if (ok) { setEditingIndex(null); setDraft(''); }
                    }}
                    disabled={busy || !draft.trim()}
                    style={{ ...miniIconBtnStyle('accent'), opacity: (busy || !draft.trim()) ? 0.5 : 1 }}
                    aria-label="Сохранить"
                  ><Check size={14} /></button>
                </div>
              </>
            ) : (
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  {entry.date && (
                    <p style={{ ...TYPE.micro, color: T.textTertiary, margin: 0 }}>{entry.date}</p>
                  )}
                  <p style={{ ...TYPE.body, color: T.text, margin: '2px 0 0', lineHeight: 1.5, wordBreak: 'break-word' }}>
                    {entry.body}
                  </p>
                </div>
                <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                  <button
                    onClick={() => { haptic('selection'); setEditingIndex(entry.index); setDraft(entry.body); }}
                    style={miniIconBtnStyle('neutral')}
                    aria-label="Редактировать"
                  ><Pencil size={14} /></button>
                  <button
                    onClick={async () => {
                      const lines = (value ?? '').split('\n');
                      lines.splice(entry.index, 1);
                      await persist(lines);
                    }}
                    style={miniIconBtnStyle('danger')}
                    aria-label="Удалить"
                  ><Trash2 size={14} /></button>
                </div>
              </div>
            )}
          </div>
        );
      })}

      {adding && (
        <div style={{ padding: '14px 16px', borderTop: entries.length > 0 ? `1px solid ${T.borderSubtle}` : 'none' }}>
          <textarea
            value={newDraft}
            onChange={(e) => setNewDraft(e.target.value)}
            placeholder={placeholder}
            rows={2}
            autoFocus
            style={{
              width: '100%', padding: 12, borderRadius: R.sm,
              border: `1px solid ${T.border}`, background: T.bg, color: T.text,
              ...TYPE.body, fontFamily: 'inherit', resize: 'none', outline: 'none',
              boxSizing: 'border-box',
            }}
          />
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 10 }}>
            <button
              onClick={() => { setAdding(false); setNewDraft(''); }}
              style={{
                padding: '8px 16px', borderRadius: R.pill,
                border: `1px solid ${T.border}`, background: T.surface, color: T.textSecondary,
                ...TYPE.caption, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
              }}
            >Отмена</button>
            <button
              onClick={async () => {
                const v = newDraft.trim();
                if (!v) return;
                const stamp = new Date().toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' });
                const lines = [...(value ?? '').split('\n'), `[${stamp}] ${v}`];
                const ok = await persist(lines);
                if (ok) { setAdding(false); setNewDraft(''); }
              }}
              disabled={busy || !newDraft.trim()}
              style={{
                padding: '8px 16px', borderRadius: R.pill,
                border: 'none', background: T.accent, color: '#fff',
                ...TYPE.caption, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
                opacity: (busy || !newDraft.trim()) ? 0.5 : 1,
              }}
            >Сохранить</button>
          </div>
        </div>
      )}

      {!adding && (
        <button
          type="button"
          onClick={() => { haptic('light'); setAdding(true); }}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            width: '100%', padding: '14px 16px',
            borderTop: entries.length > 0 ? `1px solid ${T.borderSubtle}` : 'none',
            background: 'transparent', border: 'none', color: T.accent,
            ...TYPE.bodyStrong, cursor: 'pointer', fontFamily: 'inherit',
          }}
        >
          <Plus size={14} strokeWidth={2.4} /> Добавить
        </button>
      )}
    </div>
  );
}

function miniIconBtnStyle(kind: 'neutral' | 'accent' | 'danger'): React.CSSProperties {
  const colors = {
    neutral: { bg: T.surface, fg: T.textSecondary, border: `1px solid ${T.border}` },
    accent: { bg: T.accent, fg: '#fff', border: 'none' },
    danger: { bg: T.dangerSoft, fg: T.danger, border: 'none' },
  } as const;
  const c = colors[kind];
  return {
    width: 32, height: 32, borderRadius: 8,
    background: c.bg, color: c.fg, border: c.border,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    cursor: 'pointer',
  };
}

/* ─── AI chat — fixed bottom, focus-aware ─── */

function PartnerAiChat({
  partnershipId, haptic, onApplied,
}: {
  partnershipId: string;
  haptic: (k: 'light' | 'success' | 'error') => void;
  onApplied: () => void;
}) {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [focused, setFocused] = useState(false);

  async function send() {
    const value = text.trim();
    if (!value || busy) return;
    const initData = getInitData();
    if (!initData) return;
    setBusy(true);
    haptic('light');
    try {
      const res = await fetch('/api/telegram/m/partners/parse-note', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ initData, partnership_id: partnershipId, text: value }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { haptic('error'); return; }
      const d = data as { applied: boolean };
      if (d.applied) { setText(''); haptic('success'); onApplied(); }
      else haptic('error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      style={{
        position: 'fixed',
        left: 12, right: 12,
        bottom: focused
          ? 'calc(env(safe-area-inset-bottom, 0px) + 8px)'
          : 'calc(81px + env(safe-area-inset-bottom, 0px) + 8px)',
        zIndex: 30,
        background: T.surface,
        borderRadius: R.pill,
        boxShadow: SHADOW.elevated,
        border: `1px solid ${T.borderSubtle}`,
        padding: 6,
        display: 'flex', alignItems: 'center', gap: 6,
        transition: 'bottom 200ms ease',
      }}
    >
      <div style={{
        width: 32, height: 32, borderRadius: '50%',
        background: T.accentSoft, color: T.accent,
        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        marginLeft: 2,
      }}>
        <Bot size={16} strokeWidth={2.2} />
      </div>
      <input
        value={text}
        onChange={(e) => setText(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void send(); }
        }}
        disabled={busy}
        placeholder="Что нового про партнёра?"
        style={{
          flex: 1, padding: '10px 4px', borderRadius: R.pill,
          border: 'none', background: 'transparent',
          fontSize: 16, color: T.text, outline: 'none', fontFamily: 'inherit',
        }}
      />
      <button
        type="button"
        onClick={send}
        disabled={busy || text.trim().length < 2}
        style={{
          width: 40, height: 40, flexShrink: 0,
          borderRadius: '50%', border: 'none',
          background: text.trim() ? T.accent : T.bgSubtle,
          color: text.trim() ? '#fff' : T.textTertiary,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: text.trim() && !busy ? 'pointer' : 'not-allowed',
          transition: 'background 200ms ease',
        }}
        aria-label="Отправить"
      >
        {busy ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
      </button>
    </div>
  );
}
