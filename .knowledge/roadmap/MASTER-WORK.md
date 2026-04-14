# SOLO-MASTER WORK DOCUMENT

**Single source of truth** для фазы «Соло-мастер». Все задачи, порядок, статус — только здесь.

**Created:** 2026-04-13 · **Updated:** 2026-04-13 · **Phase:** Solo-Master (перед Salon/Company)

## Rules of engagement

1. Работаем **строго по порядку** сверху вниз.
2. После каждой задачи: `npm run build` → если ок, `vercel deploy --prod` → отметить `[x]`.
3. Если задача блокирует следующую — не пропускать.
4. Новые идеи/боли добавлять в секцию **Parking lot** внизу, не вклинивать в середину.
5. Каждый новый файл — YAML header (`name`, `description`, `created`, `updated`).
6. Никаких захардкоженных строк — всё через `next-intl`.
7. Клиентский модуль — **заморожен**. Трогаем только если блокирует мастер.

---

## Легенда статусов

- `[ ]` TODO
- `[~]` IN PROGRESS
- `[x]` DONE + build + deploy
- `[!]` BLOCKED (причина в скобках)

---

## BLOCK A — Telegram Mini App мастера (mobile-first)

Главная боль: у клиента Mini App есть, у мастера нет. Мастера работают в поле — им нужен телефон.

- [x] **A1.** `/telegram/m/layout.tsx` — shell, 4 таба, auth-gate (только для `masters` row)
- [x] **A2.** `/telegram/m/home/page.tsx` — KPI (записи/выручка/впереди) + hero следующей записи + quick actions
- [x] **A3.** `/telegram/m/calendar/page.tsx` — день, timeline, tap на запись → drawer (статус, клиент, цена, заметки, «отменить/завершить»)
- [x] **A4.** `/telegram/m/clients/page.tsx` — поиск + виртуализированный список с аватарами/тегами
- [x] **A5.** `/telegram/m/clients/[id]/page.tsx` — карточка клиента (история визитов, заметки, аллергии, файлы, «записать»)
- [x] **A6.** `/telegram/m/slot/new/page.tsx` — быстрое создание записи (3 тапа: клиент → услуга → время)
- [x] **A7.** `/telegram/m/profile/page.tsx` — свой профиль + QR визитки + биллинг линк
- [x] **A8.** `/telegram/m/stats/page.tsx` — неделя/месяц, выручка, загрузка, топ-услуги
- [x] **A9.** `/telegram/m/notifications/page.tsx` — входящие события (новые записи, отмены, отзывы)
- [x] **A10.** TG push мастеру на новые записи / отмены / no-show — Postgres trigger `trg_notify_master_on_appointment_insert/cancel` + существующий cron `/api/cron/notifications`
- [x] **A11.** Middleware: Mini App автораспознаёт роль — master → `/telegram/m/home`, client → `/telegram/home`

---

## BLOCK X — Регистрация / онбординг мастера

Дефолты с первого дня должны быть правильными — иначе мастер уходит.

- [x] **X1.** Миграция: enum `business_vertical` + `profiles.vertical` / `masters.vertical` / `salons.vertical` + индекс
- [x] **X2.** `/onboarding/vertical/page.tsx` — 10 карточек вертикалей, `account-type` «создать бизнес» теперь ведёт сюда
- [x] **X3.** `.knowledge/verticals.md` + `src/lib/verticals/default-services.ts` — code-ready массивы по 5-8 услуг на каждую из 10 вертикалей
- [x] **X4.** `/onboarding/create-business` читает `?vertical=X`, добавлен шаг «Популярные услуги» (checklist), завершение → POST `/api/business/create` (upsert masters + insert services)
- [x] **X5.** Trigger `trg_ensure_trial_subscription_on_master` — при `INSERT` в `masters` автосоздаёт trial subscription на 14 дней, если её ещё нет. Backfill: все существующие masters уже имели подписки.
- [x] **X6.** Онбординг checkpoint-прогресс: `<OnboardingChecklist>` (услуги → график → первая запись) с прогресс-баром и авто-скрытием при 100%. Подключён в `/dashboard` над 2×3 grid, i18n ru/uk/en.
- [x] **X7.** Upload аватар+обложка на шаге 1 `/onboarding/create-business` — drag-style cover + круглый аватар с overlap, превью, upload в bucket `avatars`, сохранение в `profiles.avatar_url`, `masters.avatar_url`, `masters.cover_url`.
- [x] **X8.** «Пригласи первых клиентов» — completion экран визарда теперь показывает web-invite ссылку (`/invite/<code>`) с copy-кнопкой + Telegram share button (`https://t.me/<bot>?start=master_<code>`) + skip. API `/api/business/create` возвращает `inviteCode` из `masters.invite_code`.
- [x] **X9.** Telegram linking в web-аккаунте мастера — таблица `telegram_link_tokens` (одноразовые, TTL 15 мин) + `POST /api/telegram/link/init` + ветка webhook `linkmaster_<token>` которая пишет `profiles.telegram_id`. UI: `<TelegramLinkCard>` на dashboard overview (скрывается когда привязано).
- [x] **X10.** Mini App регистрация → role picker (Клиент / Мастер) сверху формы `/telegram/register`. `POST /api/telegram/register` принимает `role`, создаёт `profiles.role='master'` + `masters` row через `ensureMasterRow()`, редирект после регистрации на `/telegram/m/home` для мастеров.
- [x] **X11.** Chip-picker специализации на шаге 1 `/onboarding/create-business` — список профессий per-vertical из нового `src/lib/verticals/specializations.ts` (10 вертикалей × 5-10 профессий). Сохраняется в `masters.specialization`.

---

## BLOCK Y — Подписки и биллинг

Сейчас starter платит и получает всё. Нужна реальная монетизация.

- [x] **Y1.** Расширил `SubscriptionFeature` enum — добавлены 12 новых фич (mini_app_master, smart_rebooking, burning_slots, auto_review_request, voice_ai, multi_currency, guild_marketing, google_business, social_posting, punch_card_loyalty, gdpr_export, tax_reports)
- [x] **Y2.** Переписан `SUBSCRIPTION_CONFIG` через spread-наследование STARTER→PRO→BUSINESS; лимиты starter 50/1, pro 500/1, business ∞/∞; trial = [...BUSINESS_FEATURES]
- [x] **Y3.** Создан `<PaywallCard feature requiredTier>` (Lock icon + i18n `subscription.paywall.*` + CTA `/settings/billing`) + `<WithFeature>` обёртка через `useSubscription().canUse()`
- [x] **Y4.** Создана `/settings/billing/page.tsx` — текущий план + статус-бейдж, trial countdown, матрица 3 тарифов (starter/pro/business) с ценами, highlight PRO, CTA upgrade (stub до Y8), плейсхолдер истории платежей
- [x] **Y5.** Централизованный gating через `<RouteFeatureGate>` в `(dashboard)/layout.tsx` + карта `ROUTE_FEATURES` (25+ роутов → feature/tier, longest-prefix match). Вместо правки 50 страниц — единая точка перехвата: не-в-тарифе роут → `<PaywallCard>`
- [x] **Y6.** `<TrialBadge>` в dashboard header — пил с количеством дней trial, кликабельный → `/settings/billing`, визуальная эскалация (urgent amber при ≤3 днях)
- [x] **Y7.** `/api/cron/subscriptions` (ежедневно 06:00) — 3 перехода: trial→past_due (trial_ends_at истёк), active→past_due (current_period_end истёк), past_due→expired+downgrade в starter (>7 дней). Каждый переход создаёт notification
- [x] **Y8.** LiqPay subscription upgrade flow — кнопка Upgrade на `/settings/billing` вызывает `/api/payments/create` type=subscription → auto-submit LiqPay form в новой вкладке. Webhook в `/api/payments/liqpay` уже обрабатывал `subscribe` action — обновляет `subscriptions.tier+status+current_period_end`
- [x] **Y9.** TG уведомления о trial_ends/past_due/expired — `notifyTg()` helper в cron subscriptions ищет `profiles.telegram_id` и шлёт HTML-сообщение через `sendMessage`. Email провайдер ещё не подключен — deferred в BLOCK C (7. Notifications & inbox)
- [x] **Y10.** Landing `/(landing)/page.tsx` #pricing секция обновлена — starter 299₴, pro 799₴ (highlighted), business 1999₴. Новые фичи: mini_app_master, smart_rebooking, burning_slots, auto_review_request, voice_ai, multi_currency, guild_marketing, google_business, social_posting, gdpr_export, tax_reports + i18n keys ru/uk/en

### Матрица тарифов (утверждена)

| Feature | Trial (14д) | Starter | Pro | Business |
|---|---|---|---|---|
| Calendar + online booking | ✓ | ✓ | ✓ | ✓ |
| Basic client cards | ✓ | ✓ | ✓ | ✓ |
| Basic finance | ✓ | ✓ | ✓ | ✓ |
| Reminders 24h/2h | ✓ | ✓ | ✓ | ✓ |
| Max clients | ∞ | 50 | 500 | ∞ |
| Max locations | 1 | 1 | 1 | 3 |
| **Mini App мастера** | ✓ | — | ✓ | ✓ |
| Waitlist | ✓ | — | ✓ | ✓ |
| Inventory + auto-deduct | ✓ | — | ✓ | ✓ |
| Before/after | ✓ | — | ✓ | ✓ |
| Consent forms | ✓ | — | ✓ | ✓ |
| Gift certificates | ✓ | — | ✓ | ✓ |
| Referral program | ✓ | — | ✓ | ✓ |
| Auto review request | ✓ | — | ✓ | ✓ |
| Smart rebooking | ✓ | — | ✓ | ✓ |
| Burning slots | ✓ | — | ✓ | ✓ |
| Auto-upsell | ✓ | — | ✓ | ✓ |
| Extended analytics | ✓ | — | ✓ | ✓ |
| Punch-card loyalty | ✓ | — | ✓ | ✓ |
| **AI voice notes** | ✓ | — | — | ✓ |
| AI lost-revenue | ✓ | — | — | ✓ |
| Multi-currency | ✓ | — | — | ✓ |
| Cross-marketing guilds | ✓ | — | — | ✓ |
| Auto reports PDF | ✓ | — | — | ✓ |
| Google Business sync | ✓ | — | — | ✓ |
| Social auto-posting | ✓ | — | — | ✓ |
| GDPR export | ✓ | — | — | ✓ |
| Tax reports | ✓ | — | — | ✓ |
| Priority support | ✓ | — | — | ✓ |

---

## BLOCK B — Dashboard живой

Web dashboard — 1000 строк, но почти без реальных запросов.

- [x] **B1.** `<DashboardKpiStrip>` — 5 KPI-карт поверх главной dashboard: выручка сегодня, неделя, месяц; процент загрузки на основе working_hours; следующая активная запись. Считаются локально из appointments за текущий месяц + i18n ru/uk/en
- [x] **B2.** Уже реализовано: `<AppointmentDetailDrawer>` на `/calendar` через `handleAppointmentClick` → `setSelectedAppointment + setActionsOpen`. Full карточка с onUpdated refetch
- [x] **B3.** Уже реализовано: `SidebarItem` с `openFlyout` state, motion panel, click-open flyout submenu, fixed positioning, tooltip fallback
- [x] **B4.** Уже реализовано: `<CommandPalette>` в dashboard layout через `useCommandPalette()` hook, Ctrl+K toggle
- [x] **B5.** `<DashboardRealtimeToasts>` — supabase channel `dash-notif-${userId}` на INSERT в `notifications`. При новой строке показывает sonner toast с title/body + action "Open" на link. Монтируется в dashboard layout

---

## BLOCK Z — Публичная витрина мастера

- [x] **Z1.** `/m/[handle]/page.tsx` — публичная страница мастера (SEO, Schema.org LocalBusiness)
- [x] **Z2.** QR-генератор визитки (`/api/qr?handle=...` → PNG)
- [x] **Z3.** Stories/highlights (альбомы работ) — upload + отображение
- [x] **Z4.** Портфолио с тегами (стили/техники)
- [x] **Z5.** Block «Как подготовиться» / FAQ на странице услуги
- [x] **Z6.** Отзывы с фото — upload клиентом после визита

---

## BLOCK C — Автоматизация коммуникаций

Заглушки `marketing/*` → реальный функционал.

- [x] **C1.** `marketing/messages` — шаблоны сообщений (24h/2h/thanks/win-back) с переменными
- [x] **C2.** `/api/cron/reminders` — расширить под новые шаблоны
- [x] **C3.** Auto-ask-review: cron после `completed` appointment + 2h → TG push клиенту с формой
- [x] **C4.** Smart rebooking: cron по `client_cadence` → «пора записаться, последний визит X дней назад»
- [x] **C5.** Win-back: клиент не был 60 дней → авто-пуш с скидкой
- [x] **C6.** NPS опрос после 3-го визита
- [x] **C7.** `marketing/automation` UI — построитель правил

---

## BLOCK D — Уникальные фичи (за что платят)

- [x] **D1.** Burning slots detector (`/api/cron/burning-slots` уже есть — подключить к TG push)
- [x] **D2.** Auto-upsell виджет при бронировании («добавь X за 150₴»)
- [x] **D3.** Recipe-based auto-deduction склада после visit
- [x] **D4.** Health alerts на календаре (красная точка если у клиента аллергия/противопоказание)
- [x] **D5.** Voice notes → AI транскрипция (`/api/ai/transcribe` — backend wiring)
- [x] **D6.** Repeat booking 1-click (кнопка на завершённой записи)
- [x] **D7.** Punch-card loyalty (5 услуг → 6-я бесплатно)
- [x] **D8.** Уровни клиента (новый/регулярный/VIP) + скидки
- [x] **D9.** День рождения → авто-подарок в `bonus_balance`
- [x] **D10.** Таймер услуги в Mini App календаре

---

## BLOCK E — Маркетинг внешний

- [x] **E1.** `marketing/social` — Instagram/TG автопостинг (расписание + OG image)
- [x] **E2.** `marketing/google` — Google Business Profile sync (часы, услуги, фото)
- [x] **E3.** `marketing/links` — QR + linktree страница
- [x] **E4.** `marketing/reviews` — pipeline сбора и показа отзывов
- [x] **E5.** `marketing/campaigns` — email/TG рассылки по сегментам
- [x] **E6.** `marketing/deals` — промокоды + счётчик использований
- [x] **E7.** `marketing/profile` — SEO-карточка мастера + мета

---

## BLOCK W — GDPR / юридическое / налоги

- [x] **W1.** Export данных клиента PDF/JSON (`/api/gdpr/export?client_id=...`)
- [x] **W2.** Audit log изменений карточки (таблица `client_audit_log`)
- [x] **W3.** Право на забвение (soft delete → hard delete через 30 дней cron)
- [x] **W4.** Генерация чеков ФОП (PDF + email)
- [x] **W5.** Квартальный налоговый отчёт (5% / 18%) — `/api/reports/quarterly`
- [x] **W6.** Электронная подпись договоров через `consent_forms`

---

## BLOCK V — Операционка

- [x] **V1.** График / отпуска / больничные → блокировка `masters.working_hours` диапазонов
- [x] **V2.** Import клиентов из Excel/CSV с mapping полей
- [x] **V3.** Export финансов в Excel (месяц/квартал)
- [x] **V4.** Checklist визита per-service (jsonb в `services.checklist`)
- [x] **V5.** Режим «занят/перерыв» — toggle в Mini App, мгновенно снимает онлайн-слоты
- [x] **V6.** Import Google Calendar событий (односторонний)

---

## BLOCK F — Доп уникальное

- [x] **F1.** Multi-currency auto-recalc cron (`/api/cron/fx` расширить)
- [x] **F2.** Cross-marketing guilds (обмен клиентами между смежными мастерами)
- [x] **F3.** Бейджи/уровни мастера (verified, top-недели)
- [x] **F4.** Мастер-лидерборд в `/network`

---

## BLOCK G — Internal growth loop (бесплатный маркетинг внутри сервиса)

Клиенты внутри CRES-CA лайкают, оценивают, рекомендуют — мастера поднимаются в выдаче, получают бесплатные показы, появляется стимул «жить внутри сервиса».

- [x] **G1.** Лайки/сердечки на карточку мастера и салона (`master_likes` / `salon_likes` таблицы, optimistic UI в Mini App/web)
- [x] **G2.** Звёздный рейтинг 1–5 после `completed` визита — cron C3 автоматом зовёт форму
- [x] **G3.** Home-feed recommendation engine: топ мастеров по score (лайки + рейтинг + свежесть + локация) per-vertical per-city
- [x] **G4.** Публичный лидерборд `/network` — top-10 недели/месяца в городе per-vertical
- [x] **G5.** Badges: `verified` (100+ визитов), `trending` (всплеск 7d), `top-rated` (4.8+), `fast-responder`
- [x] **G6.** Share-story card «Я рекомендую X» — клиент генерит картинку и постит в TG/IG, deep-link на профиль
- [x] **G7.** Referral rewards: клиент привёл друга → бонусы обоим в wallet (tracking через invite code + `referrer_id`)
- [x] **G8.** Score mixer настраиваемый per-vertical (для health лайки важнее, для auto — скорость ответа)

---

## BLOCK H — Финансы / налоги (боли мастера)

- [x] **H1.** Daily closeout — авто-сводка выручки/расходов/чаевых в конце дня в TG («Сегодня: 4 визита, 2400₴, из них 400₴ чай, отложить на налог 120₴»)
- [x] **H2.** Расходы с photo OCR чеков (`/api/expenses/parse-receipt` через Vision AI, авто-заполняет сумму/категорию)
- [x] **H3.** Live налоговый счётчик ФОП 5%/18% — виджет на tax-report «к уплате до Y числа: Z₴»
- [x] **H4.** Чаевые tracking — `appointments.tip_amount` + страница `/finance/tips` для логгинга + колонка в tax-report
- [x] **H5.** Invoice page `/invoice/[apt_id]` (HTML + print→PDF) для корпоративных клиентов
- [x] **H6.** Cash flow forecast `/finance/cashflow` — 14 дней, подтверждённые визиты + активные подписки, график + таблица
- [x] **H7.** Split payments `/finance/split/[apt_id]` — prepayment/remainder/full + авто-баланс (enum `payment_type.remainder`)
- [x] **H8.** Debt banner на client card + еженедельный cron `/api/cron/debts` с TG-сводкой должников

---

## BLOCK I — Рутина и автоматизация workflow (боли мастера)

- [x] **I1.** Smart scheduling — `long_visit_buffer_minutes` + `long_visit_threshold_minutes` в slots API + UI в settings
- [x] **I2.** Auto-confirm — 24h reminder с confirm-link (`/confirm/[apt_id]`), 2h cron авто-отменяет неподтверждённые (`auto_release` setting)
- [x] **I3.** FAQ templates `/settings/faq` — CRUD + clipboard copy, сидер стандартных шаблонов
- [x] **I4.** Travel buffer — `services.is_mobile` + `travel_buffer_minutes` в slots API, UI в форме услуги
- [x] **I5.** Inventory low-stock alerts — `/api/cron/low-stock` ежедневно в 5:00, TG-пуш если `quantity <= threshold`
- [x] **I6.** Birthday auto-greetings (был) + anniversary greetings по `clients.created_at` годовщине
- [x] **I7.** Voice booking `/telegram/m/voice-book` — Web Speech API + `/api/voice-booking/parse` через OpenRouter Gemini
- [x] **I8.** Break enforcement — кнопки "Применить Пн (13:00–14:00)" в `WorkingHoursTab` копируют break_start/break_end из выбранного дня во все активные рабочие дни; slots API уже фильтрует эти окна (`appointments.break_start/break_end`)

---

## BLOCK J — Soak-fix master↔client integration (критические дыры после аудита 2026-04-14)

Ручной аудит выявил 9 дыр в связке master↔client. Докрутить до того, как стартовать `SALON-WORK.md`.

- [x] **J1.** `increment_client_stats(p_client_id, p_amount)` RPC + trigger `appointments_on_completed` — обновляет `clients.total_visits/total_spent/avg_check/last_visit_at` и начисляет `bonus_balance = price × masters.bonus_percent / 100`. Drawer больше не дёргает RPC вручную (триггер делает всё). Миграция `j1_client_stats_on_completion`.
- [x] **J2.** Таблица `punch_cards (client_id, master_id, count, target, rewards_claimed, last_reward_at)` + RLS + триггер при completion инкрементит count, при `count >= masters.punch_card_every` обнуляет и шлёт клиенту TG-notification «бесплатный визит!». Миграция `j2_punch_cards`.
- [x] **J3.** Cancellation policy enforcement: `computeCancellationFee()` в `(client)/my-calendar` по `masters.cancellation_policy`, цветной warning в cancel dialog (free/partial/late), при amount>0 создаётся `payments` row с `type='cancellation_fee'` (новое значение enum добавлено миграцией `j3_payment_type_cancellation_fee`). Статус меняется на `cancelled_by_client`.
- [x] **J4.** Family booking cleanup: оставлен path через `clients.family_link_id` (работает через `family_links` table). CLIENT-REFERENCE §5.6 + §5.7 обновлены — убраны фантомные `family_members` / `for_family_member_id`, зафиксировано что `appointments_on_completed` (J1) триггер отвечает за бонусы, а не мифический `bonus_on_completion`.
- [x] **J5.** Таблица `wallet_transactions (client_id, profile_id, master_id, kind, amount, balance_after, reason, created_at)` + RLS (client и master каждый видит своё) + триггер `clients_log_bonus_change` на UPDATE `bonus_balance` автоматом пишет row. Миграция `j5_wallet_transactions`. History UI: `(client)/wallet` timeline теперь подмешивает строки из `wallet_transactions` вместе с appointments/referrals, сортирует и показывает топ-20.
- [x] **J6.** `(client)/book` ставит `booked_via='client_web'`, `(client)/my-calendar` использует `status='cancelled_by_client'` enum (закрыто вместе с J3).
- [x] **J7.** Trigger `appointments_link_client_master` `ON INSERT appointments` → upsert в `client_master_links (profile_id, master_id, source)` через `clients.profile_id`. Burning-slots cron теперь дотягивается и до web-клиентов. Миграция `j7_auto_link_client_master_on_booking`.
- [x] **J8.** `/api/gdpr/self-export` route + кнопка Download в `(client)/account-settings` — клиент сам скачивает JSON со своим profile/clients/appointments/consents/notifications/reviews. GDPR art. 20.
- [x] **J9.** Reschedule flow в `(client)/my-calendar`: новый Dialog с date-input + grid доступных слотов через `/api/slots?master_id&service_id&date`. На клик по слоту — UPDATE `starts_at/ends_at`, статус возвращается к `booked`, мастеру notification «клиент перенёс». Кнопка `CalendarClock` добавлена в agenda-view и bottom sheet.

---

## Parking lot (новые идеи — не в порядке)

- TikTok контент генератор (AI подсказки трендов)
- Чат-бот в Mini App для вопросов клиентов
- AR превью причёсок (future)
- Интеграция с календарём Apple (webcal)
- Mobile app (нативный) — пока PWA достаточно

---

## Deleted from repo (cleanup 2026-04-13)

- `.knowledge/roadmap/client-gap-analysis-2026-04-13.md` — одноразовый аудит, завершён
- `.knowledge/roadmap/phase-07b-client-closeout.md` — closeout клиентского модуля, завершён
- `.agents/client-ui-auditor/` — UI аудитор клиента, своё отработал

## Still active (клиентское, не трогаем)

- **`.knowledge/CLIENT-REFERENCE.md`** ← единственный справочник по клиентскому модулю (что реализовано, как связано с мастером/салоном). Обновляется только при реальных правках клиента.
- `.agents/personas/client-agent/` — если придётся фиксить баги в клиентском модуле
- `.knowledge/roadmap/phase-03-clients.md`, `phase-18-client-experience.md` — исторические записи, оставляем

---

## Progress tracker

```
BLOCK A  ████████████ 11 / 11 ✓
BLOCK X  ████████████ 11 / 11 ✓
BLOCK Y  ████████████ 10 / 10 ✓
BLOCK B  ████████████  5 / 5 ✓
BLOCK Z  ████████████  6 / 6 ✓
BLOCK C  ████████████  7 / 7 ✓
BLOCK D  ████████████ 10 / 10 ✓
BLOCK E  ████████████  7 / 7 ✓
BLOCK W  ████████████  6 / 6 ✓
BLOCK V  ████████████  6 / 6 ✓
BLOCK F  ████████████  4 / 4 ✓
BLOCK G  ████████████  8 / 8 ✓
BLOCK H  ████████████  8 / 8 ✓
BLOCK I  ████████████  8 / 8 ✓
BLOCK J  ████████████  9 / 9 ✓

TOTAL: 116 / 116 ✓
```

**Статус:** весь Solo-Master roadmap + soak-fix BLOCK J закрыты. Master↔client связка приведена к консистентному состоянию: completion stats → триггер, punch-card → таблица + триггер, cancellation policy → enforcement, wallet history → таблица + триггер, auto-link на booking, GDPR self-export, reschedule flow. Следующая фаза — `SALON-WORK.md` (multi-master).

---

## После Solo-Master → Salon/Company

Как только BLOCK A-F завершён → новый документ `SALON-WORK.md` с мультимастером, сменами, payrun, cross-master analytics. Не раньше.
