# Open Design CSS Files — Index

Все CSS-файлы — литеральный перенос правил из соответствующих
`*.html` файлов в `D:\nexu-open-design\open-design\.od\projects\
4e1d6ab1-f2dd-4503-8591-f6eb5812876b\` (только мобильный экран).

Каждый файл — изолированный scope (`.od-<page>`) чтобы правила
не утекали в другие места. Токены OD замаплены на наши
`--m-*` CSS-переменные чтобы темы Telegram (light/dark) работали.

## Карта file → page

| OD-файл | Наш CSS | Скоуп класса | Применено в |
|---|---|---|---|
| master-dashboard.html | od-master-dashboard.css | `.od-master-dashboard` | `app/src/app/telegram/m/home/page.tsx` |
| master-clients.html | od-master-clients.css | `.od-master-clients` | `app/src/app/telegram/m/clients/page.tsx` |
| master-services.html | od-master-services.css | `.od-master-services` | `app/src/app/telegram/m/services/page.tsx` |
| master-calendar.html | od-master-calendar.css | `.od-master-calendar` | `app/src/app/telegram/m/calendar/page.tsx` |
| master-finances.html | od-master-finances.css | `.od-master-finances` | `app/src/app/telegram/m/stats/page.tsx` |
| master-inventory.html | od-master-inventory.css | `.od-master-inventory` | `app/src/app/telegram/m/inventory/page.tsx` |
| master-suppliers.html | od-master-suppliers.css | `.od-master-suppliers` | `app/src/app/telegram/m/suppliers/page.tsx` |
| master-marketing.html | od-master-marketing.css | `.od-master-marketing` | `app/src/app/telegram/m/marketing/page.tsx` |
| master-partners.html | od-master-partners.css | `.od-master-partners` | `app/src/app/telegram/m/partners/page.tsx` |
| master-waitlist.html | od-master-waitlist.css | `.od-master-waitlist` | `app/src/app/telegram/m/waitlist/page.tsx` |
| master-templates.html | od-master-templates.css | `.od-master-templates` | `app/src/app/telegram/m/templates/page.tsx` |
| master-loyalty.html | od-master-loyalty.css | `.od-master-loyalty` | _страница не реализована_ |
| master-ai.html | od-master-ai.css | `.od-master-ai` | `app/src/app/telegram/m/ai/page.tsx` |
| master-onboarding.html | od-master-onboarding.css | `.od-master-onboarding` | `app/src/app/telegram/m/onboarding/page.tsx` |
| master-schedule.html | od-master-schedule.css | `.od-master-schedule` | `app/src/app/telegram/m/settings/schedule/page.tsx` |
| master-settings.html | od-master-settings.css | `.od-master-settings` | `app/src/app/telegram/m/settings/page.tsx` |
| master-public-page.html | od-master-public-page.css | `.od-master-public-page` | `app/src/app/telegram/m/public-page/page.tsx` |
| salon-dashboard.html | od-salon-dashboard.css | `.od-salon-dashboard` | `app/src/app/telegram/m/salon/[id]/dashboard/page.tsx` |
| salon-calendar.html | od-salon-calendar.css | `.od-salon-calendar` | `app/src/app/telegram/m/salon/[id]/calendar/page.tsx` |
| salon-finances.html | _нет mobile_ | — | переиспользует od-master-finances |
| salon-team.html | _нет mobile_ | — | переиспользует od-master-clients |
| client-mini-app.html | od-client-mini-app.css | `.od-client-mini-app` | `app/src/app/telegram/(app)/home/page.tsx` |
| client-booking-flow.html | od-client-booking-flow.css | `.od-client-booking-flow` | `app/src/app/telegram/(app)/book/page.tsx` |
| client-master-page.html | od-client-master-page.css | `.od-client-master-page` | `app/src/app/telegram/(app)/search/[id]/page.tsx` |
| client-notifications.html | od-client-notifications.css | `.od-client-notifications` | `app/src/app/telegram/(app)/notifications/page.tsx` |
| client-settings.html | od-client-settings.css | `.od-client-settings` | `app/src/app/telegram/(app)/settings/page.tsx` |
| auth-login-register.html | od-auth-login-register.css | `.od-auth-login-register` | `app/src/app/telegram/login/page.tsx`, `register/page.tsx` |
| welcome-landing.html | od-welcome-landing.css | `.od-welcome-landing` | `app/src/app/telegram/welcome/page.tsx` |

## Принцип

1. **Каждый CSS-файл** — копия мобильной секции из эталонной OD HTML.
   В шапке есть YAML с описанием и ссылкой на строки оригинала.
2. **Скоуп класса** оборачивает страницу — правила не утекают.
3. **Токены OD** (`--od-accent`, `--od-fg`, `--od-surface`, etc.) определены
   в `:root` каждого scope и замаплены на наши `--m-*` переменные.
4. **Литеральные класс-нэйминги** — `.service-row`, `.ip-fab`, `.chip`,
   `.apt-card`, etc. — взяты прямо из OD HTML, чтобы JSX можно было
   переписывать с минимумом изменений.

## Применение в новой странице

```tsx
import '@/styles/od-<page>.css';

return (
  <div className="od-<page> ...">
    {/* JSX с литеральными OD class names */}
    <div className="service-row">
      <span className="service-color-bar" />
      <div className="service-info">...</div>
      <button className="sw on" />
    </div>
  </div>
);
```
