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
import { createClient } from '@/lib/supabase/client';
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

export default function VoiceBookPage() {
  const supabase = createClient();
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

    const { data: master } = await supabase
      .from('masters')
      .select('id')
      .eq('profile_id', userId)
      .single();
    if (!master) {
      toast.error('Master not found');
      setSaving(false);
      return;
    }

    const { data: client } = await supabase
      .from('clients')
      .select('id')
      .eq('master_id', master.id)
      .ilike('full_name', `%${parsed.client_name}%`)
      .limit(1)
      .maybeSingle();

    let clientId = client?.id;
    if (!clientId) {
      const { data: newClient, error } = await supabase
        .from('clients')
        .insert({ master_id: master.id, full_name: parsed.client_name })
        .select('id')
        .single();
      if (error) {
        toast.error(error.message);
        setSaving(false);
        return;
      }
      clientId = newClient.id;
    }

    const dur = parsed.duration_min ?? 60;
    const startsAt = new Date(`${parsed.date}T${parsed.time}:00`);
    const endsAt = new Date(startsAt.getTime() + dur * 60 * 1000);

    const { error: aptErr } = await supabase.from('appointments').insert({
      master_id: master.id,
      client_id: clientId,
      starts_at: startsAt.toISOString(),
      ends_at: endsAt.toISOString(),
      status: 'booked',
      price: 0,
      currency: 'UAH',
    });

    setSaving(false);
    if (aptErr) {
      toast.error(aptErr.message);
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
