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
