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

  // Helper to normalize flight numbers for matching e.g. "BS-343", "343", "BS 343"
  const cleanFlightNum = (str: string) => {
    if (!str) return '';
    return str.replace(/BS/gi, '').replace(/[^0-[#a-zA-Z0-9]/g, '').trim().toUpperCase();
  };

  // Reconcile scheduled departure flights with saved reports
  const flightReconciliation = targetFlights.map((sf) => {
    const targetCode = cleanFlightNum(sf.flightNum || sf.flightFull);

    // Find latest matching saved report
    const matchingReports = savedReports.filter((r) => {
      const deptFlt = cleanFlightNum(r.formData?.deptFlt || r.flight || '');
      return deptFlt === targetCode;
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
    <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-5 overflow-y-auto fade-in">
      <div className="bg-slate-900 border-2 border-amber-500/60 rounded-3xl w-full max-w-5xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden my-auto">
        {/* Header */}
        <div className="p-4 sm:p-5 bg-slate-950 border-b border-slate-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/20 border border-amber-400/50 flex items-center justify-center text-amber-400 shadow-lg">
              <FileCheck2 className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base font-black text-amber-400 uppercase tracking-wider">
                  COMPLETE FLIGHT RECONCILIATION
                </h2>
                <span className="text-[10px] font-mono font-bold px-2.5 py-0.5 rounded-full bg-slate-900 text-amber-300 border border-amber-500/40">
                  {scheduleDate}
                </span>
              </div>
              <p className="text-xs text-slate-400 font-sans mt-0.5">
                Audit generated flight reports against FLST schedule for 100% analytical accuracy
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-700 transition-all cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Operational Statistics Cards */}
        <div className="p-4 bg-slate-950/60 border-b border-slate-800 shrink-0 space-y-3">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3 bg-slate-900 border border-slate-800 rounded-2xl space-y-1">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block font-mono">
                FLST SCHEDULE FLIGHTS
              </span>
              <div className="text-xl font-black text-white font-mono">{totalCount}</div>
            </div>

            <div className="p-3 bg-emerald-950/40 border border-emerald-500/50 rounded-2xl space-y-1">
              <span className="text-[10px] font-black text-emerald-400 uppercase tracking-wider block font-mono">
                REPORT GENERATED (✅)
              </span>
              <div className="text-xl font-black text-emerald-300 font-mono">{completedCount}</div>
            </div>

            <div className="p-3 bg-rose-950/40 border border-rose-500/50 rounded-2xl space-y-1">
              <span className="text-[10px] font-black text-rose-400 uppercase tracking-wider block font-mono">
                REPORT MISSING (⚠️)
              </span>
              <div className="text-xl font-black text-rose-300 font-mono">{missingCount}</div>
            </div>

            <div className="p-3 bg-amber-950/40 border border-amber-500/50 rounded-2xl space-y-1">
              <span className="text-[10px] font-black text-amber-400 uppercase tracking-wider block font-mono">
                COMPLETION ACCURACY
              </span>
              <div className="text-xl font-black text-amber-300 font-mono">{completionRate}%</div>
            </div>
          </div>

          {/* Warning banner if missing flights exist */}
          {missingCount > 0 ? (
            <div className="p-3 bg-rose-950/60 border border-rose-500/60 rounded-2xl flex items-center justify-between flex-wrap gap-2 text-xs">
              <div className="flex items-center gap-2 text-rose-200 font-medium">
                <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0" />
                <span>
                  <strong>{missingCount} flight report(s) missing!</strong> Analytical report metrics will be incomplete until all reports are submitted.
                </span>
              </div>
              <button
                type="button"
                onClick={handleCopyMissingList}
                className="px-3 py-1.5 rounded-xl bg-rose-500 hover:bg-rose-400 text-slate-950 font-black text-xs uppercase flex items-center gap-1.5 transition-all shadow-md cursor-pointer"
              >
                {copiedText ? (
                  <>
                    <Check className="w-4 h-4" /> COPIED TO CLIPBOARD!
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4" /> COPY MISSING FLIGHTS LIST
                  </>
                )}
              </button>
            </div>
          ) : (
            <div className="p-3 bg-emerald-950/60 border border-emerald-500/60 rounded-2xl flex items-center gap-2 text-xs text-emerald-200 font-bold">
              <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
              <span>🎉 100% COMPLETE! All schedule flight reports have been submitted successfully.</span>
            </div>
          )}

          {/* Filters & Search Row */}
          <div className="flex items-center justify-between flex-wrap gap-2 pt-1">
            <div className="flex items-center gap-1 bg-slate-900 p-1 rounded-xl border border-slate-800">
              <button
                type="button"
                onClick={() => setFilterTab('ALL')}
                className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer ${
                  filterTab === 'ALL'
                    ? 'bg-amber-400 text-slate-950 shadow'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                ALL FLIGHTS ({totalCount})
              </button>
              <button
                type="button"
                onClick={() => setFilterTab('COMPLETED')}
                className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer ${
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
                className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer ${
                  filterTab === 'MISSING'
                    ? 'bg-rose-500 text-slate-950 shadow'
                    : 'text-slate-400 hover:text-rose-400'
                }`}
              >
                MISSING ⚠️ ({missingCount})
              </button>
            </div>

            <div className="relative flex-1 max-w-xs">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search flight no, route, officer..."
                className="w-full bg-slate-900 border border-slate-700 rounded-xl pl-9 pr-3 py-1.5 text-xs text-white placeholder-slate-500 outline-none focus:border-amber-400 font-mono"
              />
            </div>
          </div>
        </div>

        {/* Table / List View */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2.5 custom-scrollbar">
          {filteredList.length === 0 ? (
            <div className="p-8 text-center text-slate-400 space-y-2">
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
                  className={`p-3.5 rounded-2xl border transition-all flex flex-col md:flex-row md:items-center justify-between gap-3 ${
                    item.isCompleted
                      ? 'bg-slate-950/80 border-slate-800 hover:border-slate-700'
                      : 'bg-rose-950/30 border-rose-500/50 hover:border-rose-500'
                  }`}
                >
                  {/* Left: Scheduled Flight Info */}
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-11 h-11 rounded-2xl border flex items-center justify-center font-black text-sm shrink-0 font-mono shadow-md ${
                        item.isCompleted
                          ? 'bg-emerald-950 text-emerald-300 border-emerald-500/40'
                          : 'bg-rose-950 text-rose-300 border-rose-500/40'
                      }`}
                    >
                      {item.isCompleted ? '✅' : '⚠️'}
                    </div>

                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-black text-amber-300 font-mono tracking-wide">
                          {sf.flightFull}
                        </span>
                        <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-slate-900 border border-slate-700 text-slate-200 font-mono">
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
                        <div className="text-xs text-slate-300 flex items-center gap-3 flex-wrap pt-0.5">
                          <span className="flex items-center gap-1 text-slate-400">
                            <User className="w-3.5 h-3.5 text-amber-400" />
                            Officer: <strong className="text-white">{r.officerName || r.formData?.ac || 'Saved'}</strong>
                          </span>
                          <span className="flex items-center gap-1 text-slate-400">
                            <Clock className="w-3.5 h-3.5 text-blue-400" />
                            Status: <strong className="text-emerald-300">{r.formData?.status}</strong>
                          </span>
                        </div>
                      ) : (
                        <p className="text-xs text-rose-300 italic font-sans">
                          🚨 Report missing! Flight departed without ramp report generation.
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Right: Completion Badge / Action */}
                  <div className="flex items-center gap-2 shrink-0">
                    {item.isCompleted ? (
                      <span className="px-3 py-1.5 rounded-xl bg-emerald-500/20 text-emerald-300 border border-emerald-500/50 text-xs font-black uppercase tracking-wider flex items-center gap-1.5">
                        <CheckCircle2 className="w-4 h-4 text-emerald-400" /> REPORT GENERATED
                      </span>
                    ) : (
                      <span className="px-3 py-1.5 rounded-xl bg-rose-500/20 text-rose-300 border border-rose-500/50 text-xs font-black uppercase tracking-wider flex items-center gap-1.5">
                        <AlertTriangle className="w-4 h-4 text-rose-400 animate-pulse" /> MISSING
                      </span>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 bg-slate-950 border-t border-slate-800 flex items-center justify-between shrink-0 flex-wrap gap-2">
          <span className="text-xs text-slate-400 font-mono">
            * Keep all reports updated to ensure 100% Analytical Report OTP calculation accuracy.
          </span>
          <button
            onClick={onClose}
            className="px-5 py-2.5 bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-xs uppercase tracking-wider rounded-xl transition-all cursor-pointer shadow-md"
          >
            CLOSE RECONCILIATION
          </button>
        </div>
      </div>
    </div>
  );
};
