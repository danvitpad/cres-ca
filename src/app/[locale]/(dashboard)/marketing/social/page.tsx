/** --- YAML
 * name: Social Posts Scheduler
 * description: Master drafts and schedules posts for Instagram/Telegram/Facebook — stored in social_posts for manual or future auto-publishing.
 * created: 2026-04-13
 * updated: 2026-04-13
 * --- */

'use client';

import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Share2, Plus, Trash2, CalendarClock, Image as ImageIcon } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useMaster } from '@/hooks/use-master';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';

interface SocialPost {
  id: string;
  content: string;
  image_url: string | null;
  platforms: string[];
  scheduled_at: string;
  status: string;
  created_at: string;
}

const PLATFORMS = [
  { key: 'instagram', label: 'Instagram' },
  { key: 'telegram', label: 'Telegram' },
  { key: 'facebook', label: 'Facebook' },
];

export default function SocialPostsPage() {
  const { master } = useMaster();
  const [posts, setPosts] = useState<SocialPost[]>([]);
  const [content, setContent] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [scheduledAt, setScheduledAt] = useState('');
  const [platforms, setPlatforms] = useState<string[]>(['instagram']);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!master?.id) return;
    const supabase = createClient();
    const { data } = await supabase
      .from('social_posts')
      .select('*')
      .eq('master_id', master.id)
      .order('scheduled_at', { ascending: false });
    setPosts((data ?? []) as SocialPost[]);
  }, [master?.id]);

  useEffect(() => {
    load();
  }, [load]);

  async function save() {
    if (!master?.id || !content.trim() || !scheduledAt) {
      toast.error('Заполни текст и дату');
      return;
    }
    setSaving(true);
    const supabase = createClient();
    const { error } = await supabase.from('social_posts').insert({
      master_id: master.id,
      content: content.trim(),
      image_url: imageUrl.trim() || null,
      platforms,
      scheduled_at: new Date(scheduledAt).toISOString(),
    });
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }

    // Remind master to publish — picked up by notifications cron
    const { data: m } = await supabase
      .from('masters')
      .select('profile_id')
      .eq('id', master.id)
      .single();
    if (m?.profile_id) {
      await supabase.from('notifications').insert({
        profile_id: m.profile_id,
        channel: 'telegram',
        title: '📣 Время опубликовать',
        body: `Время постить: ${content.trim().slice(0, 80)}${content.length > 80 ? '…' : ''}`,
        scheduled_for: new Date(scheduledAt).toISOString(),
      });
    }

    toast.success('Пост запланирован');
    setContent('');
    setImageUrl('');
    setScheduledAt('');
    setPlatforms(['instagram']);
    load();
  }

  async function remove(id: string) {
    const supabase = createClient();
    const { error } = await supabase.from('social_posts').delete().eq('id', id);
    if (error) {
      toast.error(error.message);
      return;
    }
    setPosts((p) => p.filter((x) => x.id !== id));
  }

  function togglePlatform(key: string) {
    setPlatforms((prev) => (prev.includes(key) ? prev.filter((p) => p !== key) : [...prev, key]));
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-semibold">
          <Share2 className="h-6 w-6 text-primary" />
          Соц-сети — расписание постов
        </h1>
        <p className="text-sm text-muted-foreground">
          Запланируй посты заранее. К назначенному времени придёт напоминание в Telegram с текстом и картинкой.
        </p>
      </div>

      <div className="space-y-3 rounded-lg border bg-card p-5">
        <div className="space-y-2">
          <Label>Текст поста</Label>
          <Textarea
            rows={4}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Что хочешь опубликовать?"
          />
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <div className="space-y-2">
            <Label className="flex items-center gap-1">
              <ImageIcon className="h-4 w-4" /> URL картинки
            </Label>
            <Input
              value={imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
              placeholder="https://…"
            />
          </div>
          <div className="space-y-2">
            <Label className="flex items-center gap-1">
              <CalendarClock className="h-4 w-4" /> Когда опубликовать
            </Label>
            <Input
              type="datetime-local"
              value={scheduledAt}
              onChange={(e) => setScheduledAt(e.target.value)}
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label>Платформы</Label>
          <div className="flex flex-wrap gap-2">
            {PLATFORMS.map((p) => (
              <button
                key={p.key}
                type="button"
                onClick={() => togglePlatform(p.key)}
                className={`rounded-full border px-3 py-1.5 text-sm transition-colors ${
                  platforms.includes(p.key)
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'bg-background hover:bg-muted'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex justify-end">
          <Button onClick={save} disabled={saving}>
            <Plus className="mr-1 h-4 w-4" />
            {saving ? '...' : 'Запланировать'}
          </Button>
        </div>
      </div>

      <div className="space-y-2">
        <h2 className="text-sm font-semibold text-muted-foreground">Запланированные посты</h2>
        {posts.length === 0 ? (
          <p className="rounded-lg border bg-card p-6 text-center text-sm text-muted-foreground">
            Пока нет запланированных постов.
          </p>
        ) : (
          posts.map((p) => (
            <div key={p.id} className="rounded-lg border bg-card p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="text-xs text-muted-foreground">
                    {new Date(p.scheduled_at).toLocaleString()} · {p.platforms.join(', ')}
                  </div>
                  <p className="mt-1 text-sm whitespace-pre-wrap">{p.content}</p>
                  {p.image_url && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={p.image_url}
                      alt=""
                      className="mt-2 max-h-64 rounded-md border"
                    />
                  )}
                </div>
                <Button variant="ghost" size="icon" onClick={() => remove(p.id)}>
                  <Trash2 className="h-4 w-4 text-red-500" />
                </Button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
