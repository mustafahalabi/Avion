type LogLevel = "INFO" | "WARN" | "ERROR";

/**
 * Formats a timestamp for worker log lines.
 *
 * @returns ISO-like timestamp without timezone suffix.
 */
function formatTimestamp(): string {
  return new Date().toISOString().replace("T", " ").slice(0, 19);
}

/**
 * Writes a structured log line to stdout or stderr.
 *
 * @param level - Log severity level.
 * @param message - Log message body.
 */
function writeLog(level: LogLevel, message: string): void {
  const line = `[${formatTimestamp()}] [${level}]  ${message}`;
  if (level === "ERROR") {
    process.stderr.write(`${line}\n`);
    return;
  }
  process.stdout.write(`${line}\n`);
}

/** Structured console logger for the local worker process. */
export const workerLogger = {
  /**
   * Logs an informational message.
   *
   * @param message - Message to log.
   */
  info(message: string): void {
    writeLog("INFO", message);
  },

  /**
   * Logs a warning message.
   *
   * @param message - Message to log.
   */
  warn(message: string): void {
    writeLog("WARN", message);
  },

  /**
   * Logs an error message.
   *
   * @param message - Message to log.
   */
  error(message: string): void {
    writeLog("ERROR", message);
  },
};
