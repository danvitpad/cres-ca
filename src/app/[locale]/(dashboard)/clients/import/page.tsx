/** --- YAML
 * name: Clients CSV Import
 * description: Импорт клиентов из CSV — парсит первую строку как заголовки, мастер маппит колонки на поля (full_name, phone, email, date_of_birth, notes), затем bulk insert в clients.
 * created: 2026-04-13
 * updated: 2026-04-13
 * --- */

'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Upload, Users, Check } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useMaster } from '@/hooks/use-master';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';

type FieldKey = 'full_name' | 'phone' | 'email' | 'date_of_birth' | 'notes' | 'ignore';

const FIELDS: { key: FieldKey; label: string }[] = [
  { key: 'full_name', label: 'Имя (обязательно)' },
  { key: 'phone', label: 'Телефон' },
  { key: 'email', label: 'Email' },
  { key: 'date_of_birth', label: 'Дата рождения (YYYY-MM-DD)' },
  { key: 'notes', label: 'Заметки' },
  { key: 'ignore', label: '— игнорировать —' },
];

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cur = '';
  let q = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) {
      if (ch === '"' && text[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (ch === '"') {
        q = false;
      } else {
        cur += ch;
      }
    } else {
      if (ch === '"') q = true;
      else if (ch === ',') {
        row.push(cur);
        cur = '';
      } else if (ch === '\n') {
        row.push(cur);
        rows.push(row);
        row = [];
        cur = '';
      } else if (ch !== '\r') {
        cur += ch;
      }
    }
  }
  if (cur || row.length) {
    row.push(cur);
    rows.push(row);
  }
  return rows.filter((r) => r.some((c) => c.trim()));
}

export default function ClientsImportPage() {
  const { master } = useMaster();
  const [rows, setRows] = useState<string[][]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [mapping, setMapping] = useState<Record<number, FieldKey>>({});
  const [importing, setImporting] = useState(false);
  const [done, setDone] = useState<number | null>(null);

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const text = reader.result as string;
      const parsed = parseCsv(text);
      if (!parsed.length) return toast.error('Пустой файл');
      setHeaders(parsed[0]);
      setRows(parsed.slice(1));
      // Auto-detect common columns
      const auto: Record<number, FieldKey> = {};
      parsed[0].forEach((h, i) => {
        const low = h.toLowerCase();
        if (low.includes('name') || low.includes('имя') || low.includes('ім')) auto[i] = 'full_name';
        else if (low.includes('phone') || low.includes('тел')) auto[i] = 'phone';
        else if (low.includes('mail') || low.includes('пошт')) auto[i] = 'email';
        else if (low.includes('birth') || low.includes('дата') || low.includes('народж')) auto[i] = 'date_of_birth';
        else if (low.includes('note') || low.includes('замет')) auto[i] = 'notes';
        else auto[i] = 'ignore';
      });
      setMapping(auto);
      setDone(null);
    };
    reader.readAsText(file, 'utf-8');
  }

  async function doImport() {
    if (!master?.id) return;
    const nameCol = Object.entries(mapping).find(([, v]) => v === 'full_name')?.[0];
    if (!nameCol) {
      toast.error('Нужна колонка "Имя"');
      return;
    }
    setImporting(true);
    const supabase = createClient();
    const inserts = rows
      .map((r) => {
        const obj: Record<string, string | null> = { master_id: master.id };
        for (const [col, field] of Object.entries(mapping)) {
          if (field === 'ignore') continue;
          const v = r[Number(col)]?.trim();
          if (v) obj[field] = v;
        }
        return obj.full_name ? obj : null;
      })
      .filter((x): x is Record<string, string> => !!x);
    const { error, count } = await supabase
      .from('clients')
      .insert(inserts, { count: 'exact' });
    setImporting(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setDone(count ?? inserts.length);
    toast.success(`Импортировано: ${count ?? inserts.length}`);
    setRows([]);
    setHeaders([]);
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-semibold">
          <Users className="h-6 w-6 text-primary" />
          Импорт клиентов из CSV
        </h1>
        <p className="text-sm text-muted-foreground">
          Загрузите CSV-файл с клиентами. Первая строка — заголовки колонок. Затем выберите какая колонка куда сохраняется.
        </p>
      </div>

      {done !== null && (
        <div className="flex items-center gap-2 rounded-lg border border-green-500/30 bg-green-500/10 p-4 text-sm text-green-700">
          <Check className="h-4 w-4" />
          Успешно импортировано {done} клиентов.
        </div>
      )}

      <div className="rounded-lg border bg-card p-5">
        <Label className="mb-2 block">CSV-файл</Label>
        <input
          type="file"
          accept=".csv,text/csv"
          onChange={onFile}
          className="text-sm"
        />
      </div>

      {headers.length > 0 && (
        <>
          <div className="rounded-lg border bg-card p-5">
            <div className="mb-3 text-sm font-semibold">Маппинг колонок</div>
            <div className="space-y-2">
              {headers.map((h, i) => (
                <div key={i} className="flex items-center gap-3 text-sm">
                  <div className="w-48 truncate font-mono text-muted-foreground">{h}</div>
                  <span className="text-muted-foreground">→</span>
                  <select
                    value={mapping[i] ?? 'ignore'}
                    onChange={(e) =>
                      setMapping((p) => ({ ...p, [i]: e.target.value as FieldKey }))
                    }
                    className="flex-1 rounded border bg-background px-2 py-1"
                  >
                    {FIELDS.map((f) => (
                      <option key={f.key} value={f.key}>
                        {f.label}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-lg border bg-card p-5">
            <div className="mb-2 text-sm font-semibold">Превью ({rows.length} строк)</div>
            <div className="max-h-64 overflow-auto text-xs">
              <table className="w-full">
                <thead className="sticky top-0 bg-card">
                  <tr>
                    {headers.map((h, i) => (
                      <th key={i} className="border-b p-2 text-left font-medium">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.slice(0, 5).map((r, i) => (
                    <tr key={i}>
                      {r.map((c, j) => (
                        <td key={j} className="border-b p-2 text-muted-foreground">
                          {c}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="flex justify-end">
            <Button onClick={doImport} disabled={importing || !rows.length}>
              <Upload className="mr-1 h-4 w-4" />
              {importing ? 'Импорт…' : `Импортировать ${rows.length}`}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
