/** --- YAML
 * name: PublicPageCustomizer
 * description: Full customizer for the master's /m/{slug} public page. Opens as a
 *              right-side drawer overlaid on top of the live page. Sections:
 *              Тип страницы → Обложка + аватар → Цвета → Био + интересы →
 *              Контакты (с public/private toggles) → Соцсети → Видимость.
 *              Mutates state optimistically and PATCHes /api/me/master-customization
 *              on save. Uses storage bucket `avatars` for cover + avatar uploads.
 * created: 2026-04-26
 * --- */

'use client';

import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import {
  X, Camera, ImagePlus, Save, Loader2, Plus, Trash2,
  Eye, EyeOff,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

const PAGE_TYPES = [
  { value: 'master',       label: 'Индивидуальный мастер' },
  { value: 'salon',        label: 'Салон красоты' },
  { value: 'clinic',       label: 'Клиника / медцентр' },
  { value: 'workshop',     label: 'Мастерская / ремонт' },
  { value: 'auto_service', label: 'Автосервис' },
  { value: 'fitness',      label: 'Фитнес / спорт' },
  { value: 'other',        label: 'Другое' },
] as const;

const SOCIAL_KEYS = [
  { key: 'telegram',  label: 'Telegram',  placeholder: '@username или ссылка' },
  { key: 'instagram', label: 'Instagram', placeholder: '@username или ссылка' },
  { key: 'whatsapp',  label: 'WhatsApp',  placeholder: '+380...' },
  { key: 'viber',     label: 'Viber',     placeholder: '+380...' },
  { key: 'tiktok',    label: 'TikTok',    placeholder: '@username' },
  { key: 'youtube',   label: 'YouTube',   placeholder: 'ссылка на канал' },
  { key: 'website',   label: 'Сайт',      placeholder: 'https://...' },
] as const;

const PRESET_COLORS = [
  'var(--color-accent)', '#3b82f6', '#0ea5e9', '#06b6d4',
  '#10b981', '#22c55e', '#eab308', '#f97316',
  '#ef4444', '#ec4899', '#f43f5e', '#2dd4bf',
  '#1f2937', '#0f172a',
];

interface Master {
  id: string;
  profile_id?: string | null;
  bio: string | null;
  cover_url: string | null;
  theme_primary_color: string | null;
  theme_background_color: string | null;
  banner_position_y: number | null;
  phone_public: boolean | null;
  email_public: boolean | null;
  dob_public: boolean | null;
  interests: string[] | null;
  social_links: Record<string, string> | null;
  page_type: string | null;
  is_public: boolean | null;
  // Migration 00114
  languages: string[] | null;
  workplace_name: string | null;
  workplace_photo_url: string | null;
  profile?: { avatar_url: string | null } | null;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  master: Master;
  onSaved?: () => void;
}

export function PublicPageCustomizer({ open, onOpenChange, master, onSaved }: Props) {
  const [bio, setBio] = useState(master.bio ?? '');
  const [coverUrl, setCoverUrl] = useState<string | null>(master.cover_url);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(master.profile?.avatar_url ?? null);
  const [primary, setPrimary] = useState(master.theme_primary_color ?? 'var(--color-accent)');
  const [background, setBackground] = useState<string | null>(master.theme_background_color);
  const [bannerY, setBannerY] = useState(master.banner_position_y ?? 50);
  const [phonePublic, setPhonePublic] = useState(master.phone_public ?? true);
  const [emailPublic, setEmailPublic] = useState(master.email_public ?? false);
  const [dobPublic, setDobPublic] = useState(master.dob_public ?? false);
  const [interests, setInterests] = useState<string[]>(master.interests ?? []);
  const [interestDraft, setInterestDraft] = useState('');
  const [social, setSocial] = useState<Record<string, string>>(master.social_links ?? {});
  const [pageType, setPageType] = useState(master.page_type ?? 'master');
  const [isPublic, setIsPublic] = useState(master.is_public ?? true);
  const [languages, setLanguages] = useState<string[]>(master.languages ?? []);
  const [languageDraft, setLanguageDraft] = useState('');
  const [workplaceName, setWorkplaceName] = useState(master.workplace_name ?? '');
  const [workplacePhotoUrl, setWorkplacePhotoUrl] = useState<string | null>(master.workplace_photo_url);
  const [workplaceBusy, setWorkplaceBusy] = useState(false);
  const workplaceInput = useRef<HTMLInputElement>(null);
  const [saving, setSaving] = useState(false);
  const [coverBusy, setCoverBusy] = useState(false);
  const [avatarBusy, setAvatarBusy] = useState(false);
  const coverInput = useRef<HTMLInputElement>(null);
  const avatarInput = useRef<HTMLInputElement>(null);

  // Re-hydrate from master prop when reopening with a fresh row
  useEffect(() => {
    if (!open) return;
    setBio(master.bio ?? '');
    setCoverUrl(master.cover_url);
    setAvatarUrl(master.profile?.avatar_url ?? null);
    setPrimary(master.theme_primary_color ?? 'var(--color-accent)');
    setBackground(master.theme_background_color);
    setBannerY(master.banner_position_y ?? 50);
    setPhonePublic(master.phone_public ?? true);
    setEmailPublic(master.email_public ?? false);
    setDobPublic(master.dob_public ?? false);
    setInterests(master.interests ?? []);
    setSocial(master.social_links ?? {});
    setPageType(master.page_type ?? 'master');
    setIsPublic(master.is_public ?? true);
    setLanguages(master.languages ?? []);
    setWorkplaceName(master.workplace_name ?? '');
    setWorkplacePhotoUrl(master.workplace_photo_url);
  }, [open, master]);

  async function uploadImage(kind: 'cover' | 'avatar', file: File) {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;
    if (file.size > 8 * 1024 * 1024) {
      toast.error('Файл больше 8 MB');
      return null;
    }
    const ext = file.name.split('.').pop() || 'jpg';
    const path = `${user.id}/${kind}-${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from('avatars').upload(path, file, {
      cacheControl: '3600',
      upsert: false,
    });
    if (error) {
      toast.error(`Не удалось загрузить: ${error.message}`);
      return null;
    }
    return supabase.storage.from('avatars').getPublicUrl(path).data.publicUrl;
  }

  async function handleCoverFile(f: File | null) {
    if (!f) return;
    setCoverBusy(true);
    const url = await uploadImage('cover', f);
    if (url) setCoverUrl(url);
    setCoverBusy(false);
  }

  async function handleAvatarFile(f: File | null) {
    if (!f) return;
    setAvatarBusy(true);
    const url = await uploadImage('avatar', f);
    if (url) setAvatarUrl(url);
    setAvatarBusy(false);
  }

  function addInterest() {
    const v = interestDraft.trim();
    if (!v || interests.includes(v)) return;
    if (interests.length >= 30) return;
    setInterests([...interests, v]);
    setInterestDraft('');
  }

  function removeInterest(i: number) {
    setInterests(interests.filter((_, idx) => idx !== i));
  }

  function addLanguage() {
    const v = languageDraft.trim();
    if (!v || languages.includes(v)) return;
    if (languages.length >= 10) return;
    setLanguages([...languages, v]);
    setLanguageDraft('');
  }
  function removeLanguage(i: number) {
    setLanguages(languages.filter((_, idx) => idx !== i));
  }

  async function uploadWorkplace(file: File) {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;
    if (file.size > 8 * 1024 * 1024) {
      toast.error('Файл больше 8 MB');
      return null;
    }
    const ext = file.name.split('.').pop() || 'jpg';
    const path = `${user.id}/workplace-${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from('avatars').upload(path, file, {
      cacheControl: '3600', upsert: false,
    });
    if (error) { toast.error(`Не удалось загрузить: ${error.message}`); return null; }
    const { data } = supabase.storage.from('avatars').getPublicUrl(path);
    return data.publicUrl;
  }

  async function save() {
    setSaving(true);
    const res = await fetch('/api/me/master-customization', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        bio,
        cover_url: coverUrl,
        avatar_url: avatarUrl,
        theme_primary_color: primary,
        theme_background_color: background,
        banner_position_y: bannerY,
        phone_public: phonePublic,
        email_public: emailPublic,
        dob_public: dobPublic,
        interests,
        social_links: social,
        page_type: pageType,
        is_public: isPublic,
        languages,
        workplace_name: workplaceName.trim() || null,
        workplace_photo_url: workplacePhotoUrl,
      }),
    });
    setSaving(false);
    const j = await res.json().catch(() => ({} as Record<string, unknown>));
    if (!res.ok) {
      toast.error((j as { error?: string }).error || 'Не удалось сохранить');
      return;
    }
    toast.success('Сохранено');
    onSaved?.();
    onOpenChange(false);
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/40 backdrop-blur-sm" onClick={() => onOpenChange(false)}>
      <div
        className="relative h-full w-full max-w-md overflow-y-auto bg-card shadow-2xl border-l border-border"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-border bg-card/95 px-5 py-3 backdrop-blur">
          <div>
            <h2 className="text-base font-semibold">Настройка страницы</h2>
            <p className="text-[11px] text-muted-foreground">Так тебя увидят клиенты на /m/{`{handle}`}</p>
          </div>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="p-1.5 rounded-md hover:bg-muted text-muted-foreground"
            aria-label="Закрыть"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-5 p-5">
          {/* Visibility */}
          <Section title="Видимость">
            <label className="flex items-center justify-between gap-3 rounded-lg border border-border p-3">
              <div>
                <p className="text-sm font-medium">Страница опубликована</p>
                <p className="text-[11px] text-muted-foreground">Когда выкл — посторонние увидят 404, ты — обычно</p>
              </div>
              <input
                type="checkbox"
                checked={isPublic}
                onChange={(e) => setIsPublic(e.target.checked)}
                className="size-5 accent-primary"
              />
            </label>
          </Section>

          {/* Page type */}
          <Section title="Тип страницы">
            <select
              value={pageType}
              onChange={(e) => setPageType(e.target.value)}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:border-primary"
            >
              {PAGE_TYPES.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
            <p className="text-[11px] text-muted-foreground mt-1.5">
              Влияет на тексты на странице и индексацию в поиске («Записаться к мастеру» vs «Записаться в клинику»)
            </p>
          </Section>

          {/* Cover + avatar */}
          <Section title="Обложка и аватар">
            <div className="relative">
              <button
                type="button"
                onClick={() => coverInput.current?.click()}
                className="relative block h-36 w-full overflow-hidden rounded-xl border border-dashed border-border bg-muted/30 hover:border-primary/40"
              >
                {coverUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={coverUrl}
                    alt=""
                    className="h-full w-full object-cover"
                    style={{ objectPosition: `center ${bannerY}%` }}
                  />
                ) : (
                  <div className="flex h-full flex-col items-center justify-center gap-2 text-muted-foreground">
                    {coverBusy ? <Loader2 className="size-5 animate-spin" /> : <ImagePlus className="size-5" />}
                    <span className="text-xs">{coverBusy ? 'Загружаю...' : 'Нажми чтобы выбрать обложку'}</span>
                  </div>
                )}
              </button>
              {coverUrl && (
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); setCoverUrl(null); }}
                  className="absolute right-2 top-2 flex size-7 items-center justify-center rounded-full bg-black/60 text-white"
                  title="Убрать обложку"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
              <input ref={coverInput} type="file" accept="image/*" hidden
                     onChange={(e) => handleCoverFile(e.target.files?.[0] ?? null)} />
              {/* Avatar overlapping bottom-left */}
              <div className="absolute -bottom-8 left-3">
                <button
                  type="button"
                  onClick={() => avatarInput.current?.click()}
                  className="relative size-20 overflow-hidden rounded-full border-4 border-card bg-muted shadow-md"
                >
                  {avatarUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={avatarUrl} alt="" className="h-full w-full object-cover" />
                  ) : avatarBusy ? (
                    <Loader2 className="size-5 animate-spin m-auto text-muted-foreground" />
                  ) : (
                    <Camera className="size-5 m-auto text-muted-foreground" />
                  )}
                </button>
                <input ref={avatarInput} type="file" accept="image/*" hidden
                       onChange={(e) => handleAvatarFile(e.target.files?.[0] ?? null)} />
              </div>
            </div>
            <div className="mt-10">
              <label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                Положение обложки по вертикали ({bannerY}%)
              </label>
              <input
                type="range"
                min={0}
                max={100}
                step={1}
                value={bannerY}
                onChange={(e) => setBannerY(Number(e.target.value))}
                className="mt-2 w-full accent-primary"
                disabled={!coverUrl}
              />
              <p className="text-[10px] text-muted-foreground mt-1">
                Двигай ползунок чтобы выбрать какую часть высокой картинки видно — низ / центр / верх
              </p>
            </div>
          </Section>

          {/* Theme colors */}
          <Section title="Цвет акцента">
            <div className="flex flex-wrap gap-2 mb-2">
              {PRESET_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setPrimary(c)}
                  className={`size-8 rounded-full ring-offset-2 ring-offset-card transition ${primary === c ? 'ring-2 ring-foreground' : ''}`}
                  style={{ background: c }}
                  title={c}
                />
              ))}
            </div>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={primary}
                onChange={(e) => setPrimary(e.target.value)}
                className="h-9 w-12 cursor-pointer rounded border border-input bg-background"
              />
              <input
                type="text"
                value={primary}
                onChange={(e) => setPrimary(e.target.value)}
                placeholder="var(--color-accent)"
                pattern="^#[0-9a-fA-F]{6}$"
                className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm font-mono outline-none focus:border-primary"
              />
            </div>
          </Section>

          <Section title="Цвет фона страницы">
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={background ?? '#ffffff'}
                onChange={(e) => setBackground(e.target.value)}
                className="h-9 w-12 cursor-pointer rounded border border-input bg-background"
              />
              <input
                type="text"
                value={background ?? ''}
                onChange={(e) => setBackground(e.target.value || null)}
                placeholder="по умолчанию (как у сайта)"
                className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm font-mono outline-none focus:border-primary"
              />
              {background && (
                <button
                  type="button"
                  onClick={() => setBackground(null)}
                  className="rounded-md border border-input p-2 text-xs text-muted-foreground hover:bg-muted"
                  title="Сбросить — будет использоваться фон сайта"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </Section>

          {/* Bio */}
          <Section title="О себе">
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              rows={4}
              placeholder="Коротко расскажи чем занимаешься, опыт, подход..."
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:border-primary resize-y"
              maxLength={1000}
            />
            <p className="text-[10px] text-muted-foreground text-right mt-1">{bio.length}/1000</p>
          </Section>

          {/* Interests */}
          <Section title="Интересы и увлечения">
            <div className="flex flex-wrap gap-1.5 mb-2">
              {interests.map((tag, i) => (
                <span
                  key={tag}
                  className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-xs"
                >
                  {tag}
                  <button
                    type="button"
                    onClick={() => removeInterest(i)}
                    className="ml-0.5 text-muted-foreground hover:text-foreground"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={interestDraft}
                onChange={(e) => setInterestDraft(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addInterest(); } }}
                placeholder="Йога, авто, кофе..."
                className="flex-1 rounded-md border border-input bg-background px-3 py-1.5 text-sm outline-none focus:border-primary"
                maxLength={40}
              />
              <button
                type="button"
                onClick={addInterest}
                disabled={!interestDraft.trim()}
                className="rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                <Plus className="h-3.5 w-3.5" />
              </button>
            </div>
          </Section>

          {/* Languages */}
          <Section title="Языки общения">
            <div className="flex flex-wrap gap-1.5 mb-2">
              {languages.map((lang, i) => (
                <span key={lang} className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-xs">
                  {lang}
                  <button type="button" onClick={() => removeLanguage(i)} className="ml-0.5 text-muted-foreground hover:text-foreground">
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={languageDraft}
                onChange={(e) => setLanguageDraft(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addLanguage(); } }}
                placeholder="Українська, English, Русский..."
                className="flex-1 rounded-md border border-input bg-background px-3 py-1.5 text-sm outline-none focus:border-primary"
                maxLength={30}
              />
              <button
                type="button"
                onClick={addLanguage}
                disabled={!languageDraft.trim()}
                className="rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                <Plus className="h-3.5 w-3.5" />
              </button>
            </div>
          </Section>

          {/* Workplace — for solo masters without salon link */}
          <Section title="Где принимаю">
            <p className="text-[11px] text-muted-foreground mb-2">
              Если ты не привязан к салону — укажи название и фото своего кабинета или мастерской,
              чтобы клиенты понимали куда идти.
            </p>
            <input
              type="text"
              value={workplaceName}
              onChange={(e) => setWorkplaceName(e.target.value)}
              placeholder="Кабинет №3 / Студия на Печерске..."
              className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm outline-none focus:border-primary mb-2"
              maxLength={120}
            />
            <input
              ref={workplaceInput}
              type="file"
              accept="image/*"
              hidden
              onChange={async (e) => {
                const f = e.target.files?.[0];
                if (!f) return;
                setWorkplaceBusy(true);
                const url = await uploadWorkplace(f);
                setWorkplaceBusy(false);
                if (url) setWorkplacePhotoUrl(url);
              }}
            />
            {workplacePhotoUrl ? (
              <div className="relative">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={workplacePhotoUrl} alt="" className="h-32 w-full rounded-md object-cover" />
                <button
                  type="button"
                  onClick={() => setWorkplacePhotoUrl(null)}
                  className="absolute right-2 top-2 rounded-full bg-black/60 p-1 text-white"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => workplaceInput.current?.click()}
                disabled={workplaceBusy}
                className="w-full rounded-md border-2 border-dashed border-input px-3 py-4 text-xs text-muted-foreground hover:border-primary hover:text-primary"
              >
                {workplaceBusy ? 'Загрузка…' : 'Добавить фото кабинета'}
              </button>
            )}
          </Section>

          {/* Contact privacy */}
          <Section title="Контакты на странице">
            <PrivacyToggle label="Показывать телефон"   on={phonePublic} setOn={setPhonePublic} />
            <PrivacyToggle label="Показывать email"     on={emailPublic} setOn={setEmailPublic} />
            <PrivacyToggle label="Показывать ДР"        on={dobPublic}   setOn={setDobPublic} />
          </Section>

          {/* Social links */}
          <Section title="Соцсети и мессенджеры">
            <div className="space-y-2">
              {SOCIAL_KEYS.map((s) => (
                <div key={s.key} className="flex items-center gap-2">
                  <span className="w-20 text-xs text-muted-foreground">{s.label}</span>
                  <input
                    type="text"
                    value={social[s.key] ?? ''}
                    onChange={(e) => setSocial({ ...social, [s.key]: e.target.value })}
                    placeholder={s.placeholder}
                    className="flex-1 rounded-md border border-input bg-background px-3 py-1.5 text-sm outline-none focus:border-primary"
                  />
                </div>
              ))}
            </div>
          </Section>

          <button
            type="button"
            onClick={save}
            disabled={saving}
            className="sticky bottom-4 z-10 flex w-full items-center justify-center gap-1.5 rounded-lg bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50 shadow-lg"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {saving ? 'Сохраняю...' : 'Сохранить изменения'}
          </button>
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <h3 className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{title}</h3>
      {children}
    </section>
  );
}

function PrivacyToggle({ label, on, setOn }: { label: string; on: boolean; setOn: (v: boolean) => void }) {
  return (
    <label className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2 cursor-pointer hover:bg-muted/30">
      <span className="flex items-center gap-2 text-sm">
        {on ? <Eye className="h-3.5 w-3.5 text-primary" /> : <EyeOff className="h-3.5 w-3.5 text-muted-foreground" />}
        {label}
      </span>
      <input
        type="checkbox"
        checked={on}
        onChange={(e) => setOn(e.target.checked)}
        className="size-4 accent-primary"
      />
    </label>
  );
}
