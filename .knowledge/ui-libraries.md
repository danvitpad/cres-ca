# UI Libraries Reference

## Already installed
- `framer-motion` / `motion` — animation engine (spring physics, gestures, layout animations, AnimatePresence)
- `shadcn` (base-ui) — primitive components (Button, Card, Dialog, Input, etc.)
- `lucide-react` — icons
- `next-themes` — dark/light theme

## Ready-made UI snippets (107 files)
Location: `D:/Claude.cres-ca/references/ui-snippets-21st/` (reference from 21st.dev, `.txt` files, Russian names).
Use as building blocks — adapt to design tokens, don't copy blindly.

**Key snippets for CRES-CA:**
| Snippet file | Use for |
|---|---|
| `Аватар с рамкой.txt` | Top masters story circles (gradient ring + status dot) |
| `Слайдер сравнения До-После.txt` | Before/After photo slider in client card |
| `Стеклянные метрики.txt` | Finance dashboard stat cards (glassmorphism + framer-motion) |
| `Слайдер карточек.txt` | Horizontal scrollable master cards / service cards |
| `Карточка клиента.txt` | Client card in master's CRM |
| `Эмодзи-рейтинг.txt` | Post-visit rating (emoji faces 1-5) |
| `Календарь.txt` | Calendar date picker base |
| `Прогресс-бар.txt` | Revenue goal, package visits remaining |
| `Реферальная карточка.txt` | Referral link sharing card |
| `Карточка продукта.txt` | Product storefront cards |
| `Стеклянная карточка оплаты.txt` | Payment/tip confirmation |
| `Выдвижная панель.txt` | Bottom sheet for mobile actions |
| `Виджет статистики с графиком.txt` | Finance charts |
| `Раскрывающийся поиск.txt` | Master search bar (expandable) |
| `Выпадающее меню профиля.txt` | Profile dropdown in dashboard header |
| `Таблица расширенная.txt` | Client list, appointment list, inventory table |
| `Фон Аврора.txt` | Landing page background effect |
| `Бенто-сетка.txt` | Dashboard overview (bento grid of stat cards) |
| `Кнопка поделиться.txt` | Share master profile / referral link |
| `Анимированный переключатель темы.txt` | Dark/light toggle |

## Additional libraries (install only when needed)

| Library | What for | How to get |
|---|---|---|
| Aceternity UI | Premium effects: floating navbar, sidebar, 3D cards, compare slider, timeline, spotlight, bento grid, infinite cards | Copy from https://ui.aceternity.com — no npm package, copy-paste TSX |
| Magic UI | Animated counters, shimmer, marquee, orbit animation, border beam, confetti | `npx magicui-cli add [component]` or copy from https://magicui.design |

## Key Aceternity components for our project
| Component | Use in CRES-CA |
|---|---|
| Floating Navbar | Client app — hide on scroll down, show on scroll up |
| Sidebar | Master dashboard — expandable, mobile-responsive |
| Compare | Before/After photo slider (matches our need exactly) |
| Timeline | Client appointment history, master activity log |
| Bento Grid | Dashboard overview — stat cards in asymmetric grid |
| Focus Cards | Master selection — blur non-focused cards |
| Infinite Moving Cards | Landing page testimonials carousel |
| Animated Modal | Booking confirmation, payment flow |
| Apple Cards Carousel | Service cards horizontal scroll |
| Carousel | Top masters horizontal scroll on client feed |
| Floating Dock | Master dashboard — quick actions dock |
| Tabs | Client card tabs (Info, History, Health, Files) |
| 3D Card Effect | Master profile card with hover depth |
| Spotlight | Featured/promoted masters highlight |
| Aurora Background | Landing page hero background |
| Sparkles | Confetti on booking confirmed, goal reached |

## Rules for external components
1. Only copy what we actually use — no full libraries "just in case"
2. Adapt all copied components to use our design tokens (colors, radius, spacing)
3. All external components MUST support dark mode
4. All animations MUST respect `prefers-reduced-motion: reduce`
5. Test on mobile (320px width) — if broken, simplify
