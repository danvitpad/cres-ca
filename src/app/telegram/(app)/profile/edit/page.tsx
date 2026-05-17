/** --- YAML
 * name: MiniAppProfileEditPage
 * description: Редагувати профіль — визуал из mobile-client/profile-edit мокапа.
 *              Back + title + Save кнопка, аватар 104px с camera-badge,
 *              card-форма (Ім'я / Прізвище / Телефон / Email / Дата народження).
 * created: 2026-05-17
 * --- */

'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Camera, Loader2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useAuthStore } from '@/stores/auth-store';
import { useTelegram } from '@/components/miniapp/telegram-provider';
import { MobilePage } from '@/components/miniapp/shells';
import { useMiniAppLocale } from '@/lib/miniapp/use-locale';
import '@/styles/od-client-mini-app.css';

type Lang = 'uk' | 'ru' | 'en';

const T_LABELS: Record<Lang, {
  title: string; save: string; saving: string;
  changePhotoHint: string;
  firstName: string; lastName: string; phone: string;
  email: string; dob: string;
  emailReadonly: string;
  saved: string; saveError: string;
}> = {
  uk: {
    title: 'Редагувати профіль', save: 'Зберегти', saving: 'Збереження…',
    changePhotoHint: 'Натисніть фото, щоб змінити',
    firstName: "Ім'я", lastName: 'Прізвище', phone: 'Телефон',
    email: 'Email', dob: 'Дата народження',
    emailReadonly: 'Email прив\'язаний до акаунту, змінити не можна',
    saved: 'Збережено', saveError: 'Не вдалося зберегти',
  },
  ru: {
    title: 'Редактировать профиль', save: 'Сохранить', saving: 'Сохранение…',
    changePhotoHint: 'Нажмите фото, чтобы изменить',
    firstName: 'Имя', lastName: 'Фамилия', phone: 'Телефон',
    email: 'Email', dob: 'Дата рождения',
    emailReadonly: 'Email привязан к аккаунту, изменить нельзя',
    saved: 'Сохранено', saveError: 'Не удалось сохранить',
  },
  en: {
    title: 'Edit profile', save: 'Save', saving: 'Saving…',
    changePhotoHint: 'Tap photo to change',
    firstName: 'First name', lastName: 'Last name', phone: 'Phone',
    email: 'Email', dob: 'Date of birth',
    emailReadonly: 'Email is linked to your account, cannot be changed',
    saved: 'Saved', saveError: 'Failed to save',
  },
};

function initialsOf(name: string): string {
  return name.trim().split(/\s+/).slice(0, 2).map((p) => p.charAt(0).toUpperCase()).join('') || '?';
}

export default function MiniAppProfileEditPage() {
  const router = useRouter();
  const { haptic } = useTelegram();
  const { userId } = useAuthStore();
  const lang = useMiniAppLocale();
  const t = T_LABELS[lang];

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [avatarBusy, setAvatarBusy] = useState(false);

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [dob, setDob] = useState('');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

  const fileRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!userId) { setLoading(false); return; }
    let cancelled = false;
    (async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      const { data: prof } = await supabase
        .from('profiles')
        .select('full_name, first_name, last_name, phone, avatar_url, date_of_birth')
        .eq('id', userId)
        .maybeSingle();
      if (cancelled) return;
      if (prof) {
        const p = prof as { full_name: string | null; first_name: string | null; last_name: string | null; phone: string | null; avatar_url: string | null; date_of_birth: string | null };
        const fn = p.first_name ?? (p.full_name ?? '').split(' ')[0] ?? '';
        const ln = p.last_name ?? (p.full_name ?? '').split(' ').slice(1).join(' ') ?? '';
        setFirstName(fn);
        setLastName(ln);
        setPhone(p.phone ?? '');
        setDob(p.date_of_birth ?? '');
        setAvatarUrl(p.avatar_url);
      }
      setEmail(user?.email ?? '');
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [userId]);

  async function save() {
    if (!userId || saving) return;
    setSaving(true);
    haptic('selection');
    try {
      const supabase = createClient();
      const fullName = [firstName.trim(), lastName.trim()].filter(Boolean).join(' ');
      const { error } = await supabase
        .from('profiles')
        .update({
          full_name: fullName || null,
          first_name: firstName.trim() || null,
          last_name: lastName.trim() || null,
          phone: phone.trim() || null,
          date_of_birth: dob || null,
        })
        .eq('id', userId);
      if (error) {
        haptic('error');
        alert(t.saveError);
        return;
      }
      haptic('success');
      router.back();
    } finally {
      setSaving(false);
    }
  }

  async function uploadAvatar(file: File) {
    if (!userId || avatarBusy) return;
    if (file.size > 5 * 1024 * 1024) {
      alert(lang === 'uk' ? 'Файл занадто великий (макс 5 МБ)' : lang === 'ru' ? 'Файл слишком большой (макс 5 МБ)' : 'File too large (max 5 MB)');
      return;
    }
    setAvatarBusy(true);
    try {
      const supabase = createClient();
      const ext = file.name.split('.').pop() || 'jpg';
      const path = `${userId}/${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from('avatars').upload(path, file, { cacheControl: '3600', upsert: false });
      if (upErr) { alert(t.saveError); return; }
      const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(path);
      const newUrl = urlData.publicUrl;
      const { error: updErr } = await supabase.from('profiles').update({ avatar_url: newUrl }).eq('id', userId);
      if (updErr) { alert(t.saveError); return; }
      setAvatarUrl(newUrl);
      haptic('success');
    } finally {
      setAvatarBusy(false);
    }
  }

  const initials = initialsOf(`${firstName} ${lastName}`);

  if (loading) {
    return (
      <MobilePage className="od-client-mini-app">
        <div className="mc-loading"><Loader2 size={24} className="animate-spin" /></div>
      </MobilePage>
    );
  }

  return (
    <MobilePage className="od-client-mini-app">
      {/* Back + title + Save */}
      <div className="mpe-back">
        <button
          onClick={() => { haptic('light'); router.back(); }}
          className="mpe-back-a"
        >
          <ArrowLeft size={20} />
          <span className="mpe-back-t">{t.title}</span>
        </button>
        <button
          onClick={save}
          disabled={saving}
          className="mpe-save"
        >
          {saving ? t.saving : t.save}
        </button>
      </div>

      {/* Avatar + camera */}
      <div className="mpe-av-wrap">
        <div className="mpe-av">
          {avatarUrl
            ? <img src={avatarUrl} alt="" style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
            : initials}
          <button
            className="mpe-av-cam"
            onClick={() => fileRef.current?.click()}
            disabled={avatarBusy}
            aria-label="Camera"
          >
            {avatarBusy ? <Loader2 size={14} className="animate-spin" /> : <Camera size={14} />}
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            style={{ display: 'none' }}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) uploadAvatar(f);
            }}
          />
        </div>
        <div style={{ fontSize: 12, color: 'var(--fg-2)' }}>{t.changePhotoHint}</div>
      </div>

      {/* Form card */}
      <div className="mpe-card">
        <Field label={t.firstName} value={firstName} onChange={setFirstName} />
        <Field label={t.lastName} value={lastName} onChange={setLastName} />
        <Field label={t.phone} value={phone} onChange={setPhone} type="tel" />
        <Field label={t.email} value={email} onChange={() => {}} type="email" disabled />
        <Field label={t.dob} value={dob} onChange={setDob} type="date" />
      </div>

      <div style={{ height: 20 }} />
    </MobilePage>
  );
}

function Field({
  label, value, onChange, type = 'text', disabled,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: 'text' | 'tel' | 'email' | 'date';
  disabled?: boolean;
}) {
  return (
    <div className="mpe-fld">
      <label className="mpe-fl">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className="mpe-fi"
      />
    </div>
  );
}
