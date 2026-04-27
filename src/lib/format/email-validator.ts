/** --- YAML
 * name: isDisposableEmail
 * description: Проверяет email на принадлежность одноразовому/временному домену.
 *              Supabase + Resend тихо отбрасывают такие письма из-за anti-abuse защиты —
 *              пользователь никогда не получит код подтверждения. Лучше предупредить
 *              его до signup-запроса, чем посадить ждать у пустого поля.
 * created: 2026-04-27
 * --- */

// Курированный список самых популярных одноразовых email-сервисов.
// Не претендует на полноту — главное закрыть верх списка (temp-mail.org со всеми
// его доменами + mailinator + остальные топ-10).
const DISPOSABLE_DOMAINS = new Set([
  // Temp Mail (temp-mail.org) — крутит сотни доменов, ниже самые частые
  'hacknapp.com',
  'wpkedu.com',
  'tempmail.com',
  'tempmail.dev',
  'tempmail.email',
  'tempmail.net',
  'tempmail.org',
  'temp-mail.org',
  'temp-mail.io',
  'tempmailo.com',
  'tempmailaddress.com',
  'tempmail.us.com',
  // Mailinator (классика)
  'mailinator.com',
  'mailinator.net',
  'mailinator.org',
  'maildrop.cc',
  // 10 Minute Mail
  '10minutemail.com',
  '10minutemail.net',
  '10minutemail.org',
  '10minutemail.de',
  // Guerrilla Mail
  'guerrillamail.com',
  'guerrillamail.net',
  'guerrillamail.org',
  'guerrillamail.de',
  'guerrillamail.biz',
  'sharklasers.com',
  'grr.la',
  // Yopmail
  'yopmail.com',
  'yopmail.fr',
  'yopmail.net',
  // Прочие частые
  'getnada.com',
  'nada.email',
  'trashmail.com',
  'trashmail.de',
  'throwawaymail.com',
  'fakeinbox.com',
  'fakemail.net',
  'mohmal.com',
  'discard.email',
  'spam4.me',
  'emailondeck.com',
  'mintemail.com',
  'mytemp.email',
  'inboxbear.com',
  'tmpmail.org',
  'tmpmail.net',
  'mvrht.net',
  'dispostable.com',
  'mailcatch.com',
  'tempinbox.com',
  'instantemailaddress.com',
  'mailnesia.com',
  'spambox.us',
  'jetable.org',
]);

/**
 * Возвращает true если email принадлежит одноразовому домену из блок-листа.
 * Регистр игнорируется. Проверяет точное совпадение домена (после @).
 */
export function isDisposableEmail(email: string): boolean {
  const at = email.lastIndexOf('@');
  if (at < 0) return false;
  const domain = email.slice(at + 1).trim().toLowerCase();
  return DISPOSABLE_DOMAINS.has(domain);
}
