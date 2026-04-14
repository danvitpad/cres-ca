# PHASE 12: AI FEATURES (Business tier)

> Voice notes, smart scheduling, auto-recommendations

- [x] **12.1 — OpenRouter integration**
  - **Create:** `src/lib/ai/openrouter.ts`
  - **What:** Function to call OpenRouter API:
    ```tsx
    export async function aiComplete(systemPrompt: string, userMessage: string): Promise<string> {
      const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'meta-llama/llama-3.1-8b-instruct:free',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userMessage },
          ],
        }),
      });
      const data = await res.json();
      return data.choices[0].message.content;
    }
    ```

- [x] **12.2 — Voice notes transcription**
  - **Create:** `src/app/api/ai/transcribe/route.ts`
  - **What:** Accept audio blob from client. Use OpenRouter/free Whisper API to transcribe. Parse transcription into structured data (client name, service, notes, inventory items).
  - **System prompt:**
    ```
    You are a CRM assistant. Parse the following voice note from a service professional.
    Extract: client_name, service_performed, notes, inventory_items_used (name + quantity).
    Return JSON only.
    ```

- [x] **12.3 — Smart scheduling suggestions**
  - **Create:** `src/app/api/ai/suggest-booking/route.ts`
  - **What:** For each client, calculate their usual visit interval. If overdue, generate a personalized reminder message.
  - **Logic:** Query appointment history, calculate avg days between visits, compare with days since last visit.
  - **Used by:** retention cron (9.6) to generate personalized messages

- [x] **12.4 — Post-visit auto-recommendation**
  - **Create:** `src/app/api/cron/recommendations/route.ts`
  - **What:** 2 hours after visit, send personalized product/service recommendation based on what was done.
  - **Uses AI to generate message** based on service performed and client history.

- [x] **12.5 — Verify Phase 12**
  - AI API works. Voice transcription parses. Recommendations generate.
  - `npm run build` passes
