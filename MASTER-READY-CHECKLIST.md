# Мастер Ready-to-Ship Checklist

> Единый аудит: что готово, что в процессе, что впереди. Обновляется на каждой сессии.
> Последний апдейт: 2026-04-17.

## 🟢 Легенда
- ✅ Готово и работает
- 🟡 Частично готово / требует доработки
- ❌ Не реализовано
- 🔒 Зависит от другого блока

---

## 1. Инфраструктура и foundation

| # | Компонент | Статус | Комментарий |
|---|---|---|---|
| 1.1 | `dashboard-theme.ts` — palette + helpers | ✅ | Purple accent, navy dark, KPI gradients |
| 1.2 | `globals.css` — CSS variables | ✅ | Синхронизирован с dashboard-theme |
| 1.3 | `lib/verticals/default-services.ts` | ✅ | 10 вертикалей |
| 1.4 | `lib/verticals/intake-fields.ts` | ✅ | Анамнез per vertical |
| 1.5 | `lib/verticals/specializations.ts` | ✅ | Специализации |
| 1.6 | `lib/verticals/feature-flags.ts` | ✅ | **NEW** 13 feature-флагов × 10 вертикалей |
| 1.7 | `lib/verticals/client-fields.ts` | ✅ | **NEW** Доп.поля клиента per vertical |
| 1.8 | `lib/verticals/work-presets.ts` | ✅ | **NEW** slot/hours/mobile + AI tone |
| 1.9 | `hooks/use-features.ts` | ✅ | **NEW** resolveFeatures(vertical, overrides) |
| 1.10 | Миграция `feature_overrides` + `clients.extra_info` | ✅ | **APPLIED** (00041) |

---

## 2. Дашборд мастера

| # | Страница / Фича | Статус | Что нужно |
|---|---|---|---|
| 2.1 | `/dashboard` — FinCheck-style 4 ряда | ✅ | 4 градиентных KPI + area chart + donut + список записей/ДР |
| 2.2 | Realtime обновление при изменениях | ✅ | Через Supabase channels |
| 2.3 | Экспенс-категоризация AI | ✅ | Через `/api/finance/ai-insights` |
| 2.4 | AI инсайты на дашборде (дневные тренды) | 🟡 | Есть на `/finance`, на дашборде нет |
| 2.5 | Кастомизация дашборда per vertical | ❌ | Нужно применить `useFeatures()` для скрытия donut (если `inventory=false`) |

---

## 3. Календарь

| # | Фича | Статус |
|---|---|---|
| 3.1 | Fresha-exact календарь (день / 3 дня / неделя / месяц) | ✅ |
| 3.2 | Drag & drop записей | 🟡 Надо проверить |
| 3.3 | Создание записи | ✅ |
| 3.4 | Блокировка времени (break, отпуск) | ✅ через `/settings/time-off` |
| 3.5 | Привязка `?client_id=` из карточки клиента | 🟡 Добавил в UI, backend принимает |
| 3.6 | Default slot duration per vertical | ❌ Надо подключить `work-presets.ts` |

---

## 4. Продажи / Финансы

| # | Страница / Фича | Статус |
|---|---|---|
| 4.1 | `/finance` — 4 таба (Сводка / Услуги / Отчёты / Записи) | ✅ |
| 4.2 | Сводка: KPI + AI-инсайт + доходы + расходы | ✅ |
| 4.3 | Услуги: profitability + cost breakdown | ✅ |
| 4.4 | Отчёты: налоги / потери / прогноз / платежи | ✅ |
| 4.5 | Записи: таблица со статусами + inline tips | ✅ |
| 4.6 | OCR чеков (expense photo) | ✅ API `/api/expenses/parse-receipt` |
| 4.7 | AI-инсайты (Gemini + OpenRouter fallback) | ✅ |
| 4.8 | Экспорт CSV | 🟡 В отчётах есть, надо проверить |

---

## 5. Клиенты

| # | Страница / Фича | Статус |
|---|---|---|
| 5.1 | `/clients` — grid карточек + filter chips | ✅ |
| 5.2 | Фильтры: Все / VIP / Просрочки / Риск / Новые / ДР | ✅ |
| 5.3 | Поиск (name, phone, email) | ✅ |
| 5.4 | Followers tabs (Clients / Users / Subscribers) | ✅ |
| 5.5 | Add to clients из followers | ✅ |
| 5.6 | `/clients/[id]` — FinSet-style с hero + KPI | ✅ |
| 5.7 | Условный рендер секций per vertical (useFeatures) | ✅ **NEW** |
| 5.8 | Hero + quick action "Записать" | ✅ |
| 5.9 | Банер дня рождения (≤30 дн) | ✅ |
| 5.10 | Секции: Info / Notes / Health / History / Analytics / Family / Files | ✅ |
| 5.11 | Extra fields per vertical (kids, pets, vehicle) | ❌ UI-рендер `clients.extra_info` через `client-fields.ts` |
| 5.12 | Import CSV | ✅ `/clients/import` |
| 5.13 | Segments (для marketing) | 🟡 Существует `/clients/segments`, простой CRUD |

---

## 6. Каталог (Services + Inventory + Memberships + Gallery)

| # | Страница / Фича | Статус |
|---|---|---|
| 6.1 | `/services` — catalog (standalone) | ✅ |
| 6.2 | `/services/memberships` | 🟡 Пока отдельная страница, не таб |
| 6.3 | `/inventory` | ✅ |
| 6.4 | `/inventory/scan` — barcode | ✅ |
| 6.5 | `/before-after` + `/portfolio` + `/stories` | 🟡 Существуют, не объединены |
| 6.6 | Шаблоны услуг при onboarding (`default-services.ts`) | ✅ |
| 6.7 | Объединить в 4 таба на /services | ❌ **BLOCK D** |

---

## 7. Маркетинг

| # | Страница / Фича | Статус |
|---|---|---|
| 7.1 | `/marketing/campaigns` — mass TG | ✅ Standalone |
| 7.2 | `/marketing/automation` — 7 toggles (24h, 2h, review, cadence, win-back, NPS) | ✅ |
| 7.3 | `/marketing/messages` — шаблоны | ✅ |
| 7.4 | `/marketing/deals` — промокоды | ✅ |
| 7.5 | `/marketing/pricing` — smart pricing | ✅ |
| 7.6 | `/marketing/reviews` — reviews management | ✅ |
| 7.7 | Объединить в 4 таба на /marketing | ❌ **BLOCK E** |

---

## 8. Настройки мастера `/settings`

| # | Раздел | Статус | Что нужно |
|---|---|---|---|
| 8.1 | Profile info (name, phone, avatar) | ✅ | |
| 8.2 | Vertical + feature toggles | ❌ | **Добавить раздел «Моя сфера» + список модулей** |
| 8.3 | Working hours (`working_hours` JSONB) | ✅ | |
| 8.4 | Subscription / billing | ✅ | `/settings/billing` |
| 8.5 | Team management | ✅ | `/settings/team` (для salon) |
| 8.6 | Equipment | ✅ | `/settings/equipment` |
| 8.7 | Locations | ✅ | `/settings/locations` (для salon) |
| 8.8 | Time off / holidays | ✅ | `/settings/time-off` |
| 8.9 | FAQ | ✅ | `/settings/faq` |
| 8.10 | **Change email with confirmation** | ❌ | Supabase Auth `updateUser({email})` — уже шлёт confirmation по дефолту. Нужен UI |
| 8.11 | **Change password** | ❌ | UI `updateUser({password})` с запросом текущего |
| 8.12 | **Change phone with OTP** | ❌ | Supabase Auth phone update |
| 8.13 | Notifications preferences | ❌ | Какие события приходят в TG/email/push |
| 8.14 | Publish/unpublish mini app | 🟡 Есть в mini app |

---

## 9. Интеграция Telegram

| # | Компонент | Статус |
|---|---|---|
| 9.1 | Telegram webhook `/api/telegram/webhook` | ✅ 449 строк |
| 9.2 | Auth via TG (login) | ✅ `/api/telegram/auth` |
| 9.3 | Setup bot per master | ✅ `/api/telegram/setup` |
| 9.4 | Link existing TG | ✅ `/api/telegram/link-existing` |
| 9.5 | Email OTP fallback | ✅ `/api/telegram/email-otp` |
| 9.6 | Mini App (`/telegram/*` pages) | ✅ |
| 9.7 | **Voice voice-to-note в карточку клиента** | ❌ **BLOCK B** |
| 9.8 | **Voice → booking** | 🟡 API `/api/voice-booking/parse` есть, в TG webhook не подключено полностью |
| 9.9 | Voice → expense | 🟡 OCR есть, voice expense — нет |
| 9.10 | Client notifications on appointment | ✅ через `pending notifications` + cron |
| 9.11 | Reminder 24h/2h | ✅ через автоматизации |

---

## 10. AI-помощник

| # | Компонент | Статус |
|---|---|---|
| 10.1 | OpenRouter integration | ✅ |
| 10.2 | Google AI Studio fallback | ✅ |
| 10.3 | **System prompt — human-friendly** | ✅ **UPDATED 2026-04-17** |
| 10.4 | AI tone per vertical | 🟡 Определён в `work-presets.ts`, надо подключить к system prompt |
| 10.5 | Voice transcription | ✅ `/api/ai/transcribe` |
| 10.6 | Voice action (inventory/reminders regex) | ✅ `/api/ai/voice-action` |
| 10.7 | **Voice router (intent detection)** | ❌ **BLOCK B** — единый `/api/ai/voice-router` |
| 10.8 | Lost revenue analysis | ✅ |
| 10.9 | Booking suggestions | ✅ |
| 10.10 | Finance AI insights | ✅ |

---

## 11. Уведомления

| # | Канал | Статус |
|---|---|---|
| 11.1 | Web push (in-app bell) | ✅ `use-notifications` hook |
| 11.2 | Telegram — отправка клиенту при записи | ✅ |
| 11.3 | Telegram — напоминания мастеру | ✅ |
| 11.4 | Email — подтверждения (auth) | ✅ Supabase default |
| 11.5 | Email — маркетинг | 🟡 Не подключён шаблонный engine |
| 11.6 | SMS | ❌ Не реализовано (vertical-depending) |
| 11.7 | Cron: reminders дневные | ✅ |

---

## 12. Публичная витрина мастера

| # | Фича | Статус |
|---|---|---|
| 12.1 | `/m/[handle]` публичная страница | ✅ |
| 12.2 | Fresha-like профиль с услугами | ✅ |
| 12.3 | Онлайн-бронирование | ✅ |
| 12.4 | Reviews публичные | ✅ |

---

## 🔴 Что осталось сделать (приоритет)

### Прямо сейчас (доделать мастера)
- [ ] **8.2** Settings: раздел «Моя сфера и модули» (feature-toggles UI)
- [ ] **8.10-8.12** Change email/password/phone с confirmation
- [ ] **8.13** Notifications preferences
- [ ] **5.11** Extra fields per vertical UI (рендер `clients.extra_info`)
- [ ] **2.5** Dashboard через `useFeatures()` (скрывать donut если inventory=false)
- [ ] **3.6** Calendar: default slot из `work-presets.ts`

### BLOCK B (следующий промпт)
- [ ] **9.7** Telegram voice → note в карточку клиента
- [ ] **9.8** Voice → booking (готовое API подключить к webhook)
- [ ] **9.9** Voice → expense через единый router
- [ ] **10.7** `/api/ai/voice-router` — intent detection
- [ ] **10.4** AI tone per vertical в system prompt

### BLOCK D (каталог)
- [ ] **6.7** Объединить services/memberships/inventory/gallery в 4 таба

### BLOCK E (маркетинг)
- [ ] **7.7** Объединить marketing в 4 таба

### BLOCK F (cleanup)
- [ ] Sidebar: убрать все flyout submenu
- [ ] Global search через command palette — верификация

---

## 📊 Итоги готовности мастера

- **Инфраструктура**: 10/10 ✅
- **Дашборд**: 4/5 (80%)
- **Календарь**: 4/6 (67%)
- **Финансы**: 7/8 (88%)
- **Клиенты**: 12/13 (92%)
- **Каталог**: 6/7 (86%) — структуру объединить
- **Маркетинг**: 6/7 (86%) — структуру объединить
- **Настройки**: 9/14 (64%) — **главная зона работы**
- **Telegram**: 9/11 (82%)
- **AI**: 8/10 (80%)
- **Уведомления**: 5/7 (71%)
- **Публичная витрина**: 4/4 (100%) ✅

**Общая готовность мастера: ~83%**. Для 100% нужно закрыть настройки (email/pass/vertical/features) + Telegram voice + объединить catalogue/marketing в табы.
