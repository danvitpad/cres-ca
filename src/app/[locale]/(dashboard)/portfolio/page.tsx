/** --- YAML
 * name: Portfolio Manager
 * description: Мастер добавляет фото работ с тегами (стили/техники). На публичной странице работает фильтрация по тегу.
 * created: 2026-04-13
 * updated: 2026-04-13
 * --- */

'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { toast } from 'sonner';
import { Plus, Trash2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useMaster } from '@/hooks/use-master';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

type Item = {
  id: string;
  image_url: string;
  caption: string | null;
  tags: string[];
  service_id: string | null;
  is_published: boolean;
};

type ServiceOpt = { id: string; name: string };

export default function PortfolioPage() {
  const supabase = createClient();
  const { master } = useMaster();
  const [items, setItems] = useState<Item[]>([]);
  const [services, setServices] = useState<ServiceOpt[]>([]);
  const [loading, setLoading] = useState(true);
  const [file, setFile] = useState<File | null>(null);
  const [caption, setCaption] = useState('');
  const [tagsInput, setTagsInput] = useState('');
  const [serviceId, setServiceId] = useState('');
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    if (!master?.id) return;
    setLoading(true);
    const [{ data: p }, { data: s }] = await Promise.all([
      supabase
        .from('master_portfolio')
        .select('id, image_url, caption, tags, service_id, is_published')
        .eq('master_id', master.id)
        .order('sort_order', { ascending: false })
        .order('created_at', { ascending: false }),
      supabase.from('services').select('id, name').eq('master_id', master.id).order('name'),
    ]);
    setItems((p as Item[]) ?? []);
    setServices((s as ServiceOpt[]) ?? []);
    setLoading(false);
  }, [supabase, master?.id]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleUpload() {
    if (!file || !master?.id) {
      toast.error('Выбери фото');
      return;
    }
    setUploading(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');
      const ext = file.name.split('.').pop() || 'jpg';
      const path = `${user.id}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const { error: upErr } = await supabase.storage.from('portfolio').upload(path, file);
      if (upErr) throw upErr;
      const image_url = supabase.storage.from('portfolio').getPublicUrl(path).data.publicUrl;
      const tags = tagsInput
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean);
      const { error } = await supabase.from('master_portfolio').insert({
        master_id: master.id,
        image_url,
        caption: caption.trim() || null,
        tags,
        service_id: serviceId || null,
      });
      if (error) throw error;
      toast.success('Работа добавлена');
      setFile(null);
      setCaption('');
      setTagsInput('');
      setServiceId('');
      if (fileRef.current) fileRef.current.value = '';
      load();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setUploading(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Удалить работу?')) return;
    const { error } = await supabase.from('master_portfolio').delete().eq('id', id);
    if (error) {
      toast.error(error.message);
      return;
    }
    setItems((prev) => prev.filter((i) => i.id !== id));
  }

  return (
    <div className="mx-auto max-w-5xl space-y-8 p-6">
      <div>
        <h1 className="text-2xl font-semibold">Портфолио</h1>
        <p className="text-sm text-muted-foreground">
          Лучшие работы с тегами стилей и техник. Клиент сможет фильтровать и найти «свой» стиль.
        </p>
      </div>

      <div className="space-y-4 rounded-lg border bg-card p-5">
        <h2 className="text-lg font-medium">Новая работа</h2>
        <div className="space-y-2">
          <Label>Фото</Label>
          <Input
            ref={fileRef}
            type="file"
            accept="image/*"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
        </div>
        <div className="space-y-2">
          <Label>Подпись</Label>
          <Input value={caption} onChange={(e) => setCaption(e.target.value)} placeholder="Напр.: Боб с мелированием" />
        </div>
        <div className="space-y-2">
          <Label>Теги (через запятую)</Label>
          <Input
            value={tagsInput}
            onChange={(e) => setTagsInput(e.target.value)}
            placeholder="боб, мелирование, блонд"
          />
        </div>
        <div className="space-y-2">
          <Label>Услуга (необязательно)</Label>
          <select
            className="w-full rounded-md border bg-background px-3 py-2 text-sm"
            value={serviceId}
            onChange={(e) => setServiceId(e.target.value)}
          >
            <option value="">—</option>
            {services.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
        <Button onClick={handleUpload} disabled={uploading || !file}>
          <Plus className="mr-1 size-4" />
          {uploading ? 'Загрузка…' : 'Добавить'}
        </Button>
      </div>

      <div>
        <h2 className="mb-3 text-lg font-medium">Работы ({items.length})</h2>
        {loading ? (
          <p className="text-sm text-muted-foreground">Загрузка…</p>
        ) : items.length === 0 ? (
          <p className="text-sm text-muted-foreground">Пока пусто.</p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((item) => (
              <div key={item.id} className="overflow-hidden rounded-xl border bg-card">
                <div className="relative aspect-square bg-neutral-100">
                  <Image src={item.image_url} alt={item.caption ?? ''} fill className="object-cover" />
                </div>
                <div className="space-y-2 p-3">
                  {item.caption && <div className="text-sm font-medium">{item.caption}</div>}
                  {item.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {item.tags.map((t) => (
                        <span
                          key={t}
                          className="rounded-full bg-violet-50 px-2 py-0.5 text-xs text-violet-700"
                        >
                          #{t}
                        </span>
                      ))}
                    </div>
                  )}
                  <Button variant="outline" size="sm" onClick={() => handleDelete(item.id)}>
                    <Trash2 className="mr-1 size-4" /> Удалить
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
