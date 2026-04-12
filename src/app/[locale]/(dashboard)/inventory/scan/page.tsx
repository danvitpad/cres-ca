/** --- YAML
 * name: Inventory Barcode Scan
 * description: Capture product photo + barcode via BarcodeDetector, match inventory_items, quick +/- adjust or create new.
 * created: 2026-04-12
 * updated: 2026-04-12
 * --- */

'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Camera, Package, Plus, Minus, ScanBarcode } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useMaster } from '@/hooks/use-master';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

type Item = {
  id: string;
  name: string;
  quantity: number;
  unit: string;
  cost_per_unit: number | null;
  barcode: string | null;
  image_url: string | null;
};

interface BarcodeDetectorAlt {
  detect: (source: ImageBitmapSource) => Promise<{ rawValue: string }[]>;
}

export default function InventoryScanPage() {
  const supabase = createClient();
  const { master } = useMaster();
  const [busy, setBusy] = useState(false);
  const [photoDataUrl, setPhotoDataUrl] = useState<string | null>(null);
  const [barcode, setBarcode] = useState('');
  const [match, setMatch] = useState<Item | null>(null);
  const [searched, setSearched] = useState(false);
  const [newName, setNewName] = useState('');
  const [newPrice, setNewPrice] = useState('');
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [supportsDetector, setSupportsDetector] = useState(false);

  useEffect(() => {
    setSupportsDetector('BarcodeDetector' in window);
  }, []);

  const lookup = useCallback(
    async (code: string) => {
      if (!master?.id || !code) return;
      const { data } = await supabase
        .from('inventory_items')
        .select('id, name, quantity, unit, cost_per_unit, barcode, image_url')
        .eq('master_id', master.id)
        .eq('barcode', code)
        .maybeSingle();
      setMatch((data as Item | null) ?? null);
      setSearched(true);
    },
    [supabase, master?.id],
  );

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    setSearched(false);
    setMatch(null);

    const reader = new FileReader();
    reader.onload = () => setPhotoDataUrl(reader.result as string);
    reader.readAsDataURL(file);

    if (supportsDetector) {
      try {
        const w = window as unknown as { BarcodeDetector: new (opts?: { formats?: string[] }) => BarcodeDetectorAlt };
        const detector = new w.BarcodeDetector({
          formats: ['ean_13', 'ean_8', 'code_128', 'code_39', 'qr_code', 'upc_a', 'upc_e'],
        });
        const bitmap = await createImageBitmap(file);
        const codes = await detector.detect(bitmap);
        if (codes.length > 0) {
          const code = codes[0].rawValue;
          setBarcode(code);
          await lookup(code);
        } else {
          toast('Штрих-код не распознан — введи вручную');
        }
      } catch (err) {
        toast.error(`Ошибка детектора: ${(err as Error).message}`);
      }
    }
    setBusy(false);
  }

  async function uploadPhoto(): Promise<string | null> {
    if (!photoDataUrl || !master?.id) return null;
    const res = await fetch(photoDataUrl);
    const blob = await res.blob();
    const path = `${master.id}/${Date.now()}.jpg`;
    const { error } = await supabase.storage.from('inventory').upload(path, blob, {
      contentType: 'image/jpeg',
      upsert: true,
    });
    if (error) {
      toast.error(`Загрузка фото: ${error.message}`);
      return null;
    }
    const { data } = supabase.storage.from('inventory').getPublicUrl(path);
    return data.publicUrl;
  }

  async function adjust(delta: number) {
    if (!match) return;
    const next = Math.max(0, Number(match.quantity) + delta);
    const { error } = await supabase
      .from('inventory_items')
      .update({ quantity: next, updated_at: new Date().toISOString() })
      .eq('id', match.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    setMatch({ ...match, quantity: next });
    toast.success(`${match.name}: ${next} ${match.unit}`);
  }

  async function createNew() {
    if (!master?.id || !newName.trim() || !barcode) return;
    setBusy(true);
    const image_url = await uploadPhoto();
    const { data, error } = await supabase
      .from('inventory_items')
      .insert({
        master_id: master.id,
        name: newName.trim(),
        quantity: 1,
        unit: 'pcs',
        cost_per_unit: newPrice ? Number(newPrice) : null,
        barcode,
        image_url,
      })
      .select()
      .single();
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setMatch(data as Item);
    setNewName('');
    setNewPrice('');
    toast.success('Товар добавлен');
  }

  function reset() {
    setPhotoDataUrl(null);
    setBarcode('');
    setMatch(null);
    setSearched(false);
    setNewName('');
    setNewPrice('');
    if (fileRef.current) fileRef.current.value = '';
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-semibold">
          <ScanBarcode className="h-6 w-6 text-primary" />
          Сканирование товара
        </h1>
        <p className="text-sm text-muted-foreground">
          Сфотографируй штрих-код препарата — найдём в складе или создадим новую позицию.
        </p>
        {!supportsDetector && (
          <p className="mt-2 text-xs text-amber-700 dark:text-amber-400">
            BarcodeDetector не поддерживается — введи штрих-код вручную после съёмки.
          </p>
        )}
      </div>

      <div className="rounded-lg border bg-card p-5 space-y-4">
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={onFile}
          className="hidden"
        />
        {photoDataUrl ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img src={photoDataUrl} alt="Снимок" className="mx-auto max-h-64 rounded-md border" />
        ) : (
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="flex w-full flex-col items-center justify-center gap-2 rounded-md border-2 border-dashed border-muted-foreground/30 p-12 text-muted-foreground transition-colors hover:border-primary/50 hover:bg-muted/30"
          >
            <Camera className="h-10 w-10" />
            <span className="text-sm font-medium">Снять штрих-код</span>
          </button>
        )}

        <div className="space-y-2">
          <Label>Штрих-код</Label>
          <div className="flex gap-2">
            <Input
              value={barcode}
              onChange={(e) => setBarcode(e.target.value)}
              placeholder="например 4607004870019"
            />
            <Button type="button" onClick={() => lookup(barcode)} disabled={!barcode || busy}>
              Найти
            </Button>
          </div>
        </div>

        {photoDataUrl && (
          <Button variant="ghost" size="sm" onClick={reset}>
            Очистить
          </Button>
        )}
      </div>

      {searched && match && (
        <div className="rounded-lg border-2 border-emerald-200 bg-emerald-50/40 p-5 dark:border-emerald-900 dark:bg-emerald-950/20">
          <div className="flex items-start gap-4">
            {match.image_url && (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img src={match.image_url} alt={match.name} className="h-20 w-20 rounded-md object-cover" />
            )}
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <Package className="h-5 w-5 text-emerald-600" />
                <h2 className="text-lg font-semibold">{match.name}</h2>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                Остаток: <span className="font-bold text-foreground">{match.quantity}</span> {match.unit}
                {match.cost_per_unit && ` • ${match.cost_per_unit} грн/${match.unit}`}
              </p>
              <div className="mt-3 flex gap-2">
                <Button size="sm" variant="outline" onClick={() => adjust(-1)}>
                  <Minus className="mr-1 h-3 w-3" /> Списать 1
                </Button>
                <Button size="sm" variant="outline" onClick={() => adjust(1)}>
                  <Plus className="mr-1 h-3 w-3" /> Принять 1
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {searched && !match && barcode && (
        <div className="rounded-lg border-2 border-amber-200 bg-amber-50/40 p-5 dark:border-amber-900 dark:bg-amber-950/20 space-y-3">
          <h2 className="font-semibold">Товар не найден — добавить?</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label>Название</Label>
              <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="OPI Базовое покрытие" />
            </div>
            <div className="space-y-1">
              <Label>Цена закупки</Label>
              <Input
                type="number"
                value={newPrice}
                onChange={(e) => setNewPrice(e.target.value)}
                placeholder="450"
              />
            </div>
          </div>
          <Button onClick={createNew} disabled={busy || !newName.trim()}>
            Добавить в склад
          </Button>
        </div>
      )}
    </div>
  );
}
