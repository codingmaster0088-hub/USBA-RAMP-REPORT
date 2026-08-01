import React, { useState } from 'react';
import { ScheduleFlight, UserProfile, ReportType } from '../types';
import {
  Plane,
  Calendar,
  Clock,
  Users,
  Compass,
  ArrowUpRight,
  ArrowDownRight,
  PlusCircle,
  Activity,
  Layers
} from 'lucide-react';

interface LiveMonitorProps {
  user: UserProfile;
  scheduleFlights: ScheduleFlight[];
  scheduleDate: string;
  onStartReportWithFlight?: (flt: ScheduleFlight) => void;
  onStartReport: (type: ReportType) => void;
}

export const LiveMonitor: React.FC<LiveMonitorProps> = ({
  user,
  scheduleFlights,
  scheduleDate
}) => {
  const [activeSection, setActiveSection] = useState<'DEPARTURE' | 'ARRIVAL'>('DEPARTURE');

  const departures = scheduleFlights.filter((f) => f.isDeparture);
  const arrivals = scheduleFlights.filter((f) => !f.isDeparture);

  const displayDate =
    scheduleDate ||
    new Date()
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

        {/* Section Filter Controls: Exactly 2 Action Buttons */}
        <div className="grid grid-cols-2 gap-2 mt-3 pt-3 border-t border-slate-800 text-xs">
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
            <span>{activeSection} LIST</span>
            <span className="font-mono text-amber-400">{activeList.length} ITEMS</span>
          </div>

          {activeList.length === 0 ? (
            <div className="p-6 bg-slate-900/50 rounded-xl text-center text-xs text-slate-500 border border-slate-800">
              No {activeSection.toLowerCase()} flights found.
            </div>
          ) : (
            <div className="divide-y divide-slate-800/60 bg-slate-900/90 border border-slate-800 rounded-2xl overflow-hidden shadow-lg">
              {activeList.map((flt, index) => (
                <div
                  key={flt.id || index}
                  className="p-3 hover:bg-slate-800/50 transition-colors flex items-center justify-between gap-2"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span
                      className={`w-2 h-2 rounded-full shrink-0 ${
                        activeSection === 'DEPARTURE' ? 'bg-amber-400' : 'bg-blue-400'
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
                      {flt.timeStr}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
