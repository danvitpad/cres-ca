/** --- YAML
 * name: ClientProfilePage
 * description: Профіль клієнта — 2-col layout: ліва ідентифікація (аватар + ім'я + телефон
 *              + статистика + кнопки) + права з 4 вкладками (Дані / Сім'я / Документи /
 *              Налаштування). Візуал — web-client/profile мокап.
 * created: 2026-04-12
 * updated: 2026-05-17
 * --- */

'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTheme } from 'next-themes';
import { useLocale } from 'next-intl';
import { toast } from 'sonner';
import {
  Camera, Share2, LogOut, Check, User as UserIcon, Users, FileText, Settings,
  Globe, Palette, Mail, Shield, AlertTriangle, Plus, Trash2, Sun, Moon, Monitor,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useAuthStore } from '@/stores/auth-store';
import { useConfirm } from '@/hooks/use-confirm';
import { cn } from '@/lib/utils';
import { humanizeError } from '@/lib/format/error';

interface ProfileData {
  id: string;
  full_name: string | null;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  email: string | null;
  avatar_url: string | null;
  created_at: string | null;
  date_of_birth: string | null;
  gender: string | null;
}

interface FamilyMember {
  id: string;
  member_name: string;
  relationship: string;
}

type Pane = 'data' | 'family' | 'docs' | 'settings';

const RELATIONSHIPS = [
  { v: 'spouse', l: 'Чоловік / Дружина' },
  { v: 'child', l: 'Син / Донька' },
  { v: 'parent', l: 'Батько / Мама' },
  { v: 'other', l: 'Інше' },
];

export default function ProfilePage() {
  const router = useRouter();
  const { userId, clearAuth } = useAuthStore();
  const confirm = useConfirm();
  const { theme, setTheme } = useTheme();
  const locale = useLocale();

  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [stats, setStats] = useState({ visits: 0, masters: 0 });
  const [family, setFamily] = useState<FamilyMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [pane, setPane] = useState<Pane>('data');

  // Editable fields
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [dob, setDob] = useState('');
  const [gender, setGender] = useState('');
  const [allergies, setAllergies] = useState('');
  const [saving, setSaving] = useState(false);
  const [avatarBusy, setAvatarBusy] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Family form
  const [showAddFam, setShowAddFam] = useState(false);
  const [famName, setFamName] = useState('');
  const [famRel, setFamRel] = useState('child');

  // Settings (local-only for now — persistent storage отдельная задача)
  const [emailReminders, setEmailReminders] = useState(true);
  const [emailConfirms, setEmailConfirms] = useState(true);
  const [emailMarketing, setEmailMarketing] = useState(false);
  const [emailReviewAsk, setEmailReviewAsk] = useState(true);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    (async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      const { data: pData } = await supabase
        .from('profiles')
        .select('id, full_name, first_name, last_name, phone, avatar_url, created_at, date_of_birth')
        .eq('id', userId).maybeSingle();
      if (cancelled) return;
      if (pData) {
        const p = pData as Omit<ProfileData, 'email' | 'gender'>;
        const full = p.full_name ?? '';
        const fn = p.first_name ?? full.split(' ')[0] ?? '';
        const ln = p.last_name ?? full.split(' ').slice(1).join(' ') ?? '';
        setProfile({ ...p, email: user?.email ?? null, gender: null });
        setFirstName(fn);
        setLastName(ln);
        setPhone(p.phone ?? '');
        setEmail(user?.email ?? '');
        setDob(p.date_of_birth ?? '');
      }

      const { data: clientRows } = await supabase
        .from('clients').select('id').eq('profile_id', userId);
      const clientIds = (clientRows ?? []).map((c) => (c as { id: string }).id);
      let visits = 0;
      if (clientIds.length > 0) {
        const { count } = await supabase
          .from('appointments').select('id', { count: 'exact', head: true })
          .in('client_id', clientIds).eq('status', 'completed');
        visits = count ?? 0;
      }
      const { count: mastersCnt } = await supabase
        .from('client_master_links').select('master_id', { count: 'exact', head: true })
        .eq('profile_id', userId);
      setStats({ visits, masters: mastersCnt ?? 0 });

      const { data: famRows } = await supabase
        .from('family_links').select('id, member_name, relationship')
        .eq('parent_profile_id', userId).order('created_at');
      setFamily((famRows ?? []) as FamilyMember[]);

      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [userId]);

  async function saveData() {
    if (!userId || saving) return;
    setSaving(true);
    const supabase = createClient();
    const fullName = `${firstName.trim()} ${lastName.trim()}`.trim();
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
    setSaving(false);
    if (error) { toast.error(humanizeError(error)); return; }
    setProfile((p) => p ? { ...p, full_name: fullName, first_name: firstName, last_name: lastName, phone, date_of_birth: dob || null } : p);
    toast.success('Збережено');
  }

  async function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !userId) return;
    if (file.size > 5 * 1024 * 1024) { toast.error('Файл занадто великий (макс 5 МБ)'); return; }
    setAvatarBusy(true);
    const supabase = createClient();
    const ext = file.name.split('.').pop() || 'jpg';
    const path = `${userId}/${Date.now()}.${ext}`;
    const { error: upErr } = await supabase.storage.from('avatars').upload(path, file, { cacheControl: '3600', upsert: false });
    if (upErr) { toast.error(humanizeError(upErr)); setAvatarBusy(false); return; }
    const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(path);
    const newUrl = urlData.publicUrl;
    const { error: updErr } = await supabase.from('profiles').update({ avatar_url: newUrl }).eq('id', userId);
    setAvatarBusy(false);
    if (updErr) { toast.error(humanizeError(updErr)); return; }
    setProfile((p) => p ? { ...p, avatar_url: newUrl } : p);
    toast.success('Аватар оновлено');
  }

  async function addFamilyMember() {
    if (!famName.trim() || !userId) return;
    const supabase = createClient();
    const { data, error } = await supabase.from('family_links').insert({
      parent_profile_id: userId,
      member_name: famName.trim(),
      relationship: famRel,
    }).select().single();
    if (error) { toast.error(humanizeError(error)); return; }
    if (data) setFamily((prev) => [...prev, data as FamilyMember]);
    setFamName(''); setFamRel('child'); setShowAddFam(false);
    toast.success('Додано');
  }

  const removeFamilyMember = useCallback(async (member: FamilyMember) => {
    const ok = await confirm({ title: 'Видалити члена сім\'ї?', description: member.member_name, confirmLabel: 'Видалити', destructive: true });
    if (!ok) return;
    const supabase = createClient();
    const { error } = await supabase.from('family_links').delete().eq('id', member.id);
    if (error) { toast.error(humanizeError(error)); return; }
    setFamily((prev) => prev.filter((m) => m.id !== member.id));
    toast.success('Видалено');
  }, [confirm]);

  function changeLocale(next: 'uk' | 'ru' | 'en') {
    const path = window.location.pathname;
    const newPath = path.replace(/^\/(uk|ru|en)/, '') || '/';
    document.cookie = `NEXT_LOCALE=${next}; path=/; max-age=31536000`;
    router.push(`/${next}${newPath}`);
    router.refresh();
  }

  async function signOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    clearAuth();
    router.push('/');
  }

  async function shareProfile() {
    try {
      if (navigator.share) {
        await navigator.share({ title: 'CRES-CA', url: window.location.origin });
      } else {
        await navigator.clipboard.writeText(window.location.origin);
        toast.success('Посилання скопійовано');
      }
    } catch {}
  }

  const fullName = useMemo(() => `${firstName} ${lastName}`.trim() || 'Користувач', [firstName, lastName]);
  const initials = useMemo(() => `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase() || 'U', [firstName, lastName]);

  if (loading) {
    return (
      <div className="grid gap-6 lg:grid-cols-[300px_1fr]">
        <div className="h-[420px] animate-pulse rounded-3xl bg-muted" />
        <div className="space-y-4">
          <div className="h-12 w-80 animate-pulse rounded-full bg-muted" />
          <div className="h-80 animate-pulse rounded-3xl bg-muted" />
        </div>
      </div>
    );
  }

  return (
    <div className="grid gap-6 pb-12 lg:grid-cols-[300px_1fr]">
      {/* LEFT — identity */}
      <aside className="flex flex-col gap-4 rounded-3xl border border-border bg-card p-6">
        <div className="relative mx-auto">
          {profile?.avatar_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={profile.avatar_url} alt={fullName} className="size-28 rounded-full object-cover" />
          ) : (
            <div className="flex size-28 items-center justify-center rounded-full bg-[#2563eb]/12 text-[32px] font-extrabold text-[#2563eb]">
              {initials}
            </div>
          )}
          <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={avatarBusy}
            className="absolute -bottom-1 -right-1 flex size-9 items-center justify-center rounded-full bg-foreground text-background shadow-md transition-transform hover:scale-110 disabled:opacity-50"
            aria-label="Змінити аватар"
          >
            <Camera className="size-4" />
          </button>
        </div>
        <div className="text-center">
          <div className="text-[18px] font-bold">{fullName}</div>
          {phone && <div className="mt-0.5 text-[13px] text-muted-foreground">{phone}</div>}
        </div>
        <div className="grid grid-cols-2 gap-2 border-y border-border py-4">
          <SidebarStat n={stats.visits} label="Візити" />
          <SidebarStat n={stats.masters} label="Майстри" />
          {/* Бонуси — закомментировано (2026-05-17), повернемо при запуску лояльності.
          <SidebarStat n={stats.bonuses} label="Бонуси" /> */}
        </div>
        <button
          onClick={shareProfile}
          className="flex items-center justify-center gap-2 rounded-xl border border-border bg-card px-4 py-2.5 text-[13px] font-semibold text-foreground transition-colors hover:bg-muted"
        >
          <Share2 className="size-3.5" /> Поділитись профілем
        </button>
        <button
          onClick={signOut}
          className="flex items-center justify-center gap-2 rounded-xl border border-red-500/40 bg-red-500/5 px-4 py-2.5 text-[13px] font-semibold text-red-500 transition-colors hover:bg-red-500/10"
        >
          <LogOut className="size-3.5" /> Вийти з акаунту
        </button>
      </aside>

      {/* RIGHT — tabs (pill-style как в моке) */}
      <div>
        <div className="mb-5 flex flex-wrap gap-2">
          {([
            ['data', 'Дані', UserIcon],
            ['family', 'Сім\'я', Users],
            ['docs', 'Документи', FileText],
            ['settings', 'Налаштування', Settings],
          ] as const).map(([k, label, Icon]) => {
            const active = pane === k;
            return (
              <button
                key={k}
                onClick={() => setPane(k as Pane)}
                className={cn(
                  'inline-flex items-center gap-2 rounded-full border px-4 py-2 text-[13px] font-semibold transition-colors',
                  active
                    ? 'border-[#2563eb] bg-[#2563eb]/10 text-[#2563eb]'
                    : 'border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground',
                )}
              >
                <Icon className="size-4" /> {label}
              </button>
            );
          })}
        </div>

        {pane === 'data' && (
          <div className="rounded-3xl border border-border bg-card p-6">
            <SectionTitle icon={<UserIcon className="size-4" />}>Особисті дані</SectionTitle>
            <div className="grid gap-4 sm:grid-cols-2">
              <FieldText label="Ім'я" value={firstName} onChange={setFirstName} />
              <FieldText label="Прізвище" value={lastName} onChange={setLastName} />
              <FieldText label="Телефон" value={phone} onChange={setPhone} placeholder="+380..." />
              <FieldText label="Email" value={email} onChange={() => {}} disabled />
              <FieldText label="Дата народження" type="date" value={dob} onChange={setDob} />
              <FieldSelect label="Стать" value={gender} onChange={setGender} options={[
                { v: '', l: 'Не вказано' },
                { v: 'male', l: 'Чоловік' },
                { v: 'female', l: 'Жінка' },
              ]} />
              <div className="sm:col-span-2">
                <FieldText
                  label="Алергії, протипоказання (опціонально)"
                  value={allergies}
                  onChange={setAllergies}
                  placeholder="Наприклад: алергія на латекс"
                />
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <button
                onClick={saveData}
                disabled={saving}
                className="inline-flex items-center gap-1.5 rounded-full bg-[#2563eb] px-5 py-2.5 text-[13px] font-semibold text-white hover:bg-[#1d4ed8] disabled:opacity-50"
              >
                <Check className="size-3.5" /> {saving ? 'Зберігаю…' : 'Зберегти'}
              </button>
            </div>
          </div>
        )}

        {pane === 'family' && (
          <div className="rounded-3xl border border-border bg-card p-6">
            <SectionTitle icon={<Users className="size-4" />}>Члени сім'ї</SectionTitle>
            <p className="mb-5 text-[13px] leading-relaxed text-muted-foreground">
              Записуйтесь до майстрів від імені членів родини. Кожен має свою картку візитів та переваг.
            </p>
            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
              {family.map((m) => (
                <div key={m.id} className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3.5">
                  <div className="flex size-11 items-center justify-center rounded-full bg-[#2563eb]/12 text-[14px] font-bold text-[#2563eb]">
                    {m.member_name.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[14px] font-semibold">{m.member_name}</div>
                    <div className="text-[11px] text-muted-foreground">{relLabel(m.relationship)}</div>
                  </div>
                  <button
                    onClick={() => removeFamilyMember(m)}
                    className="flex size-8 items-center justify-center rounded-full text-muted-foreground hover:bg-red-500/10 hover:text-red-500"
                    aria-label="Видалити"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </div>
              ))}
              <button
                onClick={() => setShowAddFam(true)}
                className="flex flex-col items-center justify-center gap-1 rounded-2xl border-2 border-dashed border-border bg-card/50 p-4 text-[12px] font-semibold text-muted-foreground transition-colors hover:border-[#2563eb] hover:text-[#2563eb]"
              >
                <Plus className="size-4" />
                Додати члена
              </button>
            </div>

            {showAddFam && (
              <div className="mt-5 rounded-2xl border border-border bg-muted/30 p-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <FieldText label="Ім'я" value={famName} onChange={setFamName} placeholder="Артем" />
                  <FieldSelect
                    label="Хто це"
                    value={famRel}
                    onChange={setFamRel}
                    options={RELATIONSHIPS.map((r) => ({ v: r.v, l: r.l }))}
                  />
                </div>
                <div className="mt-3 flex justify-end gap-2">
                  <button
                    onClick={() => { setShowAddFam(false); setFamName(''); }}
                    className="rounded-full border border-border px-4 py-2 text-[12px] font-semibold text-muted-foreground hover:bg-muted"
                  >
                    Скасувати
                  </button>
                  <button
                    onClick={addFamilyMember}
                    disabled={!famName.trim()}
                    className="rounded-full bg-[#2563eb] px-4 py-2 text-[12px] font-semibold text-white hover:bg-[#1d4ed8] disabled:opacity-50"
                  >
                    Додати
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {pane === 'docs' && (
          <div className="rounded-3xl border border-border bg-card p-6">
            <SectionTitle icon={<FileText className="size-4" />}>Мої документи</SectionTitle>
            <p className="mb-5 text-[13px] leading-relaxed text-muted-foreground">
              Анкети, медичні довідки, фото &laquo;до/після&raquo; — все в одному місці. Майстер бачить тільки те, що ви дозволили.
            </p>
            <div className="rounded-2xl border-2 border-dashed border-border bg-card/50 p-10 text-center">
              <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-[#2563eb]/12 text-[#2563eb]">
                <FileText className="size-6" />
              </div>
              <p className="mt-4 text-[15px] font-semibold">Документи скоро</p>
              <p className="mt-1 text-[13px] text-muted-foreground">
                Працюємо над завантаженням файлів та керуванням доступом майстрів.
              </p>
            </div>
          </div>
        )}

        {pane === 'settings' && (
          <div className="space-y-5">
            <div className="rounded-3xl border border-border bg-card p-6">
              <SectionTitle icon={<Globe className="size-4" />}>Мова інтерфейсу</SectionTitle>
              <div className="grid grid-cols-3 gap-2">
                {([
                  ['uk', '🇺🇦', 'Українська'],
                  ['ru', '🇺🇦', 'Русский'],
                  ['en', '🇬🇧', 'English'],
                ] as const).map(([code, flag, label]) => {
                  const active = locale === code;
                  return (
                    <button
                      key={code}
                      onClick={() => changeLocale(code as 'uk' | 'ru' | 'en')}
                      className={cn(
                        'flex items-center justify-center gap-2 rounded-xl border px-3 py-3 text-[13px] font-semibold transition-colors',
                        active
                          ? 'border-[#2563eb] bg-[#2563eb]/10 text-[#2563eb]'
                          : 'border-border text-muted-foreground hover:bg-muted',
                      )}
                    >
                      <span className="text-[16px]">{flag}</span>{label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="rounded-3xl border border-border bg-card p-6">
              <SectionTitle icon={<Palette className="size-4" />}>Тема оформлення</SectionTitle>
              <div className="grid grid-cols-3 gap-2">
                {([
                  ['light', Sun, 'Світла'],
                  ['dark', Moon, 'Темна'],
                  ['system', Monitor, 'Як у системі'],
                ] as const).map(([k, Icon, label]) => {
                  const active = theme === k;
                  return (
                    <button
                      key={k}
                      onClick={() => setTheme(k)}
                      className={cn(
                        'flex flex-col items-center gap-1.5 rounded-xl border px-3 py-3 text-[13px] font-semibold transition-colors',
                        active
                          ? 'border-[#2563eb] bg-[#2563eb]/10 text-[#2563eb]'
                          : 'border-border text-muted-foreground hover:bg-muted',
                      )}
                    >
                      <Icon className="size-5" />
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="rounded-3xl border border-border bg-card p-6">
              <SectionTitle icon={<Mail className="size-4" />}>Email-сповіщення</SectionTitle>
              <div className="divide-y divide-border">
                <Toggle
                  title="Нагадування про візит"
                  sub="За 24 години до запису"
                  checked={emailReminders}
                  onChange={setEmailReminders}
                />
                <Toggle
                  title="Підтвердження запису"
                  sub="Одразу після створення"
                  checked={emailConfirms}
                  onChange={setEmailConfirms}
                />
                <Toggle
                  title="Акції та новини"
                  sub="Раз на тиждень, не частіше"
                  checked={emailMarketing}
                  onChange={setEmailMarketing}
                />
                <Toggle
                  title="Запит відгуку після візиту"
                  sub="Через 2 години після закінчення"
                  checked={emailReviewAsk}
                  onChange={setEmailReviewAsk}
                />
              </div>
            </div>

            <div className="rounded-3xl border border-red-500/30 bg-card p-6">
              <SectionTitle icon={<AlertTriangle className="size-4 text-red-500" />}>
                <span className="text-red-500">Небезпечна зона</span>
              </SectionTitle>
              <button
                onClick={async () => {
                  const ok = await confirm({
                    title: 'Видалити акаунт?',
                    description: 'Цю дію не можна скасувати. Всі ваші дані будуть видалені.',
                    confirmLabel: 'Видалити',
                    destructive: true,
                  });
                  if (!ok) return;
                  toast.error('Зв\'яжіться з підтримкою для видалення акаунту.');
                }}
                className="inline-flex items-center gap-1.5 rounded-full border border-red-500/40 bg-red-500/5 px-4 py-2.5 text-[13px] font-semibold text-red-500 hover:bg-red-500/10"
              >
                <Trash2 className="size-3.5" /> Видалити акаунт
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function SectionTitle({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="mb-4 flex items-center gap-2 text-[15px] font-bold text-foreground">
      <span className="text-[#2563eb]">{icon}</span>
      {children}
    </div>
  );
}

function SidebarStat({ n, label }: { n: number; label: string }) {
  return (
    <div className="text-center">
      <div className="text-[20px] font-extrabold tabular-nums text-[#2563eb]">{n}</div>
      <div className="mt-0.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground/80">{label}</div>
    </div>
  );
}

function FieldText({
  label, value, onChange, placeholder, type = 'text', disabled,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: 'text' | 'date';
  disabled?: boolean;
}) {
  return (
    <label className="block">
      <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</div>
      <input
        type={type}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={cn(
          'w-full rounded-xl border border-border bg-card px-3.5 py-2.5 text-[14px] outline-none transition-colors',
          'focus:border-[#2563eb] focus:ring-2 focus:ring-[#2563eb]/20',
          disabled && 'bg-muted/40 cursor-not-allowed',
        )}
      />
    </label>
  );
}

function FieldSelect({
  label, value, onChange, options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: Array<{ v: string; l: string }>;
}) {
  return (
    <label className="block">
      <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</div>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-xl border border-border bg-card px-3.5 py-2.5 text-[14px] outline-none transition-colors focus:border-[#2563eb] focus:ring-2 focus:ring-[#2563eb]/20"
      >
        {options.map((o) => <option key={o.v} value={o.v}>{o.l}</option>)}
      </select>
    </label>
  );
}

function Toggle({
  title, sub, checked, onChange,
}: {
  title: string;
  sub: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-3">
      <div className="min-w-0 flex-1">
        <div className="text-[14px] font-semibold">{title}</div>
        <div className="text-[12px] text-muted-foreground">{sub}</div>
      </div>
      <button
        onClick={() => onChange(!checked)}
        className={cn(
          'relative h-6 w-11 shrink-0 rounded-full transition-colors',
          checked ? 'bg-[#2563eb]' : 'bg-muted',
        )}
      >
        <span
          className={cn(
            'absolute top-0.5 size-5 rounded-full bg-white shadow-sm transition-transform',
            checked ? 'translate-x-[22px]' : 'translate-x-0.5',
          )}
        />
      </button>
    </div>
  );
}

function relLabel(r: string): string {
  const map: Record<string, string> = {
    spouse: 'Чоловік / Дружина', child: 'Син / Донька', parent: 'Батько / Мама', other: 'Інше',
  };
  return map[r] ?? r;
}
