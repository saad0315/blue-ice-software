import { format } from 'date-fns';

/**
 * =============================================================================
 * GLOBAL TIMEZONE FIX - Pakistan Standard Time (PKT = UTC+5)
 * =============================================================================
 *
 * PROBLEM:
 * - Application users are in Pakistan (PKT = UTC+5)
 * - Server may run in UTC (Vercel, AWS, etc.)
 * - Database stores dates in UTC
 * - When a driver in Pakistan creates a record at 1:00 AM PKT on Jan 22,
 *   the UTC time is 8:00 PM Jan 21. If we query for "Jan 22" using UTC midnight
 *   to UTC end-of-day, we miss this record.
 *
 * SOLUTION:
 * - Define business day boundaries in PKT timezone
 * - Convert PKT boundaries to UTC for database queries
 * - Example: "Jan 22" in PKT = Jan 21 19:00 UTC to Jan 22 18:59:59.999 UTC
 *
 * KEY INSIGHT:
 * When user says "today" (e.g., Jan 22 in PKT), we need to query:
 *   - FROM: Jan 22 00:00:00 PKT = Jan 21 19:00:00 UTC
 *   - TO:   Jan 22 23:59:59 PKT = Jan 22 18:59:59 UTC
 * =============================================================================
 */

// Pakistan Standard Time offset: UTC+5 (300 minutes)
const PKT_OFFSET_MINUTES = 5 * 60; // 300 minutes

/**
 * Converts a local PKT date to UTC start of that PKT day.
 *
 * Example: If input represents "Jan 22" in PKT context:
 *   - PKT midnight: Jan 22 00:00:00 PKT
 *   - UTC equivalent: Jan 21 19:00:00 UTC (5 hours behind)
 *
 * @param date - A Date object or string (YYYY-MM-DD or ISO). The date components
 *               are interpreted as the "business date" in PKT timezone.
 * @returns UTC Date representing the start of that PKT day
 */
export function toUtcStartOfDay(date: string | Date): Date {
  let year: number, month: number, day: number;

  if (typeof date === 'string') {
    // Handle YYYY-MM-DD format (treat as PKT date)
    if (/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      const parts = date.split('-');
      year = parseInt(parts[0], 10);
      month = parseInt(parts[1], 10) - 1; // JS months are 0-indexed
      day = parseInt(parts[2], 10);
    } else {
      // ISO string or other format - parse and extract local components
      const d = new Date(date);
      year = d.getFullYear();
      month = d.getMonth();
      day = d.getDate();
    }
  } else {
    // Date object - use local date components (which represent PKT date)
    year = date.getFullYear();
    month = date.getMonth();
    day = date.getDate();
  }

  // Create PKT midnight as UTC, then subtract the offset to get actual UTC time
  // PKT 00:00:00 = UTC 19:00:00 previous day (subtract 5 hours)
  const pktMidnightAsUtc = Date.UTC(year, month, day, 0, 0, 0, 0);
  const actualUtcTime = pktMidnightAsUtc - PKT_OFFSET_MINUTES * 60 * 1000;

  return new Date(actualUtcTime);
}

/**
 * Converts a local PKT date to UTC end of that PKT day.
 *
 * Example: If input represents "Jan 22" in PKT context:
 *   - PKT end of day: Jan 22 23:59:59.999 PKT
 *   - UTC equivalent: Jan 22 18:59:59.999 UTC (5 hours behind)
 *
 * @param date - A Date object or string (YYYY-MM-DD or ISO)
 * @returns UTC Date representing the end of that PKT day
 */
export function toUtcEndOfDay(date: string | Date): Date {
  let year: number, month: number, day: number;

  if (typeof date === 'string') {
    if (/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      const parts = date.split('-');
      year = parseInt(parts[0], 10);
      month = parseInt(parts[1], 10) - 1;
      day = parseInt(parts[2], 10);
    } else {
      const d = new Date(date);
      year = d.getFullYear();
      month = d.getMonth();
      day = d.getDate();
    }
  } else {
    year = date.getFullYear();
    month = date.getMonth();
    day = date.getDate();
  }

  // Create PKT 23:59:59.999 as UTC, then subtract the offset
  // PKT 23:59:59.999 = UTC 18:59:59.999 same day
  const pktEndOfDayAsUtc = Date.UTC(year, month, day, 23, 59, 59, 999);
  const actualUtcTime = pktEndOfDayAsUtc - PKT_OFFSET_MINUTES * 60 * 1000;

  return new Date(actualUtcTime);
}

/**
 * Get "Today" as a UTC Start of Day (PKT-aware).
 *
 * Uses the current local time to determine the PKT date,
 * then returns the UTC equivalent of that PKT day's start.
 */
export function getUtcToday(): Date {
  const now = new Date();
  return toUtcStartOfDay(now);
}

/**
 * Get the current PKT date as a YYYY-MM-DD string.
 * Useful for display and API responses.
 */
export function getPktDateString(date: Date = new Date()): string {
  // Add PKT offset to UTC time to get PKT time
  const pktTime = new Date(date.getTime() + PKT_OFFSET_MINUTES * 60 * 1000);
  return pktTime.toISOString().split('T')[0];
}

/**
 * Format a date for display (e.g., '2026-01-21') in PKT timezone.
 */
export function formatUtcDate(date: Date, formatStr: string = 'yyyy-MM-dd'): string {
  if (formatStr === 'yyyy-MM-dd') {
    return getPktDateString(date);
  }

  // For complex formatting, adjust to PKT first
  const pktTime = new Date(date.getTime() + PKT_OFFSET_MINUTES * 60 * 1000);
  return format(pktTime, formatStr);
}

/**
 * Parse a date string and normalize it to PKT start of day in UTC.
 * This is the main function to use when receiving dates from client.
 */
export function normalizeToUtcStartOfDay(dateInput: string | Date): Date {
  return toUtcStartOfDay(dateInput);
}

/**
 * Create a date range for a PKT day.
 * Returns { start: UTC start, end: UTC end } for database queries.
 */
export function getPktDayRange(date: string | Date): { start: Date; end: Date } {
  return {
    start: toUtcStartOfDay(date),
    end: toUtcEndOfDay(date),
  };
}
