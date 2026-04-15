/** --- YAML
 * name: Error Mapper
 * description: Centralized mapping of API error codes to human-readable Russian messages for Mini App UI.
 * created: 2026-04-14
 * updated: 2026-04-14
 * --- */

const MESSAGES: Record<string, string> = {
  // Validation
  missing_init_data: 'Не удалось получить данные Telegram',
  invalid_init_data: 'Данные Telegram не прошли проверку',
  missing_phone: 'Укажите номер телефона',
  invalid_phone: 'Введите корректный номер телефона',
  missing_name: 'Укажите имя и фамилию',
  missing_salon_name: 'Укажите название команды',
  missing_email: 'Укажите email',
  invalid_email: 'Некорректный email — используйте латиницу',
  missing_password: 'Придумайте пароль',
  weak_password: 'Пароль должен содержать минимум 8 символов',
  missing_code: 'Введите код',
  missing_post_id: 'Не выбран пост',

  // Auth / registration
  create_failed: 'Не удалось создать аккаунт. Попробуйте снова.',
  email_taken: 'Этот email уже используется — войдите в существующий аккаунт',
  unauthorized: 'Нужно войти в аккаунт',
  not_found: 'Аккаунт с таким email не найден',
  wrong_password: 'Неверный пароль',
  wrong_code: 'Неверный код',
  expired: 'Код истёк — запросите новый',
  too_many_attempts: 'Слишком много попыток — подождите немного',
  already_linked_other: 'Этот аккаунт уже связан с другим Telegram',
  send_failed: 'Не удалось отправить код. Проверьте email и попробуйте ещё раз.',

  // Network / generic
  network_error: 'Нет связи с сервером',
  query_failed: 'Не удалось загрузить данные',
  insert_failed: 'Не удалось сохранить',
  delete_failed: 'Не удалось удалить',
  update_failed: 'Не удалось обновить',

  // Slug
  slug_taken: 'Этот CRES-ID уже занят',
  slug_invalid: 'CRES-ID: только латиница, цифры и _, от 3 до 24 символов',
  invalid_slug: 'CRES-ID: только латиница, цифры и _, от 3 до 24 символов',
};

export function mapError(code: string | null | undefined, fallback = 'Что-то пошло не так'): string {
  if (!code) return fallback;
  return MESSAGES[code] ?? fallback;
}

export function isValidAsciiEmail(email: string): boolean {
  const trimmed = email.trim();
  if (!trimmed) return false;
  // Strict ASCII: letters, digits, dots, dashes, plus, underscores in local; standard domain
  return /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(trimmed);
}

export function isValidSlug(slug: string): boolean {
  return /^[a-z0-9_]{3,24}$/.test(slug);
}
