/** --- YAML
 * name: Voice Notes
 * description: Record voice via browser SpeechRecognition, transcribe live, parse with AI, save to voice_notes.
 * created: 2026-04-12
 * updated: 2026-04-12
 * --- */

'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Mic, Square, Sparkles, Trash2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useMaster } from '@/hooks/use-master';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';

type Parsed = {
  client_name?: string;
  service_performed?: string;
  notes?: string;
  inventory_items_used?: { name: string; quantity: number | string }[];
};

type Note = {
  id: string;
  raw_text: string;
  parsed: Parsed | null;
  created_at: string;
};

interface SpeechRecognitionAlt {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> & { length: number } }) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
}

export default function VoiceNotesPage() {
  const supabase = createClient();
  const { master } = useMaster();
  const [recording, setRecording] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [parsing, setParsing] = useState(false);
  const [parsed, setParsed] = useState<Parsed | null>(null);
  const [notes, setNotes] = useState<Note[]>([]);
  const [supported, setSupported] = useState(true);
  const recRef = useRef<SpeechRecognitionAlt | null>(null);

  const load = useCallback(async () => {
    if (!master?.id) return;
    const { data } = await supabase
      .from('voice_notes')
      .select('id, raw_text, parsed, created_at')
      .eq('master_id', master.id)
      .order('created_at', { ascending: false })
      .limit(20);
    setNotes((data as Note[] | null) ?? []);
  }, [supabase, master?.id]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const w = window as unknown as {
      SpeechRecognition?: new () => SpeechRecognitionAlt;
      webkitSpeechRecognition?: new () => SpeechRecognitionAlt;
    };
    const Ctor = w.SpeechRecognition ?? w.webkitSpeechRecognition;
    if (!Ctor) {
      setSupported(false);
      return;
    }
    const r = new Ctor();
    r.lang = 'ru-RU';
    r.continuous = true;
    r.interimResults = true;
    r.onresult = (e) => {
      let text = '';
      for (let i = 0; i < e.results.length; i++) {
        text += e.results[i][0].transcript + ' ';
      }
      setTranscript(text.trim());
    };
    r.onerror = (e) => {
      toast.error(`Ошибка распознавания: ${e.error}`);
      setRecording(false);
    };
    r.onend = () => setRecording(false);
    recRef.current = r;
  }, []);

  function toggleRecord() {
    if (!recRef.current) return;
    if (recording) {
      recRef.current.stop();
      setRecording(false);
    } else {
      setTranscript('');
      setParsed(null);
      recRef.current.start();
      setRecording(true);
    }
  }

  async function parseAndSave() {
    if (!master?.id || !transcript.trim()) return;
    setParsing(true);
    let parsedResult: Parsed | null = null;
    try {
      const res = await fetch('/api/ai/transcribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: transcript }),
      });
      if (res.ok) {
        const json = await res.json();
        parsedResult = (json && typeof json === 'object' && !json.raw ? json : null) as Parsed | null;
        setParsed(parsedResult);
      } else if (res.status === 403) {
        toast.error('AI-функции доступны на Pro+');
      }
    } catch {
      // network ok, save without parse
    }

    const { error } = await supabase.from('voice_notes').insert({
      master_id: master.id,
      raw_text: transcript.trim(),
      parsed: parsedResult,
    });
    setParsing(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success('Заметка сохранена');
    setTranscript('');
    load();
  }

  async function remove(id: string) {
    const { error } = await supabase.from('voice_notes').delete().eq('id', id);
    if (error) {
      toast.error(error.message);
      return;
    }
    setNotes((prev) => prev.filter((n) => n.id !== id));
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-semibold">
          <Mic className="h-6 w-6 text-primary" />
          Голосовые заметки
        </h1>
        <p className="text-sm text-muted-foreground">
          Скажи: «Клиент Анна, сделала маникюр-гель, использовала 1 базу и 2 цвета». AI разберёт на поля.
        </p>
      </div>

      {!supported ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm dark:border-amber-900 dark:bg-amber-950/30">
          Web Speech API не поддерживается этим браузером. Попробуй Chrome/Edge.
        </div>
      ) : (
        <div className="rounded-lg border bg-card p-5 space-y-4">
          <div className="flex items-center justify-center">
            <button
              type="button"
              onClick={toggleRecord}
              className={cn(
                'flex h-24 w-24 items-center justify-center rounded-full transition-all',
                recording
                  ? 'animate-pulse bg-red-500 text-white shadow-lg shadow-red-500/40'
                  : 'bg-primary text-white hover:scale-105',
              )}
            >
              {recording ? <Square className="h-8 w-8" /> : <Mic className="h-8 w-8" />}
            </button>
          </div>
          <p className="text-center text-xs text-muted-foreground">
            {recording ? 'Идёт запись… нажми чтобы остановить' : 'Нажми чтобы начать запись'}
          </p>

          <Textarea
            value={transcript}
            onChange={(e) => setTranscript(e.target.value)}
            rows={4}
            placeholder="Расшифровка появится здесь… (можно отредактировать)"
          />

          <div className="flex gap-2">
            <Button onClick={parseAndSave} disabled={parsing || !transcript.trim()}>
              <Sparkles className="mr-1 h-4 w-4" />
              {parsing ? 'AI разбирает…' : 'Разобрать и сохранить'}
            </Button>
            {(transcript || parsed) && (
              <Button variant="ghost" onClick={() => { setTranscript(''); setParsed(null); }}>
                Очистить
              </Button>
            )}
          </div>

          {parsed && (
            <div className="rounded-md border bg-muted/30 p-3 text-sm">
              <div className="mb-1 text-xs font-semibold text-muted-foreground">AI разобрал:</div>
              {parsed.client_name && <div><span className="text-muted-foreground">Клиент:</span> {parsed.client_name}</div>}
              {parsed.service_performed && <div><span className="text-muted-foreground">Услуга:</span> {parsed.service_performed}</div>}
              {parsed.notes && <div><span className="text-muted-foreground">Заметки:</span> {parsed.notes}</div>}
              {parsed.inventory_items_used && parsed.inventory_items_used.length > 0 && (
                <div>
                  <span className="text-muted-foreground">Расход:</span>{' '}
                  {parsed.inventory_items_used.map((i) => `${i.name} ×${i.quantity}`).join(', ')}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      <div className="space-y-2">
        <h2 className="text-sm font-semibold text-muted-foreground">История</h2>
        {notes.length === 0 ? (
          <p className="rounded-lg border bg-card p-6 text-center text-sm text-muted-foreground">
            Пока нет голосовых заметок.
          </p>
        ) : (
          notes.map((n) => (
            <div key={n.id} className="rounded-lg border bg-card p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="text-xs text-muted-foreground">
                    {new Date(n.created_at).toLocaleString()}
                  </div>
                  <p className="mt-1 text-sm">{n.raw_text}</p>
                  {n.parsed && (
                    <div className="mt-2 flex flex-wrap gap-1.5 text-xs">
                      {n.parsed.client_name && (
                        <span className="rounded-full bg-primary/10 px-2 py-0.5 text-primary">
                          👤 {n.parsed.client_name}
                        </span>
                      )}
                      {n.parsed.service_performed && (
                        <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                          ✂ {n.parsed.service_performed}
                        </span>
                      )}
                      {n.parsed.inventory_items_used?.map((i, idx) => (
                        <span key={idx} className="rounded-full bg-amber-100 px-2 py-0.5 text-amber-700 dark:bg-amber-950 dark:text-amber-300">
                          📦 {i.name} ×{i.quantity}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <Button variant="ghost" size="icon" onClick={() => remove(n.id)}>
                  <Trash2 className="h-4 w-4 text-red-500" />
                </Button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
