/** --- YAML
 * name: Partner Reorder API
 * description: Save custom display_order for active partnerships of the calling
 *              master. Tier-gated — только подписки уровня business+ могут
 *              менять порядок. Принимает массив partnership ids в нужном
 *              порядке. Каждой строке проставляется display_order = index+1.
 * created: 2026-05-06
 * --- */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { hasFeature, type SubscriptionTier } from '@/types';

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { ordered_ids } = await request.json().catch(() => ({})) as { ordered_ids?: string[] };
  if (!Array.isArray(ordered_ids) || ordered_ids.length === 0) {
    return NextResponse.json({ error: 'ordered_ids[] required' }, { status: 400 });
  }

  // Tier check — только BUSINESS может менять порядок партнёров.
  const { data: profile } = await supabase
    .from('profiles')
    .select('tier')
    .eq('id', user.id)
    .maybeSingle();
  const tier = (profile?.tier ?? 'starter') as SubscriptionTier;
  if (!hasFeature(tier, 'partners_custom_order')) {
    return NextResponse.json({
      error: 'tier_required',
      message: 'Drag&drop порядка партнёров доступен в подписке Business.',
      required_tier: 'business',
    }, { status: 403 });
  }

  const { data: me } = await supabase
    .from('masters').select('id').eq('profile_id', user.id).maybeSingle();
  if (!me) return NextResponse.json({ error: 'Profile not set up' }, { status: 403 });

  // Apply order — обновляем только те partnership'ы где calling-master реально
  // одна из сторон. RLS должна пропускать только свои ряды, но дублируем
  // явный фильтр в WHERE для безопасности.
  for (let i = 0; i < ordered_ids.length; i++) {
    await supabase
      .from('master_partnerships')
      .update({ display_order: i + 1 })
      .eq('id', ordered_ids[i])
      .or(`master_id.eq.${me.id},partner_id.eq.${me.id}`);
  }

  return NextResponse.json({ ok: true, count: ordered_ids.length });
}
