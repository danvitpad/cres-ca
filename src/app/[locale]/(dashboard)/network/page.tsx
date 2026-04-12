/** --- YAML
 * name: Master Network (Guilds)
 * description: Follow/unfollow other masters to form a professional network.
 * created: 2026-04-12
 * updated: 2026-04-12
 * --- */

'use client';

import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';
import { useMaster } from '@/hooks/use-master';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';

type PeerMaster = {
  id: string;
  display_name: string | null;
  specialization: string | null;
  city: string | null;
  avatar_url: string | null;
};

export default function NetworkPage() {
  const supabase = createClient();
  const { master } = useMaster();
  const [peers, setPeers] = useState<PeerMaster[]>([]);
  const [following, setFollowing] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!master?.id) return;
    setLoading(true);
    const [{ data: ms }, { data: fs }] = await Promise.all([
      supabase
        .from('masters')
        .select('id, display_name, specialization, city, avatar_url')
        .neq('id', master.id)
        .eq('is_active', true)
        .limit(100),
      supabase.from('master_follows').select('to_master_id').eq('from_master_id', master.id),
    ]);
    setPeers((ms as PeerMaster[]) ?? []);
    setFollowing(new Set((fs ?? []).map((f) => f.to_master_id)));
    setLoading(false);
  }, [supabase, master?.id]);

  useEffect(() => {
    load();
  }, [load]);

  async function toggle(peerId: string) {
    if (!master?.id) return;
    const isFollowing = following.has(peerId);
    if (isFollowing) {
      const { error } = await supabase
        .from('master_follows')
        .delete()
        .eq('from_master_id', master.id)
        .eq('to_master_id', peerId);
      if (error) {
        toast.error(error.message);
        return;
      }
      setFollowing((prev) => {
        const next = new Set(prev);
        next.delete(peerId);
        return next;
      });
    } else {
      const { error } = await supabase
        .from('master_follows')
        .insert({ from_master_id: master.id, to_master_id: peerId });
      if (error) {
        toast.error(error.message);
        return;
      }
      setFollowing((prev) => new Set(prev).add(peerId));
    }
  }

  const filtered = peers.filter((p) => {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return (p.display_name ?? '').toLowerCase().includes(q) || (p.specialization ?? '').toLowerCase().includes(q);
  });

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold">Сеть мастеров</h1>
        <p className="text-sm text-muted-foreground">Подписывайся на коллег — будешь видеть их публикации и рекомендации.</p>
      </div>

      <Input placeholder="Поиск" value={query} onChange={(e) => setQuery(e.target.value)} />

      {loading ? (
        <p className="text-sm text-muted-foreground">Загрузка…</p>
      ) : filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground">Никого не найдено.</p>
      ) : (
        <div className="space-y-2">
          {filtered.map((p) => {
            const isFollowing = following.has(p.id);
            return (
              <div key={p.id} className="flex items-center gap-3 rounded-lg border bg-card p-3">
                <Avatar>
                  <AvatarImage src={p.avatar_url ?? undefined} />
                  <AvatarFallback>{(p.display_name ?? '?').slice(0, 1)}</AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">{p.display_name ?? '—'}</div>
                  <div className="text-xs text-muted-foreground truncate">
                    {[p.specialization, p.city].filter(Boolean).join(' · ')}
                  </div>
                </div>
                <Button size="sm" variant={isFollowing ? 'outline' : 'default'} onClick={() => toggle(p.id)}>
                  {isFollowing ? 'Отписаться' : 'Подписаться'}
                </Button>
              </div>
            );
          })}
        </div>
      )}

      <div className="text-xs text-muted-foreground">
        Подписок: {following.size}
      </div>
    </div>
  );
}
