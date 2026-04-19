/** --- YAML
 * name: Superadmin feedback
 * description: List of user feedback (text + voice) with status transitions.
 * created: 2026-04-19
 * --- */

import { listFeedback, getFeedbackCounts } from '@/lib/superadmin/feedback-data';
import { FeedbackClient } from '@/components/superadmin/feedback-client';

export const dynamic = 'force-dynamic';

export default async function SuperadminFeedbackPage() {
  const [rows, counts] = await Promise.all([listFeedback(), getFeedbackCounts()]);
  return (
    <div className="p-6">
      <div className="mb-3">
        <h1 className="text-[20px] font-semibold tracking-tight text-white">Feedback</h1>
        <p className="mt-1 text-[13px] text-white/50">Обратная связь от пользователей — текст и голосовые. Смена статусов журналируется.</p>
      </div>
      <FeedbackClient rows={rows} counts={counts} />
    </div>
  );
}
