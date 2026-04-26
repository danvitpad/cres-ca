/** --- YAML
 * name: Featured Masters
 * description: GET /api/marketplace/featured?city=Київ&limit=12 — возвращает топ
 *              public-мастеров для discovery-секции пустого фида у клиента.
 *              Сортировка: рейтинг → количество отзывов → completed_appointments.
 * created: 2026-04-26
 * --- */

import { NextResponse } from 'next/server';
import { searchMasters } from '@/lib/marketplace/search';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const city = searchParams.get('city')?.trim() || undefined;
  const limit = Math.max(1, Math.min(Number(searchParams.get('limit') ?? 12), 24));

  // Сначала пробуем по городу; если пусто — fallback на всех
  let cards = await searchMasters({ city, limit });
  if (cards.length === 0 && city) {
    cards = await searchMasters({ limit });
  }

  // Сортируем: rating desc, reviews desc
  cards.sort((a, b) => {
    const r = (b.rating ?? 0) - (a.rating ?? 0);
    if (r !== 0) return r;
    return (b.reviewsCount ?? 0) - (a.reviewsCount ?? 0);
  });

  return NextResponse.json({ items: cards.slice(0, limit) });
}
