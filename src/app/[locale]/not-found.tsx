/** --- YAML
 * name: NotFoundPage
 * description: 404 page — shown when a locale route is not found
 * --- */

import Link from 'next/link';
import { FileQuestion } from 'lucide-react';
import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export default function NotFound() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center text-center px-4">
      <FileQuestion className="size-12 text-muted-foreground/40 mb-4" />
      <h2 className="text-xl font-semibold mb-2">404</h2>
      <p className="text-muted-foreground text-sm mb-6">
        Page not found
      </p>
      <Link href="/" className={cn(buttonVariants({ variant: 'outline' }))}>
        Home
      </Link>
    </div>
  );
}
