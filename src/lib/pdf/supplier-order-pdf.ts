/** --- YAML
 * name: Supplier Order PDF
 * description: Накладная поставщику в PDF (jspdf + autotable).
 *              Layout 4-блочный: «Заказ №…» сверху-слева, дата сверху-справа,
 *              блок «Заказчик» под заказом, блок «Поставщик» под датой,
 *              далее таблица позиций с итоговой строкой. Footer — бренд CRESCA
 *              + сайт + ссылка на TG-менеджера поддержки. Локализация i18n
 *              по публичному языку мастера (ru / uk / en).
 * created: 2026-04-19
 * updated: 2026-04-26
 * --- */

import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import fs from 'node:fs';
import path from 'node:path';

export interface SupplierOrderItem {
  name: string;
  quantity: number;
  unit: string;
  unit_price: number;
  total: number;
}

export type PublicLanguage = 'ru' | 'uk' | 'en';

export interface SupplierOrderPDFInput {
  orderNumber: string;
  orderDate: string;
  /** Заказчик — мастер */
  masterName: string;
  masterPhone?: string | null;
  masterEmail?: string | null;
  /** Поставщик */
  supplierName: string;
  supplierContact?: string | null;
  supplierPhone?: string | null;
  supplierEmail?: string | null;
  items: SupplierOrderItem[];
  currency: string;
  note?: string | null;
  /** Публичный язык мастера — определяет все надписи в PDF. Default 'ru'. */
  language?: PublicLanguage;
}

const FONT_NAME = 'PTSans';

const STRINGS: Record<PublicLanguage, {
  orderNumber: string;
  orderDate: string;
  customer: string;
  supplier: string;
  phone: string;
  email: string;
  contact: string;
  itemName: string;
  qty: string;
  unit: string;
  price: string;
  total: string;
  totalRow: string;
  note: string;
  brand: string;
  brandTagline: string;
  support: string;
}> = {
  ru: {
    orderNumber: 'Заказ №',
    orderDate: 'Дата:',
    customer: 'Заказчик',
    supplier: 'Поставщик',
    phone: 'Тел.:',
    email: 'Email:',
    contact: 'Контакт:',
    itemName: 'Наименование',
    qty: 'Кол-во',
    unit: 'Ед.',
    price: 'Цена',
    total: 'Сумма',
    totalRow: 'ИТОГО',
    note: 'Примечание:',
    brand: 'CRESCA',
    brandTagline: '',
    support: 'Поддержка:',
  },
  uk: {
    orderNumber: 'Замовлення №',
    orderDate: 'Дата:',
    customer: 'Замовник',
    supplier: 'Постачальник',
    phone: 'Тел.:',
    email: 'Email:',
    contact: 'Контакт:',
    itemName: 'Найменування',
    qty: 'К-сть',
    unit: 'Од.',
    price: 'Ціна',
    total: 'Сума',
    totalRow: 'РАЗОМ',
    note: 'Примітка:',
    brand: 'CRESCA',
    brandTagline: '',
    support: 'Підтримка:',
  },
  en: {
    orderNumber: 'Order #',
    orderDate: 'Date:',
    customer: 'Customer',
    supplier: 'Supplier',
    phone: 'Phone:',
    email: 'Email:',
    contact: 'Contact:',
    itemName: 'Item',
    qty: 'Qty',
    unit: 'Unit',
    price: 'Price',
    total: 'Total',
    totalRow: 'TOTAL',
    note: 'Note:',
    brand: 'CRESCA',
    brandTagline: '',
    support: 'Support:',
  },
};

/** Cache logo as base64 data URL (read once per cold start) */
let _logoCache: string | null = null;
function loadLogoBase64(): string | null {
  if (_logoCache !== null) return _logoCache;
  try {
    const p = path.join(process.cwd(), 'public', 'icon-192.png');
    const buf = fs.readFileSync(p);
    _logoCache = `data:image/png;base64,${buf.toString('base64')}`;
    return _logoCache;
  } catch {
    _logoCache = '';
    return null;
  }
}

/** Cache font bytes (read once per cold start) */
let _fontCache: string | null = null;
function loadFontBase64(): string | null {
  if (_fontCache !== null) return _fontCache;
  try {
    const p = path.join(process.cwd(), 'public', 'fonts', 'PTSans-Regular.ttf');
    const buf = fs.readFileSync(p);
    _fontCache = buf.toString('base64');
    return _fontCache;
  } catch {
    _fontCache = '';
    return null;
  }
}

/** Register Cyrillic-capable font if available; return the font name to use. */
function registerFont(doc: jsPDF): string {
  const base64 = loadFontBase64();
  if (!base64) return 'helvetica';
  try {
    doc.addFileToVFS('PTSans-Regular.ttf', base64);
    doc.addFont('PTSans-Regular.ttf', FONT_NAME, 'normal');
    doc.addFont('PTSans-Regular.ttf', FONT_NAME, 'bold');
    return FONT_NAME;
  } catch {
    return 'helvetica';
  }
}

const SUPPORT_TG = 'https://t.me/cres_ca_bot?start=support';
const SITE_URL = 'cresca.com';

export function buildSupplierOrderPDF(input: SupplierOrderPDFInput): Uint8Array {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const lang: PublicLanguage = input.language ?? 'ru';
  const S = STRINGS[lang];

  const font = registerFont(doc);

  const marginLeft = 40;
  const marginRight = 40;
  const colWidth = (pageW - marginLeft - marginRight) / 2;
  const colLeftX = marginLeft;
  const colRightX = marginLeft + colWidth + 16;

  // ─── Top row: «Заказ №…» (left) + «Дата:…» (right) ───
  doc.setFont(font, 'bold');
  doc.setFontSize(20);
  doc.setTextColor(0);
  doc.text(`${S.orderNumber}${input.orderNumber}`, colLeftX, 56);
  doc.text(`${S.orderDate} ${input.orderDate}`, colRightX, 56);

  // ─── Two info blocks (Customer / Supplier) ───
  const blockY = 96;
  doc.setFontSize(11);
  doc.setFont(font, 'bold');
  doc.setTextColor(110);
  doc.text(S.customer.toUpperCase(), colLeftX, blockY);
  doc.text(S.supplier.toUpperCase(), colRightX, blockY);

  doc.setTextColor(0);
  // Customer block
  let lY = blockY + 18;
  doc.setFont(font, 'bold');
  doc.setFontSize(13);
  doc.text(input.masterName, colLeftX, lY);
  doc.setFont(font, 'normal');
  doc.setFontSize(10);
  doc.setTextColor(60);
  if (input.masterPhone) { lY += 14; doc.text(`${S.phone} ${input.masterPhone}`, colLeftX, lY); }
  if (input.masterEmail) { lY += 13; doc.text(`${S.email} ${input.masterEmail}`, colLeftX, lY); }

  // Supplier block
  doc.setFont(font, 'bold');
  doc.setFontSize(13);
  doc.setTextColor(0);
  let rY = blockY + 18;
  doc.text(input.supplierName, colRightX, rY);
  doc.setFont(font, 'normal');
  doc.setFontSize(10);
  doc.setTextColor(60);
  if (input.supplierContact) { rY += 14; doc.text(`${S.contact} ${input.supplierContact}`, colRightX, rY); }
  if (input.supplierPhone)   { rY += 13; doc.text(`${S.phone} ${input.supplierPhone}`, colRightX, rY); }
  if (input.supplierEmail)   { rY += 13; doc.text(`${S.email} ${input.supplierEmail}`, colRightX, rY); }

  doc.setTextColor(0);

  // ─── Items table ───
  const total = input.items.reduce((s, it) => s + it.total, 0);
  const tableStartY = Math.max(lY, rY) + 24;

  autoTable(doc, {
    startY: tableStartY,
    head: [[S.itemName, S.qty, S.unit, S.price, S.total]],
    body: input.items.map((it) => [
      it.name,
      it.quantity.toString(),
      it.unit,
      it.unit_price.toFixed(2),
      it.total.toFixed(2),
    ]),
    foot: [['', '', '', S.totalRow, `${total.toFixed(2)} ${input.currency}`]],
    headStyles: { fillColor: [15, 16, 17], textColor: 255, font, fontStyle: 'bold' },
    footStyles: { fillColor: [240, 240, 240], textColor: 0, font, fontStyle: 'bold' },
    bodyStyles: { font, fontStyle: 'normal' },
    styles: { fontSize: 10, cellPadding: 6, font },
    theme: 'grid',
  });

  if (input.note) {
    const finalY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY;
    doc.setFontSize(10);
    doc.setFont(font, 'bold');
    doc.text(S.note, marginLeft, finalY + 30);
    doc.setFont(font, 'normal');
    doc.text(doc.splitTextToSize(input.note, pageW - marginLeft - marginRight), marginLeft, finalY + 44);
  }

  // ─── Footer: бренд CRESCA + сайт + ссылка на TG-менеджера поддержки ───
  const logo = loadLogoBase64();
  const footerY = pageH - 56;
  doc.setDrawColor(220);
  doc.line(marginLeft, footerY - 10, pageW - marginRight, footerY - 10);
  if (logo) {
    try { doc.addImage(logo, 'PNG', marginLeft, footerY - 4, 24, 24); } catch { /* ignore */ }
  }
  doc.setFontSize(11);
  doc.setTextColor(0);
  doc.setFont(font, 'bold');
  doc.text(S.brand, marginLeft + 32, footerY + 6);

  doc.setFont(font, 'normal');
  doc.setFontSize(9);
  doc.setTextColor(120);
  doc.text(SITE_URL, pageW - marginRight, footerY + 2, { align: 'right' });
  doc.textWithLink(`${S.support} ${SUPPORT_TG}`, pageW - marginRight, footerY + 16, {
    align: 'right',
    url: SUPPORT_TG,
  });

  return doc.output('arraybuffer') as unknown as Uint8Array;
}

/** Sanitize a string for use as a filename (latin-friendly + transliteration of cyrillic). */
const TRANSLIT: Record<string, string> = {
  'а': 'a', 'б': 'b', 'в': 'v', 'г': 'g', 'д': 'd', 'е': 'e', 'ё': 'e', 'ж': 'zh',
  'з': 'z', 'и': 'i', 'й': 'i', 'к': 'k', 'л': 'l', 'м': 'm', 'н': 'n', 'о': 'o',
  'п': 'p', 'р': 'r', 'с': 's', 'т': 't', 'у': 'u', 'ф': 'f', 'х': 'kh', 'ц': 'ts',
  'ч': 'ch', 'ш': 'sh', 'щ': 'shch', 'ъ': '', 'ы': 'y', 'ь': '', 'э': 'e', 'ю': 'yu',
  'я': 'ya', 'і': 'i', 'ї': 'i', 'є': 'e', 'ґ': 'g',
};

export function safeFilename(parts: Array<string | null | undefined>): string {
  return parts
    .map((p) => (p ?? '').toString().toLowerCase().trim())
    .filter(Boolean)
    .map((s) =>
      s
        .split('')
        .map((ch) => TRANSLIT[ch] ?? (TRANSLIT[ch.toLowerCase()] ? '' : ch))
        .join('')
        .replace(/[^a-z0-9_\-+]+/gi, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, ''),
    )
    .filter(Boolean)
    .join('_');
}
