/** --- YAML
 * name: Landing Page v7
 * description: Premium landing — мигрировано на классы рецептов из STYLE.md (Часть 2.Б, разделы 16-21).
 *              Все стили живут в app/src/styles/components.css. Inline остаются ТОЛЬКО уникальные
 *              элементы которые не повторяются нигде (DashboardMock, Reveal-обёртка, Counter).
 * created: 2026-04-18
 * updated: 2026-04-29
 * --- */

'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { useTheme } from 'next-themes';
import { useLocale } from 'next-intl';
import { LanguageSwitcher } from '@/components/shared/language-switcher';
import { ThemeSwitchCircular } from '@/components/ui/theme-switch-circular';

/* ═══ Reveal on scroll (логика, не визуал) ═══ */
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

/* ═══ Animated counter (логика) ═══ */
function Counter({ value, suffix = '' }: { value: string; suffix?: string }) {
  const ref = useRef<HTMLSpanElement | null>(null);
  const [display, setDisplay] = useState('0');
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting) return;
      io.disconnect();
      const num = parseFloat(value.replace(/[^0-9.]/g, ''));
      const dur = 1200;
      let start: number | null = null;
      const fmt = (n: number) => {
        if (n >= 1e6) return (n / 1e6).toFixed(0) + 'M';
        if (n >= 1e3) return (n / 1e3).toFixed(0) + 'K';
        return Number.isInteger(n) ? n.toString() : n.toFixed(1);
      };
      const tick = (ts: number) => {
        if (!start) start = ts;
        const p = Math.min((ts - start) / dur, 1);
        const eased = 1 - Math.pow(1 - p, 3);
        const current = eased * num;
        setDisplay(fmt(Math.round(current * 10) / 10) + suffix);
        if (p < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    }, { threshold: 0.3 });
    io.observe(el);
    return () => io.disconnect();
  }, [value, suffix]);
  return <span ref={ref}>{display}</span>;
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
  name, price, features, pop, startLabel,
}: { name: string; price: string; features: string[]; pop?: boolean; startLabel: string }) {
  return (
    <div className="price-card">
      {pop && <div className="badge-popular">Популярный</div>}
      <div className="price-name">{name}</div>
      <div className="price-amount">
        {price} ₴<small>/мес</small>
      </div>
      <ul className="price-features">
        {features.map(f => <li key={f}>{f}</li>)}
      </ul>
      <Link href="/register" className="btn-pill-primary btn-pill-block price-cta">
        {startLabel}
      </Link>
    </div>
  );
}

/* ═══ Dashboard mock — уникальный элемент, остаётся inline ═══ */
function DashboardMock() {
  const barRef = useRef<HTMLDivElement | null>(null);
  const [anim, setAnim] = useState(false);
  useEffect(() => {
    const el = barRef.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setAnim(true); io.disconnect(); } }, { threshold: 0.3 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const bars = [85, 62, 78, 45, 92];
  const stats = [
    { l: 'Записи сегодня', v: '47',   t: '+23%',   c: '#3b82f6' },
    { l: 'Новые клиенты', v: '12',   t: '+8%',    c: '#10b981' },
    { l: 'Выручка',       v: '₴3.2K', t: '+18%',   c: 'var(--color-accent)' },
    { l: 'Рейтинг',       v: '4.9',  t: '★★★★★',   c: '#f59e0b' },
  ];
  const services = [
    { n: 'Стрижка',    p: 65, c: '#0d9488' },
    { n: 'Маникюр',    p: 48, c: '#ec4899' },
    { n: 'Массаж',     p: 38, c: '#06b6d4' },
    { n: 'Окрашивание', p: 28, c: '#10b981' },
  ];
  const svcTotal = services.reduce((s, x) => s + x.p, 0);
  const svcR = 30;
  const svcCirc = 2 * Math.PI * svcR;
  let svcOffset = 0;

  return (
    <div ref={barRef}>
      <div style={{ display: 'flex', gap: 5, marginBottom: 16, alignItems: 'center' }}>
        <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#ff5f57' }} />
        <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#febc2e' }} />
        <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#28c840' }} />
        <span style={{ flex: 1 }} />
        <span style={{ fontSize: 11, color: 'var(--lfg3)', fontWeight: 500 }}>cres-ca.com/dashboard</span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 16 }}>
        {stats.map((s, i) => (
          <div key={i} style={{
            background: 'var(--lcard)', borderRadius: 10, padding: '12px 14px',
            border: '1px solid var(--lcb)', transition: 'background .4s, border-color .4s',
          }}>
            <div style={{ fontSize: 10, color: 'var(--lfg3)', fontWeight: 500 }}>{s.l}</div>
            <div style={{ fontSize: 20, fontWeight: 800, marginTop: 2 }}>{s.v}</div>
            <div style={{ fontSize: 10, color: s.c, fontWeight: 600, marginTop: 1 }}>{s.t}</div>
          </div>
        ))}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 10 }}>
        <div style={{
          background: 'var(--lcard)', borderRadius: 10, padding: 14,
          border: '1px solid var(--lcb)', transition: 'background .4s, border-color .4s',
        }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--lfg3)', marginBottom: 12 }}>Загрузка по дням</div>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: 60 }}>
            {['Пн','Вт','Ср','Чт','Пт','Сб','Вс'].map((d, i) => {
              const h = bars[i % bars.length];
              return (
                <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                  <div style={{
                    width: '100%', borderRadius: 4, background: 'var(--color-accent)',
                    opacity: 0.15 + (h / 100) * 0.85,
                    height: anim ? h * 0.6 : 0,
                    transition: `height .8s cubic-bezier(.22,1,.36,1) ${i * 0.06}s`,
                  }} />
                  <span style={{ fontSize: 9, color: 'var(--lfg3)' }}>{d}</span>
                </div>
              );
            })}
          </div>
        </div>
        <div style={{
          background: 'var(--lcard)', borderRadius: 10, padding: 14,
          border: '1px solid var(--lcb)', transition: 'background .4s, border-color .4s',
        }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--lfg3)', marginBottom: 10 }}>Услуги</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ position: 'relative', width: 72, height: 72, flexShrink: 0 }}>
              <svg width="72" height="72" viewBox="0 0 72 72" style={{ transform: 'rotate(-90deg)' }}>
                <circle cx="36" cy="36" r={svcR} fill="none" stroke="var(--lcb)" strokeWidth="8" />
                {services.map((sv, i) => {
                  const frac = sv.p / svcTotal;
                  const dash = anim ? frac * svcCirc : 0;
                  const el = (
                    <circle
                      key={i}
                      cx="36" cy="36" r={svcR}
                      fill="none" stroke={sv.c} strokeWidth="8"
                      strokeDasharray={`${dash} ${svcCirc - dash}`}
                      strokeDashoffset={-svcOffset}
                      style={{ transition: `stroke-dasharray 1s cubic-bezier(.22,1,.36,1) ${0.2 + i * 0.1}s` }}
                    />
                  );
                  svcOffset += frac * svcCirc;
                  return el;
                })}
              </svg>
              <div style={{
                position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center', pointerEvents: 'none',
              }}>
                <span style={{ fontSize: 9, color: 'var(--lfg3)', fontWeight: 600, letterSpacing: '0.03em' }}>ВСЕГО</span>
                <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--lfg)', fontVariantNumeric: 'tabular-nums', marginTop: -1 }}>
                  {svcTotal}%
                </span>
              </div>
            </div>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 5, minWidth: 0 }}>
              {services.map((sv, i) => {
                const pct = Math.round((sv.p / svcTotal) * 100);
                return (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 10 }}>
                    <span style={{ width: 7, height: 7, borderRadius: 2, background: sv.c, flexShrink: 0 }} />
                    <span style={{ flex: 1, minWidth: 0, color: 'var(--lfg2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {sv.n}
                    </span>
                    <span style={{ color: 'var(--lfg)', fontWeight: 600, fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>
                      {pct}%
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ═══ Main page ═══ */
export default function LandingPage() {
  const locale = useLocale();
  // Intentionally read theme to keep next-themes hook active for future visual tweaks.
  useTheme();

  const features = [
    { icon: '📅', title: 'Умное расписание', desc: 'Клиенты записываются сами. Конфликты исключены. Мастера управляют графиком в пару кликов.' },
    { icon: '👥', title: 'CRM-профили',      desc: 'Полная история каждого клиента: визиты, предпочтения, аллергии, заметки мастера.' },
    { icon: '🌐', title: 'Запись 24/7',      desc: 'Через ваш сайт, Telegram Mini App или прямую ссылку. Работает круглосуточно.' },
    { icon: '💰', title: 'Финансы',           desc: 'Выручка, расходы, прибыль в реальном времени. Отчёты без бухгалтера и Excel.' },
    { icon: '🔔', title: 'Авто-напоминания',  desc: 'SMS и push за 24ч и 2ч до визита. Неявки сокращаются на 70%.' },
    { icon: '📊', title: 'Маркетинг и рост',  desc: 'Бонусная программа, реферальные скидки, авто-рассылки — рост на автопилоте.' },
  ];

  const steps = [
    { n: '01', t: 'Регистрация',  d: 'Создайте аккаунт за 2 минуты. Укажите услуги, график и цены.' },
    { n: '02', t: 'Подключение',  d: 'Поделитесь ссылкой или добавьте Telegram-бот. Клиенты начнут записываться.' },
    { n: '03', t: 'Рост',         d: 'Аналитика, напоминания и маркетинг работают за вас. Вы — занимаетесь делом.' },
  ];

  const startLabel = 'Начать бесплатно';

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
              <Link href="/login" className="btn-pill-primary btn-pill-nav" style={{ marginLeft: 4 }}>
                Начать бесплатно
              </Link>
            </div>
          </div>
        </nav>

        {/* ─── HERO ─── */}
        <section className="landing-section section-hero">
          <div className="hero-glow" />
          <div className="landing-container" style={{ position: 'relative' }}>
            <Reveal>
              <div className="hero-badge">Платформа №1 для сферы услуг</div>
            </Reveal>
            <Reveal delay={80}>
              <h1 className="heading-hero">
                Записи, клиенты, финансы — <span className="accent">в одном месте</span>
              </h1>
            </Reveal>
            <Reveal delay={160}>
              <p className="hero-lead">
                Всё для управления бизнесом услуг. Расписание, CRM, аналитика и&nbsp;маркетинг — работает на вебе и&nbsp;в&nbsp;Telegram.
              </p>
            </Reveal>
            <Reveal delay={240}>
              <div style={{ display: 'flex', gap: 12, justifyContent: 'center', marginTop: 32, flexWrap: 'wrap' }}>
                <Link href="/register" className="btn-pill-primary">Попробовать бесплатно</Link>
                <a    href="#features"  className="btn-pill-ghost">Смотреть демо</a>
              </div>
            </Reveal>
            <Reveal delay={300}>
              <p className="micro-note">14 дней бесплатно · Без привязки карты</p>
            </Reveal>

            <Reveal delay={400}>
              <div className="hero-mock">
                <DashboardMock />
              </div>
            </Reveal>
          </div>
        </section>

        {/* ─── TRUST BAR ─── */}
        <Reveal>
          <div className="landing-container">
            <div className="trust-bar">
              {[
                { v: '1000000', s: '+', l: 'Записей обработано' },
                { v: '130000',  s: '+', l: 'Специалистов' },
                { v: '120',     s: '+', l: 'Городов' },
                { v: '4.9',     s: '★', l: 'Средний рейтинг' },
              ].map((s, i) => (
                <div key={i}>
                  <div className="trust-value"><Counter value={s.v} suffix={s.s} /></div>
                  <div className="trust-label">{s.l}</div>
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
                <h2 className="heading-section-lg">Простые и честные цены</h2>
                <p className="section-lead">Для клиентов — бесплатно. Для профессионалов — от 299 ₴/мес.</p>
              </div>
            </Reveal>
            <div className="pricing-grid">
              <Reveal delay={0}>
                <PriceCard
                  name="Starter" price="299" startLabel={startLabel}
                  features={['До 50 клиентов', '1 мастер', 'Календарь и запись', 'Напоминания', 'Базовая статистика']}
                />
              </Reveal>
              <Reveal delay={80}>
                <PriceCard
                  name="Pro" price="799" pop startLabel={startLabel}
                  features={['До 500 клиентов', 'Всё из Starter', 'Лист ожидания', 'Склад и расходники', 'Расширенная аналитика', 'Авто-рассылки']}
                />
              </Reveal>
              <Reveal delay={160}>
                <PriceCard
                  name="Business" price="1 999" startLabel={startLabel}
                  features={['Безлимит клиентов', 'Безлимит мастеров', 'Всё из Pro', 'AI-функции', 'Мультивалютность', 'Приоритетная поддержка']}
                />
              </Reveal>
            </div>
          </div>
        </section>

        {/* ─── CTA ─── */}
        <section className="landing-section section-cta">
          <div className="cta-glow" />
          <Reveal>
            <div style={{ position: 'relative', maxWidth: 600, margin: '0 auto', padding: '0 24px' }}>
              <h2 className="heading-cta">Готовы начать?</h2>
              <p className="hero-lead" style={{ maxWidth: 400 }}>
                Присоединяйтесь к 130&nbsp;000+ специалистов. Бесплатно. Без карты.
              </p>
              <div style={{ display: 'flex', gap: 12, justifyContent: 'center', marginTop: 28 }}>
                <Link href="/register" className="btn-pill-primary btn-pill-lg">
                  Попробовать бесплатно
                </Link>
              </div>
            </div>
          </Reveal>
        </section>
      </div>
    </>
  );
}
