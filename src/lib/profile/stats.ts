const number = new Intl.NumberFormat("en-US");

// null means the value couldn't be loaded; never show it as 0.
export function formatStat(value: number | null): string {
  return value === null ? "—" : number.format(value);
}
