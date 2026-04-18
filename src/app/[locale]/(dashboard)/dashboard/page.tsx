/** --- YAML
 * name: DashboardRedirect
 * description: Backwards-compat redirect — `/dashboard` переименован в `/today` (Phase 9.1 close-out 2026-04-19). Старый FINCHECK-стиль с KPI_GRADIENTS заменён плоским экраном `/today`.
 * created: 2026-04-19
 * updated: 2026-04-19
 * --- */

import { redirect } from 'next/navigation';

export default async function DashboardRedirect({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  redirect(`/${locale}/today`);
}
