/** --- YAML
 * name: Mini App Salon Team Page
 * description: Admin-only. Lists salon members with role/status/load. Actions (edit rates, suspend)
 *              live on the web page; Mini App is a compact at-a-glance view.
 * created: 2026-04-19
 * --- */

'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Crown, Users2, Pause, UserCheck, Clock3 } from 'lucide-react';
import { useTelegram } from '@/components/miniapp/telegram-provider';

interface Member {
  id: string;
  role: 'admin' | 'master' | 'receptionist';
  status: 'pending' | 'active' | 'suspended';
  commission_percent: number | null;
  rent_amount: number | null;
  display_name: string | null;
  avatar_url: string | null;
  specialization: string | null;
  is_owner: boolean;
  appointments_week: number;
}

interface TeamData {
  salon: { id: string; name: string; team_mode: 'unified' | 'marketplace' };
  members: Member[];
}

function getInitData(): string | null {
  if (typeof window === 'undefined') return null;
  const w = window as { Telegram?: { WebApp?: { initData?: string } } };
  const live = w.Telegram?.WebApp?.initData;
  if (live) return live;
  try {
    const stash = sessionStorage.getItem('cres:tg');
    if (stash) {
      const parsed = JSON.parse(stash) as { initData?: string };
      if (parsed.initData) return parsed.initData;
    }
  } catch {
    /* ignore */
  }
  return null;
}

function Avatar({ name, url }: { name: string | null; url: string | null }) {
  return (
    <div className="size-10 rounded-full bg-white/10 flex items-center justify-center text-sm font-bold overflow-hidden shrink-0">
      {url ? <img src={url} alt="" className="size-full object-cover" /> : (name || 'M')[0].toUpperCase()}
    </div>
  );
}

export default function MiniAppSalonTeamPage() {
  const params = useParams();
  const salonId = params.id as string;
  const { ready } = useTelegram();
  const [data, setData] = useState<TeamData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!ready) return;
    const initData = getInitData();
    if (!initData) {
      setError('no_init_data');
      setLoading(false);
      return;
    }
    let cancelled = false;
    fetch(`/api/telegram/m/salon/${salonId}/team`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ initData }),
    })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((j: TeamData) => {
        if (!cancelled) setData(j);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : 'error');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [ready, salonId]);

  if (loading) {
    return (
      <div className="p-4 space-y-3">
        <div className="h-5 w-32 bg-white/10 rounded animate-pulse" />
        <div className="h-16 bg-white/5 rounded-xl animate-pulse" />
        <div className="h-16 bg-white/5 rounded-xl animate-pulse" />
      </div>
    );
  }

  if (error || !data) {
    return <div className="p-6 text-center text-sm text-neutral-600">Нет доступа или ошибка загрузки</div>;
  }

  const masters = data.members.filter((m) => m.role === 'master');
  const staff = data.members.filter((m) => m.role !== 'master');
  const isUnified = data.salon.team_mode === 'unified';

  return (
    <div className="p-4 space-y-5">
      <section>
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-xs uppercase tracking-wider text-neutral-500 flex items-center gap-1.5">
            <Users2 className="size-3.5" /> Мастера
            <span className="text-neutral-400">({masters.length})</span>
          </h2>
        </div>
        {masters.length === 0 ? (
          <EmptyBlock text="Пока нет мастеров" />
        ) : (
          <ul className="space-y-2">
            {masters.map((m) => (
              <MemberRow key={m.id} m={m} isUnified={isUnified} />
            ))}
          </ul>
        )}
      </section>

      {staff.length > 0 && (
        <section>
          <h2 className="text-xs uppercase tracking-wider text-neutral-500 flex items-center gap-1.5 mb-2">
            <Crown className="size-3.5" /> Админы / ресепшн
            <span className="text-neutral-400">({staff.length})</span>
          </h2>
          <ul className="space-y-2">
            {staff.map((m) => (
              <MemberRow key={m.id} m={m} isUnified={isUnified} />
            ))}
          </ul>
        </section>
      )}

      <p className="text-[11px] text-neutral-400 leading-relaxed text-center pt-2">
        Изменения ставок и приглашения — на сайте в разделе «Команда».
      </p>
    </div>
  );
}

function MemberRow({ m, isUnified }: { m: Member; isUnified: boolean }) {
  return (
    <li className="rounded-xl border border-neutral-200 bg-white border-neutral-200 p-3 flex items-center gap-3">
      <Avatar name={m.display_name} url={m.avatar_url} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="text-sm font-medium truncate">{m.display_name ?? 'Без имени'}</span>
          {m.is_owner && <Crown className="size-3.5 text-amber-400 shrink-0" />}
          {m.status === 'suspended' && <Pause className="size-3.5 text-neutral-400 shrink-0" />}
          {m.status === 'pending' && <Clock3 className="size-3.5 text-indigo-400 shrink-0" />}
          {m.status === 'active' && m.role !== 'master' && (
            <UserCheck className="size-3.5 text-emerald-400 shrink-0" />
          )}
        </div>
        <div className="text-[11px] text-neutral-500 truncate">
          {m.role === 'master'
            ? m.specialization ?? 'Мастер'
            : m.role === 'receptionist'
              ? 'Ресепшн'
              : 'Администратор'}
        </div>
      </div>
      {m.role === 'master' && (
        <div className="text-right shrink-0">
          <div className="text-xs font-semibold">{m.appointments_week}</div>
          <div className="text-[10px] text-neutral-400">нед.</div>
          {m.commission_percent !== null && isUnified && (
            <div className="text-[10px] text-neutral-500 mt-0.5">{m.commission_percent}%</div>
          )}
          {m.rent_amount !== null && !isUnified && (
            <div className="text-[10px] text-neutral-500 mt-0.5">
              {new Intl.NumberFormat('ru-RU').format(m.rent_amount)} ₴
            </div>
          )}
        </div>
      )}
    </li>
  );
}

function EmptyBlock({ text }: { text: string }) {
  return (
    <div className="rounded-xl border border-dashed border-neutral-200 p-5 text-center text-xs text-neutral-400">
      {text}
    </div>
  );
}
