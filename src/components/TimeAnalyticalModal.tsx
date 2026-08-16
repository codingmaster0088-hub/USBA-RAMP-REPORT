import React, { useState, useRef, useMemo } from 'react';
import { SavedReport, ScheduleFlight } from '../types';
import { captureHtml2CanvasSafe } from '../utils/html2canvasHelper';
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
  Timer,
  Sparkles,
  ShieldCheck,
  CheckCircle2,
  Activity,
  ArrowRight,
  TrendingUp,
  RefreshCw
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
  const [isDownloading, setIsDownloading] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');

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

  const todayIso = getTodayIso();
  const [selectedIsoDate, setSelectedIsoDate] = useState<string>(todayIso);
  const isTodaySelected = selectedIsoDate === todayIso;
  const activeDateDisplay = formatIsoToDDMMMYY(selectedIsoDate);

  // 3. Category Filter State: ALL | DOMESTIC | INTERNATIONAL
  const [flightScopeFilter, setFlightScopeFilter] = useState<'ALL' | 'DOMESTIC' | 'INTERNATIONAL'>('ALL');

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
    const targetDmKey = parseDayMonthKey(targetIso);

    const rDateString = (r.formData?.date || r.date || '').trim();
    if (rDateString) {
      const rDmKey = parseDayMonthKey(rDateString);
      if (rDmKey && targetDmKey && rDmKey === targetDmKey) {
        return true;
      }
    }

    const timestamps = [r.timestamp, r.createdAt].filter(Boolean);
    for (const ts of timestamps) {
      const t = new Date(ts as string);
      if (!isNaN(t.getTime())) {
        const monthNames = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
        const tsDay = String(t.getDate()).padStart(2, '0');
        const tsMonth = monthNames[t.getMonth()];
        const tsKey = `${tsDay}${tsMonth}`;
        if (targetDmKey && targetDmKey === tsKey) {
          return true;
        }
      }
    }

    if (targetIso === todayIso && rDateString.toUpperCase().includes('TODAY')) {
      return true;
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

    // 1. If in time box written earlier or n/a -> show 'PRE'
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

  // Process & filter reports
  const processedRows = useMemo(() => {
    // 1. Filter for selected date
    const dateFiltered = savedReports.filter((r) => isReportMatchingSelectedDate(r, selectedIsoDate));

    // 2. Filter for Scope (ALL | DOMESTIC | INTERNATIONAL)
    const scopeFiltered = dateFiltered.filter((r) => {
      if (flightScopeFilter === 'ALL') return true;
      const isDom = isDomesticReport(r);
      if (flightScopeFilter === 'DOMESTIC') return isDom;
      if (flightScopeFilter === 'INTERNATIONAL') return !isDom;
      return true;
    });

    // 3. Map into analyzed flight rows
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

    // 4. Search query filter
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
  }, [savedReports, selectedIsoDate, flightScopeFilter, searchQuery, activeDateDisplay]);

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

  // Export to Excel / CSV
  const handleExportExcel = () => {
    if (processedRows.length === 0) {
      showToast('No Data', 'No flight rows available to export', 'error');
      return;
    }

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
    if (!printCardRef.current) return;
    try {
      setIsDownloading(true);
      showToast('Generating JPG...', 'Rendering high-resolution time analytics card', 'info');

      await new Promise((resolve) => setTimeout(resolve, 300));

      const canvas = await captureHtml2CanvasSafe(printCardRef.current, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#020617',
        logging: false
      });

      const imgData = canvas.toDataURL('image/jpeg', 0.95);
      const link = document.createElement('a');
      link.href = imgData;
      link.download = `US_BANGLA_TIME_ANALYTICAL_REPORT_${activeDateDisplay.replace(/\s+/g, '_')}_${flightScopeFilter}.jpg`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      showToast('Official JPG Downloaded!', 'Saved to your downloads folder', 'success');
    } catch (e) {
      console.error(e);
      showToast('Download Failed', 'Could not generate JPG file', 'error');
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 overflow-hidden fade-in">
      <div className="bg-slate-900 border-2 border-cyan-500/60 rounded-3xl w-full max-w-[98vw] lg:max-w-7xl h-[94vh] max-h-[96vh] flex flex-col shadow-2xl overflow-hidden my-auto">
        {/* Modal Header */}
        <div className="py-2.5 px-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between shrink-0 flex-wrap gap-2">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-cyan-500/20 border border-cyan-400/50 flex items-center justify-center text-cyan-400 shadow">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-sm sm:text-base font-black text-cyan-400 uppercase tracking-wider">
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

          {/* Action & Date Controls */}
          <div className="flex items-center gap-2 flex-wrap">
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
                type="button"
                onClick={() => setSelectedIsoDate(todayIso)}
                className="px-2.5 py-1 rounded-xl bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-500/40 text-xs font-black transition-all cursor-pointer flex items-center gap-1"
                title="Return to today's date"
              >
                <span>📅</span> TODAY
              </button>
            )}

            <button
              onClick={handleExportExcel}
              className="px-3 py-1.5 rounded-xl bg-emerald-950 hover:bg-emerald-900 text-emerald-300 border border-emerald-500/40 text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 shadow"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
              <span>EXCEL / CSV</span>
            </button>

            <button
              onClick={handleDownloadJPG}
              disabled={isDownloading}
              className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 text-xs font-black transition-all cursor-pointer flex items-center gap-1.5 shadow-lg shadow-cyan-500/20 disabled:opacity-50"
            >
              <Download className="w-4 h-4" />
              <span>{isDownloading ? 'SAVING...' : 'OFFICIAL JPG'}</span>
            </button>

            <button
              onClick={onClose}
              className="p-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-700 transition-all cursor-pointer ml-1"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Toolbar: Tabs & Search */}
        <div className="p-2.5 bg-slate-950/80 border-b border-slate-800 shrink-0 space-y-2">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            {/* 3 Scope Options (ALL, DOM, INT) */}
            <div className="flex items-center gap-1 bg-slate-900 p-1 rounded-2xl border border-slate-800">
              <button
                type="button"
                onClick={() => setFlightScopeFilter('ALL')}
                className={`px-3 py-1.5 rounded-xl text-xs font-black tracking-wider transition-all cursor-pointer flex items-center gap-1.5 ${
                  flightScopeFilter === 'ALL'
                    ? 'bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/20'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                <span>ALL FLIGHTS</span>
                <span className="text-[10px] font-mono opacity-80">({stats.totalFlights})</span>
              </button>

              <button
                type="button"
                onClick={() => setFlightScopeFilter('DOMESTIC')}
                className={`px-3 py-1.5 rounded-xl text-xs font-black tracking-wider transition-all cursor-pointer flex items-center gap-1.5 ${
                  flightScopeFilter === 'DOMESTIC'
                    ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Plane className="w-3.5 h-3.5" />
                <span>DOMESTIC</span>
              </button>

              <button
                type="button"
                onClick={() => setFlightScopeFilter('INTERNATIONAL')}
                className={`px-3 py-1.5 rounded-xl text-xs font-black tracking-wider transition-all cursor-pointer flex items-center gap-1.5 ${
                  flightScopeFilter === 'INTERNATIONAL'
                    ? 'bg-blue-500 text-slate-950 shadow-md shadow-blue-500/20'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Plane className="w-3.5 h-3.5 rotate-45" />
                <span>INTERNATIONAL</span>
              </button>
            </div>

            {/* Search Box */}
            <div className="relative min-w-[220px] max-w-xs flex-1">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search flight, route, A/C, bay..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 bg-slate-900 border border-slate-700/80 rounded-xl text-xs text-slate-200 placeholder:text-slate-500 focus:border-cyan-400 outline-none"
              />
            </div>
          </div>

          {/* Average Durations KPI Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
            <div className="bg-slate-900/90 border border-cyan-500/30 rounded-xl p-2 flex flex-col">
              <span className="text-[10px] text-slate-400 font-bold uppercase">TOTAL FLIGHTS</span>
              <span className="text-base font-black text-cyan-400 font-mono">{stats.totalFlights}</span>
            </div>

            <div className="bg-slate-900/90 border border-amber-500/30 rounded-xl p-2 flex flex-col">
              <span className="text-[10px] text-slate-400 font-bold uppercase">AVG GROUND TIME</span>
              <span className="text-base font-black text-amber-400 font-mono">{stats.avgGround}</span>
            </div>

            <div className="bg-slate-900/90 border border-indigo-500/30 rounded-xl p-2 flex flex-col">
              <span className="text-[10px] text-slate-400 font-bold uppercase">AVG SECURITY</span>
              <span className="text-base font-black text-indigo-400 font-mono">{stats.avgSecurity}</span>
            </div>

            <div className="bg-slate-900/90 border border-teal-500/30 rounded-xl p-2 flex flex-col">
              <span className="text-[10px] text-slate-400 font-bold uppercase">AVG CLEANING</span>
              <span className="text-base font-black text-teal-400 font-mono">{stats.avgCleaning}</span>
            </div>

            <div className="bg-slate-900/90 border border-purple-500/30 rounded-xl p-2 flex flex-col">
              <span className="text-[10px] text-slate-400 font-bold uppercase">AVG CATERING</span>
              <span className="text-base font-black text-purple-400 font-mono">{stats.avgCatering}</span>
            </div>

            <div className="bg-slate-900/90 border border-emerald-500/30 rounded-xl p-2 flex flex-col">
              <span className="text-[10px] text-slate-400 font-bold uppercase">AVG BOARDING</span>
              <span className="text-base font-black text-emerald-400 font-mono">{stats.avgBoarding}</span>
            </div>
          </div>
        </div>

        {/* Scrollable Main Content & Interactive Table */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-4">
          {processedRows.length === 0 ? (
            <div className="py-20 text-center space-y-3 bg-slate-950/40 rounded-2xl border border-slate-800">
              <Clock className="w-12 h-12 text-slate-600 mx-auto" />
              <p className="text-sm font-bold text-slate-400">
                No saved flight reports found for {activeDateDisplay} ({flightScopeFilter})
              </p>
              <p className="text-xs text-slate-500">
                Reports generated by ramp officers on this date will automatically calculate turnaround durations here.
              </p>
            </div>
          ) : (
            <div className="bg-slate-950 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-900/90 text-slate-300 uppercase tracking-wider font-mono border-b border-slate-800 text-[11px]">
                      <th className="py-2.5 px-3 font-extrabold text-center w-10">#</th>
                      <th className="py-2.5 px-3 font-extrabold">FLIGHT</th>
                      <th className="py-2.5 px-3 font-extrabold">ROUTE</th>
                      <th className="py-2.5 px-3 font-extrabold">A/C & BAY</th>
                      <th className="py-2.5 px-3 font-extrabold text-amber-300">GROUND TIME</th>
                      <th className="py-2.5 px-3 font-extrabold text-indigo-300">
                        SECURITY <span className="text-[9px] text-slate-400">(ST - END)</span>
                      </th>
                      <th className="py-2.5 px-3 font-extrabold text-teal-300">
                        CLEANING <span className="text-[9px] text-slate-400">(ST - END)</span>
                      </th>
                      <th className="py-2.5 px-3 font-extrabold text-purple-300">
                        CATERING <span className="text-[9px] text-slate-400">(ST - END)</span>
                      </th>
                      <th className="py-2.5 px-3 font-extrabold text-emerald-300">
                        BOARDING <span className="text-[9px] text-slate-400">(PERMIT - PAX)</span>
                      </th>
                      <th className="py-2.5 px-3 font-extrabold">STATUS</th>
                      <th className="py-2.5 px-3 font-extrabold">OFFICER</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/80 font-sans">
                    {processedRows.map((row, idx) => (
                      <tr
                        key={row.id}
                        className="hover:bg-slate-900/60 transition-colors text-slate-200"
                      >
                        <td className="py-2.5 px-3 text-center text-slate-500 font-mono text-[11px]">
                          {idx + 1}
                        </td>
                        <td className="py-2.5 px-3 font-black text-white font-mono flex items-center gap-1.5">
                          <span
                            className={`w-2 h-2 rounded-full ${
                              row.isDomestic ? 'bg-amber-400' : 'bg-blue-400'
                            }`}
                          />
                          <span>{row.flight}</span>
                        </td>
                        <td className="py-2.5 px-3 font-bold text-amber-300 font-mono">{row.route}</td>
                        <td className="py-2.5 px-3 text-slate-300 font-mono text-[11px]">
                          <div>{row.ac}</div>
                          <div className="text-[10px] text-slate-400">{row.bay}</div>
                        </td>

                        {/* Ground Time */}
                        <td className="py-2.5 px-3 font-mono">
                          <span
                            className={`px-2 py-0.5 rounded-md font-extrabold text-[11px] ${
                              row.groundTime.text === 'ON GROUND'
                                ? 'bg-slate-900 text-slate-400 border border-slate-700'
                                : 'bg-amber-950/80 text-amber-300 border border-amber-500/40'
                            }`}
                          >
                            {row.groundTime.text}
                          </span>
                        </td>

                        {/* 1. Security start to end */}
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

                        {/* 2. Cleaning start to end */}
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

                        {/* 3. Catering start to end */}
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

                        {/* 4. Boarding permit to pax */}
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

                        {/* Status */}
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

                        {/* Officer */}
                        <td className="py-2.5 px-3 text-[11px] text-slate-300 font-medium">
                          {row.officer}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer Note */}
        <div className="py-2.5 px-4 bg-slate-950 border-t border-slate-800 flex items-center justify-between shrink-0 flex-wrap gap-2">
          <span className="text-[11px] text-slate-400 font-mono">
            * Durations calculated from saved turnaround timestamps for {activeDateDisplay}. If time is marked EARLIER/N/A, it is designated as 'PRE'.
          </span>
          <button
            onClick={onClose}
            className="px-4 py-1 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-700 text-xs font-bold transition-all cursor-pointer"
          >
            CLOSE
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* HIDDEN PRINT/DOWNLOAD CONTAINER FOR HIGH-RES OFFICIAL JPG GENERATION     */}
      {/* ========================================================================= */}
      <div className="fixed -left-[9999px] top-0 pointer-events-none">
        <div
          ref={printCardRef}
          className="w-[1280px] bg-slate-950 text-slate-100 p-8 border-4 border-cyan-500/80 shadow-2xl rounded-none space-y-6 font-sans"
        >
          {/* Header Branding */}
          <div className="flex items-center justify-between border-b-2 border-cyan-500/40 pb-5">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-2xl bg-cyan-500/20 border-2 border-cyan-400 flex items-center justify-center text-cyan-400">
                <Clock className="w-9 h-9" />
              </div>
              <div>
                <h1 className="text-2xl font-black text-white tracking-wider flex items-center gap-2">
                  <span className="text-cyan-400">US-BANGLA AIRLINES</span>
                  <span className="text-slate-500">|</span>
                  <span>TIME & TURNAROUND ANALYTICS</span>
                </h1>
                <p className="text-xs text-cyan-300 font-mono uppercase tracking-widest mt-0.5">
                  RAMP OPERATIONS & GROUND HANDLING DURATION AUDIT REPORT
                </p>
              </div>
            </div>

            <div className="text-right space-y-1">
              <div className="inline-block px-3 py-1 bg-cyan-500/20 border border-cyan-400 text-cyan-300 font-mono font-black text-sm rounded-lg">
                DATE: {activeDateDisplay}
              </div>
              <div className="text-[11px] font-mono text-slate-400">
                SCOPE: <span className="text-amber-400 font-bold">{flightScopeFilter}</span> | STATION:{' '}
                <span className="text-cyan-400 font-bold">{station}</span>
              </div>
            </div>
          </div>

          {/* KPI Summary Cards in Export */}
          <div className="grid grid-cols-6 gap-3">
            <div className="bg-slate-900 border border-cyan-500/40 rounded-xl p-3 text-center">
              <span className="text-[10px] text-slate-400 font-bold uppercase block">TOTAL FLIGHTS</span>
              <span className="text-xl font-black text-cyan-400 font-mono">{stats.totalFlights}</span>
            </div>
            <div className="bg-slate-900 border border-amber-500/40 rounded-xl p-3 text-center">
              <span className="text-[10px] text-slate-400 font-bold uppercase block">AVG GROUND TIME</span>
              <span className="text-xl font-black text-amber-400 font-mono">{stats.avgGround}</span>
            </div>
            <div className="bg-slate-900 border border-indigo-500/40 rounded-xl p-3 text-center">
              <span className="text-[10px] text-slate-400 font-bold uppercase block">AVG SECURITY</span>
              <span className="text-xl font-black text-indigo-400 font-mono">{stats.avgSecurity}</span>
            </div>
            <div className="bg-slate-900 border border-teal-500/40 rounded-xl p-3 text-center">
              <span className="text-[10px] text-slate-400 font-bold uppercase block">AVG CLEANING</span>
              <span className="text-xl font-black text-teal-400 font-mono">{stats.avgCleaning}</span>
            </div>
            <div className="bg-slate-900 border border-purple-500/40 rounded-xl p-3 text-center">
              <span className="text-[10px] text-slate-400 font-bold uppercase block">AVG CATERING</span>
              <span className="text-xl font-black text-purple-400 font-mono">{stats.avgCatering}</span>
            </div>
            <div className="bg-slate-900 border border-emerald-500/40 rounded-xl p-3 text-center">
              <span className="text-[10px] text-slate-400 font-bold uppercase block">AVG BOARDING</span>
              <span className="text-xl font-black text-emerald-400 font-mono">{stats.avgBoarding}</span>
            </div>
          </div>

          {/* Export Table */}
          <div className="border border-slate-700 rounded-xl overflow-hidden bg-slate-900/90">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-800 text-slate-200 uppercase font-mono text-[11px] border-b border-slate-700">
                  <th className="py-2.5 px-3 text-center w-8">#</th>
                  <th className="py-2.5 px-3">FLIGHT</th>
                  <th className="py-2.5 px-3">ROUTE</th>
                  <th className="py-2.5 px-3">A/C</th>
                  <th className="py-2.5 px-3">BAY</th>
                  <th className="py-2.5 px-3 text-amber-300">GROUND TIME</th>
                  <th className="py-2.5 px-3 text-indigo-300">SECURITY (ST-END)</th>
                  <th className="py-2.5 px-3 text-teal-300">CLEANING (ST-END)</th>
                  <th className="py-2.5 px-3 text-purple-300">CATERING (ST-END)</th>
                  <th className="py-2.5 px-3 text-emerald-300">BOARDING (PERMIT-PAX)</th>
                  <th className="py-2.5 px-3">STATUS</th>
                  <th className="py-2.5 px-3">OFFICER</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 font-sans text-slate-300">
                {processedRows.map((r, i) => (
                  <tr key={r.id} className={i % 2 === 0 ? 'bg-slate-950/50' : 'bg-slate-900/50'}>
                    <td className="py-2 px-3 text-center font-mono text-slate-500">{i + 1}</td>
                    <td className="py-2 px-3 font-bold font-mono text-white">{r.flight}</td>
                    <td className="py-2 px-3 font-bold text-amber-300 font-mono">{r.route}</td>
                    <td className="py-2 px-3 font-mono">{r.ac}</td>
                    <td className="py-2 px-3 font-mono">{r.bay}</td>
                    <td className="py-2 px-3 font-mono font-bold text-amber-300">{r.groundTime.text}</td>
                    <td className="py-2 px-3 font-mono text-indigo-300">
                      {r.securityDuration.durationText}
                      {r.securitySt && r.securityEnd && (
                        <span className="text-[10px] text-slate-400 ml-1">({r.securitySt}-{r.securityEnd})</span>
                      )}
                    </td>
                    <td className="py-2 px-3 font-mono text-teal-300">
                      {r.cleaningDuration.durationText}
                      {r.cleaningSt && r.cleaningEnd && (
                        <span className="text-[10px] text-slate-400 ml-1">({r.cleaningSt}-{r.cleaningEnd})</span>
                      )}
                    </td>
                    <td className="py-2 px-3 font-mono text-purple-300">
                      {r.cateringDuration.durationText}
                      {r.cateringSt && r.cateringEnd && (
                        <span className="text-[10px] text-slate-400 ml-1">({r.cateringSt}-{r.cateringEnd})</span>
                      )}
                    </td>
                    <td className="py-2 px-3 font-mono text-emerald-300">
                      {r.boardingDuration.durationText}
                      {r.permit && r.pax && (
                        <span className="text-[10px] text-slate-400 ml-1">({r.permit}-{r.pax})</span>
                      )}
                    </td>
                    <td className="py-2 px-3 font-bold font-mono text-[10px]">{r.status}</td>
                    <td className="py-2 px-3 text-[11px] text-slate-300">{r.officer}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Signatures & Footer in JPG */}
          <div className="pt-4 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
            <div className="space-y-1">
              <div>Generated by: <span className="text-cyan-300 font-bold">{adminName} ({adminId})</span></div>
              <div className="text-[10px] font-mono text-slate-500">
                System timestamp: {new Date().toLocaleString('en-US', { timeZone: 'Asia/Dhaka' })} (Dhaka LT)
              </div>
            </div>
            <div className="flex gap-12 text-center text-[11px] font-mono">
              <div className="border-t border-slate-600 pt-1 px-4">
                <span>DUTY OFFICER</span>
              </div>
              <div className="border-t border-slate-600 pt-1 px-4">
                <span>RAMP SUPERVISOR</span>
              </div>
              <div className="border-t border-slate-600 pt-1 px-4">
                <span>OPERATIONS MANAGER</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
