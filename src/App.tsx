import React, { useState, useEffect } from 'react';
import {
  UserProfile,
  SavedReport,
  ReportType,
  FlightMode,
  RampReportFormData,
  StationCode,
  ActiveTab,
  ScheduleFlight,
  AdminNotice,
  UserLog,
  UserActionType
} from './types';
import { parseFLSTData, sampleFLSTInput } from './utils/flstParser';
import {
  subscribeToSavedReports,
  syncReportToFirestore,
  deleteReportFromFirestore,
  subscribeToSchedule,
  syncScheduleToFirestore,
  subscribeToNotices,
  broadcastNoticeToFirestore,
  deleteNoticeFromFirestore,
  subscribeToUserLogs,
  logUserActivityToFirestore,
  saveDailyAnalyticalSnapshotToFirestore
} from './lib/firebase';
import { parseDateToIso, buildDailyAnalyticalSnapshot } from './utils/analyticalSnapshotBuilder';
import { Header } from './components/Header';
import { MobileBottomNav } from './components/MobileBottomNav';
import { LiveMonitor } from './components/LiveMonitor';
import { ReportForm } from './components/ReportForm';
import { SavedReports } from './components/SavedReports';
import { AdminSection } from './components/AdminSection';
import { LoginModal } from './components/LoginModal';
import { NoticeModal } from './components/NoticeModal';
import { ReportCanvasCard } from './components/ReportCanvasCard';
import { DownloadModal } from './components/DownloadModal';
import { CheckCircle2, AlertCircle, RefreshCw, X, Wifi } from 'lucide-react';

const FIVE_HOURS_MS = 5 * 60 * 60 * 1000; // 5 hours in milliseconds

export default function App() {
  // LocalStorage User Session with 5-Hour Inactivity Check
  const [user, setUser] = useState<UserProfile | null>(() => {
    try {
      const lastAct = localStorage.getItem('usb_last_activity');
      if (lastAct) {
        const lastTime = parseInt(lastAct, 10);
        if (!isNaN(lastTime) && Date.now() - lastTime >= FIVE_HOURS_MS) {
          localStorage.removeItem('usb_user');
          localStorage.removeItem('usb_last_activity');
          return null;
        }
      }
      const saved = localStorage.getItem('usb_user');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  // Theme Mode State (Defaults to false -> High-Sun Ramp Light Mode / White Background)
  const [isDarkMode, setIsDarkMode] = useState<boolean>(() => {
    return localStorage.getItem('usb_theme') === 'dark';
  });

  useEffect(() => {
    if (isDarkMode) {
      document.body.classList.remove('light-mode');
      document.body.classList.add('dark-mode');
    } else {
      document.body.classList.remove('dark-mode');
      document.body.classList.add('light-mode');
    }
  }, [isDarkMode]);

  const handleToggleTheme = () => {
    setIsDarkMode((prev) => {
      const next = !prev;
      localStorage.setItem('usb_theme', next ? 'dark' : 'light');
      return next;
    });
  };

  // Saved Reports state with Firebase real-time sync
  const [savedReports, setSavedReports] = useState<SavedReport[]>(() => {
    try {
      const saved = localStorage.getItem('usb_reports');
      if (saved) {
        const parsed: SavedReport[] = JSON.parse(saved);
        // Filter out legacy mock/demo reports (e.g. demo-1, demo-2 BS-341, sub-*)
        const validReports = parsed.filter(
          (r) => !r.id.startsWith('demo-') && !r.id.startsWith('sub-')
        );
        localStorage.setItem('usb_reports', JSON.stringify(validReports));
        return validReports;
      }
      return [];
    } catch {
      return [];
    }
  });

  // Schedule Flights State for LIVE tab with Firebase real-time sync
  const [scheduleFlights, setScheduleFlights] = useState<ScheduleFlight[]>(() => {
    try {
      const saved = localStorage.getItem('usb_schedule_data');
      if (saved) return JSON.parse(saved);
      const parsed = parseFLSTData(sampleFLSTInput);
      return parsed.flights;
    } catch {
      return parseFLSTData(sampleFLSTInput).flights;
    }
  });

  const [scheduleDate, setScheduleDate] = useState<string>(() => {
    try {
      const saved = localStorage.getItem('usb_schedule_date');
      if (saved) return saved;
      return parseFLSTData(sampleFLSTInput).dateHeader;
    } catch {
      return parseFLSTData(sampleFLSTInput).dateHeader;
    }
  });

  const [isLiveConnected, setIsLiveConnected] = useState<boolean>(true);

  // Admin Notices State & Pop-up Modal
  const [notices, setNotices] = useState<AdminNotice[]>([]);
  const [activePopupNotice, setActivePopupNotice] = useState<AdminNotice | null>(null);

  // User Logs State (48h auto-vanish)
  const [userLogs, setUserLogs] = useState<UserLog[]>([]);

  // Active Tab: 'live' | 'form' | 'saved' | 'admin'
  const [activeTab, setActiveTabState] = useState<ActiveTab>(() => {
    try {
      const saved = localStorage.getItem('usb_active_tab') as ActiveTab;
      if (saved && ['live', 'form', 'saved', 'admin'].includes(saved)) {
        return saved;
      }
    } catch (e) {}
    return 'live';
  });

  const setActiveTab = (tab: ActiveTab) => {
    setActiveTabState(tab);
    try {
      localStorage.setItem('usb_active_tab', tab);
    } catch (e) {}
  };

  // Form Initial Sector Mode & Report to Edit
  const [reportType, setReportType] = useState<ReportType>('DOMESTIC');
  const [reportToEdit, setReportToEditState] = useState<SavedReport | null>(() => {
    try {
      const saved = localStorage.getItem('usb_report_to_edit');
      if (saved) return JSON.parse(saved);
    } catch (e) {}
    return null;
  });

  const setReportToEdit = (rep: SavedReport | null) => {
    setReportToEditState(rep);
    try {
      if (rep) {
        localStorage.setItem('usb_report_to_edit', JSON.stringify(rep));
      } else {
        localStorage.removeItem('usb_report_to_edit');
      }
    } catch (e) {}
  };

  // Toast Modal State
  const [toastMessage, setToastMessage] = useState<{ title: string; subtitle?: string; type: 'success' | 'info' | 'error' } | null>(null);

  // Download Target Modal State for iOS/Mobile Share Support
  const [downloadModalTarget, setDownloadModalTarget] = useState<{ dataUrl: string; fileName: string } | null>(null);

  // JPG Export Render Trigger
  const [renderExportTarget, setRenderExportTarget] = useState<{
    formData: RampReportFormData;
    type: ReportType;
    mode: FlightMode;
  } | null>(null);

  const [isExporting, setIsExporting] = useState(false);

  // Helper function to log user activity
  const logUserAction = async (
    action: UserActionType,
    details: string,
    overrideUser?: UserProfile | null
  ) => {
    const activeUser = overrideUser !== undefined ? overrideUser : user;
    if (!activeUser) return;

    const now = new Date();
    const timeStr =
      now.toLocaleDateString('en-GB', {
        day: '2-digit',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit'
      }) + ' LT';

    const newLog: UserLog = {
      id: `log-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      timestamp: timeStr,
      createdAt: Date.now(),
      userName: activeUser.name,
      userId: activeUser.id,
      station: activeUser.station,
      action,
      details
    };

    try {
      await logUserActivityToFirestore(newLog);
    } catch (err) {
      console.error('Failed to log activity:', err);
    }
  };

  // Subscribe to Firebase Firestore real-time updates for Saved Reports, Schedules, Notices & User Logs
  useEffect(() => {
    const unsubReports = subscribeToSavedReports(
      (reports) => {
        const validReports = (reports || []).filter((r) => {
          if (r.id.startsWith('demo-') || r.id.startsWith('sub-')) {
            // Auto-purge legacy mock/demo report from Firestore
            deleteReportFromFirestore(r.id).catch(() => {});
            return false;
          }
          return true;
        });

        setSavedReports(validReports);
        localStorage.setItem('usb_reports', JSON.stringify(validReports));
        setIsLiveConnected(true);
      },
      () => setIsLiveConnected(false)
    );

    const unsubSchedule = subscribeToSchedule((data) => {
      if (data && data.flights && data.flights.length > 0) {
        setScheduleFlights(data.flights);
        setScheduleDate(data.dateHeader);
        localStorage.setItem('usb_schedule_data', JSON.stringify(data.flights));
        localStorage.setItem('usb_schedule_date', data.dateHeader);
        if (data.rawFlst) localStorage.setItem('usb_flst_raw', data.rawFlst);
      } else {
        // If Firestore empty schedule, sync initial parsed sample
        const defaultParsed = parseFLSTData(sampleFLSTInput);
        syncScheduleToFirestore(defaultParsed.flights, defaultParsed.dateHeader, sampleFLSTInput).catch(() => {});
      }
      setIsLiveConnected(true);
    }, () => setIsLiveConnected(false));

    const unsubNotices = subscribeToNotices((incomingNotices) => {
      setNotices(incomingNotices);
      if (incomingNotices && incomingNotices.length > 0) {
        const latest = incomingNotices[0];
        const ackId = localStorage.getItem(`usb_notice_ack_${latest.id}`);
        if (!ackId) {
          setActivePopupNotice(latest);
        }
      }
    });

    const unsubLogs = subscribeToUserLogs((incomingLogs) => {
      setUserLogs(incomingLogs);
    });

    return () => {
      unsubReports();
      unsubSchedule();
      unsubNotices();
      unsubLogs();
    };
  }, []);

  // Show Toast after login auto-reload
  useEffect(() => {
    const pendingToast = sessionStorage.getItem('usb_show_login_toast');
    if (pendingToast) {
      try {
        const { name, station } = JSON.parse(pendingToast);
        showToast(`Welcome, Officer ${name}`, `Station: ${station}`, 'success');
      } catch (e) {}
      sessionStorage.removeItem('usb_show_login_toast');
    }
  }, []);

  // 5-Hour Inactivity Activity Listener & Auto-Logout Monitor
  useEffect(() => {
    if (!user) return;

    // Set initial activity timestamp on mount/login
    const now = Date.now();
    localStorage.setItem('usb_last_activity', now.toString());

    let lastSavedTime = now;
    const registerActivity = () => {
      const current = Date.now();
      if (current - lastSavedTime > 10000) { // Throttle updates to once every 10 seconds
        lastSavedTime = current;
        localStorage.setItem('usb_last_activity', current.toString());
      }
    };

    const activityEvents = ['mousemove', 'keydown', 'click', 'touchstart', 'scroll'];
    activityEvents.forEach((evt) => window.addEventListener(evt, registerActivity, { passive: true }));

    // Periodic check every 30 seconds for 5-hour timeout
    const inactivityCheckInterval = setInterval(() => {
      const lastAct = localStorage.getItem('usb_last_activity');
      if (lastAct) {
        const lastTime = parseInt(lastAct, 10);
        if (!isNaN(lastTime) && Date.now() - lastTime >= FIVE_HOURS_MS) {
          logUserAction('LOGOUT', `Auto-logged out due to 5 hours of inactivity from station ${user.station}`);
          localStorage.removeItem('usb_user');
          localStorage.removeItem('usb_last_activity');
          setUser(null);
          showToast('Session Expired', 'Auto logged out due to 5 hours of inactivity', 'info');
        }
      }
    }, 30000);

    return () => {
      activityEvents.forEach((evt) => window.removeEventListener(evt, registerActivity));
      clearInterval(inactivityCheckInterval);
    };
  }, [user]);

  // Handle Login (Saves credentials, logs activity, and auto-reloads page for latest web bundle)
  const handleLogin = (newUser: UserProfile) => {
    setUser(newUser);
    localStorage.setItem('usb_user', JSON.stringify(newUser));
    localStorage.setItem('usb_last_activity', Date.now().toString());
    sessionStorage.setItem('usb_show_login_toast', JSON.stringify({ name: newUser.name, station: newUser.station }));
    logUserAction('LOGIN', `Logged in to system at station ${newUser.station}`, newUser);
    
    // Auto-refresh page to ensure user gets latest code update without manual refresh
    window.location.reload();
  };

  // Handle Logout
  const handleLogout = () => {
    if (user) {
      logUserAction('LOGOUT', `Logged out from station ${user.station}`);
    }
    showToast('Logged out successfully', 'Thank you Officer!', 'info');
    setTimeout(() => {
      localStorage.removeItem('usb_user');
      localStorage.removeItem('usb_last_activity');
      setUser(null);
    }, 1000);
  };

  // Station Change
  const handleStationChange = (station: StationCode) => {
    if (!user) return;
    const updatedUser = { ...user, station };
    setUser(updatedUser);
    localStorage.setItem('usb_user', JSON.stringify(updatedUser));
    showToast(`Station changed to ${station}`, '', 'info');
    logUserAction('OTHER', `Changed active station to ${station}`, updatedUser);
  };

  // Toast Helper
  const showToast = (title: string, subtitle: string = '', type: 'success' | 'info' | 'error' = 'success') => {
    setToastMessage({ title, subtitle, type });
    setTimeout(() => {
      setToastMessage(null);
    }, 3000);
  };

  // Update Schedule Action from ADMIN -> Syncs live to cloud Firestore!
  const handleUpdateSchedule = async (flights: ScheduleFlight[], dateHeader: string, rawFlst: string) => {
    setScheduleFlights(flights);
    setScheduleDate(dateHeader);
    try {
      localStorage.setItem('usb_schedule_data', JSON.stringify(flights));
      localStorage.setItem('usb_schedule_date', dateHeader);
      localStorage.setItem('usb_flst_raw', rawFlst);
      await syncScheduleToFirestore(flights, dateHeader, rawFlst);
      showToast('Flight Schedule Broadcasted Live!', `All connected devices updated (${flights.length} flights)`, 'success');
      logUserAction('UPDATE_SCHEDULE', `Updated flight schedule (${flights.length} flights) for ${dateHeader}`);
    } catch (e) {
      console.error('Error saving schedule:', e);
      showToast('Updated locally', 'Cloud sync will retry automatically', 'info');
    }
  };

  // Broadcast Special Notice from Admin
  const handleBroadcastNotice = async (message: string) => {
    if (!user) return;
    const createdAt = Date.now();
    const newNotice: AdminNotice = {
      id: `notice-${createdAt}`,
      message,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + ' LT',
      author: `${user.name} (${user.id})`,
      authorName: user.name,
      authorId: user.id,
      createdAt
    };

    await broadcastNoticeToFirestore(newNotice);
    showToast('Special Notice Broadcasted Live!', 'All online officers will receive the notice modal', 'success');
    logUserAction('BROADCAST_NOTICE', `Broadcasted special notice: "${message.slice(0, 45)}${message.length > 45 ? '...' : ''}"`);
  };

  // Delete Special Notice (Admin action)
  const handleDeleteNotice = async (noticeId: string) => {
    try {
      await deleteNoticeFromFirestore(noticeId);
      if (activePopupNotice?.id === noticeId) {
        setActivePopupNotice(null);
      }
      showToast('Notice Removed', 'Notice deleted successfully', 'info');
      logUserAction('OTHER', `Deleted broadcast notice (${noticeId})`);
    } catch (e) {
      console.error(e);
      showToast('Delete Failed', 'Could not remove notice', 'error');
    }
  };

  const handleAcknowledgeNotice = () => {
    if (activePopupNotice) {
      localStorage.setItem(`usb_notice_ack_${activePopupNotice.id}`, 'true');
      setActivePopupNotice(null);
    }
  };

  // Launch prefilled report form from LIVE schedule
  const handleStartReportWithFlight = (flt: ScheduleFlight) => {
    const todayStr = new Date()
      .toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' })
      .toUpperCase()
      .replace(/ /g, ' ');

    const newFormData: RampReportFormData = {
      date: flt.dateStr ? `${flt.dateStr} 26` : todayStr,
      ac: flt.aircraft || '',
      bay: '25',
      arvFlt: flt.isDeparture ? '' : flt.flightNum,
      arvRoute: flt.isDeparture ? '' : `${flt.sector}-DAC`,
      con: '',
      do: '',
      disem: '',
      deptFlt: flt.isDeparture ? flt.flightNum : '',
      deptRoute: flt.isDeparture ? `DAC-${flt.sector}` : '',
      std: flt.isDeparture ? flt.timeStr.replace(':', '') : '',
      dc: '',
      co: '',
      ab: '',
      status: 'ON TIME',
      securitySt: '',
      securityEnd: '',
      cleaningSt: '',
      cleaningEnd: '',
      cateringSt: '',
      cateringEnd: '',
      crew: '',
      refuel: '',
      lbag: '',
      permit: '',
      pax: flt.paxLoad || '',
      trimSigned: '',
      ground: '30',
      station: user ? user.station : 'DAC'
    };

    setReportToEdit({
      id: `report-prefill-${Date.now()}`,
      type: 'DOMESTIC',
      mode: 'ROUND',
      flight: `BS-${flt.flightNum}`,
      date: newFormData.date,
      route: newFormData.deptRoute || 'N/A',
      timestamp: new Date().toISOString(),
      formData: newFormData,
      officerName: user ? user.name : 'OFFICER',
      officerId: user ? user.id : '0000'
    });

    setReportType('DOMESTIC');
    setActiveTab('form');
    showToast(`Form Created for Flight ${flt.flightFull}`, `Sector: ${flt.sector}`, 'info');
  };

  // Navigation handlers
  const handleStartReport = (type: ReportType) => {
    setReportType(type);
    setReportToEdit(null);
    setActiveTab('form');
  };

  const handleEditReport = (id: string) => {
    const report = savedReports.find((r) => r.id === id);
    if (report) {
      setReportToEdit(report);
      setReportType(report.type);
      setActiveTab('form');
    }
  };

  const handleDeleteReport = async (id: string) => {
    if (window.confirm('Are you sure you want to delete this report?')) {
      const targetReport = savedReports.find((r) => r.id === id);
      setSavedReports((prev) => prev.filter((r) => r.id !== id));
      try {
        await deleteReportFromFirestore(id);
        logUserAction(
          'DELETE_REPORT',
          `Deleted report ${targetReport ? targetReport.flight : id}`
        );
      } catch (e) {
        console.error('Delete from cloud failed:', e);
      }
      showToast('Report deleted', '', 'info');
    }
  };

  const handleNewReport = () => {
    try {
      localStorage.removeItem('usb_ramp_report_draft');
      localStorage.removeItem('usb_report_to_edit');
    } catch (e) {}
    setReportToEdit(null);
    setActiveTab('form');
    showToast('New report form initialized', '', 'info');
  };

  // Save Report Action -> Syncs to Firestore in real time with partial data preservation
  const handleSaveReport = async (
    data: RampReportFormData,
    type: ReportType,
    mode: FlightMode,
    existingId?: string
  ) => {
    const activeUser = user || {
      id: '0000',
      name: 'RAMP OFFICER',
      station: data.station || 'DAC',
      pin: '0000',
      role: 'OFFICER' as const
    };

    if (!data.deptFlt && !data.arvFlt) {
      showToast('Flight Number Required', 'Enter Departure or Arrival Flight Number', 'error');
      return;
    }

    try {
      localStorage.removeItem('usb_ramp_report_draft');
      localStorage.removeItem('usb_report_to_edit');
    } catch (e) {}
    setReportToEdit(null);

    const targetFlightClean = (data.deptFlt || '').replace(/^BS-?/i, '').trim().toUpperCase();
    const flightKey = `BS-${targetFlightClean}`;

    // Find existing report by existingId OR by flight number so same flight updates in place
    const existingReport = existingId
      ? savedReports.find((r) => r.id === existingId)
      : savedReports.find((r) => {
          const rFltClean = (r.flight || r.formData?.deptFlt || '')
            .replace(/^BS-?/i, '')
            .trim()
            .toUpperCase();
          return rFltClean === targetFlightClean;
        });

    const id = existingReport ? existingReport.id : (existingId || `report-${Date.now()}`);

    // Merge existing formData with new updates, removing empty string overwrites if existing had data
    const mergedFormData: RampReportFormData = existingReport
      ? {
          ...existingReport.formData,
          ...data,
          station: activeUser.station
        }
      : { ...data, station: activeUser.station };

    // Clean undefined or empty overrides if existing had value
    if (existingReport) {
      Object.keys(existingReport.formData).forEach((key) => {
        const k = key as keyof RampReportFormData;
        if ((!data[k] || data[k] === '') && existingReport.formData[k]) {
          mergedFormData[k] = existingReport.formData[k];
        }
      });
    }

    let resolvedType = type;
    const cleanNum = parseInt(targetFlightClean, 10);
    if (cleanNum && !isNaN(cleanNum)) {
      if ((cleanNum >= 100 && cleanNum <= 199) || (cleanNum >= 500 && cleanNum <= 599)) {
        resolvedType = 'DOMESTIC';
      } else if (cleanNum >= 200 && cleanNum <= 499) {
        resolvedType = 'INTERNATIONAL';
      }
    }

    const newEntry: SavedReport = {
      id,
      type: resolvedType,
      mode,
      flight: flightKey,
      date: data.date || existingReport?.date || '',
      route: data.deptRoute || existingReport?.route || 'N/A',
      timestamp: new Date().toISOString(),
      officerName: activeUser.name || existingReport?.officerName || 'RAMP OFFICER',
      officerId: activeUser.id || existingReport?.officerId || '0000',
      formData: mergedFormData
    };

    setSavedReports((prev) => {
      const filtered = prev.filter((r) => {
        const rFltClean = (r.flight || r.formData?.deptFlt || '')
          .replace(/^BS-?/i, '')
          .trim()
          .toUpperCase();
        return r.id !== id && rFltClean !== targetFlightClean;
      });
      return [newEntry, ...filtered];
    });

    try {
      await syncReportToFirestore(newEntry);
      showToast(
        existingId ? 'Report Updated & Synced Live!' : 'Report Saved & Synced Live!',
        `${newEntry.flight} (${newEntry.route})`,
        'success'
      );
      logUserAction(
        'SAVE_REPORT',
        `${existingId ? 'Updated' : 'Saved'} turnaround report for ${newEntry.flight} (${newEntry.route})`
      );

      // Auto-update 30-Day Daily Analytical Snapshot in Firestore Backend Storage
      try {
        const targetDateIso = parseDateToIso(newEntry.date || newEntry.formData?.date);
        const updatedList = [
          newEntry,
          ...savedReports.filter((r) => {
            const rFltClean = (r.flight || r.formData?.deptFlt || '')
              .replace(/^BS-?/i, '')
              .trim()
              .toUpperCase();
            return r.id !== id && rFltClean !== targetFlightClean;
          })
        ];

        const reportsForDate = updatedList.filter((r) => {
          const rDateIso = parseDateToIso(r.date || r.formData?.date);
          return rDateIso === targetDateIso;
        });

        const snapshotPayload = buildDailyAnalyticalSnapshot(
          reportsForDate,
          targetDateIso,
          activeUser.station || 'DAC',
          { name: activeUser.name || 'RAMP OFFICER', id: activeUser.id || '0000' }
        );

        await saveDailyAnalyticalSnapshotToFirestore(snapshotPayload);

        // Check if all scheduled departure flights for today are completed
        const departureFlights = scheduleFlights.filter((f) => f.isDeparture !== false);
        const targetCount = departureFlights.length > 0 ? departureFlights.length : 41;

        if (reportsForDate.length >= targetCount) {
          showToast(
            'Daily Flight Schedule Completed!',
            `All ${reportsForDate.length}/${targetCount} flights completed & auto-archived in 30-Day Backend Storage`,
            'success'
          );
          logUserAction(
            'OTHER',
            `Auto-archived full daily snapshot (${snapshotPayload.dateDisplay}, ${reportsForDate.length} flights) to 30-day backend storage`
          );
        }
      } catch (snapErr) {
        console.error('Auto daily analytical snapshot save error:', snapErr);
      }
    } catch (e) {
      console.error('Sync failed:', e);
      showToast('Report Saved Locally', 'Will sync when online', 'info');
    }
  };

  // Trigger Download JPG
  const handleDownloadJPG = (
    data: RampReportFormData,
    type: ReportType,
    mode: FlightMode
  ) => {
    if (!data.deptFlt || !data.std) {
      showToast('Flight Number & STD Required', 'Enter STD to download JPG report', 'error');
      return;
    }

    setIsExporting(true);
    setRenderExportTarget({ formData: data, type, mode });
  };

  const handleDownloadFromSaved = (report: SavedReport) => {
    setIsExporting(true);
    setRenderExportTarget({
      formData: report.formData,
      type: report.type,
      mode: report.mode
    });
  };

  // JPG Render Completion
  const handleCaptureComplete = (dataUrl: string) => {
    if (!renderExportTarget || !user) return;

    const rawFlt = (renderExportTarget.formData.deptFlt || renderExportTarget.formData.arrFlt || 'REPORT').replace(/^BS-?/i, '').trim().toUpperCase();
    const fltNo = rawFlt ? `BS-${rawFlt}` : 'BS-FLIGHT';
    const routeStr = (renderExportTarget.formData.deptRoute || renderExportTarget.formData.route || renderExportTarget.formData.arrRoute || '').trim().toUpperCase();

    const fileName = routeStr ? `${fltNo} (${routeStr}).jpg` : `${fltNo}.jpg`;

    // Attempt direct download anchor trigger
    try {
      const link = document.createElement('a');
      link.download = fileName;
      link.href = dataUrl;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (e) {
      console.error('Direct download click exception:', e);
    }

    // Always open DownloadModal for iOS Safari/Chrome, WebViews, and desktop share
    setDownloadModalTarget({ dataUrl, fileName });

    setIsExporting(false);
    setRenderExportTarget(null);
    showToast('JPG Report Ready!', fileName, 'success');
  };

  const handleCaptureError = (err: any) => {
    console.error('Canvas capture failed:', err);
    setIsExporting(false);
    setRenderExportTarget(null);
    showToast('Download Error', 'Failed to generate JPG image. Retry.', 'error');
  };

  if (!user) {
    return <LoginModal onLogin={handleLogin} />;
  }

  return (
    <div className={`min-h-screen flex flex-col font-sans select-none antialiased transition-colors ${
      isDarkMode ? 'bg-slate-950 text-slate-100' : 'bg-slate-100 text-slate-900'
    }`}>
      {/* App Navigation Header */}
      <Header
        user={user}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onLogout={handleLogout}
        onStationChange={handleStationChange}
        isDarkMode={isDarkMode}
        onToggleTheme={handleToggleTheme}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-md w-full mx-auto p-3 sm:p-4">
        {/* TAB 1: LIVE MONITOR */}
        {activeTab === 'live' && (
          <LiveMonitor
            user={user}
            scheduleFlights={scheduleFlights}
            scheduleDate={scheduleDate}
            notices={notices}
            onStartReportWithFlight={handleStartReportWithFlight}
            onStartReport={handleStartReport}
            isDarkMode={isDarkMode}
            isAdmin={user?.id === '1425' || sessionStorage.getItem('usb_admin_unlocked_pin') === '11126'}
            onDeleteNotice={handleDeleteNotice}
          />
        )}

        {/* TAB 2: NEW REPORT FORM */}
        {activeTab === 'form' && (
          <ReportForm
            user={user}
            initialType={reportType}
            reportToEdit={reportToEdit}
            onSaveReport={handleSaveReport}
            onDownloadJPG={handleDownloadJPG}
            onNewReport={handleNewReport}
            isDarkMode={isDarkMode}
          />
        )}

        {/* TAB 3: SAVED REPORTS */}
        {activeTab === 'saved' && (
          <SavedReports
            savedReports={savedReports}
            onEditReport={handleEditReport}
            onDeleteReport={handleDeleteReport}
            onDownloadJPG={handleDownloadFromSaved}
            isDarkMode={isDarkMode}
          />
        )}

        {/* TAB 4: ADMIN SECTION */}
        {activeTab === 'admin' && (
          <AdminSection
            user={user}
            scheduleFlights={scheduleFlights}
            scheduleDate={scheduleDate}
            userLogs={userLogs}
            notices={notices}
            savedReports={savedReports}
            onUpdateSchedule={handleUpdateSchedule}
            onBroadcastNotice={handleBroadcastNotice}
            onDeleteNotice={handleDeleteNotice}
            showToast={showToast}
          />
        )}
      </main>

      {/* SPECIAL NOTICE POPUP MODAL FOR OFFICERS */}
      {activePopupNotice && (
        <NoticeModal
          notice={activePopupNotice}
          onClose={handleAcknowledgeNotice}
          isDarkMode={isDarkMode}
          isAdmin={user?.id === '1425' || sessionStorage.getItem('usb_admin_unlocked_pin') === '11126'}
          onDeleteNotice={handleDeleteNotice}
        />
      )}

      {/* Mobile Bottom Navigation */}
      <MobileBottomNav
        user={user}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        savedCount={savedReports.length}
        isDarkMode={isDarkMode}
      />

      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-50 w-full max-w-xs px-2 animate-bounce-short">
          <div
            className={`p-3 rounded-2xl border shadow-2xl backdrop-blur-md flex items-center justify-between gap-3 ${
              toastMessage.type === 'error'
                ? 'bg-red-950/95 border-red-500/50 text-red-200'
                : toastMessage.type === 'info'
                ? 'bg-blue-950/95 border-blue-500/50 text-blue-200'
                : 'bg-emerald-950/95 border-emerald-500/50 text-emerald-200'
            }`}
          >
            <div className="flex items-center gap-2.5">
              {toastMessage.type === 'error' ? (
                <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
              ) : (
                <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0" />
              )}
              <div>
                <p className="text-xs font-black tracking-wide">{toastMessage.title}</p>
                {toastMessage.subtitle && (
                  <p className="text-[10px] opacity-80 font-mono mt-0.5">{toastMessage.subtitle}</p>
                )}
              </div>
            </div>

            <button
              onClick={() => setToastMessage(null)}
              className="p-1 rounded-lg hover:bg-white/10 text-slate-400"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Export Loading Overlay & Offscreen Canvas */}
      {isExporting && renderExportTarget && (
        <>
          <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex flex-col items-center justify-center">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/20 border border-amber-400/40 flex items-center justify-center text-amber-400 animate-spin mb-3">
              <RefreshCw className="w-6 h-6" />
            </div>
            <p className="text-xs font-black uppercase text-amber-300 tracking-wider">
              GENERATING JPG REPORT...
            </p>
            <p className="text-[10px] text-slate-400 font-mono mt-1">Please wait while downloading image</p>
          </div>

          <ReportCanvasCard
            formData={renderExportTarget.formData}
            type={renderExportTarget.type}
            mode={renderExportTarget.mode}
            user={user}
            onCaptureComplete={handleCaptureComplete}
            onCaptureError={handleCaptureError}
          />
        </>
      )}

      {/* Download Modal for iOS / Mobile / Web Share */}
      {downloadModalTarget && (
        <DownloadModal
          isOpen={!!downloadModalTarget}
          onClose={() => setDownloadModalTarget(null)}
          dataUrl={downloadModalTarget.dataUrl}
          fileName={downloadModalTarget.fileName}
          isDarkMode={isDarkMode}
        />
      )}
    </div>
  );
}
