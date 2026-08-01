import React, { useState, useMemo } from 'react';
import { ScheduleFlight, UserProfile, ReportType } from '../types';
import {
  Plane,
  Calendar,
  Clock,
  ArrowUpRight,
  ArrowDownRight,
  Activity,
  Filter,
  CheckCircle,
  Clock3
} from 'lucide-react';

interface LiveMonitorProps {
  user: UserProfile;
  scheduleFlights: ScheduleFlight[];
  scheduleDate: string;
  onStartReportWithFlight?: (flt: ScheduleFlight) => void;
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

export const LiveMonitor: React.FC<LiveMonitorProps> = ({
  user,
  scheduleFlights,
  scheduleDate,
  onStartReportWithFlight
}) => {
  const [activeSection, setActiveSection] = useState<'DEPARTURE' | 'ARRIVAL'>('DEPARTURE');
  const [showRemainingOnly, setShowRemainingOnly] = useState<boolean>(true);

  // Current time in minutes from midnight
  const now = new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  // Filter remaining vs past flights
  const { departures, arrivals, remainingDepCount, remainingArrCount } = useMemo(() => {
    const deps = scheduleFlights.filter((f) => f.isDeparture);
    const arrs = scheduleFlights.filter((f) => !f.isDeparture);

    const isFlightRemaining = (flt: ScheduleFlight) => {
      const fltMins = parseTimeToMinutes(flt.timeStr);
      if (fltMins === null) return true; // Keep if time format unknown
      // Flight is remaining if scheduled time + 15 mins buffer is >= current time
      return fltMins + 15 >= currentMinutes;
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
  }, [scheduleFlights, currentMinutes, showRemainingOnly]);

  const displayDate =
    scheduleDate ||
    now
      .toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
      .toUpperCase();

  const activeList = activeSection === 'DEPARTURE' ? departures : arrivals;

  return (
    <div className="space-y-3 pb-20 fade-in text-slate-100">
      {/* Top LIVE Header & Date Badge */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 border border-amber-500/30 p-3.5 shadow-xl">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="inline-flex items-center gap-1 text-[10px] font-black px-2 py-0.5 rounded-full bg-red-500/20 text-red-400 border border-red-500/40">
                <span className="w-2 h-2 rounded-full bg-red-500 animate-ping" />
                LIVE SYNC
              </span>
              <span className="text-xs text-amber-400 font-mono font-bold flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5" />
                {displayDate}
              </span>
            </div>

            <h1 className="text-base font-black text-white tracking-wider uppercase">
              FLIGHT SCHEDULE MONITOR
            </h1>
            <p className="text-[11px] text-slate-300">
              Station: <strong className="text-amber-300">{user.station}</strong> • US-Bangla Airlines
            </p>
          </div>

          <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-400/40 flex items-center justify-center text-amber-400">
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
                const fltMins = parseTimeToMinutes(flt.timeStr);
                const isPast = fltMins !== null && fltMins + 15 < currentMinutes;

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

                    <div className="flex items-center gap-2 shrink-0">
                      {onStartReportWithFlight && (
                        <button
                          onClick={() => onStartReportWithFlight(flt)}
                          className="px-2 py-1 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 text-[10px] font-bold rounded-lg border border-amber-500/30 transition-all"
                        >
                          + REPORT
                        </button>
                      )}

                      <div className="font-mono text-xs font-bold text-white bg-slate-950 px-2.5 py-1 rounded-lg border border-slate-800">
                        {flt.timeStr}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

