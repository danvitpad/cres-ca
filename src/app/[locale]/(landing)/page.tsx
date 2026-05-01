/** --- YAML
 * name: Landing Page v9
 * description: Premium landing — solo master focus. No mockup, no emoji-tile bar.
 *              Hero is text-only with CTA + reassurance line. Pricing 3 tiers.
 * created: 2026-04-18
 * updated: 2026-05-01
 * --- */

'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { useTheme } from 'next-themes';
import { useLocale } from 'next-intl';
import { LanguageSwitcher } from '@/components/shared/language-switcher';
import { ThemeSwitchCircular } from '@/components/ui/theme-switch-circular';

/* ═══ Reveal on scroll ═══ */
function Reveal({ children, delay = 0 }: { children: ReactNode; delay?: number }) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [vis, setVis] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) { setTimeout(() => setVis(true), delay); io.disconnect(); }
    }, { threshold: 0.08 });
    io.observe(el);
    return () => io.disconnect();
  }, [delay]);
  return (
    <div ref={ref} style={{
      opacity: vis ? 1 : 0,
      transform: vis ? 'none' : 'translateY(20px)',
      transition: `opacity .7s cubic-bezier(.22,1,.36,1) ${delay}ms, transform .7s cubic-bezier(.22,1,.36,1) ${delay}ms`,
    }}>
      {children}
    </div>
  );
}

/* ═══ Feature card ═══ */
function FeatureCard({ icon, title, desc }: { icon: string; title: string; desc: string }) {
  return (
    <div className="feature-card">
      <div className="feature-icon">{icon}</div>
      <h3>{title}</h3>
      <p>{desc}</p>
    </div>
  );
}

/* ═══ Step card ═══ */
function StepCard({ step }: { step: { n: string; t: string; d: string } }) {
  return (
    <div className="step-card">
      <div className="step-num">{step.n}</div>
      <h3>{step.t}</h3>
      <p>{step.d}</p>
    </div>
  );
}

/* ═══ Pricing card ═══ */
function PriceCard({
  name, price, priceNote, features, pop, ctaLabel,
}: {
  name: string;
  price: string;
  priceNote?: string;
  features: string[];
  pop?: boolean;
  ctaLabel: string;
}) {
  return (
    <div className={`price-card${pop ? ' price-popular' : ''}`}>
      {pop && <div className="badge-popular">Популярный</div>}
      <div className="price-name">{name}</div>
      <div className="price-amount">
        {price} ₴<small>/мес</small>
      </div>
      {priceNote && (
        <div style={{ fontSize: 12, color: 'var(--lfg3)', marginTop: 6, lineHeight: 1.45 }}>
          {priceNote}
        </div>
      )}
      <ul className="price-features">
        {features.map((f) => <li key={f}>{f}</li>)}
      </ul>
      <Link href="/register" className="btn-pill-primary btn-pill-block price-cta">
        {ctaLabel}
      </Link>
    </div>
  );
}

/* ═══ Main page ═══ */
export default function LandingPage() {
  const locale = useLocale();
  useTheme(); // keep hook active for theme awareness

  const features = [
    { icon: '📅', title: 'Умный календарь',    desc: 'Клиенты записываются сами — через ссылку или Telegram. Конфликты и задвоения исключены автоматически.' },
    { icon: '👤', title: 'Карточки клиентов',  desc: 'История посещений, предпочтения, заметки и бонусы. Каждый клиент — в одном месте, всегда под рукой.' },
    { icon: '🤖', title: 'Telegram-бот',        desc: 'Управляйте записями и расходами голосом прямо из Telegram. Бот понимает команды и действует за вас.' },
    { icon: '💰', title: 'Финансы',             desc: 'Доходы, расходы, маржа по услугам и складу. Понятные отчёты без Excel и бухгалтера.' },
    { icon: '🔔', title: 'Авто-напоминания',   desc: 'Уведомление за 24 ч и 2 ч до визита. Клиент выбирает канал сам. Неявок становится в разы меньше.' },
    { icon: '📊', title: 'Маркетинг и рост',   desc: 'Реферальные ссылки, акции, рассылки и бонусная программа — клиенты возвращаются и приводят друзей.' },
  ];

  const steps = [
    { n: '01', t: 'Регистрация', d: 'Создайте аккаунт за 2 минуты. Укажите услуги, рабочее время и цены.' },
    { n: '02', t: 'Подключение', d: 'Поделитесь ссылкой или добавьте Telegram-бот. Клиенты начнут записываться сразу.' },
    { n: '03', t: 'Рост',        d: 'Аналитика, напоминания и маркетинг работают за вас. Вы занимаетесь своим делом.' },
  ];

  const TIERS = [
    {
      name: 'START',
      price: '299',
      priceNote: 'Всё для самостоятельной работы',
      ctaLabel: 'Начать — 14 дней бесплатно',
      features: [
        'Безлимит клиентов и записей',
        'Календарь и расписание',
        'Карточки клиентов с историей',
        'Публичная страница со своим стилем',
        'Бронирование клиентом 24/7',
        'Авто-напоминания за 24 ч и 2 ч',
        'Промокоды, бонусы, рефералы',
        'Telegram Mini App для клиентов',
      ],
    },
    {
      name: 'PRO',
      price: '799',
      pop: true,
      priceNote: 'Когда хочется работать руками, а не за компьютером',
      ctaLabel: 'Попробовать PRO',
      features: [
        'Всё из START',
        'Голосовой ввод записей в Telegram',
        'AI-помощник для клиентов в чате',
        'Рассылки клиентам по сегментам',
        'Умное возвращение «спящих» клиентов',
        'Заказы поставщикам в один клик (PDF)',
        'AI-подсказки об упущенной выручке',
        'Попадание в общий поиск мастеров',
      ],
    },
    {
      name: 'MAX',
      price: '1 499',
      priceNote: 'Для тех, кто строит бизнес',
      ctaLabel: 'Попробовать MAX',
      features: [
        'Всё из PRO',
        'AI говорит, кто из клиентов рискует уйти',
        'Прибыльность каждой услуги — видно, что приносит больше денег',
        'Сколько клиент приносит за всё время и кто возвращается',
        'Приоритет в общем поиске мастеров',
        'Рассылки с вашим брендом, а не от безликого CRM',
        'Поддержка отвечает в первую очередь',
      ],
    },
  ];

  return (
    <>
      {/* eslint-disable-next-line @next/next/no-page-custom-font */}
      <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800&display=swap" rel="stylesheet" />

      <div className="landing-v6">

        {/* ─── NAV ─── */}
        <nav className="landing-nav">
          <div className="landing-nav-inner">
            <Link href={`/${locale}`} className="landing-logo">
              <span className="logo-mark">C</span>
              CRES-CA
            </Link>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <a href="#features" className="nav-link">Возможности</a>
              <a href="#pricing"  className="nav-link">Тарифы</a>
              <LanguageSwitcher />
              <ThemeSwitchCircular size="sm" aria-label="Переключить тему" />
              <Link href="/login"    className="nav-link" style={{ marginLeft: 4 }}>Войти</Link>
              <Link href="/register" className="btn-pill-primary btn-pill-nav" style={{ marginLeft: 4 }}>
                Начать
              </Link>
            </div>
          </div>
        </nav>

        {/* ─── HERO ─── */}
        <section className="landing-section section-hero">
          <div className="hero-glow" />
          <div className="landing-container" style={{ position: 'relative' }}>
            <Reveal>
              <div className="hero-badge">Платформа для специалистов услуг</div>
            </Reveal>
            <Reveal delay={80}>
              <h1 className="heading-hero">
                Меньше рутины.<br />
                <span className="accent">Больше клиентов.</span>
              </h1>
            </Reveal>
            <Reveal delay={160}>
              <p className="hero-lead">
                Расписание, CRM, финансы и маркетинг — в одном месте.
                Плюс Telegram-бот с голосовым управлением.
              </p>
            </Reveal>
            <Reveal delay={240}>
              <div style={{ display: 'flex', gap: 12, justifyContent: 'center', marginTop: 32, flexWrap: 'wrap' }}>
                <Link href="/register" className="btn-pill-primary">Начать — 14 дней бесплатно</Link>
                <a    href="#features"  className="btn-pill-ghost">Смотреть возможности</a>
              </div>
            </Reveal>
            <Reveal delay={300}>
              <p className="micro-note">Без привязки карты · Отмена в один клик · Поддержка на родном языке</p>
            </Reveal>
          </div>
        </section>

        {/* ─── FEATURES ─── */}
        <section id="features" className="landing-section">
          <div className="landing-container">
            <Reveal>
              <div className="section-header">
                <span className="section-eyebrow">Возможности</span>
                <h2 className="heading-section-lg">Всё, что нужно для роста</h2>
                <p className="section-lead">От первой записи до масштабирования бизнеса</p>
              </div>
            </Reveal>
            <div className="features-grid">
              {features.map((f, i) => (
                <Reveal key={f.title} delay={i * 60}>
                  <FeatureCard icon={f.icon} title={f.title} desc={f.desc} />
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* ─── HOW IT WORKS ─── */}
        <section className="landing-section section-tinted">
          <div className="landing-container">
            <Reveal>
              <div className="section-header">
                <span className="section-eyebrow">Как начать</span>
                <h2 className="heading-section-lg">Три шага до результата</h2>
              </div>
            </Reveal>
            <div className="steps-grid">
              {steps.map((step, i) => (
                <Reveal key={step.n} delay={i * 100}>
                  <StepCard step={step} />
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* ─── PRICING ─── */}
        <section id="pricing" className="landing-section">
          <div className="landing-container">
            <Reveal>
              <div className="section-header">
                <span className="section-eyebrow">Тарифы</span>
                <h2 className="heading-section-lg">Честные цены для мастеров</h2>
                <p className="section-lead">
                  Для клиентов — бесплатно навсегда.&nbsp;&nbsp;Для мастеров — от 299&nbsp;₴/мес.
                </p>
              </div>
            </Reveal>
            <div className="pricing-grid">
              {TIERS.map((t, i) => (
                <Reveal key={t.name} delay={i * 80}>
                  <PriceCard {...t} />
                </Reveal>
              ))}
            </div>
            <Reveal delay={200}>
              <p style={{ textAlign: 'center', fontSize: 13, color: 'var(--lfg3)', marginTop: 24, lineHeight: 1.5 }}>
                * 14 дней пробного периода на любом тарифе. Без привязки карты. Отмена в один клик.
              </p>
            </Reveal>
          </div>
        </section>

        {/* ─── CTA ─── */}
        <section className="landing-section section-cta">
          <div className="cta-glow" />
          <Reveal>
            <div style={{ position: 'relative', maxWidth: 600, margin: '0 auto', padding: '0 24px' }}>
              <h2 className="heading-cta">Готовы начать?</h2>
              <p className="hero-lead" style={{ maxWidth: 420 }}>
                Настройте профиль за 2 минуты. Первые 14 дней — бесплатно, без привязки карты.
              </p>
              <div style={{ display: 'flex', gap: 12, justifyContent: 'center', marginTop: 28 }}>
                <Link href="/register" className="btn-pill-primary btn-pill-lg">
                  Создать аккаунт
                </Link>
              </div>
            </div>
          </Reveal>
        </section>

      </div>
    </>
  );
}
