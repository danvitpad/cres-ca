/** --- YAML
 * name: Filters
 * description: Linear-style compound filter-bar primitive. Config-driven (no hardcoded entities) — pass filter-type configs and current filters; renders chips "type | operator | values | ✕" with add-button trigger. Uses framer-motion for chip and height animations.
 * created: 2026-04-18
 * updated: 2026-04-18
 * --- */

'use client';

import * as React from 'react';
import { Dispatch, SetStateAction, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Check, ListFilter, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';

/* ─── Types ─── */

export type FilterOperator =
  | 'is' | 'is not' | 'is any of'
  | 'include' | 'do not include' | 'include any of' | 'include all of' | 'exclude all of' | 'exclude if any of'
  | 'before' | 'after';

export interface FilterOption {
  value: string;
  label: string;
  icon?: React.ReactNode;
  meta?: string;
}

export type FilterKind = 'enum' | 'multi-enum' | 'date';

export interface FilterConfig {
  type: string;
  label: string;
  icon?: React.ReactNode;
  kind: FilterKind;
  options: FilterOption[];
  group?: string;
}

export interface Filter {
  id: string;
  type: string;
  operator: FilterOperator;
  value: string[];
}

/* ─── Auto-height wrapper ─── */

interface AnimateChangeInHeightProps {
  children: React.ReactNode;
  className?: string;
}

export const AnimateChangeInHeight: React.FC<AnimateChangeInHeightProps> = ({ children, className }) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [height, setHeight] = useState<number | 'auto'>('auto');

  useEffect(() => {
    if (!containerRef.current) return;
    const ro = new ResizeObserver(entries => {
      setHeight(entries[0].contentRect.height);
    });
    ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, []);

  return (
    <motion.div
      className={cn(className, 'overflow-hidden')}
      style={{ height }}
      animate={{ height }}
      transition={{ duration: 0.12, ease: 'easeOut' }}
    >
      <div ref={containerRef}>{children}</div>
    </motion.div>
  );
};

/* ─── Operator resolver ─── */

function defaultOperators(kind: FilterKind, valueLen: number): FilterOperator[] {
  if (kind === 'date') return ['before', 'after'];
  if (kind === 'multi-enum') {
    return valueLen > 1
      ? ['include any of', 'include all of', 'exclude all of', 'exclude if any of']
      : ['include', 'do not include'];
  }
  return valueLen > 1 ? ['is any of', 'is not'] : ['is', 'is not'];
}

/* ─── Operator dropdown ─── */

function OperatorDropdown({
  config,
  filter,
  onChange,
}: {
  config: FilterConfig;
  filter: Filter;
  onChange: (op: FilterOperator) => void;
}) {
  const ops = defaultOperators(config.kind, filter.value.length);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="bg-muted hover:bg-muted/50 px-1.5 py-1 text-muted-foreground hover:text-primary transition shrink-0">
        {filter.operator}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-fit min-w-fit">
        {ops.map(op => (
          <DropdownMenuItem key={op} onClick={() => onChange(op)}>
            {op}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/* ─── Value combobox (enum / multi-enum) ─── */

function ValueCombobox({
  config,
  values,
  onChange,
}: {
  config: FilterConfig;
  values: string[];
  onChange: (next: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const [commandInput, setCommandInput] = useState('');
  const selected = values;
  const notSelected = config.options.filter(o => !selected.includes(o.value));
  const selectedOpts = selected.map(v => config.options.find(o => o.value === v)).filter(Boolean) as FilterOption[];
  const multi = config.kind === 'multi-enum' || true;

  return (
    <Popover
      open={open}
      onOpenChange={v => {
        setOpen(v);
        if (!v) setTimeout(() => setCommandInput(''), 200);
      }}
    >
      <PopoverTrigger className="rounded-none px-1.5 py-1 bg-muted hover:bg-muted/50 transition text-muted-foreground hover:text-primary shrink-0">
        <div className="flex gap-1.5 items-center">
          <div className="flex items-center flex-row -space-x-1.5">
            <AnimatePresence mode="popLayout">
              {selectedOpts.slice(0, 3).map(opt => (
                <motion.div
                  key={opt.value}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -10 }}
                  transition={{ duration: 0.2 }}
                >
                  {opt.icon || null}
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
          {selected.length === 1
            ? selectedOpts[0]?.label ?? selected[0]
            : `${selected.length} selected`}
        </div>
      </PopoverTrigger>
      <PopoverContent className="w-[220px] p-0">
        <AnimateChangeInHeight>
          <Command>
            <CommandInput
              placeholder={config.label}
              className="h-9"
              value={commandInput}
              onInputCapture={e => setCommandInput(e.currentTarget.value)}
            />
            <CommandList>
              <CommandEmpty>No results found.</CommandEmpty>
              <CommandGroup>
                {selectedOpts.map(opt => (
                  <CommandItem
                    key={opt.value}
                    className="group flex gap-2 items-center"
                    onSelect={() => {
                      onChange(selected.filter(v => v !== opt.value));
                      if (!multi) setOpen(false);
                    }}
                  >
                    <Checkbox checked={true} />
                    {opt.icon}
                    <span className="text-accent-foreground">{opt.label}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
              {notSelected.length > 0 && (
                <>
                  {selectedOpts.length > 0 && <CommandSeparator />}
                  <CommandGroup>
                    {notSelected.map(opt => (
                      <CommandItem
                        key={opt.value}
                        value={opt.label}
                        className="group flex gap-2 items-center"
                        onSelect={() => {
                          onChange([...selected, opt.value]);
                          setTimeout(() => setCommandInput(''), 200);
                          if (!multi) setOpen(false);
                        }}
                      >
                        <Checkbox checked={false} className="opacity-0 group-data-[selected=true]:opacity-100" />
                        {opt.icon}
                        <span className="text-accent-foreground">{opt.label}</span>
                        {opt.meta && (
                          <span className="text-muted-foreground text-xs ml-auto">{opt.meta}</span>
                        )}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </>
              )}
            </CommandList>
          </Command>
        </AnimateChangeInHeight>
      </PopoverContent>
    </Popover>
  );
}

/* ─── Value combobox (date — single select) ─── */

function ValueDateCombobox({
  config,
  values,
  onChange,
}: {
  config: FilterConfig;
  values: string[];
  onChange: (next: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const [commandInput, setCommandInput] = useState('');
  const selectedOpt = config.options.find(o => o.value === values[0]);

  return (
    <Popover
      open={open}
      onOpenChange={v => {
        setOpen(v);
        if (!v) setTimeout(() => setCommandInput(''), 200);
      }}
    >
      <PopoverTrigger className="rounded-none px-1.5 py-1 bg-muted hover:bg-muted/50 transition text-muted-foreground hover:text-primary shrink-0">
        {selectedOpt?.label ?? values[0]}
      </PopoverTrigger>
      <PopoverContent className="w-fit p-0">
        <AnimateChangeInHeight>
          <Command>
            <CommandInput
              placeholder={config.label}
              className="h-9"
              value={commandInput}
              onInputCapture={e => setCommandInput(e.currentTarget.value)}
            />
            <CommandList>
              <CommandEmpty>No results found.</CommandEmpty>
              <CommandGroup>
                {config.options.map(opt => (
                  <CommandItem
                    key={opt.value}
                    className="group flex gap-2 items-center"
                    onSelect={() => {
                      onChange([opt.value]);
                      setTimeout(() => setCommandInput(''), 200);
                      setOpen(false);
                    }}
                  >
                    <span className="text-accent-foreground">{opt.label}</span>
                    <Check className={cn('ml-auto', values.includes(opt.value) ? 'opacity-100' : 'opacity-0')} />
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </AnimateChangeInHeight>
      </PopoverContent>
    </Popover>
  );
}

/* ─── Chip bar ─── */

export function Filters({
  configs,
  filters,
  setFilters,
}: {
  configs: FilterConfig[];
  filters: Filter[];
  setFilters: Dispatch<SetStateAction<Filter[]>>;
}) {
  const cfgByType = React.useMemo(() => {
    const m: Record<string, FilterConfig> = {};
    for (const c of configs) m[c.type] = c;
    return m;
  }, [configs]);

  return (
    <div className="flex gap-2 flex-wrap">
      {filters
        .filter(f => f.value.length > 0)
        .map(filter => {
          const cfg = cfgByType[filter.type];
          if (!cfg) return null;
          return (
            <div key={filter.id} className="flex gap-[1px] items-center text-xs">
              <div className="flex gap-1.5 shrink-0 rounded-l bg-muted px-1.5 py-1 items-center">
                {cfg.icon}
                {cfg.label}
              </div>
              <OperatorDropdown
                config={cfg}
                filter={filter}
                onChange={op => setFilters(prev => prev.map(f => (f.id === filter.id ? { ...f, operator: op } : f)))}
              />
              {cfg.kind === 'date' ? (
                <ValueDateCombobox
                  config={cfg}
                  values={filter.value}
                  onChange={next =>
                    setFilters(prev => prev.map(f => (f.id === filter.id ? { ...f, value: next } : f)))
                  }
                />
              ) : (
                <ValueCombobox
                  config={cfg}
                  values={filter.value}
                  onChange={next =>
                    setFilters(prev => prev.map(f => (f.id === filter.id ? { ...f, value: next } : f)))
                  }
                />
              )}
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setFilters(prev => prev.filter(f => f.id !== filter.id))}
                className="bg-muted rounded-l-none rounded-r-sm h-6 w-6 text-muted-foreground hover:text-primary hover:bg-muted/50 transition shrink-0"
                aria-label="Remove filter"
              >
                <X className="size-3" />
              </Button>
            </div>
          );
        })}
    </div>
  );
}

function genFilterId() {
  return `flt-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

/* ─── Add-filter trigger ─── */

export function FilterAddButton({
  configs,
  filters,
  setFilters,
  label = 'Filter',
}: {
  configs: FilterConfig[];
  filters: Filter[];
  setFilters: Dispatch<SetStateAction<Filter[]>>;
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const [commandInput, setCommandInput] = useState('');
  const commandInputRef = useRef<HTMLInputElement>(null);
  const activeCfg = selectedType ? configs.find(c => c.type === selectedType) : null;

  const groups = React.useMemo(() => {
    const map = new Map<string, FilterConfig[]>();
    for (const c of configs) {
      const key = c.group ?? '';
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(c);
    }
    return Array.from(map.values());
  }, [configs]);

  return (
    <Popover
      open={open}
      onOpenChange={v => {
        setOpen(v);
        if (!v) setTimeout(() => { setSelectedType(null); setCommandInput(''); }, 200);
      }}
    >
      <PopoverTrigger
        render={
          <Button
            variant="ghost"
            role="combobox"
            aria-expanded={open}
            size="sm"
            className={cn(
              'transition group h-6 text-xs items-center rounded-sm flex gap-1.5',
              filters.length > 0 && 'w-6 px-0'
            )}
          >
            <ListFilter className="size-3 shrink-0 transition-all text-muted-foreground group-hover:text-primary" />
            {!filters.length && label}
          </Button>
        }
      />
      <PopoverContent className="w-[220px] p-0">
        <AnimateChangeInHeight>
          <Command>
            <CommandInput
              placeholder={selectedType ? activeCfg?.label : `${label}...`}
              className="h-9"
              value={commandInput}
              onInputCapture={e => setCommandInput(e.currentTarget.value)}
              ref={commandInputRef}
            />
            <CommandList>
              <CommandEmpty>No results found.</CommandEmpty>
              {activeCfg ? (
                <CommandGroup>
                  {activeCfg.options.map(opt => (
                    <CommandItem
                      key={opt.value}
                      value={opt.label}
                      className="group text-muted-foreground flex gap-2 items-center"
                      onSelect={() => {
                        const defaultOp: FilterOperator =
                          activeCfg.kind === 'date' ? 'before' : activeCfg.kind === 'multi-enum' ? 'include' : 'is';
                        setFilters(prev => [
                          ...prev,
                          { id: genFilterId(), type: activeCfg.type, operator: defaultOp, value: [opt.value] },
                        ]);
                        setTimeout(() => { setSelectedType(null); setCommandInput(''); }, 200);
                        setOpen(false);
                      }}
                    >
                      {opt.icon}
                      <span className="text-accent-foreground">{opt.label}</span>
                      {opt.meta && <span className="text-muted-foreground text-xs ml-auto">{opt.meta}</span>}
                    </CommandItem>
                  ))}
                </CommandGroup>
              ) : (
                groups.map((grp, idx) => (
                  <React.Fragment key={idx}>
                    <CommandGroup>
                      {grp.map(cfg => (
                        <CommandItem
                          key={cfg.type}
                          value={cfg.label}
                          className="group text-muted-foreground flex gap-2 items-center"
                          onSelect={() => {
                            setSelectedType(cfg.type);
                            setCommandInput('');
                            commandInputRef.current?.focus();
                          }}
                        >
                          {cfg.icon}
                          <span className="text-accent-foreground">{cfg.label}</span>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                    {idx < groups.length - 1 && <CommandSeparator />}
                  </React.Fragment>
                ))
              )}
            </CommandList>
          </Command>
        </AnimateChangeInHeight>
      </PopoverContent>
    </Popover>
  );
}

/* ─── Operator-based filter matcher (для удобства применения) ─── */

export function matchFilter<T>(
  filter: Filter,
  getter: (row: T) => string | string[] | Date | null | undefined,
): (row: T) => boolean {
  return row => {
    const v = getter(row);
    const values = filter.value;
    if (values.length === 0) return true;

    if (filter.operator === 'before' || filter.operator === 'after') {
      const d = v instanceof Date ? v : v ? new Date(v as string) : null;
      if (!d) return false;
      return true;
    }

    const rowVals = Array.isArray(v) ? v : v ? [String(v)] : [];

    switch (filter.operator) {
      case 'is':
        return rowVals.some(rv => rv === values[0]);
      case 'is not':
        return !rowVals.some(rv => values.includes(rv));
      case 'is any of':
      case 'include':
      case 'include any of':
        return rowVals.some(rv => values.includes(rv));
      case 'include all of':
        return values.every(fv => rowVals.includes(fv));
      case 'do not include':
      case 'exclude if any of':
        return !rowVals.some(rv => values.includes(rv));
      case 'exclude all of':
        return !values.every(fv => rowVals.includes(fv));
      default:
        return true;
    }
  };
}
