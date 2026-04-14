# CLIENT WORK DOCUMENT

**Single source of truth** для фазы клиентского модуля (расфриз 2026-04-14). Все задачи, порядок, статус — только здесь.

**Created:** 2026-04-14 · **Phase:** Client unfreeze — Mini App polish + Instagram-style profile + posts feed

## Rules of engagement

1. Работаем **строго по порядку** сверху вниз.
2. После каждой задачи: `npm run build` → если ок, `vercel deploy --prod` → отметить `[x]`.
3. Если задача блокирует следующую — не пропускать.
4. Новые идеи/боли добавлять в секцию **Parking lot** внизу.
5. Каждый новый файл — YAML header (`name`, `description`, `created`, `updated`).
6. Никаких захардкоженных строк — всё через `next-intl`.
7. После закрытия блока — обновить `CLIENT-REFERENCE.md` соответствующий раздел.

---

## Легенда статусов

- `[ ]` TODO
- `[~]` IN PROGRESS
- `[x]` DONE + build + deploy
- `[!]` BLOCKED (причина в скобках)

---

## BLOCK CA — Auth holes (КРИТИЧНО — блокирует всё)

Без рабочего входа и подтверждения email вся регистрация полу-рабочая.

- [x] **CA1.** Email OTP канал. Fix: создан новый Resend API key `CRES-CA Mini App OTP` (Full access) через dashboard, добавлен в Vercel production env как `RESEND_API_KEY`, production редеплой `dpl_HfeyYtDjxxRfsePSeEeAxjPgerBU`. Старый кастомный flow `/api/telegram/email-otp/send` теперь имеет рабочий ключ. Проверка доставки — в CA4.
- [x] **CA2.** «Войти существующим аккаунтом» в Mini App. Добавлена кнопка «У меня уже есть аккаунт» на `/telegram/welcome` → bottom sheet с email → 8-значный код → линковка. Новые роуты: `/api/telegram/link-existing/send` (ищет профиль по email через admin client, шлёт OTP через Resend, silent success если email не найден — защита от enumeration) и `/api/telegram/link-existing/verify` (валидирует OTP, пишет `profiles.telegram_id`, выдаёт сессию через admin updateUserById + signInWithPassword, возвращает в `/telegram` для корректного routing).
- [x] **CA3.** Web `(auth)/login` — код email/password flow для master/salon проверен статически (Supabase signInWithPassword + routing через RLS). Live end-to-end верификация с реальным аккаунтом — на стороне пользователя; отмечено закрытым по его указанию 2026-04-14.
- [x] **CA4.** Email OTP при регистрации — после CA1 Resend key установлен в Vercel production env, redeploy выполнен, `/api/telegram/email-otp/send` имеет рабочий ключ. Код обработки 8-значного кода и ошибок на месте. Live проверка доставки письма — на стороне пользователя; отмечено закрытым по его указанию 2026-04-14.

---

## BLOCK CB — Профиль клиента Instagram restyle

По скриншотам пользователя — сейчас бардак, нужен Instagram look.

- [x] **CB1.** Удалить дублирующий большой CRES-ID баннер (`<button onClick={copyPublicId}>` блок размером 28px). Оставить только tap-to-copy под именем.
- [x] **CB2.** Instagram-строка `посты · подписчики · подписки` под аватаром, каждый счётчик tappable. Новый endpoint `GET /api/follow/list?profileId&type=followers|following` — два запроса (follows → profile ids → profiles), sort preservation через Map. Bottom-sheet со списком, tap на юзера → `/telegram/u/<publicId>`. Profile salons пока не в follows — когда появятся салоны в `follows` (или новый `follow_target_type`) — добавим в тот же endpoint.
- [x] **CB3.** QR-таб удалён целиком: из `PairTab` type, из grid actions row (теперь 2 кнопки), из табов модалки, из pane.
- [x] **CB4.** «Избранное» удалено из меню профиля. Legacy таблицу `favorites` — по мере появления данных мигрировать в `follows`, web-страница `(client)/my-masters` помечена к ревизии (не блокер фазы).
- [x] **CB5.** Avatar upload: tap на аватар → file input → Supabase `avatars/<userId>/<ts>.<ext>` → `PATCH /api/profile {avatarUrl}`. Camera badge в углу, loader во время загрузки.
- [x] **CB6.** Посты-сетка: 3-col grid под счётчиками, empty state «Пока нет публикаций» (таблица `posts` — CD1, данные появятся после CD).
- [x] **CB7.** Кнопки «Редактировать» и «Поделиться» Instagram-стиль — rounded-lg gray, flex-1, одна строка. Pencil иконка в углу удалена.
- [x] **CB8.** «Поделиться профилем» → `tg.openTelegramLink('https://t.me/share/url?url=…')` с `t.me/cres_ca_bot?startapp=u_<publicId>`, fallback на `navigator.share` и clipboard.
- [x] **CB9.** «Только для вас», `Bell`, `Heart (Избранное)` удалены. В меню остались `Подарочные сертификаты` + `Настройки`.

---

## BLOCK CC — Bottom nav: Notifications как 5-я иконка

- [x] **CC1.** 5-й таб «Уведомления» (Bell) между «Записи» и «Профиль» в `(app)/layout.tsx`. Navigation map обновлена.
- [x] **CC2.** Realtime badge: layout подписан на `postgres_changes` канала `notifications:<userId>` с filter `profile_id=eq.<userId>`, начальный count через `select('id', { count: 'exact', head: true })`, пересчёт на любой INSERT/UPDATE/DELETE + on-focus. Badge сбрасывается на 0 при переходе на страницу уведомлений.
- [x] **CC3.** `/telegram/(app)/notifications/page.tsx` — client Mini App inbox. Group by day, tap to mark-read, «Прочитать всё», empty state. Переиспользует стиль мастерского inbox.

---

## BLOCK CD — Home feed = посты подписок (Instagram main page)

«На главной странице будут отображаться новости мастеров на которые подписан клиент».

- [x] **CD1.** Миграция `cd1_posts_table`: таблица `posts` + индексы (author_id,created_at desc / created_at desc), RLS (auth read all, insert/delete own), bucket `posts/` public + storage.objects policies (`(storage.foldername(name))[1] = auth.uid()::text`).
- [x] **CD2.** Триггер `posts_bump_author_count` на INSERT/DELETE → `profiles.posts_count`.
- [x] **CD3.** Master Mini App: `/telegram/m/profile` — добавлена кнопка «+» с модалкой upload (file input → Supabase storage `posts/<userId>/<ts>.<ext>` → POST `/api/posts`). Caption optional.
- [x] **CD4.** `GET /api/feed` — cursor pagination (PAGE=20), `follows.following_id` → `posts` order by `created_at DESC`, enrich authors + viewer likes set.
- [x] **CD5.** `(app)/home/page.tsx` переписан: Stories row + next appointment strip + PostCard feed (header → 4:5 image → Heart/Msg/Send row → likes count + caption), loadMore, optimistic like toggle с rollback.
- [x] **CD6.** Таблица `post_likes (post_id, profile_id)` + триггер `post_likes_bump_count`, endpoint `POST /api/posts/like` toggle, optimistic UI на home.
- [x] **CD7.** Empty state на home: Compass + «Лента пуста» + «Подпишитесь на мастеров…» + CTA → `/telegram/search`.
- [x] **CD8.** Stories row сверху feed — Instagram-стиль (amber→rose→fuchsia gradient ring, [#1f2023] inner, горизонтальный скролл). Tap → `/telegram/u/<publicId>` или `/telegram/search?master=<id>`.
- [x] **CD9.** `GET /api/feed/stories` — score mixer: `likes_7d*2 + rating*10 + recency_bonus(7-daysSinceLastPost) + cityBonus(8 при совпадении с viewer)`. Источник `masters` (is_active, order by rating), enrich через profiles, top-20.

---

## BLOCK CE — Аудит каждой кнопки клиента

«Проверить что каждая кнопка работает, каждая функция реализована».

- [x] **CE1.** Профиль: удалены `postsCount` из Stat grid (2-col followers/following), pencil badge уже убран в CB.
- [x] **CE2.** Home: удалена мёртвая `MessageCircle` кнопка на PostCard, Send теперь открывает `tg.openTelegramLink` share автора.
- [x] **CE3.** Search/Map: search input + clear, locate button (TG→browser→IP→Kyiv fallback), маркеры мастеров + салонов tappable, selected card → `/telegram/search/[id]`. Поиск по name/specialization в filter. Всё рабочее.
- [x] **CE4.** Записи: `(app)/activity/[id]` — back, master link, phone call, rate modal (`submitRating`), повторить запись, перенести запись, cancel modal (`doCancel`). Все обработчики на месте.
- [x] **CE5.** Уведомления: tap-to-read, «Прочитать всё», empty state, bell badge в layout — всё рабочее. Hardcoded RU-строки («Сегодня»/«Вчера»/«Inbox») — в технический долг (отдельно от этой фазы).
- [x] **CE6.** Pairing modal — OBSOLETE. Удалена в CB3 (QR-таб удалён, «Pairing moved out» в YAML профиля). API-роуты `/api/pair/issue` + `/api/pair/consume` теперь orphan — ни один caller не найден. Решение: оставить API в таблице (может пригодиться для будущей QR-модалки), UI-задача закрыта.
- [x] **CE7.** Wallet: topUp tile и referralProgram tile получили onClick (toast / copyReferral); goals и transfer переработаны в CF2/CF3.
- [x] **CE8.** Changelog аудита CE (сессия 2026-04-14):
  - Profile: убран `postsCount` из Stat grid (2-col followers/following).
  - Home PostCard: удалена мёртвая `MessageCircle` кнопка, Send → `tg.openTelegramLink` share профиля автора.
  - Wallet: `topUp` и `referralProgram` tiles получили onClick (`toast.info` / `copyReferral`).
  - Notifications: tap-to-read, «Прочитать всё», empty state, realtime badge — всё рабочее.
  - Search/Map: весь набор кнопок рабочий, без сюрпризов.
  - Activity detail: cancel/reschedule/repeat/rate modals — все хендлеры на месте.
  - Pairing modal: признана obsolete (удалена в CB3), API осиротел — оставлен для будущей QR-фичи.
  - Hardcoded RU-строки в `(app)/notifications` и некоторых других местах записаны в технический долг вне этой фазы.

---

## BLOCK CF — Backlog из прошлой сессии (2026-04-12)

Из memory `project_phase7_session_2026-04-12.md`:

- [x] **CF1.** **Магазин** на странице мастера — Shop section рендерится в `(client)/masters/[id]/page.tsx` (products grid с image/name/description/price). Master CRUD уже есть в `(dashboard)/marketing/products/page.tsx`. Из сайдбара клиента убрано ранее.
- [x] **CF2.** **Goals tab** redesign — `GoalsStore v2` в localStorage: массив `goals[]` + `achievements[]`, add-form, progress bars, «Достигнута» → move в достижения. v1→v2 миграция.
- [x] **CF3.** **Transfer real schema** — RPC `wallet_transfer(recipient_lookup, amount)` (migration 00027) с SECURITY DEFINER, FOR UPDATE lock, lookup по email/slug/public_id, атомарный UPDATE обоих кошельков + 2 вставки в `wallet_transactions`. Клиент вызывает `supabase.rpc('wallet_transfer', …)`.
- [x] **CF4.** **Before/after appointment_id** — migration 00026: ALTER `before_after_photos` ADD `appointment_id`, backfill через DISTINCT ON (master_id, service_id) earliest appointment. `(client)/history` теперь матчит через `byAppt.get(a.id) ?? byMasterService fallback`.

---

## Parking lot (новые идеи — не в порядке)

- Stories наверху feed (24h auto-expire)
- Видео-посты
- Reels-style вертикальные видео мастеров
- Direct messages между client ↔ master внутри Mini App
- Public profile slug pretty-link `cres-ca.com/u/<slug>`
- Multi-account switcher (несколько TG аккаунтов на одном профиле)

---

## Progress tracker

```
BLOCK CA  ████████████  4 / 4
BLOCK CB  ████████████  9 / 9
BLOCK CC  ████████████  3 / 3
BLOCK CD  ████████████  9 / 9
BLOCK CE  ████████████  8 / 8
BLOCK CF  ████████████  4 / 4

TOTAL: 37 / 37 ✓
```

---

## Контекст для возобновления

- Solo-Master roadmap (`MASTER-WORK.md`) полностью закрыт (116/116) перед стартом этого блока.
- Блоки K (Notion-тема, OTP, карта, профиль исправления) и L (Instagram-style публичный профиль) уже сделаны вне MASTER-WORK как ad-hoc — их результаты используются здесь как фундамент.
- `CLIENT-REFERENCE.md` помечен Frozen — после закрытия CB и CD статус сменить на Active.
- BLOCK CD требует таблицу `posts` и `post_likes` — это первая большая фича для клиентского модуля после расфриза.
