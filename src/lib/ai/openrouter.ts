/** --- YAML
 * name: OpenRouter AI
 * description: OpenRouter API integration for AI completions using free models
 * --- */

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
  return data.choices?.[0]?.message?.content || '';
}
