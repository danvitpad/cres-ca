/** --- YAML
 * name: Finance report export (PDF / Excel / CSV)
 * description: GET /api/reports/export?format=pdf|excel|csv&from=YYYY-MM-DD&to=YYYY-MM-DD
 *              Возвращает финансовый отчёт мастера за период — выручка, расходы, прибыль, таблицы записей и расходов.
 * created: 2026-04-19
 * --- */

import { NextResponse } from 'next/server';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import ExcelJS from 'exceljs';
import { createClient } from '@/lib/supabase/server';
import { registerCyrillicFont } from '@/lib/pdf/font';

interface PaymentRow {
  id: string;
  amount: number;
  currency: string;
  created_at: string;
  appointment: {
    service: { name: string | null } | { name: string | null }[] | null;
  } | {
    service: { name: string | null } | { name: string | null }[] | null;
  }[] | null;
}

function extractServiceName(p: PaymentRow): string {
  const apt = Array.isArray(p.appointment) ? p.appointment[0] : p.appointment;
  if (!apt) return '—';
  const svc = Array.isArray(apt.service) ? apt.service[0] : apt.service;
  return svc?.name ?? '—';
}

interface ExpenseRow {
  id: string;
  amount: number;
  currency: string;
  category: string | null;
  description: string | null;
  date: string;
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const format = (searchParams.get('format') ?? 'pdf').toLowerCase();
  const from = searchParams.get('from') ?? new Date(Date.now() - 30 * 864e5).toISOString().slice(0, 10);
  const to = searchParams.get('to') ?? new Date().toISOString().slice(0, 10);

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const { data: master } = await supabase
    .from('masters')
    .select('id, display_name, profile:profiles!masters_profile_id_fkey(full_name)')
    .eq('profile_id', user.id)
    .maybeSingle();
  if (!master) return NextResponse.json({ error: 'no master profile' }, { status: 400 });

  const mRow = master as { id: string; display_name: string | null; profile: { full_name: string | null } | { full_name: string | null }[] | null };
  const profile = Array.isArray(mRow.profile) ? mRow.profile[0] : mRow.profile;
  const masterName = mRow.display_name ?? profile?.full_name ?? 'Master';

  const [{ data: payments }, { data: expenses }] = await Promise.all([
    supabase
      .from('payments')
      .select('id, amount, currency, created_at, appointment:appointments(service:services(name))')
      .eq('master_id', mRow.id)
      .eq('status', 'completed')
      .gte('created_at', from)
      .lte('created_at', `${to}T23:59:59.999Z`)
      .order('created_at'),
    supabase
      .from('expenses')
      .select('id, amount, currency, category, description, date')
      .eq('master_id', mRow.id)
      .gte('date', from)
      .lte('date', to)
      .order('date'),
  ]);

  const payRows = (payments as unknown as PaymentRow[]) ?? [];
  const expRows = (expenses as unknown as ExpenseRow[]) ?? [];
  const revenue = payRows.reduce((s, p) => s + Number(p.amount ?? 0), 0);
  const expenseTotal = expRows.reduce((s, e) => s + Number(e.amount ?? 0), 0);
  const profit = revenue - expenseTotal;
  const currency = payRows[0]?.currency ?? expRows[0]?.currency ?? 'UAH';

  const filename = `finance-${from}-${to}`;

  if (format === 'csv') {
    const lines: string[] = [];
    lines.push('Section,Date,Description,Amount,Currency');
    payRows.forEach((p) => {
      const svcName = extractServiceName(p);
      lines.push(`Income,${p.created_at.slice(0, 10)},"${svcName.replace(/"/g, '""')}",${p.amount},${p.currency}`);
    });
    expRows.forEach((e) => {
      lines.push(`Expense,${e.date},"${(e.description ?? e.category ?? '').replace(/"/g, '""')}",${e.amount},${e.currency}`);
    });
    lines.push(`Summary,${to},Revenue,${revenue},${currency}`);
    lines.push(`Summary,${to},Expenses,${expenseTotal},${currency}`);
    lines.push(`Summary,${to},Profit,${profit},${currency}`);
    return new NextResponse(lines.join('\n'), {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}.csv"`,
      },
    });
  }

  if (format === 'excel' || format === 'xlsx') {
    const wb = new ExcelJS.Workbook();
    const summary = wb.addWorksheet('Summary');
    summary.addRow([`CRES-CA — ${masterName}`]);
    summary.addRow([`Period: ${from} to ${to}`]);
    summary.addRow([]);
    summary.addRow(['Revenue', revenue, currency]);
    summary.addRow(['Expenses', expenseTotal, currency]);
    summary.addRow(['Profit', profit, currency]);

    const income = wb.addWorksheet('Income');
    income.columns = [
      { header: 'Date', key: 'date', width: 14 },
      { header: 'Service', key: 'service', width: 30 },
      { header: 'Amount', key: 'amount', width: 14 },
      { header: 'Currency', key: 'currency', width: 10 },
    ];
    payRows.forEach((p) => {
      income.addRow({ date: p.created_at.slice(0, 10), service: extractServiceName(p), amount: p.amount, currency: p.currency });
    });

    const exp = wb.addWorksheet('Expenses');
    exp.columns = [
      { header: 'Date', key: 'date', width: 14 },
      { header: 'Category', key: 'category', width: 18 },
      { header: 'Description', key: 'description', width: 32 },
      { header: 'Amount', key: 'amount', width: 14 },
      { header: 'Currency', key: 'currency', width: 10 },
    ];
    expRows.forEach((e) => {
      exp.addRow({ date: e.date, category: e.category ?? '—', description: e.description ?? '', amount: e.amount, currency: e.currency });
    });

    const buf = await wb.xlsx.writeBuffer();
    return new NextResponse(new Uint8Array(buf as ArrayBuffer), {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filename}.xlsx"`,
      },
    });
  }

  // PDF
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  // Подключаем PTSans (Cyrillic). Если файл шрифта недоступен —
  // упадём на helvetica и тексты на русском станут крякозябрами,
  // но мы хотя бы не упадём целиком.
  const FONT = registerCyrillicFont(doc);
  doc.setFont(FONT, 'bold');
  doc.setFontSize(20);
  doc.text('CRES-CA', 40, 50);
  doc.setFontSize(10);
  doc.setFont(FONT, 'normal');
  doc.text(masterName, 40, 68);

  doc.setFontSize(16);
  doc.setFont(FONT, 'bold');
  doc.text('Финансовый отчёт', 40, 110);
  doc.setFontSize(10);
  doc.setFont(FONT, 'normal');
  doc.text(`Период: ${from} — ${to}`, 40, 128);

  autoTable(doc, {
    startY: 150,
    head: [['Показатель', 'Значение']],
    body: [
      ['Выручка', `${revenue.toFixed(2)} ${currency}`],
      ['Расходы', `${expenseTotal.toFixed(2)} ${currency}`],
      ['Прибыль', `${profit.toFixed(2)} ${currency}`],
    ],
    headStyles: { fillColor: [15, 16, 17], textColor: 255, font: FONT, fontStyle: 'bold' },
    styles: { fontSize: 11, cellPadding: 6, font: FONT },
    theme: 'grid',
  });

  type DocWithY = jsPDF & { lastAutoTable: { finalY: number } };
  let y = (doc as DocWithY).lastAutoTable.finalY + 24;
  doc.setFont(FONT, 'bold');
  doc.setFontSize(12);
  doc.text('Доходы', 40, y);
  y += 10;
  autoTable(doc, {
    startY: y,
    head: [['Дата', 'Услуга', 'Сумма']],
    body: payRows.map((p) => [p.created_at.slice(0, 10), extractServiceName(p), `${Number(p.amount).toFixed(2)} ${p.currency}`]),
    headStyles: { fillColor: [15, 16, 17], textColor: 255, font: FONT, fontStyle: 'bold' },
    styles: { fontSize: 9, cellPadding: 4, font: FONT },
    theme: 'grid',
  });

  y = (doc as DocWithY).lastAutoTable.finalY + 24;
  doc.setFont(FONT, 'bold');
  doc.setFontSize(12);
  doc.text('Расходы', 40, y);
  y += 10;
  autoTable(doc, {
    startY: y,
    head: [['Дата', 'Категория', 'Описание', 'Сумма']],
    body: expRows.map((e) => [e.date, e.category ?? '—', e.description ?? '', `${Number(e.amount).toFixed(2)} ${e.currency}`]),
    headStyles: { fillColor: [15, 16, 17], textColor: 255, font: FONT, fontStyle: 'bold' },
    styles: { fontSize: 9, cellPadding: 4, font: FONT },
    theme: 'grid',
  });

  const bytes = doc.output('arraybuffer') as ArrayBuffer;
  return new NextResponse(new Uint8Array(bytes), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}.pdf"`,
    },
  });
}
