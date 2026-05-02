/** --- YAML
 * name: Guild Detail Page
 * description: Состав гильдии + форма приглашения по CRES-CA invite code.
 *              Owner может удалять участников / редактировать инфу
 *              гильдии / удалять гильдию. Member видит коллег.
 * created: 2026-05-02
 * --- */

'use client';

import { useEffect, useState, use } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  ArrowLeft, Crown, MapPin, Plus, X, Loader2, UserMinus, Send, AlertCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import { usePageTheme, FONT, pageContainer } from '@/lib/dashboard-theme';
import { useConfirm } from '@/hooks/use-confirm';

interface GuildData {
  id: string;
  name: string;
  description: string | null;
  city: string | null;
  is_public: boolean;
  owner_master_id: string;
}

interface Member {
  master_id: string;
  role: string;
  status: string;
  invited_at: string;
  accepted_at: string | null;
  slug: string | null;
  name: string;
  specialization: string | null;
  avatar_url: string | null;
  city: string | null;
}

export default function GuildDetailPage({ params }: { params: Promise<{ id: string; locale: string }> }) {
  const { id, locale } = use(params);
  const { C } = usePageTheme();
  const confirm = useConfirm();
  const [guild, setGuild] = useState<GuildData | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [myMasterId, setMyMasterId] = useState<string | null>(null);

  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteCode, setInviteCode] = useState('');
  const [inviting, setInviting] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch(`/api/guilds/${id}`);
      const data = await res.json();
      if (!res.ok) { toast.error(data.error ?? 'Ошибка'); return; }
      setGuild(data.guild as GuildData);
      setMembers(data.members as Member[]);
      // Я один из members — найду себя как owner или активного
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [id]);

  // Узнаю свой master_id (из guildmembers по profile)
  useEffect(() => {
    fetch('/api/me/master-id').then((r) => r.ok ? r.json() : null).then((d) => {
      if (d?.master_id) setMyMasterId(d.master_id);
    }).catch(() => {});
  }, []);

  const isOwner = !!(guild && myMasterId && guild.owner_master_id === myMasterId);
  const activeMembers = members.filter((m) => m.status === 'active');
  const invitedMembers = members.filter((m) => m.status === 'invited');

  async function inviteMaster() {
    if (!inviteCode.trim()) return;
    setInviting(true);
    try {
      const res = await fetch(`/api/guilds/${id}/invite`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ invite_code: inviteCode.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(
          data.error === 'master_not_found' ? 'Мастер с таким CRES-CA кодом не найден'
          : data.error === 'already_member' ? 'Уже в гильдии'
          : data.error === 'already_invited' ? 'Уже приглашён'
          : data.error === 'cannot_invite_self' ? 'Себя пригласить нельзя'
          : data.error ?? 'Ошибка',
        );
        return;
      }
      toast.success('Приглашение отправлено');
      setInviteCode('');
      setInviteOpen(false);
      load();
    } finally {
      setInviting(false);
    }
  }

  async function removeMember(memberId: string, name: string) {
    const ok = await confirm({
      title: `Удалить ${name} из гильдии?`,
      description: 'Мастер потеряет членство.',
      confirmLabel: 'Удалить',
      destructive: true,
    });
    if (!ok) return;
    const res = await fetch(`/api/guilds/${id}/members/${memberId}`, { method: 'DELETE' });
    if (res.ok) { toast.success('Удалён'); load(); }
    else toast.error('Ошибка');
  }

  if (loading) {
    return (
      <div style={{ ...pageContainer, color: C.text, background: C.bg, minHeight: '100%', fontFamily: FONT, display: 'flex', justifyContent: 'center', padding: 60 }}>
        <Loader2 className="animate-spin" size={24} style={{ color: C.textSecondary }} />
      </div>
    );
  }

  if (!guild) {
    return (
      <div style={{ ...pageContainer, color: C.text, background: C.bg, minHeight: '100%', fontFamily: FONT }}>
        <div style={{ padding: 40, textAlign: 'center' }}>
          <AlertCircle size={32} style={{ margin: '0 auto 12px', color: C.textTertiary }} />
          <p style={{ fontSize: 14, color: C.text }}>Гильдия не найдена или нет доступа</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ ...pageContainer, color: C.text, background: C.bg, minHeight: '100%', fontFamily: FONT }}>
      <Link href={`/${locale}/guilds`} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 13, color: C.textSecondary, textDecoration: 'none', marginBottom: 14 }}>
        <ArrowLeft size={14} /> К списку гильдий
      </Link>

      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 18 }}>
        <div style={{ flex: 1, minWidth: 200 }}>
          <h1 style={{ fontSize: 26, fontWeight: 700, margin: 0, color: C.text, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            {guild.name}
            {isOwner && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 11, fontWeight: 700, color: '#a16207', background: '#fef3c7', padding: '3px 8px', borderRadius: 6 }}>
                <Crown size={11} /> OWNER
              </span>
            )}
          </h1>
          {guild.description && <p style={{ fontSize: 14, color: C.textSecondary, marginTop: 6, marginBottom: 0 }}>{guild.description}</p>}
          {guild.city && (
            <p style={{ fontSize: 13, color: C.textTertiary, marginTop: 6, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              <MapPin size={12} /> {guild.city}
            </p>
          )}
        </div>
        {isOwner && (
          <button
            onClick={() => setInviteOpen(true)}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              padding: '9px 14px', borderRadius: 10, border: 'none',
              background: C.accent, color: '#fff',
              fontSize: 13, fontWeight: 600, cursor: 'pointer',
            }}
          >
            <Plus size={14} /> Пригласить
          </button>
        )}
      </div>

      {/* Активные члены */}
      <section style={{ marginBottom: 24 }}>
        <h2 style={{ fontSize: 13, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, color: C.textSecondary, marginBottom: 10 }}>
          Состав · {activeMembers.length}
        </h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 10 }}>
          {activeMembers.map((m) => (
            <motion.div
              key={m.master_id}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              style={{
                padding: 12, borderRadius: 12,
                border: `1px solid ${C.border}`, background: C.surface,
                display: 'flex', alignItems: 'center', gap: 10,
              }}
            >
              {m.avatar_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={m.avatar_url} alt="" style={{ width: 44, height: 44, borderRadius: 999, objectFit: 'cover' }} />
              ) : (
                <div style={{ width: 44, height: 44, borderRadius: 999, background: C.accentSoft, color: C.accent, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700 }}>
                  {m.name[0]?.toUpperCase()}
                </div>
              )}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Link
                    href={m.slug ? `/m/${m.slug}` : '#'}
                    style={{ fontSize: 14, fontWeight: 600, color: C.text, textDecoration: 'none' }}
                  >
                    {m.name}
                  </Link>
                  {m.role === 'owner' && <Crown size={12} style={{ color: '#a16207' }} />}
                </div>
                {m.specialization && <div style={{ fontSize: 12, color: C.textSecondary, marginTop: 1 }}>{m.specialization}</div>}
              </div>
              {isOwner && m.role !== 'owner' && (
                <button
                  onClick={() => removeMember(m.master_id, m.name)}
                  title="Удалить из гильдии"
                  style={{
                    width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    borderRadius: 6, border: 'none', background: 'transparent',
                    color: C.danger, cursor: 'pointer',
                  }}
                >
                  <UserMinus size={14} />
                </button>
              )}
            </motion.div>
          ))}
        </div>
      </section>

      {/* Pending приглашения (видит только owner) */}
      {isOwner && invitedMembers.length > 0 && (
        <section>
          <h2 style={{ fontSize: 13, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, color: C.textSecondary, marginBottom: 10 }}>
            Приглашены · {invitedMembers.length}
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {invitedMembers.map((m) => (
              <div key={m.master_id} style={{
                padding: 10, borderRadius: 10,
                border: `1px dashed ${C.border}`, background: C.bg,
                display: 'flex', alignItems: 'center', gap: 10,
              }}>
                <div style={{ width: 32, height: 32, borderRadius: 999, background: C.accentSoft, color: C.accent, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 13 }}>
                  {m.name[0]?.toUpperCase()}
                </div>
                <div style={{ flex: 1, fontSize: 13, color: C.text }}>{m.name} {m.specialization && <span style={{ color: C.textTertiary }}>· {m.specialization}</span>}</div>
                <span style={{ fontSize: 11, color: C.textTertiary, fontStyle: 'italic' }}>ожидает ответа</span>
                <button
                  onClick={() => removeMember(m.master_id, m.name)}
                  title="Отозвать приглашение"
                  style={{ background: 'transparent', border: 'none', color: C.textTertiary, cursor: 'pointer' }}
                >
                  <X size={14} />
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Invite dialog */}
      {inviteOpen && (
        <div
          onClick={() => !inviting && setInviteOpen(false)}
          style={{ position: 'fixed', inset: 0, zIndex: 100, background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ width: '100%', maxWidth: 420, padding: 22, background: C.surface, borderRadius: 16, fontFamily: FONT, color: C.text }}
          >
            <h3 style={{ fontSize: 17, fontWeight: 700, marginTop: 0, marginBottom: 8 }}>Пригласить мастера</h3>
            <p style={{ fontSize: 13, color: C.textSecondary, marginTop: 0, marginBottom: 14 }}>
              Введите CRES-CA код мастера (его персональный invite code из настроек).
            </p>
            <input
              type="text"
              value={inviteCode}
              onChange={(e) => setInviteCode(e.target.value.toLowerCase().trim())}
              placeholder="например: a1b2c3d4"
              maxLength={32}
              autoFocus
              style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: `1px solid ${C.border}`, background: C.bg, color: C.text, fontFamily: 'monospace', fontSize: 14 }}
            />
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 14 }}>
              <button
                onClick={() => setInviteOpen(false)}
                disabled={inviting}
                style={{ padding: '9px 14px', borderRadius: 8, border: `1px solid ${C.border}`, background: 'transparent', color: C.text, fontSize: 13, cursor: 'pointer' }}
              >Отмена</button>
              <button
                onClick={inviteMaster}
                disabled={inviting || !inviteCode.trim()}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 5,
                  padding: '9px 14px', borderRadius: 8, border: 'none',
                  background: inviteCode.trim() ? C.accent : C.border,
                  color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer',
                  opacity: inviting ? 0.6 : 1,
                }}
              >
                {inviting ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}
                {inviting ? 'Отправка…' : 'Пригласить'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
