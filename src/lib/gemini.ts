import { GoogleGenerativeAI } from '@google/generative-ai';

let _client: GoogleGenerativeAI | null = null;

function client() {
  if (_client) return _client;
  const key = process.env.GEMINI_API_KEY;
  if (!key) {
    throw new Error(
      'Missing GEMINI_API_KEY. Copy .env.example to .env.local and add your Gemini key.'
    );
  }
  _client = new GoogleGenerativeAI(key);
  return _client;
}

function model() {
  return client().getGenerativeModel({
    model: process.env.GEMINI_MODEL || 'gemini-3.8-flash',
  });
}

// Gemini's hosted models occasionally return 503 ("high demand") or 429
// (rate limit) even on valid keys/models. These are worth a few retries
// with backoff before surfacing an error — a single blip shouldn't fail
// an entire candidate's scoring pass.
const RETRYABLE_STATUS = [429, 503];
const MAX_ATTEMPTS = 4;
const BASE_DELAY_MS = 1500;

function isRetryable(err: unknown): boolean {
  const message = err instanceof Error ? err.message : String(err);
  return RETRYABLE_STATUS.some((code) => message.includes(`[${code}`));
}

async function withRetry<T>(fn: () => Promise<T>): Promise<T> {
  let lastErr: unknown;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (attempt === MAX_ATTEMPTS || !isRetryable(err)) throw err;
      const delay = BASE_DELAY_MS * 2 ** (attempt - 1);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
  throw lastErr;
}

/**
 * Calls Gemini and parses the response as JSON. Gemini is asked to return
 * ONLY a JSON object/array — this strips markdown code fences defensively
 * in case the model wraps the output anyway.
 */
export async function generateJson<T>(prompt: string): Promise<T> {
  const raw = await withRetry(async () => {
    const result = await model().generateContent(prompt);
    return result.response.text().trim();
  });
  const cleaned = raw
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/, '')
    .replace(/```\s*$/, '')
    .trim();
  try {
    return JSON.parse(cleaned) as T;
  } catch (err) {
    throw new Error(
      `Gemini did not return valid JSON. Raw response:\n${raw}`
    );
  }
}

export async function generateText(prompt: string): Promise<string> {
  return withRetry(async () => {
    const result = await model().generateContent(prompt);
    return result.response.text().trim();
  });
}
