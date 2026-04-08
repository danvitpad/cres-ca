/** --- YAML
 * name: FileUpload
 * description: Upload photos/PDFs to Supabase Storage for client cards (Business tier gated)
 * --- */

'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';
import { useSubscription } from '@/hooks/use-subscription';
import { Button } from '@/components/ui/button';
import { Upload, FileText, Image, Trash2 } from 'lucide-react';

interface ClientFile {
  id: string;
  file_url: string;
  file_type: string;
  file_name: string;
  is_before_photo: boolean;
  created_at: string;
}

export function FileUpload({ clientId }: { clientId: string }) {
  const t = useTranslations('clients');
  const tc = useTranslations('common');
  const { canUse } = useSubscription();
  const [files, setFiles] = useState<ClientFile[]>([]);
  const [uploading, setUploading] = useState(false);

  useEffect(() => { loadFiles(); }, [clientId]); // eslint-disable-line react-hooks/exhaustive-deps

  async function loadFiles() {
    const supabase = createClient();
    const { data } = await supabase
      .from('client_files')
      .select('*')
      .eq('client_id', clientId)
      .order('created_at', { ascending: false });
    if (data) setFiles(data as ClientFile[]);
  }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    const supabase = createClient();
    const path = `${clientId}/${Date.now()}_${file.name}`;

    const { data, error } = await supabase.storage
      .from('client-files')
      .upload(path, file);

    if (error) { toast.error(error.message); setUploading(false); return; }

    const { data: urlData } = supabase.storage.from('client-files').getPublicUrl(data.path);

    await supabase.from('client_files').insert({
      client_id: clientId,
      file_url: urlData.publicUrl,
      file_type: file.type,
      file_name: file.name,
      is_before_photo: false,
    });

    setUploading(false);
    toast.success(tc('success'));
    loadFiles();
  }

  async function handleDelete(fileId: string, fileUrl: string) {
    const supabase = createClient();
    // Extract path from URL
    const path = fileUrl.split('/client-files/')[1];
    if (path) await supabase.storage.from('client-files').remove([path]);
    await supabase.from('client_files').delete().eq('id', fileId);
    loadFiles();
  }

  if (!canUse('file_storage')) return null;

  return (
    <div className="space-y-4">
      <div>
        <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-input bg-background px-3 py-2 text-sm font-medium hover:bg-accent hover:text-accent-foreground">
          <input type="file" className="hidden" accept="image/*,.pdf" onChange={handleUpload} disabled={uploading} />
          <Upload className="h-4 w-4" />
          {uploading ? tc('loading') : t('filesTab')}
        </label>
      </div>

      {files.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t('noClients')}</p>
      ) : (
        <div className="grid gap-2 grid-cols-2 sm:grid-cols-3">
          {files.map((f) => (
            <div key={f.id} className="relative rounded-lg border p-2 group">
              {f.file_type.startsWith('image/') ? (
                <a href={f.file_url} target="_blank" rel="noopener noreferrer">
                  <Image className="h-8 w-8 text-muted-foreground mx-auto" />
                  <p className="text-xs truncate mt-1">{f.file_name}</p>
                </a>
              ) : (
                <a href={f.file_url} target="_blank" rel="noopener noreferrer">
                  <FileText className="h-8 w-8 text-muted-foreground mx-auto" />
                  <p className="text-xs truncate mt-1">{f.file_name}</p>
                </a>
              )}
              <button
                onClick={() => handleDelete(f.id, f.file_url)}
                className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 text-destructive"
              >
                <Trash2 className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
