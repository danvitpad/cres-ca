/** --- YAML
 * name: Reviews Dashboard
 * description: Мастер видит все отзывы клиентов (score, comment, фото), сводную статистику и может опубликовать/скрыть каждый отзыв.
 * created: 2026-04-13
 * updated: 2026-04-13
 * --- */

'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Star, Eye, EyeOff } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useMaster } from '@/hooks/use-master';
import { Button } from '@/components/ui/button';

interface ReviewRow {
  id: string;
  score: number;
  comment: string | null;
  photos: string[] | null;
  is_published: boolean;
  created_at: string;
  appointment_id: string | null;
  clients: { full_name: string | null } | null;
  services: { name: string | null } | null;
}

export default function ReviewsPage() {
  const { master } = useMaster();
  const [reviews, setReviews] = useState<ReviewRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!master?.id) return;
    setLoading(true);
    const supabase = createClient();
    const { data } = await supabase
      .from('reviews')
      .select(
        'id, score, comment, photos, is_published, created_at, appointment_id, clients(full_name), services(name)',
      )
      .eq('target_type', 'master')
      .eq('target_id', master.id)
      .order('created_at', { ascending: false });
    setReviews((data ?? []) as unknown as ReviewRow[]);
    setLoading(false);
  }, [master?.id]);

  useEffect(() => {
    load();
  }, [load]);

  const stats = useMemo(() => {
    const total = reviews.length;
    if (!total) return { total: 0, avg: 0, dist: [0, 0, 0, 0, 0] };
    const dist = [0, 0, 0, 0, 0];
    let sum = 0;
    for (const r of reviews) {
      sum += r.score;
      if (r.score >= 1 && r.score <= 5) dist[r.score - 1]++;
    }
    return { total, avg: sum / total, dist };
  }, [reviews]);

  async function toggle(r: ReviewRow) {
    const supabase = createClient();
    const { error } = await supabase
      .from('reviews')
      .update({ is_published: !r.is_published })
      .eq('id', r.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(r.is_published ? 'Скрыт' : 'Опубликован');
    setReviews((p) => p.map((x) => (x.id === r.id ? { ...x, is_published: !r.is_published } : x)));
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-semibold">
          <Star className="h-6 w-6 text-primary" />
          Отзывы клиентов
        </h1>
        <p className="text-sm text-muted-foreground">
          Сводка по всем отзывам. Опубликованные отзывы показываются на публичной странице.
        </p>
      </div>

      <div className="grid gap-4 rounded-lg border bg-card p-5 md:grid-cols-[auto_1fr]">
        <div className="flex flex-col items-center justify-center md:border-r md:pr-6">
          <div className="text-5xl font-bold">{stats.avg.toFixed(1)}</div>
          <div className="mt-1 flex">
            {[1, 2, 3, 4, 5].map((n) => (
              <Star
                key={n}
                className={`h-4 w-4 ${
                  n <= Math.round(stats.avg) ? 'fill-amber-400 text-amber-400' : 'text-muted'
                }`}
              />
            ))}
          </div>
          <div className="mt-1 text-xs text-muted-foreground">{stats.total} отзывов</div>
        </div>
        <div className="space-y-1">
          {[5, 4, 3, 2, 1].map((n) => {
            const count = stats.dist[n - 1];
            const pct = stats.total ? (count / stats.total) * 100 : 0;
            return (
              <div key={n} className="flex items-center gap-2 text-xs">
                <span className="w-3 text-muted-foreground">{n}</span>
                <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                <div className="h-2 flex-1 overflow-hidden rounded bg-muted">
                  <div className="h-full bg-amber-400" style={{ width: `${pct}%` }} />
                </div>
                <span className="w-8 text-right text-muted-foreground">{count}</span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="space-y-3">
        {loading ? (
          <p className="text-sm text-muted-foreground">Загрузка…</p>
        ) : reviews.length === 0 ? (
          <div className="rounded-lg border bg-card p-8 text-center text-sm text-muted-foreground">
            Пока нет отзывов. Они появятся после завершённых визитов.
          </div>
        ) : (
          reviews.map((r) => (
            <div
              key={r.id}
              className={`rounded-lg border p-4 ${
                r.is_published ? 'bg-card' : 'bg-muted/40 opacity-70'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <div className="font-medium">{r.clients?.full_name ?? 'Клиент'}</div>
                    <div className="flex">
                      {[1, 2, 3, 4, 5].map((n) => (
                        <Star
                          key={n}
                          className={`h-3.5 w-3.5 ${
                            n <= r.score ? 'fill-amber-400 text-amber-400' : 'text-muted'
                          }`}
                        />
                      ))}
                    </div>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {new Date(r.created_at).toLocaleDateString()}
                    {r.services?.name ? ` · ${r.services.name}` : ''}
                  </div>
                  {r.comment && <p className="mt-2 text-sm whitespace-pre-wrap">{r.comment}</p>}
                  {r.photos && r.photos.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {r.photos.map((src, i) => (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          key={i}
                          src={src}
                          alt=""
                          className="h-20 w-20 rounded-md border object-cover"
                        />
                      ))}
                    </div>
                  )}
                </div>
                <Button size="sm" variant="outline" onClick={() => toggle(r)}>
                  {r.is_published ? (
                    <>
                      <EyeOff className="mr-1 h-4 w-4" />
                      Скрыть
                    </>
                  ) : (
                    <>
                      <Eye className="mr-1 h-4 w-4" />
                      Показать
                    </>
                  )}
                </Button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
