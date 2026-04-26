/** --- YAML
 * name: AI Client Voice Transcribe
 * description: Принимает audio blob (form-data «audio»), отправляет в Gemini для
 *              транскрипции (voice→text). Возвращает {text}. Используется
 *              AIChatSheet voice-button: client speaks → release → транскрипт
 *              появляется в input → user правит/отправляет.
 * created: 2026-04-26
 * --- */

import { NextResponse } from 'next/server';
import { voiceToText, AIUnavailableError } from '@/lib/ai/router';

export async function POST(req: Request) {
  try {
    const form = await req.formData();
    const file = form.get('audio');
    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'no_audio' }, { status: 400 });
    }
    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json({ error: 'too_large' }, { status: 413 });
    }

    const buf = await file.arrayBuffer();
    const base64 = Buffer.from(buf).toString('base64');
    const mimeType = file.type || 'audio/webm';

    const result = await voiceToText({ audioBase64: base64, mimeType });
    return NextResponse.json({ text: result.data, model: result.model });
  } catch (e) {
    if (e instanceof AIUnavailableError) {
      return NextResponse.json(
        { error: 'ai_unavailable', message: 'Голос сейчас не распознаётся, попробуй позже' },
        { status: 503 },
      );
    }
    return NextResponse.json({ error: 'internal' }, { status: 500 });
  }
}
