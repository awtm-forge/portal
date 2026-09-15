/**
 * Money is an integer in paise, everywhere (ADR 0004, CLAUDE.md section 2 rule 1).
 * Nothing in this file takes or returns a float. Formatting for a human happens
 * here and nowhere else, so the agreement, the invoice and the print route
 * cannot disagree about what a number looks like.
 */

export const PAISE_PER_RUPEE = 100n;

/** Indian digit grouping: 480000 becomes 4,80,000. */
function groupIndian(digits: string): string {
  if (digits.length <= 3) return digits;
  const last3 = digits.slice(-3);
  const rest = digits.slice(0, -3);
  const grouped = rest.replace(/\B(?=(\d{2})+(?!\d))/g, ",");
  return `${grouped},${last3}`;
}

/** "4,80,000" or "4,80,000.50". No symbol, no prefix. */
export function formatAmount(paise: bigint): string {
  const negative = paise < 0n;
  const abs = negative ? -paise : paise;
  const rupees = abs / PAISE_PER_RUPEE;
  const rem = abs % PAISE_PER_RUPEE;
  const body = groupIndian(rupees.toString());
  const withPaise = rem === 0n ? body : `${body}.${rem.toString().padStart(2, "0")}`;
  return negative ? `-${withPaise}` : withPaise;
}

/** "Rs 4,80,000". The site and the portal both say Rs, never a glyph. */
/** The rupee sign, as the brand's own invoice writes it (15 Sep). */
export function formatRupees(paise: bigint): string {
  return `\u20B9${formatAmount(paise)}`;
}

const ONES = [
  "zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten",
  "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen",
];
const TENS = ["", "", "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety"];

function underThousand(n: number): string {
  if (n < 20) return ONES[n];
  if (n < 100) {
    const t = TENS[Math.floor(n / 10)];
    const o = n % 10;
    return o === 0 ? t : `${t} ${ONES[o]}`;
  }
  const h = Math.floor(n / 100);
  const rest = n % 100;
  return rest === 0 ? `${ONES[h]} hundred` : `${ONES[h]} hundred and ${underThousand(rest)}`;
}

/**
 * The amount in words for the invoice, Indian system.
 * Acceptance criterion 12: the words must match the figure.
 */
export function amountInWords(paise: bigint): string {
  if (paise < 0n) return `minus ${amountInWords(-paise)}`;
  const rupees = paise / PAISE_PER_RUPEE;
  const rem = Number(paise % PAISE_PER_RUPEE);

  const parts: string[] = [];
  let left = rupees;
  const units: [bigint, string][] = [
    [10000000n, "crore"],
    [100000n, "lakh"],
    [1000n, "thousand"],
  ];
  for (const [size, name] of units) {
    if (left >= size) {
      const count = left / size;
      left = left % size;
      parts.push(`${amountInWordsPlain(count)} ${name}`);
    }
  }
  if (left > 0n) parts.push(underThousand(Number(left)));

  const rupeeWords = parts.length === 0 ? "zero" : parts.join(" ");
  const head = `${capitalise(rupeeWords)} rupees`;
  if (rem === 0) return `${head} only`;
  return `${head} and ${underThousand(rem)} paise only`;
}

/** Used for the count in front of crore, lakh and thousand. */
function amountInWordsPlain(n: bigint): string {
  if (n >= 10000000n) {
    const c = n / 10000000n;
    const rest = n % 10000000n;
    return rest === 0n ? `${amountInWordsPlain(c)} crore` : `${amountInWordsPlain(c)} crore ${amountInWordsPlain(rest)}`;
  }
  if (n >= 100000n) {
    const l = n / 100000n;
    const rest = n % 100000n;
    return rest === 0n ? `${amountInWordsPlain(l)} lakh` : `${amountInWordsPlain(l)} lakh ${amountInWordsPlain(rest)}`;
  }
  if (n >= 1000n) {
    const t = n / 1000n;
    const rest = n % 1000n;
    return rest === 0n ? `${underThousand(Number(t))} thousand` : `${underThousand(Number(t))} thousand ${underThousand(Number(rest))}`;
  }
  return underThousand(Number(n));
}

function capitalise(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/**
 * QUESTIONS.md Q1: the advance is rounded down and the balance takes the
 * remainder, so the two invoices always sum to the total exactly.
 */
export function splitAdvance(totalPaise: bigint, advancePct: number): { advance: bigint; balance: bigint } {
  if (!Number.isInteger(advancePct) || advancePct < 0 || advancePct > 100) {
    throw new Error(`advance_pct must be a whole number from 0 to 100, got ${advancePct}`);
  }
  if (totalPaise < 0n) throw new Error("total cannot be negative");
  const advance = (totalPaise * BigInt(advancePct)) / 100n;
  return { advance, balance: totalPaise - advance };
}

/** Parse what an admin typed into a rupee field. Accepts "480000", "4,80,000", "4,80,000.50". */
export function parseRupeesToPaise(input: string): bigint | null {
  // The sign, Rs or INR, all accepted: a person types what they see.
  const cleaned = input.trim().replace(/[, ]/g, "").replace(/^(\u20B9|Rs\.?|INR)/i, "");
  if (cleaned === "") return null;
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) return null;
  const [whole, frac = ""] = cleaned.split(".");
  const paise = BigInt(whole) * PAISE_PER_RUPEE + BigInt(frac.padEnd(2, "0"));
  return paise;
}
