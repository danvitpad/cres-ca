# FRONTEND.md — единственный канонический документ по фронтенду

> **Читай это первым** перед любой UI-задачей. Всё, что раньше было разбросано по `rules.md`, `patterns.md`, `ui-libraries.md`, `design-md/INDEX.md`, `CLAUDE.md` §Triggers и шести секциям `toolbox/CLAUDE.md` — собрано здесь. Гранулярные файлы остаются как справочники, но **единая точка входа — этот файл**.
>
> **Base skill:** `frontend-design@claude-plugins-official` (design thinking, aesthetic direction, typography, anti-AI-slop). Этот документ — проектная надстройка над ним.

---

## 0. Порядок работы над любой UI-задачей

1. **Определи поверхность** (dashboard / client feed / marketing / forms / command palette / chat).
2. **Открой brand reference** из `.knowledge/design-md/INDEX.md` → возьми палитру, типографику, spacing.
3. **Перечитай §1 (Triggers)** — критичные правила, за которые откатывается PR.
4. **Выбери паттерн** из §6 (page / client component / API route / feature-gated).
5. **Добавь premium-слой** из §5 (framer-motion, glassmorphism, shimmer, haptics).
6. **Не выдумывай styling** — всё через design-tokens из brand reference.
7. **Клонируем 1:1?** → §7 pixel-perfect workflow, никаких «approximate».

---

## 1. Критические triggers (hard rules)

**Каждое нарушение = откат.** Эти правила не обсуждаются.

1. **`@/` imports only** — никогда `../../..`.
2. **YAML header в каждом новом component/page/route:**
   ```tsx
   /** --- YAML
    * name: ComponentName
    * description: What this component does in one sentence
    * created: YYYY-MM-DD
    * updated: YYYY-MM-DD
    * --- */
   ```
3. **Supabase: два клиента, никогда не мешать.**
   - Browser: `import { createClient } from '@/lib/supabase/client'` → `createClient()`
   - Server (Server Components, API routes, middleware): `import { createClient } from '@/lib/supabase/server'` → `await createClient()` (ВАЖНО: `await`!)
4. **next-intl везде** — никаких hardcoded user-visible строк. Любая строка в UI → `t('key')` через `useTranslations()` (client) / `getTranslations()` (server).
5. **shadcn v4 / base-ui — НЕ использовать `asChild`.** Это prop не существует.
   - Для ссылок: `<Link className={cn(buttonVariants({ variant: 'outline' }))} />`
   - Для polymorphic rendering: `<Button render={<Link />}>`
6. **DESIGN.md reference** перед любой UI-задачей (см. §2).
7. **Logged-in browser work** — CLI first (`supabase`/`vercel`/`gh` + MCP), потом `mcp__claude-in-chrome__*` (реальный Chrome пользователя). **Никогда** не открывать `mcp__plugin_playwright_playwright__browser_navigate` на админские URL — там headless-гость, потребует логина, задача встанет.
8. **Subscription gating** — каждая фича с тир-лимитом обязана проверять подписку (см. §6.4).
9. **File naming:** `kebab-case.tsx` для файлов, `PascalCase` для компонентов в коде. Весь код — English; весь UI — через i18n.
10. **НЕ трогать `src/components/ui/`** — auto-generated shadcn. НЕ модифицировать `globals.css` кроме смены темы.

---

## 2. DESIGN.md library — выбор brand reference

Перед любой UI-задачей открой `.knowledge/design-md/INDEX.md`, подбери brand:

| Поверхность | Primary | Secondary |
|---|---|---|
| **Dashboard (master/salon)** | `linear.app` | `notion` |
| **Mini App / client feed** | `pinterest` | `spotify` |
| **Marketing / landing** | `stripe` | `airbnb` |
| **Forms & settings** | `supabase` | `linear.app` |
| **Command palette / focused** | `raycast` | `cursor` |
| **Chat / AI surfaces** | `claude` | — |

**Правило:** не смешивай две системы внутри одного экрана. Взял `linear.app` — держи его spacing/type/colors до конца страницы.

Обновить / добавить бренд:
```bash
npx -y getdesign@latest add <brand>
mv DESIGN.md .knowledge/design-md/<brand>/DESIGN.md
```

---

## 3. Design thinking (из base skill `frontend-design`)

Перед кодом — коммит к **bold aesthetic direction**:
- **Purpose:** что решает этот интерфейс, кто пользователь?
- **Tone:** выбери один экстрим — brutally minimal / maximalist chaos / retro-futuristic / luxury refined / editorial / brutalist / playful / organic. Не «нейтральный AI-slop».
- **Constraints:** framework, performance, a11y.
- **Differentiation:** что сделает это **незабываемым**?

**Typography:** избегай Arial/Inter по умолчанию. Пары: distinctive display font + refined body font. Реальный пример для CRES-CA — проверяй, что tokens в brand DESIGN.md уже заданы.

**Intentionality > intensity.** И minimalism, и maximalism работают — главное точность исполнения.

---

## 4. Architecture patterns — что мы используем

- **Next.js 16 App Router** (breaking changes от тренинговых данных — читать `node_modules/next/dist/docs/` перед нестандартным API).
- **React 19** — новый hooks API, Server Components по умолчанию.
- **Tailwind CSS 4** + shadcn v4 (base-ui).
- **framer-motion / motion** — анимации.
- **next-intl v4** — i18n.
- **Supabase** — DB + Auth + RLS + Storage + RPC.
- **lucide-react** — иконки.
- **next-themes** — dark/light toggle.

---

## 4.1. Единые дизайн-токены для dashboard (ОБЯЗАТЕЛЬНО)

**Проблема:** страницы писались с разными цветами, шрифтами, подходами. Три системы на одном разделе = хаос.

**Решение:** `src/lib/dashboard-theme.ts` — **единственный источник правды** для всех `(dashboard)/**` страниц.

### Что запрещено на dashboard-страницах:

1. **НЕ создавать локальные `LIGHT`/`DARK` объекты** в файле страницы. Импортируй из `@/lib/dashboard-theme`.
2. **НЕ использовать Tailwind `className`** для page-level стилей. Inline styles + токены из theme.
3. **НЕ использовать `Roobert PRO`** — шрифт: `FONT` из `dashboard-theme.ts` (Inter Variable).
4. **НЕ писать `UAH`** — всегда `CURRENCY` (`₴`) из `dashboard-theme.ts`.
5. **НЕ выдумывать цвета** (`#6950f3`, `#8b7cf6` и т.д.) — всё через `C.accent`, `C.success`, `C.danger`.

### Как правильно:

```tsx
import { usePageTheme, FONT, FONT_FEATURES, CURRENCY, pageContainer, cardStyle } from '@/lib/dashboard-theme';

export default function SomePage() {
  const { C, isDark } = usePageTheme();

  return (
    <div style={{ ...pageContainer, color: C.text }}>
      <div style={cardStyle(C)}>
        <span style={{ color: C.accent }}>1,500 {CURRENCY}</span>
      </div>
    </div>
  );
}
```

### Токены:

| Назначение | Light | Dark | Переменная |
|---|---|---|---|
| Фон страницы | `#f7f8f8` | `#0f1011` | `C.bg` |
| Карточка/Surface | `#ffffff` | `#191a1b` | `C.surface` |
| Текст основной | `#0f1011` | `#f7f8f8` | `C.text` |
| Текст вторичный | `#5c5f66` | `#d0d6e0` | `C.textSecondary` |
| Текст третичный | `#8a8f98` | `#62666d` | `C.textTertiary` |
| Акцент (Linear indigo) | `#5e6ad2` | `#7170ff` | `C.accent` |
| Успех | `#10b981` | `#34d399` | `C.success` |
| Опасность | `#ef4444` | `#ef4444` | `C.danger` |
| Граница | `rgba(0,0,0,0.06)` | `rgba(255,255,255,0.05)` | `C.border` |

Шрифт: `Inter Variable` с OpenType features `"cv01", "ss03"`. Weight: **510** (Linear signature weight) для emphasis, **400** для body.

---

## 5. Premium feel — обязательные слои

Продукт позиционируется как premium (конкуренты — Linear, Raycast, Instagram). Каждый компонент получает:

- **framer-motion transitions** на mount/update/exit (как минимум `initial + animate + transition`).
- **Glassmorphism overlays:** `bg-white/5 backdrop-blur-xl` поверх градиентного фона.
- **Gradient rings** на аватарах (stories-style): `from-amber-400 via-rose-500 to-fuchsia-500`.
- **Shimmer skeletons** вместо статических `bg-gray-200` прямоугольников.
- **Haptic feedback** в Telegram Mini App: `haptic('light' | 'selection' | 'success')` на каждое tap-действие.
- **`active:scale-[0.98]`** на все кнопки — живое касание.
- **`prefers-reduced-motion: reduce`** — обязательный респект.
- Никаких статичных gray boxes — всё анимируется, дышит, отвечает на касание.

**Anti-pattern:** «cheap templates thrown together». Пользователь откатывает такое. Reference-библиотеки: 21st.dev snippets + DESIGN.md палитры из §2.

---

## 6. Копипаст-шаблоны

### 6.1 Page (Server Component)
```tsx
/** --- YAML
 * name: PageName
 * description: What this page does
 * created: 2026-04-15
 * updated: 2026-04-15
 * --- */

import { useTranslations } from 'next-intl';

export default function PageName() {
  const t = useTranslations('section');
  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">{t('title')}</h2>
    </div>
  );
}
```

### 6.2 Client component с data fetching
```tsx
/** --- YAML
 * name: ComponentName
 * description: What this component does
 * --- */

'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

export function ComponentName() {
  const [data, setData] = useState<Type[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('table_name')
        .select('*')
        .order('created_at', { ascending: false });
      if (data) setData(data);
      setIsLoading(false);
    }
    load();
  }, []);

  if (isLoading) return <Skeleton className="h-32" />;
  return <div>{/* render data */}</div>;
}
```

### 6.3 API route (с auth check)
```tsx
/** --- YAML
 * name: API Route Name
 * description: What this endpoint does
 * --- */

import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  // ... logic ...
  return NextResponse.json({ success: true });
}
```

### 6.4 Feature-gated component (subscription tier)
```tsx
import { useSubscription } from '@/hooks/use-subscription';
import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';

function GatedFeature() {
  const { canUse } = useSubscription();

  if (!canUse('ai_features')) {
    return (
      <div className="rounded-lg border-2 border-dashed p-8 text-center text-muted-foreground">
        <p>This feature requires Pro plan</p>
        <Link href="/settings" className={cn(buttonVariants({ variant: 'outline' }), 'mt-4')}>
          Upgrade
        </Link>
      </div>
    );
  }

  return <ActualContent />;
}

// Server-side аналог (API route):
import { hasFeature } from '@/types';
if (!hasFeature(userTier, 'ai_features')) {
  return Response.json({ error: 'Upgrade required' }, { status: 403 });
}
```

---

## 7. Pixel-perfect cloning workflow

Когда задача — «повторить 1:1 существующий UI» (типа Fresha, Linear, Notion):

1. **Инструмент:** Playwright MCP → `browser_evaluate` с JS, извлекающим `getComputedStyle()` каждого целевого элемента. Приоритет выше, чем Pluck / скриншот-в-код AI — computed даёт реальные значения, не authored CSS.
2. **Что extract-им:** height, padding, borderRadius, border width, border color, background, font-size, font-weight, line-height, gap, margin — для каждого узла.
3. **Как применяем:** inline-стилями с hardcoded числами, **не** Tailwind utility-ами (они могут пересчитаться). Константы собираем в объекты `T`, `H`, `C` наверху файла.
4. **Правило невмешательства:** копируй EXACTLY, даже если выглядит «неправильно». Никаких своих дизайн-мнений. Не прятать / не удалять элементы без явного разрешения — restyle, не hide.
5. **Проверка:** скриншот diff бок-о-бок до фразы «done». Отличается — откат и замер снова.
6. **Рефакторинг в Tailwind компоненты — только после подтверждения 1:1.**

Cheat-sheet: `D:/toolbox/notes/cloning-tools.md`.

**Anti-pattern:** «спрятал header вместо restyle под Fresha» — откат.

---

## 8. UI libraries — что поставлено и как юзать

### 8.1 Installed (не ставь заново)
- `framer-motion` / `motion` — animation engine (spring, gestures, layout, AnimatePresence)
- `shadcn` (base-ui) — primitives (Button, Card, Dialog, Input, ...)
- `lucide-react` — иконки
- `next-themes` — dark/light

### 8.2 21st.dev snippets (107 файлов в `references/ui-snippets-21st/`)
Reference material, не импорт. Адаптируй к design tokens. Ключевые для CRES-CA:

| Snippet | Используется для |
|---|---|
| `Аватар с рамкой.txt` | Top masters story circles (gradient ring + status dot) |
| `Слайдер сравнения До-После.txt` | Before/After в клиентской карточке |
| `Стеклянные метрики.txt` | Finance dashboard (glassmorphism + framer-motion) |
| `Слайдер карточек.txt` | Horizontal scroll master/service cards |
| `Карточка клиента.txt` | CRM клиентская карточка |
| `Эмодзи-рейтинг.txt` | Post-visit rating 1-5 |
| `Календарь.txt` | Date picker base |
| `Прогресс-бар.txt` | Revenue goal, package visits |
| `Реферальная карточка.txt` | Referral link sharing |
| `Карточка продукта.txt` | Shop storefront |
| `Стеклянная карточка оплаты.txt` | Payment/tip confirmation |
| `Выдвижная панель.txt` | Mobile bottom sheet |
| `Виджет статистики с графиком.txt` | Finance charts |
| `Раскрывающийся поиск.txt` | Master search bar (expandable) |
| `Выпадающее меню профиля.txt` | Profile dropdown |
| `Таблица расширенная.txt` | Clients/appointments/inventory list |
| `Фон Аврора.txt` | Landing hero background |
| `Бенто-сетка.txt` | Dashboard bento grid |
| `Кнопка поделиться.txt` | Share master profile / referral |
| `Анимированный переключатель темы.txt` | Dark/light toggle |

### 8.3 External component libraries (ставить только при необходимости)

| Library | Для чего | Источник |
|---|---|---|
| **Aceternity UI** | Floating navbar, sidebar, 3D cards, compare slider, timeline, spotlight, bento grid, infinite cards | https://ui.aceternity.com — copy-paste TSX, no npm |
| **Magic UI** | Animated counters, shimmer, marquee, orbit, border beam, confetti | `npx magicui-cli add [component]` или https://magicui.design |

**Ключевые Aceternity компоненты для CRES-CA:**
Floating Navbar (client app — hide on scroll), Sidebar (master dashboard), Compare (before/after), Timeline (appointment history), Bento Grid (dashboard overview), Focus Cards (master selection), Infinite Moving Cards (landing testimonials), Animated Modal (booking/payment), Apple Cards Carousel (services), Floating Dock (quick actions), 3D Card Effect (master profile hover), Spotlight (featured masters), Aurora Background (landing hero), Sparkles (confetti on success).

### 8.4 Rules for external components
1. Копируй только то, что реально используется. Никаких библиотек «на всякий».
2. Все копии адаптируются к design tokens проекта (colors, radius, spacing).
3. Все внешние компоненты обязаны поддерживать dark mode.
4. Все анимации обязаны уважать `prefers-reduced-motion: reduce`.
5. Тест на mobile (320px) — если ломается, упрощай.

---

## 9. Sector agents — кто работает с какими файлами

| Sector | Files | Invoke | Protocol |
|---|---|---|---|
| **Client** | `(client)/**` | `/client-agent` | `.agents/personas/client-agent/SECTOR.md` |
| **Master (solo)** | `(dashboard)/**` solo features | `/master-agent` | `.agents/personas/master-agent/SECTOR.md` |
| **Salon / team** | `(dashboard)/**` team features | `/salon-agent` | `.agents/personas/salon-agent/SECTOR.md` |

Shared dashboard компоненты → выбирай персону, которой это больше выгодно. Если обеим → вызывай последовательно.

---

## 10. Don't list (concise)

1. Не ставь новые пакеты, не проверив существующие.
2. Не используй `asChild` на shadcn — `buttonVariants()` или `render` prop.
3. Не хардкодь UI-тексты — только `t()`.
4. Не мешай browser и server Supabase клиенты.
5. Не пропускай subscription checks на tier-limited фичах.
6. Не создавай файлы вне `src/` (кроме migrations и public).
7. Не трогай `globals.css` кроме смены темы.
8. Не модифицируй `src/components/ui/` — auto-generated.
9. Не используй relative imports — только `@/`.
10. Не коммить `.env.local` и секреты.
11. Не плоди локальные frontend-скиллы — этот файл и есть единственный.
12. Не открывай headless Playwright на админские URL (Supabase/Vercel/GitHub).

---

## Ссылки на справочники (детали)

Этот файл — единая точка входа. Если нужны детали:

- `.knowledge/tech-stack.md` — версии и Next.js 16 quirks
- `.knowledge/database.md` — схема БД, RLS, миграции
- `.knowledge/translations.md` — ключи i18n
- `.knowledge/design-md/<brand>/DESIGN.md` — палитры
- `.knowledge/structure.md` — folder layout
- `D:/toolbox/CLAUDE.md` — cross-project правила
- `D:/toolbox/notes/cloning-tools.md` — pixel-perfect cheat-sheet

---

**Обновлено:** 2026-04-15 (B4 consolidation — all scattered frontend rules merged here).
