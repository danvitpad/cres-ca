/** --- YAML
 * name: InlineSocialBlock
 * description: Блок «Связаться» с inline-редактированием соцсетей и мессенджеров.
 *              Хранится в masters.social_links jsonb (ключи: telegram, instagram,
 *              whatsapp, viber, tiktok, youtube, facebook, website). Клиент видит
 *              кликабельные иконки. Владелец — pencil → bottom-sheet с полями.
 *              Если ничего не заполнено: для клиента блок скрыт, владелец видит
 *              CTA «+ Добавь способы связи».
 * created: 2026-05-02
 * --- */

'use client';

import { useState } from 'react';
import { Pencil, Plus, Loader2, Send, Camera, MessageCircle, Globe, Video, Users } from 'lucide-react';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';
import { useIsOwner } from './use-is-owner';
import { InlineEditSheet } from './inline-edit-sheet';

interface SocialLinks {
  telegram?: string;
  instagram?: string;
  whatsapp?: string;
  viber?: string;
  tiktok?: string;
  youtube?: string;
  facebook?: string;
  website?: string;
}

interface Props {
  masterId: string;
  masterProfileId: string | null;
  initialSocialLinks: SocialLinks | null;
}

const FIELDS: Array<{ key: keyof SocialLinks; label: string; placeholder: string; Icon: typeof Send; href: (v: string) => string }> = [
  { key: 'telegram',  label: 'Telegram',  placeholder: '@username',          Icon: Send,          href: (v) => `https://t.me/${v.replace(/^@/, '')}` },
  { key: 'instagram', label: 'Instagram', placeholder: '@username',          Icon: Camera,        href: (v) => `https://instagram.com/${v.replace(/^@/, '')}` },
  { key: 'whatsapp',  label: 'WhatsApp',  placeholder: '+380...',            Icon: MessageCircle, href: (v) => `https://wa.me/${v.replace(/[^\d]/g, '')}` },
  { key: 'viber',     label: 'Viber',     placeholder: '+380...',            Icon: MessageCircle, href: (v) => `viber://chat?number=${encodeURIComponent(v)}` },
  { key: 'tiktok',    label: 'TikTok',    placeholder: '@username',          Icon: Video,         href: (v) => `https://tiktok.com/@${v.replace(/^@/, '')}` },
  { key: 'youtube',   label: 'YouTube',   placeholder: 'Ссылка на канал',    Icon: Video,         href: (v) => v.startsWith('http') ? v : `https://youtube.com/@${v.replace(/^@/, '')}` },
  { key: 'facebook',  label: 'Facebook',  placeholder: 'Ссылка на профиль',  Icon: Users,         href: (v) => v.startsWith('http') ? v : `https://facebook.com/${v}` },
  { key: 'website',   label: 'Сайт',      placeholder: 'https://...',        Icon: Globe,         href: (v) => v.startsWith('http') ? v : `https://${v}` },
];

export function InlineSocialBlock({ masterId, masterProfileId, initialSocialLinks }: Props) {
  const isOwner = useIsOwner(masterProfileId);
  const [links, setLinks] = useState<SocialLinks>(initialSocialLinks ?? {});
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<SocialLinks>(initialSocialLinks ?? {});
  const [saving, setSaving] = useState(false);

  const filled = FIELDS.filter((f) => (links[f.key] ?? '').trim().length > 0);
  const hasAny = filled.length > 0;

  function startEdit() {
    setDraft({ ...links });
    setOpen(true);
  }

  async function save() {
    setSaving(true);
    try {
      const supabase = createClient();
      // Strip empty values so DB stores only filled keys
      const cleaned: SocialLinks = {};
      for (const f of FIELDS) {
        const v = (draft[f.key] ?? '').trim();
        if (v) cleaned[f.key] = v;
      }
      const { error } = await supabase
        .from('masters')
        .update({ social_links: Object.keys(cleaned).length ? cleaned : null })
        .eq('id', masterId);
      if (error) {
        toast.error(error.message || 'Не удалось сохранить');
        return;
      }
      setLinks(cleaned);
      toast.success('Сохранено');
      setOpen(false);
    } finally {
      setSaving(false);
    }
  }

  // Client view: hidden if nothing filled
  if (!hasAny && !isOwner) return null;

  // Owner empty state — premium CTA
  if (!hasAny && isOwner) {
    return (
      <>
        <button
          type="button"
          onClick={startEdit}
          className="group flex w-full items-start gap-4 rounded-2xl border-2 border-dashed border-neutral-300 bg-white p-5 text-left transition-colors hover:border-neutral-900 hover:bg-neutral-50"
        >
          <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-neutral-100 text-neutral-700 group-hover:bg-neutral-900 group-hover:text-white">
            <Plus className="size-5" />
          </span>
          <span className="flex-1">
            <span className="block text-[15px] font-bold text-neutral-900">Добавь способы связи</span>
            <span className="mt-1 block text-[13px] text-neutral-500">
              Telegram, Instagram, WhatsApp, сайт — клиенту проще написать тебе там, где он привык.
            </span>
          </span>
        </button>
        <SocialSheet open={open} onClose={() => setOpen(false)} draft={draft} setDraft={setDraft} onSave={save} saving={saving} />
      </>
    );
  }

  // Filled list of social icons
  return (
    <section>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-[22px] font-bold text-neutral-900">Связаться</h2>
        {isOwner && (
          <button
            type="button"
            onClick={startEdit}
            className="flex size-9 items-center justify-center rounded-full text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-neutral-900"
            aria-label="Редактировать соцсети"
            title="Редактировать соцсети"
          >
            <Pencil className="size-4" />
          </button>
        )}
      </div>
      <ul className="grid gap-2 sm:grid-cols-2">
        {filled.map((f) => {
          const value = links[f.key]!;
          const Icon = f.Icon;
          return (
            <li key={f.key}>
              <a
                href={f.href(value)}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 rounded-2xl border border-neutral-200 bg-white px-4 py-3 transition-colors hover:bg-neutral-50"
              >
                <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-neutral-100 text-neutral-700">
                  <Icon className="size-4" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[12px] font-semibold text-neutral-500">{f.label}</span>
                  <span className="block truncate text-[14px] font-semibold text-neutral-900">{value}</span>
                </span>
              </a>
            </li>
          );
        })}
      </ul>
      <SocialSheet open={open} onClose={() => setOpen(false)} draft={draft} setDraft={setDraft} onSave={save} saving={saving} />
    </section>
  );
}

function SocialSheet({
  open, onClose, draft, setDraft, onSave, saving,
}: {
  open: boolean;
  onClose: () => void;
  draft: SocialLinks;
  setDraft: React.Dispatch<React.SetStateAction<SocialLinks>>;
  onSave: () => void;
  saving: boolean;
}) {
  return (
    <InlineEditSheet
      open={open}
      onClose={onClose}
      title="Способы связи"
      footer={
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-neutral-200 px-5 py-2 text-[13px] font-semibold text-neutral-700 hover:bg-neutral-50"
          >
            Отмена
          </button>
          <button
            type="button"
            onClick={onSave}
            disabled={saving}
            className="inline-flex items-center gap-1.5 rounded-[var(--brand-radius-lg)] bg-neutral-900 px-5 py-2 text-[13px] font-semibold text-white disabled:opacity-50"
          >
            {saving && <Loader2 className="size-3.5 animate-spin" />}
            Сохранить
          </button>
        </div>
      }
    >
      <p className="mb-4 text-[13px] text-neutral-500">
        Заполни только те, которыми пользуешься. Пустые поля скроются на странице.
      </p>
      <div className="space-y-3">
        {FIELDS.map((f) => {
          const Icon = f.Icon;
          return (
            <div key={f.key}>
              <label className="mb-1.5 flex items-center gap-1.5 text-[12px] font-semibold text-neutral-700">
                <Icon className="size-3.5 text-neutral-500" />
                {f.label}
              </label>
              <input
                type="text"
                value={draft[f.key] ?? ''}
                onChange={(e) => setDraft((d) => ({ ...d, [f.key]: e.target.value }))}
                placeholder={f.placeholder}
                className="block w-full rounded-xl border border-neutral-200 bg-white px-3 py-2 text-[14px] text-neutral-900 outline-none focus:border-neutral-400"
              />
            </div>
          );
        })}
      </div>
    </InlineEditSheet>
  );
}
