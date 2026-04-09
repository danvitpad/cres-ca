/** --- YAML
 * name: LocationsPage
 * description: Multi-location management for masters with address and working hours per location
 * --- */

'use client';

import { useCallback, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, MapPin, Pencil, Trash2, Star, X } from 'lucide-react';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';
import { useMaster } from '@/hooks/use-master';
import { EmptyState } from '@/components/shared/primitives/empty-state';

interface Location {
  id: string;
  name: string;
  address: string;
  city: string | null;
  is_default: boolean;
  created_at: string;
}

export default function LocationsPage() {
  const t = useTranslations('locations');
  const { master } = useMaster();
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Location | null>(null);

  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');

  const fetchLocations = useCallback(async () => {
    if (!master) return;
    const supabase = createClient();
    const { data } = await supabase
      .from('master_locations')
      .select('*')
      .eq('master_id', master.id)
      .order('is_default', { ascending: false });
    setLocations((data ?? []) as Location[]);
    setLoading(false);
  }, [master]);

  useEffect(() => {
    fetchLocations();
  }, [fetchLocations]);

  function openForm(loc?: Location) {
    if (loc) {
      setEditing(loc);
      setName(loc.name);
      setAddress(loc.address);
      setCity(loc.city ?? '');
    } else {
      setEditing(null);
      setName('');
      setAddress('');
      setCity('');
    }
    setShowForm(true);
  }

  function closeForm() {
    setShowForm(false);
    setEditing(null);
  }

  async function saveLocation() {
    if (!name.trim() || !address.trim() || !master) return;
    const supabase = createClient();
    const payload = {
      master_id: master.id,
      name: name.trim(),
      address: address.trim(),
      city: city.trim() || null,
    };

    if (editing) {
      await supabase.from('master_locations').update(payload).eq('id', editing.id);
    } else {
      const isFirst = locations.length === 0;
      await supabase.from('master_locations').insert({ ...payload, is_default: isFirst });
    }

    toast.success(editing ? t('updated') : t('created'));
    closeForm();
    fetchLocations();
  }

  async function setDefault(id: string) {
    if (!master) return;
    const supabase = createClient();
    // Unset all defaults first
    await supabase
      .from('master_locations')
      .update({ is_default: false })
      .eq('master_id', master.id);
    // Set new default
    await supabase
      .from('master_locations')
      .update({ is_default: true })
      .eq('id', id);
    fetchLocations();
  }

  async function deleteLocation(id: string) {
    const supabase = createClient();
    await supabase.from('master_locations').delete().eq('id', id);
    toast.success(t('deleted'));
    fetchLocations();
  }

  if (loading) return null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">{t('title')}</h2>
        <button
          onClick={() => openForm()}
          className="inline-flex items-center gap-1.5 rounded-[var(--radius-button)] bg-[var(--ds-accent)] px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-[var(--ds-accent-hover)]"
        >
          <Plus className="h-4 w-4" />
          {t('addLocation')}
        </button>
      </div>

      {/* Form */}
      <AnimatePresence>
        {showForm && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="space-y-3 rounded-[var(--radius-card)] border bg-card p-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold">{editing ? t('editLocation') : t('addLocation')}</h3>
                <button onClick={closeForm} className="p-1 text-muted-foreground hover:text-foreground">
                  <X className="h-4 w-4" />
                </button>
              </div>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t('locationName')}
                className="w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none ring-ring focus:ring-2"
              />
              <input
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder={t('address')}
                className="w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none ring-ring focus:ring-2"
              />
              <input
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder={t('city')}
                className="w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none ring-ring focus:ring-2"
              />
              <button
                onClick={saveLocation}
                disabled={!name.trim() || !address.trim()}
                className="rounded-[var(--radius-button)] bg-[var(--ds-accent)] px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
              >
                {editing ? t('save') : t('create')}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Locations list */}
      {locations.length === 0 ? (
        <EmptyState
          icon={<MapPin className="h-7 w-7" />}
          title={t('emptyTitle')}
          description={t('emptyDescription')}
        />
      ) : (
        <div className="space-y-3">
          <AnimatePresence>
            {locations.map((loc) => (
              <motion.div
                key={loc.id}
                layout
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                className="flex items-center gap-3 rounded-[var(--radius-card)] border bg-card p-4 shadow-[var(--shadow-card)]"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted">
                  <MapPin className="h-5 w-5 text-muted-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold">{loc.name}</p>
                    {loc.is_default && (
                      <span className="inline-flex items-center gap-0.5 rounded-full bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium text-amber-700 dark:bg-amber-950 dark:text-amber-400">
                        <Star className="h-2.5 w-2.5" />
                        {t('default')}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground truncate">{loc.address}</p>
                  {loc.city && <p className="text-xs text-muted-foreground">{loc.city}</p>}
                </div>
                <div className="flex items-center gap-1">
                  {!loc.is_default && (
                    <button
                      onClick={() => setDefault(loc.id)}
                      className="rounded-lg p-1.5 text-muted-foreground hover:bg-amber-50 hover:text-amber-600"
                      title={t('setDefault')}
                    >
                      <Star className="h-3.5 w-3.5" />
                    </button>
                  )}
                  <button
                    onClick={() => openForm(loc)}
                    className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => deleteLocation(loc.id)}
                    className="rounded-lg p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
