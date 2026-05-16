/** --- YAML
 * name: OnboardingWizard
 * description: 4-крокова мобільна форма онбордингу — профіль → спеціальність → послуги → успіх. Зберігає дані в profiles + masters + services.
 * created: 2026-05-16
 * updated: 2026-05-16
 * --- */

'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { toast } from 'sonner';
import {
  ArrowRight,
  User,
  Scissors,
  ListChecks,
  Check,
  LayoutDashboard,
  Link,
  Sparkle,
  Dumbbell,
  Stethoscope,
  BookOpen,
  PawPrint,
  Wrench,
  PenTool,
  Plus,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { DEFAULT_SERVICES, type VerticalKey } from '@/lib/verticals/default-services';

const ACCENT = '#2563eb';

const NICHES: { key: VerticalKey; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { key: 'beauty',    label: 'Перукар',    icon: Scissors },
  { key: 'health',    label: 'Краса',      icon: Sparkle },
  { key: 'fitness',   label: 'Фітнес',     icon: Dumbbell },
  { key: 'health',    label: 'Лікар',      icon: Stethoscope },
  { key: 'education', label: 'Репетитор',  icon: BookOpen },
  { key: 'pets',      label: 'Ветеринар',  icon: PawPrint },
  { key: 'craft',     label: 'Ремонт',     icon: Wrench },
  { key: 'tattoo',    label: 'Татуювання', icon: PenTool },
  { key: 'other',     label: 'Інше',       icon: Plus },
];

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '12px 14px',
  borderRadius: 12,
  border: '1.5px solid #e2e8f0',
  background: '#f8fafc',
  color: '#0f172a',
  fontSize: 15,
  outline: 'none',
  boxSizing: 'border-box',
  fontFamily: 'inherit',
};

const btnPrimary: React.CSSProperties = {
  width: '100%',
  padding: '14px 0',
  borderRadius: 14,
  border: 'none',
  background: ACCENT,
  color: '#fff',
  fontSize: 15,
  fontWeight: 600,
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 8,
};

const btnGhost: React.CSSProperties = {
  width: '100%',
  padding: '12px 0',
  borderRadius: 14,
  border: '1px solid #e2e8f0',
  background: 'transparent',
  color: '#64748b',
  fontSize: 15,
  fontWeight: 500,
  cursor: 'pointer',
};

export default function OnboardingPage() {
  const supabase = createClient();
  const router = useRouter();
  const params = useParams();
  const locale = (params?.locale as string) ?? 'uk';

  const [step, setStep] = useState(1);
  const [name, setName] = useState('');
  const [city, setCity] = useState('');
  const [phone, setPhone] = useState('');
  const [niche, setNiche] = useState<VerticalKey | null>(null);
  const [selectedServices, setSelectedServices] = useState<Set<number>>(new Set([0, 1, 2]));
  const [saving, setSaving] = useState(false);
  const [masterId, setMasterId] = useState<string | null>(null);
  const [slug, setSlug] = useState('');

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.replace(`/${locale}/login`); return; }
      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name, phone, city')
        .eq('id', user.id)
        .maybeSingle();
      if (profile?.full_name) setName(profile.full_name);
      if (profile?.phone) setPhone(profile.phone);
      if ((profile as Record<string, unknown> | null)?.city) setCity((profile as Record<string, unknown>).city as string);
      const { data: master } = await supabase
        .from('masters')
        .select('id, handle')
        .eq('profile_id', user.id)
        .maybeSingle();
      if (master) { setMasterId(master.id); setSlug(master.handle ?? ''); }
    })();
  }, []);

  function toggleService(idx: number) {
    setSelectedServices((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx); else next.add(idx);
      return next;
    });
  }

  async function finish() {
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      await supabase.from('profiles').update({ full_name: name.trim(), phone: phone.trim(), city: city.trim() }).eq('id', user.id);

      if (masterId && niche) {
        await supabase.from('masters').update({ specialization: niche }).eq('id', masterId);
        const nicheKey = niche as VerticalKey;
        const templates = DEFAULT_SERVICES[nicheKey] ?? [];
        const toInsert = [...selectedServices].map((idx) => templates[idx]).filter(Boolean).map((s) => ({
          master_id: masterId,
          name: s.name,
          duration_minutes: s.duration_minutes,
          price: s.price,
          is_active: true,
        }));
        if (toInsert.length > 0) {
          await supabase.from('services').insert(toInsert);
        }
      }
      setStep(4);
    } catch {
      toast.error('Щось пішло не так. Спробуй ще раз.');
    } finally {
      setSaving(false);
    }
  }

  const TOTAL = 4;
  const services = niche ? (DEFAULT_SERVICES[niche] ?? []) : [];

  return (
    <div style={{ minHeight: '100dvh', background: '#f8fafc', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-start', padding: '0 0 40px' }}>
      <div style={{ width: '100%', maxWidth: 440, padding: '0 20px' }}>

        {/* Progress */}
        {step < 4 && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '28px 0 24px' }}>
            <div style={{ display: 'flex', gap: 8 }}>
              {Array.from({ length: TOTAL - 1 }).map((_, i) => (
                <div key={i} style={{ width: 28, height: 6, borderRadius: 3, background: i < step - 1 ? ACCENT : i === step - 1 ? ACCENT : '#e2e8f0', opacity: i < step - 1 ? 0.4 : 1, transition: 'background 300ms' }} />
              ))}
            </div>
            <div style={{ fontSize: 12, color: '#64748b', fontWeight: 500 }}>Крок {step} з {TOTAL - 1}</div>
          </div>
        )}

        {/* Step 1 — Profile */}
        {step === 1 && (
          <div>
            <div style={{ width: 56, height: 56, borderRadius: 16, background: `${ACCENT}15`, color: ACCENT, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 20 }}>
              <User style={{ width: 24, height: 24 }} />
            </div>
            <div style={{ fontSize: 24, fontWeight: 700, color: '#0f172a', marginBottom: 6 }}>Розкажи про себе</div>
            <div style={{ fontSize: 14, color: '#64748b', marginBottom: 28 }}>Це допоможе налаштувати кабінет під тебе</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 6 }}>Твоє ім'я</div>
                <input style={inputStyle} type="text" placeholder="Ім'я та прізвище" value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 6 }}>Місто</div>
                <input style={inputStyle} type="text" placeholder="Наприклад: Kyiv" value={city} onChange={(e) => setCity(e.target.value)} />
              </div>
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 6 }}>Телефон</div>
                <input style={inputStyle} type="tel" placeholder="+38 (067) 000-00-00" value={phone} onChange={(e) => setPhone(e.target.value)} />
              </div>
            </div>
            <div style={{ marginTop: 32 }}>
              <button type="button" style={btnPrimary} onClick={() => setStep(2)} disabled={!name.trim()}>
                Далі <ArrowRight style={{ width: 16, height: 16 }} />
              </button>
            </div>
          </div>
        )}

        {/* Step 2 — Niche */}
        {step === 2 && (
          <div>
            <div style={{ width: 56, height: 56, borderRadius: 16, background: '#fef3c715', color: '#f59e0b', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 20 }}>
              <Scissors style={{ width: 24, height: 24 }} />
            </div>
            <div style={{ fontSize: 24, fontWeight: 700, color: '#0f172a', marginBottom: 6 }}>Яка твоя спеціальність?</div>
            <div style={{ fontSize: 14, color: '#64748b', marginBottom: 24 }}>Оберіть — CRES налаштує шаблони</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 32 }}>
              {NICHES.map((n) => {
                const Icon = n.icon;
                return (
                  <button
                    key={n.label}
                    type="button"
                    onClick={() => setNiche(n.key)}
                    style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, padding: '14px 8px', borderRadius: 14, border: `2px solid ${niche === n.key ? ACCENT : '#e2e8f0'}`, background: niche === n.key ? `${ACCENT}08` : '#fff', cursor: 'pointer', transition: 'all 150ms', color: niche === n.key ? ACCENT : '#94a3b8' }}
                  >
                    <Icon className="size-[20px]" />
                    <span style={{ fontSize: 11, fontWeight: 600, color: niche === n.key ? ACCENT : '#475569', textAlign: 'center', lineHeight: 1.2 }}>{n.label}</span>
                  </button>
                );
              })}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <button type="button" style={btnPrimary} onClick={() => setStep(3)} disabled={!niche}>
                Далі <ArrowRight style={{ width: 16, height: 16 }} />
              </button>
              <button type="button" style={btnGhost} onClick={() => setStep(1)}>Назад</button>
            </div>
          </div>
        )}

        {/* Step 3 — Services */}
        {step === 3 && (
          <div>
            <div style={{ width: 56, height: 56, borderRadius: 16, background: '#f0fdf415', color: '#10b981', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 20 }}>
              <ListChecks style={{ width: 24, height: 24 }} />
            </div>
            <div style={{ fontSize: 24, fontWeight: 700, color: '#0f172a', marginBottom: 6 }}>Оберіть послуги</div>
            <div style={{ fontSize: 14, color: '#64748b', marginBottom: 24 }}>Можна додати або змінити пізніше</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 32 }}>
              {services.map((svc, idx) => {
                const checked = selectedServices.has(idx);
                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => toggleService(idx)}
                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', borderRadius: 14, border: `2px solid ${checked ? ACCENT : '#e2e8f0'}`, background: checked ? `${ACCENT}06` : '#fff', cursor: 'pointer', textAlign: 'left' }}
                  >
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 600, color: '#0f172a' }}>{svc.name}</div>
                      <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>₴{svc.price} · {svc.duration_minutes} хв</div>
                    </div>
                    <div style={{ width: 22, height: 22, borderRadius: 6, background: checked ? ACCENT : '#f1f5f9', border: checked ? 'none' : '1.5px solid #cbd5e1', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      {checked && <Check style={{ width: 12, height: 12, color: '#fff' }} />}
                    </div>
                  </button>
                );
              })}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <button type="button" style={{ ...btnPrimary, opacity: saving ? 0.7 : 1 }} onClick={finish} disabled={saving}>
                {saving ? 'Зберігаємо…' : <><ArrowRight style={{ width: 16, height: 16 }} />Завершити</>}
              </button>
              <button type="button" style={btnGhost} onClick={() => setStep(2)}>Назад</button>
            </div>
          </div>
        )}

        {/* Step 4 — Success */}
        {step === 4 && (
          <div style={{ paddingTop: 48, textAlign: 'center' }}>
            <div style={{ width: 80, height: 80, borderRadius: '50%', background: '#f0fdf4', border: '3px solid #10b981', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px' }}>
              <Check style={{ width: 36, height: 36, color: '#10b981' }} />
            </div>
            <div style={{ fontSize: 28, fontWeight: 800, color: '#0f172a', marginBottom: 10 }}>Все готово!</div>
            <div style={{ fontSize: 15, color: '#64748b', marginBottom: 32, lineHeight: 1.5 }}>
              Твій кабінет налаштовано. Перший клієнт може записатись вже сьогодні.
            </div>
            <div style={{ background: '#fff', borderRadius: 16, padding: '16px 20px', border: '1px solid #f1f5f9', textAlign: 'left', marginBottom: 32 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 12 }}>Ваш кабінет</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <User style={{ width: 13, height: 13, color: ACCENT }} />
                  <span style={{ fontSize: 14, fontWeight: 600 }}>{name}</span>
                </div>
                {(niche || city) && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <Scissors style={{ width: 13, height: 13, color: ACCENT }} />
                    <span style={{ fontSize: 13, color: '#475569' }}>
                      {niche ? NICHES.find((n) => n.key === niche)?.label : ''}{city ? ` · ${city}` : ''}
                    </span>
                  </div>
                )}
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <ListChecks style={{ width: 13, height: 13, color: ACCENT }} />
                  <span style={{ fontSize: 13, color: '#475569' }}>{selectedServices.size} послуги додано</span>
                </div>
                {slug && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <Link style={{ width: 13, height: 13, color: '#10b981' }} />
                    <span style={{ fontSize: 13, color: '#10b981' }}>cres-ca.com/m/{slug}</span>
                  </div>
                )}
              </div>
            </div>
            <button
              type="button"
              style={btnPrimary}
              onClick={() => router.push(`/${locale}`)}
            >
              <LayoutDashboard style={{ width: 16, height: 16 }} />
              Відкрити кабінет
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
