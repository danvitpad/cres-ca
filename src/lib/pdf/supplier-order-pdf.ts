/** --- YAML
 * name: Supplier Order PDF
 * description: Генерация накладной поставщику в PDF через jspdf + autotable.
 *              Принимает order + items + supplier + masterName. Возвращает Buffer.
 * created: 2026-04-19
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

export interface SupplierOrderPDFInput {
  orderNumber: string;
  orderDate: string;
  masterName: string;
  supplierName: string;
  supplierContact?: string | null;
  supplierPhone?: string | null;
  supplierEmail?: string | null;
  items: SupplierOrderItem[];
  currency: string;
  note?: string | null;
}

const FONT_NAME = 'PTSans';

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
    doc.addFont('PTSans-Regular.ttf', FONT_NAME, 'bold'); // same file, bold emulated via size/weight
    return FONT_NAME;
  } catch {
    return 'helvetica';
  }
}

export function buildSupplierOrderPDF(input: SupplierOrderPDFInput): Uint8Array {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();

  const font = registerFont(doc);

  // Header
  doc.setFont(font, 'bold');
  doc.setFontSize(20);
  doc.text('CRES-CA', 40, 50);

  doc.setFontSize(10);
  doc.setFont(font, 'normal');
  doc.text(input.masterName, 40, 68);

  doc.setFontSize(16);
  doc.setFont(font, 'bold');
  doc.text(`Заказ поставщику №${input.orderNumber}`, 40, 110);

  doc.setFontSize(10);
  doc.setFont(font, 'normal');
  doc.text(`Дата: ${input.orderDate}`, 40, 128);

  doc.setFont(font, 'bold');
  doc.text('Поставщик:', 40, 156);
  doc.setFont(font, 'normal');
  doc.text(input.supplierName, 120, 156);
  let y = 172;
  if (input.supplierContact) { doc.text(`Контакт: ${input.supplierContact}`, 40, y); y += 14; }
  if (input.supplierPhone) { doc.text(`Телефон: ${input.supplierPhone}`, 40, y); y += 14; }
  if (input.supplierEmail) { doc.text(`Email: ${input.supplierEmail}`, 40, y); y += 14; }

  const total = input.items.reduce((s, it) => s + it.total, 0);

  autoTable(doc, {
    startY: y + 12,
    head: [['Наименование', 'Кол-во', 'Ед.', 'Цена', 'Сумма']],
    body: input.items.map((it) => [
      it.name,
      it.quantity.toString(),
      it.unit,
      it.unit_price.toFixed(2),
      it.total.toFixed(2),
    ]),
    foot: [['', '', '', 'ИТОГО', `${total.toFixed(2)} ${input.currency}`]],
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
    doc.text('Примечание:', 40, finalY + 30);
    doc.setFont(font, 'normal');
    doc.text(doc.splitTextToSize(input.note, 500), 40, finalY + 44);
  }

  // Footer with CRES-CA logo
  const logo = loadLogoBase64();
  const footerY = pageH - 56;
  doc.setDrawColor(220);
  doc.line(40, footerY - 10, pageW - 40, footerY - 10);
  if (logo) {
    try { doc.addImage(logo, 'PNG', 40, footerY - 4, 24, 24); } catch { /* ignore */ }
  }
  doc.setFontSize(9);
  doc.setTextColor(120);
  doc.setFont(font, 'bold');
  doc.text('CRES-CA', 72, footerY + 4);
  doc.setFont(font, 'normal');
  doc.text('CRM для мастеров и салонов', 72, footerY + 16);
  doc.text('cres-ca.com', pageW - 40, footerY + 10, { align: 'right' });

  return doc.output('arraybuffer') as unknown as Uint8Array;
}
