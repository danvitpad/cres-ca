/** --- YAML
 * name: User Flow Page (legacy redirect)
 * description: Deprecated role picker — unified into /login. Kept as redirect for old inbound links.
 * updated: 2026-04-15
 * --- */

import { redirect } from 'next/navigation';

export default function UserFlowPage() {
  redirect('/login');
}
