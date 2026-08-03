import React, { useState } from 'react';
import { UserProfile, ScheduleFlight, UserLog, UserActionType } from '../types';
import { parseFLSTData, sampleFLSTInput } from '../utils/flstParser';
import {
  ShieldCheck,
  Lock,
  Sparkles,
  Database,
  RefreshCw,
  Bell,
  Send,
  Users,
  Search,
  Clock,
  UserCheck,
  LogOut,
  FileText,
  Trash2,
  Calendar,
  Activity
} from 'lucide-react';

interface AdminSectionProps {
  user: UserProfile;
  scheduleFlights: ScheduleFlight[];
  scheduleDate: string;
  userLogs?: UserLog[];
  onUpdateSchedule: (flights: ScheduleFlight[], dateHeader: string, rawFlst: string) => void;
  onBroadcastNotice?: (message: string) => Promise<void>;
  showToast: (title: string, subtitle?: string, type?: 'success' | 'info' | 'error') => void;
}

export const AdminSection: React.FC<AdminSectionProps> = ({
  user,
  scheduleFlights,
  scheduleDate,
  userLogs = [],
  onUpdateSchedule,
  onBroadcastNotice,
  showToast
}) => {
  // Check admin privileges: Name must be RASEL HOSSAIN and USBA ID must be 0088
  const isAdmin =
    user.name.trim().toUpperCase() === 'RASEL HOSSAIN' && user.id.trim() === '0088';

  const [flstInput, setFlstInput] = useState<string>(() => {
    return localStorage.getItem('usb_flst_raw') || sampleFLSTInput;
  });

  const [noticeMessage, setNoticeMessage] = useState<string>('');
  const [isBroadcasting, setIsBroadcasting] = useState<boolean>(false);

  // User Logs filtering state
  const [logFilter, setLogFilter] = useState<'ALL' | 'LOGIN_LOGOUT' | 'REPORTS' | 'ADMIN'>('ALL');
  const [logSearchQuery, setLogSearchQuery] = useState<string>('');

  if (!isAdmin) {
    return (
      <div className="bg-slate-900/90 border border-amber-500/40 rounded-2xl p-6 text-center space-y-4 shadow-2xl fade-in my-auto max-w-lg mx-auto">
        <div className="w-16 h-16 mx-auto rounded-2xl bg-amber-500/10 border border-amber-400/40 flex items-center justify-center text-amber-400 shadow-lg">
          <Lock className="w-8 h-8" />
        </div>

        <div className="bg-gradient-to-r from-slate-950 via-slate-900 to-slate-950 p-5 rounded-2xl border border-amber-500/30 text-center shadow-xl space-y-2">
          <p className="text-sm sm:text-base font-black text-amber-300 tracking-wider uppercase">
            HI OFFICER, THIS PAGE IS ONLY RESERVED FOR RADOAN RASEL
          </p>
          <p className="text-xs text-slate-400 leading-relaxed">
            Please return to Live Monitor or Turnaround Report section to perform flight operations.
          </p>
        </div>
      </div>
    );
  }

  const handleGenerate = () => {
    if (!flstInput.trim()) {
      showToast('FLST Input Empty', 'Please paste flight schedule data first', 'error');
      return;
    }

    const { flights, dateHeader } = parseFLSTData(flstInput);
    if (flights.length === 0) {
      showToast('Parsing Error', 'No valid flight schedule rows detected in FLST input', 'error');
      return;
    }

    onUpdateSchedule(flights, dateHeader, flstInput);
    showToast(
      'LIVE Schedule Generated!',
      `Created ${flights.length} flights for ${dateHeader}`,
      'success'
    );
  };

  const handleLoadSample = () => {
    setFlstInput(sampleFLSTInput);
    showToast('Sample FLST Loaded', 'Click GENERATE to update LIVE monitor', 'info');
  };

  const handleSendNotice = async () => {
    if (!noticeMessage.trim()) {
      showToast('Notice Message Empty', 'Please write a message to broadcast', 'error');
      return;
    }

    if (!onBroadcastNotice) return;

    try {
      setIsBroadcasting(true);
      await onBroadcastNotice(noticeMessage.trim());
      setNoticeMessage('');
      showToast('Special Notice Broadcasted!', 'All active officers will receive pop-up notice', 'success');
    } catch (e) {
      console.error(e);
      showToast('Broadcast Failed', 'Check network connection', 'error');
    } finally {
      setIsBroadcasting(false);
    }
  };

  // Helper function to render log action badge
  const renderActionBadge = (action: UserActionType) => {
    switch (action) {
      case 'LOGIN':
        return (
          <span className="inline-flex items-center gap-1 text-[10px] font-black px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-400 border border-emerald-500/40">
            <UserCheck className="w-3 h-3" /> LOGIN
          </span>
        );
      case 'LOGOUT':
        return (
          <span className="inline-flex items-center gap-1 text-[10px] font-black px-2 py-0.5 rounded-full bg-rose-950 text-rose-400 border border-rose-500/40">
            <LogOut className="w-3 h-3" /> LOGOUT
          </span>
        );
      case 'SAVE_REPORT':
        return (
          <span className="inline-flex items-center gap-1 text-[10px] font-black px-2 py-0.5 rounded-full bg-amber-950 text-amber-300 border border-amber-500/40">
            <FileText className="w-3 h-3" /> REPORT SAVED
          </span>
        );
      case 'DELETE_REPORT':
        return (
          <span className="inline-flex items-center gap-1 text-[10px] font-black px-2 py-0.5 rounded-full bg-red-950 text-red-400 border border-red-500/40">
            <Trash2 className="w-3 h-3" /> REPORT DELETED
          </span>
        );
      case 'UPDATE_SCHEDULE':
        return (
          <span className="inline-flex items-center gap-1 text-[10px] font-black px-2 py-0.5 rounded-full bg-blue-950 text-blue-300 border border-blue-500/40">
            <Calendar className="w-3 h-3" /> SCHEDULE UPDATED
          </span>
        );
      case 'BROADCAST_NOTICE':
        return (
          <span className="inline-flex items-center gap-1 text-[10px] font-black px-2 py-0.5 rounded-full bg-purple-950 text-purple-300 border border-purple-500/40">
            <Bell className="w-3 h-3" /> NOTICE BROADCAST
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 text-[10px] font-black px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
            <Activity className="w-3 h-3" /> ACTION
          </span>
        );
    }
  };

  // Helper to format remaining time before 48h auto-purge
  const getRemainingTimeStr = (createdAt: number) => {
    const fortyEightHoursMs = 48 * 60 * 60 * 1000;
    const remainingMs = fortyEightHoursMs - (Date.now() - createdAt);
    if (remainingMs <= 0) return 'Expiring...';
    const hours = Math.floor(remainingMs / (1000 * 60 * 60));
    const minutes = Math.floor((remainingMs % (1000 * 60 * 60)) / (1000 * 60));
    return `${hours}h ${minutes}m left`;
  };

  // Filter user logs
  const filteredLogs = userLogs.filter((log) => {
    if (logFilter === 'LOGIN_LOGOUT' && log.action !== 'LOGIN' && log.action !== 'LOGOUT') return false;
    if (logFilter === 'REPORTS' && log.action !== 'SAVE_REPORT' && log.action !== 'DELETE_REPORT') return false;
    if (logFilter === 'ADMIN' && log.action !== 'UPDATE_SCHEDULE' && log.action !== 'BROADCAST_NOTICE') return false;

    if (logSearchQuery.trim()) {
      const q = logSearchQuery.toLowerCase();
      const matchName = log.userName.toLowerCase().includes(q);
      const matchId = log.userId.toLowerCase().includes(q);
      const matchStation = log.station.toLowerCase().includes(q);
      const matchDetails = log.details.toLowerCase().includes(q);
      const matchAction = log.action.toLowerCase().includes(q);
      return matchName || matchId || matchStation || matchDetails || matchAction;
    }

    return true;
  });

  return (
    <div className="space-y-4 pb-20 fade-in text-slate-100">
      {/* Admin Panel Header */}
      <div className="bg-slate-900 border border-amber-500/40 rounded-2xl p-4 shadow-xl space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-400/40 flex items-center justify-center text-amber-400 font-bold">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-sm font-black text-white uppercase tracking-wider">
                  ADMIN CONTROL PANEL
                </h1>
                <span className="text-[10px] font-black px-1.5 py-0.5 rounded bg-emerald-950 text-emerald-400 border border-emerald-500/40">
                  VERIFIED ADMIN
                </span>
              </div>
              <p className="text-[11px] text-slate-400 font-mono">
                Administrator: <strong className="text-amber-300">{user.name}</strong> (ID-{user.id})
              </p>
            </div>
          </div>

          <button
            onClick={handleLoadSample}
            className="text-[10px] font-bold px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-amber-300 border border-slate-700 active:scale-95 transition-all flex items-center gap-1"
          >
            <RefreshCw className="w-3 h-3" />
            Load Sample
          </button>
        </div>
      </div>

      {/* USER ACTIVITY LOGS FIELD (48-HOUR AUTO-PURGE) */}
      <div className="bg-slate-900 border border-amber-500/40 rounded-2xl p-4 shadow-xl space-y-3">
        <div className="flex items-center justify-between border-b border-slate-800 pb-2 flex-wrap gap-2">
          <label className="text-xs font-extrabold uppercase tracking-wider text-amber-300 flex items-center gap-1.5">
            <Users className="w-4 h-4 text-amber-400" />
            USER ACTIVITY LOGS
          </label>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
              LIVE REAL-TIME
            </span>
            <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-slate-950 text-amber-400 border border-slate-800">
              48H AUTO-PURGE ({userLogs.length})
            </span>
          </div>
        </div>

        <p className="text-[11px] text-slate-400 leading-relaxed">
          Monitor login, logout, and report activity for all officers. Each log item will{' '}
          <strong className="text-amber-300">automatically vanish after 48 hours</strong>.
        </p>

        {/* Log Filter Chips & Search Bar */}
        <div className="space-y-2">
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-500" />
            <input
              type="text"
              value={logSearchQuery}
              onChange={(e) => setLogSearchQuery(e.target.value)}
              placeholder="Search officer name, ID, station or activity..."
              className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-8 pr-3 py-1.5 text-xs text-white placeholder-slate-600 outline-none focus:border-amber-400 font-sans"
            />
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-[10px] font-extrabold no-scrollbar">
            <button
              onClick={() => setLogFilter('ALL')}
              className={`px-2.5 py-1 rounded-lg transition-all ${
                logFilter === 'ALL'
                  ? 'bg-amber-500 text-slate-950 font-black'
                  : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
              }`}
            >
              ALL ({userLogs.length})
            </button>
            <button
              onClick={() => setLogFilter('LOGIN_LOGOUT')}
              className={`px-2.5 py-1 rounded-lg transition-all ${
                logFilter === 'LOGIN_LOGOUT'
                  ? 'bg-amber-500 text-slate-950 font-black'
                  : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
              }`}
            >
              LOGIN/LOGOUT
            </button>
            <button
              onClick={() => setLogFilter('REPORTS')}
              className={`px-2.5 py-1 rounded-lg transition-all ${
                logFilter === 'REPORTS'
                  ? 'bg-amber-500 text-slate-950 font-black'
                  : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
              }`}
            >
              REPORTS
            </button>
            <button
              onClick={() => setLogFilter('ADMIN')}
              className={`px-2.5 py-1 rounded-lg transition-all ${
                logFilter === 'ADMIN'
                  ? 'bg-amber-500 text-slate-950 font-black'
                  : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
              }`}
            >
              ADMIN ACTIONS
            </button>
          </div>
        </div>

        {/* User Log List Container */}
        <div className="bg-slate-950 border border-slate-800 rounded-xl overflow-hidden max-h-72 overflow-y-auto divide-y divide-slate-800/80">
          {filteredLogs.length === 0 ? (
            <div className="p-6 text-center text-slate-500 space-y-1">
              <Clock className="w-8 h-8 mx-auto opacity-40 text-slate-600" />
              <p className="text-xs font-bold text-slate-400 uppercase">No Activity Logs Found</p>
              <p className="text-[10px] text-slate-500">
                User login, logout and report actions will automatically record here.
              </p>
            </div>
          ) : (
            filteredLogs.map((log) => (
              <div key={log.id} className="p-3 hover:bg-slate-900/60 transition-colors space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    {renderActionBadge(log.action)}
                    <span className="font-mono text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-900 text-amber-300 border border-slate-800">
                      {log.station}
                    </span>
                  </div>

                  <span className="text-[10px] font-mono text-slate-400 flex items-center gap-1">
                    <Clock className="w-3 h-3 text-slate-500" />
                    {log.timestamp}
                  </span>
                </div>

                <div className="flex items-center justify-between gap-2 pt-0.5">
                  <div className="text-xs font-bold text-slate-200">
                    Officer <strong className="text-amber-300">{log.userName}</strong>{' '}
                    <span className="text-[10px] font-mono text-slate-400">(ID-{log.userId})</span>
                  </div>

                  <span className="text-[9px] font-mono text-slate-500 bg-slate-900 px-1.5 py-0.5 rounded border border-slate-800 shrink-0">
                    {getRemainingTimeStr(log.createdAt)}
                  </span>
                </div>

                <p className="text-[11px] text-slate-300 leading-snug font-mono bg-slate-900/80 p-1.5 rounded border border-slate-800/60">
                  {log.details}
                </p>
              </div>
            ))
          )}
        </div>
      </div>

      {/* FLST Data Input Box */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-lg space-y-3">
        <div className="flex items-center justify-between border-b border-slate-800 pb-2">
          <label className="text-xs font-extrabold uppercase tracking-wider text-amber-300 flex items-center gap-1.5">
            <Sparkles className="w-4 h-4 text-amber-400" />
            FLST DATA INPUT FIELD
          </label>
          <span className="text-[10px] text-slate-400 font-mono">
            Paste raw daily flight schedule string
          </span>
        </div>

        <p className="text-[11px] text-slate-400 leading-relaxed">
          Paste daily flight data in FLST format below (e.g.{' '}
          <code className="text-amber-300 font-mono bg-slate-950 px-1 py-0.5 rounded">
            6 BS 101 DAC CGP 01AUG 07:00 AM 07:00 AT7 S2-AKJ OK SO 71
          </code>
          ) and click <strong className="text-white">GENERATE</strong> to update the LIVE monitor.
        </p>

        <textarea
          rows={8}
          value={flstInput}
          onChange={(e) => setFlstInput(e.target.value)}
          placeholder="Paste FLST data here..."
          className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-amber-300 font-mono outline-none focus:border-amber-400 leading-relaxed"
        />

        <div className="flex items-center justify-between pt-1">
          <div className="text-[11px] text-slate-400 font-mono">
            Current Schedule Count: <strong className="text-emerald-400">{scheduleFlights.length} flights</strong> ({scheduleDate || 'N/A'})
          </div>

          <button
            onClick={handleGenerate}
            className="py-2.5 px-5 rounded-xl bg-gradient-to-r from-amber-500 via-yellow-500 to-amber-500 hover:from-amber-400 hover:to-yellow-400 active:scale-95 text-slate-950 font-black text-xs uppercase tracking-wider shadow-lg shadow-amber-500/20 transition-all flex items-center gap-2"
          >
            <Database className="w-4 h-4" />
            <span>GENERATE SCHEDULE</span>
          </button>
        </div>
      </div>

      {/* SPECIAL NOTICE FOR ALL OFFICERS FIELD (24-HOUR AUTO-VANISH) */}
      <div className="bg-slate-900 border border-amber-500/40 rounded-2xl p-4 shadow-xl space-y-3">
        <div className="flex items-center justify-between border-b border-slate-800 pb-2">
          <label className="text-xs font-extrabold uppercase tracking-wider text-amber-300 flex items-center gap-1.5">
            <Bell className="w-4 h-4 text-amber-400 animate-bounce" />
            SPECIAL NOTICE INPUT FOR ALL OFFICERS
          </label>
          <span className="text-[10px] text-amber-400/90 font-mono bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/30">
            24H AUTO-VANISH
          </span>
        </div>

        <p className="text-[11px] text-slate-400 leading-relaxed">
          Post special operational instructions or announcement below. This notice will appear as a <strong className="text-amber-300">live pop-up modal</strong> for all officers and will <strong className="text-amber-300">automatically vanish after 24 hours</strong>.
        </p>

        <textarea
          rows={3}
          value={noticeMessage}
          onChange={(e) => setNoticeMessage(e.target.value)}
          placeholder="e.g. Attention Officers: Gate 4 closed for maintenance. All DAC turnaround flights operate from Gate 6 today..."
          className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-white placeholder-slate-600 outline-none focus:border-amber-400 leading-relaxed font-sans"
        />

        <div className="flex justify-end pt-1">
          <button
            onClick={handleSendNotice}
            disabled={isBroadcasting || !noticeMessage.trim()}
            className={`py-2.5 px-6 rounded-xl font-extrabold text-xs uppercase tracking-wider transition-all flex items-center gap-2 ${
              isBroadcasting || !noticeMessage.trim()
                ? 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700'
                : 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-lg shadow-emerald-500/20 active:scale-95'
            }`}
          >
            <Send className="w-4 h-4" />
            <span>{isBroadcasting ? 'BROADCASTING...' : 'BROADCAST NOTICE'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};

