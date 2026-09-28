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
    model: process.env.GEMINI_MODEL || 'gemini-2.0-flash',
  });
}

/**
 * Calls Gemini and parses the response as JSON. Gemini is asked to return
 * ONLY a JSON object/array — this strips markdown code fences defensively
 * in case the model wraps the output anyway.
 */
export async function generateJson<T>(prompt: string): Promise<T> {
  const result = await model().generateContent(prompt);
  const raw = result.response.text().trim();
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
  const result = await model().generateContent(prompt);
  return result.response.text().trim();
}
