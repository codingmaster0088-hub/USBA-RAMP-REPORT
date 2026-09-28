import React from 'react';
import { ShieldAlert, ArrowLeft, Building2 } from 'lucide-react';

interface OutstationRestrictedModalProps {
  isOpen: boolean;
  station?: string;
  onClose: () => void;
}

export const OutstationRestrictedModal: React.FC<OutstationRestrictedModalProps> = ({
  isOpen,
  station,
  onClose
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] bg-slate-950/95 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="w-full max-w-md bg-gradient-to-b from-slate-900 via-rose-950/30 to-slate-950 border-2 border-rose-500/70 rounded-3xl p-6 sm:p-7 shadow-2xl shadow-rose-950/60 relative overflow-hidden text-center space-y-5">
        {/* Glow */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-48 h-48 bg-rose-500/20 rounded-full blur-3xl pointer-events-none" />

        {/* Warning Icon */}
        <div className="w-16 h-16 mx-auto rounded-2xl bg-rose-500/20 border-2 border-rose-500/50 flex items-center justify-center text-rose-400 shadow-lg shadow-rose-500/20">
          <ShieldAlert className="w-9 h-9 animate-pulse" />
        </div>

        {/* Station Badge & Exact Required Message */}
        <div className="space-y-2">
          <span className="text-[11px] font-black uppercase tracking-widest px-3 py-1 rounded-full bg-rose-950/80 border border-rose-500/40 text-rose-300 inline-flex items-center gap-1.5">
            <Building2 className="w-3.5 h-3.5" />
            {station ? `${station} OUTSTATION RESTRICTED` : 'ACCESS RESTRICTED'}
          </span>
          <h2 className="text-lg sm:text-xl font-black text-rose-400 tracking-wide uppercase leading-snug">
            THIS APP IS TEMPORARY STOPPED FOR OUT STATION BY ADMIN
          </h2>
        </div>

        {/* Explanation Note */}
        <div className="text-xs text-slate-300 leading-relaxed font-medium bg-slate-950/90 border border-rose-900/40 rounded-xl p-3.5 text-left space-y-1">
          <p className="font-bold text-rose-300">
            Notice for Station {station ? `(${station})` : 'Officers'}:
          </p>
          <p className="text-slate-400">
            System operations for outstations have been paused under administrative instruction until further management decision. Only Dhaka Hub (DAC) operations are authorized to proceed.
          </p>
        </div>

        {/* Action Button */}
        <button
          type="button"
          onClick={onClose}
          className="w-full py-3.5 px-4 rounded-xl bg-gradient-to-r from-rose-600 via-rose-500 to-rose-600 hover:from-rose-500 hover:to-rose-400 active:scale-98 text-white font-black text-xs uppercase tracking-wider shadow-xl shadow-rose-600/30 transition-all flex items-center justify-center gap-2 cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4 stroke-[3]" />
          <span>RETURN TO LOGIN</span>
        </button>
      </div>
    </div>
  );
};
