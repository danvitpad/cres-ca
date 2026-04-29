/** --- YAML
 * name: SalonInlineContactsBlock
 * description: Блок контактов салона (phone + email) — inline-editable.
 *              Client view: clickable tel:/mailto: links, hidden если оба пусты.
 *              Owner view: pencil + dashed CTA если ни один не заполнен.
 *              Сохраняет в salons.phone + salons.email.
 *              Используется внутри SalonHeroCard как замена статичного блока контактов.
 * created: 2026-04-26
 * --- */

'use client';

import { useState } from 'react';
import { Phone, Mail, Pencil, Plus, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';
import { useIsSalonOwner } from './use-is-salon-owner';
import { InlineEditSheet } from '@/components/master/inline/inline-edit-sheet';

interface Props {
  salonId: string;
  salonOwnerId: string;
  initialPhone: string | null;
  initialEmail: string | null;
}

export function SalonInlineContactsBlock({ salonId, salonOwnerId, initialPhone, initialEmail }: Props) {
  const isOwner = useIsSalonOwner(salonOwnerId);
  const [phone, setPhone] = useState(initialPhone ?? '');
  const [email, setEmail] = useState(initialEmail ?? '');
  const [open, setOpen] = useState(false);
  const [draftPhone, setDraftPhone] = useState(phone);
  const [draftEmail, setDraftEmail] = useState(email);
  const [saving, setSaving] = useState(false);

  const hasAny = !!(phone.trim() || email.trim());

  function startEdit() {
    setDraftPhone(phone);
    setDraftEmail(email);
    setOpen(true);
  }

  async function save() {
    setSaving(true);
    try {
      const supabase = createClient();
      const nextPhone = draftPhone.trim() || null;
      const nextEmail = draftEmail.trim() || null;
      const { error } = await supabase
        .from('salons')
        .update({ phone: nextPhone, email: nextEmail })
        .eq('id', salonId);
      if (error) {
        toast.error(error.message || 'Не удалось сохранить');
        return;
      }
      setPhone(nextPhone ?? '');
      setEmail(nextEmail ?? '');
      toast.success('Контакты сохранены');
      setOpen(false);
    } finally {
      setSaving(false);
    }
  }

  const sheet = (
    <InlineEditSheet
      open={open}
      onClose={() => setOpen(false)}
      title="Контакты салона"
      footer={
        <div className="flex justify-end gap-2">
          <button type="button" onClick={() => setOpen(false)} className="rounded-[var(--brand-radius-lg)] border border-neutral-200 px-5 py-2 text-[13px] font-semibold text-neutral-700 hover:bg-neutral-50">
            Отмена
          </button>
          <button type="button" onClick={save} disabled={saving} className="inline-flex items-center gap-1.5 rounded-[var(--brand-radius-lg)] bg-neutral-900 px-5 py-2 text-[13px] font-semibold text-white disabled:opacity-50">
            {saving && <Loader2 className="size-3.5 animate-spin" />}
            Сохранить
          </button>
        </div>
      }
    >
      <p className="mb-4 text-[13px] text-neutral-500">
        Телефон и email для клиентов. Покажутся на публичной странице — клиент сможет позвонить или написать в один клик.
      </p>
      <div className="space-y-3">
        <div>
          <label className="mb-1.5 block text-[12px] font-semibold uppercase tracking-wide text-neutral-500">Телефон</label>
          <input
            type="tel"
            value={draftPhone}
            onChange={(e) => setDraftPhone(e.target.value)}
            placeholder="+380 67 123 4567"
            className="block w-full rounded-2xl border border-neutral-200 bg-white px-4 py-3 text-[14px] text-neutral-900 focus:border-neutral-400 focus:outline-none"
          />
        </div>
        <div>
          <label className="mb-1.5 block text-[12px] font-semibold uppercase tracking-wide text-neutral-500">Email</label>
          <input
            type="email"
            value={draftEmail}
            onChange={(e) => setDraftEmail(e.target.value)}
            placeholder="contact@salon.com"
            className="block w-full rounded-2xl border border-neutral-200 bg-white px-4 py-3 text-[14px] text-neutral-900 focus:border-neutral-400 focus:outline-none"
          />
          <p className="mt-1 text-[11px] text-neutral-400">Не обязательно — клиенту достаточно одного канала связи.</p>
        </div>
      </div>
    </InlineEditSheet>
  );

  if (!hasAny && !isOwner) return null;

  if (!hasAny && isOwner) {
    return (
      <>
        <button
          type="button"
          onClick={startEdit}
          className="group flex w-full items-center gap-3 rounded-2xl border-2 border-dashed border-neutral-300 bg-white p-4 text-left transition-colors hover:border-neutral-900 hover:bg-neutral-50"
        >
          <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-neutral-100 text-neutral-700 group-hover:bg-neutral-900 group-hover:text-white">
            <Plus className="size-4" />
          </span>
          <span className="flex-1">
            <span className="block text-[14px] font-bold text-neutral-900">Добавь контакты</span>
            <span className="mt-0.5 block text-[12px] text-neutral-500">Телефон или email — клиент будет знать как с тобой связаться.</span>
          </span>
        </button>
        {sheet}
      </>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <p className="text-[12px] font-semibold uppercase tracking-wide text-neutral-500">Связаться</p>
        {isOwner && (
          <button
            type="button"
            onClick={startEdit}
            className="flex size-7 items-center justify-center rounded-full text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900"
            aria-label="Редактировать контакты"
            title="Редактировать контакты"
          >
            <Pencil className="size-3.5" />
          </button>
        )}
      </div>
      <div className="mt-2 space-y-1.5">
        {phone && (
          <a
            href={`tel:${phone}`}
            className="inline-flex items-center gap-2 text-[14px] text-neutral-900 hover:underline"
          >
            <Phone className="size-3.5 text-neutral-500" />
            {phone}
          </a>
        )}
        {email && (
          <a
            href={`mailto:${email}`}
            className="block truncate text-[14px] text-neutral-900 hover:underline"
          >
            <Mail className="mr-2 inline size-3.5 text-neutral-500" />
            {email}
          </a>
        )}
      </div>
      {sheet}
    </div>
  );
}
