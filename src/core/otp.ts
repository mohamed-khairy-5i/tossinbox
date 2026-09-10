/**
 * Extract OTP / verification codes from message text or HTML.
 *
 * Strategy (in order):
 *  1. On a line containing a code keyword, prefer a standalone token that
 *     looks like a code (4-8 digits, or 5-8 uppercase alphanumeric chars
 *     containing both letters and digits).
 *  2. Fall back to the first standalone 4-8 digit number in the text.
 */

const CODE_KEYWORDS =
  /\b(?:code|otp|passcode|pin|password.?code|verification|verify|confirm|activation|active.?code|one.?time)\b|رمز|كود|تفعيل|تحقق|الرمز/i;

export function htmlToText(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|tr|h[1-6]|li)>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/[ \t]+/g, " ")
    .trim();
}

export function extractCode(input: string | undefined): string | undefined {
  if (!input) return undefined;

  const text = /<[a-z!][\s\S]*>/i.test(input) ? htmlToText(input) : input;
  if (!text) return undefined;

  const lines = text.split(/\r?\n/);

  // 1) Keyword line -> prefer a code-shaped token on that line
  for (const line of lines) {
    if (!CODE_KEYWORDS.test(line)) continue;

    const tokens = line.match(/(?<![\w-])[A-Z0-9]{4,10}(?![\w-])/g);
    if (!tokens) continue;

    for (const token of tokens) {
      if (/^\d{4,8}$/.test(token)) return token;
      if (/^[A-Z0-9]{5,8}$/.test(token) && /\d/.test(token) && /[A-Z]/.test(token)) {
        return token;
      }
    }
  }

  // 2) Fallback: first standalone 4-8 digit number anywhere
  const numeric = text.match(/(?<![\w-])(\d{4,8})(?![\w-])/);
  if (numeric) return numeric[1];

  return undefined;
}
