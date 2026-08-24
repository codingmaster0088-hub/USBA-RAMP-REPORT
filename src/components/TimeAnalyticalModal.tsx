import React, { useState, useRef, useMemo, useEffect } from 'react';
import { SavedReport, ScheduleFlight, DailyAnalyticalSnapshot } from '../types';
import { captureHtml2CanvasSafe } from '../utils/html2canvasHelper';
import { saveDailyAnalyticalSnapshotToFirestore, subscribeToDailyAnalyticalSnapshots } from '../lib/firebase';
import { parseDateToIso, formatIsoToDisplay, cleanFlightNum } from '../utils/analyticalSnapshotBuilder';
import { verifiedFlightReports } from '../data/verifiedFlightReports';
import { BackendStorageConfirmationModal } from './BackendStorageConfirmationModal';
import aircraftImage from '../assets/images/us_bangla_real_hd_plane_1786386727381.jpg';
import {
  X,
  Clock,
  Download,
  Calendar,
  FileSpreadsheet,
  Layers,
  Plane,
  Search,
  Sparkles,
  ShieldCheck,
  CheckCircle2,
  Activity,
  Image as ImageIcon,
  Eye,
  Table as TableIcon,
  Database,
  Check
} from 'lucide-react';

interface TimeAnalyticalModalProps {
  savedReports: SavedReport[];
  scheduleFlights: ScheduleFlight[];
  station: string;
  adminName: string;
  adminId: string;
  onClose: () => void;
  showToast: (title: string, subtitle?: string, type?: 'success' | 'info' | 'error') => void;
}

export const TimeAnalyticalModal: React.FC<TimeAnalyticalModalProps> = ({
  savedReports,
  scheduleFlights,
  station,
  adminName,
  adminId,
  onClose,
  showToast
}) => {
  const printCardRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDownloading, setIsDownloading] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [customHeaderPhoto, setCustomHeaderPhoto] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'HUD_TABLE' | 'PHOTO_CARD'>('HUD_TABLE');

  // 1. Helper to format Date object to YYYY-MM-DD
  const getTodayIso = (): string => {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  // 2. Helper to format ISO YYYY-MM-DD to "DD MMM YY" (e.g. "16 AUG 26")
  const formatIsoToDDMMMYY = (isoStr: string): string => {
    if (!isoStr) return '';
    const parts = isoStr.split('-');
    if (parts.length === 3) {
      const day = parts[2];
      const mIdx = parseInt(parts[1], 10) - 1;
      const monthNames = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
      const month = monthNames[mIdx] || 'JAN';
      const yr = parts[0].slice(-2);
      return `${day} ${month} ${yr}`;
    }
    return isoStr;
  };

  const formatIsoToFullDate = (isoStr: string): string => {
    if (!isoStr) return '';
    const parts = isoStr.split('-');
    if (parts.length === 3) {
      const day = parts[2];
      const mIdx = parseInt(parts[1], 10) - 1;
      const monthNames = ['JANUARY', 'FEBRUARY', 'MARCH', 'APRIL', 'MAY', 'JUNE', 'JULY', 'AUGUST', 'SEPTEMBER', 'OCTOBER', 'NOVEMBER', 'DECEMBER'];
      const month = monthNames[mIdx] || 'JANUARY';
      const yr = parts[0];
      return `${day} ${month} ${yr}`;
    }
    return isoStr;
  };

  const todayIso = getTodayIso();
  const [selectedIsoDate, setSelectedIsoDate] = useState<string>(todayIso);
  const isTodaySelected = selectedIsoDate === todayIso;
  const activeDateDisplay = formatIsoToDDMMMYY(selectedIsoDate);
  const fullDateDisplay = formatIsoToFullDate(selectedIsoDate);

  // 3. 30-Day Backend Storage Snapshot States
  const [snapshots, setSnapshots] = useState<DailyAnalyticalSnapshot[]>([]);
  const [showSaveSuccessModal, setShowSaveSuccessModal] = useState<boolean>(false);
  const [savedSnapshotInfo, setSavedSnapshotInfo] = useState<{
    dateDisplay: string;
    dateIso: string;
    totalFlights: number;
    expiresDateStr: string;
  } | null>(null);

  // Real-time listener for 30-Day Daily Analytical Snapshots
  useEffect(() => {
    const unsub = subscribeToDailyAnalyticalSnapshots((list) => {
      setSnapshots(list);
    });
    return () => unsub();
  }, []);

  // Check if an archived snapshot exists in backend for the active date
  const activeBackendSnapshot = useMemo(() => {
    return snapshots.find(
      (s) => s.dateIso === selectedIsoDate || s.dateDisplay === activeDateDisplay
    );
  }, [snapshots, selectedIsoDate, activeDateDisplay]);

  // Compute oldest archived date and range string
  const backendArchiveRange = useMemo(() => {
    if (snapshots.length === 0) {
      return {
        startDateDisplay: formatIsoToDDMMMYY(todayIso),
        todayDateDisplay: formatIsoToDDMMMYY(todayIso),
        totalArchivedDays: 1,
        rangeText: `${formatIsoToDDMMMYY(todayIso)} (START) ➔ ${formatIsoToDDMMMYY(todayIso)} (TODAY)`
      };
    }
    const sorted = [...snapshots].sort((a, b) => a.dateIso.localeCompare(b.dateIso));
    const oldest = sorted[0];
    const oldestDisplay = oldest.dateDisplay || formatIsoToDDMMMYY(oldest.dateIso) || formatIsoToDDMMMYY(todayIso);
    return {
      startDateDisplay: oldestDisplay,
      todayDateDisplay: formatIsoToDDMMMYY(todayIso),
      totalArchivedDays: snapshots.length,
      rangeText: `${oldestDisplay} (START) ➔ ${formatIsoToDDMMMYY(todayIso)} (TODAY)`
    };
  }, [snapshots, todayIso]);

  // Category Filter State: ALL | DOMESTIC | INTERNATIONAL
  const [flightScopeFilter, setFlightScopeFilter] = useState<'ALL' | 'DOMESTIC' | 'INTERNATIONAL'>('ALL');

  // Handle Custom Aircraft Photo Upload
  const handleCustomPhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 10 * 1024 * 1024) {
        showToast('Image Too Large', 'Please select an image smaller than 10MB', 'error');
        return;
      }
      const reader = new FileReader();
      reader.onload = (uploadEvent) => {
        const result = uploadEvent.target?.result as string;
        if (result) {
          setCustomHeaderPhoto(result);
          showToast('Header Photo Updated', 'Your custom aircraft photo is set for the Time Analytical Card!', 'success');
        }
      };
      reader.readAsDataURL(file);
    }
  };

  // Helper to extract day and month key e.g. "16AUG"
  const parseDayMonthKey = (str: string): string => {
    if (!str) return '';
    const cleanStr = str.trim().toUpperCase();
    if (cleanStr.includes('TODAY')) {
      const d = new Date();
      const monthNames = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
      const day = String(d.getDate()).padStart(2, '0');
      const month = monthNames[d.getMonth()];
      return `${day}${month}`;
    }

    const monthNames = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

    // 1. Alpha Month e.g. "16 AUG 2026", "16 AUG 26", "16AUG26"
    const alphaMatch = cleanStr.match(/\b(\d{1,2})\s*[-/]?\s*([A-Za-z]{3})\b/i);
    if (alphaMatch) {
      const day = String(parseInt(alphaMatch[1], 10)).padStart(2, '0');
      const month = alphaMatch[2].toUpperCase();
      return `${day}${month}`;
    }

    // 2. ISO Format YYYY-MM-DD e.g. 2026-08-16
    const isoMatch = cleanStr.match(/\b(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})\b/);
    if (isoMatch) {
      const mIdx = parseInt(isoMatch[2], 10) - 1;
      const day = String(parseInt(isoMatch[3], 10)).padStart(2, '0');
      const month = monthNames[mIdx] || 'JAN';
      return `${day}${month}`;
    }

    // 3. Numeric DD/MM/YYYY
    const numMatch = cleanStr.match(/\b(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})\b/);
    if (numMatch) {
      const day = String(parseInt(numMatch[1], 10)).padStart(2, '0');
      const mIdx = parseInt(numMatch[2], 10) - 1;
      const month = monthNames[mIdx] || 'JAN';
      return `${day}${month}`;
    }

    return cleanStr.replace(/[^0-9A-Z]/g, '').slice(0, 5);
  };

  // Helper to check if report matches selected date
  const isReportMatchingSelectedDate = (r: SavedReport, targetIso: string): boolean => {
    if (!targetIso) return true;
    const normalizedTargetIso = parseDateToIso(targetIso);
    const targetDmKey = parseDayMonthKey(normalizedTargetIso);

    // 1. Direct form date match using standardized parseDateToIso
    const rDateString = (r.formData?.date || r.date || '').trim();
    if (rDateString) {
      if (isTodaySelected && rDateString.toUpperCase().includes('TODAY')) {
        return true;
      }
      const rDateIso = parseDateToIso(rDateString);
      if (rDateIso === normalizedTargetIso) return true;

      // Match by month & day (e.g. "08-24" === "08-24")
      if (rDateIso.slice(5) === normalizedTargetIso.slice(5)) return true;

      const rDmKey = parseDayMonthKey(rDateString);
      if (rDmKey && targetDmKey && rDmKey === targetDmKey) {
        return true;
      }

      // If the report explicitly has a different date specified (e.g. "22 AUG" vs "24 AUG"), reject
      return false;
    }

    // 2. Only if no explicit date in report formData, fallback to createdAt or timestamp
    const timestamps = [r.timestamp, r.createdAt].filter(Boolean);
    for (const ts of timestamps) {
      const t = new Date(ts as string | number);
      if (!isNaN(t.getTime())) {
        const monthNames = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
        const tsDay = String(t.getDate()).padStart(2, '0');
        const tsMonth = monthNames[t.getMonth()];
        const tsKey = `${tsDay}${tsMonth}`;
        if (targetDmKey && targetDmKey === tsKey) {
          return true;
        }
        const tsIso = t.toISOString().slice(0, 10);
        if (tsIso === normalizedTargetIso || tsIso.slice(5) === normalizedTargetIso.slice(5)) {
          return true;
        }
      }
    }

    return false;
  };

  // Helper to check if report is Domestic vs International
  const isDomesticReport = (r: SavedReport): boolean => {
    const deptFltStr = r.formData?.deptFlt || '';
    const arvFltStr = r.formData?.arvFlt || '';
    const mainFltStr = r.flight || '';
    const rawFltString = deptFltStr || arvFltStr || mainFltStr;
    const cleanNumStr = rawFltString.replace(/BS/gi, '').replace(/[^0-9]/g, '');
    const fltNum = parseInt(cleanNumStr, 10);

    if (fltNum && !isNaN(fltNum)) {
      if ((fltNum >= 100 && fltNum <= 199) || (fltNum >= 500 && fltNum <= 599)) {
        return true;
      }
      if (fltNum >= 200 && fltNum <= 499) {
        return false;
      }
    }

    const routeText = `${r.formData?.deptRoute || ''} ${r.formData?.arvRoute || ''} ${r.route || ''}`.toUpperCase();
    const intlStationRegex = /\b(DXB|SHJ|AUH|RUH|JED|MED|MLE|BKK|DMK|MCT|DOH|CCU|MAA|DEL|BOM|CAN|SIN|KUL|PKX|KMG|NRT|ICN|LHR)\b/;
    if (intlStationRegex.test(routeText)) {
      return false;
    }

    const domStationRegex = /\b(DAC|CGP|ZYL|CXB|RJH|SPD|JSR|BZL)\b/;
    if (domStationRegex.test(routeText)) {
      return true;
    }

    if (r.type) {
      if (r.type.toUpperCase() === 'DOMESTIC') return true;
      if (r.type.toUpperCase() === 'INTERNATIONAL') return false;
    }

    return false;
  };

  // Helper: Parse HHMM / HH:MM string to minutes of day
  const parseTimeToMinutes = (timeStr?: string): number | null => {
    if (!timeStr) return null;
    const clean = timeStr.trim().toUpperCase();
    if (['EARLIER', 'EARLY', 'N/A', 'NA', 'OB', 'PRE', 'ON GROUND'].some((s) => clean.includes(s))) {
      return null;
    }
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

  // Helper: Calculate duration between start and end times
  const calculateTurnaroundDuration = (
    startStr?: string,
    endStr?: string
  ): { durationText: string; minutes: number | null; isPre: boolean } => {
    const sClean = (startStr || '').trim().toUpperCase();
    const eClean = (endStr || '').trim().toUpperCase();

    // If marked earlier or n/a -> show 'PRE'
    if (
      sClean === 'EARLIER' ||
      sClean === 'EARLY' ||
      sClean === 'N/A' ||
      sClean === 'NA' ||
      sClean === 'OB' ||
      sClean === 'PRE' ||
      eClean === 'EARLIER' ||
      eClean === 'EARLY' ||
      eClean === 'N/A' ||
      eClean === 'NA' ||
      eClean === 'OB' ||
      eClean === 'PRE'
    ) {
      return { durationText: 'PRE', minutes: null, isPre: true };
    }

    if (!sClean && !eClean) {
      return { durationText: '-', minutes: null, isPre: false };
    }

    const startMin = parseTimeToMinutes(sClean);
    const endMin = parseTimeToMinutes(eClean);

    if (startMin === null || endMin === null) {
      return { durationText: sClean || eClean || '-', minutes: null, isPre: false };
    }

    let diff = endMin - startMin;
    if (diff < 0) {
      diff += 1440; // Turnaround across midnight
    }

    return {
      durationText: `${diff} MIN`,
      minutes: diff,
      isPre: false
    };
  };

  // Helper: Get Ground Time
  const getGroundTimeDisplay = (
    groundStr?: string,
    conStr?: string,
    coStr?: string,
    mode?: string
  ): { text: string; minutes: number | null } => {
    if (mode === 'DIRECT') {
      return { text: 'ON GROUND', minutes: null };
    }
    const clean = (groundStr || '').trim().toUpperCase();
    if (!clean || clean.includes('GROUND') || clean === '0 MIN' || clean === '0' || clean === 'N/A' || clean === 'EARLIER') {
      const conMin = parseTimeToMinutes(conStr);
      const coMin = parseTimeToMinutes(coStr);
      if (conMin !== null && coMin !== null) {
        let diff = coMin - conMin;
        if (diff < 0) diff += 1440;
        if (diff > 0) return { text: `${diff} MIN`, minutes: diff };
      }
      return { text: 'ON GROUND', minutes: null };
    }

    const numMatch = clean.match(/(\d+)\s*MIN/);
    if (numMatch) {
      const mins = parseInt(numMatch[1], 10);
      return { text: `${mins} MIN`, minutes: mins };
    }
    const hmMatch = clean.match(/(\d+)H\s*(\d+)M/);
    if (hmMatch) {
      const mins = parseInt(hmMatch[1], 10) * 60 + parseInt(hmMatch[2], 10);
      return { text: `${mins} MIN`, minutes: mins };
    }

    return { text: clean || 'ON GROUND', minutes: null };
  };

  // Deduplicated base reports for the selected date
  const dedupedDateReports = useMemo(() => {
    const map = new Map<string, SavedReport>();

    // 1. Process active savedReports first (they have the most accurate user-entered flight logs)
    savedReports.forEach((r) => {
      if (!isReportMatchingSelectedDate(r, selectedIsoDate)) return;

      const deptFlt = cleanFlightNum(r.formData?.deptFlt || '');
      const mainFlt = cleanFlightNum(r.flight || '');
      const arvFlt = cleanFlightNum(r.formData?.arvFlt || '');
      const fltClean = deptFlt || mainFlt || arvFlt;

      const route = `${r.formData?.deptRoute || ''} ${r.route || ''}`.toUpperCase().trim();
      const bay = (r.formData?.bay || '').toUpperCase().trim();
      const std = (r.formData?.std || '').trim();

      // Use unique report id if present, otherwise distinct flight + sector/bay key
      const key = r.id || `${fltClean}_${route}_${bay}_${std}`;
      if (!key || key === '____') return;

      map.set(key, r);
    });

    // 2. Add reports from backend snapshot if not already present
    (activeBackendSnapshot?.reportsSnapshot || []).forEach((r) => {
      if (!isReportMatchingSelectedDate(r, selectedIsoDate)) return;

      const deptFlt = cleanFlightNum(r.formData?.deptFlt || '');
      const mainFlt = cleanFlightNum(r.flight || '');
      const arvFlt = cleanFlightNum(r.formData?.arvFlt || '');
      const fltClean = deptFlt || mainFlt || arvFlt;

      const route = `${r.formData?.deptRoute || ''} ${r.route || ''}`.toUpperCase().trim();
      const bay = (r.formData?.bay || '').toUpperCase().trim();
      const std = (r.formData?.std || '').trim();

      const key = r.id || `${fltClean}_${route}_${bay}_${std}`;
      if (!key || key === '____') return;

      if (!map.has(key)) {
        map.set(key, r);
      }
    });

    // 3. Add verified historical reports (including 24 AUG BS-309 and BS-349) if not already present
    verifiedFlightReports.forEach((r) => {
      if (!isReportMatchingSelectedDate(r, selectedIsoDate)) return;

      const deptFlt = cleanFlightNum(r.formData?.deptFlt || '');
      const mainFlt = cleanFlightNum(r.flight || '');
      const arvFlt = cleanFlightNum(r.formData?.arvFlt || '');
      const fltClean = deptFlt || mainFlt || arvFlt;

      const route = `${r.formData?.deptRoute || ''} ${r.route || ''}`.toUpperCase().trim();
      const bay = (r.formData?.bay || '').toUpperCase().trim();
      const std = (r.formData?.std || '').trim();

      const key = r.id || `${fltClean}_${route}_${bay}_${std}`;
      if (!key || key === '____') return;

      // Also check by flight number key so existing user edits take precedence
      const hasFlt = Array.from(map.values()).some((ex) => {
        const exDept = cleanFlightNum(ex.formData?.deptFlt || '');
        const exMain = cleanFlightNum(ex.flight || '');
        const exArv = cleanFlightNum(ex.formData?.arvFlt || '');
        return (exDept || exMain || exArv) === fltClean;
      });

      if (!map.has(key) && !hasFlt) {
        map.set(key, r);
      }
    });

    return Array.from(map.values());
  }, [savedReports, activeBackendSnapshot, selectedIsoDate]);

  // Process & filter reports
  const processedRows = useMemo(() => {
    // 1. Filter for Scope (ALL | DOMESTIC | INTERNATIONAL)
    const scopeFiltered = dedupedDateReports.filter((r) => {
      if (flightScopeFilter === 'ALL') return true;
      const isDom = isDomesticReport(r);
      if (flightScopeFilter === 'DOMESTIC') return isDom;
      if (flightScopeFilter === 'INTERNATIONAL') return !isDom;
      return true;
    });

    // 2. Map into analyzed flight rows
    const rows = scopeFiltered.map((r, index) => {
      const flight = r.formData?.deptFlt || r.formData?.arvFlt || r.flight || 'FLT';
      const route = r.formData?.deptRoute || r.formData?.arvRoute || r.route || '-';
      const ac = r.formData?.ac || '-';
      const bay = r.formData?.bay || '-';
      const date = r.formData?.date || r.date || activeDateDisplay;
      const officer = r.officerName || 'Officer';
      const status = r.formData?.status || 'ONTIME';

      // 1. Security start to end
      const securitySt = r.formData?.securitySt || '';
      const securityEnd = r.formData?.securityEnd || '';
      const securityDuration = calculateTurnaroundDuration(securitySt, securityEnd);

      // 2. Cleaning start to end
      const cleaningSt = r.formData?.cleaningSt || '';
      const cleaningEnd = r.formData?.cleaningEnd || '';
      const cleaningDuration = calculateTurnaroundDuration(cleaningSt, cleaningEnd);

      // 3. Catering start to end
      const cateringSt = r.formData?.cateringSt || '';
      const cateringEnd = r.formData?.cateringEnd || '';
      const cateringDuration = calculateTurnaroundDuration(cateringSt, cateringEnd);

      // 4. Boarding permitted to all pax onboard
      const permit = r.formData?.permit || '';
      const pax = r.formData?.pax || '';
      const boardingDuration = calculateTurnaroundDuration(permit, pax);

      // Ground Time
      const groundTime = getGroundTimeDisplay(
        r.formData?.ground,
        r.formData?.con || r.formData?.do,
        r.formData?.co,
        r.mode
      );

      return {
        id: r.id || `row-${index}`,
        flight: flight.startsWith('BS') ? flight : `BS-${flight}`,
        rawFlight: flight,
        route,
        ac,
        bay,
        date,
        officer,
        status,
        groundTime,
        securitySt,
        securityEnd,
        securityDuration,
        cleaningSt,
        cleaningEnd,
        cleaningDuration,
        cateringSt,
        cateringEnd,
        cateringDuration,
        permit,
        pax,
        boardingDuration,
        isDomestic: isDomesticReport(r)
      };
    });

    // 3. Search query filter
    if (!searchQuery.trim()) return rows;
    const q = searchQuery.trim().toUpperCase();
    return rows.filter(
      (r) =>
        r.flight.toUpperCase().includes(q) ||
        r.route.toUpperCase().includes(q) ||
        r.ac.toUpperCase().includes(q) ||
        r.bay.toUpperCase().includes(q) ||
        r.officer.toUpperCase().includes(q)
    );
  }, [dedupedDateReports, flightScopeFilter, searchQuery, activeDateDisplay]);

  // Statistics / Average calculations
  const stats = useMemo(() => {
    let secSum = 0,
      secCount = 0;
    let cleanSum = 0,
      cleanCount = 0;
    let catSum = 0,
      catCount = 0;
    let brdSum = 0,
      brdCount = 0;
    let gndSum = 0,
      gndCount = 0;

    processedRows.forEach((r) => {
      if (r.securityDuration.minutes !== null) {
        secSum += r.securityDuration.minutes;
        secCount++;
      }
      if (r.cleaningDuration.minutes !== null) {
        cleanSum += r.cleaningDuration.minutes;
        cleanCount++;
      }
      if (r.cateringDuration.minutes !== null) {
        catSum += r.cateringDuration.minutes;
        catCount++;
      }
      if (r.boardingDuration.minutes !== null) {
        brdSum += r.boardingDuration.minutes;
        brdCount++;
      }
      if (r.groundTime.minutes !== null) {
        gndSum += r.groundTime.minutes;
        gndCount++;
      }
    });

    return {
      totalFlights: processedRows.length,
      avgSecurity: secCount > 0 ? `${Math.round(secSum / secCount)} MIN` : 'N/A',
      avgCleaning: cleanCount > 0 ? `${Math.round(cleanSum / cleanCount)} MIN` : 'N/A',
      avgCatering: catCount > 0 ? `${Math.round(catSum / catCount)} MIN` : 'N/A',
      avgBoarding: brdCount > 0 ? `${Math.round(brdSum / brdCount)} MIN` : 'N/A',
      avgGround: gndCount > 0 ? `${Math.round(gndSum / gndCount)} MIN` : 'ON GROUND'
    };
  }, [processedRows]);

  // Save Full Day Snapshot to Backend Firestore
  const handleSaveToBackend = async (showModal = true) => {
    try {
      const expiresAt = Date.now() + 30 * 24 * 60 * 60 * 1000;
      const expiresDateObj = new Date(expiresAt);
      const expiresDateStr = `${String(expiresDateObj.getDate()).padStart(2, '0')} ${expiresDateObj.toLocaleString('en-US', { month: 'short' }).toUpperCase()} ${expiresDateObj.getFullYear()}`;

      // Extract raw reports matching selected date
      const dateReports = savedReports.filter((r) => isReportMatchingSelectedDate(r, selectedIsoDate));

      const snapshotPayload: DailyAnalyticalSnapshot = {
        id: `SNAPSHOT_${selectedIsoDate}_${station || 'ALL'}`,
        dateIso: selectedIsoDate,
        dateDisplay: activeDateDisplay,
        station: station || 'ALL',
        savedAt: Date.now(),
        savedBy: {
          name: adminName || 'Admin',
          id: adminId || '001'
        },
        expiresAt,
        totalReportsCount: dateReports.length,
        reportsSnapshot: dateReports,
        timeAnalyticalData: {
          totalFlights: stats.totalFlights,
          avgSecurity: stats.avgSecurity,
          avgCleaning: stats.avgCleaning,
          avgCatering: stats.avgCatering,
          avgBoarding: stats.avgBoarding,
          avgGround: stats.avgGround
        }
      };

      await saveDailyAnalyticalSnapshotToFirestore(snapshotPayload);

      if (showModal) {
        setSavedSnapshotInfo({
          dateDisplay: activeDateDisplay,
          dateIso: selectedIsoDate,
          totalFlights: dateReports.length,
          expiresDateStr
        });
        setShowSaveSuccessModal(true);
      }
    } catch (e) {
      console.error('Error saving snapshot to backend', e);
    }
  };

  // Export to Excel / CSV
  const handleExportExcel = async () => {
    if (processedRows.length === 0) {
      showToast('No Data', 'No flight rows available to export', 'error');
      return;
    }

    // Auto-save day snapshot to backend storage with 30-day retention
    await handleSaveToBackend(true);

    const headers = [
      'SL',
      'Date',
      'Flight No',
      'Sector / Route',
      'A/C Reg',
      'Bay / Gate',
      'Ground Time',
      'Security Start',
      'Security End',
      'Security Duration',
      'Cleaning Start',
      'Cleaning End',
      'Cleaning Duration',
      'Catering Start',
      'Catering End',
      'Catering Duration',
      'Boarding Permit',
      'Pax Onboard',
      'Boarding Duration',
      'Flight Status',
      'Duty Officer'
    ];

    const rows = processedRows.map((r, i) => [
      i + 1,
      `"${r.date}"`,
      `"${r.flight}"`,
      `"${r.route}"`,
      `"${r.ac}"`,
      `"${r.bay}"`,
      `"${r.groundTime.text}"`,
      `"${r.securitySt}"`,
      `"${r.securityEnd}"`,
      `"${r.securityDuration.durationText}"`,
      `"${r.cleaningSt}"`,
      `"${r.cleaningEnd}"`,
      `"${r.cleaningDuration.durationText}"`,
      `"${r.cateringSt}"`,
      `"${r.cateringEnd}"`,
      `"${r.cateringDuration.durationText}"`,
      `"${r.permit}"`,
      `"${r.pax}"`,
      `"${r.boardingDuration.durationText}"`,
      `"${r.status}"`,
      `"${r.officer}"`
    ]);

    const csvContent =
      'data:text/csv;charset=utf-8,\uFEFF' +
      [
        `US-BANGLA AIRLINES - TIME & TURNAROUND ANALYTICAL REPORT (${activeDateDisplay} - ${flightScopeFilter})`,
        `Generated By: ${adminName} (${adminId}) | Station: ${station}`,
        '',
        headers.join(','),
        ...rows.map((e) => e.join(','))
      ].join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute(
      'download',
      `US_BANGLA_TIME_ANALYTICS_${activeDateDisplay.replace(/\s+/g, '_')}_${flightScopeFilter}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('Excel/CSV Exported', 'File downloaded successfully', 'success');
  };

  // Download High-Resolution Official JPG Card
  const handleDownloadJPG = async () => {
    if (!printCardRef.current) {
      showToast('Error', 'Photo Card canvas element not found', 'error');
      return;
    }
    try {
      setIsDownloading(true);
      showToast('Generating High-Res JPG...', 'Rendering official photo card at 1200px', 'info');

      // Auto-save day snapshot to backend storage with 30-day retention
      await handleSaveToBackend(true);

      // Allow DOM to settle
      await new Promise((resolve) => setTimeout(resolve, 350));

      const canvas = await captureHtml2CanvasSafe(printCardRef.current, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#ffffff',
        logging: false
      });

      const imgData = canvas.toDataURL('image/jpeg', 0.96);
      const link = document.createElement('a');
      link.href = imgData;
      link.download = `US_BANGLA_TIME_ANALYTICAL_REPORT_${activeDateDisplay.replace(/\s+/g, '_')}_${flightScopeFilter}.jpg`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      showToast('Official JPG Downloaded!', 'High-resolution photo card saved to your device', 'success');
    } catch (e) {
      console.error('Failed to download JPG', e);
      showToast('Download Failed', 'Could not generate JPG file', 'error');
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 overflow-hidden fade-in">
      <div className="bg-slate-900 border-2 border-cyan-500/60 rounded-3xl w-full max-w-[98vw] lg:max-w-7xl h-[94vh] max-h-[96vh] flex flex-col shadow-2xl overflow-hidden my-auto">
        
        {/* Modal Top Header Bar */}
        <div className="py-2.5 px-4 bg-slate-950 border-b border-cyan-500/30 flex items-center justify-between shrink-0 flex-wrap gap-2">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-cyan-500/20 border border-cyan-400/50 flex items-center justify-center text-cyan-400 shadow">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-sm sm:text-base font-black text-cyan-400 uppercase tracking-wider font-sans">
                  TIME ANALYTICAL REPORT
                </h2>
                <span className="text-[10px] font-mono font-bold px-2.5 py-0.5 rounded-full bg-slate-900 text-cyan-300 border border-cyan-500/40 flex items-center gap-1">
                  <Calendar className="w-3 h-3 text-cyan-400" />
                  {activeDateDisplay}
                </span>
                {isTodaySelected && (
                  <span className="text-[9px] font-black px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 tracking-wider font-mono">
                    TODAY (AUTO)
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-400 font-sans hidden sm:block">
                Turnaround duration breakdown for Security, Cleaning, Catering, Boarding & Ground Time
              </p>
            </div>
          </div>

          {/* Action Buttons, Date Selector & Photo Upload */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* Custom Plane Photo Upload Input */}
            <input
              type="file"
              ref={fileInputRef}
              accept="image/*"
              onChange={handleCustomPhotoUpload}
              className="hidden"
            />
            
            <button
              onClick={() => fileInputRef.current?.click()}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-cyan-300 font-bold text-xs rounded-xl border border-cyan-500/40 shadow active:scale-95 transition-all flex items-center gap-1.5 cursor-pointer"
              title="Upload your custom US-Bangla aircraft photo for the photo card"
            >
              <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
              <span>{customHeaderPhoto ? 'CHANGE PLANE PHOTO' : 'UPLOAD PLANE PHOTO'}</span>
            </button>
            {customHeaderPhoto && (
              <button
                onClick={() => setCustomHeaderPhoto(null)}
                className="px-2 py-1.5 bg-rose-950/70 hover:bg-rose-900 text-rose-300 font-bold text-[11px] rounded-xl border border-rose-500/40 active:scale-95 transition-all cursor-pointer"
                title="Reset to default US-Bangla HD aircraft photo"
              >
                RESET
              </button>
            )}

            {/* Date Picker Box */}
            <div className="flex items-center gap-1.5 bg-slate-900 border border-cyan-500/40 rounded-xl px-2.5 py-1 shadow-inner">
              <Calendar className="w-3.5 h-3.5 text-cyan-400" />
              <input
                type="date"
                value={selectedIsoDate}
                onChange={(e) => setSelectedIsoDate(e.target.value)}
                className="bg-transparent text-xs text-cyan-300 font-mono font-bold outline-none cursor-pointer scheme-dark"
                title="Select date to analyze durations"
              />
            </div>

            {!isTodaySelected && (
              <button
                onClick={() => setSelectedIsoDate(todayIso)}
                className="px-2.5 py-1 bg-emerald-950 hover:bg-emerald-900 text-emerald-300 text-xs font-bold rounded-xl border border-emerald-500/50 transition-colors cursor-pointer flex items-center gap-1"
                title="Jump back to Today"
              >
                <Calendar className="w-3.5 h-3.5" />
                <span>TODAY</span>
              </button>
            )}

            {/* Excel Download */}
            <button
              onClick={handleExportExcel}
              className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-emerald-400 border border-emerald-500/40 text-xs font-black rounded-xl active:scale-95 transition-all cursor-pointer flex items-center gap-1.5 shadow"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
              <span>EXCEL / CSV</span>
            </button>

            {/* Official JPG Download */}
            <button
              onClick={handleDownloadJPG}
              disabled={isDownloading}
              className="px-4 py-1.5 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 text-xs font-black rounded-xl active:scale-95 transition-all cursor-pointer flex items-center gap-1.5 shadow-lg shadow-cyan-500/20 disabled:opacity-50"
            >
              <Download className="w-3.5 h-3.5 text-slate-950" />
              <span>{isDownloading ? 'EXPORTING...' : 'OFFICIAL JPG'}</span>
            </button>

            {/* Close Modal Button */}
            <button
              onClick={onClose}
              className="p-1.5 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors cursor-pointer border border-slate-700"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* View Tabs & Category Filters */}
        <div className="bg-slate-950/80 border-b border-slate-800 px-4 py-2 flex items-center justify-between flex-wrap gap-3 shrink-0">
          
          {/* Category Tabs: ALL | DOMESTIC | INTERNATIONAL */}
          <div className="flex items-center gap-1.5 bg-slate-900 p-1 rounded-xl border border-slate-800">
            <button
              onClick={() => setFlightScopeFilter('ALL')}
              className={`px-3 py-1 rounded-lg text-xs font-black transition-all cursor-pointer flex items-center gap-1.5 ${
                flightScopeFilter === 'ALL'
                  ? 'bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/20'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>ALL FLIGHTS ({dedupedDateReports.length})</span>
            </button>
            <button
              onClick={() => setFlightScopeFilter('DOMESTIC')}
              className={`px-3 py-1 rounded-lg text-xs font-black transition-all cursor-pointer flex items-center gap-1.5 ${
                flightScopeFilter === 'DOMESTIC'
                  ? 'bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/20'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Plane className="w-3.5 h-3.5" />
              <span>DOMESTIC ({dedupedDateReports.filter((r) => isDomesticReport(r)).length})</span>
            </button>
            <button
              onClick={() => setFlightScopeFilter('INTERNATIONAL')}
              className={`px-3 py-1 rounded-lg text-xs font-black transition-all cursor-pointer flex items-center gap-1.5 ${
                flightScopeFilter === 'INTERNATIONAL'
                  ? 'bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/20'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Plane className="w-3.5 h-3.5 rotate-45" />
              <span>INTERNATIONAL ({dedupedDateReports.filter((r) => !isDomesticReport(r)).length})</span>
            </button>
          </div>

          {/* Search Box */}
          <div className="relative min-w-[220px] max-w-xs flex-1">
            <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search flight, route, A/C, bay..."
              className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-8 pr-3 py-1 text-xs text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-cyan-500"
            />
          </div>

          {/* Mode Switcher: HUD Table vs Photo Card Preview */}
          <div className="flex items-center gap-1 bg-slate-900 p-1 rounded-xl border border-slate-800">
            <button
              onClick={() => setActiveTab('HUD_TABLE')}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'HUD_TABLE'
                  ? 'bg-slate-800 text-cyan-300 border border-cyan-500/40 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <TableIcon className="w-3.5 h-3.5" />
              <span>HUD TABLE</span>
            </button>
            <button
              onClick={() => setActiveTab('PHOTO_CARD')}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'PHOTO_CARD'
                  ? 'bg-slate-800 text-cyan-300 border border-cyan-500/40 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <ImageIcon className="w-3.5 h-3.5" />
              <span>PHOTO CARD PREVIEW</span>
            </button>
          </div>
        </div>

        {/* Modal Body Container */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-4 bg-slate-950/60">
          
          {/* 30-DAY BACKEND CLOUD STORAGE RANGE & RETENTION BANNER */}
          <div className="bg-gradient-to-r from-slate-950 via-cyan-950/40 to-slate-950 border border-cyan-500/40 rounded-2xl p-3 sm:p-3.5 flex items-center justify-between flex-wrap gap-3 shadow-lg">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-cyan-500/20 border border-cyan-400/50 flex items-center justify-center text-cyan-400 shrink-0">
                <Database className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 font-mono">
                    30-DAY CLOUD STORAGE
                  </span>
                  <span className="text-xs font-black text-white font-mono tracking-wider">
                    ARCHIVE RANGE: <span className="text-cyan-400">{backendArchiveRange.rangeText}</span>
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 font-sans mt-0.5">
                  Full-day turnaround records are securely backed up in Firestore for 30 days and vanish automatically after retention.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {activeBackendSnapshot ? (
                <span className="text-xs font-mono font-bold px-3 py-1.5 rounded-xl bg-cyan-500/20 text-cyan-300 border border-cyan-500/50 flex items-center gap-1.5 shadow-sm">
                  <Check className="w-3.5 h-3.5 text-cyan-400" />
                  <span>BACKEND ARCHIVED ({activeBackendSnapshot.reportsSnapshot?.length || activeBackendSnapshot.totalReportsCount} FLTS)</span>
                </span>
              ) : (
                <button
                  onClick={() => handleSaveToBackend(true)}
                  className="px-3.5 py-1.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-black text-xs transition-all shadow-md active:scale-95 cursor-pointer flex items-center gap-1.5"
                  title="Archive full day turnaround data to backend storage now"
                >
                  <Database className="w-3.5 h-3.5" />
                  <span>SAVE TO BACKEND</span>
                </button>
              )}
            </div>
          </div>

          {/* Quick Metrics Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
            <div className="bg-slate-900/90 border border-cyan-500/30 rounded-2xl p-3 shadow">
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">TOTAL FLIGHTS</span>
              <span className="text-xl font-black text-cyan-400 font-mono mt-0.5 block">{stats.totalFlights}</span>
            </div>
            <div className="bg-slate-900/90 border border-amber-500/30 rounded-2xl p-3 shadow">
              <span className="text-[10px] text-amber-400/80 font-bold uppercase tracking-wider block">AVG GROUND TIME</span>
              <span className="text-xl font-black text-amber-400 font-mono mt-0.5 block">{stats.avgGround}</span>
            </div>
            <div className="bg-slate-900/90 border border-indigo-500/30 rounded-2xl p-3 shadow">
              <span className="text-[10px] text-indigo-400/80 font-bold uppercase tracking-wider block">AVG SECURITY</span>
              <span className="text-xl font-black text-indigo-400 font-mono mt-0.5 block">{stats.avgSecurity}</span>
            </div>
            <div className="bg-slate-900/90 border border-teal-500/30 rounded-2xl p-3 shadow">
              <span className="text-[10px] text-teal-400/80 font-bold uppercase tracking-wider block">AVG CLEANING</span>
              <span className="text-xl font-black text-teal-400 font-mono mt-0.5 block">{stats.avgCleaning}</span>
            </div>
            <div className="bg-slate-900/90 border border-purple-500/30 rounded-2xl p-3 shadow">
              <span className="text-[10px] text-purple-400/80 font-bold uppercase tracking-wider block">AVG CATERING</span>
              <span className="text-xl font-black text-purple-400 font-mono mt-0.5 block">{stats.avgCatering}</span>
            </div>
            <div className="bg-slate-900/90 border border-emerald-500/30 rounded-2xl p-3 shadow">
              <span className="text-[10px] text-emerald-400/80 font-bold uppercase tracking-wider block">AVG BOARDING</span>
              <span className="text-xl font-black text-emerald-400 font-mono mt-0.5 block">{stats.avgBoarding}</span>
            </div>
          </div>

          {/* TAB 1: HUD TABLE VIEW */}
          {activeTab === 'HUD_TABLE' && (
            <div className="bg-slate-900/90 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-950 text-slate-400 uppercase font-mono text-[10px] tracking-wider border-b border-slate-800">
                      <th className="py-3 px-3 text-center w-10">#</th>
                      <th className="py-3 px-3">FLIGHT</th>
                      <th className="py-3 px-3">ROUTE</th>
                      <th className="py-3 px-3">A/C & BAY</th>
                      <th className="py-3 px-3 text-amber-300">GROUND TIME</th>
                      <th className="py-3 px-3 text-indigo-300">SECURITY <span className="text-[9px] text-slate-500">(ST - END)</span></th>
                      <th className="py-3 px-3 text-teal-300">CLEANING <span className="text-[9px] text-slate-500">(ST - END)</span></th>
                      <th className="py-3 px-3 text-purple-300">CATERING <span className="text-[9px] text-slate-500">(ST - END)</span></th>
                      <th className="py-3 px-3 text-emerald-300">BOARDING <span className="text-[9px] text-slate-500">(PERMIT - PAX)</span></th>
                      <th className="py-3 px-3">STATUS</th>
                      <th className="py-3 px-3">OFFICER</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 font-sans text-slate-200">
                    {processedRows.length === 0 ? (
                      <tr>
                        <td colSpan={11} className="py-12 text-center text-slate-500 font-mono text-xs">
                          No turnaround duration records found for {activeDateDisplay} ({flightScopeFilter}).
                        </td>
                      </tr>
                    ) : (
                      processedRows.map((row, idx) => (
                        <tr key={row.id} className="hover:bg-slate-800/40 transition-colors">
                          <td className="py-2.5 px-3 text-center font-mono text-slate-500 text-[11px]">{idx + 1}</td>
                          <td className="py-2.5 px-3 font-mono font-bold text-white text-xs">
                            <span className="flex items-center gap-1.5">
                              <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
                              {row.flight}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 font-mono font-black text-amber-300 text-xs">{row.route}</td>
                          <td className="py-2.5 px-3 font-mono text-slate-300 text-[11px]">
                            <div>{row.ac}</div>
                            <div className="text-[10px] text-slate-400">BAY: {row.bay}</div>
                          </td>
                          <td className="py-2.5 px-3 font-mono">
                            <span
                              className={`px-2 py-0.5 rounded-md font-black text-[11px] ${
                                row.groundTime.text === 'ON GROUND'
                                  ? 'bg-slate-800 text-slate-400 border border-slate-700'
                                  : 'bg-amber-950/80 text-amber-300 border border-amber-500/40'
                              }`}
                            >
                              {row.groundTime.text}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 font-mono">
                            <div className="flex items-center gap-1.5">
                              <span
                                className={`px-2 py-0.5 rounded-md font-black text-[11px] ${
                                  row.securityDuration.durationText === 'PRE'
                                    ? 'bg-slate-800 text-cyan-300 border border-cyan-500/30'
                                    : row.securityDuration.minutes !== null
                                    ? 'bg-indigo-950/80 text-indigo-300 border border-indigo-500/40'
                                    : 'text-slate-500'
                                }`}
                              >
                                {row.securityDuration.durationText}
                              </span>
                              {row.securitySt && row.securityEnd && (
                                <span className="text-[10px] text-slate-400 font-sans">
                                  ({row.securitySt}-{row.securityEnd})
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="py-2.5 px-3 font-mono">
                            <div className="flex items-center gap-1.5">
                              <span
                                className={`px-2 py-0.5 rounded-md font-black text-[11px] ${
                                  row.cleaningDuration.durationText === 'PRE'
                                    ? 'bg-slate-800 text-cyan-300 border border-cyan-500/30'
                                    : row.cleaningDuration.minutes !== null
                                    ? 'bg-teal-950/80 text-teal-300 border border-teal-500/40'
                                    : 'text-slate-500'
                                }`}
                              >
                                {row.cleaningDuration.durationText}
                              </span>
                              {row.cleaningSt && row.cleaningEnd && (
                                <span className="text-[10px] text-slate-400 font-sans">
                                  ({row.cleaningSt}-{row.cleaningEnd})
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="py-2.5 px-3 font-mono">
                            <div className="flex items-center gap-1.5">
                              <span
                                className={`px-2 py-0.5 rounded-md font-black text-[11px] ${
                                  row.cateringDuration.durationText === 'PRE'
                                    ? 'bg-slate-800 text-cyan-300 border border-cyan-500/30'
                                    : row.cateringDuration.minutes !== null
                                    ? 'bg-purple-950/80 text-purple-300 border border-purple-500/40'
                                    : 'text-slate-500'
                                }`}
                              >
                                {row.cateringDuration.durationText}
                              </span>
                              {row.cateringSt && row.cateringEnd && (
                                <span className="text-[10px] text-slate-400 font-sans">
                                  ({row.cateringSt}-{row.cateringEnd})
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="py-2.5 px-3 font-mono">
                            <div className="flex items-center gap-1.5">
                              <span
                                className={`px-2 py-0.5 rounded-md font-black text-[11px] ${
                                  row.boardingDuration.durationText === 'PRE'
                                    ? 'bg-slate-800 text-cyan-300 border border-cyan-500/30'
                                    : row.boardingDuration.minutes !== null
                                    ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-500/40'
                                    : 'text-slate-500'
                                }`}
                              >
                                {row.boardingDuration.durationText}
                              </span>
                              {row.permit && row.pax && (
                                <span className="text-[10px] text-slate-400 font-sans">
                                  ({row.permit}-{row.pax})
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="py-2.5 px-3">
                            <span
                              className={`text-[10px] font-black px-2 py-0.5 rounded-md uppercase ${
                                row.status.includes('DELAY')
                                  ? 'bg-rose-950 text-rose-400 border border-rose-500/40'
                                  : 'bg-emerald-950 text-emerald-400 border border-emerald-500/40'
                              }`}
                            >
                              {row.status}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-[11px] text-slate-300 font-medium">
                            {row.officer}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* HIGH-RESOLUTION TIME ANALYTICAL PHOTO CARD (EXPORTED TO OFFICIAL JPG)     */}
          {/* Rendered directly in DOM for live preview and 100% reliable JPG capture   */}
          {/* ========================================================================= */}
          <div className="pt-2 space-y-3">
            <div className="flex items-center justify-between text-xs text-slate-400 flex-wrap gap-2">
              <span className="font-black uppercase text-cyan-400 flex items-center gap-1.5">
                <ImageIcon className="w-4 h-4" /> OFFICIAL HIGH-RESOLUTION TIME ANALYTICAL PHOTO CARD
              </span>
              <div className="flex items-center gap-2">
                <span className="text-slate-400 font-mono text-[11px]">Retina Canvas 1200px Width</span>
                <button
                  onClick={handleDownloadJPG}
                  disabled={isDownloading}
                  className="px-3 py-1 bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-xs font-black rounded-lg transition-all cursor-pointer flex items-center gap-1"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>{isDownloading ? 'SAVING...' : 'DOWNLOAD JPG'}</span>
                </button>
              </div>
            </div>

            {/* Scrollable Container containing the 1200px Card */}
            <div className="p-2 bg-slate-950 border border-cyan-500/50 rounded-2xl overflow-x-auto shadow-2xl">
              <div
                ref={printCardRef}
                style={{
                  width: '1200px',
                  minHeight: '1400px',
                  backgroundColor: '#ffffff',
                  color: '#0f172a',
                  fontFamily: 'system-ui, -apple-system, sans-serif',
                  padding: '36px',
                  borderRadius: '16px',
                  border: '4px solid #0284c7',
                  boxSizing: 'border-box',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between'
                }}
              >
                <div>
                  {/* 1. Header Box with Navy Bar and Aircraft Tarmac Banner */}
                  <div
                    style={{
                      marginBottom: '24px',
                      borderRadius: '16px',
                      overflow: 'hidden',
                      border: '2px solid #031b4e',
                      boxShadow: '0 8px 20px rgba(3, 27, 78, 0.12)'
                    }}
                  >
                    {/* Top Navy Bar */}
                    <div
                      style={{
                        backgroundColor: '#031b4e',
                        padding: '18px 26px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        color: '#ffffff'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                        <div
                          style={{
                            width: '54px',
                            height: '54px',
                            borderRadius: '14px',
                            backgroundColor: '#0284c7',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '28px',
                            fontWeight: '900',
                            color: '#ffffff',
                            boxShadow: '0 4px 12px rgba(2, 132, 199, 0.4)'
                          }}
                        >
                          ⏱
                        </div>
                        <div>
                          <div style={{ fontSize: '32px', fontWeight: '900', color: '#ffffff', letterSpacing: '1px', lineHeight: '1.1' }}>
                            US BANGLA AIRLINES
                          </div>
                          <div style={{ fontSize: '15px', fontWeight: '800', color: '#38bdf8', letterSpacing: '0.8px', marginTop: '4px' }}>
                            TIME ANALYTICAL REPORT • {activeDateDisplay}
                          </div>
                        </div>
                      </div>

                      <div style={{ textAlign: 'right', fontFamily: 'monospace', fontSize: '12px' }}>
                        <div style={{ backgroundColor: '#0f2963', border: '1.5px solid #38bdf8', padding: '6px 16px', borderRadius: '20px', color: '#ffffff', fontWeight: '900', marginBottom: '6px', display: 'inline-block' }}>
                          TURNAROUND & GROUND DURATION AUDIT
                        </div>
                        <div style={{ color: '#93c5fd', marginTop: '2px' }}>
                          STATION: <strong style={{ color: '#ffffff', fontWeight: '900' }}>
                            {station} ({flightScopeFilter === 'DOMESTIC' ? 'DOMESTIC FLIGHTS' : flightScopeFilter === 'INTERNATIONAL' ? 'INTERNATIONAL FLIGHTS' : 'ALL FLIGHTS'})
                          </strong>
                        </div>
                        <div style={{ color: '#93c5fd' }}>
                          DATE: <strong style={{ color: '#38bdf8', fontWeight: '900' }}>{fullDateDisplay}</strong>
                        </div>
                      </div>
                    </div>

                    {/* Aircraft Photo Banner */}
                    <div style={{ width: '100%', height: '240px', position: 'relative', overflow: 'hidden', backgroundColor: '#0f172a' }}>
                      <img
                        src={customHeaderPhoto || aircraftImage}
                        alt="US-Bangla Aircraft Banner"
                        referrerPolicy="no-referrer"
                        crossOrigin="anonymous"
                        style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center 45%' }}
                      />
                      <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(3, 27, 78, 0.75) 0%, transparent 65%)' }} />
                      <div style={{ position: 'absolute', bottom: '12px', left: '20px', right: '20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: '#ffffff', fontFamily: 'sans-serif', fontSize: '11px', fontWeight: '800', letterSpacing: '0.5px' }}>
                        <span style={{ backgroundColor: 'rgba(3, 27, 78, 0.85)', padding: '4px 12px', borderRadius: '6px', border: '1px solid #38bdf8' }}>
                          US-BANGLA AIRLINES FLEET • RAMP & GROUND OPERATIONS
                        </span>
                        <span style={{ backgroundColor: 'rgba(15, 23, 42, 0.85)', padding: '4px 12px', borderRadius: '6px', border: '1px solid #38bdf8', color: '#38bdf8' }}>
                          TURNAROUND TIME ANALYTICAL BRIEF
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* 2. KPI Summary Row (6 Metric Boxes) */}
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(6, 1fr)',
                      gap: '12px',
                      marginBottom: '24px'
                    }}
                  >
                    {/* KPI 1: TOTAL FLIGHTS */}
                    <div
                      style={{
                        backgroundColor: '#eff6ff',
                        border: '2px solid #0284c7',
                        borderRadius: '12px',
                        padding: '14px 10px',
                        textAlign: 'center',
                        boxShadow: '0 2px 4px rgba(0, 0, 0, 0.03)'
                      }}
                    >
                      <div style={{ fontSize: '11px', fontWeight: '900', color: '#0369a1', textTransform: 'uppercase' }}>
                        TOTAL FLIGHTS
                      </div>
                      <div style={{ fontSize: '28px', fontWeight: '900', color: '#0f172a', fontFamily: 'monospace', margin: '6px 0 2px 0' }}>
                        {stats.totalFlights}
                      </div>
                      <div style={{ fontSize: '10px', color: '#64748b', fontWeight: '700' }}>Evaluated Flights</div>
                    </div>

                    {/* KPI 2: AVG GROUND TIME */}
                    <div
                      style={{
                        backgroundColor: '#fffbeb',
                        border: '2px solid #f59e0b',
                        borderRadius: '12px',
                        padding: '14px 10px',
                        textAlign: 'center',
                        boxShadow: '0 2px 4px rgba(0, 0, 0, 0.03)'
                      }}
                    >
                      <div style={{ fontSize: '11px', fontWeight: '900', color: '#b45309', textTransform: 'uppercase' }}>
                        AVG GROUND TIME
                      </div>
                      <div style={{ fontSize: '24px', fontWeight: '900', color: '#d97706', fontFamily: 'monospace', margin: '6px 0 2px 0' }}>
                        {stats.avgGround}
                      </div>
                      <div style={{ fontSize: '10px', color: '#b45309', fontWeight: '700' }}>Chox-On to Chox-Off</div>
                    </div>

                    {/* KPI 3: AVG SECURITY */}
                    <div
                      style={{
                        backgroundColor: '#eef2ff',
                        border: '2px solid #6366f1',
                        borderRadius: '12px',
                        padding: '14px 10px',
                        textAlign: 'center',
                        boxShadow: '0 2px 4px rgba(0, 0, 0, 0.03)'
                      }}
                    >
                      <div style={{ fontSize: '11px', fontWeight: '900', color: '#4338ca', textTransform: 'uppercase' }}>
                        AVG SECURITY
                      </div>
                      <div style={{ fontSize: '24px', fontWeight: '900', color: '#4f46e5', fontFamily: 'monospace', margin: '6px 0 2px 0' }}>
                        {stats.avgSecurity}
                      </div>
                      <div style={{ fontSize: '10px', color: '#4338ca', fontWeight: '700' }}>ST to END</div>
                    </div>

                    {/* KPI 4: AVG CLEANING */}
                    <div
                      style={{
                        backgroundColor: '#f0fdfa',
                        border: '2px solid #0d9488',
                        borderRadius: '12px',
                        padding: '14px 10px',
                        textAlign: 'center',
                        boxShadow: '0 2px 4px rgba(0, 0, 0, 0.03)'
                      }}
                    >
                      <div style={{ fontSize: '11px', fontWeight: '900', color: '#0f766e', textTransform: 'uppercase' }}>
                        AVG CLEANING
                      </div>
                      <div style={{ fontSize: '24px', fontWeight: '900', color: '#0d9488', fontFamily: 'monospace', margin: '6px 0 2px 0' }}>
                        {stats.avgCleaning}
                      </div>
                      <div style={{ fontSize: '10px', color: '#0f766e', fontWeight: '700' }}>ST to END</div>
                    </div>

                    {/* KPI 5: AVG CATERING */}
                    <div
                      style={{
                        backgroundColor: '#faf5ff',
                        border: '2px solid #9333ea',
                        borderRadius: '12px',
                        padding: '14px 10px',
                        textAlign: 'center',
                        boxShadow: '0 2px 4px rgba(0, 0, 0, 0.03)'
                      }}
                    >
                      <div style={{ fontSize: '11px', fontWeight: '900', color: '#7e22ce', textTransform: 'uppercase' }}>
                        AVG CATERING
                      </div>
                      <div style={{ fontSize: '24px', fontWeight: '900', color: '#9333ea', fontFamily: 'monospace', margin: '6px 0 2px 0' }}>
                        {stats.avgCatering}
                      </div>
                      <div style={{ fontSize: '10px', color: '#7e22ce', fontWeight: '700' }}>ST to END</div>
                    </div>

                    {/* KPI 6: AVG BOARDING */}
                    <div
                      style={{
                        backgroundColor: '#f0fdf4',
                        border: '2px solid #16a34a',
                        borderRadius: '12px',
                        padding: '14px 10px',
                        textAlign: 'center',
                        boxShadow: '0 2px 4px rgba(0, 0, 0, 0.03)'
                      }}
                    >
                      <div style={{ fontSize: '11px', fontWeight: '900', color: '#15803d', textTransform: 'uppercase' }}>
                        AVG BOARDING
                      </div>
                      <div style={{ fontSize: '24px', fontWeight: '900', color: '#16a34a', fontFamily: 'monospace', margin: '6px 0 2px 0' }}>
                        {stats.avgBoarding}
                      </div>
                      <div style={{ fontSize: '10px', color: '#15803d', fontWeight: '700' }}>Permit to Last Pax</div>
                    </div>
                  </div>

                  {/* 3. Turnaround Duration Table */}
                  <div style={{ marginBottom: '24px', borderRadius: '12px', overflow: 'hidden', border: '1.5px solid #031b4e' }}>
                    <div
                      style={{
                        backgroundColor: '#031b4e',
                        color: '#ffffff',
                        padding: '12px 18px',
                        fontSize: '14px',
                        fontWeight: '900',
                        letterSpacing: '0.5px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span>⏱</span> TURNAROUND ACTIVITY DURATION AUDIT (MINUTES & TIMESTAMPS)
                      </div>
                      <span style={{ fontSize: '11px', fontFamily: 'monospace', color: '#93c5fd' }}>
                        {processedRows.length} FLIGHTS RECORDED
                      </span>
                    </div>

                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', fontFamily: 'sans-serif' }}>
                      <thead>
                        <tr style={{ backgroundColor: '#0f2963', color: '#ffffff' }}>
                          <th style={{ padding: '10px 8px', border: '1px solid #1e3a8a', width: '4%', textAlign: 'center', fontWeight: '900' }}>#</th>
                          <th style={{ padding: '10px 8px', border: '1px solid #1e3a8a', width: '11%', textAlign: 'left', fontWeight: '900' }}>FLIGHT</th>
                          <th style={{ padding: '10px 8px', border: '1px solid #1e3a8a', width: '10%', textAlign: 'left', fontWeight: '900' }}>ROUTE</th>
                          <th style={{ padding: '10px 8px', border: '1px solid #1e3a8a', width: '10%', textAlign: 'left', fontWeight: '900' }}>A/C & BAY</th>
                          <th style={{ padding: '10px 8px', border: '1px solid #1e3a8a', width: '10%', textAlign: 'center', fontWeight: '900' }}>GROUND TIME</th>
                          <th style={{ padding: '10px 8px', border: '1px solid #1e3a8a', width: '12%', textAlign: 'center', fontWeight: '900' }}>SECURITY (ST-END)</th>
                          <th style={{ padding: '10px 8px', border: '1px solid #1e3a8a', width: '12%', textAlign: 'center', fontWeight: '900' }}>CLEANING (ST-END)</th>
                          <th style={{ padding: '10px 8px', border: '1px solid #1e3a8a', width: '12%', textAlign: 'center', fontWeight: '900' }}>CATERING (ST-END)</th>
                          <th style={{ padding: '10px 8px', border: '1px solid #1e3a8a', width: '12%', textAlign: 'center', fontWeight: '900' }}>BOARDING (PERMIT-PAX)</th>
                          <th style={{ padding: '10px 8px', border: '1px solid #1e3a8a', width: '7%', textAlign: 'center', fontWeight: '900' }}>STATUS</th>
                        </tr>
                      </thead>
                      <tbody>
                        {processedRows.length === 0 ? (
                          <tr>
                            <td colSpan={10} style={{ padding: '24px', textAlign: 'center', color: '#64748b', fontWeight: '800', backgroundColor: '#f8fafc' }}>
                              NO TURNAROUND DURATION RECORDS FOUND FOR {activeDateDisplay}.
                            </td>
                          </tr>
                        ) : (
                          processedRows.map((r, idx) => (
                            <tr key={r.id} style={{ backgroundColor: idx % 2 === 0 ? '#ffffff' : '#f8fafc' }}>
                              <td style={{ padding: '8px', border: '1px solid #cbd5e1', textAlign: 'center', fontWeight: '800', color: '#64748b', fontSize: '12px' }}>
                                {idx + 1}
                              </td>
                              <td style={{ padding: '8px', border: '1px solid #cbd5e1', fontWeight: '900', color: '#031b4e', fontFamily: 'monospace' }}>
                                {r.flight}
                              </td>
                              <td style={{ padding: '8px', border: '1px solid #cbd5e1', fontWeight: '900', color: '#b45309', fontFamily: 'monospace' }}>
                                {r.route}
                              </td>
                              <td style={{ padding: '8px', border: '1px solid #cbd5e1', color: '#334155', fontSize: '12px', fontFamily: 'monospace' }}>
                                <strong>{r.ac}</strong> <span style={{ color: '#64748b' }}>({r.bay})</span>
                              </td>
                              <td style={{ padding: '8px', border: '1px solid #cbd5e1', textAlign: 'center', fontFamily: 'monospace', fontWeight: '900', color: '#b45309' }}>
                                {r.groundTime.text}
                              </td>
                              <td style={{ padding: '8px', border: '1px solid #cbd5e1', textAlign: 'center', fontFamily: 'monospace', fontWeight: '900', color: '#4338ca' }}>
                                <span>{r.securityDuration.durationText}</span>
                                {r.securitySt && r.securityEnd && (
                                  <div style={{ fontSize: '10px', color: '#64748b', fontWeight: 'normal' }}>({r.securitySt}-{r.securityEnd})</div>
                                )}
                              </td>
                              <td style={{ padding: '8px', border: '1px solid #cbd5e1', textAlign: 'center', fontFamily: 'monospace', fontWeight: '900', color: '#0f766e' }}>
                                <span>{r.cleaningDuration.durationText}</span>
                                {r.cleaningSt && r.cleaningEnd && (
                                  <div style={{ fontSize: '10px', color: '#64748b', fontWeight: 'normal' }}>({r.cleaningSt}-{r.cleaningEnd})</div>
                                )}
                              </td>
                              <td style={{ padding: '8px', border: '1px solid #cbd5e1', textAlign: 'center', fontFamily: 'monospace', fontWeight: '900', color: '#7e22ce' }}>
                                <span>{r.cateringDuration.durationText}</span>
                                {r.cateringSt && r.cateringEnd && (
                                  <div style={{ fontSize: '10px', color: '#64748b', fontWeight: 'normal' }}>({r.cateringSt}-{r.cateringEnd})</div>
                                )}
                              </td>
                              <td style={{ padding: '8px', border: '1px solid #cbd5e1', textAlign: 'center', fontFamily: 'monospace', fontWeight: '900', color: '#15803d' }}>
                                <span>{r.boardingDuration.durationText}</span>
                                {r.permit && r.pax && (
                                  <div style={{ fontSize: '10px', color: '#64748b', fontWeight: 'normal' }}>({r.permit}-{r.pax})</div>
                                )}
                              </td>
                              <td style={{ padding: '8px', border: '1px solid #cbd5e1', textAlign: 'center' }}>
                                <span
                                  style={{
                                    display: 'inline-block',
                                    padding: '2px 6px',
                                    borderRadius: '4px',
                                    fontSize: '10px',
                                    fontWeight: '900',
                                    fontFamily: 'monospace',
                                    backgroundColor: r.status.includes('DELAY') ? '#fee2e2' : '#dcfce7',
                                    color: r.status.includes('DELAY') ? '#b91c1c' : '#15803d',
                                    border: `1px solid ${r.status.includes('DELAY') ? '#f87171' : '#86efac'}`
                                  }}
                                >
                                  {r.status}
                                </span>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>

                  {/* 4. Turnaround Operational Remarks Note */}
                  <div
                    style={{
                      backgroundColor: '#f8fafc',
                      border: '2px solid #94a3b8',
                      borderLeft: '6px solid #0284c7',
                      borderRadius: '12px',
                      padding: '16px 20px',
                      marginBottom: '20px'
                    }}
                  >
                    <div style={{ fontSize: '14px', fontWeight: '900', color: '#031b4e', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span>📋</span> TIME AUDIT & TURNAROUND EFFICIENCY REMARKS:
                    </div>
                    <div style={{ fontSize: '13px', color: '#334155', lineHeight: '1.5', fontFamily: 'sans-serif', fontWeight: '700' }}>
                      • Recorded average turnaround ground time is <strong style={{ color: '#b45309' }}>{stats.avgGround}</strong> across {stats.totalFlights} evaluated flights at Station {station}.<br />
                      • Security & Cleaning readiness achieved an average duration of <strong style={{ color: '#4338ca' }}>{stats.avgSecurity}</strong> and <strong style={{ color: '#0f766e' }}>{stats.avgCleaning}</strong> respectively.<br />
                      • Passenger boarding permit to last passenger onboard was clocked at an average of <strong style={{ color: '#15803d' }}>{stats.avgBoarding}</strong>.
                    </div>
                  </div>
                </div>

                {/* 5. Footer Official Approval & Verification Bar */}
                <div
                  style={{
                    backgroundColor: '#031b4e',
                    borderRadius: '14px',
                    padding: '16px 24px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    color: '#ffffff',
                    fontSize: '12px',
                    fontFamily: 'monospace',
                    marginTop: 'auto'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{ width: '32px', height: '32px', borderRadius: '50%', backgroundColor: '#1e3a8a', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px' }}>
                      👤
                    </div>
                    <div>
                      <span style={{ color: '#93c5fd' }}>PREPARED BY:</span> <strong style={{ color: '#38bdf8', fontSize: '13px' }}>{adminName}</strong> <span style={{ color: '#93c5fd' }}>(ID-{adminId})</span>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', backgroundColor: '#0f2963', padding: '8px 20px', borderRadius: '10px', border: '1px solid #2563eb' }}>
                    <div style={{ width: '26px', height: '26px', borderRadius: '50%', backgroundColor: '#15803d', color: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px', fontWeight: 'bold' }}>
                      ✓
                    </div>
                    <div style={{ textAlign: 'left' }}>
                      <div style={{ color: '#4ade80', fontWeight: '900', fontSize: '12px', letterSpacing: '0.5px' }}>US-BANGLA RAMP OPERATIONS VERIFIED</div>
                      <div style={{ color: '#93c5fd', fontSize: '10px' }}>SYSTEM GEN: {new Date().toLocaleString()}</div>
                    </div>
                  </div>
                </div>

              </div>
            </div>
          </div>

        </div>

        {/* Modal Bottom Footer Bar */}
        <div className="py-2.5 px-4 bg-slate-950 border-t border-slate-800 flex items-center justify-between shrink-0 flex-wrap gap-2">
          <span className="text-[11px] text-slate-400 font-mono">
            * Turnaround durations calculated for {activeDateDisplay}. Earlier/N/A entries are designated as 'PRE'.
          </span>
          <button
            onClick={onClose}
            className="px-4 py-1 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-700 text-xs font-bold transition-all cursor-pointer"
          >
            CLOSE
          </button>
        </div>

      </div>

      {/* Backend Storage 30-Day Confirmation Modal Popup */}
      <BackendStorageConfirmationModal
        isOpen={showSaveSuccessModal}
        dateDisplay={savedSnapshotInfo?.dateDisplay || activeDateDisplay}
        dateIso={savedSnapshotInfo?.dateIso || selectedIsoDate}
        station={station}
        reportType="TIME_ANALYTICAL"
        totalFlights={savedSnapshotInfo?.totalFlights || processedRows.length}
        expiresDateStr={savedSnapshotInfo?.expiresDateStr || ''}
        onClose={() => setShowSaveSuccessModal(false)}
      />
    </div>
  );
};
