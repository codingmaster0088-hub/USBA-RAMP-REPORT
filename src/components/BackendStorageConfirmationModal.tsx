import React from 'react';
import { CheckCircle2, ShieldCheck, Database, Calendar, Clock, ArrowRight, X, Sparkles } from 'lucide-react';

interface BackendStorageConfirmationModalProps {
  isOpen: boolean;
  dateDisplay: string;
  dateIso: string;
  station: string;
  reportType: 'ANALYTICAL' | 'TIME_ANALYTICAL';
  totalFlights: number;
  expiresDateStr: string;
  onClose: () => void;
}

export const BackendStorageConfirmationModal: React.FC<BackendStorageConfirmationModalProps> = ({
  isOpen,
  dateDisplay,
  dateIso,
  station,
  reportType,
  totalFlights,
  expiresDateStr,
  onClose
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 fade-in">
      <div className="bg-slate-900 border-2 border-emerald-500/80 rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden my-auto border-t-4 border-t-emerald-400 animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="bg-gradient-to-r from-slate-950 via-emerald-950/70 to-slate-950 p-5 border-b border-emerald-500/40 flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 border-2 border-emerald-400 flex items-center justify-center text-emerald-300 shadow-lg shadow-emerald-500/20 shrink-0">
              <Database className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-emerald-500/30 text-emerald-300 border border-emerald-400/50 font-mono">
                  BACKEND CLOUD SYNC
                </span>
                <span className="text-[10px] font-bold text-slate-400 font-mono">
                  STATION: {station}
                </span>
              </div>
              <h3 className="text-base sm:text-lg font-black text-white tracking-wide mt-1">
                DATA SAVED IN BACKEND CLOUD STORAGE
              </h3>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors cursor-pointer border border-slate-700"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 sm:p-6 space-y-4 text-slate-200">
          <div className="bg-emerald-950/40 border border-emerald-500/40 rounded-2xl p-4 flex items-center gap-3.5">
            <div className="w-8 h-8 rounded-full bg-emerald-500 flex items-center justify-center text-slate-950 shrink-0 font-bold">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs sm:text-sm font-bold text-white leading-relaxed">
                Full-day reports for <span className="text-emerald-300 font-black font-mono">{dateDisplay}</span> ({totalFlights} Flights) have been permanently saved into Firestore Cloud Storage!
              </p>
            </div>
          </div>

          {/* Key Guarantee Pillars */}
          <div className="space-y-2.5 text-xs font-sans">
            <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-3 flex items-start gap-3">
              <Clock className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold text-amber-300">Strict 30-Day Auto-Retention Policy:</span>
                <p className="text-slate-400 text-[11px] mt-0.5">
                  This report will remain securely stored in backend until <strong className="text-white font-mono">{expiresDateStr}</strong> (30 days), after which it will vanish automatically from starting date.
                </p>
              </div>
            </div>

            <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-3 flex items-start gap-3">
              <ShieldCheck className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold text-cyan-300">Exact Historical Reproducibility:</span>
                <p className="text-slate-400 text-[11px] mt-0.5">
                  Even if next day schedule FLST is uploaded, selecting <strong className="text-white font-mono">{dateDisplay}</strong> from calendar will generate and download the exact same report created on this date.
                </p>
              </div>
            </div>

            <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-3 flex items-start gap-3">
              <Sparkles className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold text-emerald-300">Complete Multi-Scope Data:</span>
                <p className="text-slate-400 text-[11px] mt-0.5">
                  All scopes (ALL, DOMESTIC, INTERNATIONAL) along with Turnaround Timings, OTP calculations & Delay Categories are safely backed up.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 bg-slate-950 border-t border-slate-800 flex items-center justify-between gap-3">
          <div className="text-[11px] text-slate-400 font-mono">
            STATUS: <span className="text-emerald-400 font-bold">SNAPSHOT ACTIVE</span>
          </div>
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-black text-xs transition-all shadow-lg shadow-emerald-500/20 active:scale-95 cursor-pointer flex items-center gap-1.5"
          >
            <span>OK, GOT IT</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

      </div>
    </div>
  );
};
