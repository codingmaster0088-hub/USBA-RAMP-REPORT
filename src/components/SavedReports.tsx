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
  Timer,
  Upload,
  PlusCircle,
  Lock,
  Unlock,
  Database
} from 'lucide-react';
import { SavedReport, RampReportFormData, ReportType, FlightMode, UserProfile, StationCode } from '../types';
import { AdminReportUploadModal } from './AdminReportUploadModal';
import {
  isReportLocked,
  isReportDownloaded,
  getRemainingEditTimeMs,
  formatRemainingEditTime,
  SUPER_ADMIN_PIN
} from '../utils/reportLock';
import { ReportLockModal } from './ReportLockModal';

export function getReportStation(report: SavedReport): string {
  if (report.formData?.station) return report.formData.station.toUpperCase();
  const route = (report.formData?.deptRoute || report.formData?.arvRoute || report.route || '').toUpperCase();
  const stations: StationCode[] = ['CGP', 'SPD', 'CXB', 'ZYL', 'JSR', 'RJH', 'BZL'];
  for (const stn of stations) {
    if (route.includes(stn)) {
      return stn;
    }
  }
  return 'DAC';
}

const ALL_STATIONS = ['ALL', 'DAC', 'CGP', 'SPD', 'CXB', 'ZYL', 'JSR', 'RJH', 'BZL'] as const;

interface SavedReportsProps {
  user?: UserProfile | null;
  savedReports: SavedReport[];
  onEditReport: (id: string) => void;
  onNewReportForFlight?: (report: SavedReport) => void;
  onNewReport?: () => void;
  onDeleteReport: (id: string) => void;
  onDeleteAllReports?: () => void;
  onDownloadJPG: (report: SavedReport) => void;
  onSaveUploadedReport?: (
    data: RampReportFormData,
    type: ReportType,
    mode: FlightMode,
    existingId?: string,
    officerOverride?: { name: string; id: string }
  ) => void;
  onSuperAdminUnlock?: (pin: string) => boolean;
  isDarkMode?: boolean;
  isAdmin?: boolean;
  isSuperAdmin?: boolean;
}

const FIFTEEN_DAYS_MS = 15 * 24 * 60 * 60 * 1000;
const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;

export const SavedReports: React.FC<SavedReportsProps> = ({
  user,
  savedReports,
  onEditReport,
  onNewReportForFlight,
  onNewReport,
  onDeleteReport,
  onDeleteAllReports,
  onDownloadJPG,
  onSaveUploadedReport,
  onSuperAdminUnlock,
  isDarkMode = true,
  isAdmin = false,
  isSuperAdmin = false
}) => {
  const [filterType, setFilterType] = useState<'ALL' | 'DOMESTIC' | 'INTERNATIONAL'>('ALL');
  const [timeFilter, setTimeFilter] = useState<'15_DAYS' | 'TODAY' | 'YESTERDAY'>('15_DAYS');
  const [nowMs, setNowMs] = useState<number>(Date.now());
  const [isUploadModalOpen, setIsUploadModalOpen] = useState<boolean>(false);
  const [lockedModalReport, setLockedModalReport] = useState<SavedReport | null>(null);
  const [visibleCount, setVisibleCount] = useState<number>(30);

  const handleEditClick = (report: SavedReport) => {
    if (isReportLocked(report, isSuperAdmin)) {
      setLockedModalReport(report);
      return;
    }
    onEditReport(report.id);
  };

  const userStation = (user?.station || 'DAC').toUpperCase();
  const [stationFilter, setStationFilter] = useState<string>(isSuperAdmin ? 'ALL' : userStation);

  // Sync station filter with user.station when officer changes station
  useEffect(() => {
    if (!isSuperAdmin && user?.station) {
      setStationFilter(user.station.toUpperCase());
    }
  }, [user?.station, isSuperAdmin]);

  // Update live clock every 10 seconds for precise countdown display
  useEffect(() => {
    const timer = setInterval(() => {
      setNowMs(Date.now());
    }, 10000);
    return () => clearInterval(timer);
  }, []);

  // Helper to calculate remaining time before report auto-vanishes (15 Days Rolling Retention)
  const getRemainingVanishTime = (timestamp: string) => {
    const repTime = new Date(timestamp).getTime();
    if (isNaN(repTime) || repTime <= 0) return '15d left';

    const remainingMs = FIFTEEN_DAYS_MS - (nowMs - repTime);
    if (remainingMs <= 0) return 'Expiring...';

    const days = Math.floor(remainingMs / (1000 * 60 * 60 * 24));
    const hours = Math.floor((remainingMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));

    if (days > 0) {
      return `${days}d ${hours}h left`;
    }
    return `${hours}h left`;
  };

  // Filter logic: Station filter (Only officer station, or super admin filter) + Deduplicate by flight & date + 15 Days Retention
  const { filteredReports, todayCount, yesterdayCount, totalCount } = useMemo(() => {
    // 1. Station-based filtering
    const stationMatched = savedReports.filter((rep) => {
      const repStation = getReportStation(rep);
      if (isSuperAdmin) {
        if (stationFilter === 'ALL') return true;
        return repStation === stationFilter;
      }
      return repStation === userStation;
    });

    // Deduplicate reports by normalized flight number AND date, keeping the most recent edit
    const uniqueMap = new Map<string, SavedReport>();
    const sorted = [...stationMatched].sort((a, b) => {
      const tA = a.createdAt || new Date(a.timestamp).getTime() || 0;
      const tB = b.createdAt || new Date(b.timestamp).getTime() || 0;
      return tB - tA;
    });

    sorted.forEach((rep) => {
      const fltClean = (rep.flight || rep.formData?.deptFlt || rep.formData?.arvFlt || '')
        .replace(/^BS-?/i, '')
        .trim()
        .toUpperCase();
      const rDate = (rep.formData?.date || rep.date || '').trim().toUpperCase();
      const key = fltClean && rDate ? `BS-${fltClean}-${rDate}` : rep.id;

      if (!uniqueMap.has(key)) {
        uniqueMap.set(key, rep);
      }
    });

    const deduplicatedReports = Array.from(uniqueMap.values());

    // 15-Day Rolling Retention: keep all reports within 15 days
    const active15Days = deduplicatedReports.filter((rep) => {
      const repTime = rep.createdAt || (rep.timestamp ? new Date(rep.timestamp).getTime() : 0);
      return repTime > 0 ? nowMs - repTime <= FIFTEEN_DAYS_MS : true;
    });

    const todayReports = active15Days.filter((rep) => {
      const repTime = rep.createdAt || (rep.timestamp ? new Date(rep.timestamp).getTime() : 0);
      const isWithin24H = repTime > 0 && nowMs - repTime <= TWENTY_FOUR_HOURS_MS;
      const rDate = (rep.formData?.date || rep.date || '').toUpperCase();
      return isWithin24H || rDate.includes('TODAY');
    });

    const yesterdayReports = active15Days.filter((rep) => {
      const repTime = rep.createdAt || (rep.timestamp ? new Date(rep.timestamp).getTime() : 0);
      return repTime > 0 && (nowMs - repTime > TWENTY_FOUR_HOURS_MS && nowMs - repTime <= 2 * TWENTY_FOUR_HOURS_MS);
    });

    let timeFiltered = active15Days;
    if (timeFilter === 'TODAY') {
      timeFiltered = todayReports;
    } else if (timeFilter === 'YESTERDAY') {
      timeFiltered = yesterdayReports;
    }

    const matched = timeFiltered.filter((report) => {
      if (filterType === 'ALL') return true;
      return report.type === filterType;
    });

    return {
      filteredReports: matched,
      todayCount: todayReports.length,
      yesterdayCount: yesterdayReports.length,
      totalCount: active15Days.length
    };
  }, [savedReports, filterType, timeFilter, nowMs, isSuperAdmin, stationFilter, userStation]);

  // Reset pagination to first 30 reports on filter change
  useEffect(() => {
    setVisibleCount(30);
  }, [timeFilter, stationFilter, filterType]);

  const displayedReports = useMemo(() => {
    return filteredReports.slice(0, visibleCount);
  }, [filteredReports, visibleCount]);

  return (
    <div className={`space-y-3 pb-20 fade-in ${isDarkMode ? 'text-slate-100' : 'text-slate-900'}`}>
      {/* Header Banner & 20 Hours Switch */}
      <div
        className={`rounded-2xl p-3 shadow-lg space-y-2.5 border ${
          isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-300 shadow-slate-200'
        }`}
      >
        <div className="flex items-center justify-between flex-wrap gap-2">
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
              15-Day Rolling Retention • Auto-purged after 15 days • Live Cloud Sync
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {onNewReport && (
              <button
                type="button"
                onClick={onNewReport}
                className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 active:scale-95 text-white font-mono text-[11px] font-black uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 shadow-md shadow-emerald-950/20 cursor-pointer"
                title="Open full fresh report input page"
              >
                <PlusCircle className="w-3.5 h-3.5 stroke-[2.5]" />
                <span>NEW REPORT</span>
              </button>
            )}

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
        </div>

        {/* 15-Days Rolling Retention Filter Switch */}
        <div
          className={`flex items-center justify-between p-2 rounded-xl border text-xs flex-wrap gap-2 ${
            isDarkMode ? 'bg-slate-950/80 border-slate-800' : 'bg-slate-50 border-slate-200'
          }`}
        >
          <div className={`flex items-center gap-1.5 text-[11px] ${isDarkMode ? 'text-slate-300' : 'text-slate-800 font-bold'}`}>
            <Database className="w-3.5 h-3.5 text-cyan-400" />
            <span>Show: <strong className={isDarkMode ? 'text-amber-300' : 'text-amber-900 font-black'}>
              {timeFilter === '15_DAYS' ? 'All Active (15 Days)' : timeFilter === 'TODAY' ? 'Today (< 24H)' : 'Yesterday'}
            </strong></span>
          </div>
          <div
            className={`flex items-center p-0.5 rounded-lg border text-[10px] ${
              isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-slate-200 border-slate-300'
            }`}
          >
            <button
              onClick={() => setTimeFilter('15_DAYS')}
              className={`px-2.5 py-1 rounded-md font-bold transition-all flex items-center gap-1 cursor-pointer ${
                timeFilter === '15_DAYS'
                  ? 'bg-cyan-500 text-slate-950 shadow-md font-black'
                  : isDarkMode ? 'text-slate-400 hover:text-white' : 'text-slate-700'
              }`}
            >
              <Database className="w-3 h-3" />
              <span>ALL 15 DAYS ({totalCount})</span>
            </button>
            <button
              onClick={() => setTimeFilter('TODAY')}
              className={`px-2 py-1 rounded-md font-bold transition-all flex items-center gap-1 cursor-pointer ${
                timeFilter === 'TODAY'
                  ? 'bg-emerald-500 text-slate-950 shadow-md font-black'
                  : isDarkMode ? 'text-slate-400 hover:text-white' : 'text-slate-700'
              }`}
            >
              <Clock className="w-3 h-3" />
              <span>TODAY ({todayCount})</span>
            </button>
            <button
              onClick={() => setTimeFilter('YESTERDAY')}
              className={`px-2 py-1 rounded-md font-bold transition-all flex items-center gap-1 cursor-pointer ${
                timeFilter === 'YESTERDAY'
                  ? 'bg-amber-500 text-slate-950 shadow-md font-black'
                  : isDarkMode ? 'text-slate-400 hover:text-white' : 'text-slate-700'
              }`}
            >
              <History className="w-3 h-3" />
              <span>YESTERDAY ({yesterdayCount})</span>
            </button>
          </div>
        </div>

        {/* Station Filter / Indicator */}
        {isSuperAdmin ? (
          <div
            className={`flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-2 rounded-xl border text-xs ${
              isDarkMode ? 'bg-slate-950/80 border-slate-800' : 'bg-slate-50 border-slate-200'
            }`}
          >
            <div className={`flex items-center gap-1.5 text-[11px] ${isDarkMode ? 'text-amber-400' : 'text-amber-800 font-black'}`}>
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>SUPER ADMIN STATION FILTER:</span>
            </div>
            <div className="flex items-center flex-wrap gap-1">
              {ALL_STATIONS.map((stn) => (
                <button
                  key={stn}
                  onClick={() => setStationFilter(stn)}
                  className={`px-2 py-0.5 rounded-md text-[10px] font-mono font-bold transition-all cursor-pointer ${
                    stationFilter === stn
                      ? 'bg-amber-500 text-slate-950 font-black shadow-sm'
                      : isDarkMode
                      ? 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
                      : 'bg-white text-slate-700 hover:text-slate-900 border border-slate-300'
                  }`}
                >
                  {stn}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div
            className={`flex items-center justify-between px-3 py-1.5 rounded-xl border text-[11px] ${
              isDarkMode
                ? 'bg-slate-950/60 border-slate-800 text-slate-300'
                : 'bg-slate-50 border-slate-200 text-slate-800'
            }`}
          >
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>STATION: <strong className="text-amber-400 font-mono font-black">{userStation}</strong></span>
            </div>
            <span className="text-[10px] text-slate-500 font-medium">
              Only reports created for {userStation} station
            </span>
          </div>
        )}

        {/* Admin Action Bar: Upload Report Card & Purge All */}
        {isAdmin && (
          <div
            className={`flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 p-2.5 rounded-xl border ${
              isDarkMode
                ? 'bg-slate-950/90 border-slate-800 text-slate-200'
                : 'bg-amber-50/70 border-amber-200 text-slate-900'
            }`}
          >
            <div className="flex items-center gap-1.5 text-xs font-black tracking-wide text-amber-400">
              <Upload className="w-4 h-4 text-amber-500 shrink-0" />
              <span>ADMIN REPORT MANAGEMENT</span>
            </div>

            <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
              <button
                type="button"
                onClick={() => setIsUploadModalOpen(true)}
                className="flex-1 sm:flex-none px-3 py-1.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 active:scale-95 text-slate-950 font-mono text-[11px] font-black uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 shadow-md cursor-pointer"
              >
                <Upload className="w-3.5 h-3.5" />
                <span>UPLOAD REPORT (CARD / IMAGE)</span>
              </button>

              {onDeleteAllReports && (
                <button
                  type="button"
                  onClick={onDeleteAllReports}
                  className="px-2.5 py-1.5 rounded-xl bg-red-600 hover:bg-red-700 active:scale-95 text-white font-mono text-[10px] font-black uppercase tracking-wider transition-all flex items-center justify-center gap-1 shadow-sm cursor-pointer"
                >
                  <Trash2 className="w-3 h-3" />
                  <span>PURGE ALL FLIGHTS ({savedReports.length})</span>
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Admin Report Upload Modal */}
      {isUploadModalOpen && (
        <AdminReportUploadModal
          isOpen={isUploadModalOpen}
          onClose={() => setIsUploadModalOpen(false)}
          onSaveReport={(data, type, mode, existingId, officerOverride) => {
            if (onSaveUploadedReport) {
              onSaveUploadedReport(data, type, mode, existingId, officerOverride);
            }
          }}
          isDarkMode={isDarkMode}
        />
      )}

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
            {timeFilter === 'TODAY'
              ? 'No reports generated yet today. Switch to ALL 15 DAYS to view previous days.'
              : timeFilter === 'YESTERDAY'
              ? 'No reports found for yesterday. Switch to ALL 15 DAYS to view all records.'
              : 'No saved reports recorded in the last 15 days.'}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {displayedReports.map((report) => {
            const lastUpdatedTime = new Date(report.timestamp).toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit'
            });
            const remainingCountdown = getRemainingVanishTime(report.timestamp);
            const isDownloaded = isReportDownloaded(report);
            const isLocked = isReportLocked(report, isSuperAdmin);
            const remainingEditMs = getRemainingEditTimeMs(report);
            const remainingEditStr = formatRemainingEditTime(remainingEditMs);

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

                    {/* Station Badge */}
                    <span
                      className={`text-[9px] sm:text-[10px] font-mono font-black px-2 py-0.5 rounded-lg border ${
                        isDarkMode
                          ? 'bg-slate-950 text-amber-300 border-amber-500/30'
                          : 'bg-amber-100 text-amber-950 border-amber-300 font-black'
                      }`}
                    >
                      STN: {getReportStation(report)}
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

                  {/* Lockout status: 10-Min rule starts ONLY after DOWNLOAD JPG */}
                  <div className="flex flex-wrap items-center gap-2">
                    {isLocked ? (
                      <div
                        title="Report locked 10 minutes after clicking DOWNLOAD JPG. Read-Only (Super Admin exclusive edit)"
                        className={`inline-flex items-center gap-1 text-[10px] font-mono font-black px-2.5 py-1 rounded-full border shadow-sm ${
                          isDarkMode
                            ? 'bg-rose-950/80 border-rose-500/50 text-rose-300'
                            : 'bg-rose-100 border-rose-300 text-rose-950'
                        }`}
                      >
                        <Lock className="w-3 h-3 text-rose-400" />
                        <span>LOCKED (10M+)</span>
                      </div>
                    ) : isSuperAdmin ? (
                      <div
                        title="Super Admin unrestricted edit access"
                        className={`inline-flex items-center gap-1 text-[10px] font-mono font-black px-2.5 py-1 rounded-full border shadow-sm ${
                          isDarkMode
                            ? 'bg-amber-500/20 border-amber-500/50 text-amber-300'
                            : 'bg-amber-100 border-amber-300 text-amber-950'
                        }`}
                      >
                        <Unlock className="w-3 h-3 text-amber-400" />
                        <span>ADMIN EDIT</span>
                      </div>
                    ) : isDownloaded ? (
                      <div
                        title="10-minute timer started after clicking DOWNLOAD JPG"
                        className={`inline-flex items-center gap-1 text-[10px] font-mono font-black px-2.5 py-1 rounded-full border shadow-sm ${
                          isDarkMode
                            ? 'bg-emerald-950/80 border-emerald-500/50 text-emerald-300'
                            : 'bg-emerald-100 border-emerald-300 text-emerald-950'
                        }`}
                      >
                        <Timer className="w-3 h-3 text-emerald-400 animate-pulse" />
                        <span>EDIT: {remainingEditStr}</span>
                      </div>
                    ) : (
                      <div
                        title="Report saved via SAVE REPORT. Editable to input the rest of flight milestones."
                        className={`inline-flex items-center gap-1 text-[10px] font-mono font-black px-2.5 py-1 rounded-full border shadow-sm ${
                          isDarkMode
                            ? 'bg-blue-950/70 border-blue-500/40 text-blue-300'
                            : 'bg-sky-100 border-sky-300 text-sky-950'
                        }`}
                      >
                        <Edit className="w-3 h-3 text-sky-400" />
                        <span>SAVED (EDITABLE)</span>
                      </div>
                    )}

                    <div
                      title="Report stored in database with 15-day rolling retention"
                      className={`inline-flex items-center gap-1.5 text-[10px] font-mono font-black px-2.5 py-1 rounded-full border shadow-sm ${
                        isDarkMode
                          ? 'bg-cyan-500/15 border-cyan-500/40 text-cyan-300'
                          : 'bg-cyan-100 border-cyan-300 text-cyan-950'
                      }`}
                    >
                      <Database className="w-3.5 h-3.5 text-cyan-400" />
                      <span>{remainingCountdown}</span>
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

                  {/* Actions: Download JPG, Edit/Locked, New Report, Delete */}
                  <div className="flex items-center gap-1.5 self-end sm:self-auto flex-wrap">
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

                    {/* Edit or Locked Button */}
                    <button
                      onClick={() => handleEditClick(report)}
                      className={`px-2.5 py-1 rounded-lg border text-[10px] sm:text-xs font-black flex items-center gap-1 active:scale-95 transition-all cursor-pointer ${
                        isLocked && !isSuperAdmin
                          ? isDarkMode
                            ? 'bg-rose-950/70 hover:bg-rose-900/80 text-rose-300 border-rose-700/60'
                            : 'bg-rose-100 hover:bg-rose-200 text-rose-950 border-rose-300 shadow-sm'
                          : isDarkMode
                          ? 'bg-blue-950 hover:bg-blue-900 text-blue-300 border-blue-800'
                          : 'bg-sky-200 hover:bg-sky-300 text-sky-950 border-sky-400 shadow-sm'
                      }`}
                      title={
                        isLocked
                          ? isSuperAdmin
                            ? 'Super Admin Edit'
                            : 'Report is Locked (>10m). Click for options or Super Admin unlock'
                          : 'Edit Report'
                      }
                    >
                      {isLocked && !isSuperAdmin ? (
                        <>
                          <Lock className="w-3.5 h-3.5 text-rose-400" />
                          <span>LOCKED</span>
                        </>
                      ) : (
                        <>
                          <Edit className="w-3.5 h-3.5 text-sky-600 dark:text-blue-400" />
                          <span>{isSuperAdmin && isLocked ? 'EDIT (ADMIN)' : 'EDIT'}</span>
                        </>
                      )}
                    </button>

                    {/* Action Button: NEW REPORT opens a completely fresh input page */}
                    {onNewReport && (
                      <button
                        onClick={onNewReport}
                        className={`px-2.5 py-1 rounded-lg border text-[10px] sm:text-xs font-black flex items-center gap-1 active:scale-95 transition-all cursor-pointer ${
                          isDarkMode
                            ? 'bg-emerald-950/80 hover:bg-emerald-900 text-emerald-300 border-emerald-800'
                            : 'bg-emerald-100 hover:bg-emerald-200 text-emerald-950 border-emerald-400 shadow-sm'
                        }`}
                        title="Open full fresh report input page (create same flight or any new flight)"
                      >
                        <PlusCircle className="w-3.5 h-3.5 text-emerald-400" />
                        <span>NEW REPORT</span>
                      </button>
                    )}

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

      {/* High-Performance Pagination / Load More Bar */}
      {filteredReports.length > visibleCount && (
        <div
          className={`p-3 rounded-2xl border flex flex-col sm:flex-row items-center justify-between gap-3 shadow-lg ${
            isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-300 shadow-slate-200'
          }`}
        >
          <div className="text-xs font-mono text-slate-400">
            Showing <strong className="text-amber-400 font-black">{displayedReports.length}</strong> of{' '}
            <strong className={isDarkMode ? 'text-white font-black' : 'text-slate-900 font-black'}>
              {filteredReports.length}
            </strong>{' '}
            saved reports
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setVisibleCount((prev) => Math.min(prev + 30, filteredReports.length))}
              className="px-4 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 active:scale-95 text-slate-950 font-black text-xs transition-all shadow-md cursor-pointer flex items-center gap-1.5"
            >
              <span>LOAD MORE (+30)</span>
            </button>
            <button
              type="button"
              onClick={() => setVisibleCount(filteredReports.length)}
              className={`px-3 py-2 rounded-xl border text-xs font-black transition-all cursor-pointer ${
                isDarkMode
                  ? 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-300'
              }`}
            >
              <span>SHOW ALL ({filteredReports.length})</span>
            </button>
          </div>
        </div>
      )}

      {/* Report Lockout & Super Admin Unlock Modal */}
      {lockedModalReport && (
        <ReportLockModal
          report={lockedModalReport}
          onClose={() => setLockedModalReport(null)}
          onCreateNewReportForFlight={(rep) => {
            setLockedModalReport(null);
            if (onNewReportForFlight) {
              onNewReportForFlight(rep);
            } else {
              onEditReport(rep.id);
            }
          }}
          onSuperAdminUnlock={(pin) => {
            if (onSuperAdminUnlock) {
              const ok = onSuperAdminUnlock(pin);
              if (ok) {
                const repId = lockedModalReport.id;
                setLockedModalReport(null);
                onEditReport(repId);
                return true;
              }
            }
            return false;
          }}
          isDarkMode={isDarkMode}
        />
      )}
    </div>
  );
};


