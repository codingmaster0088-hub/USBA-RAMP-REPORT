import React, { useState, useRef } from 'react';
import { SavedReport, ScheduleFlight } from '../types';
import { captureHtml2CanvasSafe } from '../utils/html2canvasHelper';
import aircraftImage from '../assets/images/us_bangla_real_hd_plane_1786386727381.jpg';
import {
  X,
  BarChart3,
  Download,
  Calendar,
  AlertTriangle,
  TrendingUp,
  CheckCircle2,
  PieChart,
  Plane,
  FileSpreadsheet,
  Award,
  ShieldCheck,
  Zap,
  Activity,
  Sparkles,
  Layers,
  Clock,
  Briefcase,
  ChevronDown
} from 'lucide-react';

interface AnalyticalReportModalProps {
  savedReports: SavedReport[];
  scheduleFlights: ScheduleFlight[];
  station: string;
  adminName: string;
  adminId: string;
  onClose: () => void;
  showToast: (title: string, subtitle?: string, type?: 'success' | 'info' | 'error') => void;
}

export const AnalyticalReportModal: React.FC<AnalyticalReportModalProps> = ({
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
  const [isDownloading, setIsDownloading] = useState(false);
  const [customHeaderPhoto, setCustomHeaderPhoto] = useState<string | null>(null);

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
          showToast('Header Photo Updated', 'Your custom aircraft photo is now set for reports!', 'success');
        }
      };
      reader.readAsDataURL(file);
    }
  };

  // 1. Helper function: Get today's date formatted as "DD MMM YY" (e.g., "10 AUG 26")
  const formatTodayStr = (): string => {
    const d = new Date();
    const day = String(d.getDate()).padStart(2, '0');
    const month = d.toLocaleString('en-US', { month: 'short' }).toUpperCase();
    const year = String(d.getFullYear()).slice(-2);
    return `${day} ${month} ${year}`;
  };

  const todayDateStr = formatTodayStr();

  // Helper to parse date string or timestamp into JS Date
  const parseReportDate = (r: SavedReport): Date => {
    if (r.timestamp) {
      const parsedTs = new Date(r.timestamp);
      if (!isNaN(parsedTs.getTime())) return parsedTs;
    }
    const rawDate = r.formData?.date || r.date || '';
    if (rawDate) {
      const parsed = new Date(rawDate);
      if (!isNaN(parsed.getTime())) return parsed;
    }
    return new Date();
  };

  // Helper to check if two dates belong to the same calendar day
  const isSameDay = (d1: Date, d2: Date): boolean => {
    return (
      d1.getFullYear() === d2.getFullYear() &&
      d1.getMonth() === d2.getMonth() &&
      d1.getDate() === d2.getDate()
    );
  };

  // 2. 30-DAY RETENTION FILTER (Records older than 30 days vanish automatically)
  const now = new Date();
  const thirtyDaysAgoMs = now.getTime() - 30 * 24 * 60 * 60 * 1000;

  const valid30DaysReports = savedReports.filter((r) => {
    const reportDate = parseReportDate(r);
    return reportDate.getTime() >= thirtyDaysAgoMs;
  });

  // 3. Previous Month Info for Monthly Summary
  const getPreviousMonthInfo = () => {
    const d = new Date();
    d.setMonth(d.getMonth() - 1);
    const monthName = d.toLocaleString('en-US', { month: 'long' }).toUpperCase();
    const shortMonth = d.toLocaleString('en-US', { month: 'short' }).toUpperCase();
    const year = d.getFullYear();
    const monthIndex = d.getMonth();
    return {
      label: `${monthName} ${year} FULL MONTH SUMMARY`,
      shortMonth,
      monthName,
      year,
      monthIndex
    };
  };

  const prevMonthInfo = getPreviousMonthInfo();

  // Extract unique dates from last 30 days valid reports + schedule
  const uniqueDatesIn30Days = Array.from(
    new Set([
      ...valid30DaysReports.map((r) => r.formData?.date || r.date || '').filter(Boolean),
      ...scheduleFlights.map((f) => f.dateStr || '').filter(Boolean)
    ])
  ).sort();

  // 4. Date Selection & Calendar Picker State & Flight Scope State
  const [selectedDateFilter, setSelectedDateFilter] = useState<string>('TODAY');
  const [calendarDate, setCalendarDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [flightScopeFilter, setFlightScopeFilter] = useState<'ALL' | 'DOMESTIC' | 'INTERNATIONAL'>('ALL');

  // Helper to check if a saved report is Domestic based strictly on destination/route station codes & flight numbers
  const isDomesticReport = (r: SavedReport): boolean => {
    // 1. Check clean flight number first (Most accurate for US-Bangla Airlines fleet & schedule)
    const deptFltStr = r.formData?.deptFlt || '';
    const arvFltStr = r.formData?.arvFlt || '';
    const mainFltStr = r.flight || '';
    const rawFltString = deptFltStr || arvFltStr || mainFltStr;
    const cleanNumStr = rawFltString.replace(/BS/gi, '').replace(/[^0-9]/g, '');
    const fltNum = parseInt(cleanNumStr, 10);

    if (fltNum && !isNaN(fltNum)) {
      // US-Bangla Domestic Flight range: 100-199 (DAC-CGP, DAC-CXB, DAC-JSR, DAC-BZL, DAC-RJH, DAC-SPD) and 500-599 (DAC-ZYL)
      if ((fltNum >= 100 && fltNum <= 199) || (fltNum >= 500 && fltNum <= 599)) {
        return true; // 100% Strictly Domestic (e.g. BS-145 DAC-CXB, BS-115 DAC-CGP, BS-539 DAC-ZYL, BS-122 JSR-DAC)
      }
      // US-Bangla International Flight range: 200-499 (CCU, MAA, BKK, SIN, KUL, MCT, CAN, DOH, MLE, DXB, SHJ, AUH, JED, RUH)
      if (fltNum >= 200 && fltNum <= 499) {
        return false; // 100% Strictly International (e.g. BS-307 DAC-SIN, BS-321 DAC-MCT, BS-333 DAC-DOH, BS-341 DAC-DXB, BS-361 DAC-JED)
      }
    }

    // 2. Check known International station IATA codes in route strings
    const routeText = `${r.formData?.deptRoute || ''} ${r.formData?.arvRoute || ''} ${r.route || ''}`.toUpperCase();
    
    // Known International stations
    const intlStationRegex = /\b(DXB|SHJ|AUH|RUH|JED|MED|MLE|BKK|DMK|MCT|DOH|CCU|MAA|DEL|BOM|CAN|SIN|KUL|PKX|KMG|NRT|ICN|LHR)\b/;
    if (intlStationRegex.test(routeText)) {
      return false; // Strictly International
    }

    // Known Domestic stations: DAC, CGP, ZYL, CXB, RJH, SPD, JSR, BZL
    const domStationRegex = /\b(DAC|CGP|ZYL|CXB|RJH|SPD|JSR|BZL)\b/;
    if (domStationRegex.test(routeText)) {
      return true; // Strictly Domestic
    }

    // 3. Fallback to report type if route/flight is completely absent
    if (r.type) {
      const t = r.type.toUpperCase();
      if (t === 'DOMESTIC') return true;
      if (t === 'INTERNATIONAL') return false;
    }

    return false;
  };

  // Helper to normalize any date string to DDMMMYY e.g. "12 AUG 2026", "12 AUG 26", "2026-08-12", "12/08/2026" -> "12AUG26"
  const normalizeDateToDDMMMYY = (str: string): string => {
    if (!str) return '';
    const cleanStr = str.trim().toUpperCase();
    if (cleanStr.includes('TODAY')) {
      const d = new Date();
      const monthNames = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
      const day = String(d.getDate()).padStart(2, '0');
      const month = monthNames[d.getMonth()];
      const yr = String(d.getFullYear()).slice(-2);
      return `${day}${month}${yr}`;
    }

    const monthNames = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

    // 1. ISO Format YYYY-MM-DD e.g. 2026-08-12
    const isoMatch = cleanStr.match(/\b(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})\b/);
    if (isoMatch) {
      const yShort = isoMatch[1].slice(-2);
      const mIdx = parseInt(isoMatch[2], 10) - 1;
      const day = String(parseInt(isoMatch[3], 10)).padStart(2, '0');
      const month = monthNames[mIdx] || 'JAN';
      return `${day}${month}${yShort}`;
    }

    // 2. Alpha Month: "12 AUG 2026", "12 AUG 26", "12AUG26", "12AUG 02", "12-AUG-2026"
    const alphaMatch = cleanStr.match(/\b(\d{1,2})\s*[-/]?\s*([A-Za-z]{3})\s*[-/]?\s*(\d{2,4})?\b/i);
    if (alphaMatch) {
      const day = String(parseInt(alphaMatch[1], 10)).padStart(2, '0');
      const month = alphaMatch[2].toUpperCase();
      let yr = String(new Date().getFullYear()).slice(-2);
      if (alphaMatch[3]) {
        const parsedYr = parseInt(alphaMatch[3], 10);
        if (alphaMatch[3].length === 4) {
          yr = alphaMatch[3].slice(-2);
        } else if (parsedYr >= 20 && parsedYr <= 35) {
          yr = String(parsedYr).padStart(2, '0');
        }
      }
      return `${day}${month}${yr}`;
    }

    // 3. Numeric DD/MM/YYYY or DD-MM-YY
    const numMatch = cleanStr.match(/\b(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})\b/);
    if (numMatch) {
      const day = String(parseInt(numMatch[1], 10)).padStart(2, '0');
      const mIdx = parseInt(numMatch[2], 10) - 1;
      const month = monthNames[mIdx] || 'JAN';
      const yr = numMatch[3].slice(-2);
      return `${day}${month}${yr}`;
    }

    return cleanStr.replace(/[^0-9A-Z]/g, '');
  };

  // Helper to extract clean flight number e.g. "BS-321", "0321", "321" -> "321"
  const cleanFlightNum = (str: string): string => {
    if (!str) return '';
    const digitsOnly = str.replace(/BS/gi, '').replace(/[^0-9]/g, '');
    if (digitsOnly) {
      return parseInt(digitsOnly, 10).toString();
    }
    return str.replace(/BS/gi, '').replace(/[^0-9a-zA-Z]/g, '').trim().toUpperCase();
  };

  // Helper to convert YYYY-MM-DD (e.g. 2026-08-10) to "10 AUG 26"
  const formatIsoToDDMMMYY = (isoStr: string) => {
    if (!isoStr) return '';
    const parts = isoStr.split('-');
    if (parts.length !== 3) return isoStr;
    const y = Number(parts[0]);
    const m = Number(parts[1]) - 1;
    const d = Number(parts[2]);
    const dateObj = new Date(y, m, d);
    if (isNaN(dateObj.getTime())) return isoStr;
    const dayStr = String(d).padStart(2, '0');
    const monthStr = dateObj.toLocaleString('en-US', { month: 'short' }).toUpperCase();
    const yearShort = String(y).slice(-2);
    return `${dayStr} ${monthStr} ${yearShort}`;
  };

  // Filter reports based on selected date mode
  const filteredReports = valid30DaysReports.filter((r) => {
    const rDateObj = parseReportDate(r);
    const rDateStr = r.formData?.date || r.date || '';

    const normReportDate = normalizeDateToDDMMMYY(rDateStr);

    if (selectedDateFilter === 'TODAY') {
      const normToday = normalizeDateToDDMMMYY('TODAY');
      return isSameDay(rDateObj, now) || normReportDate === normToday || rDateStr.toUpperCase().includes('TODAY');
    }
    if (selectedDateFilter === 'LAST_30_DAYS') {
      return true; // Already filtered to 30 days
    }
    if (selectedDateFilter === 'PREVIOUS_MONTH') {
      return (
        rDateObj.getMonth() === prevMonthInfo.monthIndex &&
        rDateObj.getFullYear() === prevMonthInfo.year
      );
    }
    if (selectedDateFilter === 'CUSTOM_CALENDAR') {
      if (!calendarDate) return true;
      const [y, m, d] = calendarDate.split('-').map(Number);
      const targetDate = new Date(y, m - 1, d);
      const formattedDDMMMYY = formatIsoToDDMMMYY(calendarDate);
      const normCalendar = normalizeDateToDDMMMYY(calendarDate);
      return (
        isSameDay(rDateObj, targetDate) ||
        normReportDate === normCalendar ||
        rDateStr.toUpperCase().includes(formattedDDMMMYY) ||
        rDateStr.includes(calendarDate)
      );
    }
    // Specific date selected from list
    const normFilter = normalizeDateToDDMMMYY(selectedDateFilter);
    return normReportDate === normFilter || rDateStr === selectedDateFilter;
  });

  // Helper to deduplicate reports by flight number + normalized date, prioritizing the origin station flight
  const dedupeReportsLatest = (reports: SavedReport[]) => {
    const map = new Map<string, SavedReport>();
    reports.forEach((r) => {
      const deptFlt = r.formData?.deptFlt || '';
      const mainFlt = r.flight || '';
      const arvFlt = r.formData?.arvFlt || '';
      const rawFlt = deptFlt || mainFlt || arvFlt || '';
      const fltNum = cleanFlightNum(rawFlt);

      const rawDate = r.formData?.date || r.date || '';
      const normDate = normalizeDateToDDMMMYY(rawDate);

      if (!fltNum || !normDate) return;

      const key = `${fltNum}_${normDate}`;

      const existing = map.get(key);
      if (!existing) {
        map.set(key, r);
      } else {
        // If an existing report is present, prioritize the one departing from current station (e.g. DAC)
        const currentRoute = `${r.formData?.deptRoute || ''} ${r.route || ''}`.toUpperCase();
        const existingRoute = `${existing.formData?.deptRoute || ''} ${existing.route || ''}`.toUpperCase();

        const st = station ? station.toUpperCase() : 'DAC';
        const currentMatchesStation = currentRoute.startsWith(st);
        const existingMatchesStation = existingRoute.startsWith(st);

        if (currentMatchesStation && !existingMatchesStation) {
          map.set(key, r); // Keep the flight departing from station (e.g. DAC)
        } else if (currentMatchesStation === existingMatchesStation) {
          // If both or neither match, take the latest saved report
          map.set(key, r);
        }
      }
    });
    return Array.from(map.values());
  };

  const dedupedFilteredReports = dedupeReportsLatest(filteredReports);

  // Filter reports by flight scope (ALL / DOMESTIC / INTERNATIONAL)
  const scopeFilteredReports = dedupedFilteredReports.filter((r) => {
    if (flightScopeFilter === 'DOMESTIC') return isDomesticReport(r);
    if (flightScopeFilter === 'INTERNATIONAL') return !isDomesticReport(r);
    return true;
  });

  // Helper to check if a flight report is strictly delayed
  const isReportDelayed = (r: SavedReport): boolean => {
    const status = (r.formData?.status || '').toUpperCase();
    // If status explicitly contains EARLY or ON TIME / ON-TIME, it is NOT delayed
    if (status.includes('EARLY') || status.includes('ON TIME') || status.includes('ON-TIME')) {
      return false;
    }
    // Must contain DELAY to be counted as delayed
    return status.includes('DELAY');
  };

  // Calculate Key Operational Metrics
  const totalReportsCount = scopeFilteredReports.length;

  const delayedReports = scopeFilteredReports.filter(isReportDelayed);
  const delayedCount = delayedReports.length;
  const onTimeCount = Math.max(0, totalReportsCount - delayedCount);

  const otpRate = totalReportsCount > 0 ? ((onTimeCount / totalReportsCount) * 100).toFixed(1) : '100.0';
  const delayRate = totalReportsCount > 0 ? ((delayedCount / totalReportsCount) * 100).toFixed(1) : '0.0';

  // Group delays by Delay Code / Reason
  const delayCodeMap: Record<string, { code: string; count: number; flights: string[] }> = {};

  delayedReports.forEach((r) => {
    const rawReason = r.formData.delayReason?.trim() || 'UNSPECIFIED DELAY CODE';
    const splitCodes = rawReason.split(';').map((s) => s.trim()).filter(Boolean);
    const codes = splitCodes.length > 0 ? splitCodes : ['UNSPECIFIED DELAY CODE'];
    const fltName = `BS-${r.formData.deptFlt || 'XXX'} (${r.formData.deptRoute || 'ROUTE'})`;

    codes.forEach((code) => {
      if (!delayCodeMap[code]) {
        delayCodeMap[code] = { code, count: 0, flights: [] };
      }
      delayCodeMap[code].count += 1;
      if (!delayCodeMap[code].flights.includes(fltName)) {
        delayCodeMap[code].flights.push(fltName);
      }
    });
  });

  const delayBreakdown = Object.values(delayCodeMap).sort((a, b) => b.count - a.count);
  const maxDelayCount = delayBreakdown.length > 0 ? delayBreakdown[0].count : 0;
  const topDelayItems = delayBreakdown.filter((item) => item.count === maxDelayCount && item.count > 0);
  const topDelayItem = delayBreakdown.length > 0 ? delayBreakdown[0] : null;

  // IATA / Airline Categorized Delay Pareto Breakdown
  const categories = {
    'ROTATION / LATE INBOUND (ROT)': 0,
    'GROUND HANDLING & RAMP (RAMP)': 0,
    'TECHNICAL / MAINTENANCE (MX)': 0,
    'PASSENGER & COMMERCIAL (PAX)': 0,
    'ATC & WEATHER (ATC/WX)': 0,
    'OTHER / MISCELLANEOUS': 0
  };

  delayedReports.forEach((r) => {
    const reason = (r.formData.delayReason || '').toUpperCase();
    if (reason.includes('LATE ARRIVAL') || reason.includes('INBOUND') || reason.includes('ROTATION') || reason.includes('BS-') || reason.includes('AIRCRAFT')) {
      categories['ROTATION / LATE INBOUND (ROT)'] += 1;
    } else if (reason.includes('BAGGAGE') || reason.includes('RAMP') || reason.includes('BOARDING') || reason.includes('CARGO') || reason.includes('CATERING') || reason.includes('FUEL') || reason.includes('CLEANING')) {
      categories['GROUND HANDLING & BAGGAGE (RAMP)'] += 1;
    } else if (reason.includes('TECH') || reason.includes('MAINTENANCE') || reason.includes('AOG') || reason.includes('ENGINE') || reason.includes('REPAIR')) {
      categories['TECHNICAL / MAINTENANCE (MX)'] += 1;
    } else if (reason.includes('PASSENGER') || reason.includes('PAX') || reason.includes('VISA') || reason.includes('DOCUMENT') || reason.includes('NO SHOW')) {
      categories['PASSENGER & COMMERCIAL (PAX)'] += 1;
    } else if (reason.includes('ATC') || reason.includes('WEATHER') || reason.includes('RAIN') || reason.includes('FOG') || reason.includes('WIND')) {
      categories['ATC & WEATHER (ATC/WX)'] += 1;
    } else {
      categories['OTHER / MISCELLANEOUS'] += 1;
    }
  });

  const activeCategoryBreakdown = Object.entries(categories)
    .filter(([, count]) => count > 0)
    .map(([catName, count]) => ({
      catName,
      count,
      pct: delayedCount > 0 ? ((count / delayedCount) * 100).toFixed(1) : '0.0'
    }))
    .sort((a, b) => b.count - a.count);

  // Function to download executive analytical report as JPG image
  const handleDownloadJPG = async () => {
    if (!printCardRef.current) return;
    try {
      setIsDownloading(true);
      showToast('Generating Executive Analytical Brief...', 'Preparing high-resolution 1200px JPG image', 'info');

      // Short delay for DOM render stabilization
      await new Promise((res) => setTimeout(res, 350));

      const canvas = await captureHtml2CanvasSafe(printCardRef.current, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#030712',
        logging: false
      });

      const imageURI = canvas.toDataURL('image/jpeg', 0.98);
      const link = document.createElement('a');
      const dateLabel =
        selectedDateFilter === 'TODAY'
          ? todayDateStr
          : selectedDateFilter === 'PREVIOUS_MONTH'
          ? `${prevMonthInfo.shortMonth} ${prevMonthInfo.year}`
          : selectedDateFilter === 'LAST_30_DAYS'
          ? 'LAST 30 DAYS'
          : selectedDateFilter;

      link.download = `ANALYTICAL-${dateLabel}.jpg`;
      link.href = imageURI;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      showToast('Executive Report Saved!', 'High-resolution JPG analytical brief generated', 'success');
    } catch (err) {
      console.error('Failed to download JPG analytical report', err);
      showToast('Download Failed', 'Could not generate JPG report image', 'error');
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 overflow-y-auto fade-in">
      <div className="bg-slate-900 border border-amber-500/60 rounded-3xl w-full max-w-5xl max-h-[94vh] flex flex-col shadow-2xl overflow-hidden my-auto border-t-2 border-t-amber-400">
        
        {/* EXECUTIVE MODAL HEADER */}
        <div className="p-4 sm:p-5 bg-gradient-to-r from-slate-950 via-slate-900 to-slate-950 border-b border-amber-500/30 flex items-center justify-between shrink-0 flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center text-slate-950 font-black shadow-lg shadow-amber-500/25 border border-amber-300">
              <BarChart3 className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base sm:text-lg font-black text-white tracking-wide font-sans flex items-center gap-2">
                  <span>US-BANGLA AIRLINES</span>
                  <span className="text-amber-400 font-extrabold">• RAMP OPERATIONS ANALYTICAL REPORT</span>
                </h2>
                <span className="text-[10px] font-black px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 tracking-wider">
                  MANAGEMENT GRADE
                </span>
              </div>
              <p className="text-[11px] text-slate-400 font-mono mt-0.5 flex items-center gap-2">
                <span>STATION: <strong className="text-amber-300 font-bold">{station}</strong></span>
                <span>•</span>
                <span>30-DAY AUTO-RETENTION ACTIVE</span>
                <span>•</span>
                <span className="text-emerald-400 flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5" /> FOR TOP MANAGEMENT & BOARD REVIEW
                </span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="file"
              ref={fileInputRef}
              accept="image/*"
              onChange={handleCustomPhotoUpload}
              className="hidden"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              className="px-3.5 py-2.5 bg-slate-800 hover:bg-slate-700 text-amber-300 font-bold text-xs rounded-xl border border-amber-500/40 shadow-md active:scale-95 transition-all flex items-center gap-2 cursor-pointer"
              title="Upload your own custom aircraft header image"
            >
              <Sparkles className="w-4 h-4 text-amber-400" />
              <span>{customHeaderPhoto ? 'CHANGE HEADER PHOTO' : 'UPLOAD HEADER PHOTO'}</span>
            </button>
            {customHeaderPhoto && (
              <button
                onClick={() => setCustomHeaderPhoto(null)}
                className="px-2.5 py-2.5 bg-rose-950/60 hover:bg-rose-900 text-rose-300 font-bold text-xs rounded-xl border border-rose-500/40 active:scale-95 transition-all cursor-pointer"
                title="Reset to default aircraft photo"
              >
                RESET
              </button>
            )}
            <button
              onClick={handleDownloadJPG}
              disabled={isDownloading}
              className="px-4 py-2.5 bg-gradient-to-r from-amber-400 via-amber-500 to-yellow-500 hover:from-amber-300 hover:to-yellow-400 text-slate-950 font-black text-xs rounded-xl shadow-lg shadow-amber-500/20 active:scale-95 transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
            >
              <Download className="w-4 h-4" />
              <span>{isDownloading ? 'EXPORTING JPG...' : 'DOWNLOAD JPG REPORT'}</span>
            </button>
            <button
              onClick={onClose}
              className="p-2.5 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors cursor-pointer border border-slate-700"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* MODAL BODY CONTENT */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-6 text-slate-100 flex-1 bg-slate-950/60">
          
          {/* CONTROL & DATE FILTER SELECTION BAR WITH SINGLE UNIFIED DATE PICKER BOX & SCOPE SELECTION */}
          <div className="bg-slate-900/90 border border-amber-500/40 rounded-2xl p-4 flex items-center justify-between flex-wrap gap-4 shadow-xl">
            <div className="flex items-center gap-3 flex-wrap">
              <div className="flex items-center gap-2 text-amber-400">
                <Calendar className="w-5 h-5 text-amber-400" />
                <span className="text-xs font-black uppercase text-amber-300 tracking-wider font-mono">
                  SELECT REPORT DATE:
                </span>
              </div>

              {/* SINGLE UNIFIED DATE PICKER BOX */}
              <div className="flex items-center gap-2.5 bg-slate-950 border-2 border-amber-400 rounded-xl px-4 py-2 shadow-inner hover:border-amber-300 focus-within:border-amber-300 transition-all">
                <input
                  type="date"
                  value={calendarDate}
                  onChange={(e) => {
                    const newDate = e.target.value;
                    setCalendarDate(newDate);
                    setSelectedDateFilter('CUSTOM_CALENDAR');
                  }}
                  className="bg-transparent text-sm text-amber-300 font-mono font-black outline-none cursor-pointer scheme-dark"
                />
                <span className="text-xs font-black text-amber-400 font-mono bg-amber-500/15 border border-amber-500/30 px-2.5 py-1 rounded-md tracking-wider">
                  {formatIsoToDDMMMYY(calendarDate) || todayDateStr}
                </span>
              </div>

              {selectedDateFilter === 'TODAY' ? (
                <span className="text-[10px] font-black px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 tracking-wider">
                  LIVE TODAY VIEW
                </span>
              ) : (
                <button
                  onClick={() => {
                    const todayIso = new Date().toISOString().split('T')[0];
                    setCalendarDate(todayIso);
                    setSelectedDateFilter('TODAY');
                  }}
                  className="text-[10px] font-black px-3 py-1 rounded-full bg-slate-800 hover:bg-amber-500/20 text-amber-300 border border-amber-500/40 transition-all cursor-pointer"
                >
                  LOAD TODAY ({todayDateStr})
                </button>
              )}
            </div>

            {/* SEPARATE ACTION BUTTONS: ALL, INTERNATIONAL, DOMESTIC */}
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-black uppercase text-amber-300 tracking-wider font-mono flex items-center gap-1.5">
                <Plane className="w-4 h-4 text-amber-400" />
                SCOPE:
              </span>
              <div className="flex items-center gap-1.5 bg-slate-950 p-1 rounded-xl border border-amber-500/40 shadow-inner">
                <button
                  onClick={() => setFlightScopeFilter('ALL')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer flex items-center gap-1.5 ${
                    flightScopeFilter === 'ALL'
                      ? 'bg-amber-400 text-slate-950 shadow-md font-extrabold scale-105'
                      : 'text-slate-300 hover:text-white hover:bg-slate-800'
                  }`}
                >
                  <span>✈️</span> ALL
                </button>
                <button
                  onClick={() => setFlightScopeFilter('DOMESTIC')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer flex items-center gap-1.5 ${
                    flightScopeFilter === 'DOMESTIC'
                      ? 'bg-emerald-400 text-slate-950 shadow-md font-extrabold scale-105'
                      : 'text-slate-300 hover:text-white hover:bg-slate-800'
                  }`}
                >
                  <span>🇧🇩</span> DOMESTIC
                </button>
                <button
                  onClick={() => setFlightScopeFilter('INTERNATIONAL')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer flex items-center gap-1.5 ${
                    flightScopeFilter === 'INTERNATIONAL'
                      ? 'bg-sky-400 text-slate-950 shadow-md font-extrabold scale-105'
                      : 'text-slate-300 hover:text-white hover:bg-slate-800'
                  }`}
                >
                  <span>🌐</span> INTERNATIONAL
                </button>
              </div>
            </div>

            <div className="text-xs font-mono text-slate-400 flex items-center gap-3">
              <span>Prepared By: <strong className="text-amber-300 font-bold">{adminName}</strong> (ID-{adminId})</span>
              <span className="px-2 py-0.5 rounded bg-slate-950 text-slate-400 border border-slate-800 text-[10px]">
                Retention: 30 Days Purge
              </span>
            </div>
          </div>

          {/* HIGH EXECUTIVE KPI METRIC CARDS */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            
            {/* OTP % CARD */}
            <div className="bg-gradient-to-br from-slate-900 to-slate-950 border border-emerald-500/40 rounded-2xl p-4 shadow-xl relative overflow-hidden group">
              <div className="flex items-center justify-between text-emerald-400 text-xs font-black uppercase tracking-wider">
                <span>ON-TIME PERFORMANCE (OTP)</span>
                <Award className="w-5 h-5 text-emerald-400" />
              </div>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-3xl sm:text-4xl font-black text-emerald-400 font-mono tracking-tight">
                  {otpRate}%
                </span>
                <span className="text-xs font-bold text-slate-400 font-sans">Punctuality Rate</span>
              </div>
              <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden mt-3 border border-slate-700">
                <div
                  className="bg-gradient-to-r from-emerald-500 to-teal-400 h-full rounded-full transition-all duration-500"
                  style={{ width: `${Math.max(5, parseFloat(otpRate))}%` }}
                />
              </div>
              <p className="text-[10px] text-emerald-400/80 mt-2 font-mono flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                Target ≥85.0% • {parseFloat(otpRate) >= 85 ? 'EXCEEDS TARGET' : 'ATTENTION REQUIRED'}
              </p>
            </div>

            {/* TOTAL FLIGHTS CARD */}
            <div className="bg-gradient-to-br from-slate-900 to-slate-950 border border-blue-500/40 rounded-2xl p-4 shadow-xl">
              <div className="flex items-center justify-between text-blue-400 text-xs font-black uppercase tracking-wider">
                <span>FLIGHT OPERATIONS VOLUME</span>
                <Plane className="w-5 h-5 text-blue-400" />
              </div>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-3xl sm:text-4xl font-black text-white font-mono tracking-tight">
                  {totalReportsCount}
                </span>
                <span className="text-xs font-bold text-slate-400 font-sans">Departure Flights (Direct / Turnaround)</span>
              </div>
              <div className="mt-3 flex items-center justify-between text-[11px] text-slate-400 font-mono pt-2 border-t border-slate-800">
                <span>Punctual: <strong className="text-emerald-400">{onTimeCount}</strong></span>
                <span>Delayed: <strong className="text-red-400">{delayedCount}</strong></span>
              </div>
            </div>

            {/* DELAY RATE CARD */}
            <div className="bg-gradient-to-br from-slate-900 to-slate-950 border border-red-500/40 rounded-2xl p-4 shadow-xl">
              <div className="flex items-center justify-between text-red-400 text-xs font-black uppercase tracking-wider">
                <span>DELAY IMPACT RATE</span>
                <AlertTriangle className="w-5 h-5 text-red-400" />
              </div>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-3xl sm:text-4xl font-black text-red-400 font-mono tracking-tight">
                  {delayRate}%
                </span>
                <span className="text-xs font-bold text-slate-400 font-sans">Delayed Ratio</span>
              </div>
              <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden mt-3 border border-slate-700">
                <div
                  className="bg-gradient-to-r from-red-500 to-orange-500 h-full rounded-full transition-all duration-500"
                  style={{ width: `${Math.max(5, parseFloat(delayRate))}%` }}
                />
              </div>
              <p className="text-[10px] text-red-400/80 mt-2 font-mono">
                Affected: {delayedCount} out of {totalReportsCount} total flights
              </p>
            </div>

            {/* TOP DELAY REASON CARD */}
            <div className="bg-gradient-to-br from-slate-900 to-slate-950 border border-amber-500/40 rounded-2xl p-4 shadow-xl">
              <div className="flex items-center justify-between text-amber-400 text-xs font-black uppercase tracking-wider">
                <span>PRIMARY DELAY CONTRIBUTOR</span>
                <TrendingUp className="w-5 h-5 text-amber-400" />
              </div>
              <div className="mt-2">
                <p className="text-xs font-black text-amber-200 line-clamp-2 leading-snug">
                  {topDelayItems.length > 1
                    ? `${topDelayItems.length} CODES TIED FOR TOP FREQUENCY`
                    : topDelayItem
                    ? topDelayItem.code
                    : 'ZERO DELAYS REGISTERED'}
                </p>
              </div>
              <div className="mt-3 pt-2 border-t border-slate-800 flex items-center justify-between text-[11px] text-amber-400/90 font-mono">
                <span>Impact: {topDelayItem ? `${topDelayItem.count} Flight(s) Each` : 'N/A'}</span>
                <span>{topDelayItem && delayedCount > 0 ? `${((topDelayItem.count / delayedCount) * 100).toFixed(0)}% Share` : ''}</span>
              </div>
            </div>
          </div>

          {/* REPORT REMARKS TEXT BOX */}
          <div className="bg-gradient-to-r from-amber-500/10 via-slate-900 to-slate-900 border border-amber-500/40 rounded-2xl p-4 sm:p-5 shadow-xl space-y-2">
            <div className="flex items-center gap-2 text-amber-400 text-xs font-black uppercase tracking-wider">
              <Sparkles className="w-4 h-4 text-amber-400 animate-pulse" />
              <span>REPORT REMARKS:</span>
            </div>
            <div className="text-xs text-slate-200 leading-relaxed font-sans space-y-2">
              {topDelayItems.length > 0 ? (
                topDelayItems.length === 1 ? (
                  <>
                    <p>
                      <strong className="text-amber-300">• Most Used Delay Code:</strong> {topDelayItems[0].code}
                    </p>
                    <p>
                      <strong className="text-amber-300">• Used Today:</strong> {topDelayItems[0].count} time(s) ({((topDelayItems[0].count / delayedCount) * 100).toFixed(1)}% of total delays)
                    </p>
                    <p>
                      <strong className="text-amber-300">• Affected Flight(s):</strong> {topDelayItems[0].flights.join(', ')}
                    </p>
                  </>
                ) : (
                  <div className="space-y-2">
                    <p className="font-bold text-amber-300">• Most Used Delay Codes ({topDelayItems.length} Codes Tied for Top Frequency):</p>
                    {topDelayItems.map((item, idx) => (
                      <div key={item.code} className="pl-3 border-l-2 border-amber-500/60 space-y-0.5">
                        <p className="font-semibold text-amber-200">Code #{idx + 1}: {item.code}</p>
                        <p className="text-[11px] text-slate-300">• Frequency: Used {item.count} time(s) ({((item.count / delayedCount) * 100).toFixed(1)}% of total delays)</p>
                        <p className="text-[11px] text-slate-300">• Affected Flights: <span className="font-mono text-amber-300 font-bold">{item.flights.join(', ')}</span></p>
                      </div>
                    ))}
                  </div>
                )
              ) : (
                <p className="text-emerald-400 font-bold">
                  ✓ 100% On-Time Performance! Zero operational delays recorded for this period.
                </p>
              )}
            </div>
          </div>

          {/* CATEGORIZED DELAY PARETO & DETAILED BREAKDOWN */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            
            {/* PARETO CATEGORY BREAKDOWN */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5 space-y-4 shadow-xl">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <h3 className="text-xs font-black text-amber-300 uppercase tracking-wider flex items-center gap-2">
                  <Layers className="w-4 h-4 text-amber-400" />
                  CATEGORY-WISE DELAY PARETO BREAKDOWN
                </h3>
                <span className="text-[10px] font-mono text-slate-400 bg-slate-950 px-2 py-0.5 rounded border border-slate-800">
                  IATA CLASSIFICATION
                </span>
              </div>

              {activeCategoryBreakdown.length === 0 ? (
                <div className="p-8 text-center text-slate-500 space-y-2">
                  <Award className="w-10 h-10 mx-auto text-emerald-400 opacity-40" />
                  <p className="text-xs font-black text-emerald-400 uppercase">100% PUNCTUAL PERFORMANCE</p>
                  <p className="text-[11px] text-slate-500">No category delays recorded for this timeframe.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {activeCategoryBreakdown.map((cat) => (
                    <div key={cat.catName} className="bg-slate-950/80 p-3 rounded-xl border border-slate-800 space-y-1.5">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-bold text-slate-200">{cat.catName}</span>
                        <span className="font-mono font-black text-amber-300">
                          {cat.count} Flight(s) <span className="text-slate-400 font-normal">({cat.pct}%)</span>
                        </span>
                      </div>
                      <div className="w-full bg-slate-900 h-2 rounded-full overflow-hidden border border-slate-800">
                        <div
                          className="bg-gradient-to-r from-amber-500 to-yellow-500 h-full rounded-full"
                          style={{ width: `${Math.max(5, parseFloat(cat.pct))}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* SPECIFIC DELAY REASON CODES */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5 space-y-4 shadow-xl">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <h3 className="text-xs font-black text-amber-300 uppercase tracking-wider flex items-center gap-2">
                  <PieChart className="w-4 h-4 text-amber-400" />
                  SPECIFIC DELAY CODES DISTRIBUTION
                </h3>
                <span className="text-[10px] font-mono text-slate-400 bg-slate-950 px-2 py-0.5 rounded border border-slate-800">
                  {delayBreakdown.length} UNIQUE CODE(S)
                </span>
              </div>

              {delayBreakdown.length === 0 ? (
                <div className="p-8 text-center text-slate-500 space-y-2">
                  <CheckCircle2 className="w-10 h-10 mx-auto text-emerald-400 opacity-40" />
                  <p className="text-xs font-black text-emerald-400 uppercase">NO DELAY CODES REGISTERED</p>
                  <p className="text-[11px] text-slate-500">All flights departed strictly on schedule.</p>
                </div>
              ) : (
                <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
                  {delayBreakdown.map((item, index) => {
                    const sharePct = ((item.count / delayedCount) * 100).toFixed(1);
                    return (
                      <div
                        key={item.code}
                        className="bg-slate-950/90 border border-slate-800 rounded-xl p-3 space-y-1.5 hover:border-amber-500/40 transition-all"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="space-y-0.5 flex-1">
                            <div className="flex items-center gap-2">
                              <span className="w-5 h-5 rounded-full bg-amber-500 text-slate-950 font-black text-[10px] flex items-center justify-center shrink-0">
                                #{index + 1}
                              </span>
                              <span className="text-xs font-bold text-amber-100">{item.code}</span>
                            </div>
                            <p className="text-[10px] text-slate-400 font-mono pl-7">
                              Flights: <span className="text-amber-300 font-bold">{item.flights.join(', ')}</span>
                            </p>
                          </div>

                          <div className="text-right shrink-0">
                            <span className="text-xs font-black text-amber-300 font-mono">
                              {item.count} Flight(s)
                            </span>
                            <span className="block text-[10px] font-bold text-slate-400 font-mono">
                              {sharePct}% of delays
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* DELAYED FLIGHT LOG SUMMARY TABLE */}
          {delayedReports.length > 0 && (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5 space-y-3 shadow-xl">
              <h3 className="text-xs font-black text-red-400 uppercase tracking-wider flex items-center gap-2 border-b border-slate-800 pb-2">
                <FileSpreadsheet className="w-4 h-4 text-red-400" />
                DELAYED FLIGHTS LOG TABLE ({delayedReports.length})
              </h3>

              <div className="overflow-x-auto divide-y divide-slate-800 max-h-60 overflow-y-auto rounded-xl border border-slate-800">
                <table className="w-full text-left text-xs">
                  <thead className="text-[10px] text-slate-400 uppercase bg-slate-950 font-mono sticky top-0">
                    <tr>
                      <th className="p-2.5">DATE</th>
                      <th className="p-2.5">FLIGHT</th>
                      <th className="p-2.5">ROUTE</th>
                      <th className="p-2.5">AIRCRAFT</th>
                      <th className="p-2.5">STD / A/B</th>
                      <th className="p-2.5">STATUS</th>
                      <th className="p-2.5">DELAY CODE / REASON</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 font-mono text-[11px] bg-slate-950/50">
                    {delayedReports.map((r) => (
                      <tr key={r.id} className="hover:bg-slate-900/60 transition-colors">
                        <td className="p-2.5 text-slate-400 whitespace-nowrap">{r.formData.date || r.date || 'N/A'}</td>
                        <td className="p-2.5 font-bold text-amber-300">BS-{r.formData.deptFlt || 'XXX'}</td>
                        <td className="p-2.5 text-slate-300">{r.formData.deptRoute || 'N/A'}</td>
                        <td className="p-2.5 text-slate-400">{r.formData.ac || 'N/A'}</td>
                        <td className="p-2.5 text-slate-400">{r.formData.std} / {r.formData.ab || 'N/A'}</td>
                        <td className="p-2.5">
                          <span className="px-2 py-0.5 rounded bg-rose-950 text-rose-300 font-bold border border-rose-500/40 text-[10px]">
                            {r.formData.status || 'DELAYED'}
                          </span>
                        </td>
                        <td className="p-2.5 text-amber-200 font-sans font-medium">{r.formData.delayReason || 'Unspecified Delay'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* HIGH-RESOLUTION EXECUTIVE MANAGEMENT PRINTABLE CARD (EXPORTED TO JPG)      */}
          {/* ========================================================================= */}
          <div className="pt-4 border-t border-slate-800 space-y-3">
            <div className="flex items-center justify-between text-xs text-slate-400 flex-wrap gap-2">
              <span className="font-black uppercase text-amber-400 flex items-center gap-1.5">
                <Briefcase className="w-4 h-4" /> HIGH-DEFINITION EXECUTIVE REPORT BRIEF (JPG EXPORT CANVAS)
              </span>
              <span>Rendered at 1200px Retina Resolution</span>
            </div>

            <div className="p-1 bg-slate-950 border border-amber-500/50 rounded-2xl overflow-x-auto shadow-2xl">
              <div
                ref={printCardRef}
                style={{
                  width: '1200px',
                  minHeight: '1697px',
                  backgroundColor: '#ffffff',
                  color: '#0f172a',
                  fontFamily: 'system-ui, -apple-system, sans-serif',
                  padding: '40px',
                  borderRadius: '16px',
                  border: '4px solid #f59e0b',
                  boxSizing: 'border-box',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between'
                }}
              >
                <div>
                  {/* 1. Official US-Bangla Executive Header with Aircraft Tarmac Banner */}
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
                          ✈
                        </div>
                        <div>
                          <div style={{ fontSize: '32px', fontWeight: '900', color: '#ffffff', letterSpacing: '1px', lineHeight: '1.1' }}>
                            US-BANGLA AIRLINES
                          </div>
                          <div style={{ fontSize: '15px', fontWeight: '800', color: '#f59e0b', letterSpacing: '1px', marginTop: '4px' }}>
                            AIRPORT SERVICE DEPARTURE REPORT
                          </div>
                        </div>
                      </div>

                      <div style={{ textAlign: 'right', fontFamily: 'monospace', fontSize: '12px' }}>
                        <div style={{ backgroundColor: '#0f2963', border: '1.5px solid #38bdf8', padding: '6px 16px', borderRadius: '20px', color: '#ffffff', fontWeight: '900', marginBottom: '6px', display: 'inline-block' }}>
                          STRICTLY CONFIDENTIAL • MANAGEMENT REVIEW
                        </div>
                        <div style={{ color: '#93c5fd', marginTop: '2px' }}>
                          STATION: <strong style={{ color: '#ffffff', fontWeight: '900' }}>
                            {station} ({flightScopeFilter === 'DOMESTIC' ? 'DOMESTIC DEPARTURES' : flightScopeFilter === 'INTERNATIONAL' ? 'INTERNATIONAL DEPARTURES' : 'ALL DEPARTURES'})
                          </strong>
                        </div>
                        <div style={{ color: '#93c5fd' }}>REPORT PERIOD: <strong style={{ color: '#60a5fa', fontWeight: '900' }}>{selectedDateFilter === 'TODAY' ? todayDateStr : selectedDateFilter === 'CUSTOM_CALENDAR' ? formatIsoToDDMMMYY(calendarDate) : selectedDateFilter === 'PREVIOUS_MONTH' ? prevMonthInfo.label : selectedDateFilter}</strong></div>
                      </div>
                    </div>

                    {/* US-Bangla Airbus A330 Widebody Landing Banner */}
                    <div style={{ width: '100%', height: '250px', position: 'relative', overflow: 'hidden', backgroundColor: '#0f172a' }}>
                      <img
                        src={customHeaderPhoto || aircraftImage}
                        alt="US-Bangla Aircraft Banner"
                        referrerPolicy="no-referrer"
                        style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center 45%' }}
                      />
                      <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(3, 27, 78, 0.7) 0%, transparent 65%)' }} />
                      <div style={{ position: 'absolute', bottom: '12px', left: '20px', right: '20px', display: 'flex', itemsAlign: 'center', justifyContent: 'space-between', color: '#ffffff', fontFamily: 'sans-serif', fontSize: '11px', fontWeight: '800', letterSpacing: '0.5px' }}>
                        <span style={{ backgroundColor: 'rgba(3, 27, 78, 0.85)', padding: '4px 12px', borderRadius: '6px', border: '1px solid #38bdf8' }}>
                          US-BANGLA AIRLINES FLEET • HAZRAT SHAHJALAL INT'L AIRPORT (DAC)
                        </span>
                        <span style={{ backgroundColor: 'rgba(15, 23, 42, 0.85)', padding: '4px 12px', borderRadius: '6px', border: '1px solid #f59e0b', color: '#f59e0b' }}>
                          LIVE RAMP & DEPARTURE HUD METRICS
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* 2. Executive KPI Summary Cards Row (Matching Attachment 1 Exact Layout) */}
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(4, 1fr)',
                      gap: '16px',
                      marginBottom: '28px'
                    }}
                  >
                    {/* KPI 1 */}
                    <div
                      style={{
                        backgroundColor: '#f0fdf4',
                        border: '2px solid #22c55e',
                        borderRadius: '16px',
                        padding: '20px 16px',
                        textAlign: 'center',
                        boxShadow: '0 2px 4px rgba(0, 0, 0, 0.03)'
                      }}
                    >
                      <div style={{ fontSize: '13px', fontWeight: '900', color: '#15803d', textTransform: 'uppercase', tracking: '0.5px' }}>
                        ON-TIME PERFORMANCE (OTP)
                      </div>
                      <div style={{ fontSize: '42px', fontWeight: '900', color: '#16a34a', fontFamily: 'monospace', margin: '10px 0 6px 0', letterSpacing: '-1px' }}>
                        {otpRate}%
                      </div>
                      <div style={{ fontSize: '12px', color: '#475569', fontWeight: '700' }}>Target ≥85.0%</div>
                    </div>

                    {/* KPI 2 */}
                    <div
                      style={{
                        backgroundColor: '#eff6ff',
                        border: '2px solid #3b82f6',
                        borderRadius: '16px',
                        padding: '20px 16px',
                        textAlign: 'center',
                        boxShadow: '0 2px 4px rgba(0, 0, 0, 0.03)'
                      }}
                    >
                      <div style={{ fontSize: '13px', fontWeight: '900', color: '#1d4ed8', textTransform: 'uppercase', tracking: '0.5px' }}>
                        EVALUATED FLIGHTS
                      </div>
                      <div style={{ fontSize: '42px', fontWeight: '900', color: '#0f172a', fontFamily: 'monospace', margin: '10px 0 6px 0', letterSpacing: '-1px' }}>
                        {totalReportsCount}
                      </div>
                      <div style={{ fontSize: '12px', color: '#1d4ed8', fontWeight: '700' }}>Departure Flights (Direct / Turnaround)</div>
                    </div>

                    {/* KPI 3 */}
                    <div
                      style={{
                        backgroundColor: '#fef2f2',
                        border: '2px solid #ef4444',
                        borderRadius: '16px',
                        padding: '20px 16px',
                        textAlign: 'center',
                        boxShadow: '0 2px 4px rgba(0, 0, 0, 0.03)'
                      }}
                    >
                      <div style={{ fontSize: '13px', fontWeight: '900', color: '#b91c1c', textTransform: 'uppercase', tracking: '0.5px' }}>
                        DELAYED FLIGHTS
                      </div>
                      <div style={{ fontSize: '42px', fontWeight: '900', color: '#dc2626', fontFamily: 'monospace', margin: '10px 0 6px 0', letterSpacing: '-1px' }}>
                        {delayedCount}
                      </div>
                      <div style={{ fontSize: '12px', color: '#b91c1c', fontWeight: '700' }}>Delay Rate: {delayRate}%</div>
                    </div>

                    {/* KPI 4 */}
                    <div
                      style={{
                        backgroundColor: '#fffbeb',
                        border: '2px solid #f59e0b',
                        borderRadius: '16px',
                        padding: '20px 16px',
                        textAlign: 'center',
                        boxShadow: '0 2px 4px rgba(0, 0, 0, 0.03)'
                      }}
                    >
                      <div style={{ fontSize: '13px', fontWeight: '900', color: '#b45309', textTransform: 'uppercase', tracking: '0.5px' }}>
                        PUNCTUAL DEPARTURES
                      </div>
                      <div style={{ fontSize: '42px', fontWeight: '900', color: '#d97706', fontFamily: 'monospace', margin: '10px 0 6px 0', letterSpacing: '-1px' }}>
                        {onTimeCount}
                      </div>
                      <div style={{ fontSize: '12px', color: '#15803d', fontWeight: '700' }}>On-Time or Early</div>
                    </div>
                  </div>

                  {/* 3. Delay Breakdown Table */}
                  <div style={{ marginBottom: '28px', borderRadius: '12px', overflow: 'hidden', border: '1.5px solid #031b4e' }}>
                    <div
                      style={{
                        backgroundColor: '#031b4e',
                        color: '#ffffff',
                        padding: '12px 18px',
                        fontSize: '15px',
                        fontWeight: '900',
                        letterSpacing: '0.5px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px'
                      }}
                    >
                      <span>📊</span> IATA & AIRLINE DELAY REASONS ANALYSIS SUMMARY
                    </div>

                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '15px', fontFamily: 'sans-serif' }}>
                      <thead>
                        <tr style={{ backgroundColor: '#031b4e', color: '#ffffff' }}>
                          <th style={{ padding: '12px 10px', border: '1.5px solid #0f2963', width: '6%', textAlign: 'center', fontWeight: '900', fontSize: '15px' }}>#</th>
                          <th style={{ padding: '12px 12px', border: '1.5px solid #0f2963', textAlign: 'left', fontWeight: '900', width: '38%', fontSize: '15px' }}>DELAY CODE / OPERATIONAL REASON</th>
                          <th style={{ padding: '12px 12px', border: '1.5px solid #0f2963', textAlign: 'left', fontWeight: '900', width: '38%', fontSize: '15px' }}>AFFECTED FLIGHTS</th>
                          <th style={{ padding: '12px 10px', border: '1.5px solid #0f2963', width: '9%', textAlign: 'center', fontWeight: '900', fontSize: '15px' }}>COUNT</th>
                          <th style={{ padding: '12px 10px', border: '1.5px solid #0f2963', width: '9%', textAlign: 'center', fontWeight: '900', fontSize: '15px' }}>SHARE %</th>
                        </tr>
                      </thead>
                      <tbody>
                        {delayBreakdown.length === 0 ? (
                          <tr>
                            <td colSpan={5} style={{ padding: '28px', textAlign: 'center', color: '#15803d', fontWeight: '900', fontSize: '17px', border: '1.5px solid #cbd5e1', backgroundColor: '#f0fdf4' }}>
                              PERFECT PERFORMANCE: 100% ON-TIME OPERATIONAL DEPARTURES (ZERO DELAYS)
                            </td>
                          </tr>
                        ) : (
                          delayBreakdown.map((item, idx) => {
                            const pct = ((item.count / delayedCount) * 100).toFixed(1);
                            return (
                              <tr key={item.code} style={{ backgroundColor: idx % 2 === 0 ? '#ffffff' : '#f1f5f9' }}>
                                <td style={{ padding: '12px 10px', border: '1.5px solid #94a3b8', textAlign: 'center', fontWeight: '900', color: '#b45309', fontSize: '16px' }}>
                                  {idx + 1}
                                </td>
                                <td style={{ padding: '12px 12px', border: '1.5px solid #94a3b8', color: '#000000', fontWeight: '900', fontSize: '15px', lineHeight: '1.4' }}>
                                  {item.code}
                                </td>
                                <td style={{ padding: '12px 12px', border: '1.5px solid #94a3b8', color: '#031b4e', fontWeight: '900', fontFamily: 'monospace', fontSize: '15px', lineHeight: '1.4' }}>
                                  {item.flights.join(', ')}
                                </td>
                                <td style={{ padding: '12px 10px', border: '1.5px solid #94a3b8', textAlign: 'center', fontFamily: 'monospace', fontWeight: '900', color: '#dc2626', fontSize: '17px' }}>
                                  {item.count}
                                </td>
                                <td style={{ padding: '12px 10px', border: '1.5px solid #94a3b8', textAlign: 'center', fontFamily: 'monospace', fontWeight: '900', color: '#1d4ed8', fontSize: '17px' }}>
                                  {pct}%
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>

                  {/* 4. Report Remarks Section */}
                  <div
                    style={{
                      backgroundColor: '#f8fafc',
                      border: '2px solid #94a3b8',
                      borderLeft: '6px solid #0284c7',
                      borderRadius: '12px',
                      padding: '18px 22px',
                      marginBottom: '24px'
                    }}
                  >
                    <div style={{ fontSize: '16px', fontWeight: '900', color: '#031b4e', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span>📋</span> REPORT REMARKS:
                    </div>
                    <div style={{ fontSize: '15px', color: '#0f172a', lineHeight: '1.6', fontFamily: 'sans-serif', fontWeight: '800' }}>
                      {topDelayItems.length > 0 ? (
                        topDelayItems.length === 1 ? (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                            <div>
                              <strong style={{ color: '#0f172a', fontWeight: '900', fontSize: '15px' }}>• Most Used Delay Code:</strong>{' '}
                              <span style={{ color: '#b45309', fontWeight: '900', fontSize: '16px' }}>{topDelayItems[0].code}</span>
                            </div>
                            <div>
                              <strong style={{ color: '#0f172a', fontWeight: '900', fontSize: '15px' }}>• Frequency Today:</strong> Used{' '}
                              <strong style={{ color: '#dc2626', fontWeight: '900', fontSize: '16px' }}>{topDelayItems[0].count} time(s)</strong> today ({((topDelayItems[0].count / delayedCount) * 100).toFixed(1)}% of total station delays).
                            </div>
                            <div>
                              <strong style={{ color: '#0f172a', fontWeight: '900', fontSize: '15px' }}>• Affected Flight(s):</strong>{' '}
                              <span style={{ color: '#031b4e', fontWeight: '900', fontFamily: 'monospace', fontSize: '16px' }}>{topDelayItems[0].flights.join(', ')}</span>
                            </div>
                          </div>
                        ) : (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                            <div>
                              <strong style={{ color: '#0f172a', fontWeight: '900', fontSize: '15px' }}>• Most Used Delay Codes ({topDelayItems.length} Codes Tied for Top Frequency):</strong>
                            </div>
                            {topDelayItems.map((item, idx) => {
                              const pct = ((item.count / delayedCount) * 100).toFixed(1);
                              return (
                                <div key={item.code} style={{ paddingLeft: '14px', borderLeft: '4px solid #b45309', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                  <div>
                                    <strong style={{ color: '#b45309', fontWeight: '900', fontSize: '15px' }}>Code #{idx + 1}:</strong>{' '}
                                    <span style={{ color: '#0f172a', fontWeight: '900', fontSize: '16px' }}>{item.code}</span>
                                  </div>
                                  <div style={{ fontSize: '14px' }}>
                                    <strong style={{ fontWeight: '900' }}>• Frequency Today:</strong> Used <strong style={{ color: '#dc2626', fontWeight: '900', fontSize: '15px' }}>{item.count} time(s)</strong> ({pct}% of total station delays).
                                  </div>
                                  <div style={{ fontSize: '14px' }}>
                                    <strong style={{ fontWeight: '900' }}>• Affected Flight(s):</strong>{' '}
                                    <span style={{ color: '#031b4e', fontWeight: '900', fontFamily: 'monospace', fontSize: '15px' }}>{item.flights.join(', ')}</span>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )
                      ) : (
                        <div style={{ color: '#16a34a', fontWeight: '900', fontSize: '16px' }}>
                          ✓ Ground operational efficiency was 100% on schedule with zero ramp delays recorded during this period.
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* 5. Footer Official Approval & Verification Bar */}
                <div
                  style={{
                    backgroundColor: '#031b4e',
                    borderRadius: '14px',
                    padding: '16px 28px',
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
                      <span style={{ color: '#93c5fd' }}>PREPARED BY:</span> <strong style={{ color: '#f59e0b', fontSize: '13px' }}>{adminName}</strong> <span style={{ color: '#93c5fd' }}>(ID-{adminId})</span>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', backgroundColor: '#0f2963', padding: '8px 20px', borderRadius: '10px', border: '1px solid #2563eb' }}>
                    <div style={{ width: '28px', height: '28px', borderRadius: '50%', backgroundColor: '#15803d', color: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px', fontWeight: 'bold' }}>
                      ✓
                    </div>
                    <div style={{ textAlign: 'left' }}>
                      <div style={{ color: '#4ade80', fontWeight: '900', fontSize: '12px', letterSpacing: '0.5px' }}>US-BANGLA RAMP HUD VERIFIED</div>
                      <div style={{ color: '#93c5fd', fontSize: '10px' }}>GEN: {new Date().toLocaleString()}</div>
                    </div>
                  </div>
                </div>

              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};
