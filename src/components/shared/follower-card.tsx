/** --- YAML
 * name: FollowerCard
 * description: Card showing a follower profile with avatar, name, follow date, and follow-back/unfollow actions.
 * created: 2026-04-16
 * --- */

'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { UserCheck, UserPlus } from 'lucide-react';

interface FollowerCardProps {
  profileId: string;
  fullName: string;
  avatarUrl: string | null;
  phone: string | null;
  linkedAt: string;
  mutual: boolean;
  onFollowBack: () => Promise<void>;
  onUnfollowBack: () => Promise<void>;
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
  const colors = ['#3b82f6', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444', '#06b6d4', '#6366f1', '#ec4899'];
  return colors[Math.abs(hash) % colors.length];
}

export function FollowerCard({
  fullName,
  avatarUrl,
  phone,
  linkedAt,
  mutual,
  onFollowBack,
  onUnfollowBack,
}: FollowerCardProps) {
  const tf = useTranslations('followSystem');
  const [busy, setBusy] = useState(false);

  const handleAction = async () => {
    setBusy(true);
    try {
      if (mutual) {
        await onUnfollowBack();
      } else {
        await onFollowBack();
      }
    } finally {
      setBusy(false);
    }
  };

  const dateLabel = new Date(linkedAt).toLocaleDateString('ru-RU', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

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
          {phone && (
            <span style={{ fontSize: 12, color: 'var(--muted-foreground, #8a8f98)' }}>{phone}</span>
          )}
          <span style={{ fontSize: 12, color: 'var(--muted-foreground, #62666d)' }}>
            {tf('followedSince', { date: dateLabel })}
          </span>
        </div>
      </div>

      {/* Action */}
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
  );
}
