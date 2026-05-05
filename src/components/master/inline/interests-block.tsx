/** --- YAML
 * name: InlineInterestsBlock
 * description: Блок «Интересы и увлечения» с inline-редактированием.
 *              Хранится в masters.interests (text[]). Клиент видит чипы.
 *              Владелец — pencil → bottom-sheet с тегами (chip-input стиль).
 *              Если пусто — клиент не видит блок, владелец видит CTA.
 * created: 2026-05-02
 * --- */

'use client';

import { useState } from 'react';
import { Pencil, Plus, Loader2, X } from 'lucide-react';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';
import { useIsOwner } from './use-is-owner';
import { InlineEditSheet } from './inline-edit-sheet';

interface Props {
  masterId: string;
  masterProfileId: string | null;
  initialInterests: string[] | null;
}

const MAX_INTERESTS = 10;
const MAX_LEN = 32;

export function InlineInterestsBlock({ masterId, masterProfileId, initialInterests }: Props) {
  const isOwner = useIsOwner(masterProfileId);
  const [interests, setInterests] = useState<string[]>(initialInterests ?? []);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<string[]>(initialInterests ?? []);
  const [input, setInput] = useState('');
  const [saving, setSaving] = useState(false);

  const hasAny = interests.length > 0;

  function startEdit() {
    setDraft([...interests]);
    setInput('');
    setOpen(true);
  }

  function addInterest() {
    const v = input.trim();
    if (!v) return;
    if (draft.includes(v)) {
      setInput('');
      return;
    }
    if (draft.length >= MAX_INTERESTS) {
      toast.error(`Не больше ${MAX_INTERESTS} интересов`);
      return;
    }
    setDraft([...draft, v.slice(0, MAX_LEN)]);
    setInput('');
  }

  function removeInterest(i: number) {
    setDraft(draft.filter((_, idx) => idx !== i));
  }

  async function save() {
    setSaving(true);
    try {
      const supabase = createClient();
      const cleaned = draft.map((s) => s.trim()).filter(Boolean);
      const { error } = await supabase
        .from('masters')
        .update({ interests: cleaned.length ? cleaned : null })
        .eq('id', masterId);
      if (error) {
        toast.error(error.message || 'Не удалось сохранить');
        return;
      }
      setInterests(cleaned);
      toast.success('Сохранено');
      setOpen(false);
    } finally {
      setSaving(false);
    }
  }

  if (!hasAny && !isOwner) return null;

  if (!hasAny && isOwner) {
    return (
      <>
        <button
          type="button"
          onClick={startEdit}
          className="group flex w-full items-start gap-4 rounded-2xl p-5 text-left transition-colors"
          style={{
            background: 'var(--m-accent-soft)',
            border: '1.5px solid color-mix(in oklab, var(--m-accent) 30%, transparent)',
          }}
        >
          <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-neutral-100 text-neutral-700 group-hover:bg-neutral-900 group-hover:text-white">
            <Plus className="size-5" />
          </span>
          <span className="flex-1">
            <span className="block text-[15px] font-bold text-neutral-900">Расскажи об интересах</span>
            <span className="mt-1 block text-[13px] text-neutral-500">
              Что любишь кроме работы — путешествия, спорт, кофе. Помогает клиенту почувствовать тебя как человека.
            </span>
          </span>
        </button>
        <InterestsSheet
          open={open}
          onClose={() => setOpen(false)}
          draft={draft}
          input={input}
          setInput={setInput}
          onAdd={addInterest}
          onRemove={removeInterest}
          onSave={save}
          saving={saving}
        />
      </>
    );
  }

  return (
    <section>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-[22px] font-bold text-neutral-900">Интересы</h2>
        {isOwner && (
          <button
            type="button"
            onClick={startEdit}
            className="flex size-9 items-center justify-center rounded-full text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-neutral-900"
            aria-label="Редактировать интересы"
            title="Редактировать интересы"
          >
            <Pencil className="size-4" />
          </button>
        )}
      </div>
      <div className="flex flex-wrap gap-2">
        {interests.map((tag) => (
          <span
            key={tag}
            className="inline-flex items-center rounded-full border border-neutral-200 bg-white px-3 py-1 text-[13px] text-neutral-700"
          >
            {tag}
          </span>
        ))}
      </div>
      <InterestsSheet
        open={open}
        onClose={() => setOpen(false)}
        draft={draft}
        input={input}
        setInput={setInput}
        onAdd={addInterest}
        onRemove={removeInterest}
        onSave={save}
        saving={saving}
      />
    </section>
  );
}

function InterestsSheet({
  open, onClose, draft, input, setInput, onAdd, onRemove, onSave, saving,
}: {
  open: boolean;
  onClose: () => void;
  draft: string[];
  input: string;
  setInput: (s: string) => void;
  onAdd: () => void;
  onRemove: (i: number) => void;
  onSave: () => void;
  saving: boolean;
}) {
  return (
    <InlineEditSheet
      open={open}
      onClose={onClose}
      title="Интересы и увлечения"
      footer={
        <div className="flex items-center justify-between gap-3">
          <p className="text-[12px] text-neutral-500">{draft.length} / {MAX_INTERESTS}</p>
          <div className="flex gap-2">
            <button type="button" onClick={onClose} className="cres-popup-btn-cancel">
              Отмена
            </button>
            <button type="button" onClick={onSave} disabled={saving} className="cres-popup-btn-save">
              {saving && <Loader2 className="size-3.5 animate-spin" />}
              Сохранить
            </button>
          </div>
        </div>
      }
    >
      <p className="mb-3 text-[13px] text-neutral-500">
        Добавь до {MAX_INTERESTS} интересов. Например: «йога», «путешествия», «кофе».
      </p>
      <div className="flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value.slice(0, MAX_LEN))}
          onKeyDown={(e) => {
            if (e.key === 'Enter') { e.preventDefault(); onAdd(); }
          }}
          placeholder="Введите и нажмите ↵"
          className="flex-1 rounded-xl border border-neutral-200 bg-white px-3 py-2 text-[14px] outline-none focus:border-neutral-400"
        />
        <button
          type="button"
          onClick={onAdd}
          disabled={!input.trim() || draft.length >= MAX_INTERESTS}
          className="rounded-xl bg-neutral-900 px-4 text-[13px] font-semibold text-white disabled:opacity-40"
        >
          + Добавить
        </button>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {draft.map((tag, i) => (
          <span
            key={`${tag}-${i}`}
            className="inline-flex items-center gap-1.5 rounded-full border border-neutral-200 bg-white px-3 py-1 text-[13px] text-neutral-700"
          >
            {tag}
            <button
              type="button"
              onClick={() => onRemove(i)}
              className="text-neutral-400 hover:text-rose-500"
              aria-label={`Убрать ${tag}`}
            >
              <X className="size-3.5" />
            </button>
          </span>
        ))}
      </div>
    </InlineEditSheet>
  );
}
