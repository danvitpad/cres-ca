# PROJECT-JOURNAL.md — ЖИВОЙ ЖУРНАЛ ПРОЕКТА CRES-CA

> **Это главный документ проекта.** Единая точка правды, по которой мы работаем из любой сессии Claude Code. Все остальные документы (roadmap фаз, CLIENT-WORK, MASTER-WORK, memory) — вспомогательные. Здесь — **вся карта сервиса + inbox от Данила + changelog**: что есть, что работает, что предстоит сделать.
>
> **Имя `PROJECT-JOURNAL.md` зарезервировано** под будущий визуальный canvas (граф страниц/кнопок/связей). Текстовый журнал и визуальная карта будут жить параллельно.
>
> **Расположение:** `D:/Claude.cres-ca/app/PROJECT-JOURNAL.md` (рядом с `CLAUDE.md`).
> **Язык:** русский, для владельца проекта.
> **Обновляется:** в конце каждой сессии, когда что-то закрыто / добавлено / обнаружено.

---

## 🧭 Как этим пользоваться

**Для Данила (владельца проекта):**
1. Открываешь этот файл — видишь, где мы сейчас.
2. Чтобы добавить новую задачу / заметку / идею — пишешь прямо в нужный раздел строкой с префиксом `📝 TODO:` (или `📝 BUG:`, `📝 IDEA:`, `📝 FIX:`). Пример:
   ```
   📝 TODO: на странице регистрации master — добавить выбор города из списка
   📝 BUG: wallet transfer показывает «not found» даже для валидного email
   ```
3. Следующая сессия Claude Code при `/read PROJECT-JOURNAL.md` автоматически подберёт все `📝`-строки, превратит каждую в чекбокс задачи и добавит в соответствующий блок. После выполнения — отметит `[x]` и **оставит** историю в changelog внизу.

**Для Claude Code (любая сессия):**
1. **Прочитать этот файл первым** после `CLAUDE.md`.
2. Собрать все `📝`-строки и предложить план действий по ним.
3. После изменений — обновить чекбоксы в этом файле и занести запись в changelog.
4. **Никогда не создавать параллельный roadmap-документ.** Все новые задачи идут сюда.

---

## 📋 Легенда

- `[x]` — сделано, задеплоено, работает
- `[~]` — в работе сейчас
- `[ ]` — в очереди, код отсутствует / неполный
- `[!]` — блокер (причина в скобках)
- `[?]` — требует верификации (код есть, но не проверено вживую)
- `📝 TODO:` / `📝 BUG:` / `📝 IDEA:` / `📝 FIX:` — **inbox от Данила**: эти строки следующая сессия Claude превратит в чекбоксы задач

---

## 📥 INBOX — заметки Данила (разбираются в начале каждой сессии)

> Сюда Данил пишет всё, что приходит в голову — Claude разбирает, превращает в задачи, и **очищает inbox**, чтобы следующая запись попадала в пустой лист.

*(пусто — добавляй `📝 TODO: …` / `📝 BUG:` / `📝 IDEA:` / `📝 FIX:` строки сюда)*

---

## 🎬 BLOCK C — CONTENT PIPELINE (AI-генерация видео/фото/постов)

> Материал пришёл от Данила как inbox 2026-04-14 (FORGE-агент + 8 ссылок + skool.com профиль). Тема: полноценный пайплайн генерации визуального контента для (а) маркетинга проекта, (б) контента внутри продукта (посты мастеров, before/after, stories).

### Задачи

- [ ] **C1. Product-content skill** — генерация контента **внутри** продукта: мастер снял фото/видео → жмёт «сгенерировать пост/stories» → получает готовый премиум-контент (обложка, подпись, crop, колоризация, before/after коллаж). Стек: Claude API + Vercel AI Gateway (fallback модели) + FFmpeg (локально). Интеграция: кнопка в `/telegram/m/home` и master dashboard. **Ждёт:** первых реальных мастеров с живым материалом.

- [ ] **C2. Marketing-content skill** — пайплайн для маркетинга самого CRES-CA: landing копирайтинг, scroll-stop анимации, YouTube shorts, соцсети. **Уже доступны готовые skills** в текущей среде: `3d-animation-creator` (scroll-controlled video sites), `image-generator` (3 prompts для scroll-stop), `website-intelligence` (competitive analysis + premium site build), `full-clone` (functional replica), `web-page-archiver` (offline copies). Первый deliverable: новый landing с scroll-stop hero через `3d-animation-creator`.

- [ ] **C3. FORGE agent port** — адаптировать FORGE-агент (ads creative pipeline via fal.ai nano-banana-2) из Vizznary-инбокса под CRES-CA. Это фоновой агент, не продуктовая фича: SCRAPER (конкурентные креативы) → LOOPER (winner refs) → FORGE (fal.ai генерация) → PUBLISHER (модерация + аплоад). Применение: мастер загружает референс → система генерит 4 варианта креатива для его постов. **Блокер:** нужен fal.ai API key + договорённость с мастерами про data policy.

- [ ] **C4. Research: AI content research from skool.com + guides** — полная ресёрч-задача: пройти `https://www.skool.com/@dan-p-6986?g=nextgenai` memberships, прочитать 2 Notion guides (Joey Mulcahy — Claude Code Product Visual Workflow + Claude Code For Brands 101), Mobile Editing Club PDF, разобрать 4 Instagram reels как референсы стиля. Выход: `.knowledge/content-research.md` с выдержками best practices. **Инструмент:** `mcp__claude-in-chrome__*` (пользователь уже залогинен в skool) + Firecrawl MCP для Notion. **Не курс по курсу — а дистиллят в 1 файл.**

### Референсы (источники, не удалять)

**Внешние гайды / курсы:**
- https://www.skool.com/@dan-p-6986?g=nextgenai — Skool профиль Данила (memberships: NextGen AI и другие AI-контент комьюнити)
- https://joeymulcahyguides.notion.site/The-Claude-Code-Product-Visual-Workflow-3262b10bd51680d6ba29e2072a5ba78e — Claude Code Product Visual Workflow (Joey Mulcahy)
- https://joeymulcahyguides.notion.site/Claude-Code-For-Brands-101-Guide-32d2b10bd51680d7b962eef06abde69f — Claude Code For Brands 101
- https://youmind.com/nano-banana-pro-prompts — nano-banana prompts библиотека
- Mobile Editing Club PDF — `https://assets.stanwith.me/live/msc/26131308/8qbjy/mobileeditingclubcreateugcads.pdf`
- Google Drive ref — `https://drive.google.com/file/d/18C9GxNx5xYMrGa3aW_CHUXzyVDNGupjn/view`

**Instagram референсы (стиль / формат):**
- https://www.instagram.com/reel/DWjsQhVk22z/
- https://www.instagram.com/reel/DWrWNtBDX66/
- https://www.instagram.com/p/DWwNA-ECMB3/
- https://www.instagram.com/p/DWD0TyTDKK9/

### FORGE agent — спецификация (для C3, сохранена целиком)

```yaml
name: FORGE
description: Generates ad creatives (images and videos) via fal.ai nano-banana-2 using briefs from SCRAPER and winner references from LOOPER. Outputs to /ads/pending/.
pipeline_step: 2
receives_from: [SCRAPER, LOOPER]
feeds_into: PUBLISHER
```

**Responsibilities:**
- Consume briefs from SCRAPER + winner refs from LOOPER
- Build generation prompts (copy hooks + visual refs + brand tone)
- Call fal.ai nano-banana-2 → image/video variants (default 4)
- Write outputs to `/ads/pending/` + metadata sidecars
- Tag each asset: `brief_id`, `hook_used`, `source_agent`, `variant_index`

**Behavior rules:**
- Always ≥2 variants per brief
- Prefer winner refs from LOOPER; fallback to SCRAPER brief
- Never push direct to Meta — only to `/ads/pending/`
- Retry once on fal.ai error, then skip
- Preserve hook text verbatim
- Video variants приоритетны для AWARENESS objective

**Outputs:**
```
/ads/pending/
  {brief_id}_{variant_index}.jpg  (or .mp4)
  {brief_id}_{variant_index}.meta.json  # {brief_id, hook_used, headline, format, created_at, fal_job_id, source_agent}
```

---

## 1️⃣ ПУБЛИЧНЫЕ СТРАНИЦЫ (landing + статические)

Расположение: `src/app/[locale]/(landing)/`

- [x] **Главная** `/` — hero с three.js, секции features / pricing / testimonials, language switcher (ru/en/ua)
- [x] **Terms** `/terms` — пользовательское соглашение
- [x] **Privacy** `/privacy` — политика конфиденциальности
- [x] **Contact** `/contact` — форма связи
- [x] **User flow** `/user-flow` — диаграмма сценариев использования (внутренняя)
- [x] **Leaderboard** `/leaderboard` — top masters, gamification
- [x] **Public master profile** `/m/[handle]` — публичная страница мастера по pretty-handle
- [x] **Invite** `/invite/[code]` — лендинг приглашения мастера (auto-follow после регистрации)

### Транзакционные публичные страницы (без locale)
- [x] **Confirm** `/confirm/[apt_id]` — клиент подтверждает запись по ссылке из уведомления
- [x] **Review** `/review/[apt_id]` — клиент оставляет отзыв после визита
- [x] **Invoice** `/invoice/[apt_id]` — счёт / чек для клиента
- [x] **Consent** `/consent/[token]` — подписание согласия (медицинские / эстетические услуги)

---

## 2️⃣ AUTH — регистрация, вход, сброс пароля

Расположение: `src/app/[locale]/(auth)/`

### Web
- [x] **Login** `/login` — email + password, routing по роли (client → `/feed`, master → `/dashboard`, salon → `/dashboard`)
- [x] **Register** `/register` — регистрация с выбором роли (client / master / salon)
- [?] **Password reset** — **код существует в Supabase Auth, но UI-страницы `/forgot-password` и `/reset-password` НЕТ** → см. раздел 🔮 «Что предстоит сделать»

### Telegram Mini App (альтернативный вход)
- [x] **Entry** `/telegram` — HMAC-валидация initData, routing на welcome/register/home в зависимости от статуса
- [x] **Welcome** `/telegram/welcome` — CTA «Создать аккаунт» + «У меня уже есть аккаунт»
- [x] **Register** `/telegram/register` — анкета (имя, отчество, фамилия, email, согласие)
- [x] **Link existing** — bottom sheet с email → 8-значный OTP → линковка существующего аккаунта к `telegram_id`
- [x] **Terms** `/telegram/terms` — согласие внутри Mini App
- [x] **Email OTP delivery** — Resend key в Vercel production, redeploy сделан, код обработки готов *(live-доставка проверяется на стороне пользователя)*

---

## 3️⃣ ONBOARDING — первые шаги после регистрации

Расположение: `src/app/[locale]/onboarding/`

- [x] **Account type** `/onboarding/account-type` — выбор: соло-мастер / салон / клиент
- [x] **Vertical** `/onboarding/vertical` — выбор индустрии (beauty / health / auto / pets / tattoo / …), грузит дефолты услуг
- [x] **Create business** `/onboarding/create-business` — название бизнеса, логотип, адрес, часовой пояс

---

## 4️⃣ КЛИЕНТ — WEB версия

Расположение: `src/app/[locale]/(client)/`

> **Статус:** Frozen после запуска Mini App. Web-клиент оставлен для совместимости / десктоп-сценариев. Основной клиентский опыт — в Telegram Mini App (раздел 5).

- [x] **Feed** `/feed` — лента постов мастеров, на которых подписан клиент
- [x] **Map** `/map` — карта с мастерами и салонами рядом
- [x] **Masters list** `/masters` — поиск/фильтры мастеров
- [x] **Master profile** `/masters/[id]` — карточка мастера + услуги + магазин + before/after
- [x] **Booking** `/book?master_id=…&service_id=…` — флоу записи
- [x] **My calendar** `/my-calendar` — календарь клиента со всеми записями
- [x] **History** `/history` + `/history/[id]` — история визитов, before/after фото, отзывы
- [x] **My masters** `/my-masters` — список follow'ов (legacy, уйдёт в follows)
- [x] **Notifications** `/notifications` — inbox
- [x] **Profile** `/profile` — карточка клиента
- [x] **Profile → Photos** `/profile/photos` — загруженные фото
- [x] **Profile → Documents** `/profile/documents` — документы (только мастер видит)
- [x] **Profile → Family** `/profile/family` — члены семьи (несовершеннолетние)
- [x] **Wallet** `/wallet` — баланс, перевод, цели накоплений, реферал
- [x] **Forms** `/forms` — анамнез / противопоказания / здоровье
- [x] **Account settings** `/account-settings` — настройки аккаунта

---

## 5️⃣ КЛИЕНТ — MOBILE (Telegram Mini App) ⭐ ОСНОВНОЙ ОПЫТ

Расположение: `src/app/telegram/(app)/`
**Дизайн:** Instagram-like, 5-tab bottom nav, dark theme, framer-motion, haptics.

- [x] **Home** `/telegram/home` — Stories row + next appointment strip + PostCard feed
  - Stories mixer: likes_7d×2 + rating×10 + recency + city bonus
  - Optimistic like toggle с rollback
  - Empty state: «Лента пуста → Подписаться на мастеров»
- [x] **Search → Map** `/telegram/search` — редирект на `/telegram/map`
- [x] **Map** `/telegram/map` — Leaflet карта, TG LocationManager → browser → IP → Kyiv fallback, маркеры мастеров + салонов, selected card
- [x] **Search detail** `/telegram/search/[id]` — карточка мастера из результатов поиска
- [x] **Salon detail** `/telegram/salon/[id]` — карточка салона
- [x] **User profile** `/telegram/u/[publicId]` — публичный профиль юзера
- [x] **Activity** `/telegram/activity` — список записей клиента
- [x] **Activity detail** `/telegram/activity/[id]` — cancel / reschedule / repeat / rate modals
- [x] **Notifications** `/telegram/notifications` — inbox, realtime badge, mark-all-read
- [x] **Profile** `/telegram/profile` — Instagram-style: аватар + CRES-ID под именем, followers/following, Edit/Share, avatar upload, posts grid, меню (сертификаты + настройки)
- [x] **Settings** `/telegram/settings` — sign out + legal links

**Block CA-CF Summary (CLIENT-WORK.md 37/37 ✓):**
- CA: Auth holes закрыты (Resend + link-existing)
- CB: Instagram restyle профиля (9/9)
- CC: 5-я иконка Notifications в bottom nav + realtime badge (3/3)
- CD: Home feed = посты подписок + stories + likes (9/9)
- CE: Аудит каждой кнопки (8/8)
- CF: Backlog закрыт — shop на master page, goals v2, wallet RPC, before/after appointment_id (4/4)

---

## 6️⃣ МАСТЕР — MOBILE (Telegram Mini App)

Расположение: `src/app/telegram/m/`
**Дизайн:** дашборд-style dark theme, быстрый доступ к календарю и клиентам прямо с телефона.

- [x] **Home** `/telegram/m/home` — KPI плашки, ближайшие записи, быстрые действия
- [x] **Calendar** `/telegram/m/calendar` — день + неделя, drag-drop, быстрое создание слота
- [x] **Slot new** `/telegram/m/slot/new` — создание нового слота / записи
- [x] **Voice booking** `/telegram/m/voice-book` — голосом: запись → транскрипция → парсинг → confirm
- [x] **Clients** `/telegram/m/clients` — список клиентов мастера
- [x] **Client detail** `/telegram/m/clients/[id]` — карточка: визиты, документы, allergies, blacklist
- [x] **Stats** `/telegram/m/stats` — KPI: revenue / appointments / top services
- [x] **Notifications** `/telegram/m/notifications` — мастерский inbox
- [x] **Profile** `/telegram/m/profile` — профиль мастера + posts grid + кнопка «+» для загрузки поста

---

## 7️⃣ МАСТЕР / САЛОН — WEB (Dashboard)

Расположение: `src/app/[locale]/(dashboard)/`
**Дизайн:** Linear/Raycast-like, dark sidebar, bento stat cards, command palette.
**Роутинг:** одна dashboard-структура для соло-мастера и салона; фичи, которые видны только салону (team, shifts, payrun, multi-location, equipment), скрыты через `useMaster().type === 'salon'`.

### 📊 Dashboard home
- [x] `/dashboard` — обзор, KPI, свежие события, stat cards

### 📅 Calendar
- [x] `/calendar` — day/week/3-day/month view, drag-drop, quick-sale drawer, Fresha-like UI

### 👥 Clients
- [x] `/clients` — список клиентов, поиск, фильтры
- [x] `/clients/[id]` — карточка клиента
- [x] `/clients/import` — импорт CSV / Google Contacts
- [x] `/clients/blacklist` — global blacklist (cancel history cross-master)
- [x] `/clients/cadence` — cadence analytics (регулярность визитов)
- [x] `/clients/loyalty` — программа лояльности
- [x] `/clients/segments` — сегменты для рассылок

### 💼 Services
- [x] `/services` — каталог услуг
- [x] `/services/memberships` — абонементы / пакеты
- [x] `/services/products` — товары на продажу

### 📦 Inventory
- [x] `/inventory` — склад
- [x] `/inventory/scan` — штрих-код сканер

### 💰 Finance
- [x] `/finance` — overview
- [x] `/finance/daily` — ежедневный кассовый отчёт
- [x] `/finance/appointments` — финансы по записям
- [x] `/finance/payments` — платежи
- [x] `/finance/expenses` — расходы
- [x] `/finance/cashflow` — cashflow
- [x] `/finance/profitability` — рентабельность
- [x] `/finance/reports` — отчёты
- [x] `/finance/tax-report` — налоги
- [x] `/finance/tips` — чаевые
- [x] `/finance/gift-cards` — подарочные сертификаты
- [x] `/finance/memberships` — доход от абонементов
- [x] `/finance/lost-revenue` — упущенная выручка
- [x] `/finance/split/[apt_id]` — сплит оплаты (несколько методов)

### 📢 Marketing
- [x] `/marketing` — overview
- [x] `/marketing/automation` — автоматизации (reminder, upsell, birthday)
- [x] `/marketing/campaigns` — кампании
- [x] `/marketing/deals` — акции / скидки
- [x] `/marketing/google` — Google My Business интеграция
- [x] `/marketing/guild` — гильдии мастеров (cross-promo)
- [x] `/marketing/links` — короткие ссылки + UTM
- [x] `/marketing/messages` — прямые рассылки
- [x] `/marketing/pricing` — динамическое ценообразование
- [x] `/marketing/products` — CRUD товаров магазина
- [x] `/marketing/profile` — настройки публичного профиля мастера
- [x] `/marketing/reviews` — модерация отзывов
- [x] `/marketing/social` — соцсети / автопост

### 🎨 Portfolio & content
- [x] `/portfolio` — портфолио мастера
- [x] `/stories` — stories / истории
- [x] `/before-after` — загрузка фото до/после

### 🎙 AI / voice
- [x] `/voice-notes` — голосовые заметки (OpenRouter транскрипция)
- [x] `/recommend` — AI-рекомендации услуг/товаров клиенту

### 📝 Consents
- [x] `/consents` — формы согласий / подписи

### ⏱ Queue
- [x] `/queue` — очередь (живая очередь без записи)

### 🔌 Add-ons / Network
- [x] `/addons` — marketplace платных аддонов
- [x] `/network` — сеть мастеров / референс

### ⚙ Settings
- [x] `/settings` — главные настройки
- [x] `/settings/billing` — подписка + оплата (LiqPay)
- [x] `/settings/equipment` — оборудование (салон)
- [x] `/settings/faq` — FAQ
- [x] `/settings/locations` — локации (мульти-локация)
- [x] `/settings/team` — команда (салон)
- [x] `/settings/team/payrun` — выплаты зарплат
- [x] `/settings/team/shifts` — смены
- [x] `/settings/team/timesheets` — табели
- [x] `/settings/time-off` — отпуска / выходные
- [x] `/settings/time-off/import-ics` — импорт ICS календаря

---

## 8️⃣ ИНФРАСТРУКТУРА

### API Routes (`src/app/api/`)
- [x] `/api/auth/*` — sign-in, sign-out
- [x] `/api/telegram/*` — webhook, register, email-otp, link-existing
- [x] `/api/telegram/webhook` — обработка команд бота
- [x] `/api/pair/issue` + `/api/pair/consume` — 6-значный pairing code *(orphan UI после удаления QR-таба в CB3)*
- [x] `/api/profile` — CRUD профиля
- [x] `/api/follow` + `/api/follow/list` — подписки
- [x] `/api/posts` + `/api/posts/like` — посты + лайки
- [x] `/api/feed` + `/api/feed/stories` — лента + сторис
- [x] `/api/notifications` — inbox CRUD
- [x] `/api/cron/*` — крон-задачи (reminders, burning-slots, birthday, cadence)
- [x] `/api/voice-booking/parse` — AI парсинг голосовых записей
- [x] `/api/webhook/liqpay` — обработка оплат

### Supabase
- [x] **DB schema:** 40+ таблиц (migrations 00001-00027), детали в `.knowledge/database.md`
- [x] **RLS policies** на каждой таблице
- [x] **RPC functions:** `wallet_transfer`, `posts_bump_author_count`, `post_likes_bump_count`, ещё ~15 штук
- [x] **Storage buckets:** `avatars`, `covers`, `posts`, `portfolio`, `before-after`, `documents`, `voice-notes`
- [x] **Edge functions:** нет (всё в API routes)

### Интеграции
- [x] **Telegram Bot API** — webhook + бот `cres_ca_bot`
- [x] **LiqPay** — оплата подписок и предоплат
- [x] **Resend** — транзакционные emails (OTP, reminders)
- [x] **OpenRouter** — AI (voice transcription, recommendations)
- [x] **Google Maps** — геокодинг + маршруты
- [x] **Leaflet + OSM** — карты в Mini App (бесплатные)
- [x] **next-intl** — 3 языка (ru/en/ua)

### DevOps
- [x] **Vercel** production deploy
- [x] **Supabase** managed DB
- [x] **Middleware** — locale, auth, role routing
- [x] **PWA** manifest + service worker
- [x] **SEO** sitemap.xml, robots.txt, OG images

---

## 🔮 ЧТО ПРЕДСТОИТ СДЕЛАТЬ

> Всё, что не является багом текущего функционала. Упорядочено по приоритету.

### HIGH — критично для запуска
- [x] **AUTH-1.** Password reset UI — flow уже inline на `/login` (step machine `forgot → reset-sent → reset-otp → new-password`). **Нашёл баг:** UI ждал 8-значный OTP, а Supabase `resetPasswordForEmail` шлёт 6-значный — flow был сломан. Fix: 6-slot `InputOTP`. Commit `a74608e`.
- [ ] **AUTH-2.** Live-верификация email OTP при регистрации (Resend key стоит, нужен реальный тест)
- [ ] **AUTH-3.** Live-верификация web `/login` для master/salon ролей с реальным аккаунтом
- [x] **BUG-1.** При регистрации через Mini App имя сохраняется с лишним пробелом → fix в `api/telegram/register/route.ts` (trim каждой части до join). Commit `7fa7ce8`.
- [x] **FIX-1.** `cancelled_by_client` / `cancelled_by_master` теперь учитываются в 5 местах: `api/ai/lost-revenue`, `api/slots`, `api/cron/recurring`, `(dashboard)/finance/lost-revenue`, `(dashboard)/finance/appointments`. Commit `7fa7ce8`.
- [~] **I18N-1.** Масштабная регрессия next-intl: **50 файлов с захардкоженными RU-строками** (нарушение §4 rules). Делается пакетами по surface. **Прогресс: 2/50.**
  - [x] `(dashboard)/layout.tsx` — 66 строк (sidebar nav + header + user menu + notifications panel) вынесены в `dashboard.nav.*` / `dashboard.header.*` для ru/en/uk. Commit `0e65320`.
  - [x] `(dashboard)/marketing/messages/page.tsx` — 15 строк (title, description, kindLabels×8, form labels, toasts) → `marketing.messagesPage.*` для ru/en/uk. 2026-04-15.
  - [ ] **Следующий батч (по убыванию количества строк):**
    - [ ] `(dashboard)/calendar/page.tsx` (~26)
    - [ ] `(dashboard)/finance/*` (lost-revenue, appointments, daily, profitability, tax-report, payments, gift-cards, memberships)
    - [ ] `(dashboard)/clients/*` (segments, loyalty, blacklist, cadence)
    - [ ] `(dashboard)/services/*`, `inventory/*`, `before-after`, `recommend`, `network`
    - [ ] `(dashboard)/settings/team/*` (shifts, timesheets, payrun)
    - [ ] `(client)/**` — web client profile + feed legacy
    - [ ] `/telegram/**` — Mini App (notifications, home, profile, search, slot/new, voice-book)
- [ ] **E2E-1.** Master↔Client live flow не верифицирован: создать запись мастером → проверить у клиента (history/wallet/notifications). Нужен прогон через Claude-in-Chrome после подключения расширения.
- [ ] **E2E-2.** Wallet transfer RPC (`00027_cf3_wallet_transfer_rpc.sql`) — проверить live: перевод между кошельками, concurrent lock, FX конверсия.
- [ ] **E2E-3.** RLS policies — аудит всех таблиц (client не видит чужое, master видит только своих клиентов).

### MEDIUM — улучшения UX / quality
- [ ] **UX-1.** Hardcoded RU-строки в `/telegram/(app)/notifications` — перенести в next-intl (часть I18N-1)
- [ ] **UX-2.** Client web-профиль (`(client)/profile/page.tsx`) — актуализировать под новый дизайн (сейчас legacy)
- [ ] **UX-3.** Pairing API (`/api/pair/*`) — либо вернуть UI, либо удалить orphan роуты
- [ ] **UX-4.** Кнопка «Пожаловаться» на публичном профиле мастера `/m/[handle]` + модалка с причинами + запись в `reports` таблицу (источник: inbox 2026-04-14)
- [ ] **LINT-1.** 79 `react-hooks/set-state-in-effect` ошибок (React 19 strict) — рефакторить effect'ы на events / derived state. Не runtime-блокер, но копится.
- [ ] **LINT-2.** 76 unused imports/vars — автоматически через `eslint --fix` + ручная чистка.
- [ ] **LINT-3.** 27 `<img>` → заменить на `next/image` (performance + LCP).
- [x] **LINT-4.** 12 `<a href="/...">` → `<Link>` из `next/link`. Исправлено в `calendar/page.tsx` (`/services`) и `telegram/register/page.tsx` (`/telegram/terms`). 2026-04-15.
- [ ] **LINT-5.** 29 `react-hooks/preserve-manual-memoization` + 20 `exhaustive-deps` warnings — аудит и исправление.

### LOW — rework / рефакторинг
- [ ] **REF-1.** `favorites` → мигрировать в `follows` (legacy таблица)
- [ ] **REF-2.** `/my-masters` web-страница — решить судьбу (переписать или удалить)
- [ ] **REF-3.** 21 non-null assertion (`!`) в коде — ревью на безопасность.
- [ ] **REF-4.** 4 `any`-типа — заменить на конкретные типы.
- [ ] **REF-5.** TODO Phase 8 в `feed/page.tsx` — geo + paid placement ranking RPC, real social-proof from bookings.

### IDEAS — Parking lot (не в порядке)
- [ ] **Платные stories** для продвижения — buy-boost с тарифом в subscription, или разовая оплата через wallet (источник: inbox 2026-04-14)
- [ ] Stories 24h auto-expire (сейчас stories микшер постоянный)
- [ ] Видео-посты в feed
- [ ] Reels-style вертикальные видео мастеров
- [ ] Direct messages client ↔ master внутри Mini App
- [ ] Pretty-handle URLs `cres-ca.com/u/<slug>`
- [ ] Multi-account switcher (несколько TG аккаунтов на один профиль)
- [ ] AI-rebooking flow (backlog из `backlog-feed-and-ai.md`)

---

## 📊 ОБЩИЙ СТАТУС ПРОЕКТА

```
Phases 00-23          ████████████  24 / 24 ✓
MASTER-WORK           ████████████  116 / 116 ✓
CLIENT-WORK           ████████████  37 / 37 ✓

Landing               ████████████  8 / 8
Auth                  ████████████  7 / 7 (+ 3 TODO для password reset UI и live test)
Onboarding            ████████████  3 / 3
Client Web            ████████████  17 / 17 (legacy, frozen)
Client Mini App       ████████████  11 / 11 ⭐ основной
Master Mini App       ████████████  9 / 9
Dashboard             ████████████  ~60 / 60
Infrastructure        ████████████  все интеграции на месте
```

**Вердикт:** продукт фича-комплитен на бумаге. Осталась полировка (AUTH-1/2/3, UX-1/2/3) и идеи из Parking lot.

---

## 🗂 Связанные документы (вспомогательные)

Эти файлы **не дублируют** этот документ — они хранят детали:

- `CLAUDE.md` — правила работы, индекс lazy-loaded знаний
- `.knowledge/project.md` — бизнес-модель, персоны, монетизация
- `.knowledge/vision.md` — сырое видение владельца (источник истины для «что и зачем»)
- `.knowledge/verticals.md` — карта индустриальных вертикалей
- `.knowledge/tech-stack.md` — Next.js 16 quirks, версии
- `.knowledge/rules.md` — критичные правила и DO NOTs
- `.knowledge/database.md` — схема БД, миграции
- `.knowledge/translations.md` — ключи i18n
- `.knowledge/design-md/INDEX.md` — per-brand DESIGN.md палитры (linear, pinterest, stripe…)
- `.knowledge/roadmap/INDEX.md` — исторические phases 00-23
- `.knowledge/roadmap/MASTER-WORK.md` — архив фазы соло-мастера (116/116 ✓)
- `.knowledge/roadmap/CLIENT-WORK.md` — архив фазы расфриза клиента (37/37 ✓)
- `.knowledge/CLIENT-REFERENCE.md` — снэпшот клиентского модуля
- `D:/toolbox/CLAUDE.md` — универсальные лучшие практики (переносятся между проектами)

---

## 📜 Changelog (журнал изменений PROJECT-MAP)

- **2026-04-14** — файл создан. Полная ревизия проекта: 116 pages замаплены по 8 разделам, собрана секция «Что предстоит сделать» (AUTH 1-3, UX 1-3, REF 1-2, IDEAS), определён механизм `📝`-заметок от Данила.
- **2026-04-14** — repo restructure: файл перенесён в `app/` (git repo root) для видимости на GitHub Mobile. Inbox разобран: 4 заметки → BUG-1 (имя с пробелом), FIX-1 (cancelled_by_client в сегментах), UX-4 (кнопка «Пожаловаться» на профиле мастера), IDEAS (платные stories). Добавлены категоризированные папки `.agents/.skills/.components/.snippets/` по таксономии toolbox. Git backlog 124 файла закоммичен и запушен на github.com/danvitpad/cres-ca.
- **2026-04-14** — code-level аудит: `npm run build ✓`, но 260 lint issues и 50 файлов с захардкоженными RU-строками (i18n регрессия §4). Открыты задачи I18N-1, LINT-1..5, E2E-1..3, REF-3..5. Закрыты HIGH: BUG-1 (trim whitespace API), FIX-1 (granular cancellation statuses в 5 местах). Commit `7fa7ce8`.
- **2026-04-14** — AUTH-1 fix: OTP input 8→6 slots (Supabase `resetPasswordForEmail` шлёт 6-digit). Commit `a74608e`.
- **2026-04-14** — I18N-1 batch 1: `(dashboard)/layout.tsx` полностью i18n — 66 строк (sidebar nav titles/tooltips/submenus + header CTA + notifications panel + user menu) вынесены в `dashboard.nav.*` / `dashboard.header.*` для ru/en/uk. `sidebarNav` переведён из top-level const в `useMemo(buildSidebarNav(t))`. Build ✓. Commit `0e65320`.
- **2026-04-14** — сессия завершена. Session totals: AUTH-1 ✓, BUG-1 ✓, FIX-1 ✓, I18N-1 batch 1 ✓ (1/50 файлов). **Завтра продолжать:** I18N-1 batch 2 — начать с `marketing/messages/page.tsx` (27 строк), дальше `calendar/page.tsx`. Затем LINT-2 (unused vars — быстрая победа) перед LINT-1 (79 set-state-in-effect — большой).
- **2026-04-15** — **Block C создан + inbox-долг закрыт.** При первоначальном B1 я ошибочно пропустил блок на 78 строк (FORGE agent spec + 8 внешних ссылок + skool.com профиль Данила) — решил, что это embedded YAML, а на деле это был сырой inbox-материал по контент-пайплайну от 2026-04-14. Сейчас разнесён в новый `BLOCK C — CONTENT PIPELINE` с 4 задачами (C1 product-content, C2 marketing-content, C3 FORGE port, C4 research skool+guides) и секцией «Референсы» где все ссылки сохранены. FORGE yaml спецификация также сохранена для C3. Inbox действительно очищен.
- **2026-04-15** — **Autonomous session (продолжение).** **A7** telegram-auth audit complete → `.knowledge/telegram-auth-audit-2026-04-15.md` с 4 findings (key: salon_admin нельзя зарегать через Mini App — design gap). **LINT-2** unused imports: установлен `eslint-plugin-unused-imports`, настроен в `eslint.config.mjs`, `--fix` выгреб 52 unused imports в 28 файлах, issues 259→207. **I18N-1 batch 2** (1 файл): `marketing/messages/page.tsx` → 15 строк в `marketing.messagesPage.*` (ru/en/uk) + ICU-escape переменных шаблонов. **LINT-4** clear: 12 `<a href>` → `<Link>` в `calendar/page.tsx` и `telegram/register/page.tsx`. Прогресс I18N-1: 2/50.
- **2026-04-15** — **B4 полная консолидация фронтенд-правил.** Собраны все разрозненные правила (CLAUDE.md §Triggers + `rules.md` + `patterns.md` + `ui-libraries.md` + `design-md/INDEX.md` + toolbox §4/5/6/7/8) в единый мастер-документ `.knowledge/FRONTEND.md` (10 секций). Master-копия — `D:/toolbox/skills/frontend/FRONTEND-PREMIUM.md` (для переноса на следующие проекты). В knowledge-таблице проектного `CLAUDE.md` поднят первой строкой как «читать первым перед любой UI-задачей». Toolbox §16 переписан в двухслойную систему: base skill (`frontend-design@claude-plugins-official`) + premium consolidated doc (проектная надстройка).
- **2026-04-15** — inbox-триаж + критические фиксы. **A1** диагностика: Supabase save path работает (trigger `handle_new_user()` создаёт profiles + masters + subscriptions) — «регистрации не сохраняются» было следствием A2/A4. **A2** `/profile` page.tsx: убран запрос к несуществующей `client_wallets` (404) + исправлены колонки `client_master_links` (`profile_id`/`master_id` вместо `id`/`client_id`) — погасило React error #418 у клиента. **A3** Supabase wipe: тестовые auth users зачищены, 7 демо-мастеров сохранены. **A4** auth полностью переписан: `/login` и `/register` — unified pages с 3-кнопочным role picker (client/master/salon_admin), role = internal state, OAuth только для клиента, старые 1231 строк → `(auth)/_archive/`, `/user-flow` → redirect. **A6** Zoya search — закрыт диагностически (мастерский поиск читает `clients` per-master address book, а не `profiles`). **B1** `PROJECT-MAP.md → PROJECT-JOURNAL.md`, имя MAP зарезервировано под визуальный canvas, inbox очищен (📝 разнесены в A1-A7/B1-B4), `CLAUDE.md` обновлён. **Остаётся:** A5 (унификация тёмной темы master vs client через Context7), A7 (аудит telegram-auth), B2 (toolbox audit), B3 (MCP plugins), B4 (консолидация frontend-design скиллов).
