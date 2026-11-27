type Stat = { runs: number; balls_faced: number; unrecorded?: string[] };

export function isRecorded(row: { unrecorded?: string[] }, field: string) {
  return !row.unrecorded?.includes(field);
}

export function statValue<T extends { unrecorded?: string[] }>(row: T, field: keyof T) {
  return isRecorded(row, String(field)) ? row[field] as number : '—';
}

export function rateFigures(rows: Stat[]) {
  const complete = rows.filter(row => isRecorded(row, 'runs') && isRecorded(row, 'balls_faced'));
  return { runs: complete.reduce((sum, row) => sum + row.runs, 0),
    balls: complete.reduce((sum, row) => sum + row.balls_faced, 0) };
}

export function rowStrikeRate(row: Stat) {
  return isRecorded(row, 'runs') && isRecorded(row, 'balls_faced') && row.balls_faced > 0
    ? (100 * row.runs / row.balls_faced).toFixed(1) : '—';
}
