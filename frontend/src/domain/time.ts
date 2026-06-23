/** Convert a local date/time in a named timezone to UTC ISO string. */

export function zonedTimeToUtcIso(date: string, time: string, timeZone: string): string {
  const [year, month, day] = date.split('-').map(Number);
  const [hour, minute] = time.split(':').map(Number);

  let utcMs = Date.UTC(year, month - 1, day, hour, minute, 0);

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    }).formatToParts(new Date(utcMs));

    const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '0';
    const actualMs = Date.UTC(
      Number(get('year')),
      Number(get('month')) - 1,
      Number(get('day')),
      Number(get('hour')),
      Number(get('minute')),
      0,
    );
    const desiredMs = Date.UTC(year, month - 1, day, hour, minute, 0);
    utcMs += desiredMs - actualMs;
  }

  return new Date(utcMs).toISOString();
}
