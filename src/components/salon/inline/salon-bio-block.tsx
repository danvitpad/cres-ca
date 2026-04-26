/** --- YAML
 * name: SalonInlineBioBlock
 * description: Блок «О салоне» с inline-редактированием для admin/owner. Mirror'ит
 *              master InlineBioBlock — pencil top-right, dashed CTA если пусто.
 *              Сохранение в salons.bio.
 * created: 2026-04-26
 * --- */

'use client';

import { useState } from 'react';
import { Pencil, Plus, Loader2, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';
import { useIsSalonOwner } from './use-is-salon-owner';
import { InlineEditSheet } from '@/components/master/inline/inline-edit-sheet';

interface Props {
  salonId: string;
  salonOwnerId: string;
  initialBio: string | null;
}

export function SalonInlineBioBlock({ salonId, salonOwnerId, initialBio }: Props) {
  const isOwner = useIsSalonOwner(salonOwnerId);
  const [bio, setBio] = useState(initialBio ?? '');
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(bio);
  const [saving, setSaving] = useState(false);

  const hasBio = bio.trim().length > 0;

  function startEdit() {
    setDraft(bio);
    setOpen(true);
  }

  async function save() {
    setSaving(true);
    try {
      const supabase = createClient();
      const next = draft.trim();
      const { error } = await supabase
        .from('salons')
        .update({ bio: next || null })
        .eq('id', salonId);
      if (error) {
        toast.error(error.message || 'Не удалось сохранить');
        return;
      }
      setBio(next);
      toast.success('Сохранено');
      setOpen(false);
    } finally {
      setSaving(false);
    }
  }

  if (!hasBio && !isOwner) return null;

  if (!hasBio && isOwner) {
    return (
      <>
        <button
          type="button"
          onClick={startEdit}
          className="group flex w-full items-start gap-4 rounded-2xl border-2 border-dashed border-neutral-300 bg-white p-5 text-left transition-colors hover:border-neutral-900 hover:bg-neutral-50"
        >
          <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-neutral-100 text-neutral-700 group-hover:bg-neutral-900 group-hover:text-white">
            <Plus className="size-5" />
          </span>
          <span className="flex-1">
            <span className="block text-[15px] font-bold text-neutral-900">Добавь описание салона</span>
            <span className="mt-1 block text-[13px] text-neutral-500">
              История, философия, атмосфера. Что отличает вашу команду.
            </span>
          </span>
        </button>
        <BioSheet open={open} onClose={() => setOpen(false)} draft={draft} onChange={setDraft} onSave={save} saving={saving} />
      </>
    );
  }

  return (
    <section id="salon-bio">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-[22px] font-bold text-neutral-900">О салоне</h2>
        {isOwner && (
          <button
            type="button"
            onClick={startEdit}
            className="flex size-9 items-center justify-center rounded-full text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-neutral-900"
            aria-label="Редактировать описание"
            title="Редактировать описание"
          >
            <Pencil className="size-4" />
          </button>
        )}
      </div>
      <p className="whitespace-pre-line text-[15px] leading-relaxed text-neutral-700">{bio}</p>
      <BioSheet open={open} onClose={() => setOpen(false)} draft={draft} onChange={setDraft} onSave={save} saving={saving} />
    </section>
  );
}

function BioSheet({
  open, onClose, draft, onChange, onSave, saving,
}: {
  open: boolean;
  onClose: () => void;
  draft: string;
  onChange: (s: string) => void;
  onSave: () => void;
  saving: boolean;
}) {
  return (
    <InlineEditSheet
      open={open}
      onClose={onClose}
      title="О салоне"
      footer={
        <div className="flex items-center justify-between gap-3">
          <p className="text-[12px] text-neutral-500">{draft.length} / 600</p>
          <div className="flex gap-2">
            <button type="button" onClick={onClose} className="rounded-full border border-neutral-200 px-5 py-2 text-[13px] font-semibold text-neutral-700 hover:bg-neutral-50">
              Отмена
            </button>
            <button type="button" onClick={onSave} disabled={saving} className="inline-flex items-center gap-1.5 rounded-full bg-neutral-900 px-5 py-2 text-[13px] font-semibold text-white disabled:opacity-50">
              {saving && <Loader2 className="size-3.5 animate-spin" />}
              Сохранить
            </button>
          </div>
        </div>
      }
    >
      <p className="mb-3 inline-flex items-center gap-1.5 text-[12px] text-neutral-500">
        <Sparkles className="size-3.5 text-violet-500" />
        Расскажи коротко: атмосфера, специализация, что важно вашей команде.
      </p>
      <textarea
        value={draft}
        onChange={(e) => onChange(e.target.value.slice(0, 600))}
        rows={6}
        autoFocus
        placeholder="Например: «Команда из 5 мастеров в центре города. Используем только премиальные материалы, работаем без спешки.»"
        className="block w-full resize-none rounded-2xl border border-neutral-200 bg-white p-4 text-[14px] leading-relaxed text-neutral-900 outline-none focus:border-neutral-400"
      />
    </InlineEditSheet>
  );
}
