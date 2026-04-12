/** --- YAML
 * name: ClientPhotosPage
 * description: Read-only before/after photo gallery for the logged-in client. Photos are uploaded by the master and grouped into pairs.
 * created: 2026-04-12
 * updated: 2026-04-12
 * --- */

'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { motion } from 'framer-motion';
import { ImageIcon } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useAuthStore } from '@/stores/auth-store';
import { Skeleton } from '@/components/ui/skeleton';
import { ImageComparisonSlider } from '@/components/ui/image-comparison-slider';

interface PhotoRow {
  id: string;
  client_id: string;
  file_url: string;
  is_before_photo: boolean;
  paired_with: string | null;
  created_at: string;
}

interface PhotoPair {
  before: string;
  after: string;
  date: string;
}

export default function ClientPhotosPage() {
  const t = useTranslations('profile');
  const { userId } = useAuthStore();
  const [pairs, setPairs] = useState<PhotoPair[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) return;
    async function load() {
      const supabase = createClient();
      const { data: clientRows } = await supabase
        .from('clients')
        .select('id')
        .eq('profile_id', userId);
      const clientIds = (clientRows ?? []).map((c) => c.id);
      if (clientIds.length === 0) {
        setLoading(false);
        return;
      }
      const { data } = await supabase
        .from('client_files')
        .select('id, client_id, file_url, is_before_photo, paired_with, created_at')
        .in('client_id', clientIds)
        .like('file_type', 'image/%')
        .order('created_at', { ascending: false });

      const rows = (data ?? []) as PhotoRow[];
      const byId = new Map(rows.map((r) => [r.id, r]));
      const used = new Set<string>();
      const result: PhotoPair[] = [];

      for (const r of rows) {
        if (used.has(r.id)) continue;
        if (r.paired_with && byId.has(r.paired_with) && !used.has(r.paired_with)) {
          const other = byId.get(r.paired_with)!;
          const before = r.is_before_photo ? r : other;
          const after = r.is_before_photo ? other : r;
          result.push({ before: before.file_url, after: after.file_url, date: r.created_at });
          used.add(r.id);
          used.add(other.id);
        }
      }

      setPairs(result);
      setLoading(false);
    }
    load();
  }, [userId]);

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">{t('photosTab')}</h1>

      {pairs.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed py-16 text-center">
          <div className="mb-4 flex size-14 items-center justify-center rounded-full bg-muted">
            <ImageIcon className="size-6 text-muted-foreground" />
          </div>
          <p className="font-medium">{t('noPhotos')}</p>
          <p className="mt-1 max-w-sm text-sm text-muted-foreground">{t('photosDesc')}</p>
        </div>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2">
          {pairs.map((pair, idx) => (
            <motion.div
              key={`${pair.before}-${idx}`}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.05 }}
              className="space-y-2"
            >
              <div className="overflow-hidden rounded-xl border aspect-[4/5]">
                <ImageComparisonSlider
                  leftImage={pair.before}
                  rightImage={pair.after}
                  altLeft={t('before')}
                  altRight={t('after')}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                {new Date(pair.date).toLocaleDateString()}
              </p>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
