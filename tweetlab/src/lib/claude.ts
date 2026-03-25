export interface TweetVariation {
  text: string;
  scores: {
    hook: number;
    information: number;
    reply_potential: number;
    algorithm: number;
    persona: number;
    originality: number;
  };
  total_score: number;
  score_reason: string;
}

export const claudeApi = {
  async generateTweets(
    apiKey: string,
    systemPrompt: string,
    userMessage: string,
    variations = 3
  ): Promise<TweetVariation[]> {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1500,
        system: systemPrompt,
        messages: [
          {
            role: 'user',
            content: `${userMessage}\n\nGenerate ${variations} tweet variations. Return ONLY a JSON array, no markdown.`,
          },
        ],
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err?.error?.message || `API error: ${res.status}`);
    }

    const data = await res.json();
    const text = data.content?.[0]?.text || '[]';
    const clean = text.replace(/```json|```/g, '').trim();
    return JSON.parse(clean);
  },
};
