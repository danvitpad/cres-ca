/** --- YAML
 * name: Link Builder (QR + Linktree)
 * description: Мастер видит свой публичный URL, QR-код для печати/скачивания, копирует ссылки на онлайн-запись и соц-сети.
 * created: 2026-04-13
 * updated: 2026-04-13
 * --- */

'use client';

import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Copy, Download, Link2, QrCode, ExternalLink } from 'lucide-react';
import { useMaster } from '@/hooks/use-master';
import { Button } from '@/components/ui/button';

export default function LinkBuilderPage() {
  const { master } = useMaster();
  const [size, setSize] = useState(512);

  const handle = master?.invite_code ?? '';
  const publicUrl = useMemo(() => (handle ? `https://cres.ca/m/${handle}` : ''), [handle]);
  const qrUrl = useMemo(
    () => (handle ? `/api/qr?handle=${encodeURIComponent(handle)}&size=${size}` : ''),
    [handle, size],
  );

  async function copy(text: string, label: string) {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(`${label} скопировано`);
    } catch {
      toast.error('Не удалось скопировать');
    }
  }

  if (!master) {
    return (
      <div className="mx-auto max-w-3xl p-6 text-sm text-muted-foreground">Загрузка…</div>
    );
  }

  if (!handle) {
    return (
      <div className="mx-auto max-w-3xl space-y-4 p-6">
        <h1 className="flex items-center gap-2 text-2xl font-semibold">
          <Link2 className="h-6 w-6 text-primary" />
          Ссылки и QR
        </h1>
        <p className="rounded-lg border bg-card p-6 text-sm text-muted-foreground">
          Сначала установи свой никнейм (invite code) в настройках, чтобы получить публичную страницу.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-semibold">
          <Link2 className="h-6 w-6 text-primary" />
          Ссылки и QR
        </h1>
        <p className="text-sm text-muted-foreground">
          Твоя публичная страница онлайн-записи, QR-код для печати и быстрые ссылки для соц-сетей.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <div className="space-y-4 rounded-lg border bg-card p-5">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <QrCode className="h-4 w-4" /> QR-код
          </div>
          <div className="flex justify-center rounded-md border bg-white p-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={qrUrl} alt="QR" width={size / 2} height={size / 2} />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs text-muted-foreground">Размер:</label>
            <select
              value={size}
              onChange={(e) => setSize(Number(e.target.value))}
              className="rounded border bg-background px-2 py-1 text-sm"
            >
              <option value={256}>256px</option>
              <option value={512}>512px</option>
              <option value={1024}>1024px</option>
            </select>
          </div>
          <a
            href={qrUrl}
            download={`cres-ca-${handle}-qr.png`}
            className="inline-flex w-full items-center justify-center gap-1 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
          >
            <Download className="h-4 w-4" />
            Скачать PNG
          </a>
        </div>

        <div className="space-y-4 rounded-lg border bg-card p-5">
          <div className="text-sm font-semibold">Публичные ссылки</div>

          <LinkRow label="Онлайн-запись" value={publicUrl} onCopy={() => copy(publicUrl, 'Ссылка')} />
          <LinkRow
            label="Прямая запись"
            value={`${publicUrl}?book=1`}
            onCopy={() => copy(`${publicUrl}?book=1`, 'Ссылка')}
          />
          <LinkRow
            label="WhatsApp-текст"
            value={`Записаться ко мне: ${publicUrl}`}
            onCopy={() => copy(`Записаться ко мне: ${publicUrl}`, 'Текст')}
          />
          <LinkRow
            label="Instagram bio"
            value={publicUrl}
            onCopy={() => copy(publicUrl, 'Ссылка')}
          />

          <a
            href={publicUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex w-full items-center justify-center gap-1 rounded-md border px-3 py-2 text-sm hover:bg-muted"
          >
            <ExternalLink className="h-4 w-4" />
            Открыть публичную страницу
          </a>
        </div>
      </div>

      <div className="rounded-lg border bg-card p-5 text-xs text-muted-foreground">
        💡 Распечатай QR и повесь в зал — клиенты отсканируют телефоном и сразу запишутся.
        Вставь ссылку в bio Instagram, TikTok и Telegram-канала.
      </div>
    </div>
  );
}

function LinkRow({
  label,
  value,
  onCopy,
}: {
  label: string;
  value: string;
  onCopy: () => void;
}) {
  return (
    <div className="space-y-1">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="flex items-center gap-2">
        <div className="min-w-0 flex-1 truncate rounded-md border bg-background px-3 py-2 text-sm">
          {value}
        </div>
        <Button size="icon" variant="outline" onClick={onCopy}>
          <Copy className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
