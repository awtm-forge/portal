/**
 * Structured lines on stdout, which is where Hostinger's log viewer reads.
 * Never log an answer, a code, a token or an email body: CLAUDE.md section 2.
 * Fields are identifiers and counts.
 */
type Fields = Record<string, string | number | boolean | null | undefined>;

function write(level: "info" | "warn" | "error", message: string, fields?: Fields) {
  const line = { at: new Date().toISOString(), level, message, ...fields };
  const text = JSON.stringify(line);
  if (level === "error") console.error(text);
  else if (level === "warn") console.warn(text);
  else console.log(text);
}

export const logger = {
  info: (message: string, fields?: Fields) => write("info", message, fields),
  warn: (message: string, fields?: Fields) => write("warn", message, fields),
  error: (message: string, fields?: Fields) => write("error", message, fields),
};
