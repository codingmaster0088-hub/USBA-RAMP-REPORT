import React, { useState } from 'react';
import { UserProfile, ScheduleFlight } from '../types';
import { parseFLSTData, sampleFLSTInput } from '../utils/flstParser';
import { ShieldCheck, Lock, Sparkles, Database, CheckCircle2, RefreshCw, Bell, Send } from 'lucide-react';

interface AdminSectionProps {
  user: UserProfile;
  scheduleFlights: ScheduleFlight[];
  scheduleDate: string;
  onUpdateSchedule: (flights: ScheduleFlight[], dateHeader: string, rawFlst: string) => void;
  onBroadcastNotice?: (message: string) => Promise<void>;
  showToast: (title: string, subtitle?: string, type?: 'success' | 'info' | 'error') => void;
}

export const AdminSection: React.FC<AdminSectionProps> = ({
  user,
  scheduleFlights,
  scheduleDate,
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

      {/* SPECIAL NOTICE FOR ALL OFFICERS FIELD */}
      <div className="bg-slate-900 border border-amber-500/40 rounded-2xl p-4 shadow-xl space-y-3">
        <div className="flex items-center justify-between border-b border-slate-800 pb-2">
          <label className="text-xs font-extrabold uppercase tracking-wider text-amber-300 flex items-center gap-1.5">
            <Bell className="w-4 h-4 text-amber-400 animate-bounce" />
            SPECIAL NOTICE INPUT FOR ALL OFFICERS
          </label>
          <span className="text-[10px] text-amber-400/90 font-mono bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/30">
            POP-UP BROADCAST
          </span>
        </div>

        <p className="text-[11px] text-slate-400 leading-relaxed">
          Post special operational instructions or announcement below. This notice will appear as a <strong className="text-amber-300">live pop-up modal</strong> for all officers when they return or open the app.
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

      {/* Current Active Schedule Preview */}
      {scheduleFlights.length > 0 && (
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 space-y-2">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
            <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              ACTIVE GENERATED SCHEDULE PREVIEW
            </h3>
            <span className="text-[10px] text-amber-400 font-mono">{scheduleDate}</span>
          </div>

          <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1 font-mono text-[11px]">
            {scheduleFlights.map((flt) => (
              <div
                key={flt.id}
                className="bg-slate-950 p-2 rounded-lg border border-slate-800/80 flex items-center justify-between text-slate-300"
              >
                <div className="flex items-center gap-2">
                  <span
                    className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                      flt.isDeparture
                        ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                        : 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                    }`}
                  >
                    {flt.isDeparture ? 'DEPARTURE' : 'ARRIVAL'}
                  </span>
                  <span className="font-extrabold text-amber-300">{flt.formattedDisplay}</span>
                </div>
                <span className="text-slate-500 text-[10px]">{flt.sector}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

