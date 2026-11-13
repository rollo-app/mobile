const formatters = new Map<string, Intl.DateTimeFormat>();

/** A cached `Intl.DateTimeFormat`: building one is expensive, so hot paths must reuse them. */
export function dateFormatter(locale: string, options: Intl.DateTimeFormatOptions = {}): Intl.DateTimeFormat {
  const key = `${locale}|${JSON.stringify(options)}`;
  let formatter = formatters.get(key);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat(locale, options);
    formatters.set(key, formatter);
  }
  return formatter;
}
