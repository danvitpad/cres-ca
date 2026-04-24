/** --- YAML
 * name: Verification request page
 * description: Master uploads identity (doc + selfie) or expertise (cert) photos for superadmin review.
 * created: 2026-04-24
 * --- */

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { Upload, ShieldCheck, Award, Loader2, Check, CircleAlert, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

type Kind = 'identity' | 'expertise';

export default function VerificationPage() {
  const router = useRouter();
  const [kind, setKind] = useState<Kind>('identity');
  const [document, setDocument] = useState<File | null>(null);
  const [selfie, setSelfie] = useState<File | null>(null);
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  const submit = async () => {
    if (!document) {
      toast.error(kind === 'identity' ? 'Добавьте фото паспорта / ID' : 'Добавьте фото сертификата');
      return;
    }
    if (kind === 'identity' && !selfie) {
      toast.error('Для проверки личности нужно селфи с документом');
      return;
    }
    setSubmitting(true);
    try {
      const form = new FormData();
      form.append('kind', kind);
      form.append('document', document);
      if (selfie) form.append('selfie', selfie);
      if (note.trim()) form.append('note', note.trim());
      const res = await fetch('/api/verification/submit', { method: 'POST', body: form });
      if (res.ok) {
        setDone(true);
        toast.success('Заявка отправлена');
      } else {
        const j = await res.json().catch(() => ({}));
        toast.error(j.error ?? 'Ошибка');
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (done) {
    return (
      <div className="mx-auto max-w-2xl space-y-6 p-6">
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-3xl border border-emerald-500/20 bg-emerald-500/5 p-10 text-center"
        >
          <div className="mx-auto mb-4 flex size-16 items-center justify-center rounded-full bg-emerald-500/10">
            <Check className="size-8 text-emerald-600" />
          </div>
          <h1 className="text-xl font-bold">Заявка отправлена</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Модератор проверит за 1–2 дня. Результат придёт сюда и в Telegram.
          </p>
          <button
            onClick={() => {
              setDone(false);
              setDocument(null);
              setSelfie(null);
              setNote('');
            }}
            className="mt-6 rounded-full border border-border bg-background px-4 py-2 text-sm font-medium hover:bg-muted"
          >
            Подать ещё одну
          </button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6 p-6 pb-12">
      <Link href="/settings" className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-3.5" />
        Настройки
      </Link>

      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
          <ShieldCheck className="size-6 text-primary" />
          Верификация
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Подтверждённые мастера выше в поиске, вызывают больше доверия у клиентов и получают синюю галочку в профиле.
        </p>
      </div>

      {/* Kind toggle */}
      <div className="grid grid-cols-2 gap-2 rounded-2xl border border-border bg-card p-1.5">
        <button
          onClick={() => setKind('identity')}
          className={`flex items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${
            kind === 'identity' ? 'bg-sky-500/15 text-sky-400' : 'text-muted-foreground hover:bg-muted'
          }`}
        >
          <ShieldCheck className="size-4" />
          Личность
        </button>
        <button
          onClick={() => setKind('expertise')}
          className={`flex items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${
            kind === 'expertise' ? 'bg-amber-500/15 text-amber-500' : 'text-muted-foreground hover:bg-muted'
          }`}
        >
          <Award className="size-4" />
          Сертификация
        </button>
      </div>

      <div className="rounded-2xl border border-border bg-card p-5 space-y-4">
        {kind === 'identity' ? (
          <>
            <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-3 text-[12px] text-amber-700 dark:text-amber-300">
              <CircleAlert className="inline size-3.5 mr-1" />
              Фото паспорта / ID-карты + селфи, где ты держишь этот документ рядом с лицом. Модератор сверит и одобрит за 1-2 дня.
            </div>
            <FileField label="Фото документа" file={document} onChange={setDocument} />
            <FileField label="Селфи с документом" file={selfie} onChange={setSelfie} />
          </>
        ) : (
          <>
            <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-3 text-[12px] text-amber-700 dark:text-amber-300">
              <CircleAlert className="inline size-3.5 mr-1" />
              Фото сертификата / диплома. Желательно с читаемой серией, номером и твоим ФИО.
            </div>
            <FileField label="Фото сертификата" file={document} onChange={setDocument} />
          </>
        )}

        <div>
          <label className="text-sm font-medium">Заметка (опционально)</label>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value.slice(0, 500))}
            placeholder="Если есть что пояснить модератору — напиши"
            rows={3}
            className="mt-1.5 w-full resize-none rounded-xl border border-border bg-background p-3 text-sm outline-none focus:border-primary"
          />
        </div>

        <button
          onClick={submit}
          disabled={submitting}
          className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground disabled:opacity-60"
        >
          {submitting ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
          {submitting ? 'Отправка…' : 'Отправить на проверку'}
        </button>
      </div>
    </div>
  );
}

function FileField({ label, file, onChange }: { label: string; file: File | null; onChange: (f: File | null) => void }) {
  return (
    <div>
      <label className="text-sm font-medium">{label}</label>
      <div className="mt-1.5">
        <label className="relative flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-border bg-background p-4 text-sm text-muted-foreground hover:border-primary/40">
          <Upload className="size-4" />
          {file ? (
            <span className="truncate text-foreground">{file.name} · {(file.size / 1024).toFixed(0)} KB</span>
          ) : (
            <span>Выбрать файл (JPG/PNG, до 8 MB)</span>
          )}
          <input
            type="file"
            accept="image/*"
            className="absolute inset-0 cursor-pointer opacity-0"
            onChange={(e) => onChange(e.target.files?.[0] ?? null)}
          />
        </label>
      </div>
    </div>
  );
}
