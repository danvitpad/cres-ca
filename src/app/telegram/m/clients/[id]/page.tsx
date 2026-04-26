/** --- YAML
 * name: MasterMiniAppClientCard
 * description: Master Mini App client card — vertical mirror of the web 2x2 grid. Hero + KPIs +
 *              4 stacked blocks (Personal+Health / Notes / History / Analytics) + AI chat at bottom.
 *              Master CANNOT edit personal data; CAN add/edit/delete notes per entry.
 *              AI chat parses free-form text and routes to notes / allergies / contraindications.
 * created: 2026-04-13
 * updated: 2026-04-25
 * --- */

'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  ArrowLeft, Phone, Calendar, AlertTriangle, FileText,
  Loader2, Crown, BarChart3, Sparkles, Send, Pencil, Trash2,
  Plus, Check, X, User as UserIcon, Heart, Mic,
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

interface ClientFull {
  id: string;
  full_name: string;
  phone: string | null;
  email: string | null;
  date_of_birth: string | null;
  notes: string | null;
  allergies: string[] | string | null;
  contraindications: string[] | string | null;
  has_health_alert: boolean;
  total_visits: number;
  total_spent: number;
  avg_check: number;
  last_visit_at: string | null;
}

interface VisitRow {
  id: string;
  starts_at: string;
  status: string;
  price: number;
  service_name: string;
  voice_transcript: string | null;
}

interface NoteEntry {
  index: number;
  date: string | null;
  body: string;
}

function parseEntries(s: string | null): NoteEntry[] {
  if (!s) return [];
  return s.split('\n').map((line, index) => {
    const raw = line.trim();
    if (!raw) return null;
    const m = raw.match(/^\[([^\]]+)\]\s*(.*)$/);
    return { index, date: m ? m[1] : null, body: m ? m[2] : raw };
  }).filter((x): x is NoteEntry => x !== null);
}

function asArray(v: string[] | string | null): string[] {
  if (!v) return [];
  if (Array.isArray(v)) return v;
  return v.split(',').map((s) => s.trim()).filter(Boolean);
}

export default function MasterMiniAppClientCard() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { haptic } = useTelegram();
  const { userId } = useAuthStore();
  const [client, setClient] = useState<ClientFull | null>(null);
  const [visits, setVisits] = useState<VisitRow[]>([]);
  const [loading, setLoading] = useState(true);

  // eslint-disable-next-line react-hooks/preserve-manual-memoization
  const reload = useCallback(async () => {
    if (!params?.id) return;
    const initData = getInitData();
    if (!initData) { setLoading(false); return; }
    const res = await fetch('/api/telegram/m/client-detail', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ initData, client_id: params.id }),
    });
    if (!res.ok) { setLoading(false); return; }
    const json = await res.json();
    if (!json.client) { setLoading(false); return; }
    setClient(json.client as ClientFull);

    type A = {
      id: string; starts_at: string; status: string; price: number | null;
      service: { name: string } | { name: string }[] | null;
    };
    const voiceMap = (json.voiceActions ?? {}) as Record<string, { transcript: string | null; action: string }>;
    setVisits(((json.visits ?? []) as A[]).map((r) => {
      const svc = Array.isArray(r.service) ? r.service[0] : r.service;
      return {
        id: r.id,
        starts_at: r.starts_at,
        status: r.status,
        price: Number(r.price ?? 0),
        service_name: svc?.name ?? '—',
        voice_transcript: voiceMap[r.id]?.transcript ?? null,
      };
    }));
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

  if (!client) {
    return (
      <div className="px-5 pt-10 text-center">
        <p className="text-sm text-white/60">Клиент не найден</p>
      </div>
    );
  }

  const isVIP = client.total_visits >= 10;
  const allergies = asArray(client.allergies);
  const contraindications = asArray(client.contraindications);

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

      {/* Hero. Health-alert треугольник раньше клипался поверх аватара —
          теперь рендерится отдельным цветным бейджем рядом с именем,
          с onClick-объяснением (TG не поддерживает hover tooltip). */}
      <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 p-3">
        <div className="flex size-12 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-rose-500 text-base font-bold">
          {client.full_name.split(' ').slice(0, 2).map((s) => s[0]?.toUpperCase() ?? '').join('') || '—'}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 flex-wrap">
            <h1 className="truncate text-[15px] font-bold">{client.full_name}</h1>
            {isVIP && <Crown className="size-3.5 text-amber-300" />}
            {client.has_health_alert && (
              <button
                type="button"
                onClick={() => haptic('light')}
                title="Есть аллергии или противопоказания"
                aria-label="Есть аллергии или противопоказания"
                className="inline-flex items-center gap-1 rounded-full border border-rose-500/30 bg-rose-500/15 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-rose-300"
              >
                <AlertTriangle className="size-3" />
                Здоровье
              </button>
            )}
          </div>
          {client.phone && <p className="mt-0.5 text-[11px] text-white/60">{client.phone}</p>}
        </div>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-3 gap-2">
        <KPI value={String(client.total_visits)} label="Визитов" />
        <KPI value={`${Number(client.total_spent).toFixed(0)}₴`} label="Всего" />
        <KPI value={`${Number(client.avg_check).toFixed(0)}₴`} label="Чек" />
      </div>

      {/* Quick actions. tel:-ссылка не всегда открывается из TG WebApp напрямую,
          поэтому если родное действие не сработает — копируем номер в буфер
          обмена и показываем toast: мастер сможет перейти в нативную звонилку
          вручную. */}
      <div className="grid grid-cols-2 gap-2">
        {client.phone ? (
          <button
            type="button"
            onClick={async () => {
              haptic('selection');
              const phone = client.phone!;
              const w = window as unknown as { Telegram?: { WebApp?: { openLink?: (url: string) => void } } };
              try {
                // Пробуем нативно через WebApp (TG iOS/Android отдаёт это в звонилку).
                if (w.Telegram?.WebApp?.openLink) {
                  w.Telegram.WebApp.openLink(`tel:${phone}`);
                  return;
                }
                // Web-fallback
                window.location.href = `tel:${phone}`;
              } catch {
                // Final fallback — clipboard + alert
                try {
                  await navigator.clipboard.writeText(phone);
                  alert(`Номер скопирован: ${phone}`);
                } catch {
                  alert(phone);
                }
              }
            }}
            className="flex items-center justify-center gap-2 rounded-xl bg-white/10 py-2.5 text-[12px] font-semibold active:scale-[0.98] transition-transform"
          >
            <Phone className="size-3.5" /> Позвонить
          </button>
        ) : <div />}
        <Link
          href={`/telegram/m/slot/new?client_id=${client.id}`}
          onClick={() => haptic('light')}
          className="flex items-center justify-center gap-2 rounded-xl bg-white py-2.5 text-[12px] font-semibold text-black active:scale-[0.98] transition-transform"
        >
          <Calendar className="size-3.5" /> Записать
        </Link>
      </div>

      {/* 1. Personal data + Health */}
      <Block icon={<UserIcon className="size-3.5" />} title="Личные данные" badge="Клиент управляет сам">
        <div className="grid grid-cols-2 gap-3 text-[12px]">
          <Field label="Имя" value={client.full_name} />
          <Field label="Телефон" value={client.phone || '—'} />
          <Field label="Email" value={client.email || '—'} />
          <Field
            label="Дата рождения"
            value={client.date_of_birth ? new Date(client.date_of_birth).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' }) : '—'}
          />
        </div>
        <div className="mt-3 border-t border-white/10 pt-3">
          <div className="flex items-center gap-1.5">
            <Heart className={`size-3 ${client.has_health_alert ? 'text-rose-400' : 'text-white/40'}`} />
            <span className="text-[10px] uppercase tracking-wide text-white/50">Здоровье</span>
            {client.has_health_alert && (
              <span className="ml-auto rounded-full bg-rose-500/20 px-1.5 py-0.5 text-[9px] font-semibold text-rose-300">Внимание</span>
            )}
          </div>
          {(allergies.length === 0 && contraindications.length === 0) ? (
            <p className="mt-1.5 text-[11px] text-white/50">Нет аллергий и противопоказаний.</p>
          ) : (
            <div className="mt-1.5 space-y-1 text-[12px]">
              {allergies.length > 0 && (
                <p><span className="text-white/40">Аллергии:</span> <span className="text-rose-300">{allergies.join(', ')}</span></p>
              )}
              {contraindications.length > 0 && (
                <p><span className="text-white/40">Противопоказания:</span> {contraindications.join(', ')}</p>
              )}
            </div>
          )}
        </div>
        <p className="mt-2 border-t border-white/10 pt-2 text-[10px] text-white/40 leading-relaxed">
          Имя, телефон, e-mail и дата рождения — управляет клиент. Аллергии — через AI-чат снизу.
        </p>
      </Block>

      {/* 2. Notes — editable per entry */}
      <NotesBlock
        clientId={client.id}
        notes={client.notes}
        haptic={haptic}
        onSaved={reload}
      />

      {/* 3. History */}
      <Block icon={<Calendar className="size-3.5" />} title="История посещений">
        {visits.length === 0 ? (
          <p className="text-[11px] text-white/50">Пока визитов нет.</p>
        ) : (
          <ul className="space-y-1.5">
            {visits.slice(0, 8).map((v) => (
              <li key={v.id} className="flex items-center justify-between rounded-lg bg-white/[0.03] px-2.5 py-1.5">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <p className="truncate text-[12px] font-semibold">{v.service_name}</p>
                    {v.voice_transcript && <Mic className="size-2.5 text-violet-300" />}
                  </div>
                  <p className="mt-0.5 text-[10px] text-white/50">
                    {new Date(v.starts_at).toLocaleDateString('ru', { day: 'numeric', month: 'short' })}
                    {' · '}{v.status}
                  </p>
                </div>
                <p className="ml-2 shrink-0 text-[11px] font-bold text-white/80">{v.price.toFixed(0)} ₴</p>
              </li>
            ))}
          </ul>
        )}
      </Block>

      {/* 4. Analytics */}
      <Block icon={<BarChart3 className="size-3.5" />} title="Аналитика">
        <div className="grid grid-cols-2 gap-2 text-[12px]">
          <AnalyticTile label="Визитов" value={client.total_visits} />
          <AnalyticTile label="Потрачено" value={`${Number(client.total_spent).toFixed(0)} ₴`} />
          <AnalyticTile label="Средний чек" value={`${Number(client.avg_check).toFixed(0)} ₴`} />
          <AnalyticTile
            label="Последний визит"
            value={client.last_visit_at ? new Date(client.last_visit_at).toLocaleDateString('ru', { day: '2-digit', month: '2-digit' }) : '—'}
          />
        </div>
      </Block>

      {/* AI chat — sticky bottom */}
      <div className="fixed inset-x-0 bottom-0 z-50 border-t border-white/10 bg-[#0b0d17]/95 backdrop-blur px-3 pt-2 pb-[env(safe-area-inset-bottom,12px)]">
        <ClientAiChat clientId={client.id} haptic={haptic} onApplied={reload} />
      </div>
    </motion.div>
  );
}

/* ────────────────────── small primitives ────────────────────── */

function KPI({ value, label }: { value: string; label: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-2 text-center">
      <p className="text-[14px] font-bold leading-tight">{value}</p>
      <p className="mt-0.5 text-[9px] uppercase tracking-wide text-white/50">{label}</p>
    </div>
  );
}

function Block({
  icon, title, badge, children,
}: {
  icon: React.ReactNode;
  title: string;
  badge?: string;
  children: React.ReactNode;
}) {
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

function AnalyticTile({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-lg bg-violet-500/10 px-2.5 py-2">
      <p className="text-[14px] font-bold leading-tight text-violet-200 [font-variant-numeric:tabular-nums]">{value}</p>
      <p className="mt-0.5 text-[10px] text-white/60">{label}</p>
    </div>
  );
}

/* ────────────────────── Notes block ────────────────────── */

function NotesBlock({
  clientId, notes, haptic, onSaved,
}: {
  clientId: string;
  notes: string | null;
  haptic: (k: 'light' | 'selection' | 'success' | 'error' | 'medium' | 'heavy') => void;
  onSaved: () => void;
}) {
  const entries = parseEntries(notes ?? null);
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
    const res = await fetch('/api/telegram/m/clients/notes-update', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ initData, client_id: clientId, notes: next }),
    });
    setBusy(false);
    if (!res.ok) { haptic('error'); return false; }
    haptic('success');
    onSaved();
    return true;
  }

  return (
    <Block
      icon={<FileText className="size-3.5" />}
      title="Заметки мастера"
    >
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
            placeholder="Например: «Любит зелёный чай, не пьёт кофе»"
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
                const lines = [...(notes ?? '').split('\n'), `[${stamp}] ${v}`];
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
                          const lines = (notes ?? '').split('\n');
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
                          const lines = (notes ?? '').split('\n');
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

/* ────────────────────── AI Chat ────────────────────── */

function ClientAiChat({
  clientId, haptic, onApplied,
}: {
  clientId: string;
  haptic: (k: 'light' | 'selection' | 'success' | 'error' | 'medium' | 'heavy') => void;
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
      const res = await fetch('/api/telegram/m/clients/parse-note', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ initData, client_id: clientId, text: value }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        haptic('error');
        return;
      }
      const d = data as { applied: boolean };
      if (d.applied) {
        setText('');
        haptic('success');
        onApplied();
      } else {
        haptic('error');
      }
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
          placeholder="Что нового про клиента? AI разнесёт по полям…"
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
