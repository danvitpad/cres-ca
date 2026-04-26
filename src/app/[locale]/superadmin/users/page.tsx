/** --- YAML
 * name: Superadmin users list
 * description: Searchable table of all profiles with type/subscription filters and link to detail card.
 * created: 2026-04-19
 * --- */

import Link from 'next/link';
import { listUsers, type UserType, type UserSubFilter } from '@/lib/superadmin/users';
import { UsersFilters } from '@/components/superadmin/users-filters';


const TYPE_LABEL: Record<string, string> = { client: 'Клиент', master: 'Мастер', salon: 'Салон', other: '—' };

function typePill(type: string) {
  const colors: Record<string, string> = {
    client: 'bg-sky-500/10 text-sky-300 border-sky-500/20',
    master: 'bg-violet-500/10 text-violet-300 border-violet-500/20',
    salon: 'bg-pink-500/10 text-pink-300 border-pink-500/20',
    other: 'bg-white/5 text-white/50 border-white/10',
  };
  return colors[type] ?? colors.other;
}

function subPill(tier: string | null, status: string | null) {
  if (!tier) return { label: '—', cls: 'text-white/40' };
  const label = tier === 'trial' ? 'Trial' : tier[0].toUpperCase() + tier.slice(1);
  const cls = status === 'active' ? 'text-emerald-300' : status === 'past_due' ? 'text-amber-300' : status === 'cancelled' ? 'text-rose-300' : 'text-white/60';
  return { label, cls };
}

export default async function SuperadminUsersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; type?: UserType; sub?: UserSubFilter }>;
}) {
  const sp = await searchParams;
  const { rows, total } = await listUsers({
    query: sp.q,
    type: (sp.type as UserType) ?? 'all',
    sub: (sp.sub as UserSubFilter) ?? 'all',
    limit: 100,
  });

  return (
    <div className="p-6">
      <div className="mb-4 flex items-baseline justify-between">
        <h1 className="text-[20px] font-semibold tracking-tight text-white">Пользователи</h1>
        <div className="text-[11px] text-white/45">Всего: {total.toLocaleString('ru-RU')}</div>
      </div>

      <div className="mb-4">
        <UsersFilters />
      </div>

      <div className="overflow-hidden rounded-xl border border-white/10">
        <table className="w-full table-fixed border-collapse text-[13px]">
          <thead>
            <tr className="bg-white/[0.03] text-[11px] uppercase tracking-wider text-white/50">
              <th className="w-[24%] px-3 py-2.5 text-left font-medium">Имя</th>
              <th className="w-[9%] px-3 py-2.5 text-left font-medium">Тип</th>
              <th className="w-[22%] px-3 py-2.5 text-left font-medium">Email</th>
              <th className="w-[11%] px-3 py-2.5 text-left font-medium">Подписка</th>
              <th className="w-[10%] px-3 py-2.5 text-left font-medium">Whitelist</th>
              <th className="w-[12%] px-3 py-2.5 text-left font-medium">Город</th>
              <th className="w-[12%] px-3 py-2.5 text-left font-medium">Регистрация</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-3 py-10 text-center text-white/40">
                  Ничего не найдено
                </td>
              </tr>
            ) : (
              rows.map((r) => {
                const sp = subPill(r.subscriptionTier, r.subscriptionStatus);
                return (
                  <tr
                    key={r.id}
                    className="border-t border-white/5 transition-colors hover:bg-white/[0.03]"
                  >
                    <td className="truncate px-3 py-2.5">
                      <Link href={`/superadmin/users/${r.id}`} className="text-white/90 hover:text-violet-300">
                        {r.displayName}
                      </Link>
                      {r.phone && <div className="truncate text-[11px] text-white/40">{r.phone}</div>}
                    </td>
                    <td className="px-3 py-2.5">
                      <span className={['inline-flex h-5 items-center rounded border px-1.5 text-[10px] font-medium uppercase tracking-wider', typePill(r.type)].join(' ')}>
                        {TYPE_LABEL[r.type] ?? '—'}
                      </span>
                    </td>
                    <td className="truncate px-3 py-2.5 text-white/70">{r.email ?? '—'}</td>
                    <td className={['truncate px-3 py-2.5', sp.cls].join(' ')}>{sp.label}</td>
                    <td className="px-3 py-2.5">
                      {r.whitelisted ? (
                        <span className="text-emerald-400">✓</span>
                      ) : (
                        <span className="text-white/25">—</span>
                      )}
                    </td>
                    <td className="truncate px-3 py-2.5 text-white/65">{r.city ?? '—'}</td>
                    <td className="truncate px-3 py-2.5 text-white/55">
                      {new Date(r.createdAt).toLocaleDateString('ru-RU', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
