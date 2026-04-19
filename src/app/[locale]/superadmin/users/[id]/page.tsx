/** --- YAML
 * name: Superadmin user detail
 * description: Full profile card — identity, master/salon link, subscription status, whitelist, activity summary, action shortcuts.
 * created: 2026-04-19
 * --- */

import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, Mail, Phone, Send } from 'lucide-react';
import { getUserDetail } from '@/lib/superadmin/users';

export const dynamic = 'force-dynamic';

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-white/5 py-2 text-[13px] last:border-b-0">
      <dt className="text-white/50">{label}</dt>
      <dd className="text-right text-white/90">{value ?? '—'}</dd>
    </div>
  );
}

function Block({ title, children, action }: { title: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-white/10 bg-white/[0.02] p-5">
      <div className="mb-2 flex items-baseline justify-between">
        <h2 className="text-[12px] font-medium uppercase tracking-wider text-white/55">{title}</h2>
        {action}
      </div>
      <dl>{children}</dl>
    </section>
  );
}

function fmtDate(d: string | null) {
  if (!d) return '—';
  return new Date(d).toLocaleString('ru-RU', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function fmtDateShort(d: string | null) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('ru-RU', { day: '2-digit', month: 'short', year: 'numeric' });
}

export default async function SuperadminUserDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const detail = await getUserDetail(id);
  if (!detail) notFound();

  const { profile, master, salon, subscription, whitelist, activity, paymentsCount } = detail;

  return (
    <div className="p-6">
      <Link href="/superadmin/users" className="mb-4 inline-flex items-center gap-1.5 text-[12px] text-white/50 hover:text-white">
        <ArrowLeft className="size-3.5" />
        Все пользователи
      </Link>

      <div className="mb-5 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-[22px] font-semibold tracking-tight text-white">{profile.displayName}</h1>
          <div className="mt-1 flex items-center gap-3 text-[12px] text-white/55">
            <span className="rounded border border-white/10 bg-white/[0.05] px-1.5 py-0.5 uppercase tracking-wider">{profile.role}</span>
            <span>·</span>
            <span>зарегистрирован {fmtDateShort(profile.createdAt)}</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {profile.email && (
            <a href={`mailto:${profile.email}`} className="grid size-9 place-items-center rounded-md border border-white/10 bg-white/[0.04] text-white/70 hover:bg-white/[0.08] hover:text-white" aria-label="Email">
              <Mail className="size-4" />
            </a>
          )}
          {profile.phone && (
            <a href={`tel:${profile.phone}`} className="grid size-9 place-items-center rounded-md border border-white/10 bg-white/[0.04] text-white/70 hover:bg-white/[0.08] hover:text-white" aria-label="Телефон">
              <Phone className="size-4" />
            </a>
          )}
          {profile.telegramUsername && (
            <a
              href={`https://t.me/${profile.telegramUsername}`}
              target="_blank"
              rel="noreferrer"
              className="grid size-9 place-items-center rounded-md border border-white/10 bg-white/[0.04] text-white/70 hover:bg-white/[0.08] hover:text-white"
              aria-label="Telegram"
            >
              <Send className="size-4" />
            </a>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Block title="Профиль">
          <Field label="Email" value={profile.email} />
          <Field label="Телефон" value={profile.phone} />
          <Field label="Telegram" value={profile.telegramUsername ? `@${profile.telegramUsername}` : null} />
          <Field label="Локаль" value={profile.locale} />
          <Field label="ID" value={<code className="font-mono text-[11px] text-white/50">{profile.id.slice(0, 8)}…</code>} />
        </Block>

        <Block title="Подписка">
          {subscription ? (
            <>
              <Field
                label="План"
                value={
                  <span className={subscription.status === 'active' ? 'text-emerald-300' : 'text-white/90'}>
                    {subscription.tier} · {subscription.status}
                  </span>
                }
              />
              <Field label="Биллинг" value={subscription.billingPeriod ?? '—'} />
              <Field label="Триал до" value={fmtDateShort(subscription.trialEndsAt)} />
              <Field label="Период до" value={fmtDateShort(subscription.currentPeriodEnd)} />
              <Field label="Платежей" value={paymentsCount} />
              <Field label="С какого" value={fmtDateShort(subscription.createdAt)} />
            </>
          ) : (
            <div className="py-3 text-[13px] text-white/45">Подписки нет</div>
          )}
        </Block>

        <Block title="Whitelist">
          {whitelist ? (
            <>
              <Field label="Предоставлен план" value={<span className="text-emerald-300">{whitelist.grantedPlan}</span>} />
              <Field label="Причина" value={whitelist.reason ?? '—'} />
              <Field label="Действует до" value={whitelist.expiresAt ? fmtDate(whitelist.expiresAt) : 'Навсегда'} />
              <Field label="Добавлен" value={fmtDate(whitelist.createdAt)} />
            </>
          ) : (
            <div className="py-3 text-[13px] text-white/45">Не в whitelist</div>
          )}
        </Block>

        <Block title="Активность">
          <Field label="Записей" value={activity.appointmentsCount} />
          <Field label="Завершённых визитов" value={activity.completedAppointmentsCount} />
          <Field label="Голосовых команд" value={activity.voiceActionsCount} />
        </Block>

        {master && (
          <Block title="Мастер">
            <Field label="ID" value={<code className="font-mono text-[11px] text-white/50">{master.id.slice(0, 8)}…</code>} />
            <Field label="Специализация" value={master.specialization} />
            <Field label="Город" value={master.city} />
            <Field label="Активен" value={master.isActive ? 'Да' : 'Нет'} />
          </Block>
        )}

        {salon && (
          <Block title="Салон">
            <Field label="Название" value={salon.name} />
            <Field label="Город" value={salon.city} />
            <Field label="ID" value={<code className="font-mono text-[11px] text-white/50">{salon.id.slice(0, 8)}…</code>} />
          </Block>
        )}
      </div>

      <div className="mt-6 rounded-xl border border-white/10 bg-white/[0.02] p-5">
        <h2 className="mb-3 text-[12px] font-medium uppercase tracking-wider text-white/55">Действия</h2>
        <div className="flex flex-wrap gap-2">
          <Link
            href={`/superadmin/whitelist?profile_id=${profile.id}`}
            className="h-9 rounded-md border border-violet-400/30 bg-violet-500/10 px-3 text-[13px] font-medium text-violet-200 transition-colors hover:bg-violet-500/15 flex items-center"
          >
            {whitelist ? 'Настроить whitelist' : 'Добавить в whitelist'}
          </Link>
          <Link
            href={`/superadmin/subscriptions?profile_id=${profile.id}`}
            className="h-9 rounded-md border border-white/15 bg-white/[0.04] px-3 text-[13px] font-medium text-white/80 transition-colors hover:bg-white/[0.08] flex items-center"
          >
            Сменить план
          </Link>
          <Link
            href={`/superadmin/offers?target=specific&profile_id=${profile.id}`}
            className="h-9 rounded-md border border-white/15 bg-white/[0.04] px-3 text-[13px] font-medium text-white/80 transition-colors hover:bg-white/[0.08] flex items-center"
          >
            Отправить предложение
          </Link>
        </div>
      </div>
    </div>
  );
}
