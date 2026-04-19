/** --- YAML
 * name: Superadmin root redirect
 * description: /superadmin → /superadmin/dashboard
 * created: 2026-04-19
 * --- */

import { redirect } from 'next/navigation';

export default function SuperadminIndex() {
  redirect('/superadmin/dashboard');
}
