/** --- YAML
 * name: Superadmin dashboard
 * description: Platform-owner overview — counters with weekly delta, MRR/ARR/Churn/ARPU, 30-day activity, 12-month MRR line + 30-day registrations stacked bar, recent events feed.
 * created: 2026-04-19
 * --- */

import { getDashboardData } from '@/lib/superadmin/metrics';
import { MrrLineChart, RegistrationsChart } from '@/components/superadmin/dashboard-charts';

export const revalidate = 300;

function fmt(n: number) {
  return n.toLocaleString('ru-RU');
}

function Delta({ v }: { v: number }) {
  if (v === 0) return <span className="text-[11px] text-white/40">0/нед</span>;
  const pos = v > 0;
  return (
    <span className={['text-[11px]', pos ? 'text-emerald-400' : 'text-rose-400'].join(' ')}>
      {pos ? '+' : ''}
      {v}/нед
    </span>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
      <div className="text-[11px] uppercase tracking-wider text-white/40">{label}</div>
      <div className="mt-1.5 text-[22px] font-semibold tracking-tight text-white">{value}</div>
      {hint !== undefined && <div className="mt-1 text-[11px] text-white/50">{hint}</div>}
    </div>
  );
}

function Section({ title, children, className }: { title: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={['rounded-xl border border-white/10 bg-white/[0.02] p-5', className].filter(Boolean).join(' ')}>
      <h2 className="text-[13px] font-medium uppercase tracking-wider text-white/60">{title}</h2>
      <div className="mt-3">{children}</div>
    </section>
  );
}

export default async function SuperadminDashboardPage() {
  const { counters, finance, activity, mrrSeries, regSeries, events } = await getDashboardData();

  return (
    <div className="p-6">
      <div className="mb-1 flex items-baseline justify-between">
        <h1 className="text-[20px] font-semibold tracking-tight text-white">CRES-CA Platform · Дашборд</h1>
        <div className="text-[11px] text-white/40">обновление каждые 5 минут</div>
      </div>
      <p className="mb-5 text-[13px] text-white/50">Ключевые метрики платформы и лента последних событий.</p>

      <div className="grid grid-cols-4 gap-3">
        <Stat label="Пользователей" value={fmt(counters.users.total)} hint={<Delta v={counters.users.weekDelta} />} />
        <Stat label="Мастеров" value={fmt(counters.masters.total)} hint={<Delta v={counters.masters.weekDelta} />} />
        <Stat label="Салонов" value={fmt(counters.salons.total)} hint={<Delta v={counters.salons.weekDelta} />} />
        <Stat label="Клиентов" value={fmt(counters.clients.total)} hint={<Delta v={counters.clients.weekDelta} />} />
      </div>

      <div className="mt-3 grid grid-cols-4 gap-3">
        <Stat label="MRR" value={`${fmt(finance.mrr)} ₴`} hint={`${finance.activeSubs} активных подписок`} />
        <Stat label="ARR" value={`${fmt(finance.arr)} ₴`} hint="MRR × 12" />
        <Stat label="Churn" value={`${finance.churnPercent}%`} hint="за 30 дней" />
        <Stat label="ARPU" value={`${fmt(finance.arpu)} ₴`} hint="средний чек подписки" />
      </div>

      <div className="mt-4 grid grid-cols-3 gap-4">
        <Section title="Активность · 30 дней">
          <dl className="grid grid-cols-2 gap-y-2.5 text-[13px]">
            <dt className="text-white/55">Записей создано</dt>
            <dd className="text-right font-medium text-white">{fmt(activity.appointmentsCreated30d)}</dd>
            <dt className="text-white/55">Визитов завершено</dt>
            <dd className="text-right font-medium text-white">{fmt(activity.appointmentsCompleted30d)}</dd>
            <dt className="text-white/55">Голосовых команд</dt>
            <dd className="text-right font-medium text-white">{fmt(activity.voiceActions30d)}</dd>
            <dt className="text-white/55">Отзывов</dt>
            <dd className="text-right font-medium text-white">{fmt(activity.reviews30d)}</dd>
          </dl>
        </Section>

        <Section title="MRR · 12 месяцев" className="col-span-2">
          <MrrLineChart data={mrrSeries} />
        </Section>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-4">
        <Section title="Регистрации · 30 дней" className="col-span-2">
          <RegistrationsChart data={regSeries} />
        </Section>

        <Section title="Последние события">
          {events.length === 0 ? (
            <div className="py-6 text-center text-[12px] text-white/40">Событий пока нет</div>
          ) : (
            <ul className="max-h-[260px] space-y-2 overflow-y-auto pr-1">
              {events.map((e, i) => (
                <li key={`${e.kind}-${e.at}-${i}`} className="flex items-start gap-2.5 text-[12px]">
                  <span className="mt-0.5 inline-block size-1.5 shrink-0 rounded-full bg-violet-400" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="truncate text-white/85">{e.title}</span>
                      <span className="shrink-0 text-[10px] text-white/35">
                        {new Date(e.at).toLocaleString('ru-RU', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    {e.subtitle && <div className="truncate text-[11px] text-white/45">{e.subtitle}</div>}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Section>
      </div>
    </div>
  );
}
