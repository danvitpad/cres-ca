/** --- YAML
 * name: Voice Booking Mini App
 * description: Голосовая команда «запиши X на завтра 3 часа» → AI парсит → подтверждение → создание appointment. Flat cards (Phase 7.8).
 * created: 2026-04-13
 * updated: 2026-04-18
 * --- */

'use client';

import { useState } from 'react';
import { Mic, Square, Check, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useAuthStore } from '@/stores/auth-store';

interface Parsed {
  client_name: string | null;
  date: string | null;
  time: string | null;
  duration_min: number | null;
  service_hint: string | null;
}

type SRClass = new () => {
  lang: string;
  interimResults: boolean;
  onresult: (e: { results: { 0: { transcript: string } }[] }) => void;
  onerror: () => void;
  onend: () => void;
  start: () => void;
  stop: () => void;
};

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

export default function VoiceBookPage() {
  const { userId } = useAuthStore();
  const [listening, setListening] = useState(false);
  const [text, setText] = useState('');
  const [parsed, setParsed] = useState<Parsed | null>(null);
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);

  function startListening() {
    if (typeof window === 'undefined') return;
    const w = window as unknown as { SpeechRecognition?: SRClass; webkitSpeechRecognition?: SRClass };
    const SR = w.SpeechRecognition ?? w.webkitSpeechRecognition;
    if (!SR) {
      toast.error('Голосовой ввод не поддерживается в этом браузере');
      return;
    }
    const rec = new SR();
    rec.lang = 'ru-RU';
    rec.interimResults = false;
    rec.onresult = (e) => {
      const t = e.results[0][0].transcript;
      setText(t);
      setListening(false);
      parse(t);
    };
    rec.onerror = () => setListening(false);
    rec.onend = () => setListening(false);
    rec.start();
    setListening(true);
  }

  async function parse(t: string) {
    setBusy(true);
    try {
      const res = await fetch('/api/voice-booking/parse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: t }),
      });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error ?? 'Parse failed');
        return;
      }
      setParsed(json.result as Parsed);
    } finally {
      setBusy(false);
    }
  }

  async function confirm() {
    if (!parsed || !userId) return;
    if (!parsed.client_name || !parsed.date || !parsed.time) {
      toast.error('Нужно имя клиента, дата и время');
      return;
    }
    setSaving(true);
    const initData = getInitData();
    if (!initData) {
      toast.error('Нет данных сессии');
      setSaving(false);
      return;
    }
    const res = await fetch('/api/telegram/m/voice-book', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        initData,
        client_name: parsed.client_name,
        date: parsed.date,
        time: parsed.time,
        duration_min: parsed.duration_min,
      }),
    });
    setSaving(false);
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      toast.error(j.error ?? 'Не удалось создать запись');
      return;
    }
    toast.success('Запись создана');
    setParsed(null);
    setText('');
  }

  return (
    <div className="mx-auto max-w-md space-y-6 px-5 pt-6 pb-10">
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/40">Голос</p>
        <h1 className="mt-1 text-2xl font-bold">Голосовая запись</h1>
        <p className="mt-0.5 text-[12px] text-white/50">Нажми микрофон и скажи: «Запиши Машу на завтра в 15:00 на стрижку».</p>
      </div>

      <div className="flex flex-col items-center gap-3">
        <button
          onClick={startListening}
          disabled={listening || busy}
          className={`flex h-24 w-24 items-center justify-center rounded-full transition-colors ${
            listening
              ? 'animate-pulse bg-rose-500 text-white'
              : 'bg-white text-black active:bg-white/80'
          }`}
        >
          {listening ? <Square className="h-8 w-8" /> : <Mic className="h-8 w-8" />}
        </button>
        {busy && <Loader2 className="h-5 w-5 animate-spin text-white/40" />}
      </div>

      {text && (
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-sm">
          <div className="text-[10px] uppercase tracking-wide text-white/40">Ты сказал</div>
          <div className="mt-1">{text}</div>
        </div>
      )}

      {parsed && (
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 space-y-2">
          <div className="text-sm font-semibold">Распознано</div>
          <div className="text-[13px] text-white/80">Клиент: <b className="text-white">{parsed.client_name ?? '—'}</b></div>
          <div className="text-[13px] text-white/80">Дата: <b className="text-white">{parsed.date ?? '—'}</b></div>
          <div className="text-[13px] text-white/80">Время: <b className="text-white">{parsed.time ?? '—'}</b></div>
          <div className="text-[13px] text-white/80">Длительность: <b className="text-white">{parsed.duration_min ?? 60} мин</b></div>
          {parsed.service_hint && <div className="text-[13px] text-white/80">Услуга: <b className="text-white">{parsed.service_hint}</b></div>}
          <button
            onClick={confirm}
            disabled={saving}
            className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-xl bg-white py-3 text-sm font-semibold text-black active:bg-white/80 transition-colors disabled:opacity-60"
          >
            <Check className="h-4 w-4" />
            {saving ? 'Создаём…' : 'Создать запись'}
          </button>
        </div>
      )}
    </div>
  );
}
