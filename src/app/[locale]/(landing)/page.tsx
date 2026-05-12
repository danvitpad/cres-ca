/** --- YAML
 * name: Landing Page v10
 * description: Open Design alignment — hero-split с tilted dashboard mockup,
 *              proof bar, niche chips, features grid, 4-step how-it-works,
 *              3-tier pricing, FAQ accordion, CTA. Spring анимации,
 *              cubic-bezier(.16,1,.3,1) ease-out по всему лендингу.
 * created: 2026-04-18
 * updated: 2026-05-11
 * --- */

'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { useTheme } from 'next-themes';
import { useLocale } from 'next-intl';
import {
  Calendar, User, Bot, Wallet, Bell, BarChart3, Plus,
  Scissors, Car, BookOpen, PawPrint, Dumbbell, Zap, HeartPulse, PenTool,
} from 'lucide-react';
import { LanguageSwitcher } from '@/components/shared/language-switcher';
import { ThemeSwitchCircular } from '@/components/ui/theme-switch-circular';

/* ═══ Reveal on scroll (spring ease-out) ═══ */
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
    <div
      ref={ref}
      style={{
        opacity: vis ? 1 : 0,
        transform: vis ? 'none' : 'translateY(24px)',
        transition: `opacity .7s cubic-bezier(.16,1,.3,1) ${delay}ms, transform .7s cubic-bezier(.16,1,.3,1) ${delay}ms`,
      }}
    >
      {children}
    </div>
  );
}

/* ═══ Dashboard mockup (tilted) ═══ */
function DashMockup() {
  return (
    <div className="dash-mockup" aria-hidden="true">
      <div className="dm-topbar">
        <span className="dm-dot" style={{ background: '#ff5f57' }} />
        <span className="dm-dot" style={{ background: '#ffbd2e' }} />
        <span className="dm-dot" style={{ background: '#28c840' }} />
        <span className="dm-bar" />
      </div>
      <div className="dm-body">
        <div className="dm-nav">
          <div className="dm-brand">CRES-CA</div>
          <div className="dm-navitem act">Сегодня</div>
          <div className="dm-navitem">Календарь</div>
          <div className="dm-navitem">Клиенты</div>
          <div className="dm-navitem">Услуги</div>
          <div className="dm-navitem">Финансы</div>
          <div className="dm-navitem">Маркетинг</div>
        </div>
        <div className="dm-content">
          <div className="dm-kpi-row">
            <div className="dm-kpi">
              <div className="dm-kpi-label">Доход</div>
              <div className="dm-kpi-val">4 800 ₴</div>
              <div className="dm-kpi-delta">+12%</div>
            </div>
            <div className="dm-kpi">
              <div className="dm-kpi-label">Записей</div>
              <div className="dm-kpi-val">8</div>
              <div className="dm-kpi-delta" style={{ color: 'var(--color-accent)' }}>сегодня</div>
            </div>
            <div className="dm-kpi">
              <div className="dm-kpi-label">Клиенты</div>
              <div className="dm-kpi-val">142</div>
              <div className="dm-kpi-delta">+3 за неделю</div>
            </div>
          </div>
          <div className="dm-grid">
            <div className="dm-schedule">
              <div className="dm-sched-title">Расписание</div>
              <div className="dm-apt hi">
                <span className="dm-apt-time">09:00</span>
                <span>
                  <span className="dm-apt-name">Олена М.</span><br />
                  <span className="dm-apt-svc">Стрижка · 60 мин</span>
                </span>
              </div>
              <div className="dm-apt">
                <span className="dm-apt-time">11:00</span>
                <span>
                  <span className="dm-apt-name">Богдан К.</span><br />
                  <span className="dm-apt-svc">Окрашивание · 90 мин</span>
                </span>
              </div>
              <div className="dm-apt">
                <span className="dm-apt-time">14:00</span>
                <span>
                  <span className="dm-apt-name">София П.</span><br />
                  <span className="dm-apt-svc">Маникюр · 60 мин</span>
                </span>
              </div>
              <div className="dm-apt">
                <span className="dm-apt-time">17:00</span>
                <span>
                  <span className="dm-apt-name">Алексей З.</span><br />
                  <span className="dm-apt-svc">Барбер · 30 мин</span>
                </span>
              </div>
            </div>
            <div className="dm-side">
              <div className="dm-ai">
                <div className="dm-ai-label">AI-подсказка</div>
                <div className="dm-ai-txt">Богдан не был 2 месяца — напомни</div>
              </div>
              <div>
                <div style={{
                  fontSize: 9, fontWeight: 700, letterSpacing: '.06em',
                  textTransform: 'uppercase', color: 'var(--lfg3)', marginBottom: 4,
                }}>Быстро</div>
                <div className="dm-quick">
                  <div className="dm-quick-btn">+ Запись</div>
                  <div className="dm-quick-btn">+ Клиент</div>
                  <div className="dm-quick-btn">Доход</div>
                  <div className="dm-quick-btn">Расход</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ═══ Feature card ═══ */
function FeatureCard({ icon: Icon, title, desc }: { icon: React.ComponentType<{ size?: number; strokeWidth?: number }>; title: string; desc: string }) {
  return (
    <div className="feature-card">
      <div className="feature-icon">
        <Icon size={24} strokeWidth={1.75} />
      </div>
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

/* ═══ FAQ item (controlled accordion) ═══ */
function FaqItem({ q, a, open, onToggle }: { q: string; a: string; open: boolean; onToggle: () => void }) {
  return (
    <div className={`faq-item${open ? ' open' : ''}`}>
      <button type="button" className="faq-q" onClick={onToggle} aria-expanded={open}>
        <span>{q}</span>
        <span className="faq-icon" aria-hidden="true">
          <Plus size={18} strokeWidth={2} />
        </span>
      </button>
      <div className="faq-a-wrap">
        <div className="faq-a">
          <div className="faq-a-inner">{a}</div>
        </div>
      </div>
    </div>
  );
}

/* ═══ Main page ═══ */
export default function LandingPage() {
  const locale = useLocale();
  useTheme(); // keep hook active for theme awareness
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  const proofs = [
    { v: '1 200+', l: 'мастеров' },
    { v: '18 000', l: 'записей в месяц' },
    { v: '4.9', l: 'средний рейтинг' },
    { v: '9 ниш', l: 'поддерживаем' },
  ];

  const niches = [
    { icon: Scissors,   label: 'Красота и стиль' },
    { icon: Car,        label: 'Авто-сервис' },
    { icon: BookOpen,   label: 'Репетиторы' },
    { icon: PawPrint,   label: 'Грумеры' },
    { icon: Dumbbell,   label: 'Фитнес' },
    { icon: Zap,        label: 'Электрики' },
    { icon: HeartPulse, label: 'Медицина' },
    { icon: PenTool,    label: 'Тату' },
  ];

  const features = [
    { icon: Calendar,  title: 'Клиент сам записывается — даже пока вы спите',
      desc: 'Дайте ссылку или подключите бот. Конфликты и задвоения исключены — система держит расписание сама.' },
    { icon: Bell,      title: 'Никто не забудет к вам прийти',
      desc: 'Напоминание за 24 часа и за 2 часа — в Telegram. Пропусков становится в разы меньше уже в первый месяц.' },
    { icon: User,      title: 'Помните каждого клиента по имени',
      desc: 'История визитов, предпочтения, заметки, бонусы — в одной карточке. Возвращайте клиентов точечными касаниями.' },
    { icon: Wallet,    title: 'Финансы в одной таблице — без Excel и бухгалтера',
      desc: 'Доход, расходы, маржа по услугам, склад. Понятные отчёты которые сразу покажут что приносит деньги.' },
    { icon: Bot,       title: 'Запись голосом за 7 секунд',
      desc: 'Скажите боту в Telegram «запиши Машу на маникюр в пятницу в 14» — он создаст запись, проверит конфликты, пришлёт подтверждение клиенту.' },
    { icon: BarChart3, title: 'Реферальная сеть и рассылки которые возвращают «спящих»',
      desc: 'Промокоды, бонусная программа, авто-возврат клиентов через 60+ дней без визита. Маркетинг работает сам.' },
  ];

  const steps = [
    { n: '01', t: 'Зарегистрируйтесь за 2 минуты',
      d: 'Без карты. Без обучения. Без переезда данных из других CRM — поможем перенести бесплатно.' },
    { n: '02', t: 'Скопируйте ссылку — отправьте клиентам',
      d: 'У вас появится своя страница cres-ca.com/m/вашназвание. Скопировали → отправили в WhatsApp/Instagram → клиенты пишут сами.' },
    { n: '03', t: 'Получайте записи в Telegram-боте',
      d: 'Бот пишет когда клиент записался, когда подтвердил, когда напомнил себе — без вашего участия. Вы занимаетесь своим делом.' },
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

  const FAQ = [
    {
      q: 'Можно без Telegram?',
      a: 'Можно. Клиенты записываются на вашу публичную страницу cres-ca.com/m/handle прямо в браузере — без Telegram. Но бот значительно упрощает процесс и для вас, и для клиента.',
    },
    {
      q: 'Подходит ли для моей ниши?',
      a: 'CRES-CA работает для любого сервисного бизнеса: красота, здоровье, ремонт, репетиторство, фитнес, ветеринария, тату, груминг и другие. Каталог услуг и шаблоны сообщений настраиваются под вашу специфику.',
    },
    {
      q: 'Как перенести клиентов из другой CRM?',
      a: 'Поддерживаем импорт из Excel/CSV. Также помогаем напрямую перенести данные из популярных CRM — напишите в поддержку, поможем бесплатно.',
    },
    {
      q: 'Где хранятся данные?',
      a: 'Серверы в Евросоюзе, соответствие GDPR. Мы не продаём и не передаём ваши данные третьим лицам. Резервные копии — ежедневно.',
    },
    {
      q: 'Что после 14 дней пробного периода?',
      a: 'Если не подойдёт — просто не продлеваете. Без привязки карты, без авто-списаний. Если подойдёт — выбираете удобный тариф в один клик.',
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
              <a href="#faq"      className="nav-link">Вопросы</a>
              <LanguageSwitcher />
              <ThemeSwitchCircular size="sm" aria-label="Переключить тему" />
              <Link href="/login"    className="nav-link" style={{ marginLeft: 4 }}>Войти</Link>
              <Link href="/register" className="btn-pill-primary btn-pill-nav" style={{ marginLeft: 4 }}>
                Начать
              </Link>
            </div>
          </div>
        </nav>

        {/* ─── HERO (split) ─── */}
        <section className="landing-section section-hero-split">
          <div className="hero-glow" />
          <div className="landing-container" style={{ position: 'relative' }}>
            <div className="hero-split">
              <div className="hero-text">
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
                  <div className="hero-ctas-row">
                    <Link href="/register" className="btn-pill-primary">Начать — 14 дней бесплатно</Link>
                    <a    href="#features"  className="btn-pill-ghost">Смотреть возможности</a>
                  </div>
                </Reveal>
                <Reveal delay={300}>
                  <p className="micro-note">Без привязки карты · Отмена в один клик · Поддержка на родном языке</p>
                </Reveal>
              </div>
              <Reveal delay={200}>
                <DashMockup />
              </Reveal>
            </div>
          </div>
        </section>

        {/* ─── PROOF BAR ─── */}
        <section className="landing-section" style={{ padding: '0', position: 'relative' }}>
          <div className="landing-container">
            <div className="proof-bar">
              {proofs.map((p, i) => (
                <Reveal key={p.l} delay={i * 60}>
                  <div className="proof-item">
                    <div className="proof-val">{p.v}</div>
                    <div className="proof-label">{p.l}</div>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* ─── ДЛЯ КОГО (niches) ─── */}
        <section className="landing-section">
          <div className="landing-container">
            <Reveal>
              <div className="section-header">
                <span className="section-eyebrow">Для кого</span>
                <h2 className="heading-section-lg">Любая ниша. Один инструмент.</h2>
                <p className="section-lead">
                  Стрижёте, ремонтируете, лечите, учите — CRES-CA подстраивается под вашу работу.
                </p>
              </div>
            </Reveal>
            <Reveal delay={80}>
              <div className="niche-chips">
                {niches.map((n) => (
                  <span key={n.label} className="niche-chip">
                    <n.icon size={16} strokeWidth={1.75} />
                    {n.label}
                  </span>
                ))}
              </div>
            </Reveal>
          </div>
        </section>

        {/* ─── FEATURES ─── */}
        <section id="features" className="landing-section section-tinted">
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
        <section className="landing-section">
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
        <section id="pricing" className="landing-section section-tinted">
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

        {/* ─── FAQ ─── */}
        <section id="faq" className="landing-section">
          <div className="landing-container">
            <Reveal>
              <div className="section-header">
                <span className="section-eyebrow">Вопросы</span>
                <h2 className="heading-section-lg">Частые вопросы</h2>
              </div>
            </Reveal>
            <div className="faq-list">
              {FAQ.map((item, i) => (
                <Reveal key={item.q} delay={i * 50}>
                  <FaqItem
                    q={item.q}
                    a={item.a}
                    open={openFaq === i}
                    onToggle={() => setOpenFaq(openFaq === i ? null : i)}
                  />
                </Reveal>
              ))}
            </div>
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
