/** --- YAML
 * name: FinancePage
 * description: Financial dashboard with revenue/expenses/profit, period filters, service breakdown, and expense tracking
 * --- */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  Plus,
  Calendar,
  Loader2,
  Trash2,
  BarChart3,
  Users,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useAuthStore } from '@/stores/auth-store';
import { useMaster } from '@/hooks/use-master';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

interface TeamMaster {
  id: string;
  profile: { full_name: string } | null;
}

type Period = 'today' | 'week' | 'month';

interface PaymentRow {
  id: string;
  amount: number;
  currency: string;
  type: string;
  status: string;
  created_at: string;
  services: { name: string } | null;
}

interface ExpenseRow {
  id: string;
  description: string;
  amount: number;
  currency: string;
  category: string | null;
  date: string;
}

interface ServiceRevenue {
  name: string;
  total: number;
  count: number;
}

export default function FinancePage() {
  const t = useTranslations('finance');
  const td = useTranslations('dashboard');
  const tc = useTranslations('common');
  const { master, loading: masterLoading } = useMaster();
  const { role } = useAuthStore();

  const isSalonAdmin = role === 'salon_admin';
  const [period, setPeriod] = useState<Period>('month');
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [expenses, setExpenses] = useState<ExpenseRow[]>([]);
  const [serviceBreakdown, setServiceBreakdown] = useState<ServiceRevenue[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Salon-wide: team masters list + filter
  const [teamMasters, setTeamMasters] = useState<TeamMaster[]>([]);
  const [selectedMasterId, setSelectedMasterId] = useState<string | null>(null);

  // Expense form
  const [expDesc, setExpDesc] = useState('');
  const [expAmount, setExpAmount] = useState('');
  const [expCategory, setExpCategory] = useState('');

  const getDateRange = useCallback((p: Period) => {
    const now = new Date();
    const end = now.toISOString();
    let start: string;
    if (p === 'today') {
      start = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
    } else if (p === 'week') {
      const weekAgo = new Date(now);
      weekAgo.setDate(weekAgo.getDate() - 7);
      start = weekAgo.toISOString();
    } else {
      const monthAgo = new Date(now);
      monthAgo.setMonth(monthAgo.getMonth() - 1);
      start = monthAgo.toISOString();
    }
    return { start, end };
  }, []);

  // Load salon team masters for admin filter
  useEffect(() => {
    if (!isSalonAdmin || !master?.salon_id) return;
    const supabase = createClient();
    supabase
      .from('masters')
      .select('id, profile:profiles(full_name)')
      .eq('salon_id', master.salon_id)
      .order('created_at')
      .then(({ data }) => {
        if (data) setTeamMasters(data as unknown as TeamMaster[]);
      });
  }, [isSalonAdmin, master?.salon_id]);

  const loadData = useCallback(async () => {
    if (!master) return;
    setIsLoading(true);
    const supabase = createClient();
    const { start, end } = getDateRange(period);

    // Determine which master IDs to query
    const masterIds: string[] = [];
    if (isSalonAdmin && !selectedMasterId && master.salon_id) {
      // "All" selected — use all team master IDs
      masterIds.push(...teamMasters.map((m) => m.id));
      if (masterIds.length === 0) masterIds.push(master.id);
    } else if (selectedMasterId) {
      masterIds.push(selectedMasterId);
    } else {
      masterIds.push(master.id);
    }

    // Fetch payments (revenue)
    const { data: payData } = await supabase
      .from('payments')
      .select('id, amount, currency, type, status, created_at, services(name)')
      .eq('status', 'completed')
      .gte('created_at', start)
      .lte('created_at', end)
      .order('created_at', { ascending: false });

    const pays = (payData as unknown as PaymentRow[]) || [];
    setPayments(pays);

    // Build service breakdown
    const breakdown = new Map<string, ServiceRevenue>();
    for (const p of pays) {
      const name = p.services?.name || 'Other';
      const existing = breakdown.get(name) || { name, total: 0, count: 0 };
      existing.total += Number(p.amount);
      existing.count += 1;
      breakdown.set(name, existing);
    }
    setServiceBreakdown(
      Array.from(breakdown.values()).sort((a, b) => b.total - a.total),
    );

    // Fetch expenses — for salon admin with "all", use salon_id; otherwise use specific master
    const startDate = start.split('T')[0];
    const endDate = end.split('T')[0];
    let expQuery = supabase
      .from('expenses')
      .select('*')
      .gte('date', startDate)
      .lte('date', endDate)
      .order('date', { ascending: false });

    if (isSalonAdmin && !selectedMasterId && master.salon_id) {
      expQuery = expQuery.eq('salon_id', master.salon_id);
    } else {
      const targetMasterId = selectedMasterId || master.id;
      expQuery = expQuery.eq('master_id', targetMasterId);
    }

    const { data: expData } = await expQuery;
    setExpenses((expData as ExpenseRow[]) || []);
    setIsLoading(false);
  }, [master, period, getDateRange, isSalonAdmin, selectedMasterId, teamMasters]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const totalRevenue = payments.reduce((s, p) => s + Number(p.amount), 0);
  const totalExpenses = expenses.reduce((s, e) => s + Number(e.amount), 0);
  const profit = totalRevenue - totalExpenses;
  const maxServiceRevenue = serviceBreakdown[0]?.total || 1;

  async function addExpense() {
    if (!master || !expDesc.trim() || !expAmount) return;
    const supabase = createClient();
    const { error } = await supabase.from('expenses').insert({
      master_id: master.id,
      description: expDesc.trim(),
      amount: parseFloat(expAmount),
      category: expCategory.trim() || null,
    });
    if (error) {
      toast.error(tc('error'));
    } else {
      toast.success(tc('success'));
      setExpDesc('');
      setExpAmount('');
      setExpCategory('');
      loadData();
    }
  }

  async function deleteExpense(id: string) {
    const supabase = createClient();
    await supabase.from('expenses').delete().eq('id', id);
    loadData();
  }

  if (masterLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-3 gap-4">
          <Skeleton className="h-28" /><Skeleton className="h-28" /><Skeleton className="h-28" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h2 className="text-2xl font-bold tracking-tight">{td('finance')}</h2>
        <div className="flex items-center gap-3">
          {/* Salon admin: master filter */}
          {isSalonAdmin && teamMasters.length > 1 && (
            <Select
              value={selectedMasterId || 'all'}
              onValueChange={(val: string | null) => setSelectedMasterId(val === 'all' ? null : val)}
            >
              <SelectTrigger className="w-[160px] h-8 text-xs gap-1">
                <Users className="size-3.5" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all" className="text-xs">{tc('all')}</SelectItem>
                {teamMasters.map((m) => (
                  <SelectItem key={m.id} value={m.id} className="text-xs">
                    {m.profile?.full_name || m.id.slice(0, 8)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <div className="flex gap-1 rounded-xl bg-muted/50 p-1">
            {(['today', 'week', 'month'] as Period[]).map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={cn(
                  'px-3 py-1.5 text-xs font-medium rounded-lg transition-all',
                  period === p
                    ? 'bg-background shadow-sm text-foreground'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {td(p === 'today' ? 'today' : p === 'week' ? 'thisWeek' : 'thisMonth')}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          label={t('revenue')}
          value={totalRevenue}
          icon={TrendingUp}
          color="text-emerald-500"
          bgColor="bg-emerald-500/10"
          loading={isLoading}
        />
        <StatCard
          label={t('expenses')}
          value={totalExpenses}
          icon={TrendingDown}
          color="text-red-500"
          bgColor="bg-red-500/10"
          loading={isLoading}
        />
        <StatCard
          label={t('profit')}
          value={profit}
          icon={DollarSign}
          color={profit >= 0 ? 'text-blue-500' : 'text-red-500'}
          bgColor={profit >= 0 ? 'bg-blue-500/10' : 'bg-red-500/10'}
          loading={isLoading}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Revenue by service */}
        <Card className="bg-card/80 backdrop-blur border-border/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <BarChart3 className="size-4 text-primary" />
              {t('byService')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-3">
                <Skeleton className="h-6 w-full" /><Skeleton className="h-6 w-3/4" /><Skeleton className="h-6 w-1/2" />
              </div>
            ) : serviceBreakdown.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">—</p>
            ) : (
              <div className="space-y-3">
                {serviceBreakdown.map((s, i) => (
                  <motion.div
                    key={s.name}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.05 }}
                  >
                    <div className="flex items-center justify-between text-sm mb-1">
                      <span className="truncate">{s.name}</span>
                      <span className="font-medium ml-2 shrink-0">{s.total.toFixed(0)} UAH</span>
                    </div>
                    <div className="h-2 rounded-full bg-muted overflow-hidden">
                      <motion.div
                        className="h-full rounded-full bg-primary"
                        initial={{ width: 0 }}
                        animate={{ width: `${(s.total / maxServiceRevenue) * 100}%` }}
                        transition={{ duration: 0.5, delay: i * 0.05 }}
                      />
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-0.5">{s.count} appointments</p>
                  </motion.div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Expenses list */}
        <Card className="bg-card/80 backdrop-blur border-border/50">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <TrendingDown className="size-4 text-red-500" />
                {t('expenses')}
              </CardTitle>
              <Dialog>
                <DialogTrigger>
                  <Button size="sm" variant="outline" className="h-7 gap-1 text-xs">
                    <Plus className="size-3" />
                    {t('addExpense')}
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>{t('addExpense')}</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 pt-2">
                    <div className="space-y-2">
                      <Label>Description</Label>
                      <Input
                        value={expDesc}
                        onChange={(e) => setExpDesc(e.target.value)}
                        placeholder="Office rent, supplies..."
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-2">
                        <Label>Amount</Label>
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          value={expAmount}
                          onChange={(e) => setExpAmount(e.target.value)}
                          placeholder="0.00"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Category</Label>
                        <Input
                          value={expCategory}
                          onChange={(e) => setExpCategory(e.target.value)}
                          placeholder="Rent, Materials..."
                        />
                      </div>
                    </div>
                    <DialogClose>
                      <Button onClick={addExpense} className="w-full">
                        {tc('save')}
                      </Button>
                    </DialogClose>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-10 w-full" /><Skeleton className="h-10 w-full" />
              </div>
            ) : expenses.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">—</p>
            ) : (
              <div className="space-y-2 max-h-[300px] overflow-y-auto">
                <AnimatePresence>
                  {expenses.map((e, i) => (
                    <motion.div
                      key={e.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                      transition={{ delay: i * 0.03 }}
                      className="group flex items-center justify-between rounded-lg border border-border/50 px-3 py-2 transition-colors hover:bg-muted/50"
                    >
                      <div className="min-w-0">
                        <p className="text-sm truncate">{e.description}</p>
                        <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                          <Calendar className="size-3" />
                          <span>{e.date}</span>
                          {e.category && (
                            <Badge variant="outline" className="text-[9px] px-1.5 py-0 rounded-full">
                              {e.category}
                            </Badge>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-sm font-medium text-red-500">-{Number(e.amount).toFixed(0)}</span>
                        <button
                          onClick={() => deleteExpense(e.id)}
                          className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-red-500"
                        >
                          <Trash2 className="size-3.5" />
                        </button>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  icon: Icon,
  color,
  bgColor,
  loading,
}: {
  label: string;
  value: number;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  bgColor: string;
  loading: boolean;
}) {
  return (
    <Card className="bg-card/80 backdrop-blur border-border/50 transition-all hover:shadow-md hover:-translate-y-0.5">
      <CardContent className="pt-5">
        <div className="flex items-center gap-3">
          <div className={cn('flex size-10 items-center justify-center rounded-xl', bgColor)}>
            <Icon className={cn('size-5', color)} />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">{label}</p>
            {loading ? (
              <Skeleton className="h-7 w-20 mt-1" />
            ) : (
              <motion.p
                className="text-xl font-bold tracking-tight"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
              >
                {value.toFixed(0)} <span className="text-xs font-normal text-muted-foreground">UAH</span>
              </motion.p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
