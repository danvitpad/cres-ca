/** --- YAML
 * name: BirthdaySettingsDialog
 * description: Modal to configure birthday automation — toggles for TG greeting + discount, configurable % / visits / validity / services.
 * created: 2026-04-17
 * updated: 2026-04-17
 * --- */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { Cake, MessageSquare, Percent, Calendar as CalendarIcon } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { humanizeError } from '@/lib/format/error';

interface BirthdaySettings {
  enabled: boolean;
  send_tg_greeting: boolean;
  greeting_message: string;
  offer_discount: boolean;
  discount_percent: number;
  discount_visits: number;
  discount_validity_days: number;
  discount_services: string[];
}

const DEFAULT: BirthdaySettings = {
  enabled: true,
  send_tg_greeting: true,
  // Без приветствия — чтобы работало и на «ты», и на «Вы».
  greeting_message: 'С днём рождения! 🎉\nВ подарок: {discount_text}',
  offer_discount: true,
  discount_percent: 15,
  discount_visits: 1,
  discount_validity_days: 30,
  discount_services: [],
};

interface ServiceRow { id: string; name: string }

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  masterId: string;
}

export function BirthdaySettingsDialog({ open, onOpenChange, masterId }: Props) {
  const [s, setS] = useState<BirthdaySettings>(DEFAULT);
  const [services, setServices] = useState<ServiceRow[]>([]);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!open) return;
    const supabase = createClient();
    const { data: master } = await supabase
      .from('masters')
      .select('birthday_settings')
      .eq('id', masterId)
      .maybeSingle();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const cur = (master?.birthday_settings as any) || {};
    setS({ ...DEFAULT, ...cur });

    const { data: svc } = await supabase
      .from('services')
      .select('id, name')
      .eq('master_id', masterId)
      .order('name');
    setServices((svc as ServiceRow[]) || []);
    setLoading(false);
  }, [open, masterId]);

  useEffect(() => { load(); }, [load]);

  async function save() {
    setSaving(true);
    const supabase = createClient();
    const { error } = await supabase
      .from('masters')
      .update({ birthday_settings: s })
      .eq('id', masterId);
    setSaving(false);
    if (error) { toast.error(humanizeError(error)); return; }
    toast.success('Настройки сохранены');
    onOpenChange(false);
  }

  function toggleService(id: string) {
    setS(prev => {
      const cur = new Set(prev.discount_services);
      if (cur.has(id)) cur.delete(id); else cur.add(id);
      return { ...prev, discount_services: Array.from(cur) };
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="!max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Cake className="h-5 w-5 text-pink-500" />
            Поздравления с днём рождения
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="py-8 text-center text-sm text-muted-foreground">Загрузка...</div>
        ) : (
          <div className="space-y-5">
            {/* Master switch */}
            <div className="flex items-center justify-between rounded-lg border-2 border-border bg-card p-3">
              <div>
                <div className="text-sm font-semibold">Включить автопоздравления</div>
                <div className="text-xs text-muted-foreground">Бот сам напишет клиенту в день его рождения</div>
              </div>
              <Switch
                checked={s.enabled}
                onCheckedChange={(v) => setS({ ...s, enabled: v })}
              />
            </div>

            {s.enabled && (
              <>
                {/* TG greeting */}
                <div className="space-y-3 rounded-lg border-2 border-border bg-card p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <MessageSquare className="h-4 w-4 text-primary" />
                      <span className="text-sm font-semibold">Поздравительное сообщение в Telegram</span>
                    </div>
                    <Switch
                      checked={s.send_tg_greeting}
                      onCheckedChange={(v) => setS({ ...s, send_tg_greeting: v })}
                    />
                  </div>

                  {s.send_tg_greeting && (
                    <div className="space-y-1.5">
                      <Label className="text-xs">Шаблон сообщения</Label>
                      <Textarea
                        rows={3}
                        value={s.greeting_message}
                        onChange={(e) => setS({ ...s, greeting_message: e.target.value })}
                        placeholder="С днём рождения! 🎉"
                      />
                      <p className="text-[11px] text-muted-foreground">
                        Доступные плейсхолдеры: <code>{'{client_name}'}</code>, <code>{'{discount_text}'}</code>
                      </p>
                    </div>
                  )}
                </div>

                {/* Discount config */}
                <div className="space-y-3 rounded-lg border-2 border-border bg-card p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Percent className="h-4 w-4 text-green-500" />
                      <span className="text-sm font-semibold">Скидка-подарок</span>
                    </div>
                    <Switch
                      checked={s.offer_discount}
                      onCheckedChange={(v) => setS({ ...s, offer_discount: v })}
                    />
                  </div>

                  {s.offer_discount && (
                    <>
                      <div className="grid grid-cols-3 gap-3">
                        <div className="space-y-1.5">
                          <Label className="text-xs">Размер, %</Label>
                          <Input
                            type="number"
                            min={1}
                            max={50}
                            value={s.discount_percent}
                            onChange={(e) => setS({ ...s, discount_percent: Math.min(50, Math.max(1, parseInt(e.target.value) || 0)) })}
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-xs">На N визитов</Label>
                          <Input
                            type="number"
                            min={1}
                            max={10}
                            value={s.discount_visits}
                            onChange={(e) => setS({ ...s, discount_visits: Math.min(10, Math.max(1, parseInt(e.target.value) || 1)) })}
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-xs">Действует, дней</Label>
                          <Input
                            type="number"
                            min={1}
                            max={365}
                            value={s.discount_validity_days}
                            onChange={(e) => setS({ ...s, discount_validity_days: Math.min(365, Math.max(1, parseInt(e.target.value) || 30)) })}
                          />
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <Label className="text-xs flex items-center gap-1.5">
                          <CalendarIcon className="h-3 w-3" />
                          На какие услуги
                          <span className="text-muted-foreground">
                            {s.discount_services.length === 0 ? '(на все)' : `(${s.discount_services.length} выбрано)`}
                          </span>
                        </Label>
                        {services.length === 0 ? (
                          <p className="rounded-md border border-dashed p-3 text-xs text-muted-foreground">
                            Нет услуг — создайте их в Каталоге.
                          </p>
                        ) : (
                          <div className="max-h-32 space-y-1 overflow-y-auto rounded-md border p-2">
                            <button
                              type="button"
                              onClick={() => setS({ ...s, discount_services: [] })}
                              className={`flex w-full items-center gap-2 rounded px-2 py-1 text-xs hover:bg-muted ${
                                s.discount_services.length === 0 ? 'bg-primary/10 text-primary font-medium' : 'text-muted-foreground'
                              }`}
                            >
                              ✓ Все услуги
                            </button>
                            {services.map(svc => {
                              const checked = s.discount_services.includes(svc.id);
                              return (
                                <button
                                  key={svc.id}
                                  type="button"
                                  onClick={() => toggleService(svc.id)}
                                  className={`flex w-full items-center gap-2 rounded px-2 py-1 text-xs hover:bg-muted ${
                                    checked ? 'bg-primary/10 text-primary font-medium' : ''
                                  }`}
                                >
                                  <span className={`flex h-3.5 w-3.5 items-center justify-center rounded border ${checked ? 'border-primary bg-primary text-white' : 'border-input'}`}>
                                    {checked && '✓'}
                                  </span>
                                  {svc.name}
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </>
                  )}
                </div>

                {/* Preview */}
                {s.send_tg_greeting && (
                  <div className="rounded-lg border bg-muted/30 p-3">
                    <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Превью сообщения клиенту
                    </div>
                    <div className="text-sm whitespace-pre-wrap">
                      {s.greeting_message
                        .replace('{client_name}', 'Мария')
                        .replace(
                          '{discount_text}',
                          s.offer_discount
                            ? `${s.discount_percent}% скидка на ${s.discount_visits === 1 ? 'следующий визит' : `${s.discount_visits} визитов`}, действует ${s.discount_validity_days} дней`
                            : '🎁',
                        )}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        <div className="flex justify-end gap-2 border-t pt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Отмена</Button>
          <Button onClick={save} disabled={saving}>
            {saving ? 'Сохранение...' : 'Сохранить'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
