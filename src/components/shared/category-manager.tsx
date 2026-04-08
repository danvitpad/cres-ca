/** --- YAML
 * name: CategoryManager
 * description: Inline component for creating/editing service categories (name + color)
 * --- */

'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Plus, X } from 'lucide-react';

export interface Category {
  id: string;
  name: string;
  color: string;
}

interface CategoryManagerProps {
  masterId: string;
  onCategoriesChange?: (categories: Category[]) => void;
}

export function CategoryManager({ masterId, onCategoriesChange }: CategoryManagerProps) {
  const t = useTranslations('profile');
  const tc = useTranslations('common');
  const [categories, setCategories] = useState<Category[]>([]);
  const [newName, setNewName] = useState('');
  const [newColor, setNewColor] = useState('#6366f1');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadCategories();
  }, [masterId]); // eslint-disable-line react-hooks/exhaustive-deps

  async function loadCategories() {
    const supabase = createClient();
    const { data } = await supabase
      .from('service_categories')
      .select('id, name, color')
      .eq('master_id', masterId)
      .order('sort_order');
    if (data) {
      setCategories(data);
      onCategoriesChange?.(data);
    }
    setLoading(false);
  }

  async function addCategory() {
    if (!newName.trim()) return;
    const supabase = createClient();
    const { error } = await supabase.from('service_categories').insert({
      master_id: masterId,
      name: newName.trim(),
      color: newColor,
    });
    if (error) { toast.error(error.message); return; }
    setNewName('');
    loadCategories();
  }

  async function deleteCategory(id: string) {
    const supabase = createClient();
    const { error } = await supabase.from('service_categories').delete().eq('id', id);
    if (error) { toast.error(error.message); return; }
    loadCategories();
  }

  if (loading) return null;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {categories.length === 0 && (
          <p className="text-sm text-muted-foreground">{t('noCategories')}</p>
        )}
        {categories.map((cat) => (
          <Badge key={cat.id} variant="outline" className="gap-1 pl-1">
            <span className="inline-block h-3 w-3 rounded-full" style={{ backgroundColor: cat.color }} />
            {cat.name}
            <button onClick={() => deleteCategory(cat.id)} className="ml-1 hover:text-destructive">
              <X className="h-3 w-3" />
            </button>
          </Badge>
        ))}
      </div>
      <div className="flex gap-2 items-center">
        <Input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder={t('categoryName')}
          className="max-w-48 h-8"
          onKeyDown={(e) => e.key === 'Enter' && addCategory()}
        />
        <input
          type="color"
          value={newColor}
          onChange={(e) => setNewColor(e.target.value)}
          className="h-8 w-8 cursor-pointer rounded border"
        />
        <Button size="sm" variant="outline" onClick={addCategory}>
          <Plus className="h-3 w-3 mr-1" />
          {tc('create')}
        </Button>
      </div>
    </div>
  );
}
