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

export function buildSupplierOrderPDF(input: SupplierOrderPDFInput): Uint8Array {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();

  // Header
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  doc.text('CRES-CA', 40, 50);

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(input.masterName, 40, 68);

  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text(`Supplier order #${input.orderNumber}`, 40, 110);

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`Date: ${input.orderDate}`, 40, 128);

  doc.setFont('helvetica', 'bold');
  doc.text('Supplier:', 40, 156);
  doc.setFont('helvetica', 'normal');
  doc.text(input.supplierName, 110, 156);
  let y = 172;
  if (input.supplierContact) { doc.text(`Contact: ${input.supplierContact}`, 40, y); y += 14; }
  if (input.supplierPhone) { doc.text(`Phone: ${input.supplierPhone}`, 40, y); y += 14; }
  if (input.supplierEmail) { doc.text(`Email: ${input.supplierEmail}`, 40, y); y += 14; }

  const total = input.items.reduce((s, it) => s + it.total, 0);

  autoTable(doc, {
    startY: y + 12,
    head: [['Item', 'Qty', 'Unit', 'Unit price', 'Total']],
    body: input.items.map((it) => [
      it.name,
      it.quantity.toString(),
      it.unit,
      it.unit_price.toFixed(2),
      it.total.toFixed(2),
    ]),
    foot: [['', '', '', 'TOTAL', `${total.toFixed(2)} ${input.currency}`]],
    headStyles: { fillColor: [15, 16, 17], textColor: 255 },
    footStyles: { fillColor: [240, 240, 240], textColor: 0, fontStyle: 'bold' },
    styles: { fontSize: 10, cellPadding: 6 },
    theme: 'grid',
  });

  if (input.note) {
    const finalY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY;
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text('Note:', 40, finalY + 30);
    doc.setFont('helvetica', 'normal');
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
  doc.setFont('helvetica', 'bold');
  doc.text('CRES-CA', 72, footerY + 4);
  doc.setFont('helvetica', 'normal');
  doc.text('Management system for beauty & service masters', 72, footerY + 16);
  doc.text('cres-ca.com', pageW - 40, footerY + 10, { align: 'right' });

  return doc.output('arraybuffer') as unknown as Uint8Array;
}
