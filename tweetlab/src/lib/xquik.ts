const BASE = 'https://xquik.com/api/v1';

const headers = (apiKey: string) => ({
  'Content-Type': 'application/json',
  'x-api-key': apiKey,
});

export interface RadarItem {
  id?: string;
  title: string;
  volume?: number;
  category?: string;
  trend?: string;
}

export const xquikApi = {
  async getRadar(apiKey: string, limit = 8): Promise<RadarItem[]> {
    if (!apiKey) return [];
    try {
      const res = await fetch(`${BASE}/radar?limit=${limit}`, {
        headers: headers(apiKey),
      });
      if (!res.ok) return [];
      const data = await res.json();
      return data.items || [];
    } catch {
      return [];
    }
  },

  async saveDraft(apiKey: string, text: string, topic: string): Promise<void> {
    if (!apiKey) return;
    try {
      await fetch(`${BASE}/drafts`, {
        method: 'POST',
        headers: headers(apiKey),
        body: JSON.stringify({ text, topic, goal: 'engagement' }),
      });
    } catch {}
  },
};
