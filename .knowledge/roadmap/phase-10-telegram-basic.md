# PHASE 10: TELEGRAM MINI APP (Basic)

> Loading web app inside Telegram, auth via Telegram, deep links. **Full native integration in Phase 23.**

- [x] **10.1 — Telegram Mini App entry point**
  - **Create:** `src/app/telegram/page.tsx`
  - **What:** A special page that loads inside Telegram WebView. It:
    1. Reads `window.Telegram.WebApp` SDK
    2. Gets `initData` from Telegram
    3. Validates initData server-side
    4. Creates/finds user by telegram_id
    5. Sets Supabase session
    6. Redirects to appropriate UI (client: `/book`, master: `/calendar`)

- [x] **10.2 — Telegram auth validation API**
  - **Create:** `src/app/api/telegram/auth/route.ts`
  - **What:** POST endpoint that validates Telegram Mini App `initData`.
  - **Validation:** HMAC-SHA256 as per Telegram docs (https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app)
  - **Returns:** Supabase access token (sign JWT with service role or use signInAnonymously + link)

- [x] **10.3 — Telegram Web App SDK integration**
  - **Create:** `src/lib/telegram/webapp.ts`
  - **What:** Basic helper to interact with `window.Telegram.WebApp`:
    - `getTelegramUser()` → user data
    - `showMainButton(text, onClick)` → Telegram main button
    - `hapticFeedback()` → vibration
    - `close()` → close mini app
  - **Script tag:** Add `<script src="https://telegram.org/js/telegram-web-app.js?62">` to Telegram entry layout
  - **NOTE:** This is a minimal version. Phase 23 rewrites this with full typed SDK covering fullscreen, safe areas, biometrics, CloudStorage, LocationManager, payments, etc.

- [x] **10.4 — Deep link handling**
  - **What:** When user opens `t.me/CresCABot?start=master_ABC123`:
    1. Bot receives `/start master_ABC123`
    2. Bot sends message with "Open App" button (Mini App URL with params)
    3. Mini App opens → reads params → links client to master

- [x] **10.5 — Verify Phase 10**
  - Mini App loads in Telegram. Auth works. Navigation works. Deep links work.
  - `npm run build` passes
