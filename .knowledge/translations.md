# Translation Keys Reference

When adding new features, add translation keys to **all three** files: `uk.json`, `ru.json`, `en.json`.

## Naming convention
`section.keyName` (camelCase)

Examples:
- `auth.signIn`, `auth.signUp`, `auth.fullName`
- `dashboard.calendar`, `dashboard.clients`
- `calendar.dayView`, `calendar.newAppointment`
- `clients.addClient`, `clients.visitHistory`
- `booking.selectService`, `booking.bookNow`
- `nav.helpSupport`, `nav.support`
- `footer.about`, `footer.pricing`

## Template
```json
{
  "section": {
    "keyName": "Translation text"
  }
}
```

## Locales
- `uk` — Ukrainian (default)
- `ru` — Russian
- `en` — English

## Rule
**NEVER hardcode UI text.** All strings go through `useTranslations()` from `next-intl`.
