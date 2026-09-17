/**
 * A number we can build a wa.me link from. That link needs the country code,
 * and there is no safe way to guess a missing one: 6394858141 is a fine Indian
 * mobile and a fine start to several other countries' numbers. So the country
 * code has to be written down, and a leading + is how a person writes it.
 *
 * Length is not the test. A Singapore number is ten digits including its
 * country code, the same length as an Indian one without it.
 */
export function hasCountryCode(phone: string): boolean {
  return /^\+\d/.test(phone.trim().replace(/[\s()-]/g, ""));
}

export const COUNTRY_CODE_MESSAGE = "Start the number with + and the country code, or the WhatsApp link will not work. For example +91 99000 21188.";

/**
 * One way to write a number on a screen (Ayush, 17 Sep). The clients list
 * showed each number as it was typed, so two read as one block of digits
 * beside a third with spaces. An Indian mobile is written +91, then five and
 * five, the way the phone itself and a business card write it; a leading 00
 * is the same thing as a +. Anything else is left as typed with the spacing
 * tidied, because grouping is each plan's own habit and there is no safe
 * general rule. Only the showing changes; the stored value stays as typed,
 * and the forms keep showing that.
 *
 * The field is a WhatsApp number, which is a mobile, so ten digits after the
 * 91 that start 6 to 9 are read as one; a landline with an STD code that
 * happens to start the same way would be grouped wrongly, and is not what
 * anyone types here.
 */
export function formatPhone(phone: string): string {
  const typed = phone.trim().replace(/\s+/g, " ");
  if (!typed) return "";
  let digits = typed.replace(/\D/g, "");
  if (digits.startsWith("00")) digits = digits.slice(2);
  if (/^91[6-9]\d{9}$/.test(digits)) return `+91 ${digits.slice(2, 7)} ${digits.slice(7)}`;
  // No code written: grouped the same way, and nothing invented in front. Only
  // without a +, because +65 9123 4567 is also ten digits starting with a 6.
  if (!typed.startsWith("+") && /^[6-9]\d{9}$/.test(digits)) return `${digits.slice(0, 5)} ${digits.slice(5)}`;
  return typed;
}
