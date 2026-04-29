/** --- YAML
 * name: Partner Detail Page
 * description: Compact one-screen partnership card. Hero + 2x2 grid (Partner info / Notes /
 *              Cooperation terms / Activity) + AI chat at the bottom on full width. Master cannot
 *              edit partner's personal data (it's their account), but can add/edit/delete his own
 *              notes and contract-term entries. AI chat parses free-form text and routes to the
 *              right field.
 * created: 2026-04-25
 * --- */

'use client';

import { useState, useEffect, useCallback, use } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  ArrowLeft, FileText, Handshake, Sparkles, Send,
  User as UserIcon, Pencil, Trash2, Plus, Check, X,
  TicketPercent, Percent, Megaphone, BarChart3, Users,
} from 'lucide-react';
import { motion } from 'framer-motion';
import {
  FONT, FONT_FEATURES,
  usePageTheme, pageContainer,
  type PageTheme,
} from '@/lib/dashboard-theme';
import { humanizeError } from '@/lib/format/error';

/* ────────────────────── Types ────────────────────── */

interface PartnerProfile {
  full_name: string | null;
  avatar_url: string | null;
  slug: string | null;
  username: string | null;
}

interface PartnerMaster {
  id: string;
  specialization: string | null;
  vertical: string | null;
  bio: string | null;
  team_mode: string | null;
  salon_id: string | null;
  profile: PartnerProfile | null;
}

interface PartnershipDetail {
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
  partner: PartnerMaster;
  youInitiated: boolean;
}

/* ────────────────────── Page ────────────────────── */

export default function PartnerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { C } = usePageTheme();
  const [partnership, setPartnership] = useState<PartnershipDetail | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const res = await fetch(`/api/partners/${id}`, { cache: 'no-store' });
    if (!res.ok) {
      setPartnership(null);
      setLoading(false);
      return;
    }
    const data = await res.json();
    setPartnership(data.partnership ?? null);
    setLoading(false);
  }, [id]);

  useEffect(() => {
    load(); // eslint-disable-line react-hooks/set-state-in-effect
  }, [load]);

  if (loading) {
    return (
      <div style={{ ...pageContainer, background: C.bg, display: 'flex', flexDirection: 'column', gap: 16 }}>
        <Skeleton className="h-8 w-64" /><Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!partnership) {
    return (
      <div style={{ ...pageContainer, background: C.bg, color: C.text, display: 'flex', flexDirection: 'column', gap: 16 }}>
        <Button variant="ghost" onClick={() => router.back()}>
          <ArrowLeft style={{ width: 16, height: 16, marginRight: 8 }} />Назад
        </Button>
        <p style={{ color: C.textSecondary }}>Партнёрство не найдено.</p>
      </div>
    );
  }

  const partner = partnership.partner;
  const partnerName = partner.profile?.full_name || 'Партнёр';
  const initials = partnerName.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase() || '?';
  const avatarGrad = (() => {
    let hash = 0;
    for (let i = 0; i < partnerName.length; i++) hash = partnerName.charCodeAt(i) + ((hash << 5) - hash);
    const grads = [
      'linear-gradient(135deg, var(--color-accent) 0%, var(--color-accent-text) 100%)',
      'linear-gradient(135deg, #06b6d4 0%, #67e8f9 100%)',
      'linear-gradient(135deg, #10b981 0%, #34d399 100%)',
      'linear-gradient(135deg, #f59e0b 0%, #fbbf24 100%)',
      'linear-gradient(135deg, #6366f1 0%, #818cf8 100%)',
    ];
    return grads[Math.abs(hash) % grads.length];
  })();
  const isTeam = !!partner.salon_id;

  return (
    <div style={{ ...pageContainer, background: C.bg, color: C.text, minHeight: '100%', paddingBottom: 32 }}>
      <button
        onClick={() => router.back()}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          padding: '6px 12px', borderRadius: 8, border: 'none',
          background: 'transparent', color: C.textSecondary,
          cursor: 'pointer', fontSize: 13, fontWeight: 550,
          fontFamily: FONT, fontFeatureSettings: FONT_FEATURES,
          marginBottom: 12,
        }}
      >
        <ArrowLeft size={14} />
        Назад
      </button>

      {/* Hero */}
      <motion.div
        initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}
        style={{
          background: C.surface,
          border: `1px solid ${C.border}`,
          borderRadius: 16,
          padding: 16,
          marginBottom: 12,
          display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap',
        }}
      >
        <div style={{
          width: 48, height: 48, borderRadius: '50%',
          background: avatarGrad, color: '#fff',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 18, fontWeight: 600, flexShrink: 0,
        }}>
          {initials}
        </div>

        <div style={{ flex: 1, minWidth: 200 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <h1 style={{ fontSize: 17, fontWeight: 650, color: C.text, margin: 0, letterSpacing: '-0.3px' }}>
              {partnerName}
            </h1>
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: 4,
              padding: '2px 8px', borderRadius: 5,
              background: C.accentSoft, color: C.accent,
              fontSize: 11, fontWeight: 600,
            }}>
              {isTeam ? <Users size={11} /> : <UserIcon size={11} />}
              {isTeam ? 'Команда' : 'Соло-мастер'}
            </span>
            {partnership.status === 'pending' && (
              <span style={{
                padding: '2px 7px', borderRadius: 5,
                background: C.warningSoft, color: C.warning,
                fontSize: 11, fontWeight: 600,
              }}>
                Ожидает подтверждения
              </span>
            )}
            {partnership.cross_promotion && partnership.status === 'active' && (
              <span style={{
                display: 'inline-flex', alignItems: 'center', gap: 4,
                padding: '2px 7px', borderRadius: 5,
                background: 'rgba(16,185,129,0.10)', color: '#10b981',
                fontSize: 11, fontWeight: 600,
              }}>
                <Megaphone size={11} />
                Реклама вкл.
              </span>
            )}
          </div>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', fontSize: 12, color: C.textSecondary, marginTop: 3 }}>
            {partner.specialization && <span>{partner.specialization}</span>}
            {partner.vertical && <span>· {partner.vertical}</span>}
          </div>
        </div>

        {partner.profile?.slug && (
          <Link
            href={`/m/${partner.profile.slug}`}
            target="_blank"
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              padding: '8px 14px', borderRadius: 10,
              background: C.accent, color: '#fff', textDecoration: 'none',
              fontSize: 13, fontWeight: 600, flexShrink: 0,
            }}
          >
            Открыть страницу
          </Link>
        )}
      </motion.div>

      {/* 2×2 grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: 12,
          marginBottom: 12,
        }}
      >
        <PartnerInfoBlock partnership={partnership} C={C} />
        <NotesBlock
          field="note"
          title="Заметки о сотрудничестве"
          icon={<FileText size={15} />}
          partnership={partnership}
          onSaved={load}
          C={C}
        />
        <TermsBlock partnership={partnership} onSaved={load} C={C} />
        <ActivityBlock partnership={partnership} C={C} />
      </div>

      {/* AI chat — bottom, full width */}
      <PartnerAiChat partnershipId={id} onApplied={load} C={C} />
    </div>
  );
}

/* ────────────────────── Block frame ────────────────────── */

function BlockFrame({
  icon, title, accent, badge, children, C,
}: {
  icon: React.ReactNode;
  title: string;
  accent?: string;
  badge?: React.ReactNode;
  children: React.ReactNode;
  C: PageTheme;
}) {
  return (
    <section
      style={{
        background: C.surface,
        border: `1px solid ${C.border}`,
        borderRadius: 14,
        padding: 16,
        display: 'flex',
        flexDirection: 'column',
        minHeight: 0,
      }}
    >
      <header style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <span style={{ color: accent ?? C.accent, display: 'inline-flex' }}>{icon}</span>
        <h3 style={{ fontSize: 13, fontWeight: 650, color: C.text, margin: 0, letterSpacing: '-0.1px' }}>
          {title}
        </h3>
        {badge && <div style={{ marginLeft: 'auto' }}>{badge}</div>}
      </header>
      <div style={{ flex: 1, minHeight: 0 }}>{children}</div>
    </section>
  );
}

/* ────────────────────── Partner info (read-only) ────────────────────── */

function PartnerInfoBlock({ partnership, C }: { partnership: PartnershipDetail; C: PageTheme }) {
  const partner = partnership.partner;
  const profile = partner.profile;
  const isTeam = !!partner.salon_id;

  const fieldLabel: React.CSSProperties = {
    fontSize: 11, fontWeight: 600, color: C.textTertiary,
    letterSpacing: '0.04em', textTransform: 'uppercase', margin: 0,
  };
  const fieldValue: React.CSSProperties = {
    fontSize: 13, color: C.text, margin: '3px 0 0', wordBreak: 'break-word',
  };

  const initiated = new Date(partnership.initiated_at).toLocaleDateString('ru-RU', {
    day: 'numeric', month: 'long', year: 'numeric',
  });

  return (
    <BlockFrame
      icon={<UserIcon size={15} />}
      title={isTeam ? 'О команде' : 'О партнёре'}
      C={C}
      badge={
        <span style={{
          fontSize: 10, fontWeight: 500, padding: '2px 8px',
          borderRadius: 999, background: C.accentSoft, color: C.accent,
        }}>
          Партнёр управляет сам
        </span>
      }
    >
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div>
          <p style={fieldLabel}>{isTeam ? 'Название' : 'Имя'}</p>
          <p style={fieldValue}>{profile?.full_name || '—'}</p>
        </div>
        <div>
          <p style={fieldLabel}>Специализация</p>
          <p style={fieldValue}>{partner.specialization || '—'}</p>
        </div>
        <div>
          <p style={fieldLabel}>Тип</p>
          <p style={fieldValue}>{isTeam ? 'Команда / салон' : 'Соло-мастер'}</p>
        </div>
        <div>
          <p style={fieldLabel}>Telegram</p>
          <p style={fieldValue}>
            {profile?.username ? `@${profile.username}` : '—'}
          </p>
        </div>
      </div>

      <div style={{ marginTop: 14, paddingTop: 12, borderTop: `1px solid ${C.border}` }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
          <span style={{ ...fieldLabel }}>Партнёр с</span>
          <span style={{ fontSize: 12, color: C.textSecondary }}>{initiated}</span>
        </div>
        {partnership.status === 'active' && partnership.accepted_at && (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ ...fieldLabel }}>Подтверждено</span>
            <span style={{ fontSize: 12, color: C.textSecondary }}>
              {new Date(partnership.accepted_at).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' })}
            </span>
          </div>
        )}
      </div>

      {partner.bio && (
        <p style={{
          marginTop: 12, paddingTop: 10, borderTop: `1px solid ${C.border}`,
          fontSize: 12, color: C.textSecondary, lineHeight: 1.5, margin: '12px 0 0',
        }}>
          {partner.bio}
        </p>
      )}
    </BlockFrame>
  );
}

/* ────────────────────── Generic Notes block (works for `note` and `contract_terms`) ────────────────────── */

interface NoteEntry {
  index: number;
  date: string | null;
  body: string;
  raw: string;
}

function parseEntries(text: string | null): NoteEntry[] {
  if (!text) return [];
  return text
    .split('\n')
    .map((line, index) => {
      const raw = line.trim();
      if (!raw) return null;
      const m = raw.match(/^\[([^\]]+)\]\s*(.*)$/);
      return {
        index,
        date: m ? m[1] : null,
        body: m ? m[2] : raw,
        raw,
      };
    })
    .filter((x): x is NoteEntry => x !== null);
}

function NotesBlock({
  field, title, icon, partnership, onSaved, C, placeholder, emptyHint,
}: {
  field: 'note' | 'contract_terms';
  title: string;
  icon: React.ReactNode;
  partnership: PartnershipDetail;
  onSaved: () => void;
  C: PageTheme;
  placeholder?: string;
  emptyHint?: string;
}) {
  const value = partnership[field];
  const entries = parseEntries(value ?? null);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [draft, setDraft] = useState('');
  const [adding, setAdding] = useState(false);
  const [newDraft, setNewDraft] = useState('');
  const [busy, setBusy] = useState(false);

  async function persist(nextLines: string[]) {
    setBusy(true);
    const next = nextLines.map((l) => l.trim()).filter(Boolean).join('\n');
    const supabase = createClient();
    const { error } = await supabase
      .from('master_partnerships')
      .update({ [field]: next.length ? next : null })
      .eq('id', partnership.id);
    setBusy(false);
    if (error) {
      toast.error(humanizeError(error));
      return false;
    }
    onSaved();
    return true;
  }

  async function saveEdit() {
    if (editingIndex === null) return;
    const lines = (value ?? '').split('\n');
    const orig = lines[editingIndex] ?? '';
    const m = orig.match(/^\s*\[[^\]]+\]\s*/);
    const prefix = m ? m[0] : '';
    lines[editingIndex] = `${prefix}${draft.trim()}`;
    const ok = await persist(lines);
    if (ok) { toast.success('Сохранено'); setEditingIndex(null); setDraft(''); }
  }

  async function deleteEntry(entry: NoteEntry) {
    const lines = (value ?? '').split('\n');
    lines.splice(entry.index, 1);
    const ok = await persist(lines);
    if (ok) toast.success('Удалено');
  }

  async function addNew() {
    const v = newDraft.trim();
    if (!v) return;
    const stamp = new Date().toLocaleDateString('ru-RU', {
      day: '2-digit', month: '2-digit', year: 'numeric',
    });
    const lines = [...(value ?? '').split('\n'), `[${stamp}] ${v}`];
    const ok = await persist(lines);
    if (ok) { toast.success('Добавлено'); setAdding(false); setNewDraft(''); }
  }

  return (
    <BlockFrame
      icon={icon}
      title={title}
      C={C}
      badge={
        !adding && editingIndex === null ? (
          <button
            onClick={() => setAdding(true)}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 4,
              padding: '4px 10px', borderRadius: 8, border: 'none',
              background: C.accentSoft, color: C.accent,
              fontSize: 11, fontWeight: 600, cursor: 'pointer',
            }}
          >
            <Plus size={12} />
            Добавить
          </button>
        ) : null
      }
    >
      {adding && (
        <div style={{
          marginBottom: 10, padding: 10, borderRadius: 10,
          background: C.surfaceElevated, border: `1px solid ${C.border}`,
        }}>
          <textarea
            value={newDraft}
            onChange={(e) => setNewDraft(e.target.value)}
            placeholder={placeholder ?? 'Запиши что хочешь'}
            rows={2}
            autoFocus
            style={{
              width: '100%', padding: '8px 10px', borderRadius: 8,
              border: `1px solid ${C.border}`, background: C.surface,
              color: C.text, fontSize: 13, fontFamily: 'inherit', resize: 'vertical',
              outline: 'none', boxSizing: 'border-box',
            }}
          />
          <div style={{ display: 'flex', gap: 6, marginTop: 8, justifyContent: 'flex-end' }}>
            <button
              onClick={() => { setAdding(false); setNewDraft(''); }}
              style={{
                padding: '6px 10px', borderRadius: 8, border: `1px solid ${C.border}`,
                background: 'transparent', color: C.textSecondary, fontSize: 12, cursor: 'pointer',
              }}
            >Отмена</button>
            <button
              onClick={addNew}
              disabled={busy || !newDraft.trim()}
              style={{
                padding: '6px 12px', borderRadius: 8, border: 'none',
                background: C.accent, color: '#fff', fontSize: 12, fontWeight: 600,
                cursor: busy || !newDraft.trim() ? 'not-allowed' : 'pointer',
                opacity: busy || !newDraft.trim() ? 0.5 : 1,
              }}
            >Сохранить</button>
          </div>
        </div>
      )}

      {entries.length === 0 && !adding ? (
        <p style={{ fontSize: 12, color: C.textTertiary, margin: 0, lineHeight: 1.5 }}>
          {emptyHint ?? 'Пусто. Добавь вручную или просто напиши в чат снизу — AI разнесёт.'}
        </p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 280, overflowY: 'auto', paddingRight: 4 }}>
          {entries.map((entry) => {
            const isEditing = editingIndex === entry.index;
            return (
              <div
                key={entry.index}
                style={{
                  padding: '8px 10px', borderRadius: 8,
                  background: C.surfaceElevated, border: `1px solid ${C.border}`,
                  display: 'flex', flexDirection: 'column', gap: 4,
                }}
              >
                {isEditing ? (
                  <>
                    <textarea
                      value={draft}
                      onChange={(e) => setDraft(e.target.value)}
                      rows={2}
                      autoFocus
                      style={{
                        width: '100%', padding: 8, borderRadius: 6,
                        border: `1px solid ${C.border}`, background: C.surface,
                        color: C.text, fontSize: 13, fontFamily: 'inherit', resize: 'vertical',
                        outline: 'none', boxSizing: 'border-box',
                      }}
                    />
                    <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
                      <button
                        onClick={() => { setEditingIndex(null); setDraft(''); }}
                        title="Отмена"
                        style={{
                          padding: '4px 8px', borderRadius: 6, border: 'none',
                          background: 'transparent', color: C.textSecondary, cursor: 'pointer',
                          display: 'inline-flex', alignItems: 'center',
                        }}
                      ><X size={13} /></button>
                      <button
                        onClick={saveEdit}
                        disabled={busy || !draft.trim()}
                        title="Сохранить"
                        style={{
                          padding: '4px 8px', borderRadius: 6, border: 'none',
                          background: C.accent, color: '#fff', cursor: 'pointer',
                          display: 'inline-flex', alignItems: 'center',
                          opacity: busy || !draft.trim() ? 0.5 : 1,
                        }}
                      ><Check size={13} /></button>
                    </div>
                  </>
                ) : (
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      {entry.date && (
                        <div style={{ fontSize: 10, color: C.textTertiary, marginBottom: 2, letterSpacing: '0.04em' }}>
                          {entry.date}
                        </div>
                      )}
                      <div style={{ fontSize: 13, color: C.text, lineHeight: 1.45, wordBreak: 'break-word' }}>
                        {entry.body}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 2, flexShrink: 0, opacity: 0.7 }}>
                      <button
                        onClick={() => { setEditingIndex(entry.index); setDraft(entry.body); }}
                        title="Редактировать"
                        style={{
                          padding: 4, borderRadius: 6, border: 'none',
                          background: 'transparent', color: C.textSecondary, cursor: 'pointer',
                          display: 'inline-flex',
                        }}
                      ><Pencil size={12} /></button>
                      <button
                        onClick={() => deleteEntry(entry)}
                        title="Удалить"
                        style={{
                          padding: 4, borderRadius: 6, border: 'none',
                          background: 'transparent', color: C.danger, cursor: 'pointer',
                          display: 'inline-flex',
                        }}
                      ><Trash2 size={12} /></button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </BlockFrame>
  );
}

/* ────────────────────── Terms block — combines contract terms list + commission/promo + cross-promo toggle ────────────────────── */

function TermsBlock({
  partnership, onSaved, C,
}: {
  partnership: PartnershipDetail;
  onSaved: () => void;
  C: PageTheme;
}) {
  return (
    <BlockFrame icon={<Handshake size={15} />} title="Условия сотрудничества" C={C}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <FieldRow
          icon={<Percent size={13} />}
          label="Комиссия"
          value={partnership.commission_percent !== null ? `${partnership.commission_percent}%` : '—'}
          C={C}
        />
        <FieldRow
          icon={<TicketPercent size={13} />}
          label="Промокод нашим клиентам"
          value={partnership.promo_code || '—'}
          mono={!!partnership.promo_code}
          C={C}
        />
        <CrossPromotionToggle partnership={partnership} onSaved={onSaved} C={C} />
      </div>

      <div style={{ marginTop: 14, paddingTop: 12, borderTop: `1px solid ${C.border}` }}>
        <p style={{
          fontSize: 11, fontWeight: 600, color: C.textTertiary,
          letterSpacing: '0.04em', textTransform: 'uppercase', margin: 0, marginBottom: 8,
        }}>Договорённости</p>
        <ContractTermsInline partnership={partnership} onSaved={onSaved} C={C} />
      </div>
    </BlockFrame>
  );
}

function FieldRow({
  icon, label, value, mono, C,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  mono?: boolean;
  C: PageTheme;
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
      <span style={{
        display: 'inline-flex', alignItems: 'center', gap: 6,
        fontSize: 12, color: C.textSecondary,
      }}>
        <span style={{ color: C.textTertiary, display: 'inline-flex' }}>{icon}</span>
        {label}
      </span>
      <span style={{
        fontSize: 13, fontWeight: 600, color: C.text,
        fontFamily: mono ? 'ui-monospace, SFMono-Regular, monospace' : 'inherit',
      }}>{value}</span>
    </div>
  );
}

function CrossPromotionToggle({
  partnership, onSaved, C,
}: {
  partnership: PartnershipDetail;
  onSaved: () => void;
  C: PageTheme;
}) {
  const [busy, setBusy] = useState(false);

  async function toggle() {
    setBusy(true);
    const supabase = createClient();
    const { error } = await supabase
      .from('master_partnerships')
      .update({ cross_promotion: !partnership.cross_promotion })
      .eq('id', partnership.id);
    setBusy(false);
    if (error) toast.error(humanizeError(error));
    else { toast.success(partnership.cross_promotion ? 'Кросс-реклама выключена' : 'Кросс-реклама включена'); onSaved(); }
  }

  const enabled = partnership.cross_promotion;

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
      <span style={{
        display: 'inline-flex', alignItems: 'center', gap: 6,
        fontSize: 12, color: C.textSecondary,
      }}>
        <Megaphone size={13} style={{ color: C.textTertiary }} />
        Взаимная реклама
      </span>
      <button
        onClick={toggle}
        disabled={busy}
        style={{
          width: 36, height: 20, borderRadius: 999,
          background: enabled ? '#10b981' : C.border,
          border: 'none', cursor: busy ? 'not-allowed' : 'pointer',
          position: 'relative', transition: 'background 150ms',
        }}
        title={enabled ? 'Выключить' : 'Включить'}
      >
        <span style={{
          position: 'absolute', top: 2, left: enabled ? 18 : 2,
          width: 16, height: 16, borderRadius: '50%',
          background: '#fff', transition: 'left 150ms',
        }} />
      </button>
    </div>
  );
}

function ContractTermsInline({
  partnership, onSaved, C,
}: {
  partnership: PartnershipDetail;
  onSaved: () => void;
  C: PageTheme;
}) {
  const entries = parseEntries(partnership.contract_terms ?? null);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [draft, setDraft] = useState('');
  const [adding, setAdding] = useState(false);
  const [newDraft, setNewDraft] = useState('');
  const [busy, setBusy] = useState(false);

  async function persist(nextLines: string[]) {
    setBusy(true);
    const next = nextLines.map((l) => l.trim()).filter(Boolean).join('\n');
    const supabase = createClient();
    const { error } = await supabase
      .from('master_partnerships')
      .update({ contract_terms: next.length ? next : null })
      .eq('id', partnership.id);
    setBusy(false);
    if (error) { toast.error(humanizeError(error)); return false; }
    onSaved();
    return true;
  }

  return (
    <div>
      {entries.length === 0 && !adding && (
        <p style={{ fontSize: 12, color: C.textTertiary, margin: 0 }}>
          Пусто. Опиши условия в чате — AI распознает.
        </p>
      )}

      {entries.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 160, overflowY: 'auto', paddingRight: 4 }}>
          {entries.map((entry) => (
            <div
              key={entry.index}
              style={{
                padding: '6px 8px', borderRadius: 6,
                background: C.surfaceElevated, border: `1px solid ${C.border}`,
                display: 'flex', alignItems: 'flex-start', gap: 6,
              }}
            >
              {editingIndex === entry.index ? (
                <>
                  <textarea
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    rows={2}
                    autoFocus
                    style={{
                      flex: 1, padding: 6, borderRadius: 4,
                      border: `1px solid ${C.border}`, background: C.surface,
                      color: C.text, fontSize: 12, fontFamily: 'inherit', resize: 'vertical',
                      outline: 'none', boxSizing: 'border-box',
                    }}
                  />
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <button
                      onClick={() => { setEditingIndex(null); setDraft(''); }}
                      title="Отмена"
                      style={{ padding: 3, border: 'none', background: 'transparent', color: C.textSecondary, cursor: 'pointer', display: 'inline-flex' }}
                    ><X size={12} /></button>
                    <button
                      onClick={async () => {
                        if (editingIndex === null) return;
                        const lines = (partnership.contract_terms ?? '').split('\n');
                        const orig = lines[editingIndex] ?? '';
                        const m = orig.match(/^\s*\[[^\]]+\]\s*/);
                        const prefix = m ? m[0] : '';
                        lines[editingIndex] = `${prefix}${draft.trim()}`;
                        const ok = await persist(lines);
                        if (ok) { toast.success('Сохранено'); setEditingIndex(null); setDraft(''); }
                      }}
                      disabled={busy || !draft.trim()}
                      title="Сохранить"
                      style={{
                        padding: 3, border: 'none', background: C.accent, color: '#fff',
                        borderRadius: 4, cursor: 'pointer', display: 'inline-flex',
                        opacity: busy || !draft.trim() ? 0.5 : 1,
                      }}
                    ><Check size={12} /></button>
                  </div>
                </>
              ) : (
                <>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    {entry.date && (
                      <div style={{ fontSize: 10, color: C.textTertiary, letterSpacing: '0.04em' }}>
                        {entry.date}
                      </div>
                    )}
                    <div style={{ fontSize: 12, color: C.text, lineHeight: 1.4, wordBreak: 'break-word' }}>
                      {entry.body}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 2 }}>
                    <button
                      onClick={() => { setEditingIndex(entry.index); setDraft(entry.body); }}
                      title="Редактировать"
                      style={{ padding: 3, border: 'none', background: 'transparent', color: C.textSecondary, cursor: 'pointer', display: 'inline-flex' }}
                    ><Pencil size={11} /></button>
                    <button
                      onClick={async () => {
                        const lines = (partnership.contract_terms ?? '').split('\n');
                        lines.splice(entry.index, 1);
                        const ok = await persist(lines);
                        if (ok) toast.success('Удалено');
                      }}
                      title="Удалить"
                      style={{ padding: 3, border: 'none', background: 'transparent', color: C.danger, cursor: 'pointer', display: 'inline-flex' }}
                    ><Trash2 size={11} /></button>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      )}

      {adding ? (
        <div style={{ marginTop: 8, padding: 8, borderRadius: 8, background: C.surfaceElevated, border: `1px solid ${C.border}` }}>
          <textarea
            value={newDraft}
            onChange={(e) => setNewDraft(e.target.value)}
            placeholder="Например: «Комиссия 5%, отчёт раз в месяц»"
            rows={2}
            autoFocus
            style={{
              width: '100%', padding: '6px 8px', borderRadius: 6,
              border: `1px solid ${C.border}`, background: C.surface,
              color: C.text, fontSize: 12, fontFamily: 'inherit', resize: 'vertical',
              outline: 'none', boxSizing: 'border-box',
            }}
          />
          <div style={{ display: 'flex', gap: 6, marginTop: 6, justifyContent: 'flex-end' }}>
            <button
              onClick={() => { setAdding(false); setNewDraft(''); }}
              style={{ padding: '4px 8px', borderRadius: 6, border: `1px solid ${C.border}`, background: 'transparent', color: C.textSecondary, fontSize: 11, cursor: 'pointer' }}
            >Отмена</button>
            <button
              onClick={async () => {
                const v = newDraft.trim();
                if (!v) return;
                const stamp = new Date().toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' });
                const lines = [...(partnership.contract_terms ?? '').split('\n'), `[${stamp}] ${v}`];
                const ok = await persist(lines);
                if (ok) { toast.success('Добавлено'); setAdding(false); setNewDraft(''); }
              }}
              disabled={busy || !newDraft.trim()}
              style={{
                padding: '4px 10px', borderRadius: 6, border: 'none',
                background: C.accent, color: '#fff', fontSize: 11, fontWeight: 600,
                cursor: busy || !newDraft.trim() ? 'not-allowed' : 'pointer',
                opacity: busy || !newDraft.trim() ? 0.5 : 1,
              }}
            >Сохранить</button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setAdding(true)}
          style={{
            marginTop: 8, padding: '4px 10px', borderRadius: 8, border: `1px dashed ${C.border}`,
            background: 'transparent', color: C.textSecondary, fontSize: 11, fontWeight: 500,
            cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4,
          }}
        ><Plus size={11} /> Добавить условие</button>
      )}
    </div>
  );
}

/* ────────────────────── Activity block ────────────────────── */

function ActivityBlock({ partnership, C }: { partnership: PartnershipDetail; C: PageTheme }) {
  const [days, setDays] = useState(0);
  useEffect(() => {
    const initiatedAt = new Date(partnership.initiated_at).getTime();
    setDays(Math.floor((Date.now() - initiatedAt) / (1000 * 60 * 60 * 24))); // eslint-disable-line react-hooks/set-state-in-effect
  }, [partnership.initiated_at]);

  return (
    <BlockFrame icon={<BarChart3 size={15} />} title="Активность" C={C}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <Tile label="Дней в партнёрстве" value={days} accent="violet" C={C} />
        <Tile
          label="Статус"
          value={partnership.status === 'active' ? 'Активен' : partnership.status === 'pending' ? 'Ожидает' : 'Завершён'}
          accent={partnership.status === 'active' ? 'violet' : 'muted'}
          C={C}
        />
        <Tile
          label="Кросс-реклама"
          value={partnership.cross_promotion ? 'Вкл.' : 'Выкл.'}
          accent={partnership.cross_promotion ? 'violet' : 'muted'}
          C={C}
        />
        <Tile
          label="Инициатива"
          value={partnership.youInitiated ? 'Я' : 'Партнёр'}
          accent="muted"
          C={C}
        />
      </div>
      <p style={{ marginTop: 12, fontSize: 11, color: C.textTertiary, lineHeight: 1.5 }}>
        Счётчик взаимных рекомендаций появится позже — пока он только проектируется.
      </p>
    </BlockFrame>
  );
}

function Tile({
  label, value, accent, C,
}: {
  label: string;
  value: number | string;
  accent: 'violet' | 'muted';
  C: PageTheme;
}) {
  const map: Record<typeof accent, { bg: string; fg: string }> = {
    violet: { bg: C.accentSoft, fg: C.accent },
    muted: { bg: C.surfaceElevated, fg: C.textSecondary },
  };
  const acc = map[accent];
  return (
    <div style={{ padding: '8px 10px', borderRadius: 10, background: acc.bg, border: `1px solid ${C.border}` }}>
      <div style={{ fontSize: 16, fontWeight: 650, color: acc.fg, lineHeight: 1.1, fontVariantNumeric: 'tabular-nums', wordBreak: 'break-word' }}>
        {value}
      </div>
      <div style={{ marginTop: 4, fontSize: 11, color: C.textSecondary, letterSpacing: '0.02em' }}>
        {label}
      </div>
    </div>
  );
}

/* ────────────────────── AI Chat ────────────────────── */

function PartnerAiChat({
  partnershipId, onApplied, C,
}: {
  partnershipId: string;
  onApplied: () => void;
  C: PageTheme;
}) {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);

  async function send() {
    const value = text.trim();
    if (!value || busy) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/partners/${partnershipId}/parse-note`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: value }),
      });
      const data = await res.json().catch(() => ({} as Record<string, unknown>));
      if (!res.ok) {
        toast.error((data as { error?: string }).error || 'AI не смог обработать');
        return;
      }
      const d = data as { applied: boolean; summary?: string };
      if (d.applied) {
        setText('');
        toast.success(d.summary || 'Сохранено');
        onApplied();
      } else {
        toast(d.summary || 'Ничего не сохранено', { icon: '⚠️' });
      }
    } catch (e) {
      toast.error((e as Error).message || 'Ошибка');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      style={{
        background: C.surface,
        border: `1px solid ${C.border}`,
        borderRadius: 14,
        padding: 14,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <Sparkles size={14} style={{ color: C.accent }} />
        <h3 style={{ fontSize: 13, fontWeight: 650, color: C.text, margin: 0, letterSpacing: '-0.1px' }}>
          Запиши в чат всё что знаешь о партнёре
        </h3>
        <span style={{ marginLeft: 'auto', fontSize: 11, color: C.textTertiary }}>
          AI разнесёт по полям
        </span>
      </div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
              e.preventDefault();
              send();
            }
          }}
          placeholder="Например: «Дают нашим клиентам промокод NAILS10, комиссия 5%, отчёт раз в месяц. Контакт — Telegram @oleg»"
          rows={2}
          disabled={busy}
          style={{
            flex: 1, padding: '10px 12px', borderRadius: 10,
            border: `1px solid ${C.border}`, background: C.surfaceElevated,
            color: C.text, fontSize: 13, fontFamily: 'inherit',
            resize: 'vertical', minHeight: 56, outline: 'none', boxSizing: 'border-box',
          }}
          onFocus={(e) => e.currentTarget.style.borderColor = C.accent}
          onBlur={(e) => e.currentTarget.style.borderColor = C.border}
        />
        <button
          onClick={send}
          disabled={busy || text.trim().length < 2}
          style={{
            padding: '10px 16px', borderRadius: 10, border: 'none',
            background: C.accent, color: '#fff', fontSize: 13, fontWeight: 600,
            cursor: busy || text.trim().length < 2 ? 'not-allowed' : 'pointer',
            opacity: busy || text.trim().length < 2 ? 0.5 : 1,
            display: 'inline-flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap',
            height: 56,
          }}
        >
          {busy ? '…' : <><Send size={14} /> Записать</>}
        </button>
      </div>
    </div>
  );
}
