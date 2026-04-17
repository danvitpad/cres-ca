/** --- YAML
 * name: Before/After Manager
 * description: Master uploads before/after photo pairs. Rendered on /masters/[id] client side.
 * created: 2026-04-12
 * updated: 2026-04-12
 * --- */

'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';
import { useMaster } from '@/hooks/use-master';
import { useConfirm } from '@/hooks/use-confirm';
import { BeforeAfterSlider } from '@/components/shared/before-after-slider';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

type Pair = {
  id: string;
  before_url: string;
  after_url: string;
  caption: string | null;
  service_id: string | null;
  created_at: string;
};

type ServiceOpt = { id: string; name: string };

export default function BeforeAfterPage() {
  const supabase = createClient();
  const confirm = useConfirm();
  const { master } = useMaster();
  const [pairs, setPairs] = useState<Pair[]>([]);
  const [services, setServices] = useState<ServiceOpt[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [caption, setCaption] = useState('');
  const [serviceId, setServiceId] = useState<string>('');
  const [beforeFile, setBeforeFile] = useState<File | null>(null);
  const [afterFile, setAfterFile] = useState<File | null>(null);
  const beforeRef = useRef<HTMLInputElement>(null);
  const afterRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    if (!master?.id) { setLoading(false); return; }
    setLoading(true);
    const [{ data: p }, { data: s }] = await Promise.all([
      supabase
        .from('before_after_photos')
        .select('id, before_url, after_url, caption, service_id, created_at')
        .eq('master_id', master.id)
        .order('created_at', { ascending: false }),
      supabase.from('services').select('id, name').eq('master_id', master.id).order('name'),
    ]);
    setPairs((p as Pair[]) ?? []);
    setServices((s as ServiceOpt[]) ?? []);
    setLoading(false);
  }, [supabase, master?.id]);

  useEffect(() => {
    load();
  }, [load]);

  async function uploadOne(file: File, kind: 'before' | 'after'): Promise<string> {
    const ext = file.name.split('.').pop() || 'jpg';
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');
    const path = `${user.id}/${Date.now()}-${kind}.${ext}`;
    const { error } = await supabase.storage.from('before-after').upload(path, file);
    if (error) throw error;
    const { data } = supabase.storage.from('before-after').getPublicUrl(path);
    return data.publicUrl;
  }

  async function handleUpload() {
    if (!beforeFile || !afterFile || !master?.id) {
      toast.error('Выберите оба фото');
      return;
    }
    setUploading(true);
    try {
      const [before_url, after_url] = await Promise.all([
        uploadOne(beforeFile, 'before'),
        uploadOne(afterFile, 'after'),
      ]);
      const { error } = await supabase.from('before_after_photos').insert({
        master_id: master.id,
        service_id: serviceId || null,
        before_url,
        after_url,
        caption: caption.trim() || null,
      });
      if (error) throw error;
      toast.success('Пара загружена');
      setCaption('');
      setServiceId('');
      setBeforeFile(null);
      setAfterFile(null);
      if (beforeRef.current) beforeRef.current.value = '';
      if (afterRef.current) afterRef.current.value = '';
      load();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setUploading(false);
    }
  }

  async function handleDelete(id: string) {
    if (!(await confirm({ title: 'Удалить эту пару?', confirmLabel: 'Удалить', destructive: true }))) return;
    const { error } = await supabase.from('before_after_photos').delete().eq('id', id);
    if (error) {
      toast.error(error.message);
      return;
    }
    setPairs((prev) => prev.filter((p) => p.id !== id));
  }

  return (
    <div className="mx-auto max-w-5xl space-y-8 p-6">
      <div>
        <h1 className="text-2xl font-semibold">До и После</h1>
        <p className="text-sm text-muted-foreground">
          Покажи результаты работы. Клиенты увидят слайдер на твоей странице.
        </p>
      </div>

      <div className="rounded-lg border bg-card p-5 space-y-4">
        <h2 className="text-lg font-medium">Добавить пару</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>До</Label>
            <Input
              ref={beforeRef}
              type="file"
              accept="image/*"
              onChange={(e) => setBeforeFile(e.target.files?.[0] ?? null)}
            />
          </div>
          <div className="space-y-2">
            <Label>После</Label>
            <Input
              ref={afterRef}
              type="file"
              accept="image/*"
              onChange={(e) => setAfterFile(e.target.files?.[0] ?? null)}
            />
          </div>
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
        <div className="space-y-2">
          <Label>Подпись</Label>
          <Input value={caption} onChange={(e) => setCaption(e.target.value)} placeholder="Напр.: Френч + укрепление" />
        </div>
        <Button onClick={handleUpload} disabled={uploading || !beforeFile || !afterFile}>
          {uploading ? 'Загрузка…' : 'Опубликовать'}
        </Button>
      </div>

      <div>
        <h2 className="text-lg font-medium mb-3">Галерея ({pairs.length})</h2>
        {loading ? (
          <p className="text-sm text-muted-foreground">Загрузка…</p>
        ) : pairs.length === 0 ? (
          <p className="text-sm text-muted-foreground">Пока нет пар.</p>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2">
            {pairs.map((p) => (
              <div key={p.id} className="space-y-2">
                <BeforeAfterSlider beforeUrl={p.before_url} afterUrl={p.after_url} caption={p.caption} />
                <Button variant="outline" size="sm" onClick={() => handleDelete(p.id)}>
                  Удалить
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
