/** --- YAML
 * name: Voice Booking Mini App
 * description: Голосовая команда «запиши X на завтра 3 часа» → AI парсит → подтверждение → создание appointment.
 * created: 2026-04-13
 * updated: 2026-04-13
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
    <div className="mx-auto max-w-md space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold">Голосовая запись</h1>
        <p className="text-sm text-muted-foreground">Нажми микрофон и скажи: «Запиши Машу на завтра в 15:00 на стрижку».</p>
      </div>

      <div className="flex flex-col items-center gap-3">
        <button
          onClick={startListening}
          disabled={listening || busy}
          className={`flex h-24 w-24 items-center justify-center rounded-full shadow-lg ${
            listening ? 'animate-pulse bg-red-500 text-white' : 'bg-primary text-primary-foreground'
          }`}
        >
          {listening ? <Square className="h-8 w-8" /> : <Mic className="h-8 w-8" />}
        </button>
        {busy && <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />}
      </div>

      {text && (
        <div className="rounded-lg border bg-card p-3 text-sm">
          <div className="text-xs uppercase text-muted-foreground">Ты сказал</div>
          <div>{text}</div>
        </div>
      )}

      {parsed && (
        <div className="rounded-lg border bg-card p-4 space-y-2">
          <div className="text-sm font-semibold">Распознано</div>
          <div className="text-sm">Клиент: <b>{parsed.client_name ?? '—'}</b></div>
          <div className="text-sm">Дата: <b>{parsed.date ?? '—'}</b></div>
          <div className="text-sm">Время: <b>{parsed.time ?? '—'}</b></div>
          <div className="text-sm">Длительность: <b>{parsed.duration_min ?? 60} мин</b></div>
          {parsed.service_hint && <div className="text-sm">Услуга: <b>{parsed.service_hint}</b></div>}
          <button
            onClick={confirm}
            disabled={saving}
            className="mt-2 w-full rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-60"
          >
            <Check className="mr-1 inline h-4 w-4" />
            {saving ? 'Создаём…' : 'Создать запись'}
          </button>
        </div>
      )}
    </div>
  );
}
