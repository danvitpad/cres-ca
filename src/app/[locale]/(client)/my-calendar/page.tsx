/** --- YAML
 * name: ClientCalendarRedirect
 * description: Legacy /my-calendar → /appointments (Phase 4 unified).
 * updated: 2026-04-19
 * --- */

import { redirect } from 'next/navigation';

export default function MyCalendarPage() {
  redirect('/appointments');
}
