/** --- YAML
 * name: Marketing Guild
 * description: Мастер создаёт или вступает в гильдию — обмен клиентами со смежными мастерами. Список членов, приглашение по handle, рекомендация клиенту.
 * created: 2026-04-14
 * updated: 2026-04-14
 * --- */

'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Users, Plus, UserPlus, Link2, LogOut } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useMaster } from '@/hooks/use-master';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

interface Guild {
  id: string;
  name: string;
  city: string | null;
  vertical: string | null;
  description: string | null;
  owner_master_id: string;
}

interface Member {
  master_id: string;
  master: { id: string; handle: string | null; full_name: string | null; avatar_url: string | null; city: string | null; vertical: string | null } | null;
}

export default function MarketingGuildPage() {
  const { master } = useMaster();
  const [guild, setGuild] = useState<Guild | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [inviteHandle, setInviteHandle] = useState('');

  useEffect(() => {
    if (!master?.id) return;
    (async () => {
      const supabase = createClient();
      const { data: memberRow } = await supabase
        .from('guild_members')
        .select('guild_id')
        .eq('master_id', master.id)
        .maybeSingle();
      if (!memberRow) {
        setLoading(false);
        return;
      }
      const { data: g } = await supabase
        .from('guilds')
        .select('id, name, city, vertical, description, owner_master_id')
        .eq('id', memberRow.guild_id)
        .maybeSingle();
      if (g) {
        setGuild(g as Guild);
        const { data: mem } = await supabase
          .from('guild_members')
          .select('master_id, master:masters(id, handle, full_name, avatar_url, city, vertical)')
          .eq('guild_id', g.id);
        setMembers((mem ?? []) as unknown as Member[]);
      }
      setLoading(false);
    })();
  }, [master?.id]);

  async function createGuild() {
    if (!master?.id || !name.trim()) return;
    const supabase = createClient();
    const { data: me } = await supabase
      .from('masters')
      .select('id, handle, city, vertical')
      .eq('id', master.id)
      .maybeSingle();
    const mv = (me as { handle: string | null; city: string | null; vertical: string | null } | null);
    const { data: g, error } = await supabase
      .from('guilds')
      .insert({
        name: name.trim(),
        description: description.trim() || null,
        city: mv?.city ?? null,
        vertical: mv?.vertical ?? null,
        owner_master_id: master.id,
        created_by: master.profile_id,
      })
      .select('id, name, city, vertical, description, owner_master_id')
      .single();
    if (error) {
      toast.error(error.message);
      return;
    }
    await supabase.from('guild_members').insert({ guild_id: g!.id, master_id: master.id });
    setGuild(g as Guild);
    setMembers([{ master_id: master.id, master: { id: master.id, handle: mv?.handle ?? null, full_name: master.profile.full_name ?? null, avatar_url: master.profile.avatar_url ?? null, city: mv?.city ?? null, vertical: mv?.vertical ?? null } }]);
    toast.success('Гильдия создана');
  }

  async function invite() {
    if (!guild || !inviteHandle.trim()) return;
    const supabase = createClient();
    const handle = inviteHandle.trim().replace(/^@/, '');
    const { data: m } = await supabase
      .from('masters')
      .select('id, handle, full_name, avatar_url, city, vertical')
      .eq('handle', handle)
      .maybeSingle();
    if (!m) {
      toast.error('Мастер не найден');
      return;
    }
    const { error } = await supabase
      .from('guild_members')
      .insert({ guild_id: guild.id, master_id: m.id });
    if (error) {
      toast.error(error.message);
      return;
    }
    setMembers((prev) => [...prev, { master_id: m.id as string, master: m as unknown as Member['master'] }]);
    setInviteHandle('');
    toast.success(`Добавлен @${handle}`);
  }

  async function leave() {
    if (!guild || !master?.id) return;
    const supabase = createClient();
    await supabase.from('guild_members').delete().eq('guild_id', guild.id).eq('master_id', master.id);
    if (guild.owner_master_id === master.id) {
      await supabase.from('guilds').delete().eq('id', guild.id);
    }
    setGuild(null);
    setMembers([]);
    toast.success('Вы покинули гильдию');
  }

  function copyRef(handle: string | null) {
    if (!handle || !master?.id) return;
    const url = `https://cres.ca/m/${handle}?ref=${master.id}`;
    navigator.clipboard.writeText(url);
    toast.success('Ссылка скопирована');
  }

  if (loading) return <div className="p-6 text-sm text-muted-foreground">Загрузка…</div>;

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-semibold">
          <Users className="h-6 w-6 text-primary" />
          Гильдия
        </h1>
        <p className="text-sm text-muted-foreground">
          Обменивайся клиентами со смежными мастерами. Рекомендуй — получай рекомендации в ответ.
        </p>
      </div>

      {!guild ? (
        <div className="rounded-lg border bg-card p-5 space-y-3">
          <div className="text-base font-semibold">Создать гильдию</div>
          <div>
            <Label>Название</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Бьюти-альянс Одесса" />
          </div>
          <div>
            <Label>Описание</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
          </div>
          <Button onClick={createGuild} disabled={!name.trim()}>
            <Plus className="mr-1 h-4 w-4" /> Создать
          </Button>
        </div>
      ) : (
        <>
          <div className="rounded-lg border bg-card p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-lg font-semibold">{guild.name}</div>
                {guild.description && <p className="mt-1 text-sm text-muted-foreground">{guild.description}</p>}
                <div className="mt-2 text-xs text-muted-foreground">
                  {guild.city ?? '—'} · {guild.vertical ?? '—'} · {members.length} {members.length === 1 ? 'участник' : 'участников'}
                </div>
              </div>
              <Button variant="outline" size="sm" onClick={leave}>
                <LogOut className="mr-1 h-4 w-4" />
                {guild.owner_master_id === master?.id ? 'Распустить' : 'Выйти'}
              </Button>
            </div>
          </div>

          {guild.owner_master_id === master?.id && (
            <div className="rounded-lg border bg-card p-5">
              <div className="mb-2 text-sm font-semibold">Пригласить по handle</div>
              <div className="flex gap-2">
                <Input value={inviteHandle} onChange={(e) => setInviteHandle(e.target.value)} placeholder="@masterhandle" />
                <Button onClick={invite} disabled={!inviteHandle.trim()}>
                  <UserPlus className="mr-1 h-4 w-4" /> Добавить
                </Button>
              </div>
            </div>
          )}

          <div className="rounded-lg border bg-card p-5">
            <div className="mb-3 text-sm font-semibold">Участники</div>
            <div className="space-y-2">
              {members.map((m) => (
                <div key={m.master_id} className="flex items-center justify-between rounded-md border p-3">
                  <div className="flex items-center gap-3 min-w-0">
                    {m.master?.avatar_url ? (
                      <img src={m.master.avatar_url} alt="" className="h-10 w-10 rounded-full object-cover" />
                    ) : (
                      <div className="h-10 w-10 rounded-full bg-muted" />
                    )}
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium">{m.master?.full_name ?? '—'}</div>
                      <div className="truncate text-xs text-muted-foreground">
                        @{m.master?.handle ?? '—'} · {m.master?.vertical ?? '—'}
                      </div>
                    </div>
                  </div>
                  {m.master_id !== master?.id && (
                    <Button variant="outline" size="sm" onClick={() => copyRef(m.master?.handle ?? null)}>
                      <Link2 className="mr-1 h-3.5 w-3.5" /> Ref-ссылка
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
