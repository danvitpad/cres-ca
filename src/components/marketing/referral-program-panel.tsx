/** --- YAML
 * name: ReferralProgramPanel
 * description: Программа рекомендаций. Настраивается прямо здесь — без перехода
 *              в Settings. Сегментный селектор типа скидки в стиле сайта,
 *              компактные input'ы, шаблон реферальной ссылки `/m/{slug}?ref=<код клиента>`.
 *              Если slug ещё не задан — inline-кнопка генерирует его из имени без
 *              перехода в Settings.
 * created: 2026-04-18
 * updated: 2026-04-26
 * --- */

'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Gift, Copy, Check, Users, Link as LinkIcon, Languages } from 'lucide-react';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';
import { useMaster } from '@/hooks/use-master';
import { usePageTheme, FONT, CURRENCY } from '@/lib/dashboard-theme';

// Валидные значения определены check-constraint masters_client_referral_reward_type_check.
// UI должен слать ровно эти строки, иначе PATCH 400. bonus_points не выводим
// в UI — оно остаётся для Telegram-бота / голосовых команд.
type RewardType = 'discount_percent' | 'discount_amount' | 'free_service';

interface ReferralConfig {
  enabled: boolean;
  reward_type: RewardType;
  reward_value: number;
  min_visits: number;
}

const REWARD_TYPES: { v: RewardType; label: string }[] = [
  { v: 'discount_percent', label: 'Скидка %' },
  { v: 'discount_amount',  label: `Фикс ${CURRENCY}` },
  { v: 'free_service',     label: 'Бесплатная услуга' },
];

export function ReferralProgramPanel() {
  const { C } = usePageTheme();
  const { master } = useMaster();

  const [cfg, setCfg] = useState<ReferralConfig>({
    enabled: false,
    reward_type: 'discount_percent',
    reward_value: 10,
    min_visits: 1,
  });
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [copied, setCopied] = useState(false);
  const [referralCount, setReferralCount] = useState<number>(0);
  const [slug, setSlug] = useState<string | null>(null);
  const [creatingSlug, setCreatingSlug] = useState(false);
  const [sampleClientCode, setSampleClientCode] = useState<string | null>(null);

  useEffect(() => {
    if (!master) return;
    const m = master as unknown as Record<string, unknown>;
    // Existing rows might still hold legacy short codes — normalise to the canonical 3.
    const rawType = (m.client_referral_reward_type as string | undefined) || 'discount_percent';
    const normalizedType: RewardType =
      rawType === 'percent' ? 'discount_percent'
      : rawType === 'fixed' ? 'discount_amount'
      : rawType === 'service' ? 'free_service'
      : (rawType === 'discount_percent' || rawType === 'discount_amount' || rawType === 'free_service')
        ? rawType
        : 'discount_percent';
    setCfg({
      enabled: Boolean(m.client_referral_enabled),
      reward_type: normalizedType,
      reward_value: Number(m.client_referral_reward_value ?? 10),
      min_visits: Number(m.client_referral_min_visits ?? 1),
    });
    setSlug((m.slug as string | null) ?? null);
    setLoaded(true);

    // Load referral count + sample client referral_code so the master sees what
    // a real link looks like (replaces the «{код_клиента}» placeholder for preview).
    const supabase = createClient();
    supabase
      .from('referrals')
      .select('id', { count: 'exact', head: true })
      .eq('master_id', (master as { id: string }).id)
      .then(({ count }) => setReferralCount(count ?? 0));
    supabase
      .from('clients')
      .select('referral_code')
      .eq('master_id', (master as { id: string }).id)
      .not('referral_code', 'is', null)
      .limit(1)
      .maybeSingle()
      .then(({ data }) => {
        const r = data as { referral_code: string | null } | null;
        if (r?.referral_code) setSampleClientCode(r.referral_code);
      });
  }, [master]);

  async function save(next: Partial<ReferralConfig>) {
    if (!master) return;
    const merged = { ...cfg, ...next };
    setCfg(merged);
    setSaving(true);
    const supabase = createClient();
    const { error } = await supabase
      .from('masters')
      .update({
        client_referral_enabled: merged.enabled,
        client_referral_reward_type: merged.reward_type,
        client_referral_reward_value: merged.reward_value,
        client_referral_min_visits: merged.min_visits,
      })
      .eq('id', (master as { id: string }).id);
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success('Сохранено');
  }

  async function generateSlug() {
    if (!master) return;
    const m = master as unknown as Record<string, unknown>;
    const profile = (m.profile as { full_name?: string; first_name?: string } | undefined) ?? {};
    const base = (profile.full_name || profile.first_name || 'master').toString();
    // Простая транслитерация + dash
    const ru: Record<string, string> = {
      'а':'a','б':'b','в':'v','г':'g','д':'d','е':'e','ё':'e','ж':'zh','з':'z',
      'и':'i','й':'i','к':'k','л':'l','м':'m','н':'n','о':'o','п':'p','р':'r',
      'с':'s','т':'t','у':'u','ф':'f','х':'kh','ц':'ts','ч':'ch','ш':'sh','щ':'shch',
      'ъ':'','ы':'y','ь':'','э':'e','ю':'yu','я':'ya','і':'i','ї':'i','є':'e','ґ':'g',
    };
    const candidate = base.toLowerCase()
      .split('').map((ch) => ru[ch] ?? ch).join('')
      .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
      .slice(0, 60) || `master-${Date.now().toString(36)}`;

    setCreatingSlug(true);
    const supabase = createClient();
    const { error } = await supabase
      .from('masters')
      .update({ slug: candidate, is_public: true })
      .eq('id', (master as { id: string }).id);
    setCreatingSlug(false);
    if (error) { toast.error(error.message); return; }
    setSlug(candidate);
    toast.success('Публичный адрес создан');
  }

  // Превью ссылки. Если у мастера есть хотя бы 1 клиент с referral_code —
  // подставляем его реальный код, чтобы мастер видел осмысленный URL вместо
  // абстрактного «{код_клиента}». Это ссылка-пример для понимания формата —
  // каждый клиент в Mini App видит свою личную ссылку со своим кодом.
  const previewCode = sampleClientCode ?? 'a4f2c1b8e9d3';
  const shareUrl = typeof window !== 'undefined' && slug
    ? `${window.location.origin}/m/${slug}?ref=${previewCode}`
    : '';

  async function copyLink() {
    if (!shareUrl) return;
    await navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    toast.success('Шаблон ссылки скопирован');
    setTimeout(() => setCopied(false), 2000);
  }

  if (!loaded) {
    return <div style={{ padding: 40, textAlign: 'center', color: C.textTertiary, fontSize: 13 }}>Загрузка...</div>;
  }

  const inputStyle = {
    padding: '8px 10px', borderRadius: 8,
    border: `1px solid ${C.border}`, background: C.surface,
    color: C.text, fontSize: 14, fontFamily: FONT, outline: 'none',
    fontVariantNumeric: 'tabular-nums' as const,
  };

  const rewardUnit = cfg.reward_type === 'discount_percent' ? '%' : cfg.reward_type === 'discount_amount' ? CURRENCY : '';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Header with toggle */}
      <div style={{
        background: C.surface, border: `1px solid ${C.border}`,
        borderRadius: 12, padding: '18px 20px',
        display: 'flex', alignItems: 'flex-start', gap: 14,
      }}>
        <div style={{
          width: 40, height: 40, borderRadius: 10, flexShrink: 0,
          background: C.accentSoft,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Gift size={20} style={{ color: C.accent }} />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14, marginBottom: 4 }}>
            <h3 style={{ fontSize: 16, fontWeight: 600, color: C.text, margin: 0 }}>
              Программа рекомендаций
            </h3>
            <button
              onClick={() => save({ enabled: !cfg.enabled })}
              disabled={saving}
              style={{
                position: 'relative',
                width: 44, height: 24, borderRadius: 999,
                border: 'none', cursor: 'pointer',
                background: cfg.enabled ? C.accent : C.border,
                transition: 'background 0.2s',
                flexShrink: 0,
              }}
              aria-label="Включить программу"
            >
              <span style={{
                position: 'absolute',
                top: 2, left: cfg.enabled ? 22 : 2,
                width: 20, height: 20, borderRadius: '50%',
                background: '#fff',
                transition: 'left 0.2s',
                boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
              }} />
            </button>
          </div>
          <p style={{ fontSize: 13, color: C.textSecondary, lineHeight: 1.5, margin: 0 }}>
            Каждый клиент получает свою реферальную ссылку. Когда друг по ней
            записывается и приходит на {cfg.min_visits}-й визит — мастер автоматически
            начисляет бонус приведшему клиенту.
          </p>
          <Link
            href="/settings?section=profile"
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 4,
              fontSize: 11, color: C.textTertiary, textDecoration: 'none',
              marginTop: 8,
            }}
          >
            <Languages size={11} />
            Язык исходящих уведомлений настраивается в «Редактировать профиль»
          </Link>
        </div>
      </div>

      {/* Reward settings */}
      <div style={{
        background: C.surface, border: `1px solid ${C.border}`,
        borderRadius: 12, padding: '18px 20px',
        opacity: cfg.enabled ? 1 : 0.5,
        transition: 'opacity 0.2s',
        pointerEvents: cfg.enabled ? 'auto' : 'none',
      }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: C.textTertiary, marginBottom: 12, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
          Настройка вознаграждения
        </div>

        {/* Сегментный селектор типа — наш стиль, без native dropdown */}
        <div style={{ display: 'inline-flex', borderRadius: 999, padding: 4, gap: 2, background: C.surfaceElevated, border: `1px solid ${C.border}`, marginBottom: 14 }}>
          {REWARD_TYPES.map((opt) => {
            const active = cfg.reward_type === opt.v;
            return (
              <button
                key={opt.v}
                type="button"
                onClick={() => save({ reward_type: opt.v })}
                style={{
                  padding: '6px 12px', borderRadius: 999, border: 'none',
                  background: active ? C.accent : 'transparent',
                  color: active ? '#fff' : C.textSecondary,
                  fontSize: 12, fontWeight: 600, cursor: 'pointer',
                  fontFamily: FONT, transition: 'all 120ms ease',
                  whiteSpace: 'nowrap',
                }}
              >
                {opt.label}
              </button>
            );
          })}
        </div>

        {/* Узкие input'ы — раньше были широкими полями для маленьких чисел */}
        <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          {cfg.reward_type !== 'free_service' && (
            <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <span style={{ fontSize: 11, color: C.textSecondary }}>Размер</span>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <input
                  type="number"
                  value={cfg.reward_value}
                  onChange={(e) => setCfg({ ...cfg, reward_value: Number(e.target.value) })}
                  onBlur={() => save({ reward_value: cfg.reward_value })}
                  style={{ ...inputStyle, width: 88, textAlign: 'center' }}
                />
                <span style={{ fontSize: 13, color: C.textSecondary, fontWeight: 600 }}>{rewardUnit}</span>
              </div>
            </label>
          )}

          <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span style={{ fontSize: 11, color: C.textSecondary }}>Минимум визитов</span>
            <input
              type="number"
              min={1}
              value={cfg.min_visits}
              onChange={(e) => setCfg({ ...cfg, min_visits: Number(e.target.value) })}
              onBlur={() => save({ min_visits: cfg.min_visits })}
              style={{ ...inputStyle, width: 88, textAlign: 'center' }}
            />
          </label>
        </div>
      </div>

      {/* Share link */}
      <div style={{
        background: C.surface, border: `1px solid ${C.border}`,
        borderRadius: 12, padding: '18px 20px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: C.textTertiary, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
            Шаблон реферальной ссылки клиента
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: C.textTertiary, fontSize: 12 }}>
            <Users size={12} />
            {referralCount} приглашений
          </div>
        </div>

        {!slug ? (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 12,
            padding: 12, borderRadius: 10,
            background: C.accentSoft, border: `1px dashed ${C.accent}`,
          }}>
            <LinkIcon size={16} style={{ color: C.accent, flexShrink: 0 }} />
            <p style={{ fontSize: 13, color: C.text, lineHeight: 1.5, margin: 0, flex: 1 }}>
              Чтобы получить ссылку — задай публичный адрес мастера. Сгенерируем из твоего имени.
            </p>
            <button
              type="button"
              onClick={generateSlug}
              disabled={creatingSlug}
              style={{
                padding: '8px 14px', borderRadius: 8, border: 'none',
                background: C.accent, color: '#fff', fontSize: 13, fontWeight: 600,
                cursor: creatingSlug ? 'wait' : 'pointer', fontFamily: FONT,
                opacity: creatingSlug ? 0.6 : 1, whiteSpace: 'nowrap',
              }}
            >
              {creatingSlug ? '…' : 'Создать адрес'}
            </button>
          </div>
        ) : (
          <>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <input
                value={shareUrl}
                readOnly
                onFocus={(e) => e.currentTarget.select()}
                style={{ ...inputStyle, flex: 1, minWidth: 200, fontFamily: 'ui-monospace, monospace', fontSize: 12 }}
              />
              <button
                onClick={copyLink}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  padding: '8px 14px', borderRadius: 8, border: 'none',
                  background: copied ? C.success : C.accent, color: '#fff',
                  fontSize: 13, fontWeight: 600, fontFamily: FONT, cursor: 'pointer',
                }}
              >
                {copied ? <Check size={14} /> : <Copy size={14} />}
                {copied ? 'Скопировано' : 'Копировать'}
              </button>
            </div>
            <p style={{ fontSize: 12, color: C.textTertiary, lineHeight: 1.5, margin: '8px 0 0' }}>
              {sampleClientCode
                ? <>В URL подставлен реальный код одного из клиентов — каждому клиенту автоматически выдаётся свой уникальный код. Сам мастер эту ссылку никому не отправляет — её копирует <strong>клиент</strong> в своём Mini App в разделе «Бонусы» и шлёт другу.</>
                : <>Это пример формата. Реальный код у каждого клиента свой — генерируется автоматически при создании карточки. Клиент видит свою готовую ссылку в Mini App в разделе «Бонусы», копирует и отправляет другу.</>}
            </p>
          </>
        )}
      </div>
    </div>
  );
}
