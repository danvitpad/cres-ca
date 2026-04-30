/** --- YAML
 * name: Google Sheets append helper
 * description: Шлёт одну строку в Google Sheet через service-account JWT.
 *              Без googleapis npm пакета — нативный crypto + fetch.
 *              Best-effort: если env не задан или fetch упал — возвращает false,
 *              не валит основной flow.
 * created: 2026-04-30
 * --- */

import { createSign } from 'node:crypto';

const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const SHEETS_API = 'https://sheets.googleapis.com/v4/spreadsheets';

interface ServiceAccountCreds {
  email: string;
  privateKey: string;
}

function readCreds(): ServiceAccountCreds | null {
  const email = (process.env.GOOGLE_SHEETS_SERVICE_ACCOUNT_EMAIL ?? '').trim();
  let privateKey = (process.env.GOOGLE_SHEETS_PRIVATE_KEY ?? '').trim();
  if (!email || !privateKey) return null;

  // env переменные часто хранят \n как литерал — нормализуем в реальные переносы
  if (privateKey.includes('\\n')) privateKey = privateKey.replace(/\\n/g, '\n');
  if (!privateKey.startsWith('-----BEGIN')) {
    console.warn('[google-sheets] privateKey is not a PEM block');
    return null;
  }
  return { email, privateKey };
}

function base64url(input: Buffer | string): string {
  return Buffer.from(input)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

/** Подписывает JWT и обменивает на access_token у Google. */
async function getAccessToken(creds: ServiceAccountCreds): Promise<string | null> {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'RS256', typ: 'JWT' };
  const claim = {
    iss: creds.email,
    scope: 'https://www.googleapis.com/auth/spreadsheets',
    aud: TOKEN_URL,
    exp: now + 3600,
    iat: now,
  };

  const headerEnc = base64url(JSON.stringify(header));
  const claimEnc = base64url(JSON.stringify(claim));
  const unsigned = `${headerEnc}.${claimEnc}`;

  const signer = createSign('RSA-SHA256');
  signer.update(unsigned);
  signer.end();
  const signature = base64url(signer.sign(creds.privateKey));
  const jwt = `${unsigned}.${signature}`;

  try {
    const res = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
        assertion: jwt,
      }).toString(),
    });
    if (!res.ok) {
      const txt = await res.text().catch(() => '');
      console.warn('[google-sheets] token exchange failed:', res.status, txt);
      return null;
    }
    const j = (await res.json()) as { access_token?: string };
    return j.access_token ?? null;
  } catch (e) {
    console.warn('[google-sheets] token error:', e);
    return null;
  }
}

/**
 * Дозаписывает одну строку в указанный диапазон Google Sheet.
 * Возвращает true при успехе, false иначе. Best-effort.
 */
export async function appendFeedbackRow(values: (string | number | null)[]): Promise<boolean> {
  const creds = readCreds();
  if (!creds) return false;

  const spreadsheetId = (process.env.GOOGLE_SHEETS_SPREADSHEET_ID ?? '').trim();
  const range = (process.env.GOOGLE_SHEETS_FEEDBACK_RANGE ?? 'Feedback!A:I').trim();
  if (!spreadsheetId) {
    console.warn('[google-sheets] GOOGLE_SHEETS_SPREADSHEET_ID not set');
    return false;
  }

  const token = await getAccessToken(creds);
  if (!token) return false;

  try {
    const url = `${SHEETS_API}/${encodeURIComponent(spreadsheetId)}/values/${encodeURIComponent(range)}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`;
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ values: [values] }),
    });
    if (!res.ok) {
      const txt = await res.text().catch(() => '');
      console.warn('[google-sheets] append failed:', res.status, txt);
      return false;
    }
    return true;
  } catch (e) {
    console.warn('[google-sheets] append error:', e);
    return false;
  }
}
