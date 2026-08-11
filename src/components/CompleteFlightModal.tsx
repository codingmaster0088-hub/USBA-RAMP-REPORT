import React, { useState } from 'react';
import { ScheduleFlight, SavedReport } from '../types';
import {
  CheckCircle2,
  AlertTriangle,
  X,
  Search,
  Copy,
  Check,
  Calendar,
  Plane,
  User,
  Clock,
  ArrowRight,
  ShieldAlert,
  FileCheck2
} from 'lucide-react';

interface CompleteFlightModalProps {
  scheduleFlights: ScheduleFlight[];
  savedReports: SavedReport[];
  scheduleDate: string;
  onClose: () => void;
}

export const CompleteFlightModal: React.FC<CompleteFlightModalProps> = ({
  scheduleFlights,
  savedReports,
  scheduleDate,
  onClose
}) => {
  const [filterTab, setFilterTab] = useState<'ALL' | 'COMPLETED' | 'MISSING'>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [copiedText, setCopiedText] = useState<boolean>(false);

  // Filter only departure flights (isDeparture === true, or fallback to all flights if empty)
  const departureSchedule = scheduleFlights.filter((f) => f.isDeparture !== false);
  const targetFlights = departureSchedule.length > 0 ? departureSchedule : scheduleFlights;

  // Helper to test if a saved report belongs to today's schedule date
  const isReportDateMatchingSchedule = (r: SavedReport, scheduleDateStr: string): boolean => {
    const rDateString = (r.formData?.date || r.date || '').trim().toUpperCase();
    const rTimestamp = r.timestamp || '';

    // Helper to parse day (1-31) and month (JAN-DEC or 1-12)
    const parseDayMonth = (str: string) => {
      if (!str) return null;

      // 1. "11AUG", "11 AUG", "11-AUG"
      const alphaMatch = str.match(/\b(\d{1,2})\s*[-/]?\s*([A-Za-z]{3})\b/i);
      if (alphaMatch) {
        return {
          day: parseInt(alphaMatch[1], 10),
          month: alphaMatch[2].toUpperCase()
        };
      }

      // 2. ISO or DD/MM/YYYY
      const numericMatch = str.match(/\b(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})\b/);
      if (numericMatch) {
        const monthNames = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
        return {
          day: parseInt(numericMatch[1], 10),
          month: monthNames[parseInt(numericMatch[2], 10) - 1] || ''
        };
      }

      const isoMatch = str.match(/\b(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})\b/);
      if (isoMatch) {
        const monthNames = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
        return {
          day: parseInt(isoMatch[3], 10),
          month: monthNames[parseInt(isoMatch[2], 10) - 1] || ''
        };
      }

      return null;
    };

    let target = parseDayMonth(scheduleDateStr);

    // Fallback: If scheduleDate is not parsed, use today's actual date
    if (!target) {
      const today = new Date();
      const monthNames = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
      target = {
        day: today.getDate(),
        month: monthNames[today.getMonth()]
      };
    }

    const rParsed = parseDayMonth(rDateString);
    if (rParsed && target) {
      return rParsed.day === target.day && rParsed.month === target.month;
    }

    // Try rTimestamp if available
    if (rTimestamp && target) {
      const t = new Date(rTimestamp);
      if (!isNaN(t.getTime())) {
        const monthNames = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
        if (t.getDate() === target.day && monthNames[t.getMonth()] === target.month) {
          return true;
        }
      }
    }

    return false;
  };

  // Helper to normalize flight numbers for matching e.g. "BS-343", "343", "BS 343"
  const cleanFlightNum = (str: string) => {
    if (!str) return '';
    return str.replace(/BS/gi, '').replace(/[^0-[#a-zA-Z0-9]/g, '').trim().toUpperCase();
  };

  // Reconcile scheduled departure flights with saved reports for TODAY'S schedule date
  const flightReconciliation = targetFlights.map((sf) => {
    const targetCode = cleanFlightNum(sf.flightNum || sf.flightFull);

    // Find latest matching saved report for TODAY'S schedule date
    const matchingReports = savedReports.filter((r) => {
      const deptFlt = cleanFlightNum(r.formData?.deptFlt || r.flight || '');
      const isSameCode = deptFlt === targetCode;
      if (!isSameCode) return false;

      // Ensure report belongs to target schedule date
      return isReportDateMatchingSchedule(r, scheduleDate);
    });

    // Get the latest saved report if multiple exist
    const latestReport = matchingReports.length > 0 ? matchingReports[matchingReports.length - 1] : null;

    return {
      scheduleFlight: sf,
      cleanCode: targetCode,
      isCompleted: Boolean(latestReport),
      report: latestReport
    };
  });

  // Calculate reconciliation statistics
  const totalCount = flightReconciliation.length;
  const completedCount = flightReconciliation.filter((item) => item.isCompleted).length;
  const missingCount = totalCount - completedCount;
  const completionRate = totalCount > 0 ? ((completedCount / totalCount) * 100).toFixed(1) : '100.0';

  // Filter reconciliation list based on user selections
  const filteredList = flightReconciliation.filter((item) => {
    if (filterTab === 'COMPLETED' && !item.isCompleted) return false;
    if (filterTab === 'MISSING' && item.isCompleted) return false;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const fltFull = item.scheduleFlight.flightFull.toLowerCase();
      const sector = item.scheduleFlight.sector.toLowerCase();
      const ac = item.scheduleFlight.aircraft.toLowerCase();
      const officer = item.report?.officerName?.toLowerCase() || '';
      return fltFull.includes(q) || sector.includes(q) || ac.includes(q) || officer.includes(q);
    }
    return true;
  });

  const missingFlights = flightReconciliation.filter((item) => !item.isCompleted);

  // Handle Copy Missing Flights List for Admin
  const handleCopyMissingList = () => {
    if (missingFlights.length === 0) return;
    const lines = [
      `🚨 US-BANGLA RAMP REPORT ALERT (${scheduleDate}) 🚨`,
      `The following ${missingFlights.length} flight departure reports are MISSING:`,
      ...missingFlights.map(
        (m, i) =>
          `${i + 1}. ${m.scheduleFlight.flightFull} (${m.scheduleFlight.sector}) - STD: ${
            m.scheduleFlight.timeStr
          } - A/C: ${m.scheduleFlight.aircraft}`
      ),
      `Please generate and submit these ramp reports immediately to keep Analytical Report 100% accurate!`
    ];
    navigator.clipboard.writeText(lines.join('\n'));
    setCopiedText(true);
    setTimeout(() => setCopiedText(false), 3000);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 overflow-hidden fade-in">
      <div className="bg-slate-900 border-2 border-amber-500/60 rounded-3xl w-full max-w-[98vw] lg:max-w-7xl h-[94vh] max-h-[96vh] flex flex-col shadow-2xl overflow-hidden my-auto">
        {/* Header */}
        <div className="py-2.5 px-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-amber-500/20 border border-amber-400/50 flex items-center justify-center text-amber-400 shadow">
              <FileCheck2 className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-sm sm:text-base font-black text-amber-400 uppercase tracking-wider">
                  COMPLETE FLIGHT RECONCILIATION
                </h2>
                <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-slate-900 text-amber-300 border border-amber-500/40">
                  {scheduleDate}
                </span>
              </div>
              <p className="text-[11px] text-slate-400 font-sans hidden sm:block">
                Audit today's generated flight reports against FLST schedule for 100% analytical accuracy
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-700 transition-all cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Compact Operational Statistics & Control Toolbar */}
        <div className="p-2.5 bg-slate-950/80 border-b border-slate-800 shrink-0 space-y-2">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <div className="px-3 py-1.5 bg-slate-900 border border-slate-800 rounded-xl flex items-center justify-between">
              <span className="text-[10px] font-black text-slate-400 uppercase font-mono">
                FLST SCHEDULE
              </span>
              <span className="text-base font-black text-white font-mono">{totalCount}</span>
            </div>

            <div className="px-3 py-1.5 bg-emerald-950/40 border border-emerald-500/50 rounded-xl flex items-center justify-between">
              <span className="text-[10px] font-black text-emerald-400 uppercase font-mono">
                GENERATED ✅
              </span>
              <span className="text-base font-black text-emerald-300 font-mono">{completedCount}</span>
            </div>

            <div className="px-3 py-1.5 bg-rose-950/40 border border-rose-500/50 rounded-xl flex items-center justify-between">
              <span className="text-[10px] font-black text-rose-400 uppercase font-mono">
                MISSING ⚠️
              </span>
              <span className="text-base font-black text-rose-300 font-mono">{missingCount}</span>
            </div>

            <div className="px-3 py-1.5 bg-amber-950/40 border border-amber-500/50 rounded-xl flex items-center justify-between">
              <span className="text-[10px] font-black text-amber-400 uppercase font-mono">
                ACCURACY
              </span>
              <span className="text-base font-black text-amber-300 font-mono">{completionRate}%</span>
            </div>
          </div>

          {/* Filters & Search Row */}
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-1 bg-slate-900 p-1 rounded-xl border border-slate-800">
              <button
                type="button"
                onClick={() => setFilterTab('ALL')}
                className={`px-2.5 py-1 rounded-lg text-xs font-black transition-all cursor-pointer ${
                  filterTab === 'ALL'
                    ? 'bg-amber-400 text-slate-950 shadow'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                ALL ({totalCount})
              </button>
              <button
                type="button"
                onClick={() => setFilterTab('COMPLETED')}
                className={`px-2.5 py-1 rounded-lg text-xs font-black transition-all cursor-pointer ${
                  filterTab === 'COMPLETED'
                    ? 'bg-emerald-500 text-slate-950 shadow'
                    : 'text-slate-400 hover:text-emerald-400'
                }`}
              >
                GENERATED ✅ ({completedCount})
              </button>
              <button
                type="button"
                onClick={() => setFilterTab('MISSING')}
                className={`px-2.5 py-1 rounded-lg text-xs font-black transition-all cursor-pointer ${
                  filterTab === 'MISSING'
                    ? 'bg-rose-500 text-slate-950 shadow'
                    : 'text-slate-400 hover:text-rose-400'
                }`}
              >
                MISSING ⚠️ ({missingCount})
              </button>
            </div>

            {missingCount > 0 && (
              <button
                type="button"
                onClick={handleCopyMissingList}
                className="px-2.5 py-1 rounded-lg bg-rose-500 hover:bg-rose-400 text-slate-950 font-black text-[11px] uppercase flex items-center gap-1 transition-all shadow cursor-pointer ml-auto"
              >
                {copiedText ? (
                  <>
                    <Check className="w-3.5 h-3.5" /> COPIED!
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" /> COPY MISSING LIST
                  </>
                )}
              </button>
            )}

            <div className="relative flex-1 min-w-[180px] max-w-xs">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search flight no, route, officer..."
                className="w-full bg-slate-900 border border-slate-700 rounded-xl pl-8 pr-2.5 py-1 text-xs text-white placeholder-slate-500 outline-none focus:border-amber-400 font-mono"
              />
            </div>
          </div>
        </div>

        {/* EXPANDED Main Report Viewing Container */}
        <div className="flex-1 min-h-0 overflow-y-auto p-3 sm:p-4 space-y-2 custom-scrollbar bg-slate-950/40">
          {filteredList.length === 0 ? (
            <div className="py-12 text-center text-slate-400 space-y-2">
              <Plane className="w-8 h-8 mx-auto text-slate-600 animate-bounce" />
              <p className="text-xs font-mono">No departure flights match the selected filter query.</p>
            </div>
          ) : (
            filteredList.map((item, idx) => {
              const sf = item.scheduleFlight;
              const r = item.report;

              return (
                <div
                  key={sf.id || idx}
                  className={`p-2.5 sm:p-3 rounded-2xl border transition-all flex flex-col md:flex-row md:items-center justify-between gap-2.5 ${
                    item.isCompleted
                      ? 'bg-slate-900/90 border-slate-800 hover:border-slate-700'
                      : 'bg-rose-950/20 border-rose-500/40 hover:border-rose-500'
                  }`}
                >
                  {/* Left: Scheduled Flight Info */}
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-9 h-9 sm:w-10 sm:h-10 rounded-xl border flex items-center justify-center font-black text-xs shrink-0 font-mono shadow ${
                        item.isCompleted
                          ? 'bg-emerald-950 text-emerald-300 border-emerald-500/40'
                          : 'bg-rose-950 text-rose-300 border-rose-500/40'
                      }`}
                    >
                      {item.isCompleted ? '✅' : '⚠️'}
                    </div>

                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-black text-amber-300 font-mono tracking-wide">
                          {sf.flightFull}
                        </span>
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-950 border border-slate-800 text-slate-200 font-mono">
                          {sf.sector}
                        </span>
                        <span className="text-[11px] font-mono text-slate-400">
                          STD: <strong className="text-white">{sf.timeStr} LT</strong>
                        </span>
                        <span className="text-[11px] font-mono text-slate-400">
                          A/C: <strong className="text-amber-200">{sf.aircraft}</strong>
                        </span>
                      </div>

                      {item.isCompleted && r ? (
                        <div className="text-xs text-slate-300 flex items-center gap-3 flex-wrap">
                          <span className="flex items-center gap-1 text-slate-400 text-[11px]">
                            <User className="w-3 h-3 text-amber-400" />
                            Officer: <strong className="text-white">{r.officerName || r.formData?.ac || 'Saved'}</strong>
                          </span>
                          <span className="flex items-center gap-1 text-slate-400 text-[11px]">
                            <Clock className="w-3 h-3 text-blue-400" />
                            Status: <strong className="text-emerald-300">{r.formData?.status}</strong>
                          </span>
                        </div>
                      ) : (
                        <p className="text-[11px] text-rose-300 italic font-sans">
                          🚨 Report missing for today! Flight departed without ramp report generation.
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Right: Completion Badge */}
                  <div className="flex items-center gap-2 shrink-0">
                    {item.isCompleted ? (
                      <span className="px-2.5 py-1 rounded-xl bg-emerald-500/20 text-emerald-300 border border-emerald-500/50 text-[11px] font-black uppercase tracking-wider flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> REPORT GENERATED
                      </span>
                    ) : (
                      <span className="px-2.5 py-1 rounded-xl bg-rose-500/20 text-rose-300 border border-rose-500/50 text-[11px] font-black uppercase tracking-wider flex items-center gap-1">
                        <AlertTriangle className="w-3.5 h-3.5 text-rose-400 animate-pulse" /> MISSING
                      </span>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Compact Modal Footer */}
        <div className="py-2.5 px-4 bg-slate-950 border-t border-slate-800 flex items-center justify-between shrink-0 flex-wrap gap-2">
          <span className="text-[11px] text-slate-400 font-mono">
            * Only flight reports generated for today's schedule ({scheduleDate}) are matched here.
          </span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-xs uppercase tracking-wider rounded-xl transition-all cursor-pointer shadow"
          >
            CLOSE RECONCILIATION
          </button>
        </div>
      </div>
    </div>
  );
};
