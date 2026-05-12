/** --- YAML
 * name: WelcomeGate
 * description: При первом входе мастера в кабинет показывает поп-ап
 *              «Спасибо за регистрацию» с двумя кнопками — «Пройти тур»
 *              запускает короткий тур по основным страницам через
 *              ?tour=today (см. TourOverlay), «Пропустить» просто
 *              помечает welcome_seen=true и закрывает поп-ап.
 *              Заменил старый редирект на /[locale]/welcome (тот
 *              белый слайдер был неудобен — пользователь хотел поп-ап).
 * updated: 2026-05-01
 * --- */

'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useLocale } from 'next-intl';
import { motion, AnimatePresence } from 'framer-motion';
import { Compass, X } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

export function WelcomeGate() {
  const router = useRouter();
  const pathname = usePathname();
  const locale = useLocale();
  const [showDialog, setShowDialog] = useState(false);
  const [firstName, setFirstName] = useState('');
  const [role, setRole] = useState<'master' | 'client' | 'salon_admin' | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    // Старая версия редиректила на /[locale]/welcome — больше так не делаем.
    // Просто читаем флаг и показываем модалку поверх контента.
    if (!pathname) return;
    if (pathname.includes('/onboarding')) return;
    if (pathname.includes('/welcome')) return; // legacy роут — пускай рендерит сам

    const ctrl = new AbortController();
    (async () => {
      try {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user || ctrl.signal.aborted) return;
        const { data } = await supabase
          .from('profiles')
          .select('welcome_seen, first_name, full_name, role')
          .eq('id', user.id)
          .maybeSingle();
        if (ctrl.signal.aborted) return;
        const row = data as {
          welcome_seen?: boolean;
          first_name?: string | null;
          full_name?: string | null;
          role?: string | null;
        } | null;
        const seen = row?.welcome_seen ?? true;
        if (!seen) {
          setFirstName((row?.first_name || row?.full_name?.split(' ')[0] || '').trim());
          // Тур у мастера, клиента и админа разные — кнопка «Пройти тур»
          // должна вести на правильный стартовый экран в зависимости от роли.
          const r = (row?.role as 'master' | 'client' | 'salon_admin' | null) ?? null;
          setRole(r);
          setShowDialog(true);
        }
      } catch {
        // best-effort
      }
    })();

    return () => ctrl.abort();
  }, [pathname]);

  async function markSeen() {
    setSubmitting(true);
    try {
      await fetch('/api/account/welcome-complete', { method: 'POST' });
    } catch {
      /* not critical */
    } finally {
      setSubmitting(false);
    }
  }

  async function onSkip() {
    await markSeen();
    setShowDialog(false);
  }

  async function onStartTour() {
    await markSeen();
    setShowDialog(false);
    // Каждой роли — свой стартовый экран тура. Раньше всех слепо
    // отправлял на /today (мастерский экран) — клиент получал чужой
    // дашборд под чужим профилем. Теперь:
    //   master → /today?tour=today (его утренний экран)
    //   client → /feed (полноценного клиентского тура пока нет — открываем
    //                   главную клиента, чтобы не путать)
    //   salon_admin → /dashboard (его кабинет команды)
    if (role === 'client') {
      router.push(`/${locale}/feed`);
    } else if (role === 'salon_admin') {
      router.push(`/${locale}/dashboard`);
    } else {
      router.push(`/${locale}/today?tour=today`);
    }
  }

  return (
    <AnimatePresence>
      {showDialog && (
        <motion.div
          key="welcome-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9998,
            background: 'rgba(0,0,0,0.55)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 16,
            backdropFilter: 'blur(4px)',
          }}
          onClick={onSkip}
        >
          <motion.div
            key="welcome-dialog"
            initial={{ opacity: 0, scale: 0.92, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            onClick={(e) => e.stopPropagation()}
            style={{
              width: '100%',
              maxWidth: 440,
              background: 'var(--card, white)',
              color: 'var(--card-foreground, black)',
              borderRadius: 20,
              padding: '28px 24px 24px',
              boxShadow: '0 20px 60px rgba(0,0,0,0.35)',
              position: 'relative',
            }}
          >
            <button
              type="button"
              onClick={onSkip}
              aria-label="Закрыть"
              style={{
                position: 'absolute',
                top: 12,
                right: 12,
                background: 'transparent',
                border: 'none',
                width: 32,
                height: 32,
                borderRadius: 8,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                color: 'var(--muted-foreground, #888)',
              }}
            >
              <X size={18} />
            </button>

            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }}>
              <div
                style={{
                  width: 64,
                  height: 64,
                  borderRadius: 999,
                  background: 'var(--ds-accent-soft, rgba(20,184,166,0.12))',
                  color: 'var(--ds-accent, #14b8a6)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Compass size={28} />
              </div>
            </div>

            <h2
              style={{
                fontSize: 22,
                fontWeight: 700,
                lineHeight: 1.2,
                textAlign: 'center',
                margin: 0,
              }}
            >
              {firstName ? `Добро пожаловать, ${firstName}!` : 'Добро пожаловать!'}
            </h2>
            <p
              style={{
                marginTop: 10,
                fontSize: 14,
                lineHeight: 1.5,
                color: 'var(--muted-foreground, #666)',
                textAlign: 'center',
              }}
            >
              Спасибо, что выбрали CRES-CA. Хотите пройти короткий тур по основным
              разделам — расписание, клиенты, финансы — чтобы быстрее освоиться?
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 22 }}>
              <button
                type="button"
                onClick={onStartTour}
                disabled={submitting}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  height: 46,
                  borderRadius: 12,
                  border: 'none',
                  background: 'var(--ds-accent, #14b8a6)',
                  color: 'white',
                  fontSize: 15,
                  fontWeight: 600,
                  cursor: submitting ? 'wait' : 'pointer',
                  opacity: submitting ? 0.6 : 1,
                  transition: 'opacity 150ms',
                }}
              >
                <Compass size={18} />
                Пройти тур
              </button>
              <button
                type="button"
                onClick={onSkip}
                disabled={submitting}
                style={{
                  height: 42,
                  borderRadius: 12,
                  border: 'none',
                  background: 'transparent',
                  color: 'var(--muted-foreground, #888)',
                  fontSize: 14,
                  fontWeight: 500,
                  cursor: submitting ? 'wait' : 'pointer',
                }}
              >
                Пропустить
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
