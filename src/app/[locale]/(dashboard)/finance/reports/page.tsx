/** --- YAML
 * name: FinancialReportsPage
 * description: Monthly financial reports generator with download links
 * --- */

'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { motion } from 'framer-motion';
import { Download, FileText, ChevronLeft, ChevronRight } from 'lucide-react';

export default function ReportsPage() {
  const t = useTranslations('reports');
  const now = new Date();
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());

  const months = Array.from({ length: 12 }, (_, i) => i + 1);
  const currentMonth = now.getMonth() + 1;

  function downloadReport(month: number) {
    window.open(`/api/reports/monthly?year=${selectedYear}&month=${month}`, '_blank');
  }

  const monthNames = [
    t('jan'), t('feb'), t('mar'), t('apr'), t('may'), t('jun'),
    t('jul'), t('aug'), t('sep'), t('oct'), t('nov'), t('dec'),
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">{t('title')}</h2>
      </div>

      {/* Year selector */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => setSelectedYear((y) => y - 1)}
          className="rounded-lg p-2 hover:bg-muted"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <span className="text-lg font-bold">{selectedYear}</span>
        <button
          onClick={() => setSelectedYear((y) => y + 1)}
          disabled={selectedYear >= now.getFullYear()}
          className="rounded-lg p-2 hover:bg-muted disabled:opacity-30"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      {/* Months grid */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {months.map((month, i) => {
          const isPast = selectedYear < now.getFullYear() ||
            (selectedYear === now.getFullYear() && month <= currentMonth);

          return (
            <motion.div
              key={month}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.03 }}
              className="flex items-center justify-between rounded-[var(--radius-card)] border bg-card p-4 shadow-[var(--shadow-card)]"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
                  <FileText className="h-5 w-5 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-sm font-semibold">{monthNames[i]}</p>
                  <p className="text-xs text-muted-foreground">{selectedYear}</p>
                </div>
              </div>
              {isPast ? (
                <button
                  onClick={() => downloadReport(month)}
                  className="inline-flex items-center gap-1.5 rounded-[var(--radius-button)] bg-[var(--ds-accent)] px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-[var(--ds-accent-hover)]"
                >
                  <Download className="h-3.5 w-3.5" />
                  CSV
                </button>
              ) : (
                <span className="text-xs text-muted-foreground">{t('upcoming')}</span>
              )}
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
