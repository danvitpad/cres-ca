# PROJECT-MAP.md — ПОЛНАЯ КАРТА ПРОЕКТА CRES-CA

> **Это главный документ проекта.** Единая точка правды, по которой мы работаем из любой сессии Claude Code. Все остальные документы (roadmap фаз, CLIENT-WORK, MASTER-WORK, memory) — вспомогательные. Здесь — **вся карта сервиса**: что есть, что работает, что предстоит сделать.
>
> **Расположение:** `D:/Claude.cres-ca/PROJECT-MAP.md` (рядом с `CLAUDE.md`).
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
3. Следующая сессия Claude Code при `/read PROJECT-MAP.md` автоматически подберёт все `📝`-строки, превратит каждую в чекбокс задачи и добавит в соответствующий блок. После выполнения — отметит `[x]` и **оставит** историю в changelog внизу.

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
- [ ] **AUTH-1.** Password reset UI — web-страницы `/forgot-password` и `/reset-password` (Supabase Auth flow есть, UI нет)
- [ ] **AUTH-2.** Live-верификация email OTP при регистрации (Resend key стоит, нужен реальный тест)
- [ ] **AUTH-3.** Live-верификация web `/login` для master/salon ролей с реальным аккаунтом
- [x] **BUG-1.** При регистрации через Mini App имя сохраняется с лишним пробелом → fix в `api/telegram/register/route.ts` (trim каждой части до join). Commit `7fa7ce8`.
- [x] **FIX-1.** `cancelled_by_client` / `cancelled_by_master` теперь учитываются в 5 местах: `api/ai/lost-revenue`, `api/slots`, `api/cron/recurring`, `(dashboard)/finance/lost-revenue`, `(dashboard)/finance/appointments`. Commit `7fa7ce8`.
- [ ] **I18N-1.** Масштабная регрессия next-intl: **50 файлов с захардкоженными RU-строками** (нарушение §4 rules). Основные: весь `(dashboard)/**`, часть `(client)/**`, весь `/telegram/**`. Блокирует UA/EN переводы. **Делать пакетами по surface**, не одним коммитом.
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
- [ ] **LINT-4.** 12 `<a href="/...">` → заменить на `<Link>` из `next/link` (SPA navigation).
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
