/** --- YAML
 * name: Inventory Page
 * description: Stock/consumables management — materials list, quantities, auto-deduction setup
 * --- */

import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';

export default function InventoryPage() {
  const t = useTranslations('inventory');

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">{t('addItem')}</h2>
        <Button>
          <Plus className="h-4 w-4 mr-2" />
          {t('addItem')}
        </Button>
      </div>
      <div className="rounded-lg border p-8 text-center text-muted-foreground">
        {t('noItems')}
      </div>
    </div>
  );
}
