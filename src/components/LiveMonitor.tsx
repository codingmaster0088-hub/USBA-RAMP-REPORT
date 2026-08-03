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
  MessageSquare
} from 'lucide-react';

interface LiveMonitorProps {
  user: UserProfile;
  scheduleFlights: ScheduleFlight[];
  scheduleDate: string;
  notices?: AdminNotice[];
  onStartReport: (type: ReportType) => void;
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
  notices = []
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
    <div className="space-y-3 pb-20 fade-in text-slate-100">
      {/* Top LIVE Header & Date Badge */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 border border-amber-500/30 p-3.5 shadow-xl">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1.5 flex-wrap">
              <span className="inline-flex items-center gap-1 text-[10px] font-black px-2 py-0.5 rounded-full bg-red-500/20 text-red-400 border border-red-500/40">
                <span className="w-2 h-2 rounded-full bg-red-500 animate-ping" />
                LIVE SYNC
              </span>

              <span className="text-xs text-amber-400 font-mono font-bold flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5" />
                {displayDate}
              </span>

              {/* COMPACT NOTICE ACTION BUTTON */}
              <button
                onClick={() => setShowNoticesModal(true)}
                className="inline-flex items-center gap-1.5 text-[11px] font-black px-3 py-0.5 rounded-full bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-500 hover:from-amber-400 hover:to-yellow-300 text-slate-950 border border-amber-300 shadow-md shadow-amber-500/20 active:scale-95 transition-all cursor-pointer"
              >
                <Bell className="w-3.5 h-3.5 text-slate-950 animate-bounce" />
                <span>NOTICE ({notices.length})</span>
              </button>
            </div>

            <h1 className="text-base font-black text-white tracking-wider uppercase">
              FLIGHT SCHEDULE MONITOR
            </h1>
            <p className="text-[11px] text-slate-300">
              Station: <strong className="text-amber-300">{user.station}</strong> • US-Bangla Airlines
            </p>
          </div>

          <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-400/40 flex items-center justify-center text-amber-400 shrink-0">
            <Activity className="w-5 h-5 animate-pulse" />
          </div>
        </div>

        {/* Remaining Flights Toggle Switch Bar */}
        <div className="mt-3 pt-2.5 border-t border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-xs">
            <Clock3 className="w-3.5 h-3.5 text-amber-400" />
            <span className="font-bold text-slate-300">Filter Mode:</span>
          </div>

          <div className="flex items-center bg-slate-950 p-1 rounded-xl border border-slate-800 text-[10px]">
            <button
              onClick={() => setShowRemainingOnly(true)}
              className={`px-2.5 py-1 rounded-lg font-black transition-all flex items-center gap-1 ${
                showRemainingOnly
                  ? 'bg-amber-500 text-slate-950 shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Clock className="w-3 h-3" />
              <span>REMAINING ({activeSection === 'DEPARTURE' ? remainingDepCount : remainingArrCount})</span>
            </button>

            <button
              onClick={() => setShowRemainingOnly(false)}
              className={`px-2.5 py-1 rounded-lg font-black transition-all flex items-center gap-1 ${
                !showRemainingOnly
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-white'
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
            className={`py-2.5 rounded-xl font-extrabold tracking-wider transition-all flex items-center justify-center gap-1.5 ${
              activeSection === 'DEPARTURE'
                ? 'bg-amber-500 text-slate-950 shadow-lg shadow-amber-500/25 border border-amber-400'
                : 'bg-slate-800/80 text-amber-300 hover:bg-slate-800 border border-slate-700/60'
            }`}
          >
            <ArrowUpRight className="w-4 h-4" />
            <span>DEPARTURE ({departures.length})</span>
          </button>

          <button
            onClick={() => setActiveSection('ARRIVAL')}
            className={`py-2.5 rounded-xl font-extrabold tracking-wider transition-all flex items-center justify-center gap-1.5 ${
              activeSection === 'ARRIVAL'
                ? 'bg-blue-500 text-white shadow-lg shadow-blue-500/25 border border-blue-400'
                : 'bg-slate-800/80 text-blue-300 hover:bg-slate-800 border border-slate-700/60'
            }`}
          >
            <ArrowDownRight className="w-4 h-4" />
            <span>ARRIVAL ({arrivals.length})</span>
          </button>
        </div>
      </div>

      {scheduleFlights.length === 0 ? (
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-8 text-center space-y-3">
          <Plane className="w-10 h-10 text-slate-600 mx-auto opacity-50" />
          <p className="text-xs text-slate-300 font-bold uppercase">No Flight Schedule Data</p>
          <p className="text-[11px] text-slate-500 max-w-xs mx-auto leading-relaxed">
            Admin needs to paste FLST data in the ADMIN tab and click GENERATE to populate flight schedule.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          <div className="flex items-center justify-between px-1 text-xs font-bold text-slate-400 uppercase tracking-wider">
            <span>{activeSection} LIST {showRemainingOnly ? '(UPCOMING / REMAINING)' : '(ALL FLIGHTS)'}</span>
            <span className="font-mono text-amber-400">{activeList.length} ITEMS</span>
          </div>

          {activeList.length === 0 ? (
            <div className="p-8 bg-slate-900/60 rounded-2xl text-center space-y-2 border border-slate-800">
              <CheckCircle className="w-8 h-8 text-emerald-400 mx-auto opacity-80" />
              <p className="text-xs text-slate-200 font-bold uppercase">No remaining {activeSection.toLowerCase()} flights!</p>
              <p className="text-[11px] text-slate-400">
                All scheduled {activeSection.toLowerCase()} flights for earlier time have departed/arrived.
              </p>
              <button
                onClick={() => setShowRemainingOnly(false)}
                className="mt-2 px-3 py-1 bg-slate-800 hover:bg-slate-700 text-amber-300 text-xs font-bold rounded-lg border border-slate-700"
              >
                View Past Flights
              </button>
            </div>
          ) : (
            <div className="divide-y divide-slate-800/60 bg-slate-900/90 border border-slate-800 rounded-2xl overflow-hidden shadow-lg">
              {activeList.map((flt, index) => {
                const isPast = flt.calculatedMinutes !== null && flt.calculatedMinutes + 15 < currentMinutes;

                return (
                  <div
                    key={flt.id || index}
                    className={`p-3 transition-colors flex items-center justify-between gap-2 ${
                      isPast ? 'bg-slate-950/60 opacity-60' : 'hover:bg-slate-800/50'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span
                        className={`w-2 h-2 rounded-full shrink-0 ${
                          isPast
                            ? 'bg-slate-500'
                            : activeSection === 'DEPARTURE'
                            ? 'bg-amber-400 animate-pulse'
                            : 'bg-blue-400 animate-pulse'
                        }`}
                      />
                      <div className="truncate">
                        <div className="font-mono font-black text-amber-300 text-xs sm:text-sm tracking-wide truncate">
                          {flt.formattedDisplay}
                        </div>
                        <div className="text-[10px] text-slate-400 font-medium flex items-center gap-2 mt-0.5">
                          <span>A/C: <strong className="text-slate-200">{flt.aircraft}</strong></span>
                          <span>•</span>
                          <span>PAX: <strong className="text-emerald-400">{flt.paxLoad}</strong></span>
                        </div>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <div className="font-mono text-xs font-bold text-white bg-slate-950 px-2.5 py-1 rounded-lg border border-slate-800">
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
          <div className="bg-slate-900 border-2 border-amber-500/60 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[85vh] animate-in zoom-in-95">
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-amber-950 via-slate-900 to-amber-950 p-4 border-b border-amber-500/40 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-amber-500/20 border border-amber-400/40 flex items-center justify-center text-amber-400">
                  <Bell className="w-5 h-5 animate-bounce" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-amber-300 uppercase tracking-wider flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4 text-amber-400" />
                    ADMIN SPECIAL NOTICES ({notices.length})
                  </h3>
                  <p className="text-[10px] text-slate-400 font-mono">
                    Official Operational Directives & Announcements
                  </p>
                </div>
              </div>

              <button
                onClick={() => setShowNoticesModal(false)}
                className="w-8 h-8 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white flex items-center justify-center border border-slate-700 transition-all active:scale-95"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Content - Notices List */}
            <div className="p-4 space-y-3 overflow-y-auto flex-1 bg-slate-950/60">
              {notices.length === 0 ? (
                <div className="text-center py-10 space-y-2">
                  <MessageSquare className="w-10 h-10 text-slate-600 mx-auto opacity-50" />
                  <p className="text-xs text-slate-400 font-bold uppercase">No Active Special Notices</p>
                  <p className="text-[11px] text-slate-500">
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
                      className="bg-slate-900/90 p-3.5 rounded-xl border border-amber-500/40 text-xs space-y-2 shadow-lg"
                    >
                      <p className="text-amber-100 font-semibold leading-relaxed whitespace-pre-wrap">
                        {notice.message}
                      </p>
                      <div className="flex justify-between items-center text-[10px] text-slate-400 font-mono pt-2 border-t border-slate-800">
                        <span>Author: <strong className="text-amber-400">{notice.author}</strong></span>
                        <span>{formattedPostingTime}</span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Modal Footer with Close Button */}
            <div className="p-3.5 bg-slate-900 border-t border-slate-800 flex justify-end">
              <button
                onClick={() => setShowNoticesModal(false)}
                className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-slate-950 font-black text-xs uppercase tracking-wider shadow-lg shadow-amber-500/20 active:scale-95 transition-all flex items-center gap-1.5"
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


