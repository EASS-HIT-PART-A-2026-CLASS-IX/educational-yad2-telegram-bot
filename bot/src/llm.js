const OLLAMA_HOST = process.env.OLLAMA_HOST || 'http://ollama:11434';
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'smollm2:135m';

const SYSTEM_PROMPT = `You summarize Yad2 apartment listings.
Reply in 2 short lines:
Line 1: rooms, size, location, price (when present).
Line 2: one notable detail.
If the input is mostly Hebrew, reply in Hebrew. Otherwise English.
No preamble, no markdown.`;

export async function summarizeListing(snippet) {
  const res = await fetch(`${OLLAMA_HOST}/api/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: OLLAMA_MODEL,
      system: SYSTEM_PROMPT,
      prompt: snippet,
      stream: false,
      options: { temperature: 0.2, num_predict: 120 },
    }),
  });

  if (!res.ok) {
    throw new Error(`Ollama ${res.status}: ${await res.text()}`);
  }

  const data = await res.json();
  return (data.response || '').trim();
}
