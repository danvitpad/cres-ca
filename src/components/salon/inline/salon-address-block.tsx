/** --- YAML
 * name: SalonInlineAddressBlock
 * description: Адрес салона + карта (Nominatim) с inline-редактированием.
 *              Mirror master InlineAddressBlock — сохраняет в salons.city + salons.address.
 * created: 2026-04-26
 * --- */

'use client';

import { useState } from 'react';
import { MapPin, Pencil, Plus, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';
import { AddressMiniMap } from '@/components/shared/address-mini-map';
import { useIsSalonOwner } from './use-is-salon-owner';
import { InlineEditSheet } from '@/components/master/inline/inline-edit-sheet';
import { cleanAddress, composeAddress } from '@/lib/format/address';

interface Props {
  salonId: string;
  salonOwnerId: string;
  salonName: string;
  initialCity: string | null;
  initialAddress: string | null;
}

export function SalonInlineAddressBlock({
  salonId,
  salonOwnerId,
  salonName,
  initialCity,
  initialAddress,
}: Props) {
  const isOwner = useIsSalonOwner(salonOwnerId);
  const [city, setCity] = useState(initialCity ?? '');
  const [address, setAddress] = useState(initialAddress ?? '');
  const [open, setOpen] = useState(false);
  const [draftCity, setDraftCity] = useState(city);
  const [draftAddress, setDraftAddress] = useState(address);
  const [saving, setSaving] = useState(false);

  const hasAny = !!(city.trim() || address.trim());

  function startEdit() {
    setDraftCity(city);
    setDraftAddress(address);
    setOpen(true);
  }

  async function save() {
    setSaving(true);
    try {
      const supabase = createClient();
      const nextCity = draftCity.trim() || null;
      const nextAddress = draftAddress.trim() || null;
      const { error } = await supabase
        .from('salons')
        .update({ city: nextCity, address: nextAddress })
        .eq('id', salonId);
      if (error) {
        toast.error(error.message || 'Не удалось сохранить');
        return;
      }
      setCity(nextCity ?? '');
      setAddress(nextAddress ?? '');
      toast.success('Адрес сохранён');
      setOpen(false);
    } finally {
      setSaving(false);
    }
  }

  const cleanedStreet = cleanAddress(address);
  const displayAddress = composeAddress(salonName, address, city);
  const queryStr = [cleanedStreet, city].filter(Boolean).join(', ') || city || '';

  const sheet = (
    <InlineEditSheet
      open={open}
      onClose={() => setOpen(false)}
      title="Где находится салон"
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
        Куда клиенту приходить. Карта зумится автоматически на адрес.
      </p>
      <div className="space-y-3">
        <div>
          <label className="mb-1.5 block text-[12px] font-semibold uppercase tracking-wide text-neutral-500">Город</label>
          <input
            type="text"
            value={draftCity}
            onChange={(e) => setDraftCity(e.target.value)}
            placeholder="Например: Київ"
            className="block w-full rounded-2xl border border-neutral-200 bg-white px-4 py-3 text-[14px] text-neutral-900 focus:border-neutral-400 focus:outline-none"
          />
        </div>
        <div>
          <label className="mb-1.5 block text-[12px] font-semibold uppercase tracking-wide text-neutral-500">Улица и дом</label>
          <input
            type="text"
            value={draftAddress}
            onChange={(e) => setDraftAddress(e.target.value)}
            placeholder="Например: вул. Європейська, 27"
            className="block w-full rounded-2xl border border-neutral-200 bg-white px-4 py-3 text-[14px] text-neutral-900 focus:border-neutral-400 focus:outline-none"
          />
          <p className="mt-1 text-[11px] text-neutral-400">Можно оставить пустым — тогда клиент увидит только город.</p>
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
          className="group flex w-full items-center gap-3 rounded-2xl border-2 border-dashed border-neutral-300 bg-white p-5 text-left transition-colors hover:border-neutral-900 hover:bg-neutral-50"
        >
          <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-neutral-100 text-neutral-700 group-hover:bg-neutral-900 group-hover:text-white">
            <Plus className="size-5" />
          </span>
          <span className="flex-1">
            <span className="block text-[15px] font-bold text-neutral-900">Где находится салон?</span>
            <span className="mt-1 block text-[13px] text-neutral-500">
              Адрес или хотя бы город — клиенту нужно знать куда приходить.
            </span>
          </span>
        </button>
        {sheet}
      </>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-neutral-200 bg-white">
      {queryStr && <AddressMiniMap query={queryStr} className="h-48 w-full" />}
      <div className="flex items-start gap-3 p-5">
        <div className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg bg-neutral-100 text-neutral-700">
          <MapPin className="size-4" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <p className="text-[14px] font-semibold text-neutral-900">{salonName}</p>
            {isOwner && (
              <button
                type="button"
                onClick={startEdit}
                className="flex size-8 shrink-0 items-center justify-center rounded-full text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900"
                aria-label="Редактировать адрес"
                title="Редактировать адрес"
              >
                <Pencil className="size-3.5" />
              </button>
            )}
          </div>
          {displayAddress && (
            <p className="mt-0.5 text-[14px] text-neutral-600">{displayAddress}</p>
          )}
          {queryStr && (
            <a
              href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(queryStr)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 inline-flex items-center gap-1 text-[12px] font-semibold text-neutral-900 hover:underline"
            >
              Проложить маршрут →
            </a>
          )}
        </div>
      </div>
      {sheet}
    </div>
  );
}
