/**
 * Extract OTP / verification codes from message text or HTML.
 *
 * Strategy (in order):
 *  1. On a line containing a code keyword, prefer a standalone token that
 *     looks like a code (4-8 digits, or 5-8 uppercase alphanumeric chars
 *     containing both letters and digits).
 *  2. Fall back to the first standalone 4-8 digit number in the text.
 *
 * Keywords cover English plus the languages verification mail actually
 * arrives in: Arabic, French, Spanish, German, Portuguese, Italian, Russian,
 * Turkish, Chinese, Japanese, and Korean. Latin-script words use \b
 * boundaries; scripts where \b is meaningless (Arabic, Cyrillic, CJK) match
 * bare, same as the existing Arabic handling.
 */
const CODE_KEYWORDS = /\b(?:code|otp|passcode|pin|password.?code|verification|verify|confirm|activation|active.?code|one.?time|code.?de.?confirmation)\b/ // en + fr "code de confirmation"
    .source +
    "|" +
    [
        // Arabic
        "رمز", "كود", "تفعيل", "تحقق", "الرمز",
        // French
        "vérification", "vérifier", "confirmer", "confirmation",
        // Spanish / Portuguese / Italian (shared words folded)
        "código", "verificación", "verificar", "confirme", "confirmação", "verificação",
        "codice", "verifica", "conferma",
        // German
        "bestätigung", "verifizierung", "bestätigungscode",
        // Russian (Cyrillic — no \b)
        "код", "подтверждение", "верификация",
        // Turkish
        "doğrulama", "onay.?kodu",
        // Chinese / Japanese / Korean (CJK — no \b)
        "验证码", "校验码", "确认码", "確認コード", "認証コード", "検証コード", "認証番号", "인증코드", "인증 번호",
    ].join("|");
const CODE_KEYWORDS_RE = new RegExp(CODE_KEYWORDS, "i");
export function htmlToText(html) {
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
export function extractCode(input) {
    if (!input)
        return undefined;
    const text = /<[a-z!][\s\S]*>/i.test(input) ? htmlToText(input) : input;
    if (!text)
        return undefined;
    const lines = text.split(/\r?\n/);
    // 1) Keyword line -> prefer a code-shaped token on that line
    for (const line of lines) {
        if (!CODE_KEYWORDS_RE.test(line))
            continue;
        // Case-insensitive on purpose: many services send lowercase codes (f4x9k2).
        const tokens = line.match(/(?<![\w-])[A-Za-z0-9]{4,10}(?![\w-])/g);
        if (!tokens)
            continue;
        for (const token of tokens) {
            if (/^\d{4,8}$/.test(token))
                return token;
            const upper = token.toUpperCase();
            if (/^[A-Z0-9]{5,8}$/.test(upper) && /\d/.test(upper) && /[A-Z]/.test(upper)) {
                return upper;
            }
        }
    }
    // 2) Fallback: first standalone 4-8 digit number anywhere
    const numeric = text.match(/(?<![\w-])(\d{4,8})(?![\w-])/);
    if (numeric)
        return numeric[1];
    return undefined;
}
