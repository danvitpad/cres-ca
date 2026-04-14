/** --- YAML
 * name: QR code generator
 * description: GET /api/qr?handle=<invite_code> — возвращает PNG QR-код со ссылкой на публичную витрину мастера `/m/<handle>`. Используется для печатной визитки / экспорта в Instagram. Кэшируется CDN на 7 дней.
 * created: 2026-04-13
 * updated: 2026-04-13
 * --- */

import { NextResponse, type NextRequest } from 'next/server';
import QRCode from 'qrcode';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const handle = req.nextUrl.searchParams.get('handle')?.trim();
  const sizeRaw = Number(req.nextUrl.searchParams.get('size') ?? '512');
  const size = Number.isFinite(sizeRaw) ? Math.min(1024, Math.max(128, Math.round(sizeRaw))) : 512;

  if (!handle || !/^[a-zA-Z0-9_-]{3,64}$/.test(handle)) {
    return NextResponse.json({ error: 'invalid_handle' }, { status: 400 });
  }

  const base = process.env.NEXT_PUBLIC_APP_URL ?? `${req.nextUrl.protocol}//${req.nextUrl.host}`;
  const target = `${base.replace(/\/$/, '')}/m/${handle}`;

  const buffer = await QRCode.toBuffer(target, {
    type: 'png',
    width: size,
    margin: 2,
    errorCorrectionLevel: 'M',
    color: { dark: '#18181b', light: '#ffffff' },
  });

  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      'Content-Type': 'image/png',
      'Cache-Control': 'public, max-age=604800, s-maxage=604800, immutable',
      'Content-Disposition': `inline; filename="cres-${handle}.png"`,
    },
  });
}
