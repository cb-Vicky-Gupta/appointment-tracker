// Shared day/week boundary math — originally lived inline in
// app/api/dashboard/stats/route.ts; extracted once the admin stats route
// (Plan Phase B) needed the exact same "today"/"this week" windows.

export function getTodayRange(now = new Date()): { start: Date; end: Date } {
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { start, end };
}

/** Monday-based week, computed from local server time. */
export function getThisWeekRange(now = new Date()): { start: Date; end: Date } {
  const { start: startOfToday } = getTodayRange(now);
  // getDay(): 0=Sun..6=Sat -> days since Monday.
  const daysSinceMonday = (startOfToday.getDay() + 6) % 7;
  const start = new Date(startOfToday);
  start.setDate(start.getDate() - daysSinceMonday);
  const end = new Date(start);
  end.setDate(end.getDate() + 7);
  return { start, end };
}
