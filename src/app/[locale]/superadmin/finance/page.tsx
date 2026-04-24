/** --- YAML
 * name: Superadmin finance
 * description: Platform-wide finance dashboard — MRR / ARR / Churn / LTV / plan breakdown / 12-month chart / churn reasons / prognosis.
 * created: 2026-04-19
 * --- */

import { TrendingUp, TrendingDown, Users, Building2, Star, CircleDollarSign, AlertTriangle, Target, HelpCircle } from 'lucide-react';
import { getFinanceSnapshot } from '@/lib/superadmin/finance-data';
import { MrrLineChart } from '@/components/superadmin/dashboard-charts';

export const dynamic = 'force-dynamic';
export const revalidate = 300;

function fmt(n: number): string {
  return n.toLocaleString('ru-RU');
}

export default async function SuperadminFinancePage() {
  const snap = await getFinanceSnapshot();

  return (
    <div className="p-6">
      <div className="mb-4">
        <h1 className="text-[20px] font-semibold tracking-tight text-white">Финансы платформы</h1>
        <p className="mt-1 text-[13px] text-white/50">Агрегат за текущий месяц. Обновляется каждые 5 минут.</p>
      </div>

      <div className="mb-5 grid grid-cols-4 gap-3">
        <KpiCard
          label="Доход в месяц"
          en="MRR"
          tooltip="Monthly Recurring Revenue. Сколько денег в сумме платят все активные подписчики каждый месяц. Главная метрика SaaS."
          value={`${fmt(snap.mrr)} ₴`}
          accent="emerald"
          Icon={CircleDollarSign}
        />
        <KpiCard
          label="Доход в год"
          en="ARR"
          tooltip="Annual Recurring Revenue = MRR × 12. Прогноз годового дохода, если все текущие подписчики останутся."
          value={`${fmt(snap.arr)} ₴`}
          accent="sky"
          Icon={TrendingUp}
        />
        <KpiCard
          label="Средний чек"
          en="ARPU"
          tooltip="Average Revenue Per User. Сколько в среднем платит один активный подписчик. MRR ÷ количество подписок."
          value={`${fmt(snap.arpu)} ₴`}
          accent="violet"
          Icon={Users}
        />
        <KpiCard
          label="Активных подписок"
          en="Active subscriptions"
          tooltip="Количество сейчас платящих подписчиков (не считая whitelist)."
          value={fmt(snap.activeSubs)}
          accent="amber"
          Icon={Star}
          sub={`Whitelist: ${snap.whitelistCount}`}
        />
      </div>

      <div className="mb-5 grid grid-cols-4 gap-3">
        <KpiCard
          label="Прирост за месяц"
          en="New MRR"
          tooltip="Сумма денег, добавившихся к MRR от новых подписок в этом месяце."
          value={`+${fmt(snap.newMrr)} ₴`}
          accent="emerald"
          Icon={TrendingUp}
          sub="за этот месяц"
        />
        <KpiCard
          label="Потеряно (отмены)"
          en="Churned MRR"
          tooltip="Сумма денег, потерянная из-за отмен подписок в этом месяце."
          value={`-${fmt(snap.churnedMrr)} ₴`}
          accent="rose"
          Icon={TrendingDown}
          sub={`${snap.churnedCount} отмен`}
        />
        <KpiCard
          label="Чистый прирост"
          en="Net New MRR"
          tooltip="Новый MRR минус потерянный. Если плюс — платформа растёт, если минус — падает."
          value={`${snap.netNewMrr >= 0 ? '+' : ''}${fmt(snap.netNewMrr)} ₴`}
          accent={snap.netNewMrr >= 0 ? 'emerald' : 'rose'}
          Icon={snap.netNewMrr >= 0 ? TrendingUp : TrendingDown}
        />
        <KpiCard
          label="Отток"
          en="Churn %"
          tooltip="Процент подписчиков, отменивших подписку в этом месяце. Нормально для SaaS: 3-5%. Больше 7% — тревожно."
          value={`${snap.churnPercent}%`}
          accent={snap.churnPercent > 5 ? 'rose' : 'amber'}
          Icon={AlertTriangle}
          sub={`месяц`}
        />
      </div>

      <div className="mb-5 grid grid-cols-[1.4fr_1fr] gap-5">
        <Block
          title="Доход по месяцам · 12 месяцев"
          subtitle="MRR history"
          tooltip="Как менялся ежемесячный доход за последний год."
        >
          <div className="h-[240px]">
            <MrrLineChart data={snap.mrrSeries.map((p) => ({ label: p.label, value: p.mrr }))} />
          </div>
        </Block>

        <Block
          title="Доход по тарифам"
          subtitle="MRR per plan"
          tooltip="Сколько приносит каждый тариф. Помогает понять какой план наиболее прибыльный."
        >
          {snap.planBreakdown.length === 0 ? (
            <EmptyLine text="Нет активных подписок" />
          ) : (
            <div className="space-y-3">
              {snap.planBreakdown.map((p) => (
                <div key={p.tier} className="rounded-lg border border-white/5 bg-white/[0.02] p-3">
                  <div className="mb-1.5 flex items-center justify-between">
                    <div className="text-[13px] font-medium uppercase tracking-wider text-white/85">{p.tier}</div>
                    <div className="text-[13px] font-semibold text-emerald-300">{fmt(p.totalMrr)} ₴</div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-[11px] text-white/55">
                    <div>
                      Месяц: <span className="text-white/85">{p.monthly.count}</span> × {fmt(p.monthly.unit)} ₴
                      {p.monthly.total > 0 && <span className="text-white/55"> = {fmt(p.monthly.total)} ₴</span>}
                    </div>
                    <div>
                      Год: <span className="text-white/85">{p.yearly.count}</span> × {fmt(p.yearly.unit)} ₴/год
                      {p.yearly.total > 0 && <span className="text-white/55"> = {fmt(p.yearly.total)} ₴/мес</span>}
                    </div>
                  </div>
                </div>
              ))}
              <div className="flex items-center justify-between border-t border-white/10 pt-3 text-[13px]">
                <span className="text-white/65">Итого доход в месяц</span>
                <span className="font-semibold text-emerald-300">{fmt(snap.mrr)} ₴</span>
              </div>
            </div>
          )}
        </Block>
      </div>

      <div className="mb-5 grid grid-cols-2 gap-5">
        <Block
          title="Причины отмен"
          subtitle="за последние 90 дней"
          tooltip="Что именно пользователи указывают как причину отказа от подписки. Главный источник инсайтов для улучшения продукта."
        >
          {snap.churnReasons.length === 0 ? (
            <EmptyLine text="За 90 дней отмен не было" />
          ) : (
            <div className="space-y-2">
              {snap.churnReasons.map((r) => (
                <div key={r.reason} className="flex items-center justify-between rounded-md border border-white/5 bg-white/[0.02] px-3 py-2 text-[13px]">
                  <span className="truncate text-white/75">{r.reason}</span>
                  <span className="rounded-full bg-rose-500/15 px-2 py-0.5 text-[11px] font-medium text-rose-200">{r.count}</span>
                </div>
              ))}
            </div>
          )}
        </Block>

        <Block
          title="Пожизненная ценность клиента"
          subtitle="LTV — Lifetime Value"
          tooltip="Сколько денег один пользователь принесёт проекту за всё время подписки. Чем выше — тем больше можно тратить на привлечение."
        >
          <div className="space-y-3">
            <div className="flex items-center justify-between rounded-lg border border-white/5 bg-white/[0.02] p-3">
              <div className="flex items-center gap-2">
                <div className="grid size-8 place-items-center rounded-md bg-violet-500/15 text-violet-200">
                  <Users className="size-4" />
                </div>
                <div>
                  <div className="text-[12px] uppercase tracking-wider text-white/55">Мастер</div>
                  <div className="text-[11px] text-white/40">12 мес × Pro</div>
                </div>
              </div>
              <div className="text-[15px] font-semibold text-white">{fmt(snap.ltvMaster)} ₴</div>
            </div>
            <div className="flex items-center justify-between rounded-lg border border-white/5 bg-white/[0.02] p-3">
              <div className="flex items-center gap-2">
                <div className="grid size-8 place-items-center rounded-md bg-pink-500/15 text-pink-200">
                  <Building2 className="size-4" />
                </div>
                <div>
                  <div className="text-[12px] uppercase tracking-wider text-white/55">Салон</div>
                  <div className="text-[11px] text-white/40">12 мес × Business</div>
                </div>
              </div>
              <div className="text-[15px] font-semibold text-white">{fmt(snap.ltvSalon)} ₴</div>
            </div>
            <p className="text-[11px] text-white/40">Упрощённый расчёт: 12 мес × цена. Точнее — через retention когорт (TODO).</p>
          </div>
        </Block>
      </div>

      <Block
        title="Прогноз"
        tooltip="Сколько нужно подписок и какой рост MRR чтобы дойти до целевого дохода."
      >
        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-lg border border-white/5 bg-white/[0.02] p-4">
            <div className="flex items-center gap-2 text-[11px] uppercase tracking-wider text-violet-200">
              <Target className="size-3.5" />
              Через 6 мес
            </div>
            <div className="mt-2 text-[22px] font-semibold text-white">{fmt(snap.prognosis.sixMonthMrr)} ₴</div>
            <div className="mt-1 text-[11px] text-white/45">При росте {snap.prognosis.monthlyGrowthRate}%/мес</div>
          </div>
          <div className="rounded-lg border border-white/5 bg-white/[0.02] p-4">
            <div className="flex items-center gap-2 text-[11px] uppercase tracking-wider text-emerald-200">
              <Users className="size-3.5" />
              Pro до $10k
            </div>
            <div className="mt-2 text-[22px] font-semibold text-white">{fmt(snap.prognosis.proNeededFor10k)}</div>
            <div className="mt-1 text-[11px] text-white/45">подписок Pro для 10 000$/мес</div>
          </div>
          <div className="rounded-lg border border-white/5 bg-white/[0.02] p-4">
            <div className="flex items-center gap-2 text-[11px] uppercase tracking-wider text-pink-200">
              <Building2 className="size-3.5" />
              Business до $10k
            </div>
            <div className="mt-2 text-[22px] font-semibold text-white">{fmt(snap.prognosis.businessNeededFor10k)}</div>
            <div className="mt-1 text-[11px] text-white/45">подписок Business для 10 000$/мес</div>
          </div>
        </div>
      </Block>
    </div>
  );
}

function KpiCard({
  label,
  en,
  tooltip,
  value,
  sub,
  accent,
  Icon,
}: {
  label: string;
  en?: string;
  tooltip?: string;
  value: string;
  sub?: string;
  accent: 'emerald' | 'violet' | 'sky' | 'amber' | 'rose';
  Icon: React.ComponentType<{ className?: string }>;
}) {
  const accentMap = {
    emerald: 'bg-emerald-500/15 text-emerald-200',
    violet: 'bg-violet-500/15 text-violet-200',
    sky: 'bg-sky-500/15 text-sky-200',
    amber: 'bg-amber-500/15 text-amber-200',
    rose: 'bg-rose-500/15 text-rose-200',
  } as const;
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
      <div className="flex items-start justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="text-[12px] font-medium text-white/80">{label}</span>
            {tooltip && (
              <span className="group relative inline-flex">
                <HelpCircle className="size-3 text-white/35 hover:text-white/70 cursor-help" />
                <span className="pointer-events-none absolute left-1/2 top-full z-20 mt-1.5 hidden w-60 -translate-x-1/2 rounded-lg border border-white/10 bg-[#1a1b20] px-3 py-2 text-[11px] leading-relaxed text-white/75 shadow-xl group-hover:block">
                  {tooltip}
                </span>
              </span>
            )}
          </div>
          {en && <div className="mt-0.5 text-[10px] uppercase tracking-wider text-white/35">{en}</div>}
        </div>
        <div className={['grid size-7 place-items-center rounded-md shrink-0', accentMap[accent]].join(' ')}>
          <Icon className="size-3.5" />
        </div>
      </div>
      <div className="mt-2 text-[22px] font-semibold text-white">{value}</div>
      {sub && <div className="mt-0.5 text-[11px] text-white/45">{sub}</div>}
    </div>
  );
}

function Block({
  title,
  subtitle,
  tooltip,
  children,
}: {
  title: string;
  subtitle?: string;
  tooltip?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
      <div className="mb-3 flex items-baseline gap-2">
        <h3 className="text-[13px] font-semibold text-white/85">{title}</h3>
        {subtitle && <span className="text-[10px] uppercase tracking-wider text-white/35">{subtitle}</span>}
        {tooltip && (
          <span className="group relative inline-flex">
            <HelpCircle className="size-3 text-white/35 hover:text-white/70 cursor-help" />
            <span className="pointer-events-none absolute left-1/2 top-full z-20 mt-1.5 hidden w-60 -translate-x-1/2 rounded-lg border border-white/10 bg-[#1a1b20] px-3 py-2 text-[11px] leading-relaxed text-white/75 shadow-xl group-hover:block">
              {tooltip}
            </span>
          </span>
        )}
      </div>
      {children}
    </div>
  );
}

function EmptyLine({ text }: { text: string }) {
  return <div className="rounded-md border border-white/5 bg-white/[0.01] py-6 text-center text-[12px] text-white/40">{text}</div>;
}
