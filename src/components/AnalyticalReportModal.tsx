import React, { useState, useRef } from 'react';
import { SavedReport, ScheduleFlight } from '../types';
import html2canvas from 'html2canvas';
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
  const [isDownloading, setIsDownloading] = useState(false);

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

  // 4. Default Date Selection is "TODAY"
  const [selectedDateFilter, setSelectedDateFilter] = useState<string>('TODAY');

  // Filter reports based on selected date mode
  const filteredReports = valid30DaysReports.filter((r) => {
    const rDateObj = parseReportDate(r);
    const rDateStr = r.formData?.date || r.date || '';

    if (selectedDateFilter === 'TODAY') {
      return isSameDay(rDateObj, now) || rDateStr.toUpperCase().includes(todayDateStr);
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
    // Specific date selected
    return rDateStr === selectedDateFilter;
  });

  // Calculate Key Operational Metrics
  const totalReportsCount = filteredReports.length;

  const delayedReports = filteredReports.filter(
    (r) => r.formData.status?.includes('DELAY') || Boolean(r.formData.delayReason?.trim())
  );
  const delayedCount = delayedReports.length;
  const onTimeCount = Math.max(0, totalReportsCount - delayedCount);

  const otpRate = totalReportsCount > 0 ? ((onTimeCount / totalReportsCount) * 100).toFixed(1) : '100.0';
  const delayRate = totalReportsCount > 0 ? ((delayedCount / totalReportsCount) * 100).toFixed(1) : '0.0';

  // Group delays by Delay Code / Reason
  const delayCodeMap: Record<string, { code: string; count: number; flights: string[] }> = {};

  delayedReports.forEach((r) => {
    const code = r.formData.delayReason?.trim() || 'UNSPECIFIED DELAY CODE';
    const fltName = `BS-${r.formData.deptFlt || 'XXX'} (${r.formData.deptRoute || 'ROUTE'})`;
    if (!delayCodeMap[code]) {
      delayCodeMap[code] = { code, count: 0, flights: [] };
    }
    delayCodeMap[code].count += 1;
    delayCodeMap[code].flights.push(fltName);
  });

  const delayBreakdown = Object.values(delayCodeMap).sort((a, b) => b.count - a.count);
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

      const canvas = await html2canvas(printCardRef.current, {
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
          
          {/* CONTROL & DATE FILTER SELECTION BAR */}
          <div className="bg-slate-900/90 border border-amber-500/40 rounded-2xl p-4 flex items-center justify-between flex-wrap gap-4 shadow-xl">
            <div className="flex items-center gap-3 flex-wrap">
              <div className="flex items-center gap-2 text-amber-400">
                <Calendar className="w-5 h-5" />
                <span className="text-xs font-black uppercase text-slate-200 tracking-wider">
                  SELECT REPORT PERIOD:
                </span>
              </div>

              <div className="relative">
                <select
                  value={selectedDateFilter}
                  onChange={(e) => setSelectedDateFilter(e.target.value)}
                  className="bg-slate-950 border-2 border-amber-500/60 rounded-xl pl-3 pr-8 py-2 text-xs text-amber-300 font-mono font-black outline-none focus:border-amber-400 cursor-pointer shadow-inner appearance-none"
                >
                  <option value="TODAY">TODAY ({todayDateStr}) - [DEFAULT]</option>
                  <option value="PREVIOUS_MONTH">PREVIOUS MONTH SUMMARY ({prevMonthInfo.shortMonth} {prevMonthInfo.year}) [AUTO-SAVED]</option>
                  <option value="LAST_30_DAYS">FULL 30-DAY SUMMARY ({valid30DaysReports.length} FLIGHTS)</option>
                  {uniqueDatesIn30Days.map((d) => (
                    <option key={d} value={d}>
                      MANUAL DATE: {d}
                    </option>
                  ))}
                </select>
                <ChevronDown className="w-4 h-4 text-amber-400 absolute right-2.5 top-2.5 pointer-events-none" />
              </div>

              {selectedDateFilter === 'TODAY' && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  LIVE TODAY VIEW
                </span>
              )}
              {selectedDateFilter === 'PREVIOUS_MONTH' && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  AUTO MONTHLY ARCHIVE
                </span>
              )}
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
                  {topDelayItem ? topDelayItem.code : 'ZERO DELAYS REGISTERED'}
                </p>
              </div>
              <div className="mt-3 pt-2 border-t border-slate-800 flex items-center justify-between text-[11px] text-amber-400/90 font-mono">
                <span>Impact: {topDelayItem ? `${topDelayItem.count} Flight(s)` : 'N/A'}</span>
                <span>{topDelayItem && delayedCount > 0 ? `${((topDelayItem.count / delayedCount) * 100).toFixed(0)}% Share` : ''}</span>
              </div>
            </div>
          </div>

          {/* AI / AUTOMATED EXECUTIVE BRIEFING TEXT BOX */}
          <div className="bg-gradient-to-r from-amber-500/10 via-slate-900 to-slate-900 border border-amber-500/40 rounded-2xl p-4 sm:p-5 shadow-xl space-y-2">
            <div className="flex items-center gap-2 text-amber-400 text-xs font-black uppercase tracking-wider">
              <Sparkles className="w-4 h-4 text-amber-400 animate-pulse" />
              <span>AUTOMATED EXECUTIVE PERFORMANCE BRIEFING</span>
            </div>
            <p className="text-xs text-slate-200 leading-relaxed font-sans">
              Station <strong className="text-amber-300 font-bold">{station}</strong> recorded{' '}
              <strong className="text-white font-bold">{totalReportsCount} flight turnaround operations</strong> during the selected period ({selectedDateFilter === 'TODAY' ? `Today ${todayDateStr}` : selectedDateFilter === 'PREVIOUS_MONTH' ? prevMonthInfo.label : selectedDateFilter}).
              The overall On-Time Performance (OTP) stands at{' '}
              <strong className="text-emerald-400 font-bold">{otpRate}%</strong> with {onTimeCount} punctual departures and {delayedCount} recorded delay(s).{' '}
              {delayedCount > 0 ? (
                <>
                  The primary operational bottleneck was identified as{' '}
                  <strong className="text-amber-300 font-bold">{topDelayItem?.code}</strong>, representing{' '}
                  <strong className="text-amber-300 font-bold">
                    {topDelayItem && delayedCount > 0 ? ((topDelayItem.count / delayedCount) * 100).toFixed(1) : 0}%
                  </strong>{' '}
                  of overall station delays.
                </>
              ) : (
                'Zero operational delays were registered during this period, achieving 100% ground ramp operational efficiency.'
              )}
            </p>
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
                        <td className="p-2.5 text-slate-400">{r.formData.std} / {r.formData.ab || r.formData.airborne || 'N/A'}</td>
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
                  fontFamily: 'Arial, Helvetica, sans-serif',
                  padding: '48px',
                  borderRadius: '16px',
                  border: '4px solid #f59e0b',
                  boxSizing: 'border-box',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between'
                }}
              >
                <div>
                  {/* Official US-Bangla Executive Header (Day Mode) */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      borderBottom: '3px solid #f59e0b',
                      paddingBottom: '20px',
                      marginBottom: '28px'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '18px' }}>
                      <div
                        style={{
                          width: '58px',
                          height: '58px',
                          borderRadius: '14px',
                          backgroundColor: '#f59e0b',
                          color: '#030712',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '32px',
                          fontWeight: '900'
                        }}
                      >
                        ✈
                      </div>
                      <div>
                        <div style={{ fontSize: '28px', fontWeight: '900', color: '#0f172a', letterSpacing: '1.5px' }}>
                          US-BANGLA AIRLINES
                        </div>
                        <div style={{ fontSize: '15px', fontWeight: '800', color: '#b45309', letterSpacing: '1px', marginTop: '2px' }}>
                          GROUND HANDLING & RAMP OPERATIONS DIVISION
                        </div>
                      </div>
                    </div>

                    <div style={{ textAlign: 'right', fontFamily: 'monospace', fontSize: '13px', color: '#334155' }}>
                      <div style={{ backgroundColor: '#fef3c7', border: '1px solid #f59e0b', padding: '6px 16px', borderRadius: '8px', color: '#b45309', fontWeight: '900', marginBottom: '6px' }}>
                        STRICTLY CONFIDENTIAL • BOARD REVIEW
                      </div>
                      <div>STATION: <strong style={{ color: '#0f172a' }}>{station} (ALL DEPARTURES)</strong></div>
                      <div>REPORT PERIOD: <strong style={{ color: '#1d4ed8' }}>{selectedDateFilter === 'TODAY' ? todayDateStr : selectedDateFilter === 'PREVIOUS_MONTH' ? prevMonthInfo.label : selectedDateFilter}</strong></div>
                    </div>
                  </div>

                  {/* Executive KPI Summary Cards Row (Day Mode) */}
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(4, 1fr)',
                      gap: '16px',
                      marginBottom: '32px'
                    }}
                  >
                    {/* KPI 1 */}
                    <div
                      style={{
                        backgroundColor: '#f0fdf4',
                        border: '2px solid #22c55e',
                        borderRadius: '14px',
                        padding: '16px',
                        textAlign: 'center'
                      }}
                    >
                      <div style={{ fontSize: '12px', fontWeight: '800', color: '#15803d', textTransform: 'uppercase' }}>
                        ON-TIME PERFORMANCE (OTP)
                      </div>
                      <div style={{ fontSize: '36px', fontWeight: '900', color: '#16a34a', fontFamily: 'monospace', margin: '6px 0' }}>
                        {otpRate}%
                      </div>
                      <div style={{ fontSize: '11px', color: '#475569', fontWeight: 'bold' }}>Target ≥85.0%</div>
                    </div>

                    {/* KPI 2 */}
                    <div
                      style={{
                        backgroundColor: '#eff6ff',
                        border: '2px solid #3b82f6',
                        borderRadius: '14px',
                        padding: '16px',
                        textAlign: 'center'
                      }}
                    >
                      <div style={{ fontSize: '12px', fontWeight: '800', color: '#1d4ed8', textTransform: 'uppercase' }}>
                        EVALUATED FLIGHTS
                      </div>
                      <div style={{ fontSize: '36px', fontWeight: '900', color: '#0f172a', fontFamily: 'monospace', margin: '6px 0' }}>
                        {totalReportsCount}
                      </div>
                      <div style={{ fontSize: '11px', color: '#1d4ed8', fontWeight: 'bold' }}>Departure Flights (Direct / Turnaround)</div>
                    </div>

                    {/* KPI 3 */}
                    <div
                      style={{
                        backgroundColor: '#fef2f2',
                        border: '2px solid #ef4444',
                        borderRadius: '14px',
                        padding: '16px',
                        textAlign: 'center'
                      }}
                    >
                      <div style={{ fontSize: '12px', fontWeight: '800', color: '#b91c1c', textTransform: 'uppercase' }}>
                        DELAYED FLIGHTS
                      </div>
                      <div style={{ fontSize: '36px', fontWeight: '900', color: '#dc2626', fontFamily: 'monospace', margin: '6px 0' }}>
                        {delayedCount}
                      </div>
                      <div style={{ fontSize: '11px', color: '#b91c1c', fontWeight: 'bold' }}>Delay Rate: {delayRate}%</div>
                    </div>

                    {/* KPI 4 */}
                    <div
                      style={{
                        backgroundColor: '#fffbeb',
                        border: '2px solid #f59e0b',
                        borderRadius: '14px',
                        padding: '16px',
                        textAlign: 'center'
                      }}
                    >
                      <div style={{ fontSize: '12px', fontWeight: '800', color: '#b45309', textTransform: 'uppercase' }}>
                        PUNCTUAL DEPARTURES
                      </div>
                      <div style={{ fontSize: '36px', fontWeight: '900', color: '#d97706', fontFamily: 'monospace', margin: '6px 0' }}>
                        {onTimeCount}
                      </div>
                      <div style={{ fontSize: '11px', color: '#15803d', fontWeight: 'bold' }}>On-Time or Early</div>
                    </div>
                  </div>

                  {/* Delay Breakdown Table (Day Mode) */}
                  <div style={{ marginBottom: '32px' }}>
                    <div style={{ fontSize: '14px', fontWeight: '900', color: '#b45309', textTransform: 'uppercase', marginBottom: '14px', letterSpacing: '0.5px' }}>
                      IATA & AIRLINE DELAY REASONS ANALYSIS SUMMARY:
                    </div>

                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', fontFamily: 'sans-serif' }}>
                      <thead>
                        <tr style={{ backgroundColor: '#0f172a', color: '#ffffff' }}>
                          <th style={{ padding: '12px 10px', border: '1.5px solid #0f172a', width: '6%', textAlign: 'center', fontWeight: '900' }}>#</th>
                          <th style={{ padding: '12px 10px', border: '1.5px solid #0f172a', textAlign: 'left', fontWeight: '900' }}>DELAY CODE / OPERATIONAL REASON</th>
                          <th style={{ padding: '12px 10px', border: '1.5px solid #0f172a', textAlign: 'left', fontWeight: '900' }}>AFFECTED FLIGHTS</th>
                          <th style={{ padding: '12px 10px', border: '1.5px solid #0f172a', width: '12%', textAlign: 'center', fontWeight: '900' }}>COUNT</th>
                          <th style={{ padding: '12px 10px', border: '1.5px solid #0f172a', width: '12%', textAlign: 'center', fontWeight: '900' }}>SHARE %</th>
                        </tr>
                      </thead>
                      <tbody>
                        {delayBreakdown.length === 0 ? (
                          <tr>
                            <td colSpan={5} style={{ padding: '24px', textAlign: 'center', color: '#16a34a', fontWeight: '900', fontSize: '14px', border: '1.5px solid #cbd5e1', backgroundColor: '#f0fdf4' }}>
                              PERFECT PERFORMANCE: 100% ON-TIME OPERATIONAL DEPARTURES (ZERO DELAYS)
                            </td>
                          </tr>
                        ) : (
                          delayBreakdown.map((item, idx) => {
                            const pct = ((item.count / delayedCount) * 100).toFixed(1);
                            return (
                              <tr key={item.code} style={{ backgroundColor: idx % 2 === 0 ? '#ffffff' : '#f8fafc' }}>
                                <td style={{ padding: '12px 10px', border: '1.5px solid #cbd5e1', textAlign: 'center', fontWeight: '900', color: '#b45309' }}>
                                  {idx + 1}
                                </td>
                                <td style={{ padding: '12px 10px', border: '1.5px solid #cbd5e1', color: '#0f172a', fontWeight: '800' }}>
                                  {item.code}
                                </td>
                                <td style={{ padding: '12px 10px', border: '1.5px solid #cbd5e1', color: '#1e293b', fontWeight: '700', fontFamily: 'monospace' }}>
                                  {item.flights.join(', ')}
                                </td>
                                <td style={{ padding: '12px 10px', border: '1.5px solid #cbd5e1', textAlign: 'center', fontFamily: 'monospace', fontWeight: '900', color: '#b45309', fontSize: '14px' }}>
                                  {item.count}
                                </td>
                                <td style={{ padding: '12px 10px', border: '1.5px solid #cbd5e1', textAlign: 'center', fontFamily: 'monospace', fontWeight: '900', color: '#1d4ed8', fontSize: '14px' }}>
                                  {pct}%
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Footer Official Approval & Verification Block (A4 Bottom) */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    borderTop: '2px dashed #94a3b8',
                    paddingTop: '20px',
                    fontSize: '13px',
                    color: '#334155',
                    fontFamily: 'monospace',
                    marginTop: 'auto'
                  }}
                >
                  <div>
                    PREPARED BY: <strong style={{ color: '#b45309', fontSize: '14px' }}>{adminName}</strong> (ID-{adminId})
                  </div>

                  <div style={{ textAlign: 'center', border: '1.5px solid #cbd5e1', padding: '10px 28px', borderRadius: '12px', backgroundColor: '#f8fafc' }}>
                    <div style={{ color: '#16a34a', fontWeight: '900', fontSize: '12px', letterSpacing: '0.5px' }}>US-BANGLA RAMP HUD VERIFIED</div>
                    <div style={{ color: '#475569', fontSize: '11px', marginTop: '2px' }}>GEN: {new Date().toLocaleString()}</div>
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
