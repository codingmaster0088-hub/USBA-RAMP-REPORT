import React, { useState } from 'react';
import { Lock, PlusCircle, Key, X, AlertTriangle, ShieldCheck, Clock } from 'lucide-react';
import { SavedReport } from '../types';
import {
  getReportAgeSinceDownloadMs,
  formatReportAgeMins,
  SUPER_ADMIN_PIN
} from '../utils/reportLock';

interface ReportLockModalProps {
  report: SavedReport;
  onClose: () => void;
  onCreateNewReportForFlight: (report: SavedReport) => void;
  onSuperAdminUnlock: (pin: string) => boolean;
  isDarkMode?: boolean;
}

export const ReportLockModal: React.FC<ReportLockModalProps> = ({
  report,
  onClose,
  onCreateNewReportForFlight,
  onSuperAdminUnlock,
  isDarkMode = true
}) => {
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState('');
  const [showPinInput, setShowPinInput] = useState(false);

  const ageMs = getReportAgeSinceDownloadMs(report);
  const ageDisplay = formatReportAgeMins(ageMs);
  const flightNum = report.flight || report.formData?.deptFlt || report.formData?.arvFlt || 'FLIGHT';
  const route = report.formData?.deptRoute || report.formData?.arvRoute || report.route || 'ROUTE';
  const dateStr = report.formData?.date || report.date || 'TODAY';
  const acReg = report.formData?.ac || 'A/C';

  const handleVerifyPin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!pinInput.trim()) {
      setPinError('Please enter Super Admin PIN');
      return;
    }
    const success = onSuperAdminUnlock(pinInput.trim());
    if (!success) {
      setPinError('Invalid Super Admin PIN');
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4 fade-in">
      <div
        className={`w-full max-w-md border-2 rounded-3xl p-6 shadow-2xl relative overflow-hidden space-y-5 ${
          isDarkMode
            ? 'bg-slate-900 border-rose-500/60 text-slate-100 shadow-rose-950/40'
            : 'bg-white border-rose-500 text-slate-900 shadow-2xl'
        }`}
      >
        {/* Background glow */}
        <div className="absolute top-0 right-0 w-48 h-48 bg-rose-500/10 rounded-full blur-3xl pointer-events-none" />

        {/* Modal Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-rose-500/20 border border-rose-500/50 flex items-center justify-center text-rose-400 shrink-0 shadow-lg">
              <Lock className="w-6 h-6 stroke-[2.5]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-black uppercase tracking-wider text-rose-400">
                  REPORT LOCKED
                </h2>
                <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-rose-950 text-rose-300 border border-rose-500/40">
                  READ-ONLY
                </span>
              </div>
              <p className="text-xs text-slate-400 font-semibold mt-0.5">
                10-Minute Lockout Window after JPG Download
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl hover:bg-slate-800 text-slate-400 hover:text-white transition-all cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Flight Summary Card */}
        <div
          className={`p-3.5 rounded-2xl border ${
            isDarkMode ? 'bg-slate-950/70 border-slate-800' : 'bg-slate-50 border-slate-200'
          }`}
        >
          <div className="flex items-center justify-between text-xs">
            <span className="font-mono font-black text-amber-400 text-sm">{flightNum}</span>
            <span className="font-bold text-slate-400 font-mono">{route}</span>
          </div>
          <div className="flex items-center justify-between text-[11px] text-slate-400 mt-1.5 pt-1.5 border-t border-slate-800/60 font-mono">
            <span>A/C: <strong className="text-white font-bold">{acReg}</strong></span>
            <span>Date: <strong className="text-white font-bold">{dateStr}</strong></span>
            <span className="flex items-center gap-1 text-rose-400 font-bold">
              <Clock className="w-3 h-3" /> Downloaded: {ageDisplay}
            </span>
          </div>
        </div>

        {/* Informative Explanation */}
        <div className="space-y-2 text-xs leading-relaxed text-slate-300">
          <div className="flex items-start gap-2 text-amber-300/90 font-bold">
            <AlertTriangle className="w-4 h-4 shrink-0 text-amber-400 mt-0.5" />
            <span>
              Official reports become <strong>Read-Only 10 minutes</strong> after clicking <strong>'DOWNLOAD JPG'</strong>. Direct editing is restricted to <strong>Super Admin</strong>.
            </span>
          </div>
          <p className="text-[11px] text-slate-400 pl-6">
            If you need to update or correct flight timings (e.g. Door Close, C/OFF, Aircraft Reg), please click <strong>Create New Report</strong> below. The server will automatically save and prioritize your newest report as the official information.
          </p>
        </div>

        {/* Primary Action: Create New Report for This Flight */}
        <div className="space-y-2.5 pt-2 border-t border-slate-800/80">
          <button
            type="button"
            onClick={() => {
              onCreateNewReportForFlight(report);
              onClose();
            }}
            className="w-full py-3.5 px-4 rounded-xl bg-gradient-to-r from-amber-500 via-yellow-500 to-amber-500 hover:from-amber-400 hover:to-yellow-400 active:scale-98 text-slate-950 font-black text-xs uppercase tracking-wider shadow-xl shadow-amber-500/20 transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            <PlusCircle className="w-4 h-4 stroke-[2.5]" />
            <span>CREATE NEW REPORT</span>
          </button>

          {/* Super Admin Unlock Section */}
          {!showPinInput ? (
            <button
              type="button"
              onClick={() => setShowPinInput(true)}
              className="w-full py-2.5 px-3 rounded-xl bg-slate-800/80 hover:bg-slate-700/80 text-amber-300 border border-slate-700 font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all cursor-pointer"
            >
              <Key className="w-3.5 h-3.5 text-amber-400" />
              <span>SUPER ADMIN DIRECT EDIT</span>
            </button>
          ) : (
            <form onSubmit={handleVerifyPin} className="space-y-2 pt-1">
              <div className="flex items-center gap-2">
                <input
                  type="password"
                  value={pinInput}
                  onChange={(e) => {
                    setPinInput(e.target.value);
                    setPinError('');
                  }}
                  maxLength={10}
                  placeholder="Enter Super Admin PIN"
                  className="flex-1 bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs font-mono text-white outline-none focus:border-amber-400"
                  autoFocus
                />
                <button
                  type="submit"
                  className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs uppercase rounded-xl transition-all cursor-pointer"
                >
                  UNLOCK
                </button>
              </div>
              {pinError && (
                <p className="text-[11px] text-rose-400 font-bold text-center">{pinError}</p>
              )}
            </form>
          )}

          <button
            type="button"
            onClick={onClose}
            className="w-full py-2 text-slate-400 hover:text-white text-xs font-bold transition-all cursor-pointer"
          >
            Dismiss & Keep Read-Only
          </button>
        </div>
      </div>
    </div>
  );
};
