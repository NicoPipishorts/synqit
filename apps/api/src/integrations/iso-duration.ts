/** ISO 8601 durations ("PT3M20S") to milliseconds; TIDAL and YouTube both use them. */
export const parseIsoDurationMs = (value: string | undefined | null): number => {
  if (!value) {
    return 0;
  }
  const match = /^P(?:(\d+)D)?T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+(?:\.\d+)?)S)?$/.exec(value.trim());
  if (!match) {
    return 0;
  }
  const [, days, hours, minutes, seconds] = match;
  const total =
    Number(days ?? 0) * 86_400 +
    Number(hours ?? 0) * 3_600 +
    Number(minutes ?? 0) * 60 +
    Number(seconds ?? 0);
  return Math.round(total * 1000);
};
