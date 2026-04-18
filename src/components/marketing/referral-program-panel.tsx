/** --- YAML
 * name: ReferralProgramPanel
 * description: Рекомендательная программа — toggle on/off, reward type/value, min_visits. Writes to masters.client_referral_*. Share link to /r/{handle}.
 * created: 2026-04-18
 * updated: 2026-04-18
 * --- */

'use client';

import { useEffect, useState } from 'react';
import { Gift, Copy, Check, Users } from 'lucide-react';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';
import { useMaster } from '@/hooks/use-master';
import { usePageTheme, FONT, CURRENCY } from '@/lib/dashboard-theme';

type RewardType = 'percent' | 'fixed' | 'service';

interface ReferralConfig {
  enabled: boolean;
  reward_type: RewardType;
  reward_value: number;
  min_visits: number;
}

export function ReferralProgramPanel() {
  const { C } = usePageTheme();
  const { master } = useMaster();

  const [cfg, setCfg] = useState<ReferralConfig>({
    enabled: false,
    reward_type: 'percent',
    reward_value: 10,
    min_visits: 1,
  });
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [copied, setCopied] = useState(false);
  const [referralCount, setReferralCount] = useState<number>(0);

  useEffect(() => {
    if (!master) return;
    const m = master as unknown as Record<string, unknown>;
    setCfg({
      enabled: Boolean(m.client_referral_enabled),
      reward_type: (m.client_referral_reward_type as RewardType) || 'percent',
      reward_value: Number(m.client_referral_reward_value ?? 10),
      min_visits: Number(m.client_referral_min_visits ?? 1),
    });
    setLoaded(true);

    // Load referral count
    const supabase = createClient();
    supabase
      .from('referrals')
      .select('id', { count: 'exact', head: true })
      .eq('master_id', (master as { id: string }).id)
      .then(({ count }) => setReferralCount(count ?? 0));
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

  const handle = (master as { handle?: string } | null)?.handle;
  const shareUrl = typeof window !== 'undefined' && handle
    ? `${window.location.origin}/r/${handle}`
    : '';

  async function copyLink() {
    if (!shareUrl) return;
    await navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    toast.success('Ссылка скопирована');
    setTimeout(() => setCopied(false), 2000);
  }

  if (!loaded) {
    return <div style={{ padding: 40, textAlign: 'center', color: C.textTertiary, fontSize: 13 }}>Загрузка...</div>;
  }

  const inputStyle = {
    padding: '8px 12px', borderRadius: 8,
    border: `1px solid ${C.border}`, background: 'transparent',
    color: C.text, fontSize: 13, fontFamily: FONT, outline: 'none',
  };

  const rewardUnit = cfg.reward_type === 'percent' ? '%' : cfg.reward_type === 'fixed' ? CURRENCY : '';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
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
            Клиенты получают бонус, когда приводят друзей. Новый клиент переходит по вашей ссылке — вы видите, кто привёл, и вознаграждаете после {cfg.min_visits}-го визита.
          </p>
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
        <div style={{ fontSize: 12, fontWeight: 600, color: C.textTertiary, marginBottom: 14, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
          Настройка вознаграждения
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14, marginBottom: 14 }}>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span style={{ fontSize: 12, color: C.textSecondary }}>Тип вознаграждения</span>
            <select
              value={cfg.reward_type}
              onChange={(e) => save({ reward_type: e.target.value as RewardType })}
              style={{ ...inputStyle, cursor: 'pointer' }}
            >
              <option value="percent">Скидка, %</option>
              <option value="fixed">Фиксированная, {CURRENCY}</option>
              <option value="service">Бесплатная услуга</option>
            </select>
          </label>

          {cfg.reward_type !== 'service' && (
            <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <span style={{ fontSize: 12, color: C.textSecondary }}>Размер, {rewardUnit}</span>
              <input
                type="number"
                value={cfg.reward_value}
                onChange={(e) => setCfg({ ...cfg, reward_value: Number(e.target.value) })}
                onBlur={() => save({ reward_value: cfg.reward_value })}
                style={inputStyle}
              />
            </label>
          )}

          <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span style={{ fontSize: 12, color: C.textSecondary }}>Минимум визитов</span>
            <input
              type="number"
              min={1}
              value={cfg.min_visits}
              onChange={(e) => setCfg({ ...cfg, min_visits: Number(e.target.value) })}
              onBlur={() => save({ min_visits: cfg.min_visits })}
              style={inputStyle}
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
            Ссылка для приглашений
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: C.textTertiary, fontSize: 12 }}>
            <Users size={12} />
            {referralCount} приглашений
          </div>
        </div>

        {!handle ? (
          <p style={{ fontSize: 13, color: C.textTertiary, margin: 0 }}>
            Задайте публичный handle в настройках, чтобы получить ссылку.
          </p>
        ) : (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <input
              value={shareUrl}
              readOnly
              onFocus={(e) => e.currentTarget.select()}
              style={{ ...inputStyle, flex: 1, minWidth: 200, fontFamily: 'ui-monospace, monospace' }}
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
        )}
      </div>
    </div>
  );
}
