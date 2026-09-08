/**
 * Structured lines on stdout, which is where Hostinger's log viewer reads.
 * Never log an answer, a code, a token or an email body: CLAUDE.md section 2.
 * Fields are identifiers and counts.
 *
 * `logger.request` is the same thing with the request id attached, for the
 * places where several lines describe one failure and finding them together
 * is the difference between a minute and an afternoon. It is async because
 * reading the id is; `logger.error` stays sync for everything else.
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

/**
 * The same, with this request's id when there is one. Outside a request, and
 * in every script and test, it is simply the line without the field.
 */
async function withRequest(level: "info" | "warn" | "error", message: string, fields?: Fields) {
  const { currentRequestId } = await import("@/lib/request-id");
  write(level, message, { ...fields, requestId: await currentRequestId() });
}

export const requestLogger = {
  info: (message: string, fields?: Fields) => withRequest("info", message, fields),
  warn: (message: string, fields?: Fields) => withRequest("warn", message, fields),
  error: (message: string, fields?: Fields) => withRequest("error", message, fields),
};
