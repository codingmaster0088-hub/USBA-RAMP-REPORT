import React, { useState, useEffect, useMemo } from 'react';
import {
  Trash2,
  Edit,
  Download,
  Plane,
  FileSpreadsheet,
  Clock,
  ShieldCheck,
  History,
  Timer
} from 'lucide-react';
import { SavedReport } from '../types';

interface SavedReportsProps {
  savedReports: SavedReport[];
  onEditReport: (id: string) => void;
  onDeleteReport: (id: string) => void;
  onDeleteAllReports?: () => void;
  onDownloadJPG: (report: SavedReport) => void;
  isDarkMode?: boolean;
  isAdmin?: boolean;
}

const TWENTY_HOURS_MS = 20 * 60 * 60 * 1000;

export const SavedReports: React.FC<SavedReportsProps> = ({
  savedReports,
  onEditReport,
  onDeleteReport,
  onDeleteAllReports,
  onDownloadJPG,
  isDarkMode = true,
  isAdmin = false
}) => {
  const [filterType, setFilterType] = useState<'ALL' | 'DOMESTIC' | 'INTERNATIONAL'>('ALL');
  const [showOnlyActive20H, setShowOnlyActive20H] = useState<boolean>(true);
  const [nowMs, setNowMs] = useState<number>(Date.now());

  // Update live clock every 10 seconds for precise countdown display
  useEffect(() => {
    const timer = setInterval(() => {
      setNowMs(Date.now());
    }, 10000);
    return () => clearInterval(timer);
  }, []);

  // Helper to calculate remaining time before report auto-vanishes (20 Hours from last save/edit)
  const getRemainingVanishTime = (timestamp: string) => {
    const repTime = new Date(timestamp).getTime();
    if (isNaN(repTime) || repTime <= 0) return '20h 00m left';

    const remainingMs = TWENTY_HOURS_MS - (nowMs - repTime);
    if (remainingMs <= 0) return 'Expiring...';

    const hours = Math.floor(remainingMs / (1000 * 60 * 60));
    const minutes = Math.floor((remainingMs % (1000 * 60 * 60)) / (1000 * 60));

    return `${hours}h ${minutes.toString().padStart(2, '0')}m left`;
  };

  // Filter logic: Deduplicate by Flight Number + Domestic/Intl + 20 Hours Expiry
  const { filteredReports, recent20Count, totalCount } = useMemo(() => {
    // Deduplicate reports by normalized flight number, keeping the most recent one
    const uniqueMap = new Map<string, SavedReport>();
    const sorted = [...savedReports].sort((a, b) => {
      const tA = new Date(a.timestamp).getTime() || 0;
      const tB = new Date(b.timestamp).getTime() || 0;
      return tB - tA;
    });

    sorted.forEach((rep) => {
      const fltClean = (rep.flight || rep.formData?.deptFlt || '')
        .replace(/^BS-?/i, '')
        .trim()
        .toUpperCase();
      const key = fltClean ? `BS-${fltClean}` : rep.id;

      if (!uniqueMap.has(key)) {
        uniqueMap.set(key, rep);
      }
    });

    const deduplicatedReports = Array.from(uniqueMap.values());

    const active20H = deduplicatedReports.filter((rep) => {
      if (!rep.timestamp) return true;
      const repTime = new Date(rep.timestamp).getTime();
      return !isNaN(repTime) ? nowMs - repTime <= TWENTY_HOURS_MS : true;
    });

    const activeBase = showOnlyActive20H ? active20H : deduplicatedReports;

    const matched = activeBase.filter((report) => {
      if (filterType === 'ALL') return true;
      return report.type === filterType;
    });

    return {
      filteredReports: matched,
      recent20Count: active20H.length,
      totalCount: deduplicatedReports.length
    };
  }, [savedReports, filterType, showOnlyActive20H, nowMs]);

  return (
    <div className={`space-y-3 pb-20 fade-in ${isDarkMode ? 'text-slate-100' : 'text-slate-900'}`}>
      {/* Header Banner & 20 Hours Switch */}
      <div
        className={`rounded-2xl p-3 shadow-lg space-y-2.5 border ${
          isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-300 shadow-slate-200'
        }`}
      >
        <div className="flex items-center justify-between">
          <div>
            <h2
              className={`text-xs font-black uppercase tracking-wider flex items-center gap-2 ${
                isDarkMode ? 'text-white' : 'text-slate-900'
              }`}
            >
              <FileSpreadsheet className="w-4 h-4 text-amber-500" />
              SAVED TURNAROUND REPORTS ({filteredReports.length})
            </h2>
            <p className={`text-[10px] mt-0.5 ${isDarkMode ? 'text-slate-400' : 'text-slate-600 font-bold'}`}>
              Auto-vanish 20 hours after last save/edit • Live Firestore sync
            </p>
          </div>

          <div
            className={`flex items-center rounded-lg p-0.5 border text-[10px] ${
              isDarkMode ? 'bg-slate-950 border-slate-800' : 'bg-slate-100 border-slate-300'
            }`}
          >
            <button
              onClick={() => setFilterType('ALL')}
              className={`px-2 py-0.5 rounded-md font-bold transition-all cursor-pointer ${
                filterType === 'ALL'
                  ? 'bg-amber-500 text-slate-950 font-black'
                  : isDarkMode ? 'text-slate-400' : 'text-slate-600 font-bold'
              }`}
            >
              ALL
            </button>
            <button
              onClick={() => setFilterType('DOMESTIC')}
              className={`px-2 py-0.5 rounded-md font-bold transition-all cursor-pointer ${
                filterType === 'DOMESTIC'
                  ? 'bg-amber-500 text-slate-950 font-black'
                  : isDarkMode ? 'text-slate-400' : 'text-slate-600 font-bold'
              }`}
            >
              DOM
            </button>
            <button
              onClick={() => setFilterType('INTERNATIONAL')}
              className={`px-2 py-0.5 rounded-md font-bold transition-all cursor-pointer ${
                filterType === 'INTERNATIONAL'
                  ? 'bg-amber-500 text-slate-950 font-black'
                  : isDarkMode ? 'text-slate-400' : 'text-slate-600 font-bold'
              }`}
            >
              INTL
            </button>
          </div>
        </div>

        {/* 20-Hours Auto-Vanish Filter Switch */}
        <div
          className={`flex items-center justify-between p-2 rounded-xl border text-xs ${
            isDarkMode ? 'bg-slate-950/80 border-slate-800' : 'bg-slate-50 border-slate-200'
          }`}
        >
          <div className={`flex items-center gap-1.5 text-[11px] ${isDarkMode ? 'text-slate-300' : 'text-slate-800 font-bold'}`}>
            <Timer className="w-3.5 h-3.5 text-amber-500" />
            <span>Show: <strong className={isDarkMode ? 'text-amber-300' : 'text-amber-900 font-black'}>{showOnlyActive20H ? 'Active (< 20H)' : 'All History'}</strong></span>
          </div>          <div
            className={`flex items-center p-0.5 rounded-lg border text-[10px] ${
              isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-slate-200 border-slate-300'
            }`}
          >
            <button
              onClick={() => setShowOnlyActive20H(true)}
              className={`px-2 py-1 rounded-md font-bold transition-all flex items-center gap-1 cursor-pointer ${
                showOnlyActive20H
                  ? 'bg-emerald-500 text-slate-950 shadow-md font-black'
                  : isDarkMode ? 'text-slate-400' : 'text-slate-700'
              }`}
            >
              <Clock className="w-3 h-3" />
              <span>ACTIVE (20H)</span>
            </button>
            <button
              onClick={() => setShowOnlyActive20H(false)}
              className={`px-2 py-1 rounded-md font-bold transition-all flex items-center gap-1 cursor-pointer ${
                !showOnlyActive20H
                  ? 'bg-amber-500 text-slate-950 shadow-md font-black'
                  : isDarkMode ? 'text-slate-400' : 'text-slate-700'
              }`}
            >
              <History className="w-3 h-3" />
              <span>ALL ({totalCount})</span>
            </button>
          </div>
        </div>

        {/* Admin Purge All Action Bar */}
        {isAdmin && (
          <div
            className={`flex items-center justify-between p-2 rounded-xl border ${
              isDarkMode
                ? 'bg-red-950/40 border-red-900/60 text-red-300'
                : 'bg-red-50 border-red-200 text-red-900'
            }`}
          >
            <div className="flex items-center gap-1.5 text-[11px] font-bold">
              <Trash2 className="w-3.5 h-3.5 text-red-500 shrink-0" />
              <span>ADMIN CLEAR CONTROL</span>
            </div>
            {onDeleteAllReports && (
              <button
                type="button"
                onClick={onDeleteAllReports}
                className="px-2.5 py-1 rounded-lg bg-red-600 hover:bg-red-700 active:scale-95 text-white font-mono text-[10px] font-black uppercase tracking-wider transition-all flex items-center gap-1 shadow-md cursor-pointer"
              >
                <Trash2 className="w-3 h-3" />
                <span>PURGE ALL FLIGHTS ({savedReports.length})</span>
              </button>
            )}
          </div>
        )}
      </div>

      {/* Reports Compact List */}
      {filteredReports.length === 0 ? (
        <div
          className={`border rounded-2xl p-8 text-center space-y-2 ${
            isDarkMode ? 'bg-slate-900/60 border-slate-800' : 'bg-white border-slate-300 shadow-sm'
          }`}
        >
          <Plane className="w-10 h-10 text-slate-500 mx-auto opacity-50" />
          <p className={`text-xs font-bold ${isDarkMode ? 'text-slate-300' : 'text-slate-900'}`}>
            No saved reports found.
          </p>
          <p className="text-[11px] text-slate-500 max-w-xs mx-auto">
            {showOnlyActive20H
              ? 'No active reports created or updated in the last 20 hours.'
              : 'No saved reports available.'}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {filteredReports.map((report) => {
            const lastUpdatedTime = new Date(report.timestamp).toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit'
            });
            const remainingCountdown = getRemainingVanishTime(report.timestamp);

            return (
              <div
                key={report.id}
                className={`relative group border-2 rounded-2xl p-3.5 shadow-xl transition-all space-y-2.5 overflow-hidden backdrop-blur-md ${
                  report.type === 'INTERNATIONAL'
                    ? isDarkMode ? 'border-amber-500/60 shadow-amber-500/10 bg-slate-900/95' : 'border-amber-400 bg-white'
                    : isDarkMode ? 'border-cyan-500/60 shadow-cyan-500/10 bg-slate-900/95' : 'border-cyan-400 bg-white'
                }`}
              >
                {/* Left Highlight Accent Bar */}
                <div
                  className={`absolute left-0 top-0 bottom-0 w-1.5 ${
                    report.type === 'INTERNATIONAL'
                      ? 'bg-gradient-to-b from-amber-400 to-amber-600'
                      : 'bg-gradient-to-b from-cyan-400 to-blue-600'
                  }`}
                />

                {/* Top Info Bar: Flight No, Route, Type, Depart Time */}
                <div
                  className={`flex flex-wrap items-center justify-between gap-2 pb-2 pl-2 border-b ${
                    isDarkMode ? 'border-slate-800/80' : 'border-slate-200'
                  }`}
                >
                  <div className="flex flex-wrap items-center gap-2">
                    {/* Flight Data Font Color in Sun mode: BLACK & BOLD */}
                    <span
                      className={`font-mono font-black text-base sm:text-lg tracking-wider ${
                        isDarkMode ? 'text-amber-300' : 'text-slate-950 font-black'
                      }`}
                    >
                      {report.flight}
                    </span>

                    {/* Sector / Route Badge: Light Sky Blue in Sun mode */}
                    <span
                      className={`text-[10px] sm:text-xs font-black px-2.5 py-0.5 rounded-lg font-mono shadow-sm border ${
                        isDarkMode
                          ? 'bg-blue-950 text-blue-300 border-blue-700/60'
                          : 'bg-sky-100 text-sky-950 border-sky-400 font-black'
                      }`}
                    >
                      {report.route || 'N/A'}
                    </span>

                    <span
                      className={`text-[9px] sm:text-[10px] font-black px-2 py-0.5 rounded-lg uppercase tracking-wider ${
                        report.type === 'INTERNATIONAL'
                          ? isDarkMode
                            ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                            : 'bg-amber-100 text-amber-950 border border-amber-300'
                          : isDarkMode
                          ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                          : 'bg-cyan-100 text-cyan-950 border border-cyan-300'
                      }`}
                    >
                      {report.type}
                    </span>
                  </div>

                  {/* 20H Live Countdown Badge & Depart Time */}
                  <div className="flex flex-wrap items-center gap-2">
                    <div
                      title="Report auto-vanishes 20 hours after creation or last edit"
                      className={`inline-flex items-center gap-1.5 text-[10px] font-mono font-black px-2.5 py-1 rounded-full border shadow-sm ${
                        isDarkMode
                          ? 'bg-amber-500/15 border-amber-500/40 text-amber-300'
                          : 'bg-amber-100 border-amber-300 text-amber-950'
                      }`}
                    >
                      <Timer className="w-3.5 h-3.5 text-amber-500 animate-pulse" />
                      <span>Vanish in: {remainingCountdown}</span>
                    </div>

                    <div
                      className={`font-mono text-xs font-black px-2.5 py-1 rounded-lg border shadow-inner ${
                        isDarkMode
                          ? 'text-amber-300 bg-slate-950 border-slate-800'
                          : 'text-slate-950 bg-slate-100 border-slate-300'
                      }`}
                    >
                      DEPART: {report.formData?.std || 'N/A'} LT
                    </div>
                  </div>
                </div>

                {/* Bottom Bar: Officer Info & Action Buttons */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-0.5">
                  <div
                    className={`flex flex-wrap items-center gap-1.5 font-mono text-[11px] ${
                      isDarkMode ? 'text-slate-200' : 'text-slate-800'
                    }`}
                  >
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                    <span className={`font-black ${isDarkMode ? 'text-white' : 'text-slate-950'}`}>
                      {report.officerName || 'RAMP OFFICER'}
                    </span>
                    <span
                      className={`text-[10px] px-1.5 py-0.5 rounded border font-black ${
                        isDarkMode
                          ? 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                          : 'bg-amber-100 text-amber-950 border-amber-300'
                      }`}
                    >
                      ID-{report.officerId || '0000'}
                    </span>
                    <span className={`text-[10px] ${isDarkMode ? 'text-slate-400' : 'text-slate-600 font-bold'}`}>
                      Mod: {lastUpdatedTime}
                    </span>
                  </div>

                  {/* Actions: Download, Edit, Delete */}
                  <div className="flex items-center gap-1.5 self-end sm:self-auto">
                    <button
                      onClick={() => onDownloadJPG(report)}
                      className={`px-2.5 py-1 rounded-lg border text-[10px] sm:text-xs font-black flex items-center gap-1 active:scale-95 transition-all cursor-pointer ${
                        isDarkMode
                          ? 'bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border-amber-500/40'
                          : 'bg-amber-100 hover:bg-amber-200 text-amber-950 border-amber-300 shadow-sm'
                      }`}
                      title="Download JPG"
                    >
                      <Download className="w-3.5 h-3.5 text-amber-500" />
                      <span>JPG</span>
                    </button>

                    {/* Edit Button: Light Sky Blue in Sun mode */}
                    <button
                      onClick={() => onEditReport(report.id)}
                      className={`px-2.5 py-1 rounded-lg border text-[10px] sm:text-xs font-black flex items-center gap-1 active:scale-95 transition-all cursor-pointer ${
                        isDarkMode
                          ? 'bg-blue-950 hover:bg-blue-900 text-blue-300 border-blue-800'
                          : 'bg-sky-200 hover:bg-sky-300 text-sky-950 border-sky-400 shadow-sm'
                      }`}
                      title="Edit Report"
                    >
                      <Edit className="w-3.5 h-3.5 text-sky-600 dark:text-blue-400" />
                      <span>EDIT</span>
                    </button>

                    <button
                      onClick={() => onDeleteReport(report.id)}
                      className={`p-1.5 rounded-lg border text-[10px] sm:text-xs font-black active:scale-95 transition-all cursor-pointer ${
                        isDarkMode
                          ? 'bg-red-950/60 hover:bg-red-900 text-red-300 border-red-800/60'
                          : 'bg-red-100 hover:bg-red-200 text-red-950 border-red-300 shadow-sm'
                      }`}
                      title="Delete Report"
                    >
                      <Trash2 className="w-3.5 h-3.5 text-red-500" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};


