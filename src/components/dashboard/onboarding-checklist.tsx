/** --- YAML
 * name: OnboardingChecklist
 * description: 3-step launch checklist card (services → working hours → first appointment). Отображается сверху dashboard overview пока мастер не завершил онбординг. Исчезает когда все 3 шага сделаны.
 * created: 2026-04-13
 * updated: 2026-04-13
 * --- */

'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { motion, AnimatePresence } from 'framer-motion';
import { createClient } from '@/lib/supabase/client';
import type { MasterData } from '@/hooks/use-master';
import { FONT } from '@/lib/dashboard-theme';

interface Props {
  master: MasterData | null;
  theme: 'light' | 'dark';
}

interface Step {
  key: 'services' | 'hours' | 'first_appointment';
  done: boolean;
  href: string;
}

function hasWorkingHours(wh: MasterData['working_hours'] | null | undefined): boolean {
  if (!wh || typeof wh !== 'object') return false;
  return Object.values(wh).some((d) => d && d.start && d.end);
}

export function OnboardingChecklist({ master, theme }: Props) {
  const t = useTranslations('dashboard.onboardingChecklist');
  const [servicesDone, setServicesDone] = useState<boolean | null>(null);
  const [appointmentDone, setAppointmentDone] = useState<boolean | null>(null);

  useEffect(() => {
    if (!master?.id) return;
    const supabase = createClient();
    (async () => {
      const [svc, appt] = await Promise.all([
        supabase.from('services').select('id', { count: 'exact', head: true }).eq('master_id', master.id).eq('is_active', true),
        supabase.from('appointments').select('id', { count: 'exact', head: true }).eq('master_id', master.id),
      ]);
      setServicesDone((svc.count ?? 0) > 0);
      setAppointmentDone((appt.count ?? 0) > 0);
    })();
  }, [master?.id]);

  if (!master) return null;
  if (servicesDone === null || appointmentDone === null) return null;

  const hoursDone = hasWorkingHours(master.working_hours);
  const steps: Step[] = [
    { key: 'services', done: servicesDone, href: '/services' },
    { key: 'hours', done: hoursDone, href: '/settings/schedule' },
    { key: 'first_appointment', done: appointmentDone, href: '/calendar' },
  ];

  const doneCount = steps.filter((s) => s.done).length;
  if (doneCount === 3) return null;

  const isDark = theme === 'dark';
  const cardBg = isDark ? '#181818' : '#ffffff';
  const border = isDark ? '0.8px solid #333' : '0.8px solid #e0e0e0';
  const text = isDark ? '#f5f5f5' : '#0d0d0d';
  const textMuted = isDark ? '#a3a3a3' : '#737373';
  const accent = 'var(--color-accent)';
  const successBg = isDark ? '#0a2010' : '#f0fdf4';
  const successBorder = isDark ? '#2c7016' : '#22c55e';
  const pendingBg = isDark ? '#1f1f1f' : '#f9fafb';
  const pendingBorder = isDark ? '#333' : '#e5e7eb';
  const progressBg = isDark ? '#262626' : '#ececec';

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -8 }}
        style={{
          gridColumn: '1 / -1',
          backgroundColor: cardBg,
          border,
          borderRadius: 16,
          padding: 24,
          fontFamily: FONT,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 18 }}>
          <div>
            <h3 style={{ fontSize: 16, fontWeight: 600, color: text, margin: 0, lineHeight: 1.3 }}>
              {t('title')}
            </h3>
            <p style={{ fontSize: 13, color: textMuted, margin: '4px 0 0' }}>
              {t('subtitle', { done: doneCount, total: 3 })}
            </p>
          </div>
          <div style={{ fontSize: 13, color: accent, fontWeight: 600 }}>
            {Math.round((doneCount / 3) * 100)}%
          </div>
        </div>

        <div style={{ height: 4, backgroundColor: progressBg, borderRadius: 999, overflow: 'hidden', marginBottom: 20 }}>
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${(doneCount / 3) * 100}%` }}
            transition={{ duration: 0.6, ease: 'easeOut' }}
            style={{ height: '100%', backgroundColor: accent, borderRadius: 999 }}
          />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
          {steps.map((step) => (
            <Link
              key={step.key}
              href={step.href}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: '14px 16px',
                borderRadius: 12,
                backgroundColor: step.done ? successBg : pendingBg,
                border: `1px solid ${step.done ? successBorder : pendingBorder}`,
                textDecoration: 'none',
                transition: 'transform 0.15s ease',
              }}
            >
              <div
                style={{
                  width: 28,
                  height: 28,
                  minWidth: 28,
                  borderRadius: '50%',
                  backgroundColor: step.done ? successBorder : 'transparent',
                  border: step.done ? 'none' : `2px solid ${pendingBorder}`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#fff',
                }}
              >
                {step.done ? (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                ) : null}
              </div>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: text, marginBottom: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {t(`steps.${step.key}.title`)}
                </div>
                <div style={{ fontSize: 12, color: textMuted, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {t(`steps.${step.key}.hint`)}
                </div>
              </div>
            </Link>
          ))}
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
