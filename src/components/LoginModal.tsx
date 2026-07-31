import React, { useState } from 'react';
import { Plane, User, Key, Building2, ChevronRight } from 'lucide-react';
import { UserProfile, StationCode } from '../types';
import { stationList } from '../data/routesDB';

interface LoginModalProps {
  onLogin: (user: UserProfile) => void;
}

export const LoginModal: React.FC<LoginModalProps> = ({ onLogin }) => {
  const [name, setName] = useState('');
  const [id, setId] = useState('');
  const [station, setStation] = useState<StationCode>('DAC');
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Please enter Officer Name');
      return;
    }
    if (!id.trim()) {
      setError('Please enter USBA ID');
      return;
    }

    onLogin({
      name: name.trim().toUpperCase(),
      id: id.trim(),
      station
    });
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/95 backdrop-blur-md flex items-center justify-center p-4">
      <div className="w-full max-w-sm bg-gradient-to-b from-slate-900 via-blue-950 to-slate-950 border border-amber-500/30 rounded-3xl p-6 shadow-2xl relative overflow-hidden">
        {/* Background Aviation Glow */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-48 h-48 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

        {/* Brand Header */}
        <div className="text-center space-y-2 mb-6">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-br from-navy-800 to-blue-900 border border-amber-400/50 flex items-center justify-center shadow-lg shadow-amber-500/10">
            <Plane className="w-8 h-8 text-amber-400 transform -rotate-45" />
          </div>

          <div>
            <h1 className="text-xl font-black text-white tracking-wider">
              US-BANGLA AIRLINES
            </h1>
            <h2 className="text-xs font-bold tracking-widest text-amber-400 uppercase mt-0.5">
              RAMP MONITORING & REPORT SYSTEM
            </h2>
            <p className="text-[10px] text-slate-400 font-medium italic mt-1">
              Flight Operations & Dispatch HUD
            </p>
          </div>
        </div>

        {/* Login Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="p-2.5 rounded-xl bg-red-950/80 border border-red-500/50 text-red-300 text-xs text-center font-bold">
              {error}
            </div>
          )}

          <div>
            <label className="text-[11px] font-bold text-amber-200 uppercase mb-1 flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-amber-400" />
              USER NAME
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setError('');
              }}
              placeholder="e.g. RASEL HOSSAIN"
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white uppercase placeholder-slate-600 focus:border-amber-400 outline-none"
            />
          </div>

          <div>
            <label className="text-[11px] font-bold text-amber-200 uppercase mb-1 flex items-center gap-1.5">
              <Key className="w-3.5 h-3.5 text-amber-400" />
              USBA ID
            </label>
            <input
              type="text"
              value={id}
              onChange={(e) => {
                setId(e.target.value);
                setError('');
              }}
              placeholder="e.g. 0088"
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-600 focus:border-amber-400 outline-none font-mono"
            />
          </div>

          <div>
            <label className="text-[11px] font-bold text-amber-200 uppercase mb-1 flex items-center gap-1.5">
              <Building2 className="w-3.5 h-3.5 text-amber-400" />
              STATION
            </label>
            <select
              value={station}
              onChange={(e) => setStation(e.target.value as StationCode)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-amber-300 font-bold focus:border-amber-400 outline-none"
            >
              {stationList.map((st) => (
                <option key={st.code} value={st.code} className="bg-slate-900 text-white">
                  {st.city} ({st.code}) - {st.name}
                </option>
              ))}
            </select>
          </div>

          <button
            type="submit"
            className="w-full py-3.5 px-4 rounded-xl bg-gradient-to-r from-amber-500 via-yellow-500 to-amber-500 hover:from-amber-400 hover:to-yellow-400 active:scale-98 text-slate-950 font-black text-xs uppercase tracking-wider shadow-xl shadow-amber-500/20 transition-all flex items-center justify-center gap-2 mt-2"
          >
            <span>LOGIN SYSTEM</span>
            <ChevronRight className="w-4 h-4 stroke-[3]" />
          </button>
        </form>
      </div>
    </div>
  );
};
