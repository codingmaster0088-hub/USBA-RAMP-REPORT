// Report Lock Utility - 10-Minute Lockout Rule after DOWNLOAD JPG
// Rule:
// 1. If user clicked on 'SAVE REPORT' for inputting the rest of data later, the report is NOT locked and remains EDITABLE.
// 2. If user clicked on 'DOWNLOAD JPG' (official report card issued), the 10-minute timer begins from the download timestamp.
// 3. 10 minutes after 'DOWNLOAD JPG', that report automatically becomes READ-ONLY (only Super Admin can edit).

export const TEN_MINUTES_MS = 10 * 60 * 1000; // 10 minutes in milliseconds
export const SUPER_ADMIN_PIN = '11126377';

export function isReportDownloaded(report: {
  downloadedAt?: number;
  isDownloaded?: boolean;
}): boolean {
  return Boolean(
    (report.downloadedAt && !isNaN(report.downloadedAt) && report.downloadedAt > 0) ||
    report.isDownloaded
  );
}

export function getReportDownloadedAtMs(report: {
  downloadedAt?: number;
  isDownloaded?: boolean;
  createdAt?: number;
  timestamp?: string;
}): number | null {
  if (report.downloadedAt && !isNaN(report.downloadedAt) && report.downloadedAt > 0) {
    return report.downloadedAt;
  }
  return null;
}

export function getReportAgeSinceDownloadMs(report: {
  downloadedAt?: number;
  isDownloaded?: boolean;
  createdAt?: number;
  timestamp?: string;
}): number | null {
  const downloadedMs = getReportDownloadedAtMs(report);
  if (!downloadedMs) return null;
  return Math.max(0, Date.now() - downloadedMs);
}

export function isReportLocked(
  report: {
    downloadedAt?: number;
    isDownloaded?: boolean;
    createdAt?: number;
    timestamp?: string;
  },
  isSuperAdmin: boolean = false
): boolean {
  if (isSuperAdmin) return false;
  // If report was NEVER downloaded as JPG (i.e. only saved via 'SAVE REPORT'),
  // it is in progress / draft state and remains EDITABLE!
  if (!isReportDownloaded(report)) {
    return false;
  }
  const ageSinceDownload = getReportAgeSinceDownloadMs(report);
  if (ageSinceDownload === null) return false;
  return ageSinceDownload > TEN_MINUTES_MS;
}

export function getRemainingEditTimeMs(report: {
  downloadedAt?: number;
  isDownloaded?: boolean;
  createdAt?: number;
  timestamp?: string;
}): number | null {
  // If not downloaded, editing does not expire under the 10m countdown
  if (!isReportDownloaded(report)) return null;
  const ageSinceDownload = getReportAgeSinceDownloadMs(report);
  if (ageSinceDownload === null) return null;
  return Math.max(0, TEN_MINUTES_MS - ageSinceDownload);
}

export function formatRemainingEditTime(remainingMs: number | null): string {
  if (remainingMs === null) return 'Editable';
  if (remainingMs <= 0) return '0m 00s';
  const totalSeconds = Math.floor(remainingMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}m ${seconds.toString().padStart(2, '0')}s`;
}

export function formatReportAgeMins(ageMs: number | null): string {
  if (ageMs === null) return 'Not downloaded';
  const minutes = Math.floor(ageMs / (60 * 1000));
  if (minutes < 1) return 'Just now';
  if (minutes === 1) return '1 minute ago';
  if (minutes < 60) return `${minutes} minutes ago`;
  const hours = Math.floor(minutes / 60);
  const remMins = minutes % 60;
  return `${hours}h ${remMins}m ago`;
}
