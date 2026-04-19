/** --- YAML
 * name: ClientHistoryRedirect
 * description: Legacy /history → /appointments?tab=past (Phase 4 unified). /history/[id] остаётся как detail page.
 * updated: 2026-04-19
 * --- */

import { redirect } from 'next/navigation';

export default function HistoryPage() {
  redirect('/appointments?tab=past');
}
