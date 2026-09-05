import {
  calendarDays,
  localDateKey,
  monthRange,
  moveMonth,
} from '../src/shared/dates';

describe('calendar dates', () => {
  it('builds a stable six-week grid and marks today', () => {
    const month = new Date(2026, 8, 1, 12);
    const today = new Date(2026, 8, 2, 12);
    const days = calendarDays(month, today);

    expect(days).toHaveLength(42);
    expect(days.filter(day => day.isToday).map(day => day.key)).toEqual([
      '2026-09-02',
    ]);
    expect(days.filter(day => day.belongsToMonth)).toHaveLength(30);
  });

  it('uses local month boundaries and crosses year boundaries', () => {
    const month = new Date(2026, 11, 1, 12);
    const range = monthRange(month);

    expect(localDateKey(new Date(range.startISO))).toBe('2026-12-01');
    expect(localDateKey(new Date(range.endISO))).toBe('2027-01-01');
    expect(localDateKey(moveMonth(month, 1))).toBe('2027-01-01');
  });
});
