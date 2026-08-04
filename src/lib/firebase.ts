import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getFirestore,
  collection,
  doc,
  setDoc,
  deleteDoc,
  onSnapshot,
  query,
  orderBy
} from 'firebase/firestore';
import { SavedReport, ScheduleFlight, AdminNotice, UserLog } from '../types';
import config from '../../firebase-applet-config.json';

const app = !getApps().length ? initializeApp(config) : getApp();

export const db = config.firestoreDatabaseId
  ? getFirestore(app, config.firestoreDatabaseId)
  : getFirestore(app);

const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;
const FORTY_EIGHT_HOURS_MS = 48 * 60 * 60 * 1000;

// Helper to extract timestamp from notice or log ID/createdAt
function getCreatedTimestamp(item: { createdAt?: number; id: string }): number {
  if (item.createdAt) return item.createdAt;
  const parts = item.id.split('-');
  const lastPart = parts[parts.length - 1];
  const parsed = parseInt(lastPart, 10);
  return !isNaN(parsed) && parsed > 1600000000000 ? parsed : Date.now();
}

// Real-time listener for Saved Reports across all devices
export function subscribeToSavedReports(
  onUpdate: (reports: SavedReport[]) => void,
  onError?: (err: any) => void
) {
  try {
    const q = query(collection(db, 'savedReports'), orderBy('timestamp', 'desc'));
    return onSnapshot(
      q,
      (snapshot) => {
        const reports: SavedReport[] = [];
        const seenFlights = new Set<string>();

        snapshot.forEach((docSnap) => {
          const rep = docSnap.data() as SavedReport;
          const flightNum = (rep.flight || rep.formData?.deptFlt || '')
            .replace(/^BS-?/i, '')
            .trim()
            .toUpperCase();

          const key = flightNum ? `BS-${flightNum}` : rep.id;

          if (!seenFlights.has(key)) {
            seenFlights.add(key);
            reports.push(rep);
          } else {
            // Auto-purge older duplicate report document from Firestore to keep DB clean
            deleteDoc(doc(db, 'savedReports', rep.id)).catch(() => {});
          }
        });

        onUpdate(reports);
      },
      (error) => {
        console.error('Error listening to savedReports:', error);
        if (onError) onError(error);
      }
    );
  } catch (err) {
    console.error('Failed to subscribe to savedReports:', err);
    if (onError) onError(err);
    return () => {};
  }
}

// Save or Update a report in Firestore
export async function syncReportToFirestore(report: SavedReport) {
  try {
    const docRef = doc(db, 'savedReports', report.id);
    await setDoc(docRef, report, { merge: true });
  } catch (err) {
    console.error('Failed to sync report to Firestore:', err);
    throw err;
  }
}

// Delete a report from Firestore
export async function deleteReportFromFirestore(id: string) {
  try {
    const docRef = doc(db, 'savedReports', id);
    await deleteDoc(docRef);
  } catch (err) {
    console.error('Failed to delete report from Firestore:', err);
    throw err;
  }
}

// Real-time listener for Schedule Data
export function subscribeToSchedule(
  onUpdate: (data: { flights: ScheduleFlight[]; dateHeader: string; rawFlst: string }) => void,
  onError?: (err: any) => void
) {
  try {
    const docRef = doc(db, 'schedules', 'global_schedule');
    return onSnapshot(
      docRef,
      (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data();
          onUpdate({
            flights: data.flights || [],
            dateHeader: data.dateHeader || '',
            rawFlst: data.rawFlst || ''
          });
        }
      },
      (error) => {
        console.error('Error listening to schedule:', error);
        if (onError) onError(error);
      }
    );
  } catch (err) {
    console.error('Failed to subscribe to schedule:', err);
    if (onError) onError(err);
    return () => {};
  }
}

// Save schedule data to Firestore
export async function syncScheduleToFirestore(
  flights: ScheduleFlight[],
  dateHeader: string,
  rawFlst: string
) {
  try {
    const docRef = doc(db, 'schedules', 'global_schedule');
    await setDoc(docRef, {
      flights,
      dateHeader,
      rawFlst,
      updatedAt: new Date().toISOString()
    });
  } catch (err) {
    console.error('Failed to sync schedule to Firestore:', err);
    throw err;
  }
}

// Real-time listener for Admin Notices (Auto-vanish after 24 hours)
export function subscribeToNotices(
  onUpdate: (notices: AdminNotice[]) => void,
  onError?: (err: any) => void
) {
  try {
    const q = query(collection(db, 'notices'), orderBy('timestamp', 'desc'));
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
          } else {
            // Auto-purge notice from Firestore if older than 24 hours
            deleteDoc(doc(db, 'notices', item.id)).catch(() => {});
          }
        });

        // Sort descending by created timestamp
        notices.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
        onUpdate(notices);
      },
      (error) => {
        console.error('Error listening to notices:', error);
        if (onError) onError(error);
      }
    );
  } catch (err) {
    console.error('Failed to subscribe to notices:', err);
    if (onError) onError(err);
    return () => {};
  }
}

// Broadcast Admin Notice to Firestore
export async function broadcastNoticeToFirestore(notice: AdminNotice) {
  try {
    const docRef = doc(db, 'notices', notice.id);
    await setDoc(docRef, notice);
  } catch (err) {
    console.error('Failed to broadcast notice:', err);
    throw err;
  }
}

// Real-time listener for User Activity Logs (Auto-vanish after 48 hours)
export function subscribeToUserLogs(
  onUpdate: (logs: UserLog[]) => void,
  onError?: (err: any) => void
) {
  try {
    const q = query(collection(db, 'userLogs'), orderBy('createdAt', 'desc'));
    return onSnapshot(
      q,
      (snapshot) => {
        const logs: UserLog[] = [];
        const now = Date.now();

        snapshot.forEach((docSnap) => {
          const item = docSnap.data() as UserLog;
          const createdTs = item.createdAt || getCreatedTimestamp(item);
          const ageMs = now - createdTs;

          if (ageMs <= FORTY_EIGHT_HOURS_MS) {
            logs.push({ ...item, createdAt: createdTs });
          } else {
            // Auto-purge log from Firestore if older than 48 hours
            deleteDoc(doc(db, 'userLogs', item.id)).catch(() => {});
          }
        });

        logs.sort((a, b) => b.createdAt - a.createdAt);
        onUpdate(logs);
      },
      (error) => {
        console.error('Error listening to userLogs:', error);
        if (onError) onError(error);
      }
    );
  } catch (err) {
    console.error('Failed to subscribe to userLogs:', err);
    if (onError) onError(err);
    return () => {};
  }
}

// Log User Activity to Firestore
export async function logUserActivityToFirestore(log: UserLog) {
  try {
    const docRef = doc(db, 'userLogs', log.id);
    await setDoc(docRef, log);
  } catch (err) {
    console.error('Failed to log user activity to Firestore:', err);
  }
}
