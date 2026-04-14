/** --- YAML
 * name: Master Score Mixer
 * description: Computes a master's ranking score from rating, likes, badges, level, visits, freshness, response — per-vertical weights loaded from `score_weights`.
 * created: 2026-04-14
 * updated: 2026-04-14
 * --- */

export interface ScoreWeights {
  rating_weight: number;
  likes_weight: number;
  badges_weight: number;
  level_weight: number;
  visits_weight: number;
  freshness_weight: number;
  response_weight: number;
}

export interface MasterScoreInput {
  rating: number;
  likes: number;
  badges: string[];
  level: number;
  visits: number;
  freshDays: number;
  responseFast: boolean;
}

export const DEFAULT_WEIGHTS: ScoreWeights = {
  rating_weight: 10,
  likes_weight: 0.3,
  badges_weight: 5,
  level_weight: 2,
  visits_weight: 5,
  freshness_weight: 0.5,
  response_weight: 3,
};

export function computeMasterScore(input: MasterScoreInput, w: ScoreWeights = DEFAULT_WEIGHTS): number {
  const freshBoost = Math.max(0, 30 - Math.min(30, input.freshDays));
  return (
    input.rating * w.rating_weight +
    Math.min(input.likes, 300) * w.likes_weight +
    input.badges.length * w.badges_weight +
    input.level * w.level_weight +
    input.visits * w.visits_weight +
    freshBoost * w.freshness_weight +
    (input.responseFast ? w.response_weight * 10 : 0)
  );
}

export async function loadWeightsByVertical(
  supabase: { from: (t: string) => { select: (c: string) => { then: <T>(cb: (v: { data: T }) => unknown) => Promise<unknown> } } },
): Promise<Map<string, ScoreWeights>> {
  const map = new Map<string, ScoreWeights>();
  try {
    const { data } = await (supabase as unknown as {
      from: (t: string) => { select: (c: string) => Promise<{ data: (ScoreWeights & { vertical: string })[] | null }> };
    })
      .from('score_weights')
      .select('vertical, rating_weight, likes_weight, badges_weight, level_weight, visits_weight, freshness_weight, response_weight');
    for (const row of data ?? []) {
      map.set(row.vertical, row);
    }
  } catch {
    /* use defaults */
  }
  return map;
}

export function pickWeights(map: Map<string, ScoreWeights>, vertical: string | null): ScoreWeights {
  if (vertical && map.has(vertical)) return map.get(vertical)!;
  if (map.has('default')) return map.get('default')!;
  return DEFAULT_WEIGHTS;
}
