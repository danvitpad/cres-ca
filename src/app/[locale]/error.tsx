/** --- YAML
 * name: ErrorPage
 * description: Error boundary for locale pages — shows friendly error message with retry
 * --- */

'use client';

import { useTranslations } from 'next-intl';
import { AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const tc = useTranslations('common');

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center text-center px-4">
      <AlertTriangle className="size-12 text-destructive/60 mb-4" />
      <h2 className="text-xl font-semibold mb-2">{tc('error')}</h2>
      <p className="text-muted-foreground text-sm mb-6 max-w-md">
        {error.message || 'Something went wrong. Please try again.'}
      </p>
      <Button onClick={reset} variant="outline">
        {tc('back')}
      </Button>
    </div>
  );
}
