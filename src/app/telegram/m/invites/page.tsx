/** --- YAML
 * name: MasterMiniAppInvites
 * description: Master Mini App — список приглашений в команды/салоны.
 *              Master видит pending invites и кнопки Принять / Отклонить.
 *              При accept делает RPC accept_master_team_invite (атомарно создаёт
 *              salon_members) → редирект в /telegram/m/salon/[id]/dashboard.
 * created: 2026-04-26
 * --- */

'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Loader2, Check, X, Inbox, Users, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';
import { MobilePage, PageHeader, EmptyState } from '@/components/miniapp/shells';
import { T, R, TYPE, PAGE_PADDING_X } from '@/components/miniapp/design';
import { useTelegram } from '@/components/miniapp/telegram-provider';
import { useMiniAppLocale, type MiniAppLang } from '@/lib/miniapp/use-locale';

const I18N: Record<MiniAppLang, {
  title: string;
  awaiting: (n: number) => string;
  emptySubtitle: string;
  emptyTitle: string;
  emptyDesc: string;
  active: string;
  history: string;
  statusAccepted: string; statusDeclined: string; statusCancelled: string; statusExpired: string;
  acceptBtn: string; declineBtn: string;
  toastNowInTeam: (n: string) => string;
  toastAccepted: string; toastDeclined: string;
  toastFailed: string;
  openSalonPage: string;
}> = {
  uk: {
    title: 'Запрошення',
    awaiting: (n) => `Чекають твоєї відповіді: ${n}`,
    emptySubtitle: 'Тут зʼявляться запрошення від адміністраторів салонів',
    emptyTitle: 'Немає запрошень',
    emptyDesc: 'Коли адмін салону покличе тебе в команду — запрошення зʼявиться тут.',
    active: 'Активні', history: 'Історія',
    statusAccepted: 'Прийнято', statusDeclined: 'Відхилено',
    statusCancelled: 'Відкликано адміном', statusExpired: 'Прострочено',
    acceptBtn: 'Прийняти', declineBtn: 'Відхилити',
    toastNowInTeam: (n) => `Тепер у команді «${n}»`,
    toastAccepted: 'Прийнято', toastDeclined: 'Відхилено',
    toastFailed: 'Не вдалося',
    openSalonPage: 'Відкрити сторінку салону',
  },
  ru: {
    title: 'Приглашения',
    awaiting: (n) => `Ждут твоего ответа: ${n}`,
    emptySubtitle: 'Здесь появятся приглашения от админов салонов',
    emptyTitle: 'Нет приглашений',
    emptyDesc: 'Когда админ салона позовёт тебя в команду, приглашение появится здесь.',
    active: 'Активные', history: 'История',
    statusAccepted: 'Принято', statusDeclined: 'Отклонено',
    statusCancelled: 'Отозвано админом', statusExpired: 'Истекло',
    acceptBtn: 'Принять', declineBtn: 'Отклонить',
    toastNowInTeam: (n) => `Теперь в команде «${n}»`,
    toastAccepted: 'Принято', toastDeclined: 'Отклонено',
    toastFailed: 'Не получилось',
    openSalonPage: 'Открыть страницу салона',
  },
  en: {
    title: 'Invitations',
    awaiting: (n) => `Waiting for your answer: ${n}`,
    emptySubtitle: 'Salon admin invitations will appear here',
    emptyTitle: 'No invitations',
    emptyDesc: 'When a salon admin invites you to the team, the invitation appears here.',
    active: 'Active', history: 'History',
    statusAccepted: 'Accepted', statusDeclined: 'Declined',
    statusCancelled: 'Withdrawn by admin', statusExpired: 'Expired',
    acceptBtn: 'Accept', declineBtn: 'Decline',
    toastNowInTeam: (n) => `Now on the «${n}» team`,
    toastAccepted: 'Accepted', toastDeclined: 'Declined',
    toastFailed: 'Failed',
    openSalonPage: 'Open salon page',
  },
};

interface Invite {
  id: string;
  status: 'pending' | 'accepted' | 'declined' | 'cancelled' | 'expired';
  message: string | null;
  created_at: string;
  decided_at: string | null;
  salon: {
    id: string;
    name: string;
    city: string | null;
    logo_url: string | null;
    cover_url: string | null;
    bio: string | null;
    owner_id: string;
  } | { id: string; name: string; city: string | null; logo_url: string | null; cover_url: string | null; bio: string | null; owner_id: string }[] | null;
}

export default function MasterMiniAppInvites() {
  const router = useRouter();
  const { ready, haptic } = useTelegram();
  const lang = useMiniAppLocale();
  const t = I18N[lang];
  const [invites, setInvites] = useState<Invite[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const r = await fetch('/api/master-invites');
      if (!r.ok) {
        setLoading(false);
        return;
      }
      const j = (await r.json()) as { invites: Invite[] };
      setInvites(j.invites ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!ready) return;
    load();
  }, [ready, load]);

  async function decide(invite: Invite, action: 'accept' | 'decline') {
    setBusy(`${invite.id}-${action}`);
    haptic('selection');
    try {
      const res = await fetch(`/api/master-invites/${invite.id}/${action}`, { method: 'POST' });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error((json as { error?: string }).error || t.toastFailed);
        return;
      }
      const salonObj = Array.isArray(invite.salon) ? invite.salon[0] : invite.salon;
      if (action === 'accept' && salonObj) {
        toast.success(t.toastNowInTeam(salonObj.name));
        router.replace(`/telegram/m/salon/${salonObj.id}/dashboard`);
      } else {
        toast.success(action === 'accept' ? t.toastAccepted : t.toastDeclined);
        await load();
      }
    } finally {
      setBusy(null);
    }
  }

  if (loading) {
    return (
      <MobilePage>
        <PageHeader title={t.title} />
        <div style={{ padding: PAGE_PADDING_X }}>
          <div style={{ height: 96, background: T.surface, borderRadius: R.md, opacity: 0.5 }} />
        </div>
      </MobilePage>
    );
  }

  const pending = invites.filter((i) => i.status === 'pending');
  const decided = invites.filter((i) => i.status !== 'pending').slice(0, 8);

  return (
    <MobilePage>
      <PageHeader
        title={t.title}
        subtitle={pending.length > 0 ? t.awaiting(pending.length) : t.emptySubtitle}
      />

      {invites.length === 0 ? (
        <EmptyState
          icon={<Inbox size={42} color={T.textSecondary} strokeWidth={1.5} />}
          title={t.emptyTitle}
          desc={t.emptyDesc}
        />
      ) : (
        <div style={{ padding: `8px ${PAGE_PADDING_X}px 24px`, display: 'flex', flexDirection: 'column', gap: 16 }}>
          {pending.length > 0 && (
            <section>
              <h2 style={{ ...TYPE.caption, color: T.textSecondary, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 8 }}>
                {t.active}
              </h2>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>
                {pending.map((i) => (
                  <InviteCard
                    key={i.id}
                    t={t}
                    invite={i}
                    busy={busy}
                    onAccept={() => decide(i, 'accept')}
                    onDecline={() => decide(i, 'decline')}
                  />
                ))}
              </ul>
            </section>
          )}

          {decided.length > 0 && (
            <section>
              <h2 style={{ ...TYPE.caption, color: T.textSecondary, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 8 }}>
                {t.history}
              </h2>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>
                {decided.map((i) => (
                  <InviteCard key={i.id} t={t} invite={i} readonly />
                ))}
              </ul>
            </section>
          )}
        </div>
      )}
    </MobilePage>
  );
}

function InviteCard({
  t,
  invite,
  busy,
  onAccept,
  onDecline,
  readonly,
}: {
  t: typeof I18N['ru'];
  invite: Invite;
  busy?: string | null;
  onAccept?: () => void;
  onDecline?: () => void;
  readonly?: boolean;
}) {
  const salon = Array.isArray(invite.salon) ? invite.salon[0] : invite.salon;
  if (!salon) return null;

  const acceptBusy = busy === `${invite.id}-accept`;
  const declineBusy = busy === `${invite.id}-decline`;

  const statusBadge =
    invite.status === 'accepted' ? (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 8px', fontSize: 11, fontWeight: 600, background: '#dcfce7', color: '#15803d', borderRadius: R.pill }}>
        <Check size={12} /> {t.statusAccepted}
      </span>
    ) : invite.status === 'declined' ? (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 8px', fontSize: 11, fontWeight: 600, background: '#fee2e2', color: '#b91c1c', borderRadius: R.pill }}>
        <X size={12} /> {t.statusDeclined}
      </span>
    ) : invite.status === 'cancelled' ? (
      <span style={{ padding: '2px 8px', fontSize: 11, fontWeight: 600, background: T.bgSubtle, color: T.textSecondary, borderRadius: R.pill }}>
        {t.statusCancelled}
      </span>
    ) : invite.status === 'expired' ? (
      <span style={{ padding: '2px 8px', fontSize: 11, fontWeight: 600, background: T.bgSubtle, color: T.textSecondary, borderRadius: R.pill }}>
        {t.statusExpired}
      </span>
    ) : null;

  return (
    <li
      style={{
        background: T.surface,
        border: `1px solid ${T.borderSubtle}`,
        borderRadius: R.md,
        padding: 16,
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
      }}
    >
      {salon.cover_url && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={salon.cover_url}
          alt=""
          style={{ width: '100%', height: 96, objectFit: 'cover', borderRadius: R.sm, marginBottom: 4 }}
        />
      )}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
        <div
          style={{
            width: 48,
            height: 48,
            borderRadius: 12,
            background: T.bgSubtle,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            overflow: 'hidden',
          }}
        >
          {salon.logo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={salon.logo_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          ) : (
            <Users size={22} color={T.textSecondary} strokeWidth={2} />
          )}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'space-between' }}>
            <p style={{ ...TYPE.bodyStrong, margin: 0, color: T.text }}>{salon.name}</p>
            {statusBadge}
          </div>
          {salon.city && <p style={{ ...TYPE.caption, margin: '2px 0 0' }}>{salon.city}</p>}
        </div>
      </div>

      {invite.message && (
        <div style={{ background: T.bgSubtle, borderRadius: R.sm, padding: 10, fontSize: 13, color: T.text, lineHeight: 1.45 }}>
          «{invite.message}»
        </div>
      )}

      <Link
        href={`/s/${salon.id}`}
        target="_blank"
        rel="noopener"
        style={{
          alignSelf: 'flex-start',
          display: 'inline-flex',
          alignItems: 'center',
          gap: 4,
          fontSize: 12,
          fontWeight: 600,
          color: T.textSecondary,
          textDecoration: 'none',
        }}
      >
        {t.openSalonPage}
        <ExternalLink size={12} />
      </Link>

      {!readonly && invite.status === 'pending' && (
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            type="button"
            onClick={onDecline}
            disabled={!!busy}
            style={{
              flex: 1,
              padding: '10px 12px',
              borderRadius: R.pill,
              border: `1px solid ${T.border}`,
              background: T.surface,
              color: T.text,
              fontSize: 13,
              fontWeight: 600,
              fontFamily: 'inherit',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              cursor: busy ? 'not-allowed' : 'pointer',
              opacity: busy ? 0.6 : 1,
            }}
          >
            {declineBusy ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <X size={14} />}
            {t.declineBtn}
          </button>
          <button
            type="button"
            onClick={onAccept}
            disabled={!!busy}
            style={{
              flex: 1,
              padding: '10px 12px',
              borderRadius: R.pill,
              border: 'none',
              background: T.text,
              color: T.surface,
              fontSize: 13,
              fontWeight: 600,
              fontFamily: 'inherit',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              cursor: busy ? 'not-allowed' : 'pointer',
              opacity: busy ? 0.6 : 1,
            }}
          >
            {acceptBusy ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <Check size={14} />}
            {t.acceptBtn}
          </button>
        </div>
      )}
    </li>
  );
}
