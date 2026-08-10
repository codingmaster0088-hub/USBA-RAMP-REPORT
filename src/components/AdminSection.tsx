import React, { useState } from 'react';
import { UserProfile, ScheduleFlight, UserLog, UserActionType, AdminNotice, SavedReport } from '../types';
import { parseFLSTData, sampleFLSTInput } from '../utils/flstParser';
import { AnalyticalReportModal } from './AnalyticalReportModal';
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
  Activity,
  BarChart3,
  X,
  ChevronRight
} from 'lucide-react';

interface AdminSectionProps {
  user: UserProfile;
  scheduleFlights: ScheduleFlight[];
  scheduleDate: string;
  userLogs?: UserLog[];
  notices?: AdminNotice[];
  savedReports?: SavedReport[];
  onUpdateSchedule: (flights: ScheduleFlight[], dateHeader: string, rawFlst: string) => void;
  onBroadcastNotice?: (message: string) => Promise<void>;
  onDeleteNotice?: (noticeId: string) => void;
  showToast: (title: string, subtitle?: string, type?: 'success' | 'info' | 'error') => void;
}

export const AdminSection: React.FC<AdminSectionProps> = ({
  user,
  scheduleFlights,
  scheduleDate,
  userLogs = [],
  notices = [],
  savedReports = [],
  onUpdateSchedule,
  onBroadcastNotice,
  onDeleteNotice,
  showToast
}) => {
  // Secret Admin PIN authentication state
  const [adminPin, setAdminPin] = useState('');
  const [isPinUnlocked, setIsPinUnlocked] = useState<boolean>(() => {
    return sessionStorage.getItem('usb_admin_unlocked_pin') === '11126';
  });
  const [pinError, setPinError] = useState('');
  const [showPin, setShowPin] = useState(false);

  // Active Admin Modal Popup State ('LOG_CHECK' | 'FLST_INPUT' | 'NOTICE' | 'ANALYTICAL_REPORT' | null)
  const [activeModal, setActiveModal] = useState<'LOG_CHECK' | 'FLST_INPUT' | 'NOTICE' | 'ANALYTICAL_REPORT' | null>(null);

  const [flstInput, setFlstInput] = useState<string>(() => {
    return localStorage.getItem('usb_flst_raw') || sampleFLSTInput;
  });

  const [noticeMessage, setNoticeMessage] = useState<string>('');
  const [isBroadcasting, setIsBroadcasting] = useState<boolean>(false);

  // User Logs filtering state
  const [logFilter, setLogFilter] = useState<'ALL' | 'LOGIN_LOGOUT' | 'REPORTS' | 'ADMIN'>('ALL');
  const [logSearchQuery, setLogSearchQuery] = useState<string>('');

  const handleVerifyPin = (e: React.FormEvent) => {
    e.preventDefault();
    if (adminPin.trim() === '11126') {
      setIsPinUnlocked(true);
      sessionStorage.setItem('usb_admin_unlocked_pin', '11126');
      setPinError('');
      showToast('Admin Security Verified', 'Welcome to Master Admin Panel', 'success');
    } else {
      setPinError('Incorrect Secret Admin PIN. Access Denied!');
      setAdminPin('');
      showToast('Access Denied', 'Invalid Secret PIN', 'error');
    }
  };

  const handleLockAdmin = () => {
    setIsPinUnlocked(false);
    sessionStorage.removeItem('usb_admin_unlocked_pin');
    setAdminPin('');
    showToast('Admin Panel Locked', 'PIN required to re-enter', 'info');
  };

  if (!isPinUnlocked) {
    return (
      <div className="bg-slate-900/90 border border-amber-500/40 rounded-2xl p-6 text-center space-y-5 shadow-2xl fade-in my-auto max-w-md mx-auto">
        <div className="w-16 h-16 mx-auto rounded-2xl bg-amber-500/10 border border-amber-400/50 flex items-center justify-center text-amber-400 shadow-xl shadow-amber-500/10">
          <Lock className="w-8 h-8" />
        </div>

        <div className="space-y-2">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-bold">
            <ShieldCheck className="w-3.5 h-3.5 text-amber-400" />
            ADMIN SECURITY CHECKPOINT
          </div>
          <h2 className="text-lg font-black text-white tracking-wide uppercase">
            RESTRICTED ADMIN ACCESS
          </h2>
          <p className="text-xs text-slate-400 leading-relaxed">
            Entering the <strong className="text-amber-300">Secret Admin PIN</strong> is strictly required to unlock control features, broadcasts & activity logs.
          </p>
        </div>

        <form onSubmit={handleVerifyPin} className="space-y-4 pt-2">
          <div className="space-y-1 text-left">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
              ENTER SECRET ADMIN PIN (5-DIGITS)
            </label>
            <div className="relative">
              <input
                type={showPin ? 'text' : 'password'}
                maxLength={5}
                value={adminPin}
                onChange={(e) => {
                  setAdminPin(e.target.value);
                  if (pinError) setPinError('');
                }}
                placeholder="•••••"
                className="w-full bg-slate-950 border border-slate-800 focus:border-amber-400 rounded-xl px-4 py-3 text-center text-lg font-mono font-bold tracking-[0.5em] text-amber-300 outline-none transition-all placeholder:tracking-normal placeholder:text-slate-700"
                autoFocus
              />
              <button
                type="button"
                onClick={() => setShowPin(!showPin)}
                className="absolute right-3 top-3 text-xs text-slate-500 hover:text-amber-300 font-mono font-bold"
              >
                {showPin ? 'HIDE' : 'SHOW'}
              </button>
            </div>
            {pinError && (
              <p className="text-[11px] font-bold text-rose-400 pt-1 text-center font-mono">
                ⚠️ {pinError}
              </p>
            )}
          </div>

          <button
            type="submit"
            className="w-full py-3 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-extrabold text-xs uppercase tracking-wider rounded-xl shadow-lg shadow-amber-500/20 active:scale-95 transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            <Lock className="w-4 h-4" />
            UNLOCK ADMIN PANEL
          </button>
        </form>
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
      {/* Admin Panel Header (matching Photo 2 design) */}
      <div className="bg-slate-900/90 border border-amber-500/40 rounded-2xl p-3.5 shadow-xl space-y-2">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center text-slate-950 font-black text-xl shadow-lg shadow-amber-500/20 border border-amber-300 shrink-0">
              ✈
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-base font-black text-amber-400 uppercase tracking-wider">
                  US-BANGLA
                </h1>
                <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-blue-950 text-blue-300 border border-blue-500/40 tracking-wider">
                  RAMP HUD
                </span>
              </div>
              <div className="flex items-center gap-1.5 text-[11px] font-mono mt-0.5 flex-wrap">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse inline-block"></span>
                <span className="font-bold text-white uppercase">{user.name}</span>
                <span className="text-amber-400 font-bold">• ID-{user.id}</span>
                <span className="text-slate-500 text-[10px] italic">| invented by radoan rasel |</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 px-2.5 py-1 rounded-xl bg-amber-500/10 border border-amber-500/40 text-amber-300 text-xs font-bold">
              <span>☀️ SUN</span>
            </div>
            <div className="px-3 py-1 rounded-xl bg-slate-950 border border-amber-500/60 text-amber-300 font-mono font-bold text-xs flex items-center gap-1">
              <span>{user.station || 'DAC'}</span>
            </div>
            <button
              onClick={handleLockAdmin}
              title="Lock Admin Panel"
              className="p-2 rounded-xl bg-rose-950/80 hover:bg-rose-900 text-rose-300 border border-rose-500/40 active:scale-95 transition-all cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* 4 SEPARATE ACTION BUTTONS / MODULE CARDS */}
      <div className="space-y-2">
        <label className="text-xs font-black text-amber-300 uppercase tracking-wider block pl-1">
          SELECT ADMIN ACTION MODULE:
        </label>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* 1. LOG CHECK BUTTON */}
          <button
            onClick={() => setActiveModal('LOG_CHECK')}
            className={`bg-slate-900 hover:bg-slate-800 border rounded-2xl p-4 text-left transition-all active:scale-95 cursor-pointer shadow-xl space-y-2 group ${
              activeModal === 'LOG_CHECK' ? 'border-amber-400 bg-amber-500/10' : 'border-amber-500/40 hover:border-amber-400'
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-400/40 flex items-center justify-center text-amber-400 group-hover:bg-amber-500 group-hover:text-slate-950 transition-colors shadow-md">
                <Users className="w-5 h-5" />
              </div>
              <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-slate-950 text-amber-400 border border-slate-800">
                {userLogs.length} LOGS
              </span>
            </div>
            <div>
              <div className="text-xs font-black text-white group-hover:text-amber-300 uppercase tracking-wide flex items-center justify-between">
                <span>1. LOG CHECK</span>
                <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-amber-300 transition-transform group-hover:translate-x-0.5" />
              </div>
              <p className="text-[11px] text-slate-400 leading-snug mt-1">
                View officer login, logout, & report activity logs (48h auto-purge).
              </p>
            </div>
          </button>

          {/* 2. FLST INPUT BUTTON */}
          <button
            onClick={() => setActiveModal('FLST_INPUT')}
            className={`bg-slate-900 hover:bg-slate-800 border rounded-2xl p-4 text-left transition-all active:scale-95 cursor-pointer shadow-xl space-y-2 group ${
              activeModal === 'FLST_INPUT' ? 'border-blue-400 bg-blue-500/10' : 'border-blue-500/40 hover:border-blue-400'
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="w-10 h-10 rounded-xl bg-blue-500/15 border border-blue-400/40 flex items-center justify-center text-blue-400 group-hover:bg-blue-500 group-hover:text-slate-950 transition-colors shadow-md">
                <Database className="w-5 h-5" />
              </div>
              <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-slate-950 text-blue-300 border border-slate-800">
                {scheduleFlights.length} FLTS
              </span>
            </div>
            <div>
              <div className="text-xs font-black text-white group-hover:text-blue-300 uppercase tracking-wide flex items-center justify-between">
                <span>2. FLST INPUT</span>
                <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-blue-300 transition-transform group-hover:translate-x-0.5" />
              </div>
              <p className="text-[11px] text-slate-400 leading-snug mt-1">
                Paste raw flight schedule string & generate LIVE flight monitor.
              </p>
            </div>
          </button>

          {/* 3. NOTICE BUTTON */}
          <button
            onClick={() => setActiveModal('NOTICE')}
            className={`bg-slate-900 hover:bg-slate-800 border rounded-2xl p-4 text-left transition-all active:scale-95 cursor-pointer shadow-xl space-y-2 group ${
              activeModal === 'NOTICE' ? 'border-purple-400 bg-purple-500/10' : 'border-purple-500/40 hover:border-purple-400'
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="w-10 h-10 rounded-xl bg-purple-500/15 border border-purple-400/40 flex items-center justify-center text-purple-400 group-hover:bg-purple-500 group-hover:text-slate-950 transition-colors shadow-md">
                <Bell className="w-5 h-5" />
              </div>
              <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-slate-950 text-purple-300 border border-slate-800">
                {notices.length} ACTIVE
              </span>
            </div>
            <div>
              <div className="text-xs font-black text-white group-hover:text-purple-300 uppercase tracking-wide flex items-center justify-between">
                <span>3. NOTICE</span>
                <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-purple-300 transition-transform group-hover:translate-x-0.5" />
              </div>
              <p className="text-[11px] text-slate-400 leading-snug mt-1">
                Broadcast special notice pop-ups to all active officers (24h auto-vanish).
              </p>
            </div>
          </button>

          {/* 4. ANALYTICAL REPORT BUTTON */}
          <button
            onClick={() => setActiveModal('ANALYTICAL_REPORT')}
            className={`bg-slate-900 hover:bg-slate-800 border rounded-2xl p-4 text-left transition-all active:scale-95 cursor-pointer shadow-xl space-y-2 group ${
              activeModal === 'ANALYTICAL_REPORT' ? 'border-emerald-400 bg-emerald-500/10' : 'border-emerald-500/50 hover:border-emerald-400'
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/15 border border-emerald-400/40 flex items-center justify-center text-emerald-400 group-hover:bg-emerald-500 group-hover:text-slate-950 transition-colors shadow-md">
                <BarChart3 className="w-5 h-5" />
              </div>
              <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-slate-950 text-emerald-400 border border-slate-800">
                ANALYTICS
              </span>
            </div>
            <div>
              <div className="text-xs font-black text-white group-hover:text-emerald-300 uppercase tracking-wide flex items-center justify-between">
                <span>4. ANALYTICAL REPORT</span>
                <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-emerald-300 transition-transform group-hover:translate-x-0.5" />
              </div>
              <p className="text-[11px] text-slate-400 leading-snug mt-1">
                Day-wise delay code statistics, breakdown & downloadable JPG report.
              </p>
            </div>
          </button>
        </div>
      </div>

      {/* POPUP WINDOW MODAL 1: LOG CHECK */}
      {activeModal === 'LOG_CHECK' && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-5 overflow-y-auto fade-in">
          <div className="bg-slate-900 border border-amber-500/50 rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden my-auto space-y-0">
            {/* Modal Header */}
            <div className="p-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-amber-500/15 border border-amber-400/40 flex items-center justify-center text-amber-400">
                  <Users className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-sm font-black text-white uppercase tracking-wider">
                    1. LOG CHECK (USER ACTIVITY LOGS)
                  </h2>
                  <p className="text-[10px] text-slate-400 font-mono">
                    Real-time officer authentication & report action logs (48-Hour Auto-Purge)
                  </p>
                </div>
              </div>
              <button
                onClick={() => setActiveModal(null)}
                className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Scrollable Body */}
            <div className="p-4 sm:p-6 overflow-y-auto space-y-4 flex-1">
              {/* Log Filter Chips & Search Bar */}
              <div className="space-y-2">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-500" />
                  <input
                    type="text"
                    value={logSearchQuery}
                    onChange={(e) => setLogSearchQuery(e.target.value)}
                    placeholder="Search officer name, ID, station or activity..."
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-8 pr-3 py-2 text-xs text-white placeholder-slate-600 outline-none focus:border-amber-400 font-sans"
                  />
                </div>

                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-[10px] font-extrabold no-scrollbar">
                  <button
                    onClick={() => setLogFilter('ALL')}
                    className={`px-3 py-1.5 rounded-lg transition-all ${
                      logFilter === 'ALL'
                        ? 'bg-amber-500 text-slate-950 font-black'
                        : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
                    }`}
                  >
                    ALL ({userLogs.length})
                  </button>
                  <button
                    onClick={() => setLogFilter('LOGIN_LOGOUT')}
                    className={`px-3 py-1.5 rounded-lg transition-all ${
                      logFilter === 'LOGIN_LOGOUT'
                        ? 'bg-amber-500 text-slate-950 font-black'
                        : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
                    }`}
                  >
                    LOGIN/LOGOUT
                  </button>
                  <button
                    onClick={() => setLogFilter('REPORTS')}
                    className={`px-3 py-1.5 rounded-lg transition-all ${
                      logFilter === 'REPORTS'
                        ? 'bg-amber-500 text-slate-950 font-black'
                        : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
                    }`}
                  >
                    REPORTS
                  </button>
                  <button
                    onClick={() => setLogFilter('ADMIN')}
                    className={`px-3 py-1.5 rounded-lg transition-all ${
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
              <div className="bg-slate-950 border border-slate-800 rounded-xl overflow-hidden max-h-96 overflow-y-auto divide-y divide-slate-800/80">
                {filteredLogs.length === 0 ? (
                  <div className="p-8 text-center text-slate-500 space-y-1">
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

                      <p className="text-[11px] text-slate-300 leading-snug font-mono bg-slate-900/80 p-2 rounded border border-slate-800/60">
                        {log.details}
                      </p>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* POPUP WINDOW MODAL 2: FLST INPUT */}
      {activeModal === 'FLST_INPUT' && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-5 overflow-y-auto fade-in">
          <div className="bg-slate-900 border border-blue-500/50 rounded-2xl w-full max-w-3xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden my-auto">
            {/* Modal Header */}
            <div className="p-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-blue-500/15 border border-blue-400/40 flex items-center justify-center text-blue-400">
                  <Database className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-sm font-black text-white uppercase tracking-wider">
                    2. FLST INPUT (FLIGHT SCHEDULE DATA)
                  </h2>
                  <p className="text-[10px] text-slate-400 font-mono">
                    Paste raw daily flight schedule string to update LIVE flight monitor
                  </p>
                </div>
              </div>
              <button
                onClick={() => setActiveModal(null)}
                className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-4 sm:p-6 overflow-y-auto space-y-4 flex-1">
              <p className="text-xs text-slate-300 leading-relaxed">
                Paste daily flight data in FLST format below (e.g.{' '}
                <code className="text-amber-300 font-mono bg-slate-950 px-1.5 py-0.5 rounded border border-slate-800">
                  6 BS 101 DAC CGP 01AUG 07:00 AM 07:00 AT7 S2-AKJ OK SO 71
                </code>
                ) and click <strong className="text-white">GENERATE SCHEDULE</strong>.
              </p>

              <textarea
                rows={10}
                value={flstInput}
                onChange={(e) => setFlstInput(e.target.value)}
                placeholder="Paste FLST data here..."
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-amber-300 font-mono outline-none focus:border-blue-400 leading-relaxed"
              />

              <div className="flex items-center justify-between flex-wrap gap-3 pt-2">
                <div className="text-xs text-slate-400 font-mono">
                  Current Schedule: <strong className="text-emerald-400">{scheduleFlights.length} flights</strong> ({scheduleDate || 'N/A'})
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={handleLoadSample}
                    className="py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-amber-300 border border-slate-700 font-bold text-xs active:scale-95 transition-all cursor-pointer flex items-center gap-1.5"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    LOAD SAMPLE
                  </button>

                  <button
                    onClick={() => {
                      handleGenerate();
                      setActiveModal(null);
                    }}
                    className="py-2.5 px-5 rounded-xl bg-gradient-to-r from-blue-500 via-indigo-500 to-blue-600 hover:from-blue-400 hover:to-indigo-400 active:scale-95 text-white font-black text-xs uppercase tracking-wider shadow-lg shadow-blue-500/20 transition-all flex items-center gap-2 cursor-pointer"
                  >
                    <Database className="w-4 h-4" />
                    <span>GENERATE SCHEDULE</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* POPUP WINDOW MODAL 3: NOTICE */}
      {activeModal === 'NOTICE' && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-5 overflow-y-auto fade-in">
          <div className="bg-slate-900 border border-purple-500/50 rounded-2xl w-full max-w-3xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden my-auto">
            {/* Modal Header */}
            <div className="p-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-purple-500/15 border border-purple-400/40 flex items-center justify-center text-purple-400">
                  <Bell className="w-5 h-5 animate-bounce" />
                </div>
                <div>
                  <h2 className="text-sm font-black text-white uppercase tracking-wider">
                    3. NOTICE (SPECIAL BROADCAST ANNOUNCEMENT)
                  </h2>
                  <p className="text-[10px] text-slate-400 font-mono">
                    Broadcast operational notice pop-ups to all active officers (24H Auto-Vanish)
                  </p>
                </div>
              </div>
              <button
                onClick={() => setActiveModal(null)}
                className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-4 sm:p-6 overflow-y-auto space-y-5 flex-1">
              <div className="space-y-2">
                <label className="text-xs font-extrabold text-amber-300 uppercase tracking-wider block">
                  WRITE SPECIAL OPERATIONAL NOTICE:
                </label>
                <textarea
                  rows={4}
                  value={noticeMessage}
                  onChange={(e) => setNoticeMessage(e.target.value)}
                  placeholder="e.g. Attention Officers: Gate 4 closed for maintenance. All DAC turnaround flights operate from Gate 6 today..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-white placeholder-slate-600 outline-none focus:border-purple-400 leading-relaxed font-sans"
                />
              </div>

              <div className="flex justify-end">
                <button
                  onClick={async () => {
                    await handleSendNotice();
                  }}
                  disabled={isBroadcasting || !noticeMessage.trim()}
                  className={`py-2.5 px-6 rounded-xl font-extrabold text-xs uppercase tracking-wider transition-all flex items-center gap-2 cursor-pointer ${
                    isBroadcasting || !noticeMessage.trim()
                      ? 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700'
                      : 'bg-purple-500 hover:bg-purple-400 text-slate-950 shadow-lg shadow-purple-500/20 active:scale-95'
                  }`}
                >
                  <Send className="w-4 h-4" />
                  <span>{isBroadcasting ? 'BROADCASTING...' : 'BROADCAST NOTICE'}</span>
                </button>
              </div>

              {/* Active Broadcast Notices List */}
              {notices.length > 0 && (
                <div className="pt-4 border-t border-slate-800 space-y-2">
                  <span className="text-xs font-extrabold text-amber-300 uppercase tracking-wider block">
                    ACTIVE BROADCASTED NOTICES ({notices.length})
                  </span>
                  <div className="space-y-2 max-h-56 overflow-y-auto">
                    {notices.map((n) => (
                      <div
                        key={n.id}
                        className="bg-slate-950 p-3 rounded-xl border border-purple-500/30 flex items-start justify-between gap-3"
                      >
                        <div className="space-y-1 text-xs text-left">
                          <p className="text-slate-200 font-bold leading-relaxed whitespace-pre-wrap">
                            {n.message}
                          </p>
                          <div className="text-[10px] font-mono text-slate-500">
                            Author: <span className="text-amber-400">{n.authorName || n.author || 'Admin'}</span>
                          </div>
                        </div>
                        {onDeleteNotice && (
                          <button
                            onClick={() => onDeleteNotice(n.id)}
                            className="px-2.5 py-1.5 rounded-lg bg-rose-950 hover:bg-rose-900 text-rose-300 border border-rose-500/40 text-[10px] font-bold shrink-0 transition-all active:scale-95 flex items-center gap-1 cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                            <span>REMOVE</span>
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* POPUP WINDOW MODAL 4: ANALYTICAL REPORT */}
      {activeModal === 'ANALYTICAL_REPORT' && (
        <AnalyticalReportModal
          savedReports={savedReports}
          scheduleFlights={scheduleFlights}
          station={user.station}
          adminName={user.name}
          adminId={user.id}
          onClose={() => setActiveModal(null)}
          showToast={showToast}
        />
      )}
    </div>
  );
};

