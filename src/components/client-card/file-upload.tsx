/** --- YAML
 * name: FileUpload
 * description: Upload photos/PDFs to Supabase Storage for client cards (Business tier gated)
 * --- */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import { createClient } from '@/lib/supabase/client';
import { useSubscription } from '@/hooks/use-subscription';
import { Button } from '@/components/ui/button';
import { UploadCloud, FileText, Image, Trash2, CheckCircle2, File as FileIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

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
    processFile(file);
  }

  async function handleDelete(fileId: string, fileUrl: string) {
    const supabase = createClient();
    // Extract path from URL
    const path = fileUrl.split('/client-files/')[1];
    if (path) await supabase.storage.from('client-files').remove([path]);
    await supabase.from('client_files').delete().eq('id', fileId);
    loadFiles();
  }

  const [isDragging, setIsDragging] = useState(false);

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    const droppedFiles = Array.from(e.dataTransfer.files);
    if (droppedFiles.length > 0) {
      processFile(droppedFiles[0]);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function processFile(file: File) {
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

  if (!canUse('file_storage')) return null;

  return (
    <div className="space-y-4">
      {/* Drag-n-drop zone */}
      <div
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        className={cn(
          'relative flex flex-col items-center justify-center rounded-xl border-2 border-dashed p-6 transition-all cursor-pointer',
          isDragging
            ? 'border-primary bg-primary/5 scale-[1.01]'
            : 'border-border/50 hover:border-border hover:bg-muted/30',
          uploading && 'opacity-60 pointer-events-none',
        )}
      >
        <input
          type="file"
          className="absolute inset-0 opacity-0 cursor-pointer"
          accept="image/*,.pdf"
          onChange={handleUpload}
          disabled={uploading}
        />
        <motion.div
          animate={isDragging ? { scale: 1.1, y: -4 } : { scale: 1, y: 0 }}
          transition={{ type: 'spring', stiffness: 300, damping: 20 }}
        >
          <UploadCloud className={cn('size-8 mb-2', isDragging ? 'text-primary' : 'text-muted-foreground/50')} />
        </motion.div>
        <p className="text-sm font-medium">
          {uploading ? tc('loading') : isDragging ? 'Drop file here' : 'Drag & drop or click to upload'}
        </p>
        <p className="text-[10px] text-muted-foreground mt-1">PNG, JPG, PDF up to 10MB</p>
      </div>

      {/* Files grid */}
      {files.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-2">No files yet</p>
      ) : (
        <div className="grid gap-2 grid-cols-2 sm:grid-cols-3">
          <AnimatePresence>
            {files.map((f, i) => (
              <motion.div
                key={f.id}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{ delay: i * 0.03 }}
                className="relative rounded-xl border bg-card/50 p-3 group hover:shadow-sm transition-shadow"
              >
                <a href={f.file_url} target="_blank" rel="noopener noreferrer" className="flex flex-col items-center gap-2">
                  {f.file_type.startsWith('image/') ? (
                    <div className="flex size-10 items-center justify-center rounded-lg bg-blue-500/10">
                      <Image className="size-5 text-blue-500" />
                    </div>
                  ) : (
                    <div className="flex size-10 items-center justify-center rounded-lg bg-amber-500/10">
                      <FileText className="size-5 text-amber-500" />
                    </div>
                  )}
                  <p className="text-[11px] truncate w-full text-center">{f.file_name}</p>
                </a>
                <button
                  onClick={() => handleDelete(f.id, f.file_url)}
                  className="absolute top-1.5 right-1.5 p-1 rounded-md opacity-0 group-hover:opacity-100 hover:bg-red-500/10 transition-all"
                >
                  <Trash2 className="size-3 text-red-500" />
                </button>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
