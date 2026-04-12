/** --- YAML
 * name: ClientSegmentsPage
 * description: Fresha-exact client segments — create and manage client groups for targeted marketing
 * --- */

'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { useTheme } from 'next-themes';
import { motion } from 'framer-motion';
import { Plus, Users, Filter } from 'lucide-react';

const FONT = '"Roobert PRO", AktivGroteskVF, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';

const LIGHT = {
  bg: '#ffffff', text: '#0d0d0d', textMuted: '#737373',
  cardBg: '#ffffff', cardBorder: '#e5e5e5', accent: '#6950f3',
  emptyBg: '#f9fafb', emptyBorder: '#e5e5e5',
};
const DARK = {
  bg: '#000000', text: '#f5f5f5', textMuted: '#999999',
  cardBg: '#000000', cardBorder: '#1a1a1a', accent: '#8b7cf6',
  emptyBg: '#000000', emptyBorder: '#1a1a1a',
};

export default function ClientSegmentsPage() {
  const t = useTranslations('clients');
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const C = mounted && resolvedTheme === 'dark' ? DARK : LIGHT;

  return (
    <div style={{ fontFamily: FONT, padding: '32px 40px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <h1 style={{ fontSize: 28, fontWeight: 600, color: C.text, margin: 0 }}>
          {t('segments')}
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
          {t('createSegment')}
        </button>
      </div>
      <p style={{ fontSize: 15, color: C.textMuted, margin: '0 0 32px', lineHeight: '22px' }}>
        {t('segmentsDesc')}
      </p>

      {/* Empty state */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        style={{
          backgroundColor: C.emptyBg,
          border: `1px dashed ${C.emptyBorder}`,
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
          <Users size={28} color={C.accent} />
        </div>
        <div style={{ fontSize: 18, fontWeight: 600, color: C.text, marginBottom: 8 }}>
          {t('noSegments')}
        </div>
        <div style={{ fontSize: 15, color: C.textMuted, maxWidth: 400, margin: '0 auto', lineHeight: '22px' }}>
          {t('noSegmentsDesc')}
        </div>
      </motion.div>
    </div>
  );
}
