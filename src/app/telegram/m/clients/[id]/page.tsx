/** --- YAML
 * name: MasterMiniAppClientCard
 * description: Master Mini App client card — summary, health/allergies, visit history with 🎙 voice markers and transcript reveal, notes, files. Quick actions: call, book, add note.
 * created: 2026-04-13
 * updated: 2026-04-18
 * --- */

'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { AnimatePresence, motion } from 'framer-motion';
import {
  ArrowLeft,
  Phone,
  Calendar,
  AlertTriangle,
  FileText,
  Loader2,
  Save,
  Crown,
  TrendingUp,
  Mic,
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
  allergies: string | null;
  contraindications: string | null;
  has_health_alert: boolean;
  behavior_indicators: string[] | null;
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

interface FileRow {
  id: string;
  file_url: string;
  file_type: string | null;
  description: string | null;
  is_before_photo: boolean;
  created_at: string;
}

export default function MasterMiniAppClientCard() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { haptic } = useTelegram();
  const { userId } = useAuthStore();
  const [client, setClient] = useState<ClientFull | null>(null);
  const [visits, setVisits] = useState<VisitRow[]>([]);
  const [files, setFiles] = useState<FileRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [noteDraft, setNoteDraft] = useState('');
  const [savingNote, setSavingNote] = useState(false);
  const [openTranscriptId, setOpenTranscriptId] = useState<string | null>(null);

  useEffect(() => {
    if (!params?.id || !userId) return;
    (async () => {
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
      setNoteDraft((json.client.notes as string) ?? '');

      type A = {
        id: string;
        starts_at: string;
        status: string;
        price: number | null;
        service: { name: string } | { name: string }[] | null;
      };
      const voiceMap = (json.voiceActions ?? {}) as Record<string, { transcript: string | null; action: string }>;
      const mapped: VisitRow[] = ((json.visits ?? []) as A[]).map((r) => {
        const svc = Array.isArray(r.service) ? r.service[0] : r.service;
        return {
          id: r.id,
          starts_at: r.starts_at,
          status: r.status,
          price: Number(r.price ?? 0),
          service_name: svc?.name ?? '—',
          voice_transcript: voiceMap[r.id]?.transcript ?? null,
        };
      });
      setVisits(mapped);
      setFiles((json.files ?? []) as FileRow[]);
      setLoading(false);
    })();
  }, [params?.id, userId]);

  async function saveNote() {
    if (!client) return;
    setSavingNote(true);
    const initData = getInitData();
    if (!initData) { setSavingNote(false); return; }
    const res = await fetch('/api/telegram/m/client-detail', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ initData, client_id: client.id, save_note: noteDraft }),
    });
    if (res.ok) {
      haptic('success');
      setClient({ ...client, notes: noteDraft });
    } else {
      haptic('error');
    }
    setSavingNote(false);
  }

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

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="space-y-5 px-5 pt-6 pb-10"
    >
      <button
        onClick={() => {
          haptic('light');
          router.back();
        }}
        className="flex size-9 items-center justify-center rounded-xl border border-white/10 bg-white/5"
      >
        <ArrowLeft className="size-4" />
      </button>

      {/* Header */}
      <div className="flex items-center gap-4">
        <div className="flex size-16 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-rose-500 text-xl font-bold">
          {client.full_name
            .split(' ')
            .slice(0, 2)
            .map((s) => s[0]?.toUpperCase() ?? '')
            .join('') || '—'}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <h1 className="truncate text-xl font-bold">{client.full_name}</h1>
            {isVIP && <Crown className="size-4 text-amber-300" />}
          </div>
          {client.phone && <p className="mt-0.5 text-[12px] text-white/60">{client.phone}</p>}
        </div>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-3 gap-2">
        <div className="rounded-2xl border border-white/10 bg-white/5 p-3 text-center">
          <p className="text-lg font-bold">{client.total_visits}</p>
          <p className="text-[10px] uppercase tracking-wide text-white/50">Визитов</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/5 p-3 text-center">
          <p className="text-lg font-bold">{Number(client.total_spent).toFixed(0)}₴</p>
          <p className="text-[10px] uppercase tracking-wide text-white/50">Всего</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/5 p-3 text-center">
          <p className="text-lg font-bold">{Number(client.avg_check).toFixed(0)}₴</p>
          <p className="text-[10px] uppercase tracking-wide text-white/50">Чек</p>
        </div>
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-2 gap-2">
        {client.phone && (
          <a
            href={`tel:${client.phone}`}
            onClick={() => haptic('selection')}
            className="flex items-center justify-center gap-2 rounded-2xl bg-white/10 py-3 text-[12px] font-semibold active:scale-[0.98] transition-transform"
          >
            <Phone className="size-4" /> Позвонить
          </a>
        )}
        <Link
          href={`/telegram/m/slot/new?client_id=${client.id}`}
          onClick={() => haptic('light')}
          className="flex items-center justify-center gap-2 rounded-2xl bg-white py-3 text-[12px] font-semibold text-black active:scale-[0.98] transition-transform"
        >
          <Calendar className="size-4" /> Записать
        </Link>
      </div>

      {/* Health alert */}
      {(client.has_health_alert || client.allergies || client.contraindications) && (
        <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 p-4">
          <div className="flex items-center gap-2">
            <AlertTriangle className="size-4 text-rose-300" />
            <p className="text-[11px] font-semibold uppercase tracking-wide text-rose-200">Внимание</p>
          </div>
          {client.allergies && (
            <p className="mt-2 text-[13px] text-white/90">
              <span className="text-white/50">Аллергии:</span> {client.allergies}
            </p>
          )}
          {client.contraindications && (
            <p className="mt-1 text-[13px] text-white/90">
              <span className="text-white/50">Противопоказания:</span> {client.contraindications}
            </p>
          )}
        </div>
      )}

      {/* Notes */}
      <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
        <p className="text-[10px] uppercase tracking-wide text-white/40">Заметки</p>
        <textarea
          value={noteDraft}
          onChange={(e) => setNoteDraft(e.target.value)}
          rows={3}
          placeholder="Предпочтения, особенности, комментарии…"
          className="mt-2 w-full resize-none rounded-xl border border-white/10 bg-black/40 p-3 text-[13px] outline-none focus:border-white/20"
        />
        {noteDraft !== (client.notes ?? '') && (
          <button
            onClick={saveNote}
            disabled={savingNote}
            className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-500 py-2.5 text-[12px] font-semibold text-black active:scale-[0.98] transition-transform disabled:opacity-50"
          >
            <Save className="size-3.5" /> Сохранить
          </button>
        )}
      </div>

      {/* Visits */}
      <div>
        <div className="mb-2 flex items-center gap-2">
          <TrendingUp className="size-4 text-white/60" />
          <h2 className="text-sm font-semibold">История визитов</h2>
        </div>
        {visits.length === 0 ? (
          <p className="rounded-2xl border border-white/10 bg-white/5 p-4 text-center text-[12px] text-white/50">
            Пока визитов нет
          </p>
        ) : (
          <ul className="space-y-2">
            {visits.map((v) => {
              const hasVoice = Boolean(v.voice_transcript);
              const expanded = openTranscriptId === v.id;
              return (
                <li key={v.id} className="overflow-hidden rounded-xl border border-white/10 bg-white/5">
                  <div className="flex items-center justify-between p-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <p className="truncate text-[13px] font-semibold">{v.service_name}</p>
                        {hasVoice && (
                          <button
                            onClick={() => {
                              haptic('selection');
                              setOpenTranscriptId(expanded ? null : v.id);
                            }}
                            aria-label="Создано голосом"
                            className="flex size-5 shrink-0 items-center justify-center rounded-md border border-white/10 bg-white/[0.03] text-violet-300 active:bg-white/[0.06] transition-colors"
                          >
                            <Mic className="size-3" />
                          </button>
                        )}
                      </div>
                      <p className="mt-0.5 text-[10px] text-white/50">
                        {new Date(v.starts_at).toLocaleDateString('ru', { day: 'numeric', month: 'short', year: 'numeric' })}
                        {' · '}
                        {v.status}
                      </p>
                    </div>
                    <p className="shrink-0 text-[12px] font-bold text-white/80">{v.price.toFixed(0)} ₴</p>
                  </div>
                  <AnimatePresence initial={false}>
                    {expanded && v.voice_transcript && (
                      <motion.div
                        key="transcript"
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="border-t border-white/10 bg-white/[0.03] px-3 py-2"
                      >
                        <p className="text-[11px] italic text-white/70">
                          <span className="not-italic text-violet-300">🎙</span> «{v.voice_transcript}»
                        </p>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Files */}
      {files.length > 0 && (
        <div>
          <div className="mb-2 flex items-center gap-2">
            <FileText className="size-4 text-white/60" />
            <h2 className="text-sm font-semibold">Файлы</h2>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {files.map((f) => {
              const isImage = (f.file_type ?? '').startsWith('image/');
              return (
                <a
                  key={f.id}
                  href={f.file_url}
                  target="_blank"
                  rel="noreferrer"
                  onClick={() => haptic('light')}
                  className="relative aspect-square overflow-hidden rounded-xl border border-white/10 bg-white/5"
                >
                  {isImage ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={f.file_url} alt={f.description ?? ''} className="size-full object-cover" />
                  ) : (
                    <div className="flex size-full items-center justify-center">
                      <FileText className="size-6 text-white/40" />
                    </div>
                  )}
                  {f.is_before_photo && (
                    <span className="absolute left-1 top-1 rounded-full bg-black/60 px-1.5 py-0.5 text-[8px] font-semibold">
                      ДО
                    </span>
                  )}
                </a>
              );
            })}
          </div>
        </div>
      )}
    </motion.div>
  );
}
