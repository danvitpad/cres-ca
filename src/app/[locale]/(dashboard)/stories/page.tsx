/** --- YAML
 * name: Stories Manager
 * description: Мастер создаёт альбомы работ (stories/highlights) — название, обложка, набор фото. Отображаются на публичной витрине `/m/[handle]`.
 * created: 2026-04-13
 * updated: 2026-04-13
 * --- */

'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { toast } from 'sonner';
import { Plus, Trash2, X } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useMaster } from '@/hooks/use-master';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

type Story = {
  id: string;
  title: string;
  cover_url: string | null;
  photos: string[];
  sort_order: number;
  is_published: boolean;
};

export default function StoriesPage() {
  const supabase = createClient();
  const { master } = useMaster();
  const [stories, setStories] = useState<Story[]>([]);
  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    if (!master?.id) return;
    setLoading(true);
    const { data } = await supabase
      .from('master_stories')
      .select('id, title, cover_url, photos, sort_order, is_published')
      .eq('master_id', master.id)
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: false });
    setStories((data as Story[]) ?? []);
    setLoading(false);
  }, [supabase, master?.id]);

  useEffect(() => {
    load();
  }, [load]);

  async function uploadOne(file: File): Promise<string> {
    const ext = file.name.split('.').pop() || 'jpg';
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');
    const path = `${user.id}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const { error } = await supabase.storage.from('stories').upload(path, file);
    if (error) throw error;
    return supabase.storage.from('stories').getPublicUrl(path).data.publicUrl;
  }

  async function handleCreate() {
    if (!master?.id || !title.trim() || files.length === 0) {
      toast.error('Укажи название и хотя бы одно фото');
      return;
    }
    setUploading(true);
    try {
      const urls = await Promise.all(files.map(uploadOne));
      const { error } = await supabase.from('master_stories').insert({
        master_id: master.id,
        title: title.trim(),
        cover_url: urls[0],
        photos: urls,
        sort_order: stories.length,
      });
      if (error) throw error;
      toast.success('Альбом создан');
      setTitle('');
      setFiles([]);
      if (fileRef.current) fileRef.current.value = '';
      load();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setUploading(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Удалить альбом?')) return;
    const { error } = await supabase.from('master_stories').delete().eq('id', id);
    if (error) {
      toast.error(error.message);
      return;
    }
    setStories((prev) => prev.filter((s) => s.id !== id));
  }

  async function togglePublished(story: Story) {
    const { error } = await supabase
      .from('master_stories')
      .update({ is_published: !story.is_published })
      .eq('id', story.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    setStories((prev) => prev.map((s) => (s.id === story.id ? { ...s, is_published: !s.is_published } : s)));
  }

  return (
    <div className="mx-auto max-w-5xl space-y-8 p-6">
      <div>
        <h1 className="text-2xl font-semibold">Истории / альбомы</h1>
        <p className="text-sm text-muted-foreground">
          Сгруппируй работы в альбомы: «Свадебные», «Мужские стрижки», «Коллекция весна». Отображаются на публичной
          странице кружками-сторис.
        </p>
      </div>

      <div className="space-y-4 rounded-lg border bg-card p-5">
        <h2 className="text-lg font-medium">Новый альбом</h2>
        <div className="space-y-2">
          <Label>Название</Label>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Например: Свадебные образы" />
        </div>
        <div className="space-y-2">
          <Label>Фото (можно несколько)</Label>
          <Input
            ref={fileRef}
            type="file"
            accept="image/*"
            multiple
            onChange={(e) => setFiles(Array.from(e.target.files ?? []))}
          />
          {files.length > 0 && <p className="text-xs text-muted-foreground">{files.length} файл(ов) выбрано</p>}
        </div>
        <Button onClick={handleCreate} disabled={uploading || !title.trim() || files.length === 0}>
          <Plus className="mr-1 size-4" />
          {uploading ? 'Загрузка…' : 'Создать альбом'}
        </Button>
      </div>

      <div>
        <h2 className="mb-3 text-lg font-medium">Альбомы ({stories.length})</h2>
        {loading ? (
          <p className="text-sm text-muted-foreground">Загрузка…</p>
        ) : stories.length === 0 ? (
          <p className="text-sm text-muted-foreground">Пока пусто — создай первый альбом.</p>
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {stories.map((story) => (
              <div key={story.id} className="group overflow-hidden rounded-xl border bg-card">
                <div className="relative aspect-square bg-neutral-100">
                  {story.cover_url && (
                    <Image src={story.cover_url} alt={story.title} fill className="object-cover" />
                  )}
                  {!story.is_published && (
                    <div className="absolute left-2 top-2 rounded-full bg-black/70 px-2 py-1 text-xs text-white">
                      скрыт
                    </div>
                  )}
                </div>
                <div className="space-y-2 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="font-medium">{story.title}</div>
                    <div className="text-xs text-muted-foreground">{story.photos.length} фото</div>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" className="flex-1" onClick={() => togglePublished(story)}>
                      {story.is_published ? <X className="size-4" /> : 'Показать'}
                      <span className="ml-1">{story.is_published ? 'Скрыть' : ''}</span>
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => handleDelete(story.id)}>
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
