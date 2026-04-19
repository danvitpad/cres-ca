/** --- YAML
 * name: Superadmin settings client
 * description: Inline-editable plan cards (monthly/yearly price + features + limits) + read-only integrations + env-driven referral/superadmin summary.
 * created: 2026-04-19
 * --- */

'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Check, CheckCircle2, AlertCircle, Pencil, X } from 'lucide-react';
import type { PlatformSettings, PlanRow } from '@/lib/superadmin/settings-data';

export function SettingsClient({ data }: { data: PlatformSettings }) {
  return (
    <div className="space-y-5">
      <Block title="Тарифные планы" subtitle="Цены и фичи. Изменение применяется сразу — существующие подписки продолжают действовать по старой цене до следующего периода.">
        <div className="grid grid-cols-1 gap-3 xl:grid-cols-3">
          {data.plans.map((p) => <PlanCard key={p.id} plan={p} />)}
        </div>
      </Block>

      <Block title="Триал и реферальные бонусы" subtitle="Управляется через .env. Для изменения — правка переменных окружения.">
        <div className="grid grid-cols-3 gap-3">
          <EnvCard label="Длительность триала" value={`${data.trialDays} дней`} env="TRIAL_DAYS" />
          <EnvCard label="Бонус клиент→клиент" value={`${data.referralClientBonus} ₴`} env="REFERRAL_CLIENT_BONUS" />
          <EnvCard label="Процент мастер→мастер" value={`${data.referralMasterPercent}%`} env="REFERRAL_MASTER_PERCENT" />
        </div>
      </Block>

      <Block title="Супер-админы" subtitle="Доступ к /superadmin/* имеет каждый email из .env SUPERADMIN_EMAILS.">
        <div className="flex flex-wrap gap-1.5">
          {data.superadminEmails.length === 0 ? (
            <span className="text-[13px] text-rose-300">⚠ SUPERADMIN_EMAILS пуст — никто не имеет доступа</span>
          ) : (
            data.superadminEmails.map((e) => (
              <span key={e} className="inline-flex items-center gap-1.5 rounded-full border border-violet-400/30 bg-violet-500/[0.08] px-3 py-1 text-[12px] text-violet-100">
                {e}
              </span>
            ))
          )}
        </div>
      </Block>

      <Block title="Интеграции" subtitle="Статус подключения внешних сервисов. Ключи редактируются в .env / Vercel env.">
        <div className="grid grid-cols-1 gap-2 xl:grid-cols-2">
          {data.integrations.map((i) => (
            <div key={i.name} className="flex items-center justify-between rounded-lg border border-white/5 bg-white/[0.02] p-3">
              <div className="flex items-center gap-2.5">
                <div className={['grid size-8 place-items-center rounded-md', i.connected ? 'bg-emerald-500/15 text-emerald-200' : 'bg-rose-500/15 text-rose-200'].join(' ')}>
                  {i.connected ? <CheckCircle2 className="size-4" /> : <AlertCircle className="size-4" />}
                </div>
                <div className="min-w-0">
                  <div className="text-[13px] font-medium text-white">{i.name}</div>
                  <div className="truncate text-[11px] text-white/45">{i.detail}</div>
                </div>
              </div>
              <span className={['rounded-full px-2 py-0.5 text-[11px] uppercase tracking-wider', i.connected ? 'bg-emerald-500/15 text-emerald-200' : 'bg-white/5 text-white/50'].join(' ')}>
                {i.connected ? 'Подключено' : 'Нет'}
              </span>
            </div>
          ))}
        </div>
      </Block>

      <Block title="Email-шаблоны" subtitle="Шаблоны подтверждения / сброса пароля / приглашения.">
        <a
          href="https://supabase.com/dashboard/project/nrrfvyikuseprtrbfbbp/auth/templates"
          target="_blank"
          rel="noreferrer"
          className="inline-flex h-9 items-center gap-2 rounded-md border border-white/10 bg-white/[0.04] px-3 text-[13px] text-violet-300 hover:bg-white/[0.08]"
        >
          Открыть в Supabase Dashboard →
        </a>
      </Block>
    </div>
  );
}

function PlanCard({ plan }: { plan: PlanRow }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [monthly, setMonthly] = useState(plan.priceMonthly);
  const [yearly, setYearly] = useState(plan.priceYearly);
  const [busy, setBusy] = useState(false);
  const [, startTransition] = useTransition();

  const save = async () => {
    setBusy(true);
    const res = await fetch('/api/superadmin/plans', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ id: plan.id, price_monthly: monthly, price_yearly: yearly }),
    });
    setBusy(false);
    if (res.ok) {
      toast.success('Сохранено');
      setEditing(false);
      startTransition(() => router.refresh());
    } else {
      const err = await res.json().catch(() => ({ error: 'unknown' }));
      toast.error(`Ошибка: ${err.error}`);
    }
  };

  const cancel = () => {
    setMonthly(plan.priceMonthly);
    setYearly(plan.priceYearly);
    setEditing(false);
  };

  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
      <div className="mb-2 flex items-center justify-between">
        <div>
          <div className="text-[11px] uppercase tracking-wider text-violet-200">{plan.tier}</div>
          <div className="text-[16px] font-semibold text-white">{plan.nameRu}</div>
        </div>
        {editing ? (
          <div className="flex items-center gap-1">
            <button type="button" onClick={cancel} disabled={busy} className="grid size-7 place-items-center rounded text-white/55 hover:bg-white/10 hover:text-white">
              <X className="size-3.5" />
            </button>
            <button type="button" onClick={save} disabled={busy} className="grid size-7 place-items-center rounded bg-emerald-500/20 text-emerald-200 hover:bg-emerald-500/30">
              <Check className="size-3.5" />
            </button>
          </div>
        ) : (
          <button type="button" onClick={() => setEditing(true)} className="grid size-7 place-items-center rounded text-white/55 hover:bg-white/10 hover:text-white" aria-label="Редактировать">
            <Pencil className="size-3.5" />
          </button>
        )}
      </div>

      <div className="mb-3 grid grid-cols-2 gap-2">
        <PriceField label={`${plan.currency} / мес`} value={monthly} onChange={setMonthly} editing={editing} />
        <PriceField label={`${plan.currency} / год`} value={yearly} onChange={setYearly} editing={editing} />
      </div>

      {plan.features.length > 0 && (
        <div className="mb-3">
          <div className="mb-1.5 text-[11px] uppercase tracking-wider text-white/45">Фичи</div>
          <div className="flex flex-wrap gap-1">
            {plan.features.map((f) => (
              <span key={f} className="rounded-full bg-white/5 px-2 py-0.5 text-[10px] text-white/65">{f}</span>
            ))}
          </div>
        </div>
      )}

      {Object.keys(plan.limits).length > 0 && (
        <div>
          <div className="mb-1.5 text-[11px] uppercase tracking-wider text-white/45">Лимиты</div>
          <div className="space-y-0.5 text-[11px]">
            {Object.entries(plan.limits).map(([k, v]) => (
              <div key={k} className="flex justify-between text-white/55">
                <span>{k}</span>
                <span className="text-white/75">{v === -1 ? '∞' : v}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function PriceField({ label, value, onChange, editing }: { label: string; value: number; onChange: (v: number) => void; editing: boolean }) {
  return (
    <div className="rounded-lg border border-white/5 bg-white/[0.02] p-2.5">
      <div className="text-[10px] uppercase tracking-wider text-white/45">{label}</div>
      {editing ? (
        <input
          type="number"
          min={0}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="mt-0.5 h-7 w-full rounded border border-white/15 bg-white/[0.04] px-2 text-[13px] text-white outline-none focus:border-violet-400/50"
        />
      ) : (
        <div className="mt-0.5 text-[15px] font-semibold text-white">{value.toLocaleString('ru-RU')}</div>
      )}
    </div>
  );
}

function EnvCard({ label, value, env }: { label: string; value: string; env: string }) {
  return (
    <div className="rounded-lg border border-white/5 bg-white/[0.02] p-3">
      <div className="text-[11px] uppercase tracking-wider text-white/45">{label}</div>
      <div className="mt-1 text-[15px] font-semibold text-white">{value}</div>
      <div className="mt-1 font-mono text-[10px] text-white/35">{env}</div>
    </div>
  );
}

function Block({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-white/10 bg-white/[0.015] p-5">
      <h2 className="text-[15px] font-semibold text-white">{title}</h2>
      {subtitle && <p className="mb-4 mt-0.5 text-[12px] text-white/50">{subtitle}</p>}
      {children}
    </section>
  );
}
