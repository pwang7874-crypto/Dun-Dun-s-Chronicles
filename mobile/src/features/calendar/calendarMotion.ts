export type CalendarMonthDirection = -1 | 0 | 1;

/** Keeps vertical feed scrolling separate from an intentional month swipe. */
export const isHorizontalCalendarGesture = (dx: number, dy: number) =>
  Math.abs(dx) > 14 && Math.abs(dx) > Math.abs(dy) * 1.25;

/** Negative means the finger travelled left, so the calendar advances. */
export const calendarMonthDirectionForGesture = (
  dx: number,
  velocityX: number,
): CalendarMonthDirection => {
  if (dx <= -38 || (dx < 0 && velocityX <= -0.55)) {
    return 1;
  }
  if (dx >= 38 || (dx > 0 && velocityX >= 0.55)) {
    return -1;
  }
  return 0;
};
