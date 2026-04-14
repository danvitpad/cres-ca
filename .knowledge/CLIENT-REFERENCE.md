# CLIENT MODULE — Reference Snapshot

**Единственный справочный документ по клиентскому модулю.** Что реализовано, как связано с мастером/салоном, какие нюансы. Обновляется только при реальных изменениях клиентского кода.

**Status:** ❄️ Frozen (модуль завершён на фазе 7, новые фичи не добавляем до стабилизации мастера).
**Created:** 2026-04-13 · **Last review:** 2026-04-13

---

## 1. Вход и регистрация клиента

| Точка входа | Путь | Что происходит |
|---|---|---|
| Landing | `/[locale]/` | Публичный сайт, CTA «Открыть в Telegram» → бот `@cres_ca_bot` |
| Mini App | `/telegram` | `telegram/page.tsx` валидирует `initData` через `/api/telegram/auth`, решает маршрут |
| Registration | `/telegram/register` | Только если `linked && needsRegistration` — добирает имя/телефон |
| Welcome / consent | `/telegram/welcome` | Если профиль не связан — экран согласия |

**Роутинг по роли (telegram/page.tsx):**
- `client` → `/telegram/home`
- `master` / `salon_admin` → `/telegram/m/home` (master Mini App)
- `startParam=master_XXX` → `/telegram/home?master=XXX` (deep link в профиль мастера)

Silent user creation запрещён — `/api/telegram/auth` никогда не создаёт профиль без согласия (см. `.knowledge/rules.md`).

---

## 2. Client Mini App (основной продукт клиента)

Все страницы — `app/src/app/telegram/(app)/**`. Layout: `telegram/(app)/layout.tsx` (shell с нижним табом, темная тема, TelegramProvider).

| Таб / экран | Файл | Что делает |
|---|---|---|
| Home (главная лента) | `(app)/home/page.tsx` | «Для тебя» — рекомендации мастеров/салонов, ближайшая запись, быстрые действия |
| Search | `(app)/search/page.tsx` | Поиск мастеров/услуг по городу, фильтры |
| Search result | `(app)/search/[id]/page.tsx` | Детальная карточка поискового результата |
| Map | `(app)/map/page.tsx` | Карта с пинами мастеров/салонов в радиусе |
| Salon | `(app)/salon/[id]/page.tsx` | Публичная страница салона (услуги, мастера, отзывы, бронь) |
| Activity feed | `(app)/activity/page.tsx` | Лента посещений/событий клиента (визиты, отзывы, баллы) |
| Activity detail | `(app)/activity/[id]/page.tsx` | Детали одной записи |
| Profile | `(app)/profile/page.tsx` | Свой профиль, настройки, выход |

**Дизайн-паттерны клиентского Mini App:**
- Instagram-like ленты (карточки с фото, тонкие скругления, темный фон)
- Bottom sheet для деталей и фильтров (не модалы)
- framer-motion + haptic feedback на всех тапах
- Поддержка `?master=XXX` deep-link для перехода из шары мастера

---

## 3. Web-версия клиента (`[locale]/(client)/**`)

Web работает параллельно с Mini App — для тех, кто заходит из браузера. Layout: `(client)/layout.tsx` (bottom tab bar, адаптирован под mobile).

| Раздел | Файл | Реализовано |
|---|---|---|
| Feed | `(client)/feed/page.tsx` | ✅ Stories + лента мастеров, premium стиль |
| Book (бронирование) | `(client)/book/page.tsx` | ✅ Flow: мастер → услуга → слот → подтверждение |
| My calendar | `(client)/my-calendar/page.tsx` | ✅ Свои будущие/прошлые записи, отмена, rescheduling |
| Masters | `(client)/masters/page.tsx` | ✅ Список доступных мастеров |
| Master profile | `(client)/masters/[id]/page.tsx` | ✅ Публичная карточка мастера (услуги, портфолио, отзывы, «записаться») |
| My masters | `(client)/my-masters/page.tsx` | ✅ Избранные мастера клиента |
| Map | `(client)/map/page.tsx` | ✅ Карта мастеров в городе |
| History | `(client)/history/page.tsx` + `[id]` | ✅ История визитов с деталями |
| Wallet | `(client)/wallet/page.tsx` | ✅ Бонусы, гифт-карты, remaining visits на пакетах, transfer history |
| Profile | `(client)/profile/page.tsx` | ✅ Свой профиль, настройки, avatar |
| Documents | `(client)/profile/documents/page.tsx` | ✅ Согласия, подписанные формы (GDPR, consent forms) |
| Family | `(client)/profile/family/page.tsx` | ✅ Члены семьи / подопечные (для записи детей, питомцев, старших) |
| Photos | `(client)/profile/photos/page.tsx` | ✅ Альбом before/after фото клиента |
| Forms | `(client)/forms/page.tsx` | ✅ Формы, которые мастер попросил заполнить (анамнез) |
| Notifications | `(client)/notifications/page.tsx` | ✅ Inbox уведомлений (напоминания, изменения, сообщения) |
| Account settings | `(client)/account-settings/page.tsx` | ✅ Язык, уведомления, удаление аккаунта (GDPR) |

---

## 4. Кто создаёт, кто видит (разграничение ролей)

Критически важное правило: контент делится на **master-only** (мастер создал для себя) и **shared** (мастер создал, клиент видит).

| Сущность | Создаёт | Видит клиент? | Где у клиента |
|---|---|---|---|
| Anamnesis / противопоказания | master | ❌ только мастер | — |
| Internal master notes | master | ❌ | — |
| Blacklist / risk flags | master | ❌ | — |
| Before/after photos | master (uploads) | ✅ своих | `profile/photos` |
| Product recommendations | master | ✅ shared | `feed` / `book` |
| Loyalty punch-card | master → system | ✅ прогресс | `wallet` |
| Gift certificates | master выдал / клиент купил | ✅ баланс | `wallet` |
| Consent forms | master отправил | ✅ подписать | `forms` → `documents` |
| Appointment details | master | ✅ частично (время, услуга, цена) | `my-calendar`, `history` |
| Health alerts (аллергии) | master → system | ❌ только индикатор в master UI | — |

**Never expose:** internal notes, blacklist flags, anamnesis raw text, master stats.

---

## 5. Связи с мастером и салоном

### 5.1 Бронирование (client → master)

1. Клиент на `(client)/book` или `(app)/salon/[id]` выбирает услугу + слот.
2. POST `/api/appointments` → создаёт строку в `appointments` с `booked_via='client_web'` или `'client_miniapp'`.
3. Postgres trigger `trg_notify_master_on_appointment_insert` → insert в `notifications` (channel=`telegram`).
4. Cron `/api/cron/notifications` → `sendMessage()` мастеру в TG.
5. У мастера появляется в календаре и в Mini App `/telegram/m/notifications`.

### 5.2 Отмена со стороны клиента

Status update → `cancelled_by_client`. Trigger `trg_notify_master_on_appointment_cancel` → уведомление мастеру.
Клиент может отменить из `(client)/my-calendar` или Mini App аналога.

### 5.3 No-show

Если клиент не пришёл, мастер ставит `no_show` в своём Mini App (`/telegram/m/calendar` drawer). Триггер уведомлений на no-show исходит из мастера, не из клиента — клиенту приходит «извини, ты не пришёл + политика возврата» через `marketing/messages` шаблон.

### 5.4 Отзывы

После `status='completed'` (будущий cron C3) — клиенту TG push с формой отзыва. Пишется в `reviews`, мастер видит в dashboard `marketing/reviews`.

### 5.5 Share / реферал

- Клиент может шарить карточку мастера из `(app)/salon/[id]` или `(client)/masters/[id]` — формируется deep link `t.me/cres_ca_bot?startapp=master_<id>`.
- `telegram/page.tsx` парсит `start_param` → редирект на карточку мастера.
- Мастер в профиле видит «откуда пришёл клиент» (referral source) — пока placeholder, полноценно в блоке D referral program.

### 5.6 Family / подопечные

`(client)/profile/family` использует таблицу `family_links` (не `family_members` — её нет). При бронировании «для подопечного» на стороне мастера создаётся **отдельная `clients` row** с заполненным `family_link_id`, и `appointments.client_id` указывает на эту row. Колонки `appointments.for_family_member_id` **не существует** — логика полностью через `family_link_id` в `clients`. Мастер видит каждого подопечного как отдельную карточку, сгруппированную через `family_link_id`.

### 5.7 Семейный кошелёк

`wallet` показывает баланс бонусов клиента из `clients.bonus_balance`. Transfer между членами семьи — RPC не реализована (в TODO). Объединённого family-балaнса пока нет — каждая `clients` row с `family_link_id` имеет свой `bonus_balance` per-master.

### 5.8 Wallet / оплаты

- Предоплата LiqPay: `(client)/book` → `/api/payments/create` → LiqPay checkout → webhook `/api/payments/liqpay` обновляет `appointments.prepaid`.
- Бонусы начисляются после `completed` визита триггером `appointments_on_completed` (миграция `j1_client_stats_on_completion`) по ставке `masters.bonus_percent` от (`price + tip_amount`). Одновременно инкрементится `punch_cards.count`, при достижении `masters.punch_card_every` клиент получает TG-notification о бесплатном визите.
- Гифт-карты покупаются из `wallet` или на публичной странице мастера.

---

## 6. База данных — клиентские таблицы

| Таблица | Роль клиента |
|---|---|
| `profiles` | Профиль (один на телеграм-аккаунт), `role='client'` |
| `clients` | Связь клиент↔мастер (карточка у мастера). Одна запись на каждую пару `(profile_id, master_id)` |
| `family_members` | Подопечные, принадлежат `profile_id` |
| `appointments` | Бронирования. `client_id` = `clients.id` (у мастера), `profile_id` можно выцепить через join |
| `notifications` | Входящие для клиента — фильтр по `profile_id` |
| `wallet_transactions` | Движения бонусов/гифтов |
| `reviews` | Отзывы клиента о визите |
| `consent_forms` | Подписанные формы |
| `client_files` | Загруженные фото (before/after, документы) |

---

## 7. API-точки, которыми пользуется клиент

| Endpoint | Назначение |
|---|---|
| `POST /api/telegram/auth` | Валидация `initData`, routing по роли |
| `POST /api/telegram/register` | Завершение регистрации (имя, телефон) |
| `POST /api/appointments` | Создать запись |
| `PATCH /api/appointments/[id]` | Отмена/перенос клиентом |
| `POST /api/payments/create` | Инициировать LiqPay оплату |
| `POST /api/payments/liqpay` | LiqPay webhook |
| `POST /api/invite/claim` | Принять инвайт-код (от мастера / рефералку) |
| `GET /api/u/[publicId]` | Публичная карточка мастера/салона |
| `GET /api/slots` | Доступные слоты для бронирования |

---

## 8. i18n

Клиентский модуль полностью через `next-intl`. Ключи в `messages/ru.json`, `messages/uk.json`, `messages/en.json` — секции `client.*`, `booking.*`, `wallet.*`. Хардкод строк запрещён.

---

## 9. Дизайн-правила (зафиксировано)

- **Instagram-vibes для ленты:** темный фон, тонкие скругления (`rounded-2xl`/`3xl`), карточки с большим фото.
- **framer-motion** на входе каждой страницы и drawer-ов (AnimatePresence).
- **Haptic feedback** на каждом таре (impact/selection/success через TelegramProvider).
- **Никаких cheap-шаблонов** — кастомные карточки, не generic Tailwind UI.
- **Mobile-first,** всё работает на 360×640 идеально, web — адаптивно.

---

## 10. Что НЕ реализовано (сознательно отложено)

| Feature | Причина | Где вернуться |
|---|---|---|
| Чат с мастером внутри Mini App | Слишком жирно, пока хватит TG native | Roadmap phase-23 |
| Видео-отзывы | UX не понятен, ждём feedback | Parking lot |
| AR-превью | Future product | Parking lot |
| Transfer RPC между членами семьи | Бэкенд не готов, только UI заглушка | MASTER-WORK block D или W |
| Push уведомления клиенту о burning slots | Ждёт D1 (мастер burning-slots cron) | MASTER-WORK D1 |

---

## 11. Агент и дополнительные файлы

- `.agents/personas/client-agent/SKILL.md` — правила и анти-паттерны для работы в клиентском модуле
- `.agents/personas/client-agent/SECTOR.md` — живой лог решений (продолжает вестись при любых правках)
- `.knowledge/roadmap/phase-18-client-experience.md` — историческая фиксация редизайна (read-only архив)
- `.knowledge/roadmap/phase-03-clients.md` — первичная реализация клиентских сущностей (read-only)

**Если нужно фиксить баг в клиенте:** сначала читаем этот документ + SECTOR.md, затем изменяем код. После правки — обновляем соответствующую строку здесь.

---

## 12. Связь с фазой мастера (MASTER-WORK.md)

Клиент **не будет развиваться** до окончания `MASTER-WORK.md` (блоки A-F). Исключение — критические баги, блокирующие платящих клиентов.

Единственные cross-sector изменения в client, допустимые сейчас:
- Адаптация `telegram/page.tsx` под routing по роли (уже сделано, A11)
- Любые pipeline-изменения в `notifications` / `appointments` триггерах, если мастерские триггеры затрагивают общую таблицу
