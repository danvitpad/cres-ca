/** --- YAML
 * name: MasterMiniAppPartnerCard
 * description: Master Mini App partner card — vertical mirror of web partner detail. Hero +
 *              4 stacked blocks (Partner info / Notes / Terms / Activity) + AI chat at bottom.
 *              Editable per-entry notes & contract terms; AI parses free-form text into
 *              notes/contract_terms/commission/promo/cross_promotion.
 * created: 2026-04-25
 * --- */

'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  ArrowLeft, Loader2, Sparkles, Send, Pencil, Trash2, Plus,
  Check, X, FileText, Handshake, Megaphone, Percent, TicketPercent,
  User as UserIcon, Users, BarChart3,
} from 'lucide-react';
import { useAuthStore } from '@/stores/auth-store';
import { useTelegram } from '@/components/miniapp/telegram-provider';

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

interface Profile { full_name: string | null; avatar_url: string | null; slug: string | null; username: string | null }
interface MasterEntry {
  id: string;
  specialization: string | null;
  vertical: string | null;
  bio: string | null;
  team_mode: string | null;
  salon_id: string | null;
  profile: Profile | null;
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

export default function MasterMiniAppPartnerCard() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { userId } = useAuthStore();
  const { haptic } = useTelegram();
  const [partnership, setPartnership] = useState<Partnership | null>(null);
  const [loading, setLoading] = useState(true);

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

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="size-6 animate-spin text-white/40" />
      </div>
    );
  }
  if (!partnership) {
    return (
      <div className="px-5 pt-10 text-center">
        <p className="text-sm text-white/60">Партнёрство не найдено</p>
      </div>
    );
  }

  const partner = partnership.partner;
  const partnerName = partner.profile?.full_name || 'Партнёр';
  const initials = partnerName.split(' ').slice(0, 2).map((s) => s[0]?.toUpperCase() ?? '').join('') || '—';
  const isTeam = !!partner.salon_id;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="space-y-3 px-4 pt-4 pb-32"
    >
      <button
        onClick={() => { haptic('light'); router.back(); }}
        className="flex size-9 items-center justify-center rounded-xl border border-white/10 bg-white/5"
      >
        <ArrowLeft className="size-4" />
      </button>

      {/* Hero */}
      <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 p-3">
        <div className="flex size-12 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-cyan-500 text-base font-bold">
          {initials}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <h1 className="truncate text-[15px] font-bold">{partnerName}</h1>
            <span className="flex items-center gap-0.5 rounded-full bg-violet-500/20 px-1.5 py-0.5 text-[9px] font-medium text-violet-200">
              {isTeam ? <Users className="size-2.5" /> : <UserIcon className="size-2.5" />}
              {isTeam ? 'Команда' : 'Соло'}
            </span>
            {partnership.status === 'active' && partnership.cross_promotion && (
              <span className="flex items-center gap-0.5 rounded-full bg-emerald-500/20 px-1.5 py-0.5 text-[9px] font-medium text-emerald-300">
                <Megaphone className="size-2.5" />Реклама
              </span>
            )}
          </div>
          <p className="mt-0.5 truncate text-[11px] text-white/55">{partner.specialization || '—'}</p>
        </div>
        {partner.profile?.slug && (
          <Link
            href={`/m/${partner.profile.slug}`}
            target="_blank"
            onClick={() => haptic('light')}
            className="shrink-0 rounded-lg bg-white/10 px-3 py-1.5 text-[10px] font-semibold"
          >
            Профиль
          </Link>
        )}
      </div>

      {/* 1. Partner info */}
      <Block icon={<UserIcon className="size-3.5" />} title={isTeam ? 'О команде' : 'О партнёре'} badge="Партнёр управляет сам">
        <div className="grid grid-cols-2 gap-3 text-[12px]">
          <Field label={isTeam ? 'Название' : 'Имя'} value={partnerName} />
          <Field label="Специализация" value={partner.specialization || '—'} />
          <Field label="Тип" value={isTeam ? 'Команда / салон' : 'Соло-мастер'} />
          <Field label="Telegram" value={partner.profile?.username ? `@${partner.profile.username}` : '—'} />
        </div>
        {partner.bio && (
          <p className="mt-2 border-t border-white/10 pt-2 text-[11px] text-white/70 leading-relaxed">
            {partner.bio}
          </p>
        )}
      </Block>

      {/* 2. Notes */}
      <NotesBlock
        title="Заметки о сотрудничестве"
        icon={<FileText className="size-3.5" />}
        partnership={partnership}
        field="note"
        haptic={haptic}
        onSaved={reload}
      />

      {/* 3. Terms */}
      <Block icon={<Handshake className="size-3.5" />} title="Условия">
        <div className="space-y-2 text-[12px]">
          <Row icon={<Percent className="size-3" />} label="Комиссия" value={partnership.commission_percent !== null ? `${partnership.commission_percent}%` : '—'} />
          <Row icon={<TicketPercent className="size-3" />} label="Промокод нашим" value={partnership.promo_code || '—'} mono={!!partnership.promo_code} />
          <CrossPromoRow partnership={partnership} haptic={haptic} onSaved={reload} />
        </div>
        <div className="mt-2 border-t border-white/10 pt-2">
          <p className="mb-1 text-[10px] uppercase tracking-wide text-white/40">Договорённости</p>
          <NotesInline partnership={partnership} field="contract_terms" haptic={haptic} onSaved={reload} />
        </div>
      </Block>

      {/* 4. Activity */}
      <ActivityBlock partnership={partnership} />

      {/* AI chat */}
      <div className="fixed inset-x-0 bottom-0 z-50 border-t border-white/10 bg-[#0b0d17]/95 backdrop-blur px-3 pt-2 pb-[env(safe-area-inset-bottom,12px)]">
        <PartnerAiChat partnershipId={partnership.id} haptic={haptic} onApplied={reload} />
      </div>
    </motion.div>
  );
}

/* primitives */

function Block({ icon, title, badge, children }: { icon: React.ReactNode; title: string; badge?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-white/10 bg-white/5 p-3">
      <header className="mb-2 flex items-center gap-1.5">
        <span className="text-violet-300">{icon}</span>
        <h3 className="text-[12px] font-semibold tracking-tight">{title}</h3>
        {badge && (
          <span className="ml-auto rounded-full bg-violet-500/15 px-2 py-0.5 text-[9px] font-medium text-violet-200">
            {badge}
          </span>
        )}
      </header>
      {children}
    </section>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[9px] uppercase tracking-wide text-white/40">{label}</p>
      <p className="mt-0.5 break-words text-[12px] text-white/95">{value}</p>
    </div>
  );
}

function Row({ icon, label, value, mono }: { icon: React.ReactNode; label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className="flex items-center gap-1.5 text-white/60">
        <span className="text-white/40">{icon}</span>
        {label}
      </span>
      <span className={`font-semibold text-white ${mono ? 'font-mono' : ''}`}>{value}</span>
    </div>
  );
}

function CrossPromoRow({
  partnership, haptic, onSaved,
}: {
  partnership: Partnership;
  haptic: (k: 'light' | 'success' | 'error') => void;
  onSaved: () => void;
}) {
  const [busy, setBusy] = useState(false);

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
        field: 'cross_promotion',
        value: !partnership.cross_promotion,
      }),
    });
    setBusy(false);
    if (!res.ok) haptic('error');
    else { haptic('success'); onSaved(); }
  }

  const enabled = partnership.cross_promotion;
  return (
    <div className="flex items-center justify-between">
      <span className="flex items-center gap-1.5 text-white/60">
        <Megaphone className="size-3 text-white/40" />
        Взаимная реклама
      </span>
      <button
        onClick={toggle}
        disabled={busy}
        className={`relative h-5 w-9 rounded-full transition-colors ${enabled ? 'bg-emerald-500' : 'bg-white/15'}`}
      >
        <span
          className="absolute top-0.5 size-4 rounded-full bg-white transition-all"
          style={{ left: enabled ? 18 : 2 }}
        />
      </button>
    </div>
  );
}

/* Notes block (full) */

function NotesBlock({
  title, icon, partnership, field, haptic, onSaved,
}: {
  title: string;
  icon: React.ReactNode;
  partnership: Partnership;
  field: 'note' | 'contract_terms';
  haptic: (k: 'light' | 'success' | 'error' | 'selection') => void;
  onSaved: () => void;
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
    const initData = getInitData();
    if (!initData) { setBusy(false); return false; }
    const next = nextLines.map((l) => l.trim()).filter(Boolean).join('\n');
    const res = await fetch('/api/telegram/m/partners/update', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        initData,
        partnership_id: partnership.id,
        field,
        value: next.length ? next : null,
      }),
    });
    setBusy(false);
    if (!res.ok) { haptic('error'); return false; }
    haptic('success');
    onSaved();
    return true;
  }

  return (
    <Block icon={icon} title={title}>
      <div className="-mt-1 mb-2 flex justify-end">
        {!adding && editingIndex === null && (
          <button
            onClick={() => { haptic('light'); setAdding(true); }}
            className="flex items-center gap-1 rounded-md bg-violet-500/20 px-2 py-1 text-[10px] font-semibold text-violet-200 active:scale-95"
          >
            <Plus className="size-3" /> Добавить
          </button>
        )}
      </div>

      {adding && (
        <div className="mb-2 rounded-lg border border-white/10 bg-black/30 p-2">
          <textarea
            value={newDraft}
            onChange={(e) => setNewDraft(e.target.value)}
            placeholder={field === 'contract_terms' ? '«Комиссия 5%, отчёт раз в месяц»' : '«Делает скидку 10% нашим»'}
            rows={2}
            autoFocus
            className="w-full resize-none rounded-md bg-black/40 px-2 py-1.5 text-[12px] outline-none"
          />
          <div className="mt-1.5 flex justify-end gap-1.5">
            <button
              onClick={() => { setAdding(false); setNewDraft(''); }}
              className="rounded-md border border-white/10 px-2 py-1 text-[10px] text-white/70"
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
              className="rounded-md bg-violet-500 px-2.5 py-1 text-[10px] font-semibold text-white disabled:opacity-40"
            >Сохранить</button>
          </div>
        </div>
      )}

      {entries.length === 0 && !adding ? (
        <p className="text-[11px] leading-relaxed text-white/50">
          Пусто. Добавь вручную или напиши в чат снизу — AI разнесёт.
        </p>
      ) : (
        <div className="space-y-1.5">
          {entries.map((entry) => {
            const isEditing = editingIndex === entry.index;
            return (
              <div key={entry.index} className="rounded-lg bg-white/[0.04] px-2.5 py-1.5">
                {isEditing ? (
                  <>
                    <textarea
                      value={draft}
                      onChange={(e) => setDraft(e.target.value)}
                      rows={2}
                      autoFocus
                      className="w-full resize-none rounded-md bg-black/40 px-2 py-1.5 text-[12px] outline-none"
                    />
                    <div className="mt-1 flex justify-end gap-1.5">
                      <button
                        onClick={() => { setEditingIndex(null); setDraft(''); }}
                        className="flex size-6 items-center justify-center rounded-md bg-white/5 text-white/70"
                      ><X className="size-3" /></button>
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
                        className="flex size-6 items-center justify-center rounded-md bg-violet-500 text-white disabled:opacity-40"
                      ><Check className="size-3" /></button>
                    </div>
                  </>
                ) : (
                  <div className="flex items-start gap-2">
                    <div className="min-w-0 flex-1">
                      {entry.date && (
                        <p className="text-[9px] tracking-wide text-white/40">{entry.date}</p>
                      )}
                      <p className="break-words text-[12px] text-white/90 leading-relaxed">{entry.body}</p>
                    </div>
                    <div className="flex shrink-0 gap-0.5 opacity-70">
                      <button
                        onClick={() => { haptic('selection'); setEditingIndex(entry.index); setDraft(entry.body); }}
                        className="flex size-6 items-center justify-center rounded-md text-white/70"
                      ><Pencil className="size-3" /></button>
                      <button
                        onClick={async () => {
                          const lines = (value ?? '').split('\n');
                          lines.splice(entry.index, 1);
                          await persist(lines);
                        }}
                        className="flex size-6 items-center justify-center rounded-md text-rose-400"
                      ><Trash2 className="size-3" /></button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </Block>
  );
}

/* Notes inline (compact, used inside Terms block for contract_terms) */

function NotesInline({
  partnership, field, haptic, onSaved,
}: {
  partnership: Partnership;
  field: 'contract_terms';
  haptic: (k: 'light' | 'success' | 'error' | 'selection') => void;
  onSaved: () => void;
}) {
  const value = partnership[field];
  const entries = parseEntries(value ?? null);
  const [adding, setAdding] = useState(false);
  const [newDraft, setNewDraft] = useState('');
  const [busy, setBusy] = useState(false);

  async function persist(nextLines: string[]) {
    setBusy(true);
    const initData = getInitData();
    if (!initData) { setBusy(false); return false; }
    const next = nextLines.map((l) => l.trim()).filter(Boolean).join('\n');
    const res = await fetch('/api/telegram/m/partners/update', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        initData,
        partnership_id: partnership.id,
        field,
        value: next.length ? next : null,
      }),
    });
    setBusy(false);
    if (!res.ok) { haptic('error'); return false; }
    haptic('success');
    onSaved();
    return true;
  }

  return (
    <div>
      {entries.length === 0 && !adding && (
        <p className="text-[11px] text-white/50">Пусто. Опиши условия в AI-чате.</p>
      )}
      {entries.length > 0 && (
        <div className="space-y-1">
          {entries.map((entry) => (
            <div key={entry.index} className="flex items-start gap-2 rounded-md bg-white/[0.03] px-2 py-1">
              <div className="min-w-0 flex-1">
                {entry.date && <p className="text-[9px] text-white/40">{entry.date}</p>}
                <p className="text-[11px] text-white/90 leading-relaxed">{entry.body}</p>
              </div>
              <button
                onClick={async () => {
                  const lines = (value ?? '').split('\n');
                  lines.splice(entry.index, 1);
                  await persist(lines);
                }}
                className="shrink-0 text-rose-400"
              ><Trash2 className="size-3" /></button>
            </div>
          ))}
        </div>
      )}
      {adding ? (
        <div className="mt-2 rounded-md border border-white/10 bg-black/30 p-2">
          <textarea
            value={newDraft}
            onChange={(e) => setNewDraft(e.target.value)}
            placeholder="Например: «Комиссия 5%, отчёт раз в месяц»"
            rows={2}
            autoFocus
            className="w-full resize-none rounded-md bg-black/40 px-2 py-1 text-[11px] outline-none"
          />
          <div className="mt-1 flex justify-end gap-1.5">
            <button onClick={() => { setAdding(false); setNewDraft(''); }} className="rounded-md border border-white/10 px-2 py-0.5 text-[10px] text-white/70">Отмена</button>
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
              className="rounded-md bg-violet-500 px-2 py-0.5 text-[10px] font-semibold text-white disabled:opacity-40"
            >Сохранить</button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setAdding(true)}
          className="mt-2 flex items-center gap-1 rounded-md border border-dashed border-white/15 px-2 py-1 text-[10px] text-white/60"
        >
          <Plus className="size-3" /> Добавить условие
        </button>
      )}
    </div>
  );
}

/* Activity block */

function ActivityBlock({ partnership }: { partnership: Partnership }) {
  const [days, setDays] = useState(0);
  useEffect(() => {
    setDays(Math.floor((Date.now() - new Date(partnership.initiated_at).getTime()) / (1000 * 60 * 60 * 24))); // eslint-disable-line react-hooks/set-state-in-effect
  }, [partnership.initiated_at]);

  return (
    <Block icon={<BarChart3 className="size-3.5" />} title="Активность">
      <div className="grid grid-cols-2 gap-2 text-[12px]">
        <Tile label="Дней в партнёрстве" value={days} />
        <Tile label="Статус" value={partnership.status === 'active' ? 'Активен' : partnership.status === 'pending' ? 'Ожидает' : 'Завершён'} />
        <Tile label="Кросс-реклама" value={partnership.cross_promotion ? 'Вкл.' : 'Выкл.'} />
        <Tile label="Инициатива" value={partnership.youInitiated ? 'Я' : 'Партнёр'} />
      </div>
      <p className="mt-2 text-[10px] text-white/40 leading-relaxed">
        Счётчик взаимных рекомендаций появится позже.
      </p>
    </Block>
  );
}

function Tile({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-lg bg-violet-500/10 px-2.5 py-2">
      <p className="text-[14px] font-bold leading-tight text-violet-200 [font-variant-numeric:tabular-nums]">{value}</p>
      <p className="mt-0.5 text-[10px] text-white/60">{label}</p>
    </div>
  );
}

/* AI chat */

function PartnerAiChat({
  partnershipId, haptic, onApplied,
}: {
  partnershipId: string;
  haptic: (k: 'light' | 'success' | 'error') => void;
  onApplied: () => void;
}) {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);

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
    <div className="flex items-end gap-2">
      <div className="flex flex-1 items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-3 py-2">
        <Sparkles className="size-3.5 shrink-0 text-violet-300" />
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Что нового про партнёра? AI разнесёт…"
          rows={1}
          disabled={busy}
          className="max-h-[120px] flex-1 resize-none bg-transparent text-[12px] outline-none placeholder:text-white/40"
        />
      </div>
      <button
        onClick={send}
        disabled={busy || text.trim().length < 2}
        className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-violet-500 text-white disabled:opacity-40"
      >
        {busy ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
      </button>
    </div>
  );
}
