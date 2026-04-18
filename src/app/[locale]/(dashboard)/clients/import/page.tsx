/** --- YAML
 * name: Clients CSV Import
 * description: Импорт клиентов из CSV — парсит первую строку как заголовки, мастер маппит колонки на поля (full_name, phone, email, date_of_birth, notes), затем bulk insert в clients.
 * created: 2026-04-13
 * updated: 2026-04-17
 * --- */

'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Upload, Users, Check } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useMaster } from '@/hooks/use-master';
import {
  FONT, FONT_FEATURES, usePageTheme, pageContainer, cardStyle, headingStyle, labelStyle,
  type PageTheme,
} from '@/lib/dashboard-theme';
import { Table } from '@/components/ui/table';

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

/* ─── Inline button ─── */
function ActionButton({ onClick, disabled, children, C }: {
  onClick: () => void; disabled: boolean; children: React.ReactNode; C: PageTheme;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 6,
        padding: '8px 16px', borderRadius: 8, border: 'none',
        background: C.accent, color: '#fff',
        fontSize: 13, fontWeight: 510, fontFamily: FONT, fontFeatureSettings: FONT_FEATURES,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
        transition: 'background 0.15s',
      }}
    >
      {children}
    </button>
  );
}

export default function ClientsImportPage() {
  const { master } = useMaster();
  const { C } = usePageTheme();
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
    <div style={{ ...pageContainer, background: C.bg, color: C.text }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ ...headingStyle(C), display: 'flex', alignItems: 'center', gap: 8 }}>
          <Users style={{ width: 22, height: 22, color: C.accent }} />
          Импорт клиентов из CSV
        </h1>
        <p style={{ fontSize: 13, color: C.textSecondary, marginTop: 6, lineHeight: 1.5 }}>
          Загрузите CSV-файл с клиентами. Первая строка — заголовки колонок. Затем выберите какая колонка куда сохраняется.
        </p>
      </div>

      {/* Success banner */}
      {done !== null && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '12px 16px', borderRadius: 10, marginBottom: 20,
          background: C.successSoft, border: `1px solid ${C.success}33`,
          fontSize: 13, fontWeight: 510, color: C.success,
        }}>
          <Check style={{ width: 16, height: 16 }} />
          Успешно импортировано {done} клиентов.
        </div>
      )}

      {/* File input card */}
      <div style={{ ...cardStyle(C), marginBottom: 20 }}>
        <div style={{ ...labelStyle(C), marginBottom: 8 }}>CSV-файл</div>
        <input
          type="file"
          accept=".csv,text/csv"
          onChange={onFile}
          style={{
            fontSize: 13, fontFamily: FONT, color: C.text,
            background: C.surfaceElevated, border: `1px solid ${C.border}`,
            borderRadius: 6, padding: '6px 10px',
          }}
        />
      </div>

      {headers.length > 0 && (
        <>
          {/* Column mapping card */}
          <div style={{ ...cardStyle(C), marginBottom: 20 }}>
            <div style={{ fontSize: 14, fontWeight: 510, color: C.text, marginBottom: 14 }}>
              Маппинг колонок
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {headers.map((h, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 13 }}>
                  <div style={{
                    width: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    fontFamily: 'monospace', color: C.textSecondary,
                  }}>
                    {h}
                  </div>
                  <span style={{ color: C.textTertiary }}>→</span>
                  <select
                    value={mapping[i] ?? 'ignore'}
                    onChange={(e) =>
                      setMapping((p) => ({ ...p, [i]: e.target.value as FieldKey }))
                    }
                    style={{
                      flex: 1, borderRadius: 6, padding: '5px 8px',
                      border: `1px solid ${C.border}`, background: C.surface,
                      color: C.text, fontSize: 13, fontFamily: FONT,
                    }}
                  >
                    {FIELDS.map((f) => (
                      <option key={f.key} value={f.key}>{f.label}</option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
          </div>

          {/* Preview card */}
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 14, fontWeight: 510, color: C.text, marginBottom: 10 }}>
              Превью ({rows.length} строк)
            </div>
            <Table C={C}>
              <Table.Header>
                <Table.Row>
                  {headers.map((h, i) => (
                    <Table.Head key={i}>{h}</Table.Head>
                  ))}
                </Table.Row>
              </Table.Header>
              <Table.Body interactive>
                {rows.slice(0, 5).map((r, i) => (
                  <Table.Row key={i}>
                    {r.map((c, j) => (
                      <Table.Cell key={j} style={{ color: C.textSecondary }}>
                        {c}
                      </Table.Cell>
                    ))}
                  </Table.Row>
                ))}
              </Table.Body>
            </Table>
          </div>

          {/* Import button */}
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <ActionButton onClick={doImport} disabled={importing || !rows.length} C={C}>
              <Upload style={{ width: 14, height: 14 }} />
              {importing ? 'Импорт…' : `Импортировать ${rows.length}`}
            </ActionButton>
          </div>
        </>
      )}
    </div>
  );
}
