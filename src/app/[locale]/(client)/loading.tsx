/** --- YAML
 * name: ClientLoading
 * description: Skeleton loading state for client-facing pages
 * --- */

import { Skeleton } from '@/components/ui/skeleton';

export default function ClientLoading() {
  return (
    <div className="space-y-4 p-4">
      <Skeleton className="h-8 w-40" />
      <Skeleton className="h-20 w-full" />
      <Skeleton className="h-20 w-full" />
      <Skeleton className="h-20 w-full" />
    </div>
  );
}
