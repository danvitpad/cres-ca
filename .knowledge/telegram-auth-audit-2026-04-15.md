---
name: Telegram Auth Audit
description: A7 — полный аудит telegram-auth flow для всех 3 ролей (client / master / salon_admin). Reporting, not fix.
created: 2026-04-15
---

# A7 — Telegram Auth Audit для 3 ролей

## Scope
Проверить, что Telegram Mini App auth корректно работает для client, master, salon_admin. Это reporting — фиксы делаются отдельными задачами.

---

## 1. Entry flow (`/telegram/page.tsx`)

**Проверено:** строки 13-133.

Последовательность:
1. Ждёт `window.Telegram.WebApp` до 4сек.
2. `webapp.initData` → POST `/api/telegram/auth` с initData.
3. Response: `{linked, needsRegistration, userId, role, tier, ...}`.
4. Routing:
   - `linked && !needsRegistration` → по role:
     - `client` → `/telegram/home`
     - `master` | `salon_admin` → `/telegram/m/home` ✅
     - deep-link `u_<publicId>` → `/telegram/u/<raw>`
     - deep-link `master_<id>` → `/telegram/home?master=<id>`
   - `linked && needsRegistration` (нет телефона) → `/telegram/register`
   - `!linked` → `/telegram/welcome`

**Вердикт:** entry flow **корректен для всех 3 ролей**. salon_admin обрабатывается точно как master (`(role === 'master' || role === 'salon_admin') → /telegram/m/home`), что логично — у салона тоже мастерский dashboard.

---

## 2. Auth API (`/api/telegram/auth/route.ts`)

**Проверено:** строки 1-100.

- HMAC validation через `TELEGRAM_BOT_TOKEN` — стандартная telegram schema, корректная.
- Lookup по `profiles.telegram_id`:
  - Не нашлось → `{linked: false, needsRegistration: true, tgData: {...}}`
  - Нашлось → читает `profile.role` + tier из `subscriptions` → возвращает всё.
- **role возвращается как есть** (enum `client | master | salon_admin | receptionist`).

**Вердикт:** API работает **для всех ролей без дискриминации**. Никакой whitelisting. ✅

---

## 3. Register flow (`/api/telegram/register/route.ts` + `/telegram/register/page.tsx`)

**Проверено:** API строки 64-76, page строки 37, 267-298.

**⚠️ FINDING 1 — salon_admin НЕ может зарегистрироваться через Telegram.**

```ts
// API route.ts:75-76
role?: 'client' | 'master';   // Тип ограничен
const safeRole: 'client' | 'master' = role === 'master' ? 'master' : 'client';
```

```tsx
// register/page.tsx:37
const [role, setRole] = useState<'client' | 'master'>('client');
// UI (267-298) — только 2 кнопки: Client / Master
```

**Интерпретация:**
- Регистрация салона через Mini App **намеренно запрещена** — в UI только 2 кнопки, API type тоже narrow.
- salon_admin может **только войти** через Telegram, если его профиль уже создан через web `/register` → `/onboarding/account-type`.
- Это **дизайн-решение**, не баг: салон = сложная сущность (название, адрес, часовой пояс, команда), requires onboarding wizard, который в Mini App не реализован.

**Статус:** `[?]` — требует явного подтверждения от Данила, что это намеренно.

**Рекомендация:** либо
  - (а) задокументировать в CLAUDE.md / PROJECT-JOURNAL.md, что salon_admin web-only registration,
  - (б) добавить 3-ю кнопку «Салон» в `/telegram/register` + расширить API → ведёт на короткий wizard салона.

---

## 4. Link-existing flow (`/api/telegram/link-existing/*`)

**Проверено:** `verify/route.ts:65,124` + `password/route.ts:67,103`.

- `link-existing/verify` — лукап профиля по email (после 8-значного OTP), читает `role` и возвращает как есть.
- `link-existing/password` — альтернативный путь (через пароль), тот же принцип.

**Вердикт:** salon_admin и любая другая роль **корректно линкуется**. Flow берёт роль из существующего профиля, не навязывает свою. ✅

**Путь для салона:** web register → onboarding/create-business → (позже) открывает Mini App → `/telegram/welcome` → «У меня уже есть аккаунт» → link-existing с email/password → Mini App знает о salon_admin → роутит на `/telegram/m/home`. **Работает.**

---

## 5. Middleware bypass

**Проверено:** `src/middleware.ts:101`.

```ts
matcher: ['/((?!api|_next|_vercel|telegram|.*\\..*).*)'],
```

**Важно:** `/telegram/**` **полностью исключено** из middleware. Это намеренно:
- Telegram Mini App auth = HMAC через `initData`, не Supabase-cookies.
- Каждая страница в `/telegram/*` сама полагается на `useAuthStore` (zustand, persist в localStorage).
- Страницы без `/telegram/` prefix проходят стандартный Supabase auth через middleware.

**Потенциальная уязвимость:**
- Если localStorage `auth-store` подделать (`{userId, role, tier}`), направить браузер на `/telegram/m/home` — страница рендерится **без серверной проверки**.
- Но любой запрос к `/api/*` всё равно пойдёт через Supabase RLS. Подделка localStorage **не даёт** реального доступа к данным — RLS ловит на уровне БД.
- Уязвимость ограничена UI-spoof (показать клиенту интерфейс мастера без реальных данных).

**Вердикт:** архитектурно приемлемо для MVP. Для prod-level security стоит добавить server-side HMAC revalidation в `page.tsx` каждого `/telegram/*` экрана. **Не срочно.**

---

## 6. Routing matrix

| Role | Web `/login` | Mini App entry | Mini App register |
|---|---|---|---|
| **client** | ✅ → `/feed` | ✅ → `/telegram/home` | ✅ 2-кнопочный picker |
| **master** | ✅ → `/calendar` | ✅ → `/telegram/m/home` | ✅ 2-кнопочный picker |
| **salon_admin** | ✅ → `/calendar` | ✅ → `/telegram/m/home` (если уже создан через web) | ❌ **нет UI** (FINDING 1) |

---

## 7. Bugs / issues found

### FINDING 1 (design?) — salon_admin registration not available in Mini App
- **File:** `src/app/api/telegram/register/route.ts:75-78`, `src/app/telegram/register/page.tsx:37,267-298`
- **Impact:** владелец салона, заходящий впервые через Telegram, не может создать аккаунт. Должен сначала использовать web `/register`.
- **Action:** подтвердить с Данилом — задуманная механика или нет.

### FINDING 2 (observation, not bug) — Phone required for ALL roles
- `register/route.ts:81` — `if (!phone) return missing_phone`
- В web `/register` (новый после A4) phone — optional поле. В Mini App — required.
- **Impact:** расхождение UX, потенциальная путаница при кросс-platform регистрации.
- **Action:** унифицировать: либо phone обязателен везде, либо optional везде.

### FINDING 3 (low priority) — No HMAC revalidation on Mini App pages
- `middleware.ts:101` — telegram routes bypass middleware.
- **Impact:** UI-level spoof возможен (реальных данных нет из-за RLS).
- **Action:** для prod — добавить server-side `validateInitData()` в каждую `/telegram/*` Server Component, или перевести страницы на Server Components с initData в cookies/headers.

### FINDING 4 (quality) — Error messages hardcoded Russian
- `page.tsx:31,46,58` — `'Откройте это приложение из Telegram'`, `'Нет данных инициализации'`, etc.
- **Impact:** нарушение §4 rules (next-intl everywhere).
- **Action:** перенести в `messages/*.json` → часть I18N-1 батча `/telegram/*`.

---

## 8. Вердикт

**Flow для 3 ролей работает**, кроме одного design gap:

- ✅ `client` — полная поддержка (web + Mini App register + entry + link-existing).
- ✅ `master` — полная поддержка.
- ⚠️ `salon_admin` — **Mini App register недоступен**, но entry / link-existing / роутинг работают. Нужно решение: фича или bug.

**Нет критических security-багов.** RLS защищает данные даже при UI-spoof.

**Action items (новые задачи для TaskList):**
- `A7-FIX-1` — решить: добавить salon_admin в Mini App register или явно задокументировать web-only.
- `A7-FIX-2` — унифицировать phone required/optional между web и Mini App register.
- `A7-FIX-3` — добавить server-side HMAC revalidation на страницы `/telegram/*` (prod security, low prio).
- `A7-FIX-4` — перенести hardcoded RU в `/telegram/page.tsx` в i18n (часть I18N-1).

---

**Audit completed:** 2026-04-15.
