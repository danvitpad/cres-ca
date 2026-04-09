/** --- YAML
 * name: CommandPalette
 * description: Cmd+K modal with search input and categorized results for quick navigation
 * --- */

'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';
import {
  Search,
  Calendar,
  Users,
  Scissors,
  DollarSign,
  Package,
  Megaphone,
  Settings,
  Plus,
  X,
} from 'lucide-react';

interface CommandItem {
  id: string;
  label: string;
  icon: React.ReactNode;
  category: string;
  href?: string;
  action?: () => void;
}

interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  items?: CommandItem[];
}

const defaultIcon: Record<string, React.ReactNode> = {
  calendar: <Calendar className="h-4 w-4" />,
  clients: <Users className="h-4 w-4" />,
  services: <Scissors className="h-4 w-4" />,
  finance: <DollarSign className="h-4 w-4" />,
  inventory: <Package className="h-4 w-4" />,
  marketing: <Megaphone className="h-4 w-4" />,
  settings: <Settings className="h-4 w-4" />,
};

export function useCommandPalette() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, []);

  return { open, setOpen };
}

export function CommandPalette({ open, onOpenChange, items: externalItems }: CommandPaletteProps) {
  const t = useTranslations('dashboard');
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);

  const defaultItems: CommandItem[] = useMemo(
    () => [
      { id: 'calendar', label: t('calendar'), icon: defaultIcon.calendar, category: 'pages', href: '/calendar' },
      { id: 'clients', label: t('clients'), icon: defaultIcon.clients, category: 'pages', href: '/clients' },
      { id: 'services', label: t('services'), icon: defaultIcon.services, category: 'pages', href: '/services' },
      { id: 'finance', label: t('finance'), icon: defaultIcon.finance, category: 'pages', href: '/finance' },
      { id: 'inventory', label: t('inventory'), icon: defaultIcon.inventory, category: 'pages', href: '/inventory' },
      { id: 'marketing', label: t('marketing'), icon: defaultIcon.marketing, category: 'pages', href: '/marketing' },
      { id: 'settings', label: t('settings'), icon: defaultIcon.settings, category: 'pages', href: '/settings' },
      { id: 'new-appointment', label: t('newAppointment'), icon: <Plus className="h-4 w-4" />, category: 'actions' },
      { id: 'add-client', label: t('addClient'), icon: <Plus className="h-4 w-4" />, category: 'actions' },
    ],
    [t],
  );

  const items = externalItems ?? defaultItems;

  const filtered = useMemo(() => {
    if (!query) return items;
    const q = query.toLowerCase();
    return items.filter((item) => item.label.toLowerCase().includes(q));
  }, [items, query]);

  const grouped = useMemo(() => {
    const groups: Record<string, CommandItem[]> = {};
    for (const item of filtered) {
      const cat = item.category;
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(item);
    }
    return groups;
  }, [filtered]);

  useEffect(() => {
    if (open) {
      setQuery('');
      setActiveIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  const execute = useCallback(
    (item: CommandItem) => {
      onOpenChange(false);
      if (item.href) router.push(item.href);
      else item.action?.();
    },
    [onOpenChange, router],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setActiveIndex((i) => Math.min(i + 1, filtered.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActiveIndex((i) => Math.max(i - 1, 0));
      } else if (e.key === 'Enter' && filtered[activeIndex]) {
        e.preventDefault();
        execute(filtered[activeIndex]);
      }
    },
    [filtered, activeIndex, execute],
  );

  if (!open) return null;

  let flatIndex = 0;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[20vh] animate-fade-in">
      <div className="absolute inset-0 bg-black/40" onClick={() => onOpenChange(false)} />
      <div className="relative w-full max-w-lg overflow-hidden rounded-2xl bg-card shadow-[var(--shadow-overlay)] animate-scale-in">
        <div className="flex items-center gap-2 border-b px-4">
          <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={t('searchPlaceholder')}
            className="flex-1 bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground"
          />
          {query && (
            <button onClick={() => setQuery('')} className="text-muted-foreground hover:text-foreground">
              <X className="h-4 w-4" />
            </button>
          )}
          <kbd className="hidden rounded border bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground sm:inline-block">
            ESC
          </kbd>
        </div>
        <div className="max-h-72 overflow-y-auto p-2 scrollbar-thin">
          {filtered.length === 0 && (
            <p className="py-6 text-center text-sm text-muted-foreground">{t('noResults')}</p>
          )}
          {Object.entries(grouped).map(([category, categoryItems]) => (
            <div key={category}>
              <p className="px-2 py-1.5 text-xs font-medium uppercase text-muted-foreground">
                {category}
              </p>
              {categoryItems.map((item) => {
                const idx = flatIndex++;
                return (
                  <button
                    key={item.id}
                    onClick={() => execute(item)}
                    className={cn(
                      'flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors',
                      idx === activeIndex
                        ? 'bg-[var(--ds-accent-soft)] text-[var(--ds-accent)]'
                        : 'text-foreground hover:bg-muted',
                    )}
                  >
                    <span className="shrink-0">{item.icon}</span>
                    {item.label}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
