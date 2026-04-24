/** --- YAML
 * name: Voice record button
 * description: MediaRecorder-based voice capture for feedback. Tap to start, tap to stop. Shows live timer. Uploads as multipart/form-data to /api/feedback/voice.
 * created: 2026-04-21
 * --- */

'use client';

import { useEffect, useRef, useState } from 'react';
import { Mic, Square, Loader2 } from 'lucide-react';

interface VoiceRecordButtonProps {
  source: 'mobile' | 'web_settings';
  onSent: (transcript: string) => void;
  onError?: (err: string) => void;
  maxSeconds?: number;  // safety cap, default 120
}

export function VoiceRecordButton({ source, onSent, onError, maxSeconds = 120 }: VoiceRecordButtonProps) {
  const [state, setState] = useState<'idle' | 'recording' | 'sending'>('idle');
  const [seconds, setSeconds] = useState(0);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startedAtRef = useRef<number>(0);

  const stopTracks = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  useEffect(() => {
    return () => {
      stopTracks();
    };
  }, []);

  async function start() {
    if (state !== 'idle') return;
    if (typeof window === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      onError?.('Браузер не поддерживает запись голоса');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      // Pick best supported mime
      const mime = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/ogg;codecs=opus')
          ? 'audio/ogg;codecs=opus'
          : MediaRecorder.isTypeSupported('audio/webm')
            ? 'audio/webm'
            : '';
      const recorder = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream);
      recorderRef.current = recorder;
      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = handleStop;
      recorder.start();
      startedAtRef.current = Date.now();
      setState('recording');
      setSeconds(0);
      timerRef.current = setInterval(() => {
        const s = Math.round((Date.now() - startedAtRef.current) / 1000);
        setSeconds(s);
        if (s >= maxSeconds) stop();
      }, 250);
    } catch (e) {
      onError?.(e instanceof Error && e.name === 'NotAllowedError' ? 'Нет доступа к микрофону' : 'Не удалось запустить запись');
      stopTracks();
    }
  }

  function stop() {
    const r = recorderRef.current;
    if (!r) return;
    if (r.state !== 'inactive') r.stop();
  }

  async function handleStop() {
    stopTracks();
    setState('sending');
    try {
      const blob = new Blob(chunksRef.current, { type: recorderRef.current?.mimeType ?? 'audio/webm' });
      if (blob.size < 500) {
        onError?.('Запись слишком короткая');
        setState('idle');
        setSeconds(0);
        return;
      }
      const form = new FormData();
      form.append('audio', blob, 'feedback.webm');
      form.append('source', source);
      const res = await fetch('/api/feedback/voice', { method: 'POST', body: form });
      const data = (await res.json().catch(() => ({}))) as { transcript?: string; error?: string };
      if (!res.ok) {
        onError?.(data.error === 'transcription_unavailable' ? 'AI сейчас недоступен, попробуйте позже' : 'Не удалось сохранить');
        setState('idle');
        setSeconds(0);
        return;
      }
      onSent(data.transcript ?? '');
      setState('idle');
      setSeconds(0);
    } catch {
      onError?.('Сбой отправки');
      setState('idle');
      setSeconds(0);
    }
  }

  const mm = String(Math.floor(seconds / 60)).padStart(2, '0');
  const ss = String(seconds % 60).padStart(2, '0');

  if (state === 'sending') {
    return (
      <button
        type="button"
        disabled
        className="flex w-full items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] py-3.5 text-[14px] font-semibold text-white/70"
      >
        <Loader2 className="size-4 animate-spin" />
        Расшифровываю…
      </button>
    );
  }

  if (state === 'recording') {
    return (
      <button
        type="button"
        onClick={stop}
        className="flex w-full items-center justify-center gap-3 rounded-2xl border border-rose-400/30 bg-rose-500/15 py-3.5 text-[14px] font-semibold text-rose-100 active:bg-rose-500/20 transition-colors"
      >
        <span className="relative flex size-3 items-center justify-center">
          <span className="absolute size-3 animate-ping rounded-full bg-rose-400/60" />
          <span className="relative size-2.5 rounded-full bg-rose-400" />
        </span>
        <span className="tabular-nums">{mm}:{ss}</span>
        <Square className="size-4 fill-current" />
        <span className="text-[12px] font-medium opacity-70">Нажмите чтобы остановить</span>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={start}
      className="flex w-full items-center justify-center gap-2 rounded-2xl border border-violet-400/30 bg-violet-500/10 py-3.5 text-[14px] font-semibold text-violet-100 active:bg-violet-500/20 transition-colors"
    >
      <Mic className="size-4" />
      Записать голосом
    </button>
  );
}
