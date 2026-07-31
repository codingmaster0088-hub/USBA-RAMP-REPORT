import React, { useState, useEffect } from 'react';
import { Plane, LogOut, ShieldCheck } from 'lucide-react';
import { UserProfile, StationCode, ActiveTab } from '../types';
import { stationList } from '../data/routesDB';

interface HeaderProps {
  user: UserProfile | null;
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  onLogout: () => void;
  onStationChange: (station: StationCode) => void;
}

const TypewriterText: React.FC<{ text: string }> = ({ text }) => {
  const [displayText, setDisplayText] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [index, setIndex] = useState(0);

  useEffect(() => {
    let timeout: NodeJS.Timeout;
    if (!isDeleting && index < text.length) {
      timeout = setTimeout(() => {
        setDisplayText((prev) => prev + text[index]);
        setIndex((prev) => prev + 1);
      }, 90);
    } else if (!isDeleting && index === text.length) {
      timeout = setTimeout(() => {
        setIsDeleting(true);
      }, 2500);
    } else if (isDeleting && index > 0) {
      timeout = setTimeout(() => {
        setDisplayText((prev) => prev.slice(0, -1));
        setIndex((prev) => prev - 1);
      }, 40);
    } else if (isDeleting && index === 0) {
      setIsDeleting(false);
    }
    return () => clearTimeout(timeout);
  }, [index, isDeleting, text]);

  return (
    <span className="text-[10px] text-amber-300/90 font-mono italic flex items-center leading-none mt-0.5">
      <span>{displayText}</span>
      <span className="animate-pulse text-amber-400 font-bold ml-0.5">|</span>
    </span>
  );
};

export const Header: React.FC<HeaderProps> = ({
  user,
  activeTab,
  setActiveTab,
  onLogout,
  onStationChange
}) => {
  if (!user) return null;

  return (
    <header className="sticky top-0 z-50 bg-slate-900/95 backdrop-blur-md border-b border-amber-500/30 text-white shadow-xl">
      <div className="max-w-md mx-auto px-3.5 py-2 flex items-center justify-between">
        {/* Brand & Officer Badge */}
        <div className="flex items-center gap-2.5">
          <div className="relative">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-navy-800 to-blue-900 border border-amber-400/40 flex items-center justify-center shadow-lg shadow-blue-950/50">
              <Plane className="w-5 h-5 text-amber-400 transform -rotate-45" />
            </div>
            <span className="absolute -bottom-1 -right-1 flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500 border border-slate-900"></span>
            </span>
          </div>

          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-extrabold tracking-wider text-sm bg-gradient-to-r from-amber-300 via-yellow-200 to-white bg-clip-text text-transparent">
                US-BANGLA
              </span>
              <span className="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded bg-blue-950 border border-blue-500/40 text-blue-300">
                RAMP HUD
              </span>
            </div>
            <div className="flex items-center gap-1 text-[11px] text-slate-300 font-medium">
              <ShieldCheck className="w-3 h-3 text-emerald-400" />
              <span className="truncate max-w-[90px]">{user.name}</span>
              <span className="text-slate-500">•</span>
              <span className="text-amber-400 font-mono">ID-{user.id}</span>
            </div>
            <TypewriterText text="invented by radoan rasel" />
          </div>
        </div>

        {/* Station Picker & Logout */}
        <div className="flex items-center gap-1.5">
          <select
            value={user.station}
            onChange={(e) => onStationChange(e.target.value as StationCode)}
            className="bg-slate-800/90 text-amber-300 text-xs font-bold border border-amber-500/30 rounded-lg px-2 py-1.5 outline-none focus:ring-1 focus:ring-amber-400 cursor-pointer"
          >
            {stationList.map((st) => (
              <option key={st.code} value={st.code} className="bg-slate-900 text-white">
                {st.code}
              </option>
            ))}
          </select>

          <button
            onClick={onLogout}
            title="Logout Officer"
            className="p-1.5 rounded-lg bg-red-950/60 border border-red-500/30 text-red-300 hover:bg-red-900/80 active:scale-95 transition-all"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  );
};
