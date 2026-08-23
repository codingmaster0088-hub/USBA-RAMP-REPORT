import React, { useState, useMemo } from 'react';
import { ScheduleFlight, SavedReport } from '../types';
import { parseDateToIso, formatIsoToDisplay, cleanFlightNum } from '../utils/analyticalSnapshotBuilder';
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

  // Today ISO helper
  const todayIso = useMemo(() => parseDateToIso(), []);

  // Initialize selected date from scheduleDate or today
  const initialIsoDate = useMemo(() => {
    if (scheduleDate && scheduleDate.trim()) {
      return parseDateToIso(scheduleDate);
    }
    return parseDateToIso();
  }, [scheduleDate]);

  const [selectedIsoDate, setSelectedIsoDate] = useState<string>(initialIsoDate);

  // Sync selectedIsoDate if scheduleDate changes
  React.useEffect(() => {
    if (scheduleDate && scheduleDate.trim()) {
      setSelectedIsoDate(parseDateToIso(scheduleDate));
    }
  }, [scheduleDate]);

  const isTodaySelected = selectedIsoDate === todayIso;
  const activeDateDisplay = formatIsoToDisplay(selectedIsoDate);

  // Filter only departure flights (isDeparture === true, or fallback to all flights if empty)
  const departureSchedule = scheduleFlights.filter((f) => f.isDeparture !== false);
  const targetFlights = departureSchedule.length > 0 ? departureSchedule : scheduleFlights;

  // Helper to test if a saved report belongs to the selected reconciliation date
  const isReportDateMatchingSelectedDate = (r: SavedReport, targetIso: string): boolean => {
    if (!targetIso) return true;
    const normalizedTargetIso = parseDateToIso(targetIso);
    
    // 1. Direct form date match using standardized parseDateToIso
    const rDateString = (r.formData?.date || r.date || '').trim();
    if (rDateString) {
      const rIso = parseDateToIso(rDateString);
      if (rIso === normalizedTargetIso) return true;
      // Match by month & day (e.g. "08-23" === "08-23")
      if (rIso.slice(5) === normalizedTargetIso.slice(5)) return true;
      if (isTodaySelected && rDateString.toUpperCase().includes('TODAY')) return true;
    }

    // 2. Fallback check timestamp
    const rTs = r.timestamp || r.createdAt;
    if (rTs) {
      const tsIso = typeof rTs === 'number'
        ? new Date(rTs).toISOString().slice(0, 10)
        : parseDateToIso(String(rTs));
      if (tsIso === normalizedTargetIso) return true;
      if (tsIso.slice(5) === normalizedTargetIso.slice(5)) return true;
    }

    return false;
  };

  // Deduplicate target flights by flight code so multi-leg flights (e.g. BS-321 DAC vs CGP) don't duplicate
  const targetFlightsDeduplicated = useMemo(() => {
    const map = new Map<string, ScheduleFlight>();
    targetFlights.forEach((sf) => {
      const code = cleanFlightNum(sf.flightNum || sf.flightFull);
      if (!code) return;
      const existing = map.get(code);
      if (!existing) {
        map.set(code, sf);
      } else {
        // Prefer DAC departure if available
        if (sf.sector.toUpperCase().startsWith('DAC') || sf.sector.toUpperCase().includes('DAC')) {
          map.set(code, sf);
        }
      }
    });
    return Array.from(map.values());
  }, [targetFlights]);

  // Reconcile scheduled departure flights with saved reports for the SELECTED DATE
  const flightReconciliation = targetFlightsDeduplicated.map((sf) => {
    const targetCode = cleanFlightNum(sf.flightNum || sf.flightFull);

    // Find latest matching saved report for the SELECTED DATE
    const matchingReports = savedReports.filter((r) => {
      const deptFlt = cleanFlightNum(r.formData?.deptFlt || '');
      const mainFlt = cleanFlightNum(r.flight || '');
      const arvFlt = cleanFlightNum(r.formData?.arvFlt || '');

      const isSameCode = deptFlt === targetCode || mainFlt === targetCode || arvFlt === targetCode;
      if (!isSameCode) return false;

      // Ensure report belongs to target selected date
      return isReportDateMatchingSelectedDate(r, selectedIsoDate);
    });

    // Sort by latest updated/created timestamp descending so the MOST RECENT report is always active
    matchingReports.sort((a, b) => {
      const timeA = a.createdAt || (a.timestamp ? new Date(a.timestamp).getTime() : 0);
      const timeB = b.createdAt || (b.timestamp ? new Date(b.timestamp).getTime() : 0);
      return timeB - timeA;
    });

    const latestReport = matchingReports.length > 0 ? matchingReports[0] : null;

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
      `🚨 US-BANGLA RAMP REPORT ALERT (${activeDateDisplay}) 🚨`,
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
        <div className="py-2.5 px-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between shrink-0 flex-wrap gap-2">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-amber-500/20 border border-amber-400/50 flex items-center justify-center text-amber-400 shadow">
              <FileCheck2 className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-sm sm:text-base font-black text-amber-400 uppercase tracking-wider">
                  COMPLETE FLIGHT RECONCILIATION
                </h2>
                <span className="text-[10px] font-mono font-bold px-2.5 py-0.5 rounded-full bg-slate-900 text-amber-300 border border-amber-500/40 flex items-center gap-1">
                  <Calendar className="w-3 h-3 text-amber-400" />
                  {activeDateDisplay}
                </span>
                {isTodaySelected && (
                  <span className="text-[9px] font-black px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 tracking-wider font-mono">
                    TODAY (AUTO)
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-400 font-sans hidden sm:block">
                Audit generated flight reports against FLST schedule for 100% analytical accuracy
              </p>
            </div>
          </div>

          {/* Date Selector Controls in Header */}
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-1.5 bg-slate-900 border border-amber-500/40 rounded-xl px-2.5 py-1 shadow-inner">
              <Calendar className="w-3.5 h-3.5 text-amber-400" />
              <input
                type="date"
                value={selectedIsoDate}
                onChange={(e) => setSelectedIsoDate(e.target.value)}
                className="bg-transparent text-xs text-amber-300 font-mono font-bold outline-none cursor-pointer scheme-dark"
                title="Select date to reconcile reports"
              />
            </div>

            {!isTodaySelected ? (
              <button
                type="button"
                onClick={() => setSelectedIsoDate(todayIso)}
                className="px-2.5 py-1 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 text-xs font-black transition-all cursor-pointer flex items-center gap-1"
                title="Return to today's date"
              >
                <span>📅</span> TODAY
              </button>
            ) : (
              <span className="text-[10px] font-bold text-emerald-400 font-mono hidden md:inline px-1">
                ● LIVE
              </span>
            )}

            <button
              onClick={onClose}
              className="p-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-700 transition-all cursor-pointer ml-1"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
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
            * Flight reports generated for {activeDateDisplay} are matched against scheduled departures.
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
