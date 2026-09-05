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
  Square,
  Calendar
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

// Helper to convert time string (HHMM or HH:MM) to total minutes from 00:00
const parseTimeToMinutes = (tStr?: string): number | null => {
  if (!tStr) return null;
  const clean = tStr.trim().replace(/[^0-9:]/g, '');
  if (!clean) return null;
  let hh = 0;
  let mm = 0;

  if (clean.includes(':')) {
    const parts = clean.split(':');
    hh = parseInt(parts[0], 10);
    mm = parseInt(parts[1], 10);
  } else if (clean.length === 4) {
    hh = parseInt(clean.slice(0, 2), 10);
    mm = parseInt(clean.slice(2, 4), 10);
  } else if (clean.length === 3) {
    hh = parseInt(clean.slice(0, 1), 10);
    mm = parseInt(clean.slice(1, 3), 10);
  } else {
    return null;
  }

  if (isNaN(hh) || isNaN(mm) || hh < 0 || hh > 23 || mm < 0 || mm > 59) {
    return null;
  }
  return hh * 60 + mm;
};

// Check if value is presetted / earlier
const isEarlierOrPresetted = (val?: string): boolean => {
  if (!val) return false;
  const upper = val.trim().toUpperCase();
  return (
    upper === 'E' ||
    upper === 'EARLIER' ||
    upper === 'EARLY' ||
    upper === 'OB' ||
    upper === 'PRE' ||
    upper === 'N/A' ||
    upper === 'NA'
  );
};

export interface TimingErrorDetail {
  pairKey: 'security' | 'cleaning' | 'catering' | 'boarding';
  fieldLabel: string;
  startLabel: string;
  endLabel: string;
  startVal: string;
  endVal: string;
  message: string;
}

export const checkPairTiming = (
  pair: 'security' | 'cleaning' | 'catering' | 'boarding',
  form: RampReportFormData
): TimingErrorDetail | null => {
  let startVal = '';
  let endVal = '';
  let fieldLabel = '';
  let startLabel = '';
  let endLabel = '';

  if (pair === 'security') {
    startVal = form.securitySt || '';
    endVal = form.securityEnd || '';
    fieldLabel = '1 & 2. SECURITY CHECK';
    startLabel = 'Security Check Start';
    endLabel = 'Security Check End';
  } else if (pair === 'cleaning') {
    startVal = form.cleaningSt || '';
    endVal = form.cleaningEnd || '';
    fieldLabel = '3 & 4. CLEANING';
    startLabel = 'Cleaning Start';
    endLabel = 'Cleaning End';
  } else if (pair === 'catering') {
    startVal = form.cateringSt || '';
    endVal = form.cateringEnd || '';
    fieldLabel = '5 & 6. CATERING';
    startLabel = 'Catering Start';
    endLabel = 'Catering End';
  } else if (pair === 'boarding') {
    startVal = form.permit || '';
    endVal = form.pax || '';
    fieldLabel = '10 & 11. BOARDING';
    startLabel = 'Boarding Permitted';
    endLabel = 'Last Pax Onboard';
  }

  const sClean = startVal.trim().toUpperCase();
  const eClean = endVal.trim().toUpperCase();

  // If either field is missing/empty, do not flag yet (user still entering)
  if (!sClean || !eClean) return null;

  // If either field is marked as EARLIER / OB / PRE / NA, it is acceptable
  if (isEarlierOrPresetted(sClean) || isEarlierOrPresetted(eClean)) return null;

  const sMin = parseTimeToMinutes(sClean);
  const eMin = parseTimeToMinutes(eClean);

  // If time digits are not yet complete (e.g. user typed only 1 or 2 digits), do not flag
  if (sMin === null || eMin === null) return null;

  // Normal rule: Ending time must be strictly after starting time
  if (eMin > sMin) {
    return null; // Valid!
  }

  // Check valid midnight crossover (e.g., flight turnaround started 23:50 and ended 00:10 next day)
  // Started late evening (>= 18:00) and ended early morning (<= 06:00), with duration <= 300 minutes (5 hours)
  const isLateEveningStart = sMin >= 18 * 60; // 18:00 onwards
  const isEarlyMorningEnd = eMin <= 6 * 60;   // up to 06:00
  const rolloverDuration = (eMin + 1440) - sMin;

  if (isLateEveningStart && isEarlyMorningEnd && rolloverDuration > 0 && rolloverDuration <= 300) {
    return null; // Valid midnight turnaround!
  }

  // Otherwise, ending time is earlier than or equal to starting time -> WRONG TIMING!
  let message = '';
  if (pair === 'boarding') {
    message = `Last Pax Onboard time (${endVal}) cannot be earlier than or equal to Boarding Permitted time (${startVal}).`;
  } else {
    message = `${endLabel} time (${endVal}) cannot be earlier than or equal to ${startLabel} time (${startVal}).`;
  }

  return {
    pairKey: pair,
    fieldLabel,
    startLabel,
    endLabel,
    startVal,
    endVal,
    message
  };
};

export const getAllTimingErrors = (form: RampReportFormData): TimingErrorDetail[] => {
  const errors: TimingErrorDetail[] = [];
  const pairs: Array<'security' | 'cleaning' | 'catering' | 'boarding'> = [
    'security',
    'cleaning',
    'catering',
    'boarding'
  ];
  for (const p of pairs) {
    const err = checkPairTiming(p, form);
    if (err) errors.push(err);
  }
  return errors;
};

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

  const getTodayFormattedDate = (): string => {
    return new Date()
      .toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' })
      .toUpperCase();
  };

  const formatIsoToReportDate = (isoStr: string): string => {
    if (!isoStr) return '';
    const parts = isoStr.split('-');
    if (parts.length === 3) {
      const day = parts[2];
      const mIdx = parseInt(parts[1], 10) - 1;
      const monthNames = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
      const month = monthNames[mIdx] || 'JAN';
      const yr = parts[0].slice(-2);
      return `${day} ${month} ${yr}`.toUpperCase();
    }
    return isoStr;
  };

  const getInitialFormData = (userStation: string): RampReportFormData => {
    const todayStr = getTodayFormattedDate();

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
      delayRemarks: '',
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

    const todayStr = getTodayFormattedDate();

    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && parsed.formData) {
          // Check if draft was created on the current calendar day
          const draftDateStr = parsed.savedAt ? new Date(parsed.savedAt).toDateString() : null;
          const isDraftFromToday = draftDateStr === new Date().toDateString();

          return {
            ...parsed.formData,
            // If the draft is from a previous day, ALWAYS force date to today's date!
            date: isDraftFromToday && parsed.formData.date ? parsed.formData.date : todayStr
          };
        }
      }
    } catch (e) {}

    return getInitialFormData(user.station);
  });

  const [skippedModalOpen, setSkippedModalOpen] = useState<boolean>(false);
  const [skippedFieldsList, setSkippedFieldsList] = useState<string[]>([]);
  const [timingErrorModalOpen, setTimingErrorModalOpen] = useState<boolean>(false);
  const [timingErrorsList, setTimingErrorsList] = useState<TimingErrorDetail[]>([]);
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
    } else {
      // Switching to a new report: ensure date is always Today's date
      const todayStr = getTodayFormattedDate();
      setFormData((prev) => ({
        ...prev,
        date: todayStr
      }));
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

    // Delay Remarks if Flight Status is strictly DELAY
    const statusUpper = (formData.status || '').toUpperCase();
    const isDelayedStatus =
      statusUpper.includes('DELAY') &&
      !statusUpper.includes('EARLY') &&
      !statusUpper.includes('ON TIME') &&
      !statusUpper.includes('ON-TIME');

    if (isDelayedStatus) {
      if (!formData.delayRemarks?.trim() && !formData.delayReason?.trim()) {
        skipped.push('DELAY REMARKS (REQUIRED FOR DELAYED FLIGHTS)');
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

    const timingErrors = getAllTimingErrors(formData);
    if (timingErrors.length > 0) {
      setTimingErrorsList(timingErrors);
      setTimingErrorModalOpen(true);
      return;
    }

    clearDraft();
    const targetFlightClean = (formData.deptFlt || formData.arvFlt || '').replace(/[^0-9]/g, '');
    const fltNum = parseInt(targetFlightClean, 10);
    let resolvedType = reportType;
    if (fltNum) {
      if ((fltNum >= 100 && fltNum <= 199) || (fltNum >= 500 && fltNum <= 599)) {
        resolvedType = 'DOMESTIC';
      } else if (fltNum >= 200 && fltNum <= 499) {
        resolvedType = 'INTERNATIONAL';
      }
    }
    onSaveReport(formData, resolvedType, flightMode, reportToEdit?.id);
  };

  const handleDownloadAttempt = () => {
    const skipped = getSkippedFields();
    if (skipped.length > 0) {
      setSkippedFieldsList(skipped);
      setSkippedModalOpen(true);
      return;
    }

    const timingErrors = getAllTimingErrors(formData);
    if (timingErrors.length > 0) {
      setTimingErrorsList(timingErrors);
      setTimingErrorModalOpen(true);
      return;
    }

    clearDraft();
    const targetFlightClean = (formData.deptFlt || formData.arvFlt || '').replace(/[^0-9]/g, '');
    const fltNum = parseInt(targetFlightClean, 10);
    let resolvedType = reportType;
    if (fltNum) {
      if ((fltNum >= 100 && fltNum <= 199) || (fltNum >= 500 && fltNum <= 599)) {
        resolvedType = 'DOMESTIC';
      } else if (fltNum >= 200 && fltNum <= 499) {
        resolvedType = 'INTERNATIONAL';
      }
    }
    // Automatically save report with modified data when download is clicked
    onSaveReport(formData, resolvedType, flightMode, reportToEdit?.id);
    onDownloadJPG(formData, resolvedType, flightMode);
  };

  // Validate milestone pairs on Blur (option B: immediate feedback upon leaving input)
  const handleMilestoneBlur = (pair: 'security' | 'cleaning' | 'catering' | 'boarding') => {
    const err = checkPairTiming(pair, formData);
    if (err) {
      setTimingErrorsList((prev) => {
        const filtered = prev.filter((item) => item.pairKey !== pair);
        return [...filtered, err];
      });
      setTimingErrorModalOpen(true);
    } else {
      setTimingErrorsList((prev) => prev.filter((item) => item.pairKey !== pair));
    }
  };

  // Handle Field Changes
  const handleChange = (field: keyof RampReportFormData, value: string) => {
    const transformedVal = field === 'delayRemarks' ? value : value.toUpperCase();
    const updated = { ...formData, [field]: transformedVal };

    // Auto Route Lookup & Report Type Sync
    if (field === 'arvFlt' || field === 'deptFlt') {
      const fltClean = value.replace(/BS/gi, '').replace(/[^0-9]/g, '');
      const fltNum = parseInt(fltClean, 10);
      if (fltNum) {
        if ((fltNum >= 100 && fltNum <= 199) || (fltNum >= 500 && fltNum <= 599)) {
          setReportType('DOMESTIC');
        } else if (fltNum >= 200 && fltNum <= 499) {
          setReportType('INTERNATIONAL');
        }
      }
      const route = lookupRoute(value);
      if (route) {
        if (field === 'arvFlt') updated.arvRoute = route;
        if (field === 'deptFlt') updated.deptRoute = route;
      }
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
    const timeVal = `${hh}${mm}`;
    handleChange(field, timeVal);

    let pairToCheck: 'security' | 'cleaning' | 'catering' | 'boarding' | null = null;
    if (field === 'securitySt' || field === 'securityEnd') pairToCheck = 'security';
    else if (field === 'cleaningSt' || field === 'cleaningEnd') pairToCheck = 'cleaning';
    else if (field === 'cateringSt' || field === 'cateringEnd') pairToCheck = 'catering';
    else if (field === 'permit' || field === 'pax') pairToCheck = 'boarding';

    if (pairToCheck) {
      const updatedForm = { ...formData, [field]: timeVal };
      const err = checkPairTiming(pairToCheck, updatedForm);
      if (err) {
        setTimingErrorsList((prev) => {
          const filtered = prev.filter((item) => item.pairKey !== pairToCheck);
          return [...filtered, err];
        });
        setTimingErrorModalOpen(true);
      } else {
        setTimingErrorsList((prev) => prev.filter((item) => item.pairKey !== pairToCheck));
      }
    }
  };

  // Helper: Set OB Preset
  const setOBPreset = (field: keyof RampReportFormData) => {
    handleChange(field, 'OB');
  };

  // Helper: Set E (EARLIER) Preset
  const setEPreset = (field: keyof RampReportFormData) => {
    const currentVal = formData[field] || '';
    const nextVal = currentVal === 'EARLIER' ? '' : 'EARLIER';
    handleChange(field, nextVal);

    let pairToCheck: 'security' | 'cleaning' | 'catering' | 'boarding' | null = null;
    if (field === 'securitySt' || field === 'securityEnd') pairToCheck = 'security';
    else if (field === 'cleaningSt' || field === 'cleaningEnd') pairToCheck = 'cleaning';
    else if (field === 'cateringSt' || field === 'cateringEnd') pairToCheck = 'catering';
    else if (field === 'permit' || field === 'pax') pairToCheck = 'boarding';

    if (pairToCheck && nextVal === 'EARLIER') {
      setTimingErrorsList((prev) => prev.filter((item) => item.pairKey !== pairToCheck));
    }
  };

  // Check if any error is active for pairs
  const hasSecurityTimingError = timingErrorsList.some((e) => e.pairKey === 'security');
  const hasCleaningTimingError = timingErrorsList.some((e) => e.pairKey === 'cleaning');
  const hasCateringTimingError = timingErrorsList.some((e) => e.pairKey === 'catering');
  const hasBoardingTimingError = timingErrorsList.some((e) => e.pairKey === 'boarding');

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
            <div className="flex items-center justify-between mb-1">
              <label className="text-[10px] font-bold text-slate-400 uppercase flex items-center gap-1">
                <Calendar className="w-3 h-3 text-amber-400" />
                <span>DATE</span>
              </label>
              <button
                type="button"
                onClick={() => {
                  const todayStr = getTodayFormattedDate();
                  handleChange('date', todayStr);
                }}
                className="text-[9px] font-bold text-amber-400 hover:text-amber-300 uppercase px-1.5 py-0.5 rounded bg-amber-500/10 border border-amber-500/30 active:scale-95 transition-all cursor-pointer flex items-center gap-0.5"
                title="Reset date to Today"
              >
                <span>⚡ TODAY</span>
              </button>
            </div>
            <div className="relative flex items-center">
              <input
                type="text"
                value={formData.date || getTodayFormattedDate()}
                onChange={(e) => handleChange('date', e.target.value)}
                placeholder="DD MMM YY"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-3 pr-9 py-2 text-xs text-white font-mono focus:border-amber-400 outline-none uppercase font-bold"
              />
              {/* Native Calendar Date Picker Trigger */}
              <label
                className="absolute right-1.5 top-1/2 -translate-y-1/2 w-6 h-6 rounded-lg bg-slate-800 hover:bg-slate-700 text-amber-400 flex items-center justify-center cursor-pointer transition-all border border-slate-700 shadow-sm"
                title="Pick Date from Calendar"
              >
                <Calendar className="w-3.5 h-3.5" />
                <input
                  type="date"
                  className="opacity-0 absolute inset-0 w-full h-full cursor-pointer"
                  onChange={(e) => {
                    if (e.target.value) {
                      const formatted = formatIsoToReportDate(e.target.value);
                      if (formatted) handleChange('date', formatted);
                    }
                  }}
                />
              </label>
            </div>
            {/* Status helper under date field */}
            <div className="mt-1 flex items-center justify-between text-[9px]">
              {formData.date && formData.date.toUpperCase() === getTodayFormattedDate() ? (
                <span className="text-emerald-400 flex items-center gap-1 font-bold">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  TODAY (AUTOMATIC)
                </span>
              ) : (
                <span className="text-amber-400 flex items-center gap-1 font-bold">
                  <AlertTriangle className="w-2.5 h-2.5" />
                  CUSTOM DATE SELECTED
                </span>
              )}
            </div>
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

            {/* REMARKS INPUT FOR DELAYED FLIGHTS (DELAY CODES HIDDEN AS PER MANAGEMENT DECISION) */}
            {formData.status.includes('DELAY') && (
              <div className="bg-red-950/60 border-2 border-red-500/70 rounded-2xl p-3.5 space-y-3 animate-in fade-in shadow-xl">
                <div className="p-3 bg-yellow-950/40 border-2 border-yellow-400 rounded-xl space-y-2 shadow-lg">
                  <div className="flex items-center justify-between flex-wrap gap-1">
                    <label className="text-xs font-black text-yellow-300 uppercase tracking-wider flex items-center gap-1.5 font-mono">
                      <AlertTriangle className="w-4 h-4 text-yellow-400" />
                      <span>DELAY REMARKS *</span>
                    </label>
                    <span className="text-[10px] font-bold text-yellow-400/90 font-mono px-2 py-0.5 rounded bg-yellow-500/20 border border-yellow-400/30">
                      SHOWS IN FINAL REPORT
                    </span>
                  </div>
                  <textarea
                    rows={3}
                    value={formData.delayRemarks || ''}
                    onChange={(e) => handleChange('delayRemarks', e.target.value)}
                    placeholder="Enter delay remarks / reasons here (e.g. Fuel bowser late due to apron traffic, ATC hold, pax boarding delay)..."
                    className="w-full bg-yellow-100 border-2 border-yellow-400 focus:border-amber-500 rounded-xl p-2.5 text-xs text-slate-950 font-bold placeholder-slate-600 outline-none font-sans leading-relaxed resize-none shadow-inner transition-all"
                  />
                </div>
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
                    onBlur={() => handleMilestoneBlur('security')}
                    placeholder="1310"
                    className={`w-full bg-slate-950 border rounded-xl pl-2 pr-7 py-2 text-xs text-white font-mono focus:border-amber-400 outline-none ${
                      hasSecurityTimingError ? 'border-rose-500 ring-1 ring-rose-500/50' : 'border-slate-800'
                    }`}
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
                    onBlur={() => handleMilestoneBlur('security')}
                    placeholder="1320"
                    className={`w-full bg-slate-950 border rounded-xl pl-2 pr-7 py-2 text-xs text-white font-mono focus:border-amber-400 outline-none ${
                      hasSecurityTimingError ? 'border-rose-500 ring-1 ring-rose-500/50' : 'border-slate-800'
                    }`}
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
                    onBlur={() => handleMilestoneBlur('cleaning')}
                    placeholder="1320"
                    className={`w-full bg-slate-950 border rounded-xl pl-2 pr-7 py-2 text-xs text-white font-mono focus:border-amber-400 outline-none ${
                      hasCleaningTimingError ? 'border-rose-500 ring-1 ring-rose-500/50' : 'border-slate-800'
                    }`}
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
                    onBlur={() => handleMilestoneBlur('cleaning')}
                    placeholder="1328"
                    className={`w-full bg-slate-950 border rounded-xl pl-2 pr-7 py-2 text-xs text-white font-mono focus:border-amber-400 outline-none ${
                      hasCleaningTimingError ? 'border-rose-500 ring-1 ring-rose-500/50' : 'border-slate-800'
                    }`}
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
                    onBlur={() => handleMilestoneBlur('catering')}
                    placeholder="1325"
                    className={`w-full bg-slate-950 border rounded-xl pl-2 pr-7 py-2 text-xs text-white font-mono focus:border-amber-400 outline-none ${
                      hasCateringTimingError ? 'border-rose-500 ring-1 ring-rose-500/50' : 'border-slate-800'
                    }`}
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
                    onBlur={() => handleMilestoneBlur('catering')}
                    placeholder="1335"
                    className={`w-full bg-slate-950 border rounded-xl pl-2 pr-7 py-2 text-xs text-white font-mono focus:border-amber-400 outline-none ${
                      hasCateringTimingError ? 'border-rose-500 ring-1 ring-rose-500/50' : 'border-slate-800'
                    }`}
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
                  onBlur={() => handleMilestoneBlur('boarding')}
                  placeholder="1335"
                  className={`w-full bg-slate-950 border rounded-xl pl-2 pr-7 py-2 text-xs text-white font-mono focus:border-amber-400 outline-none ${
                    hasBoardingTimingError ? 'border-rose-500 ring-1 ring-rose-500/50' : 'border-slate-800'
                  }`}
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
                  onBlur={() => handleMilestoneBlur('boarding')}
                  placeholder="1350"
                  className={`w-full bg-slate-950 border rounded-xl pl-2 pr-7 py-2 text-xs text-white font-mono focus:border-amber-400 outline-none ${
                    hasBoardingTimingError ? 'border-rose-500 ring-1 ring-rose-500/50' : 'border-slate-800'
                  }`}
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

      {/* YOU INPUTTED WRONG TIMING POPUP MODAL */}
      {timingErrorModalOpen && timingErrorsList.length > 0 && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md fade-in">
          <div className="bg-slate-900 border-2 border-rose-500 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden flex flex-col max-h-[85vh] animate-in zoom-in-95">
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-rose-950 via-slate-900 to-rose-950 p-4 border-b border-rose-500/40 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-rose-500/20 border border-rose-400/50 flex items-center justify-center text-rose-400 shadow-inner shrink-0">
                  <AlertTriangle className="w-5 h-5 text-rose-400 animate-pulse" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-rose-300 uppercase tracking-wider">
                    YOU INPUTTED WRONG TIMING
                  </h3>
                  <p className="text-[10px] text-slate-400 font-mono">
                    Ending time must be after starting time
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setTimingErrorModalOpen(false)}
                className="w-8 h-8 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white flex items-center justify-center border border-slate-700 transition-all cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-4 space-y-3 overflow-y-auto flex-1 bg-slate-950/80">
              <p className="text-xs text-amber-200 font-medium">
                The turnaround sequence has incorrect times. Please correct the timing:
              </p>

              <div className="space-y-2.5">
                {timingErrorsList.map((err, idx) => (
                  <div
                    key={idx}
                    className="p-3 rounded-xl bg-rose-950/40 border border-rose-500/50 space-y-1.5 shadow-sm"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-amber-300 uppercase font-mono tracking-wide">
                        {err.fieldLabel}
                      </span>
                      <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-rose-500/20 text-rose-300 border border-rose-500/40">
                        TIMING CONFLICT
                      </span>
                    </div>
                    <p className="text-xs text-rose-100 font-medium leading-relaxed">
                      {err.message}
                    </p>
                    <div className="flex items-center gap-3 pt-1 text-[11px] font-mono text-slate-300">
                      <div>
                        <span className="text-slate-500">{err.startLabel}:</span>{' '}
                        <span className="font-bold text-amber-300">{err.startVal}</span>
                      </div>
                      <div className="text-slate-600">→</div>
                      <div>
                        <span className="text-slate-500">{err.endLabel}:</span>{' '}
                        <span className="font-bold text-rose-400">{err.endVal}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-3.5 bg-slate-900 border-t border-slate-800 flex justify-end">
              <button
                type="button"
                onClick={() => setTimingErrorModalOpen(false)}
                className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-rose-600 to-red-700 hover:from-rose-500 hover:to-red-600 text-white font-black text-xs uppercase tracking-wider shadow-lg active:scale-95 transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <span>GO BACK & CORRECT TIMING</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
