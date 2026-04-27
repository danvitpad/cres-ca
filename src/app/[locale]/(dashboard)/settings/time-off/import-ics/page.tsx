/** --- YAML
 * name: Import ICS Calendar
 * description: Мастер загружает .ics файл экспорта из Google Calendar (или любого календаря). Все события VEVENT импортируются как blocked_times — блокируют онлайн-запись.
 * created: 2026-04-14
 * updated: 2026-04-14
 * --- */

'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { CalendarDays, Upload, Check } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useMaster } from '@/hooks/use-master';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { humanizeError } from '@/lib/format/error';

interface Event {
  summary: string;
  starts_at: string;
  ends_at: string;
}

function parseIcsDate(value: string): string | null {
  const clean = value.replace(/[^0-9TZ]/g, '');
  if (clean.length < 8) return null;
  const y = clean.slice(0, 4);
  const mo = clean.slice(4, 6);
  const d = clean.slice(6, 8);
  const h = clean.slice(9, 11) || '00';
  const mi = clean.slice(11, 13) || '00';
  const s = clean.slice(13, 15) || '00';
  const isUtc = clean.endsWith('Z');
  const iso = `${y}-${mo}-${d}T${h}:${mi}:${s}${isUtc ? 'Z' : ''}`;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

function parseIcs(text: string): Event[] {
  const events: Event[] = [];
  const lines = text.replace(/\r\n/g, '\n').split('\n');
  // Unfold lines (continuation lines start with space/tab)
  const unfolded: string[] = [];
  for (const line of lines) {
    if ((line.startsWith(' ') || line.startsWith('\t')) && unfolded.length) {
      unfolded[unfolded.length - 1] += line.slice(1);
    } else {
      unfolded.push(line);
    }
  }
  let current: Partial<Event> | null = null;
  for (const line of unfolded) {
    if (line === 'BEGIN:VEVENT') {
      current = {};
      continue;
    }
    if (line === 'END:VEVENT') {
      if (current?.starts_at && current?.ends_at) {
        events.push({
          summary: current.summary ?? 'Google Calendar',
          starts_at: current.starts_at,
          ends_at: current.ends_at,
        });
      }
      current = null;
      continue;
    }
    if (!current) continue;
    const colonIdx = line.indexOf(':');
    if (colonIdx === -1) continue;
    const key = line.slice(0, colonIdx).split(';')[0];
    const val = line.slice(colonIdx + 1);
    if (key === 'SUMMARY') current.summary = val;
    else if (key === 'DTSTART') current.starts_at = parseIcsDate(val) ?? undefined;
    else if (key === 'DTEND') current.ends_at = parseIcsDate(val) ?? undefined;
  }
  return events;
}

export default function ImportIcsPage() {
  const { master } = useMaster();
  const [events, setEvents] = useState<Event[]>([]);
  const [importing, setImporting] = useState(false);
  const [done, setDone] = useState<number | null>(null);

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const text = reader.result as string;
      const parsed = parseIcs(text);
      if (!parsed.length) {
        toast.error('В файле нет событий (VEVENT)');
        return;
      }
      const now = Date.now();
      const future = parsed.filter((e) => new Date(e.ends_at).getTime() > now);
      setEvents(future);
      setDone(null);
    };
    reader.readAsText(file, 'utf-8');
  }

  async function doImport() {
    if (!master?.id || !events.length) return;
    setImporting(true);
    const supabase = createClient();
    const rows = events.map((e) => ({
      master_id: master.id,
      starts_at: e.starts_at,
      ends_at: e.ends_at,
      reason: `📅 ${e.summary}`,
    }));
    const { error, count } = await supabase
      .from('blocked_times')
      .insert(rows, { count: 'exact' });
    setImporting(false);
    if (error) {
      toast.error(humanizeError(error));
      return;
    }
    setDone(count ?? rows.length);
    setEvents([]);
    toast.success(`Импортировано: ${count ?? rows.length}`);
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-semibold">
          <CalendarDays className="h-6 w-6 text-primary" />
          Импорт из Google Calendar
        </h1>
        <p className="text-sm text-muted-foreground">
          Экспортируй календарь из Google Calendar (Settings → Export calendar → .ics файл), загрузи его сюда — события заблокируют онлайн-запись.
        </p>
      </div>

      {done !== null && (
        <div className="flex items-center gap-2 rounded-lg border border-green-500/30 bg-green-500/10 p-4 text-sm text-green-700">
          <Check className="h-4 w-4" />
          Импортировано {done} событий в blocked_times.
        </div>
      )}

      <div className="rounded-lg border bg-card p-5">
        <Label className="mb-2 block">.ics файл</Label>
        <input type="file" accept=".ics,text/calendar" onChange={onFile} className="text-sm" />
      </div>

      {events.length > 0 && (
        <>
          <div className="rounded-lg border bg-card p-5">
            <div className="mb-2 text-sm font-semibold">
              Будущие события ({events.length})
            </div>
            <div className="max-h-80 space-y-2 overflow-y-auto text-sm">
              {events.slice(0, 50).map((e, i) => (
                <div key={i} className="rounded-md border p-2">
                  <div className="font-medium">{e.summary}</div>
                  <div className="text-xs text-muted-foreground">
                    {new Date(e.starts_at).toLocaleString()} – {new Date(e.ends_at).toLocaleString()}
                  </div>
                </div>
              ))}
              {events.length > 50 && (
                <div className="text-center text-xs text-muted-foreground">
                  …и ещё {events.length - 50}
                </div>
              )}
            </div>
          </div>

          <div className="flex justify-end">
            <Button onClick={doImport} disabled={importing}>
              <Upload className="mr-1 h-4 w-4" />
              {importing ? 'Импорт…' : `Заблокировать ${events.length} слотов`}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
