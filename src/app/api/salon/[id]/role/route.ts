/** --- YAML
 * name: Salon Role API
 * description: Returns the current user's role (admin/master/receptionist) in a given salon.
 *              Used by useSalonRole hook client-side.
 * created: 2026-04-19
 * --- */

import { NextResponse } from 'next/server';
import { getCurrentUserRole } from '@/lib/team/roles';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const role = await getCurrentUserRole(id);
  return NextResponse.json({ role });
}
