/** --- YAML
 * name: ClientDocumentsPage
 * description: Read-only archive of non-image client files (PDFs, reports, certificates) uploaded by masters.
 * created: 2026-04-13
 * updated: 2026-04-13
 * --- */

'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { motion } from 'framer-motion';
import { FileText, Download, FileIcon, FileImage } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useAuthStore } from '@/stores/auth-store';
import { Skeleton } from '@/components/ui/skeleton';

interface DocRow {
  id: string;
  file_url: string;
  file_name: string;
  file_type: string | null;
  description: string | null;
  created_at: string;
}

function fileNameFromUrl(url: string): string {
  try {
    const u = new URL(url);
    const last = u.pathname.split('/').filter(Boolean).pop() ?? 'file';
    return decodeURIComponent(last);
  } catch {
    return url.split('/').pop() ?? 'file';
  }
}

function iconFor(type: string | null) {
  if (!type) return <FileIcon className="size-5" />;
  if (type.startsWith('image/')) return <FileImage className="size-5" />;
  if (type === 'application/pdf') return <FileText className="size-5" />;
  return <FileIcon className="size-5" />;
}

export default function ClientDocumentsPage() {
  const t = useTranslations('profile');
  const { userId } = useAuthStore();
  const [docs, setDocs] = useState<DocRow[]>([]);
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
        .select('id, file_url, file_type, description, created_at')
        .in('client_id', clientIds)
        .not('file_type', 'like', 'image/%')
        .order('created_at', { ascending: false });

      const rows: DocRow[] = (data ?? []).map((r: { id: string; file_url: string; file_type: string | null; description: string | null; created_at: string }) => ({
        ...r,
        file_name: fileNameFromUrl(r.file_url),
      }));
      setDocs(rows);
      setLoading(false);
    }
    load();
  }, [userId]);

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="space-y-3">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">{t('documentsTab')}</h1>

      {docs.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed py-16 text-center">
          <div className="mb-4 flex size-14 items-center justify-center rounded-full bg-muted">
            <FileText className="size-6 text-muted-foreground" />
          </div>
          <p className="font-medium">{t('noDocuments')}</p>
          <p className="mt-1 max-w-sm text-sm text-muted-foreground">{t('documentsDesc')}</p>
        </div>
      ) : (
        <ul className="divide-y divide-border/60 overflow-hidden rounded-2xl border border-border/60 bg-card shadow-[var(--shadow-card)]">
          {docs.map((doc, idx) => (
            <motion.li
              key={doc.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.03 }}
            >
              <a
                href={doc.file_url}
                target="_blank"
                rel="noopener noreferrer"
                download={doc.file_name}
                className="group flex items-center gap-4 px-5 py-4 transition-colors hover:bg-muted/40"
              >
                <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-[var(--ds-accent)]/10 text-[var(--ds-accent)]">
                  {iconFor(doc.file_type)}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold group-hover:text-[var(--ds-accent)]">
                    {doc.file_name}
                  </p>
                  {doc.description && (
                    <p className="truncate text-xs text-muted-foreground">{doc.description}</p>
                  )}
                  <div className="mt-1 flex items-center gap-2 text-[11px] uppercase tracking-wide text-muted-foreground">
                    <span>{new Date(doc.created_at).toLocaleDateString()}</span>
                  </div>
                </div>
                <Download className="size-4 shrink-0 text-muted-foreground transition-colors group-hover:text-[var(--ds-accent)]" />
              </a>
            </motion.li>
          ))}
        </ul>
      )}
    </div>
  );
}
