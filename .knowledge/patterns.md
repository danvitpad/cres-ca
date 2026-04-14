# Common Patterns

## Create a new page
```tsx
/** --- YAML
 * name: PageName
 * description: What this page does
 * --- */

import { useTranslations } from 'next-intl';

export default function PageName() {
  const t = useTranslations('section');
  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">{t('title')}</h2>
      {/* content */}
    </div>
  );
}
```

## Client component with data fetching
```tsx
/** --- YAML
 * name: ComponentName
 * description: What this component does
 * --- */

'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

export function ComponentName() {
  const [data, setData] = useState<Type[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('table_name')
        .select('*')
        .order('created_at', { ascending: false });
      if (data) setData(data);
      setIsLoading(false);
    }
    load();
  }, []);

  if (isLoading) return <Skeleton className="h-32" />;
  return <div>{/* render data */}</div>;
}
```

## API route (with auth check)
```tsx
/** --- YAML
 * name: API Route Name
 * description: What this endpoint does
 * --- */

import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  // ... logic ...

  return NextResponse.json({ success: true });
}
```

## Feature-gated component
```tsx
import { useSubscription } from '@/hooks/use-subscription';

function GatedFeature() {
  const { canUse } = useSubscription();

  if (!canUse('feature_name')) {
    return (
      <div className="rounded-lg border-2 border-dashed p-8 text-center text-muted-foreground">
        <p>This feature requires Pro plan</p>
        <Link href="/settings" className={cn(buttonVariants({ variant: 'outline' }), 'mt-4')}>
          Upgrade
        </Link>
      </div>
    );
  }

  return <ActualContent />;
}
```
