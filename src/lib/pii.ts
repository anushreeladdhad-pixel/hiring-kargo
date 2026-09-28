/**
 * Deterministic (non-AI) extraction of personal details from raw CV text.
 *
 * This runs BEFORE anything touches Gemini. The extracted name/email/phone
 * go straight to the `candidates` table (private, founder-only). The
 * sanitized text (name/email/phone lines stripped) is what gets sent to
 * every AI step (scoring, briefs, email drafts). No AI call ever sees the
 * raw text.
 *
 * Heuristics are deliberately simple and inspectable rather than "smart" —
 * this is a judgment call worth revisiting if a future CV format slips
 * through. See README "Known limitations".
 */

const EMAIL_RE = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;

// Indian mobile numbers: optional +91 prefix, then 10 digits (first 6-9),
// tolerant of a space/dash before any individual digit so "98204 37810",
// "98204-37810", and "9820437810" all match regardless of grouping.
const PHONE_RE = /(?:\+?91[-\s]?)?[6-9]\d(?:[-\s]?\d){8}/g;

const SECTION_HEADERS = new Set([
  'EXPERIENCE',
  'EDUCATION',
  'SUMMARY',
  'PROFILE',
  'PROFESSIONAL SUMMARY',
  'SKILLS',
  'CERTIFICATIONS',
  'CERTIFICATIONS & SKILLS',
  'CERTIFICATIONS & TOOLS',
  'CERTIFICATIONS & OTHER',
  'CONTACT',
  'OBJECTIVE',
  'PROJECTS',
  'ACHIEVEMENTS',
  'TOOLS',
  'REFERENCES',
]);

function looksLikeName(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed || trimmed.length > 40) return false;
  if (SECTION_HEADERS.has(trimmed.toUpperCase())) return false;
  if (/\d/.test(trimmed)) return false;
  if (EMAIL_RE.test(trimmed)) return false;
  EMAIL_RE.lastIndex = 0;
  if (trimmed.includes('@') || trimmed.includes('|') || trimmed.includes('·')) {
    return false;
  }
  // 2-4 words, each starting with a capital letter.
  const words = trimmed.split(/\s+/);
  if (words.length < 2 || words.length > 4) return false;
  return words.every((w) => /^[A-Z][a-zA-Z.'-]*$/.test(w));
}

export interface ExtractedPii {
  fullName: string;
  email: string;
  phone: string | null;
  sanitizedText: string;
}

export function extractPii(rawText: string, fallbackFilename: string): ExtractedPii {
  const lines = rawText.split(/\r?\n/).map((l) => l.trim());
  const nonEmpty = lines.filter((l) => l.length > 0);

  // Email: first match anywhere in the document.
  const emailMatch = rawText.match(EMAIL_RE);
  const email = emailMatch?.[0] ?? '';

  // Phone: first match anywhere in the document.
  const phoneMatch = rawText.match(PHONE_RE);
  const phone = phoneMatch?.[0]?.trim() ?? null;

  // Name: scan the first 10 and last 10 non-empty lines for a name-shaped
  // line, preferring the top of the document.
  const head = nonEmpty.slice(0, 10);
  const tail = nonEmpty.slice(-10);
  let fullName =
    head.find(looksLikeName) ?? [...tail].reverse().find(looksLikeName) ?? '';

  // Normalize an ALL-CAPS header name (e.g. "RAHUL BOSE") to title case for
  // display, without touching names that are already mixed-case.
  if (fullName && fullName === fullName.toUpperCase()) {
    fullName = fullName
      .split(/\s+/)
      .map((w) => w[0] + w.slice(1).toLowerCase())
      .join(' ');
  }

  if (!fullName) {
    // Last resort: derive something readable from the filename
    // (e.g. cv_01_rohan_desai.docx -> "Rohan Desai").
    fullName = fallbackFilename
      .replace(/\.[^.]+$/, '')
      .replace(/^cv[_\s-]*\d*[_\s-]*/i, '')
      .split(/[_\s-]+/)
      .filter(Boolean)
      .map((w) => w[0].toUpperCase() + w.slice(1).toLowerCase())
      .join(' ');
  }

  // Build the sanitized text: strip the name line(s), all emails, all
  // phone numbers, and any LinkedIn/GitHub personal profile URLs, then
  // collapse resulting blank lines.
  let sanitized = rawText;
  if (fullName) {
    // Case-insensitive: fullName may have been normalized from an
    // ALL-CAPS header (e.g. "RAHUL BOSE" -> "Rahul Bose") above, but the
    // raw text still has the original casing.
    const escaped = fullName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    sanitized = sanitized.replace(new RegExp(escaped, 'gi'), '[NAME]');
  }
  sanitized = sanitized.replace(EMAIL_RE, '[EMAIL]');
  sanitized = sanitized.replace(PHONE_RE, '[PHONE]');
  sanitized = sanitized.replace(
    /(https?:\/\/)?(www\.)?linkedin\.com\/in\/[a-zA-Z0-9-]+/g,
    '[LINKEDIN]'
  );
  sanitized = sanitized.replace(/\n{3,}/g, '\n\n').trim();

  return { fullName, email, phone, sanitizedText: sanitized };
}
