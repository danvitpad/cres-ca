/** --- YAML
 * name: renderTemplate
 * description: Простой рендер шаблонов сообщений — подставляет {переменные} из контекста. Используется cron-джобами для reminders/thanks/win_back. Поддерживает раздельные subject + body (gmail-style).
 * created: 2026-04-13
 * updated: 2026-04-25
 * --- */

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
