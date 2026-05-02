/** --- YAML
 * name: Guilds Page
 * description: Кабинет «Партнёрские группы» — список моих гильдий (где я owner или
 *              active member) + приглашения (где status='invited') +
 *              кнопка «Создать группу».
 * created: 2026-05-02
 * --- */

'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  Users, Plus, Crown, MapPin, Check, X, LogOut, Loader2, Trash2, Copy,
} from 'lucide-react';
import { toast } from 'sonner';
import { usePageTheme, FONT, pageContainer } from '@/lib/dashboard-theme';
import { useConfirm } from '@/hooks/use-confirm';

interface GuildSummary {
  id: string;
  name: string;
  description: string | null;
  city: string | null;
  is_public: boolean;
  is_owner: boolean;
  my_status: string | null;
  my_role: string | null;
  members_count: number;
  created_at: string;
}

export default function GuildsPage() {
  const { C } = usePageTheme();
  const confirm = useConfirm();
  const [guilds, setGuilds] = useState<GuildSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [inviteCodeOpenFor, setInviteCodeOpenFor] = useState<string | null>(null);

  // Create form
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [city, setCity] = useState('');
  const [isPublic, setIsPublic] = useState(true);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch('/api/guilds');
      if (res.ok) {
        const data = await res.json();
        setGuilds((data.guilds ?? []) as GuildSummary[]);
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function createGuild() {
    if (!name.trim()) { toast.error('Введите название'); return; }
    setCreating(true);
    try {
      const res = await fetch('/api/guilds', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || null,
          city: city.trim() || null,
          is_public: isPublic,
        }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error ?? 'Ошибка'); return; }
      toast.success('Гильдия создана');
      setCreateOpen(false);
      setName(''); setDescription(''); setCity(''); setIsPublic(true);
      load();
    } finally {
      setCreating(false);
    }
  }

  async function respondToInvite(guildId: string, action: 'accept' | 'decline') {
    const res = await fetch(`/api/guilds/${guildId}/respond`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) { toast.error(data.error ?? 'Ошибка'); return; }
    toast.success(action === 'accept' ? 'Принято' : 'Отклонено');
    load();
  }

  async function leaveGuild(guildId: string, name: string) {
    const ok = await confirm({
      title: `Покинуть «${name}»?`,
      description: 'Вы перестанете быть членом этой гильдии.',
      confirmLabel: 'Покинуть',
      destructive: true,
    });
    if (!ok) return;
    const res = await fetch(`/api/guilds/${guildId}/respond`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'leave' }),
    });
    if (res.ok) { toast.success('Покинули гильдию'); load(); }
    else { const d = await res.json().catch(() => ({})); toast.error(d.error ?? 'Ошибка'); }
  }

  async function deleteGuild(guildId: string, name: string) {
    const ok = await confirm({
      title: `Удалить гильдию «${name}»?`,
      description: 'Все участники потеряют членство. Действие необратимо.',
      confirmLabel: 'Удалить',
      destructive: true,
    });
    if (!ok) return;
    const res = await fetch(`/api/guilds/${guildId}`, { method: 'DELETE' });
    if (res.ok) { toast.success('Гильдия удалена'); load(); }
    else toast.error('Ошибка');
  }

  const invites = guilds.filter((g) => g.my_status === 'invited');
  const myGuilds = guilds.filter((g) => g.my_status === 'active');

  return (
    <div style={{ ...pageContainer, color: C.text, background: C.bg, minHeight: '100%', fontFamily: FONT }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 18 }}>
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 700, margin: 0, color: C.text }}>Партнёрские группы</h1>
          <p style={{ fontSize: 14, color: C.textSecondary, marginTop: 4, marginBottom: 0 }}>
            Объединяйтесь с коллегами разных сфер для взаимных рекомендаций. Парикмахер → маникюрше → массажисту: рекомендуете друг друга своим клиентам.
          </p>
        </div>
        <button
          onClick={() => setCreateOpen(true)}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            padding: '10px 16px', borderRadius: 10, border: 'none',
            background: C.accent, color: '#fff',
            fontSize: 14, fontWeight: 600, cursor: 'pointer',
          }}
        >
          <Plus size={16} />
          Создать группу
        </button>
      </div>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}>
          <Loader2 className="animate-spin" size={24} style={{ color: C.textSecondary }} />
        </div>
      ) : (
        <>
          {/* Приглашения */}
          {invites.length > 0 && (
            <section style={{ marginBottom: 24 }}>
              <h2 style={{ fontSize: 14, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, color: C.textSecondary, marginBottom: 10 }}>
                Приглашения · {invites.length}
              </h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {invites.map((g) => (
                  <motion.div
                    key={g.id}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    style={{
                      padding: 16, borderRadius: 14,
                      border: `1px solid ${C.accent}`,
                      background: C.accentSoft,
                      display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap',
                    }}
                  >
                    <div style={{ flex: 1, minWidth: 200 }}>
                      <div style={{ fontSize: 16, fontWeight: 600, color: C.text }}>{g.name}</div>
                      {g.description && <div style={{ fontSize: 13, color: C.textSecondary, marginTop: 2 }}>{g.description}</div>}
                      {g.city && (
                        <div style={{ fontSize: 12, color: C.textTertiary, marginTop: 4, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                          <MapPin size={11} /> {g.city}
                        </div>
                      )}
                    </div>
                    <button
                      onClick={() => respondToInvite(g.id, 'accept')}
                      style={{
                        display: 'inline-flex', alignItems: 'center', gap: 4,
                        padding: '8px 14px', borderRadius: 8, border: 'none',
                        background: C.accent, color: '#fff',
                        fontSize: 13, fontWeight: 600, cursor: 'pointer',
                      }}
                    >
                      <Check size={14} /> Принять
                    </button>
                    <button
                      onClick={() => respondToInvite(g.id, 'decline')}
                      style={{
                        display: 'inline-flex', alignItems: 'center', gap: 4,
                        padding: '8px 14px', borderRadius: 8, border: `1px solid ${C.border}`,
                        background: 'transparent', color: C.text,
                        fontSize: 13, fontWeight: 500, cursor: 'pointer',
                      }}
                    >
                      <X size={14} /> Отклонить
                    </button>
                  </motion.div>
                ))}
              </div>
            </section>
          )}

          {/* Мои гильдии */}
          <section>
            <h2 style={{ fontSize: 14, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, color: C.textSecondary, marginBottom: 10 }}>
              Мои гильдии {myGuilds.length > 0 && `· ${myGuilds.length}`}
            </h2>
            {myGuilds.length === 0 ? (
              <div style={{ padding: 32, textAlign: 'center', borderRadius: 14, border: `1px dashed ${C.border}`, background: C.surface }}>
                <Users size={32} style={{ margin: '0 auto 12px', color: C.textTertiary }} />
                <p style={{ fontSize: 14, color: C.text, fontWeight: 600, margin: 0 }}>Пока нет гильдий</p>
                <p style={{ fontSize: 13, color: C.textSecondary, marginTop: 6, marginBottom: 0 }}>
                  Создайте свою или дождитесь приглашения от коллеги.
                </p>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 12 }}>
                {myGuilds.map((g) => (
                  <motion.div
                    key={g.id}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    style={{
                      padding: 16, borderRadius: 14,
                      border: `1px solid ${C.border}`,
                      background: C.surface,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 6 }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                          <Link href={`/guilds/${g.id}`} style={{ fontSize: 16, fontWeight: 600, color: C.text, textDecoration: 'none' }}>
                            {g.name}
                          </Link>
                          {g.is_owner && (
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 10, fontWeight: 700, color: '#a16207', background: '#fef3c7', padding: '2px 6px', borderRadius: 4 }}>
                              <Crown size={10} /> OWNER
                            </span>
                          )}
                        </div>
                        {g.description && <div style={{ fontSize: 13, color: C.textSecondary, marginTop: 4 }}>{g.description}</div>}
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 10, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 12, color: C.textSecondary, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                        <Users size={12} /> {g.members_count} {g.members_count === 1 ? 'мастер' : 'мастера'}
                      </span>
                      {g.city && (
                        <span style={{ fontSize: 12, color: C.textSecondary, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                          <MapPin size={12} /> {g.city}
                        </span>
                      )}
                    </div>

                    <div style={{ display: 'flex', gap: 6, marginTop: 12, flexWrap: 'wrap' }}>
                      <Link
                        href={`/guilds/${g.id}`}
                        style={{
                          padding: '6px 12px', borderRadius: 8, border: `1px solid ${C.border}`,
                          background: 'transparent', color: C.text,
                          fontSize: 12, fontWeight: 500, textDecoration: 'none',
                        }}
                      >
                        Открыть
                      </Link>
                      {g.is_owner ? (
                        <button
                          onClick={() => deleteGuild(g.id, g.name)}
                          style={{
                            padding: '6px 12px', borderRadius: 8, border: `1px solid ${C.border}`,
                            background: 'transparent', color: C.danger,
                            fontSize: 12, fontWeight: 500, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4,
                          }}
                        >
                          <Trash2 size={12} /> Удалить
                        </button>
                      ) : (
                        <button
                          onClick={() => leaveGuild(g.id, g.name)}
                          style={{
                            padding: '6px 12px', borderRadius: 8, border: `1px solid ${C.border}`,
                            background: 'transparent', color: C.textSecondary,
                            fontSize: 12, fontWeight: 500, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4,
                          }}
                        >
                          <LogOut size={12} /> Покинуть
                        </button>
                      )}
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </section>
        </>
      )}

      {/* Create dialog */}
      {createOpen && (
        <div
          onClick={() => !creating && setCreateOpen(false)}
          style={{
            position: 'fixed', inset: 0, zIndex: 100,
            background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: '100%', maxWidth: 480, padding: 24,
              background: C.surface, borderRadius: 16,
              fontFamily: FONT, color: C.text,
            }}
          >
            <h2 style={{ fontSize: 18, fontWeight: 700, marginTop: 0, marginBottom: 14 }}>Новая гильдия</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Название (например «Бьюти-альянс Харьков»)"
                maxLength={80}
                style={{ padding: '10px 12px', borderRadius: 8, border: `1px solid ${C.border}`, background: C.bg, color: C.text, fontFamily: FONT, fontSize: 14 }}
              />
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Описание (необязательно)"
                rows={3}
                maxLength={500}
                style={{ padding: '10px 12px', borderRadius: 8, border: `1px solid ${C.border}`, background: C.bg, color: C.text, fontFamily: FONT, fontSize: 14, resize: 'vertical' }}
              />
              <input
                type="text"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="Город (необязательно)"
                style={{ padding: '10px 12px', borderRadius: 8, border: `1px solid ${C.border}`, background: C.bg, color: C.text, fontFamily: FONT, fontSize: 14 }}
              />
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                <input type="checkbox" checked={isPublic} onChange={(e) => setIsPublic(e.target.checked)} />
                <span style={{ fontSize: 13, color: C.textSecondary }}>Публичная — другие мастера смогут её найти и подать заявку</span>
              </label>
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }}>
              <button
                onClick={() => setCreateOpen(false)}
                disabled={creating}
                style={{ padding: '9px 14px', borderRadius: 8, border: `1px solid ${C.border}`, background: 'transparent', color: C.text, fontSize: 13, cursor: 'pointer' }}
              >Отмена</button>
              <button
                onClick={createGuild}
                disabled={creating || !name.trim()}
                style={{
                  padding: '9px 14px', borderRadius: 8, border: 'none',
                  background: name.trim() ? C.accent : C.border,
                  color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer',
                  opacity: creating ? 0.6 : 1,
                }}
              >{creating ? 'Создаю…' : 'Создать'}</button>
            </div>
          </div>
        </div>
      )}

      {inviteCodeOpenFor && (
        <div onClick={() => setInviteCodeOpenFor(null)} style={{ position: 'fixed', inset: 0, zIndex: 100, background: 'rgba(0,0,0,0.55)' }} />
      )}
    </div>
  );
}
