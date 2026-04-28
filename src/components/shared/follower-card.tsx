/** --- YAML
 * name: FollowerCard
 * description: Universal card for follower/user — shows avatar, name, entity type badge, follow/unfollow actions.
 * created: 2026-04-16
 * updated: 2026-04-16
 * --- */

'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { UserCheck, UserPlus, Scissors, Building2, User, UserRoundPlus } from 'lucide-react';

export type EntityType = 'client' | 'master' | 'salon';

interface FollowerCardProps {
  profileId: string;
  fullName: string;
  avatarUrl: string | null;
  phone?: string | null;
  entityType: EntityType;
  entityMeta?: {
    specialization?: string | null;
    salonName?: string | null;
    city?: string | null;
  } | null;
  followedAt?: string | null;
  mutual: boolean;
  isClient?: boolean;
  onFollow: () => Promise<void>;
  onUnfollow: () => Promise<void>;
  onAddToClients?: () => Promise<void>;
}

function getInitials(name: string) {
  return name
    .split(' ')
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

function hashColor(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  const colors = ['#3b82f6', '#2dd4bf', '#10b981', '#f59e0b', '#ef4444', '#06b6d4', '#6366f1', '#ec4899'];
  return colors[Math.abs(hash) % colors.length];
}

const ENTITY_BADGE: Record<EntityType, { bg: string; color: string; Icon: typeof User }> = {
  client: { bg: 'rgba(59,130,246,0.12)', color: '#3b82f6', Icon: User },
  master: { bg: 'rgba(45,212,191,0.12)', color: '#2dd4bf', Icon: Scissors },
  salon: { bg: 'rgba(16,185,129,0.12)', color: '#10b981', Icon: Building2 },
};

export function FollowerCard({
  fullName,
  avatarUrl,
  phone,
  entityType,
  entityMeta,
  followedAt,
  mutual,
  isClient,
  onFollow,
  onUnfollow,
  onAddToClients,
}: FollowerCardProps) {
  const tf = useTranslations('followSystem');
  const [busy, setBusy] = useState(false);
  const [addingClient, setAddingClient] = useState(false);

  const handleAction = async () => {
    setBusy(true);
    try {
      if (mutual) {
        await onUnfollow();
      } else {
        await onFollow();
      }
    } finally {
      setBusy(false);
    }
  };

  const badge = ENTITY_BADGE[entityType];
  const subtitle = entityType === 'master' && entityMeta?.specialization
    ? entityMeta.specialization
    : entityType === 'salon' && entityMeta?.salonName
      ? entityMeta.salonName
      : phone || null;

  const dateLabel = followedAt
    ? new Date(followedAt).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' })
    : null;

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 14,
      padding: '14px 18px', borderRadius: 12,
      border: '1px solid var(--border, rgba(255,255,255,0.08))',
      backgroundColor: 'var(--card, transparent)',
      transition: 'background-color 150ms',
    }}>
      {/* Avatar */}
      {avatarUrl ? (
        <img
          src={avatarUrl}
          alt={fullName}
          style={{ width: 42, height: 42, borderRadius: 999, objectFit: 'cover', flexShrink: 0 }}
        />
      ) : (
        <div style={{
          width: 42, height: 42, borderRadius: 999, flexShrink: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          backgroundColor: hashColor(fullName), color: '#fff',
          fontSize: 14, fontWeight: 600,
        }}>
          {getInitials(fullName)}
        </div>
      )}

      {/* Info */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--foreground, #f0f0f0)' }}>
            {fullName}
          </span>
          {/* Entity type badge */}
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 3,
            fontSize: 10, fontWeight: 600, padding: '2px 7px', borderRadius: 999,
            backgroundColor: badge.bg, color: badge.color,
          }}>
            <badge.Icon style={{ width: 10, height: 10 }} />
            {tf(`entity${entityType.charAt(0).toUpperCase() + entityType.slice(1)}` as 'entityClient' | 'entityMaster' | 'entitySalon')}
          </span>
          {mutual && (
            <span style={{
              fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 999,
              backgroundColor: 'rgba(94,106,210,0.15)', color: '#5e6ad2',
            }}>
              {tf('mutual')}
            </span>
          )}
        </div>
        <div style={{ display: 'flex', gap: 12, marginTop: 2 }}>
          {subtitle && (
            <span style={{ fontSize: 12, color: 'var(--muted-foreground, #8a8f98)' }}>{subtitle}</span>
          )}
          {dateLabel && (
            <span style={{ fontSize: 12, color: 'var(--muted-foreground, #62666d)' }}>
              {tf('followedSince', { date: dateLabel })}
            </span>
          )}
        </div>
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {/* Add to clients button — only for non-client entity types */}
        {onAddToClients && !isClient && entityType === 'client' && (
          <button
            onClick={async () => {
              setAddingClient(true);
              try { await onAddToClients(); } finally { setAddingClient(false); }
            }}
            disabled={addingClient}
            style={{
              display: 'flex', alignItems: 'center', gap: 5,
              padding: '8px 14px', borderRadius: 8,
              border: 'none',
              backgroundColor: '#10b981',
              color: '#ffffff',
              fontSize: 12, fontWeight: 600, cursor: 'pointer',
              opacity: addingClient ? 0.5 : 1,
              transition: 'opacity 150ms',
              whiteSpace: 'nowrap',
            }}
          >
            <UserRoundPlus style={{ width: 13, height: 13 }} />
            {tf('addToClients')}
          </button>
        )}
        {isClient && entityType === 'client' && (
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 4,
            padding: '6px 12px', borderRadius: 8,
            backgroundColor: 'rgba(16,185,129,0.12)', color: '#10b981',
            fontSize: 11, fontWeight: 600,
          }}>
            <UserCheck style={{ width: 12, height: 12 }} />
            {tf('alreadyClient')}
          </span>
        )}
        <button
          onClick={handleAction}
          disabled={busy}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '8px 16px', borderRadius: 8,
            border: mutual ? '1px solid var(--border, rgba(255,255,255,0.08))' : 'none',
            backgroundColor: mutual ? 'transparent' : '#5e6ad2',
            color: mutual ? 'var(--muted-foreground, #8a8f98)' : '#ffffff',
            fontSize: 12, fontWeight: 600, cursor: 'pointer',
            opacity: busy ? 0.5 : 1,
            transition: 'opacity 150ms',
          }}
        >
          {mutual ? (
            <>
              <UserCheck style={{ width: 13, height: 13 }} />
              {tf('unfollowBack')}
            </>
          ) : (
            <>
              <UserPlus style={{ width: 13, height: 13 }} />
              {tf('followBack')}
            </>
          )}
        </button>
      </div>
    </div>
  );
}
