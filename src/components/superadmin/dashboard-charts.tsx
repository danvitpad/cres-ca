/** --- YAML
 * name: Superadmin dashboard charts
 * description: Client-side recharts wrappers — 12-month MRR line + 30-day stacked registrations bar chart.
 * created: 2026-04-19
 * --- */

'use client';

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  BarChart,
  Bar,
  Legend,
} from 'recharts';

const AXIS = { fontSize: 11, fill: '#ffffff80' };
const GRID = '#ffffff14';

export function MrrLineChart({ data }: { data: Array<{ label: string; value: number }> }) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <LineChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid stroke={GRID} strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey="label" tick={AXIS} axisLine={{ stroke: GRID }} tickLine={false} />
        <YAxis tick={AXIS} axisLine={{ stroke: GRID }} tickLine={false} width={48} tickFormatter={(v) => `${v}₴`} />
        <Tooltip
          contentStyle={{ background: '#1f2023', border: '1px solid #ffffff1a', borderRadius: 8, fontSize: 12 }}
          labelStyle={{ color: '#ffffffb3' }}
          formatter={(v) => [`${Number(v).toLocaleString('ru-RU')} ₴`, 'MRR']}
        />
        <Line type="monotone" dataKey="value" stroke="#5eead4" strokeWidth={2} dot={{ r: 3, fill: '#5eead4' }} activeDot={{ r: 5 }} />
      </LineChart>
    </ResponsiveContainer>
  );
}

export function RegistrationsChart({ data }: { data: Array<{ date: string; clients: number; masters: number; salons: number }> }) {
  const formatted = data.map((d) => ({ ...d, short: d.date.slice(5) }));
  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={formatted} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid stroke={GRID} strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey="short" tick={AXIS} axisLine={{ stroke: GRID }} tickLine={false} interval={3} />
        <YAxis tick={AXIS} axisLine={{ stroke: GRID }} tickLine={false} width={36} allowDecimals={false} />
        <Tooltip
          contentStyle={{ background: '#1f2023', border: '1px solid #ffffff1a', borderRadius: 8, fontSize: 12 }}
          labelStyle={{ color: '#ffffffb3' }}
        />
        <Legend wrapperStyle={{ fontSize: 11, paddingTop: 4 }} iconType="circle" />
        <Bar dataKey="clients" stackId="a" fill="#60a5fa" name="Клиенты" />
        <Bar dataKey="masters" stackId="a" fill="#5eead4" name="Мастера" />
        <Bar dataKey="salons" stackId="a" fill="#f472b6" name="Салоны" />
      </BarChart>
    </ResponsiveContainer>
  );
}
