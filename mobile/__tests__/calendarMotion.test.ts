import {
  calendarMonthDirectionForGesture,
  isHorizontalCalendarGesture,
} from '../src/features/calendar/calendarMotion';

describe('calendar month gesture', () => {
  it('keeps vertical feed scrolling out of the month responder', () => {
    expect(isHorizontalCalendarGesture(8, 1)).toBe(false);
    expect(isHorizontalCalendarGesture(24, 30)).toBe(false);
    expect(isHorizontalCalendarGesture(-42, 8)).toBe(true);
  });

  it('maps the swipe direction to the month that should enter', () => {
    expect(calendarMonthDirectionForGesture(-52, -0.2)).toBe(1);
    expect(calendarMonthDirectionForGesture(52, 0.2)).toBe(-1);
    expect(calendarMonthDirectionForGesture(-20, -0.8)).toBe(1);
    expect(calendarMonthDirectionForGesture(20, 0.8)).toBe(-1);
    expect(calendarMonthDirectionForGesture(20, 0.2)).toBe(0);
  });
});
