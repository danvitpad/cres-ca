/** --- YAML
 * name: Account Type Selection
 * description: Post-registration — choose to create new business or join existing one. Restyled to match brand visuals (navy + purple accent).
 * created: 2026-04-13
 * updated: 2026-04-27
 * --- */

'use client';

import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { motion } from 'framer-motion';
import { Building2, Users, ChevronRight } from 'lucide-react';

export default function AccountTypePage() {
  const t = useTranslations('onboarding');
  const router = useRouter();

  return (
    <div
      className="fixed inset-0 overflow-y-auto"
      style={{
        background:
          'radial-gradient(120% 80% at 50% -10%, rgba(139,92,246,0.10), transparent 60%), #0b0d17',
      }}
    >
      <div className="mx-auto flex min-h-full max-w-xl flex-col justify-center px-6 py-12 md:py-16">
        {/* Logo bubble */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="mx-auto mb-8 flex size-14 items-center justify-center rounded-2xl"
          style={{
            background: 'rgba(139,92,246,0.14)',
            border: '1px solid rgba(139,92,246,0.3)',
          }}
        >
          <span className="text-xl font-bold" style={{ color: '#a78bfa', letterSpacing: '-0.02em' }}>
            C
          </span>
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
          className="text-center text-3xl font-semibold leading-tight tracking-tight md:text-4xl"
          style={{ color: '#eae8f4', letterSpacing: '-0.02em' }}
        >
          {t('accountTypeTitle')}
        </motion.h1>
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.1 }}
          className="mt-3 text-center text-sm md:text-[15px]"
          style={{ color: '#a8a3be' }}
        >
          Это можно поменять в настройках в любой момент
        </motion.p>

        <div className="mt-10 flex flex-col gap-3">
          {/* Create new business */}
          <motion.button
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            whileHover={{ y: -2 }}
            whileTap={{ scale: 0.985 }}
            onClick={() => router.push('/onboarding/vertical')}
            className="group flex items-center gap-4 rounded-2xl p-5 text-left transition-all"
            style={{
              background: '#111425',
              border: '1px solid rgba(139,92,246,0.16)',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = '#1a1d30';
              e.currentTarget.style.borderColor = 'rgba(139,92,246,0.35)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = '#111425';
              e.currentTarget.style.borderColor = 'rgba(139,92,246,0.16)';
            }}
          >
            <div
              className="flex size-12 shrink-0 items-center justify-center rounded-xl"
              style={{ background: 'rgba(139,92,246,0.12)', color: '#a78bfa' }}
            >
              <Building2 className="size-5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[15px] font-semibold" style={{ color: '#eae8f4' }}>
                {t('createBusiness')}
              </p>
              <p className="mt-1 text-xs" style={{ color: '#a8a3be' }}>
                Свой профиль или своя команда — настроим под нишу
              </p>
            </div>
            <ChevronRight
              className="size-5 transition-transform group-hover:translate-x-0.5"
              style={{ color: '#a8a3be' }}
            />
          </motion.button>

          {/* Join existing business */}
          <motion.button
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.22 }}
            whileHover={{ y: -2 }}
            whileTap={{ scale: 0.985 }}
            onClick={() => router.push('/onboarding/join-business')}
            className="group flex items-center gap-4 rounded-2xl p-5 text-left transition-all"
            style={{
              background: '#111425',
              border: '1px solid rgba(139,92,246,0.16)',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = '#1a1d30';
              e.currentTarget.style.borderColor = 'rgba(139,92,246,0.35)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = '#111425';
              e.currentTarget.style.borderColor = 'rgba(139,92,246,0.16)';
            }}
          >
            <div
              className="flex size-12 shrink-0 items-center justify-center rounded-xl"
              style={{ background: 'rgba(139,92,246,0.12)', color: '#a78bfa' }}
            >
              <Users className="size-5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[15px] font-semibold" style={{ color: '#eae8f4' }}>
                {t('joinBusiness')}
              </p>
              <p className="mt-1 text-xs" style={{ color: '#a8a3be' }}>
                {t('joinBusinessDesc')}
              </p>
            </div>
            <ChevronRight
              className="size-5 transition-transform group-hover:translate-x-0.5"
              style={{ color: '#a8a3be' }}
            />
          </motion.button>
        </div>
      </div>
    </div>
  );
}
