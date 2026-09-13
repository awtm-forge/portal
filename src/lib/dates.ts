/**
 * Every date the business cares about is computed in Asia/Kolkata: the financial
 * year boundary, invoice dates, the day-30 unlock. Storage stays UTC.
 */

export const IST = "Asia/Kolkata";

type Parts = { year: number; month: number; day: number };

/** The calendar date in Asia/Kolkata for an instant. */
export function istParts(at: Date): Parts {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: IST,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const [year, month, day] = fmt.format(at).split("-").map(Number);
  return { year, month, day };
}

/**
 * The Indian financial year label for an instant, "26-27" for 1 April 2026
 * to 31 March 2027. PORTAL-SPEC 5.7.
 */
export function financialYear(at: Date): string {
  const { year, month } = istParts(at);
  const startYear = month >= 4 ? year : year - 1;
  const endYear = startYear + 1;
  return `${String(startYear % 100).padStart(2, "0")}-${String(endYear % 100).padStart(2, "0")}`;
}

export function dayMonthYear(at: Date | null | undefined): string {
  if (!at) return "";
  return new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "long", year: "numeric", timeZone: IST }).format(at);
}

export function dayMonth(at: Date | null | undefined): string {
  if (!at) return "";
  return new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", timeZone: IST }).format(at);
}

/**
 * "Mon 8 Sep 2026". Every date a client reads carries its weekday, because a
 * date with a weekday is a day you can picture and a bare number is arithmetic
 * (13 Sep). Absolute, never "in three days".
 */
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/**
 * Built from parts rather than handed to a locale: every English locale writes
 * this differently, with commas and a four-letter "Sept", and a date a client
 * reads should look the same on every device.
 */
function istWeekday(at: Date): string {
  return new Intl.DateTimeFormat("en-GB", { weekday: "short", timeZone: IST }).format(at);
}

export function weekdayDate(at: Date | null | undefined): string {
  if (!at) return "";
  const { year, month, day } = istParts(at);
  return `${istWeekday(at)} ${day} ${MONTHS[month - 1]} ${year}`;
}

/** "Tue 16 Sep", for a date close enough that the year is noise. */
export function weekdayDayMonth(at: Date | null | undefined): string {
  if (!at) return "";
  const { month, day } = istParts(at);
  return `${istWeekday(at)} ${day} ${MONTHS[month - 1]}`;
}

/** Whether an instant is on or after today in Asia/Kolkata. */
export function isTodayOrLater(at: Date, now: Date = new Date()): boolean {
  const a = istParts(at);
  const b = istParts(now);
  return a.year * 10000 + a.month * 100 + a.day >= b.year * 10000 + b.month * 100 + b.day;
}

export function dayMonthTime(at: Date | null | undefined): string {
  if (!at) return "";
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hour12: false, timeZone: IST,
  }).format(at);
}

/** For a date input's value, the calendar date in Asia/Kolkata. */
export function isoDate(at: Date | null | undefined): string {
  if (!at) return "";
  const { year, month, day } = istParts(at);
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/** Midday UTC for a yyyy-mm-dd from a date input, so the IST calendar date cannot drift. */
export function fromIsoDate(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const at = new Date(`${value}T12:00:00.000Z`);
  return Number.isNaN(at.getTime()) ? null : at;
}

export function addDays(at: Date, days: number): Date {
  return new Date(at.getTime() + days * 24 * 60 * 60 * 1000);
}
