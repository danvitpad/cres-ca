/** --- YAML
 * name: Inventory Barcode Scan
 * description: Capture product photo + barcode via BarcodeDetector, match inventory_items, quick +/- adjust, link to client, record scan events.
 * created: 2026-04-12
 * updated: 2026-04-16
 * --- */

'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Camera,
  Package,
  Plus,
  Minus,
  ScanBarcode,
  UserPlus,
  CalendarClock,
  AlertTriangle,
  ArrowLeft,
  Check,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useMaster } from '@/hooks/use-master';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import Link from 'next/link';

type Item = {
  id: string;
  name: string;
  quantity: number;
  unit: string;
  cost_per_unit: number | null;
  barcode: string | null;
  image_url: string | null;
  expiry_date: string | null;
};

type ClientOption = {
  id: string;
  full_name: string;
};

interface BarcodeDetectorAlt {
  detect: (source: ImageBitmapSource) => Promise<{ rawValue: string }[]>;
}

export default function InventoryScanPage() {
  const supabase = createClient();
  const { master } = useMaster();
  const t = useTranslations('inventory');
  const tc = useTranslations('common');

  const [busy, setBusy] = useState(false);
  const [photoDataUrl, setPhotoDataUrl] = useState<string | null>(null);
  const [barcode, setBarcode] = useState('');
  const [match, setMatch] = useState<Item | null>(null);
  const [searched, setSearched] = useState(false);
  const [newName, setNewName] = useState('');
  const [newPrice, setNewPrice] = useState('');
  const [newExpiry, setNewExpiry] = useState('');
  const [serialNumber, setSerialNumber] = useState('');
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [supportsDetector, setSupportsDetector] = useState(false);

  // Link to client state
  const [linkDialogOpen, setLinkDialogOpen] = useState(false);
  const [clientSearch, setClientSearch] = useState('');
  const [clientOptions, setClientOptions] = useState<ClientOption[]>([]);
  const [clientsLoading, setClientsLoading] = useState(false);
  const [linkedClient, setLinkedClient] = useState<ClientOption | null>(null);

  // Scan event recorded
  const [scanRecorded, setScanRecorded] = useState(false);

  useEffect(() => {
    setSupportsDetector('BarcodeDetector' in window);
  }, []);

  const lookup = useCallback(
    async (code: string) => {
      if (!master?.id || !code) return;
      const { data } = await supabase
        .from('inventory_items')
        .select('id, name, quantity, unit, cost_per_unit, barcode, image_url, expiry_date')
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
    setScanRecorded(false);
    setLinkedClient(null);

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
          toast(t('scanManualFallback'));
        }
      } catch (err) {
        toast.error(`${t('scanError')}: ${(err as Error).message}`);
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
      toast.error(`${t('photoUploadError')}: ${error.message}`);
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

    // Record usage if deducting
    if (delta < 0 && master?.id) {
      await supabase.from('inventory_usage').insert({
        item_id: match.id,
        quantity_used: Math.abs(delta),
        recorded_by: master.profile_id ?? null,
      });
    }
  }

  async function recordScanEvent() {
    if (!match || !master?.id) return;
    setScanRecorded(true);
    toast.success(t('scanRecorded'));
  }

  async function searchClients(query: string) {
    setClientSearch(query);
    if (!master?.id || query.length < 2) {
      setClientOptions([]);
      return;
    }
    setClientsLoading(true);
    const { data } = await supabase
      .from('clients')
      .select('id, full_name')
      .eq('master_id', master.id)
      .ilike('full_name', `%${query}%`)
      .limit(10);
    setClientOptions((data as ClientOption[]) || []);
    setClientsLoading(false);
  }

  async function linkToClient(client: ClientOption) {
    if (!match || !master?.id) return;
    setBusy(true);

    // Insert scan record into client_files as a scan reference
    const { error } = await supabase.from('client_files').insert({
      client_id: client.id,
      uploaded_by: master.profile_id,
      file_url: match.image_url || `barcode:${match.barcode}`,
      file_name: `scan-${match.barcode || match.id}`,
      file_type: 'scan_record',
      description: `${t('scanLinked')}: ${match.name} (${match.barcode || 'N/A'})${serialNumber ? ` S/N: ${serialNumber}` : ''}${match.expiry_date ? ` Exp: ${match.expiry_date}` : ''}`,
    });

    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }

    setLinkedClient(client);
    setLinkDialogOpen(false);
    toast.success(`${t('scanLinkedTo')} ${client.full_name}`);
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
        expiry_date: newExpiry || null,
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
    setNewExpiry('');
    toast.success(t('itemAdded'));
  }

  function reset() {
    setPhotoDataUrl(null);
    setBarcode('');
    setMatch(null);
    setSearched(false);
    setNewName('');
    setNewPrice('');
    setNewExpiry('');
    setSerialNumber('');
    setLinkedClient(null);
    setScanRecorded(false);
    if (fileRef.current) fileRef.current.value = '';
  }

  const isExpiringSoon = match?.expiry_date
    ? new Date(match.expiry_date).getTime() - Date.now() < 30 * 24 * 60 * 60 * 1000
    : false;

  return (
    <div className="mx-auto max-w-3xl space-y-6" style={{ padding: '32px 40px' }}>
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link
          href="/inventory"
          className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
        >
          <ArrowLeft className="size-5" />
        </Link>
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold">
            <ScanBarcode className="h-6 w-6 text-primary" />
            {t('scanTitle')}
          </h1>
          <p className="text-sm text-muted-foreground">
            {t('scanDescription')}
          </p>
        </div>
      </div>

      {!supportsDetector && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-lg border border-amber-400/50 bg-amber-500/5 px-4 py-3"
        >
          <div className="flex items-center gap-2">
            <AlertTriangle className="size-4 text-amber-500 shrink-0" />
            <span className="text-sm text-amber-600 dark:text-amber-400">
              {t('scanNoDetector')}
            </span>
          </div>
        </motion.div>
      )}

      {/* Camera / file capture */}
      <Card className="bg-card/80 backdrop-blur border-border/50">
        <CardContent className="p-5 space-y-4">
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={onFile}
            className="hidden"
          />
          {photoDataUrl ? (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={photoDataUrl} alt={t('scanTitle')} className="mx-auto max-h-64 rounded-md border" />
            </motion.div>
          ) : (
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="flex w-full flex-col items-center justify-center gap-2 rounded-md border-2 border-dashed border-muted-foreground/30 p-12 text-muted-foreground transition-colors hover:border-primary/50 hover:bg-muted/30"
            >
              <Camera className="h-10 w-10" />
              <span className="text-sm font-medium">{t('scanCapture')}</span>
            </button>
          )}

          <div className="space-y-2">
            <Label>{t('scanBarcode')}</Label>
            <div className="flex gap-2">
              <Input
                value={barcode}
                onChange={(e) => setBarcode(e.target.value)}
                placeholder={t('scanBarcodePlaceholder')}
              />
              <Button type="button" onClick={() => lookup(barcode)} disabled={!barcode || busy}>
                {tc('search')}
              </Button>
            </div>
          </div>

          {photoDataUrl && (
            <Button variant="ghost" size="sm" onClick={reset}>
              {tc('clear')}
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Match found */}
      <AnimatePresence>
        {searched && match && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
          >
            <Card className="border-2 border-emerald-200 bg-emerald-50/40 dark:border-emerald-900 dark:bg-emerald-950/20">
              <CardContent className="p-5">
                <div className="flex items-start gap-4">
                  {match.image_url && (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img src={match.image_url} alt={match.name} className="h-20 w-20 rounded-md object-cover" />
                  )}
                  <div className="flex-1 space-y-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <Package className="h-5 w-5 text-emerald-600" />
                        <h2 className="text-lg font-semibold">{match.name}</h2>
                      </div>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {t('scanStock')}: <span className="font-bold text-foreground">{match.quantity}</span> {match.unit}
                        {match.cost_per_unit ? ` | ${match.cost_per_unit} UAH/${match.unit}` : ''}
                      </p>

                      {/* Expiry date display */}
                      {match.expiry_date && (
                        <div className="flex items-center gap-1.5 mt-1">
                          <CalendarClock className="size-3.5 text-muted-foreground" />
                          <span className={`text-sm ${isExpiringSoon ? 'text-amber-600 dark:text-amber-400 font-medium' : 'text-muted-foreground'}`}>
                            {t('scanExpiry')}: {new Date(match.expiry_date).toLocaleDateString()}
                          </span>
                          {isExpiringSoon && (
                            <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-amber-400 text-amber-600">
                              {t('scanExpiringSoon')}
                            </Badge>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Serial number input */}
                    <div className="space-y-1">
                      <Label className="text-xs">{t('scanSerial')}</Label>
                      <Input
                        value={serialNumber}
                        onChange={(e) => setSerialNumber(e.target.value)}
                        placeholder={t('scanSerialPlaceholder')}
                        className="h-8 text-sm"
                      />
                    </div>

                    {/* Action buttons */}
                    <div className="flex flex-wrap gap-2">
                      <Button size="sm" variant="outline" onClick={() => adjust(-1)}>
                        <Minus className="mr-1 h-3 w-3" /> {t('scanDeduct')} 1
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => adjust(1)}>
                        <Plus className="mr-1 h-3 w-3" /> {t('scanReceive')} 1
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setLinkDialogOpen(true)}
                        disabled={!!linkedClient}
                      >
                        {linkedClient ? (
                          <>
                            <Check className="mr-1 h-3 w-3" /> {linkedClient.full_name}
                          </>
                        ) : (
                          <>
                            <UserPlus className="mr-1 h-3 w-3" /> {t('scanLinkClient')}
                          </>
                        )}
                      </Button>
                      {!scanRecorded && (
                        <Button size="sm" onClick={recordScanEvent}>
                          <ScanBarcode className="mr-1 h-3 w-3" /> {t('scanRecord')}
                        </Button>
                      )}
                      {scanRecorded && (
                        <Badge variant="outline" className="text-emerald-600 border-emerald-400">
                          <Check className="mr-1 h-3 w-3" /> {t('scanRecorded')}
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* No match — create new */}
      <AnimatePresence>
        {searched && !match && barcode && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
          >
            <Card className="border-2 border-amber-200 bg-amber-50/40 dark:border-amber-900 dark:bg-amber-950/20">
              <CardContent className="p-5 space-y-3">
                <h2 className="font-semibold">{t('scanNotFound')}</h2>
                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="space-y-1">
                    <Label>{t('itemName')}</Label>
                    <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder={t('itemNamePlaceholder')} />
                  </div>
                  <div className="space-y-1">
                    <Label>{t('costPerUnit')}</Label>
                    <Input
                      type="number"
                      value={newPrice}
                      onChange={(e) => setNewPrice(e.target.value)}
                      placeholder="450"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label>{t('scanExpiry')}</Label>
                    <Input
                      type="date"
                      value={newExpiry}
                      onChange={(e) => setNewExpiry(e.target.value)}
                    />
                  </div>
                </div>
                <Button onClick={createNew} disabled={busy || !newName.trim()}>
                  {t('addItem')}
                </Button>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Link to client dialog */}
      <Dialog open={linkDialogOpen} onOpenChange={setLinkDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('scanLinkClient')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label>{tc('search')}</Label>
              <Input
                value={clientSearch}
                onChange={(e) => searchClients(e.target.value)}
                placeholder={t('scanClientSearchPlaceholder')}
                autoFocus
              />
            </div>
            {clientsLoading && (
              <p className="text-sm text-muted-foreground">{tc('loading')}...</p>
            )}
            <div className="space-y-1 max-h-60 overflow-y-auto">
              {clientOptions.map((c) => (
                <button
                  key={c.id}
                  onClick={() => linkToClient(c)}
                  disabled={busy}
                  className="w-full text-left px-3 py-2 rounded-lg hover:bg-muted/50 transition-colors text-sm"
                >
                  {c.full_name}
                </button>
              ))}
              {clientSearch.length >= 2 && !clientsLoading && clientOptions.length === 0 && (
                <p className="text-sm text-muted-foreground px-3 py-2">{t('scanNoClients')}</p>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
