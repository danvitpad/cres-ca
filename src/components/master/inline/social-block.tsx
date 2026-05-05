/** --- YAML
 * name: InlineSocialBlock
 * description: Блок «Связаться» с inline-редактированием соцсетей и мессенджеров.
 *              Хранится в masters.social_links jsonb (ключи: telegram, instagram,
 *              whatsapp, viber, tiktok, youtube, facebook, website). Клиент видит
 *              кликабельные иконки. Владелец — pencil → bottom-sheet с полями.
 *              Если ничего не заполнено: для клиента блок скрыт, владелец видит
 *              CTA «+ Добавь способы связи». Иконки — фирменные SVG-логотипы.
 * created: 2026-05-02
 * updated: 2026-05-05
 * --- */

'use client';

import { useState } from 'react';
import { Pencil, Plus, Loader2, Globe } from 'lucide-react';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';
import { useIsOwner } from './use-is-owner';
import { InlineEditSheet } from './inline-edit-sheet';

/* ─── Brand SVG icons ────────────────────────────────────────────────────── */

function IconTelegram({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M9.78 18.65l.28-4.23 7.68-6.92c.34-.31-.07-.46-.52-.19L7.74 13.3 3.64 12c-.88-.25-.89-.86.2-1.3l15.97-6.16c.73-.33 1.43.18 1.15 1.26l-2.72 12.81c-.19.91-.74 1.13-1.5.71L12.6 16.3l-1.99 1.93c-.23.23-.42.42-.83.42z" />
    </svg>
  );
}

function IconInstagram({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
    </svg>
  );
}

function IconWhatsApp({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
    </svg>
  );
}

function IconViber({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M11.398.002C8.046-.025 3.765.682 1.486 4.258-.744 7.572.072 11.37.072 11.37s.196 1.47.792 2.762c.893 2.588 5.117 5.994 5.117 5.994v2.76c0 .387.448.6.727.34l2.04-1.956s1.227.098 1.93.086c3.773-.098 7.47-1.98 8.234-6.332.864-4.904-.43-8.036-3.2-9.81A11.24 11.24 0 0011.398.002zm.183 3.29c.345-.006.69.014 1.034.06 0 0 3.696.516 4.68 4.46.496 1.988.28 5.24-2.85 6.7a8.58 8.58 0 01-2.878.73s-1.176-.014-1.56 0l-1.62 1.47v-1.78s-3.496-1.638-3.768-5.376C4.34 5.78 7.372 3.365 11.58 3.29zm.394 2.014a4.76 4.76 0 00-4.76 4.76 4.76 4.76 0 001.43 3.373l-.294 1.07 1.112-.3a4.754 4.754 0 002.512.718 4.76 4.76 0 004.76-4.76 4.76 4.76 0 00-4.76-4.861zm1.78 2.286c.228 0 .457.016.683.05.088.013.177.03.264.05l.045.01c.184.045.36.115.52.22.32.216.46.53.436.936a.764.764 0 01-.015.12c-.034.178-.11.358-.235.52a1.554 1.554 0 01-.417.39c-.224.15-.48.218-.74.196-.057-.005-.115-.013-.173-.025a4.2 4.2 0 01-1.25-.477 4.717 4.717 0 01-.913-.69 4.72 4.72 0 01-.69-.913 4.197 4.197 0 01-.477-1.25 1.2 1.2 0 01-.025-.173c-.022-.26.047-.516.196-.74a1.554 1.554 0 01.39-.417c.162-.126.342-.2.52-.235a.764.764 0 01.12-.015c.407-.024.72.116.936.436.106.16.175.336.22.52l.01.045c.02.087.037.176.05.264.034.226.05.453.05.68z" />
    </svg>
  );
}

function IconTikTok({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1V9.01a6.27 6.27 0 00-.79-.05 6.34 6.34 0 00-6.34 6.34 6.34 6.34 0 006.34 6.34 6.34 6.34 0 006.33-6.34V8.69a8.181 8.181 0 004.79 1.52V6.76a4.85 4.85 0 01-1.02-.07z" />
    </svg>
  );
}

function IconYouTube({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M23.495 6.205a3.007 3.007 0 00-2.088-2.088c-1.87-.501-9.396-.501-9.396-.501s-7.507-.01-9.396.501A3.007 3.007 0 00.527 6.205a31.247 31.247 0 00-.522 5.805 31.247 31.247 0 00.522 5.783 3.007 3.007 0 002.088 2.088c1.868.502 9.396.502 9.396.502s7.506 0 9.396-.502a3.007 3.007 0 002.088-2.088 31.247 31.247 0 00.5-5.783 31.247 31.247 0 00-.5-5.805zM9.609 15.601V8.408l6.264 3.602z" />
    </svg>
  );
}

function IconFacebook({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
    </svg>
  );
}

/* ─── Types ──────────────────────────────────────────────────────────────── */

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

type IconFC = (props: { className?: string }) => React.ReactElement;

interface Props {
  masterId: string;
  masterProfileId: string | null;
  initialSocialLinks: SocialLinks | null;
}

/* ─── Field registry ─────────────────────────────────────────────────────── */

const FIELDS: Array<{
  key: keyof SocialLinks;
  label: string;
  placeholder: string;
  Icon: IconFC;
  bg: string;
  href: (v: string) => string;
}> = [
  { key: 'telegram',  label: 'Telegram',  placeholder: '@username',         Icon: IconTelegram,  bg: '#2AABEE', href: (v) => `https://t.me/${v.replace(/^@/, '')}` },
  { key: 'instagram', label: 'Instagram', placeholder: '@username',         Icon: IconInstagram, bg: '#E1306C', href: (v) => `https://instagram.com/${v.replace(/^@/, '')}` },
  { key: 'whatsapp',  label: 'WhatsApp',  placeholder: '+380...',           Icon: IconWhatsApp,  bg: '#25D366', href: (v) => `https://wa.me/${v.replace(/[^\d]/g, '')}` },
  { key: 'viber',     label: 'Viber',     placeholder: '+380...',           Icon: IconViber,     bg: '#7360F2', href: (v) => `viber://chat?number=${encodeURIComponent(v)}` },
  { key: 'tiktok',    label: 'TikTok',    placeholder: '@username',         Icon: IconTikTok,    bg: '#010101', href: (v) => `https://tiktok.com/@${v.replace(/^@/, '')}` },
  { key: 'youtube',   label: 'YouTube',   placeholder: 'Ссылка на канал',   Icon: IconYouTube,   bg: '#FF0000', href: (v) => v.startsWith('http') ? v : `https://youtube.com/@${v.replace(/^@/, '')}` },
  { key: 'facebook',  label: 'Facebook',  placeholder: 'Ссылка на профиль', Icon: IconFacebook,  bg: '#1877F2', href: (v) => v.startsWith('http') ? v : `https://facebook.com/${v}` },
  { key: 'website',   label: 'Сайт',      placeholder: 'https://...',       Icon: Globe as unknown as IconFC, bg: '#6B7280', href: (v) => v.startsWith('http') ? v : `https://${v}` },
];

/* ─── Component ──────────────────────────────────────────────────────────── */

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

  if (!hasAny && !isOwner) return null;

  if (!hasAny && isOwner) {
    return (
      <>
        <button
          type="button"
          onClick={startEdit}
          className="group flex w-full items-start gap-4 rounded-2xl p-5 text-left transition-colors"
          style={{
            background: 'var(--m-accent-soft)',
            border: '1.5px solid color-mix(in oklab, var(--m-accent) 30%, transparent)',
          }}
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
                <span
                  className="flex size-9 shrink-0 items-center justify-center rounded-full text-white"
                  style={{ background: f.bg }}
                >
                  <Icon className="size-[18px]" />
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
          <button type="button" onClick={onClose} className="cres-popup-btn-cancel">
            Отмена
          </button>
          <button type="button" onClick={onSave} disabled={saving} className="cres-popup-btn-save">
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
              <label className="mb-1.5 flex items-center gap-2 text-[12px] font-semibold text-neutral-700">
                <span
                  className="flex size-5 shrink-0 items-center justify-center rounded-full text-white"
                  style={{ background: f.bg }}
                >
                  <Icon className="size-3" />
                </span>
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
