/** --- YAML
 * name: renderTemplate
 * description: Простой рендер шаблонов сообщений — подставляет {переменные} из контекста. Используется cron-джобами для reminders/thanks/win_back. Поддерживает раздельные subject + body (gmail-style) и локализованные fallback'и по publicLanguage мастера.
 * created: 2026-04-13
 * updated: 2026-04-26
 * --- */

export type PublicLanguage = 'ru' | 'uk' | 'en';

export type TemplateContext = Record<string, string | number | null | undefined>;

export function renderTemplate(tpl: string, ctx: TemplateContext): string {
  return tpl.replace(/\{(\w+)\}/g, (_, key) => {
    const v = ctx[key];
    return v == null ? '' : String(v);
  });
}

export function pickTemplate<T extends { content: string; is_active: boolean }>(
  templates: T[] | null | undefined,
  fallback: string,
): string {
  const active = (templates ?? []).filter((t) => t.is_active);
  if (active.length === 0) return fallback;
  return active[0].content;
}

/** Active row's subject + body, with per-kind fallback when row is missing or column is NULL. */
export function pickFullTemplate<
  T extends { subject: string | null; content: string; is_active: boolean },
>(
  templates: T[] | null | undefined,
  fallbackBody: string,
  fallbackSubject: string | null = null,
): { subject: string | null; body: string } {
  const active = (templates ?? []).filter((t) => t.is_active);
  if (active.length === 0) return { subject: fallbackSubject, body: fallbackBody };
  return {
    subject: active[0].subject ?? fallbackSubject,
    body: active[0].content,
  };
}

/** Render both subject and body against the same context. */
export function renderFullTemplate(
  tpl: { subject: string | null; body: string },
  ctx: TemplateContext,
): { subject: string | null; body: string } {
  return {
    subject: tpl.subject ? renderTemplate(tpl.subject, ctx) : null,
    body: renderTemplate(tpl.body, ctx),
  };
}

/** Локализованный fallback для cron'ов. Если мастер не задал свой шаблон —
 *  cron берёт строку на его publicLanguage. UK/EN опциональны: если нет —
 *  возвращаем RU как универсальный дефолт.
 */
export function pickLocalizedFallback(
  lang: PublicLanguage | string | null | undefined,
  fallbacks: Partial<Record<PublicLanguage, string>>,
): string {
  const safe: PublicLanguage = (lang === 'uk' || lang === 'en') ? lang : 'ru';
  return fallbacks[safe] ?? fallbacks.ru ?? Object.values(fallbacks)[0] ?? '';
}

/** Same idea для full-template (subject + body) fallback. */
export function pickLocalizedFullFallback(
  lang: PublicLanguage | string | null | undefined,
  fallbacks: Partial<Record<PublicLanguage, { subject?: string | null; body: string }>>,
): { subject: string | null; body: string } {
  const safe: PublicLanguage = (lang === 'uk' || lang === 'en') ? lang : 'ru';
  const f = fallbacks[safe] ?? fallbacks.ru ?? Object.values(fallbacks)[0]!;
  return { subject: f.subject ?? null, body: f.body };
}
