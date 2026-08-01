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
import { SavedReport, ScheduleFlight, AdminNotice } from '../types';
import config from '../../firebase-applet-config.json';

const app = !getApps().length ? initializeApp(config) : getApp();

export const db = config.firestoreDatabaseId
  ? getFirestore(app, config.firestoreDatabaseId)
  : getFirestore(app);

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
        snapshot.forEach((docSnap) => {
          reports.push(docSnap.data() as SavedReport);
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

// Real-time listener for Admin Notices
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
        snapshot.forEach((docSnap) => {
          notices.push(docSnap.data() as AdminNotice);
        });
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
