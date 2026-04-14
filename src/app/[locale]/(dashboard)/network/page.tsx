/** --- YAML
 * name: Master Network & Leaderboard
 * description: Directory of peer masters (follow/unfollow) + public leaderboard — top masters in the city per-vertical by visits + rating + badges.
 * created: 2026-04-12
 * updated: 2026-04-14
 * --- */

'use client';

import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Trophy, Users, Star } from 'lucide-react';
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

type LeaderRow = {
  id: string;
  display_name: string | null;
  specialization: string | null;
  city: string | null;
  avatar_url: string | null;
  rating: number | null;
  total_reviews: number | null;
  badges: string[] | null;
  level: number | null;
  score: number;
};

type Tab = 'directory' | 'leaderboard';

export default function NetworkPage() {
  const supabase = createClient();
  const { master } = useMaster();
  const [tab, setTab] = useState<Tab>('leaderboard');
  const [peers, setPeers] = useState<PeerMaster[]>([]);
  const [leaders, setLeaders] = useState<LeaderRow[]>([]);
  const [following, setFollowing] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!master?.id) return;
    setLoading(true);
    const [{ data: ms }, { data: fs }, { data: leaderData }] = await Promise.all([
      supabase
        .from('masters')
        .select('id, display_name, specialization, city, avatar_url')
        .neq('id', master.id)
        .eq('is_active', true)
        .limit(100),
      supabase.from('master_follows').select('to_master_id').eq('from_master_id', master.id),
      supabase
        .from('masters')
        .select('id, display_name, specialization, city, avatar_url, rating, total_reviews, badges, level, vertical')
        .eq('is_active', true)
        .limit(200),
    ]);
    setPeers((ms as PeerMaster[]) ?? []);
    setFollowing(new Set((fs ?? []).map((f) => f.to_master_id)));

    type Row = LeaderRow & { vertical: string | null };
    const rows = ((leaderData ?? []) as unknown) as Row[];
    const ranked: LeaderRow[] = rows
      .map((r) => {
        const rating = Number(r.rating ?? 0);
        const reviews = Number(r.total_reviews ?? 0);
        const badgeBoost = (r.badges?.length ?? 0) * 5;
        const levelBoost = Number(r.level ?? 0) * 2;
        const score = rating * 10 + Math.min(reviews, 200) * 0.5 + badgeBoost + levelBoost;
        return { ...r, score };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, 30);
    setLeaders(ranked);
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
        <p className="text-sm text-muted-foreground">Рейтинг и сообщество.</p>
      </div>

      <div className="flex gap-2 border-b">
        <button
          onClick={() => setTab('leaderboard')}
          className={`flex items-center gap-1.5 border-b-2 px-3 py-2 text-sm font-medium transition-colors ${
            tab === 'leaderboard' ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground'
          }`}
        >
          <Trophy className="h-4 w-4" /> Лидерборд
        </button>
        <button
          onClick={() => setTab('directory')}
          className={`flex items-center gap-1.5 border-b-2 px-3 py-2 text-sm font-medium transition-colors ${
            tab === 'directory' ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground'
          }`}
        >
          <Users className="h-4 w-4" /> Сеть
        </button>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Загрузка…</p>
      ) : tab === 'leaderboard' ? (
        <div className="space-y-2">
          {leaders.length === 0 ? (
            <p className="text-sm text-muted-foreground">Ещё нет данных для рейтинга.</p>
          ) : (
            leaders.map((l, i) => (
              <div key={l.id} className="flex items-center gap-3 rounded-lg border bg-card p-3">
                <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-bold">
                  {i + 1}
                </div>
                <Avatar>
                  <AvatarImage src={l.avatar_url ?? undefined} />
                  <AvatarFallback>{(l.display_name ?? '?').slice(0, 1)}</AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="truncate font-medium">{l.display_name ?? '—'}</span>
                    {(l.level ?? 0) > 0 && (
                      <span className="shrink-0 rounded-full bg-violet-100 px-1.5 py-0.5 text-[10px] font-semibold text-violet-800">
                        Lv {l.level}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span className="truncate">{[l.specialization, l.city].filter(Boolean).join(' · ') || '—'}</span>
                    {(l.total_reviews ?? 0) > 0 && (
                      <span className="inline-flex shrink-0 items-center gap-0.5">
                        <Star className="size-3 fill-amber-400 text-amber-400" />
                        {Number(l.rating ?? 0).toFixed(1)} ({l.total_reviews})
                      </span>
                    )}
                  </div>
                  {(l.badges?.length ?? 0) > 0 && (
                    <div className="mt-1 flex flex-wrap gap-1">
                      {l.badges!.slice(0, 3).map((b) => (
                        <span key={b} className="rounded-full bg-emerald-100 px-1.5 py-0.5 text-[10px] font-medium text-emerald-800">
                          {b === 'verified' ? '✅' : b === 'top-rated' ? '⭐' : b === 'top-week' ? '🔥' : '🏷️'} {b}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <div className="shrink-0 text-right text-xs text-muted-foreground">
                  <div className="font-bold text-foreground">{l.score.toFixed(0)}</div>
                  score
                </div>
              </div>
            ))
          )}
        </div>
      ) : (
        <>
          <Input placeholder="Поиск" value={query} onChange={(e) => setQuery(e.target.value)} />
          {filtered.length === 0 ? (
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
          <div className="text-xs text-muted-foreground">Подписок: {following.size}</div>
        </>
      )}
    </div>
  );
}
