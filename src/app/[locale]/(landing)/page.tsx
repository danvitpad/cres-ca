/** --- YAML
 * name: Landing Page v8
 * description: Premium landing — solo master focus. DashboardMock = real Today-page
 *              layout (sidebar + stats + appointment list). Pricing 3 solo tiers
 *              (START / PRO / MAX) — no team refs. Honest highlights bar.
 *              Footer styled to match landing theme.
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

/* ═══ Dashboard mock — реальный Today-экран дашборда ═══ */
function DashboardMock() {
  const apts = [
    { time: '10:00', name: 'Анна К.',   svc: 'Стандартная услуга',   price: '₴850',   done: true  },
    { time: '11:30', name: 'Максим Д.', svc: 'Консультация',          price: '₴400',   now:  true  },
    { time: '14:00', name: 'Ирина Г.',  svc: 'Комплексная процедура', price: '₴1 400', done: false },
  ];
  const navEmojis = ['🏠', '📅', '💰', '👥', '📣'];

  return (
    <div>
      {/* Browser chrome */}
      <div style={{ display: 'flex', gap: 5, marginBottom: 12, alignItems: 'center' }}>
        {(['#ff5f57', '#febc2e', '#28c840'] as const).map((c, i) => (
          <span key={i} style={{ width: 10, height: 10, borderRadius: '50%', background: c, display: 'block', flexShrink: 0 }} />
        ))}
        <span style={{ flex: 1 }} />
        <span style={{ fontSize: 11, color: 'var(--lfg3)', fontWeight: 500 }}>cres-ca.com/today</span>
      </div>

      {/* App shell */}
      <div style={{ display: 'flex', border: '1px solid var(--lcb)', borderRadius: 10, overflow: 'hidden' }}>
        {/* Collapsed sidebar */}
        <div style={{
          width: 48, flexShrink: 0,
          background: 'var(--lbg3)', borderRight: '1px solid var(--lcb)',
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          gap: 4, paddingTop: 10, paddingBottom: 10,
        }}>
          {/* Logo */}
          <div style={{
            width: 28, height: 28, borderRadius: 7, background: 'var(--color-accent)',
            display: 'grid', placeItems: 'center', color: '#fff',
            fontSize: 11, fontWeight: 900, marginBottom: 6,
          }}>C</div>
          {/* Nav icons */}
          {navEmojis.map((emoji, i) => (
            <div key={i} style={{
              width: 36, height: 36, borderRadius: 8, fontSize: 14,
              display: 'grid', placeItems: 'center',
              background: i === 0 ? 'var(--color-accent)' : 'transparent',
              color: i === 0 ? '#fff' : 'var(--lfg4)',
            }}>
              {emoji}
            </div>
          ))}
        </div>

        {/* Main content */}
        <div style={{ flex: 1, padding: '14px 16px', minWidth: 0 }}>
          {/* Page header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: 14, letterSpacing: '-0.02em', color: 'var(--lfg)' }}>Сегодня</div>
              <div style={{ fontSize: 10, color: 'var(--lfg3)', marginTop: 1 }}>Четверг, 1 мая 2026</div>
            </div>
            <div style={{
              fontSize: 10, fontWeight: 600, color: 'var(--color-accent)',
              background: 'rgba(13,148,136,0.08)', padding: '4px 9px',
              borderRadius: 6, cursor: 'default',
            }}>
              + Запись
            </div>
          </div>

          {/* Stats row */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8, marginBottom: 14 }}>
            {[
              { l: 'Записей',  v: '5',      c: 'var(--color-accent)' },
              { l: 'Выручка',  v: '₴2 650', c: '#10b981' },
              { l: 'Рейтинг',  v: '4.9 ★',  c: '#f59e0b' },
            ].map((s) => (
              <div key={s.l} style={{ background: 'var(--lcard)', borderRadius: 8, padding: '8px 10px', border: '1px solid var(--lcb)' }}>
                <div style={{ fontSize: 9, color: 'var(--lfg3)', fontWeight: 500, marginBottom: 2 }}>{s.l}</div>
                <div style={{ fontSize: 16, fontWeight: 800, color: s.c, letterSpacing: '-0.03em' }}>{s.v}</div>
              </div>
            ))}
          </div>

          {/* Section label */}
          <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--lfg3)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 8 }}>
            Ближайшие записи
          </div>

          {/* Appointment list */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            {apts.map((a, i) => (
              <div key={i} style={{
                display: 'flex', alignItems: 'center', gap: 8,
                background: a.now ? 'rgba(13,148,136,0.05)' : 'var(--lcard)',
                border: `1px solid ${a.now ? 'rgba(13,148,136,0.22)' : 'var(--lcb)'}`,
                borderRadius: 8, padding: '8px 10px', fontSize: 11,
              }}>
                <span style={{ color: 'var(--color-accent)', fontWeight: 700, minWidth: 36, flexShrink: 0, fontVariantNumeric: 'tabular-nums' }}>
                  {a.time}
                </span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ fontWeight: 600, color: 'var(--lfg)', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {a.name}
                  </span>
                  <span style={{ color: 'var(--lfg3)', fontSize: 10, display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {a.svc}
                  </span>
                </span>
                <span style={{ fontWeight: 700, fontSize: 12, color: 'var(--lfg)', flexShrink: 0 }}>{a.price}</span>
                <span style={{
                  width: 18, height: 18, borderRadius: '50%', flexShrink: 0,
                  display: 'grid', placeItems: 'center', fontSize: 9, color: '#fff',
                  background: a.done ? '#10b981' : a.now ? 'var(--color-accent)' : 'transparent',
                  border: a.done || a.now ? 'none' : '1.5px solid var(--lfg4)',
                }}>
                  {a.done ? '✓' : a.now ? '●' : ''}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
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
      priceNote: 'Всё необходимое для старта',
      ctaLabel: 'Начать — 14 дней бесплатно',
      features: [
        'Онлайн-запись 24/7',
        'Публичная страница /m/handle',
        'До 200 клиентов',
        'Календарь и расписание',
        'Напоминания в Telegram',
        'Базовая статистика',
      ],
    },
    {
      name: 'PRO',
      price: '799',
      pop: true,
      priceNote: 'Для профессионального роста',
      ctaLabel: 'Попробовать PRO',
      features: [
        'Всё из START',
        'Безлимит клиентов',
        'Финансы и учёт склада',
        'Авто-рассылки клиентам',
        'Реферальная программа',
        'Расширенная аналитика',
      ],
    },
    {
      name: 'MAX',
      price: '1 999',
      priceNote: 'AI-функции и максимум возможностей',
      ctaLabel: 'Попробовать MAX',
      features: [
        'Всё из PRO',
        'AI-голосовой ассистент',
        'Приоритет в поиске',
        'AI-анализ карточек клиентов',
        'Брендированная страница',
        'Приоритетная поддержка',
      ],
    },
  ];

  const highlights = [
    { icon: '🎤', text: 'Голосовой ввод' },
    { icon: '📱', text: 'Telegram Mini App' },
    { icon: '🔗', text: 'Публичная страница' },
    { icon: '⚡', text: '14 дней бесплатно' },
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
              <p className="micro-note">Без привязки карты · Отмена в один клик</p>
            </Reveal>
            <Reveal delay={420}>
              <div className="hero-mock">
                <DashboardMock />
              </div>
            </Reveal>
          </div>
        </section>

        {/* ─── HIGHLIGHTS BAR ─── */}
        <Reveal>
          <div className="landing-container">
            <div className="trust-bar">
              {highlights.map((h, i) => (
                <div key={i}>
                  <div className="trust-value" style={{ fontSize: 'clamp(24px,3.5vw,36px)', lineHeight: 1.1 }}>
                    {h.icon}
                  </div>
                  <div className="trust-label">{h.text}</div>
                </div>
              ))}
            </div>
          </div>
        </Reveal>

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
