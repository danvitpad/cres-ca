# Supabase Auth Email Templates

Branded HTML email templates for CRES-CA, locale-aware (ru/en/uk).

## How it works

Each template uses Go template conditionals to switch language based on
`{{ .Data.locale }}`. When calling Supabase auth methods, pass `data.locale`
in `options`:

```ts
await supabase.auth.resetPasswordForEmail(email, { data: { locale: 'ru' } });
await supabase.auth.signUp({
  email, password,
  options: { data: { locale: 'ru', role, full_name } },
});
```

The login page (`src/app/[locale]/(auth)/login/page.tsx`) automatically extracts
locale from the URL prefix (`/ru`, `/en`, `/uk`) and passes it along.

If `.Data.locale` is missing or unknown — template falls back to Russian.

## Files → Supabase Dashboard mapping

Supabase Dashboard → Project Settings → Auth → Email Templates

| File | Paste into |
|------|------------|
| `confirm-signup.html` | "Confirm signup" template |
| `reset-password.html` | "Reset password" template |
| `change-email.html` | "Change email address" template |
| `magic-link.html` | "Magic Link" template (optional — only if enabling passwordless) |

For each template in the Dashboard:
1. Copy the full HTML file contents.
2. Paste into the template body.
3. Set the subject line (see below).
4. Save.

## Recommended subject lines

Plain strings, not localized — Supabase does not template-interpolate subjects
with `{{ .Data.locale }}` reliably, so keep them in Russian or bilingual:

- Confirm signup: `Подтверждение регистрации / Confirm your email — CRES-CA`
- Reset password: `Сброс пароля / Password reset — CRES-CA`
- Change email: `Подтверждение нового email / Confirm new email — CRES-CA`
- Magic link: `Вход в CRES-CA / Sign in to CRES-CA`

## Template variables

| Variable | Present in | Meaning |
|----------|-----------|---------|
| `{{ .Token }}` | signup, reset-password | 6–8 digit OTP |
| `{{ .ConfirmationURL }}` | all | Full URL with token |
| `{{ .Email }}` | all | Recipient email |
| `{{ .NewEmail }}` | change-email only | New email being confirmed |
| `{{ .SiteURL }}` | all | Your project's Site URL (Dashboard → Auth → URL config) |
| `{{ .Data.locale }}` | all | Locale hint passed via `options.data` |

## Brand colors

- Primary violet: `#6950f3`
- Light violet (hover): `#5840e0`
- Background: `#f4f2fa`
- Foreground: `#1a1530`
- Muted foreground: `#4d4466`

All inline for email-client compatibility. No external CSS.

## Account deletion notice (not a Supabase template)

The 30-day soft-delete flow does NOT send an email from Supabase. If you want
to notify users that deletion is imminent, add a cron job (e.g., day 25 after
deletion) that uses a transactional service (Resend, Postmark) or extends
`/api/cron/account-purge/route.ts` to send a reminder before purging.
