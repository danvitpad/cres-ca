/** --- YAML
 * name: SmartPricingPage
 * description: Fresha-exact smart pricing — dynamic pricing based on demand
 * --- */

'use client';

import { useTranslations } from 'next-intl';
import { motion } from 'framer-motion';
import { TrendingUp } from 'lucide-react';
import { usePageTheme, FONT, FONT_FEATURES, CURRENCY } from '@/lib/dashboard-theme';

export default function SmartPricingPage() {
  const t = useTranslations('marketing');
  const { C, isDark, mounted } = usePageTheme();

  return (
    <div style={{ fontFamily: FONT, fontFeatureSettings: FONT_FEATURES, background: C.bg, padding: '32px 40px' }}>
      <h1 style={{ fontSize: 28, fontWeight: 600, color: C.text, margin: '0 0 8px' }}>{t('smartPricing')}</h1>
      <p style={{ fontSize: 15, color: C.textSecondary, margin: '0 0 32px', lineHeight: '22px' }}>{t('smartPricingDesc')}</p>
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} style={{ backgroundColor: C.surface, border: `1px dashed ${C.border}`, borderRadius: 12, padding: '64px 32px', textAlign: 'center' }}>
        <div style={{ width: 64, height: 64, borderRadius: 999, backgroundColor: C.accent + '15', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
          <TrendingUp size={28} color={C.accent} />
        </div>
        <div style={{ fontSize: 18, fontWeight: 600, color: C.text, marginBottom: 8 }}>{t('noPricing')}</div>
        <div style={{ fontSize: 15, color: C.textSecondary, maxWidth: 400, margin: '0 auto', lineHeight: '22px' }}>{t('noPricingDesc')}</div>
      </motion.div>
    </div>
  );
}
