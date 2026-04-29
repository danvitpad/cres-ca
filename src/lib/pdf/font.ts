/** --- YAML
 * name: PDF Cyrillic Font Helper
 * description: Регистрирует PTSans (Cyrillic-capable TTF) в любом jsPDF-документе.
 *              Helvetica по умолчанию рендерит кириллицу как «крякозябры», поэтому
 *              везде где может встретиться русский/украинский текст вызываем
 *              registerCyrillicFont(doc) и используем возвращаемое имя шрифта.
 * created: 2026-04-29
 * --- */

import type { jsPDF } from 'jspdf';
import fs from 'node:fs';
import path from 'node:path';

const FONT_NAME = 'PTSans';
let _fontCache: string | null = null;

function loadFontBase64(): string | null {
  if (_fontCache !== null) return _fontCache || null;
  try {
    const p = path.join(process.cwd(), 'public', 'fonts', 'PTSans-Regular.ttf');
    _fontCache = fs.readFileSync(p).toString('base64');
    return _fontCache;
  } catch {
    _fontCache = '';
    return null;
  }
}

export function registerCyrillicFont(doc: jsPDF): string {
  const base64 = loadFontBase64();
  if (!base64) return 'helvetica';
  try {
    doc.addFileToVFS('PTSans-Regular.ttf', base64);
    doc.addFont('PTSans-Regular.ttf', FONT_NAME, 'normal');
    doc.addFont('PTSans-Regular.ttf', FONT_NAME, 'bold');
    return FONT_NAME;
  } catch {
    return 'helvetica';
  }
}
