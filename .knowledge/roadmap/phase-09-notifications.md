# PHASE 9: NOTIFICATIONS & REMINDERS

> Telegram bot, push notifications, automated reminders

- [x] **9.1 — Telegram Bot setup**
  - **Create:** `src/lib/telegram/bot.ts`
  - **What:** Functions for Telegram Bot API:
    - `sendMessage(chatId, text, options?)` — send text message
    - `setWebhook(url)` — register webhook URL
  - **Uses:** `fetch('https://api.telegram.org/bot{TOKEN}/sendMessage', ...)`

- [x] **9.2 — Telegram webhook handler**
  - **Create:** `src/app/api/telegram/webhook/route.ts`
  - **What:** Receives Telegram updates. Handles:
    - `/start` command → register user or show welcome
    - `/start master_{invite_code}` → link client to master (insert into `client_master_links`)
    - Text messages → show help

- [x] **9.3 — Notification sender cron**
  - **Create:** `src/app/api/cron/notifications/route.ts`
  - **What:** Called by Vercel Cron every 5 minutes. Fetches pending notifications from `notifications` table where `scheduled_for <= now()`. Sends via Telegram or email. Updates status.
  - **Vercel Cron config** in `vercel.json`:
    ```json
    { "crons": [{ "path": "/api/cron/notifications", "schedule": "*/5 * * * *" }] }
    ```

- [x] **9.4 — Appointment reminder cron**
  - **Create:** `src/app/api/cron/reminders/route.ts`
  - **What:** Called every hour. Finds appointments starting in ~24h and ~2h. Creates notification records in `notifications` table for both client and master.

- [x] **9.5 — Notification when booking is created**
  - **Modify:** booking creation logic (5.4)
  - **What:** After creating appointment, insert notification for master: "New booking: {client_name} on {date} at {time} for {service}"

- [x] **9.6 — "Long time no see" auto-messages (Pro tier)**
  - **Create:** `src/app/api/cron/retention/route.ts`
  - **What:** Weekly cron. For each master (Pro+), find clients whose `last_visit_at` was > their usual interval. Calculate usual interval from appointment history. Create notification: "You haven't visited in a while, book now?"
  - **Gated by:** master must have Pro+ tier

- [x] **9.7 — Verify Phase 9**
  - Telegram bot responds to /start. Reminders are created. Notifications send.
  - `npm run build` passes
