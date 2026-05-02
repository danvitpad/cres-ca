/** --- YAML
 * name: Supplier Order Message Templates
 * description: Шаблоны сообщения о заказе для поставщика — RU/UK/EN.
 *              Возвращают (subject, body) для email и (text) для Telegram.
 *              Используются в /api/supplier-orders/[id]/dispatch.
 * created: 2026-05-02
 * --- */

import type { SupplierOrderItem } from '@/lib/pdf/supplier-order-pdf';

type Lang = 'ru' | 'uk' | 'en';

interface BuildMessageParams {
  language: Lang;
  orderNumber: string;
  orderDateStr: string;
  masterName: string;
  masterPhone: string | null;
  masterEmail: string | null;
  supplierName: string;
  items: SupplierOrderItem[];
  currency: string;
  note: string | null;
  publicPdfUrl?: string | null;
}

const I18N: Record<Lang, {
  greeting: (supplierName: string) => string;
  intro: (masterName: string, orderNumber: string, dateStr: string) => string;
  itemsHeader: string;
  notesHeader: string;
  totalLabel: string;
  contactsHeader: string;
  phoneLabel: string;
  emailLabel: string;
  pdfHint: string;
  signature: string;
  emailSubject: (orderNumber: string, masterName: string) => string;
}> = {
  ru: {
    greeting: (s) => `Здравствуйте, ${s}!`,
    intro: (m, n, d) =>
      `Это заказ от мастера ${m}.\n` +
      `Номер заказа: №${n}\n` +
      `Дата: ${d}`,
    itemsHeader: 'Позиции:',
    notesHeader: 'Примечание:',
    totalLabel: 'Итого',
    contactsHeader: 'Связаться с мастером:',
    phoneLabel: 'Телефон',
    emailLabel: 'Email',
    pdfHint: 'PDF с полной таблицей и реквизитами:',
    signature: 'Сообщение сформировано через CRES-CA — сервис для мастеров и салонов.',
    emailSubject: (n, m) => `Заказ №${n} — ${m}`,
  },
  uk: {
    greeting: (s) => `Вітаємо, ${s}!`,
    intro: (m, n, d) =>
      `Це замовлення від майстра ${m}.\n` +
      `Номер замовлення: №${n}\n` +
      `Дата: ${d}`,
    itemsHeader: 'Позиції:',
    notesHeader: 'Примітка:',
    totalLabel: 'Разом',
    contactsHeader: "Зв'язатися з майстром:",
    phoneLabel: 'Телефон',
    emailLabel: 'Email',
    pdfHint: 'PDF з повною таблицею та реквізитами:',
    signature: 'Повідомлення сформовано через CRES-CA — сервіс для майстрів і салонів.',
    emailSubject: (n, m) => `Замовлення №${n} — ${m}`,
  },
  en: {
    greeting: (s) => `Hello, ${s}!`,
    intro: (m, n, d) =>
      `New order from ${m}.\n` +
      `Order number: #${n}\n` +
      `Date: ${d}`,
    itemsHeader: 'Items:',
    notesHeader: 'Notes:',
    totalLabel: 'Total',
    contactsHeader: 'Contact the master:',
    phoneLabel: 'Phone',
    emailLabel: 'Email',
    pdfHint: 'Full PDF with table and details:',
    signature: 'Sent via CRES-CA — CRM for service professionals.',
    emailSubject: (n, m) => `Order #${n} — ${m}`,
  },
};

const CURRENCY_SYMBOL: Record<string, string> = {
  UAH: '₴', USD: '$', EUR: '€', PLN: 'zł', KZT: '₸',
};

function fmtMoney(n: number, currency: string): string {
  const sym = CURRENCY_SYMBOL[currency] ?? currency;
  return `${n.toLocaleString('ru-RU', { maximumFractionDigits: 2 })} ${sym}`;
}

export function buildSupplierOrderMessage(params: BuildMessageParams): {
  subject: string;
  text: string;
} {
  const t = I18N[params.language];
  const {
    orderNumber, orderDateStr, masterName, masterPhone, masterEmail,
    supplierName, items, currency, note, publicPdfUrl,
  } = params;

  const itemsBlock = items
    .map((it) => {
      const total = (it.total ?? it.quantity * it.unit_price);
      return `  • ${it.name} × ${it.quantity} ${it.unit} — ${fmtMoney(total, currency)}`;
    })
    .join('\n');

  const total = items.reduce((s, it) => s + (it.total ?? it.quantity * it.unit_price), 0);

  const contactsBlock = [
    masterPhone ? `${t.phoneLabel}: ${masterPhone}` : null,
    masterEmail ? `${t.emailLabel}: ${masterEmail}` : null,
  ].filter(Boolean).join('\n');

  const lines: string[] = [
    t.greeting(supplierName),
    '',
    t.intro(masterName, orderNumber, orderDateStr),
    '',
    t.itemsHeader,
    itemsBlock,
    '',
    `${t.totalLabel}: ${fmtMoney(total, currency)}`,
  ];
  if (note && note.trim()) {
    lines.push('', t.notesHeader, note.trim());
  }
  if (contactsBlock) {
    lines.push('', t.contactsHeader, contactsBlock);
  }
  if (publicPdfUrl) {
    lines.push('', t.pdfHint, publicPdfUrl);
  }
  lines.push('', '—', t.signature);

  return {
    subject: t.emailSubject(orderNumber, masterName),
    text: lines.join('\n'),
  };
}

/**
 * Прямая отправка в Telegram через нашего бота. Работает только если
 * supplier.telegram_id содержит numeric chat_id и поставщик когда-либо
 * писал боту (иначе TG возвращает 403). При неудаче возвращает null —
 * вызывающий код делает fallback на t.me/share/url.
 */
export async function trySendToSupplierViaBot(params: {
  chatId: string | null;
  pdfBytes: Uint8Array;
  pdfFilename: string;
  caption: string;
}): Promise<{ ok: true; messageId: number } | { ok: false; error: string }> {
  const { chatId, pdfBytes, pdfFilename, caption } = params;
  // Принимаем только числовые chat_id (@username не поддерживается
  // sendDocument'ом без предварительной коммуникации).
  if (!chatId || !/^-?\d+$/.test(chatId.trim())) {
    return { ok: false, error: 'not_numeric_chat_id' };
  }
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return { ok: false, error: 'no_bot_token' };

  // Telegram Bot API требует multipart/form-data для документов
  const form = new FormData();
  form.append('chat_id', chatId.trim());
  form.append('caption', caption.slice(0, 1024)); // TG лимит на caption
  form.append('parse_mode', 'HTML');
  form.append(
    'document',
    new Blob([pdfBytes as unknown as ArrayBuffer], { type: 'application/pdf' }),
    pdfFilename,
  );

  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendDocument`, {
      method: 'POST',
      body: form,
    });
    const data = await res.json();
    if (!data.ok) {
      // 403 = поставщик не начинал чат с ботом → fallback нужен
      return { ok: false, error: data.description || 'tg_send_failed' };
    }
    return { ok: true, messageId: data.result?.message_id ?? 0 };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}
