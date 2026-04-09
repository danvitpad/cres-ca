/** --- YAML
 * name: Recurring Expenses Cron
 * description: Daily cron that auto-creates expense records for recurring expenses due today
 * --- */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = await createClient();
  const today = new Date().toISOString().split('T')[0];

  // Find recurring expenses due today or earlier
  const { data: dueExpenses } = await supabase
    .from('expenses')
    .select('*')
    .eq('is_recurring', true)
    .lte('next_recurrence_date', today);

  if (!dueExpenses || dueExpenses.length === 0) {
    return NextResponse.json({ created: 0 });
  }

  let created = 0;

  for (const expense of dueExpenses) {
    // Create new expense record (non-recurring copy)
    await supabase.from('expenses').insert({
      master_id: expense.master_id,
      amount: expense.amount,
      category: expense.category,
      description: expense.description,
      date: today,
      is_recurring: false,
    });

    // Calculate next recurrence date
    const current = new Date(expense.next_recurrence_date);
    let next: Date;

    switch (expense.recurrence_interval) {
      case 'weekly':
        next = new Date(current.getTime() + 7 * 24 * 60 * 60 * 1000);
        break;
      case 'monthly':
        next = new Date(current);
        next.setMonth(next.getMonth() + 1);
        break;
      case 'quarterly':
        next = new Date(current);
        next.setMonth(next.getMonth() + 3);
        break;
      case 'yearly':
        next = new Date(current);
        next.setFullYear(next.getFullYear() + 1);
        break;
      default:
        next = new Date(current);
        next.setMonth(next.getMonth() + 1);
    }

    await supabase
      .from('expenses')
      .update({ next_recurrence_date: next.toISOString().split('T')[0] })
      .eq('id', expense.id);

    created++;
  }

  return NextResponse.json({ created });
}
