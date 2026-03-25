import { ALGORITHM_RULES } from './skill';
import type { TweetEntry, Settings } from './db';
import type { RadarItem } from './xquik';

interface BuildContextParams {
  topic: string;
  persona: any;
  settings: Settings;
  recentTweets: TweetEntry[];
  radarItems: RadarItem[];
  impressionType: string;
  length: string;
  goal: string;
  variations: number;
}

export function buildSystemPrompt(persona: any, settings: Settings): string {
  const styleRules = (persona?.style_rules || [])
    .map((r: string) => `- ${r}`)
    .join('\n');

  const hookExamples = (persona?.hook_patterns || [])
    .flatMap((hp: any) => hp.examples || [])
    .slice(0, 4)
    .map((e: string) => `  "${e}"`)
    .join('\n');

  const bestTweets = (persona?.best_performing_tweets || [])
    .slice(0, 3)
    .map(
      (t: any) =>
        `  "${t.text}" (${t.engagement_rate}% engagement)`
    )
    .join('\n');

  return `# Tweet Generation Expert

${ALGORITHM_RULES}

## Active Persona: ${persona?.name || 'Default'}
Tone: ${persona?.tone || 'casual, direct'}
Language: ${persona?.language || 'tr'}
Niche: ${settings.niche || 'general'}

### Style Rules
${styleRules}

### Hook Patterns (inspiration, not copy-paste)
${hookExamples}

### Best Performing Examples
${bestTweets}

## Output Format
Return ONLY a JSON array. No markdown fences, no explanation:
[
  {
    "text": "tweet text",
    "scores": { "hook": 0-25, "information": 0-20, "reply_potential": 0-15, "algorithm": 0-15, "persona": 0-15, "originality": 0-10 },
    "total_score": 0-100,
    "score_reason": "one sentence explanation"
  }
]`;
}

export function buildUserMessage(params: BuildContextParams): string {
  const {
    topic,
    recentTweets,
    radarItems,
    impressionType,
    length,
    goal,
    variations,
  } = params;

  const recentPerf =
    recentTweets
      .slice(0, 5)
      .map((t) => {
        const eng = t.engagement;
        const score =
          eng.like + eng.reply * 5 + eng.rt * 2 + eng.quote * 3;
        return `"${t.text.slice(0, 80)}..." → engagement score: ${score}, tweet score: ${t.score}`;
      })
      .join('\n') || 'No history yet';

  const trends =
    radarItems
      .slice(0, 4)
      .map((r) => `- ${r.title}`)
      .join('\n') || 'No trends available';

  const lengthGuide: Record<string, string> = {
    short: '140-200 characters',
    standard: '200-280 characters',
    extended: '280-500 characters',
  };

  return `## Task
Generate ${variations} tweet variation(s) about: "${topic}"

## Configuration
- Impression type: ${impressionType}
- Length: ${length} (${lengthGuide[length] || '200-280 characters'})
- Goal: ${goal}
- Language: Turkish

## Current Trending Topics (use if relevant)
${trends}

## My Recent Tweet Performance (learn from this)
${recentPerf}

## Important
- Write in Turkish
- No hashtags, no emojis
- End with question or open loop
- Sound human, not AI-generated
- First line must hook immediately`;
}

export function buildCopyPrompt(
  systemPrompt: string,
  userMessage: string
): string {
  return `${systemPrompt}\n\n---\n\n${userMessage}`;
}
