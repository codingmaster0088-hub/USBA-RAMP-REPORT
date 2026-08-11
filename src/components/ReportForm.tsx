import React, { useState, useEffect } from 'react';
import {
  Plane,
  Clock,
  Save,
  Download,
  FileText,
  Globe,
  Lock,
  Unlock,
  AlertTriangle,
  AlertCircle,
  X,
  Search,
  Check,
  CheckSquare,
  Square
} from 'lucide-react';
import {
  RampReportFormData,
  ReportType,
  FlightMode,
  UserProfile,
  SavedReport
} from '../types';
import {
  lookupRoute,
  formatAircraftReg,
  calculateFlightStatus,
  calculateGroundTime
} from '../data/routesDB';
import { DELAY_CODES } from '../constants/delayCodes';

const DRAFT_KEY = 'usb_ramp_report_draft';

interface ReportFormProps {
  user: UserProfile;
  initialType: ReportType;
  reportToEdit: SavedReport | null;
  onSaveReport: (data: RampReportFormData, type: ReportType, mode: FlightMode, reportId?: string) => void;
  onDownloadJPG: (data: RampReportFormData, type: ReportType, mode: FlightMode) => void;
  onNewReport: () => void;
  isDarkMode?: boolean;
}

export const ReportForm: React.FC<ReportFormProps> = ({
  user,
  initialType,
  reportToEdit,
  onSaveReport,
  onDownloadJPG,
  onNewReport,
  isDarkMode = false
}) => {
  const [draftRestoredAt, setDraftRestoredAt] = useState<string | null>(() => {
    if (reportToEdit) return null;
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && parsed.savedAt) {
          const d = new Date(parsed.savedAt);
          return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + ' LT';
        }
      }
    } catch (e) {}
    return null;
  });

  const [reportType, setReportType] = useState<ReportType>(() => {
    if (reportToEdit) return reportToEdit.type;
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && parsed.reportType) return parsed.reportType;
      }
    } catch (e) {}
    return initialType;
  });

  const [flightMode, setFlightMode] = useState<FlightMode>(() => {
    if (reportToEdit) return reportToEdit.mode;
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && parsed.flightMode) return parsed.flightMode;
      }
    } catch (e) {}
    return 'ROUND';
  });

  const getInitialFormData = (userStation: string): RampReportFormData => {
    const todayStr = new Date()
      .toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' })
      .toUpperCase();

    return {
      date: todayStr,
      ac: '',
      bay: '',
      docin: '',
      docout: '',
      arvFlt: '',
      arvRoute: '',
      con: '',
      do: '',
      disem: '',
      deptFlt: '',
      deptRoute: '',
      std: '',
      dc: '',
      co: '',
      ab: '',
      status: '',
      delayReason: '',
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
      pax: '',
      trimSubmitted: '',
      trimSigned: '',
      priorityBag: '',
      vipBag: '',
      offloadBag: '',
      ground: '',
      station: userStation as any
    };
  };

  // Initial Form State
  const [formData, setFormData] = useState<RampReportFormData>(() => {
    if (reportToEdit) return reportToEdit.formData;

    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && parsed.formData) {
          return parsed.formData;
        }
      }
    } catch (e) {}

    return getInitialFormData(user.station);
  });

  const [skippedModalOpen, setSkippedModalOpen] = useState<boolean>(false);
  const [skippedFieldsList, setSkippedFieldsList] = useState<string[]>([]);
  const [delaySearch, setDelaySearch] = useState<string>('');

  // Parse currently selected delay codes array from formData.delayReason string
  const selectedDelayCodes = formData.delayReason
    ? formData.delayReason.split('; ').map((s) => s.trim()).filter(Boolean)
    : [];

  const toggleDelayCode = (code: string) => {
    let updated: string[];
    if (selectedDelayCodes.includes(code)) {
      updated = selectedDelayCodes.filter((c) => c !== code);
    } else {
      updated = [...selectedDelayCodes, code];
    }
    handleChange('delayReason', updated.join('; '));
  };

  useEffect(() => {
    if (reportToEdit) {
      setFormData(reportToEdit.formData);
      setReportType(reportToEdit.type);
      setFlightMode(reportToEdit.mode);
    }
  }, [reportToEdit]);

  // Continuous auto-save draft to localStorage whenever formData, reportType, or flightMode changes
  useEffect(() => {
    if (reportToEdit) return;
    const draftPayload = {
      formData,
      reportType,
      flightMode,
      savedAt: Date.now()
    };
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify(draftPayload));
    } catch (e) {
      console.error('Failed to save draft:', e);
    }
  }, [formData, reportType, flightMode, reportToEdit]);

  // Save draft immediately when switching apps (visibilitychange / blur / beforeunload)
  useEffect(() => {
    const saveCurrentDraft = () => {
      if (reportToEdit) return;
      const draftPayload = {
        formData,
        reportType,
        flightMode,
        savedAt: Date.now()
      };
      try {
        localStorage.setItem(DRAFT_KEY, JSON.stringify(draftPayload));
      } catch (e) {}
    };

    const handleVisibilityChange = () => {
      saveCurrentDraft();
    };

    window.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('blur', saveCurrentDraft);
    window.addEventListener('beforeunload', saveCurrentDraft);

    return () => {
      window.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('blur', saveCurrentDraft);
      window.removeEventListener('beforeunload', saveCurrentDraft);
    };
  }, [formData, reportType, flightMode, reportToEdit]);

  const clearDraft = () => {
    try {
      localStorage.removeItem(DRAFT_KEY);
      setDraftRestoredAt(null);
    } catch (e) {}
  };

  const handleResetForm = () => {
    if (window.confirm('Clear all filled form fields and start a new blank report?')) {
      clearDraft();
      setFormData(getInitialFormData(user.station));
      setFlightMode('ROUND');
      setReportType('DOMESTIC');
      onNewReport();
    }
  };

  // Gate/Bay editability rule for International
  // If gate number has a letter after digits (e.g., C1A, C2A), DOC IN & DOC OUT are NOT editable
  const hasLetterAfterNumber = /\d+[A-Za-z]/.test((formData.bay || '').trim());
  const isDocEditable = reportType === 'INTERNATIONAL' && !hasLetterAfterNumber;

  // Validate all required fields
  const getSkippedFields = (): string[] => {
    const skipped: string[] = [];

    // General Info
    if (!formData.date.trim()) skipped.push('DATE');
    if (!formData.bay.trim()) skipped.push(reportType === 'INTERNATIONAL' ? 'GATE NO' : 'BAY NO');
    if (!formData.ac.trim()) skipped.push('AIRCRAFT REGISTRATION (A/C REG)');

    if (reportType === 'INTERNATIONAL' && isDocEditable) {
      if (!formData.docin?.trim()) skipped.push('DOC IN (LT)');
      if (!formData.docout?.trim()) skipped.push('DOC OUT (LT)');
    }

    // Arrival Info if ROUND
    if (flightMode === 'ROUND') {
      if (!formData.arvFlt.trim()) skipped.push('ARR FLIGHT (ARV FLT)');
      if (!formData.arvRoute.trim()) skipped.push('ARR ROUTE');
      if (!formData.con.trim()) skipped.push('C/ON (LT)');
      if (!formData.do.trim()) skipped.push('D/O (LT)');
      if (!formData.disem.trim()) skipped.push('ALL DISEM');
    }

    // Departure Info
    if (!formData.deptFlt.trim()) skipped.push('DEPT FLIGHT (BS-)');
    if (!formData.deptRoute.trim()) skipped.push('DEPT ROUTE');
    if (!formData.std.trim()) skipped.push('STD (LT)');
    if (!formData.dc.trim()) skipped.push('D/C (LT)');
    if (!formData.co.trim()) skipped.push('C/OFF (LT)');
    if (!formData.ab.trim()) skipped.push('A/B (LT)');

    // Turnaround Milestones (13 fields)
    if (!formData.securitySt?.trim()) skipped.push('1. SECURITY CHECK ST');
    if (!formData.securityEnd?.trim()) skipped.push('2. SECURITY CHECK END');
    if (!formData.cleaningSt?.trim()) skipped.push('3. CLEANING START');
    if (!formData.cleaningEnd?.trim()) skipped.push('4. CLEANING END');
    if (!formData.cateringSt?.trim()) skipped.push('5. CATERING START');
    if (!formData.cateringEnd?.trim()) skipped.push('6. CATERING END');
    if (!formData.crew.trim()) skipped.push('7. CREW REPORT');
    if (!formData.refuel.trim()) skipped.push('8. REFUELING DONE');
    if (!formData.lbag.trim()) skipped.push('9. LAST BAGGAGE REPORT');
    if (!formData.permit.trim()) skipped.push('10. BOARDING PERMITTED');
    if (!formData.pax.trim()) skipped.push('11. LAST PAX ONBOARD');
    if (!formData.trimSubmitted?.trim()) skipped.push('12. TRIM SUBMITTED');
    if (!formData.trimSigned?.trim()) skipped.push('13. TRIM SIGNED');

    // Delay Reason if Flight Status is strictly DELAY
    const statusUpper = (formData.status || '').toUpperCase();
    const isDelayedStatus =
      statusUpper.includes('DELAY') &&
      !statusUpper.includes('EARLY') &&
      !statusUpper.includes('ON TIME') &&
      !statusUpper.includes('ON-TIME');

    if (isDelayedStatus) {
      if (!formData.delayReason?.trim()) {
        skipped.push('DELAY REASON / DELAY CODE (MANDATORY FOR DELAYED FLIGHTS)');
      }
    }

    return skipped;
  };

  const handleSaveAttempt = () => {
    const skipped = getSkippedFields();
    if (skipped.length > 0) {
      setSkippedFieldsList(skipped);
      setSkippedModalOpen(true);
      return;
    }
    clearDraft();
    onSaveReport(formData, reportType, flightMode, reportToEdit?.id);
  };

  const handleDownloadAttempt = () => {
    const skipped = getSkippedFields();
    if (skipped.length > 0) {
      setSkippedFieldsList(skipped);
      setSkippedModalOpen(true);
      return;
    }
    clearDraft();
    // Automatically save report with modified data when download is clicked
    onSaveReport(formData, reportType, flightMode, reportToEdit?.id);
    onDownloadJPG(formData, reportType, flightMode);
  };

  // Handle Field Changes
  const handleChange = (field: keyof RampReportFormData, value: string) => {
    const updated = { ...formData, [field]: value.toUpperCase() };

    // Auto Route Lookup
    if (field === 'arvFlt') {
      const route = lookupRoute(value);
      if (route) updated.arvRoute = route;
    } else if (field === 'deptFlt') {
      const route = lookupRoute(value);
      if (route) updated.deptRoute = route;
    }

    // Auto Flight Status
    if (field === 'std' || field === 'co') {
      const statusRes = calculateFlightStatus(
        field === 'std' ? value : updated.std,
        field === 'co' ? value : updated.co
      );
      updated.status = statusRes.text;
    }

    // Auto Ground Time (Calculated from Arrival Door Open 'do' to Departure C/OFF 'co')
    if (field === 'do' || field === 'co' || field === 'con') {
      if (flightMode === 'ROUND') {
        const doorOpenTime = field === 'do' ? value : (updated.do || updated.con);
        const cOffTime = field === 'co' ? value : updated.co;
        if (doorOpenTime && cOffTime) {
          const gt = calculateGroundTime(doorOpenTime, cOffTime);
          updated.ground = gt;
        }
      }
    }

    setFormData(updated);
  };

  // Helper: Set Current Time (LT format HHMM e.g. 1435)
  const setNowTime = (field: keyof RampReportFormData) => {
    const now = new Date();
    const hh = String(now.getHours()).padStart(2, '0');
    const mm = String(now.getMinutes()).padStart(2, '0');
    handleChange(field, `${hh}${mm}`);
  };

  // Helper: Set OB Preset
  const setOBPreset = (field: keyof RampReportFormData) => {
    handleChange(field, 'OB');
  };

  // Helper: Set E (EARLIER) Preset
  const setEPreset = (field: keyof RampReportFormData) => {
    const currentVal = formData[field] || '';
    handleChange(field, currentVal === 'EARLIER' ? '' : 'EARLIER');
  };

  // Aircraft Registration Formatter on Blur
  const handleRegBlur = () => {
    if (formData.ac) {
      const formatted = formatAircraftReg(formData.ac);
      setFormData((prev) => ({ ...prev, ac: formatted }));
    }
  };

  return (
    <div className="space-y-4 pb-24 fade-in">
      {/* Draft Auto-Saved & Restored Notice Banner */}
      {draftRestoredAt && !reportToEdit && (
        <div
          className={`rounded-2xl p-3.5 border shadow-lg flex items-center justify-between gap-3 ${
            isDarkMode
              ? 'bg-gradient-to-r from-emerald-950/80 via-slate-900 to-emerald-950/80 border-emerald-500/40 text-emerald-200'
              : 'bg-emerald-50 border-2 border-emerald-500 text-emerald-950 shadow-emerald-100'
          }`}
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="relative flex h-3 w-3 shrink-0">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
            </span>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="font-black text-xs uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                  ⚡ DRAFT AUTO-RESTORED
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 font-mono font-bold">
                  {draftRestoredAt}
                </span>
              </div>
              <p className="text-[11px] opacity-90 leading-tight mt-0.5 font-medium">
                Your entries were automatically saved when you left the app (e.g. WhatsApp). All fields are preserved!
              </p>
            </div>
          </div>
          <button
            onClick={handleResetForm}
            className="px-2.5 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-white text-[10px] font-black uppercase tracking-wider active:scale-95 transition-all cursor-pointer shrink-0 border border-red-500 shadow-sm"
          >
            CLEAR DRAFT
          </button>
        </div>
      )}

      {/* Flight Type & Route Mode Selector */}
      <div
        className={`space-y-3 rounded-2xl p-3.5 shadow-lg border ${
          isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-300 shadow-slate-200'
        }`}
      >
        <div className="flex items-center justify-between mb-1">
          <h2
            className={`text-xs font-black uppercase tracking-wider flex items-center gap-1.5 ${
              isDarkMode ? 'text-white' : 'text-slate-900'
            }`}
          >
            <FileText className="w-4 h-4 text-amber-500" />
            1. SELECT FLIGHT TYPE
          </h2>
          <div className="flex items-center gap-2">
            <span className="hidden sm:inline-flex items-center gap-1 text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              Real-time auto-saving
            </span>
            <button
              onClick={handleResetForm}
              className={`text-[10px] font-black px-2.5 py-1 rounded-lg border active:scale-95 transition-all cursor-pointer ${
                isDarkMode
                  ? 'bg-slate-800 hover:bg-slate-700 text-amber-300 border-slate-700'
                  : 'bg-amber-100 hover:bg-amber-200 text-amber-900 border-amber-300'
              }`}
            >
              RESET FORM
            </button>
          </div>
        </div>

        {/* Domestic vs International Selector */}
        <div className="grid grid-cols-2 gap-2 bg-slate-950 p-1 rounded-xl border border-slate-800">
          <button
            onClick={() => setReportType('DOMESTIC')}
            className={`py-2.5 rounded-lg text-xs font-black transition-all flex items-center justify-center gap-2 ${
              reportType === 'DOMESTIC'
                ? 'bg-gradient-to-r from-blue-700 to-indigo-800 text-white shadow-md'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Plane className="w-4 h-4 text-amber-300 transform -rotate-45" />
            DOMESTIC
          </button>
          <button
            onClick={() => setReportType('INTERNATIONAL')}
            className={`py-2.5 rounded-lg text-xs font-black transition-all flex items-center justify-center gap-2 ${
              reportType === 'INTERNATIONAL'
                ? 'bg-gradient-to-r from-amber-500 to-yellow-500 text-slate-950 shadow-md'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Globe className="w-4 h-4" />
            INTERNATIONAL
          </button>
        </div>

        {/* Direct vs Round Flight Selector */}
        <div className="pt-2 border-t border-slate-800/80 space-y-1.5">
          <label className="text-[10px] font-bold text-slate-400 uppercase block">
            2. SELECT ROUTE MODE
          </label>
          <div className="grid grid-cols-2 gap-2 bg-slate-950 p-1 rounded-xl border border-slate-800">
            <button
              onClick={() => {
                setFlightMode('ROUND');
                const doorOpenTime = formData.do || formData.con;
                if (doorOpenTime && formData.co) {
                  const gt = calculateGroundTime(doorOpenTime, formData.co);
                  setFormData((prev) => ({ ...prev, ground: gt }));
                }
              }}
              className={`py-2.5 rounded-lg text-xs font-black transition-all ${
                flightMode === 'ROUND'
                  ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              🔄 ROUND (Arrival + Departure)
            </button>
            <button
              onClick={() => {
                setFlightMode('DIRECT');
                setFormData((prev) => ({ ...prev, ground: 'ON GROUND' }));
              }}
              className={`py-2.5 rounded-lg text-xs font-black transition-all ${
                flightMode === 'DIRECT'
                  ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              ✈️ DIRECT (Departure Only)
            </button>
          </div>
        </div>
      </div>

      {/* SECTION 1: GENERAL INFO */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-3.5 shadow-md space-y-3">
        <div className="flex items-center gap-2 border-b border-slate-800 pb-2">
          <span className="w-2 h-2 rounded-full bg-amber-400" />
          <h3 className="text-xs font-bold uppercase tracking-wider text-amber-300">
            GENERAL INFORMATION
          </h3>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block">
              DATE
            </label>
            <input
              type="text"
              value={formData.date}
              onChange={(e) => handleChange('date', e.target.value)}
              placeholder="DD MMM YY"
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white font-mono focus:border-amber-400 outline-none"
            />
          </div>

          <div>
            <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block">
              {reportType === 'INTERNATIONAL' ? 'GATE NO' : 'BAY NO'}
            </label>
            <input
              type="text"
              value={formData.bay}
              onChange={(e) => handleChange('bay', e.target.value)}
              placeholder={reportType === 'INTERNATIONAL' ? 'e.g. C1 or C1A' : 'e.g. 25'}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-amber-300 font-mono font-bold focus:border-amber-400 outline-none"
            />
          </div>
        </div>

        <div>
          <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block">
            AIRCRAFT REGISTRATION (A/C REG)
          </label>
          <input
            type="text"
            value={formData.ac}
            onChange={(e) => handleChange('ac', e.target.value)}
            onBlur={handleRegBlur}
            placeholder="e.g. AKO (Formats to S2-AKO, SXA -> HS-SXA, BBG -> PK-BBG)"
            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-amber-300 font-mono font-extrabold focus:border-amber-400 outline-none"
          />
        </div>

        {/* International Extra Docs (Gate C1/C2 vs C1A/C2A logic) */}
        {reportType === 'INTERNATIONAL' && (
          <div className="pt-2 border-t border-slate-800 space-y-2">
            <div className="flex items-center justify-between text-[10px] text-slate-400 font-bold uppercase">
              <span className="flex items-center gap-1">
                {isDocEditable ? (
                  <Unlock className="w-3 h-3 text-emerald-400" />
                ) : (
                  <Lock className="w-3 h-3 text-red-400" />
                )}
                DOC IN / DOC OUT STATUS
              </span>
              <span className={isDocEditable ? 'text-emerald-400' : 'text-amber-400 font-mono'}>
                {isDocEditable
                  ? 'EDITABLE (STANDARD GATE)'
                  : 'LOCKED (LETTER GATE e.g. C1A)'}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] font-bold text-blue-300 uppercase mb-1 block">
                  DOC IN (LT)
                </label>
                <div className="relative">
                  <input
                    type="text"
                    maxLength={4}
                    disabled={!isDocEditable}
                    value={formData.docin || ''}
                    onChange={(e) => handleChange('docin', e.target.value)}
                    placeholder="0000"
                    className={`w-full border rounded-xl pl-3 pr-10 py-2 text-xs font-mono outline-none ${
                      isDocEditable
                        ? 'bg-slate-950 border-slate-800 text-white focus:border-amber-400'
                        : 'bg-slate-900/60 border-slate-800/60 text-slate-500 cursor-not-allowed'
                    }`}
                  />
                  {isDocEditable && (
                    <button
                      type="button"
                      onClick={() => setNowTime('docin')}
                      className="absolute right-1 top-1 bottom-1 px-2 text-amber-400 hover:text-amber-300 font-bold text-xs"
                    >
                      🕒
                    </button>
                  )}
                </div>
              </div>

              <div>
                <label className="text-[10px] font-bold text-blue-300 uppercase mb-1 block">
                  DOC OUT (LT)
                </label>
                <div className="relative">
                  <input
                    type="text"
                    maxLength={4}
                    disabled={!isDocEditable}
                    value={formData.docout || ''}
                    onChange={(e) => handleChange('docout', e.target.value)}
                    placeholder="0000"
                    className={`w-full border rounded-xl pl-3 pr-10 py-2 text-xs font-mono outline-none ${
                      isDocEditable
                        ? 'bg-slate-950 border-slate-800 text-white focus:border-amber-400'
                        : 'bg-slate-900/60 border-slate-800/60 text-slate-500 cursor-not-allowed'
                    }`}
                  />
                  {isDocEditable && (
                    <button
                      type="button"
                      onClick={() => setNowTime('docout')}
                      className="absolute right-1 top-1 bottom-1 px-2 text-amber-400 hover:text-amber-300 font-bold text-xs"
                    >
                      🕒
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* SECTION 2: ARRIVAL INFO (Only if Round Mode) */}
      {flightMode === 'ROUND' && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-3.5 shadow-md space-y-3">
          <div className="flex items-center gap-2 border-b border-slate-800 pb-2">
            <span className="w-2 h-2 rounded-full bg-blue-400" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-blue-300">
              ARRIVAL INFORMATION
            </h3>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block">
                ARR FLIGHT (ARV FLT)
              </label>
              <div className="relative">
                <span className="absolute left-3 top-2.5 text-xs font-extrabold text-slate-500">
                  BS-
                </span>
                <input
                  type="number"
                  value={formData.arvFlt}
                  onChange={(e) => handleChange('arvFlt', e.target.value)}
                  placeholder="121"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-xs text-amber-300 font-mono font-bold focus:border-amber-400 outline-none"
                />
              </div>
            </div>

            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block">
                ARR ROUTE
              </label>
              <input
                type="text"
                value={formData.arvRoute}
                onChange={(e) => handleChange('arvRoute', e.target.value)}
                placeholder="DAC-JSR"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white font-mono focus:border-amber-400 outline-none uppercase"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block">
                C/ON (LT)
              </label>
              <div className="relative">
                <input
                  type="text"
                  maxLength={4}
                  value={formData.con}
                  onChange={(e) => handleChange('con', e.target.value)}
                  placeholder="1300"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-2 pr-7 py-2 text-xs text-white font-mono focus:border-amber-400 outline-none"
                />
                <button
                  type="button"
                  onClick={() => setNowTime('con')}
                  className="absolute right-1 top-1 bottom-1 text-amber-400 text-xs"
                >
                  🕒
                </button>
              </div>
            </div>

            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block">
                D/O (LT)
              </label>
              <div className="relative">
                <input
                  type="text"
                  maxLength={4}
                  value={formData.do}
                  onChange={(e) => handleChange('do', e.target.value)}
                  placeholder="1305"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-2 pr-7 py-2 text-xs text-white font-mono focus:border-amber-400 outline-none"
                />
                <button
                  type="button"
                  onClick={() => setNowTime('do')}
                  className="absolute right-1 top-1 bottom-1 text-amber-400 text-xs"
                >
                  🕒
                </button>
              </div>
            </div>

            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block">
                ALL DISEM
              </label>
              <div className="relative">
                <input
                  type="text"
                  maxLength={4}
                  value={formData.disem}
                  onChange={(e) => handleChange('disem', e.target.value)}
                  placeholder="1312"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-2 pr-7 py-2 text-xs text-white font-mono focus:border-amber-400 outline-none"
                />
                <button
                  type="button"
                  onClick={() => setNowTime('disem')}
                  className="absolute right-1 top-1 bottom-1 text-amber-400 text-xs"
                >
                  🕒
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SECTION 3: DEPARTURE INFO */}
      <div className="bg-slate-900 border-2 border-amber-500/40 rounded-2xl p-3.5 shadow-xl space-y-3.5 relative overflow-hidden">
        <div className="flex items-center justify-between border-b border-slate-800 pb-2">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-pulse" />
            <h3 className="text-xs font-black uppercase tracking-wider text-amber-400">
              DEPARTURE INFORMATION
            </h3>
          </div>
          <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
            FLIGHT TIMINGS
          </span>
        </div>

        {/* Dept Flight & Route */}
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-[10px] font-bold text-amber-200 uppercase mb-1 block">
              DEPT FLIGHT (BS-) *
            </label>
            <div className="relative">
              <span className="absolute left-3 top-2.5 text-xs font-extrabold text-amber-500">
                BS-
              </span>
              <input
                type="number"
                value={formData.deptFlt}
                onChange={(e) => handleChange('deptFlt', e.target.value)}
                placeholder="122"
                className="w-full bg-slate-950 border border-amber-500/40 rounded-xl pl-9 pr-3 py-2 text-xs text-amber-300 font-mono font-extrabold focus:border-amber-400 outline-none"
              />
            </div>
          </div>

          <div>
            <label className="text-[10px] font-bold text-amber-200 uppercase mb-1 block">
              DEPT ROUTE
            </label>
            <input
              type="text"
              value={formData.deptRoute}
              onChange={(e) => handleChange('deptRoute', e.target.value)}
              placeholder="JSR-DAC"
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white font-mono font-bold focus:border-amber-400 outline-none uppercase"
            />
          </div>
        </div>

        {/* Timings: STD, D/C, C/O, A/B */}
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-[10px] font-bold text-slate-300 uppercase mb-1 block">
              STD (LT) *
            </label>
            <div className="relative">
              <input
                type="text"
                maxLength={4}
                value={formData.std}
                onChange={(e) => handleChange('std', e.target.value)}
                placeholder="1400"
                className="w-full bg-slate-950 border border-amber-500/40 rounded-xl pl-3 pr-8 py-2 text-xs text-amber-300 font-mono font-extrabold focus:border-amber-400 outline-none"
              />
              <button
                type="button"
                onClick={() => setNowTime('std')}
                className="absolute right-1 top-1 bottom-1 px-1.5 text-amber-400 text-xs"
              >
                🕒
              </button>
            </div>
          </div>

          <div>
            <label className="text-[10px] font-bold text-slate-300 uppercase mb-1 block">
              D/C (LT)
            </label>
            <div className="relative">
              <input
                type="text"
                maxLength={4}
                value={formData.dc}
                onChange={(e) => handleChange('dc', e.target.value)}
                placeholder="1355"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-3 pr-8 py-2 text-xs text-white font-mono focus:border-amber-400 outline-none"
              />
              <button
                type="button"
                onClick={() => setNowTime('dc')}
                className="absolute right-1 top-1 bottom-1 px-1.5 text-amber-400 text-xs"
              >
                🕒
              </button>
            </div>
          </div>

          <div>
            <label className="text-[10px] font-bold text-slate-300 uppercase mb-1 block">
              C/OFF (LT)
            </label>
            <div className="relative">
              <input
                type="text"
                maxLength={4}
                value={formData.co}
                onChange={(e) => handleChange('co', e.target.value)}
                placeholder="1405"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-3 pr-8 py-2 text-xs text-white font-mono focus:border-amber-400 outline-none"
              />
              <button
                type="button"
                onClick={() => setNowTime('co')}
                className="absolute right-1 top-1 bottom-1 px-1.5 text-amber-400 text-xs"
              >
                🕒
              </button>
            </div>
          </div>

          <div>
            <label className="text-[10px] font-bold text-slate-300 uppercase mb-1 block">
              A/B (LT)
            </label>
            <div className="relative">
              <input
                type="text"
                maxLength={4}
                value={formData.ab}
                onChange={(e) => handleChange('ab', e.target.value)}
                placeholder="1415"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-3 pr-8 py-2 text-xs text-white font-mono focus:border-amber-400 outline-none"
              />
              <button
                type="button"
                onClick={() => setNowTime('ab')}
                className="absolute right-1 top-1 bottom-1 px-1.5 text-amber-400 text-xs"
              >
                🕒
              </button>
            </div>
          </div>
        </div>

        {/* Status Preview & Delay Reason Box */}
        {formData.status && (
          <div className="space-y-2">
            <div
              className={`p-2.5 rounded-xl border text-center font-mono font-extrabold text-xs transition-all ${
                formData.status.includes('DELAY')
                  ? 'bg-red-950/80 border-red-500/50 text-red-300'
                  : 'bg-emerald-950/80 border-emerald-500/50 text-emerald-300'
              }`}
            >
              {formData.status}
            </div>

            {/* MULTI-SELECT CHECKBOX (TIK BOX) DELAY CODE SELECTOR FOR DELAYED FLIGHTS */}
            {formData.status.includes('DELAY') && (
              <div className="bg-red-950/60 border-2 border-red-500/70 rounded-2xl p-3.5 space-y-3 animate-in fade-in shadow-xl">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <label className="text-xs font-black text-red-200 uppercase tracking-wider flex items-center gap-1.5">
                    <AlertTriangle className="w-4 h-4 text-red-400" />
                    SELECT DELAY REASONS (CHECK / TIK BOX FOR 1, 2 OR MORE) *
                  </label>
                  {selectedDelayCodes.length > 0 && (
                    <span className="text-[11px] font-black px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 font-mono">
                      {selectedDelayCodes.length} REASON{selectedDelayCodes.length > 1 ? 'S' : ''} CHECKED
                    </span>
                  )}
                </div>

                {/* Quick Search Input */}
                <div className="relative">
                  <Search className="w-4 h-4 text-amber-400 absolute left-3 top-2.5 pointer-events-none" />
                  <input
                    type="text"
                    value={delaySearch}
                    onChange={(e) => setDelaySearch(e.target.value)}
                    placeholder="Search delay code number or keyword (e.g. 11, 23, late, cargo...)"
                    className="w-full bg-slate-950 border border-slate-700 focus:border-amber-400 rounded-xl pl-9 pr-8 py-2 text-xs text-amber-200 placeholder-slate-500 outline-none font-mono"
                  />
                  {delaySearch && (
                    <button
                      type="button"
                      onClick={() => setDelaySearch('')}
                      className="absolute right-2.5 top-2 text-slate-400 hover:text-white text-xs font-bold"
                    >
                      ✕
                    </button>
                  )}
                </div>

                {/* Checkbox (Tik Box) List */}
                <div className="max-h-64 overflow-y-auto space-y-2.5 pr-1 custom-scrollbar bg-slate-950/90 rounded-xl p-2.5 border border-slate-800">
                  {DELAY_CODES.map((group) => {
                    const filteredCodes = group.codes.filter((c) =>
                      delaySearch
                        ? c.toLowerCase().includes(delaySearch.toLowerCase()) ||
                          group.category.toLowerCase().includes(delaySearch.toLowerCase())
                        : true
                    );
                    if (filteredCodes.length === 0) return null;

                    return (
                      <div key={group.category} className="space-y-1">
                        <div className="text-[11px] font-black text-amber-400 uppercase tracking-wider bg-slate-900/90 px-2.5 py-1 rounded border-l-2 border-amber-400 font-mono sticky top-0 z-10">
                          {group.category}
                        </div>
                        <div className="space-y-1 pl-1">
                          {filteredCodes.map((code) => {
                            const isChecked = selectedDelayCodes.includes(code);
                            return (
                              <div
                                key={code}
                                onClick={() => toggleDelayCode(code)}
                                className={`flex items-start gap-2.5 p-2 rounded-lg cursor-pointer transition-all border ${
                                  isChecked
                                    ? 'bg-amber-500/20 border-amber-500/60 text-amber-100 font-bold shadow-sm'
                                    : 'bg-slate-900/40 border-slate-800/80 text-slate-300 hover:bg-slate-800/80 hover:text-white'
                                }`}
                              >
                                <div className="mt-0.5 flex-shrink-0">
                                  {isChecked ? (
                                    <div className="w-4 h-4 bg-amber-400 text-slate-950 rounded flex items-center justify-center font-black text-xs shadow-inner">
                                      ✓
                                    </div>
                                  ) : (
                                    <div className="w-4 h-4 border-2 border-slate-600 rounded bg-slate-950 hover:border-amber-400" />
                                  )}
                                </div>
                                <span className="text-xs font-sans leading-relaxed">
                                  {code}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* SELECTED CODES SUMMARY BOX */}
                {selectedDelayCodes.length > 0 ? (
                  <div className="p-3 bg-slate-950 border border-amber-500/50 rounded-xl space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-amber-400 font-black text-[11px] uppercase tracking-wider font-mono">
                        SELECTED DELAY REASONS ({selectedDelayCodes.length}):
                      </span>
                      <button
                        type="button"
                        onClick={() => handleChange('delayReason', '')}
                        className="text-[10px] text-red-400 hover:text-red-300 font-bold uppercase underline cursor-pointer"
                      >
                        CLEAR ALL
                      </button>
                    </div>

                    <div className="space-y-1.5">
                      {selectedDelayCodes.map((c, i) => (
                        <div
                          key={i}
                          className="flex items-center justify-between gap-2 p-2 bg-amber-500/15 border border-amber-500/40 rounded-lg text-xs text-amber-200"
                        >
                          <span className="font-bold text-xs leading-snug">
                            {i + 1}. {c}
                          </span>
                          <button
                            type="button"
                            onClick={() => toggleDelayCode(c)}
                            className="text-amber-400 hover:text-red-400 font-black px-1.5 py-0.5 rounded bg-slate-900 text-xs border border-amber-500/30"
                            title="Remove this code"
                          >
                            ✕
                          </button>
                        </div>
                      ))}
                    </div>

                    {/* EDITABLE TEXT AREA */}
                    <div className="pt-1">
                      <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block font-mono">
                        COMBINED DELAY REASON TEXT:
                      </label>
                      <input
                        type="text"
                        value={formData.delayReason || ''}
                        onChange={(e) => handleChange('delayReason', e.target.value)}
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-amber-200 font-mono focus:border-amber-400 outline-none"
                      />
                    </div>
                  </div>
                ) : (
                  <p className="text-[11px] text-red-300/90 italic pl-1 font-medium">
                    ⚠️ Please check (tik box) at least 1 or 2 delay reasons from the list above.
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        {/* TURNAROUND MILESTONES (16 FIELDS) */}
        <div className="space-y-2.5 pt-2 border-t border-slate-800">
          <label className="text-[10px] font-extrabold text-amber-300 uppercase tracking-wider block">
            TURNAROUND MILESTONES (16 FIELDS)
          </label>

          <div className="grid grid-cols-2 gap-2">
            {/* 1. SECURITY CHECK ST */}
            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block">
                1. SECURITY CHECK ST
              </label>
              <div className="flex gap-1">
                <button
                  type="button"
                  onClick={() => setEPreset('securitySt')}
                  className={`px-2 py-1 font-extrabold text-[10px] rounded-lg border transition-all cursor-pointer ${
                    formData.securitySt === 'EARLIER'
                      ? 'bg-amber-500 text-slate-950 border-amber-400 font-black shadow-md'
                      : 'bg-slate-800 hover:bg-slate-700 text-amber-400 border-slate-700'
                  }`}
                  title="Set status to EARLIER"
                >
                  E
                </button>
                <div className="relative flex-1">
                  <input
                    type="text"
                    value={formData.securitySt || ''}
                    onChange={(e) => handleChange('securitySt', e.target.value)}
                    placeholder="1310"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-2 pr-7 py-2 text-xs text-white font-mono focus:border-amber-400 outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setNowTime('securitySt')}
                    className="absolute right-1 top-1 bottom-1 text-amber-400 text-xs"
                  >
                    🕒
                  </button>
                </div>
              </div>
            </div>

            {/* 2. SECURITY CHECK END */}
            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block">
                2. SECURITY CHECK END
              </label>
              <div className="flex gap-1">
                <button
                  type="button"
                  onClick={() => setEPreset('securityEnd')}
                  className={`px-2 py-1 font-extrabold text-[10px] rounded-lg border transition-all cursor-pointer ${
                    formData.securityEnd === 'EARLIER'
                      ? 'bg-amber-500 text-slate-950 border-amber-400 font-black shadow-md'
                      : 'bg-slate-800 hover:bg-slate-700 text-amber-400 border-slate-700'
                  }`}
                  title="Set status to EARLIER"
                >
                  E
                </button>
                <div className="relative flex-1">
                  <input
                    type="text"
                    value={formData.securityEnd || ''}
                    onChange={(e) => handleChange('securityEnd', e.target.value)}
                    placeholder="1320"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-2 pr-7 py-2 text-xs text-white font-mono focus:border-amber-400 outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setNowTime('securityEnd')}
                    className="absolute right-1 top-1 bottom-1 text-amber-400 text-xs"
                  >
                    🕒
                  </button>
                </div>
              </div>
            </div>

            {/* 3. CLEANING START */}
            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block">
                3. CLEANING START
              </label>
              <div className="flex gap-1">
                <button
                  type="button"
                  onClick={() => setEPreset('cleaningSt')}
                  className={`px-2 py-1 font-extrabold text-[10px] rounded-lg border transition-all cursor-pointer ${
                    formData.cleaningSt === 'EARLIER'
                      ? 'bg-amber-500 text-slate-950 border-amber-400 font-black shadow-md'
                      : 'bg-slate-800 hover:bg-slate-700 text-amber-400 border-slate-700'
                  }`}
                  title="Set status to EARLIER"
                >
                  E
                </button>
                <div className="relative flex-1">
                  <input
                    type="text"
                    value={formData.cleaningSt || ''}
                    onChange={(e) => handleChange('cleaningSt', e.target.value)}
                    placeholder="1320"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-2 pr-7 py-2 text-xs text-white font-mono focus:border-amber-400 outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setNowTime('cleaningSt')}
                    className="absolute right-1 top-1 bottom-1 text-amber-400 text-xs"
                  >
                    🕒
                  </button>
                </div>
              </div>
            </div>

            {/* 4. CLEANING END */}
            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block">
                4. CLEANING END
              </label>
              <div className="flex gap-1">
                <button
                  type="button"
                  onClick={() => setEPreset('cleaningEnd')}
                  className={`px-2 py-1 font-extrabold text-[10px] rounded-lg border transition-all cursor-pointer ${
                    formData.cleaningEnd === 'EARLIER'
                      ? 'bg-amber-500 text-slate-950 border-amber-400 font-black shadow-md'
                      : 'bg-slate-800 hover:bg-slate-700 text-amber-400 border-slate-700'
                  }`}
                  title="Set status to EARLIER"
                >
                  E
                </button>
                <div className="relative flex-1">
                  <input
                    type="text"
                    value={formData.cleaningEnd || ''}
                    onChange={(e) => handleChange('cleaningEnd', e.target.value)}
                    placeholder="1328"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-2 pr-7 py-2 text-xs text-white font-mono focus:border-amber-400 outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setNowTime('cleaningEnd')}
                    className="absolute right-1 top-1 bottom-1 text-amber-400 text-xs"
                  >
                    🕒
                  </button>
                </div>
              </div>
            </div>

            {/* 5. CATERING START */}
            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block">
                5. CATERING START
              </label>
              <div className="flex gap-1">
                <button
                  type="button"
                  onClick={() => setEPreset('cateringSt')}
                  className={`px-2 py-1 font-extrabold text-[10px] rounded-lg border transition-all cursor-pointer ${
                    formData.cateringSt === 'EARLIER'
                      ? 'bg-amber-500 text-slate-950 border-amber-400 font-black shadow-md'
                      : 'bg-slate-800 hover:bg-slate-700 text-amber-400 border-slate-700'
                  }`}
                  title="Set status to EARLIER"
                >
                  E
                </button>
                <div className="relative flex-1">
                  <input
                    type="text"
                    value={formData.cateringSt || ''}
                    onChange={(e) => handleChange('cateringSt', e.target.value)}
                    placeholder="1325"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-2 pr-7 py-2 text-xs text-white font-mono focus:border-amber-400 outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setNowTime('cateringSt')}
                    className="absolute right-1 top-1 bottom-1 text-amber-400 text-xs"
                  >
                    🕒
                  </button>
                </div>
              </div>
            </div>

            {/* 6. CATERING END */}
            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block">
                6. CATERING END
              </label>
              <div className="flex gap-1">
                <button
                  type="button"
                  onClick={() => setEPreset('cateringEnd')}
                  className={`px-2 py-1 font-extrabold text-[10px] rounded-lg border transition-all cursor-pointer ${
                    formData.cateringEnd === 'EARLIER'
                      ? 'bg-amber-500 text-slate-950 border-amber-400 font-black shadow-md'
                      : 'bg-slate-800 hover:bg-slate-700 text-amber-400 border-slate-700'
                  }`}
                  title="Set status to EARLIER"
                >
                  E
                </button>
                <div className="relative flex-1">
                  <input
                    type="text"
                    value={formData.cateringEnd || ''}
                    onChange={(e) => handleChange('cateringEnd', e.target.value)}
                    placeholder="1335"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-2 pr-7 py-2 text-xs text-white font-mono focus:border-amber-400 outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setNowTime('cateringEnd')}
                    className="absolute right-1 top-1 bottom-1 text-amber-400 text-xs"
                  >
                    🕒
                  </button>
                </div>
              </div>
            </div>

            {/* 7. CREW REPORT */}
            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block">
                7. CREW REPORT
              </label>
              <div className="flex gap-1">
                <button
                  type="button"
                  onClick={() => setOBPreset('crew')}
                  className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-amber-400 font-bold text-[10px] rounded-lg border border-slate-700"
                >
                  OB
                </button>
                <div className="relative flex-1">
                  <input
                    type="text"
                    value={formData.crew}
                    onChange={(e) => handleChange('crew', e.target.value)}
                    placeholder="1320"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-2 pr-7 py-2 text-xs text-white font-mono focus:border-amber-400 outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setNowTime('crew')}
                    className="absolute right-1 top-1 bottom-1 text-amber-400 text-xs"
                  >
                    🕒
                  </button>
                </div>
              </div>
            </div>

            {/* 8. REFUELING DONE */}
            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block">
                8. REFUELING DONE
              </label>
              <div className="flex gap-1">
                <button
                  type="button"
                  onClick={() => setOBPreset('refuel')}
                  className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-amber-400 font-bold text-[10px] rounded-lg border border-slate-700"
                >
                  OB
                </button>
                <div className="relative flex-1">
                  <input
                    type="text"
                    value={formData.refuel}
                    onChange={(e) => handleChange('refuel', e.target.value)}
                    placeholder="1335"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-2 pr-7 py-2 text-xs text-white font-mono focus:border-amber-400 outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setNowTime('refuel')}
                    className="absolute right-1 top-1 bottom-1 text-amber-400 text-xs"
                  >
                    🕒
                  </button>
                </div>
              </div>
            </div>

            {/* 9. LAST BAGGAGE REPORT */}
            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block">
                9. LAST BAGGAGE REPORT
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={formData.lbag}
                  onChange={(e) => handleChange('lbag', e.target.value)}
                  placeholder="1340"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-2 pr-7 py-2 text-xs text-white font-mono focus:border-amber-400 outline-none"
                />
                <button
                  type="button"
                  onClick={() => setNowTime('lbag')}
                  className="absolute right-1 top-1 bottom-1 text-amber-400 text-xs"
                >
                  🕒
                </button>
              </div>
            </div>

            {/* 10. BOARDING PERMITTED */}
            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block">
                10. BOARDING PERMITTED
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={formData.permit}
                  onChange={(e) => handleChange('permit', e.target.value)}
                  placeholder="1335"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-2 pr-7 py-2 text-xs text-white font-mono focus:border-amber-400 outline-none"
                />
                <button
                  type="button"
                  onClick={() => setNowTime('permit')}
                  className="absolute right-1 top-1 bottom-1 text-amber-400 text-xs"
                >
                  🕒
                </button>
              </div>
            </div>

            {/* 11. LAST PAX ONBOARD */}
            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block">
                11. LAST PAX ONBOARD
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={formData.pax}
                  onChange={(e) => handleChange('pax', e.target.value)}
                  placeholder="1350"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-2 pr-7 py-2 text-xs text-white font-mono focus:border-amber-400 outline-none"
                />
                <button
                  type="button"
                  onClick={() => setNowTime('pax')}
                  className="absolute right-1 top-1 bottom-1 text-amber-400 text-xs"
                >
                  🕒
                </button>
              </div>
            </div>

            {/* 12. TRIM SUBMITTED */}
            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block">
                12. TRIM SUBMITTED
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={formData.trimSubmitted || ''}
                  onChange={(e) => handleChange('trimSubmitted', e.target.value)}
                  placeholder="1348"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-2 pr-7 py-2 text-xs text-white font-mono focus:border-amber-400 outline-none"
                />
                <button
                  type="button"
                  onClick={() => setNowTime('trimSubmitted')}
                  className="absolute right-1 top-1 bottom-1 text-amber-400 text-xs"
                >
                  🕒
                </button>
              </div>
            </div>

            {/* 13. TRIM SIGNED */}
            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block">
                13. TRIM SIGNED
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={formData.trimSigned || ''}
                  onChange={(e) => handleChange('trimSigned', e.target.value)}
                  placeholder="1352"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-2 pr-7 py-2 text-xs text-white font-mono focus:border-amber-400 outline-none"
                />
                <button
                  type="button"
                  onClick={() => setNowTime('trimSigned')}
                  className="absolute right-1 top-1 bottom-1 text-amber-400 text-xs"
                >
                  🕒
                </button>
              </div>
            </div>

            {/* 14. PRIORITY BAG (OPTIONAL) */}
            <div>
              <label className="text-[10px] font-bold text-cyan-300 uppercase mb-1 block">
                14. PRIORITY BAG <span className="text-[9px] text-slate-500 font-normal">(OPTIONAL)</span>
              </label>
              <input
                type="number"
                min="0"
                value={formData.priorityBag || ''}
                onChange={(e) => handleChange('priorityBag', e.target.value)}
                placeholder="OPTIONAL"
                className="w-full bg-slate-950 border border-cyan-800/60 rounded-xl px-3 py-2 text-xs text-cyan-300 font-mono font-bold focus:border-cyan-400 outline-none placeholder:text-slate-600 placeholder:font-mono"
              />
            </div>

            {/* 15. VIP BAG (OPTIONAL) */}
            <div>
              <label className="text-[10px] font-bold text-amber-300 uppercase mb-1 block">
                15. VIP BAG <span className="text-[9px] text-slate-500 font-normal">(OPTIONAL)</span>
              </label>
              <input
                type="number"
                min="0"
                value={formData.vipBag || ''}
                onChange={(e) => handleChange('vipBag', e.target.value)}
                placeholder="OPTIONAL"
                className="w-full bg-slate-950 border border-amber-800/60 rounded-xl px-3 py-2 text-xs text-amber-300 font-mono font-bold focus:border-amber-400 outline-none placeholder:text-slate-600 placeholder:font-mono"
              />
            </div>

            {/* 16. OFFLOAD BAG (OPTIONAL) */}
            <div className="col-span-2 sm:col-span-1">
              <label className="text-[10px] font-bold text-rose-300 uppercase mb-1 block">
                16. OFFLOAD BAG <span className="text-[9px] text-slate-500 font-normal">(OPTIONAL)</span>
              </label>
              <input
                type="number"
                min="0"
                value={formData.offloadBag || ''}
                onChange={(e) => handleChange('offloadBag', e.target.value)}
                placeholder="OPTIONAL"
                className="w-full bg-slate-950 border border-rose-800/60 rounded-xl px-3 py-2 text-xs text-rose-300 font-mono font-bold focus:border-rose-400 outline-none placeholder:text-slate-600 placeholder:font-mono"
              />
            </div>
          </div>
        </div>

        {/* Auto calculated Ground Time */}
        <div className="pt-2 border-t border-slate-800">
          <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block">
            GROUND TIME
          </label>
          <input
            type="text"
            readOnly
            value={
              flightMode === 'DIRECT'
                ? 'ON GROUND'
                : formData.ground
                ? `${formData.ground} MINS`
                : 'PENDING'
            }
            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-xs font-mono font-black text-amber-400 text-center outline-none"
          />
        </div>
      </div>

      {/* Action Buttons */}
      <div className="grid grid-cols-2 gap-2 pt-1">
        <button
          type="button"
          onClick={handleSaveAttempt}
          className="flex items-center justify-center gap-2 py-3.5 px-4 rounded-xl bg-gradient-to-r from-blue-700 to-indigo-800 hover:from-blue-600 hover:to-indigo-700 active:scale-98 text-white font-black text-xs shadow-lg shadow-blue-950/80 transition-all border border-blue-400/30 cursor-pointer"
        >
          <Save className="w-4 h-4 text-amber-300" />
          <span>SAVE REPORT</span>
        </button>

        <button
          type="button"
          onClick={handleDownloadAttempt}
          className="flex items-center justify-center gap-2 py-3.5 px-4 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 active:scale-98 text-slate-950 font-black text-xs shadow-lg shadow-amber-950/50 transition-all border border-amber-300/50 cursor-pointer"
        >
          <Download className="w-4 h-4" />
          <span>DOWNLOAD JPG</span>
        </button>
      </div>

      {/* SKIPPED FIELDS POPUP MODAL */}
      {skippedModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md fade-in">
          <div className="bg-slate-900 border-2 border-red-500 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden flex flex-col max-h-[85vh] animate-in zoom-in-95">
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-red-950 via-slate-900 to-red-950 p-4 border-b border-red-500/40 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-red-500/20 border border-red-400/40 flex items-center justify-center text-red-400">
                  <AlertCircle className="w-5 h-5 animate-bounce" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-red-300 uppercase tracking-wider">
                    SKIPPED REQUIRED FIELDS!
                  </h3>
                  <p className="text-[10px] text-slate-400 font-mono">
                    Please fill up all skipped fields before saving/downloading
                  </p>
                </div>
              </div>

              <button
                onClick={() => setSkippedModalOpen(false)}
                className="w-8 h-8 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white flex items-center justify-center border border-slate-700 transition-all"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body: List of Skipped Fields */}
            <div className="p-4 space-y-3 overflow-y-auto flex-1 bg-slate-950/80">
              <p className="text-xs text-amber-200 font-medium">
                The following required fields were left empty:
              </p>

              <div className="flex flex-wrap gap-2">
                {skippedFieldsList.map((field, idx) => (
                  <span
                    key={idx}
                    className="text-[11px] font-mono font-bold px-2.5 py-1 rounded-lg bg-red-500/20 text-red-300 border border-red-500/40 flex items-center gap-1.5"
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-red-400" />
                    {field}
                  </span>
                ))}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-3.5 bg-slate-900 border-t border-slate-800 flex justify-end">
              <button
                onClick={() => setSkippedModalOpen(false)}
                className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-red-600 to-rose-700 hover:from-red-500 hover:to-rose-600 text-white font-black text-xs uppercase tracking-wider shadow-lg active:scale-95 transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <span>GO BACK & FILL FIELDS</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
