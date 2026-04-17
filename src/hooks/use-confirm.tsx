/** --- YAML
 * name: useConfirm
 * description: Custom confirm dialog replacement for native window.confirm(). Uses shadcn AlertDialog with themed styling. Returns a promise-based confirm() + a provider.
 * created: 2026-04-17
 * updated: 2026-04-17
 * --- */

'use client';

import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface ConfirmOptions {
  title?: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
}

interface ConfirmState extends ConfirmOptions {
  isOpen: boolean;
  resolver?: (v: boolean) => void;
}

const ConfirmContext = createContext<((opts?: ConfirmOptions) => Promise<boolean>) | null>(null);

/** Wrap the app (or layout) once. */
export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<ConfirmState>({ isOpen: false });

  const confirm = useCallback((opts: ConfirmOptions = {}): Promise<boolean> => {
    return new Promise(resolve => {
      setState({
        isOpen: true,
        title: opts.title || 'Подтвердить?',
        description: opts.description,
        confirmLabel: opts.confirmLabel || 'Подтвердить',
        cancelLabel: opts.cancelLabel || 'Отмена',
        destructive: opts.destructive,
        resolver: resolve,
      });
    });
  }, []);

  const close = (result: boolean) => {
    state.resolver?.(result);
    setState(s => ({ ...s, isOpen: false, resolver: undefined }));
  };

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <AlertDialog open={state.isOpen} onOpenChange={(open) => { if (!open) close(false); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{state.title}</AlertDialogTitle>
            {state.description && <AlertDialogDescription>{state.description}</AlertDialogDescription>}
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => close(false)}>{state.cancelLabel}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => close(true)}
              className={state.destructive ? 'bg-destructive text-white hover:bg-destructive/90' : ''}
            >
              {state.confirmLabel}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </ConfirmContext.Provider>
  );
}

/**
 * Drop-in replacement for window.confirm().
 * Returns Promise<boolean>.
 *
 * @example
 * const confirm = useConfirm();
 * if (await confirm({ title: 'Удалить?', destructive: true })) { ... }
 */
export function useConfirm() {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error('useConfirm must be used inside <ConfirmProvider>');
  return ctx;
}
