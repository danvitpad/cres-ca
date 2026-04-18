/** --- YAML
 * name: ProductsCataloguePage
 * description: Fresha-exact products catalog — retail products for sale
 * --- */

'use client';

import { useTranslations } from 'next-intl';
import { motion } from 'framer-motion';
import { Plus, ShoppingBag } from 'lucide-react';
import { usePageTheme, FONT, FONT_FEATURES } from '@/lib/dashboard-theme';

export default function ProductsCataloguePage() {
  const t = useTranslations('catalogue');
  const { C, isDark, mounted } = usePageTheme();

  return (
    <div style={{ fontFamily: FONT, fontFeatureSettings: FONT_FEATURES, padding: '32px 40px', background: C.bg }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <h1 style={{ fontSize: 28, fontWeight: 600, color: C.text, margin: 0 }}>
          {t('products')}
        </h1>
        <button
          type="button"
          style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '10px 20px', fontSize: 14, fontWeight: 500,
            backgroundColor: C.accent, color: '#ffffff',
            border: 'none', borderRadius: 999, cursor: 'pointer',
            fontFamily: FONT,
          }}
        >
          <Plus size={16} />
          {t('addProduct')}
        </button>
      </div>
      <p style={{ fontSize: 15, color: C.textSecondary, margin: '0 0 32px', lineHeight: '22px' }}>
        {t('productsDesc')}
      </p>

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        style={{
          backgroundColor: C.surface,
          border: `1px dashed ${C.border}`,
          borderRadius: 12,
          padding: '64px 32px',
          textAlign: 'center',
        }}
      >
        <div style={{
          width: 64, height: 64, borderRadius: 999,
          backgroundColor: C.accent + '15',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          margin: '0 auto 20px',
        }}>
          <ShoppingBag size={28} color={C.accent} />
        </div>
        <div style={{ fontSize: 18, fontWeight: 600, color: C.text, marginBottom: 8 }}>
          {t('noProducts')}
        </div>
        <div style={{ fontSize: 15, color: C.textSecondary, maxWidth: 400, margin: '0 auto', lineHeight: '22px' }}>
          {t('noProductsDesc')}
        </div>
      </motion.div>
    </div>
  );
}
