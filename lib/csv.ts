/**
 * Escape a value for CSV output per RFC 4180, additionally quoting any
 * string that starts with =, +, -, @, or tab to prevent CSV formula
 * injection when the file is opened in Excel/Sheets.
 */
export function csvEscape(value: unknown): string {
  if (value === null || value === undefined) return '';
  const str = String(value);
  if (/[",\n\r]/.test(str) || /^[=+\-@\t]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}
