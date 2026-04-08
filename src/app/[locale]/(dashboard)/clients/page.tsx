/** --- YAML
 * name: Clients Page
 * description: Client list with search, pagination, add dialog — links to individual client cards
 * --- */

'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';
import { useMaster } from '@/hooks/use-master';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { BehaviorIndicators } from '@/components/shared/behavior-indicators';
import { Plus, AlertTriangle } from 'lucide-react';
import type { BehaviorIndicator } from '@/types';

const PAGE_SIZE = 20;

interface ClientRow {
  id: string;
  full_name: string;
  phone: string | null;
  total_visits: number;
  avg_check: number;
  last_visit_at: string | null;
  rating: number;
  has_health_alert: boolean;
  behavior_indicators: BehaviorIndicator[];
}

export default function ClientsPage() {
  const t = useTranslations('clients');
  const tc = useTranslations('common');
  const { master, loading: masterLoading } = useMaster();
  const [clients, setClients] = useState<ClientRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [hasMore, setHasMore] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);

  const loadClients = useCallback(async (append = false) => {
    if (!master) return;
    const supabase = createClient();
    let query = supabase
      .from('clients')
      .select('id, full_name, phone, total_visits, avg_check, last_visit_at, rating, has_health_alert, behavior_indicators')
      .eq('master_id', master.id)
      .order('created_at', { ascending: false });

    if (search.trim()) {
      query = query.or(`full_name.ilike.%${search.trim()}%,phone.ilike.%${search.trim()}%`);
    }

    const offset = append ? clients.length : 0;
    query = query.range(offset, offset + PAGE_SIZE);

    const { data } = await query;
    if (data) {
      setClients(append ? [...clients, ...data] : data);
      setHasMore(data.length > PAGE_SIZE);
    }
    setLoading(false);
  }, [master, search, clients]);

  useEffect(() => {
    if (master) { setLoading(true); loadClients(); }
  }, [master, search]); // eslint-disable-line react-hooks/exhaustive-deps

  async function addClient(formData: { full_name: string; phone: string; email: string; date_of_birth: string; notes: string }) {
    if (!master) return;
    const supabase = createClient();
    const { error } = await supabase.from('clients').insert({
      master_id: master.id,
      full_name: formData.full_name,
      phone: formData.phone || null,
      email: formData.email || null,
      date_of_birth: formData.date_of_birth || null,
      notes: formData.notes || null,
    });
    if (error) { toast.error(error.message); return; }
    toast.success(tc('success'));
    setDialogOpen(false);
    loadClients();
  }

  if (masterLoading) {
    return <div className="space-y-6"><Skeleton className="h-8 w-48" /><Skeleton className="h-40 w-full" /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">{t('clientCard')}</h2>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger render={<Button />}>
            <Plus className="h-4 w-4 mr-2" />
            {t('addClient')}
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>{t('addClient')}</DialogTitle></DialogHeader>
            <AddClientForm onSubmit={addClient} />
          </DialogContent>
        </Dialog>
      </div>

      <Input
        placeholder={tc('search')}
        className="max-w-sm"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      {loading ? (
        <div className="space-y-2">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}</div>
      ) : clients.length === 0 ? (
        <div className="rounded-lg border p-8 text-center text-muted-foreground">{t('noClients')}</div>
      ) : (
        <>
          <div className="rounded-lg border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="px-4 py-2 text-left font-medium">{t('name')}</th>
                  <th className="px-4 py-2 text-left font-medium hidden sm:table-cell">{t('phone')}</th>
                  <th className="px-4 py-2 text-right font-medium">{t('totalVisits')}</th>
                  <th className="px-4 py-2 text-right font-medium hidden md:table-cell">{t('avgCheck')}</th>
                  <th className="px-4 py-2 text-right font-medium hidden lg:table-cell">{t('rating')}</th>
                </tr>
              </thead>
              <tbody>
                {clients.map((c) => (
                  <tr key={c.id} className="border-t hover:bg-muted/30">
                    <td className="px-4 py-3">
                      <Link href={`/clients/${c.id}`} className="hover:underline font-medium">
                        {c.has_health_alert && <AlertTriangle className="inline h-4 w-4 text-red-500 mr-1" />}
                        {c.full_name}
                      </Link>
                      <BehaviorIndicators indicators={c.behavior_indicators} />
                    </td>
                    <td className="px-4 py-3 hidden sm:table-cell text-muted-foreground">{c.phone || '—'}</td>
                    <td className="px-4 py-3 text-right">{c.total_visits}</td>
                    <td className="px-4 py-3 text-right hidden md:table-cell">{c.avg_check}</td>
                    <td className="px-4 py-3 text-right hidden lg:table-cell">{c.rating}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {hasMore && (
            <Button variant="outline" onClick={() => loadClients(true)} className="w-full">
              {tc('next')}
            </Button>
          )}
        </>
      )}
    </div>
  );
}

function AddClientForm({ onSubmit }: { onSubmit: (data: { full_name: string; phone: string; email: string; date_of_birth: string; notes: string }) => void }) {
  const t = useTranslations('clients');
  const tc = useTranslations('common');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [dob, setDob] = useState('');
  const [notes, setNotes] = useState('');

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    onSubmit({ full_name: fullName, phone, email, date_of_birth: dob, notes });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label>{t('name')}</Label>
        <Input value={fullName} onChange={(e) => setFullName(e.target.value)} required />
      </div>
      <div className="grid gap-4 grid-cols-2">
        <div className="space-y-2">
          <Label>{t('phone')}</Label>
          <Input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>{t('email')}</Label>
          <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
      </div>
      <div className="space-y-2">
        <Label>{t('dateOfBirth')}</Label>
        <Input type="date" value={dob} onChange={(e) => setDob(e.target.value)} />
      </div>
      <div className="space-y-2">
        <Label>{t('notes')}</Label>
        <Input value={notes} onChange={(e) => setNotes(e.target.value)} />
      </div>
      <Button type="submit" className="w-full">{tc('save')}</Button>
    </form>
  );
}
