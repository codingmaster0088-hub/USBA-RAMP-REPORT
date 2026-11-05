import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getFirestore,
  collection,
  doc,
  setDoc,
  deleteDoc,
  onSnapshot,
  query,
  orderBy,
  limit
} from 'firebase/firestore';
import { SavedReport, ScheduleFlight, AdminNotice, UserLog, DailyAnalyticalSnapshot } from '../types';
import config from '../../firebase-applet-config.json';

const app = !getApps().length ? initializeApp(config) : getApp();

export const db = config.firestoreDatabaseId
  ? getFirestore(app, config.firestoreDatabaseId)
  : getFirestore(app);

const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;
export const FIFTEEN_DAYS_MS = 15 * 24 * 60 * 60 * 1000; // Strict 15-Day rolling retention for database records

// Helper to detect if an error is a Firebase quota limit or rate-limit exhaustion
export function isQuotaExceededError(err: any): boolean {
  if (!err) return false;
  const msg = String(err?.message || err || '').toLowerCase();
  const code = String(err?.code || '').toLowerCase();
  return (
    code === 'resource-exhausted' ||
    msg.includes('quota') ||
    msg.includes('resource-exhausted') ||
    msg.includes('read units') ||
    msg.includes('limit exceeded')
  );
}

// Helper to recursively remove undefined fields and ensure Firestore compatibility
export function sanitizeForFirestore<T>(data: T): T {
  if (data === undefined) {
    return null as unknown as T;
  }
  if (data === null || typeof data !== 'object') {
    return data;
  }
  if (Array.isArray(data)) {
    return data.map((item) => sanitizeForFirestore(item)) as unknown as T;
  }
  const cleanObj: Record<string, any> = {};
  for (const [key, val] of Object.entries(data as Record<string, any>)) {
    if (val !== undefined) {
      cleanObj[key] = sanitizeForFirestore(val);
    }
  }
  return cleanObj as T;
}

// Helper to extract timestamp from notice or log ID/createdAt
function getCreatedTimestamp(item: { createdAt?: number; id: string }): number {
  if (item.createdAt) return item.createdAt;
  const parts = item.id.split('-');
  const lastPart = parts[parts.length - 1];
  const parsed = parseInt(lastPart, 10);
  return !isNaN(parsed) && parsed > 1600000000000 ? parsed : Date.now();
}

// =========================================================================
// OFFLINE & QUOTA PENDING SYNC QUEUE
// Ensures any report created or edited on any browser/device is queued and
// guaranteed to sync to Firestore the moment connection is active!
// =========================================================================

export function addToPendingSync(report: SavedReport) {
  try {
    const queue: SavedReport[] = JSON.parse(localStorage.getItem('usb_pending_sync_reports') || '[]');
    const filtered = queue.filter((r) => r.id !== report.id);
    filtered.push(report);
    localStorage.setItem('usb_pending_sync_reports', JSON.stringify(filtered));
  } catch (e) {
    console.warn('Failed to add to pending sync queue:', e);
  }
}

export function removeFromPendingSync(reportId: string) {
  try {
    const queue: SavedReport[] = JSON.parse(localStorage.getItem('usb_pending_sync_reports') || '[]');
    const filtered = queue.filter((r) => r.id !== reportId);
    localStorage.setItem('usb_pending_sync_reports', JSON.stringify(filtered));
  } catch (e) {}
}

export async function flushPendingSyncReports(): Promise<number> {
  let syncedCount = 0;
  try {
    const queue: SavedReport[] = JSON.parse(localStorage.getItem('usb_pending_sync_reports') || '[]');
    if (!queue.length) return 0;

    const remaining: SavedReport[] = [];
    for (const report of queue) {
      try {
        const docRef = doc(db, 'savedReports', report.id);
        await setDoc(docRef, sanitizeForFirestore(report), { merge: true });
        syncedCount++;
        console.log(`[Pending Sync] Synced flight ${report.flight} (${report.id}) to Firestore`);
      } catch (err) {
        remaining.push(report);
      }
    }
    localStorage.setItem('usb_pending_sync_reports', JSON.stringify(remaining));
  } catch (e) {
    console.warn('Error flushing pending sync reports:', e);
  }
  return syncedCount;
}

// Auto-flush pending queue whenever window comes online
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    flushPendingSyncReports().catch(() => {});
  });
}

// =========================================================================
// MULTICAST SHARED SUBSCRIBER FOR SAVED REPORTS
// Solves duplicate queries and binds limit to 150 documents to save quota!
// =========================================================================

let savedReportsSubscribers: Array<{
  onUpdate: (reports: SavedReport[]) => void;
  onError?: (err: any) => void;
}> = [];
let savedReportsUnsub: (() => void) | null = null;
let lastKnownSavedReports: SavedReport[] | null = null;

export function subscribeToSavedReports(
  onUpdate: (reports: SavedReport[]) => void,
  onError?: (err: any) => void
) {
  // 1. If we already have memory or cached reports, serve immediately
  if (lastKnownSavedReports) {
    onUpdate(lastKnownSavedReports);
  } else {
    try {
      const cached = localStorage.getItem('usb_reports');
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length > 0) {
          lastKnownSavedReports = parsed;
          onUpdate(parsed);
        }
      }
    } catch (e) {
      console.warn('Could not read cached reports:', e);
    }
  }

  // Register subscriber
  const sub = { onUpdate, onError };
  savedReportsSubscribers.push(sub);

  // If listener already active, return cleanup
  if (savedReportsUnsub) {
    return () => {
      savedReportsSubscribers = savedReportsSubscribers.filter((s) => s !== sub);
      if (savedReportsSubscribers.length === 0 && savedReportsUnsub) {
        savedReportsUnsub();
        savedReportsUnsub = null;
      }
    };
  }

  // Flush any pending reports on connect
  flushPendingSyncReports().catch(() => {});

  // 2. Query Firestore with limit(150) to preserve daily read quota
  try {
    let qRef;
    try {
      qRef = query(collection(db, 'savedReports'), orderBy('timestamp', 'desc'), limit(150));
    } catch {
      qRef = query(collection(db, 'savedReports'), limit(150));
    }

    savedReportsUnsub = onSnapshot(
      qRef,
      (snapshot) => {
        const rawReports: SavedReport[] = [];
        const now = Date.now();

        snapshot.forEach((docSnap) => {
          const raw = docSnap.data();
          if (!raw) return;
          const rep = { ...raw, id: raw.id || docSnap.id } as SavedReport;

          const repTime = rep.createdAt || (rep.timestamp ? new Date(rep.timestamp).getTime() : 0);
          if (repTime > 0 && now - repTime > FIFTEEN_DAYS_MS) {
            return;
          }

          rawReports.push(rep);
        });

        // In-memory sort by newest created timestamp first
        rawReports.sort((a, b) => {
          const tA = a.createdAt || (a.timestamp ? new Date(a.timestamp).getTime() : 0);
          const tB = b.createdAt || (b.timestamp ? new Date(b.timestamp).getTime() : 0);
          return tB - tA;
        });

        // Deduplicate so latest/last submitted report for that flight and date takes precedence
        const reports: SavedReport[] = [];
        const seenFlightDateKeys = new Set<string>();

        rawReports.forEach((rep) => {
          const flightNum = (rep.flight || rep.formData?.deptFlt || rep.formData?.arvFlt || '')
            .replace(/^BS-?/i, '')
            .trim()
            .toUpperCase();
          const rDate = (rep.formData?.date || rep.date || '').trim().toUpperCase();
          const key = flightNum && rDate ? `BS-${flightNum}-${rDate}` : rep.id;

          if (!seenFlightDateKeys.has(key)) {
            seenFlightDateKeys.add(key);
            reports.push(rep);
          }
        });

        lastKnownSavedReports = reports;
        try {
          localStorage.setItem('usb_reports', JSON.stringify(reports));
        } catch (e) {
          console.warn('LocalStorage save failed:', e);
        }

        // Fan out to all active subscribers
        savedReportsSubscribers.forEach((s) => {
          try {
            s.onUpdate(reports);
          } catch (e) {
            console.error('Subscriber callback error:', e);
          }
        });
      },
      (error) => {
        if (isQuotaExceededError(error)) {
          console.warn('[Firestore Cache Mode] Daily read quota limit reached for savedReports; seamlessly serving from local cache.');
          try {
            const cached = localStorage.getItem('usb_reports');
            if (cached) {
              const parsed = JSON.parse(cached);
              savedReportsSubscribers.forEach((s) => s.onUpdate(parsed));
            }
          } catch (_) {}
          return;
        }
        console.warn('Issue listening to savedReports:', error?.message || error);
        savedReportsSubscribers.forEach((s) => s.onError && s.onError(error));
      }
    );
  } catch (err) {
    if (isQuotaExceededError(err)) {
      console.warn('[Firestore Cache Mode] Quota reached on subscribeToSavedReports; serving from local cache.');
    } else {
      console.warn('Failed to subscribe to savedReports:', err);
    }
    if (onError) onError(err);
  }

  return () => {
    savedReportsSubscribers = savedReportsSubscribers.filter((s) => s !== sub);
    if (savedReportsSubscribers.length === 0 && savedReportsUnsub) {
      savedReportsUnsub();
      savedReportsUnsub = null;
    }
  };
}

// Save or Update a report in Firestore with automatic offline/local fallback and queue
export async function syncReportToFirestore(report: SavedReport): Promise<void> {
  const cleanReport = sanitizeForFirestore({
    ...report,
    id: report.id,
    timestamp: report.timestamp || new Date().toISOString(),
    createdAt: report.createdAt || Date.now()
  });

  // Always update local cache first
  try {
    const cached = JSON.parse(localStorage.getItem('usb_reports') || '[]');
    const filtered = cached.filter((r: SavedReport) => r.id !== cleanReport.id);
    filtered.unshift(cleanReport);
    localStorage.setItem('usb_reports', JSON.stringify(filtered));
    lastKnownSavedReports = filtered;
  } catch (e) {
    console.warn('Failed to update local cache for report:', e);
  }

  try {
    const docRef = doc(db, 'savedReports', cleanReport.id);
    await setDoc(docRef, cleanReport, { merge: true });
    removeFromPendingSync(cleanReport.id);
    console.log(`[Firestore] Report synced: ${cleanReport.id} (${cleanReport.flight})`);
  } catch (err) {
    addToPendingSync(cleanReport);
    if (isQuotaExceededError(err)) {
      console.warn(`[Firestore Offline Cache] Quota limit reached; report ${cleanReport.id} queued in pending sync.`);
      return;
    }
    console.warn(`[Firestore Warning] Could not sync report ${report?.id} to remote:`, err);
    throw err;
  }
}

// Delete a report from Firestore with local cache cleanup
export async function deleteReportFromFirestore(id: string) {
  removeFromPendingSync(id);
  try {
    const cached = JSON.parse(localStorage.getItem('usb_reports') || '[]');
    const filtered = cached.filter((r: SavedReport) => r.id !== id);
    localStorage.setItem('usb_reports', JSON.stringify(filtered));
    lastKnownSavedReports = filtered;
  } catch (e) {
    console.warn('Failed to delete report from local cache:', e);
  }

  try {
    const docRef = doc(db, 'savedReports', id);
    await deleteDoc(docRef);
  } catch (err) {
    if (isQuotaExceededError(err)) {
      console.warn(`[Firestore Offline Cache] Quota reached; report ${id} removed locally.`);
      return;
    }
    console.warn('Failed to delete report from Firestore:', err);
    throw err;
  }
}

// Real-time listener for Schedule Data with local cache fallback
export function subscribeToSchedule(
  onUpdate: (data: { flights: ScheduleFlight[]; dateHeader: string; rawFlst: string }) => void,
  onError?: (err: any) => void
) {
  // Hydrate from local cache immediately
  try {
    const cachedFlights = localStorage.getItem('usb_schedule_data');
    const cachedDate = localStorage.getItem('usb_schedule_date') || '';
    const cachedFlst = localStorage.getItem('usb_flst_raw') || '';
    if (cachedFlights) {
      const parsed = JSON.parse(cachedFlights);
      if (Array.isArray(parsed) && parsed.length > 0) {
        onUpdate({ flights: parsed, dateHeader: cachedDate, rawFlst: cachedFlst });
      }
    }
  } catch (e) {
    console.warn('Could not read cached schedule:', e);
  }

  try {
    const docRef = doc(db, 'schedules', 'global_schedule');
    return onSnapshot(
      docRef,
      (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data();
          const scheduleData = {
            flights: data.flights || [],
            dateHeader: data.dateHeader || '',
            rawFlst: data.rawFlst || ''
          };
          localStorage.setItem('usb_schedule_data', JSON.stringify(scheduleData.flights));
          localStorage.setItem('usb_schedule_date', scheduleData.dateHeader);
          if (scheduleData.rawFlst) localStorage.setItem('usb_flst_raw', scheduleData.rawFlst);
          onUpdate(scheduleData);
        }
      },
      (error) => {
        if (isQuotaExceededError(error)) {
          console.warn('[Firestore Cache Mode] Daily read quota reached for schedule; serving from local cache.');
          return;
        }
        console.warn('Issue listening to schedule:', error?.message || error);
        if (onError) onError(error);
      }
    );
  } catch (err) {
    if (isQuotaExceededError(err)) {
      console.warn('[Firestore Cache Mode] Quota reached on subscribeToSchedule; serving from local cache.');
    } else {
      console.warn('Failed to subscribe to schedule:', err);
    }
    if (onError) onError(err);
    return () => {};
  }
}

// Save schedule data to Firestore with local cache update
export async function syncScheduleToFirestore(
  flights: ScheduleFlight[],
  dateHeader: string,
  rawFlst: string
) {
  try {
    localStorage.setItem('usb_schedule_data', JSON.stringify(flights));
    localStorage.setItem('usb_schedule_date', dateHeader);
    if (rawFlst) localStorage.setItem('usb_flst_raw', rawFlst);
  } catch (e) {
    console.warn('Failed to save schedule to local cache:', e);
  }

  try {
    const docRef = doc(db, 'schedules', 'global_schedule');
    await setDoc(docRef, {
      flights,
      dateHeader,
      rawFlst,
      updatedAt: new Date().toISOString()
    });
  } catch (err) {
    if (isQuotaExceededError(err)) {
      console.warn('[Firestore Offline Cache] Quota reached; schedule safely saved in local storage.');
      return;
    }
    console.warn('Failed to sync schedule to Firestore:', err);
    throw err;
  }
}

// Real-time listener for Admin Notices with quota resilience
export function subscribeToNotices(
  onUpdate: (notices: AdminNotice[]) => void,
  onError?: (err: any) => void
) {
  // Hydrate from local cache immediately
  try {
    const cached = localStorage.getItem('usb_notices');
    if (cached) {
      const parsed = JSON.parse(cached);
      if (Array.isArray(parsed)) {
        onUpdate(parsed);
      }
    }
  } catch (e) {
    console.warn('Could not read cached notices:', e);
  }

  try {
    const q = query(collection(db, 'notices'), orderBy('timestamp', 'desc'), limit(25));
    return onSnapshot(
      q,
      (snapshot) => {
        const notices: AdminNotice[] = [];
        const now = Date.now();

        snapshot.forEach((docSnap) => {
          const item = docSnap.data() as AdminNotice;
          const createdTs = getCreatedTimestamp(item);
          const ageMs = now - createdTs;

          if (ageMs <= TWENTY_FOUR_HOURS_MS) {
            notices.push({ ...item, createdAt: createdTs });
          }
        });

        notices.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
        localStorage.setItem('usb_notices', JSON.stringify(notices));
        onUpdate(notices);
      },
      (error) => {
        if (isQuotaExceededError(error)) {
          console.warn('[Firestore Cache Mode] Daily read quota reached for notices; serving from local cache.');
          return;
        }
        console.warn('Issue listening to notices:', error?.message || error);
        if (onError) onError(error);
      }
    );
  } catch (err) {
    if (isQuotaExceededError(err)) {
      console.warn('[Firestore Cache Mode] Quota reached on subscribeToNotices; serving from local cache.');
    } else {
      console.warn('Failed to subscribe to notices:', err);
    }
    if (onError) onError(err);
    return () => {};
  }
}

// Broadcast Admin Notice to Firestore with local cache update
export async function broadcastNoticeToFirestore(notice: AdminNotice) {
  try {
    const cached: AdminNotice[] = JSON.parse(localStorage.getItem('usb_notices') || '[]');
    cached.unshift(notice);
    localStorage.setItem('usb_notices', JSON.stringify(cached));
  } catch (e) {
    console.warn('Failed to save notice to local cache:', e);
  }

  try {
    const docRef = doc(db, 'notices', notice.id);
    await setDoc(docRef, notice);
  } catch (err) {
    if (isQuotaExceededError(err)) {
      console.warn('[Firestore Offline Cache] Quota reached; notice broadcasted and saved locally.');
      return;
    }
    console.warn('Failed to broadcast notice:', err);
    throw err;
  }
}

// Delete Admin Notice from Firestore
export async function deleteNoticeFromFirestore(id: string) {
  try {
    const cached: AdminNotice[] = JSON.parse(localStorage.getItem('usb_notices') || '[]');
    const filtered = cached.filter((n) => n.id !== id);
    localStorage.setItem('usb_notices', JSON.stringify(filtered));
  } catch (e) {
    console.warn('Failed to delete notice from local cache:', e);
  }

  try {
    const docRef = doc(db, 'notices', id);
    await deleteDoc(docRef);
  } catch (err) {
    if (isQuotaExceededError(err)) {
      console.warn(`[Firestore Offline Cache] Quota reached; notice ${id} removed locally.`);
      return;
    }
    console.warn('Failed to delete notice from Firestore:', err);
    throw err;
  }
}

// Real-time listener for User Activity Logs with limit and quota fallback
export function subscribeToUserLogs(
  onUpdate: (logs: UserLog[]) => void,
  onError?: (err: any) => void
) {
  // Hydrate from local cache immediately
  try {
    const cached = localStorage.getItem('usb_user_logs');
    if (cached) {
      const parsed = JSON.parse(cached);
      if (Array.isArray(parsed)) {
        onUpdate(parsed);
      }
    }
  } catch (e) {
    console.warn('Could not read cached user logs:', e);
  }

  try {
    const q = query(collection(db, 'userLogs'), orderBy('createdAt', 'desc'), limit(50));
    return onSnapshot(
      q,
      (snapshot) => {
        const logs: UserLog[] = [];
        const seenIds = new Set<string>();
        const now = Date.now();

        snapshot.forEach((docSnap) => {
          const item = docSnap.data() as UserLog;
          if (!item) return;
          const logId = item.id || docSnap.id;
          const createdTs = item.createdAt || getCreatedTimestamp(item);
          const ageMs = now - createdTs;

          if (ageMs <= 72 * 60 * 60 * 1000) {
            if (!seenIds.has(logId)) {
              seenIds.add(logId);
              logs.push({ ...item, id: logId, createdAt: createdTs });
            }
          }
        });

        logs.sort((a, b) => b.createdAt - a.createdAt);
        localStorage.setItem('usb_user_logs', JSON.stringify(logs));
        onUpdate(logs);
      },
      (error) => {
        if (isQuotaExceededError(error)) {
          console.warn('[Firestore Cache Mode] Daily read quota reached for userLogs; serving from local cache.');
          return;
        }
        console.warn('Issue listening to userLogs:', error?.message || error);
        if (onError) onError(error);
      }
    );
  } catch (err) {
    if (isQuotaExceededError(err)) {
      console.warn('[Firestore Cache Mode] Quota reached on subscribeToUserLogs; serving from local cache.');
    } else {
      console.warn('Failed to subscribe to userLogs:', err);
    }
    if (onError) onError(err);
    return () => {};
  }
}

// Log User Activity to Firestore
export async function logUserActivityToFirestore(log: UserLog) {
  const cleanLog = sanitizeForFirestore(log);

  try {
    const cached: UserLog[] = JSON.parse(localStorage.getItem('usb_user_logs') || '[]');
    cached.unshift(cleanLog);
    if (cached.length > 50) cached.length = 50;
    localStorage.setItem('usb_user_logs', JSON.stringify(cached));
  } catch (e) {
    console.warn('Failed to save log to local cache:', e);
  }

  try {
    const docRef = doc(db, 'userLogs', cleanLog.id);
    await setDoc(docRef, cleanLog);
  } catch (err) {
    if (isQuotaExceededError(err)) {
      console.warn('[Firestore Offline Cache] Quota reached; user log saved in local cache.');
      return;
    }
    console.warn('Failed to log user activity to Firestore:', err);
  }
}

// =========================================================================
// 15-DAY BACKEND STORAGE FOR DAILY ANALYTICAL & TIME SNAPSHOTS
// =========================================================================

// Save full-day analytical snapshot to Firestore with 15-day retention
export async function saveDailyAnalyticalSnapshotToFirestore(snapshot: DailyAnalyticalSnapshot): Promise<void> {
  const docId = `SNAPSHOT_${snapshot.dateIso}_${snapshot.station || 'ALL'}`;
  const now = Date.now();
  const expiresAt = snapshot.expiresAt || (now + FIFTEEN_DAYS_MS);

  const payload: DailyAnalyticalSnapshot = {
    ...snapshot,
    id: docId,
    savedAt: snapshot.savedAt || now,
    expiresAt: expiresAt
  };

  const cleanPayload = sanitizeForFirestore(payload);

  try {
    const cached: DailyAnalyticalSnapshot[] = JSON.parse(localStorage.getItem('usb_daily_snapshots') || '[]');
    const filtered = cached.filter((s) => s.id !== docId);
    filtered.unshift(cleanPayload);
    localStorage.setItem('usb_daily_snapshots', JSON.stringify(filtered));
  } catch (e) {
    console.warn('Failed to save snapshot to local cache:', e);
  }

  try {
    const docRef = doc(db, 'dailyAnalyticalSnapshots', docId);
    await setDoc(docRef, cleanPayload, { merge: true });
    console.log(`[Firestore] Daily analytical snapshot saved: ${docId}`);
  } catch (err) {
    if (isQuotaExceededError(err)) {
      console.warn(`[Firestore Offline Cache] Quota reached; snapshot ${docId} retained in local cache.`);
      return;
    }
    console.warn('Failed to save daily analytical snapshot to Firestore:', err);
    throw err;
  }
}

// Multicast shared listener for Daily Analytical Snapshots
let dailySnapshotsSubscribers: Array<{
  onUpdate: (snapshots: DailyAnalyticalSnapshot[]) => void;
  onError?: (err: any) => void;
}> = [];
let dailySnapshotsUnsub: (() => void) | null = null;
let lastKnownSnapshots: DailyAnalyticalSnapshot[] | null = null;

// Real-time subscription to 15-Day Daily Analytical Snapshots with strict auto-purge and quota resilience
export function subscribeToDailyAnalyticalSnapshots(
  onUpdate: (snapshots: DailyAnalyticalSnapshot[]) => void,
  onError?: (err: any) => void
) {
  // 1. If we already have memory or cached snapshots, serve immediately
  if (lastKnownSnapshots) {
    onUpdate(lastKnownSnapshots);
  } else {
    try {
      const cached = localStorage.getItem('usb_daily_snapshots');
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length > 0) {
          lastKnownSnapshots = parsed;
          onUpdate(parsed);
        }
      }
    } catch (e) {
      console.warn('Could not read cached snapshots:', e);
    }
  }

  const sub = { onUpdate, onError };
  dailySnapshotsSubscribers.push(sub);

  if (dailySnapshotsUnsub) {
    return () => {
      dailySnapshotsSubscribers = dailySnapshotsSubscribers.filter((s) => s !== sub);
      if (dailySnapshotsSubscribers.length === 0 && dailySnapshotsUnsub) {
        dailySnapshotsUnsub();
        dailySnapshotsUnsub = null;
      }
    };
  }

  try {
    let qRef;
    try {
      qRef = query(collection(db, 'dailyAnalyticalSnapshots'), orderBy('dateIso', 'desc'), limit(20));
    } catch {
      qRef = query(collection(db, 'dailyAnalyticalSnapshots'), limit(20));
    }

    dailySnapshotsUnsub = onSnapshot(
      qRef,
      (snapshot) => {
        const list: DailyAnalyticalSnapshot[] = [];
        const now = Date.now();

        snapshot.forEach((docSnap) => {
          try {
            const item = docSnap.data() as DailyAnalyticalSnapshot;
            if (!item) return;
            const expiresAt = item.expiresAt || (item.savedAt ? item.savedAt + FIFTEEN_DAYS_MS : now + FIFTEEN_DAYS_MS);

            if (now <= expiresAt) {
              list.push({ ...item, id: item.id || docSnap.id });
            }
          } catch (e) {
            console.warn('Error parsing snapshot doc:', e);
          }
        });

        list.sort((a, b) => (b.dateIso || '').localeCompare(a.dateIso || ''));
        lastKnownSnapshots = list;
        try {
          localStorage.setItem('usb_daily_snapshots', JSON.stringify(list));
        } catch (_) {}

        dailySnapshotsSubscribers.forEach((s) => {
          try {
            s.onUpdate(list);
          } catch (e) {
            console.error('Snapshot subscriber error:', e);
          }
        });
      },
      (error) => {
        if (isQuotaExceededError(error)) {
          console.warn('[Firestore Cache Mode] Daily read quota reached for dailyAnalyticalSnapshots; serving from local cache.');
          try {
            const cached = localStorage.getItem('usb_daily_snapshots');
            if (cached) {
              const parsed = JSON.parse(cached);
              dailySnapshotsSubscribers.forEach((s) => s.onUpdate(parsed));
            }
          } catch (_) {}
          return;
        }
        console.warn('Issue listening to dailyAnalyticalSnapshots:', error?.message || error);
        dailySnapshotsSubscribers.forEach((s) => s.onError && s.onError(error));
      }
    );
  } catch (err) {
    if (isQuotaExceededError(err)) {
      console.warn('[Firestore Cache Mode] Quota reached on subscribeToDailyAnalyticalSnapshots; serving from local cache.');
    } else {
      console.warn('Failed to subscribe to dailyAnalyticalSnapshots:', err);
    }
    if (onError) onError(err);
  }

  return () => {
    dailySnapshotsSubscribers = dailySnapshotsSubscribers.filter((s) => s !== sub);
    if (dailySnapshotsSubscribers.length === 0 && dailySnapshotsUnsub) {
      dailySnapshotsUnsub();
      dailySnapshotsUnsub = null;
    }
  };
}

// System Setting: Outstation Access Control (Defaults to true: restricted)
export function subscribeToOutstationAccess(
  onUpdate: (isRestricted: boolean) => void
) {
  try {
    const cached = localStorage.getItem('usb_outstation_restricted');
    if (cached !== null) {
      onUpdate(cached === 'true');
    }
  } catch (_) {}

  try {
    const docRef = doc(db, 'systemSettings', 'outstationAccess');
    return onSnapshot(
      docRef,
      (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data();
          const restricted = data?.isRestricted !== false;
          localStorage.setItem('usb_outstation_restricted', String(restricted));
          onUpdate(restricted);
        } else {
          onUpdate(true);
        }
      },
      (err) => {
        if (isQuotaExceededError(err)) {
          console.warn('[Firestore Cache Mode] Quota reached for outstationAccess; using local setting.');
          return;
        }
        console.warn('Could not listen to outstationAccess in Firestore:', err);
      }
    );
  } catch (err) {
    console.warn('Error setting up outstation access subscription:', err);
    return () => {};
  }
}

export async function setOutstationAccessInFirestore(isRestricted: boolean): Promise<void> {
  try {
    localStorage.setItem('usb_outstation_restricted', String(isRestricted));
  } catch (e) {
    console.warn('Failed to save outstation access setting to local cache:', e);
  }

  try {
    const docRef = doc(db, 'systemSettings', 'outstationAccess');
    await setDoc(docRef, {
      isRestricted,
      updatedAt: new Date().toISOString()
    }, { merge: true });
  } catch (err) {
    if (isQuotaExceededError(err)) {
      console.warn('[Firestore Offline Cache] Quota reached; outstation access setting saved locally.');
      return;
    }
    console.warn('Failed to update outstation access in Firestore:', err);
    throw err;
  }
}
