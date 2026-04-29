/** --- YAML
 * name: Mini App Salon Team Page
 * description: Admin tabbed dashboard. 4 таба:
 *              - Команда: текущие мастера + админы (read-only summary)
 *              - Заявки: pending join requests с Approve / Reject
 *              - Приглашения: outgoing invites с CTA «Пригласить» + cancel pending
 *              - Настройки: recruitment toggle + recruitment_message
 *              Все табы требуют admin/owner.
 * created: 2026-04-19
 * updated: 2026-04-26
 * --- */

'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import {
  Crown, Users2, Pause, UserCheck, Clock3, Inbox, Settings as SettingsIcon,
  Check, X, Loader2, Lock, Unlock, ExternalLink, Send, Search, UserPlus, MailX, BookOpen,
} from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';
import { useTelegram } from '@/components/miniapp/telegram-provider';
import { createClient } from '@/lib/supabase/client';
import { SalonCatalogTab } from '@/components/salon/admin/catalog-tab';
import { humanizeError } from '@/lib/format/error';

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

interface JoinRequest {
  id: string;
  status: 'pending' | 'approved' | 'rejected' | 'withdrawn';
  message: string | null;
  created_at: string;
  decided_at: string | null;
  master: {
    id: string;
    display_name: string | null;
    specialization: string | null;
    avatar_url: string | null;
    invite_code: string | null;
    rating: number | null;
    total_reviews: number | null;
    profile: { full_name: string | null } | { full_name: string | null }[] | null;
  } | null;
}

interface MasterInvite {
  id: string;
  status: 'pending' | 'accepted' | 'declined' | 'cancelled' | 'expired';
  message: string | null;
  created_at: string;
  decided_at: string | null;
  master: {
    id: string;
    display_name: string | null;
    specialization: string | null;
    avatar_url: string | null;
    invite_code: string | null;
    rating: number | null;
    total_reviews: number | null;
    profile?: { full_name: string | null; avatar_url: string | null } | { full_name: string | null; avatar_url: string | null }[] | null;
  } | null;
}

interface MasterCandidate {
  id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  avatar_url: string | null;
  specialization: string | null;
}

interface SalonSettings {
  recruitment_open: boolean;
  recruitment_message: string | null;
  team_mode: 'unified' | 'marketplace';
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
  } catch { /* ignore */ }
  return null;
}

type Tab = 'team' | 'requests' | 'invites' | 'catalog' | 'settings';

export default function MiniAppSalonTeamPage() {
  const params = useParams();
  const salonId = params.id as string;
  const { ready } = useTelegram();
  const [tab, setTab] = useState<Tab>('team');
  const [team, setTeam] = useState<TeamData | null>(null);
  const [requests, setRequests] = useState<JoinRequest[]>([]);
  const [invites, setInvites] = useState<MasterInvite[]>([]);
  const [settings, setSettings] = useState<SalonSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pendingReqCount, setPendingReqCount] = useState(0);
  const [pendingInvCount, setPendingInvCount] = useState(0);

  const fetchTeam = useCallback(async () => {
    const initData = getInitData();
    if (!initData) {
      setError('no_init_data');
      return;
    }
    const r = await fetch(`/api/telegram/m/salon/${salonId}/team`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ initData }),
    });
    if (r.ok) {
      const j = (await r.json()) as TeamData;
      setTeam(j);
    } else if (r.status === 403 || r.status === 401) {
      setError('forbidden');
    }
  }, [salonId]);

  const fetchRequests = useCallback(async () => {
    const r = await fetch(`/api/salon/${salonId}/join-requests`);
    if (r.ok) {
      const j = (await r.json()) as { requests: JoinRequest[] };
      setRequests(j.requests);
      setPendingReqCount(j.requests.filter((x) => x.status === 'pending').length);
    }
  }, [salonId]);

  const fetchInvites = useCallback(async () => {
    const r = await fetch(`/api/salon/${salonId}/master-invites`);
    if (r.ok) {
      const j = (await r.json()) as { invites: MasterInvite[] };
      setInvites(j.invites);
      setPendingInvCount(j.invites.filter((x) => x.status === 'pending').length);
    }
  }, [salonId]);

  const fetchSettings = useCallback(async () => {
    const supabase = createClient();
    const { data } = await supabase
      .from('salons')
      .select('recruitment_open, recruitment_message, team_mode')
      .eq('id', salonId)
      .maybeSingle();
    if (data) setSettings(data as SalonSettings);
  }, [salonId]);

  useEffect(() => {
    if (!ready) return;
    setLoading(true);
    Promise.all([fetchTeam(), fetchRequests(), fetchInvites(), fetchSettings()])
      .finally(() => setLoading(false));
  }, [ready, fetchTeam, fetchRequests, fetchInvites, fetchSettings]);

  if (loading) {
    return (
      <div className="space-y-3 p-4">
        <div className="h-5 w-32 animate-pulse rounded bg-neutral-200" />
        <div className="h-16 animate-pulse rounded-xl bg-neutral-100" />
        <div className="h-16 animate-pulse rounded-xl bg-neutral-100" />
      </div>
    );
  }

  if (error === 'forbidden') {
    return <div className="p-6 text-center text-sm text-neutral-600">Только админ салона видит эту страницу.</div>;
  }

  if (error || !team) {
    return <div className="p-6 text-center text-sm text-neutral-600">Не удалось загрузить команду.</div>;
  }

  return (
    <div className="space-y-4 p-4">
      <div className="-mx-1 flex gap-2 overflow-x-auto px-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <TabButton active={tab === 'team'} onClick={() => setTab('team')}>
          <Users2 className="size-3.5" /> Команда
          <span className="text-neutral-500">{team.members.length}</span>
        </TabButton>
        <TabButton active={tab === 'requests'} onClick={() => setTab('requests')}>
          <Inbox className="size-3.5" /> Заявки
          {pendingReqCount > 0 && (
            <span className="rounded-full bg-amber-500 px-1.5 text-[10px] font-bold text-white">{pendingReqCount}</span>
          )}
        </TabButton>
        <TabButton active={tab === 'invites'} onClick={() => setTab('invites')}>
          <Send className="size-3.5" /> Приглашения
          {pendingInvCount > 0 && (
            <span className="rounded-full bg-indigo-500 px-1.5 text-[10px] font-bold text-white">{pendingInvCount}</span>
          )}
        </TabButton>
        {settings?.team_mode === 'unified' && (
          <TabButton active={tab === 'catalog'} onClick={() => setTab('catalog')}>
            <BookOpen className="size-3.5" /> Каталог
          </TabButton>
        )}
        <TabButton active={tab === 'settings'} onClick={() => setTab('settings')}>
          <SettingsIcon className="size-3.5" /> Настройки
        </TabButton>
      </div>

      {tab === 'team' && <TeamTab team={team} />}
      {tab === 'requests' && (
        <RequestsTab
          salonId={salonId}
          requests={requests}
          onChanged={() => {
            fetchRequests();
            fetchTeam();
          }}
        />
      )}
      {tab === 'invites' && (
        <InvitesTab
          salonId={salonId}
          invites={invites}
          onChanged={() => {
            fetchInvites();
            fetchTeam();
          }}
        />
      )}
      {tab === 'catalog' && settings?.team_mode === 'unified' && (
        <SalonCatalogTab salonId={salonId} />
      )}
      {tab === 'settings' && settings && (
        <SettingsTab
          salonId={salonId}
          initial={settings}
          onChanged={fetchSettings}
        />
      )}
    </div>
  );
}

function TabButton({
  active, onClick, children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        'inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-3.5 py-1.5 text-[12px] font-semibold transition-colors ' +
        (active
          ? 'border-neutral-900 bg-neutral-900 text-white'
          : 'border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-50')
      }
    >
      {children}
    </button>
  );
}

/* ───────── Team tab ───────── */

function TeamTab({ team }: { team: TeamData }) {
  const masters = team.members.filter((m) => m.role === 'master');
  const staff = team.members.filter((m) => m.role !== 'master');
  const isUnified = team.salon.team_mode === 'unified';

  return (
    <div className="space-y-5">
      <section>
        <h2 className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-neutral-500">
          <Users2 className="size-3.5" /> Мастера
          <span className="text-neutral-400">({masters.length})</span>
        </h2>
        {masters.length === 0 ? (
          <EmptyBlock text="Пока нет мастеров — заявки придут на вкладку «Заявки»." />
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
          <h2 className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-neutral-500">
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

      <Link
        href={`/s/${team.salon.id}`}
        target="_blank"
        rel="noopener"
        className="inline-flex items-center gap-1.5 text-[12px] text-neutral-700 hover:underline"
      >
        <ExternalLink className="size-3" />
        Открыть публичную страницу
      </Link>
    </div>
  );
}

function MemberRow({ m, isUnified }: { m: Member; isUnified: boolean }) {
  return (
    <li className="flex items-center gap-3 rounded-xl border border-neutral-200 bg-white p-3">
      <Avatar name={m.display_name} url={m.avatar_url} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="truncate text-sm font-semibold text-neutral-900">{m.display_name ?? 'Без имени'}</span>
          {m.is_owner && <Crown className="size-3.5 shrink-0 text-amber-500" />}
          {m.status === 'suspended' && <Pause className="size-3.5 shrink-0 text-neutral-400" />}
          {m.status === 'pending' && <Clock3 className="size-3.5 shrink-0 text-indigo-500" />}
          {m.status === 'active' && m.role !== 'master' && <UserCheck className="size-3.5 shrink-0 text-emerald-500" />}
        </div>
        <div className="truncate text-[12px] text-neutral-500">
          {m.role === 'master' ? (m.specialization ?? 'Мастер') : m.role === 'receptionist' ? 'Ресепшн' : 'Администратор'}
        </div>
      </div>
      {m.role === 'master' && (
        <div className="shrink-0 text-right">
          <div className="text-[12px] font-semibold tabular-nums text-neutral-900">{m.appointments_week}</div>
          <div className="text-[10px] text-neutral-400">нед.</div>
          {m.commission_percent !== null && isUnified && (
            <div className="mt-0.5 text-[10px] text-neutral-500">{m.commission_percent}%</div>
          )}
          {m.rent_amount !== null && !isUnified && (
            <div className="mt-0.5 text-[10px] tabular-nums text-neutral-500">
              {new Intl.NumberFormat('ru-RU').format(m.rent_amount)} ₴
            </div>
          )}
        </div>
      )}
    </li>
  );
}

/* ───────── Requests tab ───────── */

function RequestsTab({
  salonId,
  requests,
  onChanged,
}: {
  salonId: string;
  requests: JoinRequest[];
  onChanged: () => void;
}) {
  const pending = requests.filter((r) => r.status === 'pending');
  const decided = requests.filter((r) => r.status !== 'pending').slice(0, 10);

  if (requests.length === 0) {
    return (
      <EmptyBlock text="Заявок пока нет. Поделись публичной страницей салона — мастера увидят кнопку «Запросить вступление»." />
    );
  }

  return (
    <div className="space-y-5">
      {pending.length > 0 && (
        <section>
          <h2 className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-amber-700">
            <Inbox className="size-3.5" /> Ждут ответа
            <span className="text-amber-600">({pending.length})</span>
          </h2>
          <ul className="space-y-2">
            {pending.map((r) => (
              <RequestRow key={r.id} r={r} salonId={salonId} onChanged={onChanged} />
            ))}
          </ul>
        </section>
      )}
      {decided.length > 0 && (
        <section>
          <h2 className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-neutral-500">
            История
          </h2>
          <ul className="space-y-2">
            {decided.map((r) => (
              <RequestRow key={r.id} r={r} salonId={salonId} onChanged={onChanged} readonly />
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function RequestRow({
  r, salonId, onChanged, readonly,
}: {
  r: JoinRequest;
  salonId: string;
  onChanged: () => void;
  readonly?: boolean;
}) {
  const [busy, setBusy] = useState<'approve' | 'reject' | null>(null);
  const profile = Array.isArray(r.master?.profile) ? r.master?.profile[0] : r.master?.profile;
  const name = (r.master?.display_name || profile?.full_name || 'Мастер').trim();

  async function decide(action: 'approve' | 'reject') {
    setBusy(action);
    try {
      const res = await fetch(`/api/salon/${salonId}/join-requests`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ request_id: r.id, action }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error((json as { error?: string }).error || 'Не удалось обработать заявку');
        return;
      }
      toast.success(action === 'approve' ? `${name} в команде` : 'Заявка отклонена');
      onChanged();
    } finally {
      setBusy(null);
    }
  }

  const statusBadge =
    r.status === 'approved' ? (
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
        <Check className="size-3" /> Принят
      </span>
    ) : r.status === 'rejected' ? (
      <span className="inline-flex items-center gap-1 rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-semibold text-rose-700">
        <X className="size-3" /> Отклонено
      </span>
    ) : r.status === 'withdrawn' ? (
      <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-[10px] font-semibold text-neutral-500">
        Отозвано
      </span>
    ) : null;

  return (
    <li className="rounded-xl border border-neutral-200 bg-white p-3">
      <div className="flex items-start gap-3">
        <Avatar name={r.master?.display_name ?? null} url={r.master?.avatar_url ?? null} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <p className="truncate text-sm font-semibold text-neutral-900">{name}</p>
            {statusBadge}
          </div>
          {r.master?.specialization && (
            <p className="text-[12px] text-neutral-500">{r.master.specialization}</p>
          )}
          {(r.master?.rating ?? 0) > 0 && (
            <p className="text-[11px] text-neutral-400">
              ★ {(r.master?.rating ?? 0).toFixed(1)} · {r.master?.total_reviews ?? 0} отзывов
            </p>
          )}
          {r.message && (
            <p className="mt-2 rounded-lg bg-neutral-50 p-2 text-[12px] text-neutral-700">«{r.message}»</p>
          )}
          {r.master?.invite_code && (
            <Link
              href={`/m/${r.master.invite_code}`}
              target="_blank"
              rel="noopener"
              className="mt-2 inline-flex items-center gap-1 text-[11px] font-semibold text-neutral-700 hover:underline"
            >
              Открыть профиль <ExternalLink className="size-3" />
            </Link>
          )}
        </div>
      </div>

      {!readonly && r.status === 'pending' && (
        <div className="mt-3 flex justify-end gap-2">
          <button
            type="button"
            onClick={() => decide('reject')}
            disabled={busy !== null}
            className="inline-flex items-center gap-1 rounded-full border border-rose-200 bg-white px-3 py-1.5 text-[12px] font-semibold text-rose-700 hover:bg-rose-50 disabled:opacity-50"
          >
            {busy === 'reject' ? <Loader2 className="size-3 animate-spin" /> : <X className="size-3" />}
            Отклонить
          </button>
          <button
            type="button"
            onClick={() => decide('approve')}
            disabled={busy !== null}
            className="inline-flex items-center gap-1 rounded-[var(--brand-radius-lg)] bg-neutral-900 px-3 py-1.5 text-[12px] font-semibold text-white disabled:opacity-50"
          >
            {busy === 'approve' ? <Loader2 className="size-3 animate-spin" /> : <Check className="size-3" />}
            Принять
          </button>
        </div>
      )}
    </li>
  );
}

/* ───────── Invites tab (admin → master) ───────── */

function InvitesTab({
  salonId,
  invites,
  onChanged,
}: {
  salonId: string;
  invites: MasterInvite[];
  onChanged: () => void;
}) {
  const [showSearch, setShowSearch] = useState(false);
  const pending = invites.filter((i) => i.status === 'pending');
  const decided = invites.filter((i) => i.status !== 'pending').slice(0, 10);

  return (
    <div className="space-y-5">
      <button
        type="button"
        onClick={() => setShowSearch(true)}
        className="flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-neutral-300 bg-white p-4 text-[14px] font-semibold text-neutral-700 hover:border-neutral-900 hover:bg-neutral-50"
      >
        <UserPlus className="size-4" />
        Пригласить мастера в команду
      </button>

      {showSearch && (
        <InviteSearchSheet
          salonId={salonId}
          onClose={() => setShowSearch(false)}
          onInvited={() => {
            setShowSearch(false);
            onChanged();
          }}
        />
      )}

      {pending.length > 0 && (
        <section>
          <h2 className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-indigo-700">
            <Send className="size-3.5" /> Ждут ответа мастера
            <span className="text-indigo-600">({pending.length})</span>
          </h2>
          <ul className="space-y-2">
            {pending.map((i) => (
              <InviteRow key={i.id} i={i} salonId={salonId} onChanged={onChanged} />
            ))}
          </ul>
        </section>
      )}

      {decided.length > 0 && (
        <section>
          <h2 className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-neutral-500">
            История приглашений
          </h2>
          <ul className="space-y-2">
            {decided.map((i) => (
              <InviteRow key={i.id} i={i} salonId={salonId} onChanged={onChanged} readonly />
            ))}
          </ul>
        </section>
      )}

      {invites.length === 0 && !showSearch && (
        <EmptyBlock text="Пока никого не приглашал. Найди существующих мастеров CRES-CA по имени или контакту и предложи присоединиться." />
      )}
    </div>
  );
}

function InviteRow({
  i, salonId, onChanged, readonly,
}: {
  i: MasterInvite;
  salonId: string;
  onChanged: () => void;
  readonly?: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const profile = Array.isArray(i.master?.profile) ? i.master?.profile[0] : i.master?.profile;
  const name = (i.master?.display_name || profile?.full_name || 'Мастер').trim();

  async function cancel() {
    setBusy(true);
    try {
      const res = await fetch(`/api/salon/${salonId}/master-invites/${i.id}`, { method: 'DELETE' });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error((json as { error?: string }).error || 'Не удалось отменить');
        return;
      }
      toast.success('Приглашение отозвано');
      onChanged();
    } finally {
      setBusy(false);
    }
  }

  const statusBadge =
    i.status === 'accepted' ? (
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
        <Check className="size-3" /> Принято
      </span>
    ) : i.status === 'declined' ? (
      <span className="inline-flex items-center gap-1 rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-semibold text-rose-700">
        <X className="size-3" /> Отклонено
      </span>
    ) : i.status === 'cancelled' ? (
      <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-[10px] font-semibold text-neutral-500">
        Отозвано
      </span>
    ) : i.status === 'expired' ? (
      <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-[10px] font-semibold text-neutral-500">
        Истекло
      </span>
    ) : null;

  return (
    <li className="rounded-xl border border-neutral-200 bg-white p-3">
      <div className="flex items-start gap-3">
        <Avatar name={i.master?.display_name ?? null} url={i.master?.avatar_url ?? null} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <p className="truncate text-sm font-semibold text-neutral-900">{name}</p>
            {statusBadge}
          </div>
          {i.master?.specialization && (
            <p className="text-[12px] text-neutral-500">{i.master.specialization}</p>
          )}
          {i.message && (
            <p className="mt-2 rounded-lg bg-neutral-50 p-2 text-[12px] text-neutral-700">«{i.message}»</p>
          )}
        </div>
      </div>

      {!readonly && i.status === 'pending' && (
        <div className="mt-3 flex justify-end">
          <button
            type="button"
            onClick={cancel}
            disabled={busy}
            className="inline-flex items-center gap-1 rounded-full border border-neutral-200 bg-white px-3 py-1.5 text-[12px] font-semibold text-neutral-700 hover:bg-neutral-50 disabled:opacity-50"
          >
            {busy ? <Loader2 className="size-3 animate-spin" /> : <MailX className="size-3" />}
            Отозвать
          </button>
        </div>
      )}
    </li>
  );
}

function InviteSearchSheet({
  salonId, onClose, onInvited,
}: {
  salonId: string;
  onClose: () => void;
  onInvited: () => void;
}) {
  const [q, setQ] = useState('');
  const [results, setResults] = useState<MasterCandidate[]>([]);
  const [searching, setSearching] = useState(false);
  const [selected, setSelected] = useState<MasterCandidate | null>(null);
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (q.length < 2) {
      setResults([]);
      return;
    }
    let cancelled = false;
    setSearching(true);
    const t = setTimeout(async () => {
      const r = await fetch(`/api/salon/${salonId}/invites/search-masters?q=${encodeURIComponent(q)}`)
        .then((res) => res.json())
        .catch(() => null);
      if (!cancelled && r?.masters) setResults(r.masters as MasterCandidate[]);
      if (!cancelled) setSearching(false);
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [q, salonId]);

  async function send() {
    if (!selected) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/salon/${salonId}/master-invites`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ master_id: selected.id, message: message.trim() || undefined }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        const err = (json as { error?: string }).error;
        const msg =
          err === 'already_member' ? 'Этот мастер уже в команде' :
          err === 'already_invited' ? 'Этому мастеру уже отправлено приглашение' :
          'Не удалось отправить';
        toast.error(msg);
        return;
      }
      toast.success(`${selected.full_name || 'Мастер'} получит приглашение`);
      onInvited();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4" onClick={onClose}>
      <div
        className="w-full max-w-md rounded-t-3xl bg-white p-5 shadow-2xl sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        {!selected ? (
          <>
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-[16px] font-semibold text-neutral-900">Найти мастера</h3>
              <button type="button" onClick={onClose} className="rounded-full p-1 text-neutral-500 hover:bg-neutral-100">
                <X className="size-4" />
              </button>
            </div>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-neutral-400" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                autoFocus
                placeholder="Имя, email или телефон"
                className="block w-full rounded-2xl border border-neutral-200 bg-white py-2.5 pl-9 pr-3 text-[14px] text-neutral-900 outline-none focus:border-neutral-400"
              />
            </div>
            <div className="mt-3 max-h-80 overflow-y-auto">
              {q.length < 2 ? (
                <p className="py-6 text-center text-[12px] text-neutral-400">Введи минимум 2 символа</p>
              ) : searching ? (
                <p className="py-6 text-center text-[12px] text-neutral-400">Ищу…</p>
              ) : results.length === 0 ? (
                <p className="py-6 text-center text-[12px] text-neutral-400">Никого не найдено</p>
              ) : (
                <ul className="space-y-1.5">
                  {results.map((m) => (
                    <li key={m.id}>
                      <button
                        type="button"
                        onClick={() => setSelected(m)}
                        className="flex w-full items-center gap-3 rounded-xl border border-neutral-200 bg-white p-2.5 text-left hover:bg-neutral-50"
                      >
                        <Avatar name={m.full_name} url={m.avatar_url} />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[13px] font-semibold text-neutral-900">
                            {m.full_name || 'Без имени'}
                          </p>
                          <p className="truncate text-[11px] text-neutral-500">
                            {m.specialization || m.email || m.phone || '—'}
                          </p>
                        </div>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </>
        ) : (
          <>
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-[16px] font-semibold text-neutral-900">Текст приглашения</h3>
              <button type="button" onClick={() => setSelected(null)} className="rounded-full p-1 text-neutral-500 hover:bg-neutral-100">
                <X className="size-4" />
              </button>
            </div>

            <div className="mb-3 flex items-center gap-3 rounded-xl border border-neutral-200 bg-neutral-50 p-3">
              <Avatar name={selected.full_name} url={selected.avatar_url} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-semibold text-neutral-900">{selected.full_name || 'Без имени'}</p>
                <p className="truncate text-[11px] text-neutral-500">
                  {selected.specialization || selected.email || selected.phone || '—'}
                </p>
              </div>
            </div>

            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value.slice(0, 500))}
              rows={4}
              placeholder="Напр.: «Команда из 5 мастеров, ищем человека на маникюр. Свободные слоты по 4 раза в неделю.»"
              className="block w-full resize-none rounded-2xl border border-neutral-200 bg-white p-3 text-[13px] text-neutral-900 outline-none focus:border-neutral-400"
            />

            <div className="mt-3 flex items-center justify-between gap-3">
              <p className="text-[11px] text-neutral-400">{message.length} / 500</p>
              <button
                type="button"
                onClick={send}
                disabled={submitting}
                className="inline-flex items-center gap-1.5 rounded-[var(--brand-radius-lg)] bg-neutral-900 px-4 py-2 text-[13px] font-semibold text-white disabled:opacity-50"
              >
                {submitting ? <Loader2 className="size-3.5 animate-spin" /> : <Send className="size-3.5" />}
                Отправить приглашение
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/* ───────── Settings tab ───────── */

function SettingsTab({
  salonId, initial, onChanged,
}: {
  salonId: string;
  initial: SalonSettings;
  onChanged: () => void;
}) {
  const [open, setOpen] = useState(initial.recruitment_open);
  const [msg, setMsg] = useState(initial.recruitment_message ?? '');
  const [mode, setMode] = useState<'unified' | 'marketplace'>(initial.team_mode ?? 'marketplace');
  const [busy, setBusy] = useState(false);
  const [savingMsg, setSavingMsg] = useState(false);
  const [savingMode, setSavingMode] = useState(false);

  async function toggleRecruitment(next: boolean) {
    setBusy(true);
    try {
      const supabase = createClient();
      const { error } = await supabase
        .from('salons')
        .update({ recruitment_open: next })
        .eq('id', salonId);
      if (error) {
        toast.error(humanizeError(error));
        return;
      }
      setOpen(next);
      toast.success(next ? 'Набор открыт' : 'Набор закрыт');
      onChanged();
    } finally {
      setBusy(false);
    }
  }

  async function changeMode(next: 'unified' | 'marketplace') {
    if (next === mode) return;
    if (next === 'marketplace' && mode === 'unified') {
      if (!confirm('Перейти на свободный режим? Каталог салона останется в архиве — каждый мастер вернётся к своему прайсу.')) {
        return;
      }
    }
    setSavingMode(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.from('salons').update({ team_mode: next }).eq('id', salonId);
      if (error) {
        toast.error(humanizeError(error));
        return;
      }
      setMode(next);
      toast.success(next === 'unified' ? 'Включен единый каталог' : 'Включен свободный режим');
      onChanged();
    } finally {
      setSavingMode(false);
    }
  }

  async function saveMessage() {
    setSavingMsg(true);
    try {
      const supabase = createClient();
      const next = msg.trim();
      const { error } = await supabase
        .from('salons')
        .update({ recruitment_message: next || null })
        .eq('id', salonId);
      if (error) {
        toast.error(humanizeError(error));
        return;
      }
      toast.success('Сообщение мастерам сохранено');
      onChanged();
    } finally {
      setSavingMsg(false);
    }
  }

  return (
    <div className="space-y-5">
      <section className="space-y-3">
        <h2 className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500">
          Тип команды
        </h2>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => changeMode('marketplace')}
            disabled={savingMode}
            className={
              'rounded-2xl border p-4 text-left transition-colors disabled:opacity-50 ' +
              (mode === 'marketplace'
                ? 'border-neutral-900 bg-neutral-900 text-white'
                : 'border-neutral-200 bg-white text-neutral-900 hover:bg-neutral-50')
            }
          >
            <p className="text-[13px] font-bold">Свободный режим</p>
            <p className={'mt-1 text-[12px] ' + (mode === 'marketplace' ? 'text-white/80' : 'text-neutral-500')}>
              У каждого мастера свой прайс, своё расписание, своя карточка клиентов.
              Салон — общая обложка для команды.
            </p>
          </button>
          <button
            type="button"
            onClick={() => changeMode('unified')}
            disabled={savingMode}
            className={
              'rounded-2xl border p-4 text-left transition-colors disabled:opacity-50 ' +
              (mode === 'unified'
                ? 'border-neutral-900 bg-neutral-900 text-white'
                : 'border-neutral-200 bg-white text-neutral-900 hover:bg-neutral-50')
            }
          >
            <p className="text-[13px] font-bold">Единый каталог</p>
            <p className={'mt-1 text-[12px] ' + (mode === 'unified' ? 'text-white/80' : 'text-neutral-500')}>
              Услуги создаёт админ. Любой мастер команды может их выполнять.
              Клиент сначала выбирает услугу, потом мастера.
            </p>
          </button>
        </div>
        <p className="text-[11px] text-neutral-400">
          Можно переключать в любой момент. На переключении ничего не теряется — старые услуги
          у мастеров остаются, единый каталог сохраняется в архиве.
        </p>
      </section>

      <section className="rounded-2xl border border-neutral-200 bg-white p-4">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg bg-neutral-100 text-neutral-700">
            {open ? <Unlock className="size-4" /> : <Lock className="size-4" />}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-3">
              <p className="text-[14px] font-semibold text-neutral-900">
                {open ? 'Набор открыт' : 'Набор закрыт'}
              </p>
              <button
                type="button"
                onClick={() => toggleRecruitment(!open)}
                disabled={busy}
                className={
                  'relative h-6 w-11 shrink-0 rounded-full transition-colors disabled:opacity-50 ' +
                  (open ? 'bg-neutral-900' : 'bg-neutral-300')
                }
              >
                <span
                  className="absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all"
                  style={{ left: open ? 22 : 2 }}
                />
              </button>
            </div>
            <p className="mt-1 text-[13px] text-neutral-500">
              {open
                ? 'Мастера видят кнопку «Запросить вступление» на публичной странице салона.'
                : 'Заявки временно не принимаются. Уже отправленные заявки можно одобрить.'}
            </p>
          </div>
        </div>
      </section>

      <section>
        <h2 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-neutral-500">
          Сообщение мастерам
        </h2>
        <textarea
          value={msg}
          onChange={(e) => setMsg(e.target.value.slice(0, 600))}
          rows={4}
          placeholder="Напр.: «Ищем мастера маникюра на 2 рабочих дня. Команда из 5 человек, дружный коллектив.»"
          className="block w-full resize-none rounded-2xl border border-neutral-200 bg-white p-3 text-[13px] text-neutral-900 outline-none focus:border-neutral-400"
        />
        <div className="mt-2 flex items-center justify-between gap-3">
          <p className="text-[11px] text-neutral-400">{msg.length} / 600</p>
          <button
            type="button"
            onClick={saveMessage}
            disabled={savingMsg}
            className="inline-flex items-center gap-1.5 rounded-[var(--brand-radius-lg)] bg-neutral-900 px-4 py-1.5 text-[12px] font-semibold text-white disabled:opacity-50"
          >
            {savingMsg && <Loader2 className="size-3 animate-spin" />}
            Сохранить
          </button>
        </div>
      </section>
    </div>
  );
}

/* ───────── Helpers ───────── */

function Avatar({ name, url }: { name: string | null; url: string | null }) {
  return (
    <div className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-neutral-100 text-sm font-bold text-neutral-700">
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt="" className="size-full object-cover" />
      ) : (
        (name || 'M')[0]?.toUpperCase()
      )}
    </div>
  );
}

function EmptyBlock({ text }: { text: string }) {
  return (
    <div className="rounded-xl border border-dashed border-neutral-300 p-5 text-center text-[12px] text-neutral-500">
      {text}
    </div>
  );
}
