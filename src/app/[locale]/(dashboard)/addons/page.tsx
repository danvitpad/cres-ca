/** --- YAML
 * name: AddonsPage
 * description: Fresha-exact add-ons marketplace — grid of feature cards with descriptions and action buttons
 * --- */

'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { useTheme } from 'next-themes';
import { motion } from 'framer-motion';
import { CreditCard, Headphones, BarChart3, Star, Heart, MessageSquare, Zap, Globe, Shield, Smartphone } from 'lucide-react';

const FONT = '"Roobert PRO", AktivGroteskVF, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';

const LIGHT = {
  pageBg: '#ffffff',
  cardBg: '#ffffff',
  cardBorder: '0.8px solid #e0e0e0',
  text: '#0d0d0d',
  textSecondary: '#737373',
  textMuted: '#a3a3a3',
  accent: '#6950f3',
  accentSoft: '#f0edff',
  btnBg: '#f5f5f5',
  btnHover: '#ebebeb',
};
const DARK = {
  pageBg: '#000000',
  cardBg: '#000000',
  cardBorder: '0.8px solid #1a1a1a',
  text: '#f5f5f5',
  textSecondary: '#bfbfbf',
  textMuted: '#666666',
  accent: '#8880ff',
  accentSoft: '#1a1840',
  btnBg: '#000000',
  btnHover: '#0a0a0a',
};

interface Addon {
  id: string;
  titleKey: string;
  descKey: string;
  icon: typeof CreditCard;
  color: string;
}

const ADDONS: Addon[] = [
  { id: 'payments', titleKey: 'payments', descKey: 'paymentsDesc', icon: CreditCard, color: '#10b981' },
  { id: 'premium-support', titleKey: 'premiumSupport', descKey: 'premiumSupportDesc', icon: Headphones, color: '#6950f3' },
  { id: 'insights', titleKey: 'insights', descKey: 'insightsDesc', icon: BarChart3, color: '#f59e0b' },
  { id: 'google-boost', titleKey: 'googleBoost', descKey: 'googleBoostDesc', icon: Star, color: '#ef4444' },
  { id: 'loyalty', titleKey: 'loyalty', descKey: 'loyaltyDesc', icon: Heart, color: '#ec4899' },
  { id: 'sms-campaigns', titleKey: 'smsCampaigns', descKey: 'smsCampaignsDesc', icon: MessageSquare, color: '#3b82f6' },
  { id: 'automation', titleKey: 'automationAddon', descKey: 'automationAddonDesc', icon: Zap, color: '#8b5cf6' },
  { id: 'online-booking', titleKey: 'onlineBooking', descKey: 'onlineBookingDesc', icon: Globe, color: '#06b6d4' },
  { id: 'security', titleKey: 'security', descKey: 'securityDesc', icon: Shield, color: '#64748b' },
  { id: 'mobile-app', titleKey: 'mobileApp', descKey: 'mobileAppDesc', icon: Smartphone, color: '#0ea5e9' },
];

export default function AddonsPage() {
  const t = useTranslations('addons');
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const C = mounted && resolvedTheme === 'dark' ? DARK : LIGHT;

  return (
    <div style={{ maxWidth: 960, margin: '0 auto', padding: '32px 40px', fontFamily: FONT }}>
      {/* Header */}
      <div style={{ textAlign: 'center', marginBottom: 40 }}>
        <h1 style={{ fontSize: 24, fontWeight: 600, color: C.text, lineHeight: '32px', margin: '0 0 8px' }}>
          {t('title')}
        </h1>
        <p style={{ fontSize: 15, color: C.textSecondary, lineHeight: '22px', maxWidth: 500, margin: '0 auto' }}>
          {t('subtitle')}
        </p>
      </div>

      {/* Category label */}
      <div style={{ fontSize: 13, fontWeight: 600, color: C.textMuted, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 16 }}>
        {t('addonsLabel')}
      </div>

      {/* Add-ons grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
        {ADDONS.map((addon, i) => {
          const Icon = addon.icon;
          return (
            <motion.div
              key={addon.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04 }}
              style={{
                backgroundColor: C.cardBg,
                border: C.cardBorder,
                borderRadius: 8,
                padding: 24,
                display: 'flex',
                flexDirection: 'column',
                gap: 16,
                transition: 'background-color 0.15s',
              }}
              onMouseEnter={e => (e.currentTarget.style.backgroundColor = mounted && resolvedTheme === 'dark' ? '#1e1e1e' : '#fafafa')}
              onMouseLeave={e => (e.currentTarget.style.backgroundColor = C.cardBg)}
            >
              <div style={{
                width: 44, height: 44, borderRadius: 10,
                backgroundColor: addon.color + '18',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <Icon size={22} style={{ color: addon.color }} />
              </div>

              <div>
                <div style={{ fontSize: 17, fontWeight: 600, color: C.text, lineHeight: '24px', marginBottom: 6 }}>
                  {t(addon.titleKey)}
                </div>
                <div style={{ fontSize: 14, color: C.textSecondary, lineHeight: '20px' }}>
                  {t(addon.descKey)}
                </div>
              </div>

              <button
                style={{
                  marginTop: 'auto',
                  padding: '8px 20px',
                  fontSize: 14,
                  fontWeight: 500,
                  color: C.text,
                  backgroundColor: C.btnBg,
                  border: 'none',
                  borderRadius: 6,
                  cursor: 'pointer',
                  fontFamily: FONT,
                  transition: 'background-color 0.15s',
                  alignSelf: 'flex-start',
                }}
                onMouseEnter={e => (e.currentTarget.style.backgroundColor = C.btnHover)}
                onMouseLeave={e => (e.currentTarget.style.backgroundColor = C.btnBg)}
              >
                {t('viewDetails')}
              </button>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
