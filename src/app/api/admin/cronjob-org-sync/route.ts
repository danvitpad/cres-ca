/** --- YAML
 * name: cron-job.org Sync API
 * description: Одноразовый admin endpoint. После ротации CRON_SECRET в Vercel
 *              нужно обновить Bearer-токен в Authorization header у всех 4
 *              задач на cron-job.org (reminders, notifications, voice-reminders,
 *              master-tasks). Иначе cron-job.org начинает получать 401 и через
 *              N неудач автоматически отключает задачу. Использует
 *              CRONJOB_ORG_API_KEY (есть в Vercel env). Можно дёргать
 *              повторно — операция идемпотентная.
 * created: 2026-05-06
 * --- */

import { NextResponse } from 'next/server';

const CRONJOB_ORG_API = 'https://api.cron-job.org';

interface CronJob {
  jobId: number;
  enabled: boolean;
  url: string;
  title: string;
  extendedData: {
    headers: Record<string, string>;
  };
}

export async function POST(request: Request) {
  // Защищаем endpoint текущим CRON_SECRET — только тот кто знает свежий
  // секрет может его прокидывать в cron-job.org.
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const apiKey = process.env.CRONJOB_ORG_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'CRONJOB_ORG_API_KEY not set in env' }, { status: 500 });
  }

  // 1. List all jobs
  const listRes = await fetch(`${CRONJOB_ORG_API}/jobs`, {
    headers: { 'Authorization': `Bearer ${apiKey}` },
  });
  if (!listRes.ok) {
    const txt = await listRes.text();
    return NextResponse.json({ error: 'list_failed', status: listRes.status, body: txt }, { status: 500 });
  }
  const listData = await listRes.json() as { jobs: CronJob[] };
  const ourJobs = listData.jobs.filter((j) => j.url.includes('cres-ca.com'));

  const newAuthHeader = `Bearer ${process.env.CRON_SECRET}`;
  const results: Array<{ jobId: number; title: string; url: string; updated: boolean; reEnabled: boolean; error?: string }> = [];

  // 2. For each our job — update Authorization header + re-enable if disabled
  for (const job of ourJobs) {
    try {
      // Get full job to inspect existing requestHeaders
      const detailRes = await fetch(`${CRONJOB_ORG_API}/jobs/${job.jobId}`, {
        headers: { 'Authorization': `Bearer ${apiKey}` },
      });
      const detail = await detailRes.json() as { jobDetails: { extendedData: { headers: Record<string, string> } } };
      const existingHeaders = detail.jobDetails?.extendedData?.headers ?? {};
      const updatedHeaders = { ...existingHeaders, Authorization: newAuthHeader };

      // PATCH: update headers + ensure enabled
      const patchRes = await fetch(`${CRONJOB_ORG_API}/jobs/${job.jobId}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          job: {
            enabled: true,
            extendedData: { headers: updatedHeaders },
          },
        }),
      });
      const wasDisabled = !job.enabled;
      if (!patchRes.ok) {
        const txt = await patchRes.text();
        results.push({ jobId: job.jobId, title: job.title, url: job.url, updated: false, reEnabled: false, error: `${patchRes.status}: ${txt}` });
      } else {
        results.push({ jobId: job.jobId, title: job.title, url: job.url, updated: true, reEnabled: wasDisabled });
      }
    } catch (e) {
      results.push({ jobId: job.jobId, title: job.title, url: job.url, updated: false, reEnabled: false, error: e instanceof Error ? e.message : String(e) });
    }
  }

  return NextResponse.json({ ok: true, count: results.length, results });
}
