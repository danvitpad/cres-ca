/** --- YAML
 * name: Landing Page v6
 * description: Premium landing — Plus Jakarta Sans, violet accent, reveal-on-scroll, animated counters + dashboard mock, 3-step + 3-tier pricing. Ported from Claude Design bundle (ylQ3KO-IdA5lqZ02GOoYOg, v6).
 * created: 2026-04-18
 * updated: 2026-04-18
 * --- */

'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { useTheme } from 'next-themes';
import { useLocale } from 'next-intl';
import { LanguageSwitcher } from '@/components/shared/language-switcher';
import { ThemeSwitchCircular } from '@/components/ui/theme-switch-circular';

/* ═══ Theme-aware CSS vars ═══ */
const LANDING_CSS = `
.landing-v6 {
  --lf: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  --lbg: #ffffff; --lbg2: #f8f8f8; --lbg3: #f0f0f0;
  --lfg: #0a0a0a; --lfg2: #555555; --lfg3: #888888; --lfg4: #bbbbbb;
  --lcard: #ffffff; --lcb: rgba(0,0,0,.07);
  --lglass: rgba(255,255,255,.72);
  --lviolet: #0d9488; --lviolet-l: #f0fdfa; --lviolet-d: #115e59;
  --lgreen: #10b981; --lblue: #3b82f6; --lorange: #f59e0b; --lpink: #ec4899;
  font-family: var(--lf);
  background: var(--lbg);
  color: var(--lfg);
  -webkit-font-smoothing: antialiased;
  overflow-x: hidden;
}
html.dark .landing-v6 {
  --lbg: #09090b; --lbg2: #18181b; --lbg3: #27272a;
  --lfg: #fafafa; --lfg2: #a1a1aa; --lfg3: #71717a; --lfg4: #3f3f46;
  --lcard: #18181b; --lcb: rgba(255,255,255,.06);
  --lglass: rgba(9,9,11,.72);
  --lviolet: #5eead4; --lviolet-l: rgba(94,234,212,.1); --lviolet-d: #5eead4;
}
.landing-v6 * { box-sizing: border-box; }
.landing-v6 a { color: inherit; text-decoration: none; }
@keyframes landing-glow-p { 0%{opacity:.5;transform:translateX(-50%) scale(1)} 100%{opacity:1;transform:translateX(-50%) scale(1.06)} }
@keyframes landing-dot-p  { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:.4;transform:scale(1.5)} }
`;

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

/* ═══ Animated counter ═══ */
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
  const [hov, setHov] = useState(false);
  return (
    <div
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        background: 'var(--lbg2)',
        borderRadius: 16,
        padding: 'clamp(24px,3vw,36px)',
        transition: 'transform .3s, box-shadow .3s, background .4s',
        transform: hov ? 'translateY(-4px)' : 'none',
        boxShadow: hov ? '0 12px 40px rgba(0,0,0,.06)' : 'none',
        height: '100%',
      }}
    >
      <div style={{ fontSize: 28, marginBottom: 16 }}>{icon}</div>
      <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 6, letterSpacing: '-.01em' }}>{title}</h3>
      <p style={{ fontSize: 14, color: 'var(--lfg2)', lineHeight: 1.55, margin: 0 }}>{desc}</p>
    </div>
  );
}

/* ═══ Pricing card ═══ */
function PriceCard({
  name, price, features, pop, startLabel,
}: { name: string; price: string; features: string[]; pop?: boolean; startLabel: string }) {
  const [hov, setHov] = useState(false);
  return (
    <div
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        background: 'var(--lbg2)',
        color: 'var(--lfg)',
        borderRadius: 16,
        padding: 'clamp(28px,3vw,40px)',
        display: 'flex',
        flexDirection: 'column',
        transition: 'transform .3s, box-shadow .3s, background .4s, color .4s',
        transform: hov ? 'translateY(-4px)' : 'none',
        boxShadow: hov ? '0 12px 40px rgba(0,0,0,.08)' : 'none',
        border: '1px solid var(--lcb)',
        height: '100%',
      }}
    >
      {pop && (
        <div style={{
          fontSize: 10, fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase',
          background: 'var(--lviolet)', color: '#fff', padding: '4px 10px', borderRadius: 99,
          width: 'fit-content', marginBottom: 14,
        }}>
          Популярный
        </div>
      )}
      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--lfg2)', letterSpacing: '.02em' }}>{name}</div>
      <div style={{ fontSize: 'clamp(36px,5vw,48px)', fontWeight: 800, letterSpacing: '-.03em', marginTop: 4 }}>
        {price} ₴<small style={{ fontSize: 15, fontWeight: 400, color: 'var(--lfg2)' }}>/мес</small>
      </div>
      <ul style={{ listStyle: 'none', margin: '24px 0 0', padding: 0, flex: 1, display: 'flex', flexDirection: 'column', gap: 10 }}>
        {features.map(f => (
          <li key={f} style={{ fontSize: 14, color: 'var(--lfg2)', display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--lviolet)', flexShrink: 0 }} />
            {f}
          </li>
        ))}
      </ul>
      <Link
        href="/register"
        style={{
          display: 'block', width: '100%', textAlign: 'center',
          padding: 13, borderRadius: 99, fontSize: 14, fontWeight: 600,
          marginTop: 24, border: 'none', cursor: 'pointer', fontFamily: 'var(--lf)',
          background: 'var(--lviolet)', color: '#fff',
        }}
      >
        {startLabel}
      </Link>
    </div>
  );
}

/* ═══ Dashboard mock ═══ */
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
    { l: 'Записи сегодня', v: '47',   t: '+23%',   c: 'var(--lblue)'   },
    { l: 'Новые клиенты', v: '12',   t: '+8%',    c: 'var(--lgreen)'  },
    { l: 'Выручка',       v: '₴3.2K', t: '+18%',   c: 'var(--lviolet)' },
    { l: 'Рейтинг',       v: '4.9',  t: '★★★★★',   c: 'var(--lorange)' },
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
                    width: '100%', borderRadius: 4, background: 'var(--lviolet)',
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
  const { resolvedTheme } = useTheme();
  // May be undefined on first render before next-themes hydrates — shadow falls back to light.
  const isDark = resolvedTheme === 'dark';

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
      <style dangerouslySetInnerHTML={{ __html: LANDING_CSS }} />

      <div className="landing-v6">
        {/* ─── NAV ─── */}
        <nav style={{
          position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100,
          backdropFilter: 'blur(20px) saturate(1.6)',
          WebkitBackdropFilter: 'blur(20px) saturate(1.6)',
          background: 'var(--lglass)',
          borderBottom: '1px solid var(--lcb)',
          transition: 'background .4s',
        }}>
          <div style={{
            maxWidth: 1200, margin: '0 auto',
            padding: '0 clamp(24px,5vw,64px)', height: 56,
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}>
            <Link href={`/${locale}`} style={{ fontWeight: 800, fontSize: 17, letterSpacing: '-.03em', display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{
                width: 26, height: 26, borderRadius: 7,
                background: 'var(--lviolet)', display: 'grid', placeItems: 'center',
                color: '#fff', fontSize: 12, fontWeight: 900,
              }}>C</span>
              CRES-CA
            </Link>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <a href="#features" style={{ padding: '7px 14px', fontSize: 13, fontWeight: 500, color: 'var(--lfg2)', borderRadius: 99 }}>
                Возможности
              </a>
              <a href="#pricing" style={{ padding: '7px 14px', fontSize: 13, fontWeight: 500, color: 'var(--lfg2)', borderRadius: 99 }}>
                Тарифы
              </a>
              <LanguageSwitcher />
              <ThemeSwitchCircular
                size="sm"
                aria-label="Переключить тему"
                style={{ borderColor: 'var(--lcb)', background: 'transparent', color: 'var(--lfg2)' }}
              />
              <Link href="/login" style={{
                padding: '8px 18px', borderRadius: 99,
                background: 'var(--lviolet)', color: '#fff',
                fontSize: 13, fontWeight: 600,
                marginLeft: 4,
                boxShadow: '0 2px 12px rgba(13,148,136,.25)',
              }}>
                Начать бесплатно
              </Link>
            </div>
          </div>
        </nav>

        {/* ─── HERO ─── */}
        <section style={{ padding: 'clamp(130px,18vw,180px) 0 clamp(60px,8vw,100px)', textAlign: 'center', position: 'relative', overflow: 'hidden' }}>
          <div style={{
            position: 'absolute', top: '10%', left: '50%', transform: 'translateX(-50%)',
            width: 'min(900px, 140vw)', height: 700,
            background: 'radial-gradient(ellipse, var(--lviolet-l), transparent 65%)',
            pointerEvents: 'none', animation: 'landing-glow-p 6s ease-in-out infinite alternate',
          }} />
          <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 clamp(24px,5vw,64px)', position: 'relative' }}>
            <Reveal>
              <div style={{
                display: 'inline-flex', alignItems: 'center', gap: 8,
                padding: '6px 16px 6px 8px', borderRadius: 99,
                background: 'var(--lviolet-l)', color: 'var(--lviolet)',
                fontSize: 13, fontWeight: 600, marginBottom: 24,
              }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--lviolet)', animation: 'landing-dot-p 2s ease infinite' }} />
                Платформа №1 для сферы услуг
              </div>
            </Reveal>
            <Reveal delay={80}>
              <h1 style={{
                fontSize: 'clamp(40px,7vw,72px)', fontWeight: 800, lineHeight: 1.02,
                letterSpacing: '-.04em', maxWidth: 800, margin: '0 auto', textWrap: 'balance',
              }}>
                Записи, клиенты, финансы — <span style={{ color: 'var(--lviolet)' }}>в одном месте</span>
              </h1>
            </Reveal>
            <Reveal delay={160}>
              <p style={{
                fontSize: 'clamp(17px,2vw,20px)', color: 'var(--lfg2)',
                maxWidth: 520, margin: '16px auto 0', lineHeight: 1.55,
              }}>
                Всё для управления бизнесом услуг. Расписание, CRM, аналитика и&nbsp;маркетинг — работает на вебе и&nbsp;в&nbsp;Telegram.
              </p>
            </Reveal>
            <Reveal delay={240}>
              <div style={{ display: 'flex', gap: 12, justifyContent: 'center', marginTop: 32, flexWrap: 'wrap' }}>
                <Link href="/register" style={{
                  padding: '14px 32px', borderRadius: 99,
                  background: 'var(--lviolet)', color: '#fff',
                  fontSize: 16, fontWeight: 600, transition: 'all .3s',
                  boxShadow: '0 4px 20px rgba(13,148,136,.25)',
                }}>
                  Попробовать бесплатно
                </Link>
                <a href="#features" style={{
                  padding: '14px 32px', borderRadius: 99,
                  background: 'transparent', color: 'var(--lfg)',
                  fontSize: 16, fontWeight: 500,
                  border: '1px solid var(--lcb)', transition: '.2s',
                }}>
                  Смотреть демо
                </a>
              </div>
            </Reveal>
            <Reveal delay={300}>
              <p style={{ marginTop: 14, fontSize: 12, color: 'var(--lfg3)' }}>
                14 дней бесплатно · Без привязки карты
              </p>
            </Reveal>

            <Reveal delay={400}>
              <div style={{
                marginTop: 'clamp(40px,6vw,72px)',
                background: 'var(--lbg2)',
                border: '1px solid var(--lcb)',
                borderRadius: 16,
                padding: 'clamp(16px,2vw,28px)',
                boxShadow: isDark ? '0 24px 80px rgba(0,0,0,.3)' : '0 24px 80px rgba(0,0,0,.06)',
                transition: 'background .4s, border-color .4s, box-shadow .4s',
                maxWidth: 860,
                marginLeft: 'auto', marginRight: 'auto',
              }}>
                <DashboardMock />
              </div>
            </Reveal>
          </div>
        </section>

        {/* ─── TRUST BAR ─── */}
        <Reveal>
          <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 clamp(24px,5vw,64px)' }}>
            <div style={{
              display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)',
              borderTop: '1px solid var(--lcb)', borderBottom: '1px solid var(--lcb)',
              padding: 'clamp(28px,4vw,44px) 0', textAlign: 'center',
              transition: 'border-color .4s',
            }}>
              {[
                { v: '1000000', s: '+', l: 'Записей обработано' },
                { v: '130000',  s: '+', l: 'Специалистов' },
                { v: '120',     s: '+', l: 'Городов' },
                { v: '4.9',     s: '★', l: 'Средний рейтинг' },
              ].map((s, i) => (
                <div key={i}>
                  <div style={{ fontSize: 'clamp(28px,4vw,44px)', fontWeight: 800, letterSpacing: '-.03em' }}>
                    <Counter value={s.v} suffix={s.s} />
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--lfg3)', marginTop: 4, fontWeight: 500 }}>{s.l}</div>
                </div>
              ))}
            </div>
          </div>
        </Reveal>

        {/* ─── FEATURES ─── */}
        <section id="features" style={{ padding: 'clamp(80px,12vw,120px) 0' }}>
          <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 clamp(24px,5vw,64px)' }}>
            <Reveal>
              <div style={{ textAlign: 'center', marginBottom: 'clamp(40px,5vw,64px)' }}>
                <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--lviolet)', marginBottom: 10 }}>
                  Возможности
                </div>
                <h2 style={{ fontSize: 'clamp(32px,4.5vw,48px)', fontWeight: 800, letterSpacing: '-.035em', lineHeight: 1.06 }}>
                  Всё, что нужно для роста
                </h2>
                <p style={{ fontSize: 17, color: 'var(--lfg2)', maxWidth: 480, margin: '12px auto 0', lineHeight: 1.5 }}>
                  От первой записи до масштабирования бизнеса
                </p>
              </div>
            </Reveal>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
              gap: 16,
            }}>
              {features.map((f, i) => (
                <Reveal key={f.title} delay={i * 60}>
                  <FeatureCard icon={f.icon} title={f.title} desc={f.desc} />
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* ─── HOW IT WORKS ─── */}
        <section style={{ background: 'var(--lbg2)', padding: 'clamp(80px,12vw,120px) 0', transition: 'background .4s' }}>
          <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 clamp(24px,5vw,64px)' }}>
            <Reveal>
              <div style={{ textAlign: 'center', marginBottom: 'clamp(40px,5vw,64px)' }}>
                <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--lviolet)', marginBottom: 10 }}>
                  Как начать
                </div>
                <h2 style={{ fontSize: 'clamp(32px,4.5vw,48px)', fontWeight: 800, letterSpacing: '-.035em', lineHeight: 1.06 }}>
                  Три шага до результата
                </h2>
              </div>
            </Reveal>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 24 }}>
              {steps.map((step, i) => (
                <Reveal key={step.n} delay={i * 100}>
                  <StepCard step={step} />
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* ─── PRICING ─── */}
        <section id="pricing" style={{ padding: 'clamp(80px,12vw,120px) 0' }}>
          <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 clamp(24px,5vw,64px)' }}>
            <Reveal>
              <div style={{ textAlign: 'center', marginBottom: 'clamp(40px,5vw,64px)' }}>
                <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--lviolet)', marginBottom: 10 }}>
                  Тарифы
                </div>
                <h2 style={{ fontSize: 'clamp(32px,4.5vw,48px)', fontWeight: 800, letterSpacing: '-.035em', lineHeight: 1.06 }}>
                  Простые и честные цены
                </h2>
                <p style={{ fontSize: 17, color: 'var(--lfg2)', maxWidth: 440, margin: '12px auto 0', lineHeight: 1.5 }}>
                  Для клиентов — бесплатно. Для профессионалов — от 299 ₴/мес.
                </p>
              </div>
            </Reveal>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
              gap: 16, maxWidth: 960, margin: '0 auto',
            }}>
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
        <section style={{ padding: 'clamp(80px,12vw,140px) 0', textAlign: 'center', position: 'relative', overflow: 'hidden' }}>
          <div style={{
            position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
            width: 600, height: 600,
            background: 'radial-gradient(circle, var(--lviolet-l), transparent 60%)',
            pointerEvents: 'none',
          }} />
          <Reveal>
            <div style={{ position: 'relative', maxWidth: 600, margin: '0 auto', padding: '0 24px' }}>
              <h2 style={{ fontSize: 'clamp(36px,5.5vw,56px)', fontWeight: 800, letterSpacing: '-.04em', lineHeight: 1.04 }}>
                Готовы начать?
              </h2>
              <p style={{ fontSize: 17, color: 'var(--lfg2)', maxWidth: 400, margin: '16px auto 0', lineHeight: 1.5 }}>
                Присоединяйтесь к 130&nbsp;000+ специалистов. Бесплатно. Без карты.
              </p>
              <div style={{ display: 'flex', gap: 12, justifyContent: 'center', marginTop: 28 }}>
                <Link href="/register" style={{
                  padding: '16px 36px', borderRadius: 99,
                  background: 'var(--lviolet)', color: '#fff',
                  fontSize: 17, fontWeight: 600, transition: 'all .3s',
                  boxShadow: '0 4px 24px rgba(13,148,136,.3)',
                }}>
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

/* ═══ Step card (separate to keep hover state isolated per card) ═══ */
function StepCard({ step }: { step: { n: string; t: string; d: string } }) {
  const [hov, setHov] = useState(false);
  return (
    <div
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        background: 'var(--lcard)', borderRadius: 16,
        padding: 'clamp(28px,3vw,40px)', border: '1px solid var(--lcb)',
        transition: 'transform .3s, box-shadow .3s, background .4s, border-color .4s',
        transform: hov ? 'translateY(-4px)' : 'none',
        boxShadow: hov ? '0 12px 40px rgba(0,0,0,.06)' : 'none',
      }}
    >
      <div style={{
        width: 48, height: 48, borderRadius: 12,
        background: 'var(--lviolet-l)',
        display: 'grid', placeItems: 'center',
        marginBottom: 20,
      }}>
        <span style={{ fontSize: 18, fontWeight: 800, color: 'var(--lviolet)' }}>{step.n}</span>
      </div>
      <h3 style={{ fontSize: 20, fontWeight: 700, marginBottom: 8, letterSpacing: '-.01em' }}>{step.t}</h3>
      <p style={{ fontSize: 14, color: 'var(--lfg2)', lineHeight: 1.55, margin: 0 }}>{step.d}</p>
    </div>
  );
}
