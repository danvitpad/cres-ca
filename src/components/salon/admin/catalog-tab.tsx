/** --- YAML
 * name: SalonCatalogTab
 * description: Admin tab «Каталог» — управление едиными услугами салона
 *              (используется когда team_mode='unified'). Список услуг,
 *              кнопка «Добавить услугу», inline edit, мягкое удаление.
 *              Услуги видны всем мастерам команды и используются в booking
 *              drawer на /s/[salon_id].
 * created: 2026-04-27
 * --- */

'use client';

import { useEffect, useState } from 'react';
import { Plus, Pencil, Trash2, Loader2, Save, X, BookOpen, Power } from 'lucide-react';
import { toast } from 'sonner';

interface SalonService {
  id: string;
  name: string;
  description: string | null;
  duration_minutes: number | null;
  price: number | null;
  currency: string;
  category_id: string | null;
  is_active: boolean;
  sort_order: number;
  category?: { id: string; name: string } | { id: string; name: string }[] | null;
}

interface Props {
  salonId: string;
}

export function SalonCatalogTab({ salonId }: Props) {
  const [services, setServices] = useState<SalonService[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      const r = await fetch(`/api/salon/${salonId}/catalog`);
      if (r.ok) {
        const j = (await r.json()) as { services: SalonService[] };
        setServices(j.services);
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [salonId]); // eslint-disable-line react-hooks/exhaustive-deps

  async function softDelete(id: string) {
    if (!confirm('Убрать эту услугу из каталога?')) return;
    const r = await fetch(`/api/salon/${salonId}/catalog/${id}`, { method: 'DELETE' });
    if (!r.ok) {
      toast.error('Не удалось удалить');
      return;
    }
    toast.success('Услуга убрана из каталога');
    load();
  }

  async function toggleActive(svc: SalonService) {
    const r = await fetch(`/api/salon/${salonId}/catalog/${svc.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_active: !svc.is_active }),
    });
    if (!r.ok) {
      toast.error('Не удалось обновить');
      return;
    }
    load();
  }

  if (loading) {
    return (
      <div className="space-y-3">
        <div className="h-12 animate-pulse rounded-xl bg-neutral-100" />
        <div className="h-12 animate-pulse rounded-xl bg-neutral-100" />
      </div>
    );
  }

  const active = services.filter((s) => s.is_active);
  const archived = services.filter((s) => !s.is_active);

  return (
    <div className="space-y-5">
      {!adding ? (
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-neutral-300 bg-white p-4 text-[14px] font-semibold text-neutral-700 hover:border-neutral-900 hover:bg-neutral-50"
        >
          <Plus className="size-4" />
          Добавить услугу в каталог
        </button>
      ) : (
        <ServiceForm
          salonId={salonId}
          mode="create"
          onCancel={() => setAdding(false)}
          onSaved={() => {
            setAdding(false);
            load();
          }}
        />
      )}

      {services.length === 0 && !adding && (
        <div className="rounded-xl border border-dashed border-neutral-300 p-5 text-center text-[12px] text-neutral-500">
          Каталог пуст. Добавь первую услугу — она появится на публичной странице салона
          и будет доступна всем мастерам команды.
        </div>
      )}

      {active.length > 0 && (
        <section>
          <h2 className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-neutral-500">
            <BookOpen className="size-3.5" /> Активные ({active.length})
          </h2>
          <ul className="space-y-2">
            {active.map((s) =>
              editingId === s.id ? (
                <ServiceForm
                  key={s.id}
                  salonId={salonId}
                  mode="edit"
                  initial={s}
                  onCancel={() => setEditingId(null)}
                  onSaved={() => {
                    setEditingId(null);
                    load();
                  }}
                />
              ) : (
                <ServiceRow
                  key={s.id}
                  svc={s}
                  onEdit={() => setEditingId(s.id)}
                  onToggle={() => toggleActive(s)}
                  onDelete={() => softDelete(s.id)}
                />
              )
            )}
          </ul>
        </section>
      )}

      {archived.length > 0 && (
        <section>
          <h2 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-neutral-500">
            Архив ({archived.length})
          </h2>
          <ul className="space-y-2">
            {archived.map((s) => (
              <ServiceRow
                key={s.id}
                svc={s}
                onEdit={() => setEditingId(s.id)}
                onToggle={() => toggleActive(s)}
                onDelete={() => softDelete(s.id)}
              />
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function ServiceRow({
  svc, onEdit, onToggle, onDelete,
}: {
  svc: SalonService;
  onEdit: () => void;
  onToggle: () => void;
  onDelete: () => void;
}) {
  const cat = Array.isArray(svc.category) ? svc.category[0] : svc.category;
  return (
    <li className={'rounded-xl border bg-white p-3 ' + (svc.is_active ? 'border-neutral-200' : 'border-neutral-200 opacity-60')}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="truncate text-[14px] font-semibold text-neutral-900">{svc.name}</p>
          <p className="text-[12px] text-neutral-500">
            {svc.duration_minutes ? `${svc.duration_minutes} мин` : '—'}
            {' · '}
            {svc.price && svc.price > 0
              ? `${new Intl.NumberFormat('ru-RU').format(svc.price)} ${svc.currency === 'UAH' ? 'грн' : svc.currency}`
              : 'без цены'}
            {cat?.name && ' · ' + cat.name}
          </p>
          {svc.description && (
            <p className="mt-1 line-clamp-2 text-[12px] text-neutral-600">{svc.description}</p>
          )}
        </div>
        <div className="flex shrink-0 gap-1">
          <button
            type="button"
            onClick={onToggle}
            className={
              'flex size-7 items-center justify-center rounded-full hover:bg-neutral-100 ' +
              (svc.is_active ? 'text-emerald-600' : 'text-neutral-400')
            }
            title={svc.is_active ? 'Скрыть' : 'Включить'}
          >
            <Power className="size-3.5" />
          </button>
          <button
            type="button"
            onClick={onEdit}
            className="flex size-7 items-center justify-center rounded-full text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900"
            title="Редактировать"
          >
            <Pencil className="size-3.5" />
          </button>
          <button
            type="button"
            onClick={onDelete}
            className="flex size-7 items-center justify-center rounded-full text-rose-500 hover:bg-rose-50"
            title="Убрать в архив"
          >
            <Trash2 className="size-3.5" />
          </button>
        </div>
      </div>
    </li>
  );
}

function ServiceForm({
  salonId, mode, initial, onCancel, onSaved,
}: {
  salonId: string;
  mode: 'create' | 'edit';
  initial?: SalonService;
  onCancel: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [duration, setDuration] = useState<string>(initial?.duration_minutes ? String(initial.duration_minutes) : '');
  const [price, setPrice] = useState<string>(initial?.price != null ? String(initial.price) : '');
  const [busy, setBusy] = useState(false);

  async function save() {
    if (!name.trim()) {
      toast.error('Введи название');
      return;
    }
    setBusy(true);
    try {
      const payload = {
        name: name.trim(),
        description: description.trim() || undefined,
        duration_minutes: duration ? Number(duration) : undefined,
        price: price ? Number(price) : undefined,
      };
      const url = mode === 'create'
        ? `/api/salon/${salonId}/catalog`
        : `/api/salon/${salonId}/catalog/${initial!.id}`;
      const method = mode === 'create' ? 'POST' : 'PATCH';
      const r = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        toast.error((j as { error?: string }).error || 'Не удалось сохранить');
        return;
      }
      toast.success(mode === 'create' ? 'Услуга добавлена' : 'Сохранено');
      onSaved();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-2xl border border-neutral-300 bg-white p-4 space-y-3">
      <p className="text-[13px] font-semibold text-neutral-900">
        {mode === 'create' ? 'Новая услуга' : 'Редактировать'}
      </p>
      <div>
        <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-neutral-500">
          Название
        </label>
        <input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Маникюр классический"
          className="block w-full rounded-xl border border-neutral-200 bg-white px-3 py-2 text-[13px] text-neutral-900 outline-none focus:border-neutral-400"
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-neutral-500">
            Длительность (мин)
          </label>
          <input
            type="number"
            inputMode="numeric"
            min={5}
            value={duration}
            onChange={(e) => setDuration(e.target.value)}
            placeholder="60"
            className="block w-full rounded-xl border border-neutral-200 bg-white px-3 py-2 text-[13px] text-neutral-900 outline-none focus:border-neutral-400"
          />
        </div>
        <div>
          <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-neutral-500">
            Цена (грн)
          </label>
          <input
            type="number"
            inputMode="decimal"
            min={0}
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            placeholder="500"
            className="block w-full rounded-xl border border-neutral-200 bg-white px-3 py-2 text-[13px] text-neutral-900 outline-none focus:border-neutral-400"
          />
        </div>
      </div>
      <div>
        <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-neutral-500">
          Описание (необязательно)
        </label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={2}
          placeholder="Что входит, особенности"
          className="block w-full resize-none rounded-xl border border-neutral-200 bg-white px-3 py-2 text-[13px] text-neutral-900 outline-none focus:border-neutral-400"
        />
      </div>
      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="inline-flex items-center gap-1 rounded-full border border-neutral-200 bg-white px-3 py-1.5 text-[12px] font-semibold text-neutral-700 hover:bg-neutral-50"
        >
          <X className="size-3" />
          Отмена
        </button>
        <button
          type="button"
          onClick={save}
          disabled={busy}
          className="inline-flex items-center gap-1 rounded-[var(--brand-radius-lg)] bg-neutral-900 px-3 py-1.5 text-[12px] font-semibold text-white disabled:opacity-50"
        >
          {busy ? <Loader2 className="size-3 animate-spin" /> : <Save className="size-3" />}
          Сохранить
        </button>
      </div>
    </div>
  );
}
