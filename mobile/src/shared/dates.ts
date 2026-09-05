export interface CalendarDay {
  key: string;
  date: Date;
  dayOfMonth: number;
  belongsToMonth: boolean;
  isToday: boolean;
}

const pad = (value: number) => String(value).padStart(2, '0');

export const localDateKey = (date: Date): string =>
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

export const monthTitle = (date: Date): string =>
  `${date.getFullYear()}年 ${date.getMonth() + 1}月`;

export const monthRange = (
  date: Date,
): { startISO: string; endISO: string } => {
  const start = new Date(date.getFullYear(), date.getMonth(), 1);
  const end = new Date(date.getFullYear(), date.getMonth() + 1, 1);
  return { startISO: start.toISOString(), endISO: end.toISOString() };
};

export const moveMonth = (date: Date, amount: number): Date =>
  new Date(date.getFullYear(), date.getMonth() + amount, 1);

export const calendarDays = (
  month: Date,
  today = new Date(),
): CalendarDay[] => {
  const first = new Date(month.getFullYear(), month.getMonth(), 1);
  const gridStart = new Date(first);
  const mondayOffset = (first.getDay() + 6) % 7;
  gridStart.setDate(first.getDate() - mondayOffset);

  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(gridStart);
    date.setDate(gridStart.getDate() + index);
    return {
      key: localDateKey(date),
      date,
      dayOfMonth: date.getDate(),
      belongsToMonth: date.getMonth() === month.getMonth(),
      isToday: localDateKey(date) === localDateKey(today),
    };
  });
};

export const displayDate = (iso: string): string => {
  const date = new Date(iso);
  return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日`;
};
