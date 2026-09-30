// Report Lock Utility - 10-Minute Lockout Rule
// Requirement 1: After generating a report, 10 minutes later that report becomes READ-ONLY. Only Super Admin can edit.
// Requirement 2: To update flight data after 10 mins, ramp officer creates a new report for that flight.
// Requirement 3: When a new report is created for the same flight, server saves and prioritizes the latest/last information.

export const TEN_MINUTES_MS = 10 * 60 * 1000; // 10 minutes in milliseconds
export const SUPER_ADMIN_PIN = '11126377';

export function getReportCreatedAtMs(report: { createdAt?: number; timestamp?: string }): number {
  if (report.createdAt && !isNaN(report.createdAt) && report.createdAt > 0) {
    return report.createdAt;
  }
  if (report.timestamp) {
    const t = new Date(report.timestamp).getTime();
    if (!isNaN(t) && t > 0) {
      return t;
    }
  }
  return 0;
}

export function getReportAgeMs(report: { createdAt?: number; timestamp?: string }): number {
  const createdMs = getReportCreatedAtMs(report);
  if (!createdMs) return 0;
  return Math.max(0, Date.now() - createdMs);
}

export function isReportLocked(
  report: { createdAt?: number; timestamp?: string },
  isSuperAdmin: boolean = false
): boolean {
  if (isSuperAdmin) return false;
  const ageMs = getReportAgeMs(report);
  return ageMs > TEN_MINUTES_MS;
}

export function getRemainingEditTimeMs(report: { createdAt?: number; timestamp?: string }): number {
  const ageMs = getReportAgeMs(report);
  return Math.max(0, TEN_MINUTES_MS - ageMs);
}

export function formatRemainingEditTime(remainingMs: number): string {
  if (remainingMs <= 0) return '0m 00s';
  const totalSeconds = Math.floor(remainingMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}m ${seconds.toString().padStart(2, '0')}s`;
}

export function formatReportAgeMins(ageMs: number): string {
  const minutes = Math.floor(ageMs / (60 * 1000));
  if (minutes < 1) return 'Just now';
  if (minutes === 1) return '1 minute ago';
  if (minutes < 60) return `${minutes} minutes ago`;
  const hours = Math.floor(minutes / 60);
  const remMins = minutes % 60;
  return `${hours}h ${remMins}m ago`;
}
