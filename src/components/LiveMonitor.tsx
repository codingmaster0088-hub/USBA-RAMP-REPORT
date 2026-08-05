import React, { useState, useMemo } from 'react';
import { ScheduleFlight, UserProfile, ReportType, AdminNotice } from '../types';
import {
  Plane,
  Calendar,
  Clock,
  ArrowUpRight,
  ArrowDownRight,
  Activity,
  Filter,
  CheckCircle,
  Clock3,
  Bell,
  Sparkles,
  X,
  MessageSquare,
  Trash2
} from 'lucide-react';

interface LiveMonitorProps {
  user: UserProfile;
  scheduleFlights: ScheduleFlight[];
  scheduleDate: string;
  notices?: AdminNotice[];
  onStartReport: (type: ReportType) => void;
  onStartReportWithFlight?: (flt: ScheduleFlight) => void;
  isDarkMode?: boolean;
  isAdmin?: boolean;
  onDeleteNotice?: (id: string) => void;
}

// Parse time string (e.g. "07:00 AM", "14:30", "0915") to total minutes from midnight
function parseTimeToMinutes(timeStr: string): number | null {
  if (!timeStr) return null;
  const str = timeStr.trim().toUpperCase();

  // Match "07:00 AM" or "02:20 PM"
  const ampmMatch = str.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/);
  if (ampmMatch) {
    let hrs = parseInt(ampmMatch[1], 10);
    const mins = parseInt(ampmMatch[2], 10);
    const ampm = ampmMatch[3];
    if (ampm === 'PM' && hrs < 12) hrs += 12;
    if (ampm === 'AM' && hrs === 12) hrs = 0;
    return hrs * 60 + mins;
  }

  // Match "14:30" or "07:00"
  const colonMatch = str.match(/^(\d{1,2}):(\d{2})$/);
  if (colonMatch) {
    const hrs = parseInt(colonMatch[1], 10);
    const mins = parseInt(colonMatch[2], 10);
    return hrs * 60 + mins;
  }

  // Match "1430" or "0700"
  const digitsMatch = str.match(/^(\d{2})(\d{2})$/);
  if (digitsMatch) {
    const hrs = parseInt(digitsMatch[1], 10);
    const mins = parseInt(digitsMatch[2], 10);
    return hrs * 60 + mins;
  }

  return null;
}

// Get duration addition offset in minutes for DAC arrivals
function getArrivalOffsetMinutes(flt: ScheduleFlight, station: string): number {
  if (station !== 'DAC' || flt.isDeparture) return 0;

  const rawUpper = (flt.formattedDisplay + ' ' + (flt.sector || '') + ' ' + (flt.rawLine || '')).toUpperCase();

  // Check if VIA CGP
  if (rawUpper.includes('VIA CGP') || rawUpper.includes('-VIA-CGP') || (rawUpper.includes('CGP') && rawUpper.includes('VIA'))) {
    return 50;
  }

  const sector = (flt.sector || '').toUpperCase().trim();

  if (rawUpper.includes('CCU') || sector === 'CCU') return 60; // 1 hour
  if (rawUpper.includes('MAA') || sector === 'MAA') return 170; // 2 hour 50 mins
  if (rawUpper.includes('CAN') || sector === 'CAN') return 310; // 5 hour 10 mins
  if (rawUpper.includes('MCT') || sector === 'MCT') return 280; // 4 hour 40 mins
  if (rawUpper.includes('MLE') || sector === 'MLE') return 245; // 4 hour 05 mins
  if (rawUpper.includes('KUL') || sector === 'KUL') return 240; // 4 hour
  if (rawUpper.includes('BKK') || sector === 'BKK') return 160; // 2 hour 40 mins
  if (rawUpper.includes('SHJ') || sector === 'SHJ') return 300; // 5 hour
  if (rawUpper.includes('DXB') || sector === 'DXB') return 310; // 5 hour 10 mins
  if (rawUpper.includes('RUH') || sector === 'RUH') return 390; // 6 hour 30 mins
  if (rawUpper.includes('JED') || sector === 'JED') return 390; // 6 hour 30 mins
  if (rawUpper.includes('AUH') || sector === 'AUH') return 290; // 4 hour 50 mins
  if (rawUpper.includes('DOH') || sector === 'DOH') return 320; // 5 hour 20 mins
  if (rawUpper.includes('SIN') || sector === 'SIN') return 280; // 4 hour 40 mins

  // Default domestic arrival into DAC
  return 35;
}

// Calculate adjusted arrival time string & next day flag
function calculateFlightTimeDisplay(flt: ScheduleFlight, station: string): { timeStr: string; totalMinutes: number | null; isNextDay: boolean } {
  const baseMinutes = parseTimeToMinutes(flt.timeStr);
  if (baseMinutes === null) {
    return { timeStr: flt.timeStr, totalMinutes: null, isNextDay: false };
  }

  const offset = getArrivalOffsetMinutes(flt, station);
  const totalMinutes = baseMinutes + offset;

  if (totalMinutes >= 1440) {
    // Next day flight (> 11:59 PM)
    return { timeStr: flt.timeStr, totalMinutes, isNextDay: true };
  }

  const hrs24 = Math.floor(totalMinutes / 60);
  const mins = totalMinutes % 60;
  const minsStr = mins < 10 ? `0${mins}` : `${mins}`;

  if (flt.timeStr.toUpperCase().includes('AM') || flt.timeStr.toUpperCase().includes('PM')) {
    const period = hrs24 >= 12 ? 'PM' : 'AM';
    let hrs12 = hrs24 % 12;
    if (hrs12 === 0) hrs12 = 12;
    const hrsStr = hrs12 < 10 ? `0${hrs12}` : `${hrs12}`;
    return { timeStr: `${hrsStr}:${minsStr} ${period}`, totalMinutes, isNextDay: false };
  }

  const hrsStr = hrs24 < 10 ? `0${hrs24}` : `${hrs24}`;
  return { timeStr: `${hrsStr}:${minsStr}`, totalMinutes, isNextDay: false };
}

function formatHeaderDate(scheduleDate: string): string {
  if (!scheduleDate) return '01 AUG 2026';
  const cleaned = scheduleDate.replace(/00$/, '').trim();
  const match = cleaned.match(/^(\d{1,2})\s*([A-Z]{3})/i);
  if (match) {
    const day = match[1].padStart(2, '0');
    const month = match[2].toUpperCase();
    const year = new Date().getFullYear();
    return `${day} ${month} ${year}`;
  }
  return scheduleDate.toUpperCase();
}

export const LiveMonitor: React.FC<LiveMonitorProps> = ({
  user,
  scheduleFlights,
  scheduleDate,
  notices = [],
  isDarkMode = false,
  isAdmin = false,
  onDeleteNotice
}) => {
  const [activeSection, setActiveSection] = useState<'DEPARTURE' | 'ARRIVAL'>('DEPARTURE');
  const [showRemainingOnly, setShowRemainingOnly] = useState<boolean>(true);
  const [showNoticesModal, setShowNoticesModal] = useState<boolean>(false);

  // Current time in minutes from midnight
  const now = new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  // Filter remaining vs past flights with station-wise time adjustments
  const { departures, arrivals, remainingDepCount, remainingArrCount } = useMemo(() => {
    const processedFlights = scheduleFlights.map((flt) => {
      const calc = calculateFlightTimeDisplay(flt, user.station);
      return {
        ...flt,
        calculatedTimeStr: calc.timeStr,
        calculatedMinutes: calc.totalMinutes,
        isNextDay: calc.isNextDay
      };
    }).filter((f) => !f.isNextDay); // Exclude next-day (> 11:59 PM) flights

    const deps = processedFlights.filter((f) => f.isDeparture);
    const arrs = processedFlights.filter((f) => !f.isDeparture);

    const isFlightRemaining = (flt: typeof processedFlights[0]) => {
      if (flt.calculatedMinutes === null) return true;
      return flt.calculatedMinutes + 15 >= currentMinutes;
    };

    const remDeps = deps.filter(isFlightRemaining);
    const remArrs = arrs.filter(isFlightRemaining);

    return {
      departures: showRemainingOnly ? remDeps : deps,
      arrivals: showRemainingOnly ? remArrs : arrs,
      remainingDepCount: remDeps.length,
      remainingArrCount: remArrs.length,
      totalDepCount: deps.length,
      totalArrCount: arrs.length
    };
  }, [scheduleFlights, currentMinutes, showRemainingOnly, user.station]);

  const displayDate = formatHeaderDate(scheduleDate);

  const activeList = activeSection === 'DEPARTURE' ? departures : arrivals;

  return (
    <div className={`space-y-3 pb-20 fade-in ${isDarkMode ? 'text-slate-100' : 'text-slate-900'}`}>
      {/* Top LIVE Header & Date Badge */}
      <div
        className={`relative overflow-hidden rounded-2xl p-3.5 shadow-xl transition-all border ${
          isDarkMode
            ? 'bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 border-amber-500/30'
            : 'bg-white border-2 border-amber-500 shadow-slate-200'
        }`}
      >
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1.5 flex-wrap">
              <span
                className={`inline-flex items-center gap-1 text-[10px] font-black px-2 py-0.5 rounded-full border ${
                  isDarkMode
                    ? 'bg-red-500/20 text-red-400 border-red-500/40'
                    : 'bg-red-100 text-red-700 border-red-300'
                }`}
              >
                <span className="w-2 h-2 rounded-full bg-red-500 animate-ping" />
                LIVE SYNC
              </span>

              <span
                className={`text-xs font-mono font-bold flex items-center gap-1 ${
                  isDarkMode ? 'text-amber-400' : 'text-amber-800'
                }`}
              >
                <Calendar className="w-3.5 h-3.5" />
                {displayDate}
              </span>

              {/* COMPACT NOTICE ACTION BUTTON */}
              <button
                onClick={() => setShowNoticesModal(true)}
                className="inline-flex items-center gap-1.5 text-[11px] font-black px-3 py-0.5 rounded-full bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-500 hover:from-amber-400 hover:to-yellow-300 text-slate-950 border border-amber-300 shadow-md active:scale-95 transition-all cursor-pointer"
              >
                <Bell className="w-3.5 h-3.5 text-slate-950 animate-bounce" />
                <span>NOTICE ({notices.length})</span>
              </button>
            </div>

            <h1
              className={`text-base font-black tracking-wider uppercase ${
                isDarkMode ? 'text-white' : 'text-slate-900'
              }`}
            >
              FLIGHT SCHEDULE MONITOR
            </h1>
            <p className={`text-[11px] ${isDarkMode ? 'text-slate-300' : 'text-slate-700 font-bold'}`}>
              Station:{' '}
              <strong className={isDarkMode ? 'text-amber-300' : 'text-amber-800 font-black'}>
                {user.station}
              </strong>{' '}
              • US-Bangla Airlines
            </p>
          </div>

          <div
            className={`w-10 h-10 rounded-xl border flex items-center justify-center shrink-0 ${
              isDarkMode
                ? 'bg-amber-500/10 border-amber-400/40 text-amber-400'
                : 'bg-amber-100 border-amber-400 text-amber-800'
            }`}
          >
            <Activity className="w-5 h-5 animate-pulse" />
          </div>
        </div>

        {/* Remaining Flights Toggle Switch Bar */}
        <div
          className={`mt-3 pt-2.5 border-t flex items-center justify-between ${
            isDarkMode ? 'border-slate-800' : 'border-slate-200'
          }`}
        >
          <div className="flex items-center gap-1.5 text-xs">
            <Clock3 className={`w-3.5 h-3.5 ${isDarkMode ? 'text-amber-400' : 'text-amber-700'}`} />
            <span className={`font-black ${isDarkMode ? 'text-slate-300' : 'text-slate-900'}`}>
              Filter Mode:
            </span>
          </div>

          <div
            className={`flex items-center p-1 rounded-xl border text-[10px] ${
              isDarkMode ? 'bg-slate-950 border-slate-800' : 'bg-slate-100 border-slate-300'
            }`}
          >
            <button
              onClick={() => setShowRemainingOnly(true)}
              className={`px-2.5 py-1 rounded-lg font-black transition-all flex items-center gap-1 cursor-pointer ${
                showRemainingOnly
                  ? 'bg-amber-500 text-slate-950 shadow-md'
                  : isDarkMode
                  ? 'text-slate-400 hover:text-white'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Clock className="w-3 h-3" />
              <span>REMAINING ({activeSection === 'DEPARTURE' ? remainingDepCount : remainingArrCount})</span>
            </button>

            <button
              onClick={() => setShowRemainingOnly(false)}
              className={`px-2.5 py-1 rounded-lg font-black transition-all flex items-center gap-1 cursor-pointer ${
                !showRemainingOnly
                  ? 'bg-blue-600 text-white shadow-md'
                  : isDarkMode
                  ? 'text-slate-400 hover:text-white'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Filter className="w-3 h-3" />
              <span>SHOW ALL ({scheduleFlights.filter(f => f.isDeparture === (activeSection === 'DEPARTURE')).length})</span>
            </button>
          </div>
        </div>

        {/* Section Filter Controls: DEPARTURE vs ARRIVAL */}
        <div className="grid grid-cols-2 gap-2 mt-2.5 text-xs">
          <button
            onClick={() => setActiveSection('DEPARTURE')}
            className={`py-2.5 rounded-xl font-extrabold tracking-wider transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              activeSection === 'DEPARTURE'
                ? 'bg-amber-500 text-slate-950 shadow-lg border border-amber-400 font-black'
                : isDarkMode
                ? 'bg-slate-800/80 text-amber-300 hover:bg-slate-800 border border-slate-700/60'
                : 'bg-amber-100 text-amber-900 hover:bg-amber-200 border border-amber-300 font-bold'
            }`}
          >
            <ArrowUpRight className="w-4 h-4" />
            <span>DEPARTURE ({departures.length})</span>
          </button>

          <button
            onClick={() => setActiveSection('ARRIVAL')}
            className={`py-2.5 rounded-xl font-extrabold tracking-wider transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              activeSection === 'ARRIVAL'
                ? 'bg-blue-600 text-white shadow-lg border border-blue-400 font-black'
                : isDarkMode
                ? 'bg-slate-800/80 text-blue-300 hover:bg-slate-800 border border-slate-700/60'
                : 'bg-blue-100 text-blue-900 hover:bg-blue-200 border border-blue-300 font-bold'
            }`}
          >
            <ArrowDownRight className="w-4 h-4" />
            <span>ARRIVAL ({arrivals.length})</span>
          </button>
        </div>
      </div>

      {scheduleFlights.length === 0 ? (
        <div
          className={`border rounded-2xl p-8 text-center space-y-3 ${
            isDarkMode ? 'bg-slate-900/80 border-slate-800' : 'bg-white border-slate-300 shadow-sm'
          }`}
        >
          <Plane className="w-10 h-10 text-slate-500 mx-auto opacity-60" />
          <p
            className={`text-xs font-bold uppercase ${
              isDarkMode ? 'text-slate-300' : 'text-slate-900'
            }`}
          >
            No Flight Schedule Data
          </p>
          <p className="text-[11px] text-slate-500 max-w-xs mx-auto leading-relaxed">
            Admin needs to paste FLST data in the ADMIN tab and click GENERATE to populate flight schedule.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          <div
            className={`flex items-center justify-between px-1 text-xs font-black uppercase tracking-wider ${
              isDarkMode ? 'text-slate-400' : 'text-slate-700'
            }`}
          >
            <span>{activeSection} LIST {showRemainingOnly ? '(UPCOMING / REMAINING)' : '(ALL FLIGHTS)'}</span>
            <span className={isDarkMode ? 'text-amber-400' : 'text-slate-900 font-black'}>
              {activeList.length} ITEMS
            </span>
          </div>

          {activeList.length === 0 ? (
            <div
              className={`p-8 rounded-2xl text-center space-y-2 border ${
                isDarkMode ? 'bg-slate-900/60 border-slate-800' : 'bg-white border-slate-300 shadow-sm'
              }`}
            >
              <CheckCircle className="w-8 h-8 text-emerald-500 mx-auto" />
              <p
                className={`text-xs font-black uppercase ${
                  isDarkMode ? 'text-slate-200' : 'text-slate-900'
                }`}
              >
                No remaining {activeSection.toLowerCase()} flights!
              </p>
              <p className={`text-[11px] ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>
                All scheduled {activeSection.toLowerCase()} flights for earlier time have departed/arrived.
              </p>
              <button
                onClick={() => setShowRemainingOnly(false)}
                className={`mt-2 px-3 py-1.5 text-xs font-black rounded-lg border cursor-pointer ${
                  isDarkMode
                    ? 'bg-slate-800 hover:bg-slate-700 text-amber-300 border-slate-700'
                    : 'bg-amber-100 hover:bg-amber-200 text-amber-900 border-amber-300'
                }`}
              >
                View Past Flights
              </button>
            </div>
          ) : (
            <div
              className={`divide-y rounded-2xl overflow-hidden shadow-lg border ${
                isDarkMode
                  ? 'divide-slate-800/60 bg-slate-900/90 border-slate-800'
                  : 'divide-slate-200 bg-white border-slate-300'
              }`}
            >
              {activeList.map((flt, index) => {
                const isPast = flt.calculatedMinutes !== null && flt.calculatedMinutes + 15 < currentMinutes;

                return (
                  <div
                    key={flt.id || index}
                    className={`p-3 transition-colors flex items-center justify-between gap-2 ${
                      isPast
                        ? isDarkMode
                          ? 'bg-slate-950/60 opacity-60'
                          : 'bg-slate-100 opacity-60'
                        : isDarkMode
                        ? 'hover:bg-slate-800/50'
                        : 'hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span
                        className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                          isPast
                            ? 'bg-slate-400'
                            : activeSection === 'DEPARTURE'
                            ? 'bg-amber-500 animate-pulse'
                            : 'bg-blue-500 animate-pulse'
                        }`}
                      />
                      <div className="truncate">
                        <div
                          className={`font-mono font-black text-xs sm:text-sm tracking-wide truncate ${
                            isDarkMode ? 'text-amber-300' : 'text-slate-950 font-black'
                          }`}
                        >
                          {flt.formattedDisplay}
                        </div>
                        <div
                          className={`text-[10px] font-bold flex items-center gap-2 mt-0.5 ${
                            isDarkMode ? 'text-slate-400' : 'text-slate-600'
                          }`}
                        >
                          <span>
                            A/C:{' '}
                            <strong className={isDarkMode ? 'text-slate-200' : 'text-slate-900 font-black'}>
                              {flt.aircraft}
                            </strong>
                          </span>
                          <span>•</span>
                          <span>
                            PAX:{' '}
                            <strong className={isDarkMode ? 'text-emerald-400' : 'text-emerald-700 font-black'}>
                              {flt.paxLoad}
                            </strong>
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <div
                        className={`font-mono text-xs font-black px-2.5 py-1 rounded-lg border ${
                          isDarkMode
                            ? 'text-white bg-slate-950 border-slate-800'
                            : 'text-slate-900 bg-slate-100 border-slate-300'
                        }`}
                      >
                        {flt.calculatedTimeStr}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* POP-UP TYPE NOTICES PAGE / MODAL */}
      {showNoticesModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md fade-in">
          <div
            className={`border-2 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[85vh] animate-in zoom-in-95 ${
              isDarkMode
                ? 'bg-slate-900 border-amber-500/60 text-slate-100'
                : 'bg-white border-amber-500 text-slate-950 shadow-amber-500/20'
            }`}
          >
            {/* Modal Header */}
            <div
              className={`p-4 border-b flex items-center justify-between ${
                isDarkMode
                  ? 'bg-gradient-to-r from-amber-950 via-slate-900 to-amber-950 border-amber-500/40'
                  : 'bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-500 border-amber-600 text-slate-950'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <div
                  className={`w-9 h-9 rounded-xl border flex items-center justify-center ${
                    isDarkMode
                      ? 'bg-amber-500/20 border-amber-400/40 text-amber-400'
                      : 'bg-slate-950/20 border-slate-900/30 text-slate-950'
                  }`}
                >
                  <Bell className="w-5 h-5 animate-bounce" />
                </div>
                <div>
                  <h3
                    className={`text-sm font-black uppercase tracking-wider flex items-center gap-1.5 ${
                      isDarkMode ? 'text-amber-300' : 'text-slate-950'
                    }`}
                  >
                    <Sparkles className={`w-4 h-4 ${isDarkMode ? 'text-amber-400' : 'text-slate-950'}`} />
                    ADMIN SPECIAL NOTICES ({notices.length})
                  </h3>
                  <p
                    className={`text-[10px] font-mono ${
                      isDarkMode ? 'text-slate-400' : 'text-slate-900 font-extrabold'
                    }`}
                  >
                    Official Operational Directives & Announcements
                  </p>
                </div>
              </div>

              <button
                onClick={() => setShowNoticesModal(false)}
                className={`w-8 h-8 rounded-xl flex items-center justify-center border transition-all active:scale-95 cursor-pointer ${
                  isDarkMode
                    ? 'bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border-slate-700'
                    : 'bg-slate-200 hover:bg-slate-300 text-slate-800 border-slate-400'
                }`}
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Content - Notices List */}
            <div
              className={`p-4 space-y-3 overflow-y-auto flex-1 ${
                isDarkMode ? 'bg-slate-950/60' : 'bg-slate-50'
              }`}
            >
              {notices.length === 0 ? (
                <div className="text-center py-10 space-y-2">
                  <MessageSquare className="w-10 h-10 text-slate-500 mx-auto opacity-50" />
                  <p className={`text-xs font-bold uppercase ${isDarkMode ? 'text-slate-400' : 'text-slate-700'}`}>
                    No Active Special Notices
                  </p>
                  <p className={`text-[11px] ${isDarkMode ? 'text-slate-500' : 'text-slate-600'}`}>
                    There are currently no special operational notices broadcasted by Admin.
                  </p>
                </div>
              ) : (
                notices.map((notice, idx) => {
                  let formattedPostingTime = 'Just Now';
                  if (notice.createdAt && !isNaN(notice.createdAt)) {
                    const d = new Date(notice.createdAt);
                    if (!isNaN(d.getTime())) {
                      formattedPostingTime = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + ' LT';
                    }
                  } else if (notice.timestamp && !notice.timestamp.toLowerCase().includes('invalid')) {
                    const d = new Date(notice.timestamp);
                    if (!isNaN(d.getTime())) {
                      formattedPostingTime = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + ' LT';
                    } else {
                      formattedPostingTime = notice.timestamp;
                    }
                  } else if (notice.id) {
                    const parts = notice.id.split('-');
                    const lastPart = parseInt(parts[parts.length - 1], 10);
                    if (!isNaN(lastPart) && lastPart > 1600000000000) {
                      const d = new Date(lastPart);
                      formattedPostingTime = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + ' LT';
                    }
                  }

                  return (
                    <div
                      key={notice.id || idx}
                      className={`p-4 rounded-xl border text-xs space-y-2 shadow-md relative ${
                        isDarkMode
                          ? 'bg-slate-900 border-amber-500/40 text-slate-100'
                          : 'bg-amber-50/90 border-amber-400/80 text-slate-950'
                      }`}
                    >
                      <p
                        className={`font-sans font-bold leading-relaxed whitespace-pre-wrap pr-8 ${
                          isDarkMode ? 'text-slate-100' : 'text-slate-950'
                        }`}
                      >
                        {notice.message}
                      </p>

                      {(isAdmin || onDeleteNotice) && (
                        <button
                          onClick={() => {
                            if (onDeleteNotice) onDeleteNotice(notice.id);
                          }}
                          title="Remove Notice (Admin Only)"
                          className="absolute top-3 right-3 p-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white border border-rose-400/40 active:scale-95 transition-all cursor-pointer flex items-center gap-1 text-[10px] font-bold shadow-md"
                        >
                          <Trash2 className="w-3.5 h-3.5 text-white" />
                          <span className="hidden sm:inline">REMOVE</span>
                        </button>
                      )}

                      <div
                        className={`flex justify-between items-center text-[10px] font-mono pt-2 border-t ${
                          isDarkMode ? 'text-slate-400 border-slate-800' : 'text-slate-800 border-amber-200'
                        }`}
                      >
                        <span>
                          Author:{' '}
                          <strong className={isDarkMode ? 'text-amber-400' : 'text-amber-900 font-black'}>
                            {notice.author || notice.authorName || 'ADMIN'}
                          </strong>
                        </span>
                        <span className="font-bold">{formattedPostingTime}</span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Modal Footer with Close Button */}
            <div
              className={`p-3.5 border-t flex justify-end ${
                isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-slate-100 border-slate-200'
              }`}
            >
              <button
                onClick={() => setShowNoticesModal(false)}
                className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-slate-950 font-black text-xs uppercase tracking-wider shadow-lg shadow-amber-500/20 active:scale-95 transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <X className="w-4 h-4" />
                <span>CLOSE</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};


