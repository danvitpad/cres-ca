/** --- YAML
 * name: EmptyState
 * description: Illustration placeholder with title, description, and optional CTA button for empty pages
 * --- */

import { cn } from '@/lib/utils';

interface EmptyStateProps {
  icon: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}

export function EmptyState({ icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div className={cn('flex flex-col items-center justify-center py-16 text-center animate-fade-in', className)}>
      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-[var(--ds-accent-soft)] text-[var(--ds-accent)]">
        {icon}
      </div>
      <h3 className="text-lg font-semibold">{title}</h3>
      {description && (
        <p className="mt-1 max-w-sm text-sm text-muted-foreground">{description}</p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
