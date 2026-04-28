/** --- YAML
 * name: CategoryManager
 * description: Inline manager for service categories — list of chips + form to add (name + 12 color swatches). Listens for 'services:refresh' to sync with child dialogs.
 * created: 2026-04-12
 * updated: 2026-04-17
 * --- */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Plus, X } from 'lucide-react';
import { humanizeError } from '@/lib/format/error';

export interface Category {
  id: string;
  name: string;
  color: string;
}

interface CategoryManagerProps {
  masterId: string;
  onCategoriesChange?: (categories: Category[]) => void;
}

const COLOR_SWATCHES = [
  '#0d9488', '#ec4899', '#ef4444', '#f59e0b',
  '#10b981', '#06b6d4', '#3b82f6', '#6366f1',
  '#2dd4bf', '#f43f5e', '#64748b', '#0f172a',
];

export function CategoryManager({ masterId, onCategoriesChange }: CategoryManagerProps) {
  const t = useTranslations('profile');
  const [categories, setCategories] = useState<Category[]>([]);
  const [newName, setNewName] = useState('');
  const [newColor, setNewColor] = useState(COLOR_SWATCHES[0]);
  const [loading, setLoading] = useState(true);
  const [isExpanded, setIsExpanded] = useState(false);

  const loadCategories = useCallback(async () => {
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
  }, [masterId, onCategoriesChange]);

  useEffect(() => {
    loadCategories();
    // Reload when services:refresh event fires (from ServiceForm's CategoryDialog)
    const handler = () => loadCategories();
    window.addEventListener('services:refresh', handler);
    return () => window.removeEventListener('services:refresh', handler);
  }, [loadCategories]);

  async function addCategory() {
    if (!newName.trim()) return;
    const supabase = createClient();
    const { error } = await supabase.from('service_categories').insert({
      master_id: masterId,
      name: newName.trim(),
      color: newColor,
    });
    if (error) { toast.error(humanizeError(error)); return; }
    toast.success('Категория создана');
    setNewName('');
    setNewColor(COLOR_SWATCHES[0]);
    setIsExpanded(false);
    loadCategories();
  }

  async function deleteCategory(id: string) {
    const supabase = createClient();
    const { error } = await supabase.from('service_categories').delete().eq('id', id);
    if (error) { toast.error(humanizeError(error)); return; }
    loadCategories();
  }

  if (loading) return null;

  return (
    <div className="space-y-3">
      {/* Category chips */}
      <div className="flex flex-wrap gap-2">
        {categories.length === 0 && !isExpanded && (
          <p className="text-sm text-muted-foreground">{t('noCategories') || 'Пока нет категорий'}</p>
        )}
        {categories.map((cat) => (
          <div
            key={cat.id}
            className="group inline-flex items-center gap-2 h-8 pl-2.5 pr-1 rounded-full border-2 border-border bg-card"
          >
            <span
              className="w-2.5 h-2.5 rounded-full"
              style={{ backgroundColor: cat.color }}
            />
            <span className="text-sm font-medium">{cat.name}</span>
            <button
              onClick={() => deleteCategory(cat.id)}
              className="w-5 h-5 rounded-full flex items-center justify-center text-muted-foreground hover:bg-destructive hover:text-destructive-foreground transition"
              aria-label={`Удалить ${cat.name}`}
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        ))}
        {!isExpanded && (
          <button
            type="button"
            onClick={() => setIsExpanded(true)}
            className="inline-flex items-center gap-1.5 h-8 px-3 rounded-full border-2 border-dashed border-border text-sm font-medium text-muted-foreground hover:border-primary hover:text-primary transition"
          >
            <Plus className="w-3.5 h-3.5" />
            Добавить категорию
          </button>
        )}
      </div>

      {/* Inline add form (expands on click) */}
      {isExpanded && (
        <div className="rounded-lg border-2 border-border bg-card p-4 space-y-3">
          <div className="space-y-1.5">
            <label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Название категории
            </label>
            <Input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Напр.: Стрижки и укладки"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') addCategory();
                if (e.key === 'Escape') setIsExpanded(false);
              }}
              className="border-2 border-border focus-visible:border-primary"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Цвет
            </label>
            <div className="flex flex-wrap gap-2">
              {COLOR_SWATCHES.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setNewColor(c)}
                  style={{
                    width: 30, height: 30, borderRadius: 999,
                    background: c,
                    border: newColor === c ? '3px solid #fff' : '2px solid transparent',
                    boxShadow: newColor === c ? `0 0 0 2px ${c}` : '0 0 0 1px rgba(0,0,0,0.1)',
                    cursor: 'pointer',
                  }}
                  aria-label={c}
                />
              ))}
            </div>
          </div>

          <div className="flex gap-2 justify-end pt-2 border-t border-border">
            <Button
              type="button"
              variant="outline"
              onClick={() => { setIsExpanded(false); setNewName(''); }}
            >
              Отмена
            </Button>
            <Button
              type="button"
              onClick={addCategory}
              disabled={!newName.trim()}
            >
              Создать
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
