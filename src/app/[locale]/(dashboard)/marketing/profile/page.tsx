/** --- YAML
 * name: SEO Profile Card
 * description: Мастер редактирует публичную SEO-карточку — display_name, bio, specialization, city, meta_title, meta_description, og image. Сохраняется в masters, рендерится на /m/<handle>.
 * created: 2026-04-13
 * updated: 2026-04-13
 * --- */

'use client';

import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Search, ExternalLink, Save } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useMaster } from '@/hooks/use-master';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';

interface SeoForm {
  display_name: string;
  specialization: string;
  bio: string;
  city: string;
  address: string;
  cover_url: string;
  meta_title: string;
  meta_description: string;
  og_image_url: string;
}

const EMPTY: SeoForm = {
  display_name: '',
  specialization: '',
  bio: '',
  city: '',
  address: '',
  cover_url: '',
  meta_title: '',
  meta_description: '',
  og_image_url: '',
};

export default function SeoProfilePage() {
  const { master, refetch } = useMaster();
  const [form, setForm] = useState<SeoForm>(EMPTY);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!master?.id) return;
    const supabase = createClient();
    const { data } = await supabase
      .from('masters')
      .select(
        'display_name, specialization, bio, city, address, cover_url, meta_title, meta_description, og_image_url',
      )
      .eq('id', master.id)
      .single();
    if (data) setForm({ ...EMPTY, ...(data as Partial<SeoForm>) });
  }, [master?.id]);

  useEffect(() => {
    load();
  }, [load]);

  async function save() {
    if (!master?.id) return;
    setSaving(true);
    const supabase = createClient();
    const { error } = await supabase
      .from('masters')
      .update({
        display_name: form.display_name || null,
        specialization: form.specialization || null,
        bio: form.bio || null,
        city: form.city || null,
        address: form.address || null,
        cover_url: form.cover_url || null,
        meta_title: form.meta_title || null,
        meta_description: form.meta_description || null,
        og_image_url: form.og_image_url || null,
      })
      .eq('id', master.id);
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success('SEO обновлено');
    refetch();
  }

  function update<K extends keyof SeoForm>(k: K, v: SeoForm[K]) {
    setForm((p) => ({ ...p, [k]: v }));
  }

  const publicUrl = master?.invite_code ? `https://cres.ca/m/${master.invite_code}` : '';
  const previewTitle =
    form.meta_title || `${form.display_name || 'Мастер'} — ${form.specialization || 'услуги'}`;
  const previewDesc =
    form.meta_description ||
    form.bio?.slice(0, 160) ||
    `Онлайн-запись к ${form.display_name || 'мастеру'} в ${form.city || 'вашем городе'}`;

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-semibold">
          <Search className="h-6 w-6 text-primary" />
          SEO-карточка
        </h1>
        <p className="text-sm text-muted-foreground">
          Настрой как твоя страница выглядит в Google, Telegram и соцсетях при отправке ссылки.
        </p>
      </div>

      {publicUrl && (
        <div className="rounded-lg border bg-card p-4">
          <div className="mb-2 text-xs font-medium text-muted-foreground">Превью в поисковике</div>
          <div className="text-xs text-green-700">{publicUrl}</div>
          <div className="text-lg text-blue-600 underline">{previewTitle}</div>
          <div className="text-sm text-muted-foreground">{previewDesc}</div>
        </div>
      )}

      <div className="space-y-5 rounded-lg border bg-card p-5">
        <div className="grid gap-3 md:grid-cols-2">
          <div className="space-y-1">
            <Label>Отображаемое имя</Label>
            <Input
              value={form.display_name}
              onChange={(e) => update('display_name', e.target.value)}
              placeholder="Анна Иванова"
            />
          </div>
          <div className="space-y-1">
            <Label>Специализация</Label>
            <Input
              value={form.specialization}
              onChange={(e) => update('specialization', e.target.value)}
              placeholder="Стилист, колорист"
            />
          </div>
          <div className="space-y-1">
            <Label>Город</Label>
            <Input
              value={form.city}
              onChange={(e) => update('city', e.target.value)}
              placeholder="Монреаль"
            />
          </div>
          <div className="space-y-1">
            <Label>Адрес</Label>
            <Input
              value={form.address}
              onChange={(e) => update('address', e.target.value)}
              placeholder="123 Rue Saint-Denis"
            />
          </div>
        </div>

        <div className="space-y-1">
          <Label>О себе (bio)</Label>
          <Textarea
            rows={3}
            value={form.bio}
            onChange={(e) => update('bio', e.target.value)}
            placeholder="Расскажи о себе, опыте и подходе…"
          />
        </div>

        <div className="space-y-1">
          <Label>Обложка (URL)</Label>
          <Input
            value={form.cover_url}
            onChange={(e) => update('cover_url', e.target.value)}
            placeholder="https://…"
          />
        </div>

        <div className="border-t pt-4">
          <div className="mb-3 text-sm font-semibold">Meta теги (опционально)</div>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label>Meta title</Label>
              <Input
                value={form.meta_title}
                onChange={(e) => update('meta_title', e.target.value)}
                maxLength={70}
                placeholder="Оставь пустым — сгенерируется автоматически"
              />
              <div className="text-xs text-muted-foreground">{form.meta_title.length}/70</div>
            </div>
            <div className="space-y-1">
              <Label>Meta description</Label>
              <Textarea
                rows={2}
                value={form.meta_description}
                onChange={(e) => update('meta_description', e.target.value)}
                maxLength={160}
                placeholder="Оставь пустым — подставится bio"
              />
              <div className="text-xs text-muted-foreground">
                {form.meta_description.length}/160
              </div>
            </div>
            <div className="space-y-1">
              <Label>OG image URL (1200×630)</Label>
              <Input
                value={form.og_image_url}
                onChange={(e) => update('og_image_url', e.target.value)}
                placeholder="https://…"
              />
            </div>
          </div>
        </div>

        <div className="flex justify-between">
          {publicUrl ? (
            <a
              href={publicUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
            >
              <ExternalLink className="h-4 w-4" />
              Открыть публичную страницу
            </a>
          ) : (
            <span />
          )}
          <Button onClick={save} disabled={saving}>
            <Save className="mr-1 h-4 w-4" />
            {saving ? '...' : 'Сохранить'}
          </Button>
        </div>
      </div>
    </div>
  );
}
