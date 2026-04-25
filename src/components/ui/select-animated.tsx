/** --- YAML
 * name: Animated Select
 * description: >
 *   Custom select with spring animations, proximity hover, keyboard nav.
 *   Unified style for all dropdowns across CRES-CA (except profile).
 *   API:
 *     <Select value onValueChange>
 *       <SelectTrigger placeholder="…" />
 *       <SelectContent>
 *         <SelectItem index={0} value="a">Label</SelectItem>
 *         …
 *       </SelectContent>
 *     </Select>
 * created: 2026-04-20
 * --- */

'use client';

import {
  forwardRef,
  useRef,
  useEffect,
  useState,
  useCallback,
  createContext,
  useContext,
  type ReactNode,
  type HTMLAttributes,
  type RefObject,
  type MutableRefObject,
} from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { cva, type VariantProps } from 'class-variance-authority';
import type { LucideIcon } from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: (string | undefined | null | false | Record<string, boolean>)[]) {
  return twMerge(clsx(inputs));
}

const springs = {
  fast: { type: 'spring' as const, duration: 0.08, bounce: 0 },
  moderate: { type: 'spring' as const, duration: 0.16, bounce: 0.15 },
};

const shape = {
  bg: 'rounded-[14px]',
  item: 'rounded-[10px]',
  input: 'rounded-[10px]',
  focusRing: 'rounded-[10px]',
  container: 'rounded-[14px]',
};

interface ItemRect { top: number; height: number; left: number; width: number }

function useProximityHover<T extends HTMLElement>(containerRef: RefObject<T | null>) {
  const itemsRef = useRef(new Map<number, HTMLElement>());
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [itemRects, setItemRects] = useState<ItemRect[]>([]);
  const itemRectsRef = useRef<ItemRect[]>([]);
  const sessionRef = useRef(0);
  const rafIdRef = useRef<number | null>(null);

  const registerItem = useCallback((index: number, element: HTMLElement | null) => {
    if (element) itemsRef.current.set(index, element);
    else itemsRef.current.delete(index);
  }, []);

  const measureItems = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;
    const containerRect = container.getBoundingClientRect();
    const rects: ItemRect[] = [];
    itemsRef.current.forEach((element, index) => {
      const rect = element.getBoundingClientRect();
      rects[index] = {
        top: rect.top - containerRect.top + container.scrollTop - container.clientTop,
        height: rect.height,
        left: rect.left - containerRect.left + container.scrollLeft - container.clientLeft,
        width: rect.width,
      };
    });
    itemRectsRef.current = rects;
    setItemRects(rects);
  }, [containerRef]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    const mouseY = e.clientY;
    if (rafIdRef.current !== null) cancelAnimationFrame(rafIdRef.current);
    rafIdRef.current = requestAnimationFrame(() => {
      rafIdRef.current = null;
      const container = containerRef.current;
      if (!container) return;
      const containerRect = container.getBoundingClientRect();
      let closestIndex: number | null = null;
      let closestDistance = Infinity;
      let containingIndex: number | null = null;
      const rects = itemRectsRef.current;
      for (let index = 0; index < rects.length; index++) {
        const r = rects[index];
        if (!r) continue;
        const itemStart = containerRect.top + container.clientTop + r.top - container.scrollTop;
        const itemEnd = itemStart + r.height;
        if (mouseY >= itemStart && mouseY <= itemEnd) containingIndex = index;
        const distance = Math.abs(mouseY - (itemStart + r.height / 2));
        if (distance < closestDistance) { closestDistance = distance; closestIndex = index; }
      }
      setActiveIndex(containingIndex ?? closestIndex);
    });
  }, [containerRef]);

  const handleMouseEnter = useCallback(() => { sessionRef.current += 1; }, []);
  const handleMouseLeave = useCallback(() => {
    if (rafIdRef.current !== null) { cancelAnimationFrame(rafIdRef.current); rafIdRef.current = null; }
    setActiveIndex(null);
  }, []);

  useEffect(() => () => { if (rafIdRef.current !== null) cancelAnimationFrame(rafIdRef.current); }, []);

  return {
    activeIndex, setActiveIndex, itemRects, sessionRef,
    handlers: { onMouseMove: handleMouseMove, onMouseEnter: handleMouseEnter, onMouseLeave: handleMouseLeave },
    registerItem, measureItems,
  };
}

interface SelectContextValue {
  value: string;
  onChange: (value: string) => void;
  open: boolean;
  setOpen: (open: boolean) => void;
  disabled: boolean;
  triggerRef: RefObject<HTMLButtonElement | null>;
  labelMap: MutableRefObject<Map<string, string>>;
}

const SelectContext = createContext<SelectContextValue | null>(null);
function useSelectContext() {
  const ctx = useContext(SelectContext);
  if (!ctx) throw new Error('Select compound components must be inside <Select>');
  return ctx;
}

interface SelectContentContextValue {
  registerItem: (index: number, element: HTMLElement | null) => void;
  activeIndex: number | null;
  checkedIndex?: number;
}

const SelectContentContext = createContext<SelectContentContextValue | null>(null);

interface SelectProps {
  children: ReactNode;
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  disabled?: boolean;
  name?: string;
  required?: boolean;
}

function Select({ children, value, defaultValue, onValueChange, disabled = false, name, required }: SelectProps) {
  const [internalValue, setInternalValue] = useState(defaultValue ?? '');
  const [open, setOpen] = useState(false);
  const currentValue = value !== undefined ? value : internalValue;
  const triggerRef = useRef<HTMLButtonElement>(null);
  const labelMap = useRef(new Map<string, string>());
  const [, setReady] = useState(false);
  useEffect(() => setReady(true), []);

  const onChange = useCallback((v: string) => {
    if (value === undefined) setInternalValue(v);
    onValueChange?.(v);
    setOpen(false);
    requestAnimationFrame(() => triggerRef.current?.focus());
  }, [value, onValueChange]);

  return (
    <SelectContext.Provider value={{ value: currentValue, onChange, open, setOpen, disabled, triggerRef, labelMap }}>
      {children}
      {name && <input type="hidden" name={name} value={currentValue} required={required} />}
    </SelectContext.Provider>
  );
}
Select.displayName = 'Select';

const triggerVariants = cva(
  ['group inline-flex items-center justify-between gap-2 outline-none cursor-pointer',
   'text-[13px] h-10 px-3 w-full', 'transition-all duration-80',
   'disabled:opacity-50 disabled:pointer-events-none', 'focus-visible:ring-1 focus-visible:ring-violet-500'],
  {
    variants: {
      variant: {
        bordered: 'border border-white/10 bg-white/[0.03] text-white hover:bg-white/[0.06]',
        borderless: 'border border-transparent bg-transparent text-white hover:bg-white/[0.04]',
      },
    },
    defaultVariants: { variant: 'bordered' },
  }
);

interface SelectTriggerProps
  extends Omit<HTMLAttributes<HTMLButtonElement>, 'children'>,
    VariantProps<typeof triggerVariants> {
  icon?: LucideIcon;
  placeholder?: string;
  error?: string;
}

const SelectTrigger = forwardRef<HTMLButtonElement, SelectTriggerProps>(
  ({ className, variant, icon: Icon, placeholder = 'Выберите…', error, ...props }, ref) => {
    const { value, open, setOpen, disabled, triggerRef, labelMap } = useSelectContext();
    const label = value ? labelMap.current.get(value) ?? value : undefined;

    return (
      <div className="flex flex-col gap-1">
        <button
          ref={(node) => {
            (triggerRef as MutableRefObject<HTMLButtonElement | null>).current = node;
            if (typeof ref === 'function') ref(node);
            else if (ref) (ref as MutableRefObject<HTMLButtonElement | null>).current = node;
          }}
          type="button" role="combobox" aria-expanded={open} aria-haspopup="listbox" disabled={disabled}
          onClick={() => setOpen(!open)}
          onKeyDown={(e) => { if (!open && ['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(e.key)) { e.preventDefault(); setOpen(true); } }}
          aria-invalid={!!error || undefined}
          className={cn(triggerVariants({ variant }), shape.input, error && 'border-rose-500/50', className)}
          {...props}
        >
          <span className="flex items-center gap-2 min-w-0 flex-1">
            {Icon && <Icon size={16} strokeWidth={1.5} className="shrink-0 text-white/50 transition-[color,stroke-width] duration-80 group-hover:text-white group-hover:stroke-[2]" />}
            <span className="min-w-0 flex-1 text-left truncate">
              {label ?? <span className="text-white/40">{placeholder}</span>}
            </span>
          </span>
          <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-white/40 transition-colors duration-80 group-hover:text-white">
            <path d="M6 9l6 6 6-6" />
          </svg>
        </button>
        {error && <span className="text-[12px] text-rose-400 pl-3">{error}</span>}
      </div>
    );
  }
);
SelectTrigger.displayName = 'SelectTrigger';

interface SelectContentProps { className?: string; children: ReactNode }

const SelectContent = forwardRef<HTMLDivElement, SelectContentProps>(
  ({ className, children }, ref) => {
    const { open, setOpen, value, triggerRef } = useSelectContext();
    const containerRef = useRef<HTMLDivElement>(null);
    const [triggerRect, setTriggerRect] = useState<DOMRect | null>(null);

    const { activeIndex, setActiveIndex, itemRects, sessionRef, handlers, registerItem, measureItems } = useProximityHover(containerRef);
    const [focusedIndex, setFocusedIndex] = useState<number | null>(null);
    const [checkedIndex, setCheckedIndex] = useState<number | undefined>(undefined);

    useEffect(() => {
      if (open && triggerRef.current) setTriggerRect(triggerRef.current.getBoundingClientRect());
    }, [open, triggerRef]);

    useEffect(() => {
      if (!open || !triggerRect) return;
      const outer = requestAnimationFrame(() => {
        const inner = requestAnimationFrame(() => {
          measureItems();
          const container = containerRef.current;
          if (container) {
            const items = Array.from(container.querySelectorAll('[data-proximity-index]')) as HTMLElement[];
            const idx = items.findIndex((el) => el.getAttribute('data-value') === value);
            setCheckedIndex(idx !== -1 ? idx : undefined);
            containerRef.current?.focus({ preventScroll: true });
          }
        });
        return () => cancelAnimationFrame(inner);
      });
      return () => cancelAnimationFrame(outer);
    }, [open, triggerRect, measureItems, value]);

    useEffect(() => {
      if (!open) return;
      const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { setOpen(false); triggerRef.current?.focus(); } };
      document.addEventListener('keydown', onKey);
      return () => document.removeEventListener('keydown', onKey);
    }, [open, setOpen, triggerRef]);

    useEffect(() => {
      if (!open) return;
      const onPointer = (e: MouseEvent) => {
        if (!containerRef.current?.contains(e.target as Node) && !triggerRef.current?.contains(e.target as Node)) setOpen(false);
      };
      document.addEventListener('mousedown', onPointer);
      return () => document.removeEventListener('mousedown', onPointer);
    }, [open, setOpen, triggerRef]);

    const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
      const items = Array.from(containerRef.current?.querySelectorAll('[role="option"]:not([data-disabled])') ?? []) as HTMLElement[];
      const currentIdx = items.indexOf(e.target as HTMLElement);
      if (['ArrowDown', 'ArrowUp', 'ArrowRight', 'ArrowLeft'].includes(e.key)) {
        e.preventDefault();
        if (currentIdx === -1) { const checked = checkedIndex != null ? items[checkedIndex] : null; (checked ?? items[0])?.focus(); }
        else { const next = ['ArrowDown', 'ArrowRight'].includes(e.key) ? (currentIdx + 1) % items.length : (currentIdx - 1 + items.length) % items.length; items[next]?.focus(); }
      } else if (e.key === 'Home') { e.preventDefault(); items[0]?.focus(); }
      else if (e.key === 'End') { e.preventDefault(); items[items.length - 1]?.focus(); }
    }, [checkedIndex]);

    if (!open) return <div hidden aria-hidden="true">{children}</div>;
    if (!triggerRect) return null;

    const activeRect = activeIndex !== null ? itemRects[activeIndex] : null;
    const checkedRect = checkedIndex != null ? itemRects[checkedIndex] : null;
    const focusRect = focusedIndex !== null ? itemRects[focusedIndex] : null;
    const isHoveringOther = activeIndex !== null && activeIndex !== checkedIndex;

    return createPortal(
      <SelectContentContext.Provider value={{ registerItem, activeIndex, checkedIndex }}>
        <div style={{ position: 'fixed', top: triggerRect.bottom + 6, left: triggerRect.left, minWidth: triggerRect.width, zIndex: 2000 }}>
          <motion.div
            ref={(node) => {
              (containerRef as MutableRefObject<HTMLDivElement | null>).current = node;
              if (typeof ref === 'function') ref(node);
              else if (ref) (ref as MutableRefObject<HTMLDivElement | null>).current = node;
            }}
            role="listbox" tabIndex={-1}
            onMouseEnter={() => { handlers.onMouseEnter(); setFocusedIndex(null); }}
            onMouseMove={handlers.onMouseMove}
            onMouseLeave={handlers.onMouseLeave}
            onFocus={(e) => {
              const indexAttr = (e.target as HTMLElement).closest('[data-proximity-index]')?.getAttribute('data-proximity-index');
              if (indexAttr != null) { const idx = Number(indexAttr); setActiveIndex(idx); setFocusedIndex((e.target as HTMLElement).matches(':focus-visible') ? idx : null); }
            }}
            onBlur={(e) => { if (containerRef.current?.contains(e.relatedTarget as Node)) return; setFocusedIndex(null); setActiveIndex(null); }}
            onKeyDown={handleKeyDown}
            className={cn(`relative flex flex-col gap-0.5 max-h-[300px] overflow-y-auto ${shape.container} bg-[#1a1b20] shadow-[0_16px_48px_rgba(0,0,0,0.5)] border border-white/10 p-1 select-none outline-none`, className)}
            initial={{ opacity: 0, y: -4, scaleY: 0.96 }}
            animate={{ opacity: 1, y: 0, scaleY: 1 }}
            transition={springs.fast}
            style={{ transformOrigin: 'top center' }}
          >
            <AnimatePresence>
              {checkedRect && (
                <motion.div className={`absolute ${shape.item} bg-violet-500/25 pointer-events-none`} initial={false}
                  animate={{ top: checkedRect.top, left: checkedRect.left, width: checkedRect.width, height: checkedRect.height, opacity: isHoveringOther ? 0.8 : 1 }}
                  exit={{ opacity: 0, transition: { duration: 0.12 } }} transition={{ ...springs.moderate, opacity: { duration: 0.08 } }} />
              )}
            </AnimatePresence>
            <AnimatePresence>
              {activeRect && (
                <motion.div key={sessionRef.current} className={`absolute ${shape.item} bg-white/[0.06] pointer-events-none`}
                  initial={{ opacity: 0, top: checkedRect?.top ?? activeRect.top, left: checkedRect?.left ?? activeRect.left, width: checkedRect?.width ?? activeRect.width, height: checkedRect?.height ?? activeRect.height }}
                  animate={{ opacity: 1, top: activeRect.top, left: activeRect.left, width: activeRect.width, height: activeRect.height }}
                  exit={{ opacity: 0, transition: { duration: 0.06 } }} transition={{ ...springs.fast, opacity: { duration: 0.08 } }} />
              )}
            </AnimatePresence>
            <AnimatePresence>
              {focusRect && (
                <motion.div className={`absolute ${shape.focusRing} pointer-events-none z-20 border border-violet-500`} initial={false}
                  animate={{ left: focusRect.left - 2, top: focusRect.top - 2, width: focusRect.width + 4, height: focusRect.height + 4 }}
                  exit={{ opacity: 0, transition: { duration: 0.06 } }} transition={{ ...springs.fast, opacity: { duration: 0.08 } }} />
              )}
            </AnimatePresence>
            {children}
          </motion.div>
        </div>
      </SelectContentContext.Provider>,
      document.body
    );
  }
);
SelectContent.displayName = 'SelectContent';

interface SelectItemProps extends HTMLAttributes<HTMLDivElement> {
  icon?: LucideIcon;
  index: number;
  value: string;
  disabled?: boolean;
}

const SelectItem = forwardRef<HTMLDivElement, SelectItemProps>(
  ({ className, children, icon: Icon, value, index, disabled = false, ...props }, ref) => {
    const selectCtx = useSelectContext();
    const contentCtx = useContext(SelectContentContext);
    const internalRef = useRef<HTMLDivElement>(null);
    const hasMounted = useRef(false);

    useEffect(() => { hasMounted.current = true; }, []);
    useEffect(() => {
      // Extract a flat text label from any children shape (string / number / array of strings+expressions)
      const flatten = (node: ReactNode): string => {
        if (node === null || node === undefined || typeof node === 'boolean') return '';
        if (typeof node === 'string' || typeof node === 'number') return String(node);
        if (Array.isArray(node)) return node.map(flatten).join('');
        return '';
      };
      const label = flatten(children).trim();
      if (label) selectCtx.labelMap.current.set(value, label);
    }, [value, children, selectCtx.labelMap]);
    useEffect(() => { contentCtx?.registerItem(index, internalRef.current); return () => contentCtx?.registerItem(index, null); }, [index, contentCtx]);

    const isActive = contentCtx?.activeIndex === index;
    const isChecked = selectCtx.value === value;
    const skipAnimation = !hasMounted.current;

    return (
      <div
        ref={(node) => {
          (internalRef as MutableRefObject<HTMLDivElement | null>).current = node;
          if (typeof ref === 'function') ref(node);
          else if (ref) (ref as MutableRefObject<HTMLDivElement | null>).current = node;
        }}
        data-proximity-index={index} data-value={value} data-disabled={disabled || undefined}
        role="option" aria-selected={isChecked} aria-label={typeof children === 'string' ? children : undefined}
        tabIndex={isChecked ? 0 : index === (contentCtx?.checkedIndex ?? 0) ? 0 : -1}
        onClick={() => { if (!disabled) selectCtx.onChange(value); }}
        onKeyDown={(e) => { if ((e.key === 'Enter' || e.key === ' ') && !disabled) { e.preventDefault(); selectCtx.onChange(value); } }}
        className={cn(`relative z-10 flex items-center gap-2 ${shape.item} px-3 py-2 text-[13px] cursor-pointer outline-none select-none`, 'transition-[color] duration-80', isActive || isChecked ? 'text-white' : 'text-white/60', disabled && 'opacity-50 pointer-events-none', className)}
        {...props}
      >
        {Icon && <Icon size={16} strokeWidth={isActive || isChecked ? 2 : 1.5} className="shrink-0 transition-[color,stroke-width] duration-80" />}
        <span className="flex-1 min-w-0 truncate">{children}</span>
        <AnimatePresence>
          {isChecked && (
            <motion.svg key="check" width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-violet-300" initial={{ opacity: 1 }} animate={{ opacity: 1 }} exit={{ opacity: 1 }}>
              <motion.path d="M4 12L9 17L20 6" initial={{ pathLength: skipAnimation ? 1 : 0 }} animate={{ pathLength: 1, transition: { duration: 0.08, ease: 'easeOut' } }} exit={{ pathLength: 0, transition: { duration: 0.04, ease: 'easeIn' } }} />
            </motion.svg>
          )}
        </AnimatePresence>
      </div>
    );
  }
);
SelectItem.displayName = 'SelectItem';

export { Select, SelectTrigger, SelectContent, SelectItem, triggerVariants };
export type { SelectProps, SelectTriggerProps, SelectContentProps, SelectItemProps };
