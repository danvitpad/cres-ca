/** --- YAML
 * name: Monthly Financial Report API
 * description: Generates CSV financial report for a given month
 * --- */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const year = parseInt(searchParams.get('year') ?? String(new Date().getFullYear()), 10);
  const month = parseInt(searchParams.get('month') ?? String(new Date().getMonth() + 1), 10);

  const { data: master } = await supabase
    .from('masters')
    .select('id, tax_rate_percent')
    .eq('profile_id', user.id)
    .single();

  if (!master) {
    return NextResponse.json({ error: 'Not a master' }, { status: 403 });
  }

  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 0, 23, 59, 59);

  // Revenue by service
  const { data: appointments } = await supabase
    .from('appointments')
    .select('id, service:services(name, category), payment:payments(amount)')
    .eq('master_id', master.id)
    .eq('status', 'completed')
    .gte('starts_at', startDate.toISOString())
    .lte('starts_at', endDate.toISOString());

  const revenueByCategory: Record<string, number> = {};
  let totalRevenue = 0;

  for (const apt of appointments ?? []) {
    const amount = (apt.payment as unknown as { amount: number } | null)?.amount ?? 0;
    const category = (apt.service as unknown as { name: string; category: string | null })?.category ?? 'Other';
    revenueByCategory[category] = (revenueByCategory[category] ?? 0) + amount;
    totalRevenue += amount;
  }

  // Expenses by category
  const { data: expenses } = await supabase
    .from('expenses')
    .select('amount, category')
    .eq('master_id', master.id)
    .gte('date', startDate.toISOString().split('T')[0])
    .lte('date', endDate.toISOString().split('T')[0]);

  const expensesByCategory: Record<string, number> = {};
  let totalExpenses = 0;

  for (const exp of expenses ?? []) {
    const cat = exp.category ?? 'Other';
    expensesByCategory[cat] = (expensesByCategory[cat] ?? 0) + exp.amount;
    totalExpenses += exp.amount;
  }

  // Inventory usage
  const { data: usage } = await supabase
    .from('inventory_usage')
    .select('quantity_used, item:inventory_items!inner(name, cost_per_unit)')
    .gte('recorded_at', startDate.toISOString())
    .lte('recorded_at', endDate.toISOString());

  let inventoryCost = 0;
  const usageLines: { name: string; qty: number; cost: number }[] = [];

  for (const u of usage ?? []) {
    const item = u.item as unknown as { name: string; cost_per_unit: number };
    const cost = u.quantity_used * (item?.cost_per_unit ?? 0);
    inventoryCost += cost;
    usageLines.push({ name: item?.name ?? '?', qty: u.quantity_used, cost });
  }

  const taxRate = master.tax_rate_percent ?? 5;
  const netProfit = totalRevenue - totalExpenses - inventoryCost;
  const taxEstimate = netProfit > 0 ? netProfit * (taxRate / 100) : 0;

  // Build CSV
  const lines: string[] = [];
  lines.push('Category,Type,Amount');
  lines.push('');
  lines.push('--- REVENUE ---,,');
  for (const [cat, amount] of Object.entries(revenueByCategory)) {
    lines.push(`${cat},Revenue,${amount.toFixed(2)}`);
  }
  lines.push(`Total Revenue,Revenue,${totalRevenue.toFixed(2)}`);
  lines.push('');
  lines.push('--- EXPENSES ---,,');
  for (const [cat, amount] of Object.entries(expensesByCategory)) {
    lines.push(`${cat},Expense,${amount.toFixed(2)}`);
  }
  lines.push(`Total Expenses,Expense,${totalExpenses.toFixed(2)}`);
  lines.push('');
  lines.push('--- INVENTORY USAGE ---,,');
  for (const u of usageLines) {
    lines.push(`${u.name},Inventory,${u.cost.toFixed(2)}`);
  }
  lines.push(`Total Inventory Cost,Inventory,${inventoryCost.toFixed(2)}`);
  lines.push('');
  lines.push('--- SUMMARY ---,,');
  lines.push(`Gross Revenue,,${totalRevenue.toFixed(2)}`);
  lines.push(`Total Costs,,${(totalExpenses + inventoryCost).toFixed(2)}`);
  lines.push(`Net Profit,,${netProfit.toFixed(2)}`);
  lines.push(`Tax Estimate (${taxRate}%),,${taxEstimate.toFixed(2)}`);
  lines.push(`After Tax,,${(netProfit - taxEstimate).toFixed(2)}`);

  const csv = lines.join('\n');
  const filename = `report-${year}-${String(month).padStart(2, '0')}.csv`;

  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  });
}
