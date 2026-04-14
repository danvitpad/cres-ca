/** --- YAML
 * name: Consent Form Signing Page
 * description: Публичная страница подписи договора клиентом по токену. Показывает текст, чекбокс согласия и canvas для подписи пальцем. Отправляет signature_data + client_agreed=true.
 * created: 2026-04-13
 * updated: 2026-04-13
 * --- */

'use client';

import { useEffect, useRef, useState, use } from 'react';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';

interface FormRow {
  id: string;
  title: string | null;
  form_text: string | null;
  client_agreed: boolean;
  agreed_at: string | null;
}

export default function ConsentSignPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const [form, setForm] = useState<FormRow | null>(null);
  const [agreed, setAgreed] = useState(false);
  const [sending, setSending] = useState(false);
  const [signed, setSigned] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawingRef = useRef(false);

  useEffect(() => {
    const supabase = createClient();
    supabase
      .from('consent_forms')
      .select('id, title, form_text, client_agreed, agreed_at')
      .eq('sign_token', token)
      .maybeSingle()
      .then(({ data }) => {
        if (!data) return;
        setForm(data as FormRow);
        if (data.client_agreed) setSigned(true);
      });
  }, [token]);

  function start(e: React.PointerEvent<HTMLCanvasElement>) {
    const c = canvasRef.current;
    if (!c) return;
    drawingRef.current = true;
    const rect = c.getBoundingClientRect();
    const ctx = c.getContext('2d');
    ctx?.beginPath();
    ctx?.moveTo(e.clientX - rect.left, e.clientY - rect.top);
  }
  function move(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawingRef.current) return;
    const c = canvasRef.current;
    if (!c) return;
    const rect = c.getBoundingClientRect();
    const ctx = c.getContext('2d');
    if (!ctx) return;
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#111';
    ctx.lineTo(e.clientX - rect.left, e.clientY - rect.top);
    ctx.stroke();
  }
  function end() {
    drawingRef.current = false;
  }
  function clearSig() {
    const c = canvasRef.current;
    c?.getContext('2d')?.clearRect(0, 0, c.width, c.height);
  }

  async function submit() {
    if (!agreed) {
      toast.error('Потрібна згода');
      return;
    }
    const c = canvasRef.current;
    if (!c) return;
    const signature = c.toDataURL('image/png');
    setSending(true);
    const res = await fetch('/api/consent/sign', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ token, signature }),
    });
    setSending(false);
    if (!res.ok) {
      toast.error('Помилка');
      return;
    }
    toast.success('Підписано');
    setSigned(true);
  }

  if (!form) {
    return <div className="mx-auto max-w-2xl p-6 text-sm text-muted-foreground">Завантаження…</div>;
  }

  if (signed) {
    return (
      <div className="mx-auto max-w-2xl space-y-4 p-6 text-center">
        <div className="text-5xl">✅</div>
        <h1 className="text-2xl font-semibold">Підписано</h1>
        <p className="text-sm text-muted-foreground">
          Дякуємо! Ваша згода зафіксована{form.agreed_at ? ` ${new Date(form.agreed_at).toLocaleString()}` : ''}.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-5 p-6">
      <h1 className="text-2xl font-semibold">{form.title ?? 'Договір згоди'}</h1>
      <div className="max-h-72 overflow-y-auto rounded-lg border bg-card p-4 text-sm whitespace-pre-wrap">
        {form.form_text}
      </div>

      <label className="flex items-start gap-2 text-sm">
        <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} className="mt-1" />
        <span>Я прочитав(ла) договір та погоджуюсь з його умовами.</span>
      </label>

      <div>
        <div className="mb-1 text-xs text-muted-foreground">Підпис (проведіть пальцем або мишею):</div>
        <canvas
          ref={canvasRef}
          width={600}
          height={180}
          className="w-full touch-none rounded-lg border bg-white"
          onPointerDown={start}
          onPointerMove={move}
          onPointerUp={end}
          onPointerLeave={end}
        />
        <button onClick={clearSig} className="mt-1 text-xs text-muted-foreground underline">
          Очистити
        </button>
      </div>

      <button
        disabled={!agreed || sending}
        onClick={submit}
        className="w-full rounded-md bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground disabled:opacity-50"
      >
        {sending ? 'Відправка…' : 'Підписати'}
      </button>
    </div>
  );
}
