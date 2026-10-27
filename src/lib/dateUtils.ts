/**
 * Date and Time utilities for Cold Call Copilot
 * 
 * Provides consistent date calculations and formatting across all components,
 * preventing timezone-offset bugs where tasks due today might appear overdue.
 */

/**
 * Returns the current date as a normalized YYYY-MM-DD string in local time.
 */
export function getTodayDateString(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Checks whether a task is overdue based on local date string comparison.
 */
export function isOverdue(dueDate: string, status?: string): boolean {
  if (status === 'Completed' || status === 'Cancelled') return false;
  if (!dueDate) return false;
  return dueDate < getTodayDateString();
}

/**
 * Checks whether a task is due today in local time.
 */
export function isDueToday(dueDate: string): boolean {
  if (!dueDate) return false;
  return dueDate === getTodayDateString();
}

/**
 * Checks whether a task is due soon (within the next 3 days, excluding today).
 */
export function isDueSoon(dueDate: string): boolean {
  if (!dueDate) return false;
  const today = getTodayDateString();
  if (dueDate <= today) return false;

  const now = new Date();
  const limit = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 3);
  const year = limit.getFullYear();
  const month = String(limit.getMonth() + 1).padStart(2, '0');
  const day = String(limit.getDate()).padStart(2, '0');
  const limitStr = `${year}-${month}-${day}`;

  return dueDate <= limitStr;
}

/**
 * Formats seconds into human-readable duration like "4m 12s" or "35s".
 */
export function formatDuration(seconds?: number): string {
  if (!seconds || seconds <= 0) return '< 1 min';
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  if (mins === 0) return `${secs}s`;
  return `${mins}m ${secs.toString().padStart(2, '0')}s`;
}

/**
 * Formats an ISO string or YYYY-MM-DD string cleanly.
 */
export function formatDisplayDate(dateStr?: string, includeTime = false): string {
  if (!dateStr) return '—';
  try {
    const date = new Date(dateStr.includes('T') ? dateStr : `${dateStr}T12:00:00`);
    if (isNaN(date.getTime())) return dateStr;

    const options: Intl.DateTimeFormatOptions = {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      ...(includeTime ? { hour: '2-digit', minute: '2-digit' } : {}),
    };
    return date.toLocaleDateString(undefined, options);
  } catch {
    return dateStr;
  }
}
