import React, { useState, useEffect } from 'react';
import {
  UserProfile,
  SavedReport,
  ReportType,
  FlightMode,
  RampReportFormData,
  StationCode,
  ActiveTab,
  ScheduleFlight
} from './types';
import { initialSampleReports } from './data/routesDB';
import { parseFLSTData, sampleFLSTInput } from './utils/flstParser';
import {
  subscribeToSavedReports,
  syncReportToFirestore,
  deleteReportFromFirestore,
  subscribeToSchedule,
  syncScheduleToFirestore
} from './lib/firebase';
import { Header } from './components/Header';
import { MobileBottomNav } from './components/MobileBottomNav';
import { LiveMonitor } from './components/LiveMonitor';
import { ReportForm } from './components/ReportForm';
import { SavedReports } from './components/SavedReports';
import { AdminSection } from './components/AdminSection';
import { LoginModal } from './components/LoginModal';
import { ReportCanvasCard } from './components/ReportCanvasCard';
import { CheckCircle2, AlertCircle, RefreshCw, X, Wifi } from 'lucide-react';

export default function App() {
  // LocalStorage User Session
  const [user, setUser] = useState<UserProfile | null>(() => {
    try {
      const saved = localStorage.getItem('usb_user');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  // Saved Reports state with Firebase real-time sync
  const [savedReports, setSavedReports] = useState<SavedReport[]>(() => {
    try {
      const saved = localStorage.getItem('usb_reports');
      return saved ? JSON.parse(saved) : initialSampleReports;
    } catch {
      return initialSampleReports;
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

  // Active Tab: 'live' | 'form' | 'saved' | 'admin'
  const [activeTab, setActiveTab] = useState<ActiveTab>('live');

  // Form Initial Sector Mode & Report to Edit
  const [reportType, setReportType] = useState<ReportType>('DOMESTIC');
  const [reportToEdit, setReportToEdit] = useState<SavedReport | null>(null);

  // Toast Modal State
  const [toastMessage, setToastMessage] = useState<{ title: string; subtitle?: string; type: 'success' | 'info' | 'error' } | null>(null);

  // JPG Export Render Trigger
  const [renderExportTarget, setRenderExportTarget] = useState<{
    formData: RampReportFormData;
    type: ReportType;
    mode: FlightMode;
  } | null>(null);

  const [isExporting, setIsExporting] = useState(false);

  // Subscribe to Firebase Firestore real-time updates for Saved Reports & Schedules
  useEffect(() => {
    const unsubReports = subscribeToSavedReports((reports) => {
      if (reports && reports.length > 0) {
        setSavedReports(reports);
        localStorage.setItem('usb_reports', JSON.stringify(reports));
      } else {
        // If Firestore reports empty, upload initial sample reports
        initialSampleReports.forEach((rep) => {
          syncReportToFirestore(rep).catch(() => {});
        });
      }
      setIsLiveConnected(true);
    }, () => setIsLiveConnected(false));

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

    return () => {
      unsubReports();
      unsubSchedule();
    };
  }, []);

  // Handle Login
  const handleLogin = (newUser: UserProfile) => {
    setUser(newUser);
    localStorage.setItem('usb_user', JSON.stringify(newUser));
    showToast(`Welcome, Officer ${newUser.name}`, `Station: ${newUser.station}`, 'success');
  };

  // Handle Logout
  const handleLogout = () => {
    showToast('Logged out successfully', 'Thank you Officer!', 'info');
    setTimeout(() => {
      localStorage.removeItem('usb_user');
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
    } catch (e) {
      console.error('Error saving schedule:', e);
      showToast('Updated locally', 'Cloud sync will retry automatically', 'info');
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
      setSavedReports((prev) => prev.filter((r) => r.id !== id));
      try {
        await deleteReportFromFirestore(id);
      } catch (e) {
        console.error('Delete from cloud failed:', e);
      }
      showToast('Report deleted', '', 'info');
    }
  };

  const handleNewReport = () => {
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
    if (!user) return;

    if (!data.deptFlt) {
      showToast('Flight Number Required', 'Enter Departure Flight Number (e.g. 101)', 'error');
      return;
    }

    const id = existingId || `report-${Date.now()}`;

    // Find existing report to merge data safely so no field is lost during incremental edits
    const existingReport = savedReports.find((r) => r.id === id);

    // Merge existing formData with new updates, removing empty string overwrites if existing had data
    const mergedFormData: RampReportFormData = existingReport
      ? {
          ...existingReport.formData,
          ...data,
          station: user.station
        }
      : { ...data, station: user.station };

    // Clean undefined or empty overrides if existing had value
    if (existingReport) {
      Object.keys(existingReport.formData).forEach((key) => {
        const k = key as keyof RampReportFormData;
        if ((!data[k] || data[k] === '') && existingReport.formData[k]) {
          mergedFormData[k] = existingReport.formData[k];
        }
      });
    }

    const newEntry: SavedReport = {
      id,
      type,
      mode,
      flight: `BS-${data.deptFlt}`,
      date: data.date || existingReport?.date || '',
      route: data.deptRoute || existingReport?.route || 'N/A',
      timestamp: new Date().toISOString(),
      officerName: user.name || existingReport?.officerName || 'RAMP OFFICER',
      officerId: user.id || existingReport?.officerId || '0000',
      formData: mergedFormData
    };

    setSavedReports((prev) => {
      const idx = prev.findIndex((r) => r.id === id);
      if (idx >= 0) {
        const copy = [...prev];
        copy[idx] = newEntry;
        return copy;
      }
      return [newEntry, ...prev];
    });

    try {
      await syncReportToFirestore(newEntry);
      showToast(
        existingId ? 'Report Updated & Synced Live!' : 'Report Saved & Synced Live!',
        `${newEntry.flight} (${newEntry.route})`,
        'success'
      );
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

    const link = document.createElement('a');
    link.download = `RAMP_${user.station}_BS${renderExportTarget.formData.deptFlt}.jpg`;
    link.href = dataUrl;
    link.click();

    setIsExporting(false);
    setRenderExportTarget(null);
    showToast('JPG Report Downloaded!', link.download, 'success');
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
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans select-none antialiased">
      {/* App Navigation Header */}
      <Header
        user={user}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onLogout={handleLogout}
        onStationChange={handleStationChange}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-md w-full mx-auto p-3 sm:p-4">
        {/* TAB 1: LIVE MONITOR */}
        {activeTab === 'live' && (
          <LiveMonitor
            user={user}
            scheduleFlights={scheduleFlights}
            scheduleDate={scheduleDate}
            onStartReportWithFlight={handleStartReportWithFlight}
            onStartReport={handleStartReport}
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
          />
        )}

        {/* TAB 3: SAVED REPORTS */}
        {activeTab === 'saved' && (
          <SavedReports
            savedReports={savedReports}
            onEditReport={handleEditReport}
            onDeleteReport={handleDeleteReport}
            onDownloadJPG={handleDownloadFromSaved}
          />
        )}

        {/* TAB 4: ADMIN SECTION */}
        {activeTab === 'admin' && (
          <AdminSection
            user={user}
            scheduleFlights={scheduleFlights}
            scheduleDate={scheduleDate}
            onUpdateSchedule={handleUpdateSchedule}
            showToast={showToast}
          />
        )}
      </main>

      {/* Mobile Bottom Navigation */}
      <MobileBottomNav
        user={user}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        savedCount={savedReports.length}
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
    </div>
  );
}
