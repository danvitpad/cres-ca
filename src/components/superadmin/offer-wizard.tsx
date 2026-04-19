/** --- YAML
 * name: Superadmin offer wizard
 * description: 6-step modal wizard (Type → Value → Target → Channels → Schedule → Preview) for creating platform_offers. Supports specific-target multi-select search and segment filtering.
 * created: 2026-04-19
 * --- */

'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { ArrowLeft, ArrowRight, Check, Percent, Coins, Gift, TrendingUp, Users, Building2, UserSearch, Target, X, Search, Mail, Send, Bell } from 'lucide-react';
import type { OfferTarget, OfferType } from '@/lib/superadmin/offers-data';

interface SearchResult {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  role: string;
}

interface FormState {
  offer_type: OfferType;
  offer_value: number;
  title_ru: string;
  description_ru: string;
  target_type: OfferTarget;
  target_ids: SearchResult[];
  segment_plan: string;
  segment_registered_before: string;
  segment_city: string;
  channels: string[];
  when: 'now' | 'schedule';
  scheduled_at: string;
  generate_promo: boolean;
}

const TYPE_META: Record<OfferType, { label: string; Icon: React.ComponentType<{ className?: string }>; unit: string; hint: string }> = {
  discount_percent: { label: '% Скидка', Icon: Percent, unit: '%', hint: 'Процент скидки на подписку' },
  discount_fixed: { label: 'Фикс. скидка', Icon: Coins, unit: '₴', hint: 'Фиксированная сумма скидки' },
  free_months: { label: 'Бесплатные месяцы', Icon: Gift, unit: 'мес', hint: 'Сколько месяцев подарить' },
  plan_upgrade: { label: 'Апгрейд плана', Icon: TrendingUp, unit: '', hint: '0 = бесплатный апгрейд до следующего плана' },
};

const TARGET_META: Record<OfferTarget, { label: string; Icon: React.ComponentType<{ className?: string }>; desc: string }> = {
  all_masters: { label: 'Все мастера', Icon: Users, desc: 'Отправить каждому зарегистрированному мастеру' },
  all_salons: { label: 'Все салоны', Icon: Building2, desc: 'Отправить каждому владельцу салона' },
  specific: { label: 'Конкретные пользователи', Icon: UserSearch, desc: 'Выбрать несколько получателей вручную' },
  segment: { label: 'Сегмент', Icon: Target, desc: 'Фильтр по плану / городу / дате регистрации' },
};

const CHANNEL_META: Record<string, { label: string; Icon: React.ComponentType<{ className?: string }> }> = {
  email: { label: 'Email', Icon: Mail },
  telegram: { label: 'Telegram push', Icon: Send },
  in_app: { label: 'In-app уведомление', Icon: Bell },
};

export function OfferWizard({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [, startTransition] = useTransition();
  const [form, setForm] = useState<FormState>({
    offer_type: 'discount_percent',
    offer_value: 50,
    title_ru: '',
    description_ru: '',
    target_type: 'all_masters',
    target_ids: [],
    segment_plan: '',
    segment_registered_before: '',
    segment_city: '',
    channels: ['in_app', 'telegram'],
    when: 'now',
    scheduled_at: '',
    generate_promo: true,
  });

  useEffect(() => {
    if (!open) {
      setStep(1);
    }
  }, [open]);

  if (!open) return null;

  const patch = (p: Partial<FormState>) => setForm((f) => ({ ...f, ...p }));

  const submit = async (action: 'draft' | 'schedule' | 'send') => {
    if (!form.title_ru.trim()) { toast.error('Заголовок обязателен'); return; }
    if (form.target_type === 'specific' && form.target_ids.length === 0) { toast.error('Выберите хотя бы одного получателя'); return; }
    if (action === 'schedule' && !form.scheduled_at) { toast.error('Укажите дату отправки'); return; }

    setSubmitting(true);
    try {
      const payload = {
        title: { ru: form.title_ru.trim(), en: form.title_ru.trim(), uk: form.title_ru.trim() },
        description: form.description_ru.trim() ? { ru: form.description_ru.trim(), en: form.description_ru.trim(), uk: form.description_ru.trim() } : null,
        offer_type: form.offer_type,
        offer_value: Number(form.offer_value),
        target_type: form.target_type,
        target_ids: form.target_type === 'specific' ? form.target_ids.map((r) => r.id) : null,
        target_segment:
          form.target_type === 'segment'
            ? {
                ...(form.segment_plan ? { plan: form.segment_plan } : {}),
                ...(form.segment_registered_before ? { registered_before: new Date(form.segment_registered_before).toISOString() } : {}),
                ...(form.segment_city ? { city: form.segment_city } : {}),
              }
            : null,
        delivery_channels: form.channels,
        action,
        scheduled_at: action === 'schedule' ? new Date(form.scheduled_at).toISOString() : null,
        generate_promo: form.generate_promo,
      };

      const res = await fetch('/api/superadmin/offers', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        const j = (await res.json().catch(() => ({}))) as { promoCode?: string; recipientsCount?: number };
        if (action === 'send') toast.success(`Отправлено. Получателей: ${j.recipientsCount ?? 0}${j.promoCode ? ` · ${j.promoCode}` : ''}`);
        else if (action === 'schedule') toast.success('Запланировано');
        else toast.success('Сохранено как черновик');
        onOpenChange(false);
        startTransition(() => router.refresh());
      } else {
        const err = await res.json().catch(() => ({ error: 'unknown' }));
        toast.error(`Ошибка: ${err.error}`);
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm" onClick={() => onOpenChange(false)}>
      <div className="relative w-[720px] max-h-[92vh] overflow-y-auto rounded-2xl border border-white/10 bg-[#111214] shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-white/10 bg-[#111214]/95 px-5 py-3.5 backdrop-blur">
          <div className="flex items-center gap-3">
            <h2 className="text-[15px] font-semibold text-white">Новое спецпредложение</h2>
            <div className="flex items-center gap-1">
              {[1, 2, 3, 4, 5, 6].map((n) => (
                <div key={n} className={`h-1.5 w-6 rounded-full ${n <= step ? 'bg-violet-400' : 'bg-white/10'}`} />
              ))}
            </div>
            <span className="text-[11px] uppercase tracking-wider text-white/40">Шаг {step}/6</span>
          </div>
          <button type="button" onClick={() => onOpenChange(false)} className="grid size-8 place-items-center rounded-md text-white/60 hover:bg-white/10 hover:text-white">
            <X className="size-4" />
          </button>
        </div>

        <div className="p-5">
          {step === 1 && <StepType form={form} onChange={patch} />}
          {step === 2 && <StepValue form={form} onChange={patch} />}
          {step === 3 && <StepTarget form={form} onChange={patch} />}
          {step === 4 && <StepChannels form={form} onChange={patch} />}
          {step === 5 && <StepWhen form={form} onChange={patch} />}
          {step === 6 && <StepPreview form={form} />}
        </div>

        <div className="sticky bottom-0 flex items-center justify-between gap-3 border-t border-white/10 bg-[#111214]/95 px-5 py-3.5 backdrop-blur">
          <button
            type="button"
            onClick={() => setStep((s) => Math.max(1, s - 1))}
            disabled={step === 1}
            className="flex h-9 items-center gap-1.5 rounded-md border border-white/10 px-3 text-[13px] text-white/75 hover:bg-white/[0.06] disabled:opacity-30"
          >
            <ArrowLeft className="size-4" />
            Назад
          </button>
          <div className="flex items-center gap-2">
            {step < 6 ? (
              <button
                type="button"
                onClick={() => setStep((s) => Math.min(6, s + 1))}
                className="flex h-9 items-center gap-1.5 rounded-md bg-violet-500 px-4 text-[13px] font-medium text-white hover:bg-violet-400"
              >
                Далее
                <ArrowRight className="size-4" />
              </button>
            ) : (
              <>
                <button type="button" onClick={() => submit('draft')} disabled={submitting} className="h-9 rounded-md border border-white/10 bg-white/[0.04] px-3 text-[13px] text-white/75 hover:bg-white/[0.08] disabled:opacity-40">
                  Сохранить черновик
                </button>
                {form.when === 'schedule' ? (
                  <button type="button" onClick={() => submit('schedule')} disabled={submitting} className="h-9 rounded-md bg-violet-500 px-4 text-[13px] font-medium text-white hover:bg-violet-400 disabled:opacity-40">
                    Запланировать
                  </button>
                ) : (
                  <button type="button" onClick={() => submit('send')} disabled={submitting} className="flex h-9 items-center gap-1.5 rounded-md bg-emerald-500 px-4 text-[13px] font-medium text-white hover:bg-emerald-400 disabled:opacity-40">
                    <Check className="size-4" />
                    Отправить
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function StepType({ form, onChange }: { form: FormState; onChange: (p: Partial<FormState>) => void }) {
  return (
    <div>
      <h3 className="mb-1 text-[15px] font-semibold text-white">Тип предложения</h3>
      <p className="mb-4 text-[13px] text-white/50">Что получит пользователь после принятия.</p>
      <div className="grid grid-cols-2 gap-2.5">
        {(Object.keys(TYPE_META) as OfferType[]).map((k) => {
          const meta = TYPE_META[k];
          const active = form.offer_type === k;
          return (
            <button
              key={k}
              type="button"
              onClick={() => onChange({ offer_type: k })}
              className={`flex items-start gap-3 rounded-xl border p-3.5 text-left transition-colors ${active ? 'border-violet-400/50 bg-violet-500/[0.08]' : 'border-white/10 bg-white/[0.02] hover:bg-white/[0.04]'}`}
            >
              <div className={`grid size-9 place-items-center rounded-lg ${active ? 'bg-violet-500/20 text-violet-200' : 'bg-white/5 text-white/60'}`}>
                <meta.Icon className="size-4.5" />
              </div>
              <div className="min-w-0">
                <div className="text-[13px] font-medium text-white">{meta.label}</div>
                <div className="text-[11px] text-white/50">{meta.hint}</div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function StepValue({ form, onChange }: { form: FormState; onChange: (p: Partial<FormState>) => void }) {
  const meta = TYPE_META[form.offer_type];
  return (
    <div>
      <h3 className="mb-1 text-[15px] font-semibold text-white">Значение</h3>
      <p className="mb-4 text-[13px] text-white/50">{meta.hint}</p>
      <div className="grid grid-cols-[1fr_auto] gap-3">
        <div>
          <label className="block text-[11px] uppercase tracking-wider text-white/50">Значение</label>
          <div className="mt-1.5 flex items-center overflow-hidden rounded-md border border-white/15 bg-white/[0.04] focus-within:border-violet-400/50">
            <input
              type="number"
              min={0}
              step="any"
              value={form.offer_value}
              onChange={(e) => onChange({ offer_value: Number(e.target.value) })}
              className="h-10 w-full bg-transparent px-3 text-[15px] text-white outline-none"
            />
            {meta.unit && <span className="px-3 text-[13px] text-white/50">{meta.unit}</span>}
          </div>
        </div>
      </div>

      <div className="mt-5">
        <label className="block text-[11px] uppercase tracking-wider text-white/50">Заголовок (RU)</label>
        <input
          type="text"
          value={form.title_ru}
          onChange={(e) => onChange({ title_ru: e.target.value })}
          placeholder="Напр. Скидка 50% на Pro для beta-тестеров"
          className="mt-1.5 h-10 w-full rounded-md border border-white/15 bg-white/[0.04] px-3 text-[13px] text-white placeholder-white/35 outline-none focus:border-violet-400/50"
        />
      </div>

      <div className="mt-3">
        <label className="block text-[11px] uppercase tracking-wider text-white/50">Описание</label>
        <textarea
          value={form.description_ru}
          onChange={(e) => onChange({ description_ru: e.target.value })}
          placeholder="Короткий текст для получателя…"
          rows={3}
          className="mt-1.5 w-full resize-none rounded-md border border-white/15 bg-white/[0.04] px-3 py-2 text-[13px] text-white placeholder-white/35 outline-none focus:border-violet-400/50"
        />
      </div>

      <label className="mt-4 flex cursor-pointer items-center gap-2 text-[13px] text-white/75">
        <input type="checkbox" checked={form.generate_promo} onChange={(e) => onChange({ generate_promo: e.target.checked })} className="accent-violet-500" />
        Сгенерировать промокод (применяется при оплате подписки)
      </label>
    </div>
  );
}

function StepTarget({ form, onChange }: { form: FormState; onChange: (p: Partial<FormState>) => void }) {
  return (
    <div>
      <h3 className="mb-1 text-[15px] font-semibold text-white">Кому отправить</h3>
      <p className="mb-4 text-[13px] text-white/50">Получатели предложения.</p>
      <div className="grid grid-cols-2 gap-2.5">
        {(Object.keys(TARGET_META) as OfferTarget[]).map((k) => {
          const meta = TARGET_META[k];
          const active = form.target_type === k;
          return (
            <button
              key={k}
              type="button"
              onClick={() => onChange({ target_type: k })}
              className={`flex items-start gap-3 rounded-xl border p-3.5 text-left transition-colors ${active ? 'border-violet-400/50 bg-violet-500/[0.08]' : 'border-white/10 bg-white/[0.02] hover:bg-white/[0.04]'}`}
            >
              <div className={`grid size-9 place-items-center rounded-lg ${active ? 'bg-violet-500/20 text-violet-200' : 'bg-white/5 text-white/60'}`}>
                <meta.Icon className="size-4.5" />
              </div>
              <div className="min-w-0">
                <div className="text-[13px] font-medium text-white">{meta.label}</div>
                <div className="text-[11px] text-white/50">{meta.desc}</div>
              </div>
            </button>
          );
        })}
      </div>

      {form.target_type === 'specific' && <SpecificPicker form={form} onChange={onChange} />}
      {form.target_type === 'segment' && <SegmentPicker form={form} onChange={onChange} />}
    </div>
  );
}

function SpecificPicker({ form, onChange }: { form: FormState; onChange: (p: Partial<FormState>) => void }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const abort = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!query.trim()) { setResults([]); return; }
    abort.current?.abort();
    abort.current = new AbortController();
    const t = setTimeout(() => {
      fetch(`/api/superadmin/users/search?q=${encodeURIComponent(query)}`, { signal: abort.current?.signal })
        .then((r) => r.json())
        .then((data: { results: SearchResult[] }) => {
          const existingIds = new Set(form.target_ids.map((r) => r.id));
          setResults((data.results ?? []).filter((r) => !existingIds.has(r.id)));
        })
        .catch(() => {});
    }, 250);
    return () => clearTimeout(t);
  }, [query, form.target_ids]);

  return (
    <div className="mt-4 rounded-xl border border-white/10 bg-white/[0.02] p-4">
      <label className="block text-[11px] uppercase tracking-wider text-white/50">Поиск пользователей</label>
      <div className="relative mt-1.5">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-white/40" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Имя, email или телефон…"
          className="h-10 w-full rounded-md border border-white/15 bg-white/[0.04] pl-9 pr-3 text-[13px] text-white placeholder-white/35 outline-none focus:border-violet-400/50"
        />
        {results.length > 0 && (
          <div className="absolute z-10 mt-1 max-h-48 w-full overflow-y-auto rounded-md border border-white/10 bg-[#1f2023] shadow-2xl">
            {results.map((r) => (
              <button
                key={r.id}
                type="button"
                onClick={() => { onChange({ target_ids: [...form.target_ids, r] }); setQuery(''); setResults([]); }}
                className="block w-full border-b border-white/5 px-3 py-2 text-left last:border-b-0 hover:bg-white/[0.08]"
              >
                <div className="text-[13px] text-white/90">{r.name}</div>
                <div className="text-[11px] text-white/45">{r.email ?? r.phone ?? '—'} · {r.role}</div>
              </button>
            ))}
          </div>
        )}
      </div>

      {form.target_ids.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {form.target_ids.map((r) => (
            <span key={r.id} className="inline-flex items-center gap-1.5 rounded-full border border-violet-400/30 bg-violet-500/[0.08] px-2.5 py-1 text-[12px] text-violet-100">
              {r.name}
              <button
                type="button"
                onClick={() => onChange({ target_ids: form.target_ids.filter((x) => x.id !== r.id) })}
                className="grid size-4 place-items-center rounded-full text-white/60 hover:bg-white/20 hover:text-white"
              >
                <X className="size-3" />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function SegmentPicker({ form, onChange }: { form: FormState; onChange: (p: Partial<FormState>) => void }) {
  return (
    <div className="mt-4 grid grid-cols-3 gap-3 rounded-xl border border-white/10 bg-white/[0.02] p-4">
      <div>
        <label className="block text-[11px] uppercase tracking-wider text-white/50">План</label>
        <select
          value={form.segment_plan}
          onChange={(e) => onChange({ segment_plan: e.target.value })}
          className="mt-1.5 h-10 w-full rounded-md border border-white/15 bg-white/[0.04] px-2.5 text-[13px] text-white outline-none focus:border-violet-400/50"
        >
          <option value="" className="bg-[#1a1b1e]">Любой</option>
          <option value="free" className="bg-[#1a1b1e]">Free (без подписки)</option>
          <option value="trial" className="bg-[#1a1b1e]">Trial</option>
          <option value="starter" className="bg-[#1a1b1e]">Starter</option>
          <option value="pro" className="bg-[#1a1b1e]">Pro</option>
          <option value="business" className="bg-[#1a1b1e]">Business</option>
        </select>
      </div>
      <div>
        <label className="block text-[11px] uppercase tracking-wider text-white/50">Регистрация до</label>
        <input
          type="date"
          value={form.segment_registered_before}
          onChange={(e) => onChange({ segment_registered_before: e.target.value })}
          className="mt-1.5 h-10 w-full rounded-md border border-white/15 bg-white/[0.04] px-2.5 text-[13px] text-white outline-none focus:border-violet-400/50"
        />
      </div>
      <div>
        <label className="block text-[11px] uppercase tracking-wider text-white/50">Город</label>
        <input
          type="text"
          value={form.segment_city}
          onChange={(e) => onChange({ segment_city: e.target.value })}
          placeholder="Киев"
          className="mt-1.5 h-10 w-full rounded-md border border-white/15 bg-white/[0.04] px-2.5 text-[13px] text-white placeholder-white/35 outline-none focus:border-violet-400/50"
        />
      </div>
    </div>
  );
}

function StepChannels({ form, onChange }: { form: FormState; onChange: (p: Partial<FormState>) => void }) {
  const toggle = (c: string) => {
    const set = new Set(form.channels);
    if (set.has(c)) set.delete(c);
    else set.add(c);
    onChange({ channels: Array.from(set) });
  };
  return (
    <div>
      <h3 className="mb-1 text-[15px] font-semibold text-white">Каналы доставки</h3>
      <p className="mb-4 text-[13px] text-white/50">Одно или несколько. In-app — через таблицу notifications.</p>
      <div className="grid grid-cols-3 gap-2.5">
        {(Object.keys(CHANNEL_META)).map((k) => {
          const meta = CHANNEL_META[k];
          const active = form.channels.includes(k);
          return (
            <button
              key={k}
              type="button"
              onClick={() => toggle(k)}
              className={`flex flex-col items-center gap-2 rounded-xl border p-4 text-center transition-colors ${active ? 'border-violet-400/50 bg-violet-500/[0.08]' : 'border-white/10 bg-white/[0.02] hover:bg-white/[0.04]'}`}
            >
              <div className={`grid size-10 place-items-center rounded-lg ${active ? 'bg-violet-500/20 text-violet-200' : 'bg-white/5 text-white/60'}`}>
                <meta.Icon className="size-5" />
              </div>
              <div className="text-[13px] font-medium text-white">{meta.label}</div>
              {active && <Check className="size-3.5 text-violet-300" />}
            </button>
          );
        })}
      </div>
      {form.channels.includes('email') && (
        <p className="mt-4 text-[11px] text-amber-300/80">⚠ Email-отправка пока заглушка — требуется Hutko/SMTP интеграция (Phase 8 settings).</p>
      )}
    </div>
  );
}

function StepWhen({ form, onChange }: { form: FormState; onChange: (p: Partial<FormState>) => void }) {
  return (
    <div>
      <h3 className="mb-1 text-[15px] font-semibold text-white">Время отправки</h3>
      <p className="mb-4 text-[13px] text-white/50">Немедленно или по расписанию.</p>
      <div className="grid grid-cols-2 gap-2.5">
        <button
          type="button"
          onClick={() => onChange({ when: 'now' })}
          className={`rounded-xl border p-4 text-left transition-colors ${form.when === 'now' ? 'border-emerald-400/50 bg-emerald-500/[0.08]' : 'border-white/10 bg-white/[0.02] hover:bg-white/[0.04]'}`}
        >
          <div className="text-[13px] font-medium text-white">Отправить сейчас</div>
          <div className="mt-1 text-[11px] text-white/50">status = sent, рассылка начинается сразу</div>
        </button>
        <button
          type="button"
          onClick={() => onChange({ when: 'schedule' })}
          className={`rounded-xl border p-4 text-left transition-colors ${form.when === 'schedule' ? 'border-violet-400/50 bg-violet-500/[0.08]' : 'border-white/10 bg-white/[0.02] hover:bg-white/[0.04]'}`}
        >
          <div className="text-[13px] font-medium text-white">Запланировать</div>
          <div className="mt-1 text-[11px] text-white/50">status = scheduled, отправить в указанное время</div>
        </button>
      </div>

      {form.when === 'schedule' && (
        <div className="mt-4">
          <label className="block text-[11px] uppercase tracking-wider text-white/50">Дата и время</label>
          <input
            type="datetime-local"
            value={form.scheduled_at}
            onChange={(e) => onChange({ scheduled_at: e.target.value })}
            className="mt-1.5 h-10 w-full rounded-md border border-white/15 bg-white/[0.04] px-3 text-[13px] text-white outline-none focus:border-violet-400/50"
          />
        </div>
      )}
    </div>
  );
}

function StepPreview({ form }: { form: FormState }) {
  const tMeta = TYPE_META[form.offer_type];
  const targMeta = TARGET_META[form.target_type];
  return (
    <div>
      <h3 className="mb-1 text-[15px] font-semibold text-white">Предпросмотр</h3>
      <p className="mb-4 text-[13px] text-white/50">Проверьте всё перед отправкой.</p>

      <div className="mb-4 rounded-xl border border-violet-400/20 bg-violet-500/[0.04] p-4">
        <div className="flex items-center gap-2 text-[11px] uppercase tracking-wider text-violet-200">
          <tMeta.Icon className="size-3.5" />
          {tMeta.label} · {form.offer_value} {tMeta.unit}
        </div>
        <div className="mt-2 text-[15px] font-medium text-white">{form.title_ru || '(без заголовка)'}</div>
        {form.description_ru && <div className="mt-1 text-[13px] text-white/70">{form.description_ru}</div>}
        {form.generate_promo && <div className="mt-2 text-[11px] text-emerald-300">+ уникальный промокод</div>}
      </div>

      <div className="space-y-2.5 text-[13px]">
        <Row label="Получатели">
          <span className="inline-flex items-center gap-1.5"><targMeta.Icon className="size-3.5" /> {targMeta.label}</span>
          {form.target_type === 'specific' && <span className="text-white/50"> · {form.target_ids.length} шт</span>}
          {form.target_type === 'segment' && (
            <span className="text-white/50"> · {[form.segment_plan, form.segment_city, form.segment_registered_before && `до ${form.segment_registered_before}`].filter(Boolean).join(', ') || 'все'}</span>
          )}
        </Row>
        <Row label="Каналы">
          <div className="flex flex-wrap gap-1">
            {form.channels.map((c) => (
              <span key={c} className="inline-flex items-center gap-1 rounded-full bg-white/5 px-2 py-0.5 text-[11px] text-white/75">
                {CHANNEL_META[c]?.label ?? c}
              </span>
            ))}
          </div>
        </Row>
        <Row label="Когда">
          {form.when === 'now' ? <span className="text-emerald-300">Сейчас</span> : <span>Запланировано: {form.scheduled_at || '—'}</span>}
        </Row>
      </div>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[120px_1fr] gap-3 rounded-lg border border-white/5 bg-white/[0.02] px-3 py-2">
      <div className="text-[11px] uppercase tracking-wider text-white/45">{label}</div>
      <div className="text-white/85">{children}</div>
    </div>
  );
}
