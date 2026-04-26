/** --- YAML
 * name: ShareStoryButton
 * description: Скачивает story-картинку для мастера (`/api/share-card/<id>`) и даёт nativeShare если доступен.
 * created: 2026-04-14
 * updated: 2026-04-14
 * --- */

'use client';

import { Share2 } from 'lucide-react';
import { toast } from 'sonner';

interface Props {
  masterId: string;
  masterName: string;
}

export function ShareStoryButton({ masterId, masterName }: Props) {
  async function share() {
    const url = `/api/share-card/${masterId}`;
    try {
      const res = await fetch(url);
      const blob = await res.blob();
      const file = new File([blob], `${masterName}.png`, { type: 'image/png' });

      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: `Я рекомендую ${masterName}` });
        return;
      }
      const objectUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = objectUrl;
      a.download = `${masterName}-story.png`;
      a.click();
      URL.revokeObjectURL(objectUrl);
      toast.success('Картинка скачана');
    } catch {
      toast.error('Не удалось создать картинку');
    }
  }

  return (
    <button
      onClick={share}
      className="inline-flex items-center gap-1.5 rounded-full border border-neutral-900/15 bg-white px-3.5 py-1.5 text-sm font-semibold text-neutral-900 shadow-sm transition-all hover:bg-neutral-50 hover:shadow active:scale-[0.98]"
      aria-label="Поделиться"
    >
      <Share2 className="size-4" />
      Поделиться
    </button>
  );
}
