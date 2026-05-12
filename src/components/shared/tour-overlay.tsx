/** --- YAML
 * name: TourOverlay
 * description: Гид по основным разделам кабинета мастера. Запускается из
 *              WelcomeGate (поп-ап после регистрации) — переходит на /today
 *              с ?tour=today и далее по цепочке /calendar → /finance.
 *              Отображает плавающую карточку внизу экрана с описанием
 *              того, что есть на текущей странице, и кнопками
 *              «Назад / Дальше / Закончить».
 * created: 2026-05-01
 * --- */

'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { useLocale } from 'next-intl';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowRight, ArrowLeft, X, CheckCircle2, Compass } from 'lucide-react';

type TourStep = {
  key: string;
  path: string; // относительный путь без локали
  title: string;
  intro: string;
  highlights: string[];
};

const TOUR_STEPS: TourStep[] = [
  {
    key: 'today',
    path: 'today',
    title: 'Сегодня — ваш утренний экран',
    intro:
      'Открыл кабинет — сразу видите главное. Ничего искать не нужно: все важные подсказки на сегодня собраны на одной странице.',
    highlights: [
      'Напоминания: что сделать сегодня (позвонить клиенту, заказать материал, и т.д.)',
      'Дни рождения клиентов и партнёров — чтобы не забыть поздравить',
      'Партнёры по гильдии — мастера, с которыми вы рекомендуете друг друга',
      'AI-помощник — задавай вопросы голосом или текстом прямо отсюда',
    ],
  },
  {
    key: 'calendar',
    path: 'calendar',
    title: 'Календарь — без хаоса',
    intro:
      'Здесь живут все записи и блоки нерабочего времени. Создать запись, заблокировать обед, поставить шаблон выходного — всё в один клик.',
    highlights: [
      'Кнопка «Добавить» создаёт запись, блок времени или групповой слот',
      'Перетаскивание мышью двигает запись на другое время',
      'Шаблоны блокировок (обед, перерыв) — сохраняешь один раз и переиспользуешь',
      'Клик на пустое время → быстрая запись со всеми вашими услугами',
    ],
  },
  {
    key: 'finance',
    path: 'finance',
    title: 'Финансы — где деньги',
    intro:
      'Доход, расход, прибыль и маржа по услугам. AI следит за дырами — где теряются деньги — и сам подкидывает подсказки.',
    highlights: [
      'Карточки сверху: доход / расход / прибыль / число записей за период',
      'AI аналитика дохода — карусель с конкретными действиями на сегодня',
      'Спросить AI-помощника — задаёшь вопрос про свои финансы текстом',
      'Вкладки «Доходы / Расходы / Маржа» — детальная разбивка',
    ],
  },
];

export function TourOverlay() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const locale = useLocale();
  const tourKey = searchParams?.get('tour');
  const [submittingDone, setSubmittingDone] = useState(false);

  // Определяем индекс шага по query
  const stepIndex = useMemo(() => {
    if (!tourKey) return -1;
    return TOUR_STEPS.findIndex((s) => s.key === tourKey);
  }, [tourKey]);

  const currentStep = stepIndex >= 0 ? TOUR_STEPS[stepIndex] : null;

  // Дополнительная защита: показываем тур только если url-путь
  // совпадает с шагом (юзер не зашёл случайно с ?tour=today на /clients).
  const onCorrectPage = useMemo(() => {
    if (!currentStep || !pathname) return false;
    return pathname.endsWith(`/${currentStep.path}`);
  }, [currentStep, pathname]);

  useEffect(() => {
    // Если ?tour есть, но мы не на правильном пути — мягко перенаправляем.
    if (currentStep && !onCorrectPage) {
      router.replace(`/${locale}/${currentStep.path}?tour=${currentStep.key}`);
    }
  }, [currentStep, onCorrectPage, router, locale]);

  if (!currentStep || !onCorrectPage) return null;

  const isFirst = stepIndex === 0;
  const isLast = stepIndex === TOUR_STEPS.length - 1;

  function navigateWithoutTour(path: string) {
    router.replace(`/${locale}/${path}`);
  }

  function goPrev() {
    if (isFirst) return;
    const prev = TOUR_STEPS[stepIndex - 1];
    router.replace(`/${locale}/${prev.path}?tour=${prev.key}`);
  }

  function goNext() {
    if (isLast) return finishTour();
    const next = TOUR_STEPS[stepIndex + 1];
    router.replace(`/${locale}/${next.path}?tour=${next.key}`);
  }

  function finishTour() {
    if (!currentStep) return;
    setSubmittingDone(true);
    // Просто убираем ?tour из URL — текущая страница остаётся
    navigateWithoutTour(currentStep.path);
  }

  function skipTour() {
    if (!currentStep) return;
    navigateWithoutTour(currentStep.path);
  }

  return (
    <AnimatePresence>
      <motion.div
        key={`tour-${currentStep.key}`}
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 16 }}
        transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
        style={{
          position: 'fixed',
          left: 16,
          right: 16,
          bottom: 16,
          zIndex: 9990,
          display: 'flex',
          justifyContent: 'center',
          pointerEvents: 'none',
        }}
      >
        <div
          style={{
            pointerEvents: 'auto',
            width: '100%',
            maxWidth: 720,
            background: 'var(--card, white)',
            color: 'var(--card-foreground, black)',
            border: '1px solid var(--border, rgba(0,0,0,0.08))',
            borderRadius: 16,
            padding: '18px 20px',
            boxShadow: '0 18px 50px rgba(0,0,0,0.28)',
            position: 'relative',
          }}
        >
          {/* Close */}
          <button
            type="button"
            onClick={skipTour}
            aria-label="Закрыть тур"
            style={{
              position: 'absolute',
              top: 8,
              right: 8,
              background: 'transparent',
              border: 'none',
              width: 30,
              height: 30,
              borderRadius: 8,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              color: 'var(--muted-foreground, #888)',
            }}
          >
            <X size={16} />
          </button>

          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: 8,
                background: 'var(--ds-accent-soft, rgba(20,184,166,0.12))',
                color: 'var(--ds-accent, #14b8a6)',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <Compass size={16} />
            </div>
            <div style={{ minWidth: 0, flex: 1 }}>
              <p
                style={{
                  margin: 0,
                  fontSize: 11,
                  fontWeight: 600,
                  letterSpacing: 0.4,
                  color: 'var(--ds-accent, #14b8a6)',
                  textTransform: 'uppercase',
                }}
              >
                Тур · шаг {stepIndex + 1} из {TOUR_STEPS.length}
              </p>
              <h3 style={{ margin: '2px 0 0', fontSize: 16, fontWeight: 700, lineHeight: 1.2 }}>
                {currentStep.title}
              </h3>
            </div>
          </div>

          {/* Intro */}
          <p
            style={{
              margin: '4px 0 12px',
              fontSize: 13.5,
              lineHeight: 1.5,
              color: 'var(--muted-foreground, #666)',
            }}
          >
            {currentStep.intro}
          </p>

          {/* Highlights */}
          <ul
            style={{
              listStyle: 'none',
              margin: 0,
              padding: 0,
              display: 'flex',
              flexDirection: 'column',
              gap: 6,
            }}
          >
            {currentStep.highlights.map((h, i) => (
              <li
                key={i}
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 8,
                  fontSize: 13,
                  lineHeight: 1.4,
                }}
              >
                <CheckCircle2
                  size={14}
                  style={{
                    flexShrink: 0,
                    marginTop: 2,
                    color: 'var(--ds-accent, #14b8a6)',
                  }}
                />
                <span>{h}</span>
              </li>
            ))}
          </ul>

          {/* Footer buttons */}
          <div
            style={{
              marginTop: 16,
              display: 'flex',
              gap: 10,
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
            }}
          >
            <button
              type="button"
              onClick={skipTour}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--muted-foreground, #888)',
                fontSize: 13,
                fontWeight: 500,
                cursor: 'pointer',
                padding: '8px 4px',
              }}
            >
              Пропустить
            </button>
            <div style={{ display: 'flex', gap: 8 }}>
              {!isFirst && (
                <button
                  type="button"
                  onClick={goPrev}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    height: 38,
                    padding: '0 14px',
                    borderRadius: 10,
                    background: 'transparent',
                    border: '1px solid var(--border, rgba(0,0,0,0.12))',
                    color: 'var(--card-foreground, black)',
                    fontSize: 13.5,
                    fontWeight: 500,
                    cursor: 'pointer',
                  }}
                >
                  <ArrowLeft size={14} />
                  Назад
                </button>
              )}
              <button
                type="button"
                onClick={goNext}
                disabled={submittingDone}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  height: 38,
                  padding: '0 18px',
                  borderRadius: 10,
                  background: 'var(--ds-accent, #14b8a6)',
                  border: 'none',
                  color: 'white',
                  fontSize: 13.5,
                  fontWeight: 600,
                  cursor: submittingDone ? 'wait' : 'pointer',
                  opacity: submittingDone ? 0.6 : 1,
                }}
              >
                {isLast ? 'Закончить тур' : 'Дальше'}
                {!isLast && <ArrowRight size={14} />}
              </button>
            </div>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
